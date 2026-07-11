import { createNavigationContainerRef } from '@react-navigation/native';

import type { ContentDeepLink } from '@/lib/deep-links';
import type {
  AppStackParamList,
  OrganizationSettingsRouteParams,
  OrganizationSettingsSection,
  ProjectBacklogRouteParams,
  ProjectIssueRouteParams,
  ProjectSettingsSection,
} from './types';

export const navigationRef = createNavigationContainerRef<AppStackParamList>();

const PROJECT_SETTINGS_SECTIONS = new Set<ProjectSettingsSection>([
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
]);

function isProjectSettingsSection(
  section: Extract<ContentDeepLink, { kind: 'project' }>['section'],
): section is ProjectSettingsSection {
  return !!section && PROJECT_SETTINGS_SECTIONS.has(section as ProjectSettingsSection);
}

function projectIssueRouteParams(
  intent: Extract<ContentDeepLink, { kind: 'project' }>,
): ProjectIssueRouteParams {
  return {
    ...(intent.projectIssueQuery ? { query: intent.projectIssueQuery } : {}),
    ...(intent.projectIssueStatus ? { status: intent.projectIssueStatus } : {}),
    ...(intent.projectIssueSprintId ? { sprintId: intent.projectIssueSprintId } : {}),
    ...(intent.projectIssueType ? { type: intent.projectIssueType } : {}),
  };
}

function projectBacklogRouteParams(
  intent: Extract<ContentDeepLink, { kind: 'project' }>,
): ProjectBacklogRouteParams {
  return {
    ...(intent.projectIssueQuery ? { query: intent.projectIssueQuery } : {}),
    ...(intent.projectIssueStatus ? { status: intent.projectIssueStatus } : {}),
    ...(intent.projectIssueType ? { type: intent.projectIssueType } : {}),
  };
}

export function navigateToProject(projectIdOrKey: string): boolean {
  if (!navigationRef.isReady()) return false;
  navigationRef.navigate('ProjectViews', { projectId: projectIdOrKey });
  return true;
}

export function navigateToOrganizationSettings(
  section?: OrganizationSettingsSection,
  params: Omit<OrganizationSettingsRouteParams, 'section'> = {},
): boolean {
  if (!navigationRef.isReady()) return false;
  navigationRef.navigate(
    'OrganizationSettings',
    section || Object.keys(params).length > 0
      ? { ...(section ? { section } : {}), ...params }
      : undefined,
  );
  return true;
}

export function navigateToContentDeepLink(intent: ContentDeepLink): boolean {
  if (!navigationRef.isReady()) return false;

  if (intent.kind === 'tab') {
    if (intent.tab === 'Dashboard' && intent.dashboardNotice) {
      navigationRef.navigate('MainTabs', {
        screen: 'Dashboard',
        params: { notice: intent.dashboardNotice },
      });
      return true;
    }
    if (intent.tab === 'Issues' && intent.myIssuesView) {
      navigationRef.navigate('MainTabs', {
        screen: 'Issues',
        params: { view: intent.myIssuesView },
      });
      return true;
    }
    if (intent.tab === 'Team' && intent.teamStatusFilter) {
      navigationRef.navigate('MainTabs', {
        screen: 'Team',
        params: { statusFilter: intent.teamStatusFilter },
      });
      return true;
    }
    if (
      intent.tab === 'Inbox' &&
      (intent.inboxActorFilter ||
        intent.inboxTypeFilter ||
        intent.inboxUnreadOnly ||
        intent.inboxSnoozedOnly)
    ) {
      navigationRef.navigate('MainTabs', {
        screen: 'Inbox',
        params: {
          ...(intent.inboxActorFilter ? { actorFilter: intent.inboxActorFilter } : {}),
          ...(intent.inboxTypeFilter ? { typeFilter: intent.inboxTypeFilter } : {}),
          ...(intent.inboxUnreadOnly ? { unreadOnly: true } : {}),
          ...(intent.inboxSnoozedOnly ? { snoozedOnly: true } : {}),
        },
      });
      return true;
    }
    if (intent.tab === 'Profile' && intent.profileFocus) {
      navigationRef.navigate('MainTabs', {
        screen: 'Profile',
        params: { focus: intent.profileFocus },
      });
      return true;
    }
    navigationRef.navigate('MainTabs', { screen: intent.tab });
    return true;
  }

  if (intent.kind === 'issue') {
    navigationRef.navigate('IssueDetail', { id: intent.issueId });
    return true;
  }

  if (intent.kind === 'initiative') {
    navigationRef.navigate('InitiativeDetail', { id: intent.initiativeId });
    return true;
  }

  if (intent.kind === 'sprint') {
    navigationRef.navigate('SprintDetail', {
      projectId: intent.projectId,
      sprintId: intent.sprintId,
    });
    return true;
  }

  if (intent.kind === 'document') {
    if (intent.pageId) {
      navigationRef.navigate('DocumentDetail', { id: intent.pageId });
      return true;
    }
    if (intent.projectId) {
      navigationRef.navigate('ProjectDocs', {
        projectId: intent.projectId,
        ...(intent.spaceId ? { spaceId: intent.spaceId } : {}),
      });
      return true;
    }
    navigationRef.navigate('Docs', intent.spaceId ? { spaceId: intent.spaceId } : undefined);
    return true;
  }

  if (intent.kind === 'public-document') {
    navigationRef.navigate('PublicDocument', { token: intent.token });
    return true;
  }

  if (intent.kind === 'public-intake') {
    navigationRef.navigate('PublicIntake', { slug: intent.slug });
    return true;
  }

  if (intent.kind === 'project') {
    if (intent.section === 'analytics') {
      navigationRef.navigate('ProjectAnalytics', { projectId: intent.projectId });
      return true;
    }
    if (intent.section === 'backlog') {
      navigationRef.navigate('ProjectBacklog', {
        projectId: intent.projectId,
        ...projectBacklogRouteParams(intent),
      });
      return true;
    }
    if (intent.section === 'board') {
      navigationRef.navigate('ProjectDetail', {
        id: intent.projectId,
        viewMode: 'board',
        ...projectIssueRouteParams(intent),
      });
      return true;
    }
    if (intent.section === 'chat') {
      navigationRef.navigate('ProjectChat', {
        projectId: intent.projectId,
        ...(intent.roomId ? { roomId: intent.roomId } : {}),
      });
      return true;
    }
    if (intent.section === 'docs') {
      navigationRef.navigate('ProjectDocs', { projectId: intent.projectId });
      return true;
    }
    if (intent.section === 'modules') {
      navigationRef.navigate('ProjectModules', { projectId: intent.projectId });
      return true;
    }
    if (intent.section === 'roadmap') {
      navigationRef.navigate('ProjectRoadmap', { projectId: intent.projectId });
      return true;
    }
    if (intent.section === 'settings') {
      navigationRef.navigate('ProjectSettings', { id: intent.projectId, section: 'general' });
      return true;
    }
    if (isProjectSettingsSection(intent.section)) {
      navigationRef.navigate('ProjectSettings', { id: intent.projectId, section: intent.section });
      return true;
    }
    if (intent.section === 'sprints') {
      navigationRef.navigate('ProjectSprints', { projectId: intent.projectId });
      return true;
    }
    if (intent.section === 'views') {
      navigationRef.navigate('ProjectViews', { projectId: intent.projectId });
      return true;
    }
    if (intent.section === 'workflows') {
      navigationRef.navigate('ProjectWorkflows', { projectId: intent.projectId });
      return true;
    }
    navigationRef.navigate('ProjectDetail', { id: intent.projectId });
    return true;
  }

  if (intent.screen === 'AiTransparency') {
    navigationRef.navigate(
      'AiTransparency',
      intent.aiTransparencyFocus ? { focus: intent.aiTransparencyFocus } : undefined,
    );
  } else if (intent.screen === 'ApiDocs') navigationRef.navigate('ApiDocs');
  else if (intent.screen === 'AuditLogStreaming') navigationRef.navigate('AuditLogStreaming');
  else if (intent.screen === 'DeveloperSettings') {
    navigationRef.navigate(
      'DeveloperSettings',
      intent.developerSection ? { section: intent.developerSection } : undefined,
    );
  } else if (intent.screen === 'Drafts') navigationRef.navigate('Drafts');
  else if (intent.screen === 'ImportSettings') {
    navigationRef.navigate(
      'ImportSettings',
      intent.importSource || intent.importProjectId
        ? {
            ...(intent.importSource ? { source: intent.importSource } : {}),
            ...(intent.importProjectId ? { projectId: intent.importProjectId } : {}),
          }
        : undefined,
    );
  } else if (intent.screen === 'InstanceAdmin') {
    navigationRef.navigate(
      'InstanceAdmin',
      intent.adminSection ? { section: intent.adminSection } : undefined,
    );
  } else if (intent.screen === 'IntakeForms') {
    navigationRef.navigate(
      'IntakeForms',
      intent.intakeFormId ? { formId: intent.intakeFormId } : undefined,
    );
  } else if (intent.screen === 'IssuesList') {
    navigationRef.navigate(
      'IssuesList',
      intent.issueListQuery ||
        intent.issueListStatus ||
        intent.issueListSprintId ||
        intent.issueListType
        ? {
            ...(intent.issueListQuery ? { query: intent.issueListQuery } : {}),
            ...(intent.issueListStatus ? { status: intent.issueListStatus } : {}),
            ...(intent.issueListSprintId ? { sprintId: intent.issueListSprintId } : {}),
            ...(intent.issueListType ? { type: intent.issueListType } : {}),
          }
        : undefined,
    );
  } else if (intent.screen === 'LabelsSettings') navigationRef.navigate('LabelsSettings');
  else if (intent.screen === 'NewIssue') {
    navigationRef.navigate(
      'NewIssue',
      intent.newIssueProjectId || intent.newIssueSprintId || intent.newIssueType
        ? {
            ...(intent.newIssueProjectId ? { projectId: intent.newIssueProjectId } : {}),
            ...(intent.newIssueSprintId ? { sprintId: intent.newIssueSprintId } : {}),
            ...(intent.newIssueType ? { type: intent.newIssueType } : {}),
          }
        : undefined,
    );
  } else if (intent.screen === 'NewProject') navigationRef.navigate('NewProject');
  else if (intent.screen === 'OrganizationSettings') {
    navigationRef.navigate(
      'OrganizationSettings',
      intent.organizationSection ? { section: intent.organizationSection } : undefined,
    );
  } else if (intent.screen === 'Search') {
    navigationRef.navigate(
      'Search',
      intent.searchQuery ? { query: intent.searchQuery } : undefined,
    );
  } else if (intent.screen === 'SsoSettings') navigationRef.navigate('SsoSettings');
  else if (intent.screen === 'Templates') navigationRef.navigate('Templates');
  else return false;

  return true;
}
