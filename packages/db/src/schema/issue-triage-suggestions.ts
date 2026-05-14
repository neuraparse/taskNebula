import { pgTable, text, timestamp, jsonb, integer, index } from 'drizzle-orm/pg-core';
import { createId } from '@paralleldrive/cuid2';
import { issues } from './issues';
import { users } from './users';

/**
 * Issue Triage Suggestions — output of the Triage Intelligence agent
 * (P0-02). Each row is one LLM call's structured proposal for an issue:
 * labels, priority, suggested assignee/team and a free-form rationale.
 *
 * The row is persisted regardless of whether it ever gets applied so we
 * can audit what the agent proposed (rejected suggestions show user trust
 * signals, accepted ones drive model-quality dashboards).
 *
 * `confidence` is an integer 0..100 (rather than a float) so it indexes
 * well and matches the threshold expressed as a percentage in the
 * workspace `triage.autoApplyConfidence` setting.
 *
 * Lifecycle:
 *   - created_at — row inserted right after the LLM call returns.
 *   - applied_at — set when /triage/apply mutates the issue.
 *   - dismissed_at — set when a human says "no thanks".
 * Mutually exclusive; both null = pending.
 */
export const issueTriageSuggestions = pgTable('issue_triage_suggestions', {
  id: text('id').$defaultFn(() => createId()).primaryKey(),
  issueId: text('issue_id')
    .notNull()
    .references(() => issues.id, { onDelete: 'cascade' }),
  // Full structured proposal — see TriageSuggestionPayload in
  // apps/web/src/lib/agents/triage.ts. Stored as JSON so we can extend
  // without a migration when the agent learns new fields.
  payload: jsonb('payload').notNull(),
  // 0..100 — integer for clean threshold comparisons.
  confidence: integer('confidence').notNull().default(0),
  appliedAt: timestamp('applied_at'),
  appliedBy: text('applied_by').references(() => users.id, { onDelete: 'set null' }),
  dismissedAt: timestamp('dismissed_at'),
  dismissedBy: text('dismissed_by').references(() => users.id, { onDelete: 'set null' }),
  createdAt: timestamp('created_at').notNull().defaultNow(),
}, (table) => ({
  issueIdx: index('triage_suggestion_issue_idx').on(table.issueId),
  issueCreatedAtIdx: index('triage_suggestion_issue_created_at_idx').on(
    table.issueId,
    table.createdAt,
  ),
}));

export type IssueTriageSuggestionRecord = typeof issueTriageSuggestions.$inferSelect;
export type NewIssueTriageSuggestion = typeof issueTriageSuggestions.$inferInsert;
