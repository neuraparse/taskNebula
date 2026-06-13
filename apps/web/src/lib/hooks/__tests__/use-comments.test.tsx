import type { ReactNode } from 'react';
import { act, renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import {
  COMMENT_HAS_REPLIES_ERROR,
  useComments,
  useCreateComment,
  useDeleteComment,
  useToggleCommentReaction,
  useUpdateComment,
  type Comment,
} from '../use-comments';

const fetchMock = jest.fn();

function createQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });
}

function createWrapper(queryClient: QueryClient) {
  return function Wrapper({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
  };
}

describe('use-comments hooks', () => {
  beforeEach(() => {
    fetchMock.mockReset();
    global.fetch = fetchMock as unknown as typeof fetch;
  });

  describe('useComments', () => {
    it('fetches comments for the given issue', async () => {
      fetchMock.mockResolvedValue({
        ok: true,
        json: async () => ({
          comments: [
            {
              id: 'comment-1',
              content: 'Looks great',
              author: { id: 'user-1', name: 'Alice', email: 'alice@example.com' },
              createdAt: '2026-04-01T00:00:00.000Z',
            },
          ],
        }),
      });

      const { result } = renderHook(() => useComments('issue-1'), {
        wrapper: createWrapper(createQueryClient()),
      });

      await waitFor(() => {
        expect(result.current.data).toHaveLength(1);
      });

      expect(fetchMock).toHaveBeenCalledWith('/api/issues/issue-1/comments');
      expect(result.current.data?.[0].id).toBe('comment-1');
    });

    it('surfaces an error when the comments response is not ok', async () => {
      fetchMock.mockResolvedValue({ ok: false });

      const { result } = renderHook(() => useComments('issue-1'), {
        wrapper: createWrapper(createQueryClient()),
      });

      await waitFor(() => {
        expect(result.current.isError).toBe(true);
      });

      expect(result.current.error?.message).toBe('Failed to fetch comments');
    });
  });

  describe('useCreateComment', () => {
    it('POSTs the comment content to the issue comments endpoint', async () => {
      fetchMock.mockResolvedValue({
        ok: true,
        json: async () => ({ id: 'comment-1', content: 'New comment' }),
      });

      const { result } = renderHook(() => useCreateComment('issue-1'), {
        wrapper: createWrapper(createQueryClient()),
      });

      await act(async () => {
        await result.current.mutateAsync('New comment');
      });

      expect(fetchMock).toHaveBeenCalledWith('/api/issues/issue-1/comments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: 'New comment' }),
      });
    });

    it('throws a generic error when comment creation fails', async () => {
      fetchMock.mockResolvedValue({
        ok: false,
        json: async () => ({}),
      });

      const { result } = renderHook(() => useCreateComment('issue-1'), {
        wrapper: createWrapper(createQueryClient()),
      });

      await expect(
        act(async () => {
          await result.current.mutateAsync('boom');
        })
      ).rejects.toThrow('Failed to create comment');
    });

    it('invalidates the comments query on successful creation', async () => {
      const queryClient = createQueryClient();
      const invalidateQueriesSpy = jest.spyOn(queryClient, 'invalidateQueries');

      fetchMock.mockResolvedValue({
        ok: true,
        json: async () => ({ id: 'comment-1' }),
      });

      const { result } = renderHook(() => useCreateComment('issue-1'), {
        wrapper: createWrapper(queryClient),
      });

      await act(async () => {
        await result.current.mutateAsync('New comment');
      });

      expect(invalidateQueriesSpy).toHaveBeenCalledWith({ queryKey: ['comments', 'issue-1'] });
    });

    it('includes mentions in the payload when provided', async () => {
      fetchMock.mockResolvedValue({
        ok: true,
        json: async () => ({ id: 'comment-1' }),
      });

      const { result } = renderHook(() => useCreateComment('issue-1'), {
        wrapper: createWrapper(createQueryClient()),
      });

      await act(async () => {
        await result.current.mutateAsync({ content: 'Hi @alice', mentions: ['user-2'] });
      });

      expect(fetchMock).toHaveBeenCalledWith('/api/issues/issue-1/comments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: 'Hi @alice', mentions: ['user-2'] }),
      });
    });
  });

  describe('useUpdateComment', () => {
    it('PATCHes the new content and invalidates the comments query', async () => {
      const queryClient = createQueryClient();
      const invalidateQueriesSpy = jest.spyOn(queryClient, 'invalidateQueries');

      fetchMock.mockResolvedValue({
        ok: true,
        json: async () => ({ id: 'comment-1', content: 'Updated' }),
      });

      const { result } = renderHook(() => useUpdateComment('issue-1'), {
        wrapper: createWrapper(queryClient),
      });

      await act(async () => {
        await result.current.mutateAsync({ commentId: 'comment-1', content: 'Updated' });
      });

      expect(fetchMock).toHaveBeenCalledWith('/api/issues/issue-1/comments/comment-1', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: 'Updated' }),
      });
      expect(invalidateQueriesSpy).toHaveBeenCalledWith({ queryKey: ['comments', 'issue-1'] });
    });

    it('throws a generic error when the update fails', async () => {
      fetchMock.mockResolvedValue({ ok: false, status: 500 });

      const { result } = renderHook(() => useUpdateComment('issue-1'), {
        wrapper: createWrapper(createQueryClient()),
      });

      await expect(
        act(async () => {
          await result.current.mutateAsync({ commentId: 'comment-1', content: 'boom' });
        })
      ).rejects.toThrow('Failed to update comment');
    });
  });

  describe('useDeleteComment', () => {
    it('DELETEs the comment and invalidates the comments query', async () => {
      const queryClient = createQueryClient();
      const invalidateQueriesSpy = jest.spyOn(queryClient, 'invalidateQueries');

      fetchMock.mockResolvedValue({
        ok: true,
        json: async () => ({ success: true, id: 'comment-1' }),
      });

      const { result } = renderHook(() => useDeleteComment('issue-1'), {
        wrapper: createWrapper(queryClient),
      });

      await act(async () => {
        await result.current.mutateAsync('comment-1');
      });

      expect(fetchMock).toHaveBeenCalledWith('/api/issues/issue-1/comments/comment-1', {
        method: 'DELETE',
      });
      expect(invalidateQueriesSpy).toHaveBeenCalledWith({ queryKey: ['comments', 'issue-1'] });
    });

    it('maps a 409 response to the has-replies sentinel error', async () => {
      fetchMock.mockResolvedValue({ ok: false, status: 409 });

      const { result } = renderHook(() => useDeleteComment('issue-1'), {
        wrapper: createWrapper(createQueryClient()),
      });

      await expect(
        act(async () => {
          await result.current.mutateAsync('comment-1');
        })
      ).rejects.toThrow(COMMENT_HAS_REPLIES_ERROR);
    });

    it('throws a generic error for other failures', async () => {
      fetchMock.mockResolvedValue({ ok: false, status: 500 });

      const { result } = renderHook(() => useDeleteComment('issue-1'), {
        wrapper: createWrapper(createQueryClient()),
      });

      await expect(
        act(async () => {
          await result.current.mutateAsync('comment-1');
        })
      ).rejects.toThrow('Failed to delete comment');
    });
  });

  describe('useToggleCommentReaction', () => {
    const baseComment: Comment = {
      id: 'comment-1',
      content: 'Hello',
      reactions: [],
      author: { id: 'user-1', name: 'Alice', email: 'alice@example.com' },
      createdAt: '2026-04-01T00:00:00.000Z',
    };

    it('POSTs the emoji and applies the optimistic toggle before the server responds', async () => {
      const queryClient = createQueryClient();
      queryClient.setQueryData(['comments', 'issue-1'], [baseComment]);

      let resolveFetch: (value: unknown) => void = () => {};
      fetchMock.mockReturnValue(
        new Promise((resolve) => {
          resolveFetch = resolve;
        })
      );

      const { result } = renderHook(() => useToggleCommentReaction('issue-1'), {
        wrapper: createWrapper(queryClient),
      });

      act(() => {
        result.current.mutate({ commentId: 'comment-1', emoji: '👍', userId: 'user-1' });
      });

      await waitFor(() => {
        const cached = queryClient.getQueryData<Comment[]>(['comments', 'issue-1']);
        expect(cached?.[0].reactions).toEqual([
          expect.objectContaining({ emoji: '👍', userId: 'user-1' }),
        ]);
      });

      expect(fetchMock).toHaveBeenCalledWith('/api/issues/issue-1/comments/comment-1/reactions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ emoji: '👍' }),
      });

      const serverReactions = [
        { emoji: '👍', userId: 'user-1', createdAt: '2026-04-02T00:00:00.000Z' },
      ];
      await act(async () => {
        resolveFetch({
          ok: true,
          json: async () => ({ commentId: 'comment-1', reacted: true, reactions: serverReactions }),
        });
      });

      await waitFor(() => {
        const cached = queryClient.getQueryData<Comment[]>(['comments', 'issue-1']);
        expect(cached?.[0].reactions).toEqual(serverReactions);
      });
    });

    it('removes an existing reaction of the session user optimistically', async () => {
      const queryClient = createQueryClient();
      const reacted: Comment = {
        ...baseComment,
        reactions: [
          { emoji: '👍', userId: 'user-1', createdAt: '2026-04-01T00:00:00.000Z' },
          { emoji: '👍', userId: 'user-2', createdAt: '2026-04-01T00:00:00.000Z' },
        ],
      };
      queryClient.setQueryData(['comments', 'issue-1'], [reacted]);

      fetchMock.mockResolvedValue({
        ok: true,
        json: async () => ({
          commentId: 'comment-1',
          reacted: false,
          reactions: [{ emoji: '👍', userId: 'user-2', createdAt: '2026-04-01T00:00:00.000Z' }],
        }),
      });

      const { result } = renderHook(() => useToggleCommentReaction('issue-1'), {
        wrapper: createWrapper(queryClient),
      });

      await act(async () => {
        await result.current.mutateAsync({ commentId: 'comment-1', emoji: '👍', userId: 'user-1' });
      });

      const cached = queryClient.getQueryData<Comment[]>(['comments', 'issue-1']);
      expect(cached?.[0].reactions).toEqual([
        { emoji: '👍', userId: 'user-2', createdAt: '2026-04-01T00:00:00.000Z' },
      ]);
    });

    it('rolls back the optimistic update when the request fails', async () => {
      const queryClient = createQueryClient();
      queryClient.setQueryData(['comments', 'issue-1'], [baseComment]);

      fetchMock.mockResolvedValue({ ok: false, status: 500 });

      const { result } = renderHook(() => useToggleCommentReaction('issue-1'), {
        wrapper: createWrapper(queryClient),
      });

      await expect(
        act(async () => {
          await result.current.mutateAsync({
            commentId: 'comment-1',
            emoji: '👍',
            userId: 'user-1',
          });
        })
      ).rejects.toThrow('Failed to toggle reaction');

      const cached = queryClient.getQueryData<Comment[]>(['comments', 'issue-1']);
      expect(cached?.[0].reactions).toEqual([]);
    });
  });
});
