/**
 * /api/ai/trace/[id] — metadata about a single AI operation used to populate
 * the AiBadge tooltip (model, feature, generatedAt).
 *
 * This is intentionally minimal — it reads the agent_runs row (when the id
 * matches one) or returns 404. Callers that want richer audit data should
 * use the existing /api/agents/runs endpoint.
 */

import { NextResponse } from 'next/server';
import { eq } from 'drizzle-orm';
import { agentRuns, db } from '@tasknebula/db';
import { auth } from '@/auth';
import { isActiveOrganizationMember } from '@/lib/auth/access-control';

export const dynamic = 'force-dynamic';

const KIND_TO_FEATURE: Record<string, string> = {
  project_tracking: 'Project Tracking',
  backlog_triage: 'Backlog Triage',
  sprint_planning: 'Sprint Planning',
  bulk_sprint_creation: 'Sprint Creation',
};

function modelLabelFromOutput(output: unknown): string {
  if (output && typeof output === 'object') {
    const o = output as Record<string, unknown>;
    if (typeof o.model === 'string') return o.model;
    if (typeof o.provider === 'string') return `${o.provider}`;
  }
  return 'Unknown model';
}

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id } = await params;
  const [run] = await db.select().from(agentRuns).where(eq(agentRuns.id, id)).limit(1);

  if (!run) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  if (!(await isActiveOrganizationMember(session.user.id, run.organizationId))) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  // The TaskNebula run log row doesn't yet capture the model name in a
  // first-class column — we synthesise from the output payload.
  return NextResponse.json({
    operationId: run.id,
    feature: KIND_TO_FEATURE[run.kind] ?? run.kind,
    model: modelLabelFromOutput(run.output),
    generatedAt: (run.completedAt ?? run.createdAt).toISOString(),
    workspaceId: run.organizationId,
    reviewedBy: null,
  });
}
