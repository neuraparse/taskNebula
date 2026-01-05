import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { db, watchers, users } from '@tasknebula/db';
import { eq, and, or } from 'drizzle-orm';
import { z } from 'zod';

export const dynamic = 'force-dynamic';

const createWatcherSchema = z.object({
  issueId: z.string().optional(),
  projectId: z.string().optional(),
}).refine(data => data.issueId || data.projectId, {
  message: 'Either issueId or projectId must be provided',
});

/**
 * GET /api/watchers?issueId=xxx or ?projectId=xxx
 * 
 * Get watchers for an issue or project
 */
export async function GET(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const issueId = searchParams.get('issueId');
  const projectId = searchParams.get('projectId');

  if (!issueId && !projectId) {
    return NextResponse.json(
      { error: 'Either issueId or projectId is required' },
      { status: 400 }
    );
  }

  try {
    const conditions = [];
    if (issueId) {
      conditions.push(eq(watchers.issueId, issueId));
    }
    if (projectId) {
      conditions.push(eq(watchers.projectId, projectId));
    }

    const watcherList = await db
      .select({
        id: watchers.id,
        userId: watchers.userId,
        issueId: watchers.issueId,
        projectId: watchers.projectId,
        createdAt: watchers.createdAt,
        user: {
          id: users.id,
          name: users.name,
          email: users.email,
          image: users.image,
        },
      })
      .from(watchers)
      .innerJoin(users, eq(watchers.userId, users.id))
      .where(or(...conditions));

    return NextResponse.json({ watchers: watcherList });
  } catch (error) {
    console.error('Error fetching watchers:', error);
    return NextResponse.json(
      { error: 'Failed to fetch watchers' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/watchers
 * 
 * Add a watcher to an issue or project
 */
export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await request.json();
    const validatedData = createWatcherSchema.parse(body);

    // Check if already watching
    const conditions = [eq(watchers.userId, session.user.id)];
    if (validatedData.issueId) {
      conditions.push(eq(watchers.issueId, validatedData.issueId));
    }
    if (validatedData.projectId) {
      conditions.push(eq(watchers.projectId, validatedData.projectId));
    }

    const [existing] = await db
      .select()
      .from(watchers)
      .where(and(...conditions));

    if (existing) {
      return NextResponse.json(
        { error: 'Already watching' },
        { status: 409 }
      );
    }

    // Create watcher
    const [newWatcher] = await db
      .insert(watchers)
      .values({
        userId: session.user.id,
        issueId: validatedData.issueId || null,
        projectId: validatedData.projectId || null,
      })
      .returning();

    return NextResponse.json(newWatcher, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid request data', details: error.errors },
        { status: 400 }
      );
    }

    console.error('Error creating watcher:', error);
    return NextResponse.json(
      { error: 'Failed to create watcher' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/watchers?issueId=xxx or ?projectId=xxx
 * 
 * Remove current user as watcher from an issue or project
 */
export async function DELETE(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const issueId = searchParams.get('issueId');
  const projectId = searchParams.get('projectId');

  if (!issueId && !projectId) {
    return NextResponse.json(
      { error: 'Either issueId or projectId is required' },
      { status: 400 }
    );
  }

  try {
    const conditions = [eq(watchers.userId, session.user.id)];
    if (issueId) {
      conditions.push(eq(watchers.issueId, issueId));
    }
    if (projectId) {
      conditions.push(eq(watchers.projectId, projectId));
    }

    await db.delete(watchers).where(and(...conditions));

    return NextResponse.json({ message: 'Watcher removed successfully' });
  } catch (error) {
    console.error('Error deleting watcher:', error);
    return NextResponse.json(
      { error: 'Failed to delete watcher' },
      { status: 500 }
    );
  }
}

