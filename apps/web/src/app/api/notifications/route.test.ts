const authMock = jest.fn();
const dbSelectMock = jest.fn();
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

jest.mock('@tasknebula/db', () => ({
  db: {
    select: (...args: unknown[]) => dbSelectMock(...args),
    update: (...args: unknown[]) => dbUpdateMock(...args),
  },
  notifications: {
    id: 'notifications.id',
    type: 'notifications.type',
    title: 'notifications.title',
    message: 'notifications.message',
    issueId: 'notifications.issueId',
    projectId: 'notifications.projectId',
    isRead: 'notifications.isRead',
    readAt: 'notifications.readAt',
    createdAt: 'notifications.createdAt',
    updatedAt: 'notifications.updatedAt',
    userId: 'notifications.userId',
    actorId: 'notifications.actorId',
  },
  users: {
    id: 'users.id',
    name: 'users.name',
    email: 'users.email',
    image: 'users.image',
  },
}));

jest.mock('drizzle-orm', () => ({
  and: (...args: unknown[]) => ({ type: 'and', args }),
  desc: (value: unknown) => ({ type: 'desc', value }),
  eq: (left: unknown, right: unknown) => ({ type: 'eq', left, right }),
}));

function selectChain(result: unknown) {
  // GET awaits the chain directly after .limit()
  return {
    from: jest.fn().mockReturnValue({
      leftJoin: jest.fn().mockReturnValue({
        where: jest.fn().mockReturnValue({
          orderBy: jest.fn().mockReturnValue({
            limit: jest.fn().mockResolvedValue(result),
          }),
        }),
      }),
    }),
  };
}

function updateResolving(result?: unknown) {
  return {
    set: jest.fn().mockReturnValue({
      where: jest.fn().mockResolvedValue(result),
    }),
  };
}

describe('/api/notifications route', () => {
  let NextRequestCtor: typeof import('next/server').NextRequest;
  let GET: typeof import('./route').GET;
  let PATCH: typeof import('./route').PATCH;

  beforeAll(async () => {
    ({ NextRequest: NextRequestCtor } = await import('next/server'));
    ({ GET, PATCH } = await import('./route'));
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('GET', () => {
    it('returns 401 when no session', async () => {
      authMock.mockResolvedValue(null);
      const response = await GET(new NextRequestCtor('http://localhost:3002/api/notifications'));
      expect(response.status).toBe(401);
      await expect(response.json()).resolves.toEqual({ error: 'Unauthorized' });
    });

    it('returns notifications for authenticated user', async () => {
      authMock.mockResolvedValue({ user: { id: 'user-1' } });
      dbSelectMock.mockReturnValueOnce(
        selectChain([
          {
            id: 'n1',
            type: 'mention',
            title: 'You were mentioned',
            message: 'Check this out',
            issueId: 'i1',
            projectId: 'p1',
            isRead: false,
            readAt: null,
            createdAt: new Date().toISOString(),
            actor: { id: 'user-2', name: 'Alice', email: 'a@e.com', image: null },
          },
        ])
      );
      const response = await GET(new NextRequestCtor('http://localhost:3002/api/notifications'));
      expect(response.status).toBe(200);
      const body = (await response.json()) as { notifications: Array<{ id: string }> };
      expect(body.notifications).toHaveLength(1);
      expect(body.notifications[0].id).toBe('n1');
    });

    it('filters by unread only when query param is set', async () => {
      authMock.mockResolvedValue({ user: { id: 'user-1' } });
      dbSelectMock.mockReturnValueOnce(selectChain([]));
      const response = await GET(
        new NextRequestCtor('http://localhost:3002/api/notifications?unreadOnly=true')
      );
      expect(response.status).toBe(200);
      await expect(response.json()).resolves.toEqual({ notifications: [] });
    });
  });

  describe('PATCH', () => {
    it('returns 401 when no session', async () => {
      authMock.mockResolvedValue(null);
      const response = await PATCH(
        new NextRequestCtor('http://localhost:3002/api/notifications', { method: 'PATCH' })
      );
      expect(response.status).toBe(401);
    });

    it('marks all notifications as read', async () => {
      authMock.mockResolvedValue({ user: { id: 'user-1' } });
      dbUpdateMock.mockReturnValueOnce(updateResolving());
      const response = await PATCH(
        new NextRequestCtor('http://localhost:3002/api/notifications', { method: 'PATCH' })
      );
      expect(response.status).toBe(200);
      await expect(response.json()).resolves.toEqual({ success: true });
      expect(dbUpdateMock).toHaveBeenCalled();
    });
  });
});
