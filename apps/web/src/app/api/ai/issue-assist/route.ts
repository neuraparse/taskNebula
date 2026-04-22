import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { and, desc, eq } from 'drizzle-orm';
import {
  createAuditLog,
  db,
  issueComments,
  issues,
  organizationMembers,
  organizations,
  projects,
  users,
} from '@tasknebula/db';
import { auth } from '@/auth';
import { aiDisabledResponse, isAiFeatureEnabled } from '@/lib/ai/feature-gate';
import { AiDraftError, type DraftProvider } from '@/lib/ai/draft-issue';
import {
  ISSUE_ASSIST_ACTIONS,
  runIssueAssist,
  type IssueAssistAction,
} from '@/lib/ai/issue-assist';
import { getSystemAgentControlSettingsFromDb } from '@/lib/agents/system';
import { resolveProviderApiKeyFromSettings } from '@/lib/agents/credentials';
import { normalizeWorkspaceAgentSettings } from '@/lib/agents/config';

export const dynamic = 'force-dynamic';

const bodySchema = z.object({
  issueId: z.string().min(1),
  action: z.enum(ISSUE_ASSIST_ACTIONS),
  customPrompt: z.string().max(2000).nullable().optional(),
  provider: z.enum(['native', 'openai', 'anthropic']).optional(),
});

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
  const a = tryProvider('anthropic');
  if (a) return { provider: 'anthropic', apiKey: a };
  const o = tryProvider('openai');
  if (o) return { provider: 'openai', apiKey: o };
  return { provider: 'native', apiKey: null };
}

export async function POST(request: NextRequest) {
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

  const [issue] = await db
    .select({
      id: issues.id,
      key: issues.key,
      type: issues.type,
      title: issues.title,
      description: issues.description,
      priority: issues.priority,
      labels: issues.labels,
      projectId: issues.projectId,
      organizationId: issues.organizationId,
    })
    .from(issues)
    .where(eq(issues.id, body.issueId))
    .limit(1);

  if (!issue) {
    return NextResponse.json({ error: 'Issue not found' }, { status: 404 });
  }

  // Access: super-admin bypass, else must be a member of the issue's org.
  const [user] = await db
    .select({ isSuperAdmin: users.isSuperAdmin })
    .from(users)
    .where(eq(users.id, session.user.id))
    .limit(1);
  if (!user?.isSuperAdmin) {
    const [orgMember] = await db
      .select({ role: organizationMembers.role })
      .from(organizationMembers)
      .where(
        and(
          eq(organizationMembers.userId, session.user.id),
          eq(organizationMembers.organizationId, issue.organizationId)
        )
      )
      .limit(1);
    if (!orgMember) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }
  }

  const [org] = await db
    .select({ settings: organizations.settings })
    .from(organizations)
    .where(eq(organizations.id, issue.organizationId))
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

  const [project] = await db
    .select({ id: projects.id })
    .from(projects)
    .where(eq(projects.id, issue.projectId))
    .limit(1);

  // Recent comments for summarize context.
  const recent = await db
    .select({
      content: issueComments.content,
      createdAt: issueComments.createdAt,
      authorName: users.name,
      authorEmail: users.email,
    })
    .from(issueComments)
    .leftJoin(users, eq(users.id, issueComments.createdBy))
    .where(eq(issueComments.issueId, issue.id))
    .orderBy(desc(issueComments.createdAt))
    .limit(8);

  const { provider, apiKey } = await resolveProviderAndKey(
    body.provider,
    issue.organizationId
  );
  const modelToUse = workspace.model?.trim() || null;

  try {
    const result = await runIssueAssist({
      action: body.action as IssueAssistAction,
      provider,
      apiKey,
      model: modelToUse,
      issue: {
        key: issue.key,
        type: issue.type,
        title: issue.title,
        description: issue.description,
        priority: issue.priority,
        labels: (issue.labels as string[] | null) ?? [],
      },
      recentComments: recent.map((c) => ({
        author: c.authorName || c.authorEmail || 'unknown',
        body: c.content,
        at: new Date(c.createdAt).toISOString(),
      })),
      customPrompt: body.customPrompt ?? null,
    });

    await createAuditLog({
      userId: session.user.id,
      organizationId: issue.organizationId,
      action: 'agent.run_completed',
      resourceType: 'issue',
      resourceId: issue.id,
      projectId: project?.id ?? issue.projectId,
      issueId: issue.id,
      metadata: {
        kind: 'issue_assist',
        subAction: body.action,
        provider,
      },
    }).catch(() => {});

    return NextResponse.json({ ...result, provider });
  } catch (err) {
    if (err instanceof AiDraftError) {
      await createAuditLog({
        userId: session.user.id,
        organizationId: issue.organizationId,
        action: 'agent.run_failed',
        resourceType: 'issue',
        resourceId: issue.id,
        projectId: project?.id ?? issue.projectId,
        issueId: issue.id,
        metadata: {
          kind: 'issue_assist',
          subAction: body.action,
          provider,
          errorCode: err.code,
        },
      }).catch(() => {});
      return NextResponse.json(
        { error: err.message, code: err.code },
        { status: err.code === 'missing_credential' ? 412 : 502 }
      );
    }
    console.error('[issue-assist] unexpected error', err);
    return NextResponse.json({ error: 'Unexpected error' }, { status: 500 });
  }
}
