/**
 * Email verification token lifecycle helpers.
 *
 * - `issueEmailVerificationToken`: generates a random token, stores its
 *   SHA-256 hash, invalidates any prior unused tokens for the same user,
 *   and sends the verification email.
 * - `consumeEmailVerificationToken`: validates an incoming raw token and,
 *   on success, marks it used and stamps `users.emailVerified`.
 *
 * Raw tokens never touch the database. Only SHA-256 hex digests do.
 */
import crypto from 'node:crypto';
import { db, users, eq, and, isNull } from '@tasknebula/db';
import { emailVerificationTokens } from '@tasknebula/db/src/schema/email-verification-tokens';
import { sendEmail } from '@/lib/email/sender';

const TOKEN_BYTES = 32; // 256 bits → 64 hex chars
const TOKEN_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

function hashToken(raw: string): string {
  return crypto.createHash('sha256').update(raw).digest('hex');
}

function buildVerificationUrl(token: string): string {
  const base = process.env.NEXT_PUBLIC_APP_URL || process.env.APP_URL || '';
  return `${base}/auth/verify-email?token=${encodeURIComponent(token)}`;
}

export interface IssueResult {
  issued: boolean;
  emailSent: boolean;
  skippedReason?: 'already_verified';
}

/**
 * Create and email a fresh verification token for the user with `userId`.
 * Any prior unused tokens for the user are marked used to prevent reuse.
 * If the user's email is already verified, no token is issued.
 */
export async function issueEmailVerificationToken(userId: string): Promise<IssueResult> {
  const [user] = await db
    .select({
      id: users.id,
      email: users.email,
      name: users.name,
      emailVerified: users.emailVerified,
    })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);

  if (!user || !user.email) {
    return { issued: false, emailSent: false };
  }

  if (user.emailVerified) {
    return { issued: false, emailSent: false, skippedReason: 'already_verified' };
  }

  // Invalidate prior unused tokens so only the newest one works.
  await db
    .update(emailVerificationTokens)
    .set({ usedAt: new Date() })
    .where(
      and(
        eq(emailVerificationTokens.userId, userId),
        isNull(emailVerificationTokens.usedAt)
      )
    );

  const rawToken = crypto.randomBytes(TOKEN_BYTES).toString('hex');
  const tokenHash = hashToken(rawToken);
  const expiresAt = new Date(Date.now() + TOKEN_TTL_MS);

  await db.insert(emailVerificationTokens).values({
    userId,
    tokenHash,
    expiresAt,
  });

  const verifyUrl = buildVerificationUrl(rawToken);
  const displayName = user.name || user.email;

  const result = await sendEmail({
    to: user.email,
    subject: 'Verify your TaskNebula email address',
    html: `<!DOCTYPE html><html><body style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,sans-serif;background:#f5f6fa;margin:0;padding:32px 16px;color:#111827;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr><td align="center">
<table role="presentation" width="560" cellpadding="0" cellspacing="0" border="0" style="max-width:560px;width:100%;background:#ffffff;border:1px solid #e5e7eb;border-radius:6px;padding:32px;">
<tr><td>
<p style="margin:0 0 8px 0;color:#6b7280;font-size:11px;letter-spacing:0.14em;text-transform:uppercase;font-weight:600;">VERIFY EMAIL</p>
<h1 style="margin:0 0 12px 0;font-size:20px;font-weight:600;color:#111827;">Confirm your email address</h1>
<p style="margin:0 0 16px 0;font-size:14px;line-height:1.6;color:#374151;">Hi ${displayName}, click the button below to verify the email address you used to sign up for TaskNebula. This link expires in 24 hours.</p>
<p style="margin:24px 0;"><a href="${verifyUrl}" style="background:#4f46e5;color:#ffffff;display:inline-block;font-size:14px;font-weight:500;padding:12px 24px;text-decoration:none;border-radius:4px;">Verify email</a></p>
<p style="margin:16px 0 0 0;font-size:12px;color:#6b7280;">If the button doesn't work, paste this URL into your browser:<br/><span style="color:#374151;word-break:break-all;">${verifyUrl}</span></p>
<p style="margin:16px 0 0 0;font-size:12px;color:#9ca3af;">If you didn't create a TaskNebula account, you can safely ignore this message.</p>
</td></tr></table>
</td></tr></table>
</body></html>`,
    text:
      `Verify your TaskNebula email address\n\n` +
      `Hi ${displayName}, confirm your email by visiting:\n${verifyUrl}\n\n` +
      `This link expires in 24 hours. If you didn't create an account, you can ignore this message.\n`,
  });

  return { issued: true, emailSent: result.sent };
}

export interface ConsumeResult {
  ok: boolean;
  reason?: 'invalid' | 'expired' | 'already_used' | 'user_missing';
  userId?: string;
}

/**
 * Validate a raw token and — if it is live — mark it used and stamp
 * `users.emailVerified`. Idempotent: already-used tokens return
 * `{ ok: false, reason: 'already_used' }`.
 */
export async function consumeEmailVerificationToken(rawToken: string): Promise<ConsumeResult> {
  if (!rawToken || typeof rawToken !== 'string') {
    return { ok: false, reason: 'invalid' };
  }

  const tokenHash = hashToken(rawToken);

  const [record] = await db
    .select()
    .from(emailVerificationTokens)
    .where(eq(emailVerificationTokens.tokenHash, tokenHash))
    .limit(1);

  if (!record) {
    return { ok: false, reason: 'invalid' };
  }

  if (record.usedAt) {
    return { ok: false, reason: 'already_used' };
  }

  if (record.expiresAt.getTime() < Date.now()) {
    return { ok: false, reason: 'expired' };
  }

  const [user] = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.id, record.userId))
    .limit(1);

  if (!user) {
    return { ok: false, reason: 'user_missing' };
  }

  const now = new Date();

  await db
    .update(users)
    .set({ emailVerified: now, updatedAt: now })
    .where(eq(users.id, record.userId));

  await db
    .update(emailVerificationTokens)
    .set({ usedAt: now })
    .where(eq(emailVerificationTokens.id, record.id));

  return { ok: true, userId: record.userId };
}
