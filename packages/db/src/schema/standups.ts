import { pgTable, text, timestamp, jsonb, index, uniqueIndex, varchar } from 'drizzle-orm/pg-core';
import { createId } from '@paralleldrive/cuid2';
import { users } from './users';
import { organizations } from './organizations';

/**
 * Standups — per-user daily digest of work activity for the previous 24h.
 *
 * Generated either by a cron job hitting POST /api/cron/standup or on demand
 * via POST /api/users/me/standup/preview. One row per (user, organization,
 * date) — duplicates are upserted so re-running the digest only refreshes
 * the latest copy.
 *
 * Content is markdown (Claude Haiku output) so the dashboard widget can
 * render it cheaply with a copy-to-Slack button. The raw events that fed
 * the prompt are stashed in `sourceEvents` for audit / re-summarization.
 */
export const standups = pgTable(
  'standups',
  {
    id: text('id').$defaultFn(() => createId()).primaryKey(),

    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),

    organizationId: text('organization_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' }),

    // ISO date string "YYYY-MM-DD" for the day this digest covers. Stored as
    // varchar(10) instead of `date` so we can rely on the unique index without
    // worrying about timezone-shifted comparisons.
    date: varchar('date', { length: 10 }).notNull(),

    // Full markdown body produced by the LLM, ready to render or paste.
    contentMd: text('content_md').notNull(),

    // Blockers split out for badge / highlight rendering. Empty string when
    // the user reported no blockers.
    blockersMd: text('blockers_md').notNull().default(''),

    // Raw events used to build the prompt — list of { type, ref, summary,
    // at }. Kept as JSONB so we can replay or re-summarize later.
    sourceEvents: jsonb('source_events').notNull().default('[]'),

    createdAt: timestamp('created_at').notNull().defaultNow(),
  },
  (table) => ({
    userDateIdx: uniqueIndex('standups_user_org_date_idx').on(
      table.userId,
      table.organizationId,
      table.date
    ),
    userIdx: index('standups_user_idx').on(table.userId),
    organizationIdx: index('standups_organization_idx').on(table.organizationId),
  })
);

export type StandupRecord = typeof standups.$inferSelect;
export type NewStandup = typeof standups.$inferInsert;
