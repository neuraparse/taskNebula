/**
 * POST /api/cron/janitor
 *
 * Cron-triggered stale-issue janitor sweep. Pulls issues with no activity
 * in 30+ days (configurable) and applies one of:
 *   - ping_assignee (post a polite "any update?" comment)
 *   - snooze 14d (push updated_at forward without bothering anyone)
 *   - auto_close_with_label:stale-auto
 *
 * Auth: `x-cron-secret` header matching `CRON_SECRET`.
 *
 * Body (optional):
 *   {
 *     organizationId?: string,    // limit to one org
 *     systemUserId?: string,      // author for janitor comments / updates
 *     staleThresholdDays?: number,
 *     dryRun?: boolean,
 *     limit?: number,
 *   }
 */

import { NextRequest, NextResponse } from 'next/server';
import { db, organizations, sql } from '@tasknebula/db';
import { requireCronAuth } from '@/lib/agents/cron-auth';
import { runJanitorForOrg } from '@/lib/agents/janitor-runner';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

interface CronBody {
  organizationId?: string;
  systemUserId?: string;
  staleThresholdDays?: number;
  dryRun?: boolean;
  limit?: number;
}

export async function POST(request: NextRequest) {
  const denied = requireCronAuth(request);
  if (denied) return denied;

  let body: CronBody = {};
  try {
    body = (await request.json()) as CronBody;
  } catch {
    // empty body OK
  }

  // Default system user — picked up from env so an operator can pre-create
  // a "TaskNebula Bot" account and pass its id.
  const systemUserId = body.systemUserId ?? process.env.JANITOR_SYSTEM_USER_ID ?? undefined;

  let orgIds: string[];
  if (body.organizationId) {
    orgIds = [body.organizationId];
  } else {
    const rows = await db
      .select({ id: organizations.id })
      .from(organizations)
      .where(sql`status != 'suspended'`)
      .limit(500);
    orgIds = rows.map((r) => r.id);
  }

  const startedAt = new Date();
  const results: Array<{
    organizationId: string;
    total: number;
    actions: { ping_assignee: number; snooze: number; auto_close_with_label: number };
    decisions: Awaited<ReturnType<typeof runJanitorForOrg>>['decisions'];
  }> = [];

  for (const organizationId of orgIds) {
    try {
      const { decisions, total } = await runJanitorForOrg({
        organizationId,
        systemUserId,
        staleThresholdDays: body.staleThresholdDays,
        dryRun: body.dryRun ?? !systemUserId,
        limit: body.limit,
      });
      const counts = { ping_assignee: 0, snooze: 0, auto_close_with_label: 0 };
      for (const d of decisions) counts[d.action] += 1;
      results.push({ organizationId, total, actions: counts, decisions });
    } catch (err) {
      results.push({
        organizationId,
        total: 0,
        actions: { ping_assignee: 0, snooze: 0, auto_close_with_label: 0 },
        decisions: [
          {
            issueId: '-',
            issueKey: '-',
            action: 'ping_assignee',
            reason: err instanceof Error ? err.message : 'unknown',
            confidence: 0,
            applied: false,
            appliedError: err instanceof Error ? err.message : 'unknown',
          },
        ],
      });
    }
  }

  return NextResponse.json({
    ok: true,
    startedAt: startedAt.toISOString(),
    finishedAt: new Date().toISOString(),
    dryRun: body.dryRun ?? !systemUserId,
    orgsProcessed: orgIds.length,
    results,
  });
}
