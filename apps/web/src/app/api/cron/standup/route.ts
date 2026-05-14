/**
 * POST /api/cron/standup
 *
 * Cron-triggered daily standup digest generator. Loops every active member
 * of every (optionally filtered) organization and writes a `standups` row.
 *
 * Auth: shared secret in `x-cron-secret` header (matches `CRON_SECRET`).
 *
 * Body (optional):
 *   { organizationId?: string }   // limit run to one org
 *   { userId?: string }           // limit run to a single user
 *
 * Designed to be invoked by an external scheduler (node-cron sidecar,
 * Vercel Cron, k8s CronJob, etc). See docker-compose snippet in the
 * project README for a reference setup.
 */

import { NextRequest, NextResponse } from 'next/server';
import { db, organizations, sql } from '@tasknebula/db';
import { requireCronAuth } from '@/lib/agents/cron-auth';
import { listOrgMemberIds, runStandupForUser } from '@/lib/agents/standup-runner';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

interface CronBody {
  organizationId?: string;
  userId?: string;
}

interface UserResult {
  userId: string;
  recordId: string | null;
  eventCount: number;
  ok: boolean;
  error?: string;
}

interface OrgResult {
  organizationId: string;
  users: UserResult[];
}

export async function POST(request: NextRequest) {
  const denied = requireCronAuth(request);
  if (denied) return denied;

  let body: CronBody = {};
  try {
    body = (await request.json()) as CronBody;
  } catch {
    // empty body is fine — defaults to all orgs / all users.
  }

  // Resolve org list.
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

  const results: OrgResult[] = [];
  const startedAt = new Date();
  for (const organizationId of orgIds) {
    const userIds = body.userId
      ? [body.userId]
      : await listOrgMemberIds(organizationId);
    const orgResult: OrgResult = { organizationId, users: [] };
    for (const userId of userIds) {
      try {
        const r = await runStandupForUser({ userId, organizationId });
        orgResult.users.push({
          userId,
          recordId: r.recordId,
          eventCount: r.eventCount,
          ok: true,
        });
      } catch (err) {
        orgResult.users.push({
          userId,
          recordId: null,
          eventCount: 0,
          ok: false,
          error: err instanceof Error ? err.message : 'unknown error',
        });
      }
    }
    results.push(orgResult);
  }

  return NextResponse.json({
    ok: true,
    startedAt: startedAt.toISOString(),
    finishedAt: new Date().toISOString(),
    orgsProcessed: orgIds.length,
    results,
  });
}
