import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { db, schema, eq, and, ROLE_DEFAULT_PERMISSIONS, type ProjectRole } from '@tasknebula/db';
import { resolveProjectByIdOrKey } from '@/lib/projects/server';
import { canReadProject } from '@/lib/auth/access-control';

// Check if user can manage members in this project
async function canManageProjectMembers(userId: string, projectId: string): Promise<boolean> {
  // Check if super admin
  const user = await db.query.users.findFirst({
    where: eq(schema.users.id, userId),
    columns: { isSuperAdmin: true },
  });
  if (user?.isSuperAdmin) return true;

  // Get project to check org
  const project = await db.query.projects.findFirst({
    where: eq(schema.projects.id, projectId),
    columns: { organizationId: true },
  });
  if (!project) return false;

  // Check org role
  const orgMember = await db.query.organizationMembers.findFirst({
    where: and(
      eq(schema.organizationMembers.userId, userId),
      eq(schema.organizationMembers.organizationId, project.organizationId)
    ),
    columns: { role: true },
  });
  if (orgMember?.role === 'owner' || orgMember?.role === 'admin') return true;

  // Check project role
  const projectMember = await db.query.projectMembers.findFirst({
    where: and(
      eq(schema.projectMembers.userId, userId),
      eq(schema.projectMembers.projectId, projectId)
    ),
  });
  if (!projectMember) return false;

  // Check if has permission to manage members
  const roleDefaults = ROLE_DEFAULT_PERMISSIONS[projectMember.role as ProjectRole];
  return (
    projectMember.canManageMembers === 'true' ||
    projectMember.canInviteMembers === 'true' ||
    roleDefaults?.canManageMembers ||
    roleDefaults?.canInviteMembers ||
    false
  );
}

// GET /api/projects/[projectId]/members - Get project members
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
    const project = await resolveProjectByIdOrKey(projectIdOrKey, session.user.id);

    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    // Member emails + the full permission matrix are sensitive: require read
    // access. 404 (not 403) so cross-org probing cannot confirm the project.
    const canRead = await canReadProject(session.user.id, project);
    if (!canRead) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    const projectId = project.id;

    const members = await db.query.projectMembers.findMany({
      where: eq(schema.projectMembers.projectId, projectId),
      with: {
        user: {
          columns: {
            id: true,
            name: true,
            email: true,
            image: true,
          },
        },
      },
    });

    // Transform to include all permission fields
    const transformedMembers = members.map((m) => ({
      ...m,
      // Convert string booleans to actual booleans for frontend
      permissions: {
        canBrowseProject: m.canBrowseProject === 'true',
        canAdministerProject: m.canAdministerProject === 'true',
        canBrowseDocs: m.canBrowseDocs === 'true',
        canCreateDocs: m.canCreateDocs === 'true',
        canEditDocs: m.canEditDocs === 'true',
        canDeleteDocs: m.canDeleteDocs === 'true',
        canBrowseChat: m.canBrowseChat === 'true',
        canCreateChannels: m.canCreateChannels === 'true',
        canPostMessages: m.canPostMessages === 'true',
        canModerateMessages: m.canModerateMessages === 'true',
        canStartCalls: m.canStartCalls === 'true',
        canManageCalls: m.canManageCalls === 'true',
        canManageSprints: m.canManageSprints === 'true',
        canStartSprint: m.canStartSprint === 'true',
        canCompleteSprint: m.canCompleteSprint === 'true',
        canDeleteSprint: m.canDeleteSprint === 'true',
        canCreateIssues: m.canCreateIssues === 'true',
        canEditIssues: m.canEditIssues === 'true',
        canEditOwnIssues: m.canEditOwnIssues === 'true',
        canDeleteIssues: m.canDeleteIssues === 'true',
        canDeleteOwnIssues: m.canDeleteOwnIssues === 'true',
        canAssignIssues: m.canAssignIssues === 'true',
        canAssigneeIssues: m.canAssigneeIssues === 'true',
        canTransitionIssues: m.canTransitionIssues === 'true',
        canScheduleIssues: m.canScheduleIssues === 'true',
        canMoveIssues: m.canMoveIssues === 'true',
        canLinkIssues: m.canLinkIssues === 'true',
        canCloseIssues: m.canCloseIssues === 'true',
        canReopenIssues: m.canReopenIssues === 'true',
        canAddComments: m.canAddComments === 'true',
        canEditOwnComments: m.canEditOwnComments === 'true',
        canEditAllComments: m.canEditAllComments === 'true',
        canDeleteOwnComments: m.canDeleteOwnComments === 'true',
        canDeleteAllComments: m.canDeleteAllComments === 'true',
        canCreateAttachments: m.canCreateAttachments === 'true',
        canDeleteOwnAttachments: m.canDeleteOwnAttachments === 'true',
        canDeleteAllAttachments: m.canDeleteAllAttachments === 'true',
        canManageWatchers: m.canManageWatchers === 'true',
        canViewWatchers: m.canViewWatchers === 'true',
        canManageMembers: m.canManageMembers === 'true',
        canInviteMembers: m.canInviteMembers === 'true',
        canRemoveMembers: m.canRemoveMembers === 'true',
        canChangeRoles: m.canChangeRoles === 'true',
        canManageWorkflow: m.canManageWorkflow === 'true',
        canLogWork: m.canLogWork === 'true',
        canEditOwnWorklogs: m.canEditOwnWorklogs === 'true',
        canEditAllWorklogs: m.canEditAllWorklogs === 'true',
        canDeleteOwnWorklogs: m.canDeleteOwnWorklogs === 'true',
        canDeleteAllWorklogs: m.canDeleteAllWorklogs === 'true',
      },
    }));

    return NextResponse.json(transformedMembers);
  } catch (error) {
    console.error('Error fetching project members:', error);
    return NextResponse.json({ error: 'Failed to fetch project members' }, { status: 500 });
  }
}

// POST /api/projects/[projectId]/members - Add member to project
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ projectId: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { projectId: projectIdOrKey } = await params;
    const project = await resolveProjectByIdOrKey(projectIdOrKey, session.user.id);

    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    // 404 (not 403) so cross-org probing cannot confirm the project exists
    const canRead = await canReadProject(session.user.id, project);
    if (!canRead) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    const projectId = project.id;

    // Check permission
    const canManage = await canManageProjectMembers(session.user.id, projectId);
    if (!canManage) {
      return NextResponse.json(
        { error: 'You do not have permission to add members' },
        { status: 403 }
      );
    }

    const body = await request.json();
    const { userId, role = 'developer' } = body;

    if (!userId) {
      return NextResponse.json({ error: 'userId is required' }, { status: 400 });
    }

    // Check if member already exists
    const existing = await db.query.projectMembers.findFirst({
      where: and(
        eq(schema.projectMembers.projectId, projectId),
        eq(schema.projectMembers.userId, userId)
      ),
    });

    if (existing) {
      return NextResponse.json(
        { error: 'User is already a member of this project' },
        { status: 409 }
      );
    }

    // Get default permissions for the role
    const roleDefaults =
      ROLE_DEFAULT_PERMISSIONS[role as ProjectRole] || ROLE_DEFAULT_PERMISSIONS.developer;

    // Create member with role default permissions
    const [member] = await db
      .insert(schema.projectMembers)
      .values({
        projectId,
        userId,
        role,
        invitedBy: session.user.id,
        // Set all permissions based on role defaults
        canBrowseProject: roleDefaults.canBrowseProject ? 'true' : 'false',
        canAdministerProject: roleDefaults.canAdministerProject ? 'true' : 'false',
        canBrowseDocs: roleDefaults.canBrowseDocs ? 'true' : 'false',
        canCreateDocs: roleDefaults.canCreateDocs ? 'true' : 'false',
        canEditDocs: roleDefaults.canEditDocs ? 'true' : 'false',
        canDeleteDocs: roleDefaults.canDeleteDocs ? 'true' : 'false',
        canBrowseChat: roleDefaults.canBrowseChat ? 'true' : 'false',
        canCreateChannels: roleDefaults.canCreateChannels ? 'true' : 'false',
        canPostMessages: roleDefaults.canPostMessages ? 'true' : 'false',
        canModerateMessages: roleDefaults.canModerateMessages ? 'true' : 'false',
        canStartCalls: roleDefaults.canStartCalls ? 'true' : 'false',
        canManageCalls: roleDefaults.canManageCalls ? 'true' : 'false',
        canManageSprints: roleDefaults.canManageSprints ? 'true' : 'false',
        canStartSprint: roleDefaults.canStartSprint ? 'true' : 'false',
        canCompleteSprint: roleDefaults.canCompleteSprint ? 'true' : 'false',
        canDeleteSprint: roleDefaults.canDeleteSprint ? 'true' : 'false',
        canCreateIssues: roleDefaults.canCreateIssues ? 'true' : 'false',
        canEditIssues: roleDefaults.canEditIssues ? 'true' : 'false',
        canEditOwnIssues: roleDefaults.canEditOwnIssues ? 'true' : 'false',
        canDeleteIssues: roleDefaults.canDeleteIssues ? 'true' : 'false',
        canDeleteOwnIssues: roleDefaults.canDeleteOwnIssues ? 'true' : 'false',
        canAssignIssues: roleDefaults.canAssignIssues ? 'true' : 'false',
        canAssigneeIssues: roleDefaults.canAssigneeIssues ? 'true' : 'false',
        canTransitionIssues: roleDefaults.canTransitionIssues ? 'true' : 'false',
        canScheduleIssues: roleDefaults.canScheduleIssues ? 'true' : 'false',
        canMoveIssues: roleDefaults.canMoveIssues ? 'true' : 'false',
        canLinkIssues: roleDefaults.canLinkIssues ? 'true' : 'false',
        canCloseIssues: roleDefaults.canCloseIssues ? 'true' : 'false',
        canReopenIssues: roleDefaults.canReopenIssues ? 'true' : 'false',
        canAddComments: roleDefaults.canAddComments ? 'true' : 'false',
        canEditOwnComments: roleDefaults.canEditOwnComments ? 'true' : 'false',
        canEditAllComments: roleDefaults.canEditAllComments ? 'true' : 'false',
        canDeleteOwnComments: roleDefaults.canDeleteOwnComments ? 'true' : 'false',
        canDeleteAllComments: roleDefaults.canDeleteAllComments ? 'true' : 'false',
        canCreateAttachments: roleDefaults.canCreateAttachments ? 'true' : 'false',
        canDeleteOwnAttachments: roleDefaults.canDeleteOwnAttachments ? 'true' : 'false',
        canDeleteAllAttachments: roleDefaults.canDeleteAllAttachments ? 'true' : 'false',
        canManageWatchers: roleDefaults.canManageWatchers ? 'true' : 'false',
        canViewWatchers: roleDefaults.canViewWatchers ? 'true' : 'false',
        canManageMembers: roleDefaults.canManageMembers ? 'true' : 'false',
        canInviteMembers: roleDefaults.canInviteMembers ? 'true' : 'false',
        canRemoveMembers: roleDefaults.canRemoveMembers ? 'true' : 'false',
        canChangeRoles: roleDefaults.canChangeRoles ? 'true' : 'false',
        canManageWorkflow: roleDefaults.canManageWorkflow ? 'true' : 'false',
        canLogWork: roleDefaults.canLogWork ? 'true' : 'false',
        canEditOwnWorklogs: roleDefaults.canEditOwnWorklogs ? 'true' : 'false',
        canEditAllWorklogs: roleDefaults.canEditAllWorklogs ? 'true' : 'false',
        canDeleteOwnWorklogs: roleDefaults.canDeleteOwnWorklogs ? 'true' : 'false',
        canDeleteAllWorklogs: roleDefaults.canDeleteAllWorklogs ? 'true' : 'false',
      })
      .returning();

    return NextResponse.json(member, { status: 201 });
  } catch (error) {
    console.error('Error adding project member:', error);
    return NextResponse.json({ error: 'Failed to add project member' }, { status: 500 });
  }
}
