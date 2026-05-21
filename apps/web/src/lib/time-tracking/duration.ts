/**
 * Duration helpers for native time-tracking (task #10).
 *
 * These functions are deliberately framework-free so they can be unit-tested in
 * a Node Jest env without pulling in the Next/React runtime. The server routes
 * use {@link computeDurationSeconds} as a defense-in-depth check against the
 * DB's GENERATED column, and {@link parseDuration} powers the `/track 30m`
 * command-palette hook.
 */

/**
 * Strict elapsed-seconds calculation between two Dates.
 *
 * Returns 0 if `end` is before `start` (clock skew / bad input). Throws on NaN
 * dates because callers should validate input before getting here.
 */
export function computeDurationSeconds(start: Date, end: Date): number {
  const s = start.getTime();
  const e = end.getTime();
  if (Number.isNaN(s) || Number.isNaN(e)) {
    throw new RangeError('computeDurationSeconds: invalid Date');
  }
  if (e <= s) return 0;
  return Math.floor((e - s) / 1000);
}

/**
 * Parse a human duration string into seconds.
 *
 * Accepts:
 *   - "30m", "30min", "30 minutes"
 *   - "2h", "2hr", "2 hours"
 *   - "1h30m", "1h 30m", "1.5h"
 *   - "45s"
 *   - bare integer = minutes (matches Toggl/Harvest convention)
 *
 * Returns `null` on unrecognized input. We intentionally don't throw — the
 * command palette will simply show a "couldn't parse" toast.
 */
const PART_RE = /(\d+(?:\.\d+)?)\s*(h(?:ours?|rs?)?|m(?:in(?:utes?)?)?|s(?:ec(?:onds?)?)?)/gi;

export function parseDuration(input: string): number | null {
  if (typeof input !== 'string') return null;
  const trimmed = input.trim().toLowerCase();
  if (!trimmed) return null;
  // Reject any input containing a sign or punctuation we don't recognise so
  // "-5m" / "+30m" don't silently coerce to a positive duration.
  if (/[+-]/.test(trimmed)) return null;

  // Bare number = minutes.
  if (/^\d+(?:\.\d+)?$/.test(trimmed)) {
    const mins = Number(trimmed);
    if (!Number.isFinite(mins) || mins <= 0) return null;
    return Math.round(mins * 60);
  }

  // Strict consumption: every non-whitespace character must belong to a
  // <number><unit> token. This is what makes "1h30mfix" fail to parse
  // (whereas a naive global match would silently accept the leading "1h30m").
  const stripped = trimmed.replace(/\s+/g, '');
  let seconds = 0;
  let matched = false;
  const re = /(\d+(?:\.\d+)?)(h(?:ours?|rs?)?|m(?:in(?:utes?)?)?|s(?:ec(?:onds?)?)?)/gi;
  let consumed = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(stripped)) !== null) {
    if (m.index !== consumed) return null; // gap → reject
    matched = true;
    const value = Number(m[1]);
    if (!Number.isFinite(value) || value < 0) return null;
    const unit = m[2]![0]!.toLowerCase();
    if (unit === 'h') seconds += value * 3600;
    else if (unit === 'm') seconds += value * 60;
    else if (unit === 's') seconds += value;
    consumed = m.index + m[0]!.length;
  }
  if (!matched || consumed !== stripped.length || seconds <= 0) return null;
  return Math.round(seconds);
}

/** Format seconds as a compact label (e.g. "1h 30m", "45m", "12s"). */
export function formatDurationSeconds(totalSeconds: number): string {
  if (!Number.isFinite(totalSeconds) || totalSeconds <= 0) return '0m';
  const total = Math.floor(totalSeconds);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  if (h > 0 && m > 0) return `${h}h ${m}m`;
  if (h > 0) return `${h}h`;
  if (m > 0) return `${m}m`;
  return `${s}s`;
}

/** Convert seconds to fractional hours, rounded to 2 dp (matches numeric(8,2)). */
export function secondsToHours(seconds: number): number {
  if (!Number.isFinite(seconds) || seconds <= 0) return 0;
  return Math.round((seconds / 3600) * 100) / 100;
}
