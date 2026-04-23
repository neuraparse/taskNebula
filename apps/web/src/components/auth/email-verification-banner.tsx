import { auth } from '@/auth';
import { db, users, organizationMembers, eq, and } from '@tasknebula/db';
import { EmailVerificationBannerClient } from './email-verification-banner-client';

/**
 * Server component that checks whether the current user's email has
 * been verified and, if not, renders the dismissible banner.
 *
 * Rendered in the authenticated `(app)` layout. No-ops when:
 *  - user is missing
 *  - user is already verified
 *  - user is a super admin (they bootstrap the system; cannot be locked out by a nag they can't clear)
 *  - user is an organization owner (trusted by definition; their own admin panel can manage verification)
 * Also auto-backfills `emailVerified` for these trusted roles so the banner
 * and any future enforcement stay consistent across the session.
 */
export async function EmailVerificationBanner() {
  const session = await auth();
  if (!session?.user?.id) return null;

  const [user] = await db
    .select({
      id: users.id,
      emailVerified: users.emailVerified,
      email: users.email,
      isSuperAdmin: users.isSuperAdmin,
    })
    .from(users)
    .where(eq(users.id, session.user.id))
    .limit(1);

  if (!user) return null;
  if (user.emailVerified) return null;

  // Trusted roles: super admin or any organization owner.
  let trusted = user.isSuperAdmin === true;
  if (!trusted) {
    const [ownerRow] = await db
      .select({ id: organizationMembers.id })
      .from(organizationMembers)
      .where(and(eq(organizationMembers.userId, user.id), eq(organizationMembers.role, 'owner')))
      .limit(1);
    trusted = !!ownerRow;
  }

  if (trusted) {
    // Backfill so the banner is a one-time check and downstream checks agree.
    await db.update(users).set({ emailVerified: new Date() }).where(eq(users.id, user.id));
    return null;
  }

  return <EmailVerificationBannerClient email={user.email} />;
}
