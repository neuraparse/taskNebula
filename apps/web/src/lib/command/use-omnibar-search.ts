'use client';

import * as React from 'react';

import type { Facet } from './facets';

export type OmnibarTab = 'all' | 'issues' | 'docs' | 'people' | 'ask';

export interface OmnibarResult {
  id: string;
  title: string;
  badge?: string | undefined;
  meta?: string | undefined;
  subtitle?: string | undefined;
  type: 'issue' | 'doc' | 'person' | 'ai';
  href?: string | undefined;
}

interface UseOmnibarSearchOptions {
  query: string;
  tab: OmnibarTab;
  organizationId: string | null;
  facets?: readonly Facet[];
  /** Debounce window in ms. Defaults to 120 to match the design brief. */
  debounceMs?: number;
}

interface UseOmnibarSearchResult {
  results: OmnibarResult[];
  loading: boolean;
  error: string | null;
}

interface SearchEnvelope {
  results?: Array<{
    id: string;
    /** Hybrid rows may be comments — issueId points at the parent issue. */
    issueId?: string | null;
    entityType?: 'issue' | 'comment';
    title?: string;
    key?: string | null;
    description?: string | null;
    snippet?: string | null;
    status?: string | null;
    priority?: string | null;
    type?: string | null;
  }>;
}

interface DocsEnvelope {
  results?: Array<{
    id: string;
    title: string;
    slug?: string;
    icon?: string | null;
    excerpt?: string | null;
    spaceId: string;
    spaceName?: string | null;
  }>;
}

interface MembersEnvelope {
  members?: Array<{
    id: string;
    name?: string | null;
    email?: string | null;
    role?: string | null;
    memberStatus?: string | null;
  }>;
}

const SEARCH_ENDPOINT = '/api/search';
const HYBRID_ENDPOINT = '/api/search/hybrid';
const RESULT_LIMIT = 20;
const ALL_ISSUE_LIMIT = 12;
const ALL_SECONDARY_LIMIT = 6;

function cleanText(value: string | null | undefined): string | undefined {
  const cleaned = value
    ?.replace(/<[^>]*>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  return cleaned || undefined;
}

function appendPayloadValue(
  payload: Record<string, string | string[]>,
  key: string,
  value: string
) {
  const trimmed = value.trim();
  if (!trimmed) return;
  const current = payload[key];
  if (!current) {
    payload[key] = trimmed;
  } else if (Array.isArray(current)) {
    payload[key] = [...current, trimmed];
  } else {
    payload[key] = [current, trimmed];
  }
}

function buildFacetPayload(
  facets: readonly Facet[] | undefined
): Record<string, string | string[]> {
  const payload: Record<string, string | string[]> = {};
  for (const facet of facets ?? []) {
    if (facet.key === 'status') appendPayloadValue(payload, 'status', facet.value);
    if (facet.key === 'assignee') appendPayloadValue(payload, 'assignee', facet.value);
    if (facet.key === 'project') appendPayloadValue(payload, 'project', facet.value);
    if (facet.key === 'label') appendPayloadValue(payload, 'label', facet.value);
    if (facet.key === 'type') appendPayloadValue(payload, 'type', facet.value);
    if (facet.key === 'priority') appendPayloadValue(payload, 'priority', facet.value);
  }
  return payload;
}

function firstFacetValue(facets: readonly Facet[] | undefined, key: Facet['key']): string | null {
  return facets?.find((facet) => facet.key === key)?.value ?? null;
}

function mapIssueResults(payload: SearchEnvelope): OmnibarResult[] {
  return (payload.results ?? []).map((row) => {
    const title = cleanText(row.title) ?? row.key ?? row.id;
    const subtitle = cleanText(row.snippet ?? row.description);
    const meta = [row.status, row.priority, row.type].filter(Boolean).join(' · ') || undefined;

    return {
      id: row.id,
      title,
      badge: row.key ?? undefined,
      subtitle,
      meta,
      type: 'issue',
      // Issue detail lives at /issues/[issueId] (see
      // app/[locale]/(app)/issues/[issueId]); comment hits navigate to
      // their parent issue.
      href: `/issues/${row.issueId ?? row.id}`,
    };
  });
}

async function fetchIssueResults(
  query: string,
  organizationId: string,
  facets: readonly Facet[] | undefined,
  signal: AbortSignal,
  limit: number
): Promise<OmnibarResult[]> {
  let response: Response | null = null;
  try {
    response = await fetch(HYBRID_ENDPOINT, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        query,
        organizationId,
        limit,
        ...buildFacetPayload(facets),
      }),
      signal,
    });
  } catch (err) {
    if ((err as { name?: string }).name === 'AbortError') throw err;
  }

  if (!response?.ok) {
    // Any hybrid failure falls back to the classic GET search wrapper. The
    // wrapper now handles free-text queries by delegating back to hybrid after
    // the membership guard, and it keeps structured JQL support intact.
    const params = new URLSearchParams({
      q: query,
      organizationId,
      saveHistory: 'false',
      limit: String(limit),
    });
    response = await fetch(`${SEARCH_ENDPOINT}?${params.toString()}`, {
      signal,
    });
  }

  if (!response.ok) {
    throw new Error(`Search failed: ${response.status}`);
  }

  return mapIssueResults((await response.json()) as SearchEnvelope);
}

async function fetchDocResults(
  query: string,
  organizationId: string,
  facets: readonly Facet[] | undefined,
  signal: AbortSignal,
  limit: number
): Promise<OmnibarResult[]> {
  const params = new URLSearchParams({
    q: query,
    organizationId,
    limit: String(limit),
  });
  const project = firstFacetValue(facets, 'project');
  if (project) params.set('projectId', project);

  const response = await fetch(`/api/docs/search?${params.toString()}`, { signal });
  if (!response.ok) {
    throw new Error(`Search failed: ${response.status}`);
  }

  const payload = (await response.json()) as DocsEnvelope;
  return (payload.results ?? []).map((row) => {
    const hrefParams = new URLSearchParams({ pageId: row.id, spaceId: row.spaceId });
    return {
      id: row.id,
      title: cleanText(row.title) ?? row.slug ?? row.id,
      badge: row.icon ?? undefined,
      subtitle: cleanText(row.excerpt) ?? cleanText(row.spaceName),
      meta: cleanText(row.spaceName),
      type: 'doc',
      href: `/docs?${hrefParams.toString()}`,
    };
  });
}

async function fetchPeopleResults(
  query: string,
  organizationId: string,
  signal: AbortSignal,
  limit: number
): Promise<OmnibarResult[]> {
  const response = await fetch(`/api/organizations/${organizationId}/members`, { signal });
  if (!response.ok) {
    throw new Error(`Search failed: ${response.status}`);
  }

  const normalizedQuery = query.trim().toLowerCase();
  const payload = (await response.json()) as MembersEnvelope;
  return (payload.members ?? [])
    .filter((member) => {
      const haystack = [member.name, member.email, member.role]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
      return haystack.includes(normalizedQuery);
    })
    .slice(0, limit)
    .map((member) => ({
      id: member.id,
      title: cleanText(member.name) ?? cleanText(member.email) ?? member.id,
      subtitle: member.name ? cleanText(member.email) : undefined,
      meta: cleanText(member.role),
      type: 'person',
      href: '/team',
    }));
}

function dedupeResults(results: OmnibarResult[]): OmnibarResult[] {
  const seen = new Set<string>();
  const deduped: OmnibarResult[] = [];
  for (const result of results) {
    const key = `${result.type}:${result.id}`;
    if (seen.has(key)) continue;
    seen.add(key);
    deduped.push(result);
  }
  return deduped;
}

/**
 * useOmnibarSearch — debounced fetch driver for the Cmd+K palette.
 *
 * The hook fires once on every change of `query`/`tab`/`organizationId`,
 * waits `debounceMs` (default 120ms), then POSTs to the hybrid endpoint
 * (it is POST-only) and falls back to the classic GET `/api/search` on any
 * non-ok hybrid response (404/405/501 while it rolls out, 5xx, …). The
 * Ask AI tab does not call any endpoint — it surfaces a CTA built by the
 * consumer.
 */
export function useOmnibarSearch({
  query,
  tab,
  organizationId,
  facets,
  debounceMs = 120,
}: UseOmnibarSearchOptions): UseOmnibarSearchResult {
  const [results, setResults] = React.useState<OmnibarResult[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const facetSignature = React.useMemo(() => JSON.stringify(facets ?? []), [facets]);

  React.useEffect(() => {
    setError(null);
    if (!query.trim() || tab === 'ask' || !organizationId) {
      setResults([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      try {
        const trimmedQuery = query.trim();
        const activeFacets = JSON.parse(facetSignature) as Facet[];
        const tasks: Array<Promise<OmnibarResult[]>> = [];

        if (tab === 'all' || tab === 'issues') {
          tasks.push(
            fetchIssueResults(
              trimmedQuery,
              organizationId,
              activeFacets,
              controller.signal,
              tab === 'all' ? ALL_ISSUE_LIMIT : RESULT_LIMIT
            )
          );
        }
        if (tab === 'all' || tab === 'docs') {
          tasks.push(
            fetchDocResults(
              trimmedQuery,
              organizationId,
              activeFacets,
              controller.signal,
              tab === 'all' ? ALL_SECONDARY_LIMIT : RESULT_LIMIT
            )
          );
        }
        if (tab === 'all' || tab === 'people') {
          tasks.push(
            fetchPeopleResults(
              trimmedQuery,
              organizationId,
              controller.signal,
              tab === 'all' ? ALL_SECONDARY_LIMIT : RESULT_LIMIT
            )
          );
        }

        const settled = await Promise.allSettled(tasks);
        const hasSuccessfulSource = settled.some((item) => item.status === 'fulfilled');
        const fulfilled = settled
          .filter(
            (item): item is PromiseFulfilledResult<OmnibarResult[]> => item.status === 'fulfilled'
          )
          .flatMap((item) => item.value);
        if (!hasSuccessfulSource) {
          const rejected = settled.find(
            (item): item is PromiseRejectedResult => item.status === 'rejected'
          );
          if (rejected) throw rejected.reason;
        }

        setResults(dedupeResults(fulfilled).slice(0, RESULT_LIMIT));
        setError(null);
      } catch (err) {
        if ((err as { name?: string }).name === 'AbortError') return;
        setError(err instanceof Error ? err.message : 'Search failed');
        setResults([]);
      } finally {
        setLoading(false);
      }
    }, debounceMs);

    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [query, tab, organizationId, facetSignature, debounceMs]);

  return { results, loading, error };
}
