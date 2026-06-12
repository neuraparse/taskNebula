/**
 * First-class label write-through sync (Jira-parity structural layer, 2026-06).
 *
 * `issues.labels` (jsonb string array) remains the REST contract and the read
 * path for ~100 existing call sites. This module mirrors those names into the
 * new `labels` / `issue_labels` tables so the structural layer stays in step:
 * routes keep writing the jsonb column exactly as before and call
 * `syncIssueLabels` alongside.
 *
 * Names resolve to ORG-WIDE labels (`project_id IS NULL`); missing labels are
 * created on the fly with the schema's default color.
 */
import { db, labels, issueLabels, type Label } from '@tasknebula/db';
import { createId } from '@paralleldrive/cuid2';
import { and, eq, inArray, isNull, notInArray } from 'drizzle-orm';

/** Root drizzle client or a transaction handle — both expose the same builder API. */
type DbExecutor = typeof db | Parameters<Parameters<typeof db.transaction>[0]>[0];

/**
 * Normalize a raw label-name array: trim, drop empties, drop names longer
 * than the `labels.name` varchar(100) limit (legacy jsonb entries are
 * unconstrained), and dedupe while preserving first-seen order.
 */
export function normalizeLabelNames(names: string[]): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const raw of names) {
    const name = raw.trim();
    if (name.length === 0 || name.length > 100) continue;
    if (seen.has(name)) continue;
    seen.add(name);
    result.push(name);
  }
  return result;
}

export interface ResolveLabelsParams {
  organizationId: string;
  names: string[];
  /** Stamped as `created_by` on labels created by this call. */
  createdBy?: string | null;
}

/**
 * Resolve label names to org-wide `labels` rows (project_id IS NULL),
 * creating any that do not exist yet (CUID2 id, default color).
 *
 * Returns rows in the same order as the (normalized) input names.
 */
export async function resolveLabels(
  params: ResolveLabelsParams,
  executor: DbExecutor = db
): Promise<Label[]> {
  const names = normalizeLabelNames(params.names);
  if (names.length === 0) return [];

  const orgWideScope = and(
    eq(labels.organizationId, params.organizationId),
    isNull(labels.projectId)
  );

  const existing = await executor
    .select()
    .from(labels)
    .where(and(orgWideScope, inArray(labels.name, names)));

  const byName = new Map<string, Label>(existing.map((row) => [row.name, row]));
  const missing = names.filter((name) => !byName.has(name));

  if (missing.length > 0) {
    // `.onConflictDoNothing()` guards the COALESCE-expression unique index
    // (label_org_project_name_idx) against concurrent creates of the same name.
    const inserted = await executor
      .insert(labels)
      .values(
        missing.map((name) => ({
          id: createId(),
          organizationId: params.organizationId,
          projectId: null,
          name,
          createdBy: params.createdBy ?? null,
        }))
      )
      .onConflictDoNothing()
      .returning();
    for (const row of inserted) byName.set(row.name, row);

    // Rows skipped by the conflict guard were created concurrently — re-read.
    const stillMissing = missing.filter((name) => !byName.has(name));
    if (stillMissing.length > 0) {
      const reread = await executor
        .select()
        .from(labels)
        .where(and(orgWideScope, inArray(labels.name, stillMissing)));
      for (const row of reread) byName.set(row.name, row);
    }
  }

  return names.map((name) => byName.get(name)).filter((row): row is Label => row !== undefined);
}

export interface SyncIssueLabelsParams {
  organizationId: string;
  issueId: string;
  /** Desired full label set, as the jsonb string array the REST contract uses. */
  labels: string[];
  createdBy?: string | null;
}

/**
 * Replace an issue's `issue_labels` rows so they exactly mirror the given
 * label-name set: resolves each name (creating missing org-wide labels),
 * deletes junction rows for labels no longer present, inserts the new ones
 * (org_id stamped). Runs in a single transaction.
 */
export async function syncIssueLabels(params: SyncIssueLabelsParams): Promise<Label[]> {
  return db.transaction(async (tx) => {
    const resolved = await resolveLabels(
      {
        organizationId: params.organizationId,
        names: params.labels,
        createdBy: params.createdBy ?? null,
      },
      tx
    );
    const labelIds = resolved.map((row) => row.id);

    if (labelIds.length === 0) {
      await tx
        .delete(issueLabels)
        .where(
          and(
            eq(issueLabels.issueId, params.issueId),
            eq(issueLabels.organizationId, params.organizationId)
          )
        );
      return resolved;
    }

    // Delete junction rows for labels that are no longer on the issue.
    await tx
      .delete(issueLabels)
      .where(
        and(
          eq(issueLabels.issueId, params.issueId),
          eq(issueLabels.organizationId, params.organizationId),
          notInArray(issueLabels.labelId, labelIds)
        )
      );

    const existingRows = await tx
      .select({ labelId: issueLabels.labelId })
      .from(issueLabels)
      .where(eq(issueLabels.issueId, params.issueId));
    const existingIds = new Set(existingRows.map((row) => row.labelId));

    const toInsert = labelIds
      .filter((labelId) => !existingIds.has(labelId))
      .map((labelId) => ({
        issueId: params.issueId,
        labelId,
        organizationId: params.organizationId,
      }));

    if (toInsert.length > 0) {
      await tx.insert(issueLabels).values(toInsert).onConflictDoNothing();
    }

    return resolved;
  });
}

/**
 * Best-effort wrapper for write-through call sites: the jsonb column is the
 * contract, so a structural-sync failure must never fail the issue mutation.
 */
export async function syncIssueLabelsBestEffort(params: SyncIssueLabelsParams): Promise<void> {
  try {
    await syncIssueLabels(params);
  } catch (err) {
    console.error('[labels] issue label sync failed', { issueId: params.issueId }, err);
  }
}
