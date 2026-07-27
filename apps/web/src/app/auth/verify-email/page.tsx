import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import { AuthShell } from '@/components/auth/auth-shell';
import { AuthIntro } from '@/components/auth/auth-ui';
import { Button } from '@/components/ui/button';

export const dynamic = 'force-dynamic';

/**
 * /auth/verify-email
 *
 * Entry point for verification links. If a raw `?token=` is present we
 * forward the browser to the GET API route, which performs the actual
 * consumption and redirects to /auth/signin?verified=1 on success or
 * bounces back here with `?error=<reason>` on failure. Without a token
 * we render the error/success status derived from the query string.
 */
type SearchParams = {
  token?: string;
  error?: string;
};

const ERROR_KEYS = ['invalid', 'expired', 'already_used', 'user_missing', 'server_error'] as const;

export default async function VerifyEmailPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const params = await searchParams;

  // When a token is present, hand off to the API route which consumes it
  // and issues the final redirect. `redirect()` throws, so control never
  // falls through when this branch triggers.
  if (params.token) {
    redirect(`/api/auth/verify-email/${encodeURIComponent(params.token)}`);
  }

  const t = await getTranslations('authPages');

  const errorKey =
    params.error && (ERROR_KEYS as readonly string[]).includes(params.error) ? params.error : null;
  const copy = errorKey
    ? {
        title: t(`verifyEmail.errors.${errorKey}.title`),
        body: t(`verifyEmail.errors.${errorKey}.body`),
      }
    : null;

  return (
    <AuthShell>
      <div className="animate-fade-up space-y-7">
        <AuthIntro
          title={copy?.title || t('verifyEmail.defaultTitle')}
          description={copy?.body || t('verifyEmail.defaultBody')}
        />

        <div className="flex flex-col gap-3">
          <Button asChild className="w-full text-sm" size="xl">
            <Link href="/auth/verify-request">{t('verifyEmail.backToPrompt')}</Link>
          </Button>
          <Button asChild className="w-full text-sm" size="xl" variant="outline">
            <Link href="/auth/signin">{t('verifyEmail.goToSignIn')}</Link>
          </Button>
        </div>
      </div>
    </AuthShell>
  );
}
