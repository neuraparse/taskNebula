/**
 * Jira importer adapter (STUB — REST call wired, sprints / attachments TODO).
 *
 * Accepts an Atlassian site (e.g. `acme.atlassian.net`), the requesting
 * user's email, and an API token created at
 *   https://id.atlassian.com/manage-profile/security/api-tokens
 *
 * Calls `GET /rest/api/3/search` with HTTP Basic auth (email + api-token),
 * which is the supported way to read Jira Cloud REST as a user.
 *
 * Why a stub: a full Jira migration also needs sprints, attachments, link
 * graph, custom fields, and JQL pagination. We bring back the bare issue
 * payload here and mark TODOs for the missing pieces. The Jira OAuth flow
 * already wired under `apps/web/src/lib/integrations/jira.ts` is the
 * preferred path when an org has the connector set up — this stub is for
 * one-shot personal imports via API token.
 *
 *   https://developer.atlassian.com/cloud/jira/platform/rest/v3/api-group-issue-search/#api-rest-api-3-search-get
 */

import { fetchWithBackoff } from './fetch-with-backoff';
import {
  Importer,
  ImportMapping,
  NormalizedRecord,
  TaskNebulaIssue,
  normalizePriority,
  normalizeType,
  safeParseDate,
} from './types';

export type JiraInput = {
  /** e.g. 'acme.atlassian.net' — no scheme. */
  site: string;
  /** Atlassian account email — used for HTTP Basic auth. */
  email: string;
  /** Personal API token. */
  apiToken: string;
  /** Optional JQL. Defaults to a permissive recently-updated query. */
  jql?: string;
  /** Page size (Jira's default cap is 100). */
  maxResults?: number;
};

type JiraIssueRaw = {
  id: string;
  key: string;
  fields?: {
    summary?: string | null;
    description?: unknown;
    issuetype?: { name?: string | null } | null;
    status?: { name?: string | null } | null;
    priority?: { name?: string | null } | null;
    labels?: string[] | null;
    assignee?: { emailAddress?: string | null } | null;
    parent?: { key?: string | null } | null;
    created?: string | null;
  };
};

/**
 * Jira REST returns description as Atlassian Document Format (ADF). For
 * import purposes we collapse to a best-effort plain text — full ADF →
 * TipTap conversion lives in a follow-up.
 */
function adfToText(adf: unknown): string | null {
  if (!adf) return null;
  if (typeof adf === 'string') return adf;
  // Crude walk: concatenate text leaves.
  const out: string[] = [];
  const walk = (node: unknown) => {
    if (!node || typeof node !== 'object') return;
    const n = node as { text?: string; content?: unknown[] };
    if (typeof n.text === 'string') out.push(n.text);
    if (Array.isArray(n.content)) n.content.forEach(walk);
  };
  walk(adf);
  return out.join(' ').trim() || null;
}

export const jiraImporter: Importer<JiraInput> = {
  name: 'jira',
  label: 'Jira',
  description:
    'Connect with an Atlassian email + API token. Imports issues and basic fields. Sprints, attachments, and custom fields are not yet supported.',

  async parseSource(input) {
    if (!input.site || !input.email || !input.apiToken) {
      throw new Error('site, email, and apiToken are all required to import from Jira.');
    }

    const base = input.site.replace(/^https?:\/\//, '').replace(/\/$/, '');
    const url = new URL(`https://${base}/rest/api/3/search`);
    url.searchParams.set('jql', input.jql ?? 'updated >= -90d ORDER BY updated DESC');
    url.searchParams.set('maxResults', String(input.maxResults ?? 50));
    url.searchParams.set(
      'fields',
      'summary,description,issuetype,status,priority,labels,assignee,parent,created'
    );

    const auth = Buffer.from(`${input.email}:${input.apiToken}`).toString('base64');
    const response = await fetchWithBackoff(url, {
      headers: {
        Authorization: `Basic ${auth}`,
        Accept: 'application/json',
      },
    });

    if (!response.ok) {
      const text = await response.text().catch(() => '');
      throw new Error(`Jira API error (${response.status}): ${text}`);
    }

    const payload = (await response.json()) as { issues?: JiraIssueRaw[] };
    const issues = payload.issues ?? [];

    return issues.map(
      (j): NormalizedRecord => ({
        key: j.key,
        title: j.fields?.summary ?? '',
        description: adfToText(j.fields?.description),
        status: j.fields?.status?.name ?? null,
        priority: j.fields?.priority?.name ?? null,
        labels: j.fields?.labels ?? [],
        assigneeEmail: j.fields?.assignee?.emailAddress ?? null,
        parentKey: j.fields?.parent?.key ?? null,
        createdAt: j.fields?.created ?? null,
        // TODO(stub): also fetch /rest/api/3/issue/{key}/comment for comments.
        comments: [],
      })
    );
  },

  mapRecord(rec, mapping: ImportMapping): TaskNebulaIssue {
    return {
      sourceKey: rec.key,
      title: rec.title || '(untitled)',
      description: rec.description,
      // TODO(stub): pass through Jira issuetype.name once we expose it.
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
