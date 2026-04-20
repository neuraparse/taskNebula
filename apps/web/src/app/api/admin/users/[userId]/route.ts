/**
 * Super Admin API - Single User Management
 * GET /api/admin/users/[userId] - Get user details
 * PATCH /api/admin/users/[userId] - Update user (grant/revoke super admin)
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { db, users, systemAuditLogs } from '@tasknebula/db';
import { eq } from 'drizzle-orm';
import { auth } from '@/auth';
import { isSuperAdmin } from '@/lib/auth/permissions';
import { createId } from '@paralleldrive/cuid2';

// GET /api/admin/users/[userId]
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ userId: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const isAdmin = await isSuperAdmin();
    if (!isAdmin) {
      return NextResponse.json({ error: 'Super admin access required' }, { status: 403 });
    }

    const { userId } = await params;

    const [user] = await db
      .select({
        id: users.id,
        name: users.name,
        email: users.email,
        image: users.image,
        status: users.status,
        isSuperAdmin: users.isSuperAdmin,
        superAdminGrantedAt: users.superAdminGrantedAt,
        createdAt: users.createdAt,
      })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    return NextResponse.json(user);
  } catch (error) {
    console.error('Failed to fetch user:', error);
    return NextResponse.json(
      { error: 'Failed to fetch user' },
      { status: 500 }
    );
  }
}

const updateUserSchema = z.object({
  isSuperAdmin: z.boolean().optional(),
  status: z.enum(['active', 'inactive', 'invited']).optional(),
});

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ userId: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const isAdmin = await isSuperAdmin();
    if (!isAdmin) {
      return NextResponse.json({ error: 'Super admin access required' }, { status: 403 });
    }

    const { userId } = await params;
    const body = await request.json();
    const data = updateUserSchema.parse(body);

    // Get current user
    const [currentUser] = await db
      .select()
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);

    if (!currentUser) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Prevent removing own super admin status
    if (userId === session.user.id && data.isSuperAdmin === false) {
      return NextResponse.json(
        { error: 'Cannot remove your own super admin status' },
        { status: 400 }
      );
    }

    // Update user
    const updateData: any = {
      ...data,
      updatedAt: new Date(),
    };

    // If granting super admin, set granted fields
    if (data.isSuperAdmin === true && !currentUser.isSuperAdmin) {
      updateData.superAdminGrantedAt = new Date();
      updateData.superAdminGrantedBy = session.user.id;
    }

    // If revoking super admin, clear granted fields
    if (data.isSuperAdmin === false && currentUser.isSuperAdmin) {
      updateData.superAdminGrantedAt = null;
      updateData.superAdminGrantedBy = null;
    }

    const [updatedUser] = await db
      .update(users)
      .set(updateData)
      .where(eq(users.id, userId))
      .returning();

    if (!updatedUser) {
      throw new Error('Failed to update user');
    }

    // Create audit log
    const changes: Record<string, { from: any; to: any }> = {};
    if (data.isSuperAdmin !== undefined && data.isSuperAdmin !== currentUser.isSuperAdmin) {
      changes.isSuperAdmin = { from: currentUser.isSuperAdmin, to: data.isSuperAdmin };
    }
    if (data.status && data.status !== currentUser.status) {
      changes.status = { from: currentUser.status, to: data.status };
    }

    if (Object.keys(changes).length > 0) {
      await db.insert(systemAuditLogs).values({
        id: createId(),
        userId: session.user.id,
        action: data.isSuperAdmin === true ? 'user.promoted_to_super_admin' : data.isSuperAdmin === false ? 'user.revoked_super_admin' : 'user.updated',
        resourceType: 'user',
        resourceId: userId,
        changes,
        ipAddress: request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || undefined,
        userAgent: request.headers.get('user-agent') || undefined,
      });
    }

    return NextResponse.json({
      id: updatedUser.id,
      name: updatedUser.name,
      email: updatedUser.email,
      image: updatedUser.image,
      status: updatedUser.status,
      isSuperAdmin: updatedUser.isSuperAdmin,
      superAdminGrantedAt: updatedUser.superAdminGrantedAt,
      createdAt: updatedUser.createdAt,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Validation failed', details: error.errors },
        { status: 400 }
      );
    }

    console.error('Failed to update user:', error);
    return NextResponse.json(
      { error: 'Failed to update user' },
      { status: 500 }
    );
  }
}

