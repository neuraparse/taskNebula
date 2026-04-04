import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { auth } from '@/auth';
import { createAuditLog, db, eq, organizations } from '@tasknebula/db';
import { hasPermission } from '@/lib/auth/permissions';
import { normalizeWorkspaceCommunicationsSettings } from '@/lib/chat/config';
import { getLivekitStatus } from '@/lib/chat/livekit';
import { isRedisConfigured } from '@/lib/server/redis';

const workspaceCommunicationsSchema = z.object({
  enabled: z.boolean().optional(),
  voiceEnabled: z.boolean().optional(),
  issueThreadsEnabled: z.boolean().optional(),
  documentThreadsEnabled: z.boolean().optional(),
  attachmentsEnabled: z.boolean().optional(),
  unreadTrackingEnabled: z.boolean().optional(),
});

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ organizationId: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { organizationId } = await params;
  const canView = await hasPermission(organizationId, 'org:view');
  if (!canView) {
    return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });
  }

  const [organization] = await db
    .select({ id: organizations.id, settings: organizations.settings, name: organizations.name })
    .from(organizations)
    .where(eq(organizations.id, organizationId))
    .limit(1);

  if (!organization) {
    return NextResponse.json({ error: 'Organization not found' }, { status: 404 });
  }

  return NextResponse.json({
    organizationId: organization.id,
    organizationName: organization.name,
    settings: normalizeWorkspaceCommunicationsSettings(
      (organization.settings as Record<string, unknown> | null)?.communications
    ),
    serviceStatus: {
      redisReady: isRedisConfigured(),
      livekit: getLivekitStatus(),
    },
  });
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ organizationId: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { organizationId } = await params;
  const canManage = await hasPermission(organizationId, 'org:settings');
  if (!canManage) {
    return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });
  }

  try {
    const payload = workspaceCommunicationsSchema.parse(await request.json());
    const [organization] = await db
      .select({ settings: organizations.settings })
      .from(organizations)
      .where(eq(organizations.id, organizationId))
      .limit(1);

    if (!organization) {
      return NextResponse.json({ error: 'Organization not found' }, { status: 404 });
    }

    const current = normalizeWorkspaceCommunicationsSettings(
      (organization.settings as Record<string, unknown> | null)?.communications
    );
    const next = normalizeWorkspaceCommunicationsSettings({
      ...current,
      ...payload,
    });

    await db
      .update(organizations)
      .set({
        settings: {
          ...((organization.settings as Record<string, unknown>) || {}),
          communications: next,
        },
        updatedAt: new Date(),
      })
      .where(eq(organizations.id, organizationId));

    await createAuditLog({
      userId: session.user.id,
      organizationId,
      action: 'organization.updated',
      resourceType: 'organization_communications',
      resourceId: organizationId,
      changes: {
        communications: { from: current, to: next },
      },
    });

    return NextResponse.json({ settings: next });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Validation failed', details: error.errors }, { status: 400 });
    }

    console.error('Failed to update communications settings:', error);
    return NextResponse.json({ error: 'Failed to update communications settings' }, { status: 500 });
  }
}
