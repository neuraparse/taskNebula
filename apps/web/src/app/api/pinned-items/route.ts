import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { db, pinnedItems } from '@tasknebula/db';
import { eq, desc, and } from 'drizzle-orm';
import { z } from 'zod';

export const dynamic = 'force-dynamic';

const PIN_KINDS = ['issue', 'doc', 'project', 'chat', 'custom'] as const;

const createPinnedItemSchema = z.object({
  kind: z.enum(PIN_KINDS),
  entityId: z.string().optional(),
  title: z.string().min(1).max(500),
  href: z.string().min(1).max(2048),
});

/**
 * GET /api/pinned-items
 *
 * List pinned items for the current user (most recent first).
 */
export async function GET() {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const items = await db
      .select()
      .from(pinnedItems)
      .where(eq(pinnedItems.userId, session.user.id))
      .orderBy(desc(pinnedItems.pinnedAt));

    return NextResponse.json({ items });
  } catch (error) {
    console.error('Get pinned items error:', error);
    return NextResponse.json(
      { error: 'Failed to get pinned items' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/pinned-items
 *
 * Idempotent insert: pinning the same href twice returns the existing row.
 */
export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const data = createPinnedItemSchema.parse(body);

    // Check for existing pin (idempotent by (userId, href)).
    const [existing] = await db
      .select()
      .from(pinnedItems)
      .where(
        and(
          eq(pinnedItems.userId, session.user.id),
          eq(pinnedItems.href, data.href)
        )
      )
      .limit(1);

    if (existing) {
      return NextResponse.json({ item: existing });
    }

    const [created] = await db
      .insert(pinnedItems)
      .values({
        userId: session.user.id,
        kind: data.kind,
        entityId: data.entityId ?? null,
        title: data.title,
        href: data.href,
      })
      .returning();

    return NextResponse.json({ item: created }, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid request data', details: error.errors },
        { status: 400 }
      );
    }

    console.error('Create pinned item error:', error);
    return NextResponse.json(
      { error: 'Failed to create pinned item' },
      { status: 500 }
    );
  }
}
