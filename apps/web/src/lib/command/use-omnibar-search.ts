'use client';

import * as React from 'react';

export type OmnibarTab = 'all' | 'issues' | 'docs' | 'people' | 'ask';

export interface OmnibarResult {
  id: string;
  title: string;
  subtitle?: string;
  type: 'issue' | 'doc' | 'person' | 'ai';
  href?: string;
}

interface UseOmnibarSearchOptions {
  query: string;
  tab: OmnibarTab;
  organizationId: string | null;
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
    title?: string;
    key?: string | null;
    description?: string | null;
    snippet?: string | null;
  }>;
}

const SEARCH_ENDPOINT = '/api/search';
const HYBRID_ENDPOINT = '/api/search/hybrid';
const RESULT_LIMIT = 20;

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
  debounceMs = 120,
}: UseOmnibarSearchOptions): UseOmnibarSearchResult {
  const [results, setResults] = React.useState<OmnibarResult[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

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
        // Hybrid is POST-only (see api/search/hybrid/route.ts).
        let response = await fetch(HYBRID_ENDPOINT, {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ query, organizationId, limit: RESULT_LIMIT }),
          signal: controller.signal,
        });
        if (!response.ok) {
          // Any hybrid failure falls back to the classic JQL search.
          const params = new URLSearchParams({
            q: query,
            organizationId,
            saveHistory: 'false',
          });
          response = await fetch(`${SEARCH_ENDPOINT}?${params.toString()}`, {
            signal: controller.signal,
          });
        }
        if (!response.ok) {
          throw new Error(`Search failed: ${response.status}`);
        }
        const payload = (await response.json()) as SearchEnvelope;
        const mapped: OmnibarResult[] = (payload.results ?? []).map((row) => ({
          id: row.id,
          title: row.title ?? row.key ?? '(untitled)',
          subtitle:
            row.key && row.key !== row.title
              ? row.key
              : (row.snippet ?? row.description ?? undefined),
          type: 'issue',
          // Issue detail lives at /issues/[issueId] (see
          // app/[locale]/(app)/issues/[issueId]); comment hits navigate to
          // their parent issue.
          href: `/issues/${row.issueId ?? row.id}`,
        }));
        setResults(mapped);
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
  }, [query, tab, organizationId, debounceMs]);

  return { results, loading, error };
}
