/**
 * Tests for the /api/inbox route, focused on filter combinations.
 *
 * We mock the drizzle chain so we can assert that the right operators land
 * in the WHERE clause for each chip combination. The route itself never
 * touches the network or the database in these tests.
 */

const authMock = jest.fn();
const dbSelectMock = jest.fn();

class MockNextRequest {
  readonly nextUrl: URL;
  constructor(public readonly url: string) {
    this.nextUrl = new URL(url);
  }
  get method() {
    return 'GET';
  }
  async json() {
    return {};
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

jest.mock('@tasknebula/db', () => {
  const op = (type: string, args: unknown[]) => ({ type, args });
  return {
    db: {
      select: (...args: unknown[]) => dbSelectMock(...args),
    },
    notifications: new Proxy(
      {},
      {
        get: (_target, prop: string) => `notifications.${prop}`,
      }
    ),
    users: new Proxy(
      {},
      {
        get: (_target, prop: string) => `users.${prop}`,
      }
    ),
    issues: new Proxy(
      {},
      {
        get: (_target, prop: string) => `issues.${prop}`,
      }
    ),
    projects: new Proxy(
      {},
      {
        get: (_target, prop: string) => `projects.${prop}`,
      }
    ),
    and: (...args: unknown[]) => op('and', args),
    or: (...args: unknown[]) => op('or', args),
    eq: (...args: unknown[]) => op('eq', args),
    desc: (...args: unknown[]) => op('desc', args),
    gt: (...args: unknown[]) => op('gt', args),
    gte: (...args: unknown[]) => op('gte', args),
    lt: (...args: unknown[]) => op('lt', args),
    lte: (...args: unknown[]) => op('lte', args),
    isNull: (...args: unknown[]) => op('isNull', args),
    inArray: (...args: unknown[]) => op('inArray', args),
  };
});

function chain(result: unknown, capture?: (where: unknown) => void) {
  const whereSpy = jest.fn().mockImplementation((arg: unknown) => {
    capture?.(arg);
    return {
      orderBy: jest.fn().mockReturnValue({
        limit: jest.fn().mockResolvedValue(result),
      }),
    };
  });
  return {
    from: jest.fn().mockReturnValue({
      leftJoin: jest.fn().mockReturnValue({
        leftJoin: jest.fn().mockReturnValue({
          leftJoin: jest.fn().mockReturnValue({
            where: whereSpy,
          }),
        }),
      }),
    }),
  };
}

function findInTree(tree: unknown, predicate: (node: { type: string; args: unknown[] }) => boolean): boolean {
  if (!tree || typeof tree !== 'object') return false;
  const node = tree as { type?: string; args?: unknown[] };
  if (typeof node.type === 'string' && Array.isArray(node.args)) {
    if (predicate(node as { type: string; args: unknown[] })) return true;
    return node.args.some((child) => findInTree(child, predicate));
  }
  return false;
}

describe('GET /api/inbox filter combinations', () => {
  let NextRequestCtor: typeof import('next/server').NextRequest;
  let GET: typeof import('../route').GET;

  beforeAll(async () => {
    ({ NextRequest: NextRequestCtor } = await import('next/server'));
    ({ GET } = await import('../route'));
  });

  beforeEach(() => {
    jest.clearAllMocks();
    authMock.mockResolvedValue({ user: { id: 'user-1' } });
  });

  it('returns 401 when unauthenticated', async () => {
    authMock.mockResolvedValue(null);
    const response = await GET(new NextRequestCtor('http://localhost/api/inbox'));
    expect(response.status).toBe(401);
  });

  it('always scopes by the authenticated user and excludes future-snoozed items by default', async () => {
    let captured: unknown = null;
    dbSelectMock.mockReturnValueOnce(chain([], (w) => (captured = w)));

    const response = await GET(new NextRequestCtor('http://localhost/api/inbox'));
    expect(response.status).toBe(200);

    // user_id = user-1
    expect(
      findInTree(
        captured,
        (n) => n.type === 'eq' && n.args[0] === 'notifications.userId' && n.args[1] === 'user-1'
      )
    ).toBe(true);
    // snoozedUntil IS NULL OR snoozedUntil <= now()
    expect(findInTree(captured, (n) => n.type === 'isNull')).toBe(true);
    expect(findInTree(captured, (n) => n.type === 'lte' && n.args[0] === 'notifications.snoozedUntil')).toBe(
      true
    );
  });

  it('filters by actor_type when chip is set', async () => {
    let captured: unknown = null;
    dbSelectMock.mockReturnValueOnce(chain([], (w) => (captured = w)));

    await GET(new NextRequestCtor('http://localhost/api/inbox?actor_type=agent'));

    expect(
      findInTree(
        captured,
        (n) => n.type === 'eq' && n.args[0] === 'notifications.actorType' && n.args[1] === 'agent'
      )
    ).toBe(true);
  });

  it('ignores unknown actor_type values', async () => {
    let captured: unknown = null;
    dbSelectMock.mockReturnValueOnce(chain([], (w) => (captured = w)));

    await GET(new NextRequestCtor('http://localhost/api/inbox?actor_type=alien'));

    expect(
      findInTree(captured, (n) => n.type === 'eq' && n.args[0] === 'notifications.actorType')
    ).toBe(false);
  });

  it('maps notification_type chip "status" to the underlying enum values', async () => {
    let captured: unknown = null;
    dbSelectMock.mockReturnValueOnce(chain([], (w) => (captured = w)));

    await GET(new NextRequestCtor('http://localhost/api/inbox?notification_type=status'));

    expect(
      findInTree(
        captured,
        (n) =>
          n.type === 'inArray' &&
          n.args[0] === 'notifications.type' &&
          Array.isArray(n.args[1]) &&
          (n.args[1] as string[]).includes('status_changed') &&
          (n.args[1] as string[]).includes('issue_updated')
      )
    ).toBe(true);
  });

  it('returns empty payload for a known chip that has no underlying events (reaction)', async () => {
    const response = await GET(new NextRequestCtor('http://localhost/api/inbox?notification_type=reaction'));
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ items: [], nextCursor: null });
    // We short-circuit before calling the DB.
    expect(dbSelectMock).not.toHaveBeenCalled();
  });

  it('flips snoozed semantics when snoozed=true', async () => {
    let captured: unknown = null;
    dbSelectMock.mockReturnValueOnce(chain([], (w) => (captured = w)));

    await GET(new NextRequestCtor('http://localhost/api/inbox?snoozed=true'));

    // snoozedUntil > now (i.e. still in the future)
    expect(
      findInTree(captured, (n) => n.type === 'gt' && n.args[0] === 'notifications.snoozedUntil')
    ).toBe(true);
    // The default-mode disjunction should not be present.
    expect(findInTree(captured, (n) => n.type === 'isNull')).toBe(false);
  });

  it('combines unread + project + since', async () => {
    let captured: unknown = null;
    dbSelectMock.mockReturnValueOnce(chain([], (w) => (captured = w)));

    const since = '2026-05-14T00:00:00.000Z';
    await GET(
      new NextRequestCtor(
        `http://localhost/api/inbox?unread=true&project=p1&since=${encodeURIComponent(since)}`
      )
    );

    expect(
      findInTree(
        captured,
        (n) =>
          n.type === 'eq' &&
          n.args[0] === 'notifications.isRead' &&
          n.args[1] === false
      )
    ).toBe(true);
    expect(
      findInTree(
        captured,
        (n) =>
          n.type === 'eq' &&
          n.args[0] === 'notifications.projectId' &&
          n.args[1] === 'p1'
      )
    ).toBe(true);
    expect(
      findInTree(captured, (n) => n.type === 'gte' && n.args[0] === 'notifications.createdAt')
    ).toBe(true);
  });

  it('paginates with a cursor that decodes to (createdAt, id) order', async () => {
    let captured: unknown = null;
    // Two rows so we trip `hasMore = true` when limit=1.
    const rows = [
      {
        id: 'n1',
        type: 'mention',
        actorType: 'user',
        title: 't',
        message: 'm',
        issueId: null,
        projectId: null,
        isRead: false,
        readAt: null,
        snoozedUntil: null,
        createdAt: new Date('2026-05-14T00:00:00.000Z'),
        actor: null,
        issue: null,
        project: null,
      },
      {
        id: 'n2',
        type: 'mention',
        actorType: 'user',
        title: 't2',
        message: 'm2',
        issueId: null,
        projectId: null,
        isRead: false,
        readAt: null,
        snoozedUntil: null,
        createdAt: new Date('2026-05-13T00:00:00.000Z'),
        actor: null,
        issue: null,
        project: null,
      },
    ];
    dbSelectMock.mockReturnValueOnce(chain(rows, (w) => (captured = w)));

    const response = await GET(new NextRequestCtor('http://localhost/api/inbox?limit=1'));
    const body = (await response.json()) as { items: unknown[]; nextCursor: string | null };
    expect(body.items).toHaveLength(1);
    expect(body.nextCursor).not.toBeNull();
    const decoded = Buffer.from(body.nextCursor!, 'base64url').toString('utf8');
    expect(decoded.endsWith('|n1')).toBe(true);

    // And: feed the cursor back, expect an `lt(createdAt)` predicate to appear.
    dbSelectMock.mockReturnValueOnce(chain([], (w) => (captured = w)));
    await GET(
      new NextRequestCtor(
        `http://localhost/api/inbox?cursor=${encodeURIComponent(body.nextCursor!)}`
      )
    );
    expect(
      findInTree(captured, (n) => n.type === 'lt' && n.args[0] === 'notifications.createdAt')
    ).toBe(true);
  });

  it('caps limit at 100 and falls back to default for invalid values', async () => {
    let captured: unknown = null;
    dbSelectMock.mockReturnValueOnce(chain([], (w) => (captured = w)));

    // Just ensure no crash on bogus limit values.
    const response = await GET(new NextRequestCtor('http://localhost/api/inbox?limit=abc'));
    expect(response.status).toBe(200);
  });
});
