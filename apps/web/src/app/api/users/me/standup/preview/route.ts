/**
 * POST /api/users/me/standup/preview
 *
 * Runs the standup digest for the current user on demand. Useful when
 * the cron isn't wired up yet, or when the user wants a fresh digest
 * mid-day. Persists the row (same upsert as the cron path) so the
 * dashboard widget picks it up immediately.
 *
 * Body (optional):
 *   { organizationId?: string }   // override the active org
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { db, organizationMembers, eq, and } from '@tasknebula/db';
import { runStandupForUser } from '@/lib/agents/standup-runner';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

interface PreviewBody {
  organizationId?: string;
}

export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let body: PreviewBody = {};
  try {
    body = (await request.json()) as PreviewBody;
  } catch {
    // empty body — resolve org below.
  }

  let organizationId = body.organizationId;
  if (!organizationId) {
    // Pick the user's first active org membership.
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
      return NextResponse.json(
        { error: 'No active organization for current user.' },
        { status: 400 }
      );
    }
    organizationId = membership.organizationId;
  } else {
    // Authorise the override.
    const [membership] = await db
      .select({ id: organizationMembers.id })
      .from(organizationMembers)
      .where(
        and(
          eq(organizationMembers.userId, session.user.id),
          eq(organizationMembers.organizationId, organizationId),
          eq(organizationMembers.status, 'active')
        )
      )
      .limit(1);
    if (!membership) {
      return NextResponse.json(
        { error: 'You are not a member of that organization.' },
        { status: 403 }
      );
    }
  }

  try {
    const result = await runStandupForUser({
      userId: session.user.id,
      organizationId,
    });
    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    console.error('[standup-preview] failed', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed to build standup' },
      { status: 500 }
    );
  }
}
