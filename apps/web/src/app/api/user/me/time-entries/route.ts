/**
 * GET /api/users/me/time-entries?from=&to= (task #10).
 *
 * Lists the caller's own time entries in a date range (default: last 7 days).
 * Used by the personal "what did I do this week" panel and as the data source
 * for future Toggl/Harvest sync (task #15).
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { and, db, desc, eq, gte, lte, timeEntries, issues } from '@tasknebula/db';

const DEFAULT_RANGE_MS = 7 * 24 * 60 * 60 * 1000;
const MAX_RANGE_MS = 90 * 24 * 60 * 60 * 1000;

export async function GET(request: NextRequest) {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const now = Date.now();
  const fromRaw = searchParams.get('from');
  const toRaw = searchParams.get('to');

  const to = toRaw ? new Date(toRaw) : new Date(now);
  const from = fromRaw ? new Date(fromRaw) : new Date(now - DEFAULT_RANGE_MS);

  if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime())) {
    return NextResponse.json({ error: 'Invalid from/to' }, { status: 400 });
  }
  if (to.getTime() < from.getTime()) {
    return NextResponse.json({ error: 'to must be >= from' }, { status: 400 });
  }
  if (to.getTime() - from.getTime() > MAX_RANGE_MS) {
    return NextResponse.json(
      { error: 'Range too wide (max 90 days)' },
      { status: 400 },
    );
  }

  const rows = await db
    .select({
      id: timeEntries.id,
      issueId: timeEntries.issueId,
      issueKey: issues.key,
      issueTitle: issues.title,
      startedAt: timeEntries.startedAt,
      endedAt: timeEntries.endedAt,
      durationSeconds: timeEntries.durationSeconds,
      description: timeEntries.description,
      source: timeEntries.source,
      integrationRef: timeEntries.integrationRef,
      createdAt: timeEntries.createdAt,
    })
    .from(timeEntries)
    .leftJoin(issues, eq(issues.id, timeEntries.issueId))
    .where(
      and(
        eq(timeEntries.userId, userId),
        gte(timeEntries.startedAt, from),
        lte(timeEntries.startedAt, to),
      ),
    )
    .orderBy(desc(timeEntries.startedAt))
    .limit(500);

  const totalSeconds = rows.reduce(
    (acc, r) => acc + (r.durationSeconds ?? 0),
    0,
  );

  return NextResponse.json({
    from: from.toISOString(),
    to: to.toISOString(),
    entries: rows,
    totalSeconds,
    totalHours: Math.round((totalSeconds / 3600) * 100) / 100,
  });
}
