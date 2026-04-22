import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { createId } from '@paralleldrive/cuid2';
import { auth } from '@/auth';
import { isSuperAdmin } from '@/lib/auth/permissions';
import { db, systemAuditLogs } from '@tasknebula/db';
import {
  getStorageConfig,
  sanitizeStorageConfig,
  upsertStorageConfig,
} from '@/lib/admin/system-settings';

const bodySchema = z.object({
  uploadsDir: z.string().trim().max(512).default(''),
  s3Bucket: z.string().trim().max(255).default(''),
  s3Region: z.string().trim().max(64).default(''),
  s3AccessKey: z.string().trim().max(255).default(''),
  s3SecretKey: z.string().optional(),
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

  const config = await getStorageConfig();
  return NextResponse.json({ storage: sanitizeStorageConfig(config) });
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

  const saved = await upsertStorageConfig(parsed.data, authz.userId);

  await db.insert(systemAuditLogs).values({
    id: createId(),
    userId: authz.userId,
    action: 'system.storage_config_updated',
    resourceType: 'system_setting',
    resourceId: 'storage_config',
    metadata: {
      uploadsDir: saved.uploadsDir,
      s3Bucket: saved.s3Bucket,
      s3Region: saved.s3Region,
      secretRotated: Boolean(parsed.data.s3SecretKey && parsed.data.s3SecretKey.trim()),
    },
  });

  return NextResponse.json({ storage: sanitizeStorageConfig(saved) });
}
