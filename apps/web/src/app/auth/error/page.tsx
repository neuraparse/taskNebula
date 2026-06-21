'use client';

import { Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';
import { AuthShell } from '@/components/auth/auth-shell';
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
    <div className="stagger space-y-6">
      <div className="flex items-center gap-3">
        <span className="flex h-10 w-10 items-center justify-center bg-[#fff1f1] text-[#da1e28]">
          <AlertCircle className="h-5 w-5" aria-hidden="true" />
        </span>
        <span className="border border-[#ffd7d9] bg-[#fff1f1] px-2 py-1 text-xs text-[#a2191f]">
          {t('error.chip', { error })}
        </span>
      </div>

      <div className="space-y-2">
        <h1 className="auth-carbon-heading">{t('error.title')}</h1>
        <p className="auth-carbon-subtitle">{errorMessage}</p>
      </div>

      <Button asChild className="auth-carbon-primary w-full" size="lg">
        <Link href="/auth/signin">{t('error.tryAgain')}</Link>
      </Button>
    </div>
  );
}

export default function AuthErrorPage() {
  const tCommon = useTranslations('common');
  return (
    <AuthShell>
      <Suspense
        fallback={
          <div className="flex items-center justify-center py-8">
            <div className="auth-carbon-spinner" aria-label={tCommon('loading')} />
          </div>
        }
      >
        <ErrorContent />
      </Suspense>
    </AuthShell>
  );
}
