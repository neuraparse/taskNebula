import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { auth } from '@/auth';
import { isSuperAdmin } from '@/lib/auth/permissions';
import {
  getVersionUpdatePreferences,
  updateVersionUpdatePreferences,
} from '@/lib/version/preferences';

const preferencesSchema = z
  .object({
    bannerEnabled: z.boolean().optional(),
    availableUpdateNotificationsEnabled: z.boolean().optional(),
    postUpdateNotificationsEnabled: z.boolean().optional(),
  })
  .refine((value) => Object.keys(value).length > 0, { message: 'empty' });

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

  return NextResponse.json(await getVersionUpdatePreferences());
}

export async function PATCH(request: NextRequest) {
  const authz = await requireAdmin();
  if ('error' in authz) return authz.error;

  const body = await request.json().catch(() => null);
  const parsed = preferencesSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Invalid update preferences', reason: 'invalid_request' },
      { status: 400 }
    );
  }

  const preferences = await updateVersionUpdatePreferences(parsed.data, authz.userId);
  return NextResponse.json(preferences);
}
