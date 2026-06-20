import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

// Response shape of GET /api/admin/version (super admin only).
export interface VersionInfo {
  current: string;
  latest: string | null;
  releaseUpdateAvailable: boolean;
  updateAvailable: boolean;
  releaseUrl: string | null;
  publishedAt: string | null;
  notes: string | null;
  checkedAt: string | null;
  image: {
    repository: string;
    latestTag: string | null;
    latestTagUrl: string | null;
    latestPushedAt: string | null;
    latestDigest: string | null;
    latestSizeBytes: number | null;
    updateAvailable: boolean;
    checkedAt: string | null;
  };
  checkDisabled: boolean;
}

export const VERSION_INFO_QUERY_KEY = ['admin', 'version'] as const;

async function fetchVersionInfo(refresh = false): Promise<VersionInfo> {
  const response = await fetch(`/api/admin/version${refresh ? '?refresh=true' : ''}`);
  const payload = await response
    .json()
    .catch(() => ({ error: 'Failed to load version information' }));
  if (!response.ok) {
    throw new Error(payload.error || 'Failed to load version information');
  }
  return payload as VersionInfo;
}

// Current vs. latest platform version (cached server-side with a 6h TTL).
export function useVersionInfo() {
  return useQuery({
    queryKey: VERSION_INFO_QUERY_KEY,
    queryFn: () => fetchVersionInfo(),
    staleTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
  });
}

// Force a fresh upstream check past the server-side cache TTL.
export function useRefreshVersionInfo() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: () => fetchVersionInfo(true),
    onSuccess: (data) => {
      queryClient.setQueryData(VERSION_INFO_QUERY_KEY, data);
    },
  });
}
