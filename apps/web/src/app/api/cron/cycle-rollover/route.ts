import { NextRequest, NextResponse } from 'next/server';
import { rolloverAllOverdueCycles } from '@/lib/issues/cycle-rollover';
import { db, users } from '@tasknebula/db';
import { eq } from 'drizzle-orm';

/**
 * POST /api/cron/cycle-rollover
 *
 * Daily cron entry point that drains overdue cycles in every project. Intended
 * to be wired into a scheduled task (Vercel Cron, GitHub Actions, k8s
 * CronJob, etc). Two ways to authenticate:
 *
 *   1. Bearer token: `Authorization: Bearer $CRON_SECRET`
 *   2. Header     : `x-cron-secret: $CRON_SECRET`
 *
 * If `CRON_SECRET` is unset the endpoint refuses to run. The work itself is
 * idempotent thanks to `sprints.rolled_over_at`, so retries on transient
 * failures are safe.
 *
 * History rows are credited to the system user whose email matches
 * `CRON_SYSTEM_USER_EMAIL` (defaults to `system@tasknebula.local`). If no
 * such user exists, we still run the rollover but skip the `changed_by`
 * field — the FK is nullable for exactly this case.
 */
export async function POST(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    return NextResponse.json(
      { error: 'CRON_SECRET not configured' },
      { status: 503 }
    );
  }

  const bearer = request.headers.get('authorization')?.replace(/^Bearer\s+/i, '');
  const headerSecret = request.headers.get('x-cron-secret');
  if (bearer !== secret && headerSecret !== secret) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const systemEmail = process.env.CRON_SYSTEM_USER_EMAIL || 'system@tasknebula.local';
  const [systemUser] = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.email, systemEmail))
    .limit(1);

  // Fall back to a literal sentinel id; the FK in issue_status_history is
  // ON DELETE SET NULL, but we still need a non-null value for the insert
  // path. Use the first row's id as a last resort.
  let actorId = systemUser?.id;
  if (!actorId) {
    const [anyUser] = await db.select({ id: users.id }).from(users).limit(1);
    actorId = anyUser?.id ?? 'system';
  }

  const result = await rolloverAllOverdueCycles(actorId);
  return NextResponse.json(result);
}
