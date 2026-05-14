/**
 * Importer adapter contracts.
 *
 * Every external source (CSV, Linear, Jira, GitHub) implements this small
 * interface so the import runner stays source-agnostic. The flow is:
 *
 *   1. `parseSource(input)` pulls raw rows / issues from the source and
 *      converts them into the `NormalizedRecord` shape (same shape for
 *      every adapter — the lowest common denominator).
 *   2. `mapRecord(rec, mapping)` projects a single normalized record onto
 *      TaskNebula's issue shape, honoring user-chosen column / field
 *      overrides supplied via `mapping`.
 *   3. The runner inserts mapped records into the `issues` table and
 *      updates the `import_jobs` row with progress / errors.
 *
 * `mapping` is intentionally loose — adapters interpret keys they care
 * about (e.g. CSV uses `mapping.columns`, Linear uses `mapping.apiKey`).
 * Anything not understood is ignored.
 */

export type NormalizedRecord = {
  /** Stable identifier from the source (e.g. Linear issue id, CSV row index). */
  key: string;
  title: string;
  description: string | null;
  /** Free-form source status string; mapped to a TaskNebula workflow status downstream. */
  status: string | null;
  /** Source priority string ('high', '1', 'P0'…); normalized by `mapRecord`. */
  priority: string | null;
  labels: string[];
  /** Email is the bridge field for matching to TaskNebula users. */
  assigneeEmail: string | null;
  /** Source key of the parent issue / epic if any (resolved by the runner). */
  parentKey: string | null;
  createdAt: string | null;
  comments: NormalizedComment[];
};

export type NormalizedComment = {
  authorEmail: string | null;
  body: string;
  createdAt: string | null;
};

/**
 * The shape an importer produces for the issue inserter. Intentionally
 * narrower than the full `issues` schema — the runner fills in
 * organization / project / reporter / workflow-status ids based on the
 * job's workspace + the resolved mapping.
 */
export type TaskNebulaIssue = {
  sourceKey: string;
  title: string;
  description: string | null;
  type: 'story' | 'task' | 'bug' | 'epic' | 'subtask';
  status: string | null;
  priority: 'critical' | 'high' | 'medium' | 'low' | 'none';
  labels: string[];
  assigneeEmail: string | null;
  parentSourceKey: string | null;
  createdAt: Date | null;
  comments: Array<{
    authorEmail: string | null;
    body: string;
    createdAt: Date | null;
  }>;
};

/**
 * Column / config mapping supplied by the user. Each adapter consults
 * its own subset of keys (CSV uses `columns`, API adapters use creds).
 */
export type ImportMapping = {
  /** CSV column → NormalizedRecord field. */
  columns?: Partial<Record<keyof NormalizedRecord, string>>;
  /** Optional default issue type when the source doesn't tell us one. */
  defaultType?: TaskNebulaIssue['type'];
  /** Adapter-specific config (api keys, repo, site, etc). */
  config?: Record<string, unknown>;
};

export interface Importer<TInput = unknown> {
  /** Short, lowercase id used in routes and table values. */
  readonly name: 'csv' | 'linear' | 'jira' | 'github';
  /** Human-friendly label for the source picker. */
  readonly label: string;
  /** Inline description for the UI. */
  readonly description: string;

  /**
   * Pull rows from the source. Adapters that hit external APIs should
   * surface only API errors here; per-record validation is left to
   * `mapRecord` so a single bad row doesn't kill the whole import.
   */
  parseSource(input: TInput): Promise<NormalizedRecord[]>;

  /** Project a single normalized record onto TaskNebula's issue shape. */
  mapRecord(rec: NormalizedRecord, mapping: ImportMapping): TaskNebulaIssue;
}

/**
 * Map a free-form priority string from any source onto our enum.
 * Recognized: 'critical' | 'high' | 'medium' | 'low' | 'none'.
 * Numeric priorities ('1'..'5', 'P0'..'P4') are normalized too.
 */
export function normalizePriority(
  value: string | null | undefined
): TaskNebulaIssue['priority'] {
  if (!value) return 'medium';
  const v = String(value).trim().toLowerCase();
  if (
    v === 'critical' ||
    v === 'urgent' ||
    v === '1' ||
    v === 'p0' ||
    v === 'p1'
  ) {
    return 'critical';
  }
  if (v === 'high' || v === '2' || v === 'p2') return 'high';
  if (v === 'medium' || v === 'normal' || v === '3' || v === 'p3') {
    return 'medium';
  }
  if (v === 'low' || v === '4' || v === 'p4') return 'low';
  if (v === 'none' || v === 'no priority' || v === '0') return 'none';
  return 'medium';
}

/**
 * Map a free-form type / kind string onto our enum. Defaults to 'task'
 * because that's the broadest TaskNebula issue type.
 */
export function normalizeType(
  value: string | null | undefined,
  fallback: TaskNebulaIssue['type'] = 'task'
): TaskNebulaIssue['type'] {
  if (!value) return fallback;
  const v = String(value).trim().toLowerCase();
  if (v === 'bug' || v === 'defect') return 'bug';
  if (v === 'story' || v === 'user story') return 'story';
  if (v === 'epic') return 'epic';
  if (v === 'subtask' || v === 'sub-task' || v === 'sub_task') {
    return 'subtask';
  }
  return 'task';
}

/**
 * Safely parse an ISO-ish date string into a Date, returning null on
 * any parse failure. Used by every adapter so bad timestamps don't
 * kill an import.
 */
export function safeParseDate(value: string | null | undefined): Date | null {
  if (!value) return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}
