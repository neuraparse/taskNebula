import type { ReactNode } from 'react';
import { act, renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useCreateProject, useProjects } from '../use-projects';

const fetchMock = jest.fn();

function createQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
      mutations: {
        retry: false,
      },
    },
  });
}

function createWrapper(queryClient: QueryClient) {
  return function Wrapper({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
  };
}

describe('useProjects', () => {
  beforeEach(() => {
    fetchMock.mockReset();
    global.fetch = fetchMock as unknown as typeof fetch;
  });

  it('requests projects with organization and teamspace filters', async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => [
        {
          id: 'project-1',
          organizationId: 'org-1',
          teamId: 'team-1',
          key: 'API',
          name: 'API Platform',
          description: null,
          status: 'active',
          settings: {},
          createdAt: '2026-04-01T00:00:00.000Z',
          updatedAt: '2026-04-01T00:00:00.000Z',
        },
      ],
    });

    const { result } = renderHook(
      () => useProjects({ organizationId: 'org-1', teamId: 'team-1' }),
      { wrapper: createWrapper(createQueryClient()) }
    );

    await waitFor(() => {
      expect(result.current.data).toHaveLength(1);
    });

    expect(fetchMock).toHaveBeenCalledWith('/api/projects?organizationId=org-1&teamId=team-1');
  });

  it('does not request projects when disabled', () => {
    renderHook(() => useProjects({ organizationId: 'org-1', enabled: false }), {
      wrapper: createWrapper(createQueryClient()),
    });

    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('creates a project with optional teamspace context and invalidates project queries', async () => {
    const queryClient = createQueryClient();
    const invalidateQueriesSpy = jest.spyOn(queryClient, 'invalidateQueries');

    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({
        id: 'project-1',
        organizationId: 'org-1',
        teamId: 'team-1',
        key: 'API',
        name: 'API Platform',
      }),
    });

    const { result } = renderHook(() => useCreateProject(), {
      wrapper: createWrapper(queryClient),
    });

    await act(async () => {
      await result.current.mutateAsync({
        name: 'API Platform',
        key: 'API',
        description: 'Core API work',
        organizationId: 'org-1',
        teamId: 'team-1',
      });
    });

    expect(fetchMock).toHaveBeenCalledWith(
      '/api/projects',
      expect.objectContaining({
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: 'API Platform',
          key: 'API',
          description: 'Core API work',
          organizationId: 'org-1',
          teamId: 'team-1',
        }),
      })
    );

    expect(invalidateQueriesSpy).toHaveBeenCalledWith({ queryKey: ['projects'] });
  });

  it('surfaces API errors when project creation fails', async () => {
    fetchMock.mockResolvedValue({
      ok: false,
      json: async () => ({
        error: 'Project key already exists',
      }),
    });

    const { result } = renderHook(() => useCreateProject(), {
      wrapper: createWrapper(createQueryClient()),
    });

    await expect(
      act(async () => {
        await result.current.mutateAsync({
          name: 'API Platform',
          key: 'API',
        });
      })
    ).rejects.toThrow('Project key already exists');
  });
});
