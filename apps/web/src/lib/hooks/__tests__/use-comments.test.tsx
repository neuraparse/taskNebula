import type { ReactNode } from 'react';
import { act, renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useComments, useCreateComment } from '../use-comments';

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
  });
});
