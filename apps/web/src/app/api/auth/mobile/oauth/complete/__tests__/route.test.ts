/**
 * @jest-environment node
 */

import { NextRequest } from 'next/server';
import { consumeMobileOAuthExchangeToken } from '@/lib/auth/mobile-oauth';

const authMock = jest.fn();

jest.mock('@/auth', () => ({
  auth: (...args: unknown[]) => authMock(...args),
}));

import { GET } from '../route';

describe('/api/auth/mobile/oauth/complete', () => {
  const originalAuthSecret = process.env.AUTH_SECRET;

  beforeEach(() => {
    jest.clearAllMocks();
    process.env.AUTH_SECRET = 'test-mobile-oauth-secret';
  });

  afterEach(() => {
    if (originalAuthSecret === undefined) {
      delete process.env.AUTH_SECRET;
    } else {
      process.env.AUTH_SECRET = originalAuthSecret;
    }
  });

  it('mints a native exchange token for the current browser OAuth session', async () => {
    authMock.mockResolvedValue({
      user: { id: 'user_1', email: 'user@example.com', name: 'User' },
    });

    const response = await GET(
      new NextRequest(
        'https://tasks.example.com/api/auth/mobile/oauth/complete?provider=github&callbackUrl=%2Fsettings%2Fsso'
      )
    );
    const location = response.headers.get('location') ?? '';
    const url = new URL(location);
    const token = url.searchParams.get('token') ?? '';

    expect(url.protocol).toBe('tasknebula:');
    expect(url.hostname).toBe('auth');
    expect(url.pathname).toBe('/oauth');
    expect(url.searchParams.get('status')).toBe('authenticated');
    expect(url.searchParams.get('server')).toBe('https://tasks.example.com');
    expect(url.searchParams.get('provider')).toBe('github');
    expect(url.searchParams.get('callbackUrl')).toBe('/settings/sso');
    await expect(consumeMobileOAuthExchangeToken(token)).resolves.toEqual(
      expect.objectContaining({
        userId: 'user_1',
        email: 'user@example.com',
        provider: 'github',
      })
    );
  });

  it('returns native error redirects when the session is missing', async () => {
    authMock.mockResolvedValue(null);

    const response = await GET(
      new NextRequest('https://tasks.example.com/api/auth/mobile/oauth/complete?provider=google')
    );

    expect(response.headers.get('location')).toBe(
      'tasknebula://auth/oauth?status=error&server=https%3A%2F%2Ftasks.example.com&provider=google&reason=unauthorized'
    );
  });
});
