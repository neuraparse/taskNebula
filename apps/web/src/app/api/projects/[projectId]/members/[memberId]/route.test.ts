const authMock = jest.fn();
const resolveProjectByIdOrKeyMock = jest.fn();
const canReadProjectMock = jest.fn();
const publishEventMock = jest.fn();
const dbDeleteMock = jest.fn();
const dbInsertMock = jest.fn();

const dbQueryMock = {
  users: { findFirst: jest.fn() },
  projects: { findFirst: jest.fn() },
  organizationMembers: { findFirst: jest.fn() },
  projectMembers: { findFirst: jest.fn(), findMany: jest.fn() },
};

class MockNextRequest {
  constructor(public readonly url: string) {}
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

jest.mock('@/lib/realtime/events', () => ({
  publishEvent: (...args: unknown[]) => publishEventMock(...args),
}));

jest.mock('@paralleldrive/cuid2', () => ({
  createId: () => 'generated-id',
}));

jest.mock('@tasknebula/db', () => ({
  db: {
    query: dbQueryMock,
    delete: (...args: unknown[]) => dbDeleteMock(...args),
    insert: (...args: unknown[]) => dbInsertMock(...args),
    update: jest.fn(),
  },
  schema: {
    users: { id: 'users.id' },
    projects: { id: 'projects.id' },
    organizationMembers: {
      userId: 'organizationMembers.userId',
      organizationId: 'organizationMembers.organizationId',
      status: 'organizationMembers.status',
      role: 'organizationMembers.role',
    },
    projectMembers: {
      id: 'projectMembers.id',
      userId: 'projectMembers.userId',
      projectId: 'projectMembers.projectId',
      role: 'projectMembers.role',
    },
    auditLogs: { id: 'auditLogs.id' },
  },
  ROLE_DEFAULT_PERMISSIONS: { developer: {} },
  PERMISSION_KEYS: {},
  and: (...args: unknown[]) => ({ type: 'and', args }),
  eq: (left: unknown, right: unknown) => ({ type: 'eq', left, right }),
  hasPermission: () => false,
}));

function deleteReturningBuilder(result: unknown) {
  return {
    where: jest.fn().mockReturnValue({
      returning: jest.fn().mockResolvedValue(result),
    }),
  };
}

function insertValuesBuilder() {
  return {
    values: jest.fn().mockResolvedValue(undefined),
  };
}

describe('DELETE /api/projects/[projectId]/members/[memberId]', () => {
  let NextRequestCtor: typeof import('next/server').NextRequest;
  let DELETE: typeof import('./route').DELETE;

  beforeAll(async () => {
    ({ NextRequest: NextRequestCtor } = await import('next/server'));
    ({ DELETE } = await import('./route'));
  });

  beforeEach(() => {
    authMock.mockReset();
    resolveProjectByIdOrKeyMock.mockReset();
    canReadProjectMock.mockReset();
    publishEventMock.mockReset();
    dbDeleteMock.mockReset();
    dbInsertMock.mockReset();
    dbQueryMock.users.findFirst.mockReset();
    dbQueryMock.projects.findFirst.mockReset();
    dbQueryMock.organizationMembers.findFirst.mockReset();
    dbQueryMock.projectMembers.findFirst.mockReset();
    dbQueryMock.projectMembers.findMany.mockReset();

    authMock.mockResolvedValue({ user: { id: 'actor-1' } });
    resolveProjectByIdOrKeyMock.mockResolvedValue({ id: 'project-1', organizationId: 'org-1' });
    canReadProjectMock.mockResolvedValue(true);
    dbQueryMock.users.findFirst.mockResolvedValue(null);
    dbQueryMock.projects.findFirst.mockResolvedValue({ organizationId: 'org-1' });
    dbQueryMock.organizationMembers.findFirst.mockResolvedValue({ role: 'member' });
    dbQueryMock.projectMembers.findFirst
      .mockResolvedValueOnce({
        id: 'member-1',
        userId: 'target-1',
        projectId: 'project-1',
        role: 'developer',
      })
      .mockResolvedValueOnce({
        id: 'actor-member-1',
        userId: 'actor-1',
        projectId: 'project-1',
        role: 'developer',
        canManageMembers: 'true',
        canRemoveMembers: 'false',
      });
    dbDeleteMock.mockReturnValue(deleteReturningBuilder([{ id: 'member-1', userId: 'target-1' }]));
    dbInsertMock.mockReturnValue(insertValuesBuilder());
  });

  it('allows project member managers to remove project members', async () => {
    const response = await DELETE(
      new NextRequestCtor('http://localhost:3002/api/projects/TASK/members/member-1'),
      { params: Promise.resolve({ projectId: 'TASK', memberId: 'member-1' }) }
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual(expect.objectContaining({ success: true }));
    expect(dbDeleteMock).toHaveBeenCalled();
    expect(publishEventMock).toHaveBeenCalledWith('member.removed', 'actor-1', {
      organizationId: 'org-1',
      projectId: 'project-1',
      targetUserId: 'target-1',
    });
  });
});
