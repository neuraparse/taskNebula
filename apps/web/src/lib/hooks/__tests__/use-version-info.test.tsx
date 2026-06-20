import type { ReactNode } from 'react';
import { act, renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import {
  VERSION_INFO_QUERY_KEY,
  useRefreshVersionInfo,
  useVersionInfo,
  type VersionInfo,
} from '../use-version-info';

const fetchMock = jest.fn();

const baseInfo: VersionInfo = {
  current: '0.4.0',
  latest: null,
  releaseUpdateAvailable: false,
  updateAvailable: false,
  releaseUrl: null,
  publishedAt: null,
  notes: null,
  checkedAt: null,
  image: {
    repository: 'neuraparse/tasknebula',
    latestTag: null,
    latestTagUrl: null,
    latestPushedAt: null,
    latestDigest: null,
    latestSizeBytes: null,
    updateAvailable: false,
    checkedAt: null,
  },
  checkDisabled: false,
};

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

describe('use-version-info hooks', () => {
  beforeEach(() => {
    fetchMock.mockReset();
    global.fetch = fetchMock as unknown as typeof fetch;
  });

  describe('useVersionInfo', () => {
    it('fetches version info from the admin endpoint without a refresh param', async () => {
      fetchMock.mockResolvedValue({
        ok: true,
        json: async () => ({
          ...baseInfo,
          latest: '0.4.1',
          updateAvailable: true,
          releaseUrl: 'https://github.com/neuraparse/taskNebula/releases/tag/v0.4.1',
        }),
      });

      const { result } = renderHook(() => useVersionInfo(), {
        wrapper: createWrapper(createQueryClient()),
      });

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(fetchMock).toHaveBeenCalledWith('/api/admin/version');
      expect(result.current.data).toMatchObject({
        current: '0.4.0',
        latest: '0.4.1',
        updateAvailable: true,
      });
    });

    it('surfaces the API error message when the request fails', async () => {
      fetchMock.mockResolvedValue({
        ok: false,
        json: async () => ({ error: 'Super admin access required' }),
      });

      const { result } = renderHook(() => useVersionInfo(), {
        wrapper: createWrapper(createQueryClient()),
      });

      await waitFor(() => {
        expect(result.current.isError).toBe(true);
      });

      expect(result.current.error).toBeInstanceOf(Error);
      expect((result.current.error as Error).message).toBe('Super admin access required');
    });

    it('falls back to a generic message when the error response is not JSON', async () => {
      fetchMock.mockResolvedValue({
        ok: false,
        json: async () => {
          throw new Error('invalid json');
        },
      });

      const { result } = renderHook(() => useVersionInfo(), {
        wrapper: createWrapper(createQueryClient()),
      });

      await waitFor(() => {
        expect(result.current.isError).toBe(true);
      });

      expect((result.current.error as Error).message).toBe('Failed to load version information');
    });
  });

  describe('useRefreshVersionInfo', () => {
    it('hits ?refresh=true and writes the result into the version cache', async () => {
      const queryClient = createQueryClient();
      queryClient.setQueryData(VERSION_INFO_QUERY_KEY, baseInfo);

      const refreshed: VersionInfo = {
        ...baseInfo,
        latest: '0.4.1',
        updateAvailable: true,
        checkedAt: '2026-06-12T08:00:00.000Z',
      };
      fetchMock.mockResolvedValue({ ok: true, json: async () => refreshed });

      const { result } = renderHook(() => useRefreshVersionInfo(), {
        wrapper: createWrapper(queryClient),
      });

      await act(async () => {
        await result.current.mutateAsync();
      });

      expect(fetchMock).toHaveBeenCalledWith('/api/admin/version?refresh=true');
      expect(queryClient.getQueryData(VERSION_INFO_QUERY_KEY)).toEqual(refreshed);
    });

    it('does not touch the cached version info when the refresh fails', async () => {
      const queryClient = createQueryClient();
      queryClient.setQueryData(VERSION_INFO_QUERY_KEY, baseInfo);

      fetchMock.mockResolvedValue({
        ok: false,
        json: async () => ({ error: 'Unauthorized' }),
      });

      const { result } = renderHook(() => useRefreshVersionInfo(), {
        wrapper: createWrapper(queryClient),
      });

      await act(async () => {
        await expect(result.current.mutateAsync()).rejects.toThrow('Unauthorized');
      });

      expect(queryClient.getQueryData(VERSION_INFO_QUERY_KEY)).toEqual(baseInfo);
    });
  });
});
