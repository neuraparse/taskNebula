/**
 * Tests for the org / project membership guard on GET /api/search.
 *
 * The route previously accepted `organizationId` (and optional `projectId`)
 * straight from the query string and ran the JQL search without verifying
 * the caller was actually a member. This file pins down the new guard:
 *
 *   1. anonymous           → 401
 *   2. non-member org      → 403 { error: 'Forbidden' }
 *   3. member org, no proj → passes guard, free-text delegates to hybrid
 *   4. member org, non-member project → 403
 *   5. member org, member project     → passes guard, free-text delegates to hybrid
 *
 * Mocks mirror the strategy used in
 * apps/web/src/app/api/projects/route.test.ts and sprints/route.test.ts:
 * `next/server`, `@/auth`, `@tasknebula/db`, and `drizzle-orm` are stubbed
 * so we never touch a real database. The `db.select(...).from(...).where(...).limit(1)`
 * chain returned by the route is satisfied via a `limitBuilder` helper that
 * yields the rows we want for each call in order.
 */

const authMock = jest.fn();
const dbSelectMock = jest.fn();
const dbInsertMock = jest.fn();
const parseJQLMock = jest.fn();
const hybridSearchMock = jest.fn();
const looksLikeFreeTextMock = jest.fn();

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

jest.mock('@paralleldrive/cuid2', () => ({
  createId: () => 'generated-id',
}));

jest.mock('@tasknebula/db', () => ({
  db: {
    select: (...args: unknown[]) => dbSelectMock(...args),
    insert: (...args: unknown[]) => dbInsertMock(...args),
  },
  // Tables only need to expose the columns referenced by the route so that
  // drizzle's `eq(col, value)` calls succeed against our stubbed `eq` mock.
  issues: {
    id: 'issues.id',
    key: 'issues.key',
    title: 'issues.title',
    description: 'issues.description',
    status: 'issues.status',
    priority: 'issues.priority',
    type: 'issues.type',
    labels: 'issues.labels',
    assigneeId: 'issues.assigneeId',
    reporterId: 'issues.reporterId',
    organizationId: 'issues.organizationId',
    projectId: 'issues.projectId',
    sprintId: 'issues.sprintId',
    createdAt: 'issues.createdAt',
    updatedAt: 'issues.updatedAt',
  },
  users: { id: 'users.id' },
  workflowStatuses: { id: 'workflowStatuses.id' },
  projects: { id: 'projects.id', organizationId: 'projects.organizationId' },
  sprints: { id: 'sprints.id' },
  searchHistory: {
    userId: 'searchHistory.userId',
    organizationId: 'searchHistory.organizationId',
  },
  organizationMembers: {
    userId: 'organizationMembers.userId',
    organizationId: 'organizationMembers.organizationId',
    role: 'organizationMembers.role',
  },
  projectMembers: {
    userId: 'projectMembers.userId',
    projectId: 'projectMembers.projectId',
    role: 'projectMembers.role',
  },
  parseJQL: (...args: unknown[]) => parseJQLMock(...args),
}));

jest.mock('@/lib/search/hybrid', () => ({
  hybridSearch: (...args: unknown[]) => hybridSearchMock(...args),
  looksLikeFreeText: (...args: unknown[]) => looksLikeFreeTextMock(...args),
}));

jest.mock('drizzle-orm', () => ({
  and: (...args: unknown[]) => ({ type: 'and', args }),
  or: (...args: unknown[]) => ({ type: 'or', args }),
  desc: (value: unknown) => ({ type: 'desc', value }),
  eq: (left: unknown, right: unknown) => ({ type: 'eq', left, right }),
  inArray: (left: unknown, right: unknown) => ({ type: 'inArray', left, right }),
  gte: (left: unknown, right: unknown) => ({ type: 'gte', left, right }),
  lte: (left: unknown, right: unknown) => ({ type: 'lte', left, right }),
  like: (left: unknown, right: unknown) => ({ type: 'like', left, right }),
}));

/**
 * Build a builder that resolves `.from(...).where(...).limit(n)` to the
 * given result. The two membership lookups in route.ts both end in
 * `.limit(1)`, so this is the only shape we need.
 */
function limitBuilder(result: unknown) {
  return {
    from: jest.fn().mockReturnValue({
      where: jest.fn().mockReturnValue({
        limit: jest.fn().mockResolvedValue(result),
      }),
    }),
  };
}

describe('/api/search membership guard', () => {
  let NextRequestCtor: typeof import('next/server').NextRequest;
  let GET: typeof import('../route').GET;

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
    ({ GET } = await import('../route'));
  });

  beforeEach(() => {
    jest.clearAllMocks();
    dbInsertMock.mockReturnValue({
      values: jest.fn().mockResolvedValue(undefined),
    });
    hybridSearchMock.mockResolvedValue([
      {
        id: 'iss-1',
        issueId: 'iss-1',
        key: 'TN-1',
        title: 'Free text match',
        snippet: 'foo',
        projectId: 'proj-1',
        entityType: 'issue',
        bm25Rank: 1,
        vectorRank: null,
        score: 0.1,
      },
    ]);
    looksLikeFreeTextMock.mockReturnValue(true);
    // Default: parseJQL returns invalid so we never reach the heavy issues
    // query. Tests that need to assert the *guard* passes the call through
    // assert on the resulting "Invalid query syntax" 400.
    parseJQLMock.mockReturnValue({
      isValid: false,
      error: 'mocked invalid query',
    });
  });

  it('rejects an anonymous request with 401', async () => {
    authMock.mockResolvedValue(null);

    const response = await GET(
      new NextRequestCtor('http://localhost:3002/api/search?q=foo&organizationId=org-1')
    );

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toEqual({ error: 'Unauthorized' });
    // Guard short-circuits before any DB hit.
    expect(dbSelectMock).not.toHaveBeenCalled();
    expect(parseJQLMock).not.toHaveBeenCalled();
  });

  it('rejects an org query from a non-member with 403', async () => {
    authMock.mockResolvedValue({ user: { id: 'user-1' } });
    // First (and only) DB call is the org-member lookup → no row.
    dbSelectMock.mockReturnValueOnce(limitBuilder([]));

    const response = await GET(
      new NextRequestCtor('http://localhost:3002/api/search?q=foo&organizationId=org-1')
    );

    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toEqual({ error: 'Forbidden' });
    expect(dbSelectMock).toHaveBeenCalledTimes(1);
    expect(parseJQLMock).not.toHaveBeenCalled();
  });

  it('passes the guard for an org member when no projectId is supplied', async () => {
    authMock.mockResolvedValue({ user: { id: 'user-1' } });
    dbSelectMock.mockReturnValueOnce(limitBuilder([{ role: 'member' }]));

    const response = await GET(
      new NextRequestCtor('http://localhost:3002/api/search?q=foo&organizationId=org-1')
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      results: [
        {
          id: 'iss-1',
          issueId: 'iss-1',
          key: 'TN-1',
          title: 'Free text match',
          snippet: 'foo',
          projectId: 'proj-1',
          entityType: 'issue',
          bm25Rank: 1,
          vectorRank: null,
          score: 0.1,
        },
      ],
      count: 1,
      query: 'foo',
      criteria: { text: 'foo' },
      mode: 'freeText',
    });
    expect(hybridSearchMock).toHaveBeenCalledWith(
      expect.objectContaining({
        query: 'foo',
        filters: { organizationId: 'org-1', projectId: null },
        limit: 100,
      })
    );
    expect(parseJQLMock).not.toHaveBeenCalled();
    // Only one membership lookup since no projectId was supplied.
    expect(dbSelectMock).toHaveBeenCalledTimes(1);
  });

  it('rejects an org member who is not a member of the requested project', async () => {
    authMock.mockResolvedValue({ user: { id: 'user-1' } });
    dbSelectMock
      // Org membership: present.
      .mockReturnValueOnce(limitBuilder([{ role: 'member' }]))
      // Project membership: absent.
      .mockReturnValueOnce(limitBuilder([]));

    const response = await GET(
      new NextRequestCtor(
        'http://localhost:3002/api/search?q=foo&organizationId=org-1&projectId=proj-1'
      )
    );

    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toEqual({ error: 'Forbidden' });
    expect(dbSelectMock).toHaveBeenCalledTimes(2);
    // Should not reach JQL parsing on a guard failure.
    expect(parseJQLMock).not.toHaveBeenCalled();
  });

  it('passes the guard for an org + project member', async () => {
    authMock.mockResolvedValue({ user: { id: 'user-1' } });
    dbSelectMock
      .mockReturnValueOnce(limitBuilder([{ role: 'member' }]))
      .mockReturnValueOnce(limitBuilder([{ role: 'member' }]));

    const response = await GET(
      new NextRequestCtor(
        'http://localhost:3002/api/search?q=foo&organizationId=org-1&projectId=proj-1'
      )
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      count: 1,
      query: 'foo',
      criteria: { text: 'foo' },
      mode: 'freeText',
    });
    expect(hybridSearchMock).toHaveBeenCalledWith(
      expect.objectContaining({
        query: 'foo',
        filters: { organizationId: 'org-1', projectId: 'proj-1' },
      })
    );
    expect(parseJQLMock).not.toHaveBeenCalled();
    expect(dbSelectMock).toHaveBeenCalledTimes(2);
  });

  it('keeps structured JQL on the parser path after the guard passes', async () => {
    authMock.mockResolvedValue({ user: { id: 'user-1' } });
    dbSelectMock.mockReturnValueOnce(limitBuilder([{ role: 'member' }]));
    looksLikeFreeTextMock.mockReturnValue(false);

    const response = await GET(
      new NextRequestCtor(
        'http://localhost:3002/api/search?q=status%20%3D%20done&organizationId=org-1'
      )
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      error: 'Invalid query syntax',
      details: 'mocked invalid query',
    });
    expect(parseJQLMock).toHaveBeenCalledWith('status = done');
    expect(hybridSearchMock).not.toHaveBeenCalled();
    expect(dbSelectMock).toHaveBeenCalledTimes(1);
  });
});
