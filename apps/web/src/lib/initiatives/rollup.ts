/**
 * Initiative roll-up calculator.
 *
 * Used by /api/initiatives/[id]/roll-up and the tree view's progress bars.
 *
 * Strategy: count every issue across every project linked to the initiative
 * (directly OR via a descendant sub-initiative). Percent complete = done /
 * total. "Done" is determined by the workflow status category — Postgres
 * already has a `workflow_status_category` enum with a `'done'` member, so
 * we trust that signal rather than re-deriving it per status.
 *
 * The function is pure so it can be exercised in jest unit tests with
 * synthetic data — see depth-and-rollup.test.ts.
 */

export interface IssueBucket {
  /** Number of issues whose status category is `done`. */
  done: number;
  /** Total number of issues (any status). */
  total: number;
}

export interface ProjectIssueCounts extends IssueBucket {
  projectId: string;
}

export interface RollUpInput {
  /** Issue counts for every project that participates in the roll-up. */
  projects: ProjectIssueCounts[];
}

export interface RollUpResult {
  done: number;
  total: number;
  /** 0..100, integer-rounded. Returns 0 when there are no issues. */
  percent: number;
  /** Number of distinct projects considered. */
  projectCount: number;
}

export function rollUpProgress(input: RollUpInput): RollUpResult {
  let done = 0;
  let total = 0;

  for (const project of input.projects) {
    done += project.done;
    total += project.total;
  }

  const percent = total === 0 ? 0 : Math.round((done / total) * 100);

  return {
    done,
    total,
    percent,
    projectCount: input.projects.length,
  };
}

/**
 * Collect every descendant initiative id reachable from `rootId` (inclusive).
 * Used to gather "all projects rolling up into this initiative tree".
 */
export function collectInitiativeAndDescendants(
  rootId: string,
  childrenByParent: Map<string | null, string[]>
): string[] {
  const result: string[] = [];
  const queue: string[] = [rootId];
  const visited = new Set<string>();

  while (queue.length > 0) {
    const next = queue.shift();
    if (!next || visited.has(next)) continue;
    visited.add(next);
    result.push(next);

    const children = childrenByParent.get(next) ?? [];
    for (const childId of children) {
      if (!visited.has(childId)) queue.push(childId);
    }
  }

  return result;
}
