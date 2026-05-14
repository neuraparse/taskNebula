import { pgTable, text, timestamp, index } from 'drizzle-orm/pg-core';
import { createId } from '@paralleldrive/cuid2';
import { issues } from './issues';
import { users } from './users';

/**
 * Append-only log of every status transition an issue undergoes. Powers the
 * Time-in-Status analytics endpoint and feeds visualizations slated for
 * roadmap task #26.
 *
 * Backfill is intentionally not performed: cycles auto-rollover (FEAT-23)
 * starts collecting from the moment this table ships. Older transitions live
 * in `issue_activities` and can be migrated later if needed.
 */
export const issueStatusHistory = pgTable(
  'issue_status_history',
  {
    id: text('id').$defaultFn(() => createId()).primaryKey(),
    issueId: text('issue_id').notNull().references(() => issues.id, { onDelete: 'cascade' }),
    // Nullable for the very first row of an issue's history if we choose to log
    // creation, but at runtime we only write rows on real transitions where
    // both ends are known. Schema keeps null permissive for backfills.
    fromStatus: text('from_status'),
    toStatus: text('to_status').notNull(),
    changedByUserId: text('changed_by_user_id').references(() => users.id, { onDelete: 'set null' }),
    changedAt: timestamp('changed_at', { withTimezone: true }).notNull().defaultNow(),
    // Free-form context: 'user', 'cycle_rollover', 'automation', etc.
    reason: text('reason'),
  },
  (table) => ({
    issueChangedAtIdx: index('issue_status_history_issue_changed_at_idx').on(
      table.issueId,
      table.changedAt
    ),
  })
);
