import type { ReactNode } from 'react';
import { act, renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useCreateIssue, useDeleteIssue, useIssue, useIssues, useUpdateIssue } from '../use-issues';

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

      const { result } = renderHook(() => useIssues({ projectId: 'project-1', status: 'open' }), {
        wrapper: createWrapper(createQueryClient()),
      });

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

    it('does not fetch issues when disabled', async () => {
      const { result } = renderHook(
        () => useIssues({ projectId: 'project-1' }, { enabled: false }),
        {
          wrapper: createWrapper(createQueryClient()),
        }
      );

      await Promise.resolve();

      expect(fetchMock).not.toHaveBeenCalled();
      expect(result.current.data).toBeUndefined();
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

    it('returns null when the API responds with 404 (issue not found)', async () => {
      fetchMock.mockResolvedValue({
        ok: false,
        status: 404,
        json: async () => ({ error: 'Issue not found' }),
      });

      const { result } = renderHook(() => useIssue('missing-id'), {
        wrapper: createWrapper(createQueryClient()),
      });

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(result.current.data).toBeNull();
      expect(result.current.error).toBeNull();
    });

    it('surfaces an error for non-404 failures', async () => {
      fetchMock.mockResolvedValue({
        ok: false,
        status: 500,
      });

      const { result } = renderHook(() => useIssue('issue-1'), {
        wrapper: createWrapper(createQueryClient()),
      });

      await waitFor(() => {
        expect(result.current.isError).toBe(true);
      });

      expect(result.current.error?.message).toBe('Failed to fetch issue');
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

    it('optimistically inserts the new issue into the project list before the server responds', async () => {
      const queryClient = createQueryClient();
      // A board/list is already showing this project's issues, plus its columns.
      queryClient.setQueryData(['issues', { projectId: 'p1' }], []);
      queryClient.setQueryData(
        ['workflow-statuses', 'p1'],
        [{ id: 'st-backlog', name: 'Backlog', category: 'backlog', color: '#ccc', position: 0 }]
      );

      // Hold the POST open so we can observe the UI *before* the server answers.
      let resolveFetch: (value: unknown) => void = () => {};
      fetchMock.mockReturnValue(
        new Promise((resolve) => {
          resolveFetch = resolve;
        })
      );

      const { result } = renderHook(() => useCreateIssue(), {
        wrapper: createWrapper(queryClient),
      });

      act(() => {
        result.current.mutate({ title: 'Instant task', projectId: 'p1', priority: 'high' });
      });

      // The card appears immediately — no refetch, no page refresh.
      await waitFor(() => {
        const list = queryClient.getQueryData<Array<{ title: string }>>([
          'issues',
          { projectId: 'p1' },
        ]);
        expect(list).toHaveLength(1);
      });
      const optimistic = queryClient.getQueryData<
        Array<{ title: string; optimistic?: boolean; statusId?: string }>
      >(['issues', { projectId: 'p1' }])![0];
      expect(optimistic.title).toBe('Instant task');
      expect(optimistic.optimistic).toBe(true);
      // Defaults to the backlog workflow status so it lands in the right column.
      expect(optimistic.statusId).toBe('st-backlog');

      // Server responds → the temp row is replaced in place by the real row.
      resolveFetch({
        ok: true,
        json: async () => ({
          id: 'real-1',
          key: 'P1-1',
          title: 'Instant task',
          projectId: 'p1',
          statusId: 'st-backlog',
        }),
      });

      await waitFor(() => {
        const list = queryClient.getQueryData<Array<{ id: string }>>([
          'issues',
          { projectId: 'p1' },
        ]);
        expect(list?.[0]?.id).toBe('real-1');
      });
      const reconciled = queryClient.getQueryData<Array<{ optimistic?: boolean }>>([
        'issues',
        { projectId: 'p1' },
      ])![0];
      expect(reconciled.optimistic).toBeUndefined();
    });

    it('reconciles the optimistic row when the routed key differs from the server CUID', async () => {
      // Boards are routed by project KEY (e.g. /projects/demo/board), so the
      // list cache is keyed ['issues', { projectId: 'demo' }] — but the server
      // resolves "demo" → a CUID and returns that. The swap must still find and
      // replace the temp row (this was the original "needs refresh" root cause).
      const queryClient = createQueryClient();
      queryClient.setQueryData(['issues', { projectId: 'demo' }], []);
      queryClient.setQueryData(
        ['workflow-statuses', 'demo'],
        [{ id: 'st', name: 'Backlog', category: 'backlog', color: '#ccc', position: 0 }]
      );

      let resolveFetch: (value: unknown) => void = () => {};
      fetchMock.mockReturnValue(
        new Promise((resolve) => {
          resolveFetch = resolve;
        })
      );

      const { result } = renderHook(() => useCreateIssue(), {
        wrapper: createWrapper(queryClient),
      });

      act(() => {
        result.current.mutate({ title: 'Cross-id task', projectId: 'demo' });
      });

      await waitFor(() => {
        expect(queryClient.getQueryData<unknown[]>(['issues', { projectId: 'demo' }])).toHaveLength(
          1
        );
      });

      // Server response carries the CUID, not the routed "demo" key.
      resolveFetch({
        ok: true,
        json: async () => ({
          id: 'real-cuid',
          key: 'DEMO-1',
          title: 'Cross-id task',
          projectId: 'proj_realcuid',
          statusId: 'st',
        }),
      });

      await waitFor(() => {
        const list = queryClient.getQueryData<Array<{ id: string }>>([
          'issues',
          { projectId: 'demo' },
        ]);
        expect(list?.[0]?.id).toBe('real-cuid');
      });
      const reconciled = queryClient.getQueryData<Array<{ optimistic?: boolean }>>([
        'issues',
        { projectId: 'demo' },
      ])![0];
      expect(reconciled.optimistic).toBeUndefined();
    });

    it('does not insert the optimistic issue into a non-matching filtered list', async () => {
      const queryClient = createQueryClient();
      // A widget showing only issues assigned to someone else.
      queryClient.setQueryData(
        ['issues', { projectId: 'p1', assigneeId: 'someone-else' }],
        [{ id: 'x', title: 'Theirs' }]
      );
      // The plain project board.
      queryClient.setQueryData(['issues', { projectId: 'p1' }], []);

      let resolveFetch: (value: unknown) => void = () => {};
      fetchMock.mockReturnValue(
        new Promise((resolve) => {
          resolveFetch = resolve;
        })
      );

      const { result } = renderHook(() => useCreateIssue(), {
        wrapper: createWrapper(queryClient),
      });

      act(() => {
        // New issue is unassigned → must not appear in the someone-else list.
        result.current.mutate({ title: 'Unassigned task', projectId: 'p1' });
      });

      await waitFor(() => {
        expect(queryClient.getQueryData<unknown[]>(['issues', { projectId: 'p1' }])).toHaveLength(
          1
        );
      });
      // The assignee-filtered list is untouched.
      expect(
        queryClient.getQueryData<unknown[]>([
          'issues',
          { projectId: 'p1', assigneeId: 'someone-else' },
        ])
      ).toHaveLength(1);

      resolveFetch({ ok: true, json: async () => ({ id: 'real', projectId: 'p1' }) });
      await waitFor(() => expect(result.current.isSuccess).toBe(true));
    });

    it('rolls back the optimistic insert when the server rejects the create', async () => {
      const queryClient = createQueryClient();
      queryClient.setQueryData(['issues', { projectId: 'p1' }], [{ id: 'existing', title: 'Old' }]);

      fetchMock.mockResolvedValue({
        ok: false,
        json: async () => ({ error: 'Boom' }),
      });

      const { result } = renderHook(() => useCreateIssue(), {
        wrapper: createWrapper(queryClient),
      });

      await act(async () => {
        await result.current
          .mutateAsync({ title: 'Doomed', projectId: 'p1' })
          .catch(() => undefined);
      });

      const list = queryClient.getQueryData<Array<{ id: string }>>(['issues', { projectId: 'p1' }]);
      expect(list).toHaveLength(1);
      expect(list?.[0]?.id).toBe('existing');
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

    it('optimistically removes the issue from the list immediately', async () => {
      const queryClient = createQueryClient();
      queryClient.setQueryData(['issue', 'i1'], { id: 'i1', projectId: 'p1', sprintId: null });
      queryClient.setQueryData(
        ['issues', { projectId: 'p1' }],
        [
          { id: 'i1', title: 'Delete me' },
          { id: 'i2', title: 'Keep me' },
        ]
      );

      let resolveFetch: (value: unknown) => void = () => {};
      fetchMock.mockReturnValue(
        new Promise((resolve) => {
          resolveFetch = resolve;
        })
      );

      const { result } = renderHook(() => useDeleteIssue(), {
        wrapper: createWrapper(queryClient),
      });

      act(() => {
        result.current.mutate('i1');
      });

      await waitFor(() => {
        const list = queryClient.getQueryData<Array<{ id: string }>>([
          'issues',
          { projectId: 'p1' },
        ]);
        expect(list).toHaveLength(1);
      });
      expect(
        queryClient.getQueryData<Array<{ id: string }>>(['issues', { projectId: 'p1' }])![0].id
      ).toBe('i2');

      resolveFetch({ ok: true, json: async () => ({ success: true }) });
      await waitFor(() => expect(result.current.isSuccess).toBe(true));
    });

    it('rolls back the optimistic delete when the server rejects it', async () => {
      const queryClient = createQueryClient();
      queryClient.setQueryData(['issue', 'i1'], { id: 'i1', projectId: 'p1', sprintId: null });
      queryClient.setQueryData(
        ['issues', { projectId: 'p1' }],
        [
          { id: 'i1', title: 'Delete me' },
          { id: 'i2', title: 'Keep me' },
        ]
      );

      fetchMock.mockResolvedValue({ ok: false });

      const { result } = renderHook(() => useDeleteIssue(), {
        wrapper: createWrapper(queryClient),
      });

      act(() => {
        result.current.mutate('i1');
      });

      await waitFor(() => expect(result.current.isError).toBe(true));

      // The row is restored — nothing silently vanishes on failure.
      const list = queryClient.getQueryData<Array<{ id: string }>>(['issues', { projectId: 'p1' }]);
      expect(list).toHaveLength(2);
      expect(list?.map((i) => i.id)).toEqual(['i1', 'i2']);
    });
  });
});
