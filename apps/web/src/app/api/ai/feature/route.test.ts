/**
 * @jest-environment node
 */

const authMock = jest.fn();
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

jest.mock('@/lib/auth/workspace-access', () => ({
  userHasWorkspaceAccess: (...args: unknown[]) => userHasWorkspaceAccessMock(...args),
}));

jest.mock('@/lib/agents/system', () => ({
  getSystemAgentControlSettingsFromDb: (...args: unknown[]) =>
    getSystemAgentControlSettingsFromDbMock(...args),
}));

describe('GET /api/ai/feature', () => {
  let GET: typeof import('./route').GET;

  beforeAll(async () => {
    ({ GET } = await import('./route'));
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('does not reveal the global AI flag to anonymous callers', async () => {
    authMock.mockResolvedValue(null);

    const response = await GET();

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ enabled: false });
    expect(userHasWorkspaceAccessMock).not.toHaveBeenCalled();
    expect(getSystemAgentControlSettingsFromDbMock).not.toHaveBeenCalled();
  });

  it('does not reveal the global AI flag to users without workspace access', async () => {
    authMock.mockResolvedValue({ user: { id: 'user-1' } });
    userHasWorkspaceAccessMock.mockResolvedValue(false);

    const response = await GET();

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ enabled: false });
    expect(getSystemAgentControlSettingsFromDbMock).not.toHaveBeenCalled();
  });
});
