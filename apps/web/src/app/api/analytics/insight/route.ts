/**
 * GET /api/analytics/insight?metric=&period=&scopeId=
 *
 * Returns a short, AI-generated explanation of recent change in the given
 * metric, plus one recommended action. Cached by (metric, period, scopeId)
 * in Redis (or an in-memory LRU when Redis isn't configured) for 15 minutes.
 *
 * The endpoint pulls a thin slice of metric history server-side and asks
 * Claude Haiku (or whatever model the org has selected) for a two-sentence
 * commentary. Falls back to a deterministic stub when no LLM key exists
 * so the UI still renders something useful in local dev.
 */

import { NextRequest, NextResponse } from 'next/server';
import { and, eq, gte, sql } from 'drizzle-orm';
import {
  db,
  issues,
  sprints,
  workflowStatuses,
  organizationMembers,
  organizations,
} from '@tasknebula/db';
import { auth } from '@/auth';
import { resolveProjectAccess } from '@/lib/auth/project-access';
import { getRedisClient, ensureRedisConnection, isRedisConfigured } from '@/lib/server/redis';
import { normalizeWorkspaceAgentSettings } from '@/lib/agents/config';
import { getSystemAgentControlSettingsFromDb } from '@/lib/agents/system';
import { resolveProviderApiKeyFromSettings } from '@/lib/agents/credentials';

export const dynamic = 'force-dynamic';

const SUPPORTED_METRICS = new Set([
  'velocity',
  'burndown',
  'cycle-time',
  'throughput',
  'deploy-frequency',
  'lead-time',
  'change-failure-rate',
]);

const SUPPORTED_PERIODS = new Set(['7d', '14d', '30d', '90d', 'current-sprint', '6-sprints']);

const TTL_SECONDS = 15 * 60;

// Tiny in-process fallback cache when Redis isn't configured.
const memCache = new Map<string, { value: string; expiresAt: number }>();

function cacheKey(metric: string, period: string, scopeId: string | null) {
  return `analytics:insight:${metric}:${period}:${scopeId ?? 'none'}`;
}

async function readCache(key: string): Promise<string | null> {
  if (isRedisConfigured()) {
    const client = await ensureRedisConnection(getRedisClient());
    if (client) {
      const value = await client.get(key).catch(() => null);
      if (value) return value;
    }
  }
  const hit = memCache.get(key);
  if (hit && hit.expiresAt > Date.now()) return hit.value;
  if (hit) memCache.delete(key);
  return null;
}

async function writeCache(key: string, value: string) {
  if (isRedisConfigured()) {
    const client = await ensureRedisConnection(getRedisClient());
    if (client) {
      await client.set(key, value, 'EX', TTL_SECONDS).catch(() => {});
    }
  }
  memCache.set(key, { value, expiresAt: Date.now() + TTL_SECONDS * 1000 });
}

async function pullMetricSnapshot(
  metric: string,
  period: string,
  scopeId: string | null
): Promise<{ summary: string; series: number[] }> {
  // Approximate window in days. We don't try to be exact — the LLM just
  // needs a flavor of recent shape.
  const days = period === '7d' ? 7 : period === '14d' ? 14 : period === '90d' ? 90 : 30;
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

  if (metric === 'throughput' && scopeId) {
    const rows = await db
      .select({
        day: sql<string>`to_char(${issues.updatedAt}, 'YYYY-MM-DD')`,
        count: sql<number>`COUNT(*)`,
      })
      .from(issues)
      .leftJoin(workflowStatuses, eq(issues.statusId, workflowStatuses.id))
      .where(
        and(
          eq(issues.projectId, scopeId),
          eq(workflowStatuses.category, 'done'),
          gte(issues.updatedAt, since)
        )
      )
      .groupBy(sql`to_char(${issues.updatedAt}, 'YYYY-MM-DD')`)
      .orderBy(sql`to_char(${issues.updatedAt}, 'YYYY-MM-DD')`);

    const series = rows.map((r: { count: number | null }) => Number(r.count) || 0);
    return {
      summary: `Throughput last ${days}d: ${series.join(', ') || 'no completions'}`,
      series,
    };
  }

  if (metric === 'velocity' && scopeId) {
    const rows = await db
      .select({
        name: sprints.name,
        completedIssues: sql<number>`COALESCE(SUM(CASE WHEN ${workflowStatuses.category} = 'done' THEN 1 ELSE 0 END), 0)`,
      })
      .from(sprints)
      .leftJoin(issues, eq(issues.sprintId, sprints.id))
      .leftJoin(workflowStatuses, eq(issues.statusId, workflowStatuses.id))
      .where(and(eq(sprints.projectId, scopeId), eq(sprints.status, 'completed')))
      .groupBy(sprints.id, sprints.name, sprints.startDate)
      .orderBy(sprints.startDate);

    const series = rows
      .slice(-6)
      .map((r: { completedIssues: number | null }) => Number(r.completedIssues) || 0);
    return {
      summary: `Velocity (last sprints): ${series.join(', ') || 'no data'}`,
      series,
    };
  }

  return { summary: `Metric ${metric} over ${period}: no detailed series.`, series: [] };
}

function trendDelta(series: number[]): number | null {
  if (series.length < 2) return null;
  const half = Math.floor(series.length / 2);
  const before = series.slice(0, half);
  const after = series.slice(half);
  const avg = (arr: number[]) =>
    arr.length === 0 ? 0 : arr.reduce((s, v) => s + v, 0) / arr.length;
  const a = avg(before);
  const b = avg(after);
  if (a === 0) return b === 0 ? 0 : 100;
  return ((b - a) / a) * 100;
}

function deterministicSummary(
  metric: string,
  period: string,
  snapshot: { summary: string; series: number[] }
): string {
  const delta = trendDelta(snapshot.series);
  if (delta === null) {
    return `Not enough ${metric} data over ${period} to detect a trend. Capture more sprints, then check again.`;
  }
  const dir = delta > 5 ? 'rose' : delta < -5 ? 'fell' : 'stayed flat';
  const advice =
    delta < -10
      ? 'Investigate blockers in the active sprint and re-balance WIP.'
      : delta > 10
        ? 'Lock in the change — review what unblocked the team and codify it.'
        : 'Hold the current cadence and re-check next week.';
  return `${metric} ${dir} ~${Math.abs(delta).toFixed(0)}% over the last ${period}. ${advice}`;
}

async function llmSummary(
  metric: string,
  period: string,
  snapshot: { summary: string; series: number[] },
  organizationId: string
): Promise<string | null> {
  // Resolve workspace AI settings + an Anthropic key.
  const [org] = await db
    .select({ settings: organizations.settings })
    .from(organizations)
    .where(eq(organizations.id, organizationId))
    .limit(1);
  const orgSettings = (org?.settings as Record<string, unknown> | null) || null;
  const workspace = normalizeWorkspaceAgentSettings(
    (orgSettings as { aiAgents?: unknown })?.aiAgents
  );
  if (!workspace.assistantEnabled) return null;

  const system = await getSystemAgentControlSettingsFromDb();
  const platformStore = system.providerCredentials ?? null;
  const apiKey = resolveProviderApiKeyFromSettings(orgSettings, 'anthropic', platformStore);
  if (!apiKey) return null;

  const model = workspace.model?.trim() || 'claude-haiku-4-5';

  const prompt = [
    `Metric: ${metric}`,
    `Period: ${period}`,
    `Recent series: [${snapshot.series.join(', ')}]`,
    '',
    `Explain in 2 sentences what changed and why it might have happened, then recommend ONE concrete action the team can take this week. Be specific. No preamble.`,
  ].join('\n');

  try {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model,
        max_tokens: 200,
        temperature: 0.3,
        messages: [{ role: 'user', content: prompt }],
      }),
    });
    if (!res.ok) return null;
    const payload = (await res.json()) as {
      content?: Array<{ type: string; text?: string }>;
    };
    const text = payload.content?.find((b) => b.type === 'text')?.text?.trim();
    if (!text) return null;
    return text.slice(0, 500);
  } catch {
    return null;
  }
}

export async function GET(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const metric = (searchParams.get('metric') || '').toLowerCase();
  const period = (searchParams.get('period') || '30d').toLowerCase();
  const scopeId = searchParams.get('scopeId');
  const organizationId = searchParams.get('organizationId');

  if (!SUPPORTED_METRICS.has(metric)) {
    return NextResponse.json(
      { error: `Unsupported metric. Try one of ${[...SUPPORTED_METRICS].join(', ')}.` },
      { status: 400 }
    );
  }
  if (!SUPPORTED_PERIODS.has(period)) {
    return NextResponse.json(
      { error: `Unsupported period. Try one of ${[...SUPPORTED_PERIODS].join(', ')}.` },
      { status: 400 }
    );
  }

  let safeScopeId: string | null = null;
  let safeOrgId: string | null = null;

  if (scopeId) {
    const access = await resolveProjectAccess(session.user.id, scopeId);
    if (!access.project || !access.canRead) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }
    safeScopeId = access.project.id;
    safeOrgId = access.project.organizationId;
  }

  // If an organizationId was supplied without a scoped project, make sure the
  // caller is an active member before using workspace-level LLM credentials.
  if (organizationId) {
    const [member] = await db
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
    if (member && !safeOrgId) safeOrgId = organizationId;
  }

  const key = cacheKey(metric, period, safeScopeId);
  const cached = await readCache(key);
  if (cached) {
    return NextResponse.json({ summary: cached, cached: true });
  }

  const snapshot = await pullMetricSnapshot(metric, period, safeScopeId);

  let summary: string | null = null;
  if (safeOrgId) {
    summary = await llmSummary(metric, period, snapshot, safeOrgId);
  }
  if (!summary) {
    summary = deterministicSummary(metric, period, snapshot);
  }

  await writeCache(key, summary);
  return NextResponse.json({
    summary,
    cached: false,
    generatedAt: new Date().toISOString(),
  });
}
