import { dispatchIssueAgent, listIssueAgentSessions } from './endpoints';
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

describe('issue agent sessions API', () => {
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

  it('lists and normalizes issue agent sessions', async () => {
    jest.mocked(globalThis.fetch).mockResolvedValue(
      jsonResponse(200, {
        sessions: [
          {
            id: 'session_1',
            issueId: 'issue_1',
            provider: 'codex',
            externalId: null,
            state: 'active',
            payload: {
              localRun: {
                command: 'codex',
                status: 'running',
                exitCode: null,
              },
            },
            startedAt: '2026-06-29T10:00:00.000Z',
            updatedAt: '2026-06-29T10:01:00.000Z',
            finishedAt: null,
          },
          { id: 'missing-issue' },
        ],
      }),
    );

    await expect(listIssueAgentSessions('issue_1')).resolves.toEqual({
      sessions: [
        {
          id: 'session_1',
          issueId: 'issue_1',
          provider: 'codex',
          externalId: null,
          state: 'active',
          payload: {
            localRun: {
              command: 'codex',
              status: 'running',
              exitCode: null,
            },
          },
          startedAt: '2026-06-29T10:00:00.000Z',
          updatedAt: '2026-06-29T10:01:00.000Z',
          finishedAt: null,
        },
      ],
    });
    expect(jest.mocked(globalThis.fetch).mock.calls[0]?.[0]).toBe(
      'https://tasks.example.com/api/issues/issue_1/agent-sessions',
    );
  });

  it('dispatches an issue agent session', async () => {
    jest.mocked(globalThis.fetch).mockResolvedValue(
      jsonResponse(200, {
        sessionId: 'session_2',
        provider: 'codex',
        state: 'active',
        runner: 'local_cli',
        callbackUrl: 'https://tasks.example.com/api/webhooks/agent-session/codex',
      }),
    );

    await expect(
      dispatchIssueAgent('issue_1', {
        provider: 'codex',
        promptOverride: 'Open a small PR',
      }),
    ).resolves.toEqual({
      sessionId: 'session_2',
      provider: 'codex',
      state: 'active',
      runner: 'local_cli',
      callbackUrl: 'https://tasks.example.com/api/webhooks/agent-session/codex',
    });

    const [url, init] = jest.mocked(globalThis.fetch).mock.calls[0] ?? [];
    expect(url).toBe('https://tasks.example.com/api/issues/issue_1/dispatch-agent');
    expect(init).toMatchObject({ method: 'POST' });
    expect(JSON.parse(String(init?.body))).toEqual({
      provider: 'codex',
      prompt_override: 'Open a small PR',
    });
  });
});
