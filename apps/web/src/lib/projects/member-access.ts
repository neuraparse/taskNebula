import {
  db,
  schema,
  eq,
  and,
  ROLE_DEFAULT_PERMISSIONS,
  hasPermission as roleHasPermission,
  type ProjectRole,
} from '@tasknebula/db';

export async function canManageProjectMembers(userId: string, projectId: string): Promise<boolean> {
  const user = await db.query.users.findFirst({
    where: eq(schema.users.id, userId),
    columns: { isSuperAdmin: true },
  });
  if (user?.isSuperAdmin) return true;

  const project = await db.query.projects.findFirst({
    where: eq(schema.projects.id, projectId),
    columns: { organizationId: true },
  });
  if (!project) return false;

  const orgMember = await db.query.organizationMembers.findFirst({
    where: and(
      eq(schema.organizationMembers.userId, userId),
      eq(schema.organizationMembers.organizationId, project.organizationId),
      eq(schema.organizationMembers.status, 'active')
    ),
    columns: { role: true },
  });
  if (roleHasPermission(orgMember?.role || '', 'project:manage')) return true;

  const projectMember = await db.query.projectMembers.findFirst({
    where: and(
      eq(schema.projectMembers.userId, userId),
      eq(schema.projectMembers.projectId, projectId)
    ),
  });
  if (!projectMember) return false;

  const roleDefaults = ROLE_DEFAULT_PERMISSIONS[projectMember.role as ProjectRole];
  return (
    projectMember.canManageMembers === 'true' ||
    projectMember.canInviteMembers === 'true' ||
    roleDefaults?.canManageMembers ||
    roleDefaults?.canInviteMembers ||
    false
  );
}
