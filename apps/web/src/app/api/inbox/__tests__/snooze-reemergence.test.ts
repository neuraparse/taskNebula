/**
 * Tests for snooze re-emergence logic.
 *
 * The inbox doesn't run a cron — re-emergence is enforced at *read* time.
 * The default GET query must:
 *   - Exclude rows whose `snoozed_until` is still in the future (NOT visible).
 *   - Include rows whose `snoozed_until` is null OR <= now() (visible again).
 *
 * These tests pin the contract by inspecting the WHERE tree the route
 * builds for a default `GET /api/inbox` call.
 */

const authMock = jest.fn();
const dbSelectMock = jest.fn();
const dbUpdateMock = jest.fn();

class MockNextRequest {
  readonly nextUrl: URL;
  private readonly bodyValue: string;
  constructor(
    public readonly url: string,
    init?: { method?: string; body?: string }
  ) {
    this.nextUrl = new URL(url);
    this.bodyValue = init?.body || '';
    this.method = init?.method || 'GET';
  }
  method: string;
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

jest.mock('@tasknebula/db', () => {
  const op = (type: string, args: unknown[]) => ({ type, args });
  return {
    db: {
      select: (...args: unknown[]) => dbSelectMock(...args),
      update: (...args: unknown[]) => dbUpdateMock(...args),
    },
    notifications: new Proxy(
      {},
      { get: (_t, prop: string) => `notifications.${prop}` }
    ),
    users: new Proxy({}, { get: (_t, prop: string) => `users.${prop}` }),
    issues: new Proxy({}, { get: (_t, prop: string) => `issues.${prop}` }),
    projects: new Proxy({}, { get: (_t, prop: string) => `projects.${prop}` }),
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

function selectChain(result: unknown, capture?: (where: unknown) => void) {
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

function findNodes(tree: unknown, predicate: (n: { type: string; args: unknown[] }) => boolean) {
  const found: Array<{ type: string; args: unknown[] }> = [];
  const visit = (node: unknown) => {
    if (!node || typeof node !== 'object') return;
    const t = node as { type?: string; args?: unknown[] };
    if (typeof t.type === 'string' && Array.isArray(t.args)) {
      if (predicate(t as { type: string; args: unknown[] })) {
        found.push(t as { type: string; args: unknown[] });
      }
      for (const child of t.args) visit(child);
    }
  };
  visit(tree);
  return found;
}

describe('snooze re-emergence', () => {
  let NextRequestCtor: typeof import('next/server').NextRequest;
  let GET: typeof import('../route').GET;
  let snoozePOST: typeof import('../[id]/snooze/route').POST;

  beforeAll(async () => {
    ({ NextRequest: NextRequestCtor } = await import('next/server'));
    ({ GET } = await import('../route'));
    ({ POST: snoozePOST } = await import('../[id]/snooze/route'));
  });

  beforeEach(() => {
    jest.clearAllMocks();
    authMock.mockResolvedValue({ user: { id: 'user-1' } });
  });

  it('default inbox query hides notifications whose snoozed_until is in the future', async () => {
    let captured: unknown = null;
    dbSelectMock.mockReturnValueOnce(selectChain([], (w) => (captured = w)));

    await GET(new NextRequestCtor('http://localhost/api/inbox'));

    // The WHERE tree must include an OR(isNull(snoozedUntil), lte(snoozedUntil, now)).
    const orNodes = findNodes(captured, (n) => n.type === 'or');
    const matchingOr = orNodes.find(
      (orNode) =>
        findNodes(orNode, (n) => n.type === 'isNull' && n.args[0] === 'notifications.snoozedUntil').length > 0 &&
        findNodes(orNode, (n) => n.type === 'lte' && n.args[0] === 'notifications.snoozedUntil').length > 0
    );
    expect(matchingOr).toBeDefined();

    // The `lte` arg's RHS is a Date — the threshold must be "now" (within a
    // couple of seconds of test execution).
    const lteNode = findNodes(matchingOr!, (n) => n.type === 'lte')[0];
    const threshold = lteNode.args[1] as Date;
    expect(threshold).toBeInstanceOf(Date);
    expect(Math.abs(threshold.getTime() - Date.now())).toBeLessThan(5_000);
  });

  it('a row snoozed 1h ago re-emerges in the next GET (lte threshold passes)', async () => {
    let captured: unknown = null;
    dbSelectMock.mockReturnValueOnce(selectChain([], (w) => (captured = w)));

    await GET(new NextRequestCtor('http://localhost/api/inbox'));

    const lteNode = findNodes(
      captured,
      (n) => n.type === 'lte' && n.args[0] === 'notifications.snoozedUntil'
    )[0];
    const threshold = lteNode.args[1] as Date;

    // A row snoozed to one hour ago should now be visible — i.e. its
    // snoozed_until is <= the threshold.
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
    expect(oneHourAgo.getTime() <= threshold.getTime()).toBe(true);

    // Whereas a row snoozed to one hour in the future should still be hidden.
    const oneHourAhead = new Date(Date.now() + 60 * 60 * 1000);
    expect(oneHourAhead.getTime() <= threshold.getTime()).toBe(false);
  });

  it('snooze POST rejects a timestamp in the past (would re-emerge instantly)', async () => {
    const past = new Date(Date.now() - 60_000).toISOString();
    const response = await snoozePOST(
      new NextRequestCtor('http://localhost/api/inbox/n1/snooze', {
        method: 'POST',
        body: JSON.stringify({ until: past }),
      }),
      { params: Promise.resolve({ id: 'n1' }) }
    );
    expect(response.status).toBe(400);
  });

  it('snooze POST accepts a future timestamp and writes it through', async () => {
    const future = new Date(Date.now() + 60 * 60 * 1000).toISOString();
    const updatedReturning = [
      { id: 'n1', snoozedUntil: new Date(future) },
    ];
    dbUpdateMock.mockReturnValueOnce({
      set: jest.fn().mockReturnValue({
        where: jest.fn().mockReturnValue({
          returning: jest.fn().mockResolvedValue(updatedReturning),
        }),
      }),
    });

    const response = await snoozePOST(
      new NextRequestCtor('http://localhost/api/inbox/n1/snooze', {
        method: 'POST',
        body: JSON.stringify({ until: future }),
      }),
      { params: Promise.resolve({ id: 'n1' }) }
    );

    expect(response.status).toBe(200);
    expect(dbUpdateMock).toHaveBeenCalled();
  });

  it('snooze POST with null clears the snooze (re-emerges immediately)', async () => {
    const updatedReturning = [{ id: 'n1', snoozedUntil: null }];
    dbUpdateMock.mockReturnValueOnce({
      set: jest.fn().mockReturnValue({
        where: jest.fn().mockReturnValue({
          returning: jest.fn().mockResolvedValue(updatedReturning),
        }),
      }),
    });

    const response = await snoozePOST(
      new NextRequestCtor('http://localhost/api/inbox/n1/snooze', {
        method: 'POST',
        body: JSON.stringify({ until: null }),
      }),
      { params: Promise.resolve({ id: 'n1' }) }
    );
    expect(response.status).toBe(200);
  });

  it('flipping `snoozed=true` chip shows ONLY items with future snoozed_until', async () => {
    let captured: unknown = null;
    dbSelectMock.mockReturnValueOnce(selectChain([], (w) => (captured = w)));

    await GET(new NextRequestCtor('http://localhost/api/inbox?snoozed=true'));

    const gtNode = findNodes(
      captured,
      (n) => n.type === 'gt' && n.args[0] === 'notifications.snoozedUntil'
    )[0];
    expect(gtNode).toBeDefined();

    // The complementary OR (default mode) must NOT be present here.
    const orWithIsNull = findNodes(captured, (n) => n.type === 'or').find((orNode) =>
      findNodes(orNode, (m) => m.type === 'isNull' && m.args[0] === 'notifications.snoozedUntil').length > 0
    );
    expect(orWithIsNull).toBeUndefined();
  });
});
