import Link from 'next/link';
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
export default async function VerifyRequestPage({
  searchParams,
}: VerifyRequestPageProps) {
  const session = await auth();
  const isAuthenticated = !!session?.user?.id;

  const resolvedSearchParams = (await searchParams) ?? {};
  const rawEmail = resolvedSearchParams.email;
  const emailParam = Array.isArray(rawEmail) ? rawEmail[0] : rawEmail;
  const email = emailParam && emailParam.length > 0 ? emailParam : null;

  const canResend = isAuthenticated || !!email;

  return (
    <div className="relative min-h-dvh grid place-items-center bg-background overflow-hidden px-4">
      <div
        aria-hidden="true"
        className="bg-aurora absolute inset-0 pointer-events-none blur-3xl opacity-60 -z-10"
      />

      <div className="relative w-full max-w-sm animate-blur-in">
        <div className="mb-5 flex justify-center">
          <Link
            href="/"
            className="flex items-center gap-2 rounded-md transition-all duration-150 ease-snap focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
          >
            <div className="flex h-7 w-7 items-center justify-center rounded-md bg-foreground">
              <span className="text-[11px] font-semibold tracking-tight text-background">TN</span>
            </div>
            <span className="text-sm font-semibold tracking-tight text-foreground">TaskNebula</span>
          </Link>
        </div>

        <div className="surface-card rounded-lg p-6 sm:p-8 text-center">
          <h1 className="text-lg font-semibold text-foreground">Check your email</h1>
          {email ? (
            <p className="mt-2 text-sm text-muted-foreground">
              We sent a verification email to{' '}
              <span className="font-medium text-foreground break-all">{email}</span>.
              Click the link to confirm your email address and continue. The link
              expires in 24 hours.
            </p>
          ) : (
            <p className="mt-2 text-sm text-muted-foreground">
              We sent you a verification link. Click it to confirm your email
              address and continue. The link expires in 24 hours.
            </p>
          )}

          {canResend ? (
            <div className="mt-6 space-y-3">
              <VerifyRequestResendButton email={email ?? undefined} />
              <p className="text-xs text-muted-foreground">
                Didn&apos;t get the email? Check your spam folder or resend.
              </p>
              <Link
                href="/auth/signin"
                className="inline-block text-xs font-medium text-muted-foreground hover:text-foreground transition-colors"
              >
                Back to sign in
              </Link>
            </div>
          ) : (
            <div className="mt-6 space-y-3">
              <Link
                href="/auth/signin"
                className="inline-block text-sm font-medium text-primary hover:underline"
              >
                Back to sign in
              </Link>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
