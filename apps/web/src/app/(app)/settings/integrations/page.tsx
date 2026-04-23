import { redirect } from 'next/navigation';
import { auth } from '@/auth';
import { db, organizationMembers } from '@tasknebula/db';
import { eq } from 'drizzle-orm';
import { requirePermission } from '@/lib/auth/permissions';
import { IntegrationsGrid } from '@/components/settings/integrations-grid';

export const metadata = { title: 'Integrations · TaskNebula' };

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

  return (
    <div className="mx-auto w-full max-w-5xl px-6 py-8 lg:px-8">
      <header className="mb-8">
        <h1 className="text-2xl font-semibold tracking-tight">Integrations</h1>
        <p className="mt-1.5 text-sm text-muted-foreground">
          Connect TaskNebula to the tools your team uses every day.
        </p>
      </header>
      <IntegrationsGrid />
    </div>
  );
}
