/**
 * Issue Security Schemes - Jira-like issue visibility control
 * 
 * Issue security schemes allow you to control who can view specific issues.
 * Security levels can be assigned to issues to restrict visibility.
 */

import { pgTable, text, timestamp, varchar, boolean, integer, index, uniqueIndex } from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';
import { createId } from '@paralleldrive/cuid2';
import { organizations } from './organizations';
import { projects } from './projects';
import { users } from './users';

// Issue Security Schemes table
export const issueSecuritySchemes = pgTable('issue_security_schemes', {
  id: text('id').$defaultFn(() => createId()).primaryKey(),
  organizationId: text('organization_id').notNull().references(() => organizations.id, { onDelete: 'cascade' }),
  name: varchar('name', { length: 255 }).notNull(),
  description: text('description'),
  isDefault: boolean('is_default').notNull().default(false),
  
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
  createdBy: text('created_by').notNull().references(() => users.id),
  updatedBy: text('updated_by').notNull().references(() => users.id),
}, (table) => ({
  orgIdx: index('issue_security_scheme_org_idx').on(table.organizationId),
  orgNameIdx: uniqueIndex('issue_security_scheme_org_name_idx').on(table.organizationId, table.name),
}));

// Issue Security Levels table - Levels within a security scheme
export const issueSecurityLevels = pgTable('issue_security_levels', {
  id: text('id').$defaultFn(() => createId()).primaryKey(),
  schemeId: text('scheme_id').notNull().references(() => issueSecuritySchemes.id, { onDelete: 'cascade' }),
  name: varchar('name', { length: 255 }).notNull(),
  description: text('description'),
  sortOrder: integer('sort_order').notNull().default(0),
  isDefault: boolean('is_default').notNull().default(false), // Default level for new issues
  
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
}, (table) => ({
  schemeIdx: index('issue_security_level_scheme_idx').on(table.schemeId),
  schemeNameIdx: uniqueIndex('issue_security_level_scheme_name_idx').on(table.schemeId, table.name),
  sortIdx: index('issue_security_level_sort_idx').on(table.schemeId, table.sortOrder),
}));

// Issue Security Level Members - Who can see issues at this security level
export const issueSecurityLevelMembers = pgTable('issue_security_level_members', {
  id: text('id').$defaultFn(() => createId()).primaryKey(),
  levelId: text('level_id').notNull().references(() => issueSecurityLevels.id, { onDelete: 'cascade' }),
  
  // Member type: 'user', 'group', 'project_role', 'reporter', 'assignee', 'project_lead', 'anyone'
  memberType: varchar('member_type', { length: 50 }).notNull(),
  memberValue: text('member_value'), // User ID, group ID, role name, etc.
  
  createdAt: timestamp('created_at').notNull().defaultNow(),
}, (table) => ({
  levelIdx: index('issue_security_member_level_idx').on(table.levelId),
  memberIdx: index('issue_security_member_type_idx').on(table.levelId, table.memberType),
}));

// Project Issue Security Scheme Assignment
export const projectSecuritySchemes = pgTable('project_security_schemes', {
  id: text('id').$defaultFn(() => createId()).primaryKey(),
  projectId: text('project_id').notNull().references(() => projects.id, { onDelete: 'cascade' }),
  schemeId: text('scheme_id').notNull().references(() => issueSecuritySchemes.id, { onDelete: 'cascade' }),
  
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
  createdBy: text('created_by').notNull().references(() => users.id),
}, (table) => ({
  projectIdx: uniqueIndex('project_security_scheme_project_idx').on(table.projectId),
  schemeIdx: index('project_security_scheme_scheme_idx').on(table.schemeId),
}));

// Relations
export const issueSecuritySchemesRelations = relations(issueSecuritySchemes, ({ one, many }) => ({
  organization: one(organizations, {
    fields: [issueSecuritySchemes.organizationId],
    references: [organizations.id],
  }),
  levels: many(issueSecurityLevels),
  projectAssignments: many(projectSecuritySchemes),
  creator: one(users, {
    fields: [issueSecuritySchemes.createdBy],
    references: [users.id],
  }),
}));

export const issueSecurityLevelsRelations = relations(issueSecurityLevels, ({ one, many }) => ({
  scheme: one(issueSecuritySchemes, {
    fields: [issueSecurityLevels.schemeId],
    references: [issueSecuritySchemes.id],
  }),
  members: many(issueSecurityLevelMembers),
}));

export const issueSecurityLevelMembersRelations = relations(issueSecurityLevelMembers, ({ one }) => ({
  level: one(issueSecurityLevels, {
    fields: [issueSecurityLevelMembers.levelId],
    references: [issueSecurityLevels.id],
  }),
}));

export const projectSecuritySchemesRelations = relations(projectSecuritySchemes, ({ one }) => ({
  project: one(projects, {
    fields: [projectSecuritySchemes.projectId],
    references: [projects.id],
  }),
  scheme: one(issueSecuritySchemes, {
    fields: [projectSecuritySchemes.schemeId],
    references: [issueSecuritySchemes.id],
  }),
  creator: one(users, {
    fields: [projectSecuritySchemes.createdBy],
    references: [users.id],
  }),
}));

