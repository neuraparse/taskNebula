import type { ReactNode } from 'react';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useOrganizationMembers } from '../use-members';

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

describe('useOrganizationMembers', () => {
  beforeEach(() => {
    fetchMock.mockReset();
    global.fetch = fetchMock as unknown as typeof fetch;
  });

  it('is disabled when organizationId is null and does not fetch', async () => {
    const { result } = renderHook(() => useOrganizationMembers(null), {
      wrapper: createWrapper(createQueryClient()),
    });

    await Promise.resolve();

    expect(fetchMock).not.toHaveBeenCalled();
    expect(result.current.data).toBeUndefined();
  });

  it('fetches organization members for the given organization', async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({
        members: [
          {
            id: 'user-1',
            name: 'Alice',
            email: 'alice@example.com',
            image: null,
            status: 'active',
            role: 'owner',
            memberStatus: 'active',
            joinedAt: '2026-01-01T00:00:00.000Z',
          },
        ],
        userRole: 'owner',
        isSuperAdmin: false,
      }),
    });

    const { result } = renderHook(() => useOrganizationMembers('org-1'), {
      wrapper: createWrapper(createQueryClient()),
    });

    await waitFor(() => {
      expect(result.current.data?.members).toHaveLength(1);
    });

    expect(fetchMock).toHaveBeenCalledWith('/api/organizations/org-1/members');
    expect(result.current.data?.userRole).toBe('owner');
  });

  it('surfaces an error when the members response is not ok', async () => {
    fetchMock.mockResolvedValue({ ok: false });

    const { result } = renderHook(() => useOrganizationMembers('org-1'), {
      wrapper: createWrapper(createQueryClient()),
    });

    await waitFor(() => {
      expect(result.current.isError).toBe(true);
    });

    expect(result.current.error).toBeInstanceOf(Error);
    expect(result.current.error?.message).toBe('Failed to fetch organization members');
  });

  it('returns the full response shape including userRole and isSuperAdmin', async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({
        members: [],
        userRole: 'admin',
        isSuperAdmin: true,
      }),
    });

    const { result } = renderHook(() => useOrganizationMembers('org-2'), {
      wrapper: createWrapper(createQueryClient()),
    });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(result.current.data).toEqual({
      members: [],
      userRole: 'admin',
      isSuperAdmin: true,
    });
  });
});
