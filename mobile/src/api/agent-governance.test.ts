import {
  approveAgentApproval,
  getAgentPolicy,
  getProjectAgentSettings,
  listAgentApprovals,
  rejectAgentApproval,
  updateProjectAgentSettings,
} from './endpoints';
import { configureApi } from './client';

const originalFetch = globalThis.fetch;

function jsonResponse(status: number, body: unknown): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    statusText: status >= 200 && status < 300 ? 'OK' : 'Error',
    json: jest.fn().mockResolvedValue(body),
    text: jest.fn().mockResolvedValue(JSON.stringify(body)),
  } as unknown as Response;
}

describe('agent governance API', () => {
  beforeAll(() => {
    globalThis.fetch = jest.fn() as unknown as typeof fetch;
  });

  beforeEach(() => {
    jest.mocked(globalThis.fetch).mockReset();
    configureApi({ baseUrl: 'https://tasks.example.com', cookie: 'authjs.session-token=abc' });
  });

  afterAll(() => {
    globalThis.fetch = originalFetch;
  });

  it('loads and normalizes agent policy status', async () => {
    jest.mocked(globalThis.fetch).mockResolvedValue(
      jsonResponse(200, {
        enabled: true,
        found: true,
        sourcePath: '/srv/tasknebula/AGENTOWNERS',
        parsedAt: '2026-06-28T10:00:00.000Z',
        errors: [{ line: '4', message: 'Unknown effect', raw: 'bad rule' }],
        rules: [
          {
            actor: 'triage-agent',
            actorKind: 'agent',
            resource: 'issues',
            action: 'update',
            effect: 'require_approval',
            approvers: ['owner'],
            raw: 'agent triage-agent issues:update require_approval',
            line: '12',
          },
          { actor: 'missing-fields' },
        ],
      }),
    );

    await expect(getAgentPolicy('org_1')).resolves.toEqual({
      enabled: true,
      found: true,
      sourcePath: '/srv/tasknebula/AGENTOWNERS',
      parsedAt: '2026-06-28T10:00:00.000Z',
      errors: [{ line: 4, message: 'Unknown effect', raw: 'bad rule' }],
      rules: [
        {
          actor: 'triage-agent',
          actorKind: 'agent',
          resource: 'issues',
          action: 'update',
          effect: 'require_approval',
          approvers: ['owner'],
          raw: 'agent triage-agent issues:update require_approval',
          line: 12,
        },
      ],
    });

    expect(jest.mocked(globalThis.fetch).mock.calls[0]?.[0]).toBe(
      'https://tasks.example.com/api/agent-policy?organizationId=org_1',
    );
  });

  it('lists and decides agent approval requests', async () => {
    jest
      .mocked(globalThis.fetch)
      .mockResolvedValueOnce(
        jsonResponse(200, {
          approvals: [
            {
              id: 'approval_1',
              workspaceId: 'org_1',
              projectId: 'project_1',
              requestedBy: 'user_1',
              actor: 'triage-agent',
              resource: 'issues',
              action: 'update',
              targetType: 'issue',
              targetId: 'issue_1',
              proposedPayload: { status: 'done' },
              matchedRule: 'agent triage-agent issues:update require_approval',
              decisionReason: 'Matched AGENTOWNERS rule',
              status: 'pending',
              requestedAt: '2026-06-28T10:00:00.000Z',
              expiresAt: null,
            },
            { id: 'missing-workspace' },
          ],
        }),
      )
      .mockResolvedValueOnce(
        jsonResponse(200, {
          approval: {
            id: 'approval_1',
            workspaceId: 'org_1',
            actor: 'triage-agent',
            resource: 'issues',
            action: 'update',
            targetType: 'issue',
            status: 'approved',
          },
          result: { issueId: 'issue_1' },
        }),
      )
      .mockResolvedValueOnce(
        jsonResponse(200, {
          approval: {
            id: 'approval_2',
            workspaceId: 'org_1',
            actor: 'planner-agent',
            resource: 'comments',
            action: 'create',
            targetType: 'issue',
            status: 'rejected',
          },
        }),
      );

    await expect(listAgentApprovals({ organizationId: 'org_1' })).resolves.toEqual([
      expect.objectContaining({
        id: 'approval_1',
        workspaceId: 'org_1',
        projectId: 'project_1',
        actor: 'triage-agent',
        proposedPayload: { status: 'done' },
        status: 'pending',
      }),
    ]);

    await expect(approveAgentApproval('approval_1')).resolves.toEqual({
      approval: expect.objectContaining({
        id: 'approval_1',
        status: 'approved',
      }),
      result: { issueId: 'issue_1' },
    });

    await expect(rejectAgentApproval('approval_2')).resolves.toEqual({
      approval: expect.objectContaining({
        id: 'approval_2',
        status: 'rejected',
      }),
    });

    expect(jest.mocked(globalThis.fetch).mock.calls[0]?.[0]).toBe(
      'https://tasks.example.com/api/agent-approvals?organizationId=org_1&status=pending',
    );
    expect(jest.mocked(globalThis.fetch).mock.calls[1]?.[0]).toBe(
      'https://tasks.example.com/api/agent-approvals/approval_1/approve',
    );
    expect(jest.mocked(globalThis.fetch).mock.calls[1]?.[1]).toMatchObject({ method: 'POST' });
    expect(jest.mocked(globalThis.fetch).mock.calls[2]?.[0]).toBe(
      'https://tasks.example.com/api/agent-approvals/approval_2/reject',
    );
    expect(jest.mocked(globalThis.fetch).mock.calls[2]?.[1]).toMatchObject({ method: 'POST' });
  });

  it('loads and updates project AI agent settings', async () => {
    jest
      .mocked(globalThis.fetch)
      .mockResolvedValueOnce(
        jsonResponse(200, {
          project: { id: 'project_1', key: 'MOB', name: 'Mobile' },
          access: { canView: true, canManage: true, projectRole: 'admin' },
          workspaceSettings: {
            enabled: true,
            assistantEnabled: true,
            provider: 'openai',
            model: 'gpt-4.1',
            executionMode: 'assistive',
            allowWriteActions: true,
            requireApprovalForWrites: true,
            dailyRunLimit: '20',
            capabilities: { backlog_triage: true },
          },
          projectSettings: {
            enabled: true,
            inheritWorkspaceDefaults: false,
            executionMode: 'manual',
            allowWriteActions: false,
            sprintBatchSize: '3',
            sprintLengthDays: '14',
            issueCapacityPerSprint: '12',
            autoAssignToPlannedSprints: true,
            capabilities: { backlog_triage: true, sprint_planning: false },
          },
          effectiveSettings: {
            enabled: true,
            allowWriteActions: false,
            executionMode: 'manual',
            provider: 'openai',
            model: 'gpt-4.1',
            requireApprovalForWrites: true,
            dailyRunLimit: '20',
            sprintBatchSize: '3',
            sprintLengthDays: '14',
            issueCapacityPerSprint: '12',
            autoAssignToPlannedSprints: true,
            capabilities: { backlog_triage: true, sprint_planning: false },
          },
          providerStatus: { ready: true, summary: 'Ready', configured: true },
          configIssues: [{ code: 'writes_preview_only', severity: 'warning', blocksRuns: false }],
          runtimeSummary: {
            runningRuns: '1',
            lastRunAt: '2026-06-28T10:00:00.000Z',
            lastFailure: null,
          },
          runAvailability: { canRun: true, reason: null },
          serviceStatus: [{ key: 'execution', label: 'Run API', state: 'ready', detail: 'OK' }],
          lastRunByKind: {
            backlog_triage: {
              id: 'run_1',
              kind: 'backlog_triage',
              status: 'completed',
              dryRun: true,
              writeActionsCount: '0',
            },
          },
          recentRuns: [
            {
              id: 'run_1',
              kind: 'backlog_triage',
              status: 'completed',
              dryRun: true,
              writeActionsCount: '0',
            },
          ],
        }),
      )
      .mockResolvedValueOnce(
        jsonResponse(200, {
          projectId: 'project_1',
          projectSettings: {
            enabled: false,
            inheritWorkspaceDefaults: true,
            executionMode: 'assistive',
            allowWriteActions: true,
            capabilities: { backlog_triage: false },
          },
        }),
      );

    await expect(getProjectAgentSettings('project_1')).resolves.toMatchObject({
      project: { id: 'project_1', key: 'MOB', name: 'Mobile' },
      access: { canView: true, canManage: true, projectRole: 'admin' },
      projectSettings: {
        enabled: true,
        inheritWorkspaceDefaults: false,
        executionMode: 'manual',
        allowWriteActions: false,
        sprintBatchSize: 3,
        capabilities: { backlog_triage: true, sprint_planning: false },
      },
      effectiveSettings: {
        provider: 'openai',
        model: 'gpt-4.1',
        dailyRunLimit: 20,
      },
      runtimeSummary: { runningRuns: 1 },
      runAvailability: { canRun: true, reason: null },
      recentRuns: [expect.objectContaining({ id: 'run_1', kind: 'backlog_triage' })],
    });

    await expect(
      updateProjectAgentSettings('project_1', {
        enabled: false,
        inheritWorkspaceDefaults: true,
        capabilities: { backlog_triage: false },
      }),
    ).resolves.toMatchObject({
      enabled: false,
      inheritWorkspaceDefaults: true,
      executionMode: 'assistive',
      allowWriteActions: true,
      capabilities: { backlog_triage: false },
    });

    const calls = jest.mocked(globalThis.fetch).mock.calls;
    expect(calls[0]?.[0]).toBe('https://tasks.example.com/api/projects/project_1/agents');
    expect(calls[1]?.[0]).toBe('https://tasks.example.com/api/projects/project_1/agents');
    expect(calls[1]?.[1]).toMatchObject({ method: 'PATCH' });
    expect(JSON.parse(String(calls[1]?.[1]?.body))).toEqual({
      enabled: false,
      inheritWorkspaceDefaults: true,
      capabilities: { backlog_triage: false },
    });
  });
});
