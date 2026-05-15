import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import {
  db,
  initiatives,
  initiativeProjects,
  organizationMembers,
  projects,
  MAX_INITIATIVE_DEPTH,
} from '@tasknebula/db';
import { eq, and, inArray, asc } from 'drizzle-orm';
import { createId } from '@paralleldrive/cuid2';
import { buildInitiativeIndex, validateInitiativeDepth } from '@/lib/initiatives/depth';

/**
 * GET /api/initiatives — list every initiative in the user's organizations
 * with their immediate children collapsed into a nested `children` array
 * (one level of explicit nesting; the UI walks the tree itself).
 *
 * Query params:
 *   - workspaceId  Optional. Filter to a single organization the user belongs
 *                  to. When omitted, returns every workspace the caller has
 *                  membership in.
 */
export async function GET(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const workspaceIdParam = request.nextUrl.searchParams.get('workspaceId');

  // Resolve which workspaces the caller can see.
  const memberships = await db
    .select({ organizationId: organizationMembers.organizationId })
    .from(organizationMembers)
    .where(eq(organizationMembers.userId, session.user.id));

  if (memberships.length === 0) {
    return NextResponse.json({ initiatives: [] });
  }

  let workspaceIds = memberships.map((m) => m.organizationId);
  if (workspaceIdParam) {
    if (!workspaceIds.includes(workspaceIdParam)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    workspaceIds = [workspaceIdParam];
  }

  const rows = await db
    .select()
    .from(initiatives)
    .where(inArray(initiatives.workspaceId, workspaceIds))
    .orderBy(asc(initiatives.sortOrder), asc(initiatives.createdAt));

  // Build a nested tree client-side-friendly shape. Roots first, each node
  // carries a flat `children` array of *direct* children. The UI does the
  // rest of the walk (we cap depth at 5, so this is cheap).
  type Row = (typeof rows)[number];
  type Node = Row & { children: Node[] };

  const byId = new Map<string, Node>();
  for (const row of rows) {
    byId.set(row.id, { ...(row as Row), children: [] });
  }
  const roots: Node[] = [];
  for (const node of byId.values()) {
    if (node.parentInitiativeId && byId.has(node.parentInitiativeId)) {
      byId.get(node.parentInitiativeId)!.children.push(node);
    } else {
      roots.push(node);
    }
  }

  return NextResponse.json({ initiatives: roots, flat: rows });
}

/**
 * POST /api/initiatives — create a new initiative.
 *
 * Body: { workspaceId, name, slug?, description?, parentInitiativeId?, status?,
 *         ownerUserId?, targetDate?, color?, sortOrder? }
 *
 * Enforces the 5-level depth cap when `parentInitiativeId` is provided.
 */
export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  if (!body || typeof body !== 'object') {
    return NextResponse.json({ error: 'Invalid body' }, { status: 400 });
  }

  const {
    workspaceId,
    name,
    slug,
    description,
    parentInitiativeId,
    status,
    ownerUserId,
    targetDate,
    color,
    sortOrder,
  } = body as Record<string, unknown>;

  if (!workspaceId || typeof workspaceId !== 'string') {
    return NextResponse.json({ error: 'workspaceId required' }, { status: 400 });
  }
  if (!name || typeof name !== 'string') {
    return NextResponse.json({ error: 'name required' }, { status: 400 });
  }

  // Membership check
  const [membership] = await db
    .select()
    .from(organizationMembers)
    .where(
      and(
        eq(organizationMembers.userId, session.user.id),
        eq(organizationMembers.organizationId, workspaceId)
      )
    )
    .limit(1);

  if (!membership) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  // Depth enforcement + same-workspace check for the proposed parent.
  // Without the workspace check the FK would catch a cross-workspace
  // parent at INSERT time as a 500; better to reject explicitly with 400.
  if (parentInitiativeId) {
    if (typeof parentInitiativeId !== 'string') {
      return NextResponse.json({ error: 'parentInitiativeId must be string' }, { status: 400 });
    }
    const [parentRow] = await db
      .select({ id: initiatives.id, workspaceId: initiatives.workspaceId })
      .from(initiatives)
      .where(eq(initiatives.id, parentInitiativeId))
      .limit(1);
    if (!parentRow || parentRow.workspaceId !== workspaceId) {
      return NextResponse.json(
        { error: 'parentInitiativeId does not belong to this workspace' },
        { status: 400 }
      );
    }

    const siblings = await db
      .select({
        id: initiatives.id,
        parentInitiativeId: initiatives.parentInitiativeId,
      })
      .from(initiatives)
      .where(eq(initiatives.workspaceId, workspaceId));

    const index = buildInitiativeIndex(siblings);
    const verdict = validateInitiativeDepth(parentInitiativeId, index);
    if (!verdict.allowed) {
      return NextResponse.json(
        {
          error: `Initiative depth ${verdict.depth} exceeds max ${verdict.max}`,
        },
        { status: 400 }
      );
    }
  }

  // Validate every `projectIds` entry belongs to this workspace before we
  // insert the linking rows. The FK would otherwise reject the row with a
  // 500-class error after the initiative was already created (partial
  // state). Pulling the membership up front keeps the route atomic.
  let validatedProjectIds: string[] | null = null;
  if (Array.isArray((body as { projectIds?: unknown }).projectIds)) {
    const requested = ((body as { projectIds?: unknown }).projectIds as unknown[]).filter(
      (p): p is string => typeof p === 'string' && p.length > 0
    );
    if (requested.length > 0) {
      const owned = await db
        .select({ id: projects.id })
        .from(projects)
        .where(and(eq(projects.organizationId, workspaceId), inArray(projects.id, requested)));
      const ownedIds = new Set(owned.map((row) => row.id));
      const stranger = requested.find((id) => !ownedIds.has(id));
      if (stranger) {
        return NextResponse.json(
          { error: `Project ${stranger} does not belong to this workspace` },
          { status: 400 }
        );
      }
      validatedProjectIds = requested;
    } else {
      validatedProjectIds = [];
    }
  }

  const computedSlug =
    typeof slug === 'string' && slug.length > 0
      ? slug.toLowerCase()
      : name
          .toLowerCase()
          .replace(/[^a-z0-9-]+/g, '-')
          .replace(/^-+|-+$/g, '')
          .slice(0, 80) || createId().slice(0, 8);

  const id = createId();
  let created;
  try {
    [created] = await db
      .insert(initiatives)
      .values({
        id,
        workspaceId,
        parentInitiativeId: (parentInitiativeId as string | null) || null,
        name,
        slug: computedSlug,
        description: typeof description === 'string' ? description : null,
        status: (status as any) || 'planned',
        ownerUserId: (ownerUserId as string | null) || null,
        targetDate: (targetDate as string | null) || null,
        color: (color as string | null) || null,
        sortOrder: typeof sortOrder === 'number' ? sortOrder : 0,
        createdBy: session.user.id,
        updatedBy: session.user.id,
      })
      .returning();
  } catch (err: unknown) {
    // postgres-js surfaces unique-violation as `error.code === '23505'`.
    // Translate to 409 Conflict instead of letting a 500 bubble up.
    if (typeof err === 'object' && err !== null && (err as { code?: string }).code === '23505') {
      return NextResponse.json(
        { error: `Slug "${computedSlug}" is already in use in this workspace.` },
        { status: 409 }
      );
    }
    throw err;
  }

  // Optionally link projects (already validated above).
  if (validatedProjectIds && validatedProjectIds.length > 0) {
    await db
      .insert(initiativeProjects)
      .values(validatedProjectIds.map((projectId) => ({ initiativeId: id, projectId })))
      .onConflictDoNothing();
  }

  return NextResponse.json(
    { initiative: created, maxDepth: MAX_INITIATIVE_DEPTH },
    { status: 201 }
  );
}
