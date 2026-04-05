const authMock = jest.fn();
const resolveProjectByIdOrKeyMock = jest.fn();
const dbSelectMock = jest.fn();
const dbInsertMock = jest.fn();
const dbUpdateMock = jest.fn();

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

  get headers() {
    return new Map(Object.entries(this.init?.headers || {}));
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

jest.mock('@/lib/projects/server', () => ({
  resolveProjectByIdOrKey: (...args: unknown[]) => resolveProjectByIdOrKeyMock(...args),
}));

jest.mock('@tasknebula/db', () => ({
  db: {
    select: (...args: unknown[]) => dbSelectMock(...args),
    insert: (...args: unknown[]) => dbInsertMock(...args),
    update: (...args: unknown[]) => dbUpdateMock(...args),
  },
  savedFilters: {
    organizationId: 'savedFilters.organizationId',
    projectId: 'savedFilters.projectId',
    userId: 'savedFilters.userId',
    isPublic: 'savedFilters.isPublic',
    isStarred: 'savedFilters.isStarred',
    lastUsedAt: 'savedFilters.lastUsedAt',
    updatedAt: 'savedFilters.updatedAt',
  },
  organizationMembers: {
    id: 'organizationMembers.id',
    organizationId: 'organizationMembers.organizationId',
    userId: 'organizationMembers.userId',
  },
}));

jest.mock('drizzle-orm', () => ({
  and: (...args: unknown[]) => ({ type: 'and', args }),
  desc: (value: unknown) => ({ type: 'desc', value }),
  eq: (left: unknown, right: unknown) => ({ type: 'eq', left, right }),
  or: (...args: unknown[]) => ({ type: 'or', args }),
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

function orderBuilder(result: unknown) {
  return {
    from: jest.fn().mockReturnValue({
      where: jest.fn().mockReturnValue({
        orderBy: jest.fn().mockResolvedValue(result),
      }),
    }),
  };
}

describe('Project views route', () => {
  let NextRequestCtor: typeof import('next/server').NextRequest;
  let GET: typeof import('./route').GET;
  let POST: typeof import('./route').POST;

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
        private readonly bodyValue: string;

        constructor(url: string, init?: { method?: string; headers?: Record<string, string>; body?: string }) {
          this._url = url;
          this._method = init?.method || 'GET';
          this._headers = new MockHeaders(init?.headers);
          this._nextUrl = new URL(url);
          this.bodyValue = init?.body || '';
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

        async json() {
          return JSON.parse(this.bodyValue || '{}');
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
    ({ GET, POST } = await import('./route'));
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns 401 when the user is not authenticated', async () => {
    authMock.mockResolvedValue(null);

    const response = await GET(new NextRequestCtor('http://localhost:3002/api/projects/project-1/views'), {
      params: Promise.resolve({ projectId: 'project-1' }),
    });

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toEqual({ error: 'Unauthorized' });
  });

  it('returns project views for an accessible project', async () => {
    authMock.mockResolvedValue({ user: { id: 'user-1' } });
    resolveProjectByIdOrKeyMock.mockResolvedValue({
      id: 'project-1',
      key: 'API',
      name: 'API Platform',
      organizationId: 'org-1',
      teamId: 'team-1',
    });
    dbSelectMock
      .mockReturnValueOnce(limitBuilder([{ id: 'member-1' }]))
      .mockReturnValueOnce(
        orderBuilder([
          {
            id: 'view-1',
            name: 'Release Board',
            viewType: 'board',
          },
        ])
      );

    const response = await GET(
      new NextRequestCtor('http://localhost:3002/api/projects/project-1/views?includePublic=false'),
      {
        params: Promise.resolve({ projectId: 'project-1' }),
      }
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      viewerId: 'user-1',
      project: {
        id: 'project-1',
        key: 'API',
        name: 'API Platform',
        teamId: 'team-1',
      },
      views: [
        {
          id: 'view-1',
          name: 'Release Board',
          viewType: 'board',
          scope: 'project',
          teamspaceId: null,
          isDefault: false,
          isOwned: false,
        },
      ],
    });
  });

  it('creates a project-scoped saved view with the project defaults', async () => {
    authMock.mockResolvedValue({ user: { id: 'user-1' } });
    resolveProjectByIdOrKeyMock.mockResolvedValue({
      id: 'project-1',
      key: 'API',
      name: 'API Platform',
      organizationId: 'org-1',
      teamId: 'team-1',
    });
    dbSelectMock
      .mockReturnValueOnce(limitBuilder([{ id: 'member-1' }]))
      .mockReturnValueOnce({ from: jest.fn().mockReturnValue({ where: jest.fn().mockResolvedValue([]) }) });

    dbUpdateMock.mockReturnValue({
      set: jest.fn().mockReturnValue({
        where: jest.fn().mockResolvedValue(undefined),
      }),
    });

    const insertedValues: Array<Record<string, unknown>> = [];
    dbInsertMock.mockReturnValue({
      values: (value: Record<string, unknown>) => {
        insertedValues.push(value);
        return {
          returning: async () => [
            {
              id: 'view-1',
              ...value,
            },
          ],
        };
      },
    });

    const response = await POST(
      new NextRequestCtor('http://localhost:3002/api/projects/project-1/views?teamId=team-1', {
        method: 'POST',
        body: JSON.stringify({
          name: 'Weekly Planning',
          criteria: {
            search: 'release',
          },
          viewType: 'calendar',
          scope: 'teamspace',
          isPinned: true,
          isDefault: true,
        }),
      }),
      {
        params: Promise.resolve({ projectId: 'project-1' }),
      }
    );

    expect(response.status).toBe(201);
    expect(insertedValues[0]).toMatchObject({
      userId: 'user-1',
      organizationId: 'org-1',
      projectId: 'project-1',
      name: 'Weekly Planning',
      query: 'project = API',
      criteria: {
        search: 'release',
        scope: 'teamspace',
        teamspaceId: 'team-1',
        defaultView: true,
      },
      viewType: 'calendar',
      isPublic: true,
      isStarred: true,
      sortBy: 'updated_at',
      sortOrder: 'desc',
      usageCount: '0',
    });
  });

  it('returns 400 for invalid view payloads', async () => {
    authMock.mockResolvedValue({ user: { id: 'user-1' } });
    resolveProjectByIdOrKeyMock.mockResolvedValue({
      id: 'project-1',
      key: 'API',
      name: 'API Platform',
      organizationId: 'org-1',
      teamId: 'team-1',
    });
    dbSelectMock.mockReturnValueOnce(limitBuilder([{ id: 'member-1' }]));

    const response = await POST(
      new NextRequestCtor('http://localhost:3002/api/projects/project-1/views', {
        method: 'POST',
        body: JSON.stringify({
          name: '',
          criteria: {},
        }),
      }),
      {
        params: Promise.resolve({ projectId: 'project-1' }),
      }
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({
      error: 'Invalid view payload',
    });
  });
});
