import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { db, issues, sprints } from '@tasknebula/db';
import { eq, and, count, sql } from 'drizzle-orm';

// GET /api/analytics/project-health?projectId=xxx
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
    // Total issues
    const [totalIssuesData] = await db
      .select({ count: count() })
      .from(issues)
      .where(eq(issues.projectId, projectId));

    const totalIssues = totalIssuesData?.count || 0;

    // Issues by status
    const issuesByStatus = await db
      .select({
        status: issues.statusId,
        count: count(),
      })
      .from(issues)
      .where(eq(issues.projectId, projectId))
      .groupBy(issues.statusId);

    // Issues by priority
    const issuesByPriority = await db
      .select({
        priority: issues.priority,
        count: count(),
      })
      .from(issues)
      .where(eq(issues.projectId, projectId))
      .groupBy(issues.priority);

    // Issues by type
    const issuesByType = await db
      .select({
        type: issues.type,
        count: count(),
      })
      .from(issues)
      .where(eq(issues.projectId, projectId))
      .groupBy(issues.type);

    // Sprint statistics
    const [totalSprintsData] = await db
      .select({ count: count() })
      .from(sprints)
      .where(eq(sprints.projectId, projectId));

    const [activeSprintsData] = await db
      .select({ count: count() })
      .from(sprints)
      .where(and(eq(sprints.projectId, projectId), eq(sprints.status, 'active')));

    const [completedSprintsData] = await db
      .select({ count: count() })
      .from(sprints)
      .where(and(eq(sprints.projectId, projectId), eq(sprints.status, 'completed')));

    // Overdue issues (issues with dueDate in the past and not done)
    const [overdueIssuesData] = await db
      .select({ count: count() })
      .from(issues)
      .where(
        and(
          eq(issues.projectId, projectId),
          sql`${issues.dueDate} < NOW()`,
          sql`${issues.statusId} != 'done'`
        )
      );

    // Unassigned issues
    const [unassignedIssuesData] = await db
      .select({ count: count() })
      .from(issues)
      .where(and(eq(issues.projectId, projectId), sql`${issues.assigneeId} IS NULL`));

    return NextResponse.json({
      overview: {
        totalIssues,
        overdueIssues: overdueIssuesData?.count || 0,
        unassignedIssues: unassignedIssuesData?.count || 0,
      },
      sprints: {
        total: totalSprintsData?.count || 0,
        active: activeSprintsData?.count || 0,
        completed: completedSprintsData?.count || 0,
      },
      issuesByStatus: issuesByStatus.map((item) => ({
        status: item.status,
        count: item.count,
      })),
      issuesByPriority: issuesByPriority.map((item) => ({
        priority: item.priority,
        count: item.count,
      })),
      issuesByType: issuesByType.map((item) => ({
        type: item.type,
        count: item.count,
      })),
    });
  } catch (error) {
    console.error('Error fetching project health data:', error);
    return NextResponse.json({ error: 'Failed to fetch project health data' }, { status: 500 });
  }
}

