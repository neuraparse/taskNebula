'use client';

import { Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';
import { AlertCircle } from 'lucide-react';
import Link from 'next/link';

const ERROR_KEYS = ['Configuration', 'AccessDenied', 'Verification', 'Default'] as const;

function ErrorContent() {
  const t = useTranslations('authPages');
  const searchParams = useSearchParams();
  const error = searchParams.get('error') || 'Default';
  const errorKey = (ERROR_KEYS as readonly string[]).includes(error) ? error : 'Default';
  const errorMessage = t(`error.messages.${errorKey}`);

  return (
    <div className="stagger space-y-5 text-center">
      <div className="flex justify-center">
        <span className="chip-rose" aria-hidden="true">
          {t('error.chip', { error })}
        </span>
      </div>

      <div className="flex justify-center">
        <AlertCircle className="text-destructive h-8 w-8" aria-hidden="true" />
      </div>

      <div className="space-y-1">
        <h1 className="text-foreground text-2xl font-semibold tracking-tight">
          {t('error.title')}
        </h1>
        <p className="text-muted-foreground text-sm">{errorMessage}</p>
      </div>

      <Button asChild className="ease-snap w-full transition-all duration-150" size="lg">
        <Link href="/auth/signin">{t('error.tryAgain')}</Link>
      </Button>
    </div>
  );
}

export default function AuthErrorPage() {
  const tCommon = useTranslations('common');
  return (
    <div className="bg-background relative grid min-h-dvh place-items-center overflow-hidden px-4">
      <div
        aria-hidden="true"
        className="bg-aurora pointer-events-none absolute inset-0 -z-10 opacity-60 blur-3xl"
      />

      <div className="animate-blur-in relative w-full max-w-sm">
        <div className="surface-card rounded-lg p-6 sm:p-8">
          <Suspense
            fallback={
              <div className="flex items-center justify-center py-8">
                <div
                  className="border-foreground h-5 w-5 animate-spin rounded-full border-2 border-t-transparent"
                  aria-label={tCommon('loading')}
                />
              </div>
            }
          >
            <ErrorContent />
          </Suspense>
        </div>
      </div>
    </div>
  );
}
