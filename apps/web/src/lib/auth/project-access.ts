import { canManageProject, canReadProject } from '@/lib/auth/access-control';
import { resolveProjectByIdOrKey } from '@/lib/projects/server';
import {
  ROLE_DEFAULT_PERMISSIONS,
  and,
  db,
  eq,
  organizationMembers,
  projectMembers,
  users,
  type GranularPermissions,
  type ProjectRole,
} from '@tasknebula/db';

type ProjectRecord = NonNullable<Awaited<ReturnType<typeof resolveProjectByIdOrKey>>>;

export type ProjectAccess = {
  project: ProjectRecord | null;
  canRead: boolean;
  canManage: boolean;
};

export type ProjectCapabilityAccess = ProjectAccess & {
  isSuperAdmin: boolean;
  isOrgOwner: boolean;
  isOrgAdmin: boolean;
  role: ProjectRole | null;
  permissions: GranularPermissions;
};

function allProjectPermissions(): GranularPermissions {
  return Object.fromEntries(
    Object.keys(ROLE_DEFAULT_PERMISSIONS.viewer).map((key) => [key, true])
  ) as GranularPermissions;
}

function noProjectPermissions(): GranularPermissions {
  return Object.fromEntries(
    Object.keys(ROLE_DEFAULT_PERMISSIONS.viewer).map((key) => [key, false])
  ) as GranularPermissions;
}

function toPermissionValue(value: string | null | undefined, fallback = false) {
  if (value === 'true') return true;
  if (value === 'false') return false;
  return fallback;
}

export async function resolveProjectAccess(
  userId: string,
  projectIdOrKey: string
): Promise<ProjectAccess> {
  const project = await resolveProjectByIdOrKey(projectIdOrKey, userId);

  if (!project) {
    return { project: null, canRead: false, canManage: false };
  }

  const canRead = await canReadProject(userId, project);
  if (!canRead) {
    return { project, canRead: false, canManage: false };
  }

  return {
    project,
    canRead: true,
    canManage: await canManageProject(userId, project),
  };
}

export async function resolveProjectCapabilityAccess(
  userId: string,
  projectIdOrKey: string
): Promise<ProjectCapabilityAccess> {
  const project = await resolveProjectByIdOrKey(projectIdOrKey, userId);
  const emptyPermissions = noProjectPermissions();

  if (!project) {
    return {
      project: null,
      canRead: false,
      canManage: false,
      isSuperAdmin: false,
      isOrgOwner: false,
      isOrgAdmin: false,
      role: null,
      permissions: emptyPermissions,
    };
  }

  const [[user], [orgMember], [projectMember]] = await Promise.all([
    db
      .select({ isSuperAdmin: users.isSuperAdmin })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1),
    db
      .select({ role: organizationMembers.role })
      .from(organizationMembers)
      .where(
        and(
          eq(organizationMembers.userId, userId),
          eq(organizationMembers.organizationId, project.organizationId),
          eq(organizationMembers.status, 'active')
        )
      )
      .limit(1),
    db
      .select()
      .from(projectMembers)
      .where(and(eq(projectMembers.userId, userId), eq(projectMembers.projectId, project.id)))
      .limit(1),
  ]);

  const isSuperAdmin = Boolean(user?.isSuperAdmin);
  const isOrgOwner = orgMember?.role === 'owner';
  const isOrgAdmin = orgMember?.role === 'admin';

  if (isSuperAdmin || isOrgOwner || isOrgAdmin) {
    return {
      project,
      canRead: true,
      canManage: true,
      isSuperAdmin,
      isOrgOwner,
      isOrgAdmin,
      role: (projectMember?.role as ProjectRole | undefined) ?? null,
      permissions: allProjectPermissions(),
    };
  }

  if (!projectMember) {
    return {
      project,
      canRead: false,
      canManage: false,
      isSuperAdmin,
      isOrgOwner,
      isOrgAdmin,
      role: null,
      permissions: emptyPermissions,
    };
  }

  const role = projectMember.role as ProjectRole;
  const roleDefaults = ROLE_DEFAULT_PERMISSIONS[role] || ROLE_DEFAULT_PERMISSIONS.viewer;
  const permissions = Object.fromEntries(
    Object.keys(roleDefaults).map((key) => [
      key,
      toPermissionValue(
        projectMember[key as keyof typeof projectMember] as string | null | undefined,
        roleDefaults[key as keyof GranularPermissions]
      ),
    ])
  ) as GranularPermissions;

  const canRead = permissions.canBrowseProject;

  return {
    project,
    canRead,
    canManage: permissions.canAdministerProject,
    isSuperAdmin,
    isOrgOwner,
    isOrgAdmin,
    role,
    permissions,
  };
}
