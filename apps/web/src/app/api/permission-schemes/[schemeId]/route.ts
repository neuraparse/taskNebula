import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { db, permissionSchemes, projectPermissionSchemes } from '@tasknebula/db';
import { eq, and } from 'drizzle-orm';

// GET /api/permission-schemes/[schemeId] - Get a specific permission scheme
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ schemeId: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { schemeId } = await params;

    const [scheme] = await db
      .select()
      .from(permissionSchemes)
      .where(eq(permissionSchemes.id, schemeId));

    if (!scheme) {
      return NextResponse.json({ error: 'Permission scheme not found' }, { status: 404 });
    }

    // Get projects using this scheme
    const projectAssignments = await db
      .select()
      .from(projectPermissionSchemes)
      .where(eq(projectPermissionSchemes.schemeId, schemeId));

    return NextResponse.json({
      ...scheme,
      projectCount: projectAssignments.length,
    });
  } catch (error) {
    console.error('Error fetching permission scheme:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// PATCH /api/permission-schemes/[schemeId] - Update a permission scheme
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ schemeId: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { schemeId } = await params;
    const body = await request.json();
    const { name, description, permissions, isDefault } = body;

    // Get existing scheme
    const [existingScheme] = await db
      .select()
      .from(permissionSchemes)
      .where(eq(permissionSchemes.id, schemeId));

    if (!existingScheme) {
      return NextResponse.json({ error: 'Permission scheme not found' }, { status: 404 });
    }

    // If setting as default, unset other defaults
    if (isDefault) {
      await db
        .update(permissionSchemes)
        .set({ isDefault: false, updatedAt: new Date(), updatedBy: session.user.id })
        .where(eq(permissionSchemes.organizationId, existingScheme.organizationId));
    }

    const [updatedScheme] = await db
      .update(permissionSchemes)
      .set({
        ...(name && { name }),
        ...(description !== undefined && { description }),
        ...(permissions && { permissions }),
        ...(isDefault !== undefined && { isDefault }),
        updatedAt: new Date(),
        updatedBy: session.user.id,
      })
      .where(eq(permissionSchemes.id, schemeId))
      .returning();

    return NextResponse.json(updatedScheme);
  } catch (error) {
    console.error('Error updating permission scheme:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// DELETE /api/permission-schemes/[schemeId] - Delete a permission scheme
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ schemeId: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { schemeId } = await params;

    // Check if scheme is in use
    const projectAssignments = await db
      .select()
      .from(projectPermissionSchemes)
      .where(eq(projectPermissionSchemes.schemeId, schemeId));

    if (projectAssignments.length > 0) {
      return NextResponse.json(
        { error: 'Cannot delete scheme that is assigned to projects' },
        { status: 400 }
      );
    }

    await db.delete(permissionSchemes).where(eq(permissionSchemes.id, schemeId));

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting permission scheme:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

