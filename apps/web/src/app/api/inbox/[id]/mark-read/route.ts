/**
 * POST /api/inbox/[id]/mark-read — mark a single inbox item as read.
 *
 * Distinct from `PATCH /api/notifications/[id]` so the inbox-specific
 * client doesn't need to know about the legacy verb shape and so the
 * action is consistent with the rest of the inbox surface (all POST).
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { db, notifications, eq, and } from '@tasknebula/db';

export const dynamic = 'force-dynamic';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;

    const [updated] = await db
      .update(notifications)
      .set({
        isRead: true,
        readAt: new Date(),
        updatedAt: new Date(),
      })
      .where(and(eq(notifications.id, id), eq(notifications.userId, session.user.id)))
      .returning();

    if (!updated) {
      return NextResponse.json({ error: 'Notification not found' }, { status: 404 });
    }

    return NextResponse.json(updated);
  } catch (error) {
    console.error('Failed to mark inbox item as read:', error);
    return NextResponse.json(
      { error: 'Failed to mark inbox item as read' },
      { status: 500 }
    );
  }
}
