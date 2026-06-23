/**
 * Tests for useOmnibarSearch — the Cmd+K palette fetch driver.
 *
 * Pins down the FEAT-25 search-path fixes:
 *   1. The hybrid endpoint is called via POST with the JSON body its zod
 *      schema expects ({ query, organizationId, limit }) — a GET would 405.
 *   2. ANY non-ok hybrid response (405, 500, …) falls back to the classic
 *      GET /api/search, not just 404/501.
 *   3. Result hrefs point at the real issue detail route /issues/[issueId]
 *      (was /work-items/:id, a 404), preferring the parent issueId for
 *      comment hits.
 *   4. A failure on both endpoints surfaces an error instead of being
 *      swallowed.
 */

import { renderHook, waitFor } from '@testing-library/react';
import { useOmnibarSearch } from '../use-omnibar-search';

const fetchMock = jest.fn();

function jsonResponse(body: unknown, init: { ok?: boolean; status?: number } = {}) {
  return {
    ok: init.ok ?? true,
    status: init.status ?? 200,
    json: async () => body,
  };
}

beforeEach(() => {
  fetchMock.mockReset();
  global.fetch = fetchMock as unknown as typeof fetch;
});

describe('useOmnibarSearch', () => {
  it('POSTs the hybrid endpoint with facet filters and maps hrefs to /issues/[issueId]', async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse({
        results: [
          // Comment hit: id is the comment id, issueId the parent issue.
          { id: 'cmt_1', issueId: 'iss_1', key: 'TN-1', title: 'Login bug', snippet: 'broken' },
          // Issue hit.
          { id: 'iss_2', issueId: 'iss_2', key: 'TN-2', title: 'Sidebar', snippet: 'collapse' },
        ],
      })
    );

    const { result } = renderHook(() =>
      useOmnibarSearch({
        query: 'login',
        tab: 'issues',
        organizationId: 'org_1',
        facets: [
          { key: 'status', value: 'in_progress' },
          { key: 'assignee', value: 'me' },
        ],
        debounceMs: 0,
      })
    );

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
      expect(result.current.results).toHaveLength(2);
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('/api/search/hybrid');
    expect(init.method).toBe('POST');
    expect(JSON.parse(String(init.body))).toEqual({
      query: 'login',
      organizationId: 'org_1',
      limit: 20,
      status: 'in_progress',
      assignee: 'me',
    });

    expect(result.current.results[0]?.href).toBe('/issues/iss_1');
    expect(result.current.results[1]?.href).toBe('/issues/iss_2');
    expect(result.current.results[0]?.badge).toBe('TN-1');
    expect(result.current.error).toBeNull();
  });

  it('falls back to GET /api/search on a non-ok hybrid response (e.g. 405)', async () => {
    fetchMock
      .mockResolvedValueOnce(
        jsonResponse({ error: 'Method Not Allowed' }, { ok: false, status: 405 })
      )
      .mockResolvedValueOnce(
        jsonResponse({ results: [{ id: 'iss_9', key: 'TN-9', title: 'Fallback hit' }] })
      );

    const { result } = renderHook(() =>
      useOmnibarSearch({
        query: 'fallback',
        tab: 'issues',
        organizationId: 'org_1',
        debounceMs: 0,
      })
    );

    await waitFor(() => {
      expect(result.current.results).toHaveLength(1);
    });

    expect(fetchMock).toHaveBeenCalledTimes(2);
    const [fallbackUrl] = fetchMock.mock.calls[1] as [string];
    expect(fallbackUrl).toContain('/api/search?');
    expect(fallbackUrl).toContain('q=fallback');
    expect(fallbackUrl).toContain('organizationId=org_1');
    expect(fallbackUrl).toContain('saveHistory=false');
    expect(fallbackUrl).toContain('limit=20');
    // Classic rows have no issueId — href falls back to the row id.
    expect(result.current.results[0]?.href).toBe('/issues/iss_9');
    expect(result.current.error).toBeNull();
  });

  it('combines issue, docs, and people results on the all tab', async () => {
    fetchMock.mockImplementation((url: RequestInfo | URL) => {
      const target = String(url);
      if (target === '/api/search/hybrid') {
        return Promise.resolve(
          jsonResponse({
            results: [{ id: 'iss_1', issueId: 'iss_1', key: 'TN-1', title: 'Login bug' }],
          })
        );
      }
      if (target.startsWith('/api/docs/search')) {
        return Promise.resolve(
          jsonResponse({
            results: [
              {
                id: 'doc_1',
                title: 'Login runbook',
                excerpt: 'OAuth redirect steps',
                spaceId: 'space_1',
                spaceName: 'Engineering',
              },
            ],
          })
        );
      }
      if (target.startsWith('/api/organizations/org_1/members')) {
        return Promise.resolve(
          jsonResponse({
            members: [
              { id: 'user_1', name: 'Ada Login', email: 'ada@example.com', role: 'member' },
              { id: 'user_2', name: 'Grace Hopper', email: 'grace@example.com', role: 'admin' },
            ],
          })
        );
      }
      return Promise.resolve(jsonResponse({}));
    });

    const { result } = renderHook(() =>
      useOmnibarSearch({ query: 'login', tab: 'all', organizationId: 'org_1', debounceMs: 0 })
    );

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
      expect(result.current.results.map((item) => item.type)).toEqual(['issue', 'doc', 'person']);
    });

    expect(result.current.results[1]?.href).toBe('/docs?pageId=doc_1&spaceId=space_1');
    expect(result.current.results[2]?.href).toBe('/team');
  });

  it('surfaces an error when both endpoints fail', async () => {
    fetchMock
      .mockResolvedValueOnce(jsonResponse({}, { ok: false, status: 500 }))
      .mockResolvedValueOnce(jsonResponse({}, { ok: false, status: 500 }));

    const { result } = renderHook(() =>
      useOmnibarSearch({ query: 'boom', tab: 'issues', organizationId: 'org_1', debounceMs: 0 })
    );

    await waitFor(() => {
      expect(result.current.error).not.toBeNull();
    });

    expect(result.current.error).toContain('500');
    expect(result.current.results).toEqual([]);
    expect(result.current.loading).toBe(false);
  });

  it('does not fetch without an organization, with an empty query, or on the ask tab', async () => {
    const { rerender } = renderHook(
      (props: { query: string; tab: 'all' | 'ask'; organizationId: string | null }) =>
        useOmnibarSearch({ ...props, debounceMs: 0 }),
      { initialProps: { query: 'x', tab: 'all' as const, organizationId: null } }
    );

    rerender({ query: '', tab: 'all', organizationId: 'org_1' });
    rerender({ query: 'x', tab: 'ask', organizationId: 'org_1' });

    await Promise.resolve();
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
