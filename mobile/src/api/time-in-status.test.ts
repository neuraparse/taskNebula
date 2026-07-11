import { listIssueTimeInStatus } from './endpoints';
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

describe('time in status API', () => {
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

  it('lists and normalizes issue time-in-status buckets', async () => {
    jest.mocked(globalThis.fetch).mockResolvedValue(
      jsonResponse(200, [
        {
          status: 'status_todo',
          status_name: 'Todo',
          status_category: 'todo',
          total_duration_seconds: '3600',
          entered_at_last: '2026-06-28T10:00:00.000Z',
          exit_count: '1',
        },
        {
          status: 'status_done',
          status_name: 'Done',
          status_category: null,
          total_duration_seconds: 120,
          entered_at_last: null,
          exit_count: 0,
        },
        { status: 'missing-duration' },
      ]),
    );

    await expect(listIssueTimeInStatus('issue_1')).resolves.toEqual([
      {
        status: 'status_todo',
        statusName: 'Todo',
        statusCategory: 'todo',
        totalDurationSeconds: 3600,
        enteredAtLast: '2026-06-28T10:00:00.000Z',
        exitCount: 1,
      },
      {
        status: 'status_done',
        statusName: 'Done',
        statusCategory: null,
        totalDurationSeconds: 120,
        enteredAtLast: null,
        exitCount: 0,
      },
    ]);
    expect(jest.mocked(globalThis.fetch).mock.calls[0]?.[0]).toBe(
      'https://tasks.example.com/api/issues/issue_1/time-in-status',
    );
  });
});
