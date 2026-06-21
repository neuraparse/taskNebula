/**
 * SSO settings page — workspace admins configure SAML IdP trust + manage
 * SCIM provisioning tokens here.
 *
 * Permission: `org:settings` (shared with other organization settings pages).
 */
import { redirect } from 'next/navigation';
import { auth } from '@/auth';
import { db, organizationMembers } from '@tasknebula/db';
import { and, eq } from 'drizzle-orm';
import { getTranslations } from 'next-intl/server';
import { requirePermission } from '@/lib/auth/permissions';
import { SsoSettingsClient } from '@/components/settings/sso-settings-client';

export async function generateMetadata() {
  const t = await getTranslations('pagesSettings');
  return { title: t('sso.metaTitle') };
}

export default async function SsoSettingsPage() {
  const session = await auth();
  if (!session?.user?.id) {
    redirect('/auth/signin?callbackUrl=/settings/sso');
  }
  const [primaryOrg] = await db
    .select({ organizationId: organizationMembers.organizationId })
    .from(organizationMembers)
    .where(
      and(eq(organizationMembers.userId, session.user.id), eq(organizationMembers.status, 'active'))
    )
    .limit(1);
  if (!primaryOrg) {
    redirect('/dashboard?error=insufficient-permission');
  }
  await requirePermission(primaryOrg.organizationId, 'org:settings');

  const t = await getTranslations('pagesSettings');

  return (
    <div className="mx-auto w-full max-w-5xl px-6 py-8 lg:px-8">
      <header className="mb-8">
        <h1 className="text-2xl font-semibold tracking-tight">{t('sso.title')}</h1>
        <p className="text-muted-foreground mt-1.5 text-sm">{t('sso.subtitle')}</p>
      </header>
      <SsoSettingsClient organizationId={primaryOrg.organizationId} />
    </div>
  );
}
