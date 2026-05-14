import { pgTable, text, timestamp, jsonb, integer, numeric, index } from 'drizzle-orm/pg-core';
import { createId } from '@paralleldrive/cuid2';

/**
 * LLM Call Audit — observability for AI/LLM-backed endpoints (Ask TaskNebula,
 * draft-issue, agent runs, etc.). Stores org/user, model, token counts,
 * USD cost and end-to-end latency.
 *
 * Privacy: only a hash of the prompt is stored — never the raw user text.
 * Admins can join with the user table to track spend per seat.
 */
export const llmCallAudit = pgTable('llm_call_audit', {
  id: text('id').$defaultFn(() => createId()).primaryKey(),

  // Org & user can be null for unauthenticated/system runs.
  orgId: text('org_id'),
  userId: text('user_id'),

  endpoint: text('endpoint').notNull().default('ask'),
  model: text('model').notNull(),

  // SHA-256 hex digest of the prompt+context fed to the LLM.
  promptHash: text('prompt_hash').notNull(),

  inputTokens: integer('input_tokens').notNull().default(0),
  outputTokens: integer('output_tokens').notNull().default(0),

  // Stored as numeric(10,6) so prices like 0.000123 round-trip.
  costUsd: numeric('cost_usd', { precision: 10, scale: 6 }).notNull().default('0'),

  latencyMs: integer('latency_ms').notNull().default(0),

  // 'success' | 'rate_limited' | 'error' | 'cancelled'
  status: text('status').notNull().default('success'),

  metadata: jsonb('metadata').notNull().default('{}'),

  createdAt: timestamp('created_at').notNull().defaultNow(),
}, (table) => ({
  orgIdx: index('llm_call_audit_org_idx').on(table.orgId),
  userIdx: index('llm_call_audit_user_idx').on(table.userId),
  createdAtIdx: index('llm_call_audit_created_at_idx').on(table.createdAt),
  endpointCreatedIdx: index('llm_call_audit_endpoint_created_idx').on(table.endpoint, table.createdAt),
}));

export type LlmCallAuditRecord = typeof llmCallAudit.$inferSelect;
export type NewLlmCallAudit = typeof llmCallAudit.$inferInsert;
