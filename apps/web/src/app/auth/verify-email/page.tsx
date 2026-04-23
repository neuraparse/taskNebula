import Link from 'next/link';
import { redirect } from 'next/navigation';

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

const ERROR_COPY: Record<string, { title: string; body: string }> = {
  invalid: {
    title: 'This verification link is invalid',
    body: 'The token we received doesn’t match any active verification request. Ask for a fresh email from the verification prompt.',
  },
  expired: {
    title: 'This verification link has expired',
    body: 'Verification links are valid for 24 hours. Request a new one to continue.',
  },
  already_used: {
    title: 'This link was already used',
    body: 'You can sign in now. If you still need to verify a different email, request a fresh link from your account.',
  },
  user_missing: {
    title: 'Account not found',
    body: 'We couldn’t find the account this link belongs to. Please sign up again.',
  },
  server_error: {
    title: 'Something went wrong',
    body: 'An unexpected error occurred while verifying your email. Please try again in a moment.',
  },
};

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

  const copy = params.error ? ERROR_COPY[params.error] : null;

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
          <h1 className="text-lg font-semibold text-foreground">
            {copy?.title || 'Email verification'}
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            {copy?.body ||
              'Open the verification link from your inbox to continue. If you need a fresh link, use the resend button on the previous screen.'}
          </p>

          <div className="mt-6 flex flex-col items-center gap-3">
            <Link
              href="/auth/verify-request"
              className="text-sm font-medium text-primary hover:underline"
            >
              Back to verification prompt
            </Link>
            <Link
              href="/auth/signin"
              className="text-xs text-muted-foreground hover:text-foreground"
            >
              Go to sign in
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
