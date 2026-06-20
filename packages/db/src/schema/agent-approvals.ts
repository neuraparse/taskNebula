import { createId } from '@paralleldrive/cuid2';
import { index, jsonb, pgTable, text, timestamp } from 'drizzle-orm/pg-core';
import { organizations } from './organizations';
import { projects } from './projects';
import { users } from './users';

/**
 * Pending AI-agent writes that AGENTOWNERS requires a human to approve.
 *
 * The original executor payload is stored in `proposed_payload` so approval can
 * replay the same action without trusting a second client-supplied body.
 */
export const agentApprovalRequests = pgTable(
  'agent_approval_requests',
  {
    id: text('id')
      .$defaultFn(() => createId())
      .primaryKey(),
    workspaceId: text('workspace_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' }),
    projectId: text('project_id').references(() => projects.id, { onDelete: 'cascade' }),
    requestedBy: text('requested_by')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    actor: text('actor').notNull(),
    resource: text('resource').notNull(),
    action: text('action').notNull(),
    targetType: text('target_type').notNull(),
    targetId: text('target_id'),
    proposedPayload: jsonb('proposed_payload').notNull().default('{}'),
    matchedRule: text('matched_rule'),
    decisionReason: text('decision_reason').notNull(),
    status: text('status').notNull().default('pending'),
    requestedAt: timestamp('requested_at').notNull().defaultNow(),
    expiresAt: timestamp('expires_at'),
    decidedBy: text('decided_by').references(() => users.id, { onDelete: 'set null' }),
    decidedAt: timestamp('decided_at'),
    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull().defaultNow(),
  },
  (table) => ({
    workspaceStatusIdx: index('agent_approval_workspace_status_idx').on(
      table.workspaceId,
      table.status,
      table.requestedAt
    ),
    projectIdx: index('agent_approval_project_idx').on(table.projectId),
    actorIdx: index('agent_approval_actor_idx').on(table.actor),
    targetIdx: index('agent_approval_target_idx').on(table.targetType, table.targetId),
    requestedByIdx: index('agent_approval_requested_by_idx').on(table.requestedBy),
  })
);

export type AgentApprovalRequest = typeof agentApprovalRequests.$inferSelect;
export type NewAgentApprovalRequest = typeof agentApprovalRequests.$inferInsert;
