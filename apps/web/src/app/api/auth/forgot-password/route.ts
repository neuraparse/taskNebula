import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { db, users } from '@tasknebula/db';
import { passwordResetTokens } from '@tasknebula/db/src/schema/password-reset-tokens';
import { and, eq, isNull } from 'drizzle-orm';
import { sendEmail } from '@/lib/email/sender';
import { checkRateLimit, getClientIp } from '@/lib/auth/rate-limit';
import { renderPasswordResetMessage } from '@/lib/email/templates';

const TOKEN_TTL_MS = 60 * 60 * 1000; // 1 hour
const RATE_LIMIT_PER_MIN = 5;
const GENERIC_MESSAGE =
  'If an account exists for that email, we’ve sent a password reset link.';

function hashToken(raw: string): string {
  return crypto.createHash('sha256').update(raw).digest('hex');
}

function resolveAppUrl(): string {
  return (
    process.env.NEXT_PUBLIC_APP_URL ||
    process.env.APP_URL ||
    'http://localhost:3000'
  );
}


export async function POST(request: NextRequest) {
  const ip = getClientIp(request);
  const limit = checkRateLimit(`forgot:${ip}`, RATE_LIMIT_PER_MIN, 60 * 1000);
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

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const email = typeof (body as { email?: unknown })?.email === 'string'
    ? ((body as { email: string }).email).trim().toLowerCase()
    : '';

  if (!email) {
    // Still return 200 to avoid enumeration even on malformed input.
    return NextResponse.json({ message: GENERIC_MESSAGE }, { status: 200 });
  }

  try {
    const user = await db.query.users.findFirst({
      where: eq(users.email, email),
    });

    if (user) {
      // Invalidate any existing unused tokens for this user so only the
      // latest link is valid.
      await db
        .update(passwordResetTokens)
        .set({ usedAt: new Date() })
        .where(
          and(
            eq(passwordResetTokens.userId, user.id),
            isNull(passwordResetTokens.usedAt)
          )
        );

      const rawToken = crypto.randomBytes(32).toString('hex');
      const tokenHash = hashToken(rawToken);
      const expiresAt = new Date(Date.now() + TOKEN_TTL_MS);

      await db.insert(passwordResetTokens).values({
        userId: user.id,
        tokenHash,
        expiresAt,
      });

      const appUrl = resolveAppUrl().replace(/\/+$/, '');
      const resetUrl = `${appUrl}/auth/reset-password?token=${rawToken}`;

      const { subject, html, text } = renderPasswordResetMessage({
        resetUrl,
        ip,
      });

      // Fire-and-forget; still await so failures get logged, but never block
      // the response with email errors.
      sendEmail({
        to: user.email,
        subject,
        html,
        text,
      }).catch((err) => {
        console.error('[forgot-password] email send failed:', err);
      });
    }

    return NextResponse.json({ message: GENERIC_MESSAGE }, { status: 200 });
  } catch (error) {
    console.error('[forgot-password] unexpected error:', error);
    // Still return generic 200 to avoid leaking whether the address exists.
    return NextResponse.json({ message: GENERIC_MESSAGE }, { status: 200 });
  }
}
