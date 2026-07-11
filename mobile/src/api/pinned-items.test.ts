import { configureApi } from './client';
import { deletePinnedItem, listPinnedItems } from './endpoints';

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

describe('pinned items API', () => {
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

  it('loads and normalizes dashboard pinned items', async () => {
    jest.mocked(globalThis.fetch).mockResolvedValue(
      jsonResponse(200, {
        items: [
          {
            id: 'pin_1',
            userId: 'user_1',
            kind: 'issue',
            entityId: 'issue_1',
            title: 'Fix mobile auth',
            href: '/issues/issue_1',
            pinnedAt: '2026-06-29T09:00:00.000Z',
          },
          {
            id: 'pin_2',
            kind: 'view',
            title: 'Triage',
            href: '/projects/project_1/views',
            createdAt: '2026-06-29T08:00:00.000Z',
          },
          { id: 'missing-title', href: '/issues/issue_2' },
        ],
      }),
    );

    await expect(listPinnedItems()).resolves.toEqual([
      {
        id: 'pin_1',
        userId: 'user_1',
        kind: 'issue',
        entityId: 'issue_1',
        title: 'Fix mobile auth',
        href: '/issues/issue_1',
        pinnedAt: '2026-06-29T09:00:00.000Z',
      },
      {
        id: 'pin_2',
        userId: null,
        kind: 'view',
        entityId: null,
        title: 'Triage',
        href: '/projects/project_1/views',
        pinnedAt: '2026-06-29T08:00:00.000Z',
      },
    ]);

    const [url] = jest.mocked(globalThis.fetch).mock.calls[0] ?? [];
    expect(url).toBe('https://tasks.example.com/api/pinned-items');
  });

  it('deletes pinned items through the web API route', async () => {
    jest.mocked(globalThis.fetch).mockResolvedValue(jsonResponse(200, { success: true }));

    await expect(deletePinnedItem('pin_1')).resolves.toEqual({ success: true });

    const [url, init] = jest.mocked(globalThis.fetch).mock.calls[0] ?? [];
    expect(url).toBe('https://tasks.example.com/api/pinned-items/pin_1');
    expect(init?.method).toBe('DELETE');
  });
});
