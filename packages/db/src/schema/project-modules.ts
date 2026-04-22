import { pgTable, text, timestamp, jsonb, varchar, index } from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';
import { createId } from '@paralleldrive/cuid2';
import { projects } from './projects';
import { users } from './users';

/**
 * Project Modules - feature areas / mini-projects within a project used to
 * group related work. Formerly stored in client localStorage; now persisted
 * server-side so data survives device switches and is shared across teammates.
 *
 * Status values mirror the `ModuleStatus` type in
 * `apps/web/src/lib/modules/use-modules.ts` and are stored as plain text so
 * new statuses can be added without a follow-up enum migration.
 */
export const projectModules = pgTable(
  'project_modules',
  {
    id: text('id').$defaultFn(() => createId()).primaryKey(),
    projectId: text('project_id')
      .notNull()
      .references(() => projects.id, { onDelete: 'cascade' }),
    name: varchar('name', { length: 255 }).notNull(),
    description: text('description'),
    // 'backlog' | 'planned' | 'in_progress' | 'paused' | 'completed' | 'cancelled'
    status: text('status').notNull().default('backlog'),
    ownerId: text('owner_id').references(() => users.id, { onDelete: 'set null' }),
    memberIds: jsonb('member_ids').notNull().default([]),
    targetDate: timestamp('target_date'),
    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull().defaultNow(),
  },
  (table) => ({
    projectIdx: index('project_module_project_idx').on(table.projectId),
  }),
);

export const projectModulesRelations = relations(projectModules, ({ one }) => ({
  project: one(projects, {
    fields: [projectModules.projectId],
    references: [projects.id],
  }),
  owner: one(users, {
    fields: [projectModules.ownerId],
    references: [users.id],
  }),
}));

export type ProjectModuleRow = typeof projectModules.$inferSelect;
export type NewProjectModuleRow = typeof projectModules.$inferInsert;
