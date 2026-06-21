/**
 * @jest-environment node
 */

const authMock = jest.fn();
const authorizeAutomationRuleMock = jest.fn();
const dbDeleteMock = jest.fn();
const dbSelectMock = jest.fn();

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

jest.mock('@/lib/automation/access', () => ({
  authorizeAutomationRule: (...args: unknown[]) => authorizeAutomationRuleMock(...args),
}));

jest.mock('drizzle-orm', () => ({
  eq: (left: unknown, right: unknown) => ({ type: 'eq', left, right }),
}));

jest.mock('@tasknebula/db', () => ({
  automationRules: {
    id: 'automationRules.id',
  },
  db: {
    delete: (...args: unknown[]) => dbDeleteMock(...args),
    select: (...args: unknown[]) => dbSelectMock(...args),
  },
}));

describe('/api/automation-rules/[ruleId]', () => {
  let DELETE: typeof import('./route').DELETE;

  beforeAll(async () => {
    ({ DELETE } = await import('./route'));
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('does not delete a rule when the scoped permission check fails', async () => {
    authMock.mockResolvedValue({ user: { id: 'user-1' } });
    authorizeAutomationRuleMock.mockResolvedValue({ status: 'forbidden' });

    const response = await DELETE(new Request('http://localhost/api/automation-rules/rule-1'), {
      params: Promise.resolve({ ruleId: 'rule-1' }),
    });

    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toEqual({
      error: 'Managing automation requires project or organization settings permission',
    });
    expect(dbDeleteMock).not.toHaveBeenCalled();
  });
});
