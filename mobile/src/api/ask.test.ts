import { askTaskNebula } from './endpoints';
import { configureApi } from './client';

const originalFetch = globalThis.fetch;

function textResponse(status: number, body: string): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    statusText: status >= 200 && status < 300 ? 'OK' : 'Error',
    json: jest.fn().mockResolvedValue({}),
    text: jest.fn().mockResolvedValue(body),
  } as unknown as Response;
}

describe('Ask TaskNebula API', () => {
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

  it('parses the Ask SSE response into answer, sources, citations, and usage', async () => {
    jest
      .mocked(globalThis.fetch)
      .mockResolvedValue(
        textResponse(
          200,
          [
            'data: {"type":"sources","sources":[{"type":"issue","id":"issue_1","key":"TN-1","title":"Login bug","snippet":"Users cannot log in.","url":"/issues/TN-1"}]}',
            '',
            'data: {"type":"token","text":"Login is blocked "}',
            '',
            'data: {"type":"token","text":"by TN-1."}',
            '',
            'data: {"type":"citations","citations":[{"type":"issue","id":"issue_1","key":"TN-1","title":"Login bug","snippet":"Users cannot log in.","url":"/issues/TN-1","occurrence":1}]}',
            '',
            'data: {"type":"done","usage":{"model":"claude-sonnet-4-6","inputTokens":10,"outputTokens":"5","costUsd":"0.001","latencyMs":1200,"reranked":true,"promptHash":"hash"}}',
            '',
          ].join('\n'),
        ),
      );

    await expect(
      askTaskNebula({
        query: 'Why is login blocked?',
        organizationId: 'org_1',
        scope: 'issues',
      }),
    ).resolves.toEqual({
      answer: 'Login is blocked by TN-1.',
      sources: [
        {
          type: 'issue',
          id: 'issue_1',
          key: 'TN-1',
          title: 'Login bug',
          snippet: 'Users cannot log in.',
          url: '/issues/TN-1',
        },
      ],
      citations: [
        {
          type: 'issue',
          id: 'issue_1',
          key: 'TN-1',
          title: 'Login bug',
          snippet: 'Users cannot log in.',
          url: '/issues/TN-1',
          occurrence: 1,
        },
      ],
      usage: {
        model: 'claude-sonnet-4-6',
        inputTokens: 10,
        outputTokens: 5,
        costUsd: 0.001,
        latencyMs: 1200,
        reranked: true,
        promptHash: 'hash',
      },
    });

    const [url, init] = jest.mocked(globalThis.fetch).mock.calls[0] ?? [];
    expect(url).toBe('https://tasks.example.com/api/ask');
    expect(init).toMatchObject({ method: 'POST' });
    expect(JSON.parse(String(init?.body))).toEqual({
      query: 'Why is login blocked?',
      organizationId: 'org_1',
      scope: 'issues',
    });
  });
});
