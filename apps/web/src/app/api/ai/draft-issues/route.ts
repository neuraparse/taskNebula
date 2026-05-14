import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { and, eq } from 'drizzle-orm';
import {
  createAuditLog,
  db,
  issues,
  notifications,
  organizationMembers,
  organizations,
  projects,
  users,
} from '@tasknebula/db';
import { auth } from '@/auth';
import { aiDisabledResponse, isAiFeatureEnabled } from '@/lib/ai/feature-gate';
import { AiDraftError, type DraftProvider } from '@/lib/ai/draft-issue';
import { draftIssuesMulti } from '@/lib/ai/draft-issues-multi';
import { BudgetExhaustedError } from '@/lib/ai/budget';
import { getSystemAgentControlSettingsFromDb } from '@/lib/agents/system';
import { resolveProviderApiKeyFromSettings } from '@/lib/agents/credentials';
import { normalizeWorkspaceAgentSettings } from '@/lib/agents/config';
import { resolveProjectByIdOrKey } from '@/lib/projects/server';
import { evaluateInjectionRisk } from '@/lib/ai/safety/sandbox';

export const dynamic = 'force-dynamic';

const bodySchema = z.object({
  projectId: z.string().min(1),
  prompt: z.string().min(3).max(6000),
  provider: z.enum(['native', 'openai', 'anthropic']).optional(),
  maxCount: z.number().int().min(1).max(20).optional(),
});

async function userHasProjectAccess(userId: string, projectIdOrKey: string) {
  const [user] = await db
    .select({ isSuperAdmin: users.isSuperAdmin })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);
  if (user?.isSuperAdmin) return true;
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

  const tryProvider = (p: DraftProvider): string | null => {
    if (p === 'native') return null;
    return resolveProviderApiKeyFromSettings(orgSettings, p, platformStore);
  };

  if (requested === 'native') return { provider: 'native', apiKey: null };
  if (requested === 'openai' || requested === 'anthropic') {
    const key = tryProvider(requested);
    if (key) return { provider: requested, apiKey: key };
  }
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
  console.log('[draft-issues] POST received');
  if (!(await isAiFeatureEnabled())) return aiDisabledResponse();

  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let body: z.infer<typeof bodySchema>;
  try {
    body = bodySchema.parse(await request.json());
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

  const project = await resolveProjectByIdOrKey(body.projectId);
  if (!project) {
    return NextResponse.json({ error: 'Project not found' }, { status: 404 });
  }

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
          'AI Assistant is disabled for this workspace. Enable it in Settings → AI & Agents → Quick setup.',
        code: 'assistant_disabled',
      },
      { status: 412 }
    );
  }

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
  const modelToUse = workspace.model?.trim() || null;

  // P1-16
  const safetyMode = workspace.aiSafetyMode ?? 'warn';
  const verdict = await evaluateInjectionRisk(body.prompt, {
    mode: safetyMode,
    anthropicApiKey: provider === 'anthropic' ? apiKey : null,
  });
  if (verdict.flagged) {
    await createAuditLog({
      userId: session.user.id,
      organizationId: project.organizationId,
      action: 'agent.run_failed',
      resourceType: 'project',
      resourceId: project.id,
      projectId: project.id,
      metadata: {
        kind: 'issue_drafts_multi',
        reason: 'injection_suspected',
        score: verdict.score,
        mode: safetyMode,
      },
    }).catch(() => {});
  }
  if (verdict.refuse) {
    return NextResponse.json(
      {
        error:
          'The prompt looks like it might contain instructions aimed at the AI itself. The workspace is in strict safety mode, so the request was blocked.',
        code: 'prompt_injection_suspected',
        score: verdict.score,
      },
      { status: 422 }
    );
  }

  try {
    const drafts = await draftIssuesMulti({
      prompt: body.prompt,
      projectName: project.name,
      projectKey: project.key,
      existingLabels: Array.from(labelSet),
      provider,
      apiKey,
      model: modelToUse,
      maxCount: body.maxCount ?? 5,
      budgetContext: {
        organizationId: project.organizationId,
        userId: session.user.id,
        feature: 'draft_multi',
      },
    });
    console.log('[draft-issues] drafts ok', { count: drafts.length, provider });

    await createAuditLog({
      userId: session.user.id,
      organizationId: project.organizationId,
      action: 'agent.run_completed',
      resourceType: 'project',
      resourceId: project.id,
      projectId: project.id,
      metadata: {
        kind: 'issue_drafts_multi',
        provider,
        count: drafts.length,
        promptChars: body.prompt.length,
      },
    }).catch(() => {});

    return NextResponse.json({ drafts, provider });
  } catch (err) {
    if (err instanceof BudgetExhaustedError) {
      return NextResponse.json(
        { error: err.message, code: 'budget_exhausted', reason: err.code },
        { status: 429 }
      );
    }
    if (err instanceof AiDraftError) {
      console.warn('[draft-issues] AiDraftError', { code: err.code, message: err.message });
      await createAuditLog({
        userId: session.user.id,
        organizationId: project.organizationId,
        action: 'agent.run_failed',
        resourceType: 'project',
        resourceId: project.id,
        projectId: project.id,
        metadata: {
          kind: 'issue_drafts_multi',
          provider,
          errorCode: err.code,
        },
      }).catch(() => {});

      const actionHint =
        err.code === 'missing_credential'
          ? ' Open Settings → AI & Agents to add a key.'
          : ' Check Settings → AI & Agents for details.';
      try {
        await db.insert(notifications).values({
          userId: session.user.id,
          type: 'ai_draft_failed',
          title: 'AI multi-draft failed',
          message: `${provider} · ${err.message.slice(0, 200)}${actionHint}`,
          projectId: project.id,
        });
      } catch {
        // swallow notify errors
      }

      return NextResponse.json(
        { error: err.message, code: err.code },
        { status: err.code === 'missing_credential' ? 412 : 502 }
      );
    }
    console.error('[draft-issues] unexpected error', err);
    return NextResponse.json({ error: 'Unexpected error' }, { status: 500 });
  }
}
