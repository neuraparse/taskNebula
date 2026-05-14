/**
 * Admin AI usage dashboard
 *
 *   GET  /api/admin/ai-usage           — daily + monthly per-org usage
 *
 * Super-admin only. Aggregates the `org_token_budgets` configured limits
 * with the live `llm_call_audit` ledger so dashboards do not have to do
 * the join themselves.
 *
 * Query params:
 *   - days (default 7)   — how many days of the per-day spend histogram
 *   - organizationId     — narrow to a single org
 */

import { NextRequest, NextResponse } from 'next/server';
import { sql } from 'drizzle-orm';
import { auth } from '@/auth';
import { isSuperAdmin } from '@/lib/auth/permissions';
import { db, llmCallAudit, orgTokenBudgets, organizations } from '@tasknebula/db';
import { eq } from 'drizzle-orm';

export const dynamic = 'force-dynamic';

function startOfUtcDay(date = new Date()): Date {
  return new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate())
  );
}

function startOfUtcMonth(date = new Date()): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1));
}

export async function GET(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const admin = await isSuperAdmin();
  if (!admin) {
    return NextResponse.json(
      { error: 'Super admin access required' },
      { status: 403 }
    );
  }

  const url = new URL(request.url);
  const days = Math.min(
    Math.max(parseInt(url.searchParams.get('days') ?? '7', 10) || 7, 1),
    90
  );
  const organizationFilter = url.searchParams.get('organizationId') ?? null;

  const dayStart = startOfUtcDay();
  const monthStart = startOfUtcMonth();
  const histStart = new Date(dayStart);
  histStart.setUTCDate(histStart.getUTCDate() - (days - 1));

  // Budgets joined with org names. We left-join so orgs without an
  // explicit row still show up (with null limits → "unlimited" in UI).
  const budgetRowsQuery = db
    .select({
      organizationId: organizations.id,
      organizationName: organizations.name,
      dailyTokenLimit: orgTokenBudgets.dailyTokenLimit,
      monthlyTokenLimit: orgTokenBudgets.monthlyTokenLimit,
      dailyCostUsdLimit: orgTokenBudgets.dailyCostUsdLimit,
      monthlyCostUsdLimit: orgTokenBudgets.monthlyCostUsdLimit,
      dailyUsedTokens: orgTokenBudgets.dailyUsedTokens,
      monthlyUsedTokens: orgTokenBudgets.monthlyUsedTokens,
      dailyUsedCost: orgTokenBudgets.dailyUsedCost,
      monthlyUsedCost: orgTokenBudgets.monthlyUsedCost,
      periodResetsAt: orgTokenBudgets.periodResetsAt,
      killSwitchEnabled: orgTokenBudgets.killSwitchEnabled,
    })
    .from(organizations)
    .leftJoin(
      orgTokenBudgets,
      eq(orgTokenBudgets.organizationId, organizations.id)
    );
  const budgetRows = organizationFilter
    ? await budgetRowsQuery.where(eq(organizations.id, organizationFilter))
    : await budgetRowsQuery;

  // Aggregate ledger metrics — count + tokens + cost per org per
  // dimension (today vs month-to-date) so the dashboard does not have to
  // run a query per org.
  const aggregateQuery = sql`
    SELECT
      organization_id,
      COUNT(*) FILTER (WHERE created_at >= ${dayStart.toISOString()}::timestamptz) AS calls_today,
      COUNT(*) FILTER (WHERE created_at >= ${monthStart.toISOString()}::timestamptz) AS calls_month,
      COALESCE(SUM(input_tokens + output_tokens) FILTER (WHERE created_at >= ${dayStart.toISOString()}::timestamptz), 0) AS tokens_today,
      COALESCE(SUM(input_tokens + output_tokens) FILTER (WHERE created_at >= ${monthStart.toISOString()}::timestamptz), 0) AS tokens_month,
      COALESCE(SUM(cost_usd) FILTER (WHERE created_at >= ${dayStart.toISOString()}::timestamptz), 0) AS cost_today,
      COALESCE(SUM(cost_usd) FILTER (WHERE created_at >= ${monthStart.toISOString()}::timestamptz), 0) AS cost_month,
      COUNT(*) FILTER (WHERE status = 'budget_exhausted' AND created_at >= ${monthStart.toISOString()}::timestamptz) AS rejected_month,
      COUNT(*) FILTER (WHERE status = 'error' AND created_at >= ${monthStart.toISOString()}::timestamptz) AS errors_month
    FROM ${llmCallAudit}
    ${organizationFilter ? sql`WHERE organization_id = ${organizationFilter}` : sql``}
    GROUP BY organization_id
  `;
  const aggResult = await db.execute(aggregateQuery);
  const aggRows = Array.isArray(aggResult)
    ? (aggResult as Record<string, unknown>[])
    : (((aggResult as { rows?: Record<string, unknown>[] }).rows) ?? []);
  const aggByOrg = new Map<string, Record<string, unknown>>();
  for (const row of aggRows) {
    aggByOrg.set(String(row.organization_id), row);
  }

  // Daily histogram for the dashboard chart.
  const histQuery = sql`
    SELECT
      organization_id,
      date_trunc('day', created_at AT TIME ZONE 'UTC') AS day,
      COUNT(*) AS calls,
      COALESCE(SUM(input_tokens + output_tokens), 0) AS tokens,
      COALESCE(SUM(cost_usd), 0) AS cost
    FROM ${llmCallAudit}
    WHERE created_at >= ${histStart.toISOString()}::timestamptz
    ${organizationFilter ? sql`AND organization_id = ${organizationFilter}` : sql``}
    GROUP BY organization_id, day
    ORDER BY day ASC
  `;
  const histResult = await db.execute(histQuery);
  const histRows = Array.isArray(histResult)
    ? (histResult as Record<string, unknown>[])
    : (((histResult as { rows?: Record<string, unknown>[] }).rows) ?? []);
  const histByOrg = new Map<string, Array<{ day: string; calls: number; tokens: number; cost: number }>>();
  for (const row of histRows) {
    const orgId = String(row.organization_id);
    const entry = {
      day:
        row.day instanceof Date
          ? row.day.toISOString().slice(0, 10)
          : String(row.day).slice(0, 10),
      calls: Number(row.calls ?? 0),
      tokens: Number(row.tokens ?? 0),
      cost: Number(row.cost ?? 0),
    };
    const list = histByOrg.get(orgId) ?? [];
    list.push(entry);
    histByOrg.set(orgId, list);
  }

  // Feature breakdown (month-to-date) so PMs can spot which surface is
  // burning the credits.
  const featureQuery = sql`
    SELECT
      organization_id,
      feature,
      COUNT(*) AS calls,
      COALESCE(SUM(input_tokens + output_tokens), 0) AS tokens,
      COALESCE(SUM(cost_usd), 0) AS cost
    FROM ${llmCallAudit}
    WHERE created_at >= ${monthStart.toISOString()}::timestamptz
    ${organizationFilter ? sql`AND organization_id = ${organizationFilter}` : sql``}
    GROUP BY organization_id, feature
    ORDER BY cost DESC
  `;
  const featureResult = await db.execute(featureQuery);
  const featureRows = Array.isArray(featureResult)
    ? (featureResult as Record<string, unknown>[])
    : (((featureResult as { rows?: Record<string, unknown>[] }).rows) ?? []);
  const featuresByOrg = new Map<string, Array<{ feature: string; calls: number; tokens: number; cost: number }>>();
  for (const row of featureRows) {
    const orgId = String(row.organization_id);
    const list = featuresByOrg.get(orgId) ?? [];
    list.push({
      feature: String(row.feature),
      calls: Number(row.calls ?? 0),
      tokens: Number(row.tokens ?? 0),
      cost: Number(row.cost ?? 0),
    });
    featuresByOrg.set(orgId, list);
  }

  const organizationsPayload = budgetRows.map((row) => {
    const agg = aggByOrg.get(row.organizationId) ?? {};
    return {
      organizationId: row.organizationId,
      organizationName: row.organizationName,
      limits: {
        dailyTokens: row.dailyTokenLimit ?? null,
        monthlyTokens: row.monthlyTokenLimit ?? null,
        dailyCostUsd: row.dailyCostUsdLimit !== null ? Number(row.dailyCostUsdLimit) : null,
        monthlyCostUsd:
          row.monthlyCostUsdLimit !== null ? Number(row.monthlyCostUsdLimit) : null,
      },
      reservedUsage: {
        dailyTokens: row.dailyUsedTokens ?? 0,
        monthlyTokens: row.monthlyUsedTokens ?? 0,
        dailyCostUsd: row.dailyUsedCost !== null ? Number(row.dailyUsedCost) : 0,
        monthlyCostUsd: row.monthlyUsedCost !== null ? Number(row.monthlyUsedCost) : 0,
      },
      actualUsage: {
        callsToday: Number(agg.calls_today ?? 0),
        callsMonth: Number(agg.calls_month ?? 0),
        tokensToday: Number(agg.tokens_today ?? 0),
        tokensMonth: Number(agg.tokens_month ?? 0),
        costTodayUsd: Number(agg.cost_today ?? 0),
        costMonthUsd: Number(agg.cost_month ?? 0),
        budgetExhaustedMonth: Number(agg.rejected_month ?? 0),
        errorsMonth: Number(agg.errors_month ?? 0),
      },
      killSwitchEnabled: row.killSwitchEnabled ?? false,
      periodResetsAt: row.periodResetsAt ?? null,
      history: histByOrg.get(row.organizationId) ?? [],
      featureBreakdown: featuresByOrg.get(row.organizationId) ?? [],
    };
  });

  return NextResponse.json({
    generatedAt: new Date().toISOString(),
    windowDays: days,
    dayStart: dayStart.toISOString(),
    monthStart: monthStart.toISOString(),
    organizations: organizationsPayload,
  });
}
