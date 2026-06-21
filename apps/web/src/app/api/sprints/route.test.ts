const authMock = jest.fn();
const dbSelectMock = jest.fn();
const dbInsertMock = jest.fn();
const publishEventMock = jest.fn();

class MockNextRequest {
  private readonly bodyValue: string;
  readonly nextUrl: URL;

  constructor(
    public readonly url: string,
    private readonly init?: { method?: string; headers?: Record<string, string>; body?: string }
  ) {
    this.nextUrl = new URL(url);
    this.bodyValue = init?.body || '';
  }

  get method() {
    return this.init?.method || 'GET';
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

jest.mock('@/lib/realtime/events', () => ({
  publishEvent: (...args: unknown[]) => publishEventMock(...args),
}));

jest.mock('@paralleldrive/cuid2', () => ({
  createId: () => 'generated-id',
}));

jest.mock('@tasknebula/db', () => ({
  db: {
    select: (...args: unknown[]) => dbSelectMock(...args),
    insert: (...args: unknown[]) => dbInsertMock(...args),
  },
  sprints: {
    id: 'sprints.id',
    projectId: 'sprints.projectId',
    name: 'sprints.name',
    goal: 'sprints.goal',
    startDate: 'sprints.startDate',
    endDate: 'sprints.endDate',
    status: 'sprints.status',
    createdAt: 'sprints.createdAt',
    updatedAt: 'sprints.updatedAt',
    createdBy: 'sprints.createdBy',
    updatedBy: 'sprints.updatedBy',
  },
  issues: {
    id: 'issues.id',
    sprintId: 'issues.sprintId',
  },
  projects: {
    id: 'projects.id',
    key: 'projects.key',
    organizationId: 'projects.organizationId',
  },
  projectMembers: {
    userId: 'projectMembers.userId',
    projectId: 'projectMembers.projectId',
    role: 'projectMembers.role',
    canManageSprints: 'projectMembers.canManageSprints',
  },
  organizationMembers: {
    userId: 'organizationMembers.userId',
    organizationId: 'organizationMembers.organizationId',
    role: 'organizationMembers.role',
    status: 'organizationMembers.status',
  },
  users: {
    id: 'users.id',
    isSuperAdmin: 'users.isSuperAdmin',
  },
  ROLE_DEFAULT_PERMISSIONS: {
    viewer: {},
    product_owner: {
      canManageSprints: true,
    },
    scrum_master: {
      canManageSprints: true,
    },
    tech_lead: {
      canManageSprints: true,
    },
  },
  hasPermission: (role: string, permission: string, isSuperAdmin = false) => {
    if (isSuperAdmin) return true;
    if (permission !== 'project:manage') return false;
    return role === 'owner' || role === 'admin';
  },
}));

jest.mock('drizzle-orm', () => ({
  and: (...args: unknown[]) => ({ type: 'and', args }),
  desc: (value: unknown) => ({ type: 'desc', value }),
  eq: (left: unknown, right: unknown) => ({ type: 'eq', left, right }),
  count: () => ({ type: 'count' }),
  inArray: (col: unknown, values: unknown) => ({ type: 'inArray', col, values }),
}));

// Returns a thenable chain where .limit() and awaiting the chain both resolve to the result.
function chainable(result: unknown) {
  const chain: {
    from: () => typeof chain;
    where: () => typeof chain;
    orderBy: () => Promise<unknown>;
    limit: () => Promise<unknown>;
    leftJoin: () => typeof chain;
    innerJoin: () => typeof chain;
    groupBy: () => Promise<unknown>;
    then: (resolve: (value: unknown) => unknown) => unknown;
  } = {
    from: () => chain,
    where: () => chain,
    orderBy: () => Promise.resolve(result),
    limit: () => Promise.resolve(result),
    leftJoin: () => chain,
    innerJoin: () => chain,
    groupBy: () => Promise.resolve(result),
    then: (resolve: (value: unknown) => unknown) => resolve(result),
  };
  return chain;
}

function insertReturning(result: unknown) {
  return {
    values: jest.fn().mockReturnValue({
      returning: jest.fn().mockResolvedValue(result),
    }),
  };
}

describe('/api/sprints route', () => {
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

  describe('GET', () => {
    it('returns 401 when no session', async () => {
      authMock.mockResolvedValue(null);
      const response = await GET(
        new NextRequestCtor('http://localhost:3002/api/sprints?projectId=PRJ')
      );
      expect(response.status).toBe(401);
      await expect(response.json()).resolves.toEqual({ error: 'Unauthorized' });
    });

    it('returns 400 when projectId missing', async () => {
      authMock.mockResolvedValue({ user: { id: 'user-1' } });
      const response = await GET(new NextRequestCtor('http://localhost:3002/api/sprints'));
      expect(response.status).toBe(400);
      await expect(response.json()).resolves.toEqual({ error: 'Project ID is required' });
    });

    it('returns 404 when project key does not resolve', async () => {
      authMock.mockResolvedValue({ user: { id: 'user-1' } });
      // resolveProjectId: short key lookup returns []
      dbSelectMock.mockReturnValueOnce(chainable([]));
      const response = await GET(
        new NextRequestCtor('http://localhost:3002/api/sprints?projectId=PRJ')
      );
      expect(response.status).toBe(404);
      await expect(response.json()).resolves.toEqual({ error: 'Project not found' });
    });

    it('returns 404 when caller is not a member of the project organization', async () => {
      authMock.mockResolvedValue({ user: { id: 'user-1' } });
      // Long projectId skips key lookup; view permission check runs first.
      dbSelectMock
        .mockReturnValueOnce(chainable([{ isSuperAdmin: false }])) // users
        .mockReturnValueOnce(
          chainable([{ id: 'project_long_id_1234567890', organizationId: 'org-1' }])
        ) // project
        .mockReturnValueOnce(chainable([])) // no org membership (cross-org probe)
        .mockReturnValueOnce(chainable([])); // no project membership

      const response = await GET(
        new NextRequestCtor(
          'http://localhost:3002/api/sprints?projectId=project_long_id_1234567890'
        )
      );
      expect(response.status).toBe(404);
      await expect(response.json()).resolves.toEqual({ error: 'Project not found' });
    });

    it('returns 403 when an in-org caller is not a project member', async () => {
      authMock.mockResolvedValue({ user: { id: 'user-1' } });
      dbSelectMock
        .mockReturnValueOnce(chainable([{ isSuperAdmin: false }])) // users
        .mockReturnValueOnce(
          chainable([{ id: 'project_long_id_1234567890', organizationId: 'org-1' }])
        ) // project
        .mockReturnValueOnce(chainable([{ role: 'member' }])) // org member (not admin/owner)
        .mockReturnValueOnce(chainable([])); // no project membership

      const response = await GET(
        new NextRequestCtor(
          'http://localhost:3002/api/sprints?projectId=project_long_id_1234567890'
        )
      );
      expect(response.status).toBe(403);
      await expect(response.json()).resolves.toEqual({ error: 'Not a project member' });
    });

    it('returns sprints with issue counts on happy path', async () => {
      authMock.mockResolvedValue({ user: { id: 'user-1' } });
      // Long projectId skips key lookup. First call = view permission (super
      // admin bypass). Second = sprints list. Third = issue counts.
      dbSelectMock
        .mockReturnValueOnce(chainable([{ isSuperAdmin: true }]))
        .mockReturnValueOnce(
          chainable([
            {
              id: 'sprint-1',
              projectId: 'project_long_id_1234567890',
              name: 'Sprint 1',
              goal: 'Ship',
              startDate: new Date(),
              endDate: new Date(),
              status: 'planned',
              createdAt: new Date(),
              updatedAt: new Date(),
              createdBy: 'user-1',
              updatedBy: 'user-1',
            },
          ])
        )
        .mockReturnValueOnce(chainable([{ sprintId: 'sprint-1', total: 5 }]));

      const response = await GET(
        new NextRequestCtor(
          'http://localhost:3002/api/sprints?projectId=project_long_id_1234567890'
        )
      );
      expect(response.status).toBe(200);
      const body = (await response.json()) as Array<{ id: string; issueCount: number }>;
      expect(body).toHaveLength(1);
      expect(body[0].id).toBe('sprint-1');
      expect(body[0].issueCount).toBe(5);
    });
  });

  describe('POST', () => {
    it('returns 401 when no session', async () => {
      authMock.mockResolvedValue(null);
      const response = await POST(
        new NextRequestCtor('http://localhost:3002/api/sprints', {
          method: 'POST',
          body: JSON.stringify({}),
        })
      );
      expect(response.status).toBe(401);
    });

    it('returns 400 when required fields missing', async () => {
      authMock.mockResolvedValue({ user: { id: 'user-1' } });
      const response = await POST(
        new NextRequestCtor('http://localhost:3002/api/sprints', {
          method: 'POST',
          body: JSON.stringify({ name: 'Sprint 1' }),
        })
      );
      expect(response.status).toBe(400);
      await expect(response.json()).resolves.toEqual({
        error: 'Project ID, name, start date, and end date are required',
      });
    });

    it('returns 404 when project cannot be resolved', async () => {
      authMock.mockResolvedValue({ user: { id: 'user-1' } });
      dbSelectMock.mockReturnValueOnce(chainable([])); // resolveProjectId returns null
      const response = await POST(
        new NextRequestCtor('http://localhost:3002/api/sprints', {
          method: 'POST',
          body: JSON.stringify({
            projectId: 'PRJ',
            name: 'Sprint 1',
            startDate: '2026-01-01',
            endDate: '2026-01-14',
          }),
        })
      );
      expect(response.status).toBe(404);
      await expect(response.json()).resolves.toEqual({ error: 'Project not found' });
    });

    it('returns 403 when user has no permission', async () => {
      authMock.mockResolvedValue({ user: { id: 'user-1' } });
      // long projectId skips key lookup, goes straight to permission check
      dbSelectMock
        .mockReturnValueOnce(chainable([{ isSuperAdmin: false }])) // users
        .mockReturnValueOnce(
          chainable([{ id: 'proj_long_id_1234567890', organizationId: 'org-1' }])
        ) // project
        .mockReturnValueOnce(chainable([{ role: 'member' }])) // orgMember (not owner)
        .mockReturnValueOnce(chainable([])); // projectMember empty

      const response = await POST(
        new NextRequestCtor('http://localhost:3002/api/sprints', {
          method: 'POST',
          body: JSON.stringify({
            projectId: 'proj_long_id_1234567890',
            name: 'Sprint 1',
            startDate: '2026-01-01',
            endDate: '2026-01-14',
          }),
        })
      );
      expect(response.status).toBe(403);
      await expect(response.json()).resolves.toEqual({ error: 'Not a project member' });
    });

    it('returns 400 when duration exceeds 90 days', async () => {
      authMock.mockResolvedValue({ user: { id: 'user-1' } });
      // Super admin bypass for permissions
      dbSelectMock.mockReturnValueOnce(chainable([{ isSuperAdmin: true }]));

      const response = await POST(
        new NextRequestCtor('http://localhost:3002/api/sprints', {
          method: 'POST',
          body: JSON.stringify({
            projectId: 'proj_long_id_1234567890',
            name: 'Sprint 1',
            startDate: '2026-01-01',
            endDate: '2026-06-01', // > 90 days
          }),
        })
      );
      expect(response.status).toBe(400);
      await expect(response.json()).resolves.toEqual({
        error: 'Sprint duration must be between 1 and 90 days',
      });
    });

    it('returns 400 when end date <= start date', async () => {
      authMock.mockResolvedValue({ user: { id: 'user-1' } });
      dbSelectMock.mockReturnValueOnce(chainable([{ isSuperAdmin: true }]));

      const response = await POST(
        new NextRequestCtor('http://localhost:3002/api/sprints', {
          method: 'POST',
          body: JSON.stringify({
            projectId: 'proj_long_id_1234567890',
            name: 'Sprint 1',
            startDate: '2026-01-14',
            endDate: '2026-01-01',
          }),
        })
      );
      expect(response.status).toBe(400);
      await expect(response.json()).resolves.toEqual({
        error: 'End date must be after start date',
      });
    });

    it('creates sprint and publishes event on happy path', async () => {
      authMock.mockResolvedValue({ user: { id: 'user-1' } });
      // super admin bypass
      dbSelectMock.mockReturnValueOnce(chainable([{ isSuperAdmin: true }]));
      // post-insert project lookup that resolves organizationId for the SSE event
      dbSelectMock.mockReturnValueOnce(chainable([{ organizationId: 'org-1' }]));
      dbInsertMock.mockReturnValueOnce(
        insertReturning([
          {
            id: 'generated-id',
            projectId: 'proj_long_id_1234567890',
            name: 'Sprint 1',
            goal: null,
            startDate: new Date('2026-01-01'),
            endDate: new Date('2026-01-14'),
            status: 'planned',
            createdBy: 'user-1',
            updatedBy: 'user-1',
          },
        ])
      );

      const response = await POST(
        new NextRequestCtor('http://localhost:3002/api/sprints', {
          method: 'POST',
          body: JSON.stringify({
            projectId: 'proj_long_id_1234567890',
            name: 'Sprint 1',
            startDate: '2026-01-01',
            endDate: '2026-01-14',
          }),
        })
      );

      expect(response.status).toBe(201);
      const body = (await response.json()) as { id: string };
      expect(body.id).toBe('generated-id');
      expect(publishEventMock).toHaveBeenCalledWith('sprint.created', 'user-1', {
        projectId: 'proj_long_id_1234567890',
        sprintId: 'generated-id',
        organizationId: 'org-1',
      });
    });
  });
});
