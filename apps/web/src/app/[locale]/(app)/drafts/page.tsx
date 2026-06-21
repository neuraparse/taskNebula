import { getTranslations } from 'next-intl/server';
import { WorkspaceRequiredNotice } from '@/components/layout/workspace-required-notice';
import { DraftsList } from '@/components/drafts/drafts-list';
import { currentUserHasWorkspaceAccess } from '@/lib/auth/workspace-access';

export const metadata = { title: 'Drafts · TaskNebula' };

export default async function DraftsPage() {
  const hasWorkspaceAccess = await currentUserHasWorkspaceAccess();
  if (!hasWorkspaceAccess) {
    return <WorkspaceRequiredNotice />;
  }

  const t = await getTranslations('pagesHome');
  return (
    <div className="mx-auto w-full max-w-7xl px-6 py-8 lg:px-8">
      <header className="mb-6">
        <h1 className="text-2xl font-semibold tracking-tight">{t('drafts_title')}</h1>
        <p className="text-muted-foreground mt-1 text-sm">{t('drafts_subtitle')}</p>
      </header>
      <DraftsList />
    </div>
  );
}
