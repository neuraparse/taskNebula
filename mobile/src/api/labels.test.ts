import { configureApi } from './client';
import { createLabel, deleteLabel, listLabels, updateLabel } from './endpoints';

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

describe('labels API', () => {
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

  it('lists and normalizes organization labels with usage counts', async () => {
    jest.mocked(globalThis.fetch).mockResolvedValue(
      jsonResponse(200, {
        labels: [
          {
            id: 'label_1',
            organizationId: 'org_1',
            projectId: null,
            name: 'Backend',
            color: '#3B82F6',
            description: 'Server work',
            usageCount: '4',
            createdAt: '2026-06-28T08:00:00.000Z',
            createdBy: 'user_1',
          },
          { id: 'invalid' },
        ],
      }),
    );

    await expect(listLabels({ organizationId: 'org_1' })).resolves.toEqual([
      {
        id: 'label_1',
        organizationId: 'org_1',
        projectId: null,
        name: 'Backend',
        color: '#3B82F6',
        description: 'Server work',
        usageCount: 4,
        createdAt: '2026-06-28T08:00:00.000Z',
        createdBy: 'user_1',
      },
    ]);
    expect(jest.mocked(globalThis.fetch).mock.calls[0]?.[0]).toBe(
      'https://tasks.example.com/api/labels?organizationId=org_1',
    );
  });

  it('creates, updates, and deletes labels through the self-hosted API', async () => {
    const label = {
      id: 'label_1',
      organizationId: 'org_1',
      projectId: null,
      name: 'Mobile',
      color: '#8B5CF6',
      description: null,
    };
    jest
      .mocked(globalThis.fetch)
      .mockResolvedValueOnce(jsonResponse(201, label))
      .mockResolvedValueOnce(jsonResponse(200, { ...label, name: 'Mobile app' }))
      .mockResolvedValueOnce(jsonResponse(200, { success: true, id: 'label_1' }));

    await createLabel({
      organizationId: 'org_1',
      name: 'Mobile',
      color: '#8B5CF6',
      description: null,
    });
    await updateLabel({
      labelId: 'label_1',
      name: 'Mobile app',
      color: '#06B6D4',
      description: 'Native client',
    });
    await deleteLabel('label_1');

    const [createUrl, createInit] = jest.mocked(globalThis.fetch).mock.calls[0] ?? [];
    const [updateUrl, updateInit] = jest.mocked(globalThis.fetch).mock.calls[1] ?? [];
    const [deleteUrl, deleteInit] = jest.mocked(globalThis.fetch).mock.calls[2] ?? [];

    expect(createUrl).toBe('https://tasks.example.com/api/labels');
    expect(createInit).toMatchObject({ method: 'POST' });
    expect(JSON.parse(String(createInit?.body))).toEqual({
      organizationId: 'org_1',
      name: 'Mobile',
      color: '#8B5CF6',
      description: null,
    });
    expect(updateUrl).toBe('https://tasks.example.com/api/labels/label_1');
    expect(updateInit).toMatchObject({ method: 'PATCH' });
    expect(JSON.parse(String(updateInit?.body))).toEqual({
      name: 'Mobile app',
      color: '#06B6D4',
      description: 'Native client',
    });
    expect(deleteUrl).toBe('https://tasks.example.com/api/labels/label_1');
    expect(deleteInit).toMatchObject({ method: 'DELETE' });
  });
});
