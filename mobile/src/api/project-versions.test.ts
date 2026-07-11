import {
  createProjectVersion,
  deleteProjectVersion,
  listIssueVersions,
  listProjectVersions,
  releaseProjectVersion,
  setIssueVersions,
  updateProjectVersion,
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

describe('project versions API', () => {
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

  it('lists and normalizes project versions from the web API', async () => {
    jest.mocked(globalThis.fetch).mockResolvedValue(
      jsonResponse(200, {
        versions: [
          {
            id: 'version_1',
            organizationId: 'org_1',
            projectId: 'project_1',
            name: '2.0',
            description: null,
            status: 'unreleased',
            startDate: '2026-07-01T00:00:00.000Z',
            releaseDate: '2026-07-31T00:00:00.000Z',
            sortOrder: '2',
            issueCount: '8',
            doneIssueCount: '3',
            createdBy: 'user_1',
            createdAt: '2026-06-28T08:00:00.000Z',
          },
          { id: 'missing-name', projectId: 'project_1' },
        ],
      }),
    );

    await expect(listProjectVersions('project_1')).resolves.toEqual([
      {
        id: 'version_1',
        organizationId: 'org_1',
        projectId: 'project_1',
        name: '2.0',
        description: null,
        status: 'unreleased',
        startDate: '2026-07-01T00:00:00.000Z',
        releaseDate: '2026-07-31T00:00:00.000Z',
        releasedAt: null,
        sortOrder: 2,
        issueCount: 8,
        doneIssueCount: 3,
        createdBy: 'user_1',
        createdAt: '2026-06-28T08:00:00.000Z',
      },
    ]);
    expect(jest.mocked(globalThis.fetch).mock.calls[0]?.[0]).toBe(
      'https://tasks.example.com/api/projects/project_1/versions',
    );
  });

  it('creates, updates, releases, and deletes project versions', async () => {
    const version = {
      id: 'version_1',
      organizationId: 'org_1',
      projectId: 'project_1',
      name: '2.0',
      status: 'unreleased',
    };
    jest
      .mocked(globalThis.fetch)
      .mockResolvedValueOnce(jsonResponse(201, { version }))
      .mockResolvedValueOnce(jsonResponse(200, { version: { ...version, status: 'archived' } }))
      .mockResolvedValueOnce(jsonResponse(200, { version: { ...version, status: 'released' } }))
      .mockResolvedValueOnce(jsonResponse(200, { success: true }));

    await createProjectVersion('project_1', {
      name: '2.0',
      description: 'Mobile launch',
      startDate: '2026-07-01',
      releaseDate: '2026-07-31',
    });
    await updateProjectVersion('project_1', 'version_1', { status: 'archived' });
    await releaseProjectVersion('project_1', 'version_1', {
      moveOpenIssuesToVersionId: 'version_2',
    });
    await deleteProjectVersion('project_1', 'version_1');

    const [, createInit] = jest.mocked(globalThis.fetch).mock.calls[0] ?? [];
    const [, updateInit] = jest.mocked(globalThis.fetch).mock.calls[1] ?? [];
    const [releaseUrl, releaseInit] = jest.mocked(globalThis.fetch).mock.calls[2] ?? [];

    expect(createInit).toMatchObject({ method: 'POST' });
    expect(JSON.parse(String(createInit?.body))).toEqual({
      name: '2.0',
      description: 'Mobile launch',
      startDate: '2026-07-01',
      releaseDate: '2026-07-31',
    });
    expect(updateInit).toMatchObject({ method: 'PATCH' });
    expect(JSON.parse(String(updateInit?.body))).toEqual({ status: 'archived' });
    expect(releaseUrl).toBe(
      'https://tasks.example.com/api/projects/project_1/versions/version_1/release',
    );
    expect(releaseInit).toMatchObject({ method: 'POST' });
    expect(JSON.parse(String(releaseInit?.body))).toEqual({
      moveOpenIssuesToVersionId: 'version_2',
    });
    expect(globalThis.fetch).toHaveBeenLastCalledWith(
      'https://tasks.example.com/api/projects/project_1/versions/version_1',
      expect.objectContaining({ method: 'DELETE' }),
    );
  });

  it('lists and replaces issue fix and affects versions', async () => {
    const fixVersion = {
      id: 'version_1',
      organizationId: 'org_1',
      projectId: 'project_1',
      name: '2.0',
      status: 'unreleased',
    };
    const affectsVersion = {
      id: 'version_2',
      organizationId: 'org_1',
      projectId: 'project_1',
      name: '1.8',
      status: 'released',
      releasedAt: '2026-06-01T10:00:00.000Z',
    };
    jest
      .mocked(globalThis.fetch)
      .mockResolvedValueOnce(
        jsonResponse(200, {
          fixVersions: [fixVersion, { id: 'missing-name' }],
          affectsVersions: [affectsVersion],
        }),
      )
      .mockResolvedValueOnce(
        jsonResponse(200, {
          fixVersions: [fixVersion],
          affectsVersions: [],
        }),
      );

    await expect(listIssueVersions('issue_1')).resolves.toEqual({
      fixVersions: [
        {
          id: 'version_1',
          organizationId: 'org_1',
          projectId: 'project_1',
          name: '2.0',
          description: null,
          status: 'unreleased',
          startDate: null,
          releaseDate: null,
          releasedAt: null,
        },
      ],
      affectsVersions: [
        {
          id: 'version_2',
          organizationId: 'org_1',
          projectId: 'project_1',
          name: '1.8',
          description: null,
          status: 'released',
          startDate: null,
          releaseDate: null,
          releasedAt: '2026-06-01T10:00:00.000Z',
        },
      ],
    });
    await setIssueVersions('issue_1', {
      fixVersionIds: ['version_1'],
      affectsVersionIds: [],
    });

    expect(jest.mocked(globalThis.fetch).mock.calls[0]?.[0]).toBe(
      'https://tasks.example.com/api/issues/issue_1/versions',
    );
    const [setUrl, setInit] = jest.mocked(globalThis.fetch).mock.calls[1] ?? [];
    expect(setUrl).toBe('https://tasks.example.com/api/issues/issue_1/versions');
    expect(setInit).toMatchObject({ method: 'PUT' });
    expect(JSON.parse(String(setInit?.body))).toEqual({
      fixVersionIds: ['version_1'],
      affectsVersionIds: [],
    });
  });
});
