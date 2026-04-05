import { useOrganization } from '../use-organization';

describe('useOrganization', () => {
  beforeEach(() => {
    localStorage.clear();
    useOrganization.setState({
      currentOrganizationId: null,
      currentTeamId: null,
    });
  });

  it('preserves the current teamspace when the same organization stays active', () => {
    useOrganization.getState().setCurrentOrganization('org-1');
    useOrganization.getState().setCurrentTeam('team-1');

    useOrganization.getState().setCurrentOrganization('org-1');

    expect(useOrganization.getState()).toMatchObject({
      currentOrganizationId: 'org-1',
      currentTeamId: 'team-1',
    });
  });

  it('clears the current teamspace when the organization changes', () => {
    useOrganization.getState().setCurrentOrganization('org-1');
    useOrganization.getState().setCurrentTeam('team-1');

    useOrganization.getState().setCurrentOrganization('org-2');

    expect(useOrganization.getState()).toMatchObject({
      currentOrganizationId: 'org-2',
      currentTeamId: null,
    });
  });

  it('clears both organization and teamspace context', () => {
    useOrganization.getState().setCurrentOrganization('org-1');
    useOrganization.getState().setCurrentTeam('team-1');

    useOrganization.getState().clearContext();

    expect(useOrganization.getState()).toMatchObject({
      currentOrganizationId: null,
      currentTeamId: null,
    });
  });
});
