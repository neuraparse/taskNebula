import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { db, pinnedItems } from '@tasknebula/db';
import { and, eq } from 'drizzle-orm';

export const dynamic = 'force-dynamic';

/**
 * DELETE /api/pinned-items/[id]
 *
 * Remove a pinned item by row id. Scoped to the calling user so a user
 * cannot delete another user's pins even if they guess an id.
 */
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;

    const [deleted] = await db
      .delete(pinnedItems)
      .where(
        and(
          eq(pinnedItems.id, id),
          eq(pinnedItems.userId, session.user.id)
        )
      )
      .returning();

    if (!deleted) {
      return NextResponse.json({ error: 'Pinned item not found' }, { status: 404 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Delete pinned item error:', error);
    return NextResponse.json(
      { error: 'Failed to delete pinned item' },
      { status: 500 }
    );
  }
}
