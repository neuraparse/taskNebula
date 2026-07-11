export const webRouteDeepLinkSamples = {
  'app:admin': {
    url: 'https://tasks.example.com/en/admin?tab=users',
    expected: { kind: 'screen', screen: 'InstanceAdmin', adminSection: 'directory' },
  },
  'app:api-docs': {
    url: 'https://tasks.example.com/en/api-docs',
    expected: { kind: 'screen', screen: 'ApiDocs' },
  },
  'app:dashboard': {
    url: 'https://tasks.example.com/en/dashboard?error=insufficient-permission',
    expected: { kind: 'tab', tab: 'Dashboard', dashboardNotice: 'accessDenied' },
  },
  'app:docs': {
    url: 'https://tasks.example.com/en/docs?spaceId=space_1',
    expected: { kind: 'document', spaceId: 'space_1' },
  },
  'app:drafts': {
    url: 'https://tasks.example.com/en/drafts',
    expected: { kind: 'screen', screen: 'Drafts' },
  },
  'app:inbox': {
    url: 'https://tasks.example.com/en/inbox?actor=agent&type=mention&unread=1',
    expected: {
      kind: 'tab',
      tab: 'Inbox',
      inboxActorFilter: 'agent',
      inboxTypeFilter: 'mention',
      inboxUnreadOnly: true,
    },
  },
  'app:issues': {
    url: 'https://tasks.example.com/en/issues?status=todo&type=story',
    expected: {
      kind: 'screen',
      screen: 'IssuesList',
      issueListStatus: 'todo',
      issueListType: 'story',
    },
  },
  'app:initiatives': {
    url: 'https://tasks.example.com/en/initiatives',
    expected: { kind: 'tab', tab: 'Initiatives' },
  },
  'app:initiatives/[id]': {
    url: 'https://tasks.example.com/en/initiatives/init_1',
    expected: { kind: 'initiative', initiativeId: 'init_1' },
  },
  'app:issues/[issueId]': {
    url: 'https://tasks.example.com/en/issues/TN-1',
    expected: { kind: 'issue', issueId: 'TN-1' },
  },
  'app:my-issues': {
    url: 'https://tasks.example.com/en/my-issues?view=mentioned',
    expected: { kind: 'tab', tab: 'Issues', myIssuesView: 'mentioned' },
  },
  'app:projects': {
    url: 'https://tasks.example.com/en/projects',
    expected: { kind: 'tab', tab: 'Projects' },
  },
  'app:projects/[projectId]': {
    url: 'https://tasks.example.com/en/projects/TN',
    expected: { kind: 'project', projectId: 'TN', section: 'views' },
  },
  'app:projects/[projectId]/analytics': {
    url: 'https://tasks.example.com/en/projects/TN/analytics',
    expected: { kind: 'project', projectId: 'TN', section: 'analytics' },
  },
  'app:projects/[projectId]/backlog': {
    url: 'https://tasks.example.com/en/projects/TN/backlog?q=auth&status=todo&type=story',
    expected: {
      kind: 'project',
      projectId: 'TN',
      section: 'backlog',
      projectIssueQuery: 'auth',
      projectIssueStatus: 'todo',
      projectIssueType: 'story',
    },
  },
  'app:projects/[projectId]/board': {
    url: 'https://tasks.example.com/en/projects/TN/board?q=bug&status=in_progress&type=bug&sprintId=backlog',
    expected: {
      kind: 'project',
      projectId: 'TN',
      section: 'board',
      projectIssueQuery: 'bug',
      projectIssueStatus: 'in_progress',
      projectIssueType: 'bug',
      projectIssueSprintId: 'none',
    },
  },
  'app:projects/[projectId]/chat': {
    url: 'https://tasks.example.com/en/projects/TN/chat?roomId=room_1',
    expected: { kind: 'project', projectId: 'TN', section: 'chat', roomId: 'room_1' },
  },
  'app:projects/[projectId]/docs': {
    url: 'https://tasks.example.com/en/projects/TN/docs',
    expected: { kind: 'project', projectId: 'TN', section: 'docs' },
  },
  'app:projects/[projectId]/modules': {
    url: 'https://tasks.example.com/en/projects/TN/modules',
    expected: { kind: 'project', projectId: 'TN', section: 'modules' },
  },
  'app:projects/[projectId]/roadmap': {
    url: 'https://tasks.example.com/en/projects/TN/roadmap',
    expected: { kind: 'project', projectId: 'TN', section: 'roadmap' },
  },
  'app:projects/[projectId]/settings': {
    url: 'https://tasks.example.com/en/projects/TN/settings',
    expected: { kind: 'project', projectId: 'TN', section: 'settings' },
  },
  'app:projects/[projectId]/settings/components': {
    url: 'https://tasks.example.com/en/projects/TN/settings/components',
    expected: { kind: 'project', projectId: 'TN', section: 'components' },
  },
  'app:projects/[projectId]/settings/versions': {
    url: 'https://tasks.example.com/en/projects/TN/settings/versions',
    expected: { kind: 'project', projectId: 'TN', section: 'versions' },
  },
  'app:projects/[projectId]/settings/workflows': {
    url: 'https://tasks.example.com/en/projects/TN/settings/workflows',
    expected: { kind: 'project', projectId: 'TN', section: 'workflows' },
  },
  'app:projects/[projectId]/sprints': {
    url: 'https://tasks.example.com/en/projects/TN/sprints',
    expected: { kind: 'project', projectId: 'TN', section: 'sprints' },
  },
  'app:projects/[projectId]/sprints/[sprintId]': {
    url: 'https://tasks.example.com/en/projects/TN/sprints/sprint_1',
    expected: { kind: 'sprint', projectId: 'TN', sprintId: 'sprint_1' },
  },
  'app:projects/[projectId]/views': {
    url: 'https://tasks.example.com/en/projects/TN/views',
    expected: { kind: 'project', projectId: 'TN', section: 'views' },
  },
  'app:settings': {
    url: 'https://tasks.example.com/en/settings?tab=appearance',
    expected: { kind: 'tab', tab: 'Profile', profileFocus: 'appearance' },
  },
  'app:settings/ai-transparency': {
    url: 'https://tasks.example.com/en/settings/ai-transparency',
    expected: { kind: 'screen', screen: 'AiTransparency' },
  },
  'app:settings/billing': {
    url: 'https://tasks.example.com/en/settings/billing',
    expected: { kind: 'screen', screen: 'OrganizationSettings', organizationSection: 'general' },
  },
  'app:settings/import': {
    url: 'https://tasks.example.com/en/settings/import?source=plane&projectId=project_1',
    expected: {
      kind: 'screen',
      screen: 'ImportSettings',
      importSource: 'plane',
      importProjectId: 'project_1',
    },
  },
  'app:settings/intake-forms': {
    url: 'https://tasks.example.com/en/settings/intake-forms',
    expected: { kind: 'screen', screen: 'IntakeForms' },
  },
  'app:settings/intake-forms/[id]/edit': {
    url: 'https://tasks.example.com/en/settings/intake-forms/form_1/edit',
    expected: { kind: 'screen', screen: 'IntakeForms', intakeFormId: 'form_1' },
  },
  'app:settings/integrations': {
    url: 'https://tasks.example.com/en/settings/integrations',
    expected: {
      kind: 'screen',
      screen: 'OrganizationSettings',
      organizationSection: 'integrations',
    },
  },
  'app:settings/labels': {
    url: 'https://tasks.example.com/en/settings/labels',
    expected: { kind: 'screen', screen: 'LabelsSettings' },
  },
  'app:settings/members': {
    url: 'https://tasks.example.com/en/settings/members',
    expected: { kind: 'tab', tab: 'Team' },
  },
  'app:settings/organization': {
    url: 'https://tasks.example.com/en/settings/organization?tab=danger',
    expected: {
      kind: 'screen',
      screen: 'OrganizationSettings',
      organizationSection: 'danger',
    },
  },
  'app:settings/security/audit-log-streaming': {
    url: 'https://tasks.example.com/en/settings/security/audit-log-streaming',
    expected: { kind: 'screen', screen: 'AuditLogStreaming' },
  },
  'app:settings/sso': {
    url: 'https://tasks.example.com/en/settings/sso',
    expected: { kind: 'screen', screen: 'SsoSettings' },
  },
  'app:team': {
    url: 'https://tasks.example.com/en/team?tab=invites',
    expected: { kind: 'tab', tab: 'Team', teamStatusFilter: 'invited' },
  },
  'app:templates': {
    url: 'https://tasks.example.com/en/templates',
    expected: { kind: 'screen', screen: 'Templates' },
  },
  'auth:error': {
    url: 'https://tasks.example.com/auth/error?error=Verification',
    expected: { kind: 'signin', signinError: 'Verification' },
  },
  'auth:forgot-password': {
    url: 'https://tasks.example.com/auth/forgot-password?email=user%40example.com',
    expected: { kind: 'forgot-password', email: 'user@example.com' },
  },
  'auth:reset-password': {
    url: 'https://tasks.example.com/auth/reset-password?token=reset_1',
    expected: { kind: 'reset-password', token: 'reset_1' },
  },
  'auth:signin': {
    url: 'https://tasks.example.com/auth/signin?email=user%40example.com',
    expected: { kind: 'signin', email: 'user@example.com' },
  },
  'auth:signup': {
    url: 'https://tasks.example.com/auth/signup?email=user%40example.com&token=invite_1',
    expected: { kind: 'signup', email: 'user@example.com', inviteToken: 'invite_1' },
  },
  'auth:verify-email': {
    url: 'https://tasks.example.com/auth/verify-email?token=verify_1',
    expected: { kind: 'verify-email', token: 'verify_1' },
  },
  'auth:verify-request': {
    url: 'https://tasks.example.com/auth/verify-request?email=user%40example.com',
    expected: { kind: 'verify-email', email: 'user@example.com' },
  },
  'public:ai-model-cards': {
    url: 'https://tasks.example.com/ai-model-cards',
    expected: { kind: 'screen', screen: 'AiTransparency', aiTransparencyFocus: 'modelCards' },
  },
  'public:intake/[slug]': {
    url: 'https://tasks.example.com/intake/bug-report',
    expected: { kind: 'public-intake', slug: 'bug-report' },
  },
  'public:trust': {
    url: 'https://tasks.example.com/trust',
    expected: { kind: 'screen', screen: 'AiTransparency' },
  },
  'root:join/project/[token]': {
    url: 'https://tasks.example.com/join/project/project_invite_1',
    expected: { kind: 'signup', projectInviteToken: 'project_invite_1' },
  },
  'root:setup': {
    url: 'https://tasks.example.com/setup',
    expected: { kind: 'server', serverUrl: 'https://tasks.example.com' },
  },
  'root:share/[token]': {
    url: 'https://tasks.example.com/share/share_token_1',
    expected: { kind: 'public-document', token: 'share_token_1' },
  },
} as const;
