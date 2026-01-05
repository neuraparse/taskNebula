import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { db, savedFilters } from '@tasknebula/db';
import { eq, and } from 'drizzle-orm';
import { z } from 'zod';

export const dynamic = 'force-dynamic';

const updateSavedFilterSchema = z.object({
  name: z.string().min(1).optional(),
  description: z.string().optional(),
  query: z.string().min(1).optional(),
  criteria: z.record(z.any()).optional(),
  isPublic: z.boolean().optional(),
  isStarred: z.boolean().optional(),
  viewType: z.enum(['list', 'board', 'timeline']).optional(),
  sortBy: z.string().optional(),
  sortOrder: z.enum(['asc', 'desc']).optional(),
});

/**
 * PATCH /api/saved-filters/[filterId]
 * 
 * Update a saved filter
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ filterId: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { filterId } = await params;
    const body = await request.json();
    const validatedData = updateSavedFilterSchema.parse(body);

    // Check if filter exists and user owns it
    const [existing] = await db
      .select()
      .from(savedFilters)
      .where(
        and(
          eq(savedFilters.id, filterId),
          eq(savedFilters.userId, session.user.id)
        )
      );

    if (!existing) {
      return NextResponse.json({ error: 'Filter not found' }, { status: 404 });
    }

    // Update filter
    const [updated] = await db
      .update(savedFilters)
      .set({
        ...validatedData,
        criteria: validatedData.criteria as any,
        updatedAt: new Date(),
      })
      .where(eq(savedFilters.id, filterId))
      .returning();

    return NextResponse.json({ filter: updated });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid request data', details: error.errors },
        { status: 400 }
      );
    }

    console.error('Update saved filter error:', error);
    return NextResponse.json(
      { error: 'Failed to update saved filter' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/saved-filters/[filterId]
 * 
 * Delete a saved filter
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ filterId: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { filterId } = await params;

    // Check if filter exists and user owns it
    const [existing] = await db
      .select()
      .from(savedFilters)
      .where(
        and(
          eq(savedFilters.id, filterId),
          eq(savedFilters.userId, session.user.id)
        )
      );

    if (!existing) {
      return NextResponse.json({ error: 'Filter not found' }, { status: 404 });
    }

    // Delete filter
    await db.delete(savedFilters).where(eq(savedFilters.id, filterId));

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Delete saved filter error:', error);
    return NextResponse.json(
      { error: 'Failed to delete saved filter' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/saved-filters/[filterId]/use
 * 
 * Increment usage count and update last used timestamp
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ filterId: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { filterId } = await params;

    // Get current filter
    const [existing] = await db
      .select()
      .from(savedFilters)
      .where(eq(savedFilters.id, filterId));

    if (!existing) {
      return NextResponse.json({ error: 'Filter not found' }, { status: 404 });
    }

    // Increment usage count
    const newCount = (parseInt(existing.usageCount) + 1).toString();

    const [updated] = await db
      .update(savedFilters)
      .set({
        usageCount: newCount,
        lastUsedAt: new Date(),
      })
      .where(eq(savedFilters.id, filterId))
      .returning();

    return NextResponse.json({ filter: updated });
  } catch (error) {
    console.error('Update filter usage error:', error);
    return NextResponse.json(
      { error: 'Failed to update filter usage' },
      { status: 500 }
    );
  }
}

