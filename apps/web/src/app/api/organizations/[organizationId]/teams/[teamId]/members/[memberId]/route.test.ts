const authMock = jest.fn();
const hasPermissionMock = jest.fn();
const dbSelectMock = jest.fn();
const dbUpdateMock = jest.fn();
const dbDeleteMock = jest.fn();

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
  db: {
    select: (...args: unknown[]) => dbSelectMock(...args),
    update: (...args: unknown[]) => dbUpdateMock(...args),
    delete: (...args: unknown[]) => dbDeleteMock(...args),
  },
  eq: (left: unknown, right: unknown) => ({ type: 'eq', left, right }),
  teamMembers: {
    id: 'teamMembers.id',
    teamId: 'teamMembers.teamId',
    userId: 'teamMembers.userId',
    role: 'teamMembers.role',
    createdAt: 'teamMembers.createdAt',
    updatedAt: 'teamMembers.updatedAt',
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

function returningBuilder(result: unknown) {
  return {
    set: jest.fn().mockReturnValue({
      where: jest.fn().mockReturnValue({
        returning: jest.fn().mockResolvedValue(result),
      }),
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

function deleteWhereBuilder(result?: unknown) {
  return {
    where: jest.fn().mockResolvedValue(result),
  };
}

describe('teamspace member detail route', () => {
  let NextRequestCtor: typeof import('next/server').NextRequest;
  let PATCH: typeof import('./route').PATCH;
  let DELETE: typeof import('./route').DELETE;

  beforeAll(async () => {
    ({ NextRequest: NextRequestCtor } = await import('next/server'));
    ({ PATCH, DELETE } = await import('./route'));
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('updates a teamspace member role and returns the hydrated member payload', async () => {
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
      .mockReturnValueOnce(
        limitBuilder([
          {
            id: 'membership-1',
            teamId: 'team-1',
            userId: 'user-2',
            role: 'member',
            createdAt: new Date().toISOString(),
          },
        ])
      )
      .mockReturnValueOnce(limitBuilder([{ id: 'membership-3' }]))
      .mockReturnValueOnce(
        limitBuilder([
          {
            id: 'user-2',
            name: 'Bayram',
            email: 'bayram@example.com',
            image: null,
            status: 'active',
          },
        ])
      );
    dbUpdateMock
      .mockReturnValueOnce(
        returningBuilder([
          {
            id: 'membership-1',
            role: 'lead',
            createdAt: new Date().toISOString(),
          },
        ])
      )
      .mockReturnValueOnce(updateWhereBuilder())
      .mockReturnValueOnce(updateWhereBuilder());

    const response = await PATCH(
      new NextRequestCtor('http://localhost:3002/api/organizations/org-1/teams/team-1/members/user-2', {
        method: 'PATCH',
        body: JSON.stringify({ role: 'lead' }),
      }),
      {
        params: Promise.resolve({ organizationId: 'org-1', teamId: 'team-1', memberId: 'user-2' }),
      }
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      member: expect.objectContaining({
        id: 'user-2',
        teamRole: 'lead',
        name: 'Bayram',
      }),
    });
  });

  it('prevents removing yourself from the teamspace', async () => {
    authMock.mockResolvedValue({ user: { id: 'user-1' } });
    hasPermissionMock.mockResolvedValue(true);

    const response = await DELETE(
      new NextRequestCtor('http://localhost:3002/api/organizations/org-1/teams/team-1/members/user-1', {
        method: 'DELETE',
      }),
      {
        params: Promise.resolve({ organizationId: 'org-1', teamId: 'team-1', memberId: 'user-1' }),
      }
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      error: 'Remove yourself from the teamspace from another admin account.',
    });
  });

  it('removes a teamspace member and clears lead ownership when needed', async () => {
    authMock.mockResolvedValue({ user: { id: 'user-1' } });
    hasPermissionMock.mockResolvedValue(true);
    dbSelectMock
      .mockReturnValueOnce(
        limitBuilder([
          {
            id: 'team-1',
            organizationId: 'org-1',
            leadId: 'user-2',
          },
        ])
      )
      .mockReturnValueOnce(
        limitBuilder([
          {
            id: 'membership-1',
            teamId: 'team-1',
            userId: 'user-2',
            role: 'lead',
          },
        ])
      )
      .mockReturnValueOnce(limitBuilder([]));
    dbDeleteMock.mockReturnValueOnce(deleteWhereBuilder());
    dbUpdateMock.mockReturnValueOnce(updateWhereBuilder());

    const response = await DELETE(
      new NextRequestCtor('http://localhost:3002/api/organizations/org-1/teams/team-1/members/user-2', {
        method: 'DELETE',
      }),
      {
        params: Promise.resolve({ organizationId: 'org-1', teamId: 'team-1', memberId: 'user-2' }),
      }
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ success: true });
  });
});
