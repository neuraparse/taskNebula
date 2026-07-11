import { routeIntegrationOAuthIntent } from './integration-oauth-routing';

describe('integration OAuth routing', () => {
  it('routes successful integration callbacks to organization integrations and refreshes cache', () => {
    const consumeAuthIntent = jest.fn();
    const invalidateWorkspaceIntegrationQueries = jest.fn();
    const navigateToOrganizationSettings = jest.fn().mockReturnValue(true);
    const queryClient = { invalidateQueries: jest.fn() };

    expect(
      routeIntegrationOAuthIntent(
        {
          kind: 'integration-oauth',
          rawUrl:
            'tasknebula://integrations/oauth?server=https%3A%2F%2Ftasks.example.com&provider=github&status=connected',
          serverUrl: 'https://tasks.example.com',
          provider: 'github',
          status: 'connected',
        },
        {
          consumeAuthIntent,
          invalidateWorkspaceIntegrationQueries,
          navigateToOrganizationSettings,
          queryClient,
        },
      ),
    ).toBe(true);

    expect(navigateToOrganizationSettings).toHaveBeenCalledWith('integrations', {
      integrationProvider: 'github',
      integrationStatus: 'connected',
    });
    expect(consumeAuthIntent).toHaveBeenCalledTimes(1);
    expect(invalidateWorkspaceIntegrationQueries).toHaveBeenCalledWith(queryClient);
  });

  it('keeps the pending callback when navigation is not ready', () => {
    const consumeAuthIntent = jest.fn();
    const invalidateWorkspaceIntegrationQueries = jest.fn();
    const navigateToOrganizationSettings = jest.fn().mockReturnValue(false);
    const queryClient = { invalidateQueries: jest.fn() };

    expect(
      routeIntegrationOAuthIntent(
        {
          kind: 'integration-oauth',
          rawUrl:
            'tasknebula://integrations/oauth?provider=slack&status=error&reason=invalid_state',
          provider: 'slack',
          status: 'error',
          reason: 'invalid_state',
        },
        {
          consumeAuthIntent,
          invalidateWorkspaceIntegrationQueries,
          navigateToOrganizationSettings,
          queryClient,
        },
      ),
    ).toBe(false);

    expect(navigateToOrganizationSettings).toHaveBeenCalledWith('integrations', {
      integrationProvider: 'slack',
      integrationStatus: 'error',
      integrationReason: 'invalid_state',
    });
    expect(consumeAuthIntent).not.toHaveBeenCalled();
    expect(invalidateWorkspaceIntegrationQueries).not.toHaveBeenCalled();
  });
});
