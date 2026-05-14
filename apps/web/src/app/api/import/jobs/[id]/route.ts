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
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id } = await params;

  const [job] = await db
    .select()
    .from(importJobs)
    .where(eq(importJobs.id, id))
    .limit(1);
  if (!job) {
    return NextResponse.json({ error: 'Import job not found' }, { status: 404 });
  }

  const [membership] = await db
    .select({ role: organizationMembers.role })
    .from(organizationMembers)
    .where(
      and(
        eq(organizationMembers.userId, session.user.id),
        eq(organizationMembers.organizationId, job.workspaceId)
      )
    )
    .limit(1);
  if (!membership) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  // Strip raw payload from mapping so we don't ship CSV text back on every poll.
  const mapping = (job.mapping ?? {}) as Record<string, unknown>;
  const safeMapping: Record<string, unknown> = { ...mapping };
  delete safeMapping.csvText;
  delete safeMapping.preview;

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
