import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { db, sprints, issues, workflowStatuses } from '@tasknebula/db';
import { eq } from 'drizzle-orm';
import { differenceInDays, addDays, format } from 'date-fns';

// GET /api/analytics/burndown?sprintId=xxx
export async function GET(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const sprintId = searchParams.get('sprintId');

  if (!sprintId) {
    return NextResponse.json({ error: 'Sprint ID is required' }, { status: 400 });
  }

  try {
    // Fetch sprint
    const [sprint] = await db.select().from(sprints).where(eq(sprints.id, sprintId));

    if (!sprint) {
      return NextResponse.json({ error: 'Sprint not found' }, { status: 404 });
    }

    // Fetch all issues in sprint with their workflow status
    const sprintIssues = await db
      .select({
        id: issues.id,
        estimate: issues.estimate,
        statusId: issues.statusId,
        updatedAt: issues.updatedAt,
        statusCategory: workflowStatuses.category,
      })
      .from(issues)
      .leftJoin(workflowStatuses, eq(issues.statusId, workflowStatuses.id))
      .where(eq(issues.sprintId, sprintId));

    const totalPoints = sprintIssues.reduce((sum, issue) => sum + (issue.estimate || 0), 0);
    const totalIssues = sprintIssues.length;

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

    const completedIssues = sprintIssues.filter(
      (issue) => issue.statusCategory === 'done'
    ).length;

    const currentDay = Math.min(
      totalDays,
      Math.max(0, differenceInDays(new Date(), startDate))
    );

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

    return NextResponse.json({
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
    });
  } catch (error) {
    console.error('Error fetching burndown data:', error);
    return NextResponse.json({ error: 'Failed to fetch burndown data' }, { status: 500 });
  }
}

