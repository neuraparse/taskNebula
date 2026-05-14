/**
 * Manual / cron-driven counter reset for AI Cost Guard.
 *
 *   POST /api/admin/ai-usage/reset-counters
 *     body: { scope?: 'daily' | 'monthly' | 'both'; organizationId?: string }
 *
 * The runtime path already does lazy rollover inside
 * `checkAndReserveTokens`: any org with traffic rolls automatically at
 * the first call after the period boundary. This endpoint exists for
 * two cases that the lazy path can't cover:
 *
 *   1. External cron (e.g. Kubernetes CronJob hitting this URL at
 *      00:05 UTC) that wants to proactively zero counters for *all*
 *      orgs so the dashboard reflects "0 today" before any traffic.
 *   2. Manual ops intervention after a misconfiguration ("the daily
 *      limit was set to 10 by mistake; reset everyone now").
 *
 * Super-admin only. Authenticated via the standard session cookie OR
 * the X-Cron-Secret header set to CRON_SECRET (so a Kubernetes Job can
 * call it without a session).
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { sql } from 'drizzle-orm';
import { auth } from '@/auth';
import { isSuperAdmin } from '@/lib/auth/permissions';
import { db, orgTokenBudgets } from '@tasknebula/db';
import { eq } from 'drizzle-orm';

export const dynamic = 'force-dynamic';

const bodySchema = z.object({
  scope: z.enum(['daily', 'monthly', 'both']).optional().default('daily'),
  organizationId: z.string().min(1).optional(),
});

function startOfNextUtcDay(): Date {
  const now = new Date();
  return new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1)
  );
}

async function authorize(request: NextRequest): Promise<boolean> {
  // Cron secret path — kubernetes/external scheduler.
  const cronHeader = request.headers.get('x-cron-secret');
  const expected = process.env.CRON_SECRET;
  if (expected && cronHeader && cronHeader === expected) return true;

  const session = await auth();
  if (!session?.user?.id) return false;
  return isSuperAdmin();
}

export async function POST(request: NextRequest) {
  if (!(await authorize(request))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let body: z.infer<typeof bodySchema>;
  try {
    body = bodySchema.parse(await request.json().catch(() => ({})));
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid input', details: err.errors },
        { status: 400 }
      );
    }
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const dailyReset = body.scope === 'daily' || body.scope === 'both';
  const monthlyReset = body.scope === 'monthly' || body.scope === 'both';
  const nextResetsAt = startOfNextUtcDay();

  const setClauses: string[] = [];
  if (dailyReset) {
    setClauses.push(
      `daily_used_tokens = 0`,
      `daily_used_cost = '0'::numeric`
    );
  }
  if (monthlyReset) {
    setClauses.push(
      `monthly_used_tokens = 0`,
      `monthly_used_cost = '0'::numeric`
    );
  }
  setClauses.push(`period_resets_at = ${nextResetsAt.getTime()}`);
  setClauses.push(`updated_at = now()`);

  // We don't try to do this in raw SQL because Drizzle's sql template
  // composition is the safer route for the timestamp param. The query
  // is small so two writes is fine.
  if (body.organizationId) {
    const updates: Record<string, unknown> = {
      periodResetsAt: nextResetsAt,
      updatedAt: new Date(),
    };
    if (dailyReset) {
      updates.dailyUsedTokens = 0;
      updates.dailyUsedCost = '0';
    }
    if (monthlyReset) {
      updates.monthlyUsedTokens = 0;
      updates.monthlyUsedCost = '0';
    }
    await db
      .update(orgTokenBudgets)
      .set(updates)
      .where(eq(orgTokenBudgets.organizationId, body.organizationId));
    return NextResponse.json({
      ok: true,
      scope: body.scope,
      organizationId: body.organizationId,
    });
  }

  await db.execute(sql`
    UPDATE ${orgTokenBudgets}
    SET
      ${dailyReset ? sql`daily_used_tokens = 0, daily_used_cost = '0'::numeric,` : sql``}
      ${monthlyReset ? sql`monthly_used_tokens = 0, monthly_used_cost = '0'::numeric,` : sql``}
      period_resets_at = ${nextResetsAt.toISOString()}::timestamptz,
      updated_at = now()
  `);

  return NextResponse.json({ ok: true, scope: body.scope });
}
