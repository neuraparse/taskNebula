import { NextRequest, NextResponse } from 'next/server';
import { db, users, organizationMembers } from '@tasknebula/db';
import { eq, and } from 'drizzle-orm';
import bcrypt from 'bcryptjs';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { name, email, password } = body;

    // Validate input
    if (!name || !email || !password) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    if (password.length < 6) {
      return NextResponse.json(
        { error: 'Password must be at least 6 characters' },
        { status: 400 }
      );
    }

    // Check if user already exists
    const existingUser = await db.query.users.findFirst({
      where: eq(users.email, email),
    });

    if (existingUser) {
      // Allow invited users to complete signup by setting their password
      if (existingUser.status === 'invited' && !existingUser.password) {
        const hashedPassword = await bcrypt.hash(password, 10);
        const [updatedUser] = await db
          .update(users)
          .set({
            name,
            password: hashedPassword,
            status: 'active',
          })
          .where(eq(users.id, existingUser.id))
          .returning();

        // Activate any pending org memberships
        await db
          .update(organizationMembers)
          .set({ status: 'active' })
          .where(
            and(
              eq(organizationMembers.userId, existingUser.id),
              eq(organizationMembers.status, 'invited')
            )
          );

        return NextResponse.json(
          {
            message: 'Account activated successfully',
            user: {
              id: updatedUser.id,
              name: updatedUser.name,
              email: updatedUser.email,
            },
          },
          { status: 201 }
        );
      }

      return NextResponse.json(
        { error: 'User with this email already exists' },
        { status: 400 }
      );
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Create user
    const [newUser] = await db
      .insert(users)
      .values({
        name,
        email,
        password: hashedPassword,
        status: 'active',
      })
      .returning();

    return NextResponse.json(
      {
        message: 'User created successfully',
        user: {
          id: newUser.id,
          name: newUser.name,
          email: newUser.email,
        },
      },
      { status: 201 }
    );
  } catch (error) {
    console.error('Signup error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

