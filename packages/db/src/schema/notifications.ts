import { pgTable, text, timestamp, boolean, pgEnum, index } from 'drizzle-orm/pg-core';
import { createId } from '@paralleldrive/cuid2';
import { users } from './users';
import { issues } from './issues';
import { projects } from './projects';

// Enums
export const notificationTypeEnum = pgEnum('notification_type', [
  'mention',
  'comment',
  'assigned',
  'status_changed',
  'issue_created',
  'issue_updated',
  'issue_linked',
  'sprint_started',
  'sprint_completed',
]);

// Notifications table
export const notifications = pgTable('notifications', {
  id: text('id').$defaultFn(() => createId()).primaryKey(),
  userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  type: notificationTypeEnum('type').notNull(),
  title: text('title').notNull(),
  message: text('message').notNull(),
  issueId: text('issue_id').references(() => issues.id, { onDelete: 'cascade' }),
  projectId: text('project_id').references(() => projects.id, { onDelete: 'cascade' }),
  actorId: text('actor_id').references(() => users.id, { onDelete: 'set null' }),
  isRead: boolean('is_read').notNull().default(false),
  readAt: timestamp('read_at'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
}, (table) => ({
  userIdx: index('notification_user_idx').on(table.userId),
  userReadIdx: index('notification_user_read_idx').on(table.userId, table.isRead),
  issueIdx: index('notification_issue_idx').on(table.issueId),
}));

