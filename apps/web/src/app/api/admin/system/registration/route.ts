import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { createId } from '@paralleldrive/cuid2';
import { auth } from '@/auth';
import { isSuperAdmin } from '@/lib/auth/permissions';
import { db, systemAuditLogs } from '@tasknebula/db';
import {
  getRegistrationPolicy,
  REGISTRATION_MODES,
  REGISTRATION_POLICY_KEY,
  upsertRegistrationPolicy,
} from '@/lib/auth/registration-policy';

const bodySchema = z.object({
  mode: z.enum(REGISTRATION_MODES),
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

  const policy = await getRegistrationPolicy();
  return NextResponse.json({ registration: policy });
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

  const previous = await getRegistrationPolicy();
  const next = await upsertRegistrationPolicy(parsed.data.mode, authz.userId);

  await db.insert(systemAuditLogs).values({
    id: createId(),
    userId: authz.userId,
    action: 'system.registration_policy_updated',
    resourceType: 'system_setting',
    resourceId: REGISTRATION_POLICY_KEY,
    changes: {
      mode: { from: previous.mode, to: next.mode },
    },
  });

  return NextResponse.json({ registration: next });
}
