'use client';

import { use } from 'react';
import { useTranslations } from 'next-intl';
import { ModulesGrid } from '@/components/modules/modules-grid';
import { useProjectPermissions } from '@/lib/hooks/use-project-permissions';
import { PageFrame } from '@/components/ui/page-frame';
import { PageHeader } from '@/components/ui/page-header';

export default function ModulesPage({ params }: { params: Promise<{ projectId: string }> }) {
  const { projectId } = use(params);
  const t = useTranslations('pagesProjectTabs');
  const { permissions, isLoading: permissionsLoading } = useProjectPermissions(projectId);
  const canManageModules =
    !permissionsLoading &&
    (permissions.canAdministerProject ||
      permissions.isSuperAdmin ||
      permissions.isOrgOwner ||
      permissions.isOrgAdmin);

  return (
    <PageFrame className="animate-fade-in" contentClassName="space-y-5">
      <PageHeader title={t('modules.title')} description={t('modules.description')} />
      <ModulesGrid projectId={projectId} canManageModules={canManageModules} />
    </PageFrame>
  );
}
