import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { db, sprints, issues } from '@tasknebula/db';
import { eq, and, count, sum } from 'drizzle-orm';

// GET /api/analytics/velocity?projectId=xxx
export async function GET(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const projectId = searchParams.get('projectId');

  if (!projectId) {
    return NextResponse.json({ error: 'Project ID is required' }, { status: 400 });
  }

  try {
    // Fetch completed sprints with their issues
    const completedSprints = await db
      .select({
        id: sprints.id,
        name: sprints.name,
        startDate: sprints.startDate,
        endDate: sprints.endDate,
      })
      .from(sprints)
      .where(and(eq(sprints.projectId, projectId), eq(sprints.status, 'completed')))
      .orderBy(sprints.startDate);

    // Calculate velocity for each sprint
    const velocityData = await Promise.all(
      completedSprints.map(async (sprint) => {
        // Get completed issues count
        const [completedCount] = await db
          .select({ count: count() })
          .from(issues)
          .where(
            and(
              eq(issues.sprintId, sprint.id),
              eq(issues.statusId, 'done') // Assuming 'done' status
            )
          );

        // Get total story points
        const [pointsData] = await db
          .select({ total: sum(issues.estimate) })
          .from(issues)
          .where(
            and(
              eq(issues.sprintId, sprint.id),
              eq(issues.statusId, 'done')
            )
          );

        return {
          sprintId: sprint.id,
          sprintName: sprint.name,
          startDate: sprint.startDate,
          endDate: sprint.endDate,
          completedIssues: completedCount?.count || 0,
          completedPoints: Number(pointsData?.total) || 0,
        };
      })
    );

    // Calculate average velocity
    const avgIssues =
      velocityData.length > 0
        ? velocityData.reduce((sum, s) => sum + s.completedIssues, 0) / velocityData.length
        : 0;
    const avgPoints =
      velocityData.length > 0
        ? velocityData.reduce((sum, s) => sum + s.completedPoints, 0) / velocityData.length
        : 0;

    return NextResponse.json({
      sprints: velocityData,
      averageVelocity: {
        issues: Math.round(avgIssues * 10) / 10,
        points: Math.round(avgPoints * 10) / 10,
      },
    });
  } catch (error) {
    console.error('Error fetching velocity data:', error);
    return NextResponse.json({ error: 'Failed to fetch velocity data' }, { status: 500 });
  }
}

