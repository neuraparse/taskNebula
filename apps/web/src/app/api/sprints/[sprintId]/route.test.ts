const authMock = jest.fn();
const dbSelectMock = jest.fn();
const dbUpdateMock = jest.fn();
const dbDeleteMock = jest.fn();
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
    delete: (...args: unknown[]) => dbDeleteMock(...args),
  },
  sprints: {
    id: 'sprints.id',
    projectId: 'sprints.projectId',
    name: 'sprints.name',
    status: 'sprints.status',
  },
  issues: {
    id: 'issues.id',
    sprintId: 'issues.sprintId',
    statusId: 'issues.statusId',
  },
  workflowStatuses: {
    id: 'workflowStatuses.id',
    category: 'workflowStatuses.category',
  },
  projects: {
    id: 'projects.id',
    organizationId: 'projects.organizationId',
  },
  projectMembers: {
    userId: 'projectMembers.userId',
    projectId: 'projectMembers.projectId',
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
      canStartSprint: true,
      canCompleteSprint: true,
      canDeleteSprint: true,
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
  ne: (left: unknown, right: unknown) => ({ type: 'ne', left, right }),
  count: () => ({ type: 'count' }),
  relations: () => ({}),
}));

function chainable(result: unknown) {
  const chain: {
    from: () => typeof chain;
    where: () => typeof chain;
    orderBy: () => Promise<unknown>;
    limit: () => Promise<unknown>;
    leftJoin: () => typeof chain;
    innerJoin: () => typeof chain;
    then: (resolve: (value: unknown) => unknown) => unknown;
  } = {
    from: () => chain,
    where: () => chain,
    orderBy: () => Promise.resolve(result),
    limit: () => Promise.resolve(result),
    leftJoin: () => chain,
    innerJoin: () => chain,
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

function updateResolving(result?: unknown) {
  return {
    set: jest.fn().mockReturnValue({
      where: jest.fn().mockResolvedValue(result),
    }),
  };
}

function deleteReturning(result: unknown) {
  return {
    where: jest.fn().mockReturnValue({
      returning: jest.fn().mockResolvedValue(result),
    }),
  };
}

describe('/api/sprints/[sprintId] route', () => {
  let NextRequestCtor: typeof import('next/server').NextRequest;
  let GET: typeof import('./route').GET;
  let PATCH: typeof import('./route').PATCH;
  let DELETE: typeof import('./route').DELETE;

  beforeAll(async () => {
    ({ NextRequest: NextRequestCtor } = await import('next/server'));
    ({ GET, PATCH, DELETE } = await import('./route'));
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('GET', () => {
    it('returns 401 when no session', async () => {
      authMock.mockResolvedValue(null);
      const response = await GET(new NextRequestCtor('http://localhost:3002/api/sprints/s1'), {
        params: Promise.resolve({ sprintId: 's1' }),
      });
      expect(response.status).toBe(401);
    });

    it('returns 404 when sprint not found', async () => {
      authMock.mockResolvedValue({ user: { id: 'user-1' } });
      dbSelectMock.mockReturnValueOnce(chainable([]));
      const response = await GET(new NextRequestCtor('http://localhost:3002/api/sprints/s1'), {
        params: Promise.resolve({ sprintId: 's1' }),
      });
      expect(response.status).toBe(404);
      await expect(response.json()).resolves.toEqual({ error: 'Sprint not found' });
    });

    it('returns 404 when caller is not a member of the sprint organization', async () => {
      authMock.mockResolvedValue({ user: { id: 'user-1' } });
      dbSelectMock
        .mockReturnValueOnce(
          chainable([{ id: 's1', projectId: 'p1', name: 'Sprint 1', status: 'active' }])
        )
        // checkSprintPermission: not super admin
        .mockReturnValueOnce(chainable([{ isSuperAdmin: false }]))
        // project exists in another org
        .mockReturnValueOnce(chainable([{ id: 'p1', organizationId: 'org-other' }]))
        // no org membership (cross-org probe)
        .mockReturnValueOnce(chainable([]))
        // no project membership
        .mockReturnValueOnce(chainable([]));

      const response = await GET(new NextRequestCtor('http://localhost:3002/api/sprints/s1'), {
        params: Promise.resolve({ sprintId: 's1' }),
      });
      expect(response.status).toBe(404);
      await expect(response.json()).resolves.toEqual({ error: 'Sprint not found' });
    });

    it('returns sprint with issue stats', async () => {
      authMock.mockResolvedValue({ user: { id: 'user-1' } });
      dbSelectMock
        .mockReturnValueOnce(
          chainable([{ id: 's1', projectId: 'p1', name: 'Sprint 1', status: 'active' }])
        )
        // checkSprintPermission('view'): super admin bypass
        .mockReturnValueOnce(chainable([{ isSuperAdmin: true }]))
        .mockReturnValueOnce(
          chainable([
            { id: 'i1', statusCategory: 'done' },
            { id: 'i2', statusCategory: 'in_progress' },
            { id: 'i3', statusCategory: 'backlog' },
          ])
        );

      const response = await GET(new NextRequestCtor('http://localhost:3002/api/sprints/s1'), {
        params: Promise.resolve({ sprintId: 's1' }),
      });

      expect(response.status).toBe(200);
      await expect(response.json()).resolves.toEqual(
        expect.objectContaining({
          id: 's1',
          issueCount: 3,
          completedCount: 1,
          inProgressCount: 1,
          todoCount: 1,
        })
      );
    });
  });

  describe('PATCH', () => {
    it('returns 401 when no session', async () => {
      authMock.mockResolvedValue(null);
      const response = await PATCH(
        new NextRequestCtor('http://localhost:3002/api/sprints/s1', {
          method: 'PATCH',
          body: JSON.stringify({}),
        }),
        { params: Promise.resolve({ sprintId: 's1' }) }
      );
      expect(response.status).toBe(401);
    });

    it('returns 404 when sprint not found', async () => {
      authMock.mockResolvedValue({ user: { id: 'user-1' } });
      dbSelectMock.mockReturnValueOnce(chainable([])); // currentSprint empty
      const response = await PATCH(
        new NextRequestCtor('http://localhost:3002/api/sprints/s1', {
          method: 'PATCH',
          body: JSON.stringify({ name: 'Rename' }),
        }),
        { params: Promise.resolve({ sprintId: 's1' }) }
      );
      expect(response.status).toBe(404);
    });

    it('returns 403 when permission denied', async () => {
      authMock.mockResolvedValue({ user: { id: 'user-1' } });
      dbSelectMock
        .mockReturnValueOnce(
          chainable([{ id: 's1', projectId: 'p1', name: 'Sprint 1', status: 'planned' }])
        )
        // checkSprintPermission: not super admin
        .mockReturnValueOnce(chainable([{ isSuperAdmin: false }]))
        // project exists
        .mockReturnValueOnce(chainable([{ id: 'p1', organizationId: 'org-1' }]))
        // org member role = member (not owner/admin)
        .mockReturnValueOnce(chainable([{ role: 'member' }]))
        // no project member
        .mockReturnValueOnce(chainable([]));

      const response = await PATCH(
        new NextRequestCtor('http://localhost:3002/api/sprints/s1', {
          method: 'PATCH',
          body: JSON.stringify({ name: 'Rename' }),
        }),
        { params: Promise.resolve({ sprintId: 's1' }) }
      );
      expect(response.status).toBe(403);
      await expect(response.json()).resolves.toEqual({ error: 'Not a project member' });
    });

    it('updates sprint and publishes event on happy path', async () => {
      authMock.mockResolvedValue({ user: { id: 'user-1' } });
      dbSelectMock
        .mockReturnValueOnce(
          chainable([
            {
              id: 's1',
              projectId: 'p1',
              name: 'Sprint 1',
              status: 'planned',
              startDate: new Date('2026-01-01'),
              endDate: new Date('2026-01-14'),
            },
          ])
        )
        // super admin bypass
        .mockReturnValueOnce(chainable([{ isSuperAdmin: true }]))
        // project lookup resolving organizationId for the SSE event
        .mockReturnValueOnce(chainable([{ organizationId: 'org-1' }]));
      dbUpdateMock.mockReturnValueOnce(
        updateReturning([{ id: 's1', projectId: 'p1', name: 'Renamed', status: 'planned' }])
      );

      const response = await PATCH(
        new NextRequestCtor('http://localhost:3002/api/sprints/s1', {
          method: 'PATCH',
          body: JSON.stringify({ name: 'Renamed' }),
        }),
        { params: Promise.resolve({ sprintId: 's1' }) }
      );

      expect(response.status).toBe(200);
      await expect(response.json()).resolves.toEqual(
        expect.objectContaining({ id: 's1', name: 'Renamed' })
      );
      expect(publishEventMock).toHaveBeenCalledWith('sprint.updated', 'user-1', {
        projectId: 'p1',
        sprintId: 's1',
        organizationId: 'org-1',
      });
    });

    it('blocks starting a sprint when another active sprint exists', async () => {
      authMock.mockResolvedValue({ user: { id: 'user-1' } });
      dbSelectMock
        .mockReturnValueOnce(
          chainable([
            {
              id: 's1',
              projectId: 'p1',
              name: 'Sprint 1',
              status: 'planned',
              startDate: new Date('2026-01-01'),
              endDate: new Date('2026-01-14'),
            },
          ])
        )
        // super admin bypass for permissions
        .mockReturnValueOnce(chainable([{ isSuperAdmin: true }]))
        // existing active sprint
        .mockReturnValueOnce(chainable([{ id: 's2', name: 'Sprint 2' }]));

      const response = await PATCH(
        new NextRequestCtor('http://localhost:3002/api/sprints/s1', {
          method: 'PATCH',
          body: JSON.stringify({ status: 'active' }),
        }),
        { params: Promise.resolve({ sprintId: 's1' }) }
      );
      expect(response.status).toBe(400);
      const body = (await response.json()) as { error: string };
      expect(body.error).toContain('Sprint 2');
    });
  });

  describe('DELETE', () => {
    it('returns 401 when no session', async () => {
      authMock.mockResolvedValue(null);
      const response = await DELETE(new NextRequestCtor('http://localhost:3002/api/sprints/s1'), {
        params: Promise.resolve({ sprintId: 's1' }),
      });
      expect(response.status).toBe(401);
    });

    it('returns 404 when sprint not found', async () => {
      authMock.mockResolvedValue({ user: { id: 'user-1' } });
      dbSelectMock.mockReturnValueOnce(chainable([]));
      const response = await DELETE(new NextRequestCtor('http://localhost:3002/api/sprints/s1'), {
        params: Promise.resolve({ sprintId: 's1' }),
      });
      expect(response.status).toBe(404);
    });

    it('returns 403 when permission denied', async () => {
      authMock.mockResolvedValue({ user: { id: 'user-1' } });
      dbSelectMock
        .mockReturnValueOnce(chainable([{ projectId: 'p1' }])) // sprint exists
        .mockReturnValueOnce(chainable([{ isSuperAdmin: false }]))
        .mockReturnValueOnce(chainable([{ id: 'p1', organizationId: 'org-1' }]))
        .mockReturnValueOnce(chainable([{ role: 'member' }]))
        .mockReturnValueOnce(chainable([]));
      const response = await DELETE(new NextRequestCtor('http://localhost:3002/api/sprints/s1'), {
        params: Promise.resolve({ sprintId: 's1' }),
      });
      expect(response.status).toBe(403);
    });

    it('returns 400 when sprint has issues', async () => {
      authMock.mockResolvedValue({ user: { id: 'user-1' } });
      dbSelectMock
        .mockReturnValueOnce(chainable([{ projectId: 'p1' }])) // sprint exists
        .mockReturnValueOnce(chainable([{ isSuperAdmin: true }])) // super admin bypass
        .mockReturnValueOnce(chainable([{ count: 3 }])); // issue count

      const response = await DELETE(new NextRequestCtor('http://localhost:3002/api/sprints/s1'), {
        params: Promise.resolve({ sprintId: 's1' }),
      });
      expect(response.status).toBe(400);
      await expect(response.json()).resolves.toEqual({
        error: 'Cannot delete sprint with assigned issues',
      });
    });

    it('deletes sprint and publishes event on happy path', async () => {
      authMock.mockResolvedValue({ user: { id: 'user-1' } });
      dbSelectMock
        .mockReturnValueOnce(chainable([{ projectId: 'p1' }]))
        .mockReturnValueOnce(chainable([{ isSuperAdmin: true }]))
        .mockReturnValueOnce(chainable([{ count: 0 }]))
        // project lookup resolving organizationId for the SSE event
        .mockReturnValueOnce(chainable([{ organizationId: 'org-1' }]));
      dbDeleteMock.mockReturnValueOnce(deleteReturning([{ id: 's1', projectId: 'p1' }]));

      const response = await DELETE(new NextRequestCtor('http://localhost:3002/api/sprints/s1'), {
        params: Promise.resolve({ sprintId: 's1' }),
      });

      expect(response.status).toBe(200);
      await expect(response.json()).resolves.toEqual({ success: true });
      expect(publishEventMock).toHaveBeenCalledWith('sprint.deleted', 'user-1', {
        projectId: 'p1',
        sprintId: 's1',
        organizationId: 'org-1',
      });
    });
  });
});

// Note: updateResolving is provided for completeness but unused in this suite.
void updateResolving;
