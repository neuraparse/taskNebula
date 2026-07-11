import { configureApi } from './client';
import { getUserAppearance, updateUserAppearance } from './endpoints';

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

describe('user appearance API', () => {
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

  it('loads and normalizes account appearance settings', async () => {
    jest.mocked(globalThis.fetch).mockResolvedValue(
      jsonResponse(200, {
        settings: {
          userId: 'user_1',
          theme: 'invalid',
          colorTheme: 'ocean',
          visualStyle: 'glass',
          interfaceFont: 'brand',
          animationsEnabled: false,
          gradientsEnabled: true,
          updatedAt: '2026-06-29T10:00:00.000Z',
        },
      }),
    );

    await expect(getUserAppearance()).resolves.toEqual({
      userId: 'user_1',
      theme: 'system',
      colorTheme: 'ocean',
      visualStyle: 'glass',
      interfaceFont: 'brand',
      animationsEnabled: false,
      gradientsEnabled: true,
      updatedAt: '2026-06-29T10:00:00.000Z',
    });

    const [url] = jest.mocked(globalThis.fetch).mock.calls[0] ?? [];
    expect(url).toBe('https://tasks.example.com/api/user/appearance');
  });

  it('updates account appearance through the web route', async () => {
    jest.mocked(globalThis.fetch).mockResolvedValue(
      jsonResponse(200, {
        settings: {
          userId: 'user_1',
          theme: 'dark',
          colorTheme: 'forest',
          visualStyle: 'minimal',
          interfaceFont: 'ibm',
          animationsEnabled: true,
          gradientsEnabled: false,
          updatedAt: '2026-06-29T11:00:00.000Z',
        },
      }),
    );

    await expect(
      updateUserAppearance({
        theme: 'dark',
        colorTheme: 'forest',
        visualStyle: 'minimal',
        interfaceFont: 'ibm',
        animationsEnabled: true,
        gradientsEnabled: false,
      }),
    ).resolves.toEqual(
      expect.objectContaining({
        theme: 'dark',
        colorTheme: 'forest',
        visualStyle: 'minimal',
        gradientsEnabled: false,
      }),
    );

    const [url, init] = jest.mocked(globalThis.fetch).mock.calls[0] ?? [];
    expect(url).toBe('https://tasks.example.com/api/user/appearance');
    expect(init).toMatchObject({ method: 'PUT' });
    expect(JSON.parse(String(init?.body))).toEqual({
      theme: 'dark',
      colorTheme: 'forest',
      visualStyle: 'minimal',
      interfaceFont: 'ibm',
      animationsEnabled: true,
      gradientsEnabled: false,
    });
  });
});
