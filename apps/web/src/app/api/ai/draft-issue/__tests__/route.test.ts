/**
 * @jest-environment node
 */
/* eslint-disable @typescript-eslint/no-require-imports */

// ---- Mocks must be declared before route import ----

jest.mock('@/lib/env', () => ({
  env: { NODE_ENV: 'test' },
  features: { webhooks: true, email: false, pushNotifications: false },
  rateLimit: { enabled: false, maxRequests: 100, windowMs: 60000 },
  isDevelopment: false,
  isProduction: false,
  isTest: true,
}));

const authMock = jest.fn();
jest.mock('@/auth', () => ({ auth: (...args: any[]) => authMock(...args) }));

const createAuditLogMock = jest.fn().mockResolvedValue(undefined);
jest.mock('@tasknebula/db', () => {
  const makeSelectChain = () => {
    const chain: any = {
      from: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      limit: jest.fn().mockResolvedValue([]),
    };
    return chain;
  };
  return {
    db: {
      select: jest.fn(() => makeSelectChain()),
      insert: jest.fn().mockReturnValue({
        values: jest.fn().mockReturnValue({ returning: jest.fn().mockResolvedValue([]) }),
      }),
    },
    createAuditLog: (...args: any[]) => createAuditLogMock(...args),
    organizationMembers: { userId: 'userId', organizationId: 'organizationId' },
    projects: {
      id: 'id',
      name: 'name',
      key: 'key',
      organizationId: 'organizationId',
    },
    users: { id: 'id', isSuperAdmin: 'isSuperAdmin' },
    issues: { projectId: 'projectId', labels: 'labels' },
    organizations: { id: 'id', settings: 'settings' },
    notifications: { userId: 'userId', type: 'type', title: 'title', message: 'message', projectId: 'projectId' },
  };
});

const gateMock = jest.fn().mockResolvedValue(true);
jest.mock('@/lib/ai/feature-gate', () => ({
  isAiFeatureEnabled: () => gateMock(),
  aiDisabledResponse: () => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports, @typescript-eslint/no-var-requires
    const { NextResponse } = require('next/server');
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  },
}));

const draftMock = jest.fn();
jest.mock('@/lib/ai/draft-issue', () => {
  class AiDraftError extends Error {
    constructor(public code: string, message: string) {
      super(message);
    }
  }
  return {
    AiDraftError,
    draftIssue: (...args: any[]) => draftMock(...args),
  };
});

jest.mock('@/lib/agents/system', () => ({
  getSystemAgentControlSettingsFromDb: jest.fn().mockResolvedValue({
    globalEnabled: true,
    allowWriteActions: true,
    requireSupervisionForAutoMode: true,
    maxConcurrentRuns: 6,
    providerCredentials: {},
  }),
}));

jest.mock('@/lib/agents/credentials', () => ({
  resolveProviderApiKeyFromSettings: jest.fn().mockReturnValue(null),
}));

jest.mock('@/lib/agents/config', () => ({
  normalizeWorkspaceAgentSettings: jest.fn().mockReturnValue({
    enabled: true,
    assistantEnabled: true,
    provider: 'anthropic',
    model: 'claude-sonnet-4-6',
  }),
}));

// ---- Helpers ----

function buildRequest(body: unknown) {
  return new Request('http://localhost:3000/api/ai/draft-issue', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  }) as any;
}

function mockDbSelect(...queueOfResults: any[][]) {
  // eslint-disable-next-line @typescript-eslint/no-require-imports, @typescript-eslint/no-var-requires
  const { db } = require('@tasknebula/db');
  for (const rows of queueOfResults) {
    (db.select as jest.Mock).mockImplementationOnce(() => ({
      from: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      limit: jest.fn().mockResolvedValue(rows),
    }));
  }
}

function mockWorkspaceAssistant(assistantEnabled: boolean) {
  // eslint-disable-next-line @typescript-eslint/no-require-imports, @typescript-eslint/no-var-requires
  const { normalizeWorkspaceAgentSettings } = require('@/lib/agents/config');
  (normalizeWorkspaceAgentSettings as jest.Mock).mockReturnValue({
    enabled: false,
    assistantEnabled,
    provider: 'anthropic',
    model: 'claude-sonnet-4-6',
  });
}

// ---- Tests ----

describe('POST /api/ai/draft-issue', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    gateMock.mockResolvedValue(true);
    authMock.mockResolvedValue({ user: { id: 'user-1' } });
    mockWorkspaceAssistant(true);
  });

  it('returns 404 when platform AI is disabled', async () => {
    gateMock.mockResolvedValueOnce(false);
    const { POST } = await import('../route');
    const response = await POST(
      buildRequest({ projectId: 'p-1', prompt: 'test prompt' })
    );
    expect(response.status).toBe(404);
  });

  it('returns 401 when unauthenticated', async () => {
    authMock.mockResolvedValueOnce(null);
    const { POST } = await import('../route');
    const response = await POST(
      buildRequest({ projectId: 'p-1', prompt: 'test prompt' })
    );
    expect(response.status).toBe(401);
  });

  it('returns 400 on invalid body (prompt too short)', async () => {
    const { POST } = await import('../route');
    const response = await POST(buildRequest({ projectId: 'p-1', prompt: 'x' }));
    expect(response.status).toBe(400);
  });

  it('returns 404 when user is not a member of the project org', async () => {
    mockDbSelect(
      [{ isSuperAdmin: false }],                         // user
      [{ organizationId: 'org-1' }],                     // project for access check
      []                                                 // orgMember — empty → no access
    );
    const { POST } = await import('../route');
    const response = await POST(
      buildRequest({ projectId: 'p-1', prompt: 'a valid prompt' })
    );
    expect(response.status).toBe(404);
  });

  it('returns 412 when workspace AI Assistant toggle is off', async () => {
    mockWorkspaceAssistant(false);
    mockDbSelect(
      [{ isSuperAdmin: false }],                                                // user
      [{ organizationId: 'org-1' }],                                            // project access
      [{ role: 'member' }],                                                     // orgMember
      [{ id: 'p-1', name: 'Acme', key: 'ACME', organizationId: 'org-1' }],      // project detail
      [{ settings: { aiAgents: { enabled: false } } }]                          // org settings for workspace check
    );
    const { POST } = await import('../route');
    const response = await POST(
      buildRequest({ projectId: 'p-1', prompt: 'a valid prompt' })
    );
    expect(response.status).toBe(412);
    const body = await response.json();
    expect(body.code).toBe('assistant_disabled');
  });

  it('returns draft on happy path and writes an audit log', async () => {
    mockDbSelect(
      [{ isSuperAdmin: false }],                                                // user
      [{ organizationId: 'org-1' }],                                            // project access
      [{ role: 'member' }],                                                     // orgMember
      [{ id: 'p-1', name: 'Acme', key: 'ACME', organizationId: 'org-1' }],      // project detail
      [{ settings: { aiAgents: { enabled: true } } }],                          // org settings for workspace check
      [{ labels: ['backend'] }, { labels: ['frontend'] }],                      // issue labels
      [{ settings: { aiAgents: { enabled: true, provider: 'native' } } }]       // org settings for resolveProviderAndKey
    );

    draftMock.mockResolvedValueOnce({
      type: 'task',
      title: 'Ship it',
      description: null,
      priority: 'medium',
      labels: ['backend'],
      estimate: null,
    });

    const { POST } = await import('../route');
    const response = await POST(
      buildRequest({ projectId: 'p-1', prompt: 'Ship the thing' })
    );
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.draft.type).toBe('task');
    expect(body.draft.title).toBe('Ship it');
    expect(createAuditLogMock).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'agent.run_completed' })
    );
  });

  it('returns 502 on provider errors and audits failure', async () => {
    mockDbSelect(
      [{ isSuperAdmin: false }],
      [{ organizationId: 'org-1' }],
      [{ role: 'member' }],
      [{ id: 'p-1', name: 'Acme', key: 'ACME', organizationId: 'org-1' }],
      [{ settings: { aiAgents: { enabled: true } } }],
      [],
      [{ settings: { aiAgents: { enabled: true, provider: 'native' } } }]
    );

    const { AiDraftError } = await import('@/lib/ai/draft-issue');
    draftMock.mockRejectedValueOnce(new AiDraftError('provider_error', 'Boom'));

    const { POST } = await import('../route');
    const response = await POST(
      buildRequest({ projectId: 'p-1', prompt: 'Test prompt' })
    );
    expect(response.status).toBe(502);
    expect(createAuditLogMock).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'agent.run_failed' })
    );
  });
});
