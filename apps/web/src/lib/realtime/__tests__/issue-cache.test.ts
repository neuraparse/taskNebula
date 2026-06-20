import { QueryClient } from '@tanstack/react-query';
import {
  matchesIssueList,
  issueBelongsInSprintList,
  issueMatchesListFilters,
  invalidateIssueCaches,
} from '../issue-cache';

describe('matchesIssueList', () => {
  it('matches a project-scoped issue list for the same project', () => {
    expect(matchesIssueList(['issues', { projectId: 'p1' }], 'p1')).toBe(true);
  });

  it('does not match a list scoped to a different project', () => {
    expect(matchesIssueList(['issues', { projectId: 'p2' }], 'p1')).toBe(false);
  });

  it('matches every issue list when no project is given', () => {
    expect(matchesIssueList(['issues', { projectId: 'p2' }], undefined)).toBe(true);
    expect(matchesIssueList(['issues', { projectId: 'p2' }], null)).toBe(true);
  });

  it('matches a project-agnostic list (no filters / no projectId) for any project', () => {
    expect(matchesIssueList(['issues'], 'p1')).toBe(true);
    expect(matchesIssueList(['issues', undefined], 'p1')).toBe(true);
    expect(matchesIssueList(['issues', { assigneeId: 'u1' }], 'p1')).toBe(true);
  });

  it('ignores non-issue query keys', () => {
    expect(matchesIssueList(['issue', 'x'], 'p1')).toBe(false);
    expect(matchesIssueList(['sprints', 'p1'], 'p1')).toBe(false);
    expect(matchesIssueList(['my-issues'], 'p1')).toBe(false);
  });
});

describe('issueBelongsInSprintList', () => {
  it('an "all issues" list (no sprint filter) accepts any issue', () => {
    expect(issueBelongsInSprintList('s1', undefined)).toBe(true);
    expect(issueBelongsInSprintList(null, undefined)).toBe(true);
  });

  it('the backlog list ("none") accepts only sprint-less issues', () => {
    expect(issueBelongsInSprintList(null, 'none')).toBe(true);
    expect(issueBelongsInSprintList(undefined, 'none')).toBe(true);
    expect(issueBelongsInSprintList('s1', 'none')).toBe(false);
  });

  it('a sprint-scoped list accepts only issues in that sprint', () => {
    expect(issueBelongsInSprintList('s1', 's1')).toBe(true);
    expect(issueBelongsInSprintList('s2', 's1')).toBe(false);
    expect(issueBelongsInSprintList(null, 's1')).toBe(false);
  });
});

describe('issueMatchesListFilters', () => {
  const issue = { assigneeId: 'u1', sprintId: 's1', type: 'task' };

  it('matches an unfiltered list', () => {
    expect(issueMatchesListFilters(issue, undefined)).toBe(true);
    expect(issueMatchesListFilters(issue, {})).toBe(true);
  });

  it('respects the assignee filter', () => {
    expect(issueMatchesListFilters(issue, { assigneeId: 'u1' })).toBe(true);
    expect(issueMatchesListFilters(issue, { assigneeId: 'u2' })).toBe(false);
  });

  it('respects the type filter', () => {
    expect(issueMatchesListFilters(issue, { type: 'task' })).toBe(true);
    expect(issueMatchesListFilters(issue, { type: 'bug' })).toBe(false);
  });

  it('respects the sprint filter', () => {
    expect(issueMatchesListFilters(issue, { sprintId: 's1' })).toBe(true);
    expect(issueMatchesListFilters({ ...issue, sprintId: null }, { sprintId: 'none' })).toBe(true);
    expect(issueMatchesListFilters(issue, { sprintId: 'none' })).toBe(false);
  });

  it('bails out (no optimistic insert) for status-category-scoped lists', () => {
    expect(issueMatchesListFilters(issue, { status: 'open' })).toBe(false);
  });
});

describe('invalidateIssueCaches', () => {
  // Behaviour-based: seed real caches, invalidate, then assert which became
  // stale. This proves the key/CUID-agnostic invalidation (the root-cause fix):
  // a board keyed by the project *key* AND a widget keyed by the *CUID* must
  // BOTH be invalidated by a mutation whose response only knows the CUID.
  function seed() {
    const queryClient = new QueryClient();
    const keys: Array<readonly unknown[]> = [
      ['issues', { projectId: 'demo' }], // board, keyed by project KEY
      ['issues', { projectId: 'proj_cuid' }], // widget, keyed by CUID
      ['issues', { projectId: 'demo', sprintId: 's1' }],
      ['sprints', 'demo'],
      ['project', 'demo'],
      ['workflow-statuses', 'demo'],
      ['projects'],
      ['my-issues', 'u1'],
      ['your-work', 'u1', 'org1'],
      ['recent-activities'],
      ['issue', 'i1'],
      ['sprint-issues', 's1'],
      ['sprint', 's1'],
      ['comments', 'i1'], // control — must NOT be invalidated
    ];
    for (const key of keys) queryClient.setQueryData(key, []);
    const isStale = (key: readonly unknown[]) =>
      queryClient.getQueryState(key)?.isInvalidated === true;
    return { queryClient, isStale };
  }

  it('invalidates every issue-derived cache regardless of project key vs CUID', () => {
    const { queryClient, isStale } = seed();

    invalidateIssueCaches(queryClient, { sprintId: 's1', issueId: 'i1' });

    // Both the key-routed board and the CUID-keyed widget are refreshed.
    expect(isStale(['issues', { projectId: 'demo' }])).toBe(true);
    expect(isStale(['issues', { projectId: 'proj_cuid' }])).toBe(true);
    expect(isStale(['issues', { projectId: 'demo', sprintId: 's1' }])).toBe(true);
    // Project-derived families (key-routed) refresh too.
    expect(isStale(['sprints', 'demo'])).toBe(true);
    expect(isStale(['project', 'demo'])).toBe(true);
    expect(isStale(['workflow-statuses', 'demo'])).toBe(true);
    expect(isStale(['projects'])).toBe(true);
    // Cross-cutting + exact-id caches.
    expect(isStale(['my-issues', 'u1'])).toBe(true);
    expect(isStale(['your-work', 'u1', 'org1'])).toBe(true);
    expect(isStale(['recent-activities'])).toBe(true);
    expect(isStale(['issue', 'i1'])).toBe(true);
    expect(isStale(['sprint-issues', 's1'])).toBe(true);
    expect(isStale(['sprint', 's1'])).toBe(true);
    // Unrelated cache is untouched.
    expect(isStale(['comments', 'i1'])).toBe(false);
  });

  it('still refreshes lists/sprints when no scope ids are provided', () => {
    const { queryClient, isStale } = seed();

    invalidateIssueCaches(queryClient, {});

    expect(isStale(['issues', { projectId: 'demo' }])).toBe(true);
    expect(isStale(['sprint-issues', 's1'])).toBe(true);
    expect(isStale(['sprints', 'demo'])).toBe(true);
    expect(isStale(['workflow-statuses', 'demo'])).toBe(true);
    expect(isStale(['my-issues', 'u1'])).toBe(true);
    expect(isStale(['comments', 'i1'])).toBe(false);
  });
});
