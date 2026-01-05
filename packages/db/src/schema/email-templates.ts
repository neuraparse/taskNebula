import { pgTable, text, timestamp, boolean, pgEnum } from 'drizzle-orm/pg-core';
import { createId } from '@paralleldrive/cuid2';
import { organizations } from './organizations';
import { users } from './users';

/**
 * Email Template Types
 * 
 * Predefined email templates for various notification types:
 * - issue_assigned: When an issue is assigned to a user
 * - issue_mentioned: When a user is mentioned in a comment
 * - issue_commented: When someone comments on a watched issue
 * - issue_status_changed: When an issue status changes
 * - issue_created: When a new issue is created in a watched project
 * - sprint_started: When a sprint starts
 * - sprint_completed: When a sprint completes
 * - daily_digest: Daily summary of activity
 * - weekly_digest: Weekly summary of activity
 */

export const emailTemplateTypeEnum = pgEnum('email_template_type', [
  'issue_assigned',
  'issue_mentioned',
  'issue_commented',
  'issue_status_changed',
  'issue_created',
  'sprint_started',
  'sprint_completed',
  'daily_digest',
  'weekly_digest',
]);

/**
 * Email Templates - Customizable email templates
 * 
 * Features:
 * - Organization-specific templates (or use default)
 * - HTML and plain text versions
 * - Template variables (e.g., {{userName}}, {{issueTitle}})
 * - Active/inactive status
 * - Default templates provided by system
 */

export const emailTemplates = pgTable('email_templates', {
  id: text('id')
    .$defaultFn(() => createId())
    .primaryKey(),
  organizationId: text('organization_id').references(() => organizations.id, { onDelete: 'cascade' }), // null = system default
  type: emailTemplateTypeEnum('type').notNull(),
  name: text('name').notNull(),
  subject: text('subject').notNull(), // Can include variables like {{issueTitle}}
  htmlBody: text('html_body').notNull(), // HTML version
  textBody: text('text_body').notNull(), // Plain text version
  isActive: boolean('is_active').notNull().default(true),
  isDefault: boolean('is_default').notNull().default(false), // System default templates
  createdBy: text('created_by').references(() => users.id, { onDelete: 'set null' }),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
});

export type EmailTemplate = typeof emailTemplates.$inferSelect;
export type NewEmailTemplate = typeof emailTemplates.$inferInsert;

/**
 * Template Variables Reference:
 * 
 * Common variables available in all templates:
 * - {{userName}} - Recipient's name
 * - {{userEmail}} - Recipient's email
 * - {{organizationName}} - Organization name
 * - {{unsubscribeUrl}} - Unsubscribe link
 * 
 * Issue-related templates:
 * - {{issueKey}} - Issue key (e.g., TASK-123)
 * - {{issueTitle}} - Issue title
 * - {{issueDescription}} - Issue description
 * - {{issueUrl}} - Direct link to issue
 * - {{assigneeName}} - Assignee name
 * - {{reporterName}} - Reporter name
 * - {{projectName}} - Project name
 * - {{status}} - Issue status
 * - {{priority}} - Issue priority
 * 
 * Comment-related templates:
 * - {{commentAuthor}} - Comment author name
 * - {{commentBody}} - Comment text
 * - {{commentUrl}} - Direct link to comment
 * 
 * Sprint-related templates:
 * - {{sprintName}} - Sprint name
 * - {{sprintGoal}} - Sprint goal
 * - {{sprintStartDate}} - Sprint start date
 * - {{sprintEndDate}} - Sprint end date
 * - {{issueCount}} - Number of issues in sprint
 * 
 * Digest templates:
 * - {{activityList}} - List of activities
 * - {{issuesSummary}} - Summary of issues
 * - {{period}} - Time period (e.g., "today", "this week")
 */

