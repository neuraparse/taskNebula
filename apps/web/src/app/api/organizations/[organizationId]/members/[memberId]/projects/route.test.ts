const authMock = jest.fn();
const hasPermissionMock = jest.fn();
const dbSelectMock = jest.fn();
const dbInsertMock = jest.fn();
const publishEventMock = jest.fn();
const getProjectMemberPermissionValuesMock = jest.fn();

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

jest.mock('drizzle-orm', () => ({
  and: (...args: unknown[]) => ({ type: 'and', args }),
  eq: (left: unknown, right: unknown) => ({ type: 'eq', left, right }),
  inArray: (col: unknown, values: unknown) => ({ type: 'inArray', col, values }),
}));

jest.mock('@tasknebula/db', () => ({
  db: {
    select: (...args: unknown[]) => dbSelectMock(...args),
    insert: (...args: unknown[]) => dbInsertMock(...args),
  },
  organizationMembers: {
    id: 'organizationMembers.id',
    organizationId: 'organizationMembers.organizationId',
    userId: 'organizationMembers.userId',
  },
  projects: {
    id: 'projects.id',
    organizationId: 'projects.organizationId',
  },
  projectMembers: {
    projectId: 'projectMembers.projectId',
    userId: 'projectMembers.userId',
  },
  auditLogs: {
    id: 'auditLogs.id',
  },
}));

function limitBuilder(result: unknown) {
  return {
    from: jest.fn().mockReturnValue({
      where: jest.fn().mockReturnValue({
        limit: jest.fn().mockResolvedValue(result),
      }),
    }),
  };
}

function fromWhereBuilder(result: unknown) {
  return {
    from: jest.fn().mockReturnValue({
      where: jest.fn().mockReturnValue({
        then: (resolve: (value: unknown) => unknown) => resolve(result),
      }),
    }),
  };
}

function valuesBuilder() {
  return {
    values: jest.fn().mockResolvedValue(undefined),
  };
}

describe('POST /api/organizations/[organizationId]/members/[memberId]/projects', () => {
  let NextRequestCtor: typeof import('next/server').NextRequest;
  let POST: typeof import('./route').POST;

  beforeAll(async () => {
    ({ NextRequest: NextRequestCtor } = await import('next/server'));
    ({ POST } = await import('./route'));
  });

  beforeEach(() => {
    authMock.mockReset();
    hasPermissionMock.mockReset();
    dbSelectMock.mockReset();
    dbInsertMock.mockReset();
    publishEventMock.mockReset();
    getProjectMemberPermissionValuesMock.mockReset();

    authMock.mockResolvedValue({ user: { id: 'admin-1' } });
    hasPermissionMock.mockResolvedValue(true);
    getProjectMemberPermissionValuesMock.mockReturnValue({
      canBrowseProject: 'true',
      canCreateIssues: 'true',
    });
    dbInsertMock.mockImplementation(() => valuesBuilder());
  });

  function buildRequest(body: unknown) {
    return new NextRequestCtor(
      'http://localhost:3002/api/organizations/org-1/members/user-1/projects',
      {
        method: 'POST',
        body: JSON.stringify(body),
      }
    );
  }

  const routeParams = {
    params: Promise.resolve({ organizationId: 'org-1', memberId: 'user-1' }),
  };

  it('rejects callers without project management permission', async () => {
    hasPermissionMock.mockResolvedValue(false);

    const response = await POST(
      buildRequest({ projectIds: ['proj-a'], projectRole: 'developer' }),
      routeParams
    );

    expect(response.status).toBe(403);
    expect(dbSelectMock).not.toHaveBeenCalled();
    expect(dbInsertMock).not.toHaveBeenCalled();
  });

  it('assigns valid projects and skips cross-org or duplicate project memberships', async () => {
    dbSelectMock.mockReturnValueOnce(limitBuilder([{ id: 'org-member-1' }]));
    dbSelectMock.mockReturnValueOnce(fromWhereBuilder([{ id: 'proj-a' }, { id: 'proj-b' }]));
    dbSelectMock.mockReturnValueOnce(fromWhereBuilder([{ projectId: 'proj-b' }]));

    const response = await POST(
      buildRequest({
        projectIds: ['proj-a', 'proj-b', 'proj-evil'],
        projectRole: 'tech_lead',
      }),
      routeParams
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      addedToProjects: ['proj-a'],
      skippedProjects: ['proj-b', 'proj-evil'],
    });

    expect(getProjectMemberPermissionValuesMock).toHaveBeenCalledWith('tech_lead');
    const valuesCalls = dbInsertMock.mock.results
      .map((result) => result.value)
      .filter((value) => value && typeof value === 'object' && 'values' in value)
      .flatMap((value) => (value as { values: jest.Mock }).values.mock.calls);
    expect(valuesCalls).toEqual(
      expect.arrayContaining([
        [
          expect.objectContaining({
            projectId: 'proj-a',
            userId: 'user-1',
            role: 'tech_lead',
            invitedBy: 'admin-1',
            canBrowseProject: 'true',
          }),
        ],
      ])
    );
    expect(publishEventMock).toHaveBeenCalledWith('member.added', 'admin-1', {
      organizationId: 'org-1',
    });
  });

  it('returns 404 when the target user is not a member of the workspace', async () => {
    dbSelectMock.mockReturnValueOnce(limitBuilder([]));

    const response = await POST(
      buildRequest({ projectIds: ['proj-a'], projectRole: 'developer' }),
      routeParams
    );

    expect(response.status).toBe(404);
    expect(dbInsertMock).not.toHaveBeenCalled();
  });
});
