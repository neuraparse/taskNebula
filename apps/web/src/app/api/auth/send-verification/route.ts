import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { checkRateLimit, getClientIp } from '@/lib/auth/rate-limit';
import { issueEmailVerificationToken } from '@/lib/auth/email-verification';

const RATE_LIMIT_PER_MIN = 5;

/**
 * POST /api/auth/send-verification
 *
 * Issues a new email-verification token for the authenticated user and
 * mails the link. Prior unused tokens are invalidated. If the user's
 * email is already verified, returns 200 with `alreadyVerified: true`.
 */
export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const ip = getClientIp(request);
  const limit = checkRateLimit(
    `send-verification:${session.user.id}:${ip}`,
    RATE_LIMIT_PER_MIN,
    60 * 1000
  );
  if (!limit.allowed) {
    return NextResponse.json(
      { error: 'Too many requests' },
      {
        status: 429,
        headers: {
          'Retry-After': String(Math.ceil(limit.retryAfterMs / 1000)),
        },
      }
    );
  }

  try {
    const result = await issueEmailVerificationToken(session.user.id);

    if (result.skippedReason === 'already_verified') {
      return NextResponse.json(
        { alreadyVerified: true, message: 'Email is already verified' },
        { status: 200 }
      );
    }

    if (!result.issued) {
      return NextResponse.json(
        { error: 'Unable to issue verification token' },
        { status: 400 }
      );
    }

    return NextResponse.json(
      {
        message: 'Verification email sent',
        emailSent: result.emailSent,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error('[send-verification] unexpected error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
