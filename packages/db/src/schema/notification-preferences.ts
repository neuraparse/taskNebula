import { pgTable, text, timestamp, boolean, pgEnum } from 'drizzle-orm/pg-core';
import { createId } from '@paralleldrive/cuid2';
import { users } from './users';
import { organizations } from './organizations';

/**
 * Notification Channels
 * 
 * - in_app: In-app notifications (notification bell)
 * - email: Email notifications
 * - digest: Digest emails (daily/weekly)
 */

export const notificationChannelEnum = pgEnum('notification_channel', [
  'in_app',
  'email',
  'digest',
]);

/**
 * Digest Frequency
 * 
 * - none: No digest emails
 * - daily: Daily digest at 9 AM
 * - weekly: Weekly digest on Monday at 9 AM
 */

export const digestFrequencyEnum = pgEnum('digest_frequency', [
  'none',
  'daily',
  'weekly',
]);

/**
 * Notification Preferences - User-level notification settings
 * 
 * Features:
 * - Per-organization preferences
 * - Channel-specific settings (in-app, email, digest)
 * - Event-specific toggles
 * - Digest frequency control
 * - Do not disturb mode
 */

export const notificationPreferences = pgTable('notification_preferences', {
  id: text('id')
    .$defaultFn(() => createId())
    .primaryKey(),
  userId: text('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  organizationId: text('organization_id')
    .notNull()
    .references(() => organizations.id, { onDelete: 'cascade' }),

  // Channel settings
  enableInApp: boolean('enable_in_app').notNull().default(true),
  enableEmail: boolean('enable_email').notNull().default(true),
  digestFrequency: digestFrequencyEnum('digest_frequency').notNull().default('none'),

  // Event-specific email settings — default policy: quiet by default.
  // Only events with direct, personal impact (direct assignment, direct mention)
  // are opted-in at creation. Everything else is opt-in by the user.
  emailOnAssigned: boolean('email_on_assigned').notNull().default(true),
  emailOnMentioned: boolean('email_on_mentioned').notNull().default(true),
  emailOnCommented: boolean('email_on_commented').notNull().default(false),
  emailOnStatusChanged: boolean('email_on_status_changed').notNull().default(false),
  emailOnIssueCreated: boolean('email_on_issue_created').notNull().default(false),
  // Sprint & project lifecycle events. These ship ON by default because they're
  // low-frequency, high-signal milestones (e.g. sprint boundaries, project archives).
  emailOnSprintStarted: boolean('email_on_sprint_started').notNull().default(true),
  emailOnSprintCompleted: boolean('email_on_sprint_completed').notNull().default(true),
  emailOnProjectCreated: boolean('email_on_project_created').notNull().default(false),
  emailOnProjectArchived: boolean('email_on_project_archived').notNull().default(false),

  // Event-specific settings (in-app)
  inAppOnAssigned: boolean('in_app_on_assigned').notNull().default(true),
  inAppOnMentioned: boolean('in_app_on_mentioned').notNull().default(true),
  inAppOnCommented: boolean('in_app_on_commented').notNull().default(true),
  inAppOnStatusChanged: boolean('in_app_on_status_changed').notNull().default(true),
  inAppOnIssueCreated: boolean('in_app_on_issue_created').notNull().default(true),
  inAppOnSprintStarted: boolean('in_app_on_sprint_started').notNull().default(true),
  inAppOnSprintCompleted: boolean('in_app_on_sprint_completed').notNull().default(true),
  inAppOnProjectCreated: boolean('in_app_on_project_created').notNull().default(true),
  inAppOnProjectArchived: boolean('in_app_on_project_archived').notNull().default(true),

  // Do not disturb
  doNotDisturb: boolean('do_not_disturb').notNull().default(false),
  doNotDisturbStart: text('do_not_disturb_start'), // Time in HH:MM format (e.g., "22:00")
  doNotDisturbEnd: text('do_not_disturb_end'), // Time in HH:MM format (e.g., "08:00")

  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
});

export type NotificationPreference = typeof notificationPreferences.$inferSelect;
export type NewNotificationPreference = typeof notificationPreferences.$inferInsert;

