import { configureApi } from './client';
import {
  getCatchMeUp,
  listInbox,
  listInboxPage,
  markNotificationRead,
  snoozeInboxNotification,
} from './endpoints';

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

describe('inbox API', () => {
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

  it('sends inbox filter chips as web API query parameters', async () => {
    jest.mocked(globalThis.fetch).mockResolvedValue(
      jsonResponse(200, {
        items: [
          {
            id: 'notification_1',
            type: 'mention',
            title: 'Mentioned in WEB-1',
            actorType: 'agent',
            isRead: false,
            snoozedUntil: '2026-06-29T10:00:00.000Z',
          },
        ],
      }),
    );

    await expect(
      listInbox({
        actorType: 'agent',
        notificationType: 'mention',
        snoozed: true,
        unreadOnly: true,
      }),
    ).resolves.toEqual([
      expect.objectContaining({
        id: 'notification_1',
        actorType: 'agent',
        isRead: false,
        snoozedUntil: '2026-06-29T10:00:00.000Z',
      }),
    ]);

    const [url] = jest.mocked(globalThis.fetch).mock.calls[0] ?? [];
    expect(url).toBe(
      'https://tasks.example.com/api/inbox?unread=true&snoozed=true&actor_type=agent&notification_type=mention',
    );
  });

  it('keeps the previous unread-only boolean shorthand working', async () => {
    jest.mocked(globalThis.fetch).mockResolvedValue(jsonResponse(200, { items: [] }));

    await expect(listInbox(true)).resolves.toEqual([]);

    const [url] = jest.mocked(globalThis.fetch).mock.calls[0] ?? [];
    expect(url).toBe('https://tasks.example.com/api/inbox?unread=true');
  });

  it('fetches cursor inbox pages with project and date filters', async () => {
    jest.mocked(globalThis.fetch).mockResolvedValue(
      jsonResponse(200, {
        items: [
          {
            id: 'notification_2',
            type: 'comment',
            title: 'New comment',
            isRead: true,
            projectId: 'project_1',
            link: '/projects/project_1/settings?tab=ai-agents',
          },
        ],
        nextCursor: 'cursor_2',
      }),
    );

    await expect(
      listInboxPage({
        actorType: 'user',
        notificationType: 'comment',
        projectId: 'project_1',
        since: '2026-06-28T00:00:00.000Z',
        until: '2026-06-29T00:00:00.000Z',
        cursor: 'cursor_1',
        limit: 15,
      }),
    ).resolves.toEqual({
      items: [
        expect.objectContaining({
          id: 'notification_2',
          projectId: 'project_1',
          link: '/projects/project_1/settings?tab=ai-agents',
          isRead: true,
        }),
      ],
      nextCursor: 'cursor_2',
    });

    const [url] = jest.mocked(globalThis.fetch).mock.calls[0] ?? [];
    expect(url).toBe(
      'https://tasks.example.com/api/inbox?actor_type=user&notification_type=comment&project=project_1&since=2026-06-28T00%3A00%3A00.000Z&until=2026-06-29T00%3A00%3A00.000Z&cursor=cursor_1&limit=15',
    );
  });

  it('fetches and normalizes catch-me-up digests', async () => {
    jest.mocked(globalThis.fetch).mockResolvedValue(
      jsonResponse(200, {
        summary_markdown: '### Since yesterday\\n- Ada mentioned you on MOB-12.',
        action_items: [
          {
            title: 'Reply on MOB-12',
            link: '/issues/issue_1',
            urgency: 'high',
          },
          {
            title: 'Open mobile project',
            link: '/projects/project_1',
          },
          {
            title: 'Missing link',
            urgency: 'medium',
          },
        ],
        since: '2026-06-28T10:00:00.000Z',
        source: 'native',
      }),
    );

    await expect(getCatchMeUp({ since: '2026-06-28T10:00:00.000Z' })).resolves.toEqual({
      summaryMarkdown: '### Since yesterday\\n- Ada mentioned you on MOB-12.',
      actionItems: [
        {
          title: 'Reply on MOB-12',
          link: '/issues/issue_1',
          urgency: 'high',
        },
        {
          title: 'Open mobile project',
          link: '/projects/project_1',
          urgency: 'low',
        },
      ],
      since: '2026-06-28T10:00:00.000Z',
      source: 'native',
    });

    const [url] = jest.mocked(globalThis.fetch).mock.calls[0] ?? [];
    expect(url).toBe(
      'https://tasks.example.com/api/inbox/catch-me-up?since=2026-06-28T10%3A00%3A00.000Z',
    );
  });

  it('snoozes and unsnoozes inbox notifications', async () => {
    jest
      .mocked(globalThis.fetch)
      .mockResolvedValueOnce(
        jsonResponse(200, {
          id: 'notification_1',
          type: 'mention',
          title: 'Mentioned in MOB-1',
          isRead: false,
          snoozedUntil: '2026-06-29T12:00:00.000Z',
        }),
      )
      .mockResolvedValueOnce(
        jsonResponse(200, {
          id: 'notification_1',
          type: 'mention',
          title: 'Mentioned in MOB-1',
          isRead: false,
          snoozedUntil: null,
        }),
      );

    await expect(
      snoozeInboxNotification({
        notificationId: 'notification_1',
        until: '2026-06-29T12:00:00.000Z',
      }),
    ).resolves.toEqual(
      expect.objectContaining({
        id: 'notification_1',
        snoozedUntil: '2026-06-29T12:00:00.000Z',
      }),
    );

    await expect(
      snoozeInboxNotification({ notificationId: 'notification_1', until: null }),
    ).resolves.toEqual(
      expect.objectContaining({
        id: 'notification_1',
        snoozedUntil: null,
      }),
    );

    const [snoozeUrl, snoozeInit] = jest.mocked(globalThis.fetch).mock.calls[0] ?? [];
    const [unsnoozeUrl, unsnoozeInit] = jest.mocked(globalThis.fetch).mock.calls[1] ?? [];
    expect(snoozeUrl).toBe('https://tasks.example.com/api/inbox/notification_1/snooze');
    expect(snoozeInit).toMatchObject({
      method: 'POST',
      body: JSON.stringify({ until: '2026-06-29T12:00:00.000Z' }),
    });
    expect(unsnoozeUrl).toBe('https://tasks.example.com/api/inbox/notification_1/snooze');
    expect(unsnoozeInit).toMatchObject({
      method: 'POST',
      body: JSON.stringify({ until: null }),
    });
  });

  it('marks a single inbox notification as read through the inbox endpoint', async () => {
    jest.mocked(globalThis.fetch).mockResolvedValue(
      jsonResponse(200, {
        id: 'notification_1',
        type: 'mention',
        title: 'Mentioned in MOB-1',
        isRead: true,
      }),
    );

    await expect(markNotificationRead('notification_1')).resolves.toEqual(
      expect.objectContaining({
        id: 'notification_1',
        isRead: true,
      }),
    );

    const [url, init] = jest.mocked(globalThis.fetch).mock.calls[0] ?? [];
    expect(url).toBe('https://tasks.example.com/api/inbox/notification_1/mark-read');
    expect(init).toMatchObject({ method: 'POST' });
  });
});
