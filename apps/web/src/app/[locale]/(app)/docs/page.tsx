import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';

import { DocsShell } from '@/components/docs/docs-shell';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('pagesWork');
  return {
    title: t('docs.metaTitle'),
  };
}

export default function DocsPage() {
  return (
    <div className="animate-fade-in h-full min-h-0 overflow-hidden">
      <DocsShell />
    </div>
  );
}
