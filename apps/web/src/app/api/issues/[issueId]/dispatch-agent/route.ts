/**
 * POST /api/issues/[issueId]/dispatch-agent
 *
 * Linear Agent Protocol entry point (P0-04). Body:
 *   { provider: 'claude' | 'cursor' | 'devin' | 'copilot' | 'openhands' | 'custom',
 *     prompt_override?: string }
 *
 * Flow:
 *   1. Auth + assign-permission check on the issue.
 *   2. Look up `agent_providers` for the issue's organization/provider; reject
 *      if the provider isn't configured or disabled.
 *   3. Generate a per-session HMAC secret, insert an `agent_sessions` row
 *      (state=pending), build an AgentSessionRequest envelope, sign it with
 *      the provider's `hmac_secret`, and POST to `endpoint_url`.
 *   4. Record the outcome in `agent_sessions.payload` and best-effort flip the
 *      row to `active` on a 2xx (the provider's first event will reconcile).
 *
 * The endpoint is intentionally synchronous: dispatch is small and the caller
 * wants to know whether the provider accepted the handoff. Long-running work
 * happens on the provider side.
 *
 * NOTE: GitHub Copilot Coding Agent has its own dispatch surface
 * (`POST /repos/{owner}/{repo}/copilot/agents/{agent_id}/runs`). We leave a
 * TODO below sketching the call we'd make once that endpoint is exposed to
 * us; for now `provider: 'copilot'` falls through to the generic webhook
 * path and admins are expected to wire a self-hosted bridge.
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import {
  agentProviders,
  agentSessions,
  and,
  db,
  eq,
  getIssueById,
  organizationMembers,
  projectMembers,
  projects,
  ROLE_DEFAULT_PERMISSIONS,
  users,
  type ProjectRole,
} from '@tasknebula/db';
import { auth } from '@/auth';
import {
  AGENT_PROVIDERS,
  generateAgentSecret,
  generateDeliveryId,
  signAgentPayload,
  type AgentProviderKind,
  type AgentSessionRequest,
} from '@/lib/agents/sessions';
import { env } from '@/lib/env';

export const dynamic = 'force-dynamic';

const DISPATCH_TIMEOUT_MS = 10_000;

const bodySchema = z.object({
  provider: z.enum(
    AGENT_PROVIDERS as readonly [AgentProviderKind, ...AgentProviderKind[]]
  ),
  prompt_override: z.string().max(16000).optional(),
});

async function userCanAssign(
  userId: string,
  projectId: string
): Promise<boolean> {
  const [user] = await db
    .select({ isSuperAdmin: users.isSuperAdmin })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);
  if (user?.isSuperAdmin) return true;

  const [project] = await db
    .select({ organizationId: projects.organizationId })
    .from(projects)
    .where(eq(projects.id, projectId))
    .limit(1);
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
  if (orgMember?.role === 'owner') return true;

  const [pm] = await db
    .select()
    .from(projectMembers)
    .where(
      and(
        eq(projectMembers.userId, userId),
        eq(projectMembers.projectId, projectId)
      )
    )
    .limit(1);
  if (!pm) return false;
  const role = pm.role as ProjectRole;
  const defaults = ROLE_DEFAULT_PERMISSIONS[role] || ROLE_DEFAULT_PERMISSIONS.viewer;
  return pm.canAssignIssues === 'true' || defaults.canAssignIssues;
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ issueId: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { issueId } = await params;

  let parsed: z.infer<typeof bodySchema>;
  try {
    parsed = bodySchema.parse(await request.json());
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Validation failed', details: err.errors },
        { status: 400 }
      );
    }
    return NextResponse.json({ error: 'Invalid body' }, { status: 400 });
  }

  const issue = await getIssueById(issueId);
  if (!issue) {
    return NextResponse.json({ error: 'Issue not found' }, { status: 404 });
  }

  const allowed = await userCanAssign(session.user.id, issue.projectId);
  if (!allowed) {
    return NextResponse.json(
      { error: 'No permission to dispatch agents on this issue' },
      { status: 403 }
    );
  }

  // GitHub Copilot Coding Agent bridge — left as a TODO. The actual call would
  // look roughly like the snippet below using the org's GitHub OAuth token
  // from `integration_connections`. Until that bridge ships, `copilot` falls
  // through to the generic webhook flow and admins wire their own runner.
  //
  // TODO(copilot):
  //   const token = decryptGithubAccessToken(orgId);
  //   await fetch(`https://api.github.com/repos/${owner}/${repo}/copilot/agents/${agentId}/runs`, {
  //     method: 'POST',
  //     headers: {
  //       Accept: 'application/vnd.github+json',
  //       Authorization: `Bearer ${token}`,
  //       'X-GitHub-Api-Version': '2022-11-28',
  //     },
  //     body: JSON.stringify({ issue_url: issueUrl, prompt: promptOverride }),
  //   });

  const [provider] = await db
    .select()
    .from(agentProviders)
    .where(
      and(
        eq(agentProviders.workspaceId, issue.organizationId),
        eq(agentProviders.provider, parsed.provider)
      )
    )
    .limit(1);

  if (!provider || !provider.enabled) {
    return NextResponse.json(
      {
        error: `Provider '${parsed.provider}' is not configured for this workspace`,
      },
      { status: 422 }
    );
  }

  const sessionSecret = generateAgentSecret();

  const [created] = await db
    .insert(agentSessions)
    .values({
      issueId,
      provider: parsed.provider,
      state: 'pending',
      signedSecret: sessionSecret,
      payload: {
        dispatchedBy: session.user.id,
        promptOverride: parsed.prompt_override ?? null,
      },
    })
    .returning();

  if (!created) {
    return NextResponse.json(
      { error: 'Failed to create agent session' },
      { status: 500 }
    );
  }

  const callbackUrl = `${env.NEXT_PUBLIC_APP_URL.replace(/\/$/, '')}/api/webhooks/agent-session/${parsed.provider}`;

  const envelope: AgentSessionRequest = {
    sessionId: created.id,
    issue: {
      id: issue.id,
      key: issue.key,
      title: issue.title,
      description: issue.description ?? null,
      priority: issue.priority,
      labels: issue.labels ?? [],
      projectId: issue.projectId,
      organizationId: issue.organizationId,
      url: `${env.NEXT_PUBLIC_APP_URL.replace(/\/$/, '')}/issues/${issue.id}`,
    },
    actorUserId: session.user.id,
    promptOverride: parsed.prompt_override ?? null,
    callbackUrl,
    dispatchedAt: new Date().toISOString(),
  };

  const body = JSON.stringify(envelope);
  const signature = signAgentPayload(body, provider.hmacSecret);
  const deliveryId = generateDeliveryId();

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), DISPATCH_TIMEOUT_MS);

  let status: 'success' | 'failed' = 'failed';
  let statusCode: number | null = null;
  let errorMessage: string | null = null;

  try {
    const resp = await fetch(provider.endpointUrl, {
      method: 'POST',
      signal: controller.signal,
      headers: {
        'Content-Type': 'application/json',
        'X-TaskNebula-Event': 'agent.session.dispatch',
        'X-TaskNebula-Signature': `sha256=${signature}`,
        'X-TaskNebula-Delivery': deliveryId,
        'X-TaskNebula-Session-Id': created.id,
      },
      body,
    });
    statusCode = resp.status;
    status = resp.ok ? 'success' : 'failed';
    if (!resp.ok) errorMessage = `HTTP ${resp.status}`;
  } catch (err) {
    errorMessage =
      err instanceof Error
        ? err.name === 'AbortError'
          ? `Dispatch timed out after ${DISPATCH_TIMEOUT_MS}ms`
          : err.message
        : String(err);
  } finally {
    clearTimeout(timer);
  }

  // Mirror the outcome on the session row. We mark the row `active` on
  // success so the UI shows progress immediately; the provider's first event
  // will overwrite this anyway.
  await db
    .update(agentSessions)
    .set({
      state: status === 'success' ? 'active' : 'error',
      updatedAt: new Date(),
      finishedAt: status === 'success' ? null : new Date(),
      payload: {
        ...(typeof created.payload === 'object' && created.payload !== null
          ? (created.payload as Record<string, unknown>)
          : {}),
        dispatch: {
          deliveryId,
          status,
          statusCode,
          errorMessage,
          endpointUrl: provider.endpointUrl,
        },
      },
    })
    .where(eq(agentSessions.id, created.id));

  if (status !== 'success') {
    return NextResponse.json(
      {
        sessionId: created.id,
        provider: parsed.provider,
        status,
        statusCode,
        error: errorMessage,
      },
      { status: 502 }
    );
  }

  return NextResponse.json({
    sessionId: created.id,
    provider: parsed.provider,
    state: 'active',
    callbackUrl,
  });
}
