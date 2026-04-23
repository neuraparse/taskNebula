import { auth } from '@/auth';
import { db, users, eq } from '@tasknebula/db';
import { EmailVerificationBannerClient } from './email-verification-banner-client';

/**
 * Server component that checks whether the current user's email has
 * been verified and, if not, renders the dismissible banner.
 *
 * Rendered in the authenticated `(app)` layout. No-ops when the user is
 * missing or already verified so it doesn't add a row of empty space.
 */
export async function EmailVerificationBanner() {
  const session = await auth();
  if (!session?.user?.id) return null;

  const [user] = await db
    .select({ emailVerified: users.emailVerified, email: users.email })
    .from(users)
    .where(eq(users.id, session.user.id))
    .limit(1);

  if (!user || user.emailVerified) return null;

  return <EmailVerificationBannerClient email={user.email} />;
}
