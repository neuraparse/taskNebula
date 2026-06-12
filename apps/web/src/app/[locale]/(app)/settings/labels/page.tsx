/**
 * Org-level labels page — members manage the first-class labels used to
 * categorize issues. Mirrors the standalone settings pages (integrations/sso).
 *
 * Permission: active org membership is enough — the labels API
 * (`/api/labels`) gates every call on `isActiveOrganizationMember`.
 */
import { redirect } from 'next/navigation';
import { auth } from '@/auth';
import { db, organizationMembers } from '@tasknebula/db';
import { eq } from 'drizzle-orm';
import { LabelsSettingsClient } from '@/components/settings/labels-settings-client';

export const metadata = { title: 'Labels · TaskNebula' };

export default async function LabelsSettingsPage() {
  const session = await auth();
  if (!session?.user?.id) {
    redirect('/auth/signin?callbackUrl=/settings/labels');
  }

  const [membership] = await db
    .select({ organizationId: organizationMembers.organizationId })
    .from(organizationMembers)
    .where(eq(organizationMembers.userId, session.user.id))
    .limit(1);

  if (!membership) {
    redirect('/dashboard?error=insufficient-permission');
  }

  return <LabelsSettingsClient />;
}
