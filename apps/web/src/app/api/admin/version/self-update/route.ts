import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { auth } from '@/auth';
import { isSuperAdmin } from '@/lib/auth/permissions';
import { getUpdateStatus } from '@/lib/version';
import { getSelfUpdateStatus, SelfUpdateError, startSelfUpdate } from '@/lib/version/self-update';

const startSchema = z.object({
  targetVersion: z.string().min(1).max(32),
  confirmedVersion: z.string().min(1).max(32),
  acknowledged: z.boolean(),
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

function getIpAddress(request: NextRequest): string | null {
  const forwarded = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim();
  return forwarded || request.headers.get('x-real-ip') || null;
}

export async function GET() {
  const authz = await requireAdmin();
  if ('error' in authz) return authz.error;

  const status = await getUpdateStatus();
  const selfUpdate = await getSelfUpdateStatus(status);
  return NextResponse.json(selfUpdate);
}

export async function POST(request: NextRequest) {
  const authz = await requireAdmin();
  if ('error' in authz) return authz.error;

  const body = await request.json().catch(() => null);
  const parsed = startSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Invalid self-update request', reason: 'invalid_request' },
      { status: 400 }
    );
  }

  const status = await getUpdateStatus();

  try {
    const selfUpdate = await startSelfUpdate({
      targetVersion: parsed.data.targetVersion,
      confirmedVersion: parsed.data.confirmedVersion,
      acknowledged: parsed.data.acknowledged,
      triggeredBy: authz.userId,
      ipAddress: getIpAddress(request),
      userAgent: request.headers.get('user-agent'),
      status,
    });
    return NextResponse.json(selfUpdate, { status: 202 });
  } catch (err) {
    if (err instanceof SelfUpdateError) {
      return NextResponse.json({ error: err.message, reason: err.reason }, { status: err.status });
    }
    return NextResponse.json(
      { error: 'Failed to start self-update', reason: 'webhook_failed' },
      { status: 502 }
    );
  }
}
