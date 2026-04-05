const authMock = jest.fn();
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

jest.mock('@tasknebula/db', () => ({
  db: {
    select: (...args: unknown[]) => dbSelectMock(...args),
  },
  issues: {
    assigneeId: 'issues.assigneeId',
    projectId: 'issues.projectId',
    updatedAt: 'issues.updatedAt',
  },
  workflowStatuses: {
    id: 'workflowStatuses.id',
  },
  projects: {
    id: 'projects.id',
    key: 'projects.key',
    name: 'projects.name',
    teamId: 'projects.teamId',
    organizationId: 'projects.organizationId',
  },
}));

jest.mock('drizzle-orm', () => ({
  and: (...args: unknown[]) => ({ type: 'and', args }),
  desc: (value: unknown) => ({ type: 'desc', value }),
  eq: (left: unknown, right: unknown) => ({ type: 'eq', left, right }),
  inArray: (left: unknown, right: unknown) => ({ type: 'inArray', left, right }),
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

describe('GET /api/issues/my-issues', () => {
  let NextRequestCtor: typeof import('next/server').NextRequest;
  let GET: typeof import('./route').GET;

  beforeAll(async () => {
    if (typeof global.Request === 'undefined') {
      class MockHeaders {
        private readonly values: Map<string, string>;

        constructor(init?: Record<string, string>) {
          this.values = new Map(
            Object.entries(init || {}).map(([key, value]) => [key.toLowerCase(), value])
          );
        }

        get(key: string) {
          return this.values.get(key.toLowerCase()) ?? null;
        }

        entries() {
          return this.values.entries();
        }

        [Symbol.iterator]() {
          return this.values.entries();
        }
      }

      class MockRequest {
        private readonly _url: string;
        private readonly _method: string;
        private readonly _headers: MockHeaders;
        private readonly _nextUrl: URL;

        constructor(url: string, init?: { method?: string; headers?: Record<string, string> }) {
          this._url = url;
          this._method = init?.method || 'GET';
          this._headers = new MockHeaders(init?.headers);
          this._nextUrl = new URL(url);
        }

        get url() {
          return this._url;
        }

        get method() {
          return this._method;
        }

        get headers() {
          return this._headers;
        }

        get nextUrl() {
          return this._nextUrl;
        }
      }

      class MockResponse {
        status: number;
        headers: MockHeaders;
        private readonly bodyValue: string;

        constructor(body?: string, init?: { status?: number; headers?: Record<string, string> }) {
          this.status = init?.status || 200;
          this.headers = new MockHeaders(init?.headers);
          this.bodyValue = body || '';
        }

        async json() {
          return JSON.parse(this.bodyValue || '{}');
        }

        static json(value: unknown, init?: { status?: number; headers?: Record<string, string> }) {
          return new MockResponse(JSON.stringify(value), {
            status: init?.status,
            headers: {
              'content-type': 'application/json',
              ...(init?.headers || {}),
            },
          });
        }
      }

      Object.assign(global, {
        Headers: MockHeaders,
        Request: MockRequest,
        Response: MockResponse,
      });
    }

    ({ NextRequest: NextRequestCtor } = await import('next/server'));
    ({ GET } = await import('./route'));
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns 401 when the user is not authenticated', async () => {
    authMock.mockResolvedValue(null);

    const response = await GET(new NextRequestCtor('http://localhost:3002/api/issues/my-issues'));

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toEqual({ error: 'Unauthorized' });
  });

  it('returns an empty issue list when the scoped teamspace has no projects', async () => {
    authMock.mockResolvedValue({ user: { id: 'user-1' } });
    dbSelectMock.mockReturnValueOnce(whereBuilder([]));

    const response = await GET(
      new NextRequestCtor('http://localhost:3002/api/issues/my-issues?organizationId=org-1&teamId=team-1')
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ issues: [] });
  });

  it('returns scoped issues decorated with workflow status and project metadata', async () => {
    authMock.mockResolvedValue({ user: { id: 'user-1' } });
    dbSelectMock
      .mockReturnValueOnce(
        whereBuilder([
          {
            id: 'project-1',
            key: 'API',
            name: 'API Platform',
            teamId: 'team-1',
          },
        ])
      )
      .mockReturnValueOnce(
        orderBuilder([
          {
            id: 'issue-1',
            key: 'API-1',
            title: 'Release API',
            projectId: 'project-1',
            statusId: 'status-1',
            assigneeId: 'user-1',
          },
        ])
      )
      .mockReturnValueOnce(
        whereBuilder([
          {
            id: 'status-1',
            name: 'Todo',
            category: 'backlog',
            color: '#64748b',
          },
        ])
      )
      .mockReturnValueOnce(
        whereBuilder([
          {
            id: 'project-1',
            key: 'API',
            name: 'API Platform',
          },
        ])
      );

    const response = await GET(
      new NextRequestCtor('http://localhost:3002/api/issues/my-issues?organizationId=org-1&teamId=team-1')
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      issues: [
        {
          id: 'issue-1',
          key: 'API-1',
          title: 'Release API',
          projectId: 'project-1',
          statusId: 'status-1',
          assigneeId: 'user-1',
          status: {
            id: 'status-1',
            name: 'Todo',
            category: 'backlog',
            color: '#64748b',
          },
          project: {
            id: 'project-1',
            key: 'API',
            name: 'API Platform',
          },
        },
      ],
    });
  });
});
