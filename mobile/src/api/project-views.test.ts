import {
  createProjectView,
  deleteProjectView,
  listProjectViews,
  markProjectViewUsed,
  updateProjectView,
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

describe('project views API', () => {
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

  it('lists and normalizes project views from the web API', async () => {
    jest.mocked(globalThis.fetch).mockResolvedValue(
      jsonResponse(200, {
        viewerId: 'user_1',
        project: {
          id: 'project_1',
          key: 'MOB',
          name: 'Mobile',
          teamId: null,
        },
        views: [
          {
            id: 'view_1',
            userId: 'user_1',
            name: 'Planning',
            description: null,
            query: 'project = MOB',
            criteria: { search: 'auth', defaultView: true },
            isPublic: true,
            isStarred: true,
            viewType: 'board',
            lastUsedAt: null,
            updatedAt: '2026-06-28T10:00:00.000Z',
            scope: 'project',
            teamspaceId: null,
            isDefault: true,
            isOwned: true,
          },
          { id: 'missing-name', userId: 'user_1' },
        ],
      }),
    );

    await expect(listProjectViews({ projectId: 'project_1', teamId: 'team_1' })).resolves.toEqual({
      viewerId: 'user_1',
      project: {
        id: 'project_1',
        key: 'MOB',
        name: 'Mobile',
        teamId: null,
      },
      views: [
        {
          id: 'view_1',
          userId: 'user_1',
          name: 'Planning',
          description: null,
          query: 'project = MOB',
          criteria: { search: 'auth', defaultView: true },
          isPublic: true,
          isStarred: true,
          viewType: 'board',
          lastUsedAt: null,
          updatedAt: '2026-06-28T10:00:00.000Z',
          scope: 'project',
          teamspaceId: null,
          isDefault: true,
          isOwned: true,
        },
      ],
    });
    expect(jest.mocked(globalThis.fetch).mock.calls[0]?.[0]).toBe(
      'https://tasks.example.com/api/projects/project_1/views?teamId=team_1',
    );
  });

  it('creates, updates, deletes, and marks project views as used', async () => {
    const view = {
      id: 'view_1',
      userId: 'user_1',
      name: 'Planning',
      criteria: {},
      isPublic: true,
      isStarred: false,
      viewType: 'list',
      updatedAt: '2026-06-28T10:00:00.000Z',
    };

    jest
      .mocked(globalThis.fetch)
      .mockResolvedValueOnce(jsonResponse(201, { view }))
      .mockResolvedValueOnce(jsonResponse(200, { view: { ...view, isStarred: true } }))
      .mockResolvedValueOnce(jsonResponse(200, { success: true }))
      .mockResolvedValueOnce(jsonResponse(200, { success: true }));

    await createProjectView('project_1', {
      name: 'Planning',
      criteria: { search: 'auth', scope: 'teamspace', teamspaceId: 'team_1' },
      viewType: 'list',
      scope: 'teamspace',
      isPinned: true,
    });
    await updateProjectView('project_1', 'view_1', { isPinned: false });
    await markProjectViewUsed('view_1');
    await deleteProjectView('project_1', 'view_1');

    const [, createInit] = jest.mocked(globalThis.fetch).mock.calls[0] ?? [];
    const [, updateInit] = jest.mocked(globalThis.fetch).mock.calls[1] ?? [];

    expect(createInit).toMatchObject({ method: 'POST' });
    expect(JSON.parse(String(createInit?.body))).toEqual({
      name: 'Planning',
      criteria: { search: 'auth', scope: 'teamspace', teamspaceId: 'team_1' },
      viewType: 'list',
      scope: 'teamspace',
      isPinned: true,
    });
    expect(updateInit).toMatchObject({ method: 'PATCH' });
    expect(JSON.parse(String(updateInit?.body))).toEqual({ isPinned: false });
    expect(jest.mocked(globalThis.fetch).mock.calls[2]?.[0]).toBe(
      'https://tasks.example.com/api/saved-filters/view_1/use',
    );
    expect(globalThis.fetch).toHaveBeenLastCalledWith(
      'https://tasks.example.com/api/projects/project_1/views/view_1',
      expect.objectContaining({ method: 'DELETE' }),
    );
  });
});
