import { pgTable, text, timestamp, integer, index } from 'drizzle-orm/pg-core';
import { createId } from '@paralleldrive/cuid2';
import { sql } from 'drizzle-orm';
import { issues } from './issues';
import { users } from './users';

/**
 * Time entries (task #10 — native time tracking).
 *
 * A row represents either:
 *   - a running timer (ended_at IS NULL, duration_seconds IS NULL)
 *   - a finalized log (ended_at set, duration_seconds GENERATED from ended_at - started_at)
 *   - a manual entry (started_at = a back-dated marker, ended_at set, duration_seconds GENERATED)
 *
 * `duration_seconds` is a GENERATED STORED column so the DB is always the source of truth
 * for elapsed time on finalized rows; running rows always show NULL.
 *
 * `source` distinguishes how the row was created so analytics can include / exclude inferred
 * entries (e.g. GitHub commits parsed into time later by task #15 Toggl/Harvest area).
 */
export const timeEntries = pgTable(
  'time_entries',
  {
    id: text('id')
      .$defaultFn(() => createId())
      .primaryKey(),
    issueId: text('issue_id')
      .notNull()
      .references(() => issues.id, { onDelete: 'cascade' }),
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    startedAt: timestamp('started_at', { withTimezone: true }).notNull(),
    endedAt: timestamp('ended_at', { withTimezone: true }),
    // GENERATED STORED: EXTRACT(EPOCH FROM ended_at - started_at)::int — see migration.
    // Drizzle doesn't yet model generated columns natively; we expose it as a regular
    // integer column and skip writes from the ORM. NULL while a timer is running.
    durationSeconds: integer('duration_seconds'),
    description: text('description'),
    source: text('source').notNull().default('manual'), // 'manual'|'timer'|'github_inferred'|'integration'
    integrationRef: text('integration_ref'), // e.g. external Toggl entry id
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    userStartedAtIdx: index('time_entries_user_started_at_idx').on(
      table.userId,
      table.startedAt,
    ),
    issueIdx: index('time_entries_issue_idx').on(table.issueId),
    // Partial unique index enforced in the migration: only one running timer (ended_at IS NULL)
    // per user. Drizzle can't express WHERE clauses on indexes here, so we keep this index
    // as documentation; the DB constraint lives in the SQL migration.
    userRunningIdx: index('time_entries_user_running_idx').on(table.userId, table.endedAt),
  }),
);

/**
 * Helper SQL fragment for computing duration on rows where the GENERATED column might be
 * stripped (e.g. when reading via a view). Prefer `time_entries.duration_seconds` directly.
 */
export const timeEntryDurationExpr = sql<number>`EXTRACT(EPOCH FROM (${timeEntries.endedAt} - ${timeEntries.startedAt}))::int`;
