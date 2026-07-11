import type { NavigatorScreenParams } from '@react-navigation/native';

export type NewIssueRouteType = 'task' | 'story' | 'bug' | 'epic';
export type ImportSourceRouteParam = 'csv' | 'plane' | 'linear' | 'jira' | 'github';
export type DeveloperSettingsSection = 'apiKeys' | 'webhooks' | 'audit';
export type InstanceAdminSection =
  | 'overview'
  | 'directory'
  | 'system'
  | 'realtime'
  | 'ai-usage'
  | 'agents'
  | 'registration'
  | 'feature-flags'
  | 'updates'
  | 'audit';
export type InboxActorRouteFilter = 'user' | 'agent' | 'webhook' | 'system';
export type InboxNotificationRouteFilter =
  | 'mention'
  | 'assignment'
  | 'due'
  | 'status'
  | 'comment'
  | 'reaction';
export type InboxTabParams = {
  actorFilter?: InboxActorRouteFilter;
  typeFilter?: InboxNotificationRouteFilter;
  unreadOnly?: boolean;
  snoozedOnly?: boolean;
};
export type DashboardRouteNotice = 'emailVerified' | 'accessDenied';
export type DashboardTabParams = {
  notice?: DashboardRouteNotice;
};
export type MyIssuesRouteView = 'assigned' | 'created' | 'subscribed' | 'mentioned';
export type MyIssuesTabParams = {
  view?: MyIssuesRouteView;
};
export type IssueListRouteStatus = 'backlog' | 'todo' | 'in_progress' | 'in_review' | 'done';
export type IssueListRouteType = 'task' | 'story' | 'bug' | 'epic';
export type IssueListStackParams = {
  query?: string;
  status?: IssueListRouteStatus;
  sprintId?: 'none' | string;
  type?: IssueListRouteType;
};
export type ProjectIssueRouteParams = {
  query?: string;
  status?: IssueListRouteStatus;
  sprintId?: 'none' | string;
  type?: IssueListRouteType;
};
export type ProjectBacklogRouteParams = Omit<ProjectIssueRouteParams, 'sprintId'>;
export type TeamStatusRouteFilter = 'active' | 'invited' | 'suspended';
export type TeamTabParams = {
  statusFilter?: TeamStatusRouteFilter;
};
export type ProfileRouteFocus = 'notifications' | 'appearance';
export type ProfileTabParams = {
  focus?: ProfileRouteFocus;
};
export type AiTransparencyRouteFocus = 'modelCards';
export type AiTransparencyRouteParams = {
  focus?: AiTransparencyRouteFocus;
};
export type SearchRouteParams = {
  query?: string;
};
export type ProjectSettingsSection =
  | 'general'
  | 'permissions'
  | 'schemes'
  | 'security'
  | 'work-item-types'
  | 'custom-fields'
  | 'estimates'
  | 'versions'
  | 'components'
  | 'automation'
  | 'ai-agents'
  | 'chat-calls'
  | 'webhooks';
export type OrganizationSettingsSection =
  | 'general'
  | 'teamspaces'
  | 'communications'
  | 'integrations'
  | 'danger';
export type OrganizationSettingsIntegrationStatus = 'connected' | 'error';
export type OrganizationSettingsRouteParams = {
  section?: OrganizationSettingsSection;
  integrationProvider?: string;
  integrationStatus?: OrganizationSettingsIntegrationStatus;
  integrationReason?: string;
};

export type AppStackParamList = {
  MainTabs: NavigatorScreenParams<AppTabParamList> | undefined;
  ProjectDetail: { id: string; viewMode?: 'list' | 'board' } & ProjectIssueRouteParams;
  ProjectSettings: { id: string; section?: ProjectSettingsSection };
  ProjectAnalytics: { projectId: string };
  ProjectBacklog: { projectId: string } & ProjectBacklogRouteParams;
  ProjectChat: { projectId: string; roomId?: string };
  ProjectDocs: { projectId: string; spaceId?: string };
  ProjectModules: { projectId: string };
  ProjectRoadmap: { projectId: string };
  ProjectSprints: { projectId: string };
  ProjectViews: { projectId: string };
  ProjectWorkflows: { projectId: string };
  SprintDetail: { projectId: string; sprintId: string };
  IssuesList: IssueListStackParams | undefined;
  IssueDetail: { id: string };
  InitiativeDetail: { id: string };
  AiTransparency: AiTransparencyRouteParams | undefined;
  AskAi: undefined;
  ApiDocs: undefined;
  ImportSettings: { source?: ImportSourceRouteParam; projectId?: string } | undefined;
  SsoSettings: undefined;
  AuditLogStreaming: undefined;
  LabelsSettings: undefined;
  OrganizationSettings: OrganizationSettingsRouteParams | undefined;
  Search: SearchRouteParams | undefined;
  Drafts: undefined;
  Templates: undefined;
  DeveloperSettings: { section?: DeveloperSettingsSection } | undefined;
  IntakeForms: { formId?: string } | undefined;
  PublicIntake: { slug: string };
  InstanceAdmin: { section?: InstanceAdminSection } | undefined;
  Docs: { spaceId?: string } | undefined;
  DocumentDetail: { id: string };
  DocumentEditor: {
    id?: string;
    spaceId?: string | null;
    parentId?: string | null;
    projectId?: string | null;
  };
  PublicDocument: { token: string };
  NewIssue: { projectId?: string; sprintId?: string; type?: NewIssueRouteType } | undefined;
  NewProject: undefined;
};

export type AppTabParamList = {
  Dashboard: DashboardTabParams | undefined;
  Projects: undefined;
  Issues: MyIssuesTabParams | undefined;
  Initiatives: undefined;
  Team: TeamTabParams | undefined;
  Inbox: InboxTabParams | undefined;
  Profile: ProfileTabParams | undefined;
};
