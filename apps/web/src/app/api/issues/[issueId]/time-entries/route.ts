/**
 * /api/issues/:issueId/time-entries — manual time entries + listing (task #10).
 *
 * GET   → list entries for the issue (most recent first), all users.
 * POST  → log a manual entry. Accepts either:
 *           - { durationSeconds, startedAt?, description? }
 *           - { startedAt, endedAt, description? }
 *         When both are provided, durationSeconds wins and we synthesise
 *         endedAt = startedAt + durationSeconds.
 *
 * After a successful create we recompute `issues.actual_hours` so the issue
 * card / sprint analytics see the new total immediately.
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { auth } from '@/auth';
import { db, desc, eq, timeEntries } from '@tasknebula/db';
import {
  assertIssueAccess,
  recomputeActualHours,
} from '@/lib/time-tracking/server';

const ManualEntry = z
  .object({
    durationSeconds: z.number().int().positive().max(24 * 3600 * 7).optional(),
    startedAt: z.string().datetime().optional(),
    endedAt: z.string().datetime().optional(),
    description: z.string().max(2000).optional(),
    source: z.enum(['manual', 'github_inferred', 'integration']).optional(),
    integrationRef: z.string().max(500).optional(),
  })
  .refine(
    (v) =>
      typeof v.durationSeconds === 'number' || (v.startedAt && v.endedAt),
    {
      message: 'Provide durationSeconds OR both startedAt and endedAt.',
    },
  );

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ issueId: string }> },
) {
  const session = await auth();
  const { issueId } = await params;
  const access = await assertIssueAccess(session?.user?.id, issueId);
  if (!access.ok) {
    return NextResponse.json({ error: access.reason }, { status: access.status });
  }

  const rows = await db
    .select()
    .from(timeEntries)
    .where(eq(timeEntries.issueId, issueId))
    .orderBy(desc(timeEntries.startedAt))
    .limit(200);

  return NextResponse.json({ entries: rows });
}

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

  let body: z.infer<typeof ManualEntry>;
  try {
    const raw = await request.json();
    body = ManualEntry.parse(raw);
  } catch (err: any) {
    return NextResponse.json(
      { error: 'Invalid body', detail: err?.message },
      { status: 400 },
    );
  }

  // Reconcile start/end vs duration.
  const now = new Date();
  let startedAt: Date;
  let endedAt: Date;
  if (typeof body.durationSeconds === 'number') {
    // Manual log: anchor to now unless the caller provided a start time.
    startedAt = body.startedAt ? new Date(body.startedAt) : new Date(now.getTime() - body.durationSeconds * 1000);
    endedAt = new Date(startedAt.getTime() + body.durationSeconds * 1000);
  } else {
    startedAt = new Date(body.startedAt!);
    endedAt = new Date(body.endedAt!);
  }

  if (Number.isNaN(startedAt.getTime()) || Number.isNaN(endedAt.getTime())) {
    return NextResponse.json({ error: 'Invalid timestamps' }, { status: 400 });
  }
  if (endedAt.getTime() <= startedAt.getTime()) {
    return NextResponse.json(
      { error: 'endedAt must be after startedAt' },
      { status: 400 },
    );
  }

  const [created] = await db
    .insert(timeEntries)
    .values({
      issueId,
      userId: userId!,
      startedAt,
      endedAt,
      description: body.description?.trim() || null,
      source: body.source ?? 'manual',
      integrationRef: body.integrationRef ?? null,
    })
    .returning();

  const totalHours = await recomputeActualHours(issueId);

  return NextResponse.json(
    { entry: created, actualHours: totalHours },
    { status: 201 },
  );
}
