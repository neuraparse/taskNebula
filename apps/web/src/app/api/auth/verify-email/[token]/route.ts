import { NextRequest, NextResponse } from 'next/server';
import { consumeEmailVerificationToken } from '@/lib/auth/email-verification';

function resolveAppUrl(): string {
  return (
    process.env.NEXT_PUBLIC_APP_URL ||
    process.env.APP_URL ||
    'http://localhost:3000'
  );
}

/**
 * GET /api/auth/verify-email/[token]
 *
 * Validates an email verification token. On success stamps
 * `users.emailVerified`, marks the token used, and redirects to the
 * sign-in page with `?verified=1`. On failure redirects to the
 * verify-email page with a `?error=<reason>` query string so the UI
 * can surface it.
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params;
  const appUrl = resolveAppUrl().replace(/\/+$/, '');

  try {
    const result = await consumeEmailVerificationToken(token);

    if (result.ok) {
      return NextResponse.redirect(`${appUrl}/auth/signin?verified=1`);
    }

    const reason = result.reason || 'invalid';
    return NextResponse.redirect(`${appUrl}/auth/verify-email?error=${reason}`);
  } catch (error) {
    console.error('[verify-email] unexpected error:', error);
    return NextResponse.redirect(`${appUrl}/auth/verify-email?error=server_error`);
  }
}
