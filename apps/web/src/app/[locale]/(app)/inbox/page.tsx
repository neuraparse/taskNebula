import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { redirect } from 'next/navigation';
import { auth } from '@/auth';
import { WorkspaceRequiredNotice } from '@/components/layout/workspace-required-notice';
import { userHasWorkspaceAccess } from '@/lib/auth/workspace-access';
import { InboxPageClient } from './inbox-client';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('pagesHome');

  return {
    title: `${t('inbox_title')} | TaskNebula`,
    description: t('inbox_subtitle'),
  };
}

export const dynamic = 'force-dynamic';

export default async function InboxPage() {
  const session = await auth();

  if (!session?.user?.id) {
    redirect('/auth/signin');
  }

  if (!(await userHasWorkspaceAccess(session.user.id))) {
    return <WorkspaceRequiredNotice />;
  }

  return <InboxPageClient />;
}
