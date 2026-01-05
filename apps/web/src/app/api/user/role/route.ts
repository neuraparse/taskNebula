import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { db, users, organizationMembers, eq } from '@tasknebula/db';

export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get user super admin status
    const [user] = await db
      .select({ 
        isSuperAdmin: users.isSuperAdmin,
      })
      .from(users)
      .where(eq(users.id, session.user.id))
      .limit(1);

    // Get first organization membership (for now, users belong to one org)
    const [orgMember] = await db
      .select({ 
        role: organizationMembers.role,
        organizationId: organizationMembers.organizationId,
      })
      .from(organizationMembers)
      .where(eq(organizationMembers.userId, session.user.id))
      .limit(1);

    return NextResponse.json({
      isSuperAdmin: user?.isSuperAdmin || false,
      orgRole: orgMember?.role || null,
      organizationId: orgMember?.organizationId || null,
    });
  } catch (error) {
    console.error('Error fetching user role:', error);
    return NextResponse.json(
      { error: 'Failed to fetch user role' },
      { status: 500 }
    );
  }
}

