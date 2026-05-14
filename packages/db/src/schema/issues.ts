import { pgTable, text, timestamp, jsonb, varchar, integer, numeric, pgEnum, index, uniqueIndex } from 'drizzle-orm/pg-core';
import { createId } from '@paralleldrive/cuid2';
import { organizations } from './organizations';
import { projects } from './projects';
import { users } from './users';
import { sprints } from './sprints';
import { workflowStatuses } from './workflows';
import { issueSecurityLevels } from './issue-security';

// Enums
export const issueTypeEnum = pgEnum('issue_type', ['story', 'task', 'bug', 'epic', 'subtask']);
export const issuePriorityEnum = pgEnum('issue_priority', ['critical', 'high', 'medium', 'low', 'none']);
export const issueActivityTypeEnum = pgEnum('issue_activity_type', [
  'created',
  'updated',
  'status_changed',
  'assigned',
  'commented',
  'linked',
  'mentioned',
]);
export const issueLinkTypeEnum = pgEnum('issue_link_type', [
  'blocks',
  'blocked_by',
  'relates_to',
  'duplicates',
  'duplicated_by',
  'parent_of',
  'child_of',
]);

// Issues table
export const issues: any = pgTable('issues', {
  id: text('id').$defaultFn(() => createId()).primaryKey(),
  organizationId: text('organization_id').notNull().references(() => organizations.id, { onDelete: 'cascade' }),
  projectId: text('project_id').notNull().references(() => projects.id, { onDelete: 'cascade' }),
  key: varchar('key', { length: 50 }).notNull(), // e.g., "TASK-123"
  number: integer('number').notNull(), // Sequential within project
  type: issueTypeEnum('type').notNull(),
  title: varchar('title', { length: 500 }).notNull(),
  description: text('description'),
  statusId: text('status_id').notNull().references(() => workflowStatuses.id),
  priority: issuePriorityEnum('priority').notNull().default('medium'),
  assigneeId: text('assignee_id').references(() => users.id, { onDelete: 'set null' }),
  reporterId: text('reporter_id').notNull().references(() => users.id),
  labels: jsonb('labels').notNull().default('[]'), // Array of strings
  sprintId: text('sprint_id').references(() => sprints.id, { onDelete: 'set null' }),
  epicId: text('epic_id').references((): any => issues.id, { onDelete: 'set null' }),
  parentId: text('parent_id').references((): any => issues.id, { onDelete: 'set null' }),
  securityLevelId: text('security_level_id').references(() => issueSecurityLevels.id, { onDelete: 'set null' }),
  estimate: integer('estimate'),
  // Native time-tracking (task #10). estimate_hours / actual_hours are user-facing hour totals.
  // story_points keeps the agile points number separate from hours; estimate_source records
  // how estimate_hours was set (manual entry, AI suggestion, or computed from story_points).
  estimateHours: numeric('estimate_hours', { precision: 8, scale: 2 }),
  actualHours: numeric('actual_hours', { precision: 8, scale: 2 }).default('0'),
  estimateSource: text('estimate_source'), // 'manual' | 'ai_suggest' | 'story_points'
  storyPoints: integer('story_points'),
  dueDate: timestamp('due_date'),
  customFields: jsonb('custom_fields').notNull().default('{}'),
  metadata: jsonb('metadata').notNull().default('{}'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
  createdBy: text('created_by').notNull().references(() => users.id),
  updatedBy: text('updated_by').notNull().references(() => users.id),
}, (table) => ({
  keyIdx: uniqueIndex('issue_key_idx').on(table.key),
  projectNumberIdx: uniqueIndex('issue_project_number_idx').on(table.projectId, table.number),
  projectIdx: index('issue_project_idx').on(table.projectId),
  assigneeIdx: index('issue_assignee_idx').on(table.assigneeId),
  statusIdx: index('issue_status_idx').on(table.statusId),
  sprintIdx: index('issue_sprint_idx').on(table.sprintId),
  reporterIdx: index('issue_reporter_idx').on(table.reporterId),
  priorityIdx: index('issue_priority_idx').on(table.priority),
  typeIdx: index('issue_type_idx').on(table.type),
  createdAtIdx: index('issue_created_at_idx').on(table.createdAt),
  updatedAtIdx: index('issue_updated_at_idx').on(table.updatedAt),
  // Composite indexes for common queries
  projectStatusIdx: index('issue_project_status_idx').on(table.projectId, table.statusId),
  projectSprintIdx: index('issue_project_sprint_idx').on(table.projectId, table.sprintId),
  projectAssigneeIdx: index('issue_project_assignee_idx').on(table.projectId, table.assigneeId),
}));

// Issue Comments table
export const issueComments: any = pgTable('issue_comments', {
  id: text('id').$defaultFn(() => createId()).primaryKey(),
  issueId: text('issue_id').notNull().references(() => issues.id, { onDelete: 'cascade' }),
  parentId: text('parent_id').references((): any => issueComments.id, { onDelete: 'cascade' }),
  content: text('content').notNull(),
  mentions: jsonb('mentions').notNull().default('[]'), // Array of user IDs
  reactions: jsonb('reactions').notNull().default('[]'),
  isInternal: text('is_internal').notNull().default('false'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
  createdBy: text('created_by').notNull().references(() => users.id),
  updatedBy: text('updated_by').notNull().references(() => users.id),
}, (table) => ({
  issueIdx: index('comment_issue_idx').on(table.issueId),
  createdAtIdx: index('comment_created_at_idx').on(table.createdAt),
  issueCreatedAtIdx: index('comment_issue_created_at_idx').on(table.issueId, table.createdAt),
}));

// Issue Activity table
export const issueActivities = pgTable('issue_activities', {
  id: text('id').$defaultFn(() => createId()).primaryKey(),
  issueId: text('issue_id').notNull().references(() => issues.id, { onDelete: 'cascade' }),
  userId: text('user_id').notNull().references(() => users.id),
  type: issueActivityTypeEnum('type').notNull(),
  field: varchar('field', { length: 100 }),
  oldValue: text('old_value'),
  newValue: text('new_value'),
  metadata: jsonb('metadata').default('{}'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
  createdBy: text('created_by').notNull().references(() => users.id),
  updatedBy: text('updated_by').notNull().references(() => users.id),
}, (table) => ({
  issueIdx: index('activity_issue_idx').on(table.issueId),
  userIdx: index('activity_user_idx').on(table.userId),
  typeIdx: index('activity_type_idx').on(table.type),
  createdAtIdx: index('activity_created_at_idx').on(table.createdAt),
  issueCreatedAtIdx: index('activity_issue_created_at_idx').on(table.issueId, table.createdAt),
}));

// Issue Links table
export const issueLinks = pgTable('issue_links', {
  id: text('id').$defaultFn(() => createId()).primaryKey(),
  sourceIssueId: text('source_issue_id').notNull().references(() => issues.id, { onDelete: 'cascade' }),
  targetIssueId: text('target_issue_id').notNull().references(() => issues.id, { onDelete: 'cascade' }),
  type: issueLinkTypeEnum('type').notNull(),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
  createdBy: text('created_by').notNull().references(() => users.id),
  updatedBy: text('updated_by').notNull().references(() => users.id),
}, (table) => ({
  sourceIdx: index('link_source_idx').on(table.sourceIssueId),
  targetIdx: index('link_target_idx').on(table.targetIssueId),
}));

// Issue Attachments table
export const issueAttachments = pgTable('issue_attachments', {
  id: text('id').$defaultFn(() => createId()).primaryKey(),
  issueId: text('issue_id').notNull().references(() => issues.id, { onDelete: 'cascade' }),
  fileName: varchar('file_name', { length: 255 }).notNull(),
  fileSize: integer('file_size').notNull(),
  mimeType: varchar('mime_type', { length: 100 }).notNull(),
  url: text('url').notNull(),
  thumbnailUrl: text('thumbnail_url'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
  createdBy: text('created_by').notNull().references(() => users.id),
  updatedBy: text('updated_by').notNull().references(() => users.id),
}, (table) => ({
  issueIdx: index('attachment_issue_idx').on(table.issueId),
}));

