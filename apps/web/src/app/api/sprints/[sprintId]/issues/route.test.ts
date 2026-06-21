const authMock = jest.fn();
const dbSelectMock = jest.fn();
const dbUpdateMock = jest.fn();
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

jest.mock('@tasknebula/db', () => ({
  db: {
    select: (...args: unknown[]) => dbSelectMock(...args),
    update: (...args: unknown[]) => dbUpdateMock(...args),
  },
  issues: {
    id: 'issues.id',
    organizationId: 'issues.organizationId',
    projectId: 'issues.projectId',
    key: 'issues.key',
    number: 'issues.number',
    type: 'issues.type',
    title: 'issues.title',
    description: 'issues.description',
    statusId: 'issues.statusId',
    priority: 'issues.priority',
    assigneeId: 'issues.assigneeId',
    reporterId: 'issues.reporterId',
    labels: 'issues.labels',
    sprintId: 'issues.sprintId',
    epicId: 'issues.epicId',
    parentId: 'issues.parentId',
    estimate: 'issues.estimate',
    dueDate: 'issues.dueDate',
    createdAt: 'issues.createdAt',
    updatedAt: 'issues.updatedAt',
  },
  workflowStatuses: {
    id: 'workflowStatuses.id',
    category: 'workflowStatuses.category',
    name: 'workflowStatuses.name',
    color: 'workflowStatuses.color',
  },
  sprints: {
    id: 'sprints.id',
    projectId: 'sprints.projectId',
  },
  projects: {
    id: 'projects.id',
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
  },
  hasPermission: (role: string, permission: string, isSuperAdmin = false) => {
    if (isSuperAdmin) return true;
    if (permission !== 'project:manage') return false;
    return role === 'owner' || role === 'admin';
  },
}));

jest.mock('drizzle-orm', () => ({
  and: (...args: unknown[]) => ({ type: 'and', args }),
  eq: (left: unknown, right: unknown) => ({ type: 'eq', left, right }),
}));

function chainable(result: unknown) {
  const chain: {
    from: () => typeof chain;
    where: () => typeof chain;
    leftJoin: () => typeof chain;
    innerJoin: () => typeof chain;
    limit: () => Promise<unknown>;
    orderBy: () => Promise<unknown>;
    then: (resolve: (value: unknown) => unknown) => unknown;
  } = {
    from: () => chain,
    where: () => chain,
    leftJoin: () => chain,
    innerJoin: () => chain,
    limit: () => Promise.resolve(result),
    orderBy: () => Promise.resolve(result),
    then: (resolve: (value: unknown) => unknown) => resolve(result),
  };
  return chain;
}

function updateReturning(result: unknown) {
  return {
    set: jest.fn().mockReturnValue({
      where: jest.fn().mockReturnValue({
        returning: jest.fn().mockResolvedValue(result),
      }),
    }),
  };
}

describe('/api/sprints/[sprintId]/issues route', () => {
  let NextRequestCtor: typeof import('next/server').NextRequest;
  let GET: typeof import('./route').GET;
  let POST: typeof import('./route').POST;
  let DELETE: typeof import('./route').DELETE;

  beforeAll(async () => {
    ({ NextRequest: NextRequestCtor } = await import('next/server'));
    ({ GET, POST, DELETE } = await import('./route'));
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('GET', () => {
    it('returns 401 when no session', async () => {
      authMock.mockResolvedValue(null);
      const response = await GET(
        new MockNextRequest(
          'http://localhost:3002/api/sprints/s1/issues'
        ) as unknown as import('next/server').NextRequest,
        { params: Promise.resolve({ sprintId: 's1' }) }
      );
      expect(response.status).toBe(401);
    });

    it('returns 404 when sprint does not exist', async () => {
      authMock.mockResolvedValue({ user: { id: 'user-1' } });
      dbSelectMock.mockReturnValueOnce(chainable([])); // sprint lookup empty
      const response = await GET(
        new NextRequestCtor('http://localhost:3002/api/sprints/s1/issues'),
        { params: Promise.resolve({ sprintId: 's1' }) }
      );
      expect(response.status).toBe(404);
      await expect(response.json()).resolves.toEqual({ error: 'Sprint not found' });
    });

    it('returns 404 when caller is not a member of the sprint organization', async () => {
      authMock.mockResolvedValue({ user: { id: 'user-1' } });
      dbSelectMock
        .mockReturnValueOnce(chainable([{ id: 's1', projectId: 'p1' }])) // sprint
        .mockReturnValueOnce(chainable([{ isSuperAdmin: false }])) // users
        .mockReturnValueOnce(chainable([{ id: 'p1', organizationId: 'org-other' }])) // project
        .mockReturnValueOnce(chainable([])) // no org membership (cross-org probe)
        .mockReturnValueOnce(chainable([])); // no project membership

      const response = await GET(
        new NextRequestCtor('http://localhost:3002/api/sprints/s1/issues'),
        { params: Promise.resolve({ sprintId: 's1' }) }
      );
      expect(response.status).toBe(404);
      await expect(response.json()).resolves.toEqual({ error: 'Sprint not found' });
    });

    it('returns sprint issues enriched with status info', async () => {
      authMock.mockResolvedValue({ user: { id: 'user-1' } });
      dbSelectMock
        .mockReturnValueOnce(chainable([{ id: 's1', projectId: 'p1' }])) // sprint
        .mockReturnValueOnce(chainable([{ isSuperAdmin: true }])) // permission bypass
        .mockReturnValueOnce(
          chainable([
            {
              id: 'i1',
              key: 'PRJ-1',
              title: 'Task 1',
              status: 'in_progress',
              statusName: 'In Progress',
              statusColor: '#2563eb',
            },
          ])
        );

      const response = await GET(
        new NextRequestCtor('http://localhost:3002/api/sprints/s1/issues'),
        { params: Promise.resolve({ sprintId: 's1' }) }
      );
      expect(response.status).toBe(200);
      const body = (await response.json()) as Array<{ id: string }>;
      expect(body).toHaveLength(1);
      expect(body[0].id).toBe('i1');
    });
  });

  describe('POST', () => {
    it('returns 401 when no session', async () => {
      authMock.mockResolvedValue(null);
      const response = await POST(
        new NextRequestCtor('http://localhost:3002/api/sprints/s1/issues', {
          method: 'POST',
          body: JSON.stringify({ issueId: 'i1' }),
        }),
        { params: Promise.resolve({ sprintId: 's1' }) }
      );
      expect(response.status).toBe(401);
    });

    it('returns 400 when issueId missing', async () => {
      authMock.mockResolvedValue({ user: { id: 'user-1' } });
      const response = await POST(
        new NextRequestCtor('http://localhost:3002/api/sprints/s1/issues', {
          method: 'POST',
          body: JSON.stringify({}),
        }),
        { params: Promise.resolve({ sprintId: 's1' }) }
      );
      expect(response.status).toBe(400);
      await expect(response.json()).resolves.toEqual({ error: 'Issue ID is required' });
    });

    it('returns 404 when sprint does not exist', async () => {
      authMock.mockResolvedValue({ user: { id: 'user-1' } });
      dbSelectMock.mockReturnValueOnce(chainable([])); // sprint lookup empty
      const response = await POST(
        new NextRequestCtor('http://localhost:3002/api/sprints/s1/issues', {
          method: 'POST',
          body: JSON.stringify({ issueId: 'i1' }),
        }),
        { params: Promise.resolve({ sprintId: 's1' }) }
      );
      expect(response.status).toBe(404);
      await expect(response.json()).resolves.toEqual({ error: 'Sprint not found' });
    });

    it('returns 404 when caller is not a member of the sprint organization', async () => {
      authMock.mockResolvedValue({ user: { id: 'user-1' } });
      dbSelectMock
        .mockReturnValueOnce(chainable([{ id: 's1', projectId: 'p1' }])) // sprint
        .mockReturnValueOnce(chainable([{ isSuperAdmin: false }])) // users
        .mockReturnValueOnce(chainable([{ id: 'p1', organizationId: 'org-other' }])) // project
        .mockReturnValueOnce(chainable([])) // no org membership (cross-org probe)
        .mockReturnValueOnce(chainable([])); // no project membership

      const response = await POST(
        new NextRequestCtor('http://localhost:3002/api/sprints/s1/issues', {
          method: 'POST',
          body: JSON.stringify({ issueId: 'i1' }),
        }),
        { params: Promise.resolve({ sprintId: 's1' }) }
      );
      expect(response.status).toBe(404);
      await expect(response.json()).resolves.toEqual({ error: 'Sprint not found' });
      expect(dbUpdateMock).not.toHaveBeenCalled();
    });

    it('returns 404 when issue not found', async () => {
      authMock.mockResolvedValue({ user: { id: 'user-1' } });
      dbSelectMock
        .mockReturnValueOnce(chainable([{ id: 's1', projectId: 'p1' }])) // sprint
        .mockReturnValueOnce(chainable([{ isSuperAdmin: true }])) // permission bypass
        .mockReturnValueOnce(chainable([])); // issue lookup empty
      const response = await POST(
        new NextRequestCtor('http://localhost:3002/api/sprints/s1/issues', {
          method: 'POST',
          body: JSON.stringify({ issueId: 'i1' }),
        }),
        { params: Promise.resolve({ sprintId: 's1' }) }
      );
      expect(response.status).toBe(404);
      await expect(response.json()).resolves.toEqual({ error: 'Issue not found' });
    });

    it('returns 404 when issue belongs to another organization', async () => {
      authMock.mockResolvedValue({ user: { id: 'user-1' } });
      dbSelectMock
        .mockReturnValueOnce(chainable([{ id: 's1', projectId: 'p1' }])) // sprint
        .mockReturnValueOnce(chainable([{ isSuperAdmin: true }])) // permission bypass
        .mockReturnValueOnce(
          chainable([{ id: 'i1', projectId: 'p2', organizationId: 'org-other' }])
        ) // issue in another org's project
        .mockReturnValueOnce(chainable([{ organizationId: 'org-1' }])); // sprint's project

      const response = await POST(
        new NextRequestCtor('http://localhost:3002/api/sprints/s1/issues', {
          method: 'POST',
          body: JSON.stringify({ issueId: 'i1' }),
        }),
        { params: Promise.resolve({ sprintId: 's1' }) }
      );
      expect(response.status).toBe(404);
      await expect(response.json()).resolves.toEqual({ error: 'Issue not found' });
      expect(dbUpdateMock).not.toHaveBeenCalled();
    });

    it('returns 400 when issue is in another project of the same organization', async () => {
      authMock.mockResolvedValue({ user: { id: 'user-1' } });
      dbSelectMock
        .mockReturnValueOnce(chainable([{ id: 's1', projectId: 'p1' }])) // sprint
        .mockReturnValueOnce(chainable([{ isSuperAdmin: true }])) // permission bypass
        .mockReturnValueOnce(chainable([{ id: 'i1', projectId: 'p2', organizationId: 'org-1' }])) // issue in a sibling project
        .mockReturnValueOnce(chainable([{ organizationId: 'org-1' }])); // sprint's project

      const response = await POST(
        new NextRequestCtor('http://localhost:3002/api/sprints/s1/issues', {
          method: 'POST',
          body: JSON.stringify({ issueId: 'i1' }),
        }),
        { params: Promise.resolve({ sprintId: 's1' }) }
      );
      expect(response.status).toBe(400);
      await expect(response.json()).resolves.toEqual({
        error: 'Issue does not belong to the sprint project',
      });
      expect(dbUpdateMock).not.toHaveBeenCalled();
    });

    it('assigns issue to sprint and publishes event', async () => {
      authMock.mockResolvedValue({ user: { id: 'user-1' } });
      dbSelectMock
        .mockReturnValueOnce(chainable([{ id: 's1', projectId: 'p1' }])) // sprint
        .mockReturnValueOnce(chainable([{ isSuperAdmin: true }])) // permission bypass
        .mockReturnValueOnce(chainable([{ id: 'i1', projectId: 'p1', organizationId: 'org-1' }])); // issue in the sprint's project
      dbUpdateMock.mockReturnValueOnce(updateReturning([{ id: 'i1', sprintId: 's1' }]));

      const response = await POST(
        new NextRequestCtor('http://localhost:3002/api/sprints/s1/issues', {
          method: 'POST',
          body: JSON.stringify({ issueId: 'i1' }),
        }),
        { params: Promise.resolve({ sprintId: 's1' }) }
      );
      expect(response.status).toBe(200);
      await expect(response.json()).resolves.toEqual({ id: 'i1', sprintId: 's1' });
      expect(publishEventMock).toHaveBeenCalledWith('sprint.issues.changed', 'user-1', {
        sprintId: 's1',
        organizationId: 'org-1',
      });
    });
  });

  describe('DELETE', () => {
    it('returns 401 when no session', async () => {
      authMock.mockResolvedValue(null);
      const response = await DELETE(
        new NextRequestCtor('http://localhost:3002/api/sprints/s1/issues?issueId=i1'),
        { params: Promise.resolve({ sprintId: 's1' }) }
      );
      expect(response.status).toBe(401);
    });

    it('returns 400 when issueId query missing', async () => {
      authMock.mockResolvedValue({ user: { id: 'user-1' } });
      const response = await DELETE(
        new NextRequestCtor('http://localhost:3002/api/sprints/s1/issues'),
        { params: Promise.resolve({ sprintId: 's1' }) }
      );
      expect(response.status).toBe(400);
      await expect(response.json()).resolves.toEqual({ error: 'Issue ID is required' });
    });

    it('returns 404 when sprint does not exist', async () => {
      authMock.mockResolvedValue({ user: { id: 'user-1' } });
      dbSelectMock.mockReturnValueOnce(chainable([])); // sprint lookup empty
      const response = await DELETE(
        new NextRequestCtor('http://localhost:3002/api/sprints/s1/issues?issueId=i1'),
        { params: Promise.resolve({ sprintId: 's1' }) }
      );
      expect(response.status).toBe(404);
      await expect(response.json()).resolves.toEqual({ error: 'Sprint not found' });
    });

    it('returns 404 when issue not in sprint', async () => {
      authMock.mockResolvedValue({ user: { id: 'user-1' } });
      dbSelectMock
        .mockReturnValueOnce(chainable([{ id: 's1', projectId: 'p1' }])) // sprint
        .mockReturnValueOnce(chainable([{ isSuperAdmin: true }])); // permission bypass
      dbUpdateMock.mockReturnValueOnce(updateReturning([]));
      const response = await DELETE(
        new NextRequestCtor('http://localhost:3002/api/sprints/s1/issues?issueId=i1'),
        { params: Promise.resolve({ sprintId: 's1' }) }
      );
      expect(response.status).toBe(404);
    });

    it('removes issue from sprint and publishes event', async () => {
      authMock.mockResolvedValue({ user: { id: 'user-1' } });
      dbSelectMock
        .mockReturnValueOnce(chainable([{ id: 's1', projectId: 'p1' }])) // sprint
        .mockReturnValueOnce(chainable([{ isSuperAdmin: true }])); // permission bypass
      dbUpdateMock.mockReturnValueOnce(updateReturning([{ id: 'i1', sprintId: null }]));
      const response = await DELETE(
        new NextRequestCtor('http://localhost:3002/api/sprints/s1/issues?issueId=i1'),
        { params: Promise.resolve({ sprintId: 's1' }) }
      );
      expect(response.status).toBe(200);
      await expect(response.json()).resolves.toEqual({ success: true });
      expect(publishEventMock).toHaveBeenCalledWith('sprint.issues.changed', 'user-1', {
        sprintId: 's1',
      });
    });
  });
});
