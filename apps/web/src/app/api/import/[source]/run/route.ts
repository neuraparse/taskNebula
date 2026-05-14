import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { db, importJobs, organizationMembers, eq, and } from '@tasknebula/db';
import { isImportSource } from '@/lib/importers';
import { executeImportJob } from '@/lib/importers/runner';

export const dynamic = 'force-dynamic';

/**
 * POST /api/import/[source]/run
 *
 * Creates an `import_jobs` row in 'pending' state and kicks off the
 * runner asynchronously. Returns the job id immediately so the UI can
 * start polling `/api/import/jobs/[id]` for progress.
 *
 * Request body:
 *   {
 *     workspaceId: string,    // required
 *     projectId:   string,    // target project for imported issues
 *     mapping:     ImportMapping & adapter-specific config,
 *     csvText?:    string,    // CSV only — raw payload
 *   }
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ source: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { source } = await params;
  if (!isImportSource(source)) {
    return NextResponse.json(
      { error: `Unknown import source: ${source}` },
      { status: 400 }
    );
  }

  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const workspaceId =
    typeof body.workspaceId === 'string' ? body.workspaceId : null;
  const projectId =
    typeof body.projectId === 'string' ? body.projectId : null;
  if (!workspaceId || !projectId) {
    return NextResponse.json(
      { error: 'workspaceId and projectId are required' },
      { status: 400 }
    );
  }

  const [membership] = await db
    .select({ role: organizationMembers.role })
    .from(organizationMembers)
    .where(
      and(
        eq(organizationMembers.userId, session.user.id),
        eq(organizationMembers.organizationId, workspaceId)
      )
    )
    .limit(1);
  if (!membership) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const mapping = {
    ...((body.mapping as Record<string, unknown>) ?? {}),
    projectId,
    // For CSV, stash the raw text inside mapping so the runner can
    // re-parse without a separate object store. For other sources we
    // keep `config` for credentials so the runner can re-fetch.
    csvText: typeof body.csvText === 'string' ? body.csvText : undefined,
  };

  const [job] = await db
    .insert(importJobs)
    .values({
      workspaceId,
      source,
      status: 'pending',
      mapping,
      createdBy: session.user.id,
    })
    .returning();

  if (!job) {
    return NextResponse.json(
      { error: 'Failed to create import job' },
      { status: 500 }
    );
  }

  // Fire-and-forget. When a real queue lands (BullMQ / pg-boss), replace
  // this with an enqueue call.
  const jobId = job.id;
  void executeImportJob(jobId).catch((err) => {
    console.error('[import] runner failed', jobId, err);
  });

  return NextResponse.json({ jobId, status: job.status }, { status: 201 });
}
