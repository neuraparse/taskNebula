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
  'ai_draft_failed',
  'agent_run_failed',
  'project_created',
  'project_archived',
]);

// Source of the notification — used for inbox filter chips so a user can
// quickly carve out "only human pings" vs. "agent activity" vs. "system
// noise". Webhook actors come from third-party integrations (GitHub, Sentry,
// etc.) and are surfaced separately so they can be aged out aggressively.
export const notificationActorTypeEnum = pgEnum('notification_actor_type', [
  'user',
  'agent',
  'webhook',
  'system',
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
  // The kind of actor that triggered the notification — distinct from the
  // user FK above which only covers human/agent identities backed by a user
  // row. Webhook + system notifications have no actor row.
  actorType: notificationActorTypeEnum('actor_type').notNull().default('user'),
  isRead: boolean('is_read').notNull().default(false),
  readAt: timestamp('read_at'),
  // When set in the future, the row is filtered out of the inbox until the
  // time elapses. Cleared (and treated as a no-op) once now() >= value, so
  // we don't strictly need a re-emergence cron, but a janitor task may null
  // expired values for cleanliness.
  snoozedUntil: timestamp('snoozed_until', { withTimezone: true }),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
}, (table) => ({
  userIdx: index('notification_user_idx').on(table.userId),
  userReadIdx: index('notification_user_read_idx').on(table.userId, table.isRead),
  issueIdx: index('notification_issue_idx').on(table.issueId),
  userSnoozedIdx: index('notification_user_snoozed_idx').on(table.userId, table.snoozedUntil),
  userActorTypeIdx: index('notification_user_actor_type_idx').on(table.userId, table.actorType),
}));
