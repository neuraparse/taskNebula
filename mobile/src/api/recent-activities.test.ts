import { listRecentActivities } from './endpoints';
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

describe('recent activities API', () => {
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

  it('lists and normalizes recent activities', async () => {
    jest.mocked(globalThis.fetch).mockResolvedValue(
      jsonResponse(200, {
        activities: [
          {
            id: 'activity_1',
            action: 'issue.priority_changed',
            type: 'issue',
            messageKey: 'changedPriorityTo',
            messageValues: {
              priority: 'high',
              status: 'Done',
              count: 2,
              cleared: null,
              ignored: { nested: true },
              invalid: true,
            },
            user: {
              id: 'user_1',
              name: 'Ada Lovelace',
              email: 'ada@example.com',
              image: null,
            },
            issue: {
              id: 'issue_1',
              key: 'MOB-12',
              title: 'Ship mobile activity feed',
            },
            createdAt: '2026-06-28T10:00:00.000Z',
            metadata: { source: 'mobile' },
          },
          {
            id: 'activity_2',
            action: 'project.created',
            type: 'project',
            message: 'created project',
            user: {
              id: 'user_2',
              name: null,
              email: 'grace@example.com',
            },
            issue: {
              id: 'project_1',
              key: 42,
              title: 'Invalid issue payload',
            },
            createdAt: '2026-06-28T11:00:00.000Z',
          },
          {
            id: 'activity_3',
            action: 'issue.updated',
            type: 'issue',
            createdAt: '2026-06-28T12:00:00.000Z',
            user: null,
          },
          { id: 'missing-action' },
        ],
      }),
    );

    await expect(listRecentActivities({ organizationId: 'org_1', limit: 5 })).resolves.toEqual([
      {
        id: 'activity_1',
        action: 'issue.priority_changed',
        type: 'issue',
        messageKey: 'changedPriorityTo',
        messageValues: {
          priority: 'high',
          status: 'Done',
          count: 2,
          cleared: null,
        },
        user: {
          id: 'user_1',
          name: 'Ada Lovelace',
          email: 'ada@example.com',
          image: null,
        },
        issue: {
          id: 'issue_1',
          key: 'MOB-12',
          title: 'Ship mobile activity feed',
        },
        createdAt: '2026-06-28T10:00:00.000Z',
        metadata: { source: 'mobile' },
      },
      {
        id: 'activity_2',
        action: 'project.created',
        type: 'project',
        message: 'created project',
        user: {
          id: 'user_2',
          name: null,
          email: 'grace@example.com',
          image: null,
        },
        issue: null,
        createdAt: '2026-06-28T11:00:00.000Z',
      },
    ]);

    expect(jest.mocked(globalThis.fetch).mock.calls[0]?.[0]).toBe(
      'https://tasks.example.com/api/activities/recent?organizationId=org_1&limit=5',
    );
  });
});
