const getLoginOAuthAvailabilityMock = jest.fn();

jest.mock('next/server', () => {
  class MockNextResponse {
    readonly headers: Headers;
    readonly status: number;

    constructor(
      private readonly payload: unknown,
      init?: { status?: number; headers?: HeadersInit }
    ) {
      this.status = init?.status || 200;
      this.headers = new Headers(init?.headers);
    }

    async json() {
      return this.payload;
    }

    static json(payload: unknown, init?: { status?: number; headers?: HeadersInit }) {
      return new MockNextResponse(payload, init);
    }
  }

  return {
    NextResponse: MockNextResponse,
  };
});

jest.mock('@/lib/auth/login-oauth-providers', () => ({
  getLoginOAuthAvailability: (...args: unknown[]) => getLoginOAuthAvailabilityMock(...args),
}));

import { GET } from './route';

describe('/api/auth/oauth-providers route', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns public OAuth login provider availability without caching', async () => {
    getLoginOAuthAvailabilityMock.mockResolvedValue({
      github: true,
      google: false,
    });

    const response = await GET();

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      providers: {
        github: true,
        google: false,
      },
    });
    expect(response.headers.get('Cache-Control')).toBe('no-store');
  });

  it('fails closed when provider resolution throws', async () => {
    const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    getLoginOAuthAvailabilityMock.mockRejectedValue(new Error('database unavailable'));

    const response = await GET();

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      providers: {
        github: false,
        google: false,
      },
    });

    consoleSpy.mockRestore();
  });
});
