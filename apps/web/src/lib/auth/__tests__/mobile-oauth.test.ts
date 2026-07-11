/**
 * @jest-environment node
 */

import { NextRequest } from 'next/server';
import {
  consumeMobileOAuthExchangeToken,
  mintMobileOAuthExchangeToken,
  mobileOAuthRedirect,
  normalizeMobileAuthCallbackUrl,
} from '../mobile-oauth';

describe('mobile OAuth exchange tokens', () => {
  const originalAuthSecret = process.env.AUTH_SECRET;

  beforeEach(() => {
    process.env.AUTH_SECRET = 'test-mobile-oauth-secret';
  });

  afterEach(() => {
    if (originalAuthSecret === undefined) {
      delete process.env.AUTH_SECRET;
    } else {
      process.env.AUTH_SECRET = originalAuthSecret;
    }
  });

  it('mints and consumes a single-use provider-scoped token', async () => {
    const token = await mintMobileOAuthExchangeToken({
      userId: 'user_1',
      email: ' User@Example.com ',
      provider: 'github',
      now: 1_000,
    });

    await expect(consumeMobileOAuthExchangeToken(token, 2_000)).resolves.toEqual(
      expect.objectContaining({
        kind: 'mobile-oauth-exchange',
        userId: 'user_1',
        email: 'user@example.com',
        provider: 'github',
      })
    );
    await expect(consumeMobileOAuthExchangeToken(token, 2_000)).resolves.toBeNull();
  });

  it('rejects tampered and expired tokens', async () => {
    const token = await mintMobileOAuthExchangeToken({
      userId: 'user_1',
      email: 'user@example.com',
      provider: 'google',
      now: 1_000,
    });

    await expect(consumeMobileOAuthExchangeToken(`${token}x`, 2_000)).resolves.toBeNull();
    await expect(consumeMobileOAuthExchangeToken(token, 62_000)).resolves.toBeNull();
  });

  it('redirects browser completion back to the native auth scheme', () => {
    const request = new NextRequest('https://tasks.example.com/api/auth/mobile/oauth/complete');
    const response = mobileOAuthRedirect(request, {
      provider: 'github',
      status: 'authenticated',
      token: 'exchange-token',
      callbackUrl: '/settings/sso',
    });

    expect(response.headers.get('location')).toBe(
      'tasknebula://auth/oauth?status=authenticated&server=https%3A%2F%2Ftasks.example.com&provider=github&token=exchange-token&callbackUrl=%2Fsettings%2Fsso'
    );
  });

  it('normalizes mobile auth callback URLs to same-origin app paths', () => {
    expect(
      normalizeMobileAuthCallbackUrl(
        'https://tasks.example.com/projects/TN/chat?view=compact',
        'https://tasks.example.com'
      )
    ).toBe('/projects/TN/chat?view=compact');
    expect(normalizeMobileAuthCallbackUrl('/settings/import', 'https://tasks.example.com')).toBe(
      '/settings/import'
    );
    expect(
      normalizeMobileAuthCallbackUrl(
        'https://evil.example.com/projects/TN',
        'https://tasks.example.com'
      )
    ).toBeNull();
    expect(
      normalizeMobileAuthCallbackUrl(
        '/auth/signin?callbackUrl=/projects/TN',
        'https://tasks.example.com'
      )
    ).toBeNull();
  });
});
