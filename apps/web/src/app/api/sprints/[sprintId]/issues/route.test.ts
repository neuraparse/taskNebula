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
        new MockNextRequest('http://localhost:3002/api/sprints/s1/issues') as unknown as import('next/server').NextRequest,
        { params: Promise.resolve({ sprintId: 's1' }) }
      );
      expect(response.status).toBe(401);
    });

    it('returns sprint issues enriched with status info', async () => {
      authMock.mockResolvedValue({ user: { id: 'user-1' } });
      dbSelectMock.mockReturnValueOnce(
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

    it('returns 404 when issue not found', async () => {
      authMock.mockResolvedValue({ user: { id: 'user-1' } });
      dbUpdateMock.mockReturnValueOnce(updateReturning([]));
      const response = await POST(
        new NextRequestCtor('http://localhost:3002/api/sprints/s1/issues', {
          method: 'POST',
          body: JSON.stringify({ issueId: 'i1' }),
        }),
        { params: Promise.resolve({ sprintId: 's1' }) }
      );
      expect(response.status).toBe(404);
    });

    it('assigns issue to sprint and publishes event', async () => {
      authMock.mockResolvedValue({ user: { id: 'user-1' } });
      dbUpdateMock.mockReturnValueOnce(
        updateReturning([{ id: 'i1', sprintId: 's1' }])
      );

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

    it('returns 404 when issue not in sprint', async () => {
      authMock.mockResolvedValue({ user: { id: 'user-1' } });
      dbUpdateMock.mockReturnValueOnce(updateReturning([]));
      const response = await DELETE(
        new NextRequestCtor('http://localhost:3002/api/sprints/s1/issues?issueId=i1'),
        { params: Promise.resolve({ sprintId: 's1' }) }
      );
      expect(response.status).toBe(404);
    });

    it('removes issue from sprint and publishes event', async () => {
      authMock.mockResolvedValue({ user: { id: 'user-1' } });
      dbUpdateMock.mockReturnValueOnce(
        updateReturning([{ id: 'i1', sprintId: null }])
      );
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
