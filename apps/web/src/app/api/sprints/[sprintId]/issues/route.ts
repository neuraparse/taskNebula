import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import {
  db,
  sprints,
  issues,
  workflowStatuses,
  projects,
  projectMembers,
  organizationMembers,
  users,
  ROLE_DEFAULT_PERMISSIONS,
  type ProjectRole,
} from '@tasknebula/db';
import { eq, and } from 'drizzle-orm';
import { publishEvent } from '@/lib/realtime/events';

// Granular permission check helper (mirrors api/sprints/[sprintId]/route.ts —
// Next.js route files may only export handlers, so the helper is duplicated).
async function checkSprintPermission(
  userId: string,
  projectId: string,
  action: 'view' | 'manage'
): Promise<{ allowed: boolean; reason?: string; notFound?: boolean }> {
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
    return { allowed: false, reason: 'Project not found', notFound: true };
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
    .where(and(eq(projectMembers.userId, userId), eq(projectMembers.projectId, projectId)))
    .limit(1);

  if (!projectMember) {
    if (orgMember?.role === 'admin' && action === 'view') {
      return { allowed: true };
    }
    if (!orgMember) {
      // Cross-org probe: report the sprint as not found so its existence
      // is not leaked to other tenants.
      return { allowed: false, reason: 'Sprint not found', notFound: true };
    }
    return { allowed: false, reason: 'Not a project member' };
  }

  if (action === 'view') {
    return { allowed: true };
  }

  // Get role defaults
  const roleDefaults =
    ROLE_DEFAULT_PERMISSIONS[projectMember.role as ProjectRole] || ROLE_DEFAULT_PERMISSIONS.viewer;
  const toBool = (val: string | null | undefined): boolean => val === 'true';

  if (toBool(projectMember.canManageSprints) || roleDefaults.canManageSprints) {
    return { allowed: true };
  }
  return { allowed: false, reason: 'No permission to manage sprints' };
}

// GET /api/sprints/[sprintId]/issues
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ sprintId: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { sprintId } = await params;

  try {
    // Resolve sprint -> project, then verify project access.
    const [sprint] = await db
      .select({ id: sprints.id, projectId: sprints.projectId })
      .from(sprints)
      .where(eq(sprints.id, sprintId))
      .limit(1);

    if (!sprint) {
      return NextResponse.json({ error: 'Sprint not found' }, { status: 404 });
    }

    const permission = await checkSprintPermission(session.user.id, sprint.projectId, 'view');
    if (!permission.allowed) {
      if (permission.notFound) {
        return NextResponse.json({ error: 'Sprint not found' }, { status: 404 });
      }
      return NextResponse.json(
        { error: permission.reason || 'Permission denied' },
        { status: 403 }
      );
    }

    const sprintIssues = await db
      .select({
        id: issues.id,
        organizationId: issues.organizationId,
        projectId: issues.projectId,
        key: issues.key,
        number: issues.number,
        type: issues.type,
        title: issues.title,
        description: issues.description,
        statusId: issues.statusId,
        priority: issues.priority,
        assigneeId: issues.assigneeId,
        reporterId: issues.reporterId,
        labels: issues.labels,
        sprintId: issues.sprintId,
        epicId: issues.epicId,
        parentId: issues.parentId,
        estimate: issues.estimate,
        dueDate: issues.dueDate,
        createdAt: issues.createdAt,
        updatedAt: issues.updatedAt,
        status: workflowStatuses.category,
        statusName: workflowStatuses.name,
        statusColor: workflowStatuses.color,
      })
      .from(issues)
      .leftJoin(workflowStatuses, eq(issues.statusId, workflowStatuses.id))
      .where(eq(issues.sprintId, sprintId));

    return NextResponse.json(sprintIssues);
  } catch (error) {
    console.error('Error fetching sprint issues:', error);
    return NextResponse.json({ error: 'Failed to fetch sprint issues' }, { status: 500 });
  }
}

// POST /api/sprints/[sprintId]/issues
// Assign issue to sprint
export async function POST(
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
    const { issueId } = body;

    if (!issueId) {
      return NextResponse.json({ error: 'Issue ID is required' }, { status: 400 });
    }

    // Resolve sprint -> project, then verify the caller can manage it.
    const [sprint] = await db
      .select({ id: sprints.id, projectId: sprints.projectId })
      .from(sprints)
      .where(eq(sprints.id, sprintId))
      .limit(1);

    if (!sprint) {
      return NextResponse.json({ error: 'Sprint not found' }, { status: 404 });
    }

    const permission = await checkSprintPermission(session.user.id, sprint.projectId, 'manage');
    if (!permission.allowed) {
      if (permission.notFound) {
        return NextResponse.json({ error: 'Sprint not found' }, { status: 404 });
      }
      return NextResponse.json(
        { error: permission.reason || 'Permission denied' },
        { status: 403 }
      );
    }

    // The issue must belong to the sprint's project — otherwise any org's
    // issues could be pulled into any sprint.
    const [issue] = await db
      .select({
        id: issues.id,
        projectId: issues.projectId,
        organizationId: issues.organizationId,
      })
      .from(issues)
      .where(eq(issues.id, issueId))
      .limit(1);

    if (!issue) {
      return NextResponse.json({ error: 'Issue not found' }, { status: 404 });
    }

    if (issue.projectId !== sprint.projectId) {
      const [sprintProject] = await db
        .select({ organizationId: projects.organizationId })
        .from(projects)
        .where(eq(projects.id, sprint.projectId))
        .limit(1);

      // Cross-org issue ids are reported as not found so existence is not
      // leaked; same-org cross-project moves get an explicit 400.
      if (!sprintProject || issue.organizationId !== sprintProject.organizationId) {
        return NextResponse.json({ error: 'Issue not found' }, { status: 404 });
      }
      return NextResponse.json(
        { error: 'Issue does not belong to the sprint project' },
        { status: 400 }
      );
    }

    const [updatedIssue] = await db
      .update(issues)
      .set({
        sprintId,
        updatedAt: new Date(),
        updatedBy: session.user.id,
      })
      .where(and(eq(issues.id, issueId), eq(issues.projectId, sprint.projectId)))
      .returning();

    if (!updatedIssue) {
      return NextResponse.json({ error: 'Issue not found' }, { status: 404 });
    }

    publishEvent('sprint.issues.changed', session.user.id, {
      sprintId,
      organizationId: issue.organizationId,
    });

    return NextResponse.json(updatedIssue);
  } catch (error) {
    console.error('Error assigning issue to sprint:', error);
    return NextResponse.json({ error: 'Failed to assign issue to sprint' }, { status: 500 });
  }
}

// DELETE /api/sprints/[sprintId]/issues/[issueId]
// Remove issue from sprint
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ sprintId: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { sprintId } = await params;
  const { searchParams } = new URL(request.url);
  const issueId = searchParams.get('issueId');

  if (!issueId) {
    return NextResponse.json({ error: 'Issue ID is required' }, { status: 400 });
  }

  try {
    // Resolve sprint -> project, then verify the caller can manage it.
    const [sprint] = await db
      .select({ id: sprints.id, projectId: sprints.projectId })
      .from(sprints)
      .where(eq(sprints.id, sprintId))
      .limit(1);

    if (!sprint) {
      return NextResponse.json({ error: 'Sprint not found' }, { status: 404 });
    }

    const permission = await checkSprintPermission(session.user.id, sprint.projectId, 'manage');
    if (!permission.allowed) {
      if (permission.notFound) {
        return NextResponse.json({ error: 'Sprint not found' }, { status: 404 });
      }
      return NextResponse.json(
        { error: permission.reason || 'Permission denied' },
        { status: 403 }
      );
    }

    const [updatedIssue] = await db
      .update(issues)
      .set({
        sprintId: null,
        updatedAt: new Date(),
        updatedBy: session.user.id,
      })
      .where(and(eq(issues.id, issueId), eq(issues.sprintId, sprintId)))
      .returning();

    if (!updatedIssue) {
      return NextResponse.json({ error: 'Issue not found in sprint' }, { status: 404 });
    }

    publishEvent('sprint.issues.changed', session.user.id, {
      sprintId,
      organizationId: updatedIssue.organizationId,
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error removing issue from sprint:', error);
    return NextResponse.json({ error: 'Failed to remove issue from sprint' }, { status: 500 });
  }
}
