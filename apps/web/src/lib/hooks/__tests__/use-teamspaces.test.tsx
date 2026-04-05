import type { ReactNode } from 'react';
import { act, renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import {
  useAddTeamspaceMember,
  useCreateTeamspace,
  useDeleteTeamspace,
  useRemoveTeamspaceMember,
  useTeamspaceMembers,
  useTeamspaces,
  useUpdateTeamspace,
  useUpdateTeamspaceMember,
} from '../use-teamspaces';

const fetchMock = jest.fn();

function createWrapper(queryClient?: QueryClient) {
  const client =
    queryClient ??
    new QueryClient({
      defaultOptions: {
        queries: {
          retry: false,
        },
      },
    });

  return function Wrapper({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
  };
}

describe('useTeamspaces', () => {
  beforeEach(() => {
    fetchMock.mockReset();
    global.fetch = fetchMock as unknown as typeof fetch;
  });

  it('does not fetch when no organization is selected', async () => {
    renderHook(() => useTeamspaces(null), {
      wrapper: createWrapper(),
    });

    await Promise.resolve();

    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('fetches teamspaces for the active organization', async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({
        teams: [
          { id: 'team-1', name: 'Platform' },
          { id: 'team-2', name: 'Growth' },
        ],
      }),
    });

    const { result } = renderHook(() => useTeamspaces('org-1'), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.data).toHaveLength(2);
    });

    expect(fetchMock).toHaveBeenCalledWith('/api/organizations/org-1/teams');
  });

  it('surfaces query errors when the teamspace request fails', async () => {
    fetchMock.mockResolvedValue({
      ok: false,
    });

    const { result } = renderHook(() => useTeamspaces('org-1'), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.isError).toBe(true);
    });

    expect(result.current.error).toBeInstanceOf(Error);
    expect(result.current.error?.message).toBe('Failed to fetch teamspaces');
  });

  it('fetches teamspace members for the selected teamspace', async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({
        team: { id: 'team-1', name: 'Platform' },
        members: [{ id: 'user-1', name: 'Bayram', teamRole: 'lead' }],
      }),
    });

    const { result } = renderHook(() => useTeamspaceMembers('org-1', 'team-1'), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.data?.members).toHaveLength(1);
    });

    expect(fetchMock).toHaveBeenCalledWith('/api/organizations/org-1/teams/team-1/members');
  });

  it('creates a teamspace with the expected payload', async () => {
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
    });
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({ team: { id: 'team-1', name: 'Platform' } }),
    });

    const { result } = renderHook(() => useCreateTeamspace('org-1'), {
      wrapper: createWrapper(queryClient),
    });

    await act(async () => {
      await result.current.mutateAsync({
        name: 'Platform',
        slug: 'platform',
        description: 'Core platform',
        leadId: 'user-1',
      });
    });

    expect(fetchMock).toHaveBeenCalledWith('/api/organizations/org-1/teams', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Platform',
        slug: 'platform',
        description: 'Core platform',
        leadId: 'user-1',
      }),
    });
  });

  it('updates a teamspace with the expected payload', async () => {
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
    });
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({ team: { id: 'team-1', name: 'Platform Core' } }),
    });

    const { result } = renderHook(() => useUpdateTeamspace('org-1'), {
      wrapper: createWrapper(queryClient),
    });

    await act(async () => {
      await result.current.mutateAsync({
        teamspaceId: 'team-1',
        payload: {
          name: 'Platform Core',
          slug: 'platform-core',
        },
      });
    });

    expect(fetchMock).toHaveBeenCalledWith('/api/organizations/org-1/teams/team-1', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Platform Core',
        slug: 'platform-core',
      }),
    });
  });

  it('deletes a teamspace', async () => {
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
    });
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({ success: true }),
    });

    const { result } = renderHook(() => useDeleteTeamspace('org-1'), {
      wrapper: createWrapper(queryClient),
    });

    await act(async () => {
      await result.current.mutateAsync('team-1');
    });

    expect(fetchMock).toHaveBeenCalledWith('/api/organizations/org-1/teams/team-1', {
      method: 'DELETE',
    });
  });

  it('adds a member to the teamspace', async () => {
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
    });
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({ member: { id: 'user-2', teamRole: 'member' } }),
    });

    const { result } = renderHook(() => useAddTeamspaceMember('org-1', 'team-1'), {
      wrapper: createWrapper(queryClient),
    });

    await act(async () => {
      await result.current.mutateAsync({
        userId: 'user-2',
        role: 'member',
      });
    });

    expect(fetchMock).toHaveBeenCalledWith('/api/organizations/org-1/teams/team-1/members', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        userId: 'user-2',
        role: 'member',
      }),
    });
  });

  it('updates a teamspace member role', async () => {
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
    });
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({ member: { id: 'user-2', teamRole: 'lead' } }),
    });

    const { result } = renderHook(() => useUpdateTeamspaceMember('org-1', 'team-1'), {
      wrapper: createWrapper(queryClient),
    });

    await act(async () => {
      await result.current.mutateAsync({
        memberId: 'user-2',
        role: 'lead',
      });
    });

    expect(fetchMock).toHaveBeenCalledWith('/api/organizations/org-1/teams/team-1/members/user-2', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ role: 'lead' }),
    });
  });

  it('removes a teamspace member', async () => {
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
    });
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({ success: true }),
    });

    const { result } = renderHook(() => useRemoveTeamspaceMember('org-1', 'team-1'), {
      wrapper: createWrapper(queryClient),
    });

    await act(async () => {
      await result.current.mutateAsync('user-2');
    });

    expect(fetchMock).toHaveBeenCalledWith('/api/organizations/org-1/teams/team-1/members/user-2', {
      method: 'DELETE',
    });
  });
});
