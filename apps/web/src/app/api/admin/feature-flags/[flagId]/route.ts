import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { db, featureFlags, systemAuditLogs } from '@tasknebula/db';
import { isSuperAdmin } from '@/lib/auth/permissions';
import { eq } from 'drizzle-orm';
import { z } from 'zod';
import { createId } from '@paralleldrive/cuid2';

export const dynamic = 'force-dynamic';

const updateFeatureFlagSchema = z.object({
  key: z.string().min(1).max(255).regex(/^[a-z0-9_-]+$/, 'Key must be lowercase alphanumeric with dashes or underscores').optional(),
  name: z.string().min(1).max(255).optional(),
  description: z.string().optional(),
  isEnabled: z.boolean().optional(),
  enabledForPlans: z.array(z.enum(['free', 'starter', 'growth', 'enterprise'])).optional(),
  enabledForOrganizations: z.array(z.string()).optional(),
  rolloutPercentage: z.number().min(0).max(100).optional(),
  metadata: z.record(z.any()).optional(),
});

// GET /api/admin/feature-flags/[flagId] - Get single feature flag
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ flagId: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Check if user is super admin
    const isSuperAdminUser = await isSuperAdmin();
    if (!isSuperAdminUser) {
      return NextResponse.json({ error: 'Forbidden - Super admin access required' }, { status: 403 });
    }

    const { flagId } = await params;

    const [flag] = await db
      .select()
      .from(featureFlags)
      .where(eq(featureFlags.id, flagId))
      .limit(1);

    if (!flag) {
      return NextResponse.json({ error: 'Feature flag not found' }, { status: 404 });
    }

    return NextResponse.json(flag);
  } catch (error) {
    console.error('Error fetching feature flag:', error);
    return NextResponse.json(
      { error: 'Failed to fetch feature flag' },
      { status: 500 }
    );
  }
}

// PATCH /api/admin/feature-flags/[flagId] - Update feature flag
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ flagId: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Check if user is super admin
    const isSuperAdminUser = await isSuperAdmin();
    if (!isSuperAdminUser) {
      return NextResponse.json({ error: 'Forbidden - Super admin access required' }, { status: 403 });
    }

    const { flagId } = await params;
    const body = await request.json();
    const validatedData = updateFeatureFlagSchema.parse(body);

    // Get old flag for audit log
    const [oldFlag] = await db
      .select()
      .from(featureFlags)
      .where(eq(featureFlags.id, flagId))
      .limit(1);

    if (!oldFlag) {
      return NextResponse.json({ error: 'Feature flag not found' }, { status: 404 });
    }

    // Update feature flag
    const [updatedFlag] = await db
      .update(featureFlags)
      .set({
        ...validatedData,
        updatedBy: session.user.id,
        updatedAt: new Date(),
      })
      .where(eq(featureFlags.id, flagId))
      .returning();

    // Create audit log
    const changes: Record<string, { from: any; to: any }> = {};
    
    if (validatedData.isEnabled !== undefined && validatedData.isEnabled !== oldFlag.isEnabled) {
      changes.isEnabled = { from: oldFlag.isEnabled, to: validatedData.isEnabled };
    }
    if (validatedData.rolloutPercentage !== undefined && validatedData.rolloutPercentage !== oldFlag.rolloutPercentage) {
      changes.rolloutPercentage = { from: oldFlag.rolloutPercentage, to: validatedData.rolloutPercentage };
    }
    if (validatedData.enabledForPlans !== undefined) {
      changes.enabledForPlans = { from: oldFlag.enabledForPlans, to: validatedData.enabledForPlans };
    }

    if (Object.keys(changes).length > 0) {
      await db.insert(systemAuditLogs).values({
        id: createId(),
        userId: session.user.id,
        action: 'feature_flag.update',
        resourceType: 'feature_flag',
        resourceId: flagId,
        changes,
        metadata: { flagKey: oldFlag.key, flagName: oldFlag.name },
        ipAddress: request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || undefined,
        userAgent: request.headers.get('user-agent') || undefined,
      });
    }

    return NextResponse.json(updatedFlag);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid request data', details: error.errors },
        { status: 400 }
      );
    }

    console.error('Error updating feature flag:', error);
    return NextResponse.json(
      { error: 'Failed to update feature flag' },
      { status: 500 }
    );
  }
}

// DELETE /api/admin/feature-flags/[flagId] - Delete feature flag
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ flagId: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Check if user is super admin
    const isSuperAdminUser = await isSuperAdmin();
    if (!isSuperAdminUser) {
      return NextResponse.json({ error: 'Forbidden - Super admin access required' }, { status: 403 });
    }

    const { flagId } = await params;

    // Get flag for audit log
    const [flag] = await db
      .select()
      .from(featureFlags)
      .where(eq(featureFlags.id, flagId))
      .limit(1);

    if (!flag) {
      return NextResponse.json({ error: 'Feature flag not found' }, { status: 404 });
    }

    // Delete feature flag
    await db.delete(featureFlags).where(eq(featureFlags.id, flagId));

    // Create audit log
    await db.insert(systemAuditLogs).values({
      id: createId(),
      userId: session.user.id,
      action: 'feature_flag.delete',
      resourceType: 'feature_flag',
      resourceId: flagId,
      metadata: { flagKey: flag.key, flagName: flag.name },
      ipAddress: request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || undefined,
      userAgent: request.headers.get('user-agent') || undefined,
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting feature flag:', error);
    return NextResponse.json(
      { error: 'Failed to delete feature flag' },
      { status: 500 }
    );
  }
}
