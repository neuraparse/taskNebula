import { draftIssueWithAi } from './endpoints';
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

describe('AI issue draft API', () => {
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

  it('generates and normalizes an issue draft', async () => {
    jest.mocked(globalThis.fetch).mockResolvedValue(
      jsonResponse(200, {
        provider: 'native',
        draft: {
          type: 'bug',
          title: 'Handle expired sessions',
          description: 'Show a clear login error when a session expires.',
          priority: 'high',
          labels: ['mobile', 'auth', 42],
          estimate: '3',
        },
      }),
    );

    await expect(
      draftIssueWithAi({
        projectId: 'project_1',
        prompt: 'Mobile users need a better expired session error.',
      }),
    ).resolves.toEqual({
      provider: 'native',
      draft: {
        type: 'bug',
        title: 'Handle expired sessions',
        description: 'Show a clear login error when a session expires.',
        priority: 'high',
        labels: ['mobile', 'auth'],
        estimate: 3,
      },
    });

    const [url, init] = jest.mocked(globalThis.fetch).mock.calls[0] ?? [];
    expect(url).toBe('https://tasks.example.com/api/ai/draft-issue');
    expect(init).toMatchObject({ method: 'POST' });
    expect(JSON.parse(String(init?.body))).toEqual({
      projectId: 'project_1',
      prompt: 'Mobile users need a better expired session error.',
    });
  });
});
