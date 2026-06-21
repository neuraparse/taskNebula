import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import {
  db,
  sprints,
  issues,
  projects,
  projectMembers,
  organizationMembers,
  users,
  ROLE_DEFAULT_PERMISSIONS,
  hasPermission as roleHasPermission,
  type ProjectRole,
} from '@tasknebula/db';
import { eq, and, desc, count, inArray } from 'drizzle-orm';
import { createId } from '@paralleldrive/cuid2';
import { publishEvent } from '@/lib/realtime/events';

// Permission check helper
async function checkSprintPermission(
  userId: string,
  projectId: string,
  action: 'view' | 'create' | 'manage'
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
        eq(organizationMembers.organizationId, project.organizationId),
        eq(organizationMembers.status, 'active')
      )
    )
    .limit(1);

  // Org roles with project:manage have full access
  if (roleHasPermission(orgMember?.role || '', 'project:manage')) {
    return { allowed: true };
  }

  // Get project membership
  const [projectMember] = await db
    .select({
      role: projectMembers.role,
      canManageSprints: projectMembers.canManageSprints,
    })
    .from(projectMembers)
    .where(and(eq(projectMembers.userId, userId), eq(projectMembers.projectId, projectId)))
    .limit(1);

  if (!projectMember) {
    if (!orgMember) {
      // Cross-org probe: report the project as not found so its existence
      // is not leaked to other tenants.
      return { allowed: false, reason: 'Project not found', notFound: true };
    }
    return { allowed: false, reason: 'Not a project member' };
  }

  // Check role defaults and explicit overrides
  const roleDefaults =
    ROLE_DEFAULT_PERMISSIONS[projectMember.role as ProjectRole] || ROLE_DEFAULT_PERMISSIONS.viewer;
  const toBool = (val: string | null | undefined): boolean => val === 'true';
  const canManage = toBool(projectMember.canManageSprints) || roleDefaults.canManageSprints;

  if (action === 'view') {
    return { allowed: true };
  }

  if (action === 'create' || action === 'manage') {
    if (canManage) {
      return { allowed: true };
    }
    return { allowed: false, reason: 'Insufficient permissions to manage sprints' };
  }

  return { allowed: false, reason: 'Unknown action' };
}

// Helper function to resolve projectId (could be ID or key)
async function resolveProjectId(projectIdOrKey: string): Promise<string | null> {
  // If it looks like a CUID (contains underscore or is long), use as-is
  if (projectIdOrKey.includes('_') || projectIdOrKey.length > 20) {
    return projectIdOrKey;
  }

  // Otherwise, try to find by key
  const [project] = await db
    .select({ id: projects.id })
    .from(projects)
    .where(eq(projects.key, projectIdOrKey.toUpperCase()))
    .limit(1);

  return project?.id || null;
}

// GET /api/sprints?projectId=xxx
export async function GET(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const projectIdParam = searchParams.get('projectId');

  if (!projectIdParam) {
    return NextResponse.json({ error: 'Project ID is required' }, { status: 400 });
  }

  try {
    // Resolve projectId (could be key or ID)
    const projectId = await resolveProjectId(projectIdParam);
    if (!projectId) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    // Permission check: caller must be able to view this project's sprints.
    // Cross-org probes get a 404 so project existence is not leaked.
    const permission = await checkSprintPermission(session.user.id, projectId, 'view');
    if (!permission.allowed) {
      if (permission.notFound) {
        return NextResponse.json({ error: 'Project not found' }, { status: 404 });
      }
      return NextResponse.json(
        { error: permission.reason || 'Permission denied' },
        { status: 403 }
      );
    }

    // Fetch sprints with issue counts
    const sprintList = await db
      .select({
        id: sprints.id,
        projectId: sprints.projectId,
        name: sprints.name,
        goal: sprints.goal,
        startDate: sprints.startDate,
        endDate: sprints.endDate,
        status: sprints.status,
        createdAt: sprints.createdAt,
        updatedAt: sprints.updatedAt,
        createdBy: sprints.createdBy,
        updatedBy: sprints.updatedBy,
      })
      .from(sprints)
      .where(eq(sprints.projectId, projectId))
      .orderBy(desc(sprints.createdAt));

    // Get issue counts for all sprints in a single aggregated query
    const sprintIdsList = sprintList.map((s) => s.id);
    const countsMap = new Map<string, number>();

    if (sprintIdsList.length > 0) {
      const countsResult = await db
        .select({ sprintId: issues.sprintId, total: count() })
        .from(issues)
        .where(inArray(issues.sprintId, sprintIdsList))
        .groupBy(issues.sprintId);

      for (const row of countsResult) {
        if (row.sprintId) {
          countsMap.set(row.sprintId, Number(row.total) || 0);
        }
      }
    }

    const sprintsWithCounts = sprintList.map((sprint) => ({
      ...sprint,
      issueCount: countsMap.get(sprint.id) || 0,
    }));

    return NextResponse.json(sprintsWithCounts);
  } catch (error) {
    console.error('Error fetching sprints:', error);
    return NextResponse.json({ error: 'Failed to fetch sprints' }, { status: 500 });
  }
}

// POST /api/sprints
export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { projectId: projectIdParam, name, goal, startDate, endDate } = body;

    if (!projectIdParam || !name || !startDate || !endDate) {
      return NextResponse.json(
        { error: 'Project ID, name, start date, and end date are required' },
        { status: 400 }
      );
    }

    // Resolve projectId (could be key or ID)
    const projectId = await resolveProjectId(projectIdParam);
    if (!projectId) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    // Check permission to create sprints. Cross-org probes get a 404 so
    // project existence is not leaked.
    const permission = await checkSprintPermission(session.user.id, projectId, 'create');
    if (!permission.allowed) {
      if (permission.notFound) {
        return NextResponse.json({ error: 'Project not found' }, { status: 404 });
      }
      return NextResponse.json(
        { error: permission.reason || 'Permission denied' },
        { status: 403 }
      );
    }

    // Validate dates
    const start = new Date(startDate);
    const end = new Date(endDate);

    if (isNaN(start.getTime()) || isNaN(end.getTime())) {
      return NextResponse.json({ error: 'Invalid date format' }, { status: 400 });
    }

    if (end <= start) {
      return NextResponse.json({ error: 'End date must be after start date' }, { status: 400 });
    }

    // Sprint duration should be reasonable (1-90 days)
    const durationDays = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
    if (durationDays < 1 || durationDays > 90) {
      return NextResponse.json(
        { error: 'Sprint duration must be between 1 and 90 days' },
        { status: 400 }
      );
    }

    const newSprint = await db
      .insert(sprints)
      .values({
        id: createId(),
        projectId,
        name,
        goal: goal || null,
        startDate: start,
        endDate: end,
        status: 'planned',
        createdBy: session.user.id,
        updatedBy: session.user.id,
      })
      .returning();

    const createdSprint = newSprint[0];
    if (!createdSprint) {
      throw new Error('Failed to create sprint');
    }

    // Sprints carry no organization_id column; resolve it via the project so
    // the realtime event survives the SSE stream's org filter.
    const [sprintProject] = await db
      .select({ organizationId: projects.organizationId })
      .from(projects)
      .where(eq(projects.id, createdSprint.projectId))
      .limit(1);

    publishEvent('sprint.created', session.user.id, {
      projectId: createdSprint.projectId,
      sprintId: createdSprint.id,
      organizationId: sprintProject?.organizationId,
    });

    return NextResponse.json(createdSprint, { status: 201 });
  } catch (error) {
    console.error('Error creating sprint:', error);
    return NextResponse.json({ error: 'Failed to create sprint' }, { status: 500 });
  }
}
