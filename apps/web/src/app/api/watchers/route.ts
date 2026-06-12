import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { db, watchers, users, projects } from '@tasknebula/db';
import { eq, and, or } from 'drizzle-orm';
import { z } from 'zod';
import {
  canReadIssue,
  canReadProject,
  isActiveOrganizationMember,
} from '@/lib/auth/access-control';

export const dynamic = 'force-dynamic';

const createWatcherSchema = z
  .object({
    issueId: z.string().optional(),
    projectId: z.string().optional(),
  })
  .refine((data) => data.issueId || data.projectId, {
    message: 'Either issueId or projectId must be provided',
  });

/**
 * Verify the caller can actually see the watched issue/project before any
 * watcher read or mutation. Cross-org probes get a 404 so resource existence
 * is not leaked; in-org callers without project access get a 403.
 *
 * Returns a NextResponse to short-circuit with, or null when access is OK.
 */
async function guardWatchTarget(
  userId: string,
  target: { issueId?: string | null; projectId?: string | null }
): Promise<NextResponse | null> {
  if (target.issueId) {
    const access = await canReadIssue(userId, target.issueId);
    if (!access.issue) {
      return NextResponse.json({ error: 'Issue not found' }, { status: 404 });
    }
    if (!access.allowed) {
      const sameOrg = await isActiveOrganizationMember(userId, access.issue.organizationId);
      return NextResponse.json(
        { error: sameOrg ? 'Forbidden' : 'Issue not found' },
        { status: sameOrg ? 403 : 404 }
      );
    }
  }

  if (target.projectId) {
    const [project] = await db
      .select()
      .from(projects)
      .where(eq(projects.id, target.projectId))
      .limit(1);
    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }
    if (!(await canReadProject(userId, project))) {
      const sameOrg = await isActiveOrganizationMember(userId, project.organizationId);
      return NextResponse.json(
        { error: sameOrg ? 'Forbidden' : 'Project not found' },
        { status: sameOrg ? 403 : 404 }
      );
    }
  }

  return null;
}

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
    return NextResponse.json({ error: 'Either issueId or projectId is required' }, { status: 400 });
  }

  try {
    // Permission check: the watched issue/project must be visible to the caller.
    const denied = await guardWatchTarget(session.user.id, { issueId, projectId });
    if (denied) {
      return denied;
    }

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
    return NextResponse.json({ error: 'Failed to fetch watchers' }, { status: 500 });
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

    // Permission check: the watched issue/project must be visible to the caller.
    const denied = await guardWatchTarget(session.user.id, validatedData);
    if (denied) {
      return denied;
    }

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
      return NextResponse.json({ error: 'Already watching' }, { status: 409 });
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
    return NextResponse.json({ error: 'Failed to create watcher' }, { status: 500 });
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
    return NextResponse.json({ error: 'Either issueId or projectId is required' }, { status: 400 });
  }

  try {
    // Permission check: the watched issue/project must be visible to the caller.
    const denied = await guardWatchTarget(session.user.id, { issueId, projectId });
    if (denied) {
      return denied;
    }

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
    return NextResponse.json({ error: 'Failed to delete watcher' }, { status: 500 });
  }
}
