/**
 * Shared nodemailer helper.
 *
 * Reads SMTP settings from environment variables (same pattern as the org
 * invite route). The transporter is built lazily so importing this module
 * never forces a `nodemailer` require at module-load time. When `SMTP_HOST`
 * is unset we silently no-op — useful for local dev and CI.
 *
 * Env vars: SMTP_HOST, SMTP_PORT, SMTP_SECURE, SMTP_USER, SMTP_PASSWORD,
 * EMAIL_FROM.
 */

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

let cachedTransport: Transport | null = null;

async function getTransport(): Promise<Transport | null> {
  if (!process.env.SMTP_HOST) return null;
  if (cachedTransport) return cachedTransport;

  const nodemailer = await import('nodemailer');
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const transportOptions: Record<string, any> = {
    host: process.env.SMTP_HOST,
    port: parseInt(process.env.SMTP_PORT || '25', 10),
    secure: process.env.SMTP_SECURE === 'true',
    tls: { rejectUnauthorized: false },
  };

  if (process.env.SMTP_USER && process.env.SMTP_PASSWORD) {
    transportOptions.auth = {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASSWORD,
    };
  }

  cachedTransport = nodemailer.default.createTransport(transportOptions) as Transport;
  return cachedTransport;
}

/**
 * Send a raw email. Returns `{ sent: false, skipped: true }` when SMTP is
 * unconfigured so callers can treat "no email server" as a soft success.
 */
export async function sendEmail(params: SendEmailParams): Promise<SendEmailResult> {
  try {
    const transport = await getTransport();
    if (!transport) {
      return { sent: false, skipped: true };
    }

    const info = await transport.sendMail({
      from: process.env.EMAIL_FROM || 'TaskNebula <noreply@localhost>',
      to: params.to,
      subject: params.subject,
      html: params.html,
      text: params.text,
    });

    return { sent: true, messageId: info.messageId };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error('[email/sender] failed to send email:', message);
    return { sent: false, error: message };
  }
}
