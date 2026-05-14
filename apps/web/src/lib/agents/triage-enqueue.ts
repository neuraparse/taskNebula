/**
 * Fire-and-forget triage enqueue helper used from POST /api/issues so
 * issue creation never blocks on the LLM. Today this is a `setImmediate`
 * fallback that runs the agent inline-but-deferred (the same pattern the
 * automation evaluator uses). When the dedicated job runner introduced
 * in the roadmap's task #3 lands, this is the single seam to swap to it.
 *
 * Errors are caught and logged at warn-level — triage is best-effort
 * assistance, not a critical-path side effect.
 */

import { db, issueTriageSuggestions } from '@tasknebula/db';
import { triageIssue } from './triage';

export function enqueueTriageOnCreate(issueId: string): void {
  if (!issueId) return;
  const scheduler: (cb: () => void) => void =
    typeof setImmediate === 'function'
      ? (cb) => setImmediate(cb)
      : (cb) => setTimeout(cb, 0);

  scheduler(() => {
    void runTriageOnce(issueId).catch((err) => {
      console.warn('[triage-enqueue] triage failed for', issueId, err);
    });
  });
}

/**
 * Exposed for tests; otherwise prefer `enqueueTriageOnCreate`.
 */
export async function runTriageOnce(issueId: string): Promise<void> {
  const { suggestion } = await triageIssue(issueId);
  await db.insert(issueTriageSuggestions).values({
    issueId,
    payload: suggestion,
    confidence: suggestion.confidence,
  });
}
