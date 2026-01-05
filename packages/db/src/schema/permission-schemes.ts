/**
 * Permission Schemes - Jira-like reusable permission templates
 * 
 * Permission schemes allow you to create a set of permissions that can be
 * applied to multiple projects at once. This makes it easy to manage
 * permissions across your organization.
 */

import { pgTable, text, timestamp, jsonb, varchar, boolean, index, uniqueIndex } from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';
import { createId } from '@paralleldrive/cuid2';
import { organizations } from './organizations';
import { projects } from './projects';
import { users } from './users';

// Permission Schemes table - Reusable permission templates
export const permissionSchemes = pgTable('permission_schemes', {
  id: text('id').$defaultFn(() => createId()).primaryKey(),
  organizationId: text('organization_id').notNull().references(() => organizations.id, { onDelete: 'cascade' }),
  name: varchar('name', { length: 255 }).notNull(),
  description: text('description'),
  isDefault: boolean('is_default').notNull().default(false),
  
  // Store all permissions as JSONB for flexibility
  // Format: { "permission_key": ["role1", "role2", "group:groupId", "user:userId"] }
  permissions: jsonb('permissions').notNull().default('{}'),
  
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
  createdBy: text('created_by').notNull().references(() => users.id),
  updatedBy: text('updated_by').notNull().references(() => users.id),
}, (table) => ({
  orgIdx: index('permission_scheme_org_idx').on(table.organizationId),
  orgNameIdx: uniqueIndex('permission_scheme_org_name_idx').on(table.organizationId, table.name),
  defaultIdx: index('permission_scheme_default_idx').on(table.organizationId, table.isDefault),
}));

// Permission Scheme Grants - Individual permission grants within a scheme
export const permissionSchemeGrants = pgTable('permission_scheme_grants', {
  id: text('id').$defaultFn(() => createId()).primaryKey(),
  schemeId: text('scheme_id').notNull().references(() => permissionSchemes.id, { onDelete: 'cascade' }),
  permissionKey: varchar('permission_key', { length: 100 }).notNull(),
  
  // Grant type: 'role', 'group', 'user', 'project_role', 'reporter', 'assignee', 'project_lead'
  grantType: varchar('grant_type', { length: 50 }).notNull(),
  grantValue: text('grant_value'), // Role name, group ID, user ID, etc.
  
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
}, (table) => ({
  schemeIdx: index('permission_grant_scheme_idx').on(table.schemeId),
  permissionIdx: index('permission_grant_permission_idx').on(table.schemeId, table.permissionKey),
}));

// Project Permission Scheme Assignment - Links projects to permission schemes
export const projectPermissionSchemes = pgTable('project_permission_schemes', {
  id: text('id').$defaultFn(() => createId()).primaryKey(),
  projectId: text('project_id').notNull().references(() => projects.id, { onDelete: 'cascade' }),
  schemeId: text('scheme_id').notNull().references(() => permissionSchemes.id, { onDelete: 'cascade' }),
  
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
  createdBy: text('created_by').notNull().references(() => users.id),
}, (table) => ({
  projectIdx: uniqueIndex('project_permission_scheme_project_idx').on(table.projectId),
  schemeIdx: index('project_permission_scheme_scheme_idx').on(table.schemeId),
}));

// Relations
export const permissionSchemesRelations = relations(permissionSchemes, ({ one, many }) => ({
  organization: one(organizations, {
    fields: [permissionSchemes.organizationId],
    references: [organizations.id],
  }),
  grants: many(permissionSchemeGrants),
  projectAssignments: many(projectPermissionSchemes),
  creator: one(users, {
    fields: [permissionSchemes.createdBy],
    references: [users.id],
  }),
}));

export const permissionSchemeGrantsRelations = relations(permissionSchemeGrants, ({ one }) => ({
  scheme: one(permissionSchemes, {
    fields: [permissionSchemeGrants.schemeId],
    references: [permissionSchemes.id],
  }),
}));

export const projectPermissionSchemesRelations = relations(projectPermissionSchemes, ({ one }) => ({
  project: one(projects, {
    fields: [projectPermissionSchemes.projectId],
    references: [projects.id],
  }),
  scheme: one(permissionSchemes, {
    fields: [projectPermissionSchemes.schemeId],
    references: [permissionSchemes.id],
  }),
  creator: one(users, {
    fields: [projectPermissionSchemes.createdBy],
    references: [users.id],
  }),
}));

