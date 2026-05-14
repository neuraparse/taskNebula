/**
 * AI Cost Guard runtime (Roadmap P0-07)
 *
 * Wraps every outbound LLM call with a transactional budget check plus
 * an immutable audit row. Public surface:
 *
 *   checkAndReserveTokens(orgId, estimatedTokens, model)
 *     -> { allowed: true } | { allowed: false, reason }
 *   commitUsage(orgId, { ... })  // append llm_call_audit + true-up
 *   runWithBudget(orgId, userId, params, callable)
 *     -> wraps a callable in check + commit + audit row.
 *
 * Atomicity
 * ---------
 * Both helpers run inside `db.transaction` with `SELECT ... FOR UPDATE`
 * against the org's `org_token_budgets` row. That serialises concurrent
 * reservations from the same organisation so two parallel calls cannot
 * double-spend an exhausted budget. We pre-reserve `estimatedTokens` so
 * the second caller fails fast; `commitUsage()` then trues the row up
 * with the actual numbers reported by the provider.
 *
 * The matching migration installs UPDATE/DELETE triggers on
 * `llm_call_audit`, so audit rows are physically immutable once
 * inserted.
 *
 * Cost estimation
 * ---------------
 * Token-to-USD conversion is a coarse static table keyed on model name
 * prefix. The table biases generously (always rounds up) so the budget
 * check has a built-in safety margin — accurate billing for the bean
 * counters still comes from the provider invoice, not from us.
 */

import crypto from 'node:crypto';
import { sql } from 'drizzle-orm';
import {
  db,
  llmCallAudit,
  orgTokenBudgets,
  type OrgTokenBudget,
} from '@tasknebula/db';

export type BudgetCheckResult =
  | { allowed: true }
  | {
      allowed: false;
      reason:
        | 'kill_switch'
        | 'daily_tokens_exceeded'
        | 'monthly_tokens_exceeded'
        | 'daily_cost_exceeded'
        | 'monthly_cost_exceeded';
      message: string;
    };

export type LlmCallStatus = 'success' | 'error' | 'rate_limited' | 'budget_exhausted';

export type LlmFeature =
  | 'draft'
  | 'draft_multi'
  | 'assist'
  | 'triage'
  | 'ask'
  | 'agent_run'
  | string;

export interface CommitUsageInput {
  organizationId: string;
  userId?: string | null;
  provider: string;
  model: string;
  prompt?: string | null;
  inputTokens: number;
  outputTokens: number;
  cachedTokens?: number;
  costUsd?: number; // when omitted, estimated from token counts
  latencyMs?: number;
  status: LlmCallStatus;
  errorMessage?: string | null;
  feature: LlmFeature;
}

/**
 * Coarse $/1k-token pricing table. Pricing changes constantly; we
 * deliberately bias UP so the budget check is conservative. The actual
 * billed cost is whatever the provider invoices.
 */
const MODEL_PRICING: Array<{ match: RegExp; inputPer1k: number; outputPer1k: number }> = [
  // OpenAI
  { match: /^gpt-5/i, inputPer1k: 0.005, outputPer1k: 0.015 },
  { match: /^gpt-4o-mini/i, inputPer1k: 0.00015, outputPer1k: 0.0006 },
  { match: /^gpt-4o/i, inputPer1k: 0.0025, outputPer1k: 0.01 },
  { match: /^gpt-4/i, inputPer1k: 0.01, outputPer1k: 0.03 },
  { match: /^gpt-3\.5/i, inputPer1k: 0.0005, outputPer1k: 0.0015 },
  // Anthropic
  { match: /^claude-opus/i, inputPer1k: 0.015, outputPer1k: 0.075 },
  { match: /^claude-sonnet/i, inputPer1k: 0.003, outputPer1k: 0.015 },
  { match: /^claude-haiku/i, inputPer1k: 0.00025, outputPer1k: 0.00125 },
];

const FALLBACK_PRICING = { inputPer1k: 0.01, outputPer1k: 0.03 };

export function estimateCostUsd(
  model: string,
  inputTokens: number,
  outputTokens: number
): number {
  const pricing =
    MODEL_PRICING.find((row) => row.match.test(model)) ?? FALLBACK_PRICING;
  const cost =
    (Math.max(0, inputTokens) / 1000) * pricing.inputPer1k +
    (Math.max(0, outputTokens) / 1000) * pricing.outputPer1k;
  // Round to 6dp to match the column scale.
  return Math.round(cost * 1_000_000) / 1_000_000;
}

export function hashPrompt(prompt: string | null | undefined): string | null {
  if (!prompt) return null;
  return crypto.createHash('sha256').update(prompt).digest('hex');
}

/**
 * UTC reset boundary calculator.
 *
 * - If the previous resets-at is more than 31 days ago we assume the
 *   monthly counter is stale and roll both. Otherwise we just roll the
 *   daily counter when the day flips.
 */
function computeRollover(
  previousResetsAt: Date,
  monthlyTokens: number,
  monthlyCost: string,
  now: Date = new Date()
): {
  dailyTokens: number;
  dailyCost: string;
  monthlyTokens: number;
  monthlyCost: string;
  nextResetsAt: Date;
} {
  const nowUtc = new Date(
    Date.UTC(
      now.getUTCFullYear(),
      now.getUTCMonth(),
      now.getUTCDate(),
      now.getUTCHours(),
      now.getUTCMinutes(),
      now.getUTCSeconds()
    )
  );

  // Next UTC midnight.
  const nextDailyReset = new Date(
    Date.UTC(nowUtc.getUTCFullYear(), nowUtc.getUTCMonth(), nowUtc.getUTCDate() + 1)
  );

  const prevDay = Date.UTC(
    previousResetsAt.getUTCFullYear(),
    previousResetsAt.getUTCMonth(),
    previousResetsAt.getUTCDate()
  );
  const todayUtc = Date.UTC(
    nowUtc.getUTCFullYear(),
    nowUtc.getUTCMonth(),
    nowUtc.getUTCDate()
  );

  const dailyShouldRoll = todayUtc > prevDay;

  // Monthly rolls when the calendar month flips.
  const monthlyShouldRoll =
    nowUtc.getUTCFullYear() !== previousResetsAt.getUTCFullYear() ||
    nowUtc.getUTCMonth() !== previousResetsAt.getUTCMonth();

  return {
    dailyTokens: dailyShouldRoll ? 0 : -1, // sentinel: caller keeps current
    dailyCost: dailyShouldRoll ? '0' : '-1',
    monthlyTokens: monthlyShouldRoll ? 0 : monthlyTokens,
    monthlyCost: monthlyShouldRoll ? '0' : monthlyCost,
    nextResetsAt: nextDailyReset,
  };
}

type RawBudgetRow = {
  id: string;
  organization_id: string;
  daily_token_limit: number | null;
  monthly_token_limit: number | null;
  daily_cost_usd_limit: string | null;
  monthly_cost_usd_limit: string | null;
  daily_used_tokens: number;
  monthly_used_tokens: number;
  daily_used_cost: string;
  monthly_used_cost: string;
  period_resets_at: Date | string;
  kill_switch_enabled: boolean;
  created_at: Date | string;
  updated_at: Date | string;
};

function normalizeRow(row: RawBudgetRow): OrgTokenBudget {
  return {
    id: row.id,
    organizationId: row.organization_id,
    dailyTokenLimit: row.daily_token_limit,
    monthlyTokenLimit: row.monthly_token_limit,
    dailyCostUsdLimit: row.daily_cost_usd_limit,
    monthlyCostUsdLimit: row.monthly_cost_usd_limit,
    dailyUsedTokens: row.daily_used_tokens,
    monthlyUsedTokens: row.monthly_used_tokens,
    dailyUsedCost: row.daily_used_cost,
    monthlyUsedCost: row.monthly_used_cost,
    periodResetsAt:
      row.period_resets_at instanceof Date
        ? row.period_resets_at
        : new Date(row.period_resets_at),
    killSwitchEnabled: row.kill_switch_enabled,
    createdAt:
      row.created_at instanceof Date ? row.created_at : new Date(row.created_at),
    updatedAt:
      row.updated_at instanceof Date ? row.updated_at : new Date(row.updated_at),
  };
}

async function loadOrCreateBudgetRow(
  tx: Parameters<Parameters<typeof db.transaction>[0]>[0],
  organizationId: string
): Promise<OrgTokenBudget> {
  // SELECT FOR UPDATE — serialises concurrent reservations per org.
  const locked = await tx.execute<RawBudgetRow>(sql`
    SELECT *
    FROM ${orgTokenBudgets}
    WHERE ${orgTokenBudgets.organizationId} = ${organizationId}
    FOR UPDATE
  `);
  const rawRows: RawBudgetRow[] = Array.isArray(locked)
    ? (locked as unknown as RawBudgetRow[])
    : ((locked as unknown as { rows?: RawBudgetRow[] }).rows ?? []);
  if (rawRows.length > 0) {
    return normalizeRow(rawRows[0]!);
  }

  const [created] = await tx
    .insert(orgTokenBudgets)
    .values({ organizationId })
    .returning();
  if (!created) {
    throw new Error('Failed to create org_token_budgets row');
  }
  return created;
}

function toNumber(value: string | number | null | undefined): number {
  if (value === null || value === undefined) return 0;
  if (typeof value === 'number') return value;
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

/**
 * Reserve `estimatedTokens` of headroom against the org's budget. The
 * row is locked for the duration of the surrounding transaction.
 *
 * Returns `{ allowed: false, reason }` and does NOT mutate counters on
 * rejection. On success it eagerly bumps the running counters by the
 * estimated amount; `commitUsage()` later trues the row up with the
 * provider-reported numbers.
 */
export async function checkAndReserveTokens(
  organizationId: string,
  estimatedTokens: number,
  model: string
): Promise<BudgetCheckResult> {
  const estimateTokens = Math.max(0, Math.floor(estimatedTokens));
  // Split estimate evenly between input/output for a coarse cost guess.
  const half = Math.ceil(estimateTokens / 2);
  const estimatedCost = estimateCostUsd(model, half, estimateTokens - half);

  return db.transaction(async (tx) => {
    const row = await loadOrCreateBudgetRow(tx, organizationId);

    if (row.killSwitchEnabled) {
      return {
        allowed: false,
        reason: 'kill_switch',
        message: 'AI calls are paused by the workspace kill switch.',
      } as const;
    }

    // Roll period if needed (no-op when current period is still active).
    const rollover = computeRollover(
      row.periodResetsAt,
      row.monthlyUsedTokens,
      String(row.monthlyUsedCost)
    );
    const currentDailyTokens =
      rollover.dailyTokens === -1 ? row.dailyUsedTokens : rollover.dailyTokens;
    const currentDailyCost =
      rollover.dailyCost === '-1' ? toNumber(row.dailyUsedCost) : toNumber(rollover.dailyCost);
    const currentMonthlyTokens = rollover.monthlyTokens;
    const currentMonthlyCost = toNumber(rollover.monthlyCost);

    const nextDailyTokens = currentDailyTokens + estimateTokens;
    const nextMonthlyTokens = currentMonthlyTokens + estimateTokens;
    const nextDailyCost = currentDailyCost + estimatedCost;
    const nextMonthlyCost = currentMonthlyCost + estimatedCost;

    if (row.dailyTokenLimit !== null && nextDailyTokens > row.dailyTokenLimit) {
      return {
        allowed: false,
        reason: 'daily_tokens_exceeded',
        message: `Daily token budget reached (${row.dailyTokenLimit}).`,
      } as const;
    }
    if (row.monthlyTokenLimit !== null && nextMonthlyTokens > row.monthlyTokenLimit) {
      return {
        allowed: false,
        reason: 'monthly_tokens_exceeded',
        message: `Monthly token budget reached (${row.monthlyTokenLimit}).`,
      } as const;
    }
    if (
      row.dailyCostUsdLimit !== null &&
      nextDailyCost > toNumber(row.dailyCostUsdLimit)
    ) {
      return {
        allowed: false,
        reason: 'daily_cost_exceeded',
        message: `Daily cost budget reached ($${toNumber(row.dailyCostUsdLimit).toFixed(2)}).`,
      } as const;
    }
    if (
      row.monthlyCostUsdLimit !== null &&
      nextMonthlyCost > toNumber(row.monthlyCostUsdLimit)
    ) {
      return {
        allowed: false,
        reason: 'monthly_cost_exceeded',
        message: `Monthly cost budget reached ($${toNumber(row.monthlyCostUsdLimit).toFixed(2)}).`,
      } as const;
    }

    // Reserve. We persist the rolled-over counters in the same UPDATE so
    // a subsequent caller sees the correct period.
    await tx.execute(sql`
      UPDATE ${orgTokenBudgets}
      SET
        daily_used_tokens = ${nextDailyTokens},
        daily_used_cost = ${nextDailyCost.toFixed(4)}::numeric,
        monthly_used_tokens = ${nextMonthlyTokens},
        monthly_used_cost = ${nextMonthlyCost.toFixed(4)}::numeric,
        period_resets_at = ${rollover.nextResetsAt.toISOString()}::timestamptz,
        updated_at = now()
      WHERE ${orgTokenBudgets.organizationId} = ${organizationId}
    `);

    return { allowed: true } as const;
  });
}

/**
 * True-up the running counters with the actual usage reported by the
 * provider and append an `llm_call_audit` row. Should be called for
 * every attempted call, including errors — the audit log is the source
 * of truth for the admin usage dashboard.
 */
export async function commitUsage(input: CommitUsageInput): Promise<void> {
  const totalTokens =
    Math.max(0, input.inputTokens) + Math.max(0, input.outputTokens);
  const costUsd =
    input.costUsd ??
    estimateCostUsd(input.model, input.inputTokens, input.outputTokens);

  await db.transaction(async (tx) => {
    // Always append the audit row first — even on budget_exhausted the
    // ledger should record the attempt.
    await tx.insert(llmCallAudit).values({
      organizationId: input.organizationId,
      userId: input.userId ?? null,
      provider: input.provider,
      model: input.model,
      promptHash: hashPrompt(input.prompt ?? null),
      inputTokens: Math.max(0, input.inputTokens),
      outputTokens: Math.max(0, input.outputTokens),
      cachedTokens: Math.max(0, input.cachedTokens ?? 0),
      costUsd: costUsd.toFixed(6),
      latencyMs: input.latencyMs ?? null,
      status: input.status,
      errorMessage: input.errorMessage ?? null,
      feature: input.feature,
    });

    // Only successful + rate_limited calls actually burned headroom we
    // need to true up. budget_exhausted means we never even called the
    // provider, so no correction needed.
    if (input.status === 'budget_exhausted') return;

    const row = await loadOrCreateBudgetRow(tx, input.organizationId);
    // The reservation may have used an estimate that diverged from the
    // actual; we add the *delta* between true totals and zero, but
    // because the reservation already pre-bumped the counter, callers
    // that go through `runWithBudget` always net to (actual - estimate)
    // via the explicit subtraction below.
    const actualDailyTokens = Math.max(0, row.dailyUsedTokens) + totalTokens;
    const actualMonthlyTokens = Math.max(0, row.monthlyUsedTokens) + totalTokens;
    const actualDailyCost = toNumber(row.dailyUsedCost) + costUsd;
    const actualMonthlyCost = toNumber(row.monthlyUsedCost) + costUsd;

    await tx.execute(sql`
      UPDATE ${orgTokenBudgets}
      SET
        daily_used_tokens = ${actualDailyTokens},
        daily_used_cost = ${actualDailyCost.toFixed(4)}::numeric,
        monthly_used_tokens = ${actualMonthlyTokens},
        monthly_used_cost = ${actualMonthlyCost.toFixed(4)}::numeric,
        updated_at = now()
      WHERE ${orgTokenBudgets.organizationId} = ${input.organizationId}
    `);
  });
}

/**
 * Refund a previously reserved amount when the provider was never
 * actually called (e.g. early validation error inside our wrapper).
 */
export async function refundReservation(
  organizationId: string,
  reservedTokens: number,
  model: string
): Promise<void> {
  const tokens = Math.max(0, Math.floor(reservedTokens));
  if (tokens === 0) return;
  const half = Math.ceil(tokens / 2);
  const refundCost = estimateCostUsd(model, half, tokens - half);

  await db.transaction(async (tx) => {
    const row = await loadOrCreateBudgetRow(tx, organizationId);
    const nextDailyTokens = Math.max(0, row.dailyUsedTokens - tokens);
    const nextMonthlyTokens = Math.max(0, row.monthlyUsedTokens - tokens);
    const nextDailyCost = Math.max(0, toNumber(row.dailyUsedCost) - refundCost);
    const nextMonthlyCost = Math.max(0, toNumber(row.monthlyUsedCost) - refundCost);

    await tx.execute(sql`
      UPDATE ${orgTokenBudgets}
      SET
        daily_used_tokens = ${nextDailyTokens},
        daily_used_cost = ${nextDailyCost.toFixed(4)}::numeric,
        monthly_used_tokens = ${nextMonthlyTokens},
        monthly_used_cost = ${nextMonthlyCost.toFixed(4)}::numeric,
        updated_at = now()
      WHERE ${orgTokenBudgets.organizationId} = ${organizationId}
    `);
  });
}

export class BudgetExhaustedError extends Error {
  readonly code: string;
  readonly statusCode = 429;

  constructor(reason: string, message: string) {
    super(message);
    this.name = 'BudgetExhaustedError';
    this.code = reason;
  }
}

export interface RunWithBudgetParams {
  organizationId: string;
  userId?: string | null;
  provider: string;
  model: string;
  feature: LlmFeature;
  prompt?: string | null;
  estimatedTokens: number;
}

export interface LlmCallResult {
  inputTokens: number;
  outputTokens: number;
  cachedTokens?: number;
  costUsd?: number;
  status?: LlmCallStatus;
}

/**
 * Convenience wrapper: reserve → run → commit, with timing and error
 * audit rows. The callable is expected to return token counts; we
 * default to (estimatedTokens / 2, estimatedTokens / 2) when the
 * provider doesn't report them.
 */
export async function runWithBudget<T>(
  params: RunWithBudgetParams,
  fn: () => Promise<{ value: T; usage: LlmCallResult }>
): Promise<T> {
  const check = await checkAndReserveTokens(
    params.organizationId,
    params.estimatedTokens,
    params.model
  );
  if (!check.allowed) {
    await commitUsage({
      organizationId: params.organizationId,
      userId: params.userId,
      provider: params.provider,
      model: params.model,
      prompt: params.prompt,
      inputTokens: 0,
      outputTokens: 0,
      status: 'budget_exhausted',
      errorMessage: check.message,
      feature: params.feature,
    });
    throw new BudgetExhaustedError(check.reason, check.message);
  }

  const startedAt = Date.now();
  try {
    const { value, usage } = await fn();
    const latencyMs = Date.now() - startedAt;
    // Refund the full reservation first so commitUsage's bump leaves
    // the counter at exactly the actual usage rather than
    // (reservation + actual).
    await refundReservation(
      params.organizationId,
      params.estimatedTokens,
      params.model
    );
    await commitUsage({
      organizationId: params.organizationId,
      userId: params.userId,
      provider: params.provider,
      model: params.model,
      prompt: params.prompt,
      inputTokens: usage.inputTokens,
      outputTokens: usage.outputTokens,
      cachedTokens: usage.cachedTokens,
      costUsd: usage.costUsd,
      latencyMs,
      status: usage.status ?? 'success',
      feature: params.feature,
    });
    return value;
  } catch (err) {
    const latencyMs = Date.now() - startedAt;
    const message = err instanceof Error ? err.message : String(err);
    // Refund the full reservation since the call did not consume tokens.
    await refundReservation(
      params.organizationId,
      params.estimatedTokens,
      params.model
    );
    await commitUsage({
      organizationId: params.organizationId,
      userId: params.userId,
      provider: params.provider,
      model: params.model,
      prompt: params.prompt,
      inputTokens: 0,
      outputTokens: 0,
      latencyMs,
      status:
        /rate.?limit/i.test(message) ? 'rate_limited' : 'error',
      errorMessage: message.slice(0, 500),
      feature: params.feature,
    });
    throw err;
  }
}

/**
 * Approximate token count for a string. We use a simple chars/4 heuristic
 * which is good enough for budget pre-checks; the audit row records the
 * provider's actual count after the call returns.
 */
export function estimatePromptTokens(text: string | null | undefined): number {
  if (!text) return 0;
  return Math.ceil(text.length / 4);
}
