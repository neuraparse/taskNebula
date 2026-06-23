'use client';

import { WifiOff } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';

export default function OfflinePage() {
  const t = useTranslations('publicPages');

  return (
    <div className="bg-background grid min-h-dvh place-items-center px-4">
      <div className="panel-warn animate-fade-up text-accent-amber flex w-full max-w-sm items-center gap-3 rounded-lg px-4 py-3">
        <WifiOff className="h-5 w-5 shrink-0" aria-hidden="true" />
        <p className="text-foreground flex-1 text-sm">{t('offlineTitle')}</p>
        <Button
          onClick={() => window.location.reload()}
          size="sm"
          variant="outline"
          className="rounded-md"
        >
          {t('offlineRetry')}
        </Button>
      </div>
    </div>
  );
}
