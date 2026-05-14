/**
 * SSO settings page — workspace admins configure SAML IdP trust + manage
 * SCIM provisioning tokens here.
 *
 * Permission: `org:settings` (already used by other admin-only pages).
 */
import { redirect } from 'next/navigation';
import { auth } from '@/auth';
import { db, organizationMembers, eq } from '@tasknebula/db';
import { requirePermission } from '@/lib/auth/permissions';
import { SsoSettingsClient } from '@/components/settings/sso-settings-client';

export const metadata = { title: 'SSO & SCIM · TaskNebula' };

export default async function SsoSettingsPage() {
  const session = await auth();
  if (!session?.user?.id) {
    redirect('/auth/signin?callbackUrl=/settings/sso');
  }
  const [primaryOrg] = await db
    .select({ organizationId: organizationMembers.organizationId })
    .from(organizationMembers)
    .where(eq(organizationMembers.userId, session.user.id))
    .limit(1);
  if (!primaryOrg) {
    redirect('/dashboard?error=insufficient-permission');
  }
  await requirePermission(primaryOrg.organizationId, 'org:settings');

  return (
    <div className="mx-auto w-full max-w-5xl px-6 py-8 lg:px-8">
      <header className="mb-8">
        <h1 className="text-2xl font-semibold tracking-tight">
          Single Sign-On & SCIM
        </h1>
        <p className="mt-1.5 text-sm text-muted-foreground">
          Configure SAML 2.0 with your identity provider and issue SCIM 2.0
          provisioning tokens for automated user lifecycle management.
        </p>
      </header>
      <SsoSettingsClient organizationId={primaryOrg.organizationId} />
    </div>
  );
}
