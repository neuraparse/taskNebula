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
    title?: string;
    key?: string;
    description?: string | null;
  }>;
}

const SEARCH_ENDPOINT = '/api/search';
const HYBRID_ENDPOINT = '/api/search/hybrid';

/**
 * useOmnibarSearch — debounced fetch driver for the Cmd+K palette.
 *
 * The hook fires once on every change of `query`/`tab`/`organizationId`,
 * waits `debounceMs` (default 120ms), then calls the hybrid endpoint
 * first and falls back to the classic `/api/search` if hybrid is not
 * implemented yet (status 404 / 501). The Ask AI tab does not call any
 * endpoint — it surfaces a CTA built by the consumer.
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
      const params = new URLSearchParams({
        q: query,
        organizationId,
        saveHistory: 'false',
      });

      const tryFetch = async (url: string): Promise<Response> =>
        fetch(`${url}?${params.toString()}`, { signal: controller.signal });

      try {
        let response = await tryFetch(HYBRID_ENDPOINT);
        if (response.status === 404 || response.status === 501) {
          response = await tryFetch(SEARCH_ENDPOINT);
        }
        if (!response.ok) {
          throw new Error(`Search failed: ${response.status}`);
        }
        const payload = (await response.json()) as SearchEnvelope;
        const mapped: OmnibarResult[] = (payload.results ?? []).map((row) => ({
          id: row.id,
          title: row.title ?? row.key ?? '(untitled)',
          subtitle: row.key && row.key !== row.title ? row.key : row.description ?? undefined,
          type: 'issue',
          href: `/work-items/${row.id}`,
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
