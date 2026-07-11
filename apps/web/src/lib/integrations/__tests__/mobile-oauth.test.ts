/**
 * @jest-environment node
 */

import { NextRequest } from 'next/server';
import {
  createMobileIntegrationState,
  decodeMobileIntegrationState,
  mobileIntegrationRedirect,
} from '../mobile-oauth';

describe('mobile integration OAuth state', () => {
  const originalAuthSecret = process.env.AUTH_SECRET;

  beforeEach(() => {
    process.env.AUTH_SECRET = 'test-secret';
  });

  afterEach(() => {
    if (originalAuthSecret === undefined) {
      delete process.env.AUTH_SECRET;
    } else {
      process.env.AUTH_SECRET = originalAuthSecret;
    }
  });

  it('signs and verifies a provider-scoped mobile state', () => {
    const state = createMobileIntegrationState({
      provider: 'github',
      organizationId: 'org_1',
      userId: 'user_1',
      now: 1_000,
    });

    expect(decodeMobileIntegrationState(state, 'github', 2_000)).toEqual(
      expect.objectContaining({
        provider: 'github',
        organizationId: 'org_1',
        userId: 'user_1',
      })
    );
    expect(decodeMobileIntegrationState(state, 'slack', 2_000)).toBeNull();
  });

  it('rejects tampered and expired states', () => {
    const state = createMobileIntegrationState({
      provider: 'slack',
      organizationId: 'org_1',
      userId: 'user_1',
      now: 1_000,
    });

    expect(decodeMobileIntegrationState(`${state}x`, 'slack', 2_000)).toBeNull();
    expect(decodeMobileIntegrationState(state, 'slack', 11 * 60 * 1000)).toBeNull();
  });

  it('redirects mobile callbacks back to the native scheme', () => {
    const request = new NextRequest('https://tasks.example.com/api/integrations/github/callback');
    const response = mobileIntegrationRedirect(request, {
      provider: 'github',
      status: 'error',
      reason: 'invalid_state',
    });

    expect(response.headers.get('location')).toBe(
      'tasknebula://integrations/oauth?provider=github&status=error&server=https%3A%2F%2Ftasks.example.com&reason=invalid_state'
    );
  });
});
