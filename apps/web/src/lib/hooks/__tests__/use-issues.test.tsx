import type { ReactNode } from 'react';
import { act, renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import {
  useCreateIssue,
  useDeleteIssue,
  useIssue,
  useIssues,
  useUpdateIssue,
} from '../use-issues';

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

describe('use-issues hooks', () => {
  beforeEach(() => {
    fetchMock.mockReset();
    global.fetch = fetchMock as unknown as typeof fetch;
  });

  describe('useIssues', () => {
    it('fetches issues with filter parameters and returns the issues array', async () => {
      fetchMock.mockResolvedValue({
        ok: true,
        json: async () => ({
          issues: [
            { id: 'issue-1', key: 'API-1', title: 'Ship feature' },
            { id: 'issue-2', key: 'API-2', title: 'Fix bug' },
          ],
        }),
      });

      const { result } = renderHook(
        () => useIssues({ projectId: 'project-1', status: 'open' }),
        { wrapper: createWrapper(createQueryClient()) }
      );

      await waitFor(() => {
        expect(result.current.data).toHaveLength(2);
      });

      expect(fetchMock).toHaveBeenCalledWith('/api/issues?projectId=project-1&status=open');
    });

    it('surfaces an error when the list response is not ok', async () => {
      fetchMock.mockResolvedValue({ ok: false });

      const { result } = renderHook(() => useIssues(), {
        wrapper: createWrapper(createQueryClient()),
      });

      await waitFor(() => {
        expect(result.current.isError).toBe(true);
      });

      expect(result.current.error?.message).toBe('Failed to fetch issues');
    });
  });

  describe('useIssue', () => {
    it('is disabled when issueId is null and does not fetch', async () => {
      const { result } = renderHook(() => useIssue(null), {
        wrapper: createWrapper(createQueryClient()),
      });

      await Promise.resolve();

      expect(fetchMock).not.toHaveBeenCalled();
      expect(result.current.data).toBeUndefined();
    });

    it('fetches a single issue by id', async () => {
      fetchMock.mockResolvedValue({
        ok: true,
        json: async () => ({ id: 'issue-1', key: 'API-1', title: 'Ship feature' }),
      });

      const { result } = renderHook(() => useIssue('issue-1'), {
        wrapper: createWrapper(createQueryClient()),
      });

      await waitFor(() => {
        expect(result.current.data?.id).toBe('issue-1');
      });

      expect(fetchMock).toHaveBeenCalledWith('/api/issues/issue-1');
    });
  });

  describe('useCreateIssue', () => {
    it('POSTs the new issue payload to /api/issues', async () => {
      fetchMock.mockResolvedValue({
        ok: true,
        json: async () => ({ id: 'issue-1' }),
      });

      const { result } = renderHook(() => useCreateIssue(), {
        wrapper: createWrapper(createQueryClient()),
      });

      await act(async () => {
        await result.current.mutateAsync({
          title: 'New issue',
          projectId: 'project-1',
          priority: 'high',
        });
      });

      expect(fetchMock).toHaveBeenCalledWith('/api/issues', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: 'New issue',
          projectId: 'project-1',
          priority: 'high',
        }),
      });
    });

    it('throws the API error message when creation fails', async () => {
      fetchMock.mockResolvedValue({
        ok: false,
        json: async () => ({ error: 'Title is required' }),
      });

      const { result } = renderHook(() => useCreateIssue(), {
        wrapper: createWrapper(createQueryClient()),
      });

      await expect(
        act(async () => {
          await result.current.mutateAsync({ title: '' });
        })
      ).rejects.toThrow('Title is required');
    });
  });

  describe('useUpdateIssue', () => {
    it('PATCHes the issue endpoint with the provided data', async () => {
      fetchMock.mockResolvedValue({
        ok: true,
        json: async () => ({ id: 'issue-1', title: 'Renamed' }),
      });

      const { result } = renderHook(() => useUpdateIssue(), {
        wrapper: createWrapper(createQueryClient()),
      });

      await act(async () => {
        await result.current.mutateAsync({
          issueId: 'issue-1',
          data: { title: 'Renamed' },
        });
      });

      expect(fetchMock).toHaveBeenCalledWith('/api/issues/issue-1', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: 'Renamed' }),
      });
    });
  });

  describe('useDeleteIssue', () => {
    it('DELETEs the issue endpoint', async () => {
      fetchMock.mockResolvedValue({
        ok: true,
        json: async () => ({ success: true }),
      });

      const { result } = renderHook(() => useDeleteIssue(), {
        wrapper: createWrapper(createQueryClient()),
      });

      await act(async () => {
        await result.current.mutateAsync('issue-1');
      });

      expect(fetchMock).toHaveBeenCalledWith('/api/issues/issue-1', {
        method: 'DELETE',
      });
    });
  });
});
