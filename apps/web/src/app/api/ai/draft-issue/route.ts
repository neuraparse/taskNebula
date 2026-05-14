import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { and, eq } from 'drizzle-orm';
import {
  createAuditLog,
  db,
  notifications,
  organizationMembers,
  projects,
  users,
  issues,
  organizations,
} from '@tasknebula/db';
import { auth } from '@/auth';
import { aiDisabledResponse, isAiFeatureEnabled } from '@/lib/ai/feature-gate';
import {
  AiDraftError,
  draftIssue,
  type DraftProvider,
} from '@/lib/ai/draft-issue';
import { BudgetExhaustedError } from '@/lib/ai/budget';
import { getSystemAgentControlSettingsFromDb } from '@/lib/agents/system';
import { resolveProviderApiKeyFromSettings } from '@/lib/agents/credentials';
import { normalizeWorkspaceAgentSettings } from '@/lib/agents/config';
import { resolveProjectByIdOrKey } from '@/lib/projects/server';

export const dynamic = 'force-dynamic';

const bodySchema = z.object({
  projectId: z.string().min(1),
  prompt: z.string().min(3).max(4000),
  provider: z.enum(['native', 'openai', 'anthropic']).optional(),
});

async function userHasProjectAccess(userId: string, projectIdOrKey: string) {
  const [user] = await db
    .select({ isSuperAdmin: users.isSuperAdmin })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);
  if (user?.isSuperAdmin) return true;

  // Accept the URL segment whether it's a canonical cuid ID or a project
  // key (e.g. /projects/N/backlog). Other issue routes already do this via
  // resolveProjectByIdOrKey; draft-issue must match.
  const project = await resolveProjectByIdOrKey(projectIdOrKey);
  if (!project) return false;

  const [orgMember] = await db
    .select({ role: organizationMembers.role })
    .from(organizationMembers)
    .where(
      and(
        eq(organizationMembers.userId, userId),
        eq(organizationMembers.organizationId, project.organizationId)
      )
    )
    .limit(1);
  return !!orgMember;
}

async function resolveProviderAndKey(
  requested: DraftProvider | undefined,
  organizationId: string
): Promise<{ provider: DraftProvider; apiKey: string | null }> {
  const [org] = await db
    .select({ settings: organizations.settings })
    .from(organizations)
    .where(eq(organizations.id, organizationId))
    .limit(1);
  const orgSettings = (org?.settings as Record<string, unknown> | null) || null;

  const system = await getSystemAgentControlSettingsFromDb();
  const platformStore = system.providerCredentials ?? null;

  const workspace = normalizeWorkspaceAgentSettings(
    (orgSettings as { aiAgents?: unknown })?.aiAgents
  );
  const workspaceDefault: DraftProvider =
    workspace.provider === 'anthropic' || workspace.provider === 'openai'
      ? workspace.provider
      : 'native';

  // Explicit request wins if a credential exists; otherwise degrade to native.
  const tryProvider = (p: DraftProvider): string | null => {
    if (p === 'native') return null;
    return resolveProviderApiKeyFromSettings(orgSettings, p, platformStore);
  };

  if (requested === 'native') {
    return { provider: 'native', apiKey: null };
  }
  if (requested === 'openai' || requested === 'anthropic') {
    const key = tryProvider(requested);
    if (key) return { provider: requested, apiKey: key };
  }

  // Auto-select — honor the workspace's saved provider first, then
  // fall through to whichever key is available.
  if (workspaceDefault !== 'native') {
    const key = tryProvider(workspaceDefault);
    if (key) return { provider: workspaceDefault, apiKey: key };
  }
  const anthropic = tryProvider('anthropic');
  if (anthropic) return { provider: 'anthropic', apiKey: anthropic };
  const openai = tryProvider('openai');
  if (openai) return { provider: 'openai', apiKey: openai };

  return { provider: 'native', apiKey: null };
}

export async function POST(request: NextRequest) {
  if (!(await isAiFeatureEnabled())) {
    return aiDisabledResponse();
  }

  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let body: z.infer<typeof bodySchema>;
  try {
    const raw = await request.json();
    body = bodySchema.parse(raw);
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid input', details: err.errors },
        { status: 400 }
      );
    }
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const hasAccess = await userHasProjectAccess(session.user.id, body.projectId);
  if (!hasAccess) {
    return NextResponse.json({ error: 'Project not found or access denied' }, { status: 404 });
  }

  // The URL segment can be either the project id or its key (e.g. "N" for
  // Nowflow). Resolve both so we never reject a legitimate Backlog-page click.
  const project = await resolveProjectByIdOrKey(body.projectId);
  if (!project) {
    return NextResponse.json(
      {
        error: `No project matching "${body.projectId}". Open the project from the Projects list and retry from its Backlog.`,
        code: 'project_not_found',
      },
      { status: 404 }
    );
  }

  // Reject upfront if the workspace's AI toggle is off — admins should
  // see a 412 rather than a drifting silent-fallback draft.
  const [org] = await db
    .select({ settings: organizations.settings })
    .from(organizations)
    .where(eq(organizations.id, project.organizationId))
    .limit(1);
  const workspace = normalizeWorkspaceAgentSettings(
    ((org?.settings as { aiAgents?: unknown } | null) ?? {}).aiAgents
  );
  if (!workspace.assistantEnabled) {
    return NextResponse.json(
      {
        error:
          'AI Assistant is disabled for this workspace. Enable it in Settings → AI & Agents → "AI Assistant".',
        code: 'assistant_disabled',
      },
      { status: 412 }
    );
  }

  // Gather a few existing labels so the LLM can reuse them instead of
  // inventing fresh ones every call.
  const labelRows = await db
    .select({ labels: issues.labels })
    .from(issues)
    .where(eq(issues.projectId, project.id))
    .limit(200);
  const labelSet = new Set<string>();
  for (const row of labelRows) {
    const labels = (row.labels as string[] | null) ?? [];
    for (const label of labels) labelSet.add(label);
    if (labelSet.size >= 60) break;
  }

  const { provider, apiKey } = await resolveProviderAndKey(
    body.provider,
    project.organizationId
  );

  // Respect the workspace-configured model when it's set; if the admin
  // picked, say, claude-opus-4-7, the draft should use that, not the
  // adapter's hardcoded fallback. Empty string → adapter falls back to a
  // sensible default.
  const modelToUse = workspace.model?.trim() || null;

  try {
    const draft = await draftIssue({
      prompt: body.prompt,
      projectName: project.name,
      projectKey: project.key,
      existingLabels: Array.from(labelSet),
      provider,
      apiKey,
      model: modelToUse,
      budgetContext: {
        organizationId: project.organizationId,
        userId: session.user.id,
        feature: 'draft',
      },
    });

    await createAuditLog({
      userId: session.user.id,
      organizationId: project.organizationId,
      action: 'agent.run_completed',
      resourceType: 'project',
      resourceId: project.id,
      projectId: project.id,
      metadata: {
        kind: 'issue_draft',
        provider,
        promptChars: body.prompt.length,
      },
    }).catch(() => {});

    return NextResponse.json({ draft, provider });
  } catch (err) {
    if (err instanceof BudgetExhaustedError) {
      return NextResponse.json(
        {
          error: err.message,
          code: 'budget_exhausted',
          reason: err.code,
        },
        { status: 429 }
      );
    }
    if (err instanceof AiDraftError) {
      await createAuditLog({
        userId: session.user.id,
        organizationId: project.organizationId,
        action: 'agent.run_failed',
        resourceType: 'project',
        resourceId: project.id,
        projectId: project.id,
        metadata: {
          kind: 'issue_draft',
          provider,
          errorCode: err.code,
        },
      }).catch(() => {});

      // Surface the failure as an in-app notification for the caller so
      // it's not lost inside an audit log only an admin sees.
      const actionHint =
        err.code === 'missing_credential'
          ? ' Open Settings → AI & Agents to add a key.'
          : err.code === 'assistant_disabled'
            ? ' Enable AI Assistant in Settings → AI & Agents.'
            : ' Check Settings → AI & Agents for details.';
      try {
        await db.insert(notifications).values({
          userId: session.user.id,
          type: 'ai_draft_failed',
          title: 'AI draft failed',
          message: `${provider} · ${err.message.slice(0, 200)}${actionHint}`,
          projectId: project.id,
        });
      } catch (notifyErr) {
        console.warn('Failed to record ai_draft_failed notification', notifyErr);
      }

      return NextResponse.json(
        { error: err.message, code: err.code },
        { status: err.code === 'missing_credential' ? 412 : 502 }
      );
    }
    console.error('draft-issue unexpected error:', err);
    return NextResponse.json({ error: 'Unexpected error' }, { status: 500 });
  }
}
