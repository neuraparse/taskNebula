import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { db, schema, eq, and, auditLogs, type ProjectRole } from '@tasknebula/db';
import { createId } from '@paralleldrive/cuid2';
import { resolveProjectByIdOrKey } from '@/lib/projects/server';
import { canReadProject } from '@/lib/auth/access-control';
import { getProjectMemberPermissionValues } from '@/lib/projects/member-permissions';
import { canManageProjectMembers } from '@/lib/projects/member-access';
import { hasPermission } from '@/lib/auth/permissions';
import { publishEvent } from '@/lib/realtime/events';

type DbExecutor = typeof db | Parameters<Parameters<typeof db.transaction>[0]>[0];

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

    const targetOrgMember = await db.query.organizationMembers.findFirst({
      where: and(
        eq(schema.organizationMembers.userId, userId),
        eq(schema.organizationMembers.organizationId, project.organizationId),
        eq(schema.organizationMembers.status, 'active')
      ),
      columns: { id: true },
    });

    let targetUser: { id: string; email: string } | null = null;
    const shouldEnsureOrgMember = !targetOrgMember;

    if (!targetOrgMember) {
      targetUser =
        (await db.query.users.findFirst({
          where: and(eq(schema.users.id, userId), eq(schema.users.status, 'active')),
          columns: { id: true, email: true },
        })) ?? null;

      if (!targetUser) {
        return NextResponse.json({ error: 'User not found' }, { status: 404 });
      }

      const canInviteToWorkspace = await hasPermission(project.organizationId, 'member:invite');
      if (!canInviteToWorkspace) {
        return NextResponse.json(
          { error: 'Invite this user to the organization before adding them to a project' },
          { status: 400 }
        );
      }
    }

    const result = await db.transaction(async (tx) => {
      const [existingProjectMember] = await tx
        .select({ id: schema.projectMembers.id })
        .from(schema.projectMembers)
        .where(
          and(
            eq(schema.projectMembers.projectId, projectId),
            eq(schema.projectMembers.userId, userId)
          )
        )
        .limit(1);

      if (existingProjectMember) {
        return { status: 'already_member' as const };
      }

      if (shouldEnsureOrgMember) {
        await ensureOrganizationMemberForProjectAdd(tx, {
          organizationId: project.organizationId,
          userId,
          actorUserId: session.user.id,
          targetUserEmail: targetUser?.email ?? null,
        });
      }

      const [member] = await tx
        .insert(schema.projectMembers)
        .values({
          projectId,
          userId,
          role,
          invitedBy: session.user.id,
          ...getProjectMemberPermissionValues(role as ProjectRole),
        })
        .onConflictDoNothing({
          target: [schema.projectMembers.projectId, schema.projectMembers.userId],
        })
        .returning();

      if (!member) {
        return { status: 'already_member' as const };
      }

      return { status: 'created' as const, member };
    });

    if (result.status === 'already_member') {
      return NextResponse.json(
        { error: 'User is already a member of this project' },
        { status: 409 }
      );
    }

    publishEvent('member.added', session.user.id, { organizationId: project.organizationId });

    return NextResponse.json(result.member, { status: 201 });
  } catch (error) {
    console.error('Error adding project member:', error);
    return NextResponse.json({ error: 'Failed to add project member' }, { status: 500 });
  }
}

async function ensureOrganizationMemberForProjectAdd(
  tx: DbExecutor,
  {
    organizationId,
    userId,
    actorUserId,
    targetUserEmail,
  }: {
    organizationId: string;
    userId: string;
    actorUserId: string;
    targetUserEmail: string | null;
  }
) {
  const [createdOrgMember] = await tx
    .insert(schema.organizationMembers)
    .values({
      id: createId(),
      organizationId,
      userId,
      role: 'member',
      status: 'active',
    })
    .onConflictDoNothing({
      target: [schema.organizationMembers.organizationId, schema.organizationMembers.userId],
    })
    .returning({ id: schema.organizationMembers.id });

  if (createdOrgMember) {
    await tx.insert(auditLogs).values({
      id: createId(),
      organizationId,
      userId: actorUserId,
      action: 'organization.member_added',
      resourceType: 'organization_member',
      resourceId: createdOrgMember.id,
      metadata: {
        addedRegisteredUserId: userId,
        addedRegisteredUserEmail: targetUserEmail,
        source: 'project_member_add',
      },
    });
    return;
  }

  const [existingOrgMember] = await tx
    .select({ id: schema.organizationMembers.id, status: schema.organizationMembers.status })
    .from(schema.organizationMembers)
    .where(
      and(
        eq(schema.organizationMembers.organizationId, organizationId),
        eq(schema.organizationMembers.userId, userId)
      )
    )
    .limit(1);

  if (!existingOrgMember) {
    throw new Error('Failed to add user to organization');
  }

  if (existingOrgMember.status !== 'active') {
    await tx
      .update(schema.organizationMembers)
      .set({ status: 'active', updatedAt: new Date() })
      .where(eq(schema.organizationMembers.id, existingOrgMember.id));
  }
}
