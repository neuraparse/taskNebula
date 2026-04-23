import { pgTable, text, timestamp, index, uniqueIndex } from 'drizzle-orm/pg-core';
import { createId } from '@paralleldrive/cuid2';
import { users } from './users';

/**
 * Pinned Items - per-user quick-access list shown on the dashboard.
 *
 * Replaces the client-side `tn:pinned-items:v1` localStorage cache so pins
 * sync across devices. `kind` is intentionally broad (issue/doc/project/
 * chat/custom) and `entityId` is optional because some pins (custom URLs)
 * don't reference a real entity row. `href` is unique per user so repeated
 * pins of the same target are idempotent.
 */
export const pinnedItems = pgTable('pinned_items', {
  id: text('id').$defaultFn(() => createId()).primaryKey(),
  userId: text('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),

  // issue | doc | project | chat | custom — kept as plain text so new kinds
  // can be introduced without a schema migration.
  kind: text('kind').notNull(),

  // Foreign entity id when applicable (issue id, document id, project id,
  // chat id). Null for custom external URLs.
  entityId: text('entity_id'),

  title: text('title').notNull(),
  href: text('href').notNull(),

  pinnedAt: timestamp('pinned_at').notNull().defaultNow(),
}, (table) => ({
  userIdx: index('pinned_items_user_idx').on(table.userId),
  userHrefUnique: uniqueIndex('pinned_items_user_href_idx').on(table.userId, table.href),
}));

export type PinnedItem = typeof pinnedItems.$inferSelect;
export type NewPinnedItem = typeof pinnedItems.$inferInsert;
