/**
 * User API - Get current user's organization permissions
 * GET /api/user/me/permissions?organizationId=X
 *
 * Returns the flat Permission[] for the current user in the given organization,
 * resolved from their organization role (+ super admin status if applicable).
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import {
  db,
  organizationMembers,
  users,
  Permission,
  SUPER_ADMIN_PERMISSIONS,
  getRolePermissions,
} from '@tasknebula/db';
import { eq, and } from 'drizzle-orm';

export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const organizationId = searchParams.get('organizationId');
    if (!organizationId) {
      return NextResponse.json(
        { error: 'organizationId query param is required' },
        { status: 400 }
      );
    }

    // Look up super admin status
    const [user] = await db
      .select({
        isSuperAdmin: users.isSuperAdmin,
      })
      .from(users)
      .where(eq(users.id, session.user.id))
      .limit(1);

    const isSuperAdmin = user?.isSuperAdmin || false;

    // Look up organization role
    const [member] = await db
      .select({
        role: organizationMembers.role,
      })
      .from(organizationMembers)
      .where(
        and(
          eq(organizationMembers.userId, session.user.id),
          eq(organizationMembers.organizationId, organizationId)
        )
      )
      .limit(1);

    const role = member?.role ?? null;

    // Not a member and not a super admin — return a "no permissions" shape.
    if (!role && !isSuperAdmin) {
      return NextResponse.json({
        organizationId,
        role: null,
        isSuperAdmin: false,
        permissions: [] as Permission[],
      });
    }

    // Compute the flat permission list.
    const rolePermissions: Permission[] = role ? getRolePermissions(role) : [];
    const permissions: Permission[] = isSuperAdmin
      ? Array.from(new Set<Permission>([...rolePermissions, ...SUPER_ADMIN_PERMISSIONS]))
      : rolePermissions;

    return NextResponse.json({
      organizationId,
      role,
      isSuperAdmin,
      permissions,
    });
  } catch (error) {
    console.error('Failed to fetch user permissions:', error);
    return NextResponse.json(
      { error: 'Failed to fetch user permissions' },
      { status: 500 }
    );
  }
}
