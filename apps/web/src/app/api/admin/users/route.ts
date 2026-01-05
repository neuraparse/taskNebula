/**
 * Super Admin API - Users Management
 * GET /api/admin/users - List all users
 * POST /api/admin/users - Create new user
 */

import { NextRequest, NextResponse } from 'next/server';
import { db, users, organizationMembers, organizations } from '@tasknebula/db';
import { eq, desc, count, like, or } from 'drizzle-orm';
import { auth } from '@/auth';
import { isSuperAdmin } from '@/lib/auth/permissions';
import { createId } from '@paralleldrive/cuid2';
import bcrypt from 'bcryptjs';

export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const isAdmin = await isSuperAdmin();
    if (!isAdmin) {
      return NextResponse.json({ error: 'Super admin access required' }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1', 10);
    const limit = parseInt(searchParams.get('limit') || '20', 10);
    const search = searchParams.get('search');
    const status = searchParams.get('status'); // 'active', 'inactive', 'invited'

    // Build query
    let query = db.select().from(users);

    // Apply filters
    const conditions = [];
    if (status) {
      conditions.push(eq(users.status, status as any));
    }
    if (search) {
      conditions.push(
        or(
          like(users.name, `%${search}%`),
          like(users.email, `%${search}%`)
        )
      );
    }

    // Get users
    const allUsers = await db
      .select()
      .from(users)
      .orderBy(desc(users.createdAt))
      .limit(limit)
      .offset((page - 1) * limit);

    // Get organization memberships for each user
    const usersWithOrgs = await Promise.all(
      allUsers.map(async (user) => {
        const memberships = await db
          .select({
            organizationId: organizationMembers.organizationId,
            organizationName: organizations.name,
            role: organizationMembers.role,
          })
          .from(organizationMembers)
          .innerJoin(organizations, eq(organizationMembers.organizationId, organizations.id))
          .where(eq(organizationMembers.userId, user.id));

        return {
          id: user.id,
          name: user.name,
          email: user.email,
          image: user.image,
          status: user.status,
          isSuperAdmin: user.isSuperAdmin,
          superAdminGrantedAt: user.superAdminGrantedAt,
          createdAt: user.createdAt,
          organizations: memberships,
        };
      })
    );

    // Get total count
    const [totalCount] = await db.select({ count: count() }).from(users);

    return NextResponse.json({
      users: usersWithOrgs,
      pagination: {
        page,
        limit,
        total: totalCount?.count || 0,
        totalPages: Math.ceil((totalCount?.count || 0) / limit),
      },
    });
  } catch (error) {
    console.error('Failed to fetch users:', error);
    return NextResponse.json(
      { error: 'Failed to fetch users' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const isAdmin = await isSuperAdmin();
    if (!isAdmin) {
      return NextResponse.json({ error: 'Super admin access required' }, { status: 403 });
    }

    const body = await request.json();
    const { name, email, password, isSuperAdmin: makeSuperAdmin } = body;

    // Validate required fields
    if (!name || !email || !password) {
      return NextResponse.json(
        { error: 'Name, email, and password are required' },
        { status: 400 }
      );
    }

    // Check if user already exists
    const existingUser = await db.query.users.findFirst({
      where: eq(users.email, email),
    });

    if (existingUser) {
      return NextResponse.json(
        { error: 'User with this email already exists' },
        { status: 400 }
      );
    }

    // Hash password
    const passwordHash = await bcrypt.hash(password, 10);

    // Create user
    const [newUser] = await db
      .insert(users)
      .values({
        id: createId(),
        name,
        email,
        password: passwordHash,
        status: 'active',
        isSuperAdmin: makeSuperAdmin || false,
        superAdminGrantedAt: makeSuperAdmin ? new Date() : null,
        superAdminGrantedBy: makeSuperAdmin ? session.user.id : null,
        settings: {},
      })
      .returning();

    return NextResponse.json({
      user: {
        id: newUser.id,
        name: newUser.name,
        email: newUser.email,
        status: newUser.status,
        isSuperAdmin: newUser.isSuperAdmin,
        createdAt: newUser.createdAt,
      },
    });
  } catch (error) {
    console.error('Failed to create user:', error);
    return NextResponse.json(
      { error: 'Failed to create user' },
      { status: 500 }
    );
  }
}
