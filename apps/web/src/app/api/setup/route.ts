import { NextRequest, NextResponse } from 'next/server';
import {
  db,
  users,
  organizations,
  organizationMembers,
  workflows,
  workflowStatuses,
  workflowTransitions,
} from '@tasknebula/db';
import { eq, sql } from 'drizzle-orm';
import bcrypt from 'bcryptjs';
import { createId } from '@paralleldrive/cuid2';

// GET /api/setup - Check if setup is needed
export async function GET() {
  try {
    const [result] = await db.select({ count: sql<number>`count(*)` }).from(users);
    const userCount = Number(result?.count ?? 0);

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

    const newUser = await db.transaction(async (tx) => {
      await tx.execute(sql`select pg_advisory_xact_lock(hashtext('tasknebula.initial_setup'))`);

      const [result] = await tx.select({ count: sql<number>`count(*)` }).from(users);
      if (Number(result?.count ?? 0) > 0) {
        throw new Error('SETUP_ALREADY_COMPLETED');
      }

      // Create admin user
      const userId = createId();
      const [createdUser] = await tx
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

      if (!createdUser) {
        throw new Error('Failed to create admin user');
      }

      // Create default organization
      const orgName = organizationName || `${name}'s Organization`;
      const orgSlug = orgName
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-|-$/g, '');

      const orgId = createId();
      await tx.insert(organizations).values({
        id: orgId,
        name: orgName,
        slug: orgSlug,
        plan: 'free',
        status: 'active',
        settings: {},
      });

      // Add user as organization owner
      await tx.insert(organizationMembers).values({
        id: createId(),
        organizationId: orgId,
        userId,
        role: 'owner',
        status: 'active',
      });

      // Create default workflow with statuses and transitions
      const workflowId = createId();
      await tx.insert(workflows).values({
        id: workflowId,
        organizationId: orgId,
        name: 'Default Workflow',
        description: 'Default workflow for all projects',
        isDefault: true,
        createdBy: userId,
        updatedBy: userId,
      });

      const todoId = createId();
      const inProgressId = createId();
      const inReviewId = createId();
      const doneId = createId();

      await tx.insert(workflowStatuses).values([
        {
          id: todoId,
          workflowId,
          name: 'To Do',
          category: 'backlog',
          color: '#94a3b8',
          position: 0,
        },
        {
          id: inProgressId,
          workflowId,
          name: 'In Progress',
          category: 'in_progress',
          color: '#3b82f6',
          position: 1,
        },
        {
          id: inReviewId,
          workflowId,
          name: 'In Review',
          category: 'in_progress',
          color: '#f59e0b',
          position: 2,
        },
        { id: doneId, workflowId, name: 'Done', category: 'done', color: '#10b981', position: 3 },
      ]);

      await tx.insert(workflowTransitions).values([
        {
          id: createId(),
          workflowId,
          name: 'Start Progress',
          fromStatusId: todoId,
          toStatusId: inProgressId,
        },
        {
          id: createId(),
          workflowId,
          name: 'Submit for Review',
          fromStatusId: inProgressId,
          toStatusId: inReviewId,
        },
        {
          id: createId(),
          workflowId,
          name: 'Complete',
          fromStatusId: inReviewId,
          toStatusId: doneId,
        },
        { id: createId(), workflowId, name: 'Reopen', fromStatusId: doneId, toStatusId: todoId },
      ]);

      return createdUser;
    });

    return NextResponse.json(
      {
        success: true,
        message: 'Setup completed! You can now sign in.',
        user: {
          id: newUser.id,
          name: newUser.name,
          email: newUser.email,
        },
      },
      { status: 201 }
    );
  } catch (error) {
    if (error instanceof Error && error.message === 'SETUP_ALREADY_COMPLETED') {
      return NextResponse.json(
        { error: 'Setup already completed. Use the login page.' },
        { status: 400 }
      );
    }

    console.error('Setup error:', error);
    return NextResponse.json(
      { error: 'Setup failed. Please check your database connection.' },
      { status: 500 }
    );
  }
}
