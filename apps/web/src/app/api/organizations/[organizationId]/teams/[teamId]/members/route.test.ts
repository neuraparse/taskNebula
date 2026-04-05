const authMock = jest.fn();
const hasPermissionMock = jest.fn();
const dbSelectMock = jest.fn();
const dbInsertMock = jest.fn();
const dbUpdateMock = jest.fn();

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

jest.mock('@tasknebula/db', () => ({
  and: (...args: unknown[]) => ({ type: 'and', args }),
  asc: (value: unknown) => ({ type: 'asc', value }),
  db: {
    select: (...args: unknown[]) => dbSelectMock(...args),
    insert: (...args: unknown[]) => dbInsertMock(...args),
    update: (...args: unknown[]) => dbUpdateMock(...args),
  },
  eq: (left: unknown, right: unknown) => ({ type: 'eq', left, right }),
  organizationMembers: {
    id: 'organizationMembers.id',
    organizationId: 'organizationMembers.organizationId',
    userId: 'organizationMembers.userId',
  },
  teamMembers: {
    id: 'teamMembers.id',
    teamId: 'teamMembers.teamId',
    userId: 'teamMembers.userId',
    role: 'teamMembers.role',
    createdAt: 'teamMembers.createdAt',
  },
  teams: {
    id: 'teams.id',
    organizationId: 'teams.organizationId',
    leadId: 'teams.leadId',
    updatedAt: 'teams.updatedAt',
  },
  users: {
    id: 'users.id',
    name: 'users.name',
    email: 'users.email',
    image: 'users.image',
    status: 'users.status',
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

function whereOrderBuilder(result: unknown) {
  return {
    from: jest.fn().mockReturnValue({
      innerJoin: jest.fn().mockReturnValue({
        where: jest.fn().mockReturnValue({
          orderBy: jest.fn().mockResolvedValue(result),
        }),
      }),
    }),
  };
}

function returningBuilder(result: unknown) {
  return {
    values: jest.fn().mockReturnValue({
      returning: jest.fn().mockResolvedValue(result),
    }),
  };
}

function updateWhereBuilder(result?: unknown) {
  return {
    set: jest.fn().mockReturnValue({
      where: jest.fn().mockResolvedValue(result),
    }),
  };
}

describe('teamspace members route', () => {
  let NextRequestCtor: typeof import('next/server').NextRequest;
  let GET: typeof import('./route').GET;
  let POST: typeof import('./route').POST;

  beforeAll(async () => {
    ({ NextRequest: NextRequestCtor } = await import('next/server'));
    ({ GET, POST } = await import('./route'));
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns the members for a teamspace', async () => {
    authMock.mockResolvedValue({ user: { id: 'user-1' } });
    hasPermissionMock.mockResolvedValue(true);
    dbSelectMock
      .mockReturnValueOnce(
        limitBuilder([
          {
            id: 'team-1',
            organizationId: 'org-1',
            name: 'Platform',
          },
        ])
      )
      .mockReturnValueOnce(
        whereOrderBuilder([
          {
            id: 'user-1',
            teamRole: 'lead',
            joinedAt: new Date().toISOString(),
            name: 'Bayram',
            email: 'bayram@example.com',
            image: null,
            status: 'active',
          },
        ])
      );

    const response = await GET(new NextRequestCtor('http://localhost:3002/api/organizations/org-1/teams/team-1/members'), {
      params: Promise.resolve({ organizationId: 'org-1', teamId: 'team-1' }),
    });

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      team: expect.objectContaining({ id: 'team-1', name: 'Platform' }),
      members: [expect.objectContaining({ id: 'user-1', teamRole: 'lead' })],
    });
  });

  it('adds an organization member to the teamspace', async () => {
    authMock.mockResolvedValue({ user: { id: 'user-1' } });
    hasPermissionMock.mockResolvedValue(true);
    dbSelectMock
      .mockReturnValueOnce(
        limitBuilder([
          {
            id: 'team-1',
            organizationId: 'org-1',
            leadId: 'user-3',
          },
        ])
      )
      .mockReturnValueOnce(limitBuilder([{ id: 'org-member-2' }]))
      .mockReturnValueOnce(limitBuilder([]))
      .mockReturnValueOnce(limitBuilder([]))
      .mockReturnValueOnce(
        limitBuilder([
          {
            id: 'user-2',
            name: 'Platform Lead',
            email: 'lead@example.com',
            image: null,
            status: 'active',
          },
        ])
      );
    dbInsertMock.mockReturnValueOnce(
      returningBuilder([
        {
          id: 'membership-1',
          teamId: 'team-1',
          userId: 'user-2',
          role: 'lead',
          createdAt: new Date().toISOString(),
        },
      ])
    );
    dbUpdateMock.mockReturnValueOnce(updateWhereBuilder());

    const response = await POST(
      new NextRequestCtor('http://localhost:3002/api/organizations/org-1/teams/team-1/members', {
        method: 'POST',
        body: JSON.stringify({
          userId: 'user-2',
          role: 'lead',
        }),
      }),
      {
        params: Promise.resolve({ organizationId: 'org-1', teamId: 'team-1' }),
      }
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      member: expect.objectContaining({
        id: 'user-2',
        teamRole: 'lead',
        name: 'Platform Lead',
      }),
    });
  });
});
