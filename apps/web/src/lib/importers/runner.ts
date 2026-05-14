/**
 * Import job runner.
 *
 * No external queue is wired in TaskNebula yet (no BullMQ / pg-boss), so
 * this module ships a simple in-process runner that:
 *   1. Reads the `import_jobs` row.
 *   2. Re-parses the source using the adapter + stored payload / config.
 *   3. Walks the normalized records, calls `mapRecord`, and inserts an
 *      issue per record.
 *   4. Updates `processed` and `errors` as it goes.
 *
 * When a real queue lands, swap the call site in
 * `app/api/import/[source]/run/route.ts` to enqueue a job that calls
 * `executeImportJob(jobId)` — the function signature is stable.
 *
 * Concurrency: not safe for distributed deployments today (no row lock).
 * That's tracked under the same follow-up as the queue integration.
 */

import {
  db,
  importJobs,
  issues,
  workflowStatuses,
  users,
  projects,
  eq,
  and,
} from '@tasknebula/db';
import type { ImportJobError } from '@tasknebula/db';
import { getImporter } from './index';
import type {
  ImportMapping,
  NormalizedRecord,
  TaskNebulaIssue,
} from './types';

type StoredMapping = ImportMapping & {
  /** Project to import into. Required for the runner. */
  projectId?: string;
  /** Raw CSV payload (only used by the csv adapter to avoid a blob store). */
  csvText?: string;
  /** Live records preview from `/preview` — used to avoid re-fetching. */
  preview?: NormalizedRecord[];
};

/**
 * Apply a single normalized record to TaskNebula's `issues` table.
 *
 * This is intentionally narrower than the full create-issue flow: we
 * bypass workflows / notifications / activity logs to keep imports
 * cheap. A follow-up should run mapped records through the normal
 * issue-create service so webhooks fire consistently.
 */
async function insertIssueRow(args: {
  workspaceId: string;
  projectId: string;
  reporterId: string;
  issue: TaskNebulaIssue;
}): Promise<void> {
  const { workspaceId, projectId, reporterId, issue } = args;

  // Resolve a workflow status: prefer one whose name matches the source
  // status (case-insensitive); fall back to the project's first status.
  const projectStatuses = await db
    .select({ id: workflowStatuses.id, name: workflowStatuses.name })
    .from(workflowStatuses);

  const statusMatch = issue.status
    ? projectStatuses.find(
        (s) => s.name.toLowerCase() === String(issue.status).toLowerCase()
      )
    : undefined;
  const statusId = statusMatch?.id ?? projectStatuses[0]?.id;
  if (!statusId) {
    throw new Error('No workflow statuses defined for this workspace.');
  }

  // Pick the next sequential number for this project.
  const existing = await db
    .select({ number: issues.number })
    .from(issues)
    .where(eq(issues.projectId, projectId));
  const nextNumber =
    existing.reduce((m: number, r: { number: number }) => Math.max(m, r.number), 0) + 1;

  // Project key prefix from the project row.
  const [project] = await db
    .select({ key: projects.key })
    .from(projects)
    .where(eq(projects.id, projectId))
    .limit(1);
  const keyPrefix = project?.key ?? 'TN';

  // Best-effort assignee lookup via email.
  let assigneeId: string | null = null;
  if (issue.assigneeEmail) {
    const [u] = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.email, issue.assigneeEmail))
      .limit(1);
    assigneeId = u?.id ?? null;
  }

  await db.insert(issues).values({
    organizationId: workspaceId,
    projectId,
    key: `${keyPrefix}-${nextNumber}`,
    number: nextNumber,
    type: issue.type,
    title: issue.title.slice(0, 500),
    description: issue.description,
    statusId,
    priority: issue.priority,
    assigneeId,
    reporterId,
    labels: issue.labels,
    createdBy: reporterId,
    updatedBy: reporterId,
    metadata: {
      importedFrom: 'import_job',
      sourceKey: issue.sourceKey,
    },
  });
}

export async function executeImportJob(jobId: string): Promise<void> {
  const [job] = await db
    .select()
    .from(importJobs)
    .where(eq(importJobs.id, jobId))
    .limit(1);
  if (!job) {
    console.warn('[import] job not found, skipping', jobId);
    return;
  }

  const adapter = getImporter(job.source);
  if (!adapter) {
    await db
      .update(importJobs)
      .set({
        status: 'failed',
        errors: [{ message: `Unknown import source: ${job.source}` }],
        finishedAt: new Date(),
      })
      .where(eq(importJobs.id, jobId));
    return;
  }

  await db
    .update(importJobs)
    .set({ status: 'running' })
    .where(eq(importJobs.id, jobId));

  const mapping = (job.mapping ?? {}) as StoredMapping;
  const errors: ImportJobError[] = [];

  let records: NormalizedRecord[];
  try {
    if (mapping.preview && mapping.preview.length > 0) {
      records = mapping.preview;
    } else if (job.source === 'csv' && typeof mapping.csvText === 'string') {
      records = await adapter.parseSource({
        text: mapping.csvText,
        columns: mapping.columns,
      });
    } else {
      // Adapters that hit external APIs need creds passed via mapping.config.
      records = await adapter.parseSource(mapping.config ?? {});
    }
  } catch (err) {
    await db
      .update(importJobs)
      .set({
        status: 'failed',
        errors: [
          { message: err instanceof Error ? err.message : String(err) },
        ],
        finishedAt: new Date(),
      })
      .where(eq(importJobs.id, jobId));
    return;
  }

  await db
    .update(importJobs)
    .set({ total: records.length })
    .where(eq(importJobs.id, jobId));

  if (!mapping.projectId) {
    await db
      .update(importJobs)
      .set({
        status: 'failed',
        errors: [{ message: 'mapping.projectId is required to run an import.' }],
        finishedAt: new Date(),
      })
      .where(eq(importJobs.id, jobId));
    return;
  }

  const reporterId = job.createdBy;
  if (!reporterId) {
    await db
      .update(importJobs)
      .set({
        status: 'failed',
        errors: [{ message: 'Import job has no createdBy user.' }],
        finishedAt: new Date(),
      })
      .where(eq(importJobs.id, jobId));
    return;
  }

  let processed = 0;
  for (const rec of records) {
    try {
      const mapped = adapter.mapRecord(rec, mapping as ImportMapping);
      if (!mapped.title) {
        errors.push({ key: rec.key, message: 'Skipping: missing title.' });
      } else {
        await insertIssueRow({
          workspaceId: job.workspaceId,
          projectId: mapping.projectId,
          reporterId,
          issue: mapped,
        });
      }
    } catch (err) {
      errors.push({
        key: rec.key,
        message: err instanceof Error ? err.message : String(err),
      });
    }
    processed++;
    // Update progress every 10 rows to keep DB chatter low.
    if (processed % 10 === 0) {
      await db
        .update(importJobs)
        .set({ processed, errors })
        .where(eq(importJobs.id, jobId));
    }
  }

  await db
    .update(importJobs)
    .set({
      processed,
      errors,
      status: errors.length === records.length ? 'failed' : 'completed',
      finishedAt: new Date(),
    })
    .where(eq(importJobs.id, jobId));
}

// Silence unused-import warning — `and` is exported for future filter use.
void and;
