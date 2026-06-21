import { auth } from '@/auth';
import {
  db,
  users,
  organizationMembers,
  eq,
  and,
  hasPermission as roleHasPermission,
} from '@tasknebula/db';
import { EmailVerificationBannerClient } from './email-verification-banner-client';

/**
 * Server component that checks whether the current user's email has
 * been verified and, if not, renders the dismissible banner.
 *
 * Rendered in the authenticated `(app)` layout. No-ops when:
 *  - user is missing
 *  - user is already verified
 *  - user is a super admin (they bootstrap the system; cannot be locked out by a nag they can't clear)
 *  - user has organization settings permission (their own admin panel can manage verification)
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

  // Trusted roles: super admin or any active org with settings permission.
  let trusted = user.isSuperAdmin === true;
  if (!trusted) {
    const memberships = await db
      .select({ role: organizationMembers.role })
      .from(organizationMembers)
      .where(
        and(eq(organizationMembers.userId, user.id), eq(organizationMembers.status, 'active'))
      );
    trusted = memberships.some((membership) =>
      roleHasPermission(membership.role || '', 'org:settings')
    );
  }

  if (trusted) {
    // Backfill so the banner is a one-time check and downstream checks agree.
    await db.update(users).set({ emailVerified: new Date() }).where(eq(users.id, user.id));
    return null;
  }

  return <EmailVerificationBannerClient email={user.email} />;
}
