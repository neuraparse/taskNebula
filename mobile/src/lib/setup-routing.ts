import type { InitialSetupResult } from '@/api/auth';
import type { ContentDeepLink } from './deep-links';
import { contentIntentFromAuthCallbackUrl } from './deep-link-routing';

export function contentIntentFromSetupResult(
  result: InitialSetupResult,
  serverUrl: string | null,
): ContentDeepLink | null {
  const nextPathIntent = contentIntentFromAuthCallbackUrl(result.nextPath, serverUrl);
  if (nextPathIntent) return nextPathIntent;

  const importSource = result.import?.source;
  const importProjectId = result.import?.projectId;
  if (!importSource || !importProjectId) return null;

  const query = new URLSearchParams({
    source: importSource,
    projectId: importProjectId,
  }).toString();
  return {
    kind: 'screen',
    rawUrl: serverUrl
      ? `${serverUrl}/settings/import?${query}`
      : `tasknebula://settings/import?${query}`,
    ...(serverUrl ? { serverUrl } : {}),
    screen: 'ImportSettings',
    importSource,
    importProjectId,
  };
}
