import { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { auth } from '@/auth';
import { redirect } from 'next/navigation';
import { WorkspaceRequiredNotice } from '@/components/layout/workspace-required-notice';
import { userHasWorkspaceAccess } from '@/lib/auth/workspace-access';
import { ProjectsClient } from './projects-client';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('pagesProjects');
  return {
    title: t('metaTitle'),
    description: t('metaDescription'),
  };
}

export const dynamic = 'force-dynamic';

export default async function ProjectsPage() {
  const session = await auth();

  if (!session?.user?.id) {
    redirect('/auth/signin');
  }

  if (!(await userHasWorkspaceAccess(session.user.id))) {
    return <WorkspaceRequiredNotice />;
  }

  return <ProjectsClient />;
}
