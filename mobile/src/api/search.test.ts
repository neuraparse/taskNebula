import { listSearchHistory, searchIssues, updateSearchHistoryPinned } from './endpoints';
import { configureApi } from './client';

const originalFetch = globalThis.fetch;

function jsonResponse(status: number, body: unknown): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    statusText: status >= 200 && status < 300 ? 'OK' : 'Error',
    json: jest.fn().mockResolvedValue(body),
    text: jest.fn().mockResolvedValue(JSON.stringify(body)),
  } as unknown as Response;
}

describe('search API', () => {
  beforeAll(() => {
    globalThis.fetch = jest.fn() as unknown as typeof fetch;
  });

  beforeEach(() => {
    jest.mocked(globalThis.fetch).mockReset();
    configureApi({ baseUrl: 'https://tasks.example.com', cookie: 'authjs.session-token=abc' });
  });

  afterAll(() => {
    globalThis.fetch = originalFetch;
  });

  it('searches issues through the hybrid endpoint', async () => {
    jest.mocked(globalThis.fetch).mockResolvedValue(
      jsonResponse(200, {
        count: 1,
        query: 'mobile auth',
        results: [
          {
            id: 'result_1',
            entityType: 'comment',
            issueId: 'issue_1',
            key: 'MOB-7',
            title: 'Fix mobile auth',
            snippet: '<mark>mobile</mark> cookie auth',
            projectId: 'project_1',
            score: 0.8,
          },
        ],
      }),
    );

    await expect(searchIssues('mobile auth')).resolves.toEqual({
      count: 1,
      query: 'mobile auth',
      results: [
        {
          id: 'result_1',
          entityType: 'comment',
          issueId: 'issue_1',
          key: 'MOB-7',
          title: 'Fix mobile auth',
          snippet: '<mark>mobile</mark> cookie auth',
          projectId: 'project_1',
          score: 0.8,
        },
      ],
    });

    const [url, init] = jest.mocked(globalThis.fetch).mock.calls[0] ?? [];
    expect(url).toBe('https://tasks.example.com/api/search/hybrid');
    expect(init?.method).toBe('POST');
    expect(JSON.parse(String(init?.body))).toEqual({ query: 'mobile auth', limit: 20 });
  });

  it('loads search history and updates pinned state', async () => {
    jest
      .mocked(globalThis.fetch)
      .mockResolvedValueOnce(
        jsonResponse(200, {
          history: [
            {
              id: 'hist_1',
              organizationId: 'org_1',
              projectId: null,
              query: 'status:in_progress',
              criteria: { text: 'status:in_progress' },
              resultCount: '5',
              pinned: true,
              createdAt: '2026-06-29T10:00:00.000Z',
            },
            { id: 'missing-query', organizationId: 'org_1' },
          ],
        }),
      )
      .mockResolvedValueOnce(
        jsonResponse(200, {
          item: {
            id: 'hist_1',
            organizationId: 'org_1',
            projectId: null,
            query: 'status:in_progress',
            criteria: { text: 'status:in_progress' },
            resultCount: 5,
            pinned: false,
          },
        }),
      );

    await expect(
      listSearchHistory({ organizationId: 'org_1', pinned: true, limit: 10 }),
    ).resolves.toEqual([
      {
        id: 'hist_1',
        organizationId: 'org_1',
        projectId: null,
        query: 'status:in_progress',
        criteria: { text: 'status:in_progress' },
        resultCount: 5,
        pinned: true,
        createdAt: '2026-06-29T10:00:00.000Z',
      },
    ]);

    await expect(updateSearchHistoryPinned('hist_1', false)).resolves.toEqual({
      id: 'hist_1',
      organizationId: 'org_1',
      projectId: null,
      query: 'status:in_progress',
      criteria: { text: 'status:in_progress' },
      resultCount: 5,
      pinned: false,
    });

    const [listUrl] = jest.mocked(globalThis.fetch).mock.calls[0] ?? [];
    expect(listUrl).toBe(
      'https://tasks.example.com/api/search-history?organizationId=org_1&limit=10&pinned=true',
    );
    const [patchUrl, patchInit] = jest.mocked(globalThis.fetch).mock.calls[1] ?? [];
    expect(patchUrl).toBe('https://tasks.example.com/api/search-history');
    expect(patchInit?.method).toBe('PATCH');
    expect(JSON.parse(String(patchInit?.body))).toEqual({ id: 'hist_1', pinned: false });
  });
});
