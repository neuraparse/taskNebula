/**
 * EU AI Act Article 50 — disclosure acknowledgement ledger.
 *
 * Tracks the first time each (workspace, user) sees an AI-generated output and
 * acknowledges the disclosure modal that explains AI involvement, retention
 * policy, and links to the model cards. Persisted so the modal only shows
 * once per disclosure-text version; bumping `version` re-shows the modal to
 * every user the next time they interact with an AI surface.
 *
 * Regulation enforcement begins 2026-08-02.
 */

import {
  index,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  varchar,
} from 'drizzle-orm/pg-core';
import { createId } from '@paralleldrive/cuid2';
import { organizations } from './organizations';
import { users } from './users';

export const aiDisclosuresAcknowledged = pgTable(
  'ai_disclosures_acknowledged',
  {
    id: text('id')
      .$defaultFn(() => createId())
      .primaryKey(),
    workspaceId: text('workspace_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' }),
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    /** Semver-ish version of the disclosure copy the user saw + agreed to. */
    version: varchar('version', { length: 32 }).notNull(),
    acknowledgedAt: timestamp('acknowledged_at').notNull().defaultNow(),
    createdAt: timestamp('created_at').notNull().defaultNow(),
  },
  (table) => ({
    // Each user acknowledges each version exactly once per workspace.
    workspaceUserVersionIdx: uniqueIndex(
      'ai_disclosures_workspace_user_version_idx'
    ).on(table.workspaceId, table.userId, table.version),
    workspaceIdx: index('ai_disclosures_workspace_idx').on(table.workspaceId),
    userIdx: index('ai_disclosures_user_idx').on(table.userId),
  })
);

export type AiDisclosureAcknowledgement =
  typeof aiDisclosuresAcknowledged.$inferSelect;
export type NewAiDisclosureAcknowledgement =
  typeof aiDisclosuresAcknowledged.$inferInsert;
