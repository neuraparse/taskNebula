const authMock = jest.fn();
const dbSelectMock = jest.fn();
const dbInsertMock = jest.fn();
const hasPermissionMock = jest.fn();

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

jest.mock('@/lib/auth/permissions', () => ({
  hasPermission: (...args: unknown[]) => hasPermissionMock(...args),
}));

jest.mock('@paralleldrive/cuid2', () => ({
  createId: () => 'generated-id',
}));

jest.mock('@tasknebula/db', () => ({
  db: {
    select: (...args: unknown[]) => dbSelectMock(...args),
    insert: (...args: unknown[]) => dbInsertMock(...args),
  },
  projects: {
    id: 'projects.id',
    organizationId: 'projects.organizationId',
    key: 'projects.key',
    teamId: 'projects.teamId',
    updatedAt: 'projects.updatedAt',
  },
  organizationMembers: {
    userId: 'organizationMembers.userId',
    organizationId: 'organizationMembers.organizationId',
    role: 'organizationMembers.role',
    status: 'organizationMembers.status',
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

type ProjectRow = {
  project: {
    id: string;
    organizationId: string;
    [key: string]: unknown;
  };
  organizationName: string | null;
  teamId: string | null;
  teamName: string | null;
  teamSlug: string | null;
};

function collectInArrayValues(condition: unknown, left: string): unknown[] | null {
  if (!condition || typeof condition !== 'object') return null;
  const node = condition as { type?: string; left?: unknown; right?: unknown; args?: unknown[] };
  if (node.type === 'inArray' && node.left === left) {
    return Array.isArray(node.right) ? node.right : [];
  }
  if (Array.isArray(node.args)) {
    for (const arg of node.args) {
      const values = collectInArrayValues(arg, left);
      if (values) return values;
    }
  }
  return null;
}

function projectListBuilder(rows: ProjectRow[]) {
  const chain = {
    leftJoin: jest.fn(() => chain),
    where: jest.fn((condition: unknown) => ({
      orderBy: jest.fn().mockResolvedValue(
        rows.filter((row) => {
          const orgIds = collectInArrayValues(condition, 'projects.organizationId');
          const projectIds = collectInArrayValues(condition, 'projects.id');
          return (
            (!orgIds || orgIds.includes(row.project.organizationId)) &&
            (!projectIds || projectIds.includes(row.project.id))
          );
        })
      ),
    })),
  };

  return {
    from: jest.fn().mockReturnValue(chain),
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
    authMock.mockReset();
    dbSelectMock.mockReset();
    dbInsertMock.mockReset();
    hasPermissionMock.mockReset();
    hasPermissionMock.mockResolvedValue(true);
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
    await expect(response.json()).resolves.toEqual({
      error: 'Forbidden',
      code: 'ORGANIZATION_FORBIDDEN',
    });
  });

  it('rejects an explicit organization filter when the user has no workspace memberships', async () => {
    authMock.mockResolvedValue({ user: { id: 'user-1' } });
    dbSelectMock
      .mockReturnValueOnce(limitBuilder([{ isSuperAdmin: false }]))
      .mockReturnValueOnce(whereBuilder([]));

    const response = await GET(
      new NextRequestCtor('http://localhost:3002/api/projects?organizationId=org-1')
    );

    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toEqual({
      error: 'Forbidden',
      code: 'ORGANIZATION_FORBIDDEN',
    });
  });

  it('keeps organization admin visibility scoped to the organization where the role is held', async () => {
    authMock.mockResolvedValue({ user: { id: 'user-1' } });
    const rows: ProjectRow[] = [
      {
        project: {
          id: 'project-admin-org',
          organizationId: 'org-admin',
          name: 'Admin org project',
          updatedAt: '2026-01-03T00:00:00.000Z',
        },
        organizationName: 'Admin Org',
        teamId: null,
        teamName: null,
        teamSlug: null,
      },
      {
        project: {
          id: 'project-member-org',
          organizationId: 'org-member',
          name: 'Member org project',
          updatedAt: '2026-01-02T00:00:00.000Z',
        },
        organizationName: 'Member Org',
        teamId: null,
        teamName: null,
        teamSlug: null,
      },
      {
        project: {
          id: 'project-hidden',
          organizationId: 'org-member',
          name: 'Hidden member org project',
          updatedAt: '2026-01-01T00:00:00.000Z',
        },
        organizationName: 'Member Org',
        teamId: null,
        teamName: null,
        teamSlug: null,
      },
    ];

    dbSelectMock
      .mockReturnValueOnce(limitBuilder([{ isSuperAdmin: false }]))
      .mockReturnValueOnce(
        whereBuilder([
          { organizationId: 'org-admin', role: 'admin' },
          { organizationId: 'org-member', role: 'member' },
        ])
      )
      .mockReturnValueOnce(projectListBuilder(rows))
      .mockReturnValueOnce(whereBuilder([{ projectId: 'project-member-org' }]))
      .mockReturnValueOnce(projectListBuilder(rows));

    const response = await GET(new NextRequestCtor('http://localhost:3002/api/projects'));

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual([
      {
        id: 'project-admin-org',
        organizationId: 'org-admin',
        name: 'Admin org project',
        updatedAt: '2026-01-03T00:00:00.000Z',
        organizationName: 'Admin Org',
        team: null,
      },
      {
        id: 'project-member-org',
        organizationId: 'org-member',
        name: 'Member org project',
        updatedAt: '2026-01-02T00:00:00.000Z',
        organizationName: 'Member Org',
        team: null,
      },
    ]);
  });

  it('rejects a teamspace that belongs to a different organization during project creation', async () => {
    authMock.mockResolvedValue({ user: { id: 'user-1' } });
    hasPermissionMock.mockResolvedValue(true);
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
    expect(hasPermissionMock).toHaveBeenCalledWith('org-1', 'project:create');
    await expect(response.json()).resolves.toEqual({
      error: 'Selected teamspace does not belong to this organization',
      code: 'TEAMSPACE_ORGANIZATION_MISMATCH',
    });
  });

  it('rejects project creation when project:create is missing', async () => {
    authMock.mockResolvedValue({ user: { id: 'user-1' } });
    hasPermissionMock.mockResolvedValue(false);

    const response = await POST(
      new NextRequestCtor('http://localhost:3002/api/projects', {
        method: 'POST',
        body: JSON.stringify({
          name: 'API Platform',
          key: 'API',
          organizationId: 'org-1',
        }),
      })
    );

    expect(response.status).toBe(403);
    expect(hasPermissionMock).toHaveBeenCalledWith('org-1', 'project:create');
    await expect(response.json()).resolves.toEqual({
      error: 'You need project creation permission in this organization',
      code: 'PROJECT_CREATE_FORBIDDEN',
    });
    expect(dbInsertMock).not.toHaveBeenCalled();
  });
});
