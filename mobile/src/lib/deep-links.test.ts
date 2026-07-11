import { parseTaskNebulaDeepLink } from './deep-links';

describe('TaskNebula deep links', () => {
  it('parses custom scheme server links', () => {
    expect(parseTaskNebulaDeepLink('tasknebula://connect?server=10.0.2.2:3000')).toEqual({
      kind: 'server',
      rawUrl: 'tasknebula://connect?server=10.0.2.2:3000',
      serverUrl: 'http://10.0.2.2:3000',
    });

    expect(parseTaskNebulaDeepLink('https://tasks.example.com/setup')).toEqual({
      kind: 'server',
      rawUrl: 'https://tasks.example.com/setup',
      serverUrl: 'https://tasks.example.com',
    });
  });

  it('parses custom scheme reset links', () => {
    expect(
      parseTaskNebulaDeepLink(
        'tasknebula://auth/reset-password?server=https%3A%2F%2Ftasks.example.com&token=reset-1',
      ),
    ).toEqual({
      kind: 'reset-password',
      rawUrl:
        'tasknebula://auth/reset-password?server=https%3A%2F%2Ftasks.example.com&token=reset-1',
      serverUrl: 'https://tasks.example.com',
      token: 'reset-1',
    });

    expect(
      parseTaskNebulaDeepLink('https://tasks.example.com/auth/reset-password?token=reset-web'),
    ).toEqual({
      kind: 'reset-password',
      rawUrl: 'https://tasks.example.com/auth/reset-password?token=reset-web',
      serverUrl: 'https://tasks.example.com',
      token: 'reset-web',
    });

    expect(parseTaskNebulaDeepLink('https://tasks.example.com/auth/reset-password')).toEqual({
      kind: 'forgot-password',
      rawUrl: 'https://tasks.example.com/auth/reset-password',
      serverUrl: 'https://tasks.example.com',
    });

    expect(
      parseTaskNebulaDeepLink(
        'https://tasks.example.com/auth/reset-password?email=User%40Example.com',
      ),
    ).toEqual({
      kind: 'forgot-password',
      rawUrl: 'https://tasks.example.com/auth/reset-password?email=User%40Example.com',
      serverUrl: 'https://tasks.example.com',
      email: 'user@example.com',
    });
  });

  it('parses native integration OAuth callback links', () => {
    expect(
      parseTaskNebulaDeepLink(
        'tasknebula://integrations/oauth?server=https%3A%2F%2Ftasks.example.com&provider=github&status=connected',
      ),
    ).toEqual({
      kind: 'integration-oauth',
      rawUrl:
        'tasknebula://integrations/oauth?server=https%3A%2F%2Ftasks.example.com&provider=github&status=connected',
      serverUrl: 'https://tasks.example.com',
      provider: 'github',
      status: 'connected',
    });

    expect(
      parseTaskNebulaDeepLink(
        'tasknebula://integrations/oauth?provider=slack&status=error&reason=invalid_state',
      ),
    ).toEqual({
      kind: 'integration-oauth',
      rawUrl: 'tasknebula://integrations/oauth?provider=slack&status=error&reason=invalid_state',
      provider: 'slack',
      status: 'error',
      reason: 'invalid_state',
    });
  });

  it('parses native login OAuth callback links', () => {
    expect(
      parseTaskNebulaDeepLink(
        'tasknebula://auth/oauth?server=https%3A%2F%2Ftasks.example.com&provider=github&status=authenticated&token=exchange-1',
      ),
    ).toEqual({
      kind: 'login-oauth',
      rawUrl:
        'tasknebula://auth/oauth?server=https%3A%2F%2Ftasks.example.com&provider=github&status=authenticated&token=exchange-1',
      serverUrl: 'https://tasks.example.com',
      provider: 'github',
      status: 'authenticated',
      token: 'exchange-1',
    });

    expect(
      parseTaskNebulaDeepLink(
        'tasknebula://auth/oauth?provider=google&status=error&reason=unauthorized',
      ),
    ).toEqual({
      kind: 'login-oauth',
      rawUrl: 'tasknebula://auth/oauth?provider=google&status=error&reason=unauthorized',
      provider: 'google',
      status: 'error',
      reason: 'unauthorized',
    });
  });

  it('parses native SAML callback links', () => {
    expect(
      parseTaskNebulaDeepLink(
        'tasknebula://auth/saml?server=https%3A%2F%2Ftasks.example.com&workspace=acme&status=authenticated&token=saml-1',
      ),
    ).toEqual({
      kind: 'saml',
      rawUrl:
        'tasknebula://auth/saml?server=https%3A%2F%2Ftasks.example.com&workspace=acme&status=authenticated&token=saml-1',
      serverUrl: 'https://tasks.example.com',
      workspace: 'acme',
      status: 'authenticated',
      token: 'saml-1',
    });

    expect(
      parseTaskNebulaDeepLink(
        'tasknebula://auth/saml?workspace=acme&status=error&reason=invalid_response',
      ),
    ).toEqual({
      kind: 'saml',
      rawUrl: 'tasknebula://auth/saml?workspace=acme&status=error&reason=invalid_response',
      workspace: 'acme',
      status: 'error',
      reason: 'invalid_response',
    });
  });

  it('parses web signup links and infers the self-host server origin', () => {
    expect(
      parseTaskNebulaDeepLink(
        'https://tasks.example.com/auth/signup?email=User%40Example.com&token=invite-1',
      ),
    ).toEqual({
      kind: 'signup',
      rawUrl: 'https://tasks.example.com/auth/signup?email=User%40Example.com&token=invite-1',
      serverUrl: 'https://tasks.example.com',
      email: 'user@example.com',
      inviteToken: 'invite-1',
    });
  });

  it('parses web sign-in and password reset request links', () => {
    expect(parseTaskNebulaDeepLink('https://tasks.example.com/auth/signin')).toEqual({
      kind: 'server',
      rawUrl: 'https://tasks.example.com/auth/signin',
      serverUrl: 'https://tasks.example.com',
    });

    expect(
      parseTaskNebulaDeepLink('https://tasks.example.com/auth/signin?projectInviteToken=project-1'),
    ).toEqual({
      kind: 'signin',
      rawUrl: 'https://tasks.example.com/auth/signin?projectInviteToken=project-1',
      serverUrl: 'https://tasks.example.com',
      projectInviteToken: 'project-1',
    });

    expect(
      parseTaskNebulaDeepLink(
        'https://tasks.example.com/auth/signin?callbackUrl=%2Fsettings%2Fimport%3Fsource%3Dplane%26projectId%3Dproject-1',
      ),
    ).toEqual({
      kind: 'signin',
      rawUrl:
        'https://tasks.example.com/auth/signin?callbackUrl=%2Fsettings%2Fimport%3Fsource%3Dplane%26projectId%3Dproject-1',
      serverUrl: 'https://tasks.example.com',
      callbackUrl: '/settings/import?source=plane&projectId=project-1',
    });

    expect(parseTaskNebulaDeepLink('https://tasks.example.com/auth/signin?verified=1')).toEqual({
      kind: 'signin',
      rawUrl: 'https://tasks.example.com/auth/signin?verified=1',
      serverUrl: 'https://tasks.example.com',
      signinStatus: 'verified',
    });

    expect(parseTaskNebulaDeepLink('https://tasks.example.com/auth/signin?reset=1')).toEqual({
      kind: 'signin',
      rawUrl: 'https://tasks.example.com/auth/signin?reset=1',
      serverUrl: 'https://tasks.example.com',
      signinStatus: 'reset',
    });

    expect(
      parseTaskNebulaDeepLink('https://tasks.example.com/auth/signin?error=CredentialsSignin'),
    ).toEqual({
      kind: 'signin',
      rawUrl: 'https://tasks.example.com/auth/signin?error=CredentialsSignin',
      serverUrl: 'https://tasks.example.com',
      signinError: 'CredentialsSignin',
    });

    expect(
      parseTaskNebulaDeepLink('https://tasks.example.com/auth/error?error=Verification'),
    ).toEqual({
      kind: 'signin',
      rawUrl: 'https://tasks.example.com/auth/error?error=Verification',
      serverUrl: 'https://tasks.example.com',
      signinError: 'Verification',
    });

    expect(
      parseTaskNebulaDeepLink(
        'tasknebula://auth/oauth?server=https%3A%2F%2Ftasks.example.com&provider=github&status=authenticated&token=exchange-1&callbackUrl=%2Fsettings%2Fsso',
      ),
    ).toEqual({
      kind: 'login-oauth',
      rawUrl:
        'tasknebula://auth/oauth?server=https%3A%2F%2Ftasks.example.com&provider=github&status=authenticated&token=exchange-1&callbackUrl=%2Fsettings%2Fsso',
      serverUrl: 'https://tasks.example.com',
      provider: 'github',
      status: 'authenticated',
      token: 'exchange-1',
      callbackUrl: '/settings/sso',
    });

    expect(
      parseTaskNebulaDeepLink(
        'tasknebula://auth/saml?server=https%3A%2F%2Ftasks.example.com&workspace=acme&status=authenticated&token=saml-1&callbackUrl=%2Fprojects%2FTN%2Fchat',
      ),
    ).toEqual({
      kind: 'saml',
      rawUrl:
        'tasknebula://auth/saml?server=https%3A%2F%2Ftasks.example.com&workspace=acme&status=authenticated&token=saml-1&callbackUrl=%2Fprojects%2FTN%2Fchat',
      serverUrl: 'https://tasks.example.com',
      workspace: 'acme',
      status: 'authenticated',
      token: 'saml-1',
      callbackUrl: '/projects/TN/chat',
    });

    expect(
      parseTaskNebulaDeepLink(
        'https://tasks.example.com/auth/forgot-password?email=User%40Example.com',
      ),
    ).toEqual({
      kind: 'forgot-password',
      rawUrl: 'https://tasks.example.com/auth/forgot-password?email=User%40Example.com',
      serverUrl: 'https://tasks.example.com',
      email: 'user@example.com',
    });
  });

  it('parses project join links', () => {
    expect(parseTaskNebulaDeepLink('https://tasks.example.com/join/project/project-1')).toEqual({
      kind: 'signup',
      rawUrl: 'https://tasks.example.com/join/project/project-1',
      serverUrl: 'https://tasks.example.com',
      projectInviteToken: 'project-1',
    });
  });

  it('rejects malformed encoded path segments without throwing', () => {
    expect(() =>
      parseTaskNebulaDeepLink('https://tasks.example.com/projects/%E0%A4%A'),
    ).not.toThrow();
    expect(parseTaskNebulaDeepLink('https://tasks.example.com/projects/%E0%A4%A')).toBeNull();

    expect(() =>
      parseTaskNebulaDeepLink('https://tasks.example.com/api/auth/verify-email/%E0%A4%A'),
    ).not.toThrow();
    expect(
      parseTaskNebulaDeepLink('https://tasks.example.com/api/auth/verify-email/%E0%A4%A'),
    ).toBeNull();

    expect(() =>
      parseTaskNebulaDeepLink('https://tasks.example.com/join/project/%E0%A4%A'),
    ).not.toThrow();
    expect(parseTaskNebulaDeepLink('https://tasks.example.com/join/project/%E0%A4%A')).toBeNull();
  });

  it('parses email verification links with tokens', () => {
    expect(
      parseTaskNebulaDeepLink(
        'https://tasks.example.com/auth/verify-email?token=verify-1&email=User%40Example.com',
      ),
    ).toEqual({
      kind: 'verify-email',
      rawUrl: 'https://tasks.example.com/auth/verify-email?token=verify-1&email=User%40Example.com',
      serverUrl: 'https://tasks.example.com',
      token: 'verify-1',
      email: 'user@example.com',
    });

    expect(
      parseTaskNebulaDeepLink('https://tasks.example.com/api/auth/verify-email/verify-2'),
    ).toEqual({
      kind: 'verify-email',
      rawUrl: 'https://tasks.example.com/api/auth/verify-email/verify-2',
      serverUrl: 'https://tasks.example.com',
      token: 'verify-2',
    });

    expect(
      parseTaskNebulaDeepLink('https://tasks.example.com/auth/verify-email?error=expired'),
    ).toEqual({
      kind: 'verify-email',
      rawUrl: 'https://tasks.example.com/auth/verify-email?error=expired',
      serverUrl: 'https://tasks.example.com',
      verifyError: 'expired',
    });

    expect(
      parseTaskNebulaDeepLink(
        'https://tasks.example.com/auth/verify-request?email=User%40Example.com',
      ),
    ).toEqual({
      kind: 'verify-email',
      rawUrl: 'https://tasks.example.com/auth/verify-request?email=User%40Example.com',
      serverUrl: 'https://tasks.example.com',
      email: 'user@example.com',
    });
  });

  it('parses locale-prefixed project content links', () => {
    expect(parseTaskNebulaDeepLink('https://tasks.example.com/projects/project_1')).toEqual({
      kind: 'project',
      rawUrl: 'https://tasks.example.com/projects/project_1',
      serverUrl: 'https://tasks.example.com',
      projectId: 'project_1',
      section: 'views',
    });

    expect(parseTaskNebulaDeepLink('https://tasks.example.com/tr/projects/project_1/docs')).toEqual(
      {
        kind: 'project',
        rawUrl: 'https://tasks.example.com/tr/projects/project_1/docs',
        serverUrl: 'https://tasks.example.com',
        projectId: 'project_1',
        section: 'docs',
      },
    );

    expect(
      parseTaskNebulaDeepLink('https://tasks.example.com/en/projects/project_1/board'),
    ).toEqual({
      kind: 'project',
      rawUrl: 'https://tasks.example.com/en/projects/project_1/board',
      serverUrl: 'https://tasks.example.com',
      projectId: 'project_1',
      section: 'board',
    });

    expect(
      parseTaskNebulaDeepLink(
        'https://tasks.example.com/projects/project_1/board?q=auth&status=in_progress&type=bug&sprintId=backlog',
      ),
    ).toEqual({
      kind: 'project',
      rawUrl:
        'https://tasks.example.com/projects/project_1/board?q=auth&status=in_progress&type=bug&sprintId=backlog',
      serverUrl: 'https://tasks.example.com',
      projectId: 'project_1',
      section: 'board',
      projectIssueQuery: 'auth',
      projectIssueStatus: 'in_progress',
      projectIssueType: 'bug',
      projectIssueSprintId: 'none',
    });

    expect(
      parseTaskNebulaDeepLink(
        'https://tasks.example.com/projects/project_1/backlog?query=docs&status=todo&type=story',
      ),
    ).toEqual({
      kind: 'project',
      rawUrl:
        'https://tasks.example.com/projects/project_1/backlog?query=docs&status=todo&type=story',
      serverUrl: 'https://tasks.example.com',
      projectId: 'project_1',
      section: 'backlog',
      projectIssueQuery: 'docs',
      projectIssueStatus: 'todo',
      projectIssueType: 'story',
    });

    expect(
      parseTaskNebulaDeepLink('https://tasks.example.com/projects/project_1/chat?roomId=room_1'),
    ).toEqual({
      kind: 'project',
      rawUrl: 'https://tasks.example.com/projects/project_1/chat?roomId=room_1',
      serverUrl: 'https://tasks.example.com',
      projectId: 'project_1',
      section: 'chat',
      roomId: 'room_1',
    });
  });

  it('parses issue, document, and tab content links', () => {
    expect(parseTaskNebulaDeepLink('https://tasks.example.com/')).toEqual({
      kind: 'tab',
      rawUrl: 'https://tasks.example.com/',
      serverUrl: 'https://tasks.example.com',
      tab: 'Dashboard',
    });

    expect(parseTaskNebulaDeepLink('https://tasks.example.com/tr')).toEqual({
      kind: 'tab',
      rawUrl: 'https://tasks.example.com/tr',
      serverUrl: 'https://tasks.example.com',
      tab: 'Dashboard',
    });

    expect(parseTaskNebulaDeepLink('https://tasks.example.com/dashboard?verified=1')).toEqual({
      kind: 'tab',
      rawUrl: 'https://tasks.example.com/dashboard?verified=1',
      serverUrl: 'https://tasks.example.com',
      tab: 'Dashboard',
      dashboardNotice: 'emailVerified',
    });

    expect(
      parseTaskNebulaDeepLink('https://tasks.example.com/dashboard?error=insufficient-permission'),
    ).toEqual({
      kind: 'tab',
      rawUrl: 'https://tasks.example.com/dashboard?error=insufficient-permission',
      serverUrl: 'https://tasks.example.com',
      tab: 'Dashboard',
      dashboardNotice: 'accessDenied',
    });

    expect(parseTaskNebulaDeepLink('https://tasks.example.com/issues/issue_1')).toEqual({
      kind: 'issue',
      rawUrl: 'https://tasks.example.com/issues/issue_1',
      serverUrl: 'https://tasks.example.com',
      issueId: 'issue_1',
    });

    expect(parseTaskNebulaDeepLink('https://tasks.example.com/issues')).toEqual({
      kind: 'screen',
      rawUrl: 'https://tasks.example.com/issues',
      serverUrl: 'https://tasks.example.com',
      screen: 'IssuesList',
    });

    expect(
      parseTaskNebulaDeepLink(
        'https://tasks.example.com/issues?q=auth&status=in_progress&type=bug&sprintId=none',
      ),
    ).toEqual({
      kind: 'screen',
      rawUrl: 'https://tasks.example.com/issues?q=auth&status=in_progress&type=bug&sprintId=none',
      serverUrl: 'https://tasks.example.com',
      screen: 'IssuesList',
      issueListQuery: 'auth',
      issueListStatus: 'in_progress',
      issueListSprintId: 'none',
      issueListType: 'bug',
    });

    expect(parseTaskNebulaDeepLink('https://tasks.example.com/my-issues')).toEqual({
      kind: 'tab',
      rawUrl: 'https://tasks.example.com/my-issues',
      serverUrl: 'https://tasks.example.com',
      tab: 'Issues',
      myIssuesView: 'assigned',
    });

    expect(parseTaskNebulaDeepLink('https://tasks.example.com/my-issues?view=created')).toEqual({
      kind: 'tab',
      rawUrl: 'https://tasks.example.com/my-issues?view=created',
      serverUrl: 'https://tasks.example.com',
      tab: 'Issues',
      myIssuesView: 'created',
    });

    expect(parseTaskNebulaDeepLink('https://tasks.example.com/docs?pageId=page_1')).toEqual({
      kind: 'document',
      rawUrl: 'https://tasks.example.com/docs?pageId=page_1',
      serverUrl: 'https://tasks.example.com',
      pageId: 'page_1',
    });

    expect(parseTaskNebulaDeepLink('https://tasks.example.com/docs/page_1')).toEqual({
      kind: 'document',
      rawUrl: 'https://tasks.example.com/docs/page_1',
      serverUrl: 'https://tasks.example.com',
      pageId: 'page_1',
    });

    expect(parseTaskNebulaDeepLink('https://tasks.example.com/docs?spaceId=space_1')).toEqual({
      kind: 'document',
      rawUrl: 'https://tasks.example.com/docs?spaceId=space_1',
      serverUrl: 'https://tasks.example.com',
      spaceId: 'space_1',
    });

    expect(
      parseTaskNebulaDeepLink('https://tasks.example.com/projects/project_1/docs?spaceId=space_1'),
    ).toEqual({
      kind: 'document',
      rawUrl: 'https://tasks.example.com/projects/project_1/docs?spaceId=space_1',
      serverUrl: 'https://tasks.example.com',
      projectId: 'project_1',
      spaceId: 'space_1',
    });

    expect(
      parseTaskNebulaDeepLink('https://tasks.example.com/projects/project_1/docs/page_2'),
    ).toEqual({
      kind: 'document',
      rawUrl: 'https://tasks.example.com/projects/project_1/docs/page_2',
      serverUrl: 'https://tasks.example.com',
      projectId: 'project_1',
      pageId: 'page_2',
    });

    expect(parseTaskNebulaDeepLink('https://tasks.example.com/de/inbox')).toEqual({
      kind: 'tab',
      rawUrl: 'https://tasks.example.com/de/inbox',
      serverUrl: 'https://tasks.example.com',
      tab: 'Inbox',
    });

    expect(parseTaskNebulaDeepLink('https://tasks.example.com/inbox?actor=agent')).toEqual({
      kind: 'tab',
      rawUrl: 'https://tasks.example.com/inbox?actor=agent',
      serverUrl: 'https://tasks.example.com',
      tab: 'Inbox',
      inboxActorFilter: 'agent',
    });

    expect(parseTaskNebulaDeepLink('https://tasks.example.com/inbox?type=reaction')).toEqual({
      kind: 'tab',
      rawUrl: 'https://tasks.example.com/inbox?type=reaction',
      serverUrl: 'https://tasks.example.com',
      tab: 'Inbox',
      inboxTypeFilter: 'reaction',
    });

    expect(
      parseTaskNebulaDeepLink('https://tasks.example.com/inbox?actor=agent&unread=1&type=mention'),
    ).toEqual({
      kind: 'tab',
      rawUrl: 'https://tasks.example.com/inbox?actor=agent&unread=1&type=mention',
      serverUrl: 'https://tasks.example.com',
      tab: 'Inbox',
      inboxActorFilter: 'agent',
      inboxTypeFilter: 'mention',
      inboxUnreadOnly: true,
    });

    expect(parseTaskNebulaDeepLink('https://tasks.example.com/inbox?unread=1')).toEqual({
      kind: 'tab',
      rawUrl: 'https://tasks.example.com/inbox?unread=1',
      serverUrl: 'https://tasks.example.com',
      tab: 'Inbox',
      inboxUnreadOnly: true,
    });

    expect(parseTaskNebulaDeepLink('https://tasks.example.com/inbox?snoozed=1')).toEqual({
      kind: 'tab',
      rawUrl: 'https://tasks.example.com/inbox?snoozed=1',
      serverUrl: 'https://tasks.example.com',
      tab: 'Inbox',
      inboxSnoozedOnly: true,
    });

    expect(parseTaskNebulaDeepLink('https://tasks.example.com/activity')).toEqual({
      kind: 'tab',
      rawUrl: 'https://tasks.example.com/activity',
      serverUrl: 'https://tasks.example.com',
      tab: 'Dashboard',
    });

    expect(parseTaskNebulaDeepLink('https://tasks.example.com/offline')).toEqual({
      kind: 'tab',
      rawUrl: 'https://tasks.example.com/offline',
      serverUrl: 'https://tasks.example.com',
      tab: 'Dashboard',
    });

    expect(parseTaskNebulaDeepLink('https://tasks.example.com/notifications')).toEqual({
      kind: 'tab',
      rawUrl: 'https://tasks.example.com/notifications',
      serverUrl: 'https://tasks.example.com',
      tab: 'Inbox',
    });

    expect(parseTaskNebulaDeepLink('https://tasks.example.com/search?q=login%20bug')).toEqual({
      kind: 'screen',
      rawUrl: 'https://tasks.example.com/search?q=login%20bug',
      serverUrl: 'https://tasks.example.com',
      screen: 'Search',
      searchQuery: 'login bug',
    });

    expect(
      parseTaskNebulaDeepLink(
        'tasknebula://search?server=https%3A%2F%2Ftasks.example.com&query=assigned%20to%20me',
      ),
    ).toEqual({
      kind: 'screen',
      rawUrl: 'tasknebula://search?server=https%3A%2F%2Ftasks.example.com&query=assigned%20to%20me',
      serverUrl: 'https://tasks.example.com',
      screen: 'Search',
      searchQuery: 'assigned to me',
    });
  });

  it('parses sprint and project workflow links', () => {
    expect(
      parseTaskNebulaDeepLink('https://tasks.example.com/projects/project_1/sprints/sprint_1'),
    ).toEqual({
      kind: 'sprint',
      rawUrl: 'https://tasks.example.com/projects/project_1/sprints/sprint_1',
      serverUrl: 'https://tasks.example.com',
      projectId: 'project_1',
      sprintId: 'sprint_1',
    });

    expect(
      parseTaskNebulaDeepLink('https://tasks.example.com/tr/projects/project_1/settings/workflows'),
    ).toEqual({
      kind: 'project',
      rawUrl: 'https://tasks.example.com/tr/projects/project_1/settings/workflows',
      serverUrl: 'https://tasks.example.com',
      projectId: 'project_1',
      section: 'workflows',
    });

    expect(
      parseTaskNebulaDeepLink(
        'https://tasks.example.com/tr/projects/project_1/settings/components',
      ),
    ).toEqual({
      kind: 'project',
      rawUrl: 'https://tasks.example.com/tr/projects/project_1/settings/components',
      serverUrl: 'https://tasks.example.com',
      projectId: 'project_1',
      section: 'components',
    });

    expect(
      parseTaskNebulaDeepLink('https://tasks.example.com/projects/project_1/settings/versions'),
    ).toEqual({
      kind: 'project',
      rawUrl: 'https://tasks.example.com/projects/project_1/settings/versions',
      serverUrl: 'https://tasks.example.com',
      projectId: 'project_1',
      section: 'versions',
    });

    const settingsTabs = [
      'general',
      'permissions',
      'schemes',
      'security',
      'work-item-types',
      'custom-fields',
      'estimates',
      'versions',
      'components',
      'automation',
      'ai-agents',
      'chat-calls',
      'webhooks',
      'workflows',
    ] as const;

    settingsTabs.forEach((tab) => {
      expect(
        parseTaskNebulaDeepLink(`https://tasks.example.com/projects/project_1/settings?tab=${tab}`),
      ).toEqual({
        kind: 'project',
        rawUrl: `https://tasks.example.com/projects/project_1/settings?tab=${tab}`,
        serverUrl: 'https://tasks.example.com',
        projectId: 'project_1',
        section: tab,
      });
    });
  });

  it('parses issue and project creation links', () => {
    expect(
      parseTaskNebulaDeepLink('https://tasks.example.com/issues/new?projectId=project_1&type=bug'),
    ).toEqual({
      kind: 'screen',
      rawUrl: 'https://tasks.example.com/issues/new?projectId=project_1&type=bug',
      serverUrl: 'https://tasks.example.com',
      screen: 'NewIssue',
      newIssueProjectId: 'project_1',
      newIssueType: 'bug',
    });

    expect(
      parseTaskNebulaDeepLink(
        'https://tasks.example.com/projects/project_1/issues/new?issueType=story',
      ),
    ).toEqual({
      kind: 'screen',
      rawUrl: 'https://tasks.example.com/projects/project_1/issues/new?issueType=story',
      serverUrl: 'https://tasks.example.com',
      screen: 'NewIssue',
      newIssueProjectId: 'project_1',
      newIssueType: 'story',
    });

    expect(
      parseTaskNebulaDeepLink(
        'https://tasks.example.com/projects/project_1/sprints/sprint_1/issues/new?type=task',
      ),
    ).toEqual({
      kind: 'screen',
      rawUrl: 'https://tasks.example.com/projects/project_1/sprints/sprint_1/issues/new?type=task',
      serverUrl: 'https://tasks.example.com',
      screen: 'NewIssue',
      newIssueProjectId: 'project_1',
      newIssueSprintId: 'sprint_1',
      newIssueType: 'task',
    });

    expect(parseTaskNebulaDeepLink('https://tasks.example.com/projects/new')).toEqual({
      kind: 'screen',
      rawUrl: 'https://tasks.example.com/projects/new',
      serverUrl: 'https://tasks.example.com',
      screen: 'NewProject',
    });
  });

  it('maps settings notification and member links to mobile tabs', () => {
    expect(parseTaskNebulaDeepLink('https://tasks.example.com/settings/notifications')).toEqual({
      kind: 'tab',
      rawUrl: 'https://tasks.example.com/settings/notifications',
      serverUrl: 'https://tasks.example.com',
      tab: 'Profile',
      profileFocus: 'notifications',
    });

    expect(parseTaskNebulaDeepLink('https://tasks.example.com/settings?tab=notifications')).toEqual(
      {
        kind: 'tab',
        rawUrl: 'https://tasks.example.com/settings?tab=notifications',
        serverUrl: 'https://tasks.example.com',
        tab: 'Profile',
        profileFocus: 'notifications',
      },
    );

    expect(parseTaskNebulaDeepLink('https://tasks.example.com/settings?tab=appearance')).toEqual({
      kind: 'tab',
      rawUrl: 'https://tasks.example.com/settings?tab=appearance',
      serverUrl: 'https://tasks.example.com',
      tab: 'Profile',
      profileFocus: 'appearance',
    });

    expect(parseTaskNebulaDeepLink('https://tasks.example.com/settings?tab=members')).toEqual({
      kind: 'tab',
      rawUrl: 'https://tasks.example.com/settings?tab=members',
      serverUrl: 'https://tasks.example.com',
      tab: 'Team',
    });

    expect(parseTaskNebulaDeepLink('https://tasks.example.com/team?tab=invites')).toEqual({
      kind: 'tab',
      rawUrl: 'https://tasks.example.com/team?tab=invites',
      serverUrl: 'https://tasks.example.com',
      tab: 'Team',
      teamStatusFilter: 'invited',
    });
  });

  it('maps developer settings tabs to the matching mobile subsection', () => {
    expect(parseTaskNebulaDeepLink('https://tasks.example.com/settings?tab=api-keys')).toEqual({
      kind: 'screen',
      rawUrl: 'https://tasks.example.com/settings?tab=api-keys',
      serverUrl: 'https://tasks.example.com',
      screen: 'DeveloperSettings',
      developerSection: 'apiKeys',
    });

    expect(parseTaskNebulaDeepLink('https://tasks.example.com/settings?tab=webhooks')).toEqual({
      kind: 'screen',
      rawUrl: 'https://tasks.example.com/settings?tab=webhooks',
      serverUrl: 'https://tasks.example.com',
      screen: 'DeveloperSettings',
      developerSection: 'webhooks',
    });

    expect(parseTaskNebulaDeepLink('https://tasks.example.com/settings?tab=audit-log')).toEqual({
      kind: 'screen',
      rawUrl: 'https://tasks.example.com/settings?tab=audit-log',
      serverUrl: 'https://tasks.example.com',
      screen: 'DeveloperSettings',
      developerSection: 'audit',
    });
  });

  it('maps organization settings subsections to the matching mobile section', () => {
    expect(parseTaskNebulaDeepLink('https://tasks.example.com/settings?tab=organization')).toEqual({
      kind: 'screen',
      rawUrl: 'https://tasks.example.com/settings?tab=organization',
      serverUrl: 'https://tasks.example.com',
      screen: 'OrganizationSettings',
      organizationSection: 'general',
    });

    expect(parseTaskNebulaDeepLink('https://tasks.example.com/settings/billing')).toEqual({
      kind: 'screen',
      rawUrl: 'https://tasks.example.com/settings/billing',
      serverUrl: 'https://tasks.example.com',
      screen: 'OrganizationSettings',
      organizationSection: 'general',
    });

    expect(parseTaskNebulaDeepLink('https://tasks.example.com/settings/integrations')).toEqual({
      kind: 'screen',
      rawUrl: 'https://tasks.example.com/settings/integrations',
      serverUrl: 'https://tasks.example.com',
      screen: 'OrganizationSettings',
      organizationSection: 'integrations',
    });

    expect(parseTaskNebulaDeepLink('https://tasks.example.com/settings?tab=teamspaces')).toEqual({
      kind: 'screen',
      rawUrl: 'https://tasks.example.com/settings?tab=teamspaces',
      serverUrl: 'https://tasks.example.com',
      screen: 'OrganizationSettings',
      organizationSection: 'teamspaces',
    });

    expect(
      parseTaskNebulaDeepLink('https://tasks.example.com/settings/organization?tab=danger'),
    ).toEqual({
      kind: 'screen',
      rawUrl: 'https://tasks.example.com/settings/organization?tab=danger',
      serverUrl: 'https://tasks.example.com',
      screen: 'OrganizationSettings',
      organizationSection: 'danger',
    });

    expect(parseTaskNebulaDeepLink('https://tasks.example.com/team?tab=teamspaces')).toEqual({
      kind: 'screen',
      rawUrl: 'https://tasks.example.com/team?tab=teamspaces',
      serverUrl: 'https://tasks.example.com',
      screen: 'OrganizationSettings',
      organizationSection: 'teamspaces',
    });
  });

  it('maps workspace settings utility tabs to their mobile screens', () => {
    expect(parseTaskNebulaDeepLink('https://tasks.example.com/settings?tab=labels')).toEqual({
      kind: 'screen',
      rawUrl: 'https://tasks.example.com/settings?tab=labels',
      serverUrl: 'https://tasks.example.com',
      screen: 'LabelsSettings',
    });

    expect(parseTaskNebulaDeepLink('https://tasks.example.com/settings?tab=ai-agents')).toEqual({
      kind: 'screen',
      rawUrl: 'https://tasks.example.com/settings?tab=ai-agents',
      serverUrl: 'https://tasks.example.com',
      screen: 'AiTransparency',
    });

    expect(parseTaskNebulaDeepLink('https://tasks.example.com/settings?tab=ai')).toEqual({
      kind: 'screen',
      rawUrl: 'https://tasks.example.com/settings?tab=ai',
      serverUrl: 'https://tasks.example.com',
      screen: 'AiTransparency',
    });
  });

  it('maps intake form edit links to the selected mobile form editor', () => {
    expect(
      parseTaskNebulaDeepLink('https://tasks.example.com/settings/intake-forms/form_1/edit'),
    ).toEqual({
      kind: 'screen',
      rawUrl: 'https://tasks.example.com/settings/intake-forms/form_1/edit',
      serverUrl: 'https://tasks.example.com',
      screen: 'IntakeForms',
      intakeFormId: 'form_1',
    });
  });

  it('maps import wizard query params to the mobile import setup', () => {
    expect(
      parseTaskNebulaDeepLink(
        'https://tasks.example.com/settings/import?source=plane&projectId=project_1',
      ),
    ).toEqual({
      kind: 'screen',
      rawUrl: 'https://tasks.example.com/settings/import?source=plane&projectId=project_1',
      serverUrl: 'https://tasks.example.com',
      screen: 'ImportSettings',
      importSource: 'plane',
      importProjectId: 'project_1',
    });
  });

  it('maps admin tabs to the matching mobile admin section', () => {
    const adminTabs = [
      ['overview', 'overview'],
      ['organizations', 'directory'],
      ['users', 'directory'],
      ['system', 'system'],
      ['realtime', 'realtime'],
      ['ai-usage', 'ai-usage'],
      ['agents', 'agents'],
      ['registration', 'registration'],
      ['feature-flags', 'feature-flags'],
      ['updates', 'updates'],
      ['audit', 'audit'],
    ] as const;

    adminTabs.forEach(([tab, section]) => {
      expect(parseTaskNebulaDeepLink(`https://tasks.example.com/admin?tab=${tab}`)).toEqual({
        kind: 'screen',
        rawUrl: `https://tasks.example.com/admin?tab=${tab}`,
        serverUrl: 'https://tasks.example.com',
        screen: 'InstanceAdmin',
        adminSection: section,
      });
    });
  });

  it('maps public trust and model card links to AI transparency', () => {
    expect(parseTaskNebulaDeepLink('https://tasks.example.com/trust')).toEqual({
      kind: 'screen',
      rawUrl: 'https://tasks.example.com/trust',
      serverUrl: 'https://tasks.example.com',
      screen: 'AiTransparency',
    });

    expect(parseTaskNebulaDeepLink('https://tasks.example.com/ai-model-cards')).toEqual({
      kind: 'screen',
      rawUrl: 'https://tasks.example.com/ai-model-cards',
      serverUrl: 'https://tasks.example.com',
      screen: 'AiTransparency',
      aiTransparencyFocus: 'modelCards',
    });
  });

  it('parses public intake links', () => {
    expect(parseTaskNebulaDeepLink('https://tasks.example.com/intake/bug-report')).toEqual({
      kind: 'public-intake',
      rawUrl: 'https://tasks.example.com/intake/bug-report',
      serverUrl: 'https://tasks.example.com',
      slug: 'bug-report',
    });

    expect(
      parseTaskNebulaDeepLink(
        'tasknebula://intake/feature-request?server=https%3A%2F%2Ftasks.example.com',
      ),
    ).toEqual({
      kind: 'public-intake',
      rawUrl: 'tasknebula://intake/feature-request?server=https%3A%2F%2Ftasks.example.com',
      serverUrl: 'https://tasks.example.com',
      slug: 'feature-request',
    });
  });

  it('parses public document share links', () => {
    expect(parseTaskNebulaDeepLink('https://tasks.example.com/share/share-token')).toEqual({
      kind: 'public-document',
      rawUrl: 'https://tasks.example.com/share/share-token',
      serverUrl: 'https://tasks.example.com',
      token: 'share-token',
    });

    expect(
      parseTaskNebulaDeepLink(
        'tasknebula://share/native-token?server=https%3A%2F%2Ftasks.example.com',
      ),
    ).toEqual({
      kind: 'public-document',
      rawUrl: 'tasknebula://share/native-token?server=https%3A%2F%2Ftasks.example.com',
      serverUrl: 'https://tasks.example.com',
      token: 'native-token',
    });
  });

  it('keeps representative web app routes mapped to mobile intents', () => {
    const representativeRoutes = [
      '/',
      '/ai-model-cards',
      '/intake/bug-report',
      '/trust',
      '/tr/admin',
      '/tr/api-docs',
      '/tr/dashboard',
      '/tr/docs',
      '/tr/drafts',
      '/tr/inbox',
      '/tr/initiatives',
      '/tr/initiatives/init_1',
      '/tr/issues',
      '/tr/issues/issue_1',
      '/tr/my-issues',
      '/tr/projects',
      '/tr/projects/new',
      '/tr/projects/project_1',
      '/tr/projects/project_1/analytics',
      '/tr/projects/project_1/backlog',
      '/tr/projects/project_1/board',
      '/tr/projects/project_1/chat',
      '/tr/projects/project_1/docs',
      '/tr/projects/project_1/modules',
      '/tr/projects/project_1/roadmap',
      '/tr/projects/project_1/settings',
      '/tr/projects/project_1/settings/components',
      '/tr/projects/project_1/settings/versions',
      '/tr/projects/project_1/settings/workflows',
      '/tr/projects/project_1/sprints',
      '/tr/projects/project_1/sprints/sprint_1',
      '/tr/projects/project_1/views',
      '/tr/settings',
      '/tr/settings/ai-transparency',
      '/tr/settings/billing',
      '/tr/settings/import',
      '/tr/settings/intake-forms',
      '/tr/settings/intake-forms/form_1/edit',
      '/tr/settings/integrations',
      '/tr/settings/labels',
      '/tr/settings/members',
      '/tr/settings/organization',
      '/tr/settings/security/audit-log-streaming',
      '/tr/settings/sso',
      '/tr/team',
      '/tr/templates',
      '/auth/error',
      '/auth/forgot-password',
      '/auth/reset-password?token=reset_1',
      '/auth/signin',
      '/auth/signup',
      '/auth/verify-email',
      '/auth/verify-request',
      '/join/project/invite_1',
      '/offline',
      '/setup',
      '/share/public_1',
    ] as const;

    representativeRoutes.forEach((route) => {
      const url = `https://tasks.example.com${route}`;
      expect(parseTaskNebulaDeepLink(url)).not.toBeNull();
    });
  });
});
