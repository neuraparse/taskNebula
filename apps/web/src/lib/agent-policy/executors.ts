import { createId } from '@paralleldrive/cuid2';
import { z } from 'zod';
import {
  createActivity,
  createAuditLog,
  createComment,
  db,
  eq,
  getIssueById,
  issues,
  projects,
  updateIssue,
  workflowStatuses,
  workflows,
  type AgentApprovalRequest,
} from '@tasknebula/db';
import { desc, and, sql } from 'drizzle-orm';
import { publishEvent } from '@/lib/realtime/events';
import { runAutomations } from '@/lib/automation/evaluator';
import { syncIssueLabelsBestEffort } from '@/lib/labels/sync';
import type { AgentApprovalExecutor } from './types';

const issueTypeSchema = z.enum(['story', 'task', 'bug', 'epic']);
const issuePrioritySchema = z.enum(['critical', 'high', 'medium', 'low', 'none']);

const createIssuePayloadSchema = z.object({
  projectId: z.string().min(1),
  type: issueTypeSchema,
  title: z.string().min(1).max(500),
  description: z.string().optional().nullable(),
  priority: issuePrioritySchema.default('medium'),
  assigneeId: z.string().optional().nullable(),
  labels: z.array(z.string()).default([]),
  sprintId: z.string().optional().nullable(),
  epicId: z.string().optional().nullable(),
  parentId: z.string().optional().nullable(),
  estimate: z.number().optional().nullable(),
  dueDate: z.string().datetime().optional().nullable(),
  customFields: z.record(z.unknown()).default({}),
  statusId: z.string().optional().nullable(),
});

const updateIssuePayloadSchema = z.object({
  issueId: z.string().min(1),
  data: z.object({
    title: z.string().min(1).max(500).optional(),
    description: z.string().optional().nullable(),
    statusId: z.string().optional(),
    priority: issuePrioritySchema.optional(),
    assigneeId: z.string().nullable().optional(),
    labels: z.array(z.string()).optional(),
    sprintId: z.string().nullable().optional(),
    resolution: z
      .enum(['fixed', 'wont_do', 'duplicate', 'cannot_reproduce', 'done'])
      .nullable()
      .optional(),
  }),
});

const createCommentPayloadSchema = z.object({
  issueId: z.string().min(1),
  data: z.object({
    content: z.string().min(1),
    parentId: z.string().optional().nullable(),
    mentions: z.array(z.string()).default([]),
    isInternal: z.boolean().default(false),
  }),
});

type StoredExecutorPayload = {
  executor: AgentApprovalExecutor;
  data: Record<string, unknown>;
};

function isSupportedExecutor(value: unknown): value is AgentApprovalExecutor {
  return value === 'issues:create' || value === 'issues:update' || value === 'comments:create';
}

function getExecutorPayload(approval: AgentApprovalRequest): StoredExecutorPayload {
  const payload = approval.proposedPayload as {
    executor?: string;
    data?: Record<string, unknown>;
  } | null;
  if (!isSupportedExecutor(payload?.executor) || !payload.data) {
    throw new Error('approval_payload_invalid');
  }
  return {
    executor: payload.executor,
    data: payload.data,
  };
}

async function executeIssueCreate(approval: AgentApprovalRequest, data: Record<string, unknown>) {
  const input = createIssuePayloadSchema.parse(data);
  const [project] = await db
    .select()
    .from(projects)
    .where(and(eq(projects.id, input.projectId), eq(projects.organizationId, approval.workspaceId)))
    .limit(1);

  if (!project) throw new Error('project_not_found');

  let workflowId = project.defaultWorkflowId;
  if (!workflowId) {
    const [workflow] = await db
      .select()
      .from(workflows)
      .where(
        and(eq(workflows.organizationId, project.organizationId), eq(workflows.isDefault, true))
      )
      .limit(1);
    workflowId = workflow?.id ?? null;
  }

  if (!workflowId) throw new Error('workflow_not_found');

  const allStatuses = await db
    .select()
    .from(workflowStatuses)
    .where(eq(workflowStatuses.workflowId, workflowId));

  let finalStatusId = input.statusId || undefined;
  if (finalStatusId && !allStatuses.some((status) => status.id === finalStatusId)) {
    finalStatusId = undefined;
  }
  if (!finalStatusId) {
    finalStatusId = [...allStatuses]
      .filter((status) => status.category === 'backlog')
      .sort((left, right) => left.position - right.position)[0]?.id;
  }
  if (!finalStatusId) throw new Error('status_not_found');

  const newIssue = await db.transaction(async (tx) => {
    await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${project.id}))`);
    const [lastIssue] = await tx
      .select()
      .from(issues)
      .where(eq(issues.projectId, project.id))
      .orderBy(desc(issues.number))
      .limit(1);

    const nextNumber = lastIssue ? (lastIssue.number || 0) + 1 : 1;
    const [inserted] = await tx
      .insert(issues)
      .values({
        id: createId(),
        organizationId: project.organizationId,
        projectId: project.id,
        key: `${project.key}-${nextNumber}`,
        number: nextNumber,
        title: input.title,
        description: input.description || null,
        statusId: finalStatusId,
        priority: input.priority,
        type: input.type,
        reporterId: approval.requestedBy,
        assigneeId: input.assigneeId || null,
        sprintId: input.sprintId || null,
        parentId: input.parentId || null,
        estimate: input.estimate || null,
        labels: input.labels,
        customFields: input.customFields,
        metadata: { source: 'agent_policy_approval', approvalRequestId: approval.id },
        createdBy: approval.requestedBy,
        updatedBy: approval.requestedBy,
      })
      .returning();
    return inserted;
  });

  if (!newIssue) throw new Error('issue_create_failed');

  if (input.labels.length > 0) {
    await syncIssueLabelsBestEffort({
      organizationId: newIssue.organizationId,
      issueId: newIssue.id,
      labels: input.labels,
      createdBy: approval.requestedBy,
    });
  }

  await Promise.allSettled([
    createActivity({ issueId: newIssue.id, userId: approval.requestedBy, type: 'created' }),
    createAuditLog({
      userId: approval.requestedBy,
      organizationId: newIssue.organizationId,
      action: 'issue.created',
      resourceType: 'issue',
      resourceId: newIssue.id,
      projectId: newIssue.projectId,
      issueId: newIssue.id,
      metadata: {
        source: 'agent_policy_approval',
        approvalRequestId: approval.id,
        actor: approval.actor,
        issueKey: newIssue.key,
      },
    }),
  ]);

  publishEvent('issue.created', approval.requestedBy, {
    projectId: newIssue.projectId,
    issueId: newIssue.id,
    sprintId: newIssue.sprintId || undefined,
    organizationId: newIssue.organizationId,
  });

  await runAutomations({
    trigger: 'issue.created',
    organizationId: newIssue.organizationId,
    projectId: newIssue.projectId,
    payload: newIssue,
    actorUserId: approval.requestedBy,
  }).catch(() => null);

  return newIssue;
}

async function executeIssueUpdate(approval: AgentApprovalRequest, data: Record<string, unknown>) {
  const input = updateIssuePayloadSchema.parse(data);
  const currentIssue = await getIssueById(input.issueId);
  if (!currentIssue) throw new Error('issue_not_found');
  if (currentIssue.organizationId !== approval.workspaceId) throw new Error('issue_not_found');
  if (approval.projectId && currentIssue.projectId !== approval.projectId) {
    throw new Error('issue_not_found');
  }

  const patch = {
    ...input.data,
    ...(input.data.resolution !== undefined
      ? { resolvedAt: input.data.resolution === null ? null : new Date() }
      : {}),
    updatedBy: approval.requestedBy,
  };

  const updated = await updateIssue(input.issueId, patch);
  if (!updated) throw new Error('issue_update_failed');

  if (input.data.labels !== undefined) {
    await syncIssueLabelsBestEffort({
      organizationId: currentIssue.organizationId,
      issueId: input.issueId,
      labels: input.data.labels,
      createdBy: approval.requestedBy,
    });
  }

  const changes: Record<string, { from: unknown; to: unknown }> = {};
  for (const key of [
    'statusId',
    'assigneeId',
    'priority',
    'title',
    'labels',
    'resolution',
  ] as const) {
    if (input.data[key] === undefined) continue;
    const before = (currentIssue as Record<string, unknown>)[key];
    const afterValue = (input.data as Record<string, unknown>)[key];
    if (JSON.stringify(before) !== JSON.stringify(afterValue)) {
      changes[key] = { from: before ?? null, to: afterValue ?? null };
    }
  }

  if (Object.keys(changes).length > 0) {
    let action:
      | 'issue.status_changed'
      | 'issue.assigned'
      | 'issue.labels_changed'
      | 'issue.priority_changed'
      | 'issue.updated' = 'issue.updated';
    if (changes.statusId) action = 'issue.status_changed';
    else if (changes.assigneeId) action = 'issue.assigned';
    else if (changes.labels) action = 'issue.labels_changed';
    else if (changes.priority) action = 'issue.priority_changed';

    await Promise.allSettled([
      createActivity({
        issueId: input.issueId,
        userId: approval.requestedBy,
        type: changes.statusId ? 'status_changed' : changes.assigneeId ? 'assigned' : 'updated',
        metadata: { source: 'agent_policy_approval', approvalRequestId: approval.id },
      } as never),
      createAuditLog({
        userId: approval.requestedBy,
        organizationId: currentIssue.organizationId,
        action,
        resourceType: 'issue',
        resourceId: input.issueId,
        projectId: currentIssue.projectId,
        issueId: input.issueId,
        changes,
        metadata: {
          source: 'agent_policy_approval',
          approvalRequestId: approval.id,
          actor: approval.actor,
        },
      }),
    ]);
  }

  publishEvent('issue.updated', approval.requestedBy, {
    projectId: currentIssue.projectId,
    issueId: input.issueId,
    sprintId: currentIssue.sprintId || undefined,
    organizationId: currentIssue.organizationId,
  });

  await runAutomations({
    trigger: 'issue.updated',
    organizationId: currentIssue.organizationId,
    projectId: currentIssue.projectId,
    payload: { before: currentIssue, after: updated, changedFields: Object.keys(changes) },
    actorUserId: approval.requestedBy,
  }).catch(() => null);

  return updated;
}

async function executeCommentCreate(approval: AgentApprovalRequest, data: Record<string, unknown>) {
  const input = createCommentPayloadSchema.parse(data);
  const issue = await getIssueById(input.issueId);
  if (!issue) throw new Error('issue_not_found');
  if (issue.organizationId !== approval.workspaceId) throw new Error('issue_not_found');

  const comment = await createComment({
    id: createId(),
    issueId: input.issueId,
    content: input.data.content,
    parentId: input.data.parentId || null,
    mentions: input.data.mentions,
    reactions: [],
    isInternal: input.data.isInternal ? 'true' : 'false',
    createdBy: approval.requestedBy,
    updatedBy: approval.requestedBy,
  });

  if (!comment) throw new Error('comment_create_failed');

  await Promise.allSettled([
    createActivity({
      issueId: input.issueId,
      userId: approval.requestedBy,
      type: 'commented',
      metadata: { source: 'agent_policy_approval', approvalRequestId: approval.id },
    } as never),
    createAuditLog({
      userId: approval.requestedBy,
      organizationId: issue.organizationId,
      action: 'issue.commented',
      resourceType: 'issue',
      resourceId: input.issueId,
      projectId: issue.projectId,
      issueId: input.issueId,
      metadata: {
        source: 'agent_policy_approval',
        approvalRequestId: approval.id,
        actor: approval.actor,
        commentId: comment.id,
      },
    }),
  ]);

  publishEvent('issue.commented', approval.requestedBy, {
    issueId: input.issueId,
    projectId: issue.projectId,
    organizationId: issue.organizationId,
  });

  return comment;
}

export async function executeApprovedAgentAction(approval: AgentApprovalRequest) {
  const payload = getExecutorPayload(approval);
  switch (payload.executor) {
    case 'issues:create':
      return executeIssueCreate(approval, payload.data);
    case 'issues:update':
      return executeIssueUpdate(approval, payload.data);
    case 'comments:create':
      return executeCommentCreate(approval, payload.data);
    default:
      throw new Error('approval_executor_unsupported');
  }
}
