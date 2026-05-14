import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import {
  db,
  initiatives,
  initiativeProjects,
  organizationMembers,
  projects,
} from '@tasknebula/db';
import { eq, and } from 'drizzle-orm';
import { buildInitiativeIndex, validateInitiativeDepth } from '@/lib/initiatives/depth';

async function loadAndAuthorize(initiativeId: string, userId: string) {
  const [initiative] = await db
    .select()
    .from(initiatives)
    .where(eq(initiatives.id, initiativeId))
    .limit(1);

  if (!initiative) return { error: NextResponse.json({ error: 'Not found' }, { status: 404 }) };

  const [membership] = await db
    .select()
    .from(organizationMembers)
    .where(
      and(
        eq(organizationMembers.userId, userId),
        eq(organizationMembers.organizationId, initiative.workspaceId)
      )
    )
    .limit(1);

  if (!membership) {
    return { error: NextResponse.json({ error: 'Forbidden' }, { status: 403 }) };
  }
  return { initiative };
}

// GET /api/initiatives/[id] — single initiative + linked projects + direct children.
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id } = await params;
  const result = await loadAndAuthorize(id, session.user.id);
  if ('error' in result) return result.error;
  const { initiative } = result;

  const links = await db
    .select({
      projectId: initiativeProjects.projectId,
      projectName: projects.name,
      projectKey: projects.key,
      projectStatus: projects.status,
    })
    .from(initiativeProjects)
    .leftJoin(projects, eq(projects.id, initiativeProjects.projectId))
    .where(eq(initiativeProjects.initiativeId, id));

  const children = await db
    .select()
    .from(initiatives)
    .where(eq(initiatives.parentInitiativeId, id));

  return NextResponse.json({ initiative, projects: links, children });
}

// PATCH /api/initiatives/[id]
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id } = await params;
  const result = await loadAndAuthorize(id, session.user.id);
  if ('error' in result) return result.error;
  const { initiative } = result;

  const body = await request.json().catch(() => null);
  if (!body || typeof body !== 'object') {
    return NextResponse.json({ error: 'Invalid body' }, { status: 400 });
  }

  const patch = body as Record<string, unknown>;

  // Re-parenting: must keep the resulting subtree under MAX_INITIATIVE_DEPTH.
  if ('parentInitiativeId' in patch) {
    const nextParent = patch.parentInitiativeId as string | null;
    if (nextParent === id) {
      return NextResponse.json({ error: 'Cannot parent an initiative to itself' }, { status: 400 });
    }
    if (nextParent) {
      const rows = await db
        .select({
          id: initiatives.id,
          parentInitiativeId: initiatives.parentInitiativeId,
        })
        .from(initiatives)
        .where(eq(initiatives.workspaceId, initiative.workspaceId));
      const verdict = validateInitiativeDepth(nextParent, buildInitiativeIndex(rows));
      if (!verdict.allowed) {
        return NextResponse.json(
          { error: `Initiative depth ${verdict.depth} exceeds max ${verdict.max}` },
          { status: 400 }
        );
      }
    }
  }

  const updates: Record<string, unknown> = { updatedAt: new Date(), updatedBy: session.user.id };
  for (const field of [
    'name',
    'slug',
    'description',
    'status',
    'ownerUserId',
    'targetDate',
    'color',
    'sortOrder',
    'parentInitiativeId',
  ] as const) {
    if (field in patch) updates[field] = patch[field];
  }

  const [updated] = await db
    .update(initiatives)
    .set(updates as any)
    .where(eq(initiatives.id, id))
    .returning();

  // Replace project links if a `projectIds` array is provided.
  if (Array.isArray((patch as { projectIds?: unknown }).projectIds)) {
    const projectIds = ((patch as { projectIds?: unknown }).projectIds as unknown[])
      .filter((p): p is string => typeof p === 'string' && p.length > 0);
    await db.delete(initiativeProjects).where(eq(initiativeProjects.initiativeId, id));
    if (projectIds.length > 0) {
      await db
        .insert(initiativeProjects)
        .values(projectIds.map((projectId) => ({ initiativeId: id, projectId })));
    }
  }

  return NextResponse.json({ initiative: updated });
}

// DELETE /api/initiatives/[id] — refuses when sub-initiatives still exist.
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id } = await params;
  const result = await loadAndAuthorize(id, session.user.id);
  if ('error' in result) return result.error;

  // Refuse if sub-initiatives still exist — caller must move or delete them
  // first. This is intentionally stricter than the ON DELETE CASCADE
  // configured on the table so an accidental click can't wipe a tree.
  const [childCheck] = await db
    .select()
    .from(initiatives)
    .where(eq(initiatives.parentInitiativeId, id))
    .limit(1);

  if (childCheck) {
    return NextResponse.json(
      {
        error: 'Delete or re-parent sub-initiatives first',
        code: 'has_children',
      },
      { status: 409 }
    );
  }

  await db.delete(initiatives).where(eq(initiatives.id, id));
  return NextResponse.json({ ok: true });
}
