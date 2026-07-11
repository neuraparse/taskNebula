/**
 * User API - Get current user info
 * GET /api/user/me - Get current user with super admin status
 */

import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import {
  and,
  db,
  eq,
  hasPermission as roleHasPermission,
  organizationMembers,
  users,
} from '@tasknebula/db';

export async function GET() {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const [user] = await db
      .select({
        id: users.id,
        name: users.name,
        email: users.email,
        image: users.image,
        isSuperAdmin: users.isSuperAdmin,
        status: users.status,
        emailVerified: users.emailVerified,
      })
      .from(users)
      .where(eq(users.id, session.user.id))
      .limit(1);

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    let trustedForVerification = user.isSuperAdmin === true;
    if (!trustedForVerification) {
      const memberships = await db
        .select({ role: organizationMembers.role })
        .from(organizationMembers)
        .where(
          and(eq(organizationMembers.userId, user.id), eq(organizationMembers.status, 'active'))
        );
      trustedForVerification = memberships.some((membership) =>
        roleHasPermission(membership.role || '', 'org:settings')
      );
    }

    return NextResponse.json({
      ...user,
      emailVerificationRequired: !user.emailVerified && !trustedForVerification,
    });
  } catch (error) {
    console.error('Failed to fetch user:', error);
    return NextResponse.json({ error: 'Failed to fetch user' }, { status: 500 });
  }
}
