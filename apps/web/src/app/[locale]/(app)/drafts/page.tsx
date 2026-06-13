import { getTranslations } from 'next-intl/server';
import { DraftsList } from '@/components/drafts/drafts-list';

export const metadata = { title: 'Drafts · TaskNebula' };

export default async function DraftsPage() {
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
