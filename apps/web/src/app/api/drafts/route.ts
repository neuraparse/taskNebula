import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { db } from '@tasknebula/db';
import { drafts } from '@tasknebula/db/src/schema/drafts';
import { eq, desc } from 'drizzle-orm';
import { z } from 'zod';

export const dynamic = 'force-dynamic';

const ENTITY_TYPES = ['issue', 'doc', 'other'] as const;

const createDraftSchema = z.object({
  title: z.string().max(500).optional().nullable(),
  content: z.string().max(100_000).optional().nullable(),
  entityType: z.enum(ENTITY_TYPES).optional(),
  organizationId: z.string().optional().nullable(),
  targetProjectId: z.string().optional().nullable(),
  metadata: z.record(z.unknown()).optional(),
});

/**
 * GET /api/drafts
 *
 * List drafts for the current user (most recently updated first).
 */
export async function GET() {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const items = await db
      .select()
      .from(drafts)
      .where(eq(drafts.userId, session.user.id))
      .orderBy(desc(drafts.updatedAt));

    return NextResponse.json({ drafts: items });
  } catch (error) {
    console.error('Get drafts error:', error);
    return NextResponse.json(
      { error: 'Failed to load drafts' },
      { status: 500 },
    );
  }
}

/**
 * POST /api/drafts
 *
 * Create a new draft for the current user.
 */
export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const data = createDraftSchema.parse(body);

    const [created] = await db
      .insert(drafts)
      .values({
        userId: session.user.id,
        organizationId: data.organizationId ?? null,
        title: data.title ?? null,
        content: data.content ?? null,
        entityType: data.entityType ?? 'other',
        targetProjectId: data.targetProjectId ?? null,
        metadata: (data.metadata ?? {}) as Record<string, unknown>,
      })
      .returning();

    return NextResponse.json({ draft: created }, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid request data', details: error.errors },
        { status: 400 },
      );
    }

    console.error('Create draft error:', error);
    return NextResponse.json(
      { error: 'Failed to create draft' },
      { status: 500 },
    );
  }
}
