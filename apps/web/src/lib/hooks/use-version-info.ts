import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';

export interface SelfUpdateJob {
  id: string;
  status: 'queued' | 'requested' | 'running' | 'succeeded' | 'failed';
  currentVersion: string;
  targetVersion: string;
  repository: string;
  imageTag: string;
  digest: string | null;
  imageRef?: string | null;
  backup?: SelfUpdateBackupSnapshot | null;
  releaseUrl: string | null;
  triggeredBy: string;
  createdAt: string;
  updatedAt: string;
  requestedAt: string | null;
  completedAt: string | null;
  failureReason: string | null;
  webhookStatus: number | null;
}

export interface SelfUpdateBackupArtifact {
  path: string | null;
  sha256: string | null;
  sizeBytes: number | null;
}

export interface SelfUpdateBackupSnapshot {
  id: string;
  status: 'pending' | 'succeeded' | 'failed' | 'skipped';
  required: boolean;
  directory: string;
  startedAt: string;
  completedAt: string | null;
  database: SelfUpdateBackupArtifact | null;
  uploads: SelfUpdateBackupArtifact | null;
  manifest: SelfUpdateBackupArtifact | null;
  failureReason: string | null;
}

export interface SelfUpdateBackupPreflight {
  required: boolean;
  available: boolean;
  directory: string;
  uploadsPath: string;
  postgresDumpAvailable: boolean;
  uploadsReadable: boolean;
  backupDirWritable: boolean;
  blockedReason:
    | 'missing_pg_dump'
    | 'backup_dir_unwritable'
    | 'uploads_unreadable'
    | 'database_url_missing'
    | null;
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
    | 'missing_digest'
    | 'backup_unavailable'
    | 'invalid_target'
    | 'active_job'
    | null;
  targetVersion: string | null;
  repository: string;
  digest: string | null;
  imageRef: string | null;
  backupPreflight: SelfUpdateBackupPreflight;
  webhookConfigured: boolean;
  manualCommands: string;
  job: SelfUpdateJob | null;
}

export interface VersionUpdatePreferences {
  bannerEnabled: boolean;
  availableUpdateNotificationsEnabled: boolean;
  postUpdateNotificationsEnabled: boolean;
  updatedAt: string | null;
  updatedBy: string | null;
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
  updatePreferences?: VersionUpdatePreferences;
  selfUpdate?: SelfUpdateStatus;
}

export const VERSION_INFO_QUERY_KEY = ['admin', 'version'] as const;
export const SELF_UPDATE_QUERY_KEY = ['admin', 'version', 'self-update'] as const;
export const VERSION_PREFERENCES_QUERY_KEY = ['admin', 'version', 'preferences'] as const;

async function fetchVersionInfo(loadError: string, refresh = false): Promise<VersionInfo> {
  const response = await fetch(`/api/admin/version${refresh ? '?refresh=true' : ''}`);
  const payload = await response.json().catch(() => ({ error: loadError }));
  if (!response.ok) {
    throw new Error(payload.error || loadError);
  }
  return payload as VersionInfo;
}

// Current vs. latest platform version (cached server-side with a 6h TTL).
export function useVersionInfo() {
  const t = useTranslations('hookErrors.version');

  return useQuery({
    queryKey: VERSION_INFO_QUERY_KEY,
    queryFn: () => fetchVersionInfo(t('load')),
    staleTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
  });
}

// Force a fresh upstream check past the server-side cache TTL.
export function useRefreshVersionInfo() {
  const queryClient = useQueryClient();
  const t = useTranslations('hookErrors.version');

  return useMutation({
    mutationFn: () => fetchVersionInfo(t('load'), true),
    onSuccess: (data) => {
      queryClient.setQueryData(VERSION_INFO_QUERY_KEY, data);
    },
  });
}

async function startSelfUpdate(
  targetVersion: string,
  startError: string
): Promise<SelfUpdateStatus> {
  const response = await fetch('/api/admin/version/self-update', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ targetVersion, confirmedVersion: targetVersion, acknowledged: true }),
  });
  const payload = await response.json().catch(() => ({ error: startError }));
  if (!response.ok) {
    throw new Error(payload.error || startError);
  }
  return payload as SelfUpdateStatus;
}

async function updateVersionPreferences(
  patch: Partial<
    Pick<
      VersionUpdatePreferences,
      'bannerEnabled' | 'availableUpdateNotificationsEnabled' | 'postUpdateNotificationsEnabled'
    >
  >,
  updateError: string
): Promise<VersionUpdatePreferences> {
  const response = await fetch('/api/admin/version/preferences', {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(patch),
  });
  const payload = await response.json().catch(() => ({ error: updateError }));
  if (!response.ok) {
    throw new Error(payload.error || updateError);
  }
  return payload as VersionUpdatePreferences;
}

export function useUpdateVersionPreferences() {
  const queryClient = useQueryClient();
  const t = useTranslations('hookErrors.version');

  return useMutation({
    mutationFn: (
      patch: Partial<
        Pick<
          VersionUpdatePreferences,
          'bannerEnabled' | 'availableUpdateNotificationsEnabled' | 'postUpdateNotificationsEnabled'
        >
      >
    ) => updateVersionPreferences(patch, t('updatePreferences')),
    onSuccess: (preferences) => {
      queryClient.setQueryData(VERSION_PREFERENCES_QUERY_KEY, preferences);
      queryClient.setQueryData<VersionInfo | undefined>(VERSION_INFO_QUERY_KEY, (current) =>
        current ? { ...current, updatePreferences: preferences } : current
      );
      queryClient.invalidateQueries({ queryKey: VERSION_INFO_QUERY_KEY });
    },
  });
}

export function useStartSelfUpdate() {
  const queryClient = useQueryClient();
  const t = useTranslations('hookErrors.version');

  return useMutation({
    mutationFn: (targetVersion: string) => startSelfUpdate(targetVersion, t('startSelfUpdate')),
    onSuccess: (data) => {
      queryClient.setQueryData(SELF_UPDATE_QUERY_KEY, data);
      queryClient.invalidateQueries({ queryKey: VERSION_INFO_QUERY_KEY });
    },
  });
}
