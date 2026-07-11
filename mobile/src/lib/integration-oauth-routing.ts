import type { QueryClient } from '@tanstack/react-query';

import type { AuthDeepLink } from './deep-links';
import type {
  OrganizationSettingsIntegrationStatus,
  OrganizationSettingsSection,
} from '@/navigation/types';

type IntegrationOAuthIntent = Extract<AuthDeepLink, { kind: 'integration-oauth' }>;

type IntegrationRouteParams = {
  integrationProvider: string;
  integrationStatus: OrganizationSettingsIntegrationStatus;
  integrationReason?: string;
};

type IntegrationOAuthRoutingDeps = {
  consumeAuthIntent: () => unknown;
  invalidateWorkspaceIntegrationQueries: (
    queryClient: Pick<QueryClient, 'invalidateQueries'>,
  ) => void;
  navigateToOrganizationSettings: (
    section?: OrganizationSettingsSection,
    params?: IntegrationRouteParams,
  ) => boolean;
  queryClient: Pick<QueryClient, 'invalidateQueries'>;
};

export function routeIntegrationOAuthIntent(
  intent: IntegrationOAuthIntent,
  deps: IntegrationOAuthRoutingDeps,
): boolean {
  const navigated = deps.navigateToOrganizationSettings('integrations', {
    integrationProvider: intent.provider,
    integrationStatus: intent.status,
    ...(intent.reason ? { integrationReason: intent.reason } : {}),
  });
  if (!navigated) return false;

  deps.consumeAuthIntent();
  deps.invalidateWorkspaceIntegrationQueries(deps.queryClient);
  return true;
}
