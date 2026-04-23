import { pgTable, text, timestamp, jsonb, index } from 'drizzle-orm/pg-core';
import { createId } from '@paralleldrive/cuid2';
import { users } from './users';
import { organizations } from './organizations';
import { projects } from './projects';

/**
 * Drafts - per-user scratch space for unfinished work items, docs, comments.
 *
 * Replaces the client-only `tn:drafts:v1` localStorage cache so drafts sync
 * across devices. `entityType` is kept as plain text (issue | doc | other)
 * so new promotion targets can be added without a schema migration.
 * `targetProjectId` is optional because drafts can be unclassified until
 * the user promotes them to a real entity in a specific project.
 */
export const drafts = pgTable('drafts', {
  id: text('id').$defaultFn(() => createId()).primaryKey(),
  userId: text('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),

  // Optional org scope — unset for personal-only scratch drafts.
  organizationId: text('organization_id').references(() => organizations.id, {
    onDelete: 'cascade',
  }),

  title: text('title'),
  // Freeform content (markdown / rich text / plain). Nullable so a draft
  // can exist with just a title while the user is still thinking.
  content: text('content'),

  // issue | doc | other — plain text so new kinds don't need a migration.
  entityType: text('entity_type').notNull().default('other'),

  // Intended promotion target. Cleared (not deleted) if the project is
  // removed so the draft survives with the user.
  targetProjectId: text('target_project_id').references(() => projects.id, {
    onDelete: 'set null',
  }),

  metadata: jsonb('metadata').notNull().default('{}'),

  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
}, (table) => ({
  userIdx: index('drafts_user_idx').on(table.userId),
}));

export type DraftRecord = typeof drafts.$inferSelect;
export type NewDraft = typeof drafts.$inferInsert;
