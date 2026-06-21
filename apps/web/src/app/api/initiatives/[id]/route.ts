import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { db, initiatives, initiativeProjects, projects } from '@tasknebula/db';
import { eq, and, inArray } from 'drizzle-orm';
import { resolveInitiativeAccess } from '@/lib/initiatives/access';
import {
  buildInitiativeIndex,
  validateInitiativeDepth,
  wouldCreateInitiativeCycle,
} from '@/lib/initiatives/depth';

async function loadAndAuthorize(initiativeId: string, userId: string) {
  const { initiative, canRead } = await resolveInitiativeAccess(userId, initiativeId);
  if (!initiative) return { error: NextResponse.json({ error: 'Not found' }, { status: 404 }) };
  if (!canRead) {
    return { error: NextResponse.json({ error: 'Forbidden' }, { status: 403 }) };
  }
  return { initiative };
}

// GET /api/initiatives/[id] — single initiative + linked projects + direct children.
export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
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
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
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
      const index = buildInitiativeIndex(rows);
      // Reject indirect cycles: setting `parentInitiativeId = descendant`
      // forms a loop that the depth-walk alone can't detect (the new edge
      // isn't in the index yet).
      if (wouldCreateInitiativeCycle(id, nextParent, index)) {
        return NextResponse.json(
          { error: 'Cannot parent an initiative to one of its descendants' },
          { status: 400 }
        );
      }
      const verdict = validateInitiativeDepth(nextParent, index);
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

  let updated;
  try {
    [updated] = await db
      .update(initiatives)
      .set(updates as any)
      .where(eq(initiatives.id, id))
      .returning();
  } catch (err: unknown) {
    // Same `23505` unique-violation translation as POST — a workspace-wide
    // duplicate slug would otherwise surface as a 500.
    if (typeof err === 'object' && err !== null && (err as { code?: string }).code === '23505') {
      const slugValue = typeof updates.slug === 'string' ? updates.slug : (initiative.slug ?? '');
      return NextResponse.json(
        { error: `Slug "${slugValue}" is already in use in this workspace.` },
        { status: 409 }
      );
    }
    throw err;
  }

  // Replace project links if a `projectIds` array is provided. Validate
  // every id belongs to this initiative's workspace before touching
  // `initiative_projects` — otherwise a cross-workspace id would 500 on
  // the FK after we'd already wiped the existing rows.
  if (Array.isArray((patch as { projectIds?: unknown }).projectIds)) {
    const requested = ((patch as { projectIds?: unknown }).projectIds as unknown[]).filter(
      (p): p is string => typeof p === 'string' && p.length > 0
    );
    if (requested.length > 0) {
      const owned = await db
        .select({ id: projects.id })
        .from(projects)
        .where(
          and(eq(projects.organizationId, initiative.workspaceId), inArray(projects.id, requested))
        );
      const ownedIds = new Set(owned.map((row) => row.id));
      const stranger = requested.find((projectId) => !ownedIds.has(projectId));
      if (stranger) {
        return NextResponse.json(
          { error: `Project ${stranger} does not belong to this workspace` },
          { status: 400 }
        );
      }
    }
    await db.delete(initiativeProjects).where(eq(initiativeProjects.initiativeId, id));
    if (requested.length > 0) {
      await db
        .insert(initiativeProjects)
        .values(requested.map((projectId) => ({ initiativeId: id, projectId })));
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
