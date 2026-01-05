import { pgTable, text, timestamp, unique, index } from 'drizzle-orm/pg-core';
import { createId } from '@paralleldrive/cuid2';
import { users } from './users';
import { issues } from './issues';
import { projects } from './projects';

/**
 * Watchers - Users who subscribe to issue updates
 * 
 * Features:
 * - Watch specific issues to receive notifications
 * - Watch entire projects to receive all issue notifications
 * - Unique constraint to prevent duplicate watches
 * - Cascade delete when user, issue, or project is deleted
 */

export const watchers = pgTable(
  'watchers',
  {
    id: text('id')
      .$defaultFn(() => createId())
      .primaryKey(),
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    issueId: text('issue_id').references(() => issues.id, { onDelete: 'cascade' }),
    projectId: text('project_id').references(() => projects.id, { onDelete: 'cascade' }),
    createdAt: timestamp('created_at').notNull().defaultNow(),
  },
  (table) => ({
    // Unique constraint: user can only watch an issue or project once
    uniqueIssueWatch: unique('unique_issue_watch').on(table.userId, table.issueId),
    uniqueProjectWatch: unique('unique_project_watch').on(table.userId, table.projectId),
    // Indexes for efficient querying
    userIdx: index('watcher_user_idx').on(table.userId),
    issueIdx: index('watcher_issue_idx').on(table.issueId),
    projectIdx: index('watcher_project_idx').on(table.projectId),
  })
);

export type Watcher = typeof watchers.$inferSelect;
export type NewWatcher = typeof watchers.$inferInsert;

