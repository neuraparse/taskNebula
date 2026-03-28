import { NextRequest, NextResponse } from 'next/server';
import { db, users, organizations, organizationMembers } from '@tasknebula/db';
import { eq, sql } from 'drizzle-orm';
import bcrypt from 'bcryptjs';
import { createId } from '@paralleldrive/cuid2';

// GET /api/setup - Check if setup is needed
export async function GET() {
  try {
    const [result] = await db.select({ count: sql<number>`count(*)` }).from(users);
    const userCount = Number(result.count);

    return NextResponse.json({
      setupRequired: userCount === 0,
      userCount,
    });
  } catch {
    // Database might not be ready yet
    return NextResponse.json({ setupRequired: true, userCount: 0 });
  }
}

// POST /api/setup - Create initial admin account
export async function POST(request: NextRequest) {
  try {
    // Check if setup is already done
    const [result] = await db.select({ count: sql<number>`count(*)` }).from(users);
    if (Number(result.count) > 0) {
      return NextResponse.json(
        { error: 'Setup already completed. Use the login page.' },
        { status: 400 }
      );
    }

    const body = await request.json();
    const { name, email, password, organizationName } = body;

    // Validate input
    if (!name || !email || !password) {
      return NextResponse.json(
        { error: 'Name, email, and password are required' },
        { status: 400 }
      );
    }

    if (password.length < 8) {
      return NextResponse.json(
        { error: 'Password must be at least 8 characters' },
        { status: 400 }
      );
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 12);

    // Create admin user
    const userId = createId();
    const [newUser] = await db
      .insert(users)
      .values({
        id: userId,
        name,
        email: email.toLowerCase(),
        password: hashedPassword,
        status: 'active',
        isSuperAdmin: true,
        settings: {},
      })
      .returning();

    // Create default organization
    const orgName = organizationName || `${name}'s Organization`;
    const orgSlug = orgName
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '');

    const orgId = createId();
    await db.insert(organizations).values({
      id: orgId,
      name: orgName,
      slug: orgSlug,
      ownerId: userId,
      plan: 'free',
      status: 'active',
      settings: {},
    });

    // Add user as organization owner
    await db.insert(organizationMembers).values({
      id: createId(),
      organizationId: orgId,
      userId: userId,
      role: 'owner',
      status: 'active',
    });

    return NextResponse.json({
      success: true,
      message: 'Setup completed! You can now sign in.',
      user: {
        id: newUser.id,
        name: newUser.name,
        email: newUser.email,
      },
    }, { status: 201 });
  } catch (error) {
    console.error('Setup error:', error);
    return NextResponse.json(
      { error: 'Setup failed. Please check your database connection.' },
      { status: 500 }
    );
  }
}
