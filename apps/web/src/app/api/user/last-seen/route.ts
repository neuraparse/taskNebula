/**
 * POST /api/user/last-seen — record the user's most recent active visit.
 * GET /api/user/last-seen  — return the previous value (used by the
 *                             dashboard "Welcome back" banner heuristic).
 *
 * The dashboard fires the POST once per mount on `/dashboard`. The banner
 * compares the *previous* value (returned by GET) to now() to decide if
 * the user has been gone long enough to be greeted, then issues POST to
 * advance the stamp.
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { db, users, eq } from '@tasknebula/db';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const [me] = await db
      .select({ lastSeenAt: users.lastSeenAt })
      .from(users)
      .where(eq(users.id, session.user.id))
      .limit(1);
    return NextResponse.json({
      lastSeenAt: me?.lastSeenAt ? me.lastSeenAt.toISOString() : null,
    });
  } catch (error) {
    console.error('Failed to read last-seen:', error);
    return NextResponse.json({ error: 'Failed to read last-seen' }, { status: 500 });
  }
}

export async function POST(_request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const now = new Date();
    await db
      .update(users)
      .set({ lastSeenAt: now, updatedAt: now })
      .where(eq(users.id, session.user.id));
    return NextResponse.json({ lastSeenAt: now.toISOString() });
  } catch (error) {
    console.error('Failed to update last-seen:', error);
    return NextResponse.json({ error: 'Failed to update last-seen' }, { status: 500 });
  }
}
