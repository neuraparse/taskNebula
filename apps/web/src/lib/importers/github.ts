/**
 * GitHub Issues importer adapter (STUB — REST call wired, milestones / PRs TODO).
 *
 * Uses the OAuth token persisted by the existing GitHub integration
 * (see apps/web/src/lib/integrations/github.ts) — callers pass in the
 * decrypted bearer token and a `{owner, repo}` pair.
 *
 * Calls `GET /repos/{owner}/{repo}/issues?state=all` which is the canonical
 * "all issues" endpoint. Note: GitHub Issues includes pull requests in the
 * same payload — we filter those out via `pull_request` presence.
 *
 *   https://docs.github.com/en/rest/issues/issues#list-repository-issues
 *
 * Why a stub: a full GitHub migration also wants comments, reactions, the
 * milestone → sprint mapping, project (V2) boards, and reaction counts.
 * Those are marked TODO below. We bring back the basic issue payload here
 * so the runner can produce real TaskNebula issues for testing.
 */

import {
  Importer,
  ImportMapping,
  NormalizedRecord,
  TaskNebulaIssue,
  normalizePriority,
  normalizeType,
  safeParseDate,
} from './types';

export type GithubInput = {
  /** OAuth access token (decrypted) for the GitHub integration. */
  accessToken: string;
  owner: string;
  repo: string;
  /** Max issues per page. GitHub caps at 100. */
  perPage?: number;
};

type GithubIssueRaw = {
  number: number;
  title: string;
  body: string | null;
  state: 'open' | 'closed';
  labels: Array<string | { name?: string }>;
  assignee: { login?: string; email?: string } | null;
  milestone: { title?: string } | null;
  created_at: string;
  pull_request?: unknown;
  user?: { login?: string } | null;
};

export const githubImporter: Importer<GithubInput> = {
  name: 'github',
  label: 'GitHub Issues',
  description:
    'Import issues from a GitHub repository using the connected OAuth token. PRs, milestones, and reactions are not yet supported.',

  async parseSource(input) {
    if (!input.accessToken) {
      throw new Error('A GitHub access token is required.');
    }
    if (!input.owner || !input.repo) {
      throw new Error('owner and repo are required.');
    }

    const url = new URL(
      `https://api.github.com/repos/${encodeURIComponent(
        input.owner
      )}/${encodeURIComponent(input.repo)}/issues`
    );
    url.searchParams.set('state', 'all');
    url.searchParams.set('per_page', String(input.perPage ?? 50));

    const response = await fetch(url, {
      headers: {
        Authorization: `Bearer ${input.accessToken}`,
        Accept: 'application/vnd.github+json',
        'X-GitHub-Api-Version': '2022-11-28',
        'User-Agent': 'TaskNebula-Importer',
      },
    });

    if (!response.ok) {
      const text = await response.text().catch(() => '');
      throw new Error(`GitHub API error (${response.status}): ${text}`);
    }

    const issues = (await response.json()) as GithubIssueRaw[];

    return issues
      // PRs surface on the issues endpoint — skip them.
      .filter((i) => !i.pull_request)
      .map((i): NormalizedRecord => {
        const labels = (i.labels ?? [])
          .map((l) =>
            typeof l === 'string' ? l : typeof l?.name === 'string' ? l.name : ''
          )
          .filter(Boolean);

        return {
          key: `#${i.number}`,
          title: i.title,
          description: i.body,
          status: i.state, // 'open' | 'closed'
          // GitHub doesn't ship a priority field — labels like 'P0' / 'high'
          // get caught by `normalizePriority` if user maps that column.
          // TODO(stub): scan labels for explicit priority markers.
          priority: null,
          labels,
          assigneeEmail: i.assignee?.email ?? null,
          parentKey: null,
          createdAt: i.created_at,
          // TODO(stub): fetch /repos/{o}/{r}/issues/{n}/comments per issue.
          comments: [],
        };
      });
  },

  mapRecord(rec, mapping: ImportMapping): TaskNebulaIssue {
    // Map GitHub state → a coarse TaskNebula priority bucket only if the
    // user wired up a priority column in their mapping; otherwise medium.
    return {
      sourceKey: rec.key,
      title: rec.title || '(untitled)',
      description: rec.description,
      type: normalizeType(null, mapping.defaultType ?? 'task'),
      status: rec.status, // 'open' / 'closed' — runner resolves to workflow status.
      priority: normalizePriority(rec.priority),
      labels: rec.labels,
      assigneeEmail: rec.assigneeEmail,
      parentSourceKey: rec.parentKey,
      createdAt: safeParseDate(rec.createdAt),
      comments: [],
    };
  },
};
