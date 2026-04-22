/**
 * Automation rule evaluator.
 *
 * NOTE: This file is a stub. The real implementation is being authored in
 * parallel by another agent and will be merged in. The signature below must
 * stay in sync with the production evaluator so callers (API routes firing
 * automation triggers) type-check cleanly.
 *
 * Callers should use fire-and-forget semantics:
 *   void runAutomations({ ... }).catch((err) => console.error(...));
 */

export type AutomationTrigger =
  | 'sprint.planned'
  | 'sprint.started'
  | 'sprint.completed'
  | 'project.created'
  | 'project.updated'
  | 'project.archived';

export interface RunAutomationsArgs {
  trigger: AutomationTrigger;
  organizationId: string;
  projectId: string;
  payload: Record<string, unknown>;
  actorUserId: string;
}

export async function runAutomations(_args: RunAutomationsArgs): Promise<void> {
  // Stub: intentionally a no-op. Real evaluator will be merged separately.
  return;
}
