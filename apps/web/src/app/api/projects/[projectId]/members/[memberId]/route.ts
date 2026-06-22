import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import {
  db,
  schema,
  eq,
  and,
  ROLE_DEFAULT_PERMISSIONS,
  PERMISSION_KEYS,
  hasPermission as roleHasPermission,
  type ProjectRole,
  type PermissionKey,
} from '@tasknebula/db';
import { createId } from '@paralleldrive/cuid2';
import { resolveProjectByIdOrKey } from '@/lib/projects/server';
import { canReadProject } from '@/lib/auth/access-control';
import { publishEvent } from '@/lib/realtime/events';

// Check if user can change roles/permissions
async function canChangeRolesAndPermissions(userId: string, projectId: string): Promise<boolean> {
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
      eq(schema.organizationMembers.organizationId, project.organizationId),
      eq(schema.organizationMembers.status, 'active')
    ),
    columns: { role: true },
  });
  if (roleHasPermission(orgMember?.role || '', 'project:manage')) return true;

  // Check project role - only product_owner can change roles
  const projectMember = await db.query.projectMembers.findFirst({
    where: and(
      eq(schema.projectMembers.userId, userId),
      eq(schema.projectMembers.projectId, projectId)
    ),
  });
  if (!projectMember) return false;

  const roleDefaults = ROLE_DEFAULT_PERMISSIONS[projectMember.role as ProjectRole];
  return projectMember.canChangeRoles === 'true' || roleDefaults?.canChangeRoles || false;
}

// Check if user can remove members
async function canRemoveProjectMembers(userId: string, projectId: string): Promise<boolean> {
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
    projectMember.canRemoveMembers === 'true' ||
    roleDefaults?.canManageMembers ||
    roleDefaults?.canRemoveMembers ||
    false
  );
}

async function isSuperAdminUser(userId: string): Promise<boolean> {
  const user = await db.query.users.findFirst({
    where: eq(schema.users.id, userId),
    columns: { isSuperAdmin: true },
  });
  return user?.isSuperAdmin === true;
}

// PATCH /api/projects/[projectId]/members/[memberId] - Update member role and permissions
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ projectId: string; memberId: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { projectId: projectIdOrKey, memberId } = await params;
    const project = await resolveProjectByIdOrKey(projectIdOrKey, session.user.id);

    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    const canRead = await canReadProject(session.user.id, project);
    if (!canRead) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    const projectId = project.id;

    // Check permission
    const canChange = await canChangeRolesAndPermissions(session.user.id, projectId);
    if (!canChange) {
      return NextResponse.json(
        { error: 'You do not have permission to change roles/permissions' },
        { status: 403 }
      );
    }

    const body = await request.json();
    const { role, permissions } = body;

    const updateData: Record<string, any> = {};
    updateData.updatedAt = new Date();

    // Update role if provided
    if (role) {
      updateData.role = role;

      // If role changed, optionally reset permissions to role defaults
      if (body.resetToDefaults) {
        const roleDefaults = ROLE_DEFAULT_PERMISSIONS[role as ProjectRole];
        if (roleDefaults) {
          Object.keys(PERMISSION_KEYS).forEach((key) => {
            const permKey = key as PermissionKey;
            updateData[permKey] = roleDefaults[permKey] ? 'true' : 'false';
          });
        }
      }
    }

    // Update individual permissions if provided
    if (permissions && typeof permissions === 'object') {
      Object.keys(permissions).forEach((key) => {
        if (key in PERMISSION_KEYS) {
          updateData[key] = permissions[key] ? 'true' : 'false';
        }
      });
    }

    if (Object.keys(updateData).length <= 1) {
      // Only updatedAt
      return NextResponse.json({ error: 'No update data provided' }, { status: 400 });
    }

    const [updated] = await db
      .update(schema.projectMembers)
      .set(updateData)
      .where(
        and(eq(schema.projectMembers.id, memberId), eq(schema.projectMembers.projectId, projectId))
      )
      .returning();

    if (!updated) {
      return NextResponse.json({ error: 'Member not found' }, { status: 404 });
    }

    publishEvent('member.updated', session.user.id, {
      organizationId: project.organizationId,
      projectId,
      targetUserId: updated.userId,
    });

    return NextResponse.json(updated);
  } catch (error) {
    console.error('Error updating project member:', error);
    return NextResponse.json({ error: 'Failed to update project member' }, { status: 500 });
  }
}

// DELETE /api/projects/[projectId]/members/[memberId] - Remove member from project
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ projectId: string; memberId: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { projectId: projectIdOrKey, memberId } = await params;
    const project = await resolveProjectByIdOrKey(projectIdOrKey, session.user.id);

    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    const canRead = await canReadProject(session.user.id, project);
    if (!canRead) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    const projectId = project.id;

    // Get the member to be deleted
    const memberToDelete = await db.query.projectMembers.findFirst({
      where: and(
        eq(schema.projectMembers.id, memberId),
        eq(schema.projectMembers.projectId, projectId)
      ),
    });

    if (!memberToDelete) {
      return NextResponse.json({ error: 'Member not found' }, { status: 404 });
    }

    const actorIsSuperAdmin = await isSuperAdminUser(session.user.id);

    // Users can remove themselves
    if (memberToDelete.userId !== session.user.id && !actorIsSuperAdmin) {
      const canRemove = await canRemoveProjectMembers(session.user.id, projectId);
      if (!canRemove) {
        return NextResponse.json(
          { error: 'You do not have permission to remove members' },
          { status: 403 }
        );
      }
    }

    // Prevent removing the last product_owner
    if (!actorIsSuperAdmin && memberToDelete.role === 'product_owner') {
      const productOwners = await db.query.projectMembers.findMany({
        where: and(
          eq(schema.projectMembers.projectId, projectId),
          eq(schema.projectMembers.role, 'product_owner')
        ),
      });
      if (productOwners.length <= 1) {
        return NextResponse.json(
          { error: 'Cannot remove the last Product Owner' },
          { status: 400 }
        );
      }
    }

    const [deleted] = await db
      .delete(schema.projectMembers)
      .where(
        and(eq(schema.projectMembers.id, memberId), eq(schema.projectMembers.projectId, projectId))
      )
      .returning();

    await db.insert(schema.auditLogs).values({
      id: createId(),
      organizationId: project.organizationId,
      userId: session.user.id,
      action: 'project.member_removed',
      resourceType: 'project_member',
      resourceId: memberToDelete.id,
      projectId,
      metadata: {
        memberId: memberToDelete.userId,
        role: memberToDelete.role,
      },
    });

    publishEvent('member.removed', session.user.id, {
      organizationId: project.organizationId,
      projectId,
      targetUserId: memberToDelete.userId,
    });

    return NextResponse.json({ success: true, deleted });
  } catch (error) {
    console.error('Error removing project member:', error);
    return NextResponse.json({ error: 'Failed to remove project member' }, { status: 500 });
  }
}
