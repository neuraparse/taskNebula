import type { ReactNode } from 'react';
import { act, renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import {
  SELF_UPDATE_QUERY_KEY,
  VERSION_INFO_QUERY_KEY,
  useRefreshVersionInfo,
  useStartSelfUpdate,
  useVersionInfo,
  type SelfUpdateStatus,
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

  describe('useStartSelfUpdate', () => {
    it('posts the target version and stores the returned self-update status', async () => {
      const queryClient = createQueryClient();
      queryClient.setQueryData(VERSION_INFO_QUERY_KEY, baseInfo);
      const selfUpdate: SelfUpdateStatus = {
        enabled: true,
        available: false,
        mode: 'external-webhook',
        blockedReason: 'active_job',
        targetVersion: '0.5.0',
        repository: 'neuraparse/tasknebula',
        digest: null,
        webhookConfigured: true,
        manualCommands: 'docker compose pull web',
        job: {
          id: 'job-1',
          status: 'requested',
          currentVersion: '0.4.0',
          targetVersion: '0.5.0',
          repository: 'neuraparse/tasknebula',
          imageTag: '0.5.0',
          digest: null,
          releaseUrl: null,
          triggeredBy: 'admin-1',
          createdAt: '2026-06-21T00:00:00.000Z',
          updatedAt: '2026-06-21T00:00:01.000Z',
          requestedAt: '2026-06-21T00:00:01.000Z',
          completedAt: null,
          failureReason: null,
          webhookStatus: 202,
        },
      };
      fetchMock.mockResolvedValue({ ok: true, json: async () => selfUpdate });

      const { result } = renderHook(() => useStartSelfUpdate(), {
        wrapper: createWrapper(queryClient),
      });

      await act(async () => {
        await result.current.mutateAsync('0.5.0');
      });

      expect(fetchMock).toHaveBeenCalledWith('/api/admin/version/self-update', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ targetVersion: '0.5.0', acknowledged: true }),
      });
      expect(queryClient.getQueryData(SELF_UPDATE_QUERY_KEY)).toEqual(selfUpdate);
      expect(queryClient.getQueryState(VERSION_INFO_QUERY_KEY)?.isInvalidated).toBe(true);
    });

    it('surfaces self-update API errors', async () => {
      fetchMock.mockResolvedValue({
        ok: false,
        json: async () => ({ error: 'Self-update is not available: disabled' }),
      });

      const { result } = renderHook(() => useStartSelfUpdate(), {
        wrapper: createWrapper(createQueryClient()),
      });

      await act(async () => {
        await expect(result.current.mutateAsync('0.5.0')).rejects.toThrow(
          'Self-update is not available: disabled'
        );
      });
    });
  });
});
