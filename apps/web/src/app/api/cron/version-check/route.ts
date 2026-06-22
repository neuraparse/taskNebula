import { NextRequest, NextResponse } from 'next/server';
import { requireCronAuth } from '@/lib/agents/cron-auth';
import { getUpdateStatus } from '@/lib/version';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

/**
 * POST /api/cron/version-check
 *
 * Forces the upstream GitHub/Docker Hub update check and lets the shared
 * version module notify super admins when a newer release/image is detected.
 * This is the polling fallback for environments that cannot expose the Docker
 * Hub webhook endpoint.
 */
export async function POST(request: NextRequest) {
  const denied = requireCronAuth(request);
  if (denied) return denied;

  const status = await getUpdateStatus({ refresh: true });
  return NextResponse.json({
    ok: true,
    current: status.current,
    latest: status.latest,
    updateAvailable: status.updateAvailable,
    releaseUpdateAvailable: status.releaseUpdateAvailable,
    imageUpdateAvailable: status.image.updateAvailable,
    imageTag: status.image.latestTag,
    checkedAt: status.checkedAt,
  });
}
