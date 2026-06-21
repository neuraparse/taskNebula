import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

export interface SelfUpdateJob {
  id: string;
  status: 'queued' | 'requested' | 'succeeded' | 'failed';
  currentVersion: string;
  targetVersion: string;
  repository: string;
  imageTag: string;
  digest: string | null;
  releaseUrl: string | null;
  triggeredBy: string;
  createdAt: string;
  updatedAt: string;
  requestedAt: string | null;
  completedAt: string | null;
  failureReason: string | null;
  webhookStatus: number | null;
}

export interface SelfUpdateStatus {
  enabled: boolean;
  available: boolean;
  mode: 'external-webhook' | 'manual';
  blockedReason:
    | 'disabled'
    | 'missing_webhook'
    | 'missing_secret'
    | 'checks_disabled'
    | 'no_update'
    | 'missing_docker_image'
    | 'invalid_target'
    | 'active_job'
    | null;
  targetVersion: string | null;
  repository: string;
  digest: string | null;
  webhookConfigured: boolean;
  manualCommands: string;
  job: SelfUpdateJob | null;
}

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
  selfUpdate?: SelfUpdateStatus;
}

export const VERSION_INFO_QUERY_KEY = ['admin', 'version'] as const;
export const SELF_UPDATE_QUERY_KEY = ['admin', 'version', 'self-update'] as const;

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

async function startSelfUpdate(targetVersion: string): Promise<SelfUpdateStatus> {
  const response = await fetch('/api/admin/version/self-update', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ targetVersion, acknowledged: true }),
  });
  const payload = await response.json().catch(() => ({ error: 'Failed to start self-update' }));
  if (!response.ok) {
    throw new Error(payload.error || 'Failed to start self-update');
  }
  return payload as SelfUpdateStatus;
}

export function useStartSelfUpdate() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: startSelfUpdate,
    onSuccess: (data) => {
      queryClient.setQueryData(SELF_UPDATE_QUERY_KEY, data);
      queryClient.invalidateQueries({ queryKey: VERSION_INFO_QUERY_KEY });
    },
  });
}
