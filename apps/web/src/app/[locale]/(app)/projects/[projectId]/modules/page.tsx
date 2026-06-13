'use client';

import { use } from 'react';
import { Layers } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { ModulesGrid } from '@/components/modules/modules-grid';

export default function ModulesPage({ params }: { params: Promise<{ projectId: string }> }) {
  const { projectId } = use(params);
  const t = useTranslations('pagesProjectTabs');

  return (
    <div className="animate-fade-in h-full overflow-y-auto">
      <div className="space-y-5 p-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="bg-primary/10 text-primary inline-flex h-9 w-9 items-center justify-center rounded-lg">
              <Layers className="h-4 w-4" />
            </span>
            <div>
              <h1 className="text-2xl font-semibold tracking-tight">{t('modules.title')}</h1>
              <p className="text-muted-foreground text-sm">{t('modules.description')}</p>
            </div>
          </div>
        </div>

        <ModulesGrid projectId={projectId} />
      </div>
    </div>
  );
}
