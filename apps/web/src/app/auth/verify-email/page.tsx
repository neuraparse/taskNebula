import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getTranslations } from 'next-intl/server';

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
    <div className="bg-background relative grid min-h-dvh place-items-center overflow-hidden px-4">
      <div
        aria-hidden="true"
        className="bg-aurora pointer-events-none absolute inset-0 -z-10 opacity-60 blur-3xl"
      />

      <div className="animate-blur-in relative w-full max-w-sm">
        <div className="mb-5 flex justify-center">
          <Link
            href="/"
            className="ease-snap focus-visible:ring-ring flex items-center gap-2 rounded-md transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2"
          >
            <div className="bg-foreground flex h-7 w-7 items-center justify-center rounded-md">
              <span className="text-background text-[11px] font-semibold tracking-tight">TN</span>
            </div>
            <span className="text-foreground text-sm font-semibold tracking-tight">TaskNebula</span>
          </Link>
        </div>

        <div className="surface-card rounded-lg p-6 text-center sm:p-8">
          <h1 className="text-foreground text-lg font-semibold">
            {copy?.title || t('verifyEmail.defaultTitle')}
          </h1>
          <p className="text-muted-foreground mt-2 text-sm">
            {copy?.body || t('verifyEmail.defaultBody')}
          </p>

          <div className="mt-6 flex flex-col items-center gap-3">
            <Link
              href="/auth/verify-request"
              className="text-primary text-sm font-medium hover:underline"
            >
              {t('verifyEmail.backToPrompt')}
            </Link>
            <Link
              href="/auth/signin"
              className="text-muted-foreground hover:text-foreground text-xs"
            >
              {t('verifyEmail.goToSignIn')}
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
