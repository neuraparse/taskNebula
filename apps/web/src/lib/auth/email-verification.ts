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
import {
  db,
  users,
  eq,
  and,
  isNull,
  isNotNull,
  gte,
  renderShell,
  paragraph,
  infoCard,
  bulletList,
  textFooter,
  EMAIL_COLORS,
} from '@tasknebula/db';
import { emailVerificationTokens } from '@tasknebula/db/src/schema/email-verification-tokens';
import { sendEmail } from '@/lib/email/sender';
import { buildAppUrl } from '@/lib/url/app-url';

const TOKEN_BYTES = 32; // 256 bits → 64 hex chars
const TOKEN_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

function hashToken(raw: string): string {
  return crypto.createHash('sha256').update(raw).digest('hex');
}

function buildVerificationUrl(token: string): string {
  return buildAppUrl(`/auth/verify-email?token=${encodeURIComponent(token)}`);
}

/**
 * Render the verify-email message (subject/html/text) with the given
 * recipient display name and verify URL. Extracted so diagnostic tools
 * (e.g. the admin email preview panel) can render an exact copy without
 * duplicating the layout composition.
 */
export function renderVerifyEmailMessage(args: { displayName: string; verifyUrl: string }): {
  subject: string;
  html: string;
  text: string;
} {
  const { displayName, verifyUrl } = args;

  const body = [
    paragraph(
      'Click the button below to verify the email associated with your TaskNebula account. This link expires in 24 hours.'
    ),
    infoCard({
      title: 'Once verified',
      tone: 'info',
      body: bulletList(['Log in and set your profile photo', 'Invite your team', 'Join a project']),
    }),
  ].join('');

  const fallback = [
    paragraph(
      `If the button doesn't work, paste this URL into your browser:<br/><span style="color:${EMAIL_COLORS.body};word-break:break-all;">${verifyUrl}</span>`,
      { muted: true, spacingTop: 20 }
    ),
    paragraph("If you didn't create a TaskNebula account, you can safely ignore this message.", {
      muted: true,
      spacingTop: 12,
    }),
  ].join('');

  const html = renderShell({
    kicker: 'VERIFY EMAIL',
    heading: 'Confirm your email address',
    subheading: `Hi ${displayName}, one click and you're set.`,
    preheader: 'Verify your TaskNebula email to access notifications and invites.',
    body: body + fallback,
    ctaLabel: 'Verify email',
    ctaUrl: verifyUrl,
  });

  const text =
    `Verify your TaskNebula email address\n\n` +
    `Hi ${displayName}, one click and you're set.\n\n` +
    `Confirm the email on your account by visiting:\n${verifyUrl}\n\n` +
    `This link expires in 24 hours. If you didn't create an account, you can ignore this message.` +
    textFooter();

  return { subject: 'Verify your TaskNebula email address', html, text };
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
    .where(and(eq(emailVerificationTokens.userId, userId), isNull(emailVerificationTokens.usedAt)));

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

  const { subject, html, text } = renderVerifyEmailMessage({ displayName, verifyUrl });

  const result = await sendEmail({
    to: user.email,
    subject,
    html,
    text,
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
 * `users.emailVerified`.
 *
 * Gracefully handles re-clicks: if the token is already used but the
 * user is now verified, we return `ok: true` so the UX lands on the
 * success page instead of an error page. Same for expired tokens on a
 * user whose email is already verified — no reason to nag them.
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

  const [user] = await db
    .select({ id: users.id, emailVerified: users.emailVerified })
    .from(users)
    .where(eq(users.id, record.userId))
    .limit(1);

  if (!user) {
    return { ok: false, reason: 'user_missing' };
  }

  // Re-click of a verify link for an already-verified user: treat as success.
  if (user.emailVerified && (record.usedAt || record.expiresAt.getTime() < Date.now())) {
    return { ok: true, userId: record.userId };
  }

  if (record.usedAt) {
    return { ok: false, reason: 'already_used' };
  }

  if (record.expiresAt.getTime() < Date.now()) {
    return { ok: false, reason: 'expired' };
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

/**
 * For authenticated users who claim they already verified — check their
 * DB state and stamp `emailVerified` when there's evidence of a
 * completed verification flow (a used token in the last 72h). Exists so
 * the banner UX has a self-service escape hatch when the client/server
 * JWT cache is out of sync with a successful DB update.
 *
 * Returns `{ verified: true }` when the user is (now) verified.
 */
export async function reconcileUserVerification(userId: string): Promise<{ verified: boolean }> {
  const [user] = await db
    .select({ id: users.id, emailVerified: users.emailVerified })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);

  if (!user) return { verified: false };
  if (user.emailVerified) return { verified: true };

  // Any used token in the last 72h means they went through the flow.
  const cutoff = new Date(Date.now() - 72 * 60 * 60 * 1000);
  const [usedRecent] = await db
    .select({ id: emailVerificationTokens.id })
    .from(emailVerificationTokens)
    .where(
      and(
        eq(emailVerificationTokens.userId, userId),
        isNotNull(emailVerificationTokens.usedAt),
        gte(emailVerificationTokens.usedAt, cutoff)
      )
    )
    .limit(1);

  if (!usedRecent) {
    return { verified: false };
  }

  const now = new Date();
  await db.update(users).set({ emailVerified: now, updatedAt: now }).where(eq(users.id, userId));

  return { verified: true };
}
