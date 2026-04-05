const authMock = jest.fn();
const hasPermissionMock = jest.fn();
const dbSelectMock = jest.fn();
const dbInsertMock = jest.fn();

class MockNextRequest {
  private readonly bodyValue: string;

  constructor(
    public readonly url: string,
    private readonly init?: { method?: string; headers?: Record<string, string>; body?: string }
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
  },
  eq: (left: unknown, right: unknown) => ({ type: 'eq', left, right }),
  inArray: (left: unknown, right: unknown[]) => ({ type: 'inArray', left, right }),
  ne: (left: unknown, right: unknown) => ({ type: 'ne', left, right }),
  organizationMembers: {
    id: 'organizationMembers.id',
    organizationId: 'organizationMembers.organizationId',
    userId: 'organizationMembers.userId',
  },
  projects: {
    organizationId: 'projects.organizationId',
    teamId: 'projects.teamId',
  },
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
    name: 'teams.name',
    slug: 'teams.slug',
    leadId: 'teams.leadId',
  },
  users: {
    id: 'users.id',
    name: 'users.name',
    email: 'users.email',
    image: 'users.image',
  },
}));

function whereBuilder(result: unknown) {
  return {
    from: jest.fn().mockReturnValue({
      where: jest.fn().mockResolvedValue(result),
    }),
  };
}

function orderBuilder(result: unknown) {
  return {
    from: jest.fn().mockReturnValue({
      where: jest.fn().mockReturnValue({
        orderBy: jest.fn().mockResolvedValue(result),
      }),
    }),
  };
}

function limitBuilder(result: unknown) {
  return {
    from: jest.fn().mockReturnValue({
      where: jest.fn().mockReturnValue({
        limit: jest.fn().mockResolvedValue(result),
      }),
    }),
  };
}

function insertReturning(result: unknown) {
  return {
    values: jest.fn().mockReturnValue({
      returning: jest.fn().mockResolvedValue(result),
    }),
  };
}

function insertResolving(result?: unknown) {
  return {
    values: jest.fn().mockResolvedValue(result),
  };
}

describe('organization teamspaces route', () => {
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

  it('returns enriched teamspaces for an accessible organization', async () => {
    authMock.mockResolvedValue({ user: { id: 'user-1' } });
    hasPermissionMock.mockResolvedValue(true);
    dbSelectMock
      .mockReturnValueOnce(
        orderBuilder([
          {
            id: 'team-1',
            organizationId: 'org-1',
            name: 'Platform',
            slug: 'platform',
            description: 'Core platform',
            avatarUrl: null,
            leadId: 'lead-1',
            settings: {},
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          },
        ])
      )
      .mockReturnValueOnce(whereBuilder([{ teamId: 'team-1', role: 'lead' }]))
      .mockReturnValueOnce(whereBuilder([{ teamId: 'team-1' }, { teamId: 'team-1' }]))
      .mockReturnValueOnce(whereBuilder([{ teamId: 'team-1' }]))
      .mockReturnValueOnce(
        whereBuilder([
          { id: 'lead-1', name: 'Platform Lead', email: 'lead@example.com', image: null },
        ])
      );

    const response = await GET(new NextRequestCtor('http://localhost:3002/api/organizations/org-1/teams'), {
      params: Promise.resolve({ organizationId: 'org-1' }),
    });

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      teams: [
        expect.objectContaining({
          id: 'team-1',
          name: 'Platform',
          isMember: true,
          currentUserRole: 'lead',
          memberCount: 2,
          projectCount: 1,
          lead: expect.objectContaining({
            id: 'lead-1',
            name: 'Platform Lead',
          }),
        }),
      ],
    });
  });

  it('creates a new teamspace and returns the serialized payload', async () => {
    authMock.mockResolvedValue({ user: { id: 'user-1' } });
    hasPermissionMock.mockResolvedValue(true);
    dbSelectMock
      .mockReturnValueOnce(limitBuilder([{ id: 'org-member-1' }]))
      .mockReturnValueOnce(limitBuilder([]))
      .mockReturnValueOnce(
        orderBuilder([
          {
            id: 'team-1',
            organizationId: 'org-1',
            name: 'Platform',
            slug: 'platform',
            description: 'Core platform',
            avatarUrl: null,
            leadId: 'user-2',
            settings: {},
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          },
        ])
      )
      .mockReturnValueOnce(whereBuilder([{ teamId: 'team-1', role: 'member' }]))
      .mockReturnValueOnce(whereBuilder([{ teamId: 'team-1' }, { teamId: 'team-1' }]))
      .mockReturnValueOnce(whereBuilder([]))
      .mockReturnValueOnce(
        whereBuilder([
          { id: 'user-2', name: 'Platform Lead', email: 'lead@example.com', image: null },
        ])
      );
    dbInsertMock
      .mockReturnValueOnce(
        insertReturning([
          {
            id: 'team-1',
            organizationId: 'org-1',
            name: 'Platform',
            slug: 'platform',
            description: 'Core platform',
            avatarUrl: null,
            leadId: 'user-2',
            settings: {},
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          },
        ])
      )
      .mockReturnValueOnce(insertResolving());

    const response = await POST(
      new NextRequestCtor('http://localhost:3002/api/organizations/org-1/teams', {
        method: 'POST',
        body: JSON.stringify({
          name: 'Platform',
          description: 'Core platform',
          leadId: 'user-2',
        }),
      }),
      {
        params: Promise.resolve({ organizationId: 'org-1' }),
      }
    );

    expect(response.status).toBe(201);
    await expect(response.json()).resolves.toEqual({
      team: expect.objectContaining({
        id: 'team-1',
        name: 'Platform',
        slug: 'platform',
        memberCount: 2,
      }),
    });
  });
});
