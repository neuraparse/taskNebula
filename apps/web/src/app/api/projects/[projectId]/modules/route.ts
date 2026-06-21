import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { desc, eq } from 'drizzle-orm';
import { auth } from '@/auth';
import { db } from '@tasknebula/db';
import { projectModules } from '@tasknebula/db/src/schema/project-modules';
import { resolveProjectAccess } from '@/lib/auth/project-access';

const MODULE_STATUSES = [
  'backlog',
  'planned',
  'in_progress',
  'paused',
  'completed',
  'cancelled',
] as const;

const createModuleSchema = z.object({
  name: z.string().min(1).max(255),
  description: z.string().max(2000).nullable().optional(),
  status: z.enum(MODULE_STATUSES).optional(),
  ownerId: z.string().nullable().optional(),
  memberIds: z.array(z.string()).optional(),
  targetDate: z.string().datetime().nullable().optional().or(z.string().length(0)),
});

async function ensureProjectAccess(
  projectIdOrKey: string,
  userId: string,
  mode: 'read' | 'manage'
) {
  const access = await resolveProjectAccess(userId, projectIdOrKey);
  if (!access.project || !access.canRead) {
    return {
      error: NextResponse.json({ error: 'Project not found' }, { status: 404 }),
    };
  }

  if (mode === 'manage' && !access.canManage) {
    return { error: NextResponse.json({ error: 'Forbidden' }, { status: 403 }) };
  }

  return { project: access.project };
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

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ projectId: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { projectId } = await params;
  const access = await ensureProjectAccess(projectId, session.user.id, 'read');
  if ('error' in access) return access.error;

  const rows = await db
    .select()
    .from(projectModules)
    .where(eq(projectModules.projectId, access.project.id))
    .orderBy(desc(projectModules.createdAt));

  return NextResponse.json({ modules: rows.map(serializeModule) });
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ projectId: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { projectId } = await params;
  const access = await ensureProjectAccess(projectId, session.user.id, 'manage');
  if ('error' in access) return access.error;

  try {
    const body = await request.json();
    const parsed = createModuleSchema.parse(body);

    const [row] = await db
      .insert(projectModules)
      .values({
        projectId: access.project.id,
        name: parsed.name.trim(),
        description: parsed.description ?? null,
        status: parsed.status ?? 'backlog',
        ownerId: parsed.ownerId ?? null,
        memberIds: parsed.memberIds ?? [],
        targetDate: parseTargetDate(parsed.targetDate ?? null),
      })
      .returning();

    if (!row) {
      throw new Error('Failed to create module');
    }

    return NextResponse.json({ module: serializeModule(row) }, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid module payload', details: error.errors },
        { status: 400 }
      );
    }
    console.error('Create project module error:', error);
    return NextResponse.json({ error: 'Failed to create module' }, { status: 500 });
  }
}
