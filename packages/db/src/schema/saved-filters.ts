import { pgTable, text, timestamp, boolean, jsonb, index } from 'drizzle-orm/pg-core';
import { createId } from '@paralleldrive/cuid2';
import { users } from './users';
import { organizations } from './organizations';
import { projects } from './projects';

/**
 * Saved Filters Table
 * 
 * Stores user-created filters for quick access to commonly used searches.
 * Filters can be organization-wide or project-specific.
 * Supports sharing filters with team members.
 */
export const savedFilters = pgTable('saved_filters', {
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
  
  // Filter details
  name: text('name').notNull(),
  description: text('description'),
  
  // JQL query string (e.g., "assignee = me AND status = 'In Progress'")
  query: text('query').notNull(),
  
  // Parsed filter criteria stored as JSON for quick access
  // Example: { "assignee": "current_user", "status": ["in_progress"], "priority": ["high", "urgent"] }
  criteria: jsonb('criteria').notNull(),
  
  // Sharing settings
  isPublic: boolean('is_public').notNull().default(false), // Visible to all org members
  isStarred: boolean('is_starred').notNull().default(false), // User's favorite
  
  // Display settings
  viewType: text('view_type').notNull().default('list'), // list, board, timeline
  sortBy: text('sort_by').default('created_at'),
  sortOrder: text('sort_order').default('desc'), // asc, desc
  
  // Metadata
  usageCount: text('usage_count').notNull().default('0'), // Track how often used
  lastUsedAt: timestamp('last_used_at'),
  
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
}, (table) => ({
  userIdx: index('saved_filter_user_idx').on(table.userId),
  organizationIdx: index('saved_filter_organization_idx').on(table.organizationId),
  projectIdx: index('saved_filter_project_idx').on(table.projectId),
  publicIdx: index('saved_filter_public_idx').on(table.isPublic),
  starredIdx: index('saved_filter_starred_idx').on(table.isStarred),
  userStarredIdx: index('saved_filter_user_starred_idx').on(table.userId, table.isStarred),
  orgPublicIdx: index('saved_filter_org_public_idx').on(table.organizationId, table.isPublic),
}));

export type SavedFilter = typeof savedFilters.$inferSelect;
export type NewSavedFilter = typeof savedFilters.$inferInsert;

