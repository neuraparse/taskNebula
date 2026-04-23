import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { and, eq } from 'drizzle-orm';
import { auth } from '@/auth';
import { db, organizationMembers } from '@tasknebula/db';
import { projectModules } from '@tasknebula/db/src/schema/project-modules';
import { resolveProjectByIdOrKey } from '@/lib/projects/server';

const MODULE_STATUSES = [
  'backlog',
  'planned',
  'in_progress',
  'paused',
  'completed',
  'cancelled',
] as const;

const updateModuleSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  description: z.string().max(2000).nullable().optional(),
  status: z.enum(MODULE_STATUSES).optional(),
  ownerId: z.string().nullable().optional(),
  memberIds: z.array(z.string()).optional(),
  targetDate: z
    .string()
    .datetime()
    .nullable()
    .optional()
    .or(z.string().length(0)),
});

async function ensureProjectAccess(projectIdOrKey: string, userId: string) {
  const project = await resolveProjectByIdOrKey(projectIdOrKey);
  if (!project) {
    return {
      error: NextResponse.json({ error: 'Project not found' }, { status: 404 }),
    };
  }

  const [membership] = await db
    .select({ id: organizationMembers.id })
    .from(organizationMembers)
    .where(
      and(
        eq(organizationMembers.organizationId, project.organizationId),
        eq(organizationMembers.userId, userId),
      ),
    )
    .limit(1);

  if (!membership) {
    return { error: NextResponse.json({ error: 'Forbidden' }, { status: 403 }) };
  }

  return { project };
}

function serializeModule(row: typeof projectModules.$inferSelect) {
  return {
    id: row.id,
    projectId: row.projectId,
    name: row.name,
    description: row.description,
    status: row.status,
    ownerId: row.ownerId,
    memberIds: Array.isArray(row.memberIds) ? (row.memberIds as string[]) : [],
    targetDate: row.targetDate ? row.targetDate.toISOString() : null,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

function parseTargetDate(value: string | null | undefined): Date | null {
  if (!value) return null;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  return d;
}

async function getModuleInProject(projectId: string, moduleId: string) {
  const [row] = await db
    .select()
    .from(projectModules)
    .where(
      and(eq(projectModules.id, moduleId), eq(projectModules.projectId, projectId)),
    )
    .limit(1);
  return row ?? null;
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ projectId: string; moduleId: string }> },
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { projectId, moduleId } = await params;
  const access = await ensureProjectAccess(projectId, session.user.id);
  if ('error' in access) return access.error;

  const existing = await getModuleInProject(access.project.id, moduleId);
  if (!existing) {
    return NextResponse.json({ error: 'Module not found' }, { status: 404 });
  }

  try {
    const body = await request.json();
    const parsed = updateModuleSchema.parse(body);

    const update: Partial<typeof projectModules.$inferInsert> = {
      updatedAt: new Date(),
    };

    if (parsed.name !== undefined) update.name = parsed.name.trim();
    if (parsed.description !== undefined) update.description = parsed.description;
    if (parsed.status !== undefined) update.status = parsed.status;
    if (parsed.ownerId !== undefined) update.ownerId = parsed.ownerId;
    if (parsed.memberIds !== undefined) update.memberIds = parsed.memberIds;
    if (parsed.targetDate !== undefined) {
      update.targetDate = parseTargetDate(parsed.targetDate);
    }

    const [row] = await db
      .update(projectModules)
      .set(update)
      .where(eq(projectModules.id, existing.id))
      .returning();

    if (!row) throw new Error('Failed to update module');

    return NextResponse.json({ module: serializeModule(row) });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid module payload', details: error.errors },
        { status: 400 },
      );
    }
    console.error('Update project module error:', error);
    return NextResponse.json({ error: 'Failed to update module' }, { status: 500 });
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ projectId: string; moduleId: string }> },
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { projectId, moduleId } = await params;
  const access = await ensureProjectAccess(projectId, session.user.id);
  if ('error' in access) return access.error;

  const existing = await getModuleInProject(access.project.id, moduleId);
  if (!existing) {
    return NextResponse.json({ error: 'Module not found' }, { status: 404 });
  }

  try {
    await db.delete(projectModules).where(eq(projectModules.id, existing.id));
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Delete project module error:', error);
    return NextResponse.json({ error: 'Failed to delete module' }, { status: 500 });
  }
}
