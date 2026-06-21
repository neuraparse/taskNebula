import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { db, initiatives, initiativeUpdates, organizationMembers, users } from '@tasknebula/db';
import { eq, and, desc } from 'drizzle-orm';
import { createId } from '@paralleldrive/cuid2';

async function loadInitiativeForUser(initiativeId: string, userId: string) {
  const [initiative] = await db
    .select()
    .from(initiatives)
    .where(eq(initiatives.id, initiativeId))
    .limit(1);
  if (!initiative) return { error: NextResponse.json({ error: 'Not found' }, { status: 404 }) };

  const [member] = await db
    .select()
    .from(organizationMembers)
    .where(
      and(
        eq(organizationMembers.userId, userId),
        eq(organizationMembers.organizationId, initiative.workspaceId),
        eq(organizationMembers.status, 'active')
      )
    )
    .limit(1);
  if (!member) return { error: NextResponse.json({ error: 'Forbidden' }, { status: 403 }) };

  return { initiative };
}

// GET /api/initiatives/[id]/updates — list updates newest-first.
export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id } = await params;
  const auth_ = await loadInitiativeForUser(id, session.user.id);
  if ('error' in auth_) return auth_.error;

  const rows = await db
    .select({
      id: initiativeUpdates.id,
      initiativeId: initiativeUpdates.initiativeId,
      status: initiativeUpdates.status,
      summary: initiativeUpdates.summary,
      blockers: initiativeUpdates.blockers,
      nextSteps: initiativeUpdates.nextSteps,
      weekOf: initiativeUpdates.weekOf,
      createdAt: initiativeUpdates.createdAt,
      authorId: initiativeUpdates.authorId,
      authorName: users.name,
      authorImage: users.image,
    })
    .from(initiativeUpdates)
    .leftJoin(users, eq(users.id, initiativeUpdates.authorId))
    .where(eq(initiativeUpdates.initiativeId, id))
    .orderBy(desc(initiativeUpdates.weekOf), desc(initiativeUpdates.createdAt));

  return NextResponse.json({ updates: rows });
}

// POST /api/initiatives/[id]/updates — post a new weekly update.
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id } = await params;
  const auth_ = await loadInitiativeForUser(id, session.user.id);
  if ('error' in auth_) return auth_.error;

  const body = await request.json().catch(() => null);
  if (!body || typeof body !== 'object') {
    return NextResponse.json({ error: 'Invalid body' }, { status: 400 });
  }

  const { status, summary, blockers, nextSteps, weekOf } = body as Record<string, unknown>;
  if (!status || typeof status !== 'string') {
    return NextResponse.json({ error: 'status required' }, { status: 400 });
  }
  if (!summary || typeof summary !== 'string') {
    return NextResponse.json({ error: 'summary required' }, { status: 400 });
  }

  // Default week-of to today (YYYY-MM-DD).
  const today = new Date().toISOString().slice(0, 10);

  const [created] = await db
    .insert(initiativeUpdates)
    .values({
      id: createId(),
      initiativeId: id,
      authorId: session.user.id,
      status,
      summary,
      blockers: typeof blockers === 'string' ? blockers : null,
      nextSteps: typeof nextSteps === 'string' ? nextSteps : null,
      weekOf: (typeof weekOf === 'string' && weekOf.length > 0 ? weekOf : today) as any,
    })
    .returning();

  // NOTE: Slack cross-post for initiative updates is tracked by roadmap
  // task #15 — intentionally out of scope here.

  return NextResponse.json({ update: created }, { status: 201 });
}
