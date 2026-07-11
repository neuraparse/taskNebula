import { verifyEmail, type VerifyEmailResult } from '@/api/auth';
import type { DashboardRouteNotice } from '@/navigation/types';
import type { AuthDeepLink } from './deep-links';

export type EmailVerificationIntent = Extract<AuthDeepLink, { kind: 'verify-email' }>;

type VerifyEmailFn = (token: string) => Promise<VerifyEmailResult>;
type RefreshUserFn = () => Promise<void>;

export async function resolveAuthenticatedEmailVerificationNotice(
  intent: EmailVerificationIntent,
  refreshUser: RefreshUserFn,
  verify: VerifyEmailFn = verifyEmail,
): Promise<DashboardRouteNotice | null> {
  if (!intent.token) return null;

  try {
    const result = await verify(intent.token);
    if (!result.verified) return null;
    await refreshUser().catch(() => undefined);
    return 'emailVerified';
  } catch {
    return null;
  }
}
