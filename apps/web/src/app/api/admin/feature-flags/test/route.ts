import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { db, featureFlags, organizations } from '@tasknebula/db';
import { isSuperAdmin } from '@/lib/auth/permissions';
import { eq } from 'drizzle-orm';
import { isFeatureEnabled } from '@/lib/feature-flags';

export const dynamic = 'force-dynamic';

/**
 * GET /api/admin/feature-flags/test?key=FOO&organizationId=BAR
 *
 * Development-only live evaluation of a feature flag. Runs the same codepath as
 * `isFeatureEnabled()` so admins can sanity-check rollout percentages, plan
 * gating, and per-org overrides without a server restart.
 *
 * Response: { enabled: boolean, source: 'db' | 'cache' | 'default' }
 */
export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const isAdmin = await isSuperAdmin();
    if (!isAdmin) {
      return NextResponse.json(
        { error: 'Forbidden - Super admin access required' },
        { status: 403 }
      );
    }

    const { searchParams } = new URL(request.url);
    const key = searchParams.get('key');
    const organizationIdParam = searchParams.get('organizationId');

    if (!key) {
      return NextResponse.json({ error: 'Missing required query param: key' }, { status: 400 });
    }

    // Load the flag directly so we can report `source: 'default'` when it does
    // not exist (i.e. isFeatureEnabled would short-circuit to false).
    const [flag] = await db.select().from(featureFlags).where(eq(featureFlags.key, key)).limit(1);

    if (!flag) {
      return NextResponse.json({
        enabled: false,
        source: 'default' as const,
        reason: 'Flag not found in DB; isFeatureEnabled() returns false.',
      });
    }

    // Pick an org to evaluate against. Prefer explicit param, else first active org.
    let organizationId = organizationIdParam ?? undefined;
    if (!organizationId) {
      const [anyOrg] = await db.select({ id: organizations.id }).from(organizations).limit(1);
      organizationId = anyOrg?.id;
    }

    if (!organizationId) {
      return NextResponse.json({
        enabled: false,
        source: 'db' as const,
        reason: 'No organization available to evaluate against.',
        flag: {
          key: flag.key,
          isEnabled: flag.isEnabled,
          rolloutPercentage: flag.rolloutPercentage,
          enabledForPlans: flag.enabledForPlans,
          enabledForOrganizations: flag.enabledForOrganizations,
        },
      });
    }

    const enabled = await isFeatureEnabled(key, organizationId);

    return NextResponse.json({
      enabled,
      source: 'db' as const,
      organizationId,
      flag: {
        key: flag.key,
        isEnabled: flag.isEnabled,
        rolloutPercentage: flag.rolloutPercentage,
        enabledForPlans: flag.enabledForPlans,
        enabledForOrganizations: flag.enabledForOrganizations,
      },
    });
  } catch (error) {
    console.error('Error evaluating feature flag:', error);
    return NextResponse.json({ error: 'Failed to evaluate feature flag' }, { status: 500 });
  }
}
