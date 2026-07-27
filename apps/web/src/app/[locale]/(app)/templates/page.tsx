import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';

import { WorkspaceRequiredNotice } from '@/components/layout/workspace-required-notice';
import { TemplatesGrid } from '@/components/templates/templates-grid';
import { currentUserHasWorkspaceAccess } from '@/lib/auth/workspace-access';
import { PageFrame } from '@/components/ui/page-frame';
import { PageHeader } from '@/components/ui/page-header';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('pagesWork');
  return {
    title: t('templates.metaTitle'),
    description: t('templates.description'),
  };
}

export default async function TemplatesPage() {
  const hasWorkspaceAccess = await currentUserHasWorkspaceAccess();
  if (!hasWorkspaceAccess) {
    return <WorkspaceRequiredNotice />;
  }

  const t = await getTranslations('pagesWork');
  return (
    <PageFrame contentClassName="space-y-5">
      <PageHeader title={t('templates.title')} description={t('templates.description')} />
      <TemplatesGrid />
    </PageFrame>
  );
}
