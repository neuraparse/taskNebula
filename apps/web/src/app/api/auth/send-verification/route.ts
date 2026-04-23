import crypto from 'node:crypto';
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { db, users, eq } from '@tasknebula/db';
import { auth } from '@/auth';
import { checkRateLimit, getClientIp } from '@/lib/auth/rate-limit';
import { issueEmailVerificationToken } from '@/lib/auth/email-verification';

const RATE_LIMIT_PER_MIN = 5;
const UNAUTH_LIMIT = 3;
const UNAUTH_WINDOW_MS = 10 * 60 * 1000;

const GENERIC_MESSAGE =
  'If that account exists, a verification email has been sent.';

const unauthBodySchema = z.object({
  email: z.string().email().max(254),
});

/**
 * Short, non-reversible identifier for a value — useful for log
 * correlation without leaking PII. Returns the first 12 hex chars of
 * SHA-256(value), which is enough to disambiguate typical log volume
 * while being impractical to rainbow-table back to the original.
 */
function hashPrefix(value: string): string {
  return crypto.createHash('sha256').update(value).digest('hex').slice(0, 12);
}

/**
 * POST /api/auth/send-verification
 *
 * Two modes:
 *  1. Authenticated: uses `session.user.id` to issue a new verification
 *     token. Prior unused tokens are invalidated.
 *  2. Unauthenticated (post-signup resend): accepts `{ email }` in the
 *     JSON body. Only issues a token if a user exists with that email
 *     AND their email is not yet verified. Rate-limited per-IP and
 *     per-email-hash so a caller cannot enumerate registered addresses
 *     via timing or 429 responses.
 *
 * Response is intentionally uniform across both paths — we never reveal
 * whether the address is registered or already verified.
 */
export async function POST(request: NextRequest) {
  const ip = getClientIp(request);
  const session = await auth();

  // Authenticated path — unchanged semantics, unified response shape.
  if (session?.user?.id) {
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
      // Fire-and-forget: don't make the client wait on SMTP.
      void issueEmailVerificationToken(session.user.id).catch((err) => {
        console.error('[send-verification] issue (auth) failed:', err);
      });
      console.log('[send-verification] request (auth)');
      return NextResponse.json({ message: GENERIC_MESSAGE }, { status: 200 });
    } catch (error) {
      console.error('[send-verification] unexpected error (auth):', error);
      return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
  }

  // Unauthenticated path — post-signup resend.
  let parsedEmail: string;
  try {
    const raw = await request.json();
    const parsed = unauthBodySchema.safeParse(raw);
    if (!parsed.success) {
      // Invalid payload shape — treat like a missing user: generic 200.
      // This avoids giving an attacker a free format-check oracle.
      return NextResponse.json({ message: GENERIC_MESSAGE }, { status: 200 });
    }
    parsedEmail = parsed.data.email.trim().toLowerCase();
  } catch {
    return NextResponse.json({ message: GENERIC_MESSAGE }, { status: 200 });
  }

  const emailKey = hashPrefix(parsedEmail);

  // Dual rate-limit: per-IP and per-email-hash. Both must pass.
  const ipLimit = checkRateLimit(
    `send-verification:unauth:ip:${ip}`,
    UNAUTH_LIMIT,
    UNAUTH_WINDOW_MS
  );
  const emailLimit = checkRateLimit(
    `send-verification:unauth:email:${emailKey}`,
    UNAUTH_LIMIT,
    UNAUTH_WINDOW_MS
  );

  if (!ipLimit.allowed || !emailLimit.allowed) {
    const retryAfterMs = Math.max(ipLimit.retryAfterMs, emailLimit.retryAfterMs);
    console.log('[send-verification] rate-limited (unauth)');
    return NextResponse.json(
      { error: 'Too many requests' },
      {
        status: 429,
        headers: {
          'Retry-After': String(Math.ceil(retryAfterMs / 1000)),
        },
      }
    );
  }

  try {
    const [user] = await db
      .select({
        id: users.id,
        emailVerified: users.emailVerified,
      })
      .from(users)
      .where(eq(users.email, parsedEmail))
      .limit(1);

    console.log(`[send-verification] request (unauth) email=${emailKey}`);

    if (user && user.emailVerified === null) {
      // Fire-and-forget token issuance; never awaited so that the
      // response time does not differ between the "user exists" and
      // "user missing" branches.
      void issueEmailVerificationToken(user.id).catch((err) => {
        console.error('[send-verification] issue (unauth) failed:', err);
      });
    }

    return NextResponse.json({ message: GENERIC_MESSAGE }, { status: 200 });
  } catch (error) {
    console.error('[send-verification] unexpected error (unauth):', error);
    // Still return 200 generic to avoid leaking state through errors.
    return NextResponse.json({ message: GENERIC_MESSAGE }, { status: 200 });
  }
}
