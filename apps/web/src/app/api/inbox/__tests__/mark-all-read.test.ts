/**
 * Tests for POST /api/inbox/mark-all-read — particularly that the query
 * filters are honored so a user can scope "mark all read" to a project or
 * actor type without nuking unrelated unread state.
 */

const authMock = jest.fn();
const dbUpdateMock = jest.fn();

class MockNextRequest {
  readonly nextUrl: URL;
  constructor(public readonly url: string) {
    this.nextUrl = new URL(url);
  }
  get method() {
    return 'POST';
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
    db: { update: (...args: unknown[]) => dbUpdateMock(...args) },
    notifications: new Proxy({}, { get: (_t, prop: string) => `notifications.${prop}` }),
    eq: (...args: unknown[]) => op('eq', args),
    and: (...args: unknown[]) => op('and', args),
    gte: (...args: unknown[]) => op('gte', args),
    lte: (...args: unknown[]) => op('lte', args),
    inArray: (...args: unknown[]) => op('inArray', args),
  };
});

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

describe('POST /api/inbox/mark-all-read', () => {
  let NextRequestCtor: typeof import('next/server').NextRequest;
  let POST: typeof import('../mark-all-read/route').POST;

  beforeAll(async () => {
    ({ NextRequest: NextRequestCtor } = await import('next/server'));
    ({ POST } = await import('../mark-all-read/route'));
  });

  beforeEach(() => {
    jest.clearAllMocks();
    authMock.mockResolvedValue({ user: { id: 'user-1' } });
  });

  it('returns 401 when unauthenticated', async () => {
    authMock.mockResolvedValue(null);
    const response = await POST(new NextRequestCtor('http://localhost/api/inbox/mark-all-read'));
    expect(response.status).toBe(401);
  });

  it('always scopes by userId AND isRead=false', async () => {
    let captured: unknown = null;
    dbUpdateMock.mockReturnValueOnce({
      set: jest.fn().mockReturnValue({
        where: jest.fn().mockImplementation((arg: unknown) => {
          captured = arg;
          return { returning: jest.fn().mockResolvedValue([{ id: 'a' }, { id: 'b' }]) };
        }),
      }),
    });

    const response = await POST(new NextRequestCtor('http://localhost/api/inbox/mark-all-read'));
    expect(response.status).toBe(200);
    const body = (await response.json()) as { count: number };
    expect(body.count).toBe(2);

    expect(
      findNodes(
        captured,
        (n) => n.type === 'eq' && n.args[0] === 'notifications.userId' && n.args[1] === 'user-1'
      ).length
    ).toBeGreaterThan(0);
    expect(
      findNodes(
        captured,
        (n) => n.type === 'eq' && n.args[0] === 'notifications.isRead' && n.args[1] === false
      ).length
    ).toBeGreaterThan(0);
  });

  it('scopes to a project when ?project= is set', async () => {
    let captured: unknown = null;
    dbUpdateMock.mockReturnValueOnce({
      set: jest.fn().mockReturnValue({
        where: jest.fn().mockImplementation((arg: unknown) => {
          captured = arg;
          return { returning: jest.fn().mockResolvedValue([]) };
        }),
      }),
    });

    await POST(new NextRequestCtor('http://localhost/api/inbox/mark-all-read?project=p1'));

    expect(
      findNodes(
        captured,
        (n) =>
          n.type === 'eq' &&
          n.args[0] === 'notifications.projectId' &&
          n.args[1] === 'p1'
      ).length
    ).toBeGreaterThan(0);
  });

  it('short-circuits when notification_type chip has no underlying events', async () => {
    const response = await POST(
      new NextRequestCtor('http://localhost/api/inbox/mark-all-read?notification_type=reaction')
    );
    expect(response.status).toBe(200);
    const body = (await response.json()) as { count: number };
    expect(body.count).toBe(0);
    expect(dbUpdateMock).not.toHaveBeenCalled();
  });

  it('maps "status" chip to underlying enum values', async () => {
    let captured: unknown = null;
    dbUpdateMock.mockReturnValueOnce({
      set: jest.fn().mockReturnValue({
        where: jest.fn().mockImplementation((arg: unknown) => {
          captured = arg;
          return { returning: jest.fn().mockResolvedValue([]) };
        }),
      }),
    });

    await POST(
      new NextRequestCtor('http://localhost/api/inbox/mark-all-read?notification_type=status')
    );

    const inArrayNode = findNodes(
      captured,
      (n) => n.type === 'inArray' && n.args[0] === 'notifications.type'
    )[0];
    expect(inArrayNode).toBeDefined();
    expect((inArrayNode.args[1] as string[]).sort()).toEqual(
      ['issue_updated', 'status_changed'].sort()
    );
  });
});
