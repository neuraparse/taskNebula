import { getOrganizationAgentSettings, updateOrganizationAgentSettings } from './endpoints';
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

const settingsResponse = {
  organizationId: 'org_1',
  organizationName: 'TaskNebula Labs',
  workspaceSettings: {
    enabled: true,
    assistantEnabled: true,
    modelConfigId: null,
    provider: 'anthropic',
    model: 'claude-sonnet-4-7',
    executionMode: 'assistive',
    allowWriteActions: false,
    requireApprovalForWrites: true,
    aiOversight: 'review_required',
    aiSafetyMode: 'strict',
    dailyRunLimit: '25',
    capabilities: {
      backlog_triage: true,
      sprint_planning: false,
    },
  },
  selectedModelConfig: null,
  modelConfigs: [
    {
      id: 'model_1',
      organizationId: 'org_1',
      name: 'Claude default',
      provider: 'anthropic',
      model: 'claude-sonnet-4-7',
      description: null,
      isDefault: true,
      isArchived: false,
      revisionCount: '3',
      createdAt: '2026-06-28T08:00:00.000Z',
      updatedAt: '2026-06-28T09:00:00.000Z',
    },
  ],
  access: {
    canView: true,
    canManage: true,
    orgRole: 'admin',
    isSuperAdmin: false,
  },
  providerStatus: {
    ready: true,
    summary: 'Anthropic key configured',
    configured: true,
    source: 'workspace',
    label: 'Anthropic',
    updatedAt: '2026-06-28T09:00:00.000Z',
  },
  configIssues: [
    {
      code: 'write_approval_required',
      scope: 'workspace',
      severity: 'info',
      title: 'Approval required',
      detail: 'Writes require approval.',
      resolution: 'Switch oversight if needed.',
      blocksRuns: false,
    },
  ],
  runtimeSummary: {
    projectCount: '4',
    enabledProjectCount: '2',
    runningRuns: '1',
    totalRuns: '12',
    lastRunAt: '2026-06-28T10:00:00.000Z',
    lastCompletedAt: null,
    lastFailedAt: null,
    lastFailure: null,
  },
  serviceStatus: [
    {
      key: 'provider',
      label: 'Provider adapter',
      state: 'ready',
      detail: 'Provider is configured.',
    },
  ],
  recentRuns: [
    {
      id: 'run_1',
      kind: 'triage',
      status: 'running',
      dryRun: true,
      summary: null,
      writeActionsCount: '0',
      createdAt: '2026-06-28T10:00:00.000Z',
      completedAt: null,
      error: null,
      projectId: 'project_1',
      projectName: 'Mobile',
      initiatedBy: 'Ada',
    },
  ],
  updatedAt: '2026-06-28T09:00:00.000Z',
};

describe('organization agent settings API', () => {
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

  it('loads and normalizes workspace AI agent transparency settings', async () => {
    jest.mocked(globalThis.fetch).mockResolvedValue(jsonResponse(200, settingsResponse));

    await expect(getOrganizationAgentSettings('org_1')).resolves.toMatchObject({
      organizationId: 'org_1',
      organizationName: 'TaskNebula Labs',
      workspaceSettings: {
        enabled: true,
        assistantEnabled: true,
        provider: 'anthropic',
        model: 'claude-sonnet-4-7',
        aiOversight: 'review_required',
        dailyRunLimit: 25,
        capabilities: {
          backlog_triage: true,
          sprint_planning: false,
        },
      },
      modelConfigs: [
        expect.objectContaining({
          id: 'model_1',
          revisionCount: 3,
          isDefault: true,
        }),
      ],
      access: {
        canView: true,
        canManage: true,
        orgRole: 'admin',
        isSuperAdmin: false,
      },
      runtimeSummary: {
        projectCount: 4,
        enabledProjectCount: 2,
        runningRuns: 1,
        totalRuns: 12,
      },
      recentRuns: [expect.objectContaining({ id: 'run_1', writeActionsCount: 0 })],
    });
    expect(jest.mocked(globalThis.fetch).mock.calls[0]?.[0]).toBe(
      'https://tasks.example.com/api/organizations/org_1/ai-agents',
    );
  });

  it('updates workspace AI policy without leaking organizationId into the body', async () => {
    jest.mocked(globalThis.fetch).mockResolvedValue(
      jsonResponse(200, {
        organizationId: 'org_1',
        workspaceSettings: {
          ...settingsResponse.workspaceSettings,
          assistantEnabled: false,
          aiOversight: 'auto',
          capabilities: { backlog_triage: false },
        },
        providerStatus: settingsResponse.providerStatus,
      }),
    );

    await expect(
      updateOrganizationAgentSettings({
        organizationId: 'org_1',
        assistantEnabled: false,
        aiOversight: 'auto',
        capabilities: { backlog_triage: false },
      }),
    ).resolves.toMatchObject({
      organizationId: 'org_1',
      workspaceSettings: {
        assistantEnabled: false,
        aiOversight: 'auto',
        capabilities: { backlog_triage: false },
      },
    });

    const [url, init] = jest.mocked(globalThis.fetch).mock.calls[0] ?? [];
    expect(url).toBe('https://tasks.example.com/api/organizations/org_1/ai-agents');
    expect(init).toMatchObject({ method: 'PATCH' });
    expect(JSON.parse(String(init?.body))).toEqual({
      assistantEnabled: false,
      aiOversight: 'auto',
      capabilities: { backlog_triage: false },
    });
  });

  it('updates workspace model and execution policy fields', async () => {
    jest.mocked(globalThis.fetch).mockResolvedValue(
      jsonResponse(200, {
        organizationId: 'org_1',
        workspaceSettings: {
          ...settingsResponse.workspaceSettings,
          enabled: true,
          modelConfigId: null,
          provider: 'openai',
          model: 'gpt-5.4',
          executionMode: 'auto',
          allowWriteActions: true,
          requireApprovalForWrites: false,
          aiSafetyMode: 'strict',
          dailyRunLimit: 100,
        },
        providerStatus: settingsResponse.providerStatus,
      }),
    );

    await expect(
      updateOrganizationAgentSettings({
        organizationId: 'org_1',
        enabled: true,
        modelConfigId: null,
        provider: 'openai',
        model: 'gpt-5.4',
        executionMode: 'auto',
        allowWriteActions: true,
        requireApprovalForWrites: false,
        aiSafetyMode: 'strict',
        dailyRunLimit: 100,
      }),
    ).resolves.toMatchObject({
      organizationId: 'org_1',
      workspaceSettings: {
        enabled: true,
        provider: 'openai',
        model: 'gpt-5.4',
        executionMode: 'auto',
        allowWriteActions: true,
        requireApprovalForWrites: false,
        aiSafetyMode: 'strict',
        dailyRunLimit: 100,
      },
    });

    const [url, init] = jest.mocked(globalThis.fetch).mock.calls[0] ?? [];
    expect(url).toBe('https://tasks.example.com/api/organizations/org_1/ai-agents');
    expect(init).toMatchObject({ method: 'PATCH' });
    expect(JSON.parse(String(init?.body))).toEqual({
      enabled: true,
      modelConfigId: null,
      provider: 'openai',
      model: 'gpt-5.4',
      executionMode: 'auto',
      allowWriteActions: true,
      requireApprovalForWrites: false,
      aiSafetyMode: 'strict',
      dailyRunLimit: 100,
    });
  });
});
