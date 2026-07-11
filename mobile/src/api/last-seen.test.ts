import { configureApi } from './client';
import { getLastSeen, updateLastSeen } from './endpoints';

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

describe('last-seen API', () => {
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

  it('loads the previous dashboard last-seen timestamp', async () => {
    jest
      .mocked(globalThis.fetch)
      .mockResolvedValue(jsonResponse(200, { lastSeenAt: '2026-06-29T08:00:00.000Z' }));

    await expect(getLastSeen()).resolves.toBe('2026-06-29T08:00:00.000Z');

    const [url] = jest.mocked(globalThis.fetch).mock.calls[0] ?? [];
    expect(url).toBe('https://tasks.example.com/api/user/last-seen');
  });

  it('normalizes an empty last-seen value to null', async () => {
    jest.mocked(globalThis.fetch).mockResolvedValue(jsonResponse(200, { lastSeenAt: null }));

    await expect(getLastSeen()).resolves.toBeNull();
  });

  it('advances the dashboard last-seen timestamp', async () => {
    jest
      .mocked(globalThis.fetch)
      .mockResolvedValue(jsonResponse(200, { lastSeenAt: '2026-06-29T10:00:00.000Z' }));

    await expect(updateLastSeen()).resolves.toBe('2026-06-29T10:00:00.000Z');

    const [url, init] = jest.mocked(globalThis.fetch).mock.calls[0] ?? [];
    expect(url).toBe('https://tasks.example.com/api/user/last-seen');
    expect(init?.method).toBe('POST');
  });
});
