import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { createId } from '@paralleldrive/cuid2';
import { auth } from '@/auth';
import { isSuperAdmin } from '@/lib/auth/permissions';
import { db, systemAuditLogs } from '@tasknebula/db';
import {
  getLivekitConfigStored,
  sanitizeLivekitConfig,
  upsertLivekitConfig,
} from '@/lib/admin/system-settings';

const bodySchema = z.object({
  url: z.string().trim().max(512).default(''),
  apiKey: z.string().trim().max(255).default(''),
  // Optional on update — leaving blank keeps the existing envelope.
  apiSecret: z.string().optional(),
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

  const config = await getLivekitConfigStored();
  return NextResponse.json({ livekit: sanitizeLivekitConfig(config) });
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

  const saved = await upsertLivekitConfig(parsed.data, authz.userId);

  await db.insert(systemAuditLogs).values({
    id: createId(),
    userId: authz.userId,
    action: 'system.livekit_config_updated',
    resourceType: 'system_setting',
    resourceId: 'livekit_config',
    metadata: {
      url: saved.url,
      apiKey: saved.apiKey,
      secretRotated: Boolean(parsed.data.apiSecret && parsed.data.apiSecret.trim()),
    },
  });

  return NextResponse.json({ livekit: sanitizeLivekitConfig(saved) });
}
