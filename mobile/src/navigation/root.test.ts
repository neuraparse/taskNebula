const mockNavigate = jest.fn();
const mockIsReady = jest.fn();

function loadRootNavigation(): typeof import('./root') {
  jest.resetModules();
  jest.doMock('@react-navigation/native', () => ({
    createNavigationContainerRef: () => ({
      isReady: mockIsReady,
      navigate: mockNavigate,
    }),
  }));
  let root: typeof import('./root') | null = null;
  jest.isolateModules(() => {
    root = jest.requireActual<typeof import('./root')>('./root');
  });
  if (!root) throw new Error('Failed to load root navigation helpers');
  return root;
}

describe('root navigation helpers', () => {
  beforeEach(() => {
    mockNavigate.mockReset();
    mockIsReady.mockReset();
    mockIsReady.mockReturnValue(true);
  });

  it('opens accepted project invites on the same Views surface as web /projects/:id', () => {
    const { navigateToProject } = loadRootNavigation();

    expect(navigateToProject('TN-CORE')).toBe(true);

    expect(mockNavigate).toHaveBeenCalledWith('ProjectViews', { projectId: 'TN-CORE' });
  });

  it('reports failed navigation without consuming pending intents when the navigator is not ready', () => {
    mockIsReady.mockReturnValue(false);
    const { navigateToContentDeepLink, navigateToOrganizationSettings, navigateToProject } =
      loadRootNavigation();

    expect(navigateToProject('TN-CORE')).toBe(false);
    expect(
      navigateToOrganizationSettings('integrations', {
        integrationProvider: 'github',
        integrationStatus: 'connected',
      }),
    ).toBe(false);
    expect(
      navigateToContentDeepLink({
        kind: 'screen',
        rawUrl: 'https://tasks.example.com/search?q=auth',
        screen: 'Search',
        searchQuery: 'auth',
      }),
    ).toBe(false);
    expect(mockNavigate).not.toHaveBeenCalled();
  });

  it('routes default project deep links to ProjectViews', () => {
    const { navigateToContentDeepLink } = loadRootNavigation();

    expect(
      navigateToContentDeepLink({
        kind: 'project',
        rawUrl: 'https://tasks.example.com/projects/project_1',
        projectId: 'project_1',
        section: 'views',
      }),
    ).toBe(true);

    expect(mockNavigate).toHaveBeenCalledWith('ProjectViews', { projectId: 'project_1' });
  });

  it('routes project board deep links with issue filters', () => {
    const { navigateToContentDeepLink } = loadRootNavigation();

    navigateToContentDeepLink({
      kind: 'project',
      rawUrl:
        'https://tasks.example.com/projects/project_1/board?q=auth&status=in_progress&type=bug&sprintId=backlog',
      projectId: 'project_1',
      section: 'board',
      projectIssueQuery: 'auth',
      projectIssueStatus: 'in_progress',
      projectIssueType: 'bug',
      projectIssueSprintId: 'none',
    });

    expect(mockNavigate).toHaveBeenCalledWith('ProjectDetail', {
      id: 'project_1',
      viewMode: 'board',
      query: 'auth',
      status: 'in_progress',
      type: 'bug',
      sprintId: 'none',
    });
  });

  it('routes project backlog deep links with backlog-compatible filters', () => {
    const { navigateToContentDeepLink } = loadRootNavigation();

    navigateToContentDeepLink({
      kind: 'project',
      rawUrl:
        'https://tasks.example.com/projects/project_1/backlog?query=docs&status=todo&type=story',
      projectId: 'project_1',
      section: 'backlog',
      projectIssueQuery: 'docs',
      projectIssueStatus: 'todo',
      projectIssueType: 'story',
      projectIssueSprintId: 'sprint_1',
    });

    expect(mockNavigate).toHaveBeenCalledWith('ProjectBacklog', {
      projectId: 'project_1',
      query: 'docs',
      status: 'todo',
      type: 'story',
    });
  });

  it('routes model card links to AI Transparency with focus', () => {
    const { navigateToContentDeepLink } = loadRootNavigation();

    navigateToContentDeepLink({
      kind: 'screen',
      rawUrl: 'https://tasks.example.com/ai-model-cards',
      screen: 'AiTransparency',
      aiTransparencyFocus: 'modelCards',
    });

    expect(mockNavigate).toHaveBeenCalledWith('AiTransparency', { focus: 'modelCards' });
  });

  it('routes integration OAuth results to organization integrations settings', () => {
    const { navigateToOrganizationSettings } = loadRootNavigation();

    navigateToOrganizationSettings('integrations', {
      integrationProvider: 'github',
      integrationStatus: 'connected',
    });

    expect(mockNavigate).toHaveBeenCalledWith('OrganizationSettings', {
      section: 'integrations',
      integrationProvider: 'github',
      integrationStatus: 'connected',
    });
  });

  it('routes billing deep links to the organization settings general section like web', () => {
    const { navigateToContentDeepLink } = loadRootNavigation();

    navigateToContentDeepLink({
      kind: 'screen',
      rawUrl: 'https://tasks.example.com/settings/billing',
      screen: 'OrganizationSettings',
      organizationSection: 'general',
    });

    expect(mockNavigate).toHaveBeenCalledWith('OrganizationSettings', { section: 'general' });
  });

  it('passes dashboard route notices to the Dashboard tab', () => {
    const { navigateToContentDeepLink } = loadRootNavigation();

    navigateToContentDeepLink({
      kind: 'tab',
      rawUrl: 'https://tasks.example.com/dashboard?error=insufficient-permission',
      tab: 'Dashboard',
      dashboardNotice: 'accessDenied',
    });

    expect(mockNavigate).toHaveBeenCalledWith('MainTabs', {
      screen: 'Dashboard',
      params: { notice: 'accessDenied' },
    });
  });

  it('routes /issues links to the global issues stack screen with filters', () => {
    const { navigateToContentDeepLink } = loadRootNavigation();

    navigateToContentDeepLink({
      kind: 'screen',
      rawUrl: 'https://tasks.example.com/issues?status=in_progress&type=bug',
      screen: 'IssuesList',
      issueListStatus: 'in_progress',
      issueListType: 'bug',
    });

    expect(mockNavigate).toHaveBeenCalledWith('IssuesList', {
      status: 'in_progress',
      type: 'bug',
    });
  });
});
