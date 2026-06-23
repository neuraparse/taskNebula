import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { Suspense } from 'react';
import { redirect } from 'next/navigation';
import { auth } from '@/auth';
import { WorkspaceRequiredNotice } from '@/components/layout/workspace-required-notice';
import { userHasWorkspaceAccess } from '@/lib/auth/workspace-access';
import { MyIssuesClient } from './my-issues-client';
import { MyIssuesLoadingShell } from './my-issues-loading-shell';

export async function generateMetadata(): Promise<Metadata> {
  const tNav = await getTranslations('nav');

  return {
    title: `${tNav('my_issues')} | TaskNebula`,
  };
}

// PPR opt-in stub — re-enable once Next ships PPR on stable.
// export const experimental_ppr = true;

export default async function MyIssuesPage() {
  const session = await auth();

  if (!session?.user?.id) {
    redirect('/auth/signin');
  }

  if (!(await userHasWorkspaceAccess(session.user.id))) {
    return <WorkspaceRequiredNotice />;
  }

  return (
    <Suspense fallback={<MyIssuesLoadingShell />}>
      <MyIssuesClient />
    </Suspense>
  );
}
