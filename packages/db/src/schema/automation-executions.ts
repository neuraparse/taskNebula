import { pgTable, text, timestamp, jsonb, integer, index } from 'drizzle-orm/pg-core';
import { createId } from '@paralleldrive/cuid2';
import { automationRules } from './workflows';

// Automation Executions table
// One row per rule fired (either matched+run or skipped by condition check).
// Records the triggering payload, per-action results, duration and any error so
// admins can audit automation behavior over time.
export const automationExecutions = pgTable('automation_executions', {
  id: text('id').$defaultFn(() => createId()).primaryKey(),
  ruleId: text('rule_id')
    .notNull()
    .references(() => automationRules.id, { onDelete: 'cascade' }),
  triggeredAt: timestamp('triggered_at').notNull().defaultNow(),
  triggerPayload: jsonb('trigger_payload'),
  // status values: 'matched' | 'skipped' | 'success' | 'failed'
  status: text('status').notNull(),
  // actionResults shape: Array<{ actionType: string; ok: boolean; error?: string }>
  actionResults: jsonb('action_results'),
  durationMs: integer('duration_ms'),
  error: text('error'),
}, (table) => ({
  ruleIdx: index('automation_execution_rule_idx').on(table.ruleId),
  ruleTriggeredAtIdx: index('automation_execution_rule_triggered_at_idx').on(
    table.ruleId,
    table.triggeredAt
  ),
}));
