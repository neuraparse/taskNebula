'use client';

import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { FilePlus2, NotebookText } from 'lucide-react';

interface DocsGettingStartedProps {
  canCreate: boolean;
  hasPages: boolean;
  scopeLabel: string;
  spaceName?: string | null;
  className?: string;
  onCreatePage?: () => void;
}

export function DocsGettingStarted({
  canCreate,
  hasPages,
  className,
  onCreatePage,
}: DocsGettingStartedProps) {
  const t = useTranslations('collab');
  return (
    <div
      className={cn(
        'animate-fade-up flex flex-col items-center gap-4 py-16 text-center',
        className
      )}
    >
      <div className="bg-surface text-muted-foreground flex h-10 w-10 items-center justify-center rounded-md">
        <NotebookText className="h-5 w-5" />
      </div>
      <p className="text-muted-foreground text-sm">
        {hasPages ? t('docs.gettingStarted.selectPage') : t('docs.gettingStarted.noPages')}
      </p>
      {canCreate ? (
        <Button size="sm" onClick={onCreatePage}>
          <FilePlus2 className="mr-2 h-4 w-4" />
          {t('docs.createPage')}
        </Button>
      ) : (
        <p className="text-muted-foreground text-xs">{t('docs.gettingStarted.readOnly')}</p>
      )}
    </div>
  );
}
