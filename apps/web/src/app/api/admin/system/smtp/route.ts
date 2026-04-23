import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { createId } from '@paralleldrive/cuid2';
import { auth } from '@/auth';
import { isSuperAdmin } from '@/lib/auth/permissions';
import { db, systemAuditLogs } from '@tasknebula/db';
import {
  getSmtpConfig,
  sanitizeSmtpConfig,
  upsertSmtpConfig,
} from '@/lib/admin/system-settings';
import { resetEmailTransportCache } from '@/lib/email/sender';

const bodySchema = z.object({
  host: z.string().trim().max(255).default(''),
  port: z
    .union([z.number().int(), z.string()])
    .transform((v) => (typeof v === 'number' ? v : parseInt(v, 10)))
    .refine((v) => Number.isFinite(v) && v >= 1 && v <= 65535, 'port must be 1-65535'),
  secure: z.boolean().default(false),
  user: z.string().trim().max(255).default(''),
  // Optional on update — leaving blank keeps the existing envelope.
  password: z.string().optional(),
  emailFrom: z.string().trim().max(255).default(''),
});

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

export async function GET() {
  const authz = await requireAdmin();
  if ('error' in authz) return authz.error;

  const config = await getSmtpConfig();
  return NextResponse.json({ smtp: sanitizeSmtpConfig(config) });
}

export async function PUT(request: NextRequest) {
  const authz = await requireAdmin();
  if ('error' in authz) return authz.error;

  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? 'Invalid body' },
      { status: 400 }
    );
  }

  const saved = await upsertSmtpConfig(parsed.data, authz.userId);
  resetEmailTransportCache();

  await db.insert(systemAuditLogs).values({
    id: createId(),
    userId: authz.userId,
    action: 'system.smtp_config_updated',
    resourceType: 'system_setting',
    resourceId: 'smtp_config',
    metadata: {
      host: saved.host,
      port: saved.port,
      secure: saved.secure,
      emailFrom: saved.emailFrom,
      passwordRotated: Boolean(parsed.data.password && parsed.data.password.trim()),
    },
  });

  return NextResponse.json({ smtp: sanitizeSmtpConfig(saved) });
}
