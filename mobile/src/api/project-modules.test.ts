import {
  createProjectModule,
  deleteProjectModule,
  listProjectModules,
  updateProjectModule,
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

describe('project modules API', () => {
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

  it('lists and normalizes project modules from the web API', async () => {
    jest.mocked(globalThis.fetch).mockResolvedValue(
      jsonResponse(200, {
        modules: [
          {
            id: 'module_1',
            projectId: 'project_1',
            name: 'Auth',
            description: null,
            status: 'in_progress',
            ownerId: 'user_1',
            memberIds: ['user_1', 42, 'user_2'],
            targetDate: '2026-07-31T00:00:00.000Z',
            createdAt: '2026-06-28T08:00:00.000Z',
            updatedAt: '2026-06-28T09:00:00.000Z',
          },
          { id: 'missing-name', projectId: 'project_1' },
        ],
      }),
    );

    await expect(listProjectModules('project_1')).resolves.toEqual([
      {
        id: 'module_1',
        projectId: 'project_1',
        name: 'Auth',
        description: null,
        status: 'in_progress',
        ownerId: 'user_1',
        memberIds: ['user_1', 'user_2'],
        targetDate: '2026-07-31T00:00:00.000Z',
        createdAt: '2026-06-28T08:00:00.000Z',
        updatedAt: '2026-06-28T09:00:00.000Z',
      },
    ]);
    expect(jest.mocked(globalThis.fetch).mock.calls[0]?.[0]).toBe(
      'https://tasks.example.com/api/projects/project_1/modules',
    );
  });

  it('creates, updates, and deletes project modules', async () => {
    const module = {
      id: 'module_1',
      projectId: 'project_1',
      name: 'Auth',
      status: 'planned',
      memberIds: [],
    };
    jest
      .mocked(globalThis.fetch)
      .mockResolvedValueOnce(jsonResponse(201, { module }))
      .mockResolvedValueOnce(jsonResponse(200, { module: { ...module, status: 'completed' } }))
      .mockResolvedValueOnce(jsonResponse(200, { success: true }));

    await createProjectModule('project_1', {
      name: 'Auth',
      description: 'Login and signup',
      status: 'planned',
      ownerId: null,
      memberIds: [],
      targetDate: '2026-07-31T00:00:00.000Z',
    });
    await updateProjectModule('project_1', 'module_1', { status: 'completed' });
    await deleteProjectModule('project_1', 'module_1');

    const [, createInit] = jest.mocked(globalThis.fetch).mock.calls[0] ?? [];
    const [, updateInit] = jest.mocked(globalThis.fetch).mock.calls[1] ?? [];

    expect(createInit).toMatchObject({ method: 'POST' });
    expect(JSON.parse(String(createInit?.body))).toEqual({
      name: 'Auth',
      description: 'Login and signup',
      status: 'planned',
      ownerId: null,
      memberIds: [],
      targetDate: '2026-07-31T00:00:00.000Z',
    });
    expect(updateInit).toMatchObject({ method: 'PATCH' });
    expect(JSON.parse(String(updateInit?.body))).toEqual({ status: 'completed' });
    expect(globalThis.fetch).toHaveBeenLastCalledWith(
      'https://tasks.example.com/api/projects/project_1/modules/module_1',
      expect.objectContaining({ method: 'DELETE' }),
    );
  });
});
