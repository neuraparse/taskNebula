import {
  pgTable,
  text,
  timestamp,
  varchar,
  index,
  uniqueIndex,
  primaryKey,
} from 'drizzle-orm/pg-core';
import { relations, sql } from 'drizzle-orm';
import { createId } from '@paralleldrive/cuid2';
import { organizations } from './organizations';
import { projects } from './projects';
import { users } from './users';
import { issues } from './issues';

/**
 * First-class labels (Jira-parity structural layer, 2026-06).
 *
 * Replaces the legacy `issues.labels` jsonb string array as the source of
 * truth. A label belongs to an organization; `project_id` is NULLABLE —
 * NULL means the label is org-wide, non-NULL scopes it to one project.
 *
 * Uniqueness is (organization_id, COALESCE(project_id, ''), name) so an
 * org-wide label and a project-scoped label with the same name cannot
 * collide ambiguously. The COALESCE expression index is hand-written in
 * migration 0054 (drizzle-kit generate is not used in this repo).
 */
export const labels = pgTable(
  'labels',
  {
    id: text('id')
      .$defaultFn(() => createId())
      .primaryKey(),
    organizationId: text('organization_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' }),
    // NULL = org-wide label, available to every project in the org.
    projectId: text('project_id').references(() => projects.id, { onDelete: 'cascade' }),
    name: varchar('name', { length: 100 }).notNull(),
    color: varchar('color', { length: 20 }).notNull().default('#6B7280'),
    description: text('description'),
    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull().defaultNow(),
    createdBy: text('created_by').references(() => users.id, { onDelete: 'set null' }),
  },
  (table) => ({
    // Mirrors: CREATE UNIQUE INDEX label_org_project_name_idx
    //   ON labels (organization_id, COALESCE(project_id, ''), name);
    // Documentation only — the authoritative DDL lives in
    // drizzle/0054_jira_parity_layer.sql (drizzle-kit generate is frozen at
    // 0012, so this expression index is never auto-emitted).
    orgProjectNameIdx: uniqueIndex('label_org_project_name_idx').on(
      table.organizationId,
      sql`COALESCE(${table.projectId}, '')`,
      table.name
    ),
    orgIdx: index('label_org_idx').on(table.organizationId),
    projectIdx: index('label_project_idx').on(table.projectId),
  })
);

/**
 * Many-to-many junction between issues and labels.
 * Composite PK (issue_id, label_id); `organization_id` is denormalized for
 * tenant scoping per the multi-tenancy rule.
 */
export const issueLabels = pgTable(
  'issue_labels',
  {
    issueId: text('issue_id')
      .notNull()
      .references(() => issues.id, { onDelete: 'cascade' }),
    labelId: text('label_id')
      .notNull()
      .references(() => labels.id, { onDelete: 'cascade' }),
    organizationId: text('organization_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' }),
    createdAt: timestamp('created_at').notNull().defaultNow(),
  },
  (table) => ({
    pk: primaryKey({ columns: [table.issueId, table.labelId] }),
    labelIdx: index('issue_label_label_idx').on(table.labelId),
    orgIdx: index('issue_label_org_idx').on(table.organizationId),
  })
);

// Relations
export const labelsRelations = relations(labels, ({ one, many }) => ({
  organization: one(organizations, {
    fields: [labels.organizationId],
    references: [organizations.id],
  }),
  project: one(projects, {
    fields: [labels.projectId],
    references: [projects.id],
  }),
  creator: one(users, {
    fields: [labels.createdBy],
    references: [users.id],
  }),
  issueLabels: many(issueLabels),
}));

export const issueLabelsRelations = relations(issueLabels, ({ one }) => ({
  issue: one(issues, {
    fields: [issueLabels.issueId],
    references: [issues.id],
  }),
  label: one(labels, {
    fields: [issueLabels.labelId],
    references: [labels.id],
  }),
}));

export type Label = typeof labels.$inferSelect;
export type NewLabel = typeof labels.$inferInsert;
export type IssueLabel = typeof issueLabels.$inferSelect;
export type NewIssueLabel = typeof issueLabels.$inferInsert;
