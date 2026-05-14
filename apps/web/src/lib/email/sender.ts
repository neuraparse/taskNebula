/**
 * Shared nodemailer helper.
 *
 * Resolution order:
 *   1. DB-stored SMTP config (Admin → System → SMTP)
 *   2. Environment variables (SMTP_HOST, SMTP_PORT, SMTP_SECURE,
 *      SMTP_USER, SMTP_PASSWORD, EMAIL_FROM)
 *
 * When neither layer is configured we silently no-op so local/CI runs
 * behave like a "soft success" (useful so invite/signup flows don't fail
 * just because SMTP isn't wired up).
 */

import { resolveSmtpConfig, type ResolvedSmtpConfig } from '@/lib/admin/system-settings';

export interface SendEmailParams {
  to: string;
  subject: string;
  html: string;
  text?: string;
}

export interface SendEmailResult {
  sent: boolean;
  messageId?: string;
  skipped?: boolean;
  error?: string;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Transport = { sendMail: (opts: any) => Promise<{ messageId?: string }> };

type CachedTransport = {
  transport: Transport;
  signature: string;
  emailFrom: string;
};

let cachedTransport: CachedTransport | null = null;

function signatureFor(cfg: ResolvedSmtpConfig) {
  return [
    cfg.source,
    cfg.host,
    cfg.port,
    cfg.secure ? '1' : '0',
    cfg.user,
    // hash-like shortener — avoids holding the raw password in memory as a
    // cache key. Length + last4 is enough to detect rotation.
    `${cfg.password.length}:${cfg.password.slice(-4)}`,
  ].join('|');
}

async function buildTransport(cfg: ResolvedSmtpConfig): Promise<Transport> {
  const nodemailer = await import('nodemailer');
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const transportOptions: Record<string, any> = {
    host: cfg.host,
    port: cfg.port,
    secure: cfg.secure,
    tls: { rejectUnauthorized: false },
  };

  if (cfg.user && cfg.password) {
    transportOptions.auth = { user: cfg.user, pass: cfg.password };
  }

  return nodemailer.default.createTransport(transportOptions) as Transport;
}

async function getTransport(): Promise<{ transport: Transport; emailFrom: string } | null> {
  const cfg = await resolveSmtpConfig();
  if (!cfg) return null;

  const signature = signatureFor(cfg);
  if (cachedTransport && cachedTransport.signature === signature) {
    return { transport: cachedTransport.transport, emailFrom: cachedTransport.emailFrom };
  }

  const transport = await buildTransport(cfg);
  cachedTransport = { transport, signature, emailFrom: cfg.emailFrom };
  return { transport, emailFrom: cfg.emailFrom };
}

/**
 * Send a raw email. Returns `{ sent: false, skipped: true }` when SMTP is
 * unconfigured so callers can treat "no email server" as a soft success.
 */
export async function sendEmail(params: SendEmailParams): Promise<SendEmailResult> {
  try {
    const resolved = await getTransport();
    if (!resolved) {
      return { sent: false, skipped: true };
    }

    const info = await resolved.transport.sendMail({
      from: resolved.emailFrom,
      to: params.to,
      subject: params.subject,
      html: params.html,
      text: params.text,
    });

    // QUAL-21: under exactOptionalPropertyTypes, `messageId?: string` cannot
    // accept `string | undefined`. nodemailer types `messageId` as optional,
    // so spread it only when present.
    return {
      sent: true,
      ...(info.messageId !== undefined ? { messageId: info.messageId } : {}),
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error('[email/sender] failed to send email:', message);
    return { sent: false, error: message };
  }
}

/**
 * Reset the cached transporter — useful after an admin rotates the SMTP
 * password so the next send picks up fresh credentials without a server
 * restart.
 */
export function resetEmailTransportCache() {
  cachedTransport = null;
}
