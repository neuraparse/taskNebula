import { listIssueActivities } from './endpoints';
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

describe('issue activities API', () => {
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

  it('lists and normalizes issue activities', async () => {
    jest.mocked(globalThis.fetch).mockResolvedValue(
      jsonResponse(200, {
        activities: [
          {
            id: 'act_1',
            issueId: 'issue_1',
            userId: 'user_1',
            type: 'updated',
            field: 'priority',
            oldValue: 'medium',
            newValue: 'high',
            metadata: { source: 'mobile' },
            createdAt: '2026-06-28T10:00:00.000Z',
            user: {
              id: 'user_1',
              name: 'Ada Lovelace',
              email: 'ada@example.com',
              image: null,
            },
          },
          {
            id: 'act_2',
            issueId: 'issue_1',
            type: 'commented',
            createdAt: '2026-06-28T10:05:00.000Z',
            user: null,
          },
          { id: 'missing-type', issueId: 'issue_1', createdAt: '2026-06-28T10:10:00.000Z' },
        ],
        total: 3,
      }),
    );

    await expect(listIssueActivities('issue_1')).resolves.toEqual([
      {
        id: 'act_1',
        issueId: 'issue_1',
        userId: 'user_1',
        type: 'updated',
        field: 'priority',
        oldValue: 'medium',
        newValue: 'high',
        metadata: { source: 'mobile' },
        createdAt: '2026-06-28T10:00:00.000Z',
        user: {
          id: 'user_1',
          name: 'Ada Lovelace',
          email: 'ada@example.com',
          image: null,
        },
      },
      {
        id: 'act_2',
        issueId: 'issue_1',
        type: 'commented',
        field: null,
        oldValue: null,
        newValue: null,
        createdAt: '2026-06-28T10:05:00.000Z',
        user: null,
      },
    ]);
    expect(jest.mocked(globalThis.fetch).mock.calls[0]?.[0]).toBe(
      'https://tasks.example.com/api/issues/issue_1/activities',
    );
  });
});
