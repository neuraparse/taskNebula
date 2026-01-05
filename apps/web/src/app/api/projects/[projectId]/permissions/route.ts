import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { db, projects, projectMembers, organizationMembers, users, eq, and, ROLE_DEFAULT_PERMISSIONS, type ProjectRole, type GranularPermissions } from '@tasknebula/db';

// Full permissions interface with all granular permissions
export interface UserProjectPermissions extends GranularPermissions {
  isMember: boolean;
  role: ProjectRole | null;
  isSuperAdmin: boolean;
  isOrgOwner: boolean;
  isOrgAdmin: boolean;
}

// All permissions set to true (for super admin / org owner)
const ALL_PERMISSIONS: GranularPermissions = {
  canBrowseProject: true,
  canAdministerProject: true,
  canManageSprints: true,
  canStartSprint: true,
  canCompleteSprint: true,
  canDeleteSprint: true,
  canCreateIssues: true,
  canEditIssues: true,
  canEditOwnIssues: true,
  canDeleteIssues: true,
  canDeleteOwnIssues: true,
  canAssignIssues: true,
  canAssigneeIssues: true,
  canTransitionIssues: true,
  canScheduleIssues: true,
  canMoveIssues: true,
  canLinkIssues: true,
  canCloseIssues: true,
  canReopenIssues: true,
  canAddComments: true,
  canEditOwnComments: true,
  canEditAllComments: true,
  canDeleteOwnComments: true,
  canDeleteAllComments: true,
  canCreateAttachments: true,
  canDeleteOwnAttachments: true,
  canDeleteAllAttachments: true,
  canManageWatchers: true,
  canViewWatchers: true,
  canManageMembers: true,
  canInviteMembers: true,
  canRemoveMembers: true,
  canChangeRoles: true,
  canManageWorkflow: true,
  canLogWork: true,
  canEditOwnWorklogs: true,
  canEditAllWorklogs: true,
  canDeleteOwnWorklogs: true,
  canDeleteAllWorklogs: true,
};

// No permissions (for non-members)
const NO_PERMISSIONS: GranularPermissions = {
  canBrowseProject: false,
  canAdministerProject: false,
  canManageSprints: false,
  canStartSprint: false,
  canCompleteSprint: false,
  canDeleteSprint: false,
  canCreateIssues: false,
  canEditIssues: false,
  canEditOwnIssues: false,
  canDeleteIssues: false,
  canDeleteOwnIssues: false,
  canAssignIssues: false,
  canAssigneeIssues: false,
  canTransitionIssues: false,
  canScheduleIssues: false,
  canMoveIssues: false,
  canLinkIssues: false,
  canCloseIssues: false,
  canReopenIssues: false,
  canAddComments: false,
  canEditOwnComments: false,
  canEditAllComments: false,
  canDeleteOwnComments: false,
  canDeleteAllComments: false,
  canCreateAttachments: false,
  canDeleteOwnAttachments: false,
  canDeleteAllAttachments: false,
  canManageWatchers: false,
  canViewWatchers: false,
  canManageMembers: false,
  canInviteMembers: false,
  canRemoveMembers: false,
  canChangeRoles: false,
  canManageWorkflow: false,
  canLogWork: false,
  canEditOwnWorklogs: false,
  canEditAllWorklogs: false,
  canDeleteOwnWorklogs: false,
  canDeleteAllWorklogs: false,
};

// Helper to resolve projectId (key or CUID)
async function resolveProjectId(projectIdOrKey: string): Promise<string | null> {
  if (projectIdOrKey.length > 10 || projectIdOrKey.includes('_')) {
    return projectIdOrKey;
  }
  const [project] = await db
    .select({ id: projects.id })
    .from(projects)
    .where(eq(projects.key, projectIdOrKey.toUpperCase()))
    .limit(1);
  return project?.id || null;
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ projectId: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { projectId: projectIdOrKey } = await params;
    const projectId = await resolveProjectId(projectIdOrKey);

    if (!projectId) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
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
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    // Check if user is super admin
    const [user] = await db
      .select({ isSuperAdmin: users.isSuperAdmin })
      .from(users)
      .where(eq(users.id, session.user.id))
      .limit(1);

    const isSuperAdmin = user?.isSuperAdmin || false;

    // Get organization membership
    const [orgMember] = await db
      .select({ role: organizationMembers.role })
      .from(organizationMembers)
      .where(
        and(
          eq(organizationMembers.userId, session.user.id),
          eq(organizationMembers.organizationId, project.organizationId)
        )
      )
      .limit(1);

    const isOrgOwner = orgMember?.role === 'owner';
    const isOrgAdmin = orgMember?.role === 'admin' || isOrgOwner;

    // Get project membership with ALL permission columns
    const [projectMember] = await db
      .select()
      .from(projectMembers)
      .where(
        and(
          eq(projectMembers.userId, session.user.id),
          eq(projectMembers.projectId, projectId)
        )
      )
      .limit(1);

    // Super admin or org owner has full access
    if (isSuperAdmin || isOrgOwner) {
      return NextResponse.json({
        isMember: true,
        role: (projectMember?.role as ProjectRole) || 'product_owner',
        isSuperAdmin,
        isOrgOwner,
        isOrgAdmin,
        ...ALL_PERMISSIONS,
      } as UserProjectPermissions);
    }

    // Not a member - no access (org admin can browse)
    if (!projectMember) {
      const viewOnlyPermissions = { ...NO_PERMISSIONS };
      if (isOrgAdmin) {
        viewOnlyPermissions.canBrowseProject = true;
      }
      return NextResponse.json({
        isMember: false,
        role: null,
        isSuperAdmin,
        isOrgOwner,
        isOrgAdmin,
        ...viewOnlyPermissions,
      } as UserProjectPermissions);
    }

    // Get role-based default permissions
    const roleDefaults = ROLE_DEFAULT_PERMISSIONS[projectMember.role as ProjectRole] || ROLE_DEFAULT_PERMISSIONS.viewer;

    // Helper to convert 'true'/'false' string to boolean
    const toBool = (val: string | null | undefined): boolean => val === 'true';

    // Build permissions from database values (custom overrides) or role defaults
    const permissions: UserProjectPermissions = {
      isMember: true,
      role: projectMember.role as ProjectRole,
      isSuperAdmin,
      isOrgOwner,
      isOrgAdmin,
      // Project
      canBrowseProject: toBool(projectMember.canBrowseProject) || roleDefaults.canBrowseProject,
      canAdministerProject: toBool(projectMember.canAdministerProject) || roleDefaults.canAdministerProject,
      // Sprint
      canManageSprints: toBool(projectMember.canManageSprints) || roleDefaults.canManageSprints,
      canStartSprint: toBool(projectMember.canStartSprint) || roleDefaults.canStartSprint,
      canCompleteSprint: toBool(projectMember.canCompleteSprint) || roleDefaults.canCompleteSprint,
      canDeleteSprint: toBool(projectMember.canDeleteSprint) || roleDefaults.canDeleteSprint,
      // Issue
      canCreateIssues: toBool(projectMember.canCreateIssues) || roleDefaults.canCreateIssues,
      canEditIssues: toBool(projectMember.canEditIssues) || roleDefaults.canEditIssues,
      canEditOwnIssues: toBool(projectMember.canEditOwnIssues) || roleDefaults.canEditOwnIssues,
      canDeleteIssues: toBool(projectMember.canDeleteIssues) || roleDefaults.canDeleteIssues,
      canDeleteOwnIssues: toBool(projectMember.canDeleteOwnIssues) || roleDefaults.canDeleteOwnIssues,
      canAssignIssues: toBool(projectMember.canAssignIssues) || roleDefaults.canAssignIssues,
      canAssigneeIssues: toBool(projectMember.canAssigneeIssues) || roleDefaults.canAssigneeIssues,
      canTransitionIssues: toBool(projectMember.canTransitionIssues) || roleDefaults.canTransitionIssues,
      canScheduleIssues: toBool(projectMember.canScheduleIssues) || roleDefaults.canScheduleIssues,
      canMoveIssues: toBool(projectMember.canMoveIssues) || roleDefaults.canMoveIssues,
      canLinkIssues: toBool(projectMember.canLinkIssues) || roleDefaults.canLinkIssues,
      canCloseIssues: toBool(projectMember.canCloseIssues) || roleDefaults.canCloseIssues,
      canReopenIssues: toBool(projectMember.canReopenIssues) || roleDefaults.canReopenIssues,
      // Comment
      canAddComments: toBool(projectMember.canAddComments) || roleDefaults.canAddComments,
      canEditOwnComments: toBool(projectMember.canEditOwnComments) || roleDefaults.canEditOwnComments,
      canEditAllComments: toBool(projectMember.canEditAllComments) || roleDefaults.canEditAllComments,
      canDeleteOwnComments: toBool(projectMember.canDeleteOwnComments) || roleDefaults.canDeleteOwnComments,
      canDeleteAllComments: toBool(projectMember.canDeleteAllComments) || roleDefaults.canDeleteAllComments,
      // Attachment
      canCreateAttachments: toBool(projectMember.canCreateAttachments) || roleDefaults.canCreateAttachments,
      canDeleteOwnAttachments: toBool(projectMember.canDeleteOwnAttachments) || roleDefaults.canDeleteOwnAttachments,
      canDeleteAllAttachments: toBool(projectMember.canDeleteAllAttachments) || roleDefaults.canDeleteAllAttachments,
      // Watcher
      canManageWatchers: toBool(projectMember.canManageWatchers) || roleDefaults.canManageWatchers,
      canViewWatchers: toBool(projectMember.canViewWatchers) || roleDefaults.canViewWatchers,
      // Member
      canManageMembers: toBool(projectMember.canManageMembers) || roleDefaults.canManageMembers,
      canInviteMembers: toBool(projectMember.canInviteMembers) || roleDefaults.canInviteMembers,
      canRemoveMembers: toBool(projectMember.canRemoveMembers) || roleDefaults.canRemoveMembers,
      canChangeRoles: toBool(projectMember.canChangeRoles) || roleDefaults.canChangeRoles,
      // Workflow
      canManageWorkflow: toBool(projectMember.canManageWorkflow) || roleDefaults.canManageWorkflow,
      // Time Tracking
      canLogWork: toBool(projectMember.canLogWork) || roleDefaults.canLogWork,
      canEditOwnWorklogs: toBool(projectMember.canEditOwnWorklogs) || roleDefaults.canEditOwnWorklogs,
      canEditAllWorklogs: toBool(projectMember.canEditAllWorklogs) || roleDefaults.canEditAllWorklogs,
      canDeleteOwnWorklogs: toBool(projectMember.canDeleteOwnWorklogs) || roleDefaults.canDeleteOwnWorklogs,
      canDeleteAllWorklogs: toBool(projectMember.canDeleteAllWorklogs) || roleDefaults.canDeleteAllWorklogs,
    };

    return NextResponse.json(permissions);
  } catch (error) {
    console.error('Error fetching project permissions:', error);
    return NextResponse.json(
      { error: 'Failed to fetch permissions' },
      { status: 500 }
    );
  }
}

