/**
 * POST /api/issues/:issueId/timer/start (task #10).
 *
 * Starts a running timer for the calling user on the given issue. The
 * "only one running timer per user" invariant is enforced by the partial
 * unique index in migration 0028 — we catch the constraint violation and
 * return 409 with the existing running entry so the client can offer to stop
 * it.
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { and, db, eq, isNull, timeEntries } from '@tasknebula/db';
import { assertIssueAccess } from '@/lib/time-tracking/server';

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ issueId: string }> },
) {
  const session = await auth();
  const userId = session?.user?.id;
  const { issueId } = await params;

  const access = await assertIssueAccess(userId, issueId);
  if (!access.ok) {
    return NextResponse.json({ error: access.reason }, { status: access.status });
  }

  // Pre-check: surface the existing running timer to the caller without
  // triggering the unique-constraint exception path when we can avoid it.
  const [existing] = await db
    .select({
      id: timeEntries.id,
      issueId: timeEntries.issueId,
      startedAt: timeEntries.startedAt,
    })
    .from(timeEntries)
    .where(and(eq(timeEntries.userId, userId!), isNull(timeEntries.endedAt)))
    .limit(1);

  if (existing) {
    return NextResponse.json(
      {
        error: 'Timer already running',
        running: existing,
      },
      { status: 409 },
    );
  }

  try {
    const [created] = await db
      .insert(timeEntries)
      .values({
        issueId,
        userId: userId!,
        startedAt: new Date(),
        source: 'timer',
      })
      .returning();
    return NextResponse.json({ entry: created }, { status: 201 });
  } catch (err: any) {
    // 23505 = unique_violation on the partial index. Race window between the
    // pre-check above and the insert.
    if (err?.code === '23505') {
      return NextResponse.json(
        { error: 'Timer already running' },
        { status: 409 },
      );
    }
    console.error('timer/start failed', err);
    return NextResponse.json({ error: 'Failed to start timer' }, { status: 500 });
  }
}
