import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import {
  db,
  projects,
  organizationMembers,
  projectMembers,
  users,
  workflows,
  teams,
  organizations,
  ROLE_DEFAULT_PERMISSIONS,
  type ProjectRole,
} from '@tasknebula/db';
import { eq, and, inArray, desc } from 'drizzle-orm';
import { createId } from '@paralleldrive/cuid2';
import { publishEvent } from '@/lib/realtime/events';
import { runAutomations } from '@/lib/automation/evaluator';

// GET /api/projects - List all projects for the current user
export async function GET(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const searchParams = request.nextUrl.searchParams;
    const requestedOrganizationId = searchParams.get('organizationId');
    const requestedTeamId = searchParams.get('teamId');

    // Check if user is super admin
    const [user] = await db
      .select({ isSuperAdmin: users.isSuperAdmin })
      .from(users)
      .where(eq(users.id, session.user.id))
      .limit(1);

    // Get user's organization memberships
    const userOrgMemberships = await db
      .select({
        organizationId: organizationMembers.organizationId,
        role: organizationMembers.role,
      })
      .from(organizationMembers)
      .where(eq(organizationMembers.userId, session.user.id));

    if (userOrgMemberships.length === 0 && !user?.isSuperAdmin) {
      return NextResponse.json([]);
    }

    let orgIds = userOrgMemberships.map((m) => m.organizationId);
    if (requestedOrganizationId) {
      if (!user?.isSuperAdmin && !orgIds.includes(requestedOrganizationId)) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
      }
      orgIds = [requestedOrganizationId];
    }

    const isOrgOwnerOrAdmin = userOrgMemberships.some(
      (m) => m.role === 'owner' || m.role === 'admin'
    );
    const teamFilter = requestedTeamId
      ? eq(projects.teamId, requestedTeamId)
      : undefined;

    const mapProjects = <
      T extends {
        project: typeof projects.$inferSelect;
        organizationName: string | null;
        teamId: string | null;
        teamName: string | null;
        teamSlug: string | null;
      },
    >(
      rows: T[]
    ) =>
      rows.map((row) => ({
        ...row.project,
        organizationName: row.organizationName ?? '',
        team: row.teamId
          ? {
              id: row.teamId,
              name: row.teamName ?? 'Unknown teamspace',
              slug: row.teamSlug ?? row.teamId,
            }
          : null,
      }));

    // Super admins and org owners/admins see all projects in their orgs
    if (user?.isSuperAdmin || isOrgOwnerOrAdmin) {
      const userProjects = await db
        .select({
          project: projects,
          organizationName: organizations.name,
          teamId: teams.id,
          teamName: teams.name,
          teamSlug: teams.slug,
        })
        .from(projects)
        .leftJoin(organizations, eq(projects.organizationId, organizations.id))
        .leftJoin(teams, eq(projects.teamId, teams.id))
        .where(
          and(
            inArray(projects.organizationId, orgIds),
            ...(teamFilter ? [teamFilter] : [])
          )
        )
        .orderBy(desc(projects.updatedAt));

      return NextResponse.json(mapProjects(userProjects));
    }

    // Regular users only see projects they are members of
    const userProjectMemberships = await db
      .select({ projectId: projectMembers.projectId })
      .from(projectMembers)
      .where(eq(projectMembers.userId, session.user.id));

    if (userProjectMemberships.length === 0) {
      return NextResponse.json([]);
    }

    const projectIds = userProjectMemberships.map((m) => m.projectId);

    const userProjects = await db
      .select({
        project: projects,
        organizationName: organizations.name,
        teamId: teams.id,
        teamName: teams.name,
        teamSlug: teams.slug,
      })
      .from(projects)
      .leftJoin(organizations, eq(projects.organizationId, organizations.id))
      .leftJoin(teams, eq(projects.teamId, teams.id))
      .where(
        and(
          inArray(projects.organizationId, orgIds),
          inArray(projects.id, projectIds),
          ...(teamFilter ? [teamFilter] : [])
        )
      )
      .orderBy(desc(projects.updatedAt));

    return NextResponse.json(mapProjects(userProjects));
  } catch (error) {
    console.error('Error fetching projects:', error);
    return NextResponse.json({ error: 'Failed to fetch projects' }, { status: 500 });
  }
}

// POST /api/projects - Create a new project
export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { name, key, description, organizationId, teamId } = body;

    if (!name || !key) {
      return NextResponse.json(
        { error: 'Name and key are required' },
        { status: 400 }
      );
    }

    // Get user's first organization if not specified
    let orgId = organizationId;
    if (!orgId) {
      const [membership] = await db
        .select()
        .from(organizationMembers)
        .where(eq(organizationMembers.userId, session.user.id))
        .limit(1);

      if (!membership) {
        return NextResponse.json(
          { error: 'You must be a member of an organization to create a project' },
          { status: 400 }
        );
      }
      orgId = membership.organizationId;
    }

    const normalizedTeamId: string | null = teamId || null;
    if (normalizedTeamId) {
      const [team] = await db
        .select({
          id: teams.id,
          organizationId: teams.organizationId,
        })
        .from(teams)
        .where(eq(teams.id, normalizedTeamId))
        .limit(1);

      if (!team || team.organizationId !== orgId) {
        return NextResponse.json(
          { error: 'Selected teamspace does not belong to this organization' },
          { status: 400 }
        );
      }
    }

    // Check if project key already exists
    const [existingProject] = await db
      .select()
      .from(projects)
      .where(
        and(
          eq(projects.organizationId, orgId),
          eq(projects.key, key.toUpperCase())
        )
      )
      .limit(1);

    if (existingProject) {
      return NextResponse.json(
        { error: 'Project key already exists in this organization' },
        { status: 400 }
      );
    }

    const projectId = createId();

    // Get organization's default workflow
    const [defaultWorkflow] = await db
      .select({ id: workflows.id })
      .from(workflows)
      .where(and(eq(workflows.organizationId, orgId), eq(workflows.isDefault, true)))
      .limit(1);

    const newProject = await db
      .insert(projects)
      .values({
        id: projectId,
        organizationId: orgId,
        teamId: normalizedTeamId,
        key: key.toUpperCase(),
        name,
        description: description || null,
        status: 'active',
        settings: {},
        defaultWorkflowId: defaultWorkflow?.id || null,
        createdBy: session.user.id,
        updatedBy: session.user.id,
      })
      .returning();

    const createdProject = newProject[0];

    if (!createdProject) {
      throw new Error('Project could not be created');
    }

    // Add creator as product_owner with full permissions from role defaults
    const role: ProjectRole = 'product_owner';
    const defaults = ROLE_DEFAULT_PERMISSIONS[role];
    const permissionValues: Record<string, string> = {};
    for (const [key, val] of Object.entries(defaults)) {
      permissionValues[key] = val ? 'true' : 'false';
    }

    await db.insert(projectMembers).values({
      id: createId(),
      projectId: projectId,
      userId: session.user.id,
      role,
      ...permissionValues,
      invitedBy: session.user.id,
    });

    publishEvent('project.created', session.user.id, {
      projectId: createdProject.id,
      organizationId: orgId,
    });

    void runAutomations({
      trigger: 'project.created',
      organizationId: orgId,
      projectId: createdProject.id,
      payload: { project: createdProject },
      actorUserId: session.user.id,
    }).catch((err) =>
      console.error('Failed to run project.created automations:', err)
    );

    return NextResponse.json(createdProject, { status: 201 });
  } catch (error) {
    console.error('Error creating project:', error);
    return NextResponse.json({ error: 'Failed to create project' }, { status: 500 });
  }
}
