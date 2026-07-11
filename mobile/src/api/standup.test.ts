import { configureApi } from './client';
import { generateStandupPreview, getTodayStandup } from './endpoints';

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

describe('standup API', () => {
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

  it('returns null when today has no standup digest', async () => {
    jest.mocked(globalThis.fetch).mockResolvedValue(jsonResponse(204, undefined));

    await expect(getTodayStandup('org_1')).resolves.toBeNull();

    const [url] = jest.mocked(globalThis.fetch).mock.calls[0] ?? [];
    expect(url).toBe('https://tasks.example.com/api/users/me/standup/today?organizationId=org_1');
  });

  it('loads and normalizes today standup digest', async () => {
    jest.mocked(globalThis.fetch).mockResolvedValue(
      jsonResponse(200, {
        id: 'standup_1',
        date: '2026-06-29',
        contentMd: '- Shipped mobile auth',
        blockersMd: '',
        createdAt: '2026-06-29T08:00:00.000Z',
      }),
    );

    await expect(getTodayStandup()).resolves.toEqual({
      id: 'standup_1',
      date: '2026-06-29',
      contentMd: '- Shipped mobile auth',
      blockersMd: '',
      createdAt: '2026-06-29T08:00:00.000Z',
    });
  });

  it('generates a standup preview for the active organization', async () => {
    jest.mocked(globalThis.fetch).mockResolvedValue(
      jsonResponse(200, {
        ok: true,
        id: 'standup_2',
        date: '2026-06-29',
        contentMd: '- Reviewed deadlines',
        blockersMd: '- Waiting on design',
        createdAt: '2026-06-29T09:00:00.000Z',
      }),
    );

    await expect(generateStandupPreview('org_1')).resolves.toEqual({
      id: 'standup_2',
      date: '2026-06-29',
      contentMd: '- Reviewed deadlines',
      blockersMd: '- Waiting on design',
      createdAt: '2026-06-29T09:00:00.000Z',
    });

    const [url, init] = jest.mocked(globalThis.fetch).mock.calls[0] ?? [];
    expect(url).toBe('https://tasks.example.com/api/users/me/standup/preview');
    expect(init?.method).toBe('POST');
    expect(JSON.parse(String(init?.body))).toEqual({ organizationId: 'org_1' });
  });
});
