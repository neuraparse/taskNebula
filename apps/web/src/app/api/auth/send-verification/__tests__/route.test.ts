const authMock = jest.fn();
const issueTokenMock = jest.fn();
const selectLimitMock = jest.fn();

// --- Minimal next/server shims (pattern borrowed from signup route test) ---

class MockNextRequest {
  private readonly bodyValue: string;
  readonly nextUrl: URL;
  readonly headers: { get(name: string): string | null };

  constructor(
    public readonly url: string,
    private readonly init?: {
      method?: string;
      headers?: Record<string, string>;
      body?: string;
    }
  ) {
    this.nextUrl = new URL(url);
    this.bodyValue = init?.body || '';
    const headerMap = new Map<string, string>();
    for (const [k, v] of Object.entries(init?.headers || {})) {
      headerMap.set(k.toLowerCase(), v);
    }
    this.headers = {
      get: (name: string) => headerMap.get(name.toLowerCase()) ?? null,
    };
  }

  get method() {
    return this.init?.method || 'GET';
  }

  async json() {
    if (!this.bodyValue) throw new Error('empty body');
    return JSON.parse(this.bodyValue);
  }
}

class MockNextResponse {
  constructor(
    private readonly payload: unknown,
    init?: { status?: number; headers?: Record<string, string> }
  ) {
    this.status = init?.status || 200;
    this.headers = init?.headers || {};
  }

  status: number;
  headers: Record<string, string>;

  async json() {
    return this.payload;
  }

  static json(
    payload: unknown,
    init?: { status?: number; headers?: Record<string, string> }
  ) {
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

jest.mock('@/lib/auth/email-verification', () => ({
  issueEmailVerificationToken: (...args: unknown[]) => issueTokenMock(...args),
}));

// The route calls `db.select({...}).from(users).where(eq(...)).limit(1)`.
// We mock just enough of the chain to return whatever `selectLimitMock`
// is configured to return.
jest.mock('@tasknebula/db', () => {
  const chain = {
    from: () => chain,
    where: () => chain,
    limit: (...args: unknown[]) => selectLimitMock(...args),
  };
  return {
    db: {
      select: () => chain,
    },
    users: {
      id: 'users.id',
      email: 'users.email',
      emailVerified: 'users.emailVerified',
    },
    eq: (left: unknown, right: unknown) => ({ type: 'eq', left, right }),
  };
});

describe('/api/auth/send-verification route', () => {
  let NextRequestCtor: typeof import('next/server').NextRequest;
  let POST: typeof import('../route').POST;

  beforeAll(async () => {
    ({ NextRequest: NextRequestCtor } = await import('next/server'));
    ({ POST } = await import('../route'));
  });

  beforeEach(() => {
    jest.clearAllMocks();
    issueTokenMock.mockResolvedValue({ issued: true, emailSent: true });
  });

  function makeRequest(opts: {
    body?: unknown;
    ip?: string;
  } = {}) {
    const headers: Record<string, string> = {};
    if (opts.ip) headers['x-forwarded-for'] = opts.ip;
    return new NextRequestCtor(
      'http://localhost:3002/api/auth/send-verification',
      {
        method: 'POST',
        headers,
        body: opts.body === undefined ? '' : JSON.stringify(opts.body),
      }
    );
  }

  it('authenticated path issues token and returns generic 200', async () => {
    authMock.mockResolvedValue({ user: { id: 'user-123' } });

    const response = await POST(makeRequest({ ip: '10.0.0.1' }));

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      message: 'If that account exists, a verification email has been sent.',
    });

    // Fire-and-forget: allow the microtask queue to flush so the
    // `void issue...()` call is observable.
    await Promise.resolve();
    expect(issueTokenMock).toHaveBeenCalledTimes(1);
    expect(issueTokenMock).toHaveBeenCalledWith('user-123');
  });

  it('unauthenticated with unverified user issues a token', async () => {
    authMock.mockResolvedValue(null);
    selectLimitMock.mockResolvedValue([
      { id: 'user-999', emailVerified: null },
    ]);

    const response = await POST(
      makeRequest({ body: { email: 'unverified@example.com' }, ip: '10.0.0.2' })
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      message: 'If that account exists, a verification email has been sent.',
    });

    await Promise.resolve();
    expect(issueTokenMock).toHaveBeenCalledTimes(1);
    expect(issueTokenMock).toHaveBeenCalledWith('user-999');
  });

  it('unauthenticated with already-verified user returns 200 and does NOT issue', async () => {
    authMock.mockResolvedValue(null);
    selectLimitMock.mockResolvedValue([
      { id: 'user-777', emailVerified: new Date('2024-01-01') },
    ]);

    const response = await POST(
      makeRequest({ body: { email: 'verified@example.com' }, ip: '10.0.0.3' })
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      message: 'If that account exists, a verification email has been sent.',
    });

    await Promise.resolve();
    expect(issueTokenMock).not.toHaveBeenCalled();
  });

  it('unauthenticated path rate-limits on the 4th request (same IP + email)', async () => {
    authMock.mockResolvedValue(null);
    selectLimitMock.mockResolvedValue([
      { id: 'user-555', emailVerified: null },
    ]);

    // 3 requests should pass through with 200.
    for (let i = 0; i < 3; i += 1) {
      const res = await POST(
        makeRequest({ body: { email: 'ratelimit@example.com' }, ip: '10.99.0.1' })
      );
      expect(res.status).toBe(200);
    }

    // 4th request in the same 10-minute window hits the limit.
    const fourth = await POST(
      makeRequest({ body: { email: 'ratelimit@example.com' }, ip: '10.99.0.1' })
    );
    expect(fourth.status).toBe(429);
    await expect(fourth.json()).resolves.toEqual({ error: 'Too many requests' });
  });
});
