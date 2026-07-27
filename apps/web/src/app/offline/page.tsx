'use client';

import Link from 'next/link';
import { WifiOff } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';

export default function OfflinePage() {
  const t = useTranslations('publicPages');
  const tAuth = useTranslations('authExtra');
  const tNotFound = useTranslations('errorPages.notFound');

  return (
    <main className="bg-muted/30 text-foreground grid min-h-dvh place-items-center px-4 py-8">
      <section
        aria-labelledby="offline-title"
        className="animate-fade-up border-border bg-card shadow-xs w-full max-w-md rounded-lg border p-6 sm:p-8"
      >
        <div
          className="bg-accent-amber/10 text-accent-amber mb-8 flex h-10 w-10 items-center justify-center rounded-md"
          aria-hidden="true"
        >
          <WifiOff className="h-5 w-5" />
        </div>

        <div className="space-y-2">
          <p className="kicker text-accent-amber">{tAuth('network_error')}</p>
          <h1 id="offline-title" className="text-2xl font-semibold tracking-tight">
            {t('offlineTitle')}
          </h1>
        </div>

        <div className="mt-8 grid gap-3 sm:grid-cols-2">
          <Button onClick={() => window.location.reload()} size="xl" className="w-full text-sm">
            {t('offlineRetry')}
          </Button>
          <Button asChild size="xl" variant="outline" className="w-full text-sm">
            <Link href="/">{tNotFound('backToHome')}</Link>
          </Button>
        </div>
      </section>
    </main>
  );
}
