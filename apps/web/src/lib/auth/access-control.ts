import {
  db,
  issues,
  organizationMembers,
  projectMembers,
  projects,
  users,
  ROLE_DEFAULT_PERMISSIONS,
  hasPermission as roleHasPermission,
  type ProjectRole,
} from '@tasknebula/db';
import { and, eq } from 'drizzle-orm';

function toBool(value: unknown): boolean {
  return value === true || value === 'true';
}

export async function isActiveOrganizationMember(
  userId: string,
  organizationId: string
): Promise<boolean> {
  const [user] = await db
    .select({ isSuperAdmin: users.isSuperAdmin })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);
  if (user?.isSuperAdmin) return true;

  const [member] = await db
    .select({ id: organizationMembers.id })
    .from(organizationMembers)
    .where(
      and(
        eq(organizationMembers.userId, userId),
        eq(organizationMembers.organizationId, organizationId),
        eq(organizationMembers.status, 'active')
      )
    )
    .limit(1);

  return Boolean(member);
}

async function getProjectMembership(userId: string, projectId: string) {
  const [member] = await db
    .select({
      role: projectMembers.role,
      canBrowseProject: projectMembers.canBrowseProject,
      canAdministerProject: projectMembers.canAdministerProject,
      canAddComments: projectMembers.canAddComments,
      canEditIssues: projectMembers.canEditIssues,
    })
    .from(projectMembers)
    .where(and(eq(projectMembers.userId, userId), eq(projectMembers.projectId, projectId)))
    .limit(1);

  return member ?? null;
}

export async function canReadProject(
  userId: string,
  project: typeof projects.$inferSelect
): Promise<boolean> {
  const [user] = await db
    .select({ isSuperAdmin: users.isSuperAdmin })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);
  if (user?.isSuperAdmin) return true;

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

  if (roleHasPermission(orgMember?.role || '', 'project:manage')) {
    return true;
  }

  const projectMember = await getProjectMembership(userId, project.id);
  if (!projectMember) return false;

  const roleDefaults =
    ROLE_DEFAULT_PERMISSIONS[projectMember.role as ProjectRole] || ROLE_DEFAULT_PERMISSIONS.viewer;
  return toBool(projectMember.canBrowseProject) || roleDefaults.canBrowseProject;
}

export async function canManageProject(
  userId: string,
  project: typeof projects.$inferSelect
): Promise<boolean> {
  const [user] = await db
    .select({ isSuperAdmin: users.isSuperAdmin })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);
  if (user?.isSuperAdmin) return true;

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

  if (roleHasPermission(orgMember?.role || '', 'project:manage')) {
    return true;
  }

  const projectMember = await getProjectMembership(userId, project.id);
  if (!projectMember) return false;

  const roleDefaults =
    ROLE_DEFAULT_PERMISSIONS[projectMember.role as ProjectRole] || ROLE_DEFAULT_PERMISSIONS.viewer;
  return toBool(projectMember.canAdministerProject) || roleDefaults.canAdministerProject;
}

export async function canReadIssue(
  userId: string,
  issueId: string
): Promise<{
  allowed: boolean;
  issue: typeof issues.$inferSelect | null;
}> {
  const [issue] = await db.select().from(issues).where(eq(issues.id, issueId)).limit(1);

  if (!issue) return { allowed: false, issue: null };

  const [project] = await db
    .select()
    .from(projects)
    .where(eq(projects.id, issue.projectId))
    .limit(1);

  if (!project) return { allowed: false, issue };
  return { allowed: await canReadProject(userId, project), issue };
}

export async function canCommentOnIssue(
  userId: string,
  issueId: string
): Promise<{
  allowed: boolean;
  issue: typeof issues.$inferSelect | null;
}> {
  const result = await canReadIssue(userId, issueId);
  if (!result.allowed || !result.issue) return result;

  const projectMember = await getProjectMembership(userId, result.issue.projectId);
  if (!projectMember) return result;

  const roleDefaults =
    ROLE_DEFAULT_PERMISSIONS[projectMember.role as ProjectRole] || ROLE_DEFAULT_PERMISSIONS.viewer;
  return {
    issue: result.issue,
    allowed: toBool(projectMember.canAddComments) || roleDefaults.canAddComments,
  };
}

export async function canEditIssue(
  userId: string,
  issueId: string
): Promise<{
  allowed: boolean;
  issue: typeof issues.$inferSelect | null;
}> {
  const result = await canReadIssue(userId, issueId);
  if (!result.allowed || !result.issue) return result;

  const [project] = await db
    .select()
    .from(projects)
    .where(eq(projects.id, result.issue.projectId))
    .limit(1);
  if (!project) return { allowed: false, issue: result.issue };
  if (await canManageProject(userId, project)) return result;

  const projectMember = await getProjectMembership(userId, result.issue.projectId);
  if (!projectMember) return { allowed: false, issue: result.issue };

  const roleDefaults =
    ROLE_DEFAULT_PERMISSIONS[projectMember.role as ProjectRole] || ROLE_DEFAULT_PERMISSIONS.viewer;
  return {
    issue: result.issue,
    allowed: toBool(projectMember.canEditIssues) || roleDefaults.canEditIssues,
  };
}
