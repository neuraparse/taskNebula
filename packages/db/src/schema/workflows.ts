import { pgTable, text, timestamp, jsonb, varchar, boolean, integer, pgEnum } from 'drizzle-orm/pg-core';
import { createId } from '@paralleldrive/cuid2';
import { organizations } from './organizations';
import { users } from './users';
import { projects } from './projects';

// Enums
export const workflowStatusCategoryEnum = pgEnum('workflow_status_category', [
  'backlog',
  'in_progress',
  'in_review',
  'done',
  'blocked',
]);

// Workflows table
export const workflows = pgTable('workflows', {
  id: text('id').$defaultFn(() => createId()).primaryKey(),
  organizationId: text('organization_id').notNull().references(() => organizations.id, { onDelete: 'cascade' }),
  name: varchar('name', { length: 255 }).notNull(),
  description: text('description'),
  isDefault: boolean('is_default').notNull().default(false),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
  createdBy: text('created_by').notNull().references(() => users.id),
  updatedBy: text('updated_by').notNull().references(() => users.id),
});

// Workflow Statuses table
export const workflowStatuses = pgTable('workflow_statuses', {
  id: text('id').$defaultFn(() => createId()).primaryKey(),
  workflowId: text('workflow_id').notNull().references(() => workflows.id, { onDelete: 'cascade' }),
  name: varchar('name', { length: 100 }).notNull(),
  category: workflowStatusCategoryEnum('category').notNull(),
  color: varchar('color', { length: 20 }).notNull(),
  position: integer('position').notNull(),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
});

// Workflow Transitions table
export const workflowTransitions = pgTable('workflow_transitions', {
  id: text('id').$defaultFn(() => createId()).primaryKey(),
  workflowId: text('workflow_id').notNull().references(() => workflows.id, { onDelete: 'cascade' }),
  name: varchar('name', { length: 255 }).notNull(),
  fromStatusId: text('from_status_id').notNull().references(() => workflowStatuses.id, { onDelete: 'cascade' }),
  toStatusId: text('to_status_id').notNull().references(() => workflowStatuses.id, { onDelete: 'cascade' }),
  conditions: jsonb('conditions').default('[]'),
  validators: jsonb('validators').default('[]'),
  postActions: jsonb('post_actions').default('[]'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
});

// Automation Rules table
export const automationRules = pgTable('automation_rules', {
  id: text('id').$defaultFn(() => createId()).primaryKey(),
  organizationId: text('organization_id').notNull().references(() => organizations.id, { onDelete: 'cascade' }),
  projectId: text('project_id').references(() => projects.id, { onDelete: 'cascade' }),
  name: varchar('name', { length: 255 }).notNull(),
  description: text('description'),
  enabled: boolean('enabled').notNull().default(true),
  trigger: jsonb('trigger').notNull(),
  conditions: jsonb('conditions').notNull().default('[]'),
  actions: jsonb('actions').notNull().default('[]'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
  createdBy: text('created_by').notNull().references(() => users.id),
  updatedBy: text('updated_by').notNull().references(() => users.id),
});

