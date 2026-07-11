const authMock = jest.fn();
const consumeEmailVerificationTokenMock = jest.fn();

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

  static json(payload: unknown, init?: { status?: number; headers?: Record<string, string> }) {
    return new MockNextResponse(payload, init);
  }

  static redirect(url: string | URL, status = 307) {
    return new MockNextResponse(null, {
      status,
      headers: { Location: String(url) },
    });
  }
}

jest.mock('next/server', () => ({
  NextResponse: MockNextResponse,
}));

jest.mock('@/auth', () => ({
  auth: (...args: unknown[]) => authMock(...args),
}));

jest.mock('@/lib/auth/email-verification', () => ({
  consumeEmailVerificationToken: (...args: unknown[]) => consumeEmailVerificationTokenMock(...args),
}));

jest.mock('@/lib/url/app-url', () => ({
  buildAppUrl: (path: string, origin = 'http://localhost:3002') => `${origin}${path}`,
}));

describe('/api/auth/verify-email/[token] route', () => {
  let GET: typeof import('./route').GET;

  beforeAll(async () => {
    ({ GET } = await import('./route'));
  });

  beforeEach(() => {
    jest.clearAllMocks();
    authMock.mockResolvedValue(null);
  });

  function makeRequest(accept: string) {
    const url = 'http://localhost:3002/api/auth/verify-email/token-1';
    return {
      url,
      nextUrl: new URL(url),
      headers: {
        get: (name: string) => (name.toLowerCase() === 'accept' ? accept : null),
      },
    } as never;
  }

  it('returns JSON for native clients that request application/json', async () => {
    consumeEmailVerificationTokenMock.mockResolvedValue({ ok: true, userId: 'user-1' });

    const response = await GET(makeRequest('application/json'), {
      params: Promise.resolve({ token: 'token-1' }),
    });

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      verified: true,
      authenticated: false,
    });
  });

  it('returns JSON reason codes for failed native verification attempts', async () => {
    consumeEmailVerificationTokenMock.mockResolvedValue({ ok: false, reason: 'expired' });

    const response = await GET(makeRequest('application/json'), {
      params: Promise.resolve({ token: 'token-1' }),
    });

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      verified: false,
      reason: 'expired',
    });
  });

  it('keeps browser requests on the redirect flow', async () => {
    authMock.mockResolvedValue({ user: { id: 'user-1' } });
    consumeEmailVerificationTokenMock.mockResolvedValue({ ok: true, userId: 'user-1' });

    const response = await GET(makeRequest('text/html'), {
      params: Promise.resolve({ token: 'token-1' }),
    });

    expect(response.status).toBe(307);
    expect(response.headers.Location).toBe('http://localhost:3002/dashboard?verified=1');
  });
});
