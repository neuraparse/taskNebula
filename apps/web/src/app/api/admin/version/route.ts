import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { isSuperAdmin } from '@/lib/auth/permissions';
import { getUpdateStatus } from '@/lib/version';
import { getSelfUpdateStatus } from '@/lib/version/self-update';
import { getVersionUpdatePreferences } from '@/lib/version/preferences';

/**
 * GET /api/admin/version — super-admin-only update status.
 *
 * Response: {
 *   current: string,            // running version (from the build)
 *   latest: string | null,      // latest known GitHub/Docker Hub semver, null when unknown
 *   releaseUpdateAvailable: boolean,
 *   updateAvailable: boolean,
 *   releaseUrl: string | null,
 *   publishedAt: string | null, // ISO timestamp from GitHub
 *   notes: string | null,       // release body, first 2000 chars
 *   checkedAt: string | null,   // ISO timestamp of the last upstream fetch
 *   image: object,              // Docker Hub tag metadata for neuraparse/tasknebula
 *   checkDisabled: boolean,     // TASKNEBULA_DISABLE_UPDATE_CHECK=true
 *   updatePreferences: object,  // DB-backed banner/inbox notification settings
 *   selfUpdate: object          // opt-in external-updater capability/status
 * }
 *
 * `?refresh=true` forces a fetch past the 6h cache TTL. Upstream failures
 * never surface as errors — the last cached state (or nulls) is returned.
 */

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

export async function GET(request: NextRequest) {
  const authz = await requireAdmin();
  if ('error' in authz) return authz.error;

  const refresh = request.nextUrl.searchParams.get('refresh') === 'true';
  const status = await getUpdateStatus({ refresh });
  const selfUpdate = await getSelfUpdateStatus(status);
  const updatePreferences = await getVersionUpdatePreferences();

  return NextResponse.json({ ...status, updatePreferences, selfUpdate });
}
