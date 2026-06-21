import { pgTable, text, timestamp, jsonb, pgEnum, index } from 'drizzle-orm/pg-core';
import { createId } from '@paralleldrive/cuid2';
import { users } from './users';
import { organizations } from './organizations';
import { issues } from './issues';
import { projects } from './projects';

// Audit log action types
export const auditLogActionEnum = pgEnum('audit_log_action', [
  // Issue actions
  'issue.created',
  'issue.updated',
  'issue.deleted',
  'issue.status_changed',
  'issue.assigned',
  'issue.unassigned',
  'issue.priority_changed',
  'issue.labels_changed',
  'issue.linked',
  'issue.unlinked',
  'issue.commented',
  'issue.attachment_added',
  'issue.attachment_removed',
  'issue.custom_field_changed',

  // Document actions
  'document.created',
  'document.updated',
  'document.deleted',
  'document.restored',
  'document.linked_issue',
  'document.unlinked_issue',
  'document.public_shared',
  'document.public_unshared',
  'document.public_link_regenerated',

  // Chat actions
  'chat.channel_created',
  'chat.channel_updated',
  'chat.channel_deleted',
  'chat.message_created',
  'chat.message_updated',
  'chat.message_deleted',
  'chat.call_started',
  'chat.call_ended',

  // Agent actions
  'agent.config_updated',
  'agent.model_config_created',
  'agent.model_config_updated',
  'agent.model_config_archived',
  'agent.run_requested',
  'agent.run_completed',
  'agent.run_failed',
  'agent.policy.allow',
  'agent.policy.deny',
  'agent.policy.require_approval',
  'agent.approval.created',
  'agent.approval.approved',
  'agent.approval.rejected',

  // Project actions
  'project.created',
  'project.updated',
  'project.deleted',
  'project.member_added',
  'project.member_removed',
  'project.invite_link_created',
  'project.invite_link_revoked',
  'project.invite_link_accepted',
  'project.invite_link_signup',

  // Sprint actions
  'sprint.created',
  'sprint.updated',
  'sprint.deleted',
  'sprint.started',
  'sprint.completed',
  'sprint.issue_added',
  'sprint.issue_removed',

  // Organization actions
  'organization.created',
  'organization.updated',
  'organization.member_added',
  'organization.member_added_to_project',
  'organization.member_removed',
  'organization.role_changed',

  // Custom field actions
  'custom_field.created',
  'custom_field.updated',
  'custom_field.deleted',

  // Webhook actions
  'webhook.created',
  'webhook.updated',
  'webhook.deleted',
  'webhook.triggered',

  // API key actions
  'api_key.created',
  'api_key.revoked',
]);

// Audit logs table
export const auditLogs = pgTable(
  'audit_logs',
  {
    id: text('id')
      .$defaultFn(() => createId())
      .primaryKey(),

    // Who performed the action
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),

    // Organization context
    organizationId: text('organization_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' }),

    // What action was performed
    action: auditLogActionEnum('action').notNull(),

    // Resource information
    resourceType: text('resource_type').notNull(), // 'issue', 'project', 'sprint', etc.
    resourceId: text('resource_id').notNull(), // ID of the affected resource

    // Optional related resources
    projectId: text('project_id').references(() => projects.id, { onDelete: 'cascade' }),
    issueId: text('issue_id').references(() => issues.id, { onDelete: 'cascade' }),

    // Change details
    changes: jsonb('changes'), // { field: { from: 'old', to: 'new' } }
    metadata: jsonb('metadata'), // Additional context (IP address, user agent, etc.)

    // Timestamps
    createdAt: timestamp('created_at').notNull().defaultNow(),
  },
  (table) => ({
    userIdx: index('audit_log_user_idx').on(table.userId),
    organizationIdx: index('audit_log_organization_idx').on(table.organizationId),
    resourceTypeIdx: index('audit_log_resource_type_idx').on(table.resourceType),
    resourceIdIdx: index('audit_log_resource_id_idx').on(table.resourceId),
    projectIdx: index('audit_log_project_idx').on(table.projectId),
    issueIdx: index('audit_log_issue_idx').on(table.issueId),
    createdAtIdx: index('audit_log_created_at_idx').on(table.createdAt),
    // Composite indexes for common queries
    orgCreatedAtIdx: index('audit_log_org_created_at_idx').on(
      table.organizationId,
      table.createdAt
    ),
    resourceIdx: index('audit_log_resource_idx').on(table.resourceType, table.resourceId),
  })
);
