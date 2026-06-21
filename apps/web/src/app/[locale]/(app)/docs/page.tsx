import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { redirect } from 'next/navigation';

import { auth } from '@/auth';
import { DocsShell } from '@/components/docs/docs-shell';
import { WorkspaceRequiredNotice } from '@/components/layout/workspace-required-notice';
import { userHasWorkspaceAccess } from '@/lib/auth/workspace-access';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('pagesWork');
  return {
    title: t('docs.metaTitle'),
  };
}

export default async function DocsPage() {
  const session = await auth();

  if (!session?.user?.id) {
    redirect('/auth/signin');
  }

  if (!(await userHasWorkspaceAccess(session.user.id))) {
    return <WorkspaceRequiredNotice />;
  }

  return (
    <div className="animate-fade-in h-full min-h-0 overflow-hidden">
      <DocsShell />
    </div>
  );
}
