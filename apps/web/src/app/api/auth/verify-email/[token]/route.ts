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
  request: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params;
  const origin = request.nextUrl?.origin ?? new URL(request.url).origin;
  const wantsJson = request.headers.get('accept')?.includes('application/json') === true;

  try {
    const [result, session] = await Promise.all([consumeEmailVerificationToken(token), auth()]);

    if (result.ok) {
      if (wantsJson) {
        return NextResponse.json({
          verified: true,
          authenticated: Boolean(session?.user?.id),
        });
      }

      const target = session?.user?.id
        ? buildAppUrl('/dashboard?verified=1', origin)
        : buildAppUrl('/auth/signin?verified=1', origin);
      return NextResponse.redirect(target);
    }

    const reason = result.reason || 'invalid';
    if (wantsJson) {
      return NextResponse.json({ verified: false, reason }, { status: 400 });
    }

    return NextResponse.redirect(buildAppUrl(`/auth/verify-email?error=${reason}`, origin));
  } catch (error) {
    console.error('[verify-email] unexpected error:', error);
    if (wantsJson) {
      return NextResponse.json({ verified: false, reason: 'server_error' }, { status: 500 });
    }

    return NextResponse.redirect(buildAppUrl('/auth/verify-email?error=server_error', origin));
  }
}
