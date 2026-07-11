import {
  assignProjectPermissionScheme,
  createPermissionScheme,
  deletePermissionScheme,
  getProjectPermissionScheme,
  listPermissionSchemes,
  updatePermissionScheme,
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

describe('permission schemes API', () => {
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

  it('lists and normalizes organization permission schemes', async () => {
    jest.mocked(globalThis.fetch).mockResolvedValue(
      jsonResponse(200, [
        {
          id: 'scheme_1',
          name: 'Delivery team',
          description: 'Default delivery policy',
          isDefault: true,
          permissions: { developer: ['canBrowseProject', 123, 'canEditIssues'] },
          projectCount: '2',
          createdAt: '2026-06-28T10:00:00.000Z',
        },
        { id: 'missing-name' },
      ]),
    );

    await expect(listPermissionSchemes('org_1')).resolves.toEqual([
      {
        id: 'scheme_1',
        name: 'Delivery team',
        description: 'Default delivery policy',
        isDefault: true,
        permissions: { developer: ['canBrowseProject', 'canEditIssues'] },
        projectCount: 2,
        createdAt: '2026-06-28T10:00:00.000Z',
        updatedAt: null,
      },
    ]);
    expect(jest.mocked(globalThis.fetch).mock.calls[0]?.[0]).toBe(
      'https://tasks.example.com/api/permission-schemes?organizationId=org_1',
    );
  });

  it('creates, updates, and deletes permission schemes', async () => {
    jest
      .mocked(globalThis.fetch)
      .mockResolvedValueOnce(
        jsonResponse(201, {
          id: 'scheme_2',
          name: 'QA team',
          description: null,
          isDefault: false,
          permissions: { qa_engineer: ['canBrowseProject'] },
        }),
      )
      .mockResolvedValueOnce(
        jsonResponse(200, {
          id: 'scheme_2',
          name: 'QA team updated',
          description: 'Updated',
          isDefault: true,
          permissions: { qa_engineer: ['canBrowseProject'] },
        }),
      )
      .mockResolvedValueOnce(jsonResponse(200, { success: true }));

    await createPermissionScheme({
      organizationId: 'org_1',
      name: 'QA team',
      description: null,
      baseRole: 'qa_engineer',
    });
    await updatePermissionScheme({
      schemeId: 'scheme_2',
      name: 'QA team updated',
      description: 'Updated',
      isDefault: true,
    });
    await deletePermissionScheme('scheme_2');

    const calls = jest.mocked(globalThis.fetch).mock.calls;
    expect(calls[0]?.[0]).toBe('https://tasks.example.com/api/permission-schemes');
    expect(calls[0]?.[1]).toMatchObject({ method: 'POST' });
    expect(JSON.parse(String(calls[0]?.[1]?.body))).toEqual({
      organizationId: 'org_1',
      name: 'QA team',
      baseRole: 'qa_engineer',
      isDefault: false,
    });
    expect(calls[1]?.[0]).toBe('https://tasks.example.com/api/permission-schemes/scheme_2');
    expect(calls[1]?.[1]).toMatchObject({ method: 'PATCH' });
    expect(JSON.parse(String(calls[1]?.[1]?.body))).toEqual({
      name: 'QA team updated',
      description: 'Updated',
      isDefault: true,
    });
    expect(calls[2]?.[0]).toBe('https://tasks.example.com/api/permission-schemes/scheme_2');
    expect(calls[2]?.[1]).toMatchObject({ method: 'DELETE' });
  });

  it('loads and assigns a project permission scheme', async () => {
    jest
      .mocked(globalThis.fetch)
      .mockResolvedValueOnce(
        jsonResponse(200, {
          projectId: 'project_1',
          assignedSchemeId: null,
          effectiveSchemeId: 'scheme_default',
          source: 'organization-default',
          scheme: {
            id: 'scheme_default',
            name: 'Default',
            description: null,
            isDefault: true,
          },
        }),
      )
      .mockResolvedValueOnce(
        jsonResponse(200, {
          projectId: 'project_1',
          assignedSchemeId: 'scheme_1',
          effectiveSchemeId: 'scheme_1',
          source: 'project',
          scheme: {
            id: 'scheme_1',
            name: 'Delivery team',
            description: 'Project override',
            isDefault: false,
          },
        }),
      );

    await expect(getProjectPermissionScheme('project_1')).resolves.toMatchObject({
      projectId: 'project_1',
      source: 'organization-default',
      scheme: { id: 'scheme_default', name: 'Default', isDefault: true },
    });
    await expect(assignProjectPermissionScheme('project_1', 'scheme_1')).resolves.toMatchObject({
      projectId: 'project_1',
      assignedSchemeId: 'scheme_1',
      source: 'project',
      scheme: { id: 'scheme_1', name: 'Delivery team' },
    });

    const calls = jest.mocked(globalThis.fetch).mock.calls;
    expect(calls[0]?.[0]).toBe(
      'https://tasks.example.com/api/projects/project_1/permission-scheme',
    );
    expect(calls[1]?.[0]).toBe(
      'https://tasks.example.com/api/projects/project_1/permission-scheme',
    );
    expect(calls[1]?.[1]).toMatchObject({ method: 'PATCH' });
    expect(JSON.parse(String(calls[1]?.[1]?.body))).toEqual({ schemeId: 'scheme_1' });
  });
});
