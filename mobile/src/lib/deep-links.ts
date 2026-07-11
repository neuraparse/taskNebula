import { extractAuthTokenInput, parseSignupInviteInput } from './auth-links';
import { normalizeBaseUrl } from './server-url';
import type {
  AiTransparencyRouteFocus,
  DashboardRouteNotice,
  DeveloperSettingsSection,
  ImportSourceRouteParam,
  InboxActorRouteFilter,
  InboxNotificationRouteFilter,
  InstanceAdminSection,
  IssueListRouteStatus,
  IssueListRouteType,
  MyIssuesRouteView,
  NewIssueRouteType,
  OrganizationSettingsSection,
  ProfileRouteFocus,
  ProjectSettingsSection,
  TeamStatusRouteFilter,
} from '@/navigation/types';

export type AuthDeepLink =
  | {
      kind: 'server';
      serverUrl: string;
      rawUrl: string;
    }
  | {
      kind: 'signup';
      rawUrl: string;
      serverUrl?: string;
      email?: string;
      inviteToken?: string;
      projectInviteToken?: string;
    }
  | {
      kind: 'signin';
      rawUrl: string;
      serverUrl?: string;
      email?: string;
      projectInviteToken?: string;
      callbackUrl?: string;
      signinStatus?: 'verified' | 'reset';
      signinError?: string;
    }
  | {
      kind: 'reset-password';
      rawUrl: string;
      serverUrl?: string;
      token: string;
    }
  | {
      kind: 'forgot-password';
      rawUrl: string;
      serverUrl?: string;
      email?: string;
    }
  | {
      kind: 'verify-email';
      rawUrl: string;
      serverUrl?: string;
      email?: string;
      token?: string;
      verifyError?: string;
    }
  | {
      kind: 'integration-oauth';
      rawUrl: string;
      serverUrl?: string;
      provider: 'github' | 'gitlab' | 'jira' | 'sentry' | 'slack' | string;
      status: 'connected' | 'error';
      reason?: string;
    }
  | {
      kind: 'login-oauth';
      rawUrl: string;
      serverUrl?: string;
      provider: 'github' | 'google' | string;
      status: 'authenticated' | 'error';
      token?: string;
      reason?: string;
      callbackUrl?: string;
    }
  | {
      kind: 'saml';
      rawUrl: string;
      serverUrl?: string;
      workspace?: string;
      status: 'authenticated' | 'error';
      token?: string;
      reason?: string;
      callbackUrl?: string;
    };

export type ContentDeepLink =
  | {
      kind: 'tab';
      rawUrl: string;
      serverUrl?: string;
      tab: 'Dashboard' | 'Projects' | 'Issues' | 'Initiatives' | 'Team' | 'Inbox' | 'Profile';
      inboxActorFilter?: InboxActorRouteFilter;
      inboxTypeFilter?: InboxNotificationRouteFilter;
      inboxUnreadOnly?: boolean;
      inboxSnoozedOnly?: boolean;
      dashboardNotice?: DashboardRouteNotice;
      myIssuesView?: MyIssuesRouteView;
      profileFocus?: ProfileRouteFocus;
      teamStatusFilter?: TeamStatusRouteFilter;
    }
  | {
      kind: 'project';
      rawUrl: string;
      serverUrl?: string;
      projectId: string;
      section?:
        | 'analytics'
        | 'backlog'
        | 'board'
        | 'chat'
        | ProjectSettingsSection
        | 'docs'
        | 'modules'
        | 'roadmap'
        | 'settings'
        | 'sprints'
        | 'views'
        | 'workflows';
      roomId?: string;
      projectIssueQuery?: string;
      projectIssueStatus?: IssueListRouteStatus;
      projectIssueSprintId?: 'none' | string;
      projectIssueType?: IssueListRouteType;
    }
  | {
      kind: 'sprint';
      rawUrl: string;
      serverUrl?: string;
      projectId: string;
      sprintId: string;
    }
  | {
      kind: 'issue';
      rawUrl: string;
      serverUrl?: string;
      issueId: string;
    }
  | {
      kind: 'initiative';
      rawUrl: string;
      serverUrl?: string;
      initiativeId: string;
    }
  | {
      kind: 'document';
      rawUrl: string;
      serverUrl?: string;
      pageId?: string;
      spaceId?: string;
      projectId?: string;
    }
  | {
      kind: 'public-document';
      rawUrl: string;
      serverUrl?: string;
      token: string;
    }
  | {
      kind: 'public-intake';
      rawUrl: string;
      serverUrl?: string;
      slug: string;
    }
  | {
      kind: 'screen';
      rawUrl: string;
      serverUrl?: string;
      screen:
        | 'AiTransparency'
        | 'ApiDocs'
        | 'AuditLogStreaming'
        | 'DeveloperSettings'
        | 'Drafts'
        | 'ImportSettings'
        | 'InstanceAdmin'
        | 'IntakeForms'
        | 'IssuesList'
        | 'LabelsSettings'
        | 'NewIssue'
        | 'NewProject'
        | 'OrganizationSettings'
        | 'Search'
        | 'SsoSettings'
        | 'Templates';
      organizationSection?: OrganizationSettingsSection;
      developerSection?: DeveloperSettingsSection;
      adminSection?: InstanceAdminSection;
      intakeFormId?: string;
      importSource?: ImportSourceRouteParam;
      importProjectId?: string;
      issueListQuery?: string;
      issueListStatus?: IssueListRouteStatus;
      issueListSprintId?: 'none' | string;
      issueListType?: IssueListRouteType;
      aiTransparencyFocus?: AiTransparencyRouteFocus;
      searchQuery?: string;
      newIssueProjectId?: string;
      newIssueSprintId?: string;
      newIssueType?: NewIssueRouteType;
    };

export type TaskNebulaDeepLink = AuthDeepLink | ContentDeepLink;
type ProjectDeepLinkSection = NonNullable<Extract<ContentDeepLink, { kind: 'project' }>['section']>;

const LOCALE_PREFIXES = new Set([
  'ar',
  'bg',
  'cs',
  'da',
  'de',
  'el',
  'en',
  'es',
  'fi',
  'fr',
  'he',
  'hi',
  'hu',
  'id',
  'it',
  'ja',
  'ko',
  'nb',
  'nl',
  'pl',
  'pt',
  'ro',
  'ru',
  'sv',
  'th',
  'tr',
  'uk',
  'vi',
  'zh-CN',
  'zh-TW',
]);

const PROJECT_SECTIONS = new Set<ProjectDeepLinkSection>([
  'analytics',
  'backlog',
  'board',
  'chat',
  'components',
  'custom-fields',
  'docs',
  'estimates',
  'general',
  'modules',
  'automation',
  'ai-agents',
  'chat-calls',
  'roadmap',
  'permissions',
  'schemes',
  'security',
  'settings',
  'sprints',
  'versions',
  'views',
  'webhooks',
  'work-item-types',
  'workflows',
]);

function parseUrl(value: string): URL | null {
  try {
    return new URL(value.trim());
  } catch {
    return null;
  }
}

function normalizedPath(url: URL): string {
  if (url.protocol === 'tasknebula:') {
    return url.host ? `/${url.host}${url.pathname}` : url.pathname;
  }
  return url.pathname;
}

function linkServerUrl(url: URL): string | undefined {
  const explicit =
    url.searchParams.get('server') ??
    url.searchParams.get('serverUrl') ??
    url.searchParams.get('baseUrl');
  if (explicit) return normalizeBaseUrl(explicit) ?? undefined;
  if (url.protocol === 'http:' || url.protocol === 'https:')
    return normalizeBaseUrl(url.origin) ?? undefined;
  return undefined;
}

function clean(value: string | null | undefined): string | undefined {
  const trimmed = value?.trim();
  return trimmed || undefined;
}

function safeDecodeURIComponent(value: string): string | null {
  try {
    return decodeURIComponent(value);
  } catch {
    return null;
  }
}

function routeSegments(path: string): string[] | null {
  const segments: string[] = [];
  for (const segment of path.split('/').filter(Boolean)) {
    const decoded = safeDecodeURIComponent(segment);
    if (decoded === null) return null;
    segments.push(decoded);
  }
  if (segments[0] && LOCALE_PREFIXES.has(segments[0])) return segments.slice(1);
  return segments;
}

function withServer<T extends ContentDeepLink>(value: T, serverUrl: string | undefined): T {
  return {
    ...value,
    ...(serverUrl ? { serverUrl } : {}),
  } as T;
}

function isProjectSection(value: string | undefined): value is ProjectDeepLinkSection {
  return !!value && PROJECT_SECTIONS.has(value as ProjectDeepLinkSection);
}

function adminSectionForTab(value: string | undefined): InstanceAdminSection | undefined {
  if (value === 'overview') return 'overview';
  if (value === 'organizations' || value === 'users') return 'directory';
  if (value === 'system') return 'system';
  if (value === 'realtime') return 'realtime';
  if (value === 'ai-usage') return 'ai-usage';
  if (value === 'agents') return 'agents';
  if (value === 'registration') return 'registration';
  if (value === 'feature-flags') return 'feature-flags';
  if (value === 'updates') return 'updates';
  if (value === 'audit') return 'audit';
  return undefined;
}

function inboxActorForQuery(value: string | undefined): InboxActorRouteFilter | undefined {
  if (value === 'user' || value === 'agent' || value === 'webhook' || value === 'system') {
    return value;
  }
  return undefined;
}

function inboxTypeForQuery(value: string | undefined): InboxNotificationRouteFilter | undefined {
  if (
    value === 'mention' ||
    value === 'assignment' ||
    value === 'due' ||
    value === 'status' ||
    value === 'comment' ||
    value === 'reaction'
  ) {
    return value;
  }
  return undefined;
}

function queryFlag(value: string | null): boolean {
  return value === '1' || value === 'true';
}

function dashboardNoticeForQuery(url: URL): DashboardRouteNotice | undefined {
  if (url.searchParams.get('verified') === '1') return 'emailVerified';
  if (url.searchParams.get('error') === 'insufficient-permission') return 'accessDenied';
  return undefined;
}

function dashboardDeepLink(
  rawUrl: string,
  url: URL,
  serverUrl: string | undefined,
): ContentDeepLink {
  const dashboardNotice = dashboardNoticeForQuery(url);
  return withServer(
    {
      kind: 'tab',
      rawUrl,
      tab: 'Dashboard',
      ...(dashboardNotice ? { dashboardNotice } : {}),
    },
    serverUrl,
  );
}

function myIssuesViewForQuery(value: string | undefined): MyIssuesRouteView | undefined {
  if (
    value === 'assigned' ||
    value === 'created' ||
    value === 'subscribed' ||
    value === 'mentioned'
  ) {
    return value;
  }
  return undefined;
}

function issueListStatusForQuery(value: string | undefined): IssueListRouteStatus | undefined {
  if (
    value === 'backlog' ||
    value === 'todo' ||
    value === 'in_progress' ||
    value === 'in_review' ||
    value === 'done'
  ) {
    return value;
  }
  return undefined;
}

function issueListTypeForQuery(value: string | undefined): IssueListRouteType | undefined {
  if (value === 'task' || value === 'story' || value === 'bug' || value === 'epic') {
    return value;
  }
  return undefined;
}

function sprintIdForQuery(value: string | undefined): 'none' | string | undefined {
  if (!value) return undefined;
  if (value === 'backlog') return 'none';
  return value;
}

function issuesListDeepLink(
  rawUrl: string,
  url: URL,
  serverUrl: string | undefined,
): ContentDeepLink {
  const issueListQuery = clean(url.searchParams.get('q')) ?? clean(url.searchParams.get('query'));
  const issueListStatus = issueListStatusForQuery(clean(url.searchParams.get('status')));
  const issueListType = issueListTypeForQuery(clean(url.searchParams.get('type')));
  const issueListSprintId = sprintIdForQuery(clean(url.searchParams.get('sprintId')));
  return withServer(
    {
      kind: 'screen',
      rawUrl,
      screen: 'IssuesList',
      ...(issueListQuery ? { issueListQuery } : {}),
      ...(issueListStatus ? { issueListStatus } : {}),
      ...(issueListType ? { issueListType } : {}),
      ...(issueListSprintId ? { issueListSprintId } : {}),
    },
    serverUrl,
  );
}

function projectIssueFiltersForQuery(url: URL): {
  projectIssueQuery?: string;
  projectIssueStatus?: IssueListRouteStatus;
  projectIssueSprintId?: 'none' | string;
  projectIssueType?: IssueListRouteType;
} {
  const projectIssueQuery =
    clean(url.searchParams.get('q')) ?? clean(url.searchParams.get('query'));
  const projectIssueStatus = issueListStatusForQuery(clean(url.searchParams.get('status')));
  const projectIssueType = issueListTypeForQuery(clean(url.searchParams.get('type')));
  const projectIssueSprintId = sprintIdForQuery(clean(url.searchParams.get('sprintId')));
  return {
    ...(projectIssueQuery ? { projectIssueQuery } : {}),
    ...(projectIssueStatus ? { projectIssueStatus } : {}),
    ...(projectIssueType ? { projectIssueType } : {}),
    ...(projectIssueSprintId ? { projectIssueSprintId } : {}),
  };
}

function organizationSectionForQuery(
  value: string | undefined,
): OrganizationSettingsSection | undefined {
  if (
    value === 'general' ||
    value === 'teamspaces' ||
    value === 'communications' ||
    value === 'integrations' ||
    value === 'danger'
  ) {
    return value;
  }
  return undefined;
}

function importSourceForQuery(value: string | undefined): ImportSourceRouteParam | undefined {
  if (
    value === 'csv' ||
    value === 'plane' ||
    value === 'linear' ||
    value === 'jira' ||
    value === 'github'
  ) {
    return value;
  }
  return undefined;
}

function newIssueTypeForQuery(value: string | undefined): NewIssueRouteType | undefined {
  if (value === 'task' || value === 'story' || value === 'bug' || value === 'epic') {
    return value;
  }
  return undefined;
}

function newIssueDeepLink(
  rawUrl: string,
  url: URL,
  serverUrl: string | undefined,
  projectId?: string,
  sprintId?: string,
): ContentDeepLink {
  const queryProjectId = clean(url.searchParams.get('projectId'));
  const querySprintId = clean(url.searchParams.get('sprintId'));
  const newIssueProjectId = projectId ?? queryProjectId;
  const newIssueSprintId = sprintId ?? querySprintId;
  const newIssueType =
    newIssueTypeForQuery(clean(url.searchParams.get('type'))) ??
    newIssueTypeForQuery(clean(url.searchParams.get('issueType')));
  return withServer(
    {
      kind: 'screen',
      rawUrl,
      screen: 'NewIssue',
      ...(newIssueProjectId ? { newIssueProjectId } : {}),
      ...(newIssueSprintId ? { newIssueSprintId } : {}),
      ...(newIssueType ? { newIssueType } : {}),
    },
    serverUrl,
  );
}

function importSettingsDeepLink(
  rawUrl: string,
  url: URL,
  serverUrl: string | undefined,
): ContentDeepLink {
  const importSource = importSourceForQuery(clean(url.searchParams.get('source')));
  const importProjectId = clean(url.searchParams.get('projectId'));
  return withServer(
    {
      kind: 'screen',
      rawUrl,
      screen: 'ImportSettings',
      ...(importSource ? { importSource } : {}),
      ...(importProjectId ? { importProjectId } : {}),
    },
    serverUrl,
  );
}

function parseContentDeepLink(
  path: string,
  url: URL,
  rawUrl: string,
  serverUrl: string | undefined,
): ContentDeepLink | null {
  const segments = routeSegments(path);
  if (!segments) return null;
  const [first, second, third, fourth, fifth, sixth] = segments;

  if (!first) {
    return dashboardDeepLink(rawUrl, url, serverUrl);
  }

  if (first === 'dashboard') {
    return dashboardDeepLink(rawUrl, url, serverUrl);
  }
  if (first === 'offline') {
    return dashboardDeepLink(rawUrl, url, serverUrl);
  }
  if (first === 'activity') {
    return dashboardDeepLink(rawUrl, url, serverUrl);
  }
  if (first === 'projects' && !second) {
    return withServer({ kind: 'tab', rawUrl, tab: 'Projects' }, serverUrl);
  }
  if (first === 'my-issues') {
    const myIssuesView = myIssuesViewForQuery(clean(url.searchParams.get('view'))) ?? 'assigned';
    return withServer(
      {
        kind: 'tab',
        rawUrl,
        tab: 'Issues',
        myIssuesView,
      },
      serverUrl,
    );
  }
  if (first === 'initiatives' && !second) {
    return withServer({ kind: 'tab', rawUrl, tab: 'Initiatives' }, serverUrl);
  }
  if (first === 'team') {
    const tab = clean(url.searchParams.get('tab'));
    if (tab === 'teamspaces') {
      return withServer(
        {
          kind: 'screen',
          rawUrl,
          screen: 'OrganizationSettings',
          organizationSection: 'teamspaces',
        },
        serverUrl,
      );
    }
    return withServer(
      {
        kind: 'tab',
        rawUrl,
        tab: 'Team',
        ...(tab === 'invites' ? { teamStatusFilter: 'invited' } : {}),
      },
      serverUrl,
    );
  }
  if (first === 'inbox') {
    const inboxActorFilter = inboxActorForQuery(clean(url.searchParams.get('actor')));
    const inboxTypeFilter = inboxTypeForQuery(clean(url.searchParams.get('type')));
    const inboxUnreadOnly = queryFlag(url.searchParams.get('unread'));
    const inboxSnoozedOnly = queryFlag(url.searchParams.get('snoozed'));
    return withServer(
      {
        kind: 'tab',
        rawUrl,
        tab: 'Inbox',
        ...(inboxActorFilter ? { inboxActorFilter } : {}),
        ...(inboxTypeFilter ? { inboxTypeFilter } : {}),
        ...(inboxUnreadOnly ? { inboxUnreadOnly } : {}),
        ...(inboxSnoozedOnly ? { inboxSnoozedOnly } : {}),
      },
      serverUrl,
    );
  }
  if (first === 'notifications') {
    return withServer({ kind: 'tab', rawUrl, tab: 'Inbox' }, serverUrl);
  }

  if (first === 'search') {
    const searchQuery = clean(url.searchParams.get('q')) ?? clean(url.searchParams.get('query'));
    return withServer(
      {
        kind: 'screen',
        rawUrl,
        screen: 'Search',
        ...(searchQuery ? { searchQuery } : {}),
      },
      serverUrl,
    );
  }

  if (first === 'issues' && second === 'new') {
    return newIssueDeepLink(rawUrl, url, serverUrl);
  }

  if (first === 'issues' && !second) {
    return issuesListDeepLink(rawUrl, url, serverUrl);
  }

  if (first === 'issues' && second) {
    return withServer({ kind: 'issue', rawUrl, issueId: second }, serverUrl);
  }

  if (first === 'initiatives' && second) {
    return withServer({ kind: 'initiative', rawUrl, initiativeId: second }, serverUrl);
  }

  if (first === 'docs') {
    const pageId = clean(url.searchParams.get('pageId'));
    const pathPageId = pageId ?? second;
    const spaceId = clean(url.searchParams.get('spaceId'));
    return withServer(
      {
        kind: 'document',
        rawUrl,
        ...(pathPageId ? { pageId: pathPageId } : {}),
        ...(spaceId ? { spaceId } : {}),
      },
      serverUrl,
    );
  }

  if (first === 'share' && second) {
    return withServer({ kind: 'public-document', rawUrl, token: second }, serverUrl);
  }

  if (first === 'intake' && second) {
    return withServer({ kind: 'public-intake', rawUrl, slug: second }, serverUrl);
  }

  if (first === 'projects' && second === 'new') {
    return withServer({ kind: 'screen', rawUrl, screen: 'NewProject' }, serverUrl);
  }

  if (first === 'projects' && second) {
    if (third === 'issues' && fourth === 'new') {
      return newIssueDeepLink(rawUrl, url, serverUrl, second);
    }

    if (third === 'sprints' && fourth && fifth === 'issues' && sixth === 'new') {
      return newIssueDeepLink(rawUrl, url, serverUrl, second, fourth);
    }

    if (third === 'sprints' && fourth) {
      return withServer(
        {
          kind: 'sprint',
          rawUrl,
          projectId: second,
          sprintId: fourth,
        },
        serverUrl,
      );
    }

    const pageId = clean(url.searchParams.get('pageId'));
    const pathPageId = pageId ?? fourth;
    const spaceId = clean(url.searchParams.get('spaceId'));
    if (third === 'docs' && (pathPageId || spaceId)) {
      return withServer(
        {
          kind: 'document',
          rawUrl,
          ...(pathPageId ? { pageId: pathPageId } : {}),
          ...(spaceId ? { spaceId } : {}),
          projectId: second,
        },
        serverUrl,
      );
    }

    const settingsTab = clean(url.searchParams.get('tab'));
    const settingsSection =
      third === 'settings'
        ? isProjectSection(fourth)
          ? fourth
          : isProjectSection(settingsTab)
            ? settingsTab
            : 'settings'
        : (third ?? 'views');
    const section = isProjectSection(settingsSection) ? settingsSection : undefined;
    const roomId = section === 'chat' ? clean(url.searchParams.get('roomId')) : undefined;
    const projectIssueFilters =
      section === 'board' || section === 'backlog' ? projectIssueFiltersForQuery(url) : {};
    return withServer(
      {
        kind: 'project',
        rawUrl,
        projectId: second,
        ...(section ? { section } : {}),
        ...(roomId ? { roomId } : {}),
        ...projectIssueFilters,
      },
      serverUrl,
    );
  }

  if (first === 'drafts') {
    return withServer({ kind: 'screen', rawUrl, screen: 'Drafts' }, serverUrl);
  }
  if (first === 'templates') {
    return withServer({ kind: 'screen', rawUrl, screen: 'Templates' }, serverUrl);
  }
  if (first === 'ai-model-cards') {
    return withServer(
      { kind: 'screen', rawUrl, screen: 'AiTransparency', aiTransparencyFocus: 'modelCards' },
      serverUrl,
    );
  }
  if (first === 'trust') {
    return withServer({ kind: 'screen', rawUrl, screen: 'AiTransparency' }, serverUrl);
  }
  if (first === 'api-docs') {
    return withServer({ kind: 'screen', rawUrl, screen: 'ApiDocs' }, serverUrl);
  }
  if (first === 'admin') {
    const adminSection = adminSectionForTab(clean(url.searchParams.get('tab')));
    return withServer(
      {
        kind: 'screen',
        rawUrl,
        screen: 'InstanceAdmin',
        ...(adminSection ? { adminSection } : {}),
      },
      serverUrl,
    );
  }

  if (first === 'settings') {
    const tab = clean(url.searchParams.get('tab'));
    if (second === 'notifications' || tab === 'notifications') {
      return withServer(
        {
          kind: 'tab',
          rawUrl,
          tab: 'Profile',
          profileFocus: 'notifications',
        },
        serverUrl,
      );
    }
    if (tab === 'appearance') {
      return withServer(
        {
          kind: 'tab',
          rawUrl,
          tab: 'Profile',
          profileFocus: 'appearance',
        },
        serverUrl,
      );
    }
    if (second === 'members' || tab === 'members') {
      return withServer({ kind: 'tab', rawUrl, tab: 'Team' }, serverUrl);
    }
    if (
      second === 'api-keys' ||
      second === 'developer' ||
      tab === 'api-keys' ||
      tab === 'webhooks' ||
      tab === 'audit-log'
    ) {
      const developerSection =
        second === 'api-keys' || tab === 'api-keys'
          ? 'apiKeys'
          : tab === 'webhooks'
            ? 'webhooks'
            : tab === 'audit-log'
              ? 'audit'
              : undefined;
      return withServer(
        {
          kind: 'screen',
          rawUrl,
          screen: 'DeveloperSettings',
          ...(developerSection ? { developerSection } : {}),
        },
        serverUrl,
      );
    }
    if (tab === 'ai-transparency') {
      return withServer({ kind: 'screen', rawUrl, screen: 'AiTransparency' }, serverUrl);
    }
    if (tab === 'ai-agents' || tab === 'ai') {
      return withServer({ kind: 'screen', rawUrl, screen: 'AiTransparency' }, serverUrl);
    }
    if (tab === 'organization') {
      return withServer(
        {
          kind: 'screen',
          rawUrl,
          screen: 'OrganizationSettings',
          organizationSection: 'general',
        },
        serverUrl,
      );
    }
    if (tab === 'teamspaces') {
      return withServer(
        {
          kind: 'screen',
          rawUrl,
          screen: 'OrganizationSettings',
          organizationSection: 'teamspaces',
        },
        serverUrl,
      );
    }
    if (tab === 'communications') {
      return withServer(
        {
          kind: 'screen',
          rawUrl,
          screen: 'OrganizationSettings',
          organizationSection: 'communications',
        },
        serverUrl,
      );
    }
    if (tab === 'integrations') {
      return withServer(
        {
          kind: 'screen',
          rawUrl,
          screen: 'OrganizationSettings',
          organizationSection: 'integrations',
        },
        serverUrl,
      );
    }
    if (tab === 'intake-forms') {
      return withServer({ kind: 'screen', rawUrl, screen: 'IntakeForms' }, serverUrl);
    }
    if (tab === 'labels') {
      return withServer({ kind: 'screen', rawUrl, screen: 'LabelsSettings' }, serverUrl);
    }
    if (tab === 'sso') {
      return withServer({ kind: 'screen', rawUrl, screen: 'SsoSettings' }, serverUrl);
    }
    if (second === 'ai-transparency') {
      return withServer({ kind: 'screen', rawUrl, screen: 'AiTransparency' }, serverUrl);
    }
    if (second === 'import') {
      return importSettingsDeepLink(rawUrl, url, serverUrl);
    }
    if (second === 'intake-forms') {
      return withServer(
        {
          kind: 'screen',
          rawUrl,
          screen: 'IntakeForms',
          ...(third && fourth === 'edit' ? { intakeFormId: third } : {}),
        },
        serverUrl,
      );
    }
    if (second === 'teamspaces') {
      return withServer(
        {
          kind: 'screen',
          rawUrl,
          screen: 'OrganizationSettings',
          organizationSection: 'teamspaces',
        },
        serverUrl,
      );
    }
    if (second === 'communications') {
      return withServer(
        {
          kind: 'screen',
          rawUrl,
          screen: 'OrganizationSettings',
          organizationSection: 'communications',
        },
        serverUrl,
      );
    }
    if (second === 'integrations') {
      return withServer(
        {
          kind: 'screen',
          rawUrl,
          screen: 'OrganizationSettings',
          organizationSection: 'integrations',
        },
        serverUrl,
      );
    }
    if (second === 'labels') {
      return withServer({ kind: 'screen', rawUrl, screen: 'LabelsSettings' }, serverUrl);
    }
    if (second === 'organization') {
      const organizationSection = organizationSectionForQuery(tab) ?? 'general';
      return withServer(
        {
          kind: 'screen',
          rawUrl,
          screen: 'OrganizationSettings',
          organizationSection,
        },
        serverUrl,
      );
    }
    if (second === 'billing' || !second) {
      return withServer(
        {
          kind: 'screen',
          rawUrl,
          screen: 'OrganizationSettings',
          organizationSection: 'general',
        },
        serverUrl,
      );
    }
    if (second === 'sso') {
      return withServer({ kind: 'screen', rawUrl, screen: 'SsoSettings' }, serverUrl);
    }
    if (second === 'security' && third === 'audit-log-streaming') {
      return withServer({ kind: 'screen', rawUrl, screen: 'AuditLogStreaming' }, serverUrl);
    }
  }

  return null;
}

export function isAuthDeepLink(
  intent: TaskNebulaDeepLink,
): intent is Exclude<AuthDeepLink, { kind: 'server' }> {
  return (
    intent.kind === 'signup' ||
    intent.kind === 'signin' ||
    intent.kind === 'forgot-password' ||
    intent.kind === 'reset-password' ||
    intent.kind === 'verify-email' ||
    intent.kind === 'login-oauth' ||
    intent.kind === 'saml' ||
    intent.kind === 'integration-oauth'
  );
}

export function isContentDeepLink(intent: TaskNebulaDeepLink | null): intent is ContentDeepLink {
  return !!intent && intent.kind !== 'server' && !isAuthDeepLink(intent);
}

export function parseTaskNebulaDeepLink(value: string): TaskNebulaDeepLink | null {
  const url = parseUrl(value);
  if (!url) return null;

  const path = normalizedPath(url);
  const serverUrl = linkServerUrl(url);
  const rawUrl = value;

  if (path === '/connect' || path === '/server') {
    if (!serverUrl) return null;
    return { kind: 'server', serverUrl, rawUrl };
  }

  if (path === '/setup') {
    if (!serverUrl) return null;
    return { kind: 'server', serverUrl, rawUrl };
  }

  if (path === '/integrations/oauth') {
    const provider = clean(url.searchParams.get('provider'));
    const status = clean(url.searchParams.get('status'));
    if (!provider || (status !== 'connected' && status !== 'error')) return null;
    const reason = clean(url.searchParams.get('reason'));
    return {
      kind: 'integration-oauth',
      rawUrl,
      provider,
      status,
      ...(serverUrl ? { serverUrl } : {}),
      ...(reason ? { reason } : {}),
    };
  }

  if (path === '/auth/oauth') {
    const provider = clean(url.searchParams.get('provider')) ?? 'oauth';
    const status = clean(url.searchParams.get('status'));
    if (status !== 'authenticated' && status !== 'error') return null;
    const token = clean(url.searchParams.get('token'));
    const reason = clean(url.searchParams.get('reason'));
    const callbackUrl = clean(url.searchParams.get('callbackUrl'));
    return {
      kind: 'login-oauth',
      rawUrl,
      provider,
      status,
      ...(serverUrl ? { serverUrl } : {}),
      ...(token ? { token } : {}),
      ...(reason ? { reason } : {}),
      ...(callbackUrl ? { callbackUrl } : {}),
    };
  }

  if (path === '/auth/saml') {
    const status = clean(url.searchParams.get('status'));
    if (status !== 'authenticated' && status !== 'error') return null;
    const workspace = clean(url.searchParams.get('workspace'));
    const token = clean(url.searchParams.get('token'));
    const reason = clean(url.searchParams.get('reason'));
    const callbackUrl = clean(url.searchParams.get('callbackUrl'));
    return {
      kind: 'saml',
      rawUrl,
      status,
      ...(serverUrl ? { serverUrl } : {}),
      ...(workspace ? { workspace } : {}),
      ...(token ? { token } : {}),
      ...(reason ? { reason } : {}),
      ...(callbackUrl ? { callbackUrl } : {}),
    };
  }

  if (path === '/auth/signup') {
    const invite = parseSignupInviteInput(value);
    return {
      kind: 'signup',
      rawUrl,
      ...(serverUrl ? { serverUrl } : {}),
      ...invite,
    };
  }

  if (path === '/auth/signin') {
    const email = clean(url.searchParams.get('email'))?.toLowerCase();
    const projectInviteToken = clean(url.searchParams.get('projectInviteToken'));
    const callbackUrl = clean(url.searchParams.get('callbackUrl'));
    const signinStatus =
      url.searchParams.get('verified') === '1'
        ? 'verified'
        : url.searchParams.get('reset') === '1'
          ? 'reset'
          : undefined;
    const signinError = clean(url.searchParams.get('error'));
    if (email || projectInviteToken || callbackUrl || signinStatus || signinError) {
      return {
        kind: 'signin',
        rawUrl,
        ...(serverUrl ? { serverUrl } : {}),
        ...(email ? { email } : {}),
        ...(projectInviteToken ? { projectInviteToken } : {}),
        ...(callbackUrl ? { callbackUrl } : {}),
        ...(signinStatus ? { signinStatus } : {}),
        ...(signinError ? { signinError } : {}),
      };
    }
    if (!serverUrl) return null;
    return { kind: 'server', serverUrl, rawUrl };
  }

  if (path === '/auth/error') {
    const signinError = clean(url.searchParams.get('error')) ?? 'Default';
    return {
      kind: 'signin',
      rawUrl,
      ...(serverUrl ? { serverUrl } : {}),
      signinError,
    };
  }

  if (path === '/auth/forgot-password') {
    const email = clean(url.searchParams.get('email'))?.toLowerCase();
    return {
      kind: 'forgot-password',
      rawUrl,
      ...(serverUrl ? { serverUrl } : {}),
      ...(email ? { email } : {}),
    };
  }

  if (path === '/auth/reset-password') {
    const token = extractAuthTokenInput(value, ['token']);
    if (!token || token === value.trim()) {
      const email = clean(url.searchParams.get('email'))?.toLowerCase();
      return {
        kind: 'forgot-password',
        rawUrl,
        ...(serverUrl ? { serverUrl } : {}),
        ...(email ? { email } : {}),
      };
    }
    return {
      kind: 'reset-password',
      rawUrl,
      token,
      ...(serverUrl ? { serverUrl } : {}),
    };
  }

  if (path === '/auth/verify-email') {
    const token = extractAuthTokenInput(value, ['token']);
    const email = clean(url.searchParams.get('email'))?.toLowerCase();
    const verifyError = clean(url.searchParams.get('error'));
    return {
      kind: 'verify-email',
      rawUrl,
      ...(serverUrl ? { serverUrl } : {}),
      ...(token && token !== value.trim() ? { token } : {}),
      ...(email ? { email } : {}),
      ...(verifyError ? { verifyError } : {}),
    };
  }

  const verifyEmailApiMatch = path.match(/^\/api\/auth\/verify-email\/([^/?#]+)$/);
  if (verifyEmailApiMatch?.[1]) {
    const token = safeDecodeURIComponent(verifyEmailApiMatch[1]);
    if (!token) return null;
    return {
      kind: 'verify-email',
      rawUrl,
      ...(serverUrl ? { serverUrl } : {}),
      token,
    };
  }

  if (path === '/auth/verify-request') {
    const email = clean(url.searchParams.get('email'))?.toLowerCase();
    return {
      kind: 'verify-email',
      rawUrl,
      ...(serverUrl ? { serverUrl } : {}),
      ...(email ? { email } : {}),
    };
  }

  const projectInviteMatch = path.match(/^\/join\/project\/([^/?#]+)$/);
  if (projectInviteMatch?.[1]) {
    const projectInviteToken = safeDecodeURIComponent(projectInviteMatch[1]);
    if (!projectInviteToken) return null;
    return {
      kind: 'signup',
      rawUrl,
      ...(serverUrl ? { serverUrl } : {}),
      projectInviteToken,
    };
  }

  return parseContentDeepLink(path, url, rawUrl, serverUrl);
}
