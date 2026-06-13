import { useQuery } from '@tanstack/react-query';
import { VERSION_INFO_QUERY_KEY, type VersionInfo } from '@/lib/hooks/use-version-info';

// Match the server-side cache TTL (6h) so the client never out-polls the cache.
const POLL_INTERVAL_MS = 6 * 60 * 60 * 1000;

async function fetchVersionInfo(): Promise<VersionInfo> {
  // Non-forced read: hits the server's 6h cache, so the poll never triggers
  // an upstream GitHub fetch more often than the TTL allows.
  const response = await fetch('/api/admin/version');
  const payload = await response
    .json()
    .catch(() => ({ error: 'Failed to load version information' }));
  if (!response.ok) {
    throw new Error(payload.error || 'Failed to load version information');
  }
  return payload as VersionInfo;
}

/**
 * Version info with a gentle background poll so a freshly-pulled image surfaces
 * the update banner without a manual "Check now" click.
 *
 * Shares the `VERSION_INFO_QUERY_KEY` cache with `useVersionInfo`, so the
 * version panel and the banner stay in sync. Polling pauses while the tab is in
 * the background and stops entirely once the server reports the check is
 * disabled (`TASKNEBULA_DISABLE_UPDATE_CHECK`), so we never hammer the endpoint.
 */
export function useVersionPoll() {
  return useQuery({
    queryKey: VERSION_INFO_QUERY_KEY,
    queryFn: () => fetchVersionInfo(),
    staleTime: POLL_INTERVAL_MS,
    refetchOnWindowFocus: false,
    // Function form lets us read the latest data and disable the timer once the
    // server says update checks are off — returning false stops the interval.
    refetchInterval: (query) => (query.state.data?.checkDisabled ? false : POLL_INTERVAL_MS),
    // Don't keep polling a hidden tab; resumes on focus/visibility regain.
    refetchIntervalInBackground: false,
  });
}
