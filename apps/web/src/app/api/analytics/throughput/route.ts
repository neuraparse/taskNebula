/**
 * GET /api/analytics/throughput?projectId=&days=&bucket=
 *
 * Returns the number of issues completed per bucket (day or week) over the
 * requested window. Used by ThroughputChart.
 */

import { NextRequest, NextResponse } from 'next/server';
import { and, eq, gte, sql } from 'drizzle-orm';
import {
  db,
  issues,
  organizationMembers,
  projects,
  workflowStatuses,
} from '@tasknebula/db';
import { auth } from '@/auth';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const projectId = searchParams.get('projectId');
  const daysParam = searchParams.get('days');
  const bucket = (searchParams.get('bucket') || 'week').toLowerCase();
  const days = Math.max(7, Math.min(180, Number(daysParam) || 60));

  if (!projectId) {
    return NextResponse.json(
      { error: 'projectId is required' },
      { status: 400 }
    );
  }
  if (bucket !== 'day' && bucket !== 'week') {
    return NextResponse.json(
      { error: 'bucket must be "day" or "week"' },
      { status: 400 }
    );
  }

  const [proj] = await db
    .select({ id: projects.id, organizationId: projects.organizationId })
    .from(projects)
    .where(eq(projects.id, projectId))
    .limit(1);
  if (!proj) {
    return NextResponse.json({ error: 'Project not found' }, { status: 404 });
  }
  const [member] = await db
    .select({ id: organizationMembers.id })
    .from(organizationMembers)
    .where(
      and(
        eq(organizationMembers.userId, session.user.id),
        eq(organizationMembers.organizationId, proj.organizationId)
      )
    )
    .limit(1);
  if (!member) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

  const truncFmt = bucket === 'week' ? "'IYYY-IW'" : "'YYYY-MM-DD'";
  const rows = await db
    .select({
      period: sql<string>`to_char(${issues.updatedAt}, ${sql.raw(truncFmt)})`,
      count: sql<number>`COUNT(*)`,
    })
    .from(issues)
    .leftJoin(workflowStatuses, eq(issues.statusId, workflowStatuses.id))
    .where(
      and(
        eq(issues.projectId, projectId),
        eq(workflowStatuses.category, 'done'),
        gte(issues.updatedAt, since)
      )
    )
    .groupBy(sql`to_char(${issues.updatedAt}, ${sql.raw(truncFmt)})`)
    .orderBy(sql`to_char(${issues.updatedAt}, ${sql.raw(truncFmt)})`);

  return NextResponse.json({
    projectId,
    bucket,
    days,
    data: rows.map((r: { period: string; count: number | null }) => ({
      period: r.period,
      count: Number(r.count) || 0,
    })),
  });
}
