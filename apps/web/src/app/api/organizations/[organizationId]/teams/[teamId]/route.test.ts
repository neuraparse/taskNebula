const authMock = jest.fn();
const hasPermissionMock = jest.fn();
const dbSelectMock = jest.fn();
const dbUpdateMock = jest.fn();
const dbDeleteMock = jest.fn();
const dbInsertMock = jest.fn();

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
    insert: (...args: unknown[]) => dbInsertMock(...args),
  },
  eq: (left: unknown, right: unknown) => ({ type: 'eq', left, right }),
  ne: (left: unknown, right: unknown) => ({ type: 'ne', left, right }),
  organizationMembers: {
    id: 'organizationMembers.id',
    organizationId: 'organizationMembers.organizationId',
    userId: 'organizationMembers.userId',
  },
  teamMembers: {
    id: 'teamMembers.id',
    teamId: 'teamMembers.teamId',
    userId: 'teamMembers.userId',
  },
  teams: {
    id: 'teams.id',
    organizationId: 'teams.organizationId',
    slug: 'teams.slug',
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

describe('teamspace detail route', () => {
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

  it('returns 404 when trying to update a missing teamspace', async () => {
    authMock.mockResolvedValue({ user: { id: 'user-1' } });
    hasPermissionMock.mockResolvedValue(true);
    dbSelectMock.mockReturnValueOnce(limitBuilder([]));

    const response = await PATCH(
      new NextRequestCtor('http://localhost:3002/api/organizations/org-1/teams/team-1', {
        method: 'PATCH',
        body: JSON.stringify({ name: 'Platform' }),
      }),
      {
        params: Promise.resolve({ organizationId: 'org-1', teamId: 'team-1' }),
      }
    );

    expect(response.status).toBe(404);
    await expect(response.json()).resolves.toEqual({ error: 'Teamspace not found' });
  });

  it('updates and deletes a teamspace when the user has access', async () => {
    authMock.mockResolvedValue({ user: { id: 'user-1' } });
    hasPermissionMock.mockResolvedValue(true);
    dbSelectMock
      .mockReturnValueOnce(
        limitBuilder([
          {
            id: 'team-1',
            organizationId: 'org-1',
            name: 'Platform',
            slug: 'platform',
            description: 'Old description',
            avatarUrl: null,
            leadId: 'user-2',
            settings: {},
            createdAt: new Date(),
            updatedAt: new Date(),
          },
        ])
      )
      .mockReturnValueOnce(limitBuilder([{ id: 'member-1' }]))
      .mockReturnValueOnce(limitBuilder([]))
      .mockReturnValueOnce(limitBuilder([{ id: 'membership-1' }]))
      .mockReturnValueOnce(limitBuilder([]));
    dbUpdateMock
      .mockReturnValueOnce(
        returningBuilder([
          {
            id: 'team-1',
            name: 'Platform Core',
            slug: 'platform-core',
          },
        ])
      )
      .mockReturnValueOnce(updateWhereBuilder());
      dbInsertMock.mockReturnValueOnce({ values: jest.fn().mockResolvedValue(undefined) });
    dbDeleteMock.mockReturnValueOnce(deleteWhereBuilder());

    const patchResponse = await PATCH(
      new NextRequestCtor('http://localhost:3002/api/organizations/org-1/teams/team-1', {
        method: 'PATCH',
        body: JSON.stringify({
          name: 'Platform Core',
          slug: 'platform-core',
          leadId: 'user-3',
        }),
      }),
      {
        params: Promise.resolve({ organizationId: 'org-1', teamId: 'team-1' }),
      }
    );

    expect(patchResponse.status).toBe(200);
    await expect(patchResponse.json()).resolves.toEqual({
      team: expect.objectContaining({
        id: 'team-1',
        name: 'Platform Core',
        slug: 'platform-core',
      }),
    });

    dbSelectMock.mockReset();
    dbSelectMock.mockReturnValueOnce(
      limitBuilder([
        {
          id: 'team-1',
          organizationId: 'org-1',
          name: 'Platform',
        },
      ])
    );

    const deleteResponse = await DELETE(
      new NextRequestCtor('http://localhost:3002/api/organizations/org-1/teams/team-1', {
        method: 'DELETE',
      }),
      {
        params: Promise.resolve({ organizationId: 'org-1', teamId: 'team-1' }),
      }
    );

    expect(deleteResponse.status).toBe(200);
    await expect(deleteResponse.json()).resolves.toEqual({ success: true });
  });
});
