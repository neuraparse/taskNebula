/**
 * STUB: Automation rule evaluator.
 *
 * This file is a placeholder so typecheck passes while the real
 * automation engine is implemented in a parallel agent branch.
 * When that branch merges, it will replace this file with the real
 * implementation that loads rules from the database, evaluates
 * their conditions against the payload, and dispatches actions.
 *
 * Keep the exported signature of `runAutomations` stable; callers
 * in `apps/web/src/app/api/issues/**` rely on this exact shape.
 */

export type AutomationTrigger =
  | 'issue.created'
  | 'issue.updated'
  | 'issue.status_changed'
  | 'issue.assigned'
  | 'issue.deleted';

export interface RunAutomationsArgs {
  trigger: AutomationTrigger;
  organizationId: string;
  projectId: string;
  payload: unknown;
  actorUserId: string;
}

/**
 * No-op stub. The real implementation will:
 *   1. Load enabled automation rules for (organizationId, projectId, trigger).
 *   2. Evaluate each rule's conditions against payload.
 *   3. Dispatch matching actions (assign, transition, notify, webhook, ...).
 *
 * Callers invoke this fire-and-forget; errors must not propagate.
 */
export async function runAutomations(_args: RunAutomationsArgs): Promise<void> {
  // intentionally empty — replaced at merge time
  return;
}
