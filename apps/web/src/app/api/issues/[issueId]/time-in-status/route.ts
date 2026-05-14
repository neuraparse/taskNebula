import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import {
  db,
  issueStatusHistory,
  issues,
  workflowStatuses,
} from '@tasknebula/db';
import { eq, asc } from 'drizzle-orm';
import { computeTimeInStatus } from '@/lib/issues/time-in-status';

/**
 * GET /api/issues/[issueId]/time-in-status
 *
 * Returns the per-status duration breakdown computed from
 * `issue_status_history`. Shape:
 *   [{ status, total_duration_seconds, entered_at_last, exit_count }]
 *
 * The history table was introduced in FEAT-23; older transitions are not
 * backfilled so the response will be empty for issues that haven't moved
 * since the migration shipped.
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ issueId: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { issueId } = await params;

  // Confirm the issue exists so callers get a 404 rather than an empty 200
  // when they typo the id.
  const [issue] = await db
    .select({ id: issues.id })
    .from(issues)
    .where(eq(issues.id, issueId))
    .limit(1);

  if (!issue) {
    return NextResponse.json({ error: 'Issue not found' }, { status: 404 });
  }

  const rows = await db
    .select({
      fromStatus: issueStatusHistory.fromStatus,
      toStatus: issueStatusHistory.toStatus,
      changedAt: issueStatusHistory.changedAt,
    })
    .from(issueStatusHistory)
    .where(eq(issueStatusHistory.issueId, issueId))
    .orderBy(asc(issueStatusHistory.changedAt));

  const buckets = computeTimeInStatus(
    rows.map((r) => ({
      fromStatus: r.fromStatus,
      toStatus: r.toStatus,
      changedAt: r.changedAt,
    }))
  );

  // Hydrate status names so the UI can display "In Progress" instead of an
  // opaque workflow_status id. Statuses are looked up in one round-trip.
  const statusIds = Array.from(new Set(buckets.map((b) => b.status)));
  const statusRows = statusIds.length
    ? await db
        .select({
          id: workflowStatuses.id,
          name: workflowStatuses.name,
          category: workflowStatuses.category,
        })
        .from(workflowStatuses)
    : [];
  const statusMap = new Map(statusRows.map((s) => [s.id, s]));

  const payload = buckets.map((b) => ({
    status: b.status,
    status_name: statusMap.get(b.status)?.name ?? b.status,
    status_category: statusMap.get(b.status)?.category ?? null,
    total_duration_seconds: b.totalDurationSeconds,
    entered_at_last: b.enteredAtLast ? b.enteredAtLast.toISOString() : null,
    exit_count: b.exitCount,
  }));

  return NextResponse.json(payload);
}
