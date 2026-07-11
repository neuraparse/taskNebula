import { configureApi } from './client';
import { addComment, listComments, toggleCommentReaction, updateComment } from './endpoints';

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

describe('comment reactions API', () => {
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

  it('normalizes reactions returned with comments', async () => {
    jest.mocked(globalThis.fetch).mockResolvedValue(
      jsonResponse(200, {
        comments: [
          {
            id: 'comment_1',
            issueId: 'issue_1',
            content: 'Looks good',
            author: {
              id: 'user_1',
              name: 'Ada',
              email: 'ada@example.com',
            },
            createdAt: '2026-06-28T10:00:00.000Z',
            updatedAt: '2026-06-28T10:00:00.000Z',
            mentions: ['user_2', 42, 'user_3'],
            reactions: [
              { emoji: '👍', userId: 'user_1', createdAt: '2026-06-28T10:01:00.000Z' },
              { emoji: '🚀', userId: 'user_2' },
              { emoji: 'broken' },
            ],
          },
        ],
      }),
    );

    await expect(listComments('issue_1')).resolves.toEqual([
      {
        id: 'comment_1',
        issueId: 'issue_1',
        content: 'Looks good',
        author: {
          id: 'user_1',
          name: 'Ada',
          email: 'ada@example.com',
          image: null,
        },
        authorId: 'user_1',
        parentId: null,
        edited: false,
        createdAt: '2026-06-28T10:00:00.000Z',
        updatedAt: '2026-06-28T10:00:00.000Z',
        mentions: ['user_2', 'user_3'],
        reactions: [
          { emoji: '👍', userId: 'user_1', createdAt: '2026-06-28T10:01:00.000Z' },
          { emoji: '🚀', userId: 'user_2' },
        ],
      },
    ]);
  });

  it('toggles a comment reaction', async () => {
    jest.mocked(globalThis.fetch).mockResolvedValue(
      jsonResponse(200, {
        commentId: 'comment_1',
        reacted: true,
        reactions: [{ emoji: '👍', userId: 'user_1', createdAt: '2026-06-28T10:01:00.000Z' }],
      }),
    );

    await expect(
      toggleCommentReaction('issue_1', { commentId: 'comment_1', emoji: '👍' }),
    ).resolves.toEqual({
      commentId: 'comment_1',
      reacted: true,
      reactions: [{ emoji: '👍', userId: 'user_1', createdAt: '2026-06-28T10:01:00.000Z' }],
    });

    const [url, init] = jest.mocked(globalThis.fetch).mock.calls[0] ?? [];
    expect(url).toBe('https://tasks.example.com/api/issues/issue_1/comments/comment_1/reactions');
    expect(init).toMatchObject({ method: 'POST' });
    expect(JSON.parse(String(init?.body))).toEqual({ emoji: '👍' });
  });

  it('creates comments with mention ids', async () => {
    jest.mocked(globalThis.fetch).mockResolvedValue(
      jsonResponse(200, {
        id: 'comment_1',
        issueId: 'issue_1',
        content: '@Ada please review',
        mentions: ['user_2'],
      }),
    );

    await expect(
      addComment('issue_1', {
        content: '@Ada please review',
        mentions: ['user_2', ''],
      }),
    ).resolves.toMatchObject({
      id: 'comment_1',
      mentions: ['user_2'],
    });

    const [url, init] = jest.mocked(globalThis.fetch).mock.calls[0] ?? [];
    expect(url).toBe('https://tasks.example.com/api/issues/issue_1/comments');
    expect(init).toMatchObject({ method: 'POST' });
    expect(JSON.parse(String(init?.body))).toEqual({
      content: '@Ada please review',
      mentions: ['user_2'],
    });
  });

  it('updates comments with mention ids', async () => {
    jest.mocked(globalThis.fetch).mockResolvedValue(
      jsonResponse(200, {
        id: 'comment_1',
        issueId: 'issue_1',
        content: '@Grace shipped',
        mentions: ['user_3'],
      }),
    );

    await expect(
      updateComment('issue_1', {
        commentId: 'comment_1',
        content: '@Grace shipped',
        mentions: ['user_3'],
      }),
    ).resolves.toMatchObject({
      id: 'comment_1',
      mentions: ['user_3'],
    });

    const [url, init] = jest.mocked(globalThis.fetch).mock.calls[0] ?? [];
    expect(url).toBe('https://tasks.example.com/api/issues/issue_1/comments/comment_1');
    expect(init).toMatchObject({ method: 'PATCH' });
    expect(JSON.parse(String(init?.body))).toEqual({
      content: '@Grace shipped',
      mentions: ['user_3'],
    });
  });
});
