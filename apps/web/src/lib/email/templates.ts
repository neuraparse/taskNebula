/**
 * Shared renderers for bespoke (non-BUILTIN_TEMPLATES) transactional emails.
 *
 * Each helper returns `{ subject, html, text }` so callers can feed the same
 * output into the production `sendEmail()` path and into the admin preview
 * endpoint without duplicating composition logic.
 *
 * Live in `src/lib/email/` (not inside an `api/.../route.ts`) because Next.js
 * App Router forbids exporting arbitrary names from route modules — only the
 * handler methods + a small allowlist of config symbols are permitted.
 */

import { renderShell, paragraph, infoCard, bulletList, chip, textFooter } from '@tasknebula/db';

/**
 * Render the password-reset message (subject/html/text).
 *
 * `ip` is caller-supplied (untrusted) and may be empty; the helper escapes
 * it for safe embedding in HTML.
 */
export function renderPasswordResetMessage(args: {
  resetUrl: string;
  ip?: string;
  requestedAt?: string;
}): { subject: string; html: string; text: string } {
  const { resetUrl } = args;
  const requestedAt = args.requestedAt || new Date().toUTCString();

  const escapeHtml = (s: string) =>
    s
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');

  const hasIp = Boolean(args.ip && args.ip !== 'unknown');
  const displayIp = hasIp ? escapeHtml(args.ip as string) : '';
  const ipLine = displayIp
    ? ` Request origin: <span style="display:inline-block;padding:1px 6px;background:#f3f4f6;border:1px solid #e5e7eb;border-radius:4px;font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;font-size:12px;color:#374151;">${displayIp}</span>.`
    : '';

  const bodyHtml = [
    paragraph(
      `Someone requested a password reset for your TaskNebula account at ${requestedAt}.${ipLine}`
    ),
    infoCard({
      title: "If you didn't request this",
      tone: 'warning',
      body:
        "You can safely ignore this email — your password won't change unless you click the button below. " +
        'If you keep receiving these messages unexpectedly, consider rotating your password from your account settings.',
    }),
    paragraph(
      `If the button doesn't work, paste this URL into your browser:<br/><span style="word-break:break-all;color:#374151;">${resetUrl}</span>`,
      { muted: true, spacingTop: 18 }
    ),
  ].join('\n');

  const html = renderShell({
    kicker: 'SECURITY',
    heading: 'Reset your password',
    subheading: 'A reset link was requested for your TaskNebula account.',
    preheader: "This link expires in 1 hour. If you didn't request this, ignore this email.",
    body: bodyHtml,
    ctaLabel: 'Reset password',
    ctaUrl: resetUrl,
  });

  const text =
    `Reset your TaskNebula password\n\n` +
    `Someone requested a password reset for your TaskNebula account at ${requestedAt}.` +
    (hasIp ? ` Request origin: ${args.ip}.` : '') +
    `\n\nOpen this link to reset your password (expires in 1 hour):\n${resetUrl}\n\n` +
    `If you didn't request this, you can safely ignore this email — your password won't change.` +
    textFooter();

  return { subject: 'Reset your TaskNebula password', html, text };
}

/** Render the org-invitation message (subject/html/text). */
export function renderInvitationMessage(args: {
  inviteeEmail: string;
  inviterName: string;
  orgName: string;
  role: string;
  addedProjectNames: string[];
  signupUrl: string;
  expiresAt?: Date;
  expiresInDays?: number;
}): { subject: string; html: string; text: string } {
  const { inviteeEmail, inviterName, orgName, role, addedProjectNames, signupUrl } = args;
  const expiryText = args.expiresAt
    ? `This invitation expires on ${args.expiresAt.toUTCString()}.`
    : '';

  const projectsSection =
    addedProjectNames.length > 0
      ? infoCard({
          tone: 'info',
          title: "You'll be added to",
          body: addedProjectNames.map((n) => chip(n, { tone: 'brand' })).join(' '),
        })
      : '';

  const emailBody =
    paragraph(
      `<strong>${inviterName}</strong> has invited you to join <strong>${orgName}</strong> on TaskNebula. Accept the invitation to start collaborating on projects, sprints, and issues with your team.`
    ) +
    infoCard({
      tone: 'info',
      title: 'Your role',
      body: `You'll be added as ${chip(role, { tone: 'brand' })}.`,
    }) +
    projectsSection +
    bulletList([
      'Track projects and sprints',
      'Real-time notifications',
      'Integrated chat and calls',
    ]) +
    (expiryText
      ? infoCard({
          tone: 'warning',
          title: 'Invitation expiry',
          body: `${expiryText} Ask your team admin to resend it if the link expires.`,
        })
      : '') +
    paragraph(`Sign up with ${inviteeEmail} to accept.`, {
      muted: true,
      spacingTop: 14,
    });

  const html = renderShell({
    kicker: 'INVITATION',
    heading: `You're invited to ${orgName}`,
    subheading: `${inviterName} wants you on their team.`,
    preheader: 'Join your team on TaskNebula to collaborate on projects, sprints, and issues.',
    body: emailBody,
    ctaLabel: 'Accept invitation',
    ctaUrl: signupUrl,
  });

  const projectsTextLine =
    addedProjectNames.length > 0 ? `You'll be added to: ${addedProjectNames.join(', ')}\n\n` : '';
  const expiryTextLine = expiryText ? `${expiryText}\n\n` : '';

  const text =
    `${inviterName} invited you to ${orgName} on TaskNebula.\n\n` +
    `Role: ${role}\n\n` +
    projectsTextLine +
    expiryTextLine +
    `You'll get:\n- Track projects and sprints\n- Real-time notifications\n- Integrated chat and calls\n\n` +
    `Accept your invitation: ${signupUrl}\n` +
    `Sign up with ${inviteeEmail} to accept.` +
    textFooter();

  return {
    subject: `You've been invited to ${orgName} on TaskNebula`,
    html,
    text,
  };
}
