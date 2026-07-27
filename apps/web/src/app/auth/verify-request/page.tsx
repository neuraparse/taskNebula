import Link from 'next/link';
import { getTranslations } from 'next-intl/server';
import { auth } from '@/auth';
import { AuthShell } from '@/components/auth/auth-shell';
import { AUTH_STANDALONE_LINK_CLASS_NAME, AuthIntro } from '@/components/auth/auth-ui';
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
      <div className="animate-fade-up space-y-7">
        <AuthIntro
          title={t('verifyRequest.title')}
          description={
            email
              ? t.rich('verifyRequest.bodyWithEmail', {
                  email,
                  strong: (chunks) => (
                    <span className="text-foreground break-all font-medium">{chunks}</span>
                  ),
                })
              : t('verifyRequest.body')
          }
        />

        {canResend ? (
          <div className="space-y-3">
            <VerifyRequestResendButton email={email ?? undefined} />
            <p className="text-muted-foreground text-sm leading-6">{t('verifyRequest.didntGet')}</p>
            <Link href="/auth/signin" className={`${AUTH_STANDALONE_LINK_CLASS_NAME} text-sm`}>
              {t('verifyRequest.backToSignIn')}
            </Link>
          </div>
        ) : (
          <Link href="/auth/signin" className={`${AUTH_STANDALONE_LINK_CLASS_NAME} text-sm`}>
            {t('verifyRequest.backToSignIn')}
          </Link>
        )}
      </div>
    </AuthShell>
  );
}
