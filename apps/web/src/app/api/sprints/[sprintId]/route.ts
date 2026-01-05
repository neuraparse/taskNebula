import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { db, sprints, issues, workflowStatuses, projects, projectMembers, organizationMembers, users, ROLE_DEFAULT_PERMISSIONS, type ProjectRole } from '@tasknebula/db';
import { eq, count, and, ne } from 'drizzle-orm';

// Granular permission check helper
async function checkSprintPermission(
  userId: string,
  projectId: string,
  action: 'view' | 'manage' | 'start' | 'complete' | 'delete'
): Promise<{ allowed: boolean; reason?: string }> {
  // Get user super admin status
  const [user] = await db
    .select({ isSuperAdmin: users.isSuperAdmin })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);

  if (user?.isSuperAdmin) {
    return { allowed: true };
  }

  // Get project with organization
  const [project] = await db
    .select({
      id: projects.id,
      organizationId: projects.organizationId,
    })
    .from(projects)
    .where(eq(projects.id, projectId))
    .limit(1);

  if (!project) {
    return { allowed: false, reason: 'Project not found' };
  }

  // Check organization membership
  const [orgMember] = await db
    .select({ role: organizationMembers.role })
    .from(organizationMembers)
    .where(
      and(
        eq(organizationMembers.userId, userId),
        eq(organizationMembers.organizationId, project.organizationId)
      )
    )
    .limit(1);

  // Org owners have full access
  if (orgMember?.role === 'owner') {
    return { allowed: true };
  }

  // Get project membership with all permission columns
  const [projectMember] = await db
    .select()
    .from(projectMembers)
    .where(
      and(
        eq(projectMembers.userId, userId),
        eq(projectMembers.projectId, projectId)
      )
    )
    .limit(1);

  if (!projectMember) {
    if (orgMember?.role === 'admin' && action === 'view') {
      return { allowed: true };
    }
    return { allowed: false, reason: 'Not a project member' };
  }

  if (action === 'view') {
    return { allowed: true };
  }

  // Get role defaults
  const roleDefaults = ROLE_DEFAULT_PERMISSIONS[projectMember.role as ProjectRole] || ROLE_DEFAULT_PERMISSIONS.viewer;
  const toBool = (val: string | null | undefined): boolean => val === 'true';

  // Check specific permissions based on action
  switch (action) {
    case 'manage':
      if (toBool(projectMember.canManageSprints) || roleDefaults.canManageSprints) {
        return { allowed: true };
      }
      return { allowed: false, reason: 'No permission to manage sprints' };

    case 'start':
      if (toBool(projectMember.canStartSprint) || roleDefaults.canStartSprint) {
        return { allowed: true };
      }
      return { allowed: false, reason: 'No permission to start sprints' };

    case 'complete':
      if (toBool(projectMember.canCompleteSprint) || roleDefaults.canCompleteSprint) {
        return { allowed: true };
      }
      return { allowed: false, reason: 'No permission to complete sprints' };

    case 'delete':
      if (toBool(projectMember.canDeleteSprint) || roleDefaults.canDeleteSprint) {
        return { allowed: true };
      }
      return { allowed: false, reason: 'No permission to delete sprints' };

    default:
      return { allowed: false, reason: 'Unknown action' };
  }
}

// GET /api/sprints/[sprintId]
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ sprintId: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { sprintId } = await params;

  try {
    const [sprint] = await db
      .select()
      .from(sprints)
      .where(eq(sprints.id, sprintId))
      .limit(1);

    if (!sprint) {
      return NextResponse.json({ error: 'Sprint not found' }, { status: 404 });
    }

    // Get issue count and completion stats
    const sprintIssues = await db
      .select({
        id: issues.id,
        statusCategory: workflowStatuses.category,
      })
      .from(issues)
      .leftJoin(workflowStatuses, eq(issues.statusId, workflowStatuses.id))
      .where(eq(issues.sprintId, sprintId));

    const issueCount = sprintIssues.length;
    const completedCount = sprintIssues.filter((i) => i.statusCategory === 'done').length;
    const inProgressCount = sprintIssues.filter((i) => i.statusCategory === 'in_progress').length;

    return NextResponse.json({
      ...sprint,
      issueCount,
      completedCount,
      inProgressCount,
      todoCount: issueCount - completedCount - inProgressCount,
    });
  } catch (error) {
    console.error('Error fetching sprint:', error);
    return NextResponse.json({ error: 'Failed to fetch sprint' }, { status: 500 });
  }
}

// PATCH /api/sprints/[sprintId]
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ sprintId: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { sprintId } = await params;

  try {
    const body = await request.json();
    const { name, goal, startDate, endDate, status } = body;

    // Fetch current sprint to get projectId
    const [currentSprint] = await db
      .select()
      .from(sprints)
      .where(eq(sprints.id, sprintId))
      .limit(1);

    if (!currentSprint) {
      return NextResponse.json({ error: 'Sprint not found' }, { status: 404 });
    }

    // Determine required permission based on status change
    let requiredAction: 'manage' | 'start' | 'complete' = 'manage';
    if (status === 'active' && currentSprint.status !== 'active') {
      requiredAction = 'start';
    } else if (status === 'completed' && currentSprint.status === 'active') {
      requiredAction = 'complete';
    }

    // Check permission
    const permission = await checkSprintPermission(session.user.id, currentSprint.projectId, requiredAction);
    if (!permission.allowed) {
      return NextResponse.json(
        { error: permission.reason || 'Permission denied' },
        { status: 403 }
      );
    }

    // If trying to activate sprint, check for other active sprints in the same project
    if (status === 'active' && currentSprint.status !== 'active') {
      const [existingActiveSprint] = await db
        .select({ id: sprints.id, name: sprints.name })
        .from(sprints)
        .where(
          and(
            eq(sprints.projectId, currentSprint.projectId),
            eq(sprints.status, 'active'),
            ne(sprints.id, sprintId)
          )
        )
        .limit(1);

      if (existingActiveSprint) {
        return NextResponse.json(
          {
            error: `Cannot start sprint. "${existingActiveSprint.name}" is already active. Complete or close it first.`,
          },
          { status: 400 }
        );
      }
    }

    // Validate dates if provided
    const newStartDate = startDate ? new Date(startDate) : currentSprint.startDate;
    const newEndDate = endDate ? new Date(endDate) : currentSprint.endDate;

    if (newEndDate <= newStartDate) {
      return NextResponse.json(
        { error: 'End date must be after start date' },
        { status: 400 }
      );
    }

    const updateData: Record<string, unknown> = {
      updatedBy: session.user.id,
      updatedAt: new Date(),
    };

    if (name !== undefined) updateData.name = name;
    if (goal !== undefined) updateData.goal = goal;
    if (startDate !== undefined) updateData.startDate = newStartDate;
    if (endDate !== undefined) updateData.endDate = newEndDate;
    if (status !== undefined) updateData.status = status;

    // If completing sprint, move incomplete issues to backlog
    if (status === 'completed' && currentSprint.status === 'active') {
      // Get incomplete issues (not in 'done' category)
      const sprintIssues = await db
        .select({
          issueId: issues.id,
          statusCategory: workflowStatuses.category,
        })
        .from(issues)
        .leftJoin(workflowStatuses, eq(issues.statusId, workflowStatuses.id))
        .where(eq(issues.sprintId, sprintId));

      const incompleteIssueIds = sprintIssues
        .filter((i) => i.statusCategory !== 'done')
        .map((i) => i.issueId);

      // Move incomplete issues to backlog (remove from sprint)
      if (incompleteIssueIds.length > 0) {
        for (const issueId of incompleteIssueIds) {
          await db
            .update(issues)
            .set({ sprintId: null, updatedAt: new Date(), updatedBy: session.user.id })
            .where(eq(issues.id, issueId));
        }
      }
    }

    const [updatedSprint] = await db
      .update(sprints)
      .set(updateData)
      .where(eq(sprints.id, sprintId))
      .returning();

    // Include stats about moved issues if sprint was completed
    const response: Record<string, unknown> = { ...updatedSprint };
    if (status === 'completed' && currentSprint.status === 'active') {
      const sprintIssues = await db
        .select({
          issueId: issues.id,
          statusCategory: workflowStatuses.category,
        })
        .from(issues)
        .leftJoin(workflowStatuses, eq(issues.statusId, workflowStatuses.id))
        .where(eq(issues.sprintId, sprintId));

      response.completedIssuesCount = sprintIssues.filter((i) => i.statusCategory === 'done').length;
      response.movedToBacklogCount = 0; // Already moved, so this is informational
    }

    return NextResponse.json(response);
  } catch (error) {
    console.error('Error updating sprint:', error);
    return NextResponse.json({ error: 'Failed to update sprint' }, { status: 500 });
  }
}

// DELETE /api/sprints/[sprintId]
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ sprintId: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { sprintId } = await params;

  try {
    // Get sprint to check project
    const [sprint] = await db
      .select({ projectId: sprints.projectId })
      .from(sprints)
      .where(eq(sprints.id, sprintId))
      .limit(1);

    if (!sprint) {
      return NextResponse.json({ error: 'Sprint not found' }, { status: 404 });
    }

    // Check permission to delete sprints
    const permission = await checkSprintPermission(session.user.id, sprint.projectId, 'delete');
    if (!permission.allowed) {
      return NextResponse.json(
        { error: permission.reason || 'Permission denied' },
        { status: 403 }
      );
    }

    // Check if sprint has issues
    const [issueCount] = await db
      .select({ count: count() })
      .from(issues)
      .where(eq(issues.sprintId, sprintId));

    if (issueCount && issueCount.count > 0) {
      return NextResponse.json(
        { error: 'Cannot delete sprint with assigned issues' },
        { status: 400 }
      );
    }

    const [deletedSprint] = await db
      .delete(sprints)
      .where(eq(sprints.id, sprintId))
      .returning();

    if (!deletedSprint) {
      return NextResponse.json({ error: 'Sprint not found' }, { status: 404 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting sprint:', error);
    return NextResponse.json({ error: 'Failed to delete sprint' }, { status: 500 });
  }
}

