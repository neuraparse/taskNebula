import type { QueryClient } from '@tanstack/react-query';

/**
 * Single source of truth for how issue mutations and the SSE realtime stream
 * touch the React Query cache. Before this existed, `use-issues`, `use-sprints`
 * and `use-realtime-sync` each hand-rolled their own (subtly different) set of
 * `invalidateQueries` calls, so a new issue could land in one surface but go
 * stale in another until a manual page refresh. Everything that derives from
 * issue data now invalidates through here, so the surfaces never drift.
 */

export interface IssueCacheScope {
  projectId?: string | null;
  sprintId?: string | null;
  issueId?: string | null;
  /** Parent issue id when the mutated issue is a subtask. */
  parentId?: string | null;
}

/**
 * Matches every `['issues', { projectId, ... }]` list cache. When `projectId`
 * is omitted it matches **all** issue lists (used when the affected project is
 * unknown, e.g. a generic invalidation). A list cache keyed only by `['issues']`
 * (no filters object) is treated as project-agnostic and always matches.
 */
export function matchesIssueList(queryKey: readonly unknown[], projectId?: string | null): boolean {
  if (queryKey[0] !== 'issues') return false;
  if (!projectId) return true;
  const filters = queryKey[1] as { projectId?: string } | undefined;
  // A list with no project filter shows cross-project issues, so a new issue in
  // any project should still refresh it.
  if (filters?.projectId == null) return true;
  return filters.projectId === projectId;
}

/**
 * Decide whether an issue with the given `sprintId` belongs in a list cache
 * scoped to `listSprintId`. Mirrors the API's `sprintId` query semantics:
 *   - no sprint filter  → all issues
 *   - `'none'`          → backlog (issues with no sprint)
 *   - a concrete id     → exactly that sprint
 */
export function issueBelongsInSprintList(
  issueSprintId: string | null | undefined,
  listSprintId: string | null | undefined
): boolean {
  if (listSprintId == null) return true;
  if (listSprintId === 'none') return !issueSprintId;
  return issueSprintId === listSprintId;
}

/**
 * Whether an issue should appear in a list cache given that list's full filter
 * set (`['issues', filters]`). Used to decide which list caches an optimistic
 * create should insert into, so the new card never flashes into a list it
 * doesn't belong to. Filters we can't evaluate from an optimistic row (the
 * `status` category filter) cause us to bail out and defer to the refetch.
 */
export function issueMatchesListFilters(
  issue: { assigneeId?: string | null; sprintId?: string | null; type?: string },
  filters: { assigneeId?: string; sprintId?: string; type?: string; status?: string } | undefined
): boolean {
  if (!filters) return true;
  if (!issueBelongsInSprintList(issue.sprintId, filters.sprintId)) return false;
  if (filters.assigneeId && issue.assigneeId !== filters.assigneeId) return false;
  if (filters.type && issue.type !== filters.type) return false;
  // `status` filters on the workflow-status *category*, which an optimistic row
  // can't resolve reliably — skip optimistic insertion for status-scoped lists.
  if (filters.status) return false;
  return true;
}

/**
 * Project-derived query families whose key is `[family, projectId, ...]`.
 *
 * CRITICAL: project boards are routed by the lowercase project **key** (e.g.
 * `/projects/demo/board`), so these caches are keyed by that key
 * (`['sprints', 'demo']`), while the server returns CUIDs. Scoping invalidation
 * by the CUID from a mutation response therefore never matches the key-routed
 * cache — which was the root cause of "new issues don't show until refresh".
 * We invalidate these families by name (any id) instead; only mounted queries
 * actually refetch, so the cost is negligible and correctness is guaranteed
 * regardless of whether the cache was keyed by project key or id.
 */
const PROJECT_FAMILIES = new Set(['sprints', 'project', 'workflow-statuses', 'projects']);

/**
 * Invalidate (and refetch the active ones) every cache that derives from issue
 * data: issue lists, the single-issue + subtask caches, sprint metadata, the
 * project-derived families above, and the cross-cutting home/dashboard widgets.
 * Call from a mutation's `onSettled` and from the SSE consumer so cross-client
 * and same-client paths converge on the same server truth.
 *
 * Issue lists and project families are invalidated *broadly* (never scoped by a
 * project id) on purpose — see PROJECT_FAMILIES. `issueId`/`sprintId` are real
 * CUIDs from the server, so those are matched by exact key.
 */
export function invalidateIssueCaches(queryClient: QueryClient, scope: IssueCacheScope = {}): void {
  const { sprintId, issueId, parentId } = scope;

  // Every issue list, regardless of how its project is keyed (key vs CUID).
  queryClient.invalidateQueries({
    predicate: (query) => matchesIssueList(query.queryKey),
  });

  // Project-derived families, by name (key/CUID-agnostic).
  queryClient.invalidateQueries({
    predicate: (query) =>
      typeof query.queryKey[0] === 'string' && PROJECT_FAMILIES.has(query.queryKey[0] as string),
  });

  // Exact-id caches — these ids are real CUIDs, so exact keys match.
  if (issueId) {
    queryClient.invalidateQueries({ queryKey: ['issue', issueId] });
    queryClient.invalidateQueries({ queryKey: ['subtasks', issueId] });
  }
  if (parentId) {
    queryClient.invalidateQueries({ queryKey: ['subtasks', parentId] });
  }
  if (sprintId) {
    queryClient.invalidateQueries({ queryKey: ['sprint-issues', sprintId] });
    queryClient.invalidateQueries({ queryKey: ['sprint', sprintId] });
  } else {
    // Unknown sprint: refresh every sprint-issue list so a reparented/created
    // issue surfaces wherever it landed.
    queryClient.invalidateQueries({ queryKey: ['sprint-issues'] });
  }

  // Cross-cutting surfaces that render issue data and must look live.
  for (const key of ['my-issues', 'your-work', 'recent-activities'] as const) {
    queryClient.invalidateQueries({ queryKey: [key] });
  }
}
