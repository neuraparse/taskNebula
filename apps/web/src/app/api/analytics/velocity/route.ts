import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { db, sprints, issues } from '@tasknebula/db';
import { eq, and, sql } from 'drizzle-orm';

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
    // Fetch completed sprints with aggregated issue metrics in a single query
    const rows = await db
      .select({
        id: sprints.id,
        name: sprints.name,
        startDate: sprints.startDate,
        endDate: sprints.endDate,
        completedIssues: sql<number>`COALESCE(SUM(CASE WHEN ${issues.statusId} = 'done' THEN 1 ELSE 0 END), 0)`,
        completedPoints: sql<number>`COALESCE(SUM(CASE WHEN ${issues.statusId} = 'done' THEN ${issues.estimate} ELSE 0 END), 0)`,
      })
      .from(sprints)
      .leftJoin(issues, eq(issues.sprintId, sprints.id))
      .where(and(eq(sprints.projectId, projectId), eq(sprints.status, 'completed')))
      .groupBy(sprints.id, sprints.name, sprints.startDate, sprints.endDate)
      .orderBy(sprints.startDate);

    const velocityData = rows.map((row) => ({
      sprintId: row.id,
      sprintName: row.name,
      startDate: row.startDate,
      endDate: row.endDate,
      completedIssues: Number(row.completedIssues) || 0,
      completedPoints: Number(row.completedPoints) || 0,
    }));

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

