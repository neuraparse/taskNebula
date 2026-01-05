import { pgTable, text, timestamp, pgEnum, index } from 'drizzle-orm/pg-core';
import { createId } from '@paralleldrive/cuid2';
import { projects } from './projects';
import { users } from './users';

// Enums
export const sprintStatusEnum = pgEnum('sprint_status', ['planned', 'active', 'completed']);

// Sprints table
export const sprints = pgTable('sprints', {
  id: text('id').$defaultFn(() => createId()).primaryKey(),
  projectId: text('project_id').notNull().references(() => projects.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  goal: text('goal'),
  startDate: timestamp('start_date').notNull(),
  endDate: timestamp('end_date').notNull(),
  status: sprintStatusEnum('status').notNull().default('planned'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
  createdBy: text('created_by').notNull().references(() => users.id),
  updatedBy: text('updated_by').notNull().references(() => users.id),
}, (table) => ({
  projectIdx: index('sprint_project_idx').on(table.projectId),
  statusIdx: index('sprint_status_idx').on(table.status),
  projectStatusIdx: index('sprint_project_status_idx').on(table.projectId, table.status),
  dateRangeIdx: index('sprint_date_range_idx').on(table.startDate, table.endDate),
}));

