import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { db, schema, eq, and, ROLE_DEFAULT_PERMISSIONS, PERMISSION_KEYS, type ProjectRole, type PermissionKey } from '@tasknebula/db';

// Helper to resolve project key or id
async function resolveProjectId(projectIdOrKey: string): Promise<string | null> {
  if (projectIdOrKey.length > 10 || projectIdOrKey.includes('_')) {
    return projectIdOrKey;
  }
  const project = await db.query.projects.findFirst({
    where: eq(schema.projects.key, projectIdOrKey.toUpperCase()),
  });
  return project?.id || null;
}

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
      eq(schema.organizationMembers.organizationId, project.organizationId)
    ),
    columns: { role: true },
  });
  if (orgMember?.role === 'owner') return true;

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
      eq(schema.organizationMembers.organizationId, project.organizationId)
    ),
    columns: { role: true },
  });
  if (orgMember?.role === 'owner' || orgMember?.role === 'admin') return true;

  const projectMember = await db.query.projectMembers.findFirst({
    where: and(
      eq(schema.projectMembers.userId, userId),
      eq(schema.projectMembers.projectId, projectId)
    ),
  });
  if (!projectMember) return false;

  const roleDefaults = ROLE_DEFAULT_PERMISSIONS[projectMember.role as ProjectRole];
  return projectMember.canRemoveMembers === 'true' || roleDefaults?.canRemoveMembers || false;
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
    const projectId = await resolveProjectId(projectIdOrKey);

    if (!projectId) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    // Check permission
    const canChange = await canChangeRolesAndPermissions(session.user.id, projectId);
    if (!canChange) {
      return NextResponse.json({ error: 'You do not have permission to change roles/permissions' }, { status: 403 });
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

    if (Object.keys(updateData).length <= 1) { // Only updatedAt
      return NextResponse.json({ error: 'No update data provided' }, { status: 400 });
    }

    const [updated] = await db
      .update(schema.projectMembers)
      .set(updateData)
      .where(and(eq(schema.projectMembers.id, memberId), eq(schema.projectMembers.projectId, projectId)))
      .returning();

    if (!updated) {
      return NextResponse.json({ error: 'Member not found' }, { status: 404 });
    }

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
    const projectId = await resolveProjectId(projectIdOrKey);

    if (!projectId) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    // Get the member to be deleted
    const memberToDelete = await db.query.projectMembers.findFirst({
      where: and(eq(schema.projectMembers.id, memberId), eq(schema.projectMembers.projectId, projectId)),
    });

    if (!memberToDelete) {
      return NextResponse.json({ error: 'Member not found' }, { status: 404 });
    }

    // Users can remove themselves
    if (memberToDelete.userId !== session.user.id) {
      const canRemove = await canRemoveProjectMembers(session.user.id, projectId);
      if (!canRemove) {
        return NextResponse.json({ error: 'You do not have permission to remove members' }, { status: 403 });
      }
    }

    // Prevent removing the last product_owner
    if (memberToDelete.role === 'product_owner') {
      const productOwners = await db.query.projectMembers.findMany({
        where: and(
          eq(schema.projectMembers.projectId, projectId),
          eq(schema.projectMembers.role, 'product_owner')
        ),
      });
      if (productOwners.length <= 1) {
        return NextResponse.json({ error: 'Cannot remove the last Product Owner' }, { status: 400 });
      }
    }

    const [deleted] = await db
      .delete(schema.projectMembers)
      .where(and(eq(schema.projectMembers.id, memberId), eq(schema.projectMembers.projectId, projectId)))
      .returning();

    return NextResponse.json({ success: true, deleted });
  } catch (error) {
    console.error('Error removing project member:', error);
    return NextResponse.json({ error: 'Failed to remove project member' }, { status: 500 });
  }
}

