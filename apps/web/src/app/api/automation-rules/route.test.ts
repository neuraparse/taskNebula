/**
 * @jest-environment node
 */

const authMock = jest.fn();
const authorizeAutomationScopeMock = jest.fn();
const dbSelectMock = jest.fn();
const dbInsertMock = jest.fn();

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
  authorizeAutomationScope: (...args: unknown[]) => authorizeAutomationScopeMock(...args),
}));

jest.mock('drizzle-orm', () => ({
  and: (...args: unknown[]) => ({ type: 'and', args }),
  desc: (value: unknown) => ({ type: 'desc', value }),
  eq: (left: unknown, right: unknown) => ({ type: 'eq', left, right }),
  isNull: (value: unknown) => ({ type: 'isNull', value }),
  or: (...args: unknown[]) => ({ type: 'or', args }),
}));

jest.mock('@tasknebula/db', () => ({
  automationRules: {
    actions: 'automationRules.actions',
    conditions: 'automationRules.conditions',
    enabled: 'automationRules.enabled',
    id: 'automationRules.id',
    name: 'automationRules.name',
    organizationId: 'automationRules.organizationId',
    projectId: 'automationRules.projectId',
  },
  db: {
    insert: (...args: unknown[]) => dbInsertMock(...args),
    select: (...args: unknown[]) => dbSelectMock(...args),
  },
}));

describe('/api/automation-rules', () => {
  let GET: typeof import('./route').GET;
  let POST: typeof import('./route').POST;

  beforeAll(async () => {
    ({ GET, POST } = await import('./route'));
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('blocks listing automation rules when the scoped permission check fails', async () => {
    authMock.mockResolvedValue({ user: { id: 'user-1' } });
    authorizeAutomationScopeMock.mockResolvedValue({ status: 'forbidden' });

    const response = await GET(
      new Request('http://localhost/api/automation-rules?organizationId=org-1&projectId=PRJ')
    );

    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toEqual({
      error: 'Managing automation requires project or organization settings permission',
    });
    expect(dbSelectMock).not.toHaveBeenCalled();
  });

  it('creates project-scoped rules with the authorized canonical project id', async () => {
    authMock.mockResolvedValue({ user: { id: 'user-1' } });
    authorizeAutomationScopeMock.mockResolvedValue({
      status: 'ok',
      organizationId: 'org-1',
      projectId: 'project-cuid',
    });
    const valuesMock = jest.fn().mockReturnValue({
      returning: jest.fn().mockResolvedValue([{ id: 'rule-1' }]),
    });
    dbInsertMock.mockReturnValue({ values: valuesMock });

    const response = await POST(
      new Request('http://localhost/api/automation-rules', {
        method: 'POST',
        body: JSON.stringify({
          organizationId: 'org-1',
          projectId: 'PRJ',
          name: 'Auto assign',
          trigger: { type: 'issue_created' },
          actions: [{ type: 'assign_issue' }],
        }),
      })
    );

    expect(response.status).toBe(201);
    expect(valuesMock).toHaveBeenCalledWith(
      expect.objectContaining({
        organizationId: 'org-1',
        projectId: 'project-cuid',
        createdBy: 'user-1',
      })
    );
  });
});
