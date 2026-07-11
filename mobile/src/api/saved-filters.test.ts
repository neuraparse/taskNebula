import {
  createSavedIssueFilter,
  deleteSavedIssueFilter,
  listSavedIssueFilters,
  markSavedIssueFilterUsed,
  updateSavedIssueFilter,
} from './endpoints';
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

describe('saved filters API', () => {
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

  it('lists and normalizes saved issue filters from the web API', async () => {
    jest.mocked(globalThis.fetch).mockResolvedValue(
      jsonResponse(200, {
        filters: [
          {
            id: 'filter_1',
            userId: 'user_1',
            organizationId: 'org_1',
            projectId: 'project_1',
            name: 'Review bugs',
            description: null,
            query: 'type:bug status:in_review',
            criteria: { search: 'crash', status: 'in_review', type: 'bug' },
            isPublic: true,
            isStarred: true,
            viewType: 'board',
            sortBy: 'updated_at',
            sortOrder: 'asc',
            usageCount: '3',
            lastUsedAt: '2026-06-28T10:00:00.000Z',
            createdAt: '2026-06-20T10:00:00.000Z',
            updatedAt: '2026-06-28T10:00:00.000Z',
          },
          { id: 'missing-name', organizationId: 'org_1' },
        ],
      }),
    );

    await expect(
      listSavedIssueFilters({ organizationId: 'org_1', projectId: 'project_1' }),
    ).resolves.toEqual([
      {
        id: 'filter_1',
        userId: 'user_1',
        organizationId: 'org_1',
        projectId: 'project_1',
        name: 'Review bugs',
        description: null,
        query: 'type:bug status:in_review',
        criteria: { search: 'crash', status: 'in_review', type: 'bug' },
        isPublic: true,
        isStarred: true,
        viewType: 'board',
        sortBy: 'updated_at',
        sortOrder: 'asc',
        usageCount: 3,
        lastUsedAt: '2026-06-28T10:00:00.000Z',
        createdAt: '2026-06-20T10:00:00.000Z',
        updatedAt: '2026-06-28T10:00:00.000Z',
      },
    ]);
    expect(jest.mocked(globalThis.fetch).mock.calls[0]?.[0]).toBe(
      'https://tasks.example.com/api/saved-filters?organizationId=org_1&projectId=project_1&includePublic=true',
    );
  });

  it('creates, updates, marks used, and deletes saved issue filters', async () => {
    const filter = {
      id: 'filter_1',
      userId: 'user_1',
      organizationId: 'org_1',
      name: 'Review bugs',
      criteria: { status: 'in_review', type: 'bug' },
      isPublic: false,
      isStarred: true,
      usageCount: '0',
    };

    jest
      .mocked(globalThis.fetch)
      .mockResolvedValueOnce(jsonResponse(201, { filter }))
      .mockResolvedValueOnce(jsonResponse(200, { filter: { ...filter, isStarred: false } }))
      .mockResolvedValueOnce(jsonResponse(200, { filter: { ...filter, usageCount: '1' } }))
      .mockResolvedValueOnce(jsonResponse(200, { success: true }));

    await createSavedIssueFilter({
      organizationId: 'org_1',
      projectId: null,
      name: 'Review bugs',
      query: 'status:in_review type:bug',
      criteria: { status: 'in_review', type: 'bug' },
      isStarred: true,
      viewType: 'list',
      sortBy: 'updated_at',
      sortOrder: 'desc',
    });
    await updateSavedIssueFilter('filter_1', { isStarred: false });
    await markSavedIssueFilterUsed('filter_1');
    await deleteSavedIssueFilter('filter_1');

    const [, createInit] = jest.mocked(globalThis.fetch).mock.calls[0] ?? [];
    const [, updateInit] = jest.mocked(globalThis.fetch).mock.calls[1] ?? [];

    expect(createInit).toMatchObject({ method: 'POST' });
    expect(JSON.parse(String(createInit?.body))).toEqual({
      organizationId: 'org_1',
      projectId: null,
      name: 'Review bugs',
      query: 'status:in_review type:bug',
      criteria: { status: 'in_review', type: 'bug' },
      isStarred: true,
      viewType: 'list',
      sortBy: 'updated_at',
      sortOrder: 'desc',
    });
    expect(updateInit).toMatchObject({ method: 'PATCH' });
    expect(JSON.parse(String(updateInit?.body))).toEqual({ isStarred: false });
    expect(jest.mocked(globalThis.fetch).mock.calls[2]?.[0]).toBe(
      'https://tasks.example.com/api/saved-filters/filter_1/use',
    );
    expect(globalThis.fetch).toHaveBeenLastCalledWith(
      'https://tasks.example.com/api/saved-filters/filter_1',
      expect.objectContaining({ method: 'DELETE' }),
    );
  });
});
