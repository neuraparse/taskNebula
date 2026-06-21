const getClientCredentialsMock = jest.fn();

jest.mock('@/lib/integrations/client-credentials', () => ({
  getClientCredentials: (...args: unknown[]) => getClientCredentialsMock(...args),
}));

import { getLoginOAuthAvailability, isLoginOAuthProvider } from '@/lib/auth/login-oauth-providers';

describe('login OAuth provider settings', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('recognizes only login OAuth providers', () => {
    expect(isLoginOAuthProvider('github')).toBe(true);
    expect(isLoginOAuthProvider('google')).toBe(true);
    expect(isLoginOAuthProvider('slack')).toBe(false);
  });

  it('marks providers available only when credentials resolve', async () => {
    getClientCredentialsMock.mockImplementation(async (provider: string) =>
      provider === 'github'
        ? {
            provider,
            clientId: 'github-client',
            clientSecret: 'github-secret',
            redirectUri: null,
            scope: null,
            source: 'db',
          }
        : null
    );

    await expect(getLoginOAuthAvailability()).resolves.toEqual({
      github: true,
      google: false,
    });
    expect(getClientCredentialsMock).toHaveBeenCalledWith('github');
    expect(getClientCredentialsMock).toHaveBeenCalledWith('google');
  });
});
