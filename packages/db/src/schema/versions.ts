import {
  pgTable,
  pgEnum,
  text,
  timestamp,
  varchar,
  integer,
  index,
  uniqueIndex,
  primaryKey,
} from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';
import { createId } from '@paralleldrive/cuid2';
import { organizations } from './organizations';
import { projects } from './projects';
import { users } from './users';
import { issues } from './issues';

/**
 * Project versions / releases (Jira-parity structural layer, 2026-06).
 *
 * Jira-style "Fix Version" / "Affects Version" support. A version belongs
 * to exactly one project; issues link to versions through the two junction
 * tables below (an issue can have many fix versions and many affects
 * versions, and vice versa).
 */
export const versionStatusEnum = pgEnum('version_status', ['unreleased', 'released', 'archived']);

export const projectVersions = pgTable(
  'project_versions',
  {
    id: text('id')
      .$defaultFn(() => createId())
      .primaryKey(),
    organizationId: text('organization_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' }),
    projectId: text('project_id')
      .notNull()
      .references(() => projects.id, { onDelete: 'cascade' }),
    name: varchar('name', { length: 120 }).notNull(),
    description: text('description'),
    status: versionStatusEnum('status').notNull().default('unreleased'),
    startDate: timestamp('start_date'),
    // Planned release date (editable target).
    releaseDate: timestamp('release_date'),
    // Actual moment the version was marked released.
    releasedAt: timestamp('released_at'),
    sortOrder: integer('sort_order').notNull().default(0),
    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull().defaultNow(),
    createdBy: text('created_by').references(() => users.id, { onDelete: 'set null' }),
  },
  (table) => ({
    projectNameIdx: uniqueIndex('project_version_project_name_idx').on(table.projectId, table.name),
    orgIdx: index('project_version_org_idx').on(table.organizationId),
    projectStatusIdx: index('project_version_project_status_idx').on(table.projectId, table.status),
  })
);

/** Issues fixed/delivered in a version ("Fix Version/s" in Jira). */
export const issueFixVersions = pgTable(
  'issue_fix_versions',
  {
    issueId: text('issue_id')
      .notNull()
      .references(() => issues.id, { onDelete: 'cascade' }),
    versionId: text('version_id')
      .notNull()
      .references(() => projectVersions.id, { onDelete: 'cascade' }),
    organizationId: text('organization_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' }),
    createdAt: timestamp('created_at').notNull().defaultNow(),
  },
  (table) => ({
    pk: primaryKey({ columns: [table.issueId, table.versionId] }),
    versionIdx: index('issue_fix_version_version_idx').on(table.versionId),
    orgIdx: index('issue_fix_version_org_idx').on(table.organizationId),
  })
);

/** Versions in which a bug was observed ("Affects Version/s" in Jira). */
export const issueAffectsVersions = pgTable(
  'issue_affects_versions',
  {
    issueId: text('issue_id')
      .notNull()
      .references(() => issues.id, { onDelete: 'cascade' }),
    versionId: text('version_id')
      .notNull()
      .references(() => projectVersions.id, { onDelete: 'cascade' }),
    organizationId: text('organization_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' }),
    createdAt: timestamp('created_at').notNull().defaultNow(),
  },
  (table) => ({
    pk: primaryKey({ columns: [table.issueId, table.versionId] }),
    versionIdx: index('issue_affects_version_version_idx').on(table.versionId),
    orgIdx: index('issue_affects_version_org_idx').on(table.organizationId),
  })
);

// Relations
export const projectVersionsRelations = relations(projectVersions, ({ one, many }) => ({
  organization: one(organizations, {
    fields: [projectVersions.organizationId],
    references: [organizations.id],
  }),
  project: one(projects, {
    fields: [projectVersions.projectId],
    references: [projects.id],
  }),
  creator: one(users, {
    fields: [projectVersions.createdBy],
    references: [users.id],
  }),
  fixIssues: many(issueFixVersions),
  affectsIssues: many(issueAffectsVersions),
}));

export const issueFixVersionsRelations = relations(issueFixVersions, ({ one }) => ({
  issue: one(issues, {
    fields: [issueFixVersions.issueId],
    references: [issues.id],
  }),
  version: one(projectVersions, {
    fields: [issueFixVersions.versionId],
    references: [projectVersions.id],
  }),
}));

export const issueAffectsVersionsRelations = relations(issueAffectsVersions, ({ one }) => ({
  issue: one(issues, {
    fields: [issueAffectsVersions.issueId],
    references: [issues.id],
  }),
  version: one(projectVersions, {
    fields: [issueAffectsVersions.versionId],
    references: [projectVersions.id],
  }),
}));

export type ProjectVersion = typeof projectVersions.$inferSelect;
export type NewProjectVersion = typeof projectVersions.$inferInsert;
export type IssueFixVersion = typeof issueFixVersions.$inferSelect;
export type IssueAffectsVersion = typeof issueAffectsVersions.$inferSelect;
