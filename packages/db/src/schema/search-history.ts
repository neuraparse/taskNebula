import { pgTable, text, timestamp, jsonb, index } from 'drizzle-orm/pg-core';
import { createId } from '@paralleldrive/cuid2';
import { users } from './users';
import { organizations } from './organizations';
import { projects } from './projects';

/**
 * Search History Table
 * 
 * Stores recent searches for quick access and autocomplete suggestions.
 * Automatically cleaned up after 30 days.
 */
export const searchHistory = pgTable('search_history', {
  id: text('id').$defaultFn(() => createId()).primaryKey(),
  
  // Ownership
  userId: text('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  organizationId: text('organization_id')
    .notNull()
    .references(() => organizations.id, { onDelete: 'cascade' }),
  projectId: text('project_id')
    .references(() => projects.id, { onDelete: 'cascade' }),
  
  // Search details
  query: text('query').notNull(), // JQL query string
  
  // Parsed criteria for analytics
  criteria: jsonb('criteria').notNull(),
  
  // Results metadata
  resultCount: text('result_count').notNull().default('0'),
  
  // Timestamps
  createdAt: timestamp('created_at').notNull().defaultNow(),
}, (table) => ({
  userIdx: index('search_history_user_idx').on(table.userId),
  organizationIdx: index('search_history_organization_idx').on(table.organizationId),
  projectIdx: index('search_history_project_idx').on(table.projectId),
  createdAtIdx: index('search_history_created_at_idx').on(table.createdAt),
  userCreatedAtIdx: index('search_history_user_created_at_idx').on(table.userId, table.createdAt),
}));

export type SearchHistory = typeof searchHistory.$inferSelect;
export type NewSearchHistory = typeof searchHistory.$inferInsert;

