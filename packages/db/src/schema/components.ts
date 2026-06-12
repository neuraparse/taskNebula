import {
  pgTable,
  pgEnum,
  text,
  timestamp,
  varchar,
  boolean,
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
 * Project components (Jira-parity structural layer, 2026-06).
 *
 * Components slice a project into areas of ownership (e.g. "API",
 * "Mobile", "Billing"). `default_assignee_type` controls who gets new
 * issues filed against the component when no assignee is chosen:
 *   - project_default  — fall through to the project's normal behavior
 *   - component_lead   — auto-assign to `lead_id`
 *   - unassigned       — leave unassigned
 */
export const componentDefaultAssigneeEnum = pgEnum('component_default_assignee', [
  'project_default',
  'component_lead',
  'unassigned',
]);

export const components = pgTable(
  'components',
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
    leadId: text('lead_id').references(() => users.id, { onDelete: 'set null' }),
    defaultAssigneeType: componentDefaultAssigneeEnum('default_assignee_type')
      .notNull()
      .default('project_default'),
    archived: boolean('archived').notNull().default(false),
    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull().defaultNow(),
  },
  (table) => ({
    projectNameIdx: uniqueIndex('component_project_name_idx').on(table.projectId, table.name),
    orgIdx: index('component_org_idx').on(table.organizationId),
  })
);

/**
 * Many-to-many junction between issues and components.
 * Composite PK (issue_id, component_id); `organization_id` denormalized
 * for tenant scoping.
 */
export const issueComponents = pgTable(
  'issue_components',
  {
    issueId: text('issue_id')
      .notNull()
      .references(() => issues.id, { onDelete: 'cascade' }),
    componentId: text('component_id')
      .notNull()
      .references(() => components.id, { onDelete: 'cascade' }),
    organizationId: text('organization_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' }),
    createdAt: timestamp('created_at').notNull().defaultNow(),
  },
  (table) => ({
    pk: primaryKey({ columns: [table.issueId, table.componentId] }),
    componentIdx: index('issue_component_component_idx').on(table.componentId),
    orgIdx: index('issue_component_org_idx').on(table.organizationId),
  })
);

// Relations
export const componentsRelations = relations(components, ({ one, many }) => ({
  organization: one(organizations, {
    fields: [components.organizationId],
    references: [organizations.id],
  }),
  project: one(projects, {
    fields: [components.projectId],
    references: [projects.id],
  }),
  lead: one(users, {
    fields: [components.leadId],
    references: [users.id],
  }),
  issueComponents: many(issueComponents),
}));

export const issueComponentsRelations = relations(issueComponents, ({ one }) => ({
  issue: one(issues, {
    fields: [issueComponents.issueId],
    references: [issues.id],
  }),
  component: one(components, {
    fields: [issueComponents.componentId],
    references: [components.id],
  }),
}));

export type Component = typeof components.$inferSelect;
export type NewComponent = typeof components.$inferInsert;
export type IssueComponent = typeof issueComponents.$inferSelect;
export type NewIssueComponent = typeof issueComponents.$inferInsert;
