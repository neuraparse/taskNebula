import {
  pgTable,
  text,
  timestamp,
  jsonb,
  varchar,
  pgEnum,
  uniqueIndex,
  index,
  integer,
} from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';
import { createId } from '@paralleldrive/cuid2';
import { organizations } from './organizations';
import { teams } from './organizations';
import { users } from './users';

// Enums
export const projectVisibilityEnum = pgEnum('project_visibility', [
  'private',
  'internal',
  'public',
]);
export const projectStatusEnum = pgEnum('project_status', ['active', 'archived', 'on_hold']);

// Project Role Enum - Scrum/Agile roles
export const projectRoleEnum = pgEnum('project_role', [
  'product_owner', // Can manage backlog, priorities, accept/reject work
  'scrum_master', // Can manage sprints, team, remove impediments
  'tech_lead', // Can assign tasks, review code, technical decisions
  'developer', // Can work on tasks, update status, comment
  'qa_engineer', // Can create bugs, verify fixes, test
  'designer', // Can create design tasks, attach designs
  'viewer', // Read-only access
]);

// Projects table
export const projects = pgTable(
  'projects',
  {
    id: text('id')
      .$defaultFn(() => createId())
      .primaryKey(),
    organizationId: text('organization_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' }),
    teamId: text('team_id').references(() => teams.id, { onDelete: 'set null' }),
    key: varchar('key', { length: 20 }).notNull(), // e.g., "TASK", "PROJ"
    name: varchar('name', { length: 255 }).notNull(),
    description: text('description'),
    iconUrl: text('icon_url'),
    leadId: text('lead_id').references(() => users.id, { onDelete: 'set null' }),
    defaultWorkflowId: text('default_workflow_id'), // References workflows.id
    visibility: projectVisibilityEnum('visibility').notNull().default('internal'),
    status: projectStatusEnum('status').notNull().default('active'),
    settings: jsonb('settings').notNull().default('{}'),
    startDate: timestamp('start_date'),
    targetDate: timestamp('target_date'),
    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull().defaultNow(),
    createdBy: text('created_by')
      .notNull()
      .references(() => users.id),
    updatedBy: text('updated_by')
      .notNull()
      .references(() => users.id),
  },
  (table) => ({
    orgKeyIdx: uniqueIndex('project_org_key_idx').on(table.organizationId, table.key),
    organizationIdx: index('project_organization_idx').on(table.organizationId),
    teamIdx: index('project_team_idx').on(table.teamId),
    statusIdx: index('project_status_idx').on(table.status),
    leadIdx: index('project_lead_idx').on(table.leadId),
  })
);

// Project Members table - Users assigned to specific projects with roles
export const projectMembers = pgTable(
  'project_members',
  {
    id: text('id')
      .$defaultFn(() => createId())
      .primaryKey(),
    projectId: text('project_id')
      .notNull()
      .references(() => projects.id, { onDelete: 'cascade' }),
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    role: projectRoleEnum('role').notNull().default('developer'),

    // ===== JIRA-LIKE GRANULAR PERMISSIONS =====
    // Project Permissions
    canBrowseProject: varchar('can_browse_project', { length: 5 }).notNull().default('true'),
    canAdministerProject: varchar('can_administer_project', { length: 5 })
      .notNull()
      .default('false'),
    canBrowseDocs: varchar('can_browse_docs', { length: 5 }).notNull().default('true'),
    canCreateDocs: varchar('can_create_docs', { length: 5 }).notNull().default('false'),
    canEditDocs: varchar('can_edit_docs', { length: 5 }).notNull().default('false'),
    canDeleteDocs: varchar('can_delete_docs', { length: 5 }).notNull().default('false'),
    canBrowseChat: varchar('can_browse_chat', { length: 5 }).notNull().default('true'),
    canCreateChannels: varchar('can_create_channels', { length: 5 }).notNull().default('false'),
    canPostMessages: varchar('can_post_messages', { length: 5 }).notNull().default('true'),
    canModerateMessages: varchar('can_moderate_messages', { length: 5 }).notNull().default('false'),
    canStartCalls: varchar('can_start_calls', { length: 5 }).notNull().default('false'),
    canManageCalls: varchar('can_manage_calls', { length: 5 }).notNull().default('false'),

    // Sprint Permissions
    canManageSprints: varchar('can_manage_sprints', { length: 5 }).notNull().default('false'),
    canStartSprint: varchar('can_start_sprint', { length: 5 }).notNull().default('false'),
    canCompleteSprint: varchar('can_complete_sprint', { length: 5 }).notNull().default('false'),
    canDeleteSprint: varchar('can_delete_sprint', { length: 5 }).notNull().default('false'),

    // Issue Permissions
    canCreateIssues: varchar('can_create_issues', { length: 5 }).notNull().default('true'),
    canEditIssues: varchar('can_edit_issues', { length: 5 }).notNull().default('true'),
    canEditOwnIssues: varchar('can_edit_own_issues', { length: 5 }).notNull().default('true'),
    canDeleteIssues: varchar('can_delete_issues', { length: 5 }).notNull().default('false'),
    canDeleteOwnIssues: varchar('can_delete_own_issues', { length: 5 }).notNull().default('false'),
    canAssignIssues: varchar('can_assign_issues', { length: 5 }).notNull().default('false'),
    canAssigneeIssues: varchar('can_assignee_issues', { length: 5 }).notNull().default('true'), // Can be assigned to issues
    canTransitionIssues: varchar('can_transition_issues', { length: 5 }).notNull().default('true'),
    canScheduleIssues: varchar('can_schedule_issues', { length: 5 }).notNull().default('false'), // Add/remove from sprints
    canMoveIssues: varchar('can_move_issues', { length: 5 }).notNull().default('false'),
    canLinkIssues: varchar('can_link_issues', { length: 5 }).notNull().default('true'),
    canCloseIssues: varchar('can_close_issues', { length: 5 }).notNull().default('true'),
    canReopenIssues: varchar('can_reopen_issues', { length: 5 }).notNull().default('true'),

    // Comment Permissions
    canAddComments: varchar('can_add_comments', { length: 5 }).notNull().default('true'),
    canEditOwnComments: varchar('can_edit_own_comments', { length: 5 }).notNull().default('true'),
    canEditAllComments: varchar('can_edit_all_comments', { length: 5 }).notNull().default('false'),
    canDeleteOwnComments: varchar('can_delete_own_comments', { length: 5 })
      .notNull()
      .default('true'),
    canDeleteAllComments: varchar('can_delete_all_comments', { length: 5 })
      .notNull()
      .default('false'),

    // Attachment Permissions
    canCreateAttachments: varchar('can_create_attachments', { length: 5 })
      .notNull()
      .default('true'),
    canDeleteOwnAttachments: varchar('can_delete_own_attachments', { length: 5 })
      .notNull()
      .default('true'),
    canDeleteAllAttachments: varchar('can_delete_all_attachments', { length: 5 })
      .notNull()
      .default('false'),

    // Watcher Permissions
    canManageWatchers: varchar('can_manage_watchers', { length: 5 }).notNull().default('false'),
    canViewWatchers: varchar('can_view_watchers', { length: 5 }).notNull().default('true'),

    // Member Permissions
    canManageMembers: varchar('can_manage_members', { length: 5 }).notNull().default('false'),
    canInviteMembers: varchar('can_invite_members', { length: 5 }).notNull().default('false'),
    canRemoveMembers: varchar('can_remove_members', { length: 5 }).notNull().default('false'),
    canChangeRoles: varchar('can_change_roles', { length: 5 }).notNull().default('false'),

    // Workflow Permissions
    canManageWorkflow: varchar('can_manage_workflow', { length: 5 }).notNull().default('false'),

    // Time Tracking Permissions
    canLogWork: varchar('can_log_work', { length: 5 }).notNull().default('true'),
    canEditOwnWorklogs: varchar('can_edit_own_worklogs', { length: 5 }).notNull().default('true'),
    canEditAllWorklogs: varchar('can_edit_all_worklogs', { length: 5 }).notNull().default('false'),
    canDeleteOwnWorklogs: varchar('can_delete_own_worklogs', { length: 5 })
      .notNull()
      .default('true'),
    canDeleteAllWorklogs: varchar('can_delete_all_worklogs', { length: 5 })
      .notNull()
      .default('false'),

    // Metadata
    joinedAt: timestamp('joined_at').notNull().defaultNow(),
    invitedBy: text('invited_by').references(() => users.id),
    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull().defaultNow(),
  },
  (table) => ({
    projectUserIdx: uniqueIndex('project_member_project_user_idx').on(
      table.projectId,
      table.userId
    ),
    userIdx: index('project_member_user_idx').on(table.userId),
    projectIdx: index('project_member_project_idx').on(table.projectId),
    roleIdx: index('project_member_role_idx').on(table.role),
  })
);

// Project invite links - shareable, limited-use links for joining a project.
export const projectInviteLinks = pgTable(
  'project_invite_links',
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
    tokenHash: text('token_hash').notNull(),
    role: projectRoleEnum('role').notNull().default('developer'),
    maxUses: integer('max_uses').notNull().default(1),
    usedCount: integer('used_count').notNull().default(0),
    expiresAt: timestamp('expires_at').notNull(),
    revokedAt: timestamp('revoked_at'),
    revokedBy: text('revoked_by').references(() => users.id, { onDelete: 'set null' }),
    createdBy: text('created_by')
      .notNull()
      .references(() => users.id),
    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull().defaultNow(),
  },
  (table) => ({
    tokenHashIdx: uniqueIndex('project_invite_link_token_hash_idx').on(table.tokenHash),
    projectIdx: index('project_invite_link_project_idx').on(table.projectId),
    organizationIdx: index('project_invite_link_organization_idx').on(table.organizationId),
    expiresAtIdx: index('project_invite_link_expires_at_idx').on(table.expiresAt),
    revokedAtIdx: index('project_invite_link_revoked_at_idx').on(table.revokedAt),
  })
);

// Relations for projectMembers
export const projectMembersRelations = relations(projectMembers, ({ one }) => ({
  project: one(projects, {
    fields: [projectMembers.projectId],
    references: [projects.id],
  }),
  user: one(users, {
    fields: [projectMembers.userId],
    references: [users.id],
  }),
  inviter: one(users, {
    fields: [projectMembers.invitedBy],
    references: [users.id],
  }),
}));

export const projectInviteLinksRelations = relations(projectInviteLinks, ({ one }) => ({
  organization: one(organizations, {
    fields: [projectInviteLinks.organizationId],
    references: [organizations.id],
  }),
  project: one(projects, {
    fields: [projectInviteLinks.projectId],
    references: [projects.id],
  }),
  creator: one(users, {
    fields: [projectInviteLinks.createdBy],
    references: [users.id],
  }),
  revoker: one(users, {
    fields: [projectInviteLinks.revokedBy],
    references: [users.id],
  }),
}));

// Relations for projects
export const projectsRelations = relations(projects, ({ many, one }) => ({
  members: many(projectMembers),
  inviteLinks: many(projectInviteLinks),
  organization: one(organizations, {
    fields: [projects.organizationId],
    references: [organizations.id],
  }),
  team: one(teams, {
    fields: [projects.teamId],
    references: [teams.id],
  }),
  lead: one(users, {
    fields: [projects.leadId],
    references: [users.id],
  }),
}));
