import { deleteDraft, listDrafts, updateDraft } from './endpoints';
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

describe('drafts API', () => {
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

  it('normalizes current-user drafts', async () => {
    jest.mocked(globalThis.fetch).mockResolvedValue(
      jsonResponse(200, {
        drafts: [
          {
            id: 'draft_1',
            title: null,
            content: 'Draft body',
            entityType: 'issue',
            targetProjectId: 'project_1',
            metadata: { source: 'mobile' },
            updatedAt: '2026-06-28T08:00:00.000Z',
          },
          { title: 'missing id' },
        ],
      }),
    );

    await expect(listDrafts()).resolves.toEqual([
      {
        id: 'draft_1',
        title: '',
        content: 'Draft body',
        entityType: 'issue',
        targetProjectId: 'project_1',
        metadata: { source: 'mobile' },
        updatedAt: '2026-06-28T08:00:00.000Z',
      },
    ]);
  });

  it('patches draft fields without sending absent optional values', async () => {
    jest.mocked(globalThis.fetch).mockResolvedValue(
      jsonResponse(200, {
        draft: {
          id: 'draft_1',
          title: 'Updated',
          content: null,
          entityType: 'doc',
          metadata: {},
        },
      }),
    );

    await updateDraft({
      id: 'draft_1',
      title: 'Updated',
      content: null,
      entityType: 'doc',
      targetProjectId: null,
    });

    const [url, init] = jest.mocked(globalThis.fetch).mock.calls[0] ?? [];
    expect(url).toBe('https://tasks.example.com/api/drafts/draft_1');
    expect(init).toMatchObject({ method: 'PATCH' });
    expect(JSON.parse(String(init?.body))).toEqual({
      title: 'Updated',
      content: null,
      entityType: 'doc',
      targetProjectId: null,
    });
  });

  it('deletes a draft by id', async () => {
    jest.mocked(globalThis.fetch).mockResolvedValue(jsonResponse(200, { success: true }));

    await deleteDraft('draft_1');

    expect(globalThis.fetch).toHaveBeenCalledWith(
      'https://tasks.example.com/api/drafts/draft_1',
      expect.objectContaining({ method: 'DELETE' }),
    );
  });
});
