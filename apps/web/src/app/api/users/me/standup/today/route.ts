/**
 * GET /api/users/me/standup/today
 *
 * Returns today's standup record for the current user, if one exists.
 * The dashboard widget calls this on mount — when no record exists yet
 * it gets a 204 and renders a "no digest yet, run preview" CTA instead.
 *
 * Query:
 *   ?organizationId=...   (optional — defaults to the user's first active org)
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import {
  db,
  standups,
  organizationMembers,
  and,
  eq,
  desc,
} from '@tasknebula/db';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

function todayDateKey(): string {
  return new Date().toISOString().slice(0, 10);
}

export async function GET(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  let organizationId = searchParams.get('organizationId');

  if (!organizationId) {
    const [membership] = await db
      .select({ organizationId: organizationMembers.organizationId })
      .from(organizationMembers)
      .where(
        and(
          eq(organizationMembers.userId, session.user.id),
          eq(organizationMembers.status, 'active')
        )
      )
      .limit(1);
    if (!membership) {
      return new NextResponse(null, { status: 204 });
    }
    organizationId = membership.organizationId;
  }

  const dateKey = todayDateKey();
  const [row] = await db
    .select({
      id: standups.id,
      date: standups.date,
      contentMd: standups.contentMd,
      blockersMd: standups.blockersMd,
      createdAt: standups.createdAt,
    })
    .from(standups)
    .where(
      and(
        eq(standups.userId, session.user.id),
        eq(standups.organizationId, organizationId),
        eq(standups.date, dateKey)
      )
    )
    .orderBy(desc(standups.createdAt))
    .limit(1);

  if (!row) {
    return new NextResponse(null, { status: 204 });
  }

  return NextResponse.json({
    id: row.id,
    date: row.date,
    contentMd: row.contentMd,
    blockersMd: row.blockersMd,
    createdAt: row.createdAt,
  });
}
