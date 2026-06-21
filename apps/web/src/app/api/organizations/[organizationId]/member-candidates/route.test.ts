const authMock = jest.fn();
const hasPermissionMock = jest.fn();
const resolveProjectByIdOrKeyMock = jest.fn();
const dbSelectMock = jest.fn();

class MockNextRequest {
  readonly nextUrl: URL;

  constructor(public readonly url: string) {
    this.nextUrl = new URL(url);
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

jest.mock('@/lib/projects/server', () => ({
  resolveProjectByIdOrKey: (...args: unknown[]) => resolveProjectByIdOrKeyMock(...args),
}));

jest.mock('@tasknebula/db', () => ({
  db: {
    select: (...args: unknown[]) => dbSelectMock(...args),
  },
  users: {
    id: 'users.id',
    name: 'users.name',
    email: 'users.email',
    image: 'users.image',
    status: 'users.status',
  },
  organizationMembers: {
    userId: 'organizationMembers.userId',
    organizationId: 'organizationMembers.organizationId',
    role: 'organizationMembers.role',
    status: 'organizationMembers.status',
  },
  projectMembers: {
    userId: 'projectMembers.userId',
    projectId: 'projectMembers.projectId',
  },
  and: (...args: unknown[]) => ({ type: 'and', args }),
  eq: (left: unknown, right: unknown) => ({ type: 'eq', left, right }),
  ilike: (left: unknown, right: unknown) => ({ type: 'ilike', left, right }),
  notInArray: (left: unknown, right: unknown) => ({ type: 'notInArray', left, right }),
  or: (...args: unknown[]) => ({ type: 'or', args }),
}));

function fromWhereBuilder(result: unknown) {
  return {
    from: jest.fn().mockReturnValue({
      where: jest.fn().mockResolvedValue(result),
    }),
  };
}

function orgMembersBuilder(result: unknown) {
  const chain = {
    innerJoin: jest.fn().mockReturnThis(),
    where: jest.fn().mockResolvedValue(result),
  };
  return {
    from: jest.fn().mockReturnValue(chain),
  };
}

function registeredUsersBuilder(result: unknown) {
  return {
    from: jest.fn().mockReturnValue({
      where: jest.fn().mockReturnValue({
        limit: jest.fn().mockResolvedValue(result),
      }),
    }),
  };
}

describe('GET /api/organizations/[organizationId]/member-candidates', () => {
  let NextRequestCtor: typeof import('next/server').NextRequest;
  let GET: typeof import('./route').GET;

  beforeAll(async () => {
    ({ NextRequest: NextRequestCtor } = await import('next/server'));
    ({ GET } = await import('./route'));
  });

  beforeEach(() => {
    authMock.mockReset();
    hasPermissionMock.mockReset();
    resolveProjectByIdOrKeyMock.mockReset();
    dbSelectMock.mockReset();

    authMock.mockResolvedValue({ user: { id: 'admin-1' } });
    hasPermissionMock.mockResolvedValue(true);
    resolveProjectByIdOrKeyMock.mockResolvedValue({ id: 'project-1', organizationId: 'org-1' });
  });

  it('includes registered users outside the workspace for callers that can invite members', async () => {
    dbSelectMock.mockReturnValueOnce(fromWhereBuilder([{ userId: 'already-project' }]));
    dbSelectMock.mockReturnValueOnce(
      orgMembersBuilder([
        {
          id: 'org-user-1',
          name: 'Org User',
          email: 'org@example.com',
          image: null,
          status: 'active',
          role: 'member',
          memberStatus: 'active',
        },
        {
          id: 'already-project',
          name: 'Already Project',
          email: 'already@example.com',
          image: null,
          status: 'active',
          role: 'member',
          memberStatus: 'active',
        },
      ])
    );
    dbSelectMock.mockReturnValueOnce(
      registeredUsersBuilder([
        {
          id: 'registered-user-1',
          name: 'Registered User',
          email: 'registered@example.com',
          image: null,
          status: 'active',
        },
      ])
    );

    const response = await GET(
      new NextRequestCtor(
        'http://localhost:3002/api/organizations/org-1/member-candidates?projectId=TASK'
      ),
      { params: Promise.resolve({ organizationId: 'org-1' }) }
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      canInviteRegisteredUsers: true,
      members: [
        expect.objectContaining({
          id: 'org-user-1',
          source: 'organization_member',
        }),
        expect.objectContaining({
          id: 'registered-user-1',
          source: 'registered_user',
          role: null,
        }),
      ],
    });
  });

  it('does not expose registered users when the caller cannot invite workspace members', async () => {
    hasPermissionMock.mockImplementation(async (_organizationId: string, permission: string) => {
      return permission === 'member:view';
    });
    dbSelectMock.mockReturnValueOnce(orgMembersBuilder([]));

    const response = await GET(
      new NextRequestCtor('http://localhost:3002/api/organizations/org-1/member-candidates'),
      { params: Promise.resolve({ organizationId: 'org-1' }) }
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      canInviteRegisteredUsers: false,
      members: [],
    });
    expect(dbSelectMock).toHaveBeenCalledTimes(1);
  });
});
