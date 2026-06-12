import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { db, issueStatusHistory, workflowStatuses } from '@tasknebula/db';
import { eq, asc } from 'drizzle-orm';
import { computeTimeInStatus } from '@/lib/issues/time-in-status';
import { canReadIssue, isActiveOrganizationMember } from '@/lib/auth/access-control';

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

  // Permission check: caller must be able to read the issue. Missing issues
  // and cross-org probes both get a 404 so we don't leak that the issue
  // exists; in-org callers without project access get a 403.
  const access = await canReadIssue(session.user.id, issueId);
  if (!access.issue) {
    return NextResponse.json({ error: 'Issue not found' }, { status: 404 });
  }
  if (!access.allowed) {
    const sameOrg = await isActiveOrganizationMember(session.user.id, access.issue.organizationId);
    return NextResponse.json(
      { error: sameOrg ? 'Forbidden' : 'Issue not found' },
      { status: sameOrg ? 403 : 404 }
    );
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
