import { NextResponse } from 'next/server';
import { createId } from '@paralleldrive/cuid2';
import { AccessToken } from 'livekit-server-sdk';
import { auth } from '@/auth';
import { isSuperAdmin } from '@/lib/auth/permissions';
import { db, systemAuditLogs } from '@tasknebula/db';
import { resolveLivekitConfig } from '@/lib/admin/system-settings';

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

export async function POST() {
  const authz = await requireAdmin();
  if ('error' in authz) return authz.error;

  const cfg = await resolveLivekitConfig();
  if (!cfg) {
    return NextResponse.json(
      {
        success: false,
        error:
          'LiveKit is not configured. Save a LiveKit config first or set LIVEKIT_URL / LIVEKIT_API_KEY / LIVEKIT_API_SECRET in the environment.',
      },
      { status: 400 }
    );
  }

  try {
    const testRoomName = `tn-admin-test-${createId()}`;
    const token = new AccessToken(cfg.apiKey, cfg.apiSecret, {
      identity: `admin-test-${authz.userId}`,
      name: 'Admin test',
    });
    token.addGrant({
      room: testRoomName,
      roomJoin: true,
      canPublish: false,
      canSubscribe: true,
    });
    const jwt = await token.toJwt();

    await db.insert(systemAuditLogs).values({
      id: createId(),
      userId: authz.userId,
      action: 'system.livekit_test_ok',
      resourceType: 'system_setting',
      resourceId: 'livekit_config',
      metadata: { source: cfg.source, roomName: testRoomName },
    });

    return NextResponse.json({
      success: true,
      source: cfg.source,
      url: cfg.url,
      roomName: testRoomName,
      tokenPreview: jwt.slice(0, 20) + '…',
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    await db.insert(systemAuditLogs).values({
      id: createId(),
      userId: authz.userId,
      action: 'system.livekit_test_failed',
      resourceType: 'system_setting',
      resourceId: 'livekit_config',
      metadata: { source: cfg.source, error: message },
    });
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
