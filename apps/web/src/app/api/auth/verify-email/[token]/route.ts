import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
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
 * `users.emailVerified`, marks the token used, and redirects:
 *   - authenticated users → /dashboard?verified=1
 *   - signed-out users    → /auth/signin?verified=1
 *
 * On failure redirects to /auth/verify-email?error=<reason>.
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params;
  const appUrl = resolveAppUrl().replace(/\/+$/, '');

  try {
    const [result, session] = await Promise.all([
      consumeEmailVerificationToken(token),
      auth(),
    ]);

    if (result.ok) {
      const target = session?.user?.id
        ? `${appUrl}/dashboard?verified=1`
        : `${appUrl}/auth/signin?verified=1`;
      return NextResponse.redirect(target);
    }

    const reason = result.reason || 'invalid';
    return NextResponse.redirect(`${appUrl}/auth/verify-email?error=${reason}`);
  } catch (error) {
    console.error('[verify-email] unexpected error:', error);
    return NextResponse.redirect(`${appUrl}/auth/verify-email?error=server_error`);
  }
}
