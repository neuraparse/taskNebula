import Link from 'next/link';
import { getTranslations } from 'next-intl/server';
import { auth } from '@/auth';
import { AuthShell } from '@/components/auth/auth-shell';
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
    <AuthShell>
      <div className="stagger space-y-6">
        <div className="space-y-2">
          <h1 className="auth-carbon-heading">{t('verifyRequest.title')}</h1>
          {email ? (
            <p className="auth-carbon-subtitle">
              {t.rich('verifyRequest.bodyWithEmail', {
                email,
                strong: (chunks) => (
                  <span className="break-all font-medium text-[#161616]">{chunks}</span>
                ),
              })}
            </p>
          ) : (
            <p className="auth-carbon-subtitle">{t('verifyRequest.body')}</p>
          )}
        </div>

        {canResend ? (
          <div className="space-y-3">
            <VerifyRequestResendButton email={email ?? undefined} />
            <p className="text-sm text-[#525252]">{t('verifyRequest.didntGet')}</p>
            <Link href="/auth/signin" className="auth-carbon-link inline-block text-sm">
              {t('verifyRequest.backToSignIn')}
            </Link>
          </div>
        ) : (
          <Link href="/auth/signin" className="auth-carbon-link inline-block text-sm">
            {t('verifyRequest.backToSignIn')}
          </Link>
        )}
      </div>
    </AuthShell>
  );
}
