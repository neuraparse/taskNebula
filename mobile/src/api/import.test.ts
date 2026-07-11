import { configureApi } from './client';
import { getImportJob, previewImport, runImport } from './endpoints';

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

describe('import API', () => {
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

  it('previews and normalizes import samples', async () => {
    jest.mocked(globalThis.fetch).mockResolvedValue(
      jsonResponse(200, {
        source: 'csv',
        total: '2',
        sample: [
          {
            key: 'ROW-1',
            title: 'Fix mobile import',
            description: null,
            status: 'Todo',
            priority: 'High',
            labels: ['mobile', 42, 'import'],
            assigneeEmail: 'ada@example.com',
          },
          { key: 'missing-title' },
        ],
        suggestedMapping: {
          title: 'Title',
          priority: 'Priority',
          ignored: 42,
        },
      }),
    );

    await expect(
      previewImport('csv', {
        workspaceId: 'org_1',
        csvText: 'Title,Priority\\nFix mobile import,High',
        columns: {},
      }),
    ).resolves.toEqual({
      source: 'csv',
      total: 2,
      sample: [
        {
          key: 'ROW-1',
          title: 'Fix mobile import',
          description: null,
          status: 'Todo',
          priority: 'High',
          labels: ['mobile', 'import'],
          assigneeEmail: 'ada@example.com',
        },
      ],
      suggestedMapping: {
        title: 'Title',
        priority: 'Priority',
      },
    });

    const [url, init] = jest.mocked(globalThis.fetch).mock.calls[0] ?? [];
    expect(url).toBe('https://tasks.example.com/api/import/csv/preview');
    expect(init).toMatchObject({ method: 'POST' });
    expect(JSON.parse(String(init?.body))).toEqual({
      workspaceId: 'org_1',
      csvText: 'Title,Priority\\nFix mobile import,High',
      columns: {},
    });
  });

  it('runs imports with the web-compatible body shape', async () => {
    jest
      .mocked(globalThis.fetch)
      .mockResolvedValue(jsonResponse(201, { jobId: 'job_1', status: 'pending' }));

    await expect(
      runImport('csv', {
        workspaceId: 'org_1',
        projectId: 'project_1',
        mapping: {
          columns: { title: 'Title' },
          config: { workspaceId: 'org_1', csvText: 'Title\\nFix import' },
        },
        csvText: 'Title\\nFix import',
      }),
    ).resolves.toEqual({ jobId: 'job_1', status: 'pending' });

    const [url, init] = jest.mocked(globalThis.fetch).mock.calls[0] ?? [];
    expect(url).toBe('https://tasks.example.com/api/import/csv/run');
    expect(init).toMatchObject({ method: 'POST' });
    expect(JSON.parse(String(init?.body))).toEqual({
      workspaceId: 'org_1',
      projectId: 'project_1',
      mapping: {
        columns: { title: 'Title' },
        config: { workspaceId: 'org_1', csvText: 'Title\\nFix import' },
      },
      csvText: 'Title\\nFix import',
    });
  });

  it('loads import job progress and errors', async () => {
    jest.mocked(globalThis.fetch).mockResolvedValue(
      jsonResponse(200, {
        id: 'job_1',
        workspaceId: 'org_1',
        source: 'csv',
        status: 'failed',
        total: '3',
        processed: '2',
        errors: [{ key: 'ROW-3', message: 'Missing title' }, { message: null }],
        createdAt: '2026-06-28T08:00:00.000Z',
        finishedAt: '2026-06-28T08:01:00.000Z',
      }),
    );

    await expect(getImportJob('job_1')).resolves.toEqual({
      id: 'job_1',
      workspaceId: 'org_1',
      source: 'csv',
      status: 'failed',
      total: 3,
      processed: 2,
      errors: [{ key: 'ROW-3', message: 'Missing title' }],
      createdAt: '2026-06-28T08:00:00.000Z',
      finishedAt: '2026-06-28T08:01:00.000Z',
    });
    expect(jest.mocked(globalThis.fetch).mock.calls[0]?.[0]).toBe(
      'https://tasks.example.com/api/import/jobs/job_1',
    );
  });
});
