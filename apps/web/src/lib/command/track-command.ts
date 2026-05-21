/**
 * `/track 30m` command-palette hook (task #10).
 *
 * Full cmd-k wiring belongs to task #25; this module exposes only the parser +
 * the side-effect (POST to the time-entry endpoint) so that whoever wires
 * cmd-k can call `handleTrackCommand` from inside their existing command
 * dispatcher. Keeping the imperative work here makes it trivial to unit-test
 * without spinning up the React tree.
 */

import { parseDuration } from '@/lib/time-tracking/duration';

export interface TrackCommandResult {
  ok: boolean;
  /** Seconds logged, when successful. */
  seconds?: number;
  /** Human-readable error / explanation when not ok. */
  message?: string;
}

export interface TrackCommandContext {
  /** Issue to log against. Caller resolves this from the open detail view. */
  issueId: string | null | undefined;
  /** Optional override for tests. Defaults to the global `fetch`. */
  fetcher?: typeof fetch;
}

/**
 * Parse a raw command string like `/track 30m fixed flaky test` (or `track 1h`)
 * and POST a time entry. Returns a structured result so the dispatcher can
 * toast the user.
 *
 * The grammar is intentionally forgiving — we look for the first parseable
 * duration token and treat the remainder as the description.
 */
export async function handleTrackCommand(
  input: string,
  ctx: TrackCommandContext
): Promise<TrackCommandResult> {
  if (!ctx.issueId) {
    return { ok: false, message: 'Open an issue to log time against.' };
  }

  // Strip the optional leading slash and the literal "track" keyword.
  // The keyword may be followed by whitespace OR end-of-string ("/track" with
  // no args at all should hit the usage branch, not the parser branch).
  const cleaned = input
    .trim()
    .replace(/^\/?track(\s+|$)/i, '')
    .trim();
  if (!cleaned) {
    return {
      ok: false,
      message: 'Usage: /track <duration> [note]. e.g. /track 30m bugfix',
    };
  }

  // Walk tokens until we hit one that parses as a duration; treat the rest
  // as the description.
  const tokens = cleaned.split(/\s+/);
  let durationSeconds: number | null = null;
  let descriptionStart = -1;
  // We greedy-extend the duration so "1h 30m fix" still works.
  const durationTokens: string[] = [];
  for (let i = 0; i < tokens.length; i++) {
    const trial = [...durationTokens, tokens[i]!].join('');
    const parsed = parseDuration(trial);
    if (parsed) {
      durationSeconds = parsed;
      durationTokens.push(tokens[i]!);
    } else if (durationSeconds !== null) {
      descriptionStart = i;
      break;
    } else {
      // First token wasn't a duration — bail.
      break;
    }
  }

  if (!durationSeconds) {
    return {
      ok: false,
      message: `Couldn't parse a duration from "${cleaned}". Try "30m" or "1h 15m".`,
    };
  }

  const description = descriptionStart >= 0 ? tokens.slice(descriptionStart).join(' ') : undefined;

  const fetcher = ctx.fetcher ?? fetch;
  try {
    const res = await fetcher(`/api/issues/${ctx.issueId}/time-entries`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ durationSeconds, description }),
    });
    if (!res.ok) {
      const detail = await res.text().catch(() => '');
      return {
        ok: false,
        message: `Server rejected log (${res.status}): ${detail.slice(0, 120)}`,
      };
    }
    return { ok: true, seconds: durationSeconds };
  } catch (err: any) {
    return { ok: false, message: err?.message ?? 'Network error' };
  }
}
