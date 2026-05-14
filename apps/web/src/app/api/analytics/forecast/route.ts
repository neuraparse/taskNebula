/**
 * GET /api/analytics/forecast?projectId=
 *
 * Monte Carlo ship-date forecast. Pulls the last 6 completed sprints'
 * throughput and the current backlog (not-done issues without a future
 * sprint association), runs `monteCarloForecast`, and returns p50/p80/p95
 * ship dates plus a histogram for charting.
 */

import { NextRequest, NextResponse } from 'next/server';
import { and, eq, ne, isNull, or, sql } from 'drizzle-orm';
import {
  db,
  issues,
  projects,
  sprints,
  workflowStatuses,
  organizationMembers,
} from '@tasknebula/db';
import { auth } from '@/auth';
import { monteCarloForecast } from '@/lib/analytics/forecast';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const projectId = searchParams.get('projectId');
  const seedParam = searchParams.get('seed');
  const iterationsParam = searchParams.get('iterations');

  if (!projectId) {
    return NextResponse.json(
      { error: 'projectId is required' },
      { status: 400 }
    );
  }

  // Authorize via org membership.
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

  // Throughput per completed sprint, most recent 6.
  const rows = await db
    .select({
      id: sprints.id,
      name: sprints.name,
      startDate: sprints.startDate,
      completed: sql<number>`COALESCE(SUM(CASE WHEN ${workflowStatuses.category} = 'done' THEN 1 ELSE 0 END), 0)`,
    })
    .from(sprints)
    .leftJoin(issues, eq(issues.sprintId, sprints.id))
    .leftJoin(workflowStatuses, eq(issues.statusId, workflowStatuses.id))
    .where(
      and(eq(sprints.projectId, projectId), eq(sprints.status, 'completed'))
    )
    .groupBy(sprints.id, sprints.name, sprints.startDate)
    .orderBy(sql`${sprints.startDate} DESC`)
    .limit(6);

  const throughput = rows
    .map((r: { completed: number | null }) => Number(r.completed) || 0)
    .reverse(); // chronological order

  // Backlog: not-done issues in this project not yet in a completed sprint.
  const backlogRows = await db
    .select({ count: sql<number>`COUNT(*)` })
    .from(issues)
    .leftJoin(workflowStatuses, eq(issues.statusId, workflowStatuses.id))
    .where(
      and(
        eq(issues.projectId, projectId),
        or(
          isNull(workflowStatuses.category),
          ne(workflowStatuses.category, 'done')
        )
      )
    );
  const backlog = Number(backlogRows[0]?.count ?? 0);

  const result = monteCarloForecast({
    throughput,
    backlog,
    iterations: iterationsParam ? Number(iterationsParam) : 1000,
    seed: seedParam ? Number(seedParam) : 0xc0ffee,
    startDate: new Date(),
  });

  return NextResponse.json({
    projectId,
    backlog,
    throughputHistory: throughput,
    ...result,
  });
}
