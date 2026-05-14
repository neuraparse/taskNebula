import { redirect } from 'next/navigation';
import { auth } from '@/auth';
import { db, organizationMembers } from '@tasknebula/db';
import { eq } from 'drizzle-orm';
import { requirePermission } from '@/lib/auth/permissions';
import { ImportWizard } from './import-wizard';

export const metadata = { title: 'Import issues · TaskNebula' };

/**
 * Settings → Import page.
 *
 * Renders the source picker + adapter-specific form. Auth and membership
 * are enforced here so the client never needs to know about workspace
 * resolution.
 */
export default async function ImportSettingsPage() {
  const session = await auth();
  if (!session?.user?.id) {
    redirect('/auth/signin?callbackUrl=/settings/import');
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
        <h1 className="text-2xl font-semibold tracking-tight">Import issues</h1>
        <p className="mt-1.5 text-sm text-muted-foreground">
          Bring work into TaskNebula from a CSV file, Linear, Jira, or GitHub
          Issues. CSV is fully supported today; the other sources are in
          preview and may not import every field.
        </p>
      </header>
      <ImportWizard workspaceId={primaryOrg.organizationId} />
    </div>
  );
}
