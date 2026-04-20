import type { ReactNode } from 'react';
import { act, renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import {
  useAssignIssueToSprint,
  useCreateSprint,
  useDeleteSprint,
  useSprints,
  useUpdateSprint,
} from '../use-sprints';

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

describe('use-sprints hooks', () => {
  beforeEach(() => {
    fetchMock.mockReset();
    global.fetch = fetchMock as unknown as typeof fetch;
  });

  describe('useSprints', () => {
    it('is disabled and returns [] when projectId is null', async () => {
      const { result } = renderHook(() => useSprints(null), {
        wrapper: createWrapper(createQueryClient()),
      });

      await Promise.resolve();

      expect(fetchMock).not.toHaveBeenCalled();
      expect(result.current.data).toBeUndefined();
    });

    it('fetches sprints for a project', async () => {
      fetchMock.mockResolvedValue({
        ok: true,
        json: async () => [
          { id: 'sprint-1', projectId: 'project-1', name: 'Sprint 1' },
        ],
      });

      const { result } = renderHook(() => useSprints('project-1'), {
        wrapper: createWrapper(createQueryClient()),
      });

      await waitFor(() => {
        expect(result.current.data).toHaveLength(1);
      });

      expect(fetchMock).toHaveBeenCalledWith('/api/sprints?projectId=project-1');
    });

    it('surfaces an error when the response is not ok', async () => {
      fetchMock.mockResolvedValue({
        ok: false,
      });

      const { result } = renderHook(() => useSprints('project-1'), {
        wrapper: createWrapper(createQueryClient()),
      });

      await waitFor(() => {
        expect(result.current.isError).toBe(true);
      });

      expect(result.current.error).toBeInstanceOf(Error);
      expect(result.current.error?.message).toBe('Failed to fetch sprints');
    });
  });

  describe('useCreateSprint', () => {
    it('POSTs a JSON body with ISO-stringified dates', async () => {
      fetchMock.mockResolvedValue({
        ok: true,
        json: async () => ({ id: 'sprint-1' }),
      });

      const { result } = renderHook(() => useCreateSprint(), {
        wrapper: createWrapper(createQueryClient()),
      });

      const startDate = new Date('2026-05-01T00:00:00.000Z');
      const endDate = new Date('2026-05-15T00:00:00.000Z');

      await act(async () => {
        await result.current.mutateAsync({
          projectId: 'project-1',
          name: 'Sprint 1',
          goal: 'Ship it',
          startDate,
          endDate,
        });
      });

      expect(fetchMock).toHaveBeenCalledWith('/api/sprints', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          projectId: 'project-1',
          name: 'Sprint 1',
          goal: 'Ship it',
          startDate: startDate.toISOString(),
          endDate: endDate.toISOString(),
        }),
      });
    });

    it('throws the error message from the response JSON when creation fails', async () => {
      fetchMock.mockResolvedValue({
        ok: false,
        json: async () => ({ error: 'Sprint name already exists' }),
      });

      const { result } = renderHook(() => useCreateSprint(), {
        wrapper: createWrapper(createQueryClient()),
      });

      await expect(
        act(async () => {
          await result.current.mutateAsync({
            projectId: 'project-1',
            name: 'Sprint 1',
            startDate: new Date('2026-05-01T00:00:00.000Z'),
            endDate: new Date('2026-05-15T00:00:00.000Z'),
          });
        })
      ).rejects.toThrow('Sprint name already exists');
    });
  });

  describe('useUpdateSprint', () => {
    it('PATCHes the sprint endpoint with the provided data', async () => {
      fetchMock.mockResolvedValue({
        ok: true,
        json: async () => ({ id: 'sprint-1', projectId: 'project-1' }),
      });

      const { result } = renderHook(() => useUpdateSprint(), {
        wrapper: createWrapper(createQueryClient()),
      });

      await act(async () => {
        await result.current.mutateAsync({
          sprintId: 'sprint-1',
          data: { name: 'Renamed Sprint' },
        });
      });

      expect(fetchMock).toHaveBeenCalledWith('/api/sprints/sprint-1', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: 'Renamed Sprint' }),
      });
    });
  });

  describe('useDeleteSprint', () => {
    it('DELETEs the sprint endpoint', async () => {
      fetchMock.mockResolvedValue({
        ok: true,
        json: async () => ({ success: true }),
      });

      const { result } = renderHook(() => useDeleteSprint(), {
        wrapper: createWrapper(createQueryClient()),
      });

      await act(async () => {
        await result.current.mutateAsync('sprint-1');
      });

      expect(fetchMock).toHaveBeenCalledWith('/api/sprints/sprint-1', {
        method: 'DELETE',
      });
    });
  });

  describe('useAssignIssueToSprint', () => {
    it('POSTs the issueId to the sprint issues endpoint', async () => {
      fetchMock.mockResolvedValue({
        ok: true,
        json: async () => ({ success: true }),
      });

      const { result } = renderHook(() => useAssignIssueToSprint(), {
        wrapper: createWrapper(createQueryClient()),
      });

      await act(async () => {
        await result.current.mutateAsync({
          sprintId: 'sprint-1',
          issueId: 'issue-1',
        });
      });

      expect(fetchMock).toHaveBeenCalledWith('/api/sprints/sprint-1/issues', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ issueId: 'issue-1' }),
      });
    });
  });
});
