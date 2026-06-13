import { redirect } from 'next/navigation';
import { auth } from '@/auth';
import { db, organizationMembers } from '@tasknebula/db';
import { eq } from 'drizzle-orm';
import { getTranslations } from 'next-intl/server';
import { requirePermission } from '@/lib/auth/permissions';
import { IntegrationsGrid } from '@/components/settings/integrations-grid';

export async function generateMetadata() {
  const t = await getTranslations('pagesSettings');
  return { title: t('integrations.metaTitle') };
}

export default async function IntegrationsPage() {
  const session = await auth();
  if (!session?.user?.id) {
    redirect('/auth/signin?callbackUrl=/settings/integrations');
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

  const t = await getTranslations('pagesSettings');

  return (
    <div className="mx-auto w-full max-w-5xl px-6 py-8 lg:px-8">
      <header className="mb-8">
        <h1 className="text-2xl font-semibold tracking-tight">{t('integrations.title')}</h1>
        <p className="text-muted-foreground mt-1.5 text-sm">{t('integrations.subtitle')}</p>
      </header>
      <IntegrationsGrid />
    </div>
  );
}
