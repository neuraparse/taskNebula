/**
 * @jest-environment node
 */

const authMock = jest.fn();
const userHasWorkspaceAccessMock = jest.fn();

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

jest.mock('jose', () => ({
  SignJWT: jest.fn(),
}));

jest.mock('@/auth', () => ({
  auth: (...args: unknown[]) => authMock(...args),
}));

jest.mock('@/lib/auth/workspace-access', () => ({
  userHasWorkspaceAccess: (...args: unknown[]) => userHasWorkspaceAccessMock(...args),
}));

describe('POST /api/collab/token', () => {
  let POST: typeof import('./route').POST;

  beforeAll(async () => {
    ({ POST } = await import('./route'));
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('does not mint collaboration tokens for users without workspace access', async () => {
    authMock.mockResolvedValue({ user: { id: 'user-1' } });
    userHasWorkspaceAccessMock.mockResolvedValue(false);

    const response = await POST();

    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toEqual({
      error: 'Workspace access required',
    });
  });
});
