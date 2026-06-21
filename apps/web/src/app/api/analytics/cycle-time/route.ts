/**
 * GET /api/analytics/cycle-time?projectId=&days=
 *
 * Returns a distribution of cycle times (days from issue creation to its
 * most recent transition into a `done` status) for completed issues in
 * the requested window. Used by the CycleTimeHistogram chart.
 */

import { NextRequest, NextResponse } from 'next/server';
import { and, eq, gte, sql } from 'drizzle-orm';
import { db, issueActivities, issues, workflowStatuses } from '@tasknebula/db';
import { auth } from '@/auth';
import { resolveProjectAccess } from '@/lib/auth/project-access';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const projectId = searchParams.get('projectId');
  const daysParam = searchParams.get('days');
  const days = Math.max(1, Math.min(180, Number(daysParam) || 30));

  if (!projectId) {
    return NextResponse.json({ error: 'projectId is required' }, { status: 400 });
  }

  const access = await resolveProjectAccess(session.user.id, projectId);
  if (!access.project || !access.canRead) {
    return NextResponse.json({ error: 'Project not found' }, { status: 404 });
  }
  const resolvedProjectId = access.project.id;

  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

  // Pull issues currently in a `done` status and updated recently. Use the
  // most recent `statusId` activity as the completion timestamp where
  // available; otherwise fall back to issues.updatedAt.
  const rows = await db
    .select({
      id: issues.id,
      createdAt: issues.createdAt,
      updatedAt: issues.updatedAt,
      doneAt: sql<Date | null>`MAX(CASE WHEN ${issueActivities.field} = 'statusId' THEN ${issueActivities.createdAt} END)`,
    })
    .from(issues)
    .leftJoin(workflowStatuses, eq(issues.statusId, workflowStatuses.id))
    .leftJoin(issueActivities, eq(issueActivities.issueId, issues.id))
    .where(
      and(
        eq(issues.projectId, resolvedProjectId),
        eq(workflowStatuses.category, 'done'),
        gte(issues.updatedAt, since)
      )
    )
    .groupBy(issues.id, issues.createdAt, issues.updatedAt);

  const cycleDays: number[] = [];
  for (const row of rows) {
    const start = new Date(row.createdAt).getTime();
    const end = new Date((row.doneAt as Date | null) ?? row.updatedAt).getTime();
    const diff = (end - start) / (1000 * 60 * 60 * 24);
    if (Number.isFinite(diff) && diff >= 0) cycleDays.push(diff);
  }

  const sorted = cycleDays.slice().sort((a, b) => a - b);
  const p50 = sorted[Math.floor(sorted.length * 0.5)] ?? 0;
  const p90 = sorted[Math.floor(sorted.length * 0.9)] ?? 0;

  return NextResponse.json({
    projectId: resolvedProjectId,
    days,
    sampleSize: cycleDays.length,
    values: cycleDays,
    p50,
    p90,
  });
}
