const authMock = jest.fn();
const dbSelectMock = jest.fn();

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
  publishEvent: jest.fn(),
}));

jest.mock('@paralleldrive/cuid2', () => ({
  createId: () => 'generated-id',
}));

jest.mock('@tasknebula/db', () => ({
  db: {
    select: (...args: unknown[]) => dbSelectMock(...args),
    insert: jest.fn(),
  },
  projects: {
    organizationId: 'projects.organizationId',
    key: 'projects.key',
    teamId: 'projects.teamId',
    updatedAt: 'projects.updatedAt',
  },
  organizationMembers: {
    userId: 'organizationMembers.userId',
    organizationId: 'organizationMembers.organizationId',
    role: 'organizationMembers.role',
  },
  projectMembers: {
    projectId: 'projectMembers.projectId',
    userId: 'projectMembers.userId',
  },
  users: {
    id: 'users.id',
    isSuperAdmin: 'users.isSuperAdmin',
  },
  workflows: {
    organizationId: 'workflows.organizationId',
    isDefault: 'workflows.isDefault',
    id: 'workflows.id',
  },
  teams: {
    id: 'teams.id',
    organizationId: 'teams.organizationId',
  },
  organizations: {
    name: 'organizations.name',
  },
  ROLE_DEFAULT_PERMISSIONS: {
    product_owner: {},
  },
}));

jest.mock('drizzle-orm', () => ({
  and: (...args: unknown[]) => ({ type: 'and', args }),
  desc: (value: unknown) => ({ type: 'desc', value }),
  eq: (left: unknown, right: unknown) => ({ type: 'eq', left, right }),
  inArray: (left: unknown, right: unknown) => ({ type: 'inArray', left, right }),
  relations: () => ({}),
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

function whereBuilder(result: unknown) {
  return {
    from: jest.fn().mockReturnValue({
      where: jest.fn().mockResolvedValue(result),
    }),
  };
}

describe('/api/projects route', () => {
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

        constructor(
          url: string,
          init?: { method?: string; headers?: Record<string, string>; body?: string }
        ) {
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

  it('rejects a requested organization outside the user membership scope', async () => {
    authMock.mockResolvedValue({ user: { id: 'user-1' } });
    dbSelectMock.mockReturnValueOnce(limitBuilder([{ isSuperAdmin: false }])).mockReturnValueOnce(
      whereBuilder([
        {
          organizationId: 'org-1',
          role: 'member',
        },
      ])
    );

    const response = await GET(
      new NextRequestCtor('http://localhost:3002/api/projects?organizationId=org-2')
    );

    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toEqual({ error: 'Forbidden' });
  });

  it('rejects a teamspace that belongs to a different organization during project creation', async () => {
    authMock.mockResolvedValue({ user: { id: 'user-1' } });
    dbSelectMock.mockReturnValueOnce(
      limitBuilder([
        {
          id: 'team-2',
          organizationId: 'org-2',
        },
      ])
    );

    const response = await POST(
      new NextRequestCtor('http://localhost:3002/api/projects', {
        method: 'POST',
        body: JSON.stringify({
          name: 'API Platform',
          key: 'API',
          organizationId: 'org-1',
          teamId: 'team-2',
        }),
      })
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      error: 'Selected teamspace does not belong to this organization',
    });
  });
});
