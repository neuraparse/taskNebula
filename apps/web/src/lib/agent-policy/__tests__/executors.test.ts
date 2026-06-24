/**
 * @jest-environment node
 */

const createCommentMock = jest.fn();
const getIssueByIdMock = jest.fn();

jest.mock('@tasknebula/db', () => {
  const table = (name: string) => ({ __name: name });

  return {
    createActivity: jest.fn(),
    createAuditLog: jest.fn(),
    createComment: (...args: unknown[]) => createCommentMock(...args),
    db: {
      select: jest.fn(),
      transaction: jest.fn(),
    },
    eq: (left: unknown, right: unknown) => ({ op: 'eq', left, right }),
    getIssueById: (...args: unknown[]) => getIssueByIdMock(...args),
    issues: table('issues'),
    projects: table('projects'),
    updateIssue: jest.fn(),
    workflowStatuses: table('workflow_statuses'),
    workflows: table('workflows'),
  };
});

jest.mock('@/lib/realtime/events', () => ({
  publishEvent: jest.fn(),
}));

jest.mock('@/lib/automation/evaluator', () => ({
  runAutomations: jest.fn(),
}));

jest.mock('@/lib/labels/sync', () => ({
  syncIssueLabelsBestEffort: jest.fn(),
}));

import type { AgentApprovalRequest } from '@tasknebula/db';
import { executeApprovedAgentAction } from '../executors';

function approval(overrides: Partial<AgentApprovalRequest> = {}): AgentApprovalRequest {
  return {
    id: 'approval-1',
    workspaceId: 'org-1',
    projectId: 'project-a',
    requestedBy: 'user-1',
    actor: 'agent:codex',
    resource: 'comments',
    action: 'create',
    targetType: 'issue',
    targetId: 'issue-b',
    proposedPayload: {
      executor: 'comments:create',
      data: {
        issueId: 'issue-b',
        data: {
          content: 'Looks good',
        },
      },
    },
    matchedRule: null,
    decisionReason: 'require_approval',
    status: 'pending',
    decidedBy: null,
    decidedAt: null,
    requestedAt: new Date('2026-01-01T00:00:00Z'),
    expiresAt: null,
    updatedAt: new Date('2026-01-01T00:00:00Z'),
    ...overrides,
  } as AgentApprovalRequest;
}

describe('executeApprovedAgentAction', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('does not apply a project-scoped comment approval to an issue in another project', async () => {
    getIssueByIdMock.mockResolvedValue({
      id: 'issue-b',
      organizationId: 'org-1',
      projectId: 'project-b',
      reporterId: 'user-2',
    });

    await expect(executeApprovedAgentAction(approval())).rejects.toThrow('issue_not_found');
    expect(createCommentMock).not.toHaveBeenCalled();
  });
});
