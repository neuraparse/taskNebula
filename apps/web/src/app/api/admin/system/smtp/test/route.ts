import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { createId } from '@paralleldrive/cuid2';
import { auth } from '@/auth';
import { isSuperAdmin } from '@/lib/auth/permissions';
import { db, systemAuditLogs, users, eq } from '@tasknebula/db';
import { resolveSmtpConfig } from '@/lib/admin/system-settings';

const bodySchema = z
  .object({
    to: z.string().trim().email().optional(),
  })
  .optional();

async function requireAdmin() {
  const session = await auth();
  if (!session?.user?.id) {
    return { error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) } as const;
  }
  const admin = await isSuperAdmin();
  if (!admin) {
    return {
      error: NextResponse.json({ error: 'Super admin access required' }, { status: 403 }),
    } as const;
  }
  return { userId: session.user.id } as const;
}

export async function POST(request: NextRequest) {
  const authz = await requireAdmin();
  if ('error' in authz) return authz.error;

  const parsedBody = bodySchema.safeParse(await request.json().catch(() => ({})));
  const desiredTo = parsedBody.success ? parsedBody.data?.to : undefined;

  // Default to the admin's own email when no explicit recipient given.
  let recipient = desiredTo;
  if (!recipient) {
    const [admin] = await db
      .select({ email: users.email })
      .from(users)
      .where(eq(users.id, authz.userId))
      .limit(1);
    recipient = admin?.email || undefined;
  }

  if (!recipient) {
    return NextResponse.json(
      { success: false, error: 'No recipient email available' },
      { status: 400 }
    );
  }

  const cfg = await resolveSmtpConfig();
  if (!cfg) {
    return NextResponse.json(
      {
        success: false,
        error: 'SMTP is not configured. Save an SMTP config first or set SMTP_HOST in the environment.',
      },
      { status: 400 }
    );
  }

  try {
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
    const transport = nodemailer.default.createTransport(transportOptions);
    const info = await transport.sendMail({
      from: cfg.emailFrom,
      to: recipient,
      subject: 'TaskNebula SMTP test email',
      html: `<p>This is a test email from your TaskNebula admin console.</p>
<p>If you are seeing this, your SMTP configuration is working correctly (<strong>${cfg.source}</strong> source).</p>`,
      text: `TaskNebula SMTP test email — config source: ${cfg.source}. If you received this, your SMTP configuration is working.`,
    });

    await db.insert(systemAuditLogs).values({
      id: createId(),
      userId: authz.userId,
      action: 'system.smtp_test_sent',
      resourceType: 'system_setting',
      resourceId: 'smtp_config',
      metadata: { recipient, source: cfg.source },
    });

    return NextResponse.json({
      success: true,
      source: cfg.source,
      messageId: info.messageId,
      recipient,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    await db.insert(systemAuditLogs).values({
      id: createId(),
      userId: authz.userId,
      action: 'system.smtp_test_failed',
      resourceType: 'system_setting',
      resourceId: 'smtp_config',
      metadata: { recipient, source: cfg.source, error: message },
    });
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
