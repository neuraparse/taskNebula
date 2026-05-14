/**
 * Cycle (sprint) auto-rollover (FEAT-23).
 *
 * When a cycle's end_date has passed, any non-Done issues attached to it are
 * moved into the next planned/active cycle of the same project. Each move
 * also writes an `issue_status_history` row with reason `cycle_rollover` so
 * the time-in-status aggregator can attribute the change correctly.
 *
 * This module exposes two surfaces:
 *   - `selectIssuesToRollover(...)` is pure and unit-testable.
 *   - `rolloverCycle(...)` performs the database mutations.
 */

import { and, asc, eq, inArray, gt, lt, isNull, or, sql } from 'drizzle-orm';
import {
  db,
  sprints,
  issues,
  issueStatusHistory,
  workflowStatuses,
} from '@tasknebula/db';

export interface RolloverCandidateIssue {
  id: string;
  statusId: string;
  statusCategory: string;
}

export interface SelectInput {
  cycleEndDate: Date;
  now: Date;
  enableAutoRollover: boolean;
  rolledOverAt: Date | null;
  issuesInCycle: RolloverCandidateIssue[];
}

export interface SelectionResult {
  shouldRollover: boolean;
  issuesToMove: RolloverCandidateIssue[];
  reason?: string;
}

/**
 * Decide whether a cycle should auto-rollover and which of its issues should
 * migrate to the next cycle. Mixed open/closed inputs are filtered so that
 * issues already in the `done` category remain attached for historical
 * reporting on the completed cycle.
 */
export function selectIssuesToRollover(input: SelectInput): SelectionResult {
  if (!input.enableAutoRollover) {
    return { shouldRollover: false, issuesToMove: [], reason: 'rollover_disabled' };
  }
  if (input.cycleEndDate > input.now) {
    return { shouldRollover: false, issuesToMove: [], reason: 'cycle_not_ended' };
  }
  // Idempotency: don't double-roll a cycle that we already handled. We use
  // strict > because a follow-up manual trigger should still be able to run
  // after explicitly clearing rolledOverAt.
  if (input.rolledOverAt && input.rolledOverAt >= input.cycleEndDate) {
    return { shouldRollover: false, issuesToMove: [], reason: 'already_rolled_over' };
  }

  const open = input.issuesInCycle.filter(
    (i) => i.statusCategory !== 'done' && i.statusCategory !== 'cancelled'
  );

  return { shouldRollover: true, issuesToMove: open };
}

export interface RolloverOutcome {
  movedIssueIds: string[];
  nextCycleId: string | null;
  reason?: string;
}

/**
 * Perform the rollover for a single cycle. Safe to call repeatedly — the
 * `rolled_over_at` column guards against duplicates.
 *
 * @param cycleId         Source cycle to drain.
 * @param actorUserId     User credited for the move in history rows. Use a
 *                        system user id for the cron path.
 * @param manualOverride  When true (manual trigger), the function ignores the
 *                        `enable_auto_rollover` flag but still respects the
 *                        date check.
 */
export async function rolloverCycle(
  cycleId: string,
  actorUserId: string,
  manualOverride = false
): Promise<RolloverOutcome> {
  const now = new Date();

  const [cycle] = await db
    .select()
    .from(sprints)
    .where(eq(sprints.id, cycleId))
    .limit(1);

  if (!cycle) {
    return { movedIssueIds: [], nextCycleId: null, reason: 'cycle_not_found' };
  }

  // Hydrate the issues + their workflow status category.
  const cycleIssues = await db
    .select({
      id: issues.id,
      statusId: issues.statusId,
      statusCategory: workflowStatuses.category,
    })
    .from(issues)
    .leftJoin(workflowStatuses, eq(issues.statusId, workflowStatuses.id))
    .where(eq(issues.sprintId, cycleId));

  const selection = selectIssuesToRollover({
    cycleEndDate: cycle.endDate,
    now,
    enableAutoRollover: manualOverride ? true : cycle.enableAutoRollover,
    rolledOverAt: cycle.rolledOverAt ?? null,
    issuesInCycle: cycleIssues.map((row) => ({
      id: row.id,
      statusId: row.statusId,
      statusCategory: (row.statusCategory ?? 'in_progress') as string,
    })),
  });

  if (!selection.shouldRollover) {
    return {
      movedIssueIds: [],
      nextCycleId: null,
      reason: selection.reason,
    };
  }

  // Find the next cycle in the same project: prefer the soonest planned cycle
  // whose start_date is >= this cycle's end_date; fall back to any active
  // cycle if one exists.
  const [nextCycle] = await db
    .select({ id: sprints.id })
    .from(sprints)
    .where(
      and(
        eq(sprints.projectId, cycle.projectId),
        // Use lt(id, ...) to exclude the source cycle — id is text but the
        // join below also filters by start date so we add an explicit guard.
        sql`${sprints.id} <> ${cycle.id}`,
        or(
          and(eq(sprints.status, 'planned'), gt(sprints.startDate, cycle.endDate)),
          eq(sprints.status, 'active')
        )!
      )
    )
    .orderBy(asc(sprints.startDate))
    .limit(1);

  // Always mark the source cycle as rolled over even if there's no next cycle,
  // so we don't keep re-checking it. The issues simply stay where they are.
  if (!nextCycle) {
    await db
      .update(sprints)
      .set({ rolledOverAt: now, updatedAt: now, updatedBy: actorUserId })
      .where(eq(sprints.id, cycleId));
    return {
      movedIssueIds: [],
      nextCycleId: null,
      reason: 'no_next_cycle',
    };
  }

  const issueIds = selection.issuesToMove.map((i) => i.id);
  if (issueIds.length > 0) {
    await db
      .update(issues)
      .set({ sprintId: nextCycle.id, updatedAt: now, updatedBy: actorUserId })
      .where(inArray(issues.id, issueIds));

    // History rows: same status on both sides (we only moved cycles, not
    // status), but reason marks the cause so the time-in-status aggregator
    // can attribute it to the rollover instead of a user transition.
    await db.insert(issueStatusHistory).values(
      selection.issuesToMove.map((issue) => ({
        issueId: issue.id,
        fromStatus: issue.statusId,
        toStatus: issue.statusId,
        changedByUserId: actorUserId,
        changedAt: now,
        reason: 'cycle_rollover',
      }))
    );
  }

  await db
    .update(sprints)
    .set({ rolledOverAt: now, updatedAt: now, updatedBy: actorUserId })
    .where(eq(sprints.id, cycleId));

  return { movedIssueIds: issueIds, nextCycleId: nextCycle.id };
}

/**
 * Find every cycle whose end_date has elapsed and whose rolled_over_at is
 * either null or older than its end_date, and process them. Designed to run
 * from a cron worker or a first-request-of-day check.
 */
export async function rolloverAllOverdueCycles(
  actorUserId: string
): Promise<{ processed: number; totalMoved: number }> {
  const now = new Date();
  const overdue = await db
    .select({ id: sprints.id })
    .from(sprints)
    .where(
      and(
        eq(sprints.enableAutoRollover, true),
        lt(sprints.endDate, now),
        or(
          isNull(sprints.rolledOverAt),
          lt(sprints.rolledOverAt, sprints.endDate)
        )!
      )
    );

  let totalMoved = 0;
  for (const row of overdue) {
    const result = await rolloverCycle(row.id, actorUserId);
    totalMoved += result.movedIssueIds.length;
  }

  return { processed: overdue.length, totalMoved };
}
