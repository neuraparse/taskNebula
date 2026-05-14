/**
 * AI Cost Guard schema
 *
 * Two tables that back the per-org AI cost / token budget guardrail
 * shipped with TaskNebula Roadmap task P0-07:
 *
 *   1. `org_token_budgets`
 *      One row per organization. Holds the configured daily / monthly
 *      token + USD limits, the live running counters, the period reset
 *      timestamp, and an emergency kill switch. Counters are mutated
 *      from the `commitUsage()` helper inside a Postgres transaction
 *      that uses `SELECT ... FOR UPDATE` to avoid lost-update races
 *      between concurrent LLM calls.
 *
 *   2. `llm_call_audit`
 *      Append-only ledger of every LLM call attempted by the platform
 *      (regardless of whether it was actually billed). Used for the
 *      admin AI usage dashboard, anomaly detection, and tying spend
 *      back to a feature/user. INSERT-only — the matching SQL migration
 *      installs a trigger that rejects UPDATE/DELETE so this row is
 *      immutable once written.
 *
 * The existing `audit_logs` table tracks high-level actions and is not
 * a substitute for the LLM-call ledger: we need per-call token and
 * cost metrics that are too volume-heavy for the action log and need
 * different retention rules.
 */

import {
  pgTable,
  text,
  timestamp,
  integer,
  numeric,
  boolean,
  uniqueIndex,
  index,
} from 'drizzle-orm/pg-core';
import { createId } from '@paralleldrive/cuid2';
import { organizations } from './organizations';
import { users } from './users';

export const orgTokenBudgets = pgTable(
  'org_token_budgets',
  {
    id: text('id').$defaultFn(() => createId()).primaryKey(),
    organizationId: text('organization_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' }),

    // Configured ceilings. Null = unlimited for that dimension.
    dailyTokenLimit: integer('daily_token_limit'),
    monthlyTokenLimit: integer('monthly_token_limit'),
    dailyCostUsdLimit: numeric('daily_cost_usd_limit', { precision: 12, scale: 4 }),
    monthlyCostUsdLimit: numeric('monthly_cost_usd_limit', { precision: 12, scale: 4 }),

    // Running counters. Reset at period boundaries (UTC midnight for
    // daily, 1st-of-month UTC for monthly).
    dailyUsedTokens: integer('daily_used_tokens').notNull().default(0),
    monthlyUsedTokens: integer('monthly_used_tokens').notNull().default(0),
    dailyUsedCost: numeric('daily_used_cost', { precision: 12, scale: 4 })
      .notNull()
      .default('0'),
    monthlyUsedCost: numeric('monthly_used_cost', { precision: 12, scale: 4 })
      .notNull()
      .default('0'),

    // When the next reset should happen. Stored explicitly so a kill
    // switch toggle or a forgotten cron does not silently keep counters
    // stale forever; `checkAndReserveTokens` rolls the period if this
    // timestamp is in the past before doing any math.
    periodResetsAt: timestamp('period_resets_at', { withTimezone: true })
      .notNull()
      .defaultNow(),

    // Emergency stop. When true, every call is rejected with
    // `budget_kill_switch` regardless of remaining budget.
    killSwitchEnabled: boolean('kill_switch_enabled').notNull().default(false),

    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => ({
    organizationUniqueIdx: uniqueIndex('org_token_budgets_organization_idx').on(
      table.organizationId
    ),
  })
);

export const llmCallAudit = pgTable(
  'llm_call_audit',
  {
    id: text('id').$defaultFn(() => createId()).primaryKey(),
    organizationId: text('organization_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' }),
    userId: text('user_id').references(() => users.id, { onDelete: 'set null' }),

    // Provider / model. `provider` is a free-form text rather than an
    // enum so adding a new provider does not require a migration.
    provider: text('provider').notNull(),
    model: text('model').notNull(),

    // SHA-256 of the prompt (hex). Never store the prompt itself —
    // these rows are kept for 90+ days for cost auditing and should
    // never become a data exfiltration target.
    promptHash: text('prompt_hash'),

    // Token + cost accounting.
    inputTokens: integer('input_tokens').notNull().default(0),
    outputTokens: integer('output_tokens').notNull().default(0),
    cachedTokens: integer('cached_tokens').notNull().default(0),
    costUsd: numeric('cost_usd', { precision: 12, scale: 6 })
      .notNull()
      .default('0'),

    latencyMs: integer('latency_ms'),

    // success | error | rate_limited | budget_exhausted
    status: text('status').notNull(),
    errorMessage: text('error_message'),

    // High-level feature label so spend can be sliced per surface:
    // draft, assist, triage, ask, ...
    feature: text('feature').notNull(),

    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => ({
    organizationIdx: index('llm_call_audit_organization_idx').on(
      table.organizationId
    ),
    createdAtIdx: index('llm_call_audit_created_at_idx').on(table.createdAt),
    orgCreatedAtIdx: index('llm_call_audit_org_created_at_idx').on(
      table.organizationId,
      table.createdAt
    ),
    statusIdx: index('llm_call_audit_status_idx').on(table.status),
    featureIdx: index('llm_call_audit_feature_idx').on(table.feature),
  })
);

export type OrgTokenBudget = typeof orgTokenBudgets.$inferSelect;
export type NewOrgTokenBudget = typeof orgTokenBudgets.$inferInsert;
export type LlmCallAuditRow = typeof llmCallAudit.$inferSelect;
export type NewLlmCallAuditRow = typeof llmCallAudit.$inferInsert;
