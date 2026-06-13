import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';

import { TemplatesGrid } from '@/components/templates/templates-grid';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('pagesWork');
  return {
    title: t('templates.metaTitle'),
    description: t('templates.description'),
  };
}

export default async function TemplatesPage() {
  const t = await getTranslations('pagesWork');
  return (
    <div className="mx-auto w-full max-w-7xl px-6 py-8 lg:px-8">
      <header className="mb-6">
        <h1 className="text-2xl font-semibold tracking-tight">{t('templates.title')}</h1>
        <p className="text-muted-foreground mt-1 text-sm">{t('templates.description')}</p>
      </header>
      <TemplatesGrid />
    </div>
  );
}
