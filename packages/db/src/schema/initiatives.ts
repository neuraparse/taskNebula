import {
  pgTable,
  text,
  timestamp,
  date,
  integer,
  pgEnum,
  index,
  uniqueIndex,
  primaryKey,
} from 'drizzle-orm/pg-core';
import type { AnyPgColumn } from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';
import { createId } from '@paralleldrive/cuid2';
import { organizations } from './organizations';
import { users } from './users';
import { projects } from './projects';

/**
 * Initiatives sit ABOVE projects in the planning hierarchy. They can nest
 * (sub-initiatives, "programs of work") up to 5 levels deep — the depth limit
 * is enforced in the application layer because Postgres recursive CTE depth
 * checks aren't a clean fit for an INSERT/UPDATE trigger flow.
 *
 * One initiative belongs to a single workspace (organization). Many projects
 * can be linked to a single initiative via the `initiative_projects` join
 * table, and a single project can roll up into multiple initiatives if a
 * workspace wants to slice the same work two different ways (e.g. by
 * customer + by quarter).
 */
export const initiativeStatusEnum = pgEnum('initiative_status', [
  'planned',
  'active',
  'paused',
  'complete',
  'cancelled',
]);

export const initiatives = pgTable(
  'initiatives',
  {
    id: text('id')
      .$defaultFn(() => createId())
      .primaryKey(),

    // "Workspace" in roadmap parlance maps to our organization concept.
    workspaceId: text('workspace_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' }),

    // Self-reference for sub-initiatives. App layer caps depth at 5.
    parentInitiativeId: text('parent_initiative_id').references((): AnyPgColumn => initiatives.id, {
      onDelete: 'cascade',
    }),

    name: text('name').notNull(),
    slug: text('slug').notNull(),
    description: text('description'),
    status: initiativeStatusEnum('status').notNull().default('planned'),

    ownerUserId: text('owner_user_id').references(() => users.id, {
      onDelete: 'set null',
    }),
    targetDate: date('target_date'),
    color: text('color'),
    sortOrder: integer('sort_order').notNull().default(0),

    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull().defaultNow(),
    createdBy: text('created_by').references(() => users.id, {
      onDelete: 'set null',
    }),
    updatedBy: text('updated_by').references(() => users.id, {
      onDelete: 'set null',
    }),
  },
  (table) => ({
    // Unique slug within a workspace — keeps URLs predictable.
    workspaceSlugIdx: uniqueIndex('initiative_workspace_slug_idx').on(
      table.workspaceId,
      table.slug
    ),
    workspaceIdx: index('initiative_workspace_idx').on(table.workspaceId),
    parentIdx: index('initiative_parent_idx').on(table.parentInitiativeId),
    statusIdx: index('initiative_status_idx').on(table.status),
  })
);

/**
 * Many-to-many junction between initiatives and projects.
 * Composite PK on (initiative_id, project_id) — a project can't be linked
 * to the same initiative twice.
 */
export const initiativeProjects = pgTable(
  'initiative_projects',
  {
    initiativeId: text('initiative_id')
      .notNull()
      .references(() => initiatives.id, { onDelete: 'cascade' }),
    projectId: text('project_id')
      .notNull()
      .references(() => projects.id, { onDelete: 'cascade' }),
    createdAt: timestamp('created_at').notNull().defaultNow(),
  },
  (table) => ({
    pk: primaryKey({ columns: [table.initiativeId, table.projectId] }),
    projectIdx: index('initiative_projects_project_idx').on(table.projectId),
  })
);

/**
 * Weekly status posts attached to an initiative ("RAG-style" updates).
 * `status` is a free-text traffic light (`'green' | 'yellow' | 'red'` or
 * whatever convention the workspace prefers) — intentionally not enumerated
 * so workspaces can adopt their own vocabulary without a migration.
 */
export const initiativeUpdates = pgTable(
  'initiative_updates',
  {
    id: text('id')
      .$defaultFn(() => createId())
      .primaryKey(),
    initiativeId: text('initiative_id')
      .notNull()
      .references(() => initiatives.id, { onDelete: 'cascade' }),
    authorId: text('author_id').references(() => users.id, {
      onDelete: 'set null',
    }),
    status: text('status').notNull(),
    summary: text('summary').notNull(),
    blockers: text('blockers'),
    nextSteps: text('next_steps'),
    weekOf: date('week_of').notNull(),
    createdAt: timestamp('created_at').notNull().defaultNow(),
  },
  (table) => ({
    initiativeIdx: index('initiative_updates_initiative_idx').on(table.initiativeId),
    weekIdx: index('initiative_updates_week_idx').on(table.weekOf),
  })
);

// Relations
export const initiativesRelations = relations(initiatives, ({ one, many }) => ({
  workspace: one(organizations, {
    fields: [initiatives.workspaceId],
    references: [organizations.id],
  }),
  parent: one(initiatives, {
    fields: [initiatives.parentInitiativeId],
    references: [initiatives.id],
    relationName: 'initiative_parent_children',
  }),
  children: many(initiatives, { relationName: 'initiative_parent_children' }),
  owner: one(users, {
    fields: [initiatives.ownerUserId],
    references: [users.id],
  }),
  projects: many(initiativeProjects),
  updates: many(initiativeUpdates),
}));

export const initiativeProjectsRelations = relations(initiativeProjects, ({ one }) => ({
  initiative: one(initiatives, {
    fields: [initiativeProjects.initiativeId],
    references: [initiatives.id],
  }),
  project: one(projects, {
    fields: [initiativeProjects.projectId],
    references: [projects.id],
  }),
}));

export const initiativeUpdatesRelations = relations(initiativeUpdates, ({ one }) => ({
  initiative: one(initiatives, {
    fields: [initiativeUpdates.initiativeId],
    references: [initiatives.id],
  }),
  author: one(users, {
    fields: [initiativeUpdates.authorId],
    references: [users.id],
  }),
}));

export type Initiative = typeof initiatives.$inferSelect;
export type NewInitiative = typeof initiatives.$inferInsert;
export type InitiativeProject = typeof initiativeProjects.$inferSelect;
export type InitiativeUpdate = typeof initiativeUpdates.$inferSelect;
export type NewInitiativeUpdate = typeof initiativeUpdates.$inferInsert;

/**
 * Maximum nesting depth for sub-initiatives. Enforced in the API layer
 * (see /api/initiatives POST/PATCH handlers) and in
 * `validateInitiativeDepth` in apps/web/src/lib/initiatives/depth.ts.
 */
export const MAX_INITIATIVE_DEPTH = 5;
