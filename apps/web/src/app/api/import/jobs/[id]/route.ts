import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { db, importJobs, organizationMembers, eq, and } from '@tasknebula/db';

export const dynamic = 'force-dynamic';

/**
 * GET /api/import/jobs/[id]
 *
 * Returns the import-job status, progress counters, and any per-record
 * errors. Scoped to the calling user's organization membership so jobs
 * are not leaked across workspaces.
 *
 * Response shape:
 *   {
 *     id, workspaceId, source, status, total, processed, errors[],
 *     createdAt, finishedAt
 *   }
 */
export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id } = await params;

  const [job] = await db.select().from(importJobs).where(eq(importJobs.id, id)).limit(1);
  if (!job) {
    return NextResponse.json({ error: 'Import job not found' }, { status: 404 });
  }

  const [membership] = await db
    .select({ role: organizationMembers.role })
    .from(organizationMembers)
    .where(
      and(
        eq(organizationMembers.userId, session.user.id),
        eq(organizationMembers.organizationId, job.workspaceId),
        eq(organizationMembers.status, 'active')
      )
    )
    .limit(1);
  if (!membership) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  // Strip raw payload AND upstream API credentials from mapping so we don't
  // ship CSV text back on every poll, and so Linear/Jira/GitHub access
  // tokens stored alongside the field-mapping config never leak to the UI
  // (or to anyone who can read the response body — caching proxies, logs,
  // browser devtools). The credential keys below match what the runner
  // adapters write under `mapping.config` for each upstream.
  const mapping = (job.mapping ?? {}) as Record<string, unknown>;
  const safeMapping: Record<string, unknown> = { ...mapping };
  delete safeMapping.csvText;
  delete safeMapping.preview;
  if (safeMapping.config && typeof safeMapping.config === 'object') {
    const cfg = { ...(safeMapping.config as Record<string, unknown>) };
    for (const k of [
      'apiKey',
      'apiToken',
      'accessToken',
      'refreshToken',
      'clientSecret',
      'password',
      'authorization',
    ]) {
      if (k in cfg) cfg[k] = '***';
    }
    safeMapping.config = cfg;
  }

  return NextResponse.json({
    id: job.id,
    workspaceId: job.workspaceId,
    source: job.source,
    status: job.status,
    total: job.total,
    processed: job.processed,
    errors: job.errors,
    mapping: safeMapping,
    createdAt: job.createdAt,
    finishedAt: job.finishedAt,
  });
}
