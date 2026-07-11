/**
 * @jest-environment node
 */

import { NextRequest } from 'next/server';

const getLoginOAuthCredentialsMock = jest.fn();

jest.mock('@/lib/auth/login-oauth-providers', () => ({
  getLoginOAuthCredentials: (...args: unknown[]) => getLoginOAuthCredentialsMock(...args),
  isLoginOAuthProvider: (value: unknown) => value === 'github' || value === 'google',
}));

import { GET } from '../route';

describe('/api/auth/mobile/oauth/authorize', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('redirects configured providers to Auth.js with the native completion callback', async () => {
    getLoginOAuthCredentialsMock.mockResolvedValue({
      github: {
        clientId: 'github-client',
        clientSecret: 'github-secret',
        redirectUri: null,
        scope: null,
        source: 'db',
      },
      google: null,
    });

    const response = await GET(
      new NextRequest('https://tasks.example.com/api/auth/mobile/oauth/authorize?provider=github')
    );
    const location = response.headers.get('location');

    expect(response.status).toBe(307);
    expect(location).toContain('https://tasks.example.com/api/auth/signin/github?callbackUrl=');
    expect(decodeURIComponent(location ?? '')).toContain(
      'https://tasks.example.com/api/auth/mobile/oauth/complete?provider=github'
    );
  });

  it('carries a same-origin mobile callback URL through the Auth.js completion URL', async () => {
    getLoginOAuthCredentialsMock.mockResolvedValue({
      github: {
        clientId: 'github-client',
        clientSecret: 'github-secret',
        redirectUri: null,
        scope: null,
        source: 'db',
      },
      google: null,
    });

    const response = await GET(
      new NextRequest(
        'https://tasks.example.com/api/auth/mobile/oauth/authorize?provider=github&callbackUrl=%2Fsettings%2Fsso'
      )
    );
    const location = response.headers.get('location') ?? '';
    const signInUrl = new URL(location);
    const completeUrl = new URL(signInUrl.searchParams.get('callbackUrl') ?? '');

    expect(completeUrl.origin).toBe('https://tasks.example.com');
    expect(completeUrl.pathname).toBe('/api/auth/mobile/oauth/complete');
    expect(completeUrl.searchParams.get('provider')).toBe('github');
    expect(completeUrl.searchParams.get('callbackUrl')).toBe('/settings/sso');
  });

  it('rejects unsupported or unconfigured providers', async () => {
    await expect(
      GET(
        new NextRequest('https://tasks.example.com/api/auth/mobile/oauth/authorize?provider=slack')
      )
    ).resolves.toMatchObject({ status: 400 });

    getLoginOAuthCredentialsMock.mockResolvedValue({ github: null, google: null });
    await expect(
      GET(
        new NextRequest('https://tasks.example.com/api/auth/mobile/oauth/authorize?provider=google')
      )
    ).resolves.toMatchObject({ status: 404 });
  });
});
