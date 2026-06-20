import {
  agentApprovalRequests,
  createAuditLog,
  db,
  type AgentApprovalRequest,
} from '@tasknebula/db';
import { evaluateAgentPolicy } from './evaluator';
import type {
  AgentApprovalExecutor,
  AgentPolicyEvaluationResult,
  AgentPolicyMarker,
} from './types';

type GuardParams = {
  workspaceId: string;
  projectId?: string | null;
  requestedBy: string;
  actor: string;
  resource: string;
  action: string;
  targetType: string;
  targetId?: string | null;
  proposedPayload: {
    executor: AgentApprovalExecutor;
    data: Record<string, unknown>;
  };
  context?: Record<string, unknown>;
};

export type AgentActionGuardResult =
  | {
      allowed: true;
      decision: AgentPolicyEvaluationResult;
    }
  | {
      allowed: false;
      httpStatus: 202 | 403;
      decision: AgentPolicyEvaluationResult;
      approvalRequest?: AgentApprovalRequest;
      body: Record<string, unknown>;
    };

function auditActionForDecision(decision: AgentPolicyEvaluationResult['decision']) {
  if (decision === 'allow') return 'agent.policy.allow' as const;
  if (decision === 'deny') return 'agent.policy.deny' as const;
  return 'agent.policy.require_approval' as const;
}

function compactPayload(params: GuardParams, decision: AgentPolicyEvaluationResult) {
  return {
    actor: params.actor,
    resource: params.resource,
    action: params.action,
    decision: decision.decision,
    matchedRule: decision.matchedRule?.raw ?? null,
    targetId: params.targetId ?? null,
    policySourcePath: decision.policySourcePath,
    reason: decision.reason,
  };
}

async function recordPolicyDecision(params: GuardParams, decision: AgentPolicyEvaluationResult) {
  await createAuditLog({
    userId: params.requestedBy,
    organizationId: params.workspaceId,
    action: auditActionForDecision(decision.decision),
    resourceType: 'agent_policy',
    resourceId: params.targetId ?? params.projectId ?? params.workspaceId,
    projectId: params.projectId ?? undefined,
    metadata: compactPayload(params, decision),
  }).catch(() => null);
}

export function readAgentPolicyMarker(value: unknown): AgentPolicyMarker | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const source = value as Record<string, unknown>;
  const actor = typeof source.actor === 'string' ? source.actor.trim() : '';
  if (!actor) return null;

  return {
    actor,
    source: typeof source.source === 'string' ? source.source : undefined,
    resource: typeof source.resource === 'string' ? source.resource : undefined,
    action: typeof source.action === 'string' ? source.action : undefined,
    targetType: typeof source.targetType === 'string' ? source.targetType : undefined,
  };
}

export function stripAgentPolicyMarker<T extends { agentPolicy?: unknown }>(value: T) {
  const { agentPolicy: _agentPolicy, ...rest } = value;
  return rest;
}

export async function guardAgentAction(params: GuardParams): Promise<AgentActionGuardResult> {
  const decision = await evaluateAgentPolicy({
    workspaceId: params.workspaceId,
    projectId: params.projectId,
    actor: params.actor,
    actorType: 'agent',
    resource: params.resource,
    action: params.action,
    targetId: params.targetId,
    context: params.context,
  });

  await recordPolicyDecision(params, decision);

  if (decision.decision === 'allow') {
    return { allowed: true, decision };
  }

  if (decision.decision === 'deny') {
    return {
      allowed: false,
      httpStatus: 403,
      decision,
      body: {
        code: 'agent_policy_denied',
        decision: 'deny',
        matchedRule: decision.matchedRule?.raw ?? null,
      },
    };
  }

  const [approvalRequest] = await db
    .insert(agentApprovalRequests)
    .values({
      workspaceId: params.workspaceId,
      projectId: params.projectId ?? null,
      requestedBy: params.requestedBy,
      actor: params.actor,
      resource: params.resource,
      action: params.action,
      targetType: params.targetType,
      targetId: params.targetId ?? null,
      proposedPayload: params.proposedPayload,
      matchedRule: decision.matchedRule?.raw ?? null,
      decisionReason: decision.reason,
      status: 'pending',
    })
    .returning();

  if (approvalRequest) {
    await createAuditLog({
      userId: params.requestedBy,
      organizationId: params.workspaceId,
      action: 'agent.approval.created',
      resourceType: 'agent_approval',
      resourceId: approvalRequest.id,
      projectId: params.projectId ?? undefined,
      metadata: {
        ...compactPayload(params, decision),
        approvalRequestId: approvalRequest.id,
      },
    }).catch(() => null);
  }

  return {
    allowed: false,
    httpStatus: 202,
    decision,
    approvalRequest,
    body: {
      code: 'agent_policy_approval_required',
      decision: 'require_approval',
      approvalRequestId: approvalRequest?.id ?? null,
      approvers: decision.matchedRule?.approvers ?? [],
      matchedRule: decision.matchedRule?.raw ?? null,
    },
  };
}
