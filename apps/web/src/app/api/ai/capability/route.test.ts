/**
 * @jest-environment node
 */

const authMock = jest.fn();
const dbSelectMock = jest.fn();
const isActiveOrganizationMemberMock = jest.fn();
const userHasWorkspaceAccessMock = jest.fn();
const getSystemAgentControlSettingsFromDbMock = jest.fn();

class MockNextResponse {
  constructor(
    private readonly payload: unknown,
    init?: { status?: number }
  ) {
    this.status = init?.status || 200;
  }

  status: number;

  async json() {
    return this.payload;
  }

  static json(payload: unknown, init?: { status?: number }) {
    return new MockNextResponse(payload, init);
  }
}

jest.mock('next/server', () => ({
  NextResponse: MockNextResponse,
}));

jest.mock('@/auth', () => ({
  auth: (...args: unknown[]) => authMock(...args),
}));

jest.mock('@/lib/auth/access-control', () => ({
  isActiveOrganizationMember: (...args: unknown[]) => isActiveOrganizationMemberMock(...args),
}));

jest.mock('@/lib/auth/workspace-access', () => ({
  userHasWorkspaceAccess: (...args: unknown[]) => userHasWorkspaceAccessMock(...args),
}));

jest.mock('@/lib/agents/system', () => ({
  getSystemAgentControlSettingsFromDb: (...args: unknown[]) =>
    getSystemAgentControlSettingsFromDbMock(...args),
}));

jest.mock('@/lib/agents/credentials', () => ({
  getProviderCredentialStatusFromSettings: () => ({
    configured: false,
    source: null,
  }),
}));

jest.mock('@/lib/agents/config', () => ({
  normalizeWorkspaceAgentSettings: () => ({
    assistantEnabled: false,
    enabled: false,
    model: '',
    provider: 'native',
  }),
}));

jest.mock('@tasknebula/db', () => ({
  db: {
    select: (...args: unknown[]) => dbSelectMock(...args),
  },
  eq: (left: unknown, right: unknown) => ({ type: 'eq', left, right }),
  organizations: {
    id: 'organizations.id',
    settings: 'organizations.settings',
  },
}));

describe('GET /api/ai/capability', () => {
  let GET: typeof import('./route').GET;

  beforeAll(async () => {
    ({ GET } = await import('./route'));
  });

  beforeEach(() => {
    jest.clearAllMocks();
    userHasWorkspaceAccessMock.mockResolvedValue(true);
  });

  it('does not read platform AI settings for users without workspace access', async () => {
    authMock.mockResolvedValue({ user: { id: 'user-1' } });
    userHasWorkspaceAccessMock.mockResolvedValue(false);

    const response = await GET(new Request('http://localhost/api/ai/capability'));

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      platformEnabled: false,
      assistantEnabled: false,
      agentsEnabled: false,
      canDraft: false,
      canRunAgents: false,
    });
    expect(getSystemAgentControlSettingsFromDbMock).not.toHaveBeenCalled();
    expect(dbSelectMock).not.toHaveBeenCalled();
  });

  it('does not read organization AI settings for non-members', async () => {
    authMock.mockResolvedValue({ user: { id: 'user-1' } });
    getSystemAgentControlSettingsFromDbMock.mockResolvedValue({
      globalEnabled: true,
      providerCredentials: null,
    });
    isActiveOrganizationMemberMock.mockResolvedValue(false);

    const response = await GET(
      new Request('http://localhost/api/ai/capability?organizationId=org-1')
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      platformEnabled: true,
      assistantEnabled: false,
      agentsEnabled: false,
      canDraft: false,
      canRunAgents: false,
    });
    expect(dbSelectMock).not.toHaveBeenCalled();
  });
});
