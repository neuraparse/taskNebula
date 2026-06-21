import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { db, issues, sprints, workflowStatuses } from '@tasknebula/db';
import { eq, and, count, sql } from 'drizzle-orm';
import { resolveProjectAccess } from '@/lib/auth/project-access';

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
    const access = await resolveProjectAccess(session.user.id, projectId);
    if (!access.project || !access.canRead) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }
    const resolvedProjectId = access.project.id;

    // Total issues
    const [totalIssuesData] = await db
      .select({ count: count() })
      .from(issues)
      .where(eq(issues.projectId, resolvedProjectId));

    const totalIssues = totalIssuesData?.count || 0;

    // Issues by status — resolve the statusId (a CUID) to the human-readable
    // workflow status name + color so the chart never renders raw ids.
    const issuesByStatus = await db
      .select({
        statusId: issues.statusId,
        name: workflowStatuses.name,
        color: workflowStatuses.color,
        category: workflowStatuses.category,
        count: count(),
      })
      .from(issues)
      .leftJoin(workflowStatuses, eq(issues.statusId, workflowStatuses.id))
      .where(eq(issues.projectId, resolvedProjectId))
      .groupBy(
        issues.statusId,
        workflowStatuses.name,
        workflowStatuses.color,
        workflowStatuses.category
      );

    // Issues by priority
    const issuesByPriority = await db
      .select({
        priority: issues.priority,
        count: count(),
      })
      .from(issues)
      .where(eq(issues.projectId, resolvedProjectId))
      .groupBy(issues.priority);

    // Issues by type
    const issuesByType = await db
      .select({
        type: issues.type,
        count: count(),
      })
      .from(issues)
      .where(eq(issues.projectId, resolvedProjectId))
      .groupBy(issues.type);

    // Sprint statistics
    const [totalSprintsData] = await db
      .select({ count: count() })
      .from(sprints)
      .where(eq(sprints.projectId, resolvedProjectId));

    const [activeSprintsData] = await db
      .select({ count: count() })
      .from(sprints)
      .where(and(eq(sprints.projectId, resolvedProjectId), eq(sprints.status, 'active')));

    const [completedSprintsData] = await db
      .select({ count: count() })
      .from(sprints)
      .where(and(eq(sprints.projectId, resolvedProjectId), eq(sprints.status, 'completed')));

    // Overdue issues (issues with dueDate in the past and not done)
    // statusId references workflowStatuses.id (cuid) — not a literal 'done'
    // string — so we must join and filter by the status category.
    const [overdueIssuesData] = await db
      .select({ count: count() })
      .from(issues)
      .leftJoin(workflowStatuses, eq(issues.statusId, workflowStatuses.id))
      .where(
        and(
          eq(issues.projectId, resolvedProjectId),
          sql`${issues.dueDate} < NOW()`,
          sql`(${workflowStatuses.category} IS NULL OR ${workflowStatuses.category} != 'done')`
        )
      );

    // Unassigned issues
    const [unassignedIssuesData] = await db
      .select({ count: count() })
      .from(issues)
      .where(and(eq(issues.projectId, resolvedProjectId), sql`${issues.assigneeId} IS NULL`));

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
        status: item.statusId ?? 'unknown',
        name: item.name ?? null,
        color: item.color ?? null,
        category: item.category ?? null,
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
