import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
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
  hasPermission as roleHasPermission,
  type ProjectRole,
} from '@tasknebula/db';
import { eq, and, inArray, desc } from 'drizzle-orm';
import { createId } from '@paralleldrive/cuid2';
import { publishEvent } from '@/lib/realtime/events';
import { notifyProjectCreated } from '@/lib/notifications/project-events';
import { runAutomations } from '@/lib/automation/evaluator';
import { withValidation } from '@/lib/api-validation';
import { hasPermission } from '@/lib/auth/permissions';

// FEAT-29: replaces ad-hoc `if (!name || !key)` checks with a Zod schema.
// `key` is uppercased downstream; we accept any case here and let the
// handler normalize.
const createProjectSchema = z.object({
  name: z.string().min(1).max(120),
  key: z
    .string()
    .min(2)
    .max(10)
    .regex(/^[A-Za-z][A-Za-z0-9]*$/, 'key must be alphanumeric, start with a letter'),
  description: z.string().max(2000).nullable().optional(),
  organizationId: z.string().optional(),
  teamId: z.string().nullable().optional(),
});

// GET /api/projects - List all projects for the current user
export async function GET(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized', code: 'UNAUTHORIZED' }, { status: 401 });
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
      .where(
        and(
          eq(organizationMembers.userId, session.user.id),
          eq(organizationMembers.status, 'active')
        )
      );

    let orgIds = userOrgMemberships.map((m) => m.organizationId);
    if (requestedOrganizationId) {
      if (!user?.isSuperAdmin && !orgIds.includes(requestedOrganizationId)) {
        return NextResponse.json(
          { error: 'Forbidden', code: 'ORGANIZATION_FORBIDDEN' },
          { status: 403 }
        );
      }
      orgIds = [requestedOrganizationId];
    }

    if (userOrgMemberships.length === 0 && !user?.isSuperAdmin) {
      return NextResponse.json([]);
    }

    const teamFilter = requestedTeamId ? eq(projects.teamId, requestedTeamId) : undefined;

    type ProjectListRow = {
      project: typeof projects.$inferSelect;
      organizationName: string | null;
      teamId: string | null;
      teamName: string | null;
      teamSlug: string | null;
    };

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

    const selectProjects = async (
      visibleOrgIds?: string[],
      visibleProjectIds?: string[]
    ): Promise<ProjectListRow[]> => {
      if (visibleOrgIds && visibleOrgIds.length === 0) {
        return [];
      }

      const filters = [
        ...(visibleOrgIds ? [inArray(projects.organizationId, visibleOrgIds)] : []),
        ...(visibleProjectIds ? [inArray(projects.id, visibleProjectIds)] : []),
        ...(teamFilter ? [teamFilter] : []),
      ];

      const query = db
        .select({
          project: projects,
          organizationName: organizations.name,
          teamId: teams.id,
          teamName: teams.name,
          teamSlug: teams.slug,
        })
        .from(projects)
        .leftJoin(organizations, eq(projects.organizationId, organizations.id))
        .leftJoin(teams, eq(projects.teamId, teams.id));

      if (filters.length === 0) {
        return query.orderBy(desc(projects.updatedAt));
      }

      return query.where(and(...filters)).orderBy(desc(projects.updatedAt));
    };

    if (user?.isSuperAdmin) {
      const visibleOrgIds = requestedOrganizationId ? orgIds : undefined;
      const userProjects = await selectProjects(visibleOrgIds);

      return NextResponse.json(mapProjects(userProjects));
    }

    const scopedMemberships = requestedOrganizationId
      ? userOrgMemberships.filter((m) => m.organizationId === requestedOrganizationId)
      : userOrgMemberships;

    const adminOrgIds = scopedMemberships
      .filter((m) => roleHasPermission(m.role || '', 'project:manage'))
      .map((m) => m.organizationId);
    const memberOrgIds = scopedMemberships
      .filter((m) => !roleHasPermission(m.role || '', 'project:manage'))
      .map((m) => m.organizationId);

    const visibleProjects: ProjectListRow[] = [];

    // Org roles with project:manage see every project only inside those orgs.
    visibleProjects.push(...(await selectProjects(adminOrgIds)));

    // Regular organization users only see projects they are explicitly members of.
    const userProjectMemberships = await db
      .select({ projectId: projectMembers.projectId })
      .from(projectMembers)
      .where(eq(projectMembers.userId, session.user.id));

    if (memberOrgIds.length > 0 && userProjectMemberships.length > 0) {
      const projectIds = userProjectMemberships.map((m) => m.projectId);
      visibleProjects.push(...(await selectProjects(memberOrgIds, projectIds)));
    }

    return NextResponse.json(mapProjects(visibleProjects));
  } catch (error) {
    console.error('Error fetching projects:', error);
    return NextResponse.json({ error: 'Failed to fetch projects' }, { status: 500 });
  }
}

// POST /api/projects - Create a new project
// Migrated to withValidation (FEAT-29). The wrapper enforces the schema
// (replacing the manual `if (!name || !key)` check) before we touch the DB.
export const POST = withValidation({ body: createProjectSchema })(async (request, { body }) => {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized', code: 'UNAUTHORIZED' }, { status: 401 });
  }

  try {
    const { name, key, description, organizationId, teamId } = body;

    // Get user's first organization if not specified
    let orgId = organizationId;
    if (!orgId) {
      const [membership] = await db
        .select({
          organizationId: organizationMembers.organizationId,
          status: organizationMembers.status,
        })
        .from(organizationMembers)
        .where(
          and(
            eq(organizationMembers.userId, session.user.id),
            eq(organizationMembers.status, 'active')
          )
        )
        .limit(1);

      if (!membership) {
        return NextResponse.json(
          {
            error: 'You must be a member of an organization to create a project',
            code: 'ORGANIZATION_MEMBERSHIP_REQUIRED',
          },
          { status: 403 }
        );
      }
      orgId = membership.organizationId;
    }

    const canCreateProject = await hasPermission(orgId, 'project:create');
    if (!canCreateProject) {
      return NextResponse.json(
        {
          error: 'You need project creation permission in this organization',
          code: 'PROJECT_CREATE_FORBIDDEN',
        },
        { status: 403 }
      );
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
          {
            error: 'Selected teamspace does not belong to this organization',
            code: 'TEAMSPACE_ORGANIZATION_MISMATCH',
          },
          { status: 400 }
        );
      }
    }

    // Check if project key already exists
    const [existingProject] = await db
      .select()
      .from(projects)
      .where(and(eq(projects.organizationId, orgId), eq(projects.key, key.toUpperCase())))
      .limit(1);

    if (existingProject) {
      return NextResponse.json(
        {
          error: 'Project key already exists in this organization',
          code: 'PROJECT_KEY_EXISTS',
        },
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

    // Fire-and-forget project.created notifications to org members
    // (excluding the creator). Wrapped so SMTP/DB hiccups can't fail the
    // create request.
    try {
      notifyProjectCreated({
        project: {
          id: createdProject.id,
          name: createdProject.name,
          key: createdProject.key,
          description: createdProject.description,
          organizationId: orgId,
        },
        actorUserId: session.user.id,
      });
    } catch (err) {
      console.error('notifyProjectCreated dispatch failed:', err);
    }

    void runAutomations({
      trigger: 'project.created',
      organizationId: orgId,
      projectId: createdProject.id,
      payload: { project: createdProject },
      actorUserId: session.user.id,
    }).catch((err) => console.error('Failed to run project.created automations:', err));

    return NextResponse.json(createdProject, { status: 201 });
  } catch (error) {
    console.error('Error creating project:', error);
    return NextResponse.json({ error: 'Failed to create project' }, { status: 500 });
  }
});
