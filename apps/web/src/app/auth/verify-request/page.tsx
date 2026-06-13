import Link from 'next/link';
import { getTranslations } from 'next-intl/server';
import { auth } from '@/auth';
import { VerifyRequestResendButton } from '@/components/auth/verify-request-resend-button';

export const dynamic = 'force-dynamic';

interface VerifyRequestPageProps {
  searchParams?: Promise<{ email?: string | string[] }>;
}

/**
 * /auth/verify-request
 *
 * Shown after signup or when NextAuth redirects an unverified user here.
 * Tells the user to check their inbox and exposes a resend button wired
 * to POST /api/auth/send-verification.
 *
 * The resend button is available when either:
 *   - the visitor has an authenticated session (endpoint resolves the
 *     user from the session cookie), OR
 *   - an `?email=` query param is present (endpoint resolves the user
 *     by email — used immediately after signup before session cookie
 *     is established).
 */
export default async function VerifyRequestPage({ searchParams }: VerifyRequestPageProps) {
  const session = await auth();
  const isAuthenticated = !!session?.user?.id;

  const resolvedSearchParams = (await searchParams) ?? {};
  const rawEmail = resolvedSearchParams.email;
  const emailParam = Array.isArray(rawEmail) ? rawEmail[0] : rawEmail;
  const email = emailParam && emailParam.length > 0 ? emailParam : null;

  const canResend = isAuthenticated || !!email;

  const t = await getTranslations('authPages');

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
              <span className="text-background text-[11px] font-semibold tracking-tight">
                {'TN'}
              </span>
            </div>
            <span className="text-foreground text-sm font-semibold tracking-tight">
              {'TaskNebula'}
            </span>
          </Link>
        </div>

        <div className="surface-card rounded-lg p-6 text-center sm:p-8">
          <h1 className="text-foreground text-lg font-semibold">{t('verifyRequest.title')}</h1>
          {email ? (
            <p className="text-muted-foreground mt-2 text-sm">
              {t.rich('verifyRequest.bodyWithEmail', {
                email,
                strong: (chunks) => (
                  <span className="text-foreground break-all font-medium">{chunks}</span>
                ),
              })}
            </p>
          ) : (
            <p className="text-muted-foreground mt-2 text-sm">{t('verifyRequest.body')}</p>
          )}

          {canResend ? (
            <div className="mt-6 space-y-3">
              <VerifyRequestResendButton email={email ?? undefined} />
              <p className="text-muted-foreground text-xs">{t('verifyRequest.didntGet')}</p>
              <Link
                href="/auth/signin"
                className="text-muted-foreground hover:text-foreground inline-block text-xs font-medium transition-colors"
              >
                {t('verifyRequest.backToSignIn')}
              </Link>
            </div>
          ) : (
            <div className="mt-6 space-y-3">
              <Link
                href="/auth/signin"
                className="text-primary inline-block text-sm font-medium hover:underline"
              >
                {t('verifyRequest.backToSignIn')}
              </Link>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
