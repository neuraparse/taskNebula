import { apiFetch, ApiError, configureApi, setUnauthorizedHandler } from './client';

const originalFetch = globalThis.fetch;

function textResponse(status: number, body: unknown): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    statusText: status === 401 ? 'Unauthorized' : `HTTP ${status}`,
    text: jest.fn().mockResolvedValue(JSON.stringify(body)),
    json: jest.fn().mockResolvedValue(body),
  } as unknown as Response;
}

describe('API client', () => {
  beforeAll(() => {
    globalThis.fetch = jest.fn() as unknown as typeof fetch;
  });

  beforeEach(() => {
    jest.mocked(globalThis.fetch).mockReset();
    configureApi({ baseUrl: null, cookie: null });
    setUnauthorizedHandler(null);
  });

  afterAll(() => {
    globalThis.fetch = originalFetch;
  });

  it('runs the unauthorized handler when apiFetch receives a 401', async () => {
    const onUnauthorized = jest.fn();
    configureApi({ baseUrl: 'https://tasks.example.com', cookie: 'authjs.session-token=s1' });
    setUnauthorizedHandler(onUnauthorized);
    jest.mocked(globalThis.fetch).mockResolvedValue(textResponse(401, { error: 'Unauthorized' }));

    await expect(apiFetch('/api/projects')).rejects.toBeInstanceOf(ApiError);

    expect(onUnauthorized).toHaveBeenCalledTimes(1);
    expect(globalThis.fetch).toHaveBeenCalledWith(
      'https://tasks.example.com/api/projects',
      expect.objectContaining({
        headers: expect.objectContaining({
          Cookie: 'authjs.session-token=s1',
        }),
      }),
    );
  });
});
