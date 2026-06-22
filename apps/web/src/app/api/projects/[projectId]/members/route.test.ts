const authMock = jest.fn();
const resolveProjectByIdOrKeyMock = jest.fn();
const canReadProjectMock = jest.fn();
const canManageProjectMembersMock = jest.fn();
const hasPermissionMock = jest.fn();
const getProjectMemberPermissionValuesMock = jest.fn();
const publishEventMock = jest.fn();
const dbInsertMock = jest.fn();
const dbSelectMock = jest.fn();
const dbUpdateMock = jest.fn();

const dbQueryMock = {
  projectMembers: { findMany: jest.fn() },
  organizationMembers: { findFirst: jest.fn() },
  users: { findFirst: jest.fn() },
};

class MockNextRequest {
  private readonly bodyValue: string;

  constructor(
    public readonly url: string,
    private readonly init?: { method?: string; body?: string }
  ) {
    this.bodyValue = init?.body || '';
  }

  async json() {
    return JSON.parse(this.bodyValue || '{}');
  }
}

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
  NextRequest: MockNextRequest,
  NextResponse: MockNextResponse,
}));

jest.mock('@/auth', () => ({
  auth: (...args: unknown[]) => authMock(...args),
}));

jest.mock('@/lib/projects/server', () => ({
  resolveProjectByIdOrKey: (...args: unknown[]) => resolveProjectByIdOrKeyMock(...args),
}));

jest.mock('@/lib/auth/access-control', () => ({
  canReadProject: (...args: unknown[]) => canReadProjectMock(...args),
}));

jest.mock('@/lib/projects/member-access', () => ({
  canManageProjectMembers: (...args: unknown[]) => canManageProjectMembersMock(...args),
}));

jest.mock('@/lib/auth/permissions', () => ({
  hasPermission: (...args: unknown[]) => hasPermissionMock(...args),
}));

jest.mock('@/lib/projects/member-permissions', () => ({
  getProjectMemberPermissionValues: (...args: unknown[]) =>
    getProjectMemberPermissionValuesMock(...args),
}));

jest.mock('@/lib/realtime/events', () => ({
  publishEvent: (...args: unknown[]) => publishEventMock(...args),
}));

jest.mock('@paralleldrive/cuid2', () => ({
  createId: () => 'generated-id',
}));

jest.mock('@tasknebula/db', () => ({
  db: {
    query: dbQueryMock,
    insert: (...args: unknown[]) => dbInsertMock(...args),
    select: (...args: unknown[]) => dbSelectMock(...args),
    update: (...args: unknown[]) => dbUpdateMock(...args),
    transaction: (callback: (tx: unknown) => unknown) =>
      callback({
        insert: (...args: unknown[]) => dbInsertMock(...args),
        select: (...args: unknown[]) => dbSelectMock(...args),
        update: (...args: unknown[]) => dbUpdateMock(...args),
      }),
  },
  schema: {
    users: {
      id: 'users.id',
      status: 'users.status',
    },
    organizationMembers: {
      id: 'organizationMembers.id',
      userId: 'organizationMembers.userId',
      organizationId: 'organizationMembers.organizationId',
      role: 'organizationMembers.role',
      status: 'organizationMembers.status',
      updatedAt: 'organizationMembers.updatedAt',
    },
    projectMembers: {
      id: 'projectMembers.id',
      userId: 'projectMembers.userId',
      projectId: 'projectMembers.projectId',
    },
  },
  auditLogs: {
    id: 'auditLogs.id',
  },
  and: (...args: unknown[]) => ({ type: 'and', args }),
  eq: (left: unknown, right: unknown) => ({ type: 'eq', left, right }),
}));

function valuesReturningBuilder(result: unknown) {
  const returning = jest.fn().mockResolvedValue(result);
  return {
    values: jest.fn().mockReturnValue({
      onConflictDoNothing: jest.fn().mockReturnValue({ returning }),
      returning,
    }),
  };
}

function valuesOnlyBuilder() {
  return {
    values: jest.fn().mockResolvedValue(undefined),
  };
}

function selectLimitBuilder(result: unknown) {
  return {
    from: jest.fn().mockReturnValue({
      where: jest.fn().mockReturnValue({
        limit: jest.fn().mockResolvedValue(result),
      }),
    }),
  };
}

describe('POST /api/projects/[projectId]/members', () => {
  let NextRequestCtor: typeof import('next/server').NextRequest;
  let POST: typeof import('./route').POST;

  beforeAll(async () => {
    ({ NextRequest: NextRequestCtor } = await import('next/server'));
    ({ POST } = await import('./route'));
  });

  beforeEach(() => {
    authMock.mockReset();
    resolveProjectByIdOrKeyMock.mockReset();
    canReadProjectMock.mockReset();
    canManageProjectMembersMock.mockReset();
    hasPermissionMock.mockReset();
    getProjectMemberPermissionValuesMock.mockReset();
    publishEventMock.mockReset();
    dbInsertMock.mockReset();
    dbSelectMock.mockReset();
    dbUpdateMock.mockReset();
    dbQueryMock.organizationMembers.findFirst.mockReset();
    dbQueryMock.users.findFirst.mockReset();

    authMock.mockResolvedValue({ user: { id: 'admin-1' } });
    resolveProjectByIdOrKeyMock.mockResolvedValue({ id: 'project-1', organizationId: 'org-1' });
    canReadProjectMock.mockResolvedValue(true);
    canManageProjectMembersMock.mockResolvedValue(true);
    hasPermissionMock.mockResolvedValue(true);
    getProjectMemberPermissionValuesMock.mockReturnValue({ canBrowseProject: 'true' });
  });

  function buildRequest(body: unknown) {
    return new NextRequestCtor('http://localhost:3002/api/projects/TASK/members', {
      method: 'POST',
      body: JSON.stringify(body),
    });
  }

  it('adds a registered active user to the workspace before adding them to the project', async () => {
    dbQueryMock.organizationMembers.findFirst.mockResolvedValue(null);
    dbQueryMock.users.findFirst.mockResolvedValue({
      id: 'registered-user-1',
      email: 'registered@example.com',
    });
    dbSelectMock.mockReturnValueOnce(selectLimitBuilder([]));

    dbInsertMock
      .mockReturnValueOnce(valuesReturningBuilder([{ id: 'org-member-1' }]))
      .mockReturnValueOnce(valuesOnlyBuilder())
      .mockReturnValueOnce(
        valuesReturningBuilder([
          {
            id: 'project-member-1',
            projectId: 'project-1',
            userId: 'registered-user-1',
            role: 'developer',
          },
        ])
      );

    const response = await POST(buildRequest({ userId: 'registered-user-1', role: 'developer' }), {
      params: Promise.resolve({ projectId: 'TASK' }),
    });

    expect(response.status).toBe(201);
    await expect(response.json()).resolves.toEqual(
      expect.objectContaining({
        id: 'project-member-1',
        userId: 'registered-user-1',
      })
    );

    const valuesCalls = dbInsertMock.mock.results
      .map((result) => result.value)
      .filter((value) => value && typeof value === 'object' && 'values' in value)
      .flatMap((value) => (value as { values: jest.Mock }).values.mock.calls);

    expect(valuesCalls).toEqual(
      expect.arrayContaining([
        [
          expect.objectContaining({
            organizationId: 'org-1',
            userId: 'registered-user-1',
            role: 'member',
            status: 'active',
          }),
        ],
        [
          expect.objectContaining({
            projectId: 'project-1',
            userId: 'registered-user-1',
            role: 'developer',
            invitedBy: 'admin-1',
            canBrowseProject: 'true',
          }),
        ],
      ])
    );
    expect(hasPermissionMock).toHaveBeenCalledWith('org-1', 'member:invite');
    expect(publishEventMock).toHaveBeenCalledWith('member.added', 'admin-1', {
      organizationId: 'org-1',
      projectId: 'project-1',
      targetUserId: 'registered-user-1',
    });
  });

  it('keeps the old guard when caller can manage project members but cannot add workspace members', async () => {
    dbQueryMock.organizationMembers.findFirst.mockResolvedValue(null);
    dbQueryMock.users.findFirst.mockResolvedValue({
      id: 'registered-user-1',
      email: 'registered@example.com',
    });
    hasPermissionMock.mockResolvedValue(false);

    const response = await POST(buildRequest({ userId: 'registered-user-1', role: 'developer' }), {
      params: Promise.resolve({ projectId: 'TASK' }),
    });

    expect(response.status).toBe(400);
    expect(dbInsertMock).not.toHaveBeenCalled();
  });

  it('does not create workspace membership when the user is already a project member', async () => {
    dbQueryMock.organizationMembers.findFirst.mockResolvedValue(null);
    dbQueryMock.users.findFirst.mockResolvedValue({
      id: 'registered-user-1',
      email: 'registered@example.com',
    });
    dbSelectMock.mockReturnValueOnce(selectLimitBuilder([{ id: 'project-member-1' }]));

    const response = await POST(buildRequest({ userId: 'registered-user-1', role: 'developer' }), {
      params: Promise.resolve({ projectId: 'TASK' }),
    });

    expect(response.status).toBe(409);
    expect(dbInsertMock).not.toHaveBeenCalled();
    expect(publishEventMock).not.toHaveBeenCalled();
  });
});
