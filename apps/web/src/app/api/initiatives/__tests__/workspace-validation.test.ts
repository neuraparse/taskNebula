/**
 * @jest-environment node
 *
 * Tests for the two cross-workspace validation guards added to the
 * `/api/initiatives` routes:
 *
 *   1. `parentInitiativeId` must live in the same workspace as the
 *      initiative being created/edited. Without this guard the FK would
 *      surface a 500 instead of an actionable 400.
 *   2. Every entry in `projectIds` must belong to that workspace. Same
 *      story — we want a clean 400 with the offending id, not an FK 500
 *      after the parent row was already inserted.
 *
 * Mock strategy mirrors apps/web/src/app/api/projects/route.test.ts and
 * apps/web/src/app/api/search/__tests__/membership-guard.test.ts: stub
 * `next/server`, `@/auth`, `@tasknebula/db`, `drizzle-orm`, and the
 * depth helpers. We queue a fresh builder per `db.select(...)` call so
 * each test only describes the rows relevant to that path.
 */

const authMock = jest.fn();
const dbSelectMock = jest.fn();
const dbInsertMock = jest.fn();
const dbUpdateMock = jest.fn();
const dbDeleteMock = jest.fn();
const buildInitiativeIndexMock = jest.fn();
const validateInitiativeDepthMock = jest.fn();
const wouldCreateInitiativeCycleMock = jest.fn();

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
    update: (...args: unknown[]) => dbUpdateMock(...args),
    delete: (...args: unknown[]) => dbDeleteMock(...args),
  },
  initiatives: {
    id: 'initiatives.id',
    workspaceId: 'initiatives.workspaceId',
    parentInitiativeId: 'initiatives.parentInitiativeId',
    sortOrder: 'initiatives.sortOrder',
    createdAt: 'initiatives.createdAt',
  },
  initiativeProjects: {
    initiativeId: 'initiativeProjects.initiativeId',
    projectId: 'initiativeProjects.projectId',
  },
  organizationMembers: {
    userId: 'organizationMembers.userId',
    organizationId: 'organizationMembers.organizationId',
  },
  projects: {
    id: 'projects.id',
    organizationId: 'projects.organizationId',
  },
  MAX_INITIATIVE_DEPTH: 5,
}));

jest.mock('drizzle-orm', () => ({
  and: (...args: unknown[]) => ({ type: 'and', args }),
  asc: (value: unknown) => ({ type: 'asc', value }),
  desc: (value: unknown) => ({ type: 'desc', value }),
  eq: (left: unknown, right: unknown) => ({ type: 'eq', left, right }),
  inArray: (left: unknown, right: unknown) => ({ type: 'inArray', left, right }),
}));

jest.mock('@/lib/initiatives/depth', () => ({
  buildInitiativeIndex: (...args: unknown[]) => buildInitiativeIndexMock(...args),
  validateInitiativeDepth: (...args: unknown[]) => validateInitiativeDepthMock(...args),
  wouldCreateInitiativeCycle: (...args: unknown[]) => wouldCreateInitiativeCycleMock(...args),
}));

/**
 * Builder that resolves `.from(...).where(...).limit(n)` to `result`.
 * Matches the membership lookup, the parent-initiative lookup, and the
 * PATCH "load initiative" call.
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

/**
 * Builder that resolves `.from(...).where(...)` directly (no `.limit`).
 * Matches the sibling-scan (depth check) and the project-ownership scan.
 */
function whereBuilder(result: unknown) {
  return {
    from: jest.fn().mockReturnValue({
      where: jest.fn().mockResolvedValue(result),
    }),
  };
}

/** Builder for `db.insert(...).values(...).returning()`. */
function insertReturningBuilder(returned: unknown, valuesSpy?: jest.Mock) {
  const valuesFn = valuesSpy ?? jest.fn();
  valuesFn.mockReturnValue({
    returning: jest.fn().mockResolvedValue(returned),
  });
  return { values: valuesFn };
}

/** Builder for `db.insert(...).values(...).onConflictDoNothing()`. */
function insertOnConflictBuilder(valuesSpy?: jest.Mock) {
  const valuesFn = valuesSpy ?? jest.fn();
  valuesFn.mockReturnValue({
    onConflictDoNothing: jest.fn().mockResolvedValue(undefined),
  });
  return { values: valuesFn };
}

/** Builder for the plain `db.insert(...).values(...)` used by PATCH. */
function insertValuesBuilder(valuesSpy?: jest.Mock) {
  const valuesFn = valuesSpy ?? jest.fn().mockResolvedValue(undefined);
  return { values: valuesFn };
}

/** Builder for `db.update(...).set(...).where(...).returning()`. */
function updateReturningBuilder(returned: unknown) {
  return {
    set: jest.fn().mockReturnValue({
      where: jest.fn().mockReturnValue({
        returning: jest.fn().mockResolvedValue(returned),
      }),
    }),
  };
}

/** Builder for `db.delete(...).where(...)`. */
function deleteBuilder() {
  return {
    where: jest.fn().mockResolvedValue(undefined),
  };
}

describe('/api/initiatives workspace validation guards', () => {
  let NextRequestCtor: typeof import('next/server').NextRequest;
  let POST: typeof import('../route').POST;
  let PATCH: typeof import('../[id]/route').PATCH;

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
    ({ POST } = await import('../route'));
    ({ PATCH } = await import('../[id]/route'));
  });

  beforeEach(() => {
    jest.clearAllMocks();
    // Default depth helpers: index is opaque, parent is depth-OK, no cycle.
    buildInitiativeIndexMock.mockReturnValue(new Map());
    validateInitiativeDepthMock.mockReturnValue({ allowed: true });
    wouldCreateInitiativeCycleMock.mockReturnValue(false);
  });

  // ------------------------------------------------------------------
  // POST /api/initiatives
  // ------------------------------------------------------------------
  describe('POST /api/initiatives', () => {
    it('rejects parentInitiativeId belonging to another workspace with 400', async () => {
      authMock.mockResolvedValue({ user: { id: 'user-1' } });
      dbSelectMock
        // 1) membership lookup → present
        .mockReturnValueOnce(limitBuilder([{ userId: 'user-1', organizationId: 'ws-1' }]))
        // 2) parent initiative lookup → exists but in ws-2
        .mockReturnValueOnce(limitBuilder([{ id: 'parent-foreign', workspaceId: 'ws-2' }]));

      const response = await POST(
        new NextRequestCtor('http://localhost:3002/api/initiatives', {
          method: 'POST',
          body: JSON.stringify({
            workspaceId: 'ws-1',
            name: 'Q3 Bets',
            parentInitiativeId: 'parent-foreign',
          }),
        })
      );

      expect(response.status).toBe(400);
      await expect(response.json()).resolves.toEqual({
        error: 'parentInitiativeId does not belong to this workspace',
      });
      // We bail before touching siblings, projects, or insert.
      expect(dbSelectMock).toHaveBeenCalledTimes(2);
      expect(dbInsertMock).not.toHaveBeenCalled();
    });

    it('accepts a same-workspace parentInitiativeId and creates the initiative', async () => {
      authMock.mockResolvedValue({ user: { id: 'user-1' } });
      const insertValuesSpy = jest.fn();

      dbSelectMock
        // 1) membership
        .mockReturnValueOnce(limitBuilder([{ userId: 'user-1', organizationId: 'ws-1' }]))
        // 2) parent in same workspace
        .mockReturnValueOnce(limitBuilder([{ id: 'parent-ok', workspaceId: 'ws-1' }]))
        // 3) siblings (for depth) — empty is fine; helpers are mocked
        .mockReturnValueOnce(whereBuilder([]));

      dbInsertMock.mockReturnValueOnce(
        insertReturningBuilder(
          [{ id: 'generated-id', name: 'Child', workspaceId: 'ws-1' }],
          insertValuesSpy
        )
      );

      const response = await POST(
        new NextRequestCtor('http://localhost:3002/api/initiatives', {
          method: 'POST',
          body: JSON.stringify({
            workspaceId: 'ws-1',
            name: 'Child',
            parentInitiativeId: 'parent-ok',
          }),
        })
      );

      expect(response.status).toBe(201);
      const body = (await response.json()) as { initiative: { id: string }; maxDepth: number };
      expect(body.initiative.id).toBe('generated-id');
      expect(body.maxDepth).toBe(5);
      expect(validateInitiativeDepthMock).toHaveBeenCalledWith('parent-ok', expect.any(Map));
      // No `projectIds` provided → no second insert.
      expect(dbInsertMock).toHaveBeenCalledTimes(1);
      expect(insertValuesSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          id: 'generated-id',
          workspaceId: 'ws-1',
          parentInitiativeId: 'parent-ok',
          name: 'Child',
        })
      );
    });

    it('rejects projectIds containing a foreign project id with 400 (mentions the id)', async () => {
      authMock.mockResolvedValue({ user: { id: 'user-1' } });
      dbSelectMock
        // 1) membership
        .mockReturnValueOnce(limitBuilder([{ userId: 'user-1', organizationId: 'ws-1' }]))
        // 2) projects scan: only `proj-ours` matched, `proj-foreign` missing
        .mockReturnValueOnce(whereBuilder([{ id: 'proj-ours' }]));

      const response = await POST(
        new NextRequestCtor('http://localhost:3002/api/initiatives', {
          method: 'POST',
          body: JSON.stringify({
            workspaceId: 'ws-1',
            name: 'Top-level',
            projectIds: ['proj-ours', 'proj-foreign'],
          }),
        })
      );

      expect(response.status).toBe(400);
      await expect(response.json()).resolves.toEqual({
        error: 'Project proj-foreign does not belong to this workspace',
      });
      expect(dbInsertMock).not.toHaveBeenCalled();
    });

    it('accepts projectIds entirely within the workspace and inserts link rows', async () => {
      authMock.mockResolvedValue({ user: { id: 'user-1' } });
      const initiativeValuesSpy = jest.fn();
      const linkValuesSpy = jest.fn();

      dbSelectMock
        // 1) membership
        .mockReturnValueOnce(limitBuilder([{ userId: 'user-1', organizationId: 'ws-1' }]))
        // 2) projects scan: both owned
        .mockReturnValueOnce(whereBuilder([{ id: 'proj-a' }, { id: 'proj-b' }]));

      dbInsertMock
        // 1) initiatives insert
        .mockReturnValueOnce(
          insertReturningBuilder(
            [{ id: 'generated-id', name: 'Top-level', workspaceId: 'ws-1' }],
            initiativeValuesSpy
          )
        )
        // 2) initiative_projects link insert
        .mockReturnValueOnce(insertOnConflictBuilder(linkValuesSpy));

      const response = await POST(
        new NextRequestCtor('http://localhost:3002/api/initiatives', {
          method: 'POST',
          body: JSON.stringify({
            workspaceId: 'ws-1',
            name: 'Top-level',
            projectIds: ['proj-a', 'proj-b'],
          }),
        })
      );

      expect(response.status).toBe(201);
      expect(dbInsertMock).toHaveBeenCalledTimes(2);
      // Initiative row carries the right workspace.
      expect(initiativeValuesSpy).toHaveBeenCalledWith(
        expect.objectContaining({ workspaceId: 'ws-1', name: 'Top-level' })
      );
      // Link rows are exactly { initiativeId, projectId } per requested id.
      expect(linkValuesSpy).toHaveBeenCalledWith([
        { initiativeId: 'generated-id', projectId: 'proj-a' },
        { initiativeId: 'generated-id', projectId: 'proj-b' },
      ]);
    });

    it('accepts an empty projectIds array without inserting any link rows', async () => {
      authMock.mockResolvedValue({ user: { id: 'user-1' } });
      const initiativeValuesSpy = jest.fn();

      // Membership only — `requested.length === 0` short-circuits before the
      // project ownership scan, so we don't queue a `whereBuilder` here.
      dbSelectMock.mockReturnValueOnce(
        limitBuilder([{ userId: 'user-1', organizationId: 'ws-1' }])
      );

      dbInsertMock.mockReturnValueOnce(
        insertReturningBuilder(
          [{ id: 'generated-id', name: 'No-links', workspaceId: 'ws-1' }],
          initiativeValuesSpy
        )
      );

      const response = await POST(
        new NextRequestCtor('http://localhost:3002/api/initiatives', {
          method: 'POST',
          body: JSON.stringify({
            workspaceId: 'ws-1',
            name: 'No-links',
            projectIds: [],
          }),
        })
      );

      expect(response.status).toBe(201);
      // Initiative inserted, but no second insert for `initiative_projects`.
      expect(dbInsertMock).toHaveBeenCalledTimes(1);
      expect(initiativeValuesSpy).toHaveBeenCalledTimes(1);
    });
  });

  // ------------------------------------------------------------------
  // PATCH /api/initiatives/[id]
  // ------------------------------------------------------------------
  describe('PATCH /api/initiatives/[id]', () => {
    const params = Promise.resolve({ id: 'init-1' });

    it('rejects projectIds containing a foreign project id with 400', async () => {
      authMock.mockResolvedValue({ user: { id: 'user-1' } });

      dbSelectMock
        // 1) loadAndAuthorize: initiative row
        .mockReturnValueOnce(limitBuilder([{ id: 'init-1', workspaceId: 'ws-1', slug: 'old' }]))
        // 2) loadAndAuthorize: membership
        .mockReturnValueOnce(limitBuilder([{ userId: 'user-1', organizationId: 'ws-1' }]))
        // 3) projects scan: foreign id not returned
        .mockReturnValueOnce(whereBuilder([]));

      // The PATCH path runs the update *before* the projectIds scan, so we
      // still need to satisfy `db.update(...)`. The route bails on the
      // workspace check before any delete/insert hits the link table.
      dbUpdateMock.mockReturnValueOnce(
        updateReturningBuilder([{ id: 'init-1', workspaceId: 'ws-1' }])
      );

      const response = await PATCH(
        new NextRequestCtor('http://localhost:3002/api/initiatives/init-1', {
          method: 'PATCH',
          body: JSON.stringify({ projectIds: ['foreign'] }),
        }),
        { params }
      );

      expect(response.status).toBe(400);
      await expect(response.json()).resolves.toEqual({
        error: 'Project foreign does not belong to this workspace',
      });
      // Guard short-circuits before delete/insert on initiative_projects.
      expect(dbDeleteMock).not.toHaveBeenCalled();
      expect(dbInsertMock).not.toHaveBeenCalled();
    });

    it('accepts projectIds in the workspace: deletes old links and inserts new ones', async () => {
      authMock.mockResolvedValue({ user: { id: 'user-1' } });

      dbSelectMock
        // 1) loadAndAuthorize: initiative row
        .mockReturnValueOnce(limitBuilder([{ id: 'init-1', workspaceId: 'ws-1', slug: 'old' }]))
        // 2) loadAndAuthorize: membership
        .mockReturnValueOnce(limitBuilder([{ userId: 'user-1', organizationId: 'ws-1' }]))
        // 3) projects scan: owned
        .mockReturnValueOnce(whereBuilder([{ id: 'ours' }]));

      dbUpdateMock.mockReturnValueOnce(
        updateReturningBuilder([{ id: 'init-1', workspaceId: 'ws-1', slug: 'old' }])
      );

      const deleteWhereSpy = deleteBuilder();
      dbDeleteMock.mockReturnValueOnce(deleteWhereSpy);

      const linkValuesSpy = jest.fn().mockResolvedValue(undefined);
      dbInsertMock.mockReturnValueOnce(insertValuesBuilder(linkValuesSpy));

      const response = await PATCH(
        new NextRequestCtor('http://localhost:3002/api/initiatives/init-1', {
          method: 'PATCH',
          body: JSON.stringify({ projectIds: ['ours'] }),
        }),
        { params }
      );

      expect(response.status).toBe(200);
      // Old links wiped first.
      expect(dbDeleteMock).toHaveBeenCalledTimes(1);
      expect(deleteWhereSpy.where).toHaveBeenCalledTimes(1);
      // New link row inserted with the right shape.
      expect(linkValuesSpy).toHaveBeenCalledWith([{ initiativeId: 'init-1', projectId: 'ours' }]);
    });
  });
});
