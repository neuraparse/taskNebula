/**
 * POST /api/inbox/[id]/snooze — defer a notification until a given timestamp.
 *
 * Body: { until: ISO timestamp }
 *
 * Re-emergence model: there is no scheduled job that surfaces snoozed items.
 * The inbox GET filters `snoozed_until <= now()` automatically, so a row
 * "reappears" the moment the user reloads after the timer elapses. This
 * keeps the cron logic trivial and the semantics deterministic (tested in
 * snooze-reemergence.test.ts).
 *
 * Passing `{ until: null }` (or omitting the body) clears any existing
 * snooze.
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

    let body: { until?: string | null } = {};
    try {
      body = (await request.json()) as { until?: string | null };
    } catch {
      // Empty body is allowed (clears snooze).
    }

    let snoozedUntil: Date | null = null;
    if (body.until !== undefined && body.until !== null) {
      const parsed = new Date(body.until);
      if (Number.isNaN(parsed.getTime())) {
        return NextResponse.json({ error: 'Invalid `until` timestamp.' }, { status: 400 });
      }
      // Snoozing to the past is a no-op (would re-emerge instantly). Reject
      // so the UI surfaces the mistake rather than silently dropping it.
      if (parsed.getTime() <= Date.now()) {
        return NextResponse.json(
          { error: '`until` must be in the future.' },
          { status: 400 }
        );
      }
      snoozedUntil = parsed;
    }

    const [updated] = await db
      .update(notifications)
      .set({
        snoozedUntil,
        updatedAt: new Date(),
      })
      .where(and(eq(notifications.id, id), eq(notifications.userId, session.user.id)))
      .returning();

    if (!updated) {
      return NextResponse.json({ error: 'Notification not found' }, { status: 404 });
    }

    return NextResponse.json(updated);
  } catch (error) {
    console.error('Failed to snooze notification:', error);
    return NextResponse.json({ error: 'Failed to snooze notification' }, { status: 500 });
  }
}
