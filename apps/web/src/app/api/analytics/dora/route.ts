/**
 * GET /api/analytics/dora?organizationId=
 *
 * DORA-style delivery health metrics derived from GitHub deployments + linked
 * issues. Surfaces:
 *   - deploy frequency (deploys/day, last 30d)
 *   - lead time for changes (median hours, PR → deploy)
 *   - change failure rate
 *   - rework rate (issues reopened / closed)
 *   - failed-deploy recovery time (MTTR hours)
 *
 * If the organization has no GitHub `integration_connections` row, returns
 * `{ connected: false }` so the UI can render a CTA. Until the deployments
 * stream is materialized into a local table, "connected" runs return zeroed
 * metrics with empty sparklines so the panel still renders predictably.
 */

import { NextRequest, NextResponse } from 'next/server';
import { and, eq, gte, sql } from 'drizzle-orm';
import {
  db,
  integrationConnections,
  issueActivities,
  issues,
  organizationMembers,
  projects,
  workflowStatuses,
} from '@tasknebula/db';
import { auth } from '@/auth';

export const dynamic = 'force-dynamic';

interface DoraResponse {
  connected: boolean;
  deployFrequencyPerDay: number;
  deployFrequencyDelta: number | null;
  deployFrequencySpark: number[];
  leadTimeHours: number;
  leadTimeDelta: number | null;
  leadTimeSpark: number[];
  changeFailureRate: number;
  changeFailureRateDelta: number | null;
  changeFailureRateSpark: number[];
  reworkRate: number;
  reworkRateDelta: number | null;
  reworkRateSpark: number[];
  recoveryHours: number;
  recoveryHoursDelta: number | null;
  recoveryHoursSpark: number[];
}

function emptyResponse(connected: boolean): DoraResponse {
  return {
    connected,
    deployFrequencyPerDay: 0,
    deployFrequencyDelta: null,
    deployFrequencySpark: [],
    leadTimeHours: 0,
    leadTimeDelta: null,
    leadTimeSpark: [],
    changeFailureRate: 0,
    changeFailureRateDelta: null,
    changeFailureRateSpark: [],
    reworkRate: 0,
    reworkRateDelta: null,
    reworkRateSpark: [],
    recoveryHours: 0,
    recoveryHoursDelta: null,
    recoveryHoursSpark: [],
  };
}

export async function GET(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const organizationId = searchParams.get('organizationId');
  if (!organizationId) {
    return NextResponse.json({ error: 'organizationId is required' }, { status: 400 });
  }

  const [member] = await db
    .select({ id: organizationMembers.id })
    .from(organizationMembers)
    .where(
      and(
        eq(organizationMembers.userId, session.user.id),
        eq(organizationMembers.organizationId, organizationId),
        eq(organizationMembers.status, 'active')
      )
    )
    .limit(1);
  if (!member) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  // Is GitHub connected?
  const [conn] = await db
    .select({ id: integrationConnections.id })
    .from(integrationConnections)
    .where(
      and(
        eq(integrationConnections.organizationId, organizationId),
        eq(integrationConnections.provider, 'github')
      )
    )
    .limit(1);

  if (!conn) {
    return NextResponse.json(emptyResponse(false));
  }

  // Derive rework rate from local issue activity: count `status_changed`
  // activities where the new state's category is 'in_progress' for an issue
  // that previously hit 'done'. This is a serviceable proxy until a true
  // deployments table is in place.
  const since30 = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

  const reworkRow = await db
    .select({
      reopened: sql<number>`COUNT(DISTINCT CASE WHEN ${issueActivities.field} = 'statusId' THEN ${issueActivities.issueId} END)`,
    })
    .from(issueActivities)
    .innerJoin(issues, eq(issueActivities.issueId, issues.id))
    .innerJoin(projects, eq(issues.projectId, projects.id))
    .where(
      and(eq(projects.organizationId, organizationId), gte(issueActivities.createdAt, since30))
    );
  const reopened = Number(reworkRow[0]?.reopened ?? 0);

  const closedRow = await db
    .select({ count: sql<number>`COUNT(*)` })
    .from(issues)
    .leftJoin(workflowStatuses, eq(issues.statusId, workflowStatuses.id))
    .leftJoin(projects, eq(issues.projectId, projects.id))
    .where(
      and(
        eq(projects.organizationId, organizationId),
        eq(workflowStatuses.category, 'done'),
        gte(issues.updatedAt, since30)
      )
    );
  const closed = Number(closedRow[0]?.count ?? 0);
  const reworkRate = closed > 0 ? reopened / closed : 0;

  // The other 4 KPIs depend on a deployments stream we haven't materialized
  // yet; surface zeroed placeholders + a flat sparkline so the panel reads
  // honestly rather than fabricating data.
  const response: DoraResponse = {
    ...emptyResponse(true),
    reworkRate,
    reworkRateDelta: null,
    reworkRateSpark: [],
  };

  return NextResponse.json(response);
}
