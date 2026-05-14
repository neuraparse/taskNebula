/**
 * POST /api/issues/:issueId/timer/stop (task #10).
 *
 * Stops the caller's currently running timer on this issue. If no timer is
 * running (or it's for a different issue), 404 is returned. Once the row is
 * finalised we recompute `issues.actual_hours` so the issue card stays in
 * sync without waiting for a background job.
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { auth } from '@/auth';
import { and, db, eq, isNull, timeEntries } from '@tasknebula/db';
import { assertIssueAccess, recomputeActualHours } from '@/lib/time-tracking/server';

const StopBody = z
  .object({
    description: z.string().max(2000).optional(),
  })
  .optional();

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ issueId: string }> },
) {
  const session = await auth();
  const userId = session?.user?.id;
  const { issueId } = await params;

  const access = await assertIssueAccess(userId, issueId);
  if (!access.ok) {
    return NextResponse.json({ error: access.reason }, { status: access.status });
  }

  let body: z.infer<typeof StopBody> = undefined;
  try {
    const raw = await request.json().catch(() => undefined);
    body = StopBody.parse(raw);
  } catch {
    return NextResponse.json({ error: 'Invalid body' }, { status: 400 });
  }

  // Find the running timer for this user *on this issue*. We scope to the
  // issue so a stray click on a stale tab doesn't close someone's other
  // running timer.
  const [running] = await db
    .select()
    .from(timeEntries)
    .where(
      and(
        eq(timeEntries.userId, userId!),
        eq(timeEntries.issueId, issueId),
        isNull(timeEntries.endedAt),
      ),
    )
    .limit(1);

  if (!running) {
    return NextResponse.json(
      { error: 'No running timer for this issue' },
      { status: 404 },
    );
  }

  const [updated] = await db
    .update(timeEntries)
    .set({
      endedAt: new Date(),
      description: body?.description ?? running.description ?? null,
    })
    .where(eq(timeEntries.id, running.id))
    .returning();

  const totalHours = await recomputeActualHours(issueId);

  return NextResponse.json({ entry: updated, actualHours: totalHours });
}
