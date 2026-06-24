/**
 * POST /api/webhooks/agent-session/[provider]
 *
 * Linear Agent Protocol receiver (P0-04). The provider POSTs an
 * AgentSessionEvent here when its session changes state. We:
 *
 *   1. Verify the HMAC signature against the per-session secret (preferred)
 *      or the provider's shared `hmac_secret`. Signatures must be valid; if
 *      neither matches we 401 and never touch the row.
 *   2. Parse the event with the AgentSessionEventSchema. Schema errors return
 *      400 so misbehaving providers learn fast.
 *   3. Reduce the state machine. Invalid transitions are dropped with a 200
 *      so the provider doesn't retry forever; the row stays put.
 *   4. Update the `agent_sessions` row (state, payload merge, finishedAt for
 *      terminal states).
 *   5. Post a short comment on the linked issue ("Cursor started", "Devin
 *      completed PR #42 → <url>"). The comment is created as the virtual
 *      agent user when one is configured.
 *   6. If the event reports terminal completion, best-effort transition the
 *      issue to the first `in_review` (when a PR is attached) or `done`
 *      workflow status. Transition failures are logged but never surface to
 *      the provider.
 *
 * The route is intentionally permissive about extra fields — providers add
 * metadata over time and we don't want to force a redeploy on every change.
 */

import { NextRequest, NextResponse } from 'next/server';
import {
  agentSessions,
  agentProviders,
  createComment,
  db,
  eq,
  getIssueById,
  issues,
  issueComments,
  workflows,
  workflowStatuses,
  and,
  users,
} from '@tasknebula/db';
import {
  AGENT_PROVIDERS,
  AgentSessionEventSchema,
  nextSessionState,
  renderAgentComment,
  type AgentProviderKind,
  type AgentSessionEvent,
  type AgentSessionState,
  verifyAgentSignature,
  isTerminalState,
} from '@/lib/agents/sessions';

export const dynamic = 'force-dynamic';

function isValidProvider(value: string): value is AgentProviderKind {
  return (AGENT_PROVIDERS as readonly string[]).includes(value);
}

interface VerificationResult {
  ok: boolean;
  session: typeof agentSessions.$inferSelect | null;
  reason?: string;
}

async function loadSessionFromHeaders(
  request: NextRequest,
  provider: AgentProviderKind
): Promise<typeof agentSessions.$inferSelect | null> {
  const sessionId = request.headers.get('x-tasknebula-session-id');
  if (!sessionId) return null;
  const [row] = await db
    .select()
    .from(agentSessions)
    .where(eq(agentSessions.id, sessionId))
    .limit(1);
  return row && row.provider === provider ? row : null;
}

async function loadSessionFromEvent(
  event: AgentSessionEvent,
  provider: AgentProviderKind
): Promise<typeof agentSessions.$inferSelect | null> {
  if (event.sessionId) {
    const [row] = await db
      .select()
      .from(agentSessions)
      .where(eq(agentSessions.id, event.sessionId))
      .limit(1);
    if (row && row.provider === provider) return row;
  }
  if (event.externalId) {
    const [row] = await db
      .select()
      .from(agentSessions)
      .where(
        and(eq(agentSessions.externalId, event.externalId), eq(agentSessions.provider, provider))
      )
      .limit(1);
    if (row) return row;
  }
  return null;
}

async function verifySignature(
  rawBody: string,
  signatureHeader: string | null,
  session: typeof agentSessions.$inferSelect | null,
  workspaceId: string | null,
  provider: AgentProviderKind
): Promise<VerificationResult> {
  if (!signatureHeader) {
    return { ok: false, session, reason: 'Missing signature header' };
  }

  // Prefer the per-session secret — it's tighter scoped (one session, one
  // recipient) and is rotated with each dispatch.
  if (session && verifyAgentSignature(rawBody, signatureHeader, session.signedSecret)) {
    return { ok: true, session };
  }

  // Fall back to the workspace provider's shared secret. We only consult it
  // when we know which workspace the session belongs to; for sessionless
  // payloads (e.g. probe webhooks) this branch is skipped.
  if (workspaceId) {
    const [providerRow] = await db
      .select()
      .from(agentProviders)
      .where(
        and(eq(agentProviders.workspaceId, workspaceId), eq(agentProviders.provider, provider))
      )
      .limit(1);
    if (providerRow && verifyAgentSignature(rawBody, signatureHeader, providerRow.hmacSecret)) {
      return { ok: true, session };
    }
  }

  return { ok: false, session, reason: 'Bad signature' };
}

async function findAgentUser(provider: AgentProviderKind): Promise<string | null> {
  const [agent] = await db
    .select({ id: users.id })
    .from(users)
    .where(and(eq(users.isAgent, true), eq(users.agentProvider, provider)))
    .limit(1);
  return agent?.id ?? null;
}

async function maybeTransitionIssueOnComplete(
  issueId: string,
  organizationId: string,
  event: AgentSessionEvent
): Promise<void> {
  // Look up the org's default workflow.
  const [workflow] = await db
    .select()
    .from(workflows)
    .where(and(eq(workflows.organizationId, organizationId), eq(workflows.isDefault, true)))
    .limit(1);
  if (!workflow) return;

  const statuses = await db
    .select()
    .from(workflowStatuses)
    .where(eq(workflowStatuses.workflowId, workflow.id));

  // If the agent attached a PR, move to in_review; otherwise mark done.
  const targetCategory: 'in_review' | 'done' = event.pullRequest?.url ? 'in_review' : 'done';

  const candidates = statuses
    .filter((s) => s.category === targetCategory)
    .sort((a, b) => a.position - b.position);
  const target = candidates[0];
  if (!target) return;

  try {
    await db
      .update(issues)
      .set({ statusId: target.id, updatedAt: new Date() })
      .where(eq(issues.id, issueId));
  } catch (err) {
    console.warn('[agent-session] failed to transition issue', {
      issueId,
      err: err instanceof Error ? err.message : String(err),
    });
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ provider: string }> }
) {
  const { provider: providerParam } = await params;
  if (!isValidProvider(providerParam)) {
    return NextResponse.json({ error: 'Unknown provider' }, { status: 404 });
  }
  const provider = providerParam;

  const rawBody = await request.text();
  let json: unknown;
  try {
    json = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const parsed = AgentSessionEventSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Invalid AgentSessionEvent', details: parsed.error.errors },
      { status: 400 }
    );
  }
  const event = parsed.data;

  // Locate the session first so we can use its workspace for fallback HMAC.
  const session =
    (await loadSessionFromHeaders(request, provider)) ??
    (await loadSessionFromEvent(event, provider));

  // We need an issue to derive workspace; if no session is known yet we treat
  // the call as unverifiable (the dispatch endpoint always supplies a row).
  let workspaceId: string | null = null;
  if (session) {
    const [issueRow] = await db
      .select({ organizationId: issues.organizationId })
      .from(issues)
      .where(eq(issues.id, session.issueId))
      .limit(1);
    workspaceId = issueRow?.organizationId ?? null;
  }

  const signatureHeader =
    request.headers.get('x-tasknebula-signature') ||
    request.headers.get('x-agent-signature') ||
    request.headers.get('linear-signature');

  const verdict = await verifySignature(rawBody, signatureHeader, session, workspaceId, provider);
  if (!verdict.ok || !session) {
    return NextResponse.json(
      { error: verdict.reason ?? 'Unable to locate session' },
      { status: 401 }
    );
  }

  const currentState = session.state as AgentSessionState;
  const requestedState = event.state;
  const newState = nextSessionState(currentState, requestedState);
  if (!newState) {
    // Drop invalid transitions but don't make the provider retry forever.
    console.warn('[agent-session] dropping invalid transition', {
      sessionId: session.id,
      from: currentState,
      to: requestedState,
    });
    return NextResponse.json({
      ok: true,
      sessionId: session.id,
      state: currentState,
      dropped: true,
      reason: `Invalid transition ${currentState} -> ${requestedState}`,
    });
  }

  const mergedPayload = {
    ...(typeof session.payload === 'object' && session.payload !== null
      ? (session.payload as Record<string, unknown>)
      : {}),
    lastEvent: event,
  };

  await db
    .update(agentSessions)
    .set({
      state: newState,
      externalId: event.externalId ?? session.externalId,
      payload: mergedPayload,
      updatedAt: new Date(),
      finishedAt: isTerminalState(newState) ? new Date() : null,
    })
    .where(eq(agentSessions.id, session.id));

  // Best-effort comment + issue transition. We swallow errors so the provider
  // gets a clean 200 even if our downstream side-effects fail.
  try {
    const issue = await getIssueById(session.issueId);
    if (issue) {
      const agentUserId = (await findAgentUser(provider)) ?? issue.reporterId;
      // The createdBy/updatedBy columns are NOT NULL — fall back to the issue
      // reporter when no virtual agent user has been seeded yet.
      const comment = renderAgentComment(provider, newState, event);
      await createComment({
        issueId: session.issueId,
        content: comment,
        createdBy: agentUserId,
        updatedBy: agentUserId,
      } as typeof issueComments.$inferInsert);

      if (newState === 'complete') {
        await maybeTransitionIssueOnComplete(session.issueId, issue.organizationId, event);
      }
    }
  } catch (err) {
    console.error('[agent-session] downstream side-effect failed', {
      sessionId: session.id,
      err: err instanceof Error ? err.message : String(err),
    });
  }

  return NextResponse.json({
    ok: true,
    sessionId: session.id,
    state: newState,
  });
}
