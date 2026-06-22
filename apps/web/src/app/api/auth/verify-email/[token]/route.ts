import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { consumeEmailVerificationToken } from '@/lib/auth/email-verification';
import { buildAppUrl } from '@/lib/url/app-url';

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
  const origin = _request.nextUrl?.origin ?? new URL(_request.url).origin;

  try {
    const [result, session] = await Promise.all([consumeEmailVerificationToken(token), auth()]);

    if (result.ok) {
      const target = session?.user?.id
        ? buildAppUrl('/dashboard?verified=1', origin)
        : buildAppUrl('/auth/signin?verified=1', origin);
      return NextResponse.redirect(target);
    }

    const reason = result.reason || 'invalid';
    return NextResponse.redirect(buildAppUrl(`/auth/verify-email?error=${reason}`, origin));
  } catch (error) {
    console.error('[verify-email] unexpected error:', error);
    return NextResponse.redirect(buildAppUrl('/auth/verify-email?error=server_error', origin));
  }
}
