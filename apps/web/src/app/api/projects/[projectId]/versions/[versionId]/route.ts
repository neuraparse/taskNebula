import { NextRequest, NextResponse } from 'next/server';
import { db, projectVersions } from '@tasknebula/db';
import { auth } from '@/auth';
import { eq, and, ne } from 'drizzle-orm';
import { z } from 'zod';
import { resolveProjectByIdOrKey } from '@/lib/projects/server';
import { canManageProject, canReadProject } from '@/lib/auth/access-control';

export const dynamic = 'force-dynamic';

const updateVersionSchema = z.object({
  name: z.string().min(1).max(120).optional(),
  description: z.string().max(10000).optional().nullable(),
  startDate: z.coerce.date().optional().nullable(),
  releaseDate: z.coerce.date().optional().nullable(),
  status: z.enum(['unreleased', 'released', 'archived']).optional(),
  sortOrder: z.number().int().optional(),
});

async function resolveVersionAccess(
  userId: string,
  projectIdOrKey: string,
  versionId: string
): Promise<
  | {
      ok: true;
      project: NonNullable<Awaited<ReturnType<typeof resolveProjectByIdOrKey>>>;
      version: typeof projectVersions.$inferSelect;
    }
  | { ok: false; response: NextResponse }
> {
  const project = await resolveProjectByIdOrKey(projectIdOrKey, userId);
  if (!project) {
    return {
      ok: false,
      response: NextResponse.json({ error: 'Project not found' }, { status: 404 }),
    };
  }
  // 404 (not 403) so cross-org probing can't confirm the project exists
  if (!(await canReadProject(userId, project))) {
    return {
      ok: false,
      response: NextResponse.json({ error: 'Project not found' }, { status: 404 }),
    };
  }

  const [version] = await db
    .select()
    .from(projectVersions)
    .where(and(eq(projectVersions.id, versionId), eq(projectVersions.projectId, project.id)))
    .limit(1);
  if (!version) {
    return {
      ok: false,
      response: NextResponse.json({ error: 'Version not found' }, { status: 404 }),
    };
  }

  return { ok: true, project, version };
}

// GET /api/projects/[projectId]/versions/[versionId] - Fetch a single version
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ projectId: string; versionId: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { projectId, versionId } = await params;
    const access = await resolveVersionAccess(session.user.id, projectId, versionId);
    if (!access.ok) return access.response;

    return NextResponse.json({ version: access.version });
  } catch (error) {
    console.error('Error fetching project version:', error);
    return NextResponse.json({ error: 'Failed to fetch version' }, { status: 500 });
  }
}

// PATCH /api/projects/[projectId]/versions/[versionId] - Update a version
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ projectId: string; versionId: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { projectId, versionId } = await params;
    const access = await resolveVersionAccess(session.user.id, projectId, versionId);
    if (!access.ok) return access.response;
    const { project, version } = access;

    if (!(await canManageProject(session.user.id, project))) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const body = updateVersionSchema.parse(await request.json());

    if (body.name !== undefined && body.name !== version.name) {
      const [duplicate] = await db
        .select({ id: projectVersions.id })
        .from(projectVersions)
        .where(
          and(
            eq(projectVersions.projectId, project.id),
            eq(projectVersions.name, body.name),
            ne(projectVersions.id, version.id)
          )
        )
        .limit(1);
      if (duplicate) {
        return NextResponse.json(
          { error: 'A version with this name already exists in this project' },
          { status: 409 }
        );
      }
    }

    const updates: Partial<typeof projectVersions.$inferInsert> = { updatedAt: new Date() };
    if (body.name !== undefined) updates.name = body.name;
    if (body.description !== undefined) updates.description = body.description;
    if (body.startDate !== undefined) updates.startDate = body.startDate;
    if (body.releaseDate !== undefined) updates.releaseDate = body.releaseDate;
    if (body.sortOrder !== undefined) updates.sortOrder = body.sortOrder;
    if (body.status !== undefined && body.status !== version.status) {
      updates.status = body.status;
      if (body.status === 'released') {
        updates.releasedAt = version.releasedAt ?? new Date();
      } else if (body.status === 'unreleased') {
        updates.releasedAt = null;
      }
    }

    const [updated] = await db
      .update(projectVersions)
      .set(updates)
      .where(eq(projectVersions.id, version.id))
      .returning();

    return NextResponse.json({ version: updated });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid request data', details: error.errors },
        { status: 400 }
      );
    }
    console.error('Error updating project version:', error);
    return NextResponse.json({ error: 'Failed to update version' }, { status: 500 });
  }
}

// DELETE /api/projects/[projectId]/versions/[versionId] - Delete a version
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ projectId: string; versionId: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { projectId, versionId } = await params;
    const access = await resolveVersionAccess(session.user.id, projectId, versionId);
    if (!access.ok) return access.response;

    if (!(await canManageProject(session.user.id, access.project))) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // issue_fix_versions / issue_affects_versions rows cascade on delete
    await db.delete(projectVersions).where(eq(projectVersions.id, access.version.id));

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting project version:', error);
    return NextResponse.json({ error: 'Failed to delete version' }, { status: 500 });
  }
}
