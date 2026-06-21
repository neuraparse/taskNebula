import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { db, sprints, issues, workflowStatuses, projects } from '@tasknebula/db';
import { eq } from 'drizzle-orm';
import { differenceInDays, addDays, format } from 'date-fns';
import { canReadProject } from '@/lib/auth/access-control';

// GET /api/analytics/burndown?sprintId=xxx[&unit=points|hours]
//
// task #10: when `unit=hours` (or when the caller doesn't pass `unit` but the
// sprint has *any* issue with a non-null `actual_hours`), we additionally
// surface hour-denominated totals alongside the existing story-point numbers.
// The default response shape is unchanged so existing chart code keeps working.
export async function GET(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const sprintId = searchParams.get('sprintId');
  const unitParam = searchParams.get('unit'); // null | 'points' | 'hours'

  if (!sprintId) {
    return NextResponse.json({ error: 'Sprint ID is required' }, { status: 400 });
  }

  try {
    // Fetch sprint
    const [sprint] = await db.select().from(sprints).where(eq(sprints.id, sprintId));

    if (!sprint) {
      return NextResponse.json({ error: 'Sprint not found' }, { status: 404 });
    }

    const [project] = await db
      .select()
      .from(projects)
      .where(eq(projects.id, sprint.projectId))
      .limit(1);

    if (!project || !(await canReadProject(session.user.id, project))) {
      return NextResponse.json({ error: 'Sprint not found' }, { status: 404 });
    }

    // Fetch all issues in sprint with their workflow status
    const sprintIssues = await db
      .select({
        id: issues.id,
        estimate: issues.estimate,
        estimateHours: issues.estimateHours,
        actualHours: issues.actualHours,
        statusId: issues.statusId,
        updatedAt: issues.updatedAt,
        statusCategory: workflowStatuses.category,
      })
      .from(issues)
      .leftJoin(workflowStatuses, eq(issues.statusId, workflowStatuses.id))
      .where(eq(issues.sprintId, sprintId));

    const totalPoints = sprintIssues.reduce((sum, issue) => sum + (issue.estimate || 0), 0);
    const totalIssues = sprintIssues.length;

    // Hour-based totals (task #10). Only meaningful when the team has populated
    // estimate_hours / actual_hours. We always compute these — the response
    // includes them only when there's signal, so old clients don't see noise.
    const totalEstimateHours = sprintIssues.reduce(
      (sum, issue) => sum + Number(issue.estimateHours ?? 0),
      0
    );
    const totalActualHours = sprintIssues.reduce(
      (sum, issue) => sum + Number(issue.actualHours ?? 0),
      0
    );
    const completedActualHours = sprintIssues
      .filter((issue) => issue.statusCategory === 'done')
      .reduce((sum, issue) => sum + Number(issue.actualHours ?? 0), 0);
    const hasHourData = totalEstimateHours > 0 || totalActualHours > 0;

    // Calculate ideal burndown
    const startDate = new Date(sprint.startDate);
    const endDate = new Date(sprint.endDate);
    const totalDays = differenceInDays(endDate, startDate);

    // Prevent division by zero
    const safeTotalDays = Math.max(1, totalDays);

    const idealBurndown = [];
    for (let i = 0; i <= totalDays; i++) {
      const date = addDays(startDate, i);
      const remaining = totalPoints - (totalPoints / safeTotalDays) * i;
      idealBurndown.push({
        date: format(date, 'MMM dd'),
        ideal: Math.max(0, Math.round(remaining)),
      });
    }

    // Calculate actual burndown - use workflow status category 'done'
    const completedPoints = sprintIssues
      .filter((issue) => issue.statusCategory === 'done')
      .reduce((sum, issue) => sum + (issue.estimate || 0), 0);

    const completedIssues = sprintIssues.filter((issue) => issue.statusCategory === 'done').length;

    const currentDay = Math.min(totalDays, Math.max(0, differenceInDays(new Date(), startDate)));

    const actualBurndown = idealBurndown.map((item, index) => {
      if (index > currentDay) {
        return { ...item, actual: null };
      }
      // Simplified: linear interpolation to current completion
      const safeCurrentDay = Math.max(1, currentDay);
      const progress = index / safeCurrentDay;
      const burned = completedPoints * progress;
      return {
        ...item,
        actual: Math.round(totalPoints - burned),
      };
    });

    const responseBody: Record<string, unknown> = {
      sprintName: sprint.name,
      startDate: sprint.startDate,
      endDate: sprint.endDate,
      totalPoints,
      totalIssues,
      completedPoints,
      completedIssues,
      remainingPoints: totalPoints - completedPoints,
      remainingIssues: totalIssues - completedIssues,
      burndown: actualBurndown,
    };

    // Additive hour breakdown — only attached when the team is logging hours
    // or when the caller explicitly asked for it. Existing point-only clients
    // see no change.
    if (hasHourData || unitParam === 'hours') {
      responseBody.hours = {
        totalEstimateHours: Math.round(totalEstimateHours * 100) / 100,
        totalActualHours: Math.round(totalActualHours * 100) / 100,
        completedActualHours: Math.round(completedActualHours * 100) / 100,
        remainingEstimateHours: Math.round((totalEstimateHours - completedActualHours) * 100) / 100,
      };
    }

    return NextResponse.json(responseBody);
  } catch (error) {
    console.error('Error fetching burndown data:', error);
    return NextResponse.json({ error: 'Failed to fetch burndown data' }, { status: 500 });
  }
}
