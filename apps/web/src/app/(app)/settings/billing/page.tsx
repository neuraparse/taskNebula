import { redirect } from 'next/navigation';
import { auth } from '@/auth';
import { db, organizationMembers } from '@tasknebula/db';
import { eq } from 'drizzle-orm';
import { requirePermission } from '@/lib/auth/permissions';

export default async function BillingRedirectPage() {
  const session = await auth();
  if (!session?.user?.id) {
    redirect('/auth/signin?callbackUrl=/settings/billing');
  }

  const [primaryOrg] = await db
    .select({ organizationId: organizationMembers.organizationId })
    .from(organizationMembers)
    .where(eq(organizationMembers.userId, session.user.id))
    .limit(1);

  if (!primaryOrg) {
    redirect('/dashboard?error=insufficient-permission');
  }

  await requirePermission(primaryOrg.organizationId, 'org:billing');

  redirect('/settings?tab=organization');
}
