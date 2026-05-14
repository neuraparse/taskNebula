/**
 * Pure aggregation helpers for the Time-in-Status analytics
 * (FEAT-23). Kept side-effect-free so it can be unit tested without a
 * database or HTTP layer.
 */

export interface StatusHistoryRow {
  /** The status the issue transitioned out of. Null for the first row. */
  fromStatus: string | null;
  /** The status the issue transitioned into. */
  toStatus: string;
  /** When the transition happened. */
  changedAt: Date;
}

export interface TimeInStatusBucket {
  status: string;
  /** Total seconds the issue spent in this status across all visits. */
  totalDurationSeconds: number;
  /** Most recent time the issue entered this status, or null if it never has. */
  enteredAtLast: Date | null;
  /** Number of times the issue exited this status (closed visits). */
  exitCount: number;
}

/**
 * Aggregate a per-issue history into the buckets returned by
 * `GET /api/issues/[id]/time-in-status`.
 *
 * Algorithm:
 *   - Sort the history by changedAt ascending.
 *   - Walk pairs of consecutive rows. The first row's toStatus is the issue's
 *     initial status; subsequent rows mark exits/entries.
 *   - The "open" interval (current status) is closed against `now`.
 *   - exitCount only increments when the issue leaves the status, so the
 *     currently-occupied status will report exitCount = visits - 1.
 */
export function computeTimeInStatus(
  history: StatusHistoryRow[],
  now: Date = new Date()
): TimeInStatusBucket[] {
  if (history.length === 0) {
    return [];
  }

  const ordered = [...history].sort(
    (a, b) => a.changedAt.getTime() - b.changedAt.getTime()
  );

  const buckets = new Map<string, TimeInStatusBucket>();
  const upsert = (status: string): TimeInStatusBucket => {
    let bucket = buckets.get(status);
    if (!bucket) {
      bucket = {
        status,
        totalDurationSeconds: 0,
        enteredAtLast: null,
        exitCount: 0,
      };
      buckets.set(status, bucket);
    }
    return bucket;
  };

  // The first row's toStatus tells us where the issue first landed.
  const first = ordered[0]!;
  let currentStatus: string = first.toStatus;
  let currentEnteredAt: Date = first.changedAt;
  upsert(currentStatus).enteredAtLast = currentEnteredAt;

  for (let i = 1; i < ordered.length; i++) {
    const row = ordered[i]!;
    const dwellSeconds = Math.max(
      0,
      Math.floor((row.changedAt.getTime() - currentEnteredAt.getTime()) / 1000)
    );
    const exiting = upsert(currentStatus);
    exiting.totalDurationSeconds += dwellSeconds;
    exiting.exitCount += 1;

    currentStatus = row.toStatus;
    currentEnteredAt = row.changedAt;
    const entering = upsert(currentStatus);
    entering.enteredAtLast = currentEnteredAt;
  }

  // Close out the currently-occupied status against `now`.
  const openSeconds = Math.max(
    0,
    Math.floor((now.getTime() - currentEnteredAt.getTime()) / 1000)
  );
  upsert(currentStatus).totalDurationSeconds += openSeconds;

  return Array.from(buckets.values()).sort(
    (a, b) => b.totalDurationSeconds - a.totalDurationSeconds
  );
}
