'use client';

import { Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';
import { AuthShell } from '@/components/auth/auth-shell';
import { AuthIntro, AuthLoading } from '@/components/auth/auth-ui';
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
    <div className="animate-fade-up space-y-7">
      <div className="panel-danger text-destructive flex items-center gap-3 px-4 py-3">
        <AlertCircle className="h-5 w-5 shrink-0" aria-hidden="true" />
        <p className="min-w-0 break-words font-mono text-xs">{t('error.chip', { error })}</p>
      </div>

      <AuthIntro title={t('error.title')} description={errorMessage} />

      <Button asChild className="w-full text-sm" size="xl">
        <Link href="/auth/signin">{t('error.tryAgain')}</Link>
      </Button>
    </div>
  );
}

export default function AuthErrorPage() {
  const tCommon = useTranslations('common');
  return (
    <AuthShell>
      <Suspense fallback={<AuthLoading label={tCommon('loading')} />}>
        <ErrorContent />
      </Suspense>
    </AuthShell>
  );
}
