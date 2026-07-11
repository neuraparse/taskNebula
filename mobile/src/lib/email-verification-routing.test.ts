import {
  resolveAuthenticatedEmailVerificationNotice,
  type EmailVerificationIntent,
} from './email-verification-routing';

const baseIntent: EmailVerificationIntent = {
  kind: 'verify-email',
  rawUrl: 'https://tasks.example.com/auth/verify-email?token=verify-token',
  serverUrl: 'https://tasks.example.com',
  token: 'verify-token',
};

describe('authenticated email verification routing', () => {
  it('returns the dashboard success notice after verifying the token', async () => {
    const refreshUser = jest.fn().mockResolvedValue(undefined);
    const verify = jest.fn().mockResolvedValue({ verified: true });

    await expect(
      resolveAuthenticatedEmailVerificationNotice(baseIntent, refreshUser, verify),
    ).resolves.toBe('emailVerified');

    expect(verify).toHaveBeenCalledWith('verify-token');
    expect(refreshUser).toHaveBeenCalledTimes(1);
  });

  it('still shows the success notice when refreshing the user fails', async () => {
    const refreshUser = jest.fn().mockRejectedValue(new Error('network'));
    const verify = jest.fn().mockResolvedValue({ verified: true });

    await expect(
      resolveAuthenticatedEmailVerificationNotice(baseIntent, refreshUser, verify),
    ).resolves.toBe('emailVerified');
  });

  it('does not route to a notice for invalid or rejected tokens', async () => {
    const refreshUser = jest.fn().mockResolvedValue(undefined);

    await expect(
      resolveAuthenticatedEmailVerificationNotice(
        baseIntent,
        refreshUser,
        jest.fn().mockResolvedValue({ verified: false }),
      ),
    ).resolves.toBeNull();
    await expect(
      resolveAuthenticatedEmailVerificationNotice(
        baseIntent,
        refreshUser,
        jest.fn().mockRejectedValue(new Error('invalid')),
      ),
    ).resolves.toBeNull();

    expect(refreshUser).not.toHaveBeenCalled();
  });

  it('ignores verify links that do not carry a token', async () => {
    const refreshUser = jest.fn().mockResolvedValue(undefined);
    const verify = jest.fn().mockResolvedValue({ verified: true });

    await expect(
      resolveAuthenticatedEmailVerificationNotice(
        {
          kind: 'verify-email',
          rawUrl: 'https://tasks.example.com/auth/verify-email?error=expired',
          serverUrl: 'https://tasks.example.com',
          verifyError: 'expired',
        },
        refreshUser,
        verify,
      ),
    ).resolves.toBeNull();

    expect(verify).not.toHaveBeenCalled();
    expect(refreshUser).not.toHaveBeenCalled();
  });
});
