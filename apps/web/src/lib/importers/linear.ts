/**
 * Linear importer adapter (STUB — real API call wired, enriched data TODO).
 *
 * Accepts a Linear personal API key + optional team key. Calls the Linear
 * GraphQL endpoint at https://api.linear.app/graphql with a minimal `issues`
 * query and converts the response to NormalizedRecord.
 *
 * Why a stub: TaskNebula doesn't ship `@linear/sdk` (extra ~200KB and a peer
 * tree we don't need yet), so we hit GraphQL directly. The minimal query
 * already brings back enough to populate the issue table; enriched data —
 * cycles, projects, sub-issue trees, attachments, reactions — are marked
 * TODO and should be wired before this adapter graduates from stub.
 *
 * Auth note: Linear personal API keys are passed as the `Authorization`
 * header VALUE (no `Bearer` prefix) per Linear's docs.
 *   https://developers.linear.app/docs/graphql/working-with-the-graphql-api/api-keys
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
import { fetchWithBackoff } from './fetch-with-backoff';

export type LinearInput = {
  apiKey: string;
  /** Optional Linear team key (e.g. 'ENG'). When set, scopes the query. */
  teamKey?: string;
  /** Page size — Linear caps at 250. */
  first?: number;
};

export const LINEAR_GRAPHQL_URL = 'https://api.linear.app/graphql';

/**
 * GraphQL query — kept minimal on purpose. TODO before non-stub:
 *  - paginate (`pageInfo.hasNextPage` + `endCursor`)
 *  - fetch `cycle { name, number }`
 *  - fetch `project { name }`
 *  - fetch `attachments`, `comments(first:50)`, `subscribers`
 *  - fetch `parent { identifier }` to rebuild epic / sub-issue tree
 */
const LINEAR_ISSUES_QUERY = `
  query Issues($first: Int!, $after: String, $filter: IssueFilter) {
    issues(first: $first, after: $after, filter: $filter) {
      nodes {
        id
        identifier
        title
        description
        priority
        priorityLabel
        createdAt
        state { name }
        assignee { email }
        labels(first: 25) { nodes { name } }
        parent { identifier }
      }
      pageInfo { hasNextPage endCursor }
    }
  }
`;

const LINEAR_PAGE_SIZE = 50;
// Hard cap so a runaway Linear workspace can't blow up RAM or eat the
// import job's time budget. 10 000 issues = ~5 minutes at 50/page over
// a healthy connection, which matches our cron retry window.
const LINEAR_MAX_PAGES = 200;

type LinearIssueNode = {
  id: string;
  identifier: string;
  title: string;
  description?: string | null;
  priority?: number | null;
  priorityLabel?: string | null;
  createdAt?: string | null;
  state?: { name?: string | null } | null;
  assignee?: { email?: string | null } | null;
  labels?: { nodes?: Array<{ name: string }> } | null;
  parent?: { identifier?: string | null } | null;
};

/**
 * Issue Linear's `priority` is a 0-4 enum: 0 = no priority, 1 = urgent,
 * 2 = high, 3 = medium, 4 = low. Match that onto our enum.
 */
function mapLinearPriority(p: number | null | undefined): string {
  switch (p) {
    case 1:
      return 'critical';
    case 2:
      return 'high';
    case 3:
      return 'medium';
    case 4:
      return 'low';
    default:
      return 'none';
  }
}

export const linearImporter: Importer<LinearInput> = {
  name: 'linear',
  label: 'Linear',
  description:
    'Connect with a Linear personal API key. Imports issues with basic metadata. Cycles, projects, and attachments are not yet supported.',

  async parseSource(input) {
    if (!input.apiKey) {
      throw new Error('A Linear personal API key is required.');
    }

    const filter = input.teamKey ? { team: { key: { eq: input.teamKey } } } : undefined;

    // Walk `pageInfo.hasNextPage` instead of capping at the first 50
    // results. Each request goes through `fetchWithBackoff` so transient
    // 429 / 5xx responses don't kill the entire import job.
    const nodes: LinearIssueNode[] = [];
    let cursor: string | undefined;
    let pages = 0;
    while (pages < LINEAR_MAX_PAGES) {
      const response = await fetchWithBackoff(LINEAR_GRAPHQL_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: input.apiKey,
        },
        body: JSON.stringify({
          query: LINEAR_ISSUES_QUERY,
          variables: { first: input.first ?? LINEAR_PAGE_SIZE, after: cursor, filter },
        }),
      });

      if (!response.ok) {
        const text = await response.text().catch(() => '');
        throw new Error(`Linear API error (${response.status}): ${text}`);
      }

      const payload = (await response.json()) as {
        data?: {
          issues?: {
            nodes?: LinearIssueNode[];
            pageInfo?: { hasNextPage?: boolean; endCursor?: string | null };
          };
        };
        errors?: Array<{ message: string }>;
      };
      if (payload.errors?.length) {
        const first = payload.errors[0]?.message ?? 'unknown';
        throw new Error(`Linear GraphQL error: ${first}`);
      }
      const page = payload.data?.issues;
      const pageNodes = page?.nodes ?? [];
      nodes.push(...pageNodes);
      pages += 1;
      if (!page?.pageInfo?.hasNextPage || !page.pageInfo.endCursor) break;
      cursor = page.pageInfo.endCursor;
    }

    return nodes.map(
      (n): NormalizedRecord => ({
        key: n.identifier,
        title: n.title,
        description: n.description ?? null,
        status: n.state?.name ?? null,
        priority: mapLinearPriority(n.priority),
        labels: n.labels?.nodes?.map((l) => l.name) ?? [],
        assigneeEmail: n.assignee?.email ?? null,
        parentKey: n.parent?.identifier ?? null,
        createdAt: n.createdAt ?? null,
        // TODO(stub): fetch issue comments via `comments(first:50)`.
        comments: [],
      })
    );
  },

  mapRecord(rec, mapping: ImportMapping): TaskNebulaIssue {
    return {
      sourceKey: rec.key,
      title: rec.title || '(untitled)',
      description: rec.description,
      type: normalizeType(null, mapping.defaultType ?? 'task'),
      status: rec.status,
      priority: normalizePriority(rec.priority),
      labels: rec.labels,
      assigneeEmail: rec.assigneeEmail,
      parentSourceKey: rec.parentKey,
      createdAt: safeParseDate(rec.createdAt),
      comments: [],
    };
  },
};
