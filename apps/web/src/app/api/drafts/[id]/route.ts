import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { db } from '@tasknebula/db';
import { drafts } from '@tasknebula/db/src/schema/drafts';
import { and, eq } from 'drizzle-orm';
import { z } from 'zod';

export const dynamic = 'force-dynamic';

const ENTITY_TYPES = ['issue', 'doc', 'other'] as const;

const patchDraftSchema = z.object({
  title: z.string().max(500).optional().nullable(),
  content: z.string().max(100_000).optional().nullable(),
  entityType: z.enum(ENTITY_TYPES).optional(),
  organizationId: z.string().optional().nullable(),
  targetProjectId: z.string().optional().nullable(),
  metadata: z.record(z.unknown()).optional(),
});

/**
 * PATCH /api/drafts/[id]
 *
 * Partially update a draft owned by the caller. Scoped to userId so a user
 * cannot mutate another user's draft even if they guess the id.
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;
    const body = await request.json();
    const patch = patchDraftSchema.parse(body);

    // Build the update set explicitly so we only touch fields the caller
    // actually provided. Drizzle's undefined values are ignored, but being
    // explicit makes intent obvious and protects against schema drift.
    const updateSet: Record<string, unknown> = { updatedAt: new Date() };
    if (patch.title !== undefined) updateSet.title = patch.title;
    if (patch.content !== undefined) updateSet.content = patch.content;
    if (patch.entityType !== undefined) updateSet.entityType = patch.entityType;
    if (patch.organizationId !== undefined) updateSet.organizationId = patch.organizationId;
    if (patch.targetProjectId !== undefined) updateSet.targetProjectId = patch.targetProjectId;
    if (patch.metadata !== undefined) updateSet.metadata = patch.metadata;

    const [updated] = await db
      .update(drafts)
      .set(updateSet)
      .where(and(eq(drafts.id, id), eq(drafts.userId, session.user.id)))
      .returning();

    if (!updated) {
      return NextResponse.json({ error: 'Draft not found' }, { status: 404 });
    }

    return NextResponse.json({ draft: updated });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid request data', details: error.errors },
        { status: 400 },
      );
    }

    console.error('Update draft error:', error);
    return NextResponse.json(
      { error: 'Failed to update draft' },
      { status: 500 },
    );
  }
}

/**
 * DELETE /api/drafts/[id]
 *
 * Remove a draft owned by the caller.
 */
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;

    const [deleted] = await db
      .delete(drafts)
      .where(and(eq(drafts.id, id), eq(drafts.userId, session.user.id)))
      .returning();

    if (!deleted) {
      return NextResponse.json({ error: 'Draft not found' }, { status: 404 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Delete draft error:', error);
    return NextResponse.json(
      { error: 'Failed to delete draft' },
      { status: 500 },
    );
  }
}
