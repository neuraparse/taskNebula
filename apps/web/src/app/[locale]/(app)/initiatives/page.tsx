import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { auth } from '@/auth';
import { redirect } from 'next/navigation';
import { WorkspaceRequiredNotice } from '@/components/layout/workspace-required-notice';
import { userHasWorkspaceAccess } from '@/lib/auth/workspace-access';
import { InitiativesClient } from './initiatives-client';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('pagesHome');

  return {
    title: `${t('initiatives_title')} | TaskNebula`,
    description: t('initiatives_subtitle'),
  };
}

export const dynamic = 'force-dynamic';

export default async function InitiativesPage() {
  const session = await auth();
  if (!session?.user?.id) redirect('/auth/signin');

  const hasWorkspaceAccess = await userHasWorkspaceAccess(session.user.id);
  if (!hasWorkspaceAccess) {
    return <WorkspaceRequiredNotice />;
  }

  return <InitiativesClient />;
}
