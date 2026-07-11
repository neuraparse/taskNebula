/** Query + mutation hooks. Keys are namespaced by the active server URL so
 *  switching self-hosted instances never serves another server's cache. */
import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient, type QueryClient } from '@tanstack/react-query';
import i18next from 'i18next';
import { getServerHealth } from '@/api/auth';
import { getAuthCookie, getBaseUrl } from '@/api/client';
import * as api from '@/api/endpoints';
import type {
  AttachIssueDocumentInput,
  AddTeamspaceMemberInput,
  AddProjectMemberInput,
  AddCommentInput,
  AskTaskNebulaInput,
  ApplyIssueTriageInput,
  AssignOrganizationMemberProjectsInput,
  CreateConversationCallTokenInput,
  CreateConversationMessageInput,
  CreateApiKeyInput,
  CreateAutomationRuleInput,
  CreateCustomFieldInput,
  CreateLabelInput,
  CreateProjectChatChannelInput,
  CreateInitiativeInput,
  CreateInitiativeUpdateInput,
  CreateDocumentPageInput,
  CreateDraftInput,
  CreateIssueInput,
  CreateIssueLinkInput,
  CreateIntakeFormInput,
  CreatePermissionSchemeInput,
  CreateSecurityLevelInput,
  CreateSecuritySchemeInput,
  CreateProjectModuleInput,
  CreateProjectViewInput,
  CreateProjectComponentInput,
  CreateProjectInput,
  CreateProjectInviteLinkInput,
  CreateProjectVersionInput,
  CreateSavedIssueFilterInput,
  CreateAuditLogSinkInput,
  CreateScimTokenInput,
  DispatchIssueAgentInput,
  DraftIssueWithAiInput,
  CreateSprintInput,
  CreateTeamspaceInput,
  InitiativesListResponse,
  ImportPreviewInput,
  InviteOrganizationMemberInput,
  IssueFilters,
  LeaveConversationCallInput,
  ListCustomFieldsInput,
  LogIssueTimeEntryInput,
  ReleaseProjectVersionInput,
  RunIssueAssistInput,
  RunImportInput,
  RestoreDocumentRevisionInput,
  SetIssueCustomFieldValueInput,
  SetIssueVersionsInput,
  StopIssueTimerInput,
  ToggleCommentReactionInput,
  UpdateCommentInput,
  UpdateAutomationRuleInput,
  UpdateCustomFieldInput,
  UpdateAuditLogSinkInput,
  UpdateConversationMessageInput,
  UpdateDocumentPageInput,
  UpdateDocumentShareInput,
  UpdateDraftInput,
  UpdateIssueInput,
  UpdateLabelInput,
  UpdateIntakeFormInput,
  UpdateOrganizationAgentSettingsInput,
  UpdatePermissionSchemeInput,
  UpdateSecurityLevelInput,
  UpdateSecuritySchemeInput,
  UpdateProjectAgentSettingsInput,
  UpdateWorkspaceCommunicationsSettingsInput,
  UpdateNotificationPreferencesInput,
  UpdateUserAppearanceInput,
  UpdateOrganizationInput,
  UpdateProjectCommunicationsSettingsInput,
  UpdateProjectChatChannelInput,
  UpdateProjectModuleInput,
  UpdateProjectViewInput,
  UpdateProjectWorkflowTransitionInput,
  UpdateOrganizationMemberRoleInput,
  UpdateProjectMemberInput,
  UpdateProjectComponentInput,
  UpdateProjectInput,
  UpdateProjectVersionInput,
  UpdateSavedIssueFilterInput,
  UpdateSprintInput,
  UpdateTeamspaceMemberInput,
  UpdateTeamspaceInput,
  UpsertSsoConfigInput,
  UploadDocumentAttachmentInput,
  UploadIssueAttachmentInput,
  UseTemplateOverrides,
} from '@/api/endpoints';
import type {
  AgentApprovalRequest,
  AgentApprovalStatus,
  AiCapability,
  AdminAgentControlResponse,
  ApiKey,
  AdminFeatureFlag,
  AutomationRule,
  AuditLogSink,
  AuditLogSinksResponse,
  AuditLogSinkTestResult,
  CreatedAuditLogSink,
  CreatedScimToken,
  CustomField,
  Comment,
  CommentReaction,
  ConversationMessage,
  ConversationMessagesPage,
  DocumentPage,
  DocumentRevision,
  DocumentScopeParams,
  DocumentTreeResponse,
  Draft,
  Issue,
  IssueAgentSessionsResponse,
  IssueStatusCategory,
  IssueTriageResponse,
  IssueVersions,
  MyWorkloadResponse,
  MyWorkloadWindow,
  InitiativeUpdate,
  ImportJobStatus,
  ImportPreviewResponse,
  ImportRunResponse,
  InboxFilters,
  Label,
  IntakeForm,
  MyIssueView,
  NotificationPreferences,
  Organization,
  OrganizationAgentSettingsResponse,
  OrganizationsResponse,
  PermissionScheme,
  PinnedItem,
  ProjectAgentSettingsResponse,
  ProjectChatActiveCall,
  ProjectChatBootstrap,
  ProjectCommunicationsSettingsResponse,
  ProjectComponent,
  ProjectModule,
  ProjectViewsResponse,
  ProjectVersion,
  ProjectWorkflowTransitionsResponse,
  PublicDocumentPage,
  PublicIntakeFormResponse,
  RegistrationPolicy,
  SavedIssueFilter,
  SearchHistoryEntry,
  ScimTokensResponse,
  SecurityScheme,
  Sprint,
  SprintBurndownAnalytics,
  StandupDigest,
  SsoConfigResponse,
  SubmitPublicIntakeResult,
  Teamspace,
  TeamspaceMembersResponse,
  UserAppearanceSettings,
  Webhook,
  Watcher,
  WorkspaceIntegrationProvider,
  WorkspaceIntegrationStatus,
  WorkspaceCommunicationsSettingsResponse,
} from '@/api/types';

const server = () => getBaseUrl() ?? 'none';

function mergeProjectVersionCounts(current: ProjectVersion, next: ProjectVersion): ProjectVersion {
  const merged: ProjectVersion = { ...current, ...next };
  if (next.issueCount === undefined && current.issueCount !== undefined) {
    merged.issueCount = current.issueCount;
  }
  if (next.doneIssueCount === undefined && current.doneIssueCount !== undefined) {
    merged.doneIssueCount = current.doneIssueCount;
  }
  return merged;
}

function messageTimestamp(message: ConversationMessage): number {
  const time = new Date(message.createdAt).getTime();
  return Number.isNaN(time) ? 0 : time;
}

function upsertConversationMessage(
  current: ConversationMessage[] | undefined,
  message: ConversationMessage,
): ConversationMessage[] {
  const messages = current ?? [];
  const index = messages.findIndex((item) => item.id === message.id);
  const next =
    index >= 0
      ? messages.map((item) => (item.id === message.id ? message : item))
      : [...messages, message];
  return [...next].sort((left, right) => messageTimestamp(left) - messageTimestamp(right));
}

function mergeOlderConversationMessages(
  current: ConversationMessage[] | undefined,
  older: ConversationMessage[],
): ConversationMessage[] {
  const messages = current ?? [];
  const seen = new Set(messages.map((message) => message.id));
  return [...older.filter((message) => !seen.has(message.id)), ...messages].sort(
    (left, right) => messageTimestamp(left) - messageTimestamp(right),
  );
}

function patchConversationMessageReactions(
  current: ConversationMessage[] | undefined,
  messageId: string,
  reactions: ConversationMessage['reactions'],
): ConversationMessage[] {
  return (current ?? []).map((message) =>
    message.id === messageId ? { ...message, reactions } : message,
  );
}

function tombstoneConversationMessage(
  current: ConversationMessage[] | undefined,
  messageId: string,
): ConversationMessage[] {
  const deletedAt = new Date().toISOString();
  return (current ?? []).map((message) =>
    message.id === messageId
      ? {
          ...message,
          body: '',
          attachments: [],
          mentions: [],
          deletedAt: message.deletedAt ?? deletedAt,
          canDelete: false,
          canEdit: false,
        }
      : message,
  );
}

function isConversationMessage(value: unknown): value is ConversationMessage {
  return (
    Boolean(value) &&
    typeof value === 'object' &&
    typeof (value as ConversationMessage).id === 'string' &&
    typeof (value as ConversationMessage).roomId === 'string'
  );
}

function numericCallCount(value: unknown): number {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && value.trim()) {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return 0;
}

function normalizeSseActiveCall(value: unknown, roomId: string): ProjectChatActiveCall | null {
  if (!value || typeof value !== 'object') return null;
  const raw = value as Record<string, unknown>;
  if (typeof raw.id !== 'string' || !raw.id) return null;
  const call: ProjectChatActiveCall = {
    id: raw.id,
    roomId: typeof raw.roomId === 'string' && raw.roomId ? raw.roomId : roomId,
    participantCount: numericCallCount(raw.participantCount),
  };
  if (typeof raw.livekitRoomName === 'string') call.livekitRoomName = raw.livekitRoomName;
  return call;
}

function sameActiveCall(
  current: ProjectChatActiveCall | null | undefined,
  next: ProjectChatActiveCall | null,
): boolean {
  if (!current && !next) return true;
  if (!current || !next) return false;
  return (
    current.id === next.id &&
    current.roomId === next.roomId &&
    current.participantCount === next.participantCount &&
    current.livekitRoomName === next.livekitRoomName
  );
}

function patchProjectChatActiveCall(
  current: ProjectChatBootstrap | undefined,
  roomId: string,
  nextCall: ProjectChatActiveCall | null,
): ProjectChatBootstrap | undefined {
  if (!current) return current;

  let changed = false;
  const activeCall = nextCall
    ? {
        ...nextCall,
        roomId: nextCall.roomId ?? roomId,
      }
    : null;

  const channels = current.channels.map((channel) => {
    if (channel.roomId !== roomId || sameActiveCall(channel.activeCall, activeCall)) {
      return channel;
    }
    changed = true;
    return { ...channel, activeCall };
  });

  const recentDiscussions = current.recentDiscussions.map((discussion) => {
    if (discussion.id !== roomId || sameActiveCall(discussion.activeCall, activeCall)) {
      return discussion;
    }
    changed = true;
    return { ...discussion, activeCall };
  });

  let activeCalls = current.activeCalls;
  if (activeCall) {
    const existingIndex = current.activeCalls.findIndex((call) => call.roomId === roomId);
    if (existingIndex >= 0) {
      if (!sameActiveCall(current.activeCalls[existingIndex], activeCall)) {
        activeCalls = current.activeCalls.map((call, index) =>
          index === existingIndex ? activeCall : call,
        );
        changed = true;
      }
    } else {
      activeCalls = [...current.activeCalls, activeCall];
      changed = true;
    }
  } else {
    const filtered = current.activeCalls.filter((call) => call.roomId !== roomId);
    if (filtered.length !== current.activeCalls.length) {
      activeCalls = filtered;
      changed = true;
    }
  }

  return changed ? { ...current, channels, recentDiscussions, activeCalls } : current;
}

function patchProjectChatActiveCallCache(
  qc: QueryClient,
  projectId: string | null,
  roomId: string | null,
  call: ProjectChatActiveCall | null,
) {
  if (!projectId || !roomId) return;
  qc.setQueryData<ProjectChatBootstrap>(qk.projectChatBootstrap(projectId), (current) =>
    patchProjectChatActiveCall(current, roomId, call),
  );
}

function defaultConversationPage(): ConversationMessagesPage {
  return { messages: [], pageInfo: { hasMore: false, nextCursor: null } };
}

const ISSUE_DERIVED_FAMILIES = new Set([
  'issue',
  'issues',
  'metrics',
  'project',
  'projects',
  'recentActivities',
  'search',
  'sprint',
]);

export function invalidateIssueDerivedQueries(qc: Pick<QueryClient, 'invalidateQueries'>): void {
  const currentServer = server();
  qc.invalidateQueries({
    predicate: (query) =>
      query.queryKey[0] === currentServer &&
      typeof query.queryKey[1] === 'string' &&
      ISSUE_DERIVED_FAMILIES.has(query.queryKey[1]),
  });
}

export function invalidateWorkspaceIntegrationQueries(
  qc: Pick<QueryClient, 'invalidateQueries'>,
): void {
  const currentServer = server();
  qc.invalidateQueries({
    predicate: (query) =>
      query.queryKey[0] === currentServer && query.queryKey[1] === 'workspaceIntegrations',
  });
}

type ChatSseEvent = {
  type?: string;
  data?: string | null;
};
type ChatSseListener = (event: ChatSseEvent) => void;
type ChatSse = {
  addEventListener: (type: string, listener: ChatSseListener) => void;
  removeAllEventListeners: () => void;
  close: () => void;
};
type ChatSseConstructor = new (
  url: string,
  options: {
    headers: Record<string, string>;
    pollingInterval: number;
    timeout: number;
    timeoutBeforeConnection: number;
  },
) => ChatSse;

export const qk = {
  me: () => [server(), 'me'] as const,
  userAppearance: () => [server(), 'userAppearance'] as const,
  serverHealth: () => [server(), 'serverHealth'] as const,
  projects: () => [server(), 'projects'] as const,
  project: (id: string) => [server(), 'project', id] as const,
  projectAnalytics: (id: string | null) =>
    [server(), 'project', id ?? 'none', 'analytics'] as const,
  doraAnalytics: (organizationId: string | null) =>
    [server(), 'organization', organizationId ?? 'none', 'analytics', 'dora'] as const,
  drafts: () => [server(), 'drafts'] as const,
  templates: () => [server(), 'templates'] as const,
  apiKeys: (organizationId: string | null) =>
    [server(), 'apiKeys', organizationId ?? 'none'] as const,
  webhooks: (organizationId: string | null, projectId?: string | null) =>
    [server(), 'webhooks', organizationId ?? 'none', projectId ?? 'organization'] as const,
  auditLogs: (organizationId: string | null, filter: string) =>
    [server(), 'auditLogs', organizationId ?? 'none', filter] as const,
  recentActivities: (organizationId: string | null, limit = 20) =>
    [server(), 'recentActivities', organizationId ?? 'none', limit] as const,
  auditLogSinks: (organizationId: string | null) =>
    [server(), 'auditLogSinks', organizationId ?? 'none'] as const,
  agentPolicy: (organizationId: string | null) =>
    [server(), 'agentPolicy', organizationId ?? 'none'] as const,
  agentApprovals: (organizationId: string | null, status: AgentApprovalStatus | 'all') =>
    [server(), 'agentApprovals', organizationId ?? 'none', status] as const,
  organizationAgentSettings: (organizationId: string | null) =>
    [server(), 'organizationAgentSettings', organizationId ?? 'none'] as const,
  projectAgentSettings: (projectId: string | null) =>
    [server(), 'project', projectId ?? 'none', 'agentSettings'] as const,
  workspaceCommunications: (organizationId: string | null) =>
    [server(), 'workspaceCommunications', organizationId ?? 'none'] as const,
  workspaceIntegrations: (organizationId: string | null) =>
    [server(), 'workspaceIntegrations', organizationId ?? 'none'] as const,
  adminStats: () => [server(), 'admin', 'stats'] as const,
  adminOrganizations: (limit = 10) => [server(), 'admin', 'organizations', limit] as const,
  adminUsers: (limit = 10) => [server(), 'admin', 'users', limit] as const,
  adminSmtpConfig: () => [server(), 'admin', 'system', 'smtp'] as const,
  adminStorageConfig: () => [server(), 'admin', 'system', 'storage'] as const,
  adminLivekitConfig: () => [server(), 'admin', 'system', 'livekit'] as const,
  adminAgentControl: () => [server(), 'admin', 'agentControl'] as const,
  adminRegistration: () => [server(), 'admin', 'registration'] as const,
  adminVersion: () => [server(), 'admin', 'version'] as const,
  adminAiUsage: (days = 7) => [server(), 'admin', 'aiUsage', days] as const,
  adminFeatureFlags: () => [server(), 'admin', 'featureFlags'] as const,
  adminRealtimeHealth: () => [server(), 'admin', 'realtimeHealth'] as const,
  searchHistory: (organizationId: string | null, pinned: boolean) =>
    [server(), 'searchHistory', organizationId ?? 'none', pinned ? 'pinned' : 'recent'] as const,
  systemAuditLogs: () => [server(), 'admin', 'auditLogs'] as const,
  organizations: () => [server(), 'organizations'] as const,
  organization: (organizationId: string | null) =>
    [server(), 'organization', organizationId ?? 'none'] as const,
  ssoConfig: (organizationId: string | null) =>
    [server(), 'organization', organizationId ?? 'none', 'ssoConfig'] as const,
  scimTokens: (organizationId: string | null) =>
    [server(), 'organization', organizationId ?? 'none', 'scimTokens'] as const,
  teamspaces: (organizationId: string | null) =>
    [server(), 'organization', organizationId ?? 'none', 'teamspaces'] as const,
  teamspaceMembers: (organizationId: string | null, teamspaceId: string | null) =>
    [
      server(),
      'organization',
      organizationId ?? 'none',
      'teamspace',
      teamspaceId ?? 'none',
      'members',
    ] as const,
  documentSpaces: (params: DocumentScopeParams = {}) =>
    [
      server(),
      'docs',
      'spaces',
      params.organizationId ?? 'all-organizations',
      params.projectId ?? 'all-projects',
    ] as const,
  documentPages: (spaceId?: string | null, params: DocumentScopeParams = {}) =>
    [
      server(),
      'docs',
      'pages',
      spaceId ?? 'default',
      params.organizationId ?? 'all-organizations',
      params.projectId ?? 'all-projects',
    ] as const,
  documentPage: (pageId: string | null) => [server(), 'docs', 'page', pageId ?? 'none'] as const,
  documentTree: (pageId: string | null) =>
    [server(), 'docs', 'page', pageId ?? 'none', 'tree'] as const,
  publicDocumentPage: (token: string | null) =>
    [server(), 'publicDocumentPage', token ?? 'none'] as const,
  documentRevisions: (pageId: string | null) =>
    [server(), 'docs', 'page', pageId ?? 'none', 'revisions'] as const,
  documentAttachments: (pageId: string | null) =>
    [server(), 'docs', 'page', pageId ?? 'none', 'attachments'] as const,
  documentSearch: (query: string, organizationId?: string | null, projectId?: string | null) =>
    [
      server(),
      'docs',
      'search',
      query.trim(),
      organizationId ?? 'all-organizations',
      projectId ?? 'all-projects',
    ] as const,
  issuesRoot: () => [server(), 'issues'] as const,
  issues: (f: IssueFilters) => [server(), 'issues', f] as const,
  savedIssueFilters: (organizationId: string | null, projectId?: string | null) =>
    [server(), 'savedIssueFilters', organizationId ?? 'none', projectId ?? 'all-projects'] as const,
  myIssues: (view: MyIssueView) => [server(), 'issues', 'my', view] as const,
  myWorkload: (window: MyWorkloadWindow) => [server(), 'metrics', 'myWorkload', window] as const,
  search: (query: string) => [server(), 'search', query.trim()] as const,
  issue: (id: string) => [server(), 'issue', id] as const,
  issueSubtasks: (id: string | null) => [server(), 'issue', id ?? 'none', 'subtasks'] as const,
  sprint: (id: string | null) => [server(), 'sprint', id ?? 'none'] as const,
  sprintIssues: (id: string | null) => [server(), 'sprint', id ?? 'none', 'issues'] as const,
  sprintBurndown: (id: string | null) => [server(), 'sprint', id ?? 'none', 'burndown'] as const,
  sprints: (projectId: string | null) =>
    [server(), 'project', projectId ?? 'none', 'sprints'] as const,
  comments: (id: string) => [server(), 'issue', id, 'comments'] as const,
  issueActivities: (id: string | null) => [server(), 'issue', id ?? 'none', 'activities'] as const,
  issueAttachments: (id: string | null) =>
    [server(), 'issue', id ?? 'none', 'attachments'] as const,
  watchers: (id: string) => [server(), 'issue', id, 'watchers'] as const,
  issueTriage: (id: string | null) => [server(), 'issue', id ?? 'none', 'triage'] as const,
  issueLinks: (id: string | null) => [server(), 'issue', id ?? 'none', 'links'] as const,
  issueDocuments: (id: string | null) => [server(), 'issue', id ?? 'none', 'documents'] as const,
  issueTimeEntries: (id: string | null) =>
    [server(), 'issue', id ?? 'none', 'timeEntries'] as const,
  issueTimeInStatus: (id: string | null) =>
    [server(), 'issue', id ?? 'none', 'timeInStatus'] as const,
  issueAgentSessions: (id: string | null) =>
    [server(), 'issue', id ?? 'none', 'agentSessions'] as const,
  initiatives: (workspaceId?: string | null) =>
    [server(), 'initiatives', workspaceId ?? 'all'] as const,
  initiative: (id: string) => [server(), 'initiative', id] as const,
  initiativeRollup: (id: string) => [server(), 'initiative', id, 'rollup'] as const,
  initiativeUpdates: (id: string) => [server(), 'initiative', id, 'updates'] as const,
  inbox: (filters: InboxFilters | boolean) => [server(), 'inbox', filters] as const,
  inboxPage: (filters: InboxFilters | boolean) => [server(), 'inbox', 'page', filters] as const,
  catchMeUp: (since?: string | null) =>
    [server(), 'inbox', 'catchMeUp', since ?? 'latest'] as const,
  pinnedItems: () => [server(), 'pinnedItems'] as const,
  todayStandup: (organizationId?: string | null) =>
    [server(), 'standup', 'today', organizationId ?? 'default'] as const,
  intakeForms: (projectId?: string | null) =>
    [server(), 'intakeForms', projectId ?? 'all'] as const,
  intakeForm: (formId: string | null) => [server(), 'intakeForm', formId ?? 'none'] as const,
  publicIntakeForm: (slug: string | null) =>
    [server(), 'publicIntakeForm', slug ?? 'none'] as const,
  importJob: (jobId: string | null) => [server(), 'importJob', jobId ?? 'none'] as const,
  notificationPreferences: (organizationId: string | null) =>
    [server(), 'notificationPreferences', organizationId ?? 'none'] as const,
  aiCapability: (organizationId: string | null) =>
    [server(), 'aiCapability', organizationId ?? 'none'] as const,
  labels: (organizationId: string | null, projectId?: string | null) =>
    [server(), 'labels', organizationId ?? 'none', projectId ?? 'none'] as const,
  customFields: (organizationId: string | null, projectId?: string | null) =>
    [server(), 'customFields', organizationId ?? 'none', projectId ?? 'none'] as const,
  projectComponents: (projectId: string | null) =>
    [server(), 'project', projectId ?? 'none', 'components'] as const,
  projectModules: (projectId: string | null) =>
    [server(), 'project', projectId ?? 'none', 'modules'] as const,
  projectViews: (projectId: string | null, teamId?: string | null) =>
    [server(), 'project', projectId ?? 'none', 'views', teamId ?? 'all-teamspaces'] as const,
  projectChatBootstrap: (projectId: string | null) =>
    [server(), 'project', projectId ?? 'none', 'chat', 'bootstrap'] as const,
  liveCalls: () => [server(), 'chat', 'liveCalls'] as const,
  projectCommunications: (projectId: string | null) =>
    [server(), 'project', projectId ?? 'none', 'communications'] as const,
  conversationMessages: (roomId: string | null) =>
    [server(), 'conversation', roomId ?? 'none', 'messages'] as const,
  projectWorkflowStatuses: (projectId: string | null) =>
    [server(), 'project', projectId ?? 'none', 'workflowStatuses'] as const,
  projectWorkflowTransitions: (projectId: string | null) =>
    [server(), 'project', projectId ?? 'none', 'workflowTransitions'] as const,
  projectVersions: (projectId: string | null) =>
    [server(), 'project', projectId ?? 'none', 'versions'] as const,
  issueComponents: (issueId: string | null) =>
    [server(), 'issue', issueId ?? 'none', 'components'] as const,
  issueVersions: (issueId: string | null) =>
    [server(), 'issue', issueId ?? 'none', 'versions'] as const,
  issueCustomFieldValues: (issueId: string | null) =>
    [server(), 'issue', issueId ?? 'none', 'customFieldValues'] as const,
  projectMembers: (projectId: string | null) =>
    [server(), 'project', projectId ?? 'none', 'members'] as const,
  projectInviteLinks: (projectId: string | null) =>
    [server(), 'project', projectId ?? 'none', 'inviteLinks'] as const,
  permissionSchemes: (organizationId: string | null) =>
    [server(), 'permissionSchemes', organizationId ?? 'none'] as const,
  projectPermissionScheme: (projectId: string | null) =>
    [server(), 'project', projectId ?? 'none', 'permissionScheme'] as const,
  securitySchemes: (organizationId: string | null) =>
    [server(), 'securitySchemes', organizationId ?? 'none'] as const,
  projectSecurityScheme: (projectId: string | null) =>
    [server(), 'project', projectId ?? 'none', 'securityScheme'] as const,
  automationRules: (organizationId: string | null, projectId?: string | null) =>
    [server(), 'automationRules', organizationId ?? 'none', projectId ?? 'organization'] as const,
  automationExecutions: (ruleId: string | null) =>
    [server(), 'automationRule', ruleId ?? 'none', 'executions'] as const,
  organizationMembers: (organizationId: string | null) =>
    [server(), 'organization', organizationId ?? 'none', 'members'] as const,
};

export const useMe = () => useQuery({ queryKey: qk.me(), queryFn: api.me });

export const useUserAppearance = (enabled = true) =>
  useQuery({ queryKey: qk.userAppearance(), queryFn: api.getUserAppearance, enabled });

export const useServerHealth = () =>
  useQuery({ queryKey: qk.serverHealth(), queryFn: getServerHealth, retry: 1 });

export const useProjects = () =>
  useQuery({ queryKey: qk.projects(), queryFn: () => api.listProjects() });

export const useProject = (id: string) =>
  useQuery({ queryKey: qk.project(id), queryFn: () => api.getProject(id), enabled: !!id });

export const useProjectAnalytics = (id: string | null) =>
  useQuery({
    queryKey: qk.projectAnalytics(id),
    queryFn: () => api.getProjectAnalytics(id ?? ''),
    enabled: !!id,
  });

export const useDoraAnalytics = (organizationId: string | null) =>
  useQuery({
    queryKey: qk.doraAnalytics(organizationId),
    queryFn: () => api.getDoraAnalytics(organizationId ?? ''),
    enabled: !!organizationId,
  });

export const useDrafts = () => useQuery({ queryKey: qk.drafts(), queryFn: () => api.listDrafts() });

export function useCreateDraft() {
  const qc = useQueryClient();
  return useMutation({
    mutationKey: ['createDraft'],
    mutationFn: (input: CreateDraftInput) => api.createDraft(input),
    onSuccess: (draft) => {
      qc.setQueryData<Draft[]>(qk.drafts(), (current) => [draft, ...(current ?? [])]);
      qc.invalidateQueries({ queryKey: qk.drafts() });
    },
  });
}

export function useUpdateDraft() {
  const qc = useQueryClient();
  return useMutation({
    mutationKey: ['updateDraft'],
    mutationFn: (input: UpdateDraftInput) => api.updateDraft(input),
    onSuccess: (draft) => {
      qc.setQueryData<Draft[]>(qk.drafts(), (current) =>
        current?.map((item) => (item.id === draft.id ? draft : item)),
      );
      qc.invalidateQueries({ queryKey: qk.drafts() });
    },
  });
}

export function useDeleteDraft() {
  const qc = useQueryClient();
  return useMutation({
    mutationKey: ['deleteDraft'],
    mutationFn: (draftId: string) => api.deleteDraft(draftId),
    onSuccess: (_result, draftId) => {
      qc.setQueryData<Draft[]>(qk.drafts(), (current) =>
        current?.filter((item) => item.id !== draftId),
      );
      qc.invalidateQueries({ queryKey: qk.drafts() });
    },
  });
}

export function usePromoteDraft() {
  const qc = useQueryClient();
  return useMutation({
    mutationKey: ['promoteDraft'],
    mutationFn: async ({ draft, projectId }: { draft: Draft; projectId: string }) => {
      const issue = await api.createIssue({
        projectId,
        type: 'task',
        title: draft.title.trim() || i18next.t('drafts.untitled'),
        priority: 'medium',
        labels: [],
        ...(draft.content ? { description: draft.content } : {}),
      });
      await api.deleteDraft(draft.id).catch(() => undefined);
      return issue;
    },
    onSuccess: (issue: Issue) => {
      qc.setQueryData(qk.issue(issue.id), issue);
      qc.invalidateQueries({ queryKey: qk.drafts() });
      invalidateIssueDerivedQueries(qc);
    },
  });
}

export function usePromoteDocumentDraft() {
  const qc = useQueryClient();
  return useMutation({
    mutationKey: ['promoteDocumentDraft'],
    mutationFn: async ({ draft, spaceId }: { draft: Draft; spaceId: string }) => {
      const page = await api.createDocumentPage({
        spaceId,
        title: draft.title.trim() || i18next.t('drafts.untitled'),
        contentJson: api.documentTextToContentJson(draft.content ?? ''),
      });
      await api.deleteDraft(draft.id).catch(() => undefined);
      return page;
    },
    onSuccess: (page: DocumentPage) => {
      qc.invalidateQueries({ queryKey: qk.drafts() });
      qc.setQueryData(qk.documentPage(page.id), page);
      qc.invalidateQueries({ queryKey: [server(), 'docs'] });
    },
  });
}

export const useTemplates = () =>
  useQuery({ queryKey: qk.templates(), queryFn: () => api.listTemplates() });

export const usePinnedItems = () =>
  useQuery({ queryKey: qk.pinnedItems(), queryFn: () => api.listPinnedItems() });

export function useDeletePinnedItem() {
  const qc = useQueryClient();
  return useMutation({
    mutationKey: ['deletePinnedItem'],
    mutationFn: (id: string) => api.deletePinnedItem(id),
    onSuccess: (_result, id) => {
      qc.setQueryData<PinnedItem[]>(qk.pinnedItems(), (current) =>
        current?.filter((item) => item.id !== id),
      );
      qc.invalidateQueries({ queryKey: qk.pinnedItems() });
    },
  });
}

export const useTodayStandup = (organizationId?: string | null) =>
  useQuery({
    queryKey: qk.todayStandup(organizationId),
    queryFn: () => api.getTodayStandup(organizationId),
  });

export function useGenerateStandupPreview(organizationId?: string | null) {
  const qc = useQueryClient();
  return useMutation({
    mutationKey: ['generateStandupPreview', organizationId],
    mutationFn: () => api.generateStandupPreview(organizationId),
    onSuccess: (digest: StandupDigest) => {
      qc.setQueryData(qk.todayStandup(organizationId), digest);
      qc.invalidateQueries({ queryKey: qk.todayStandup(organizationId) });
    },
  });
}

export const useApiKeys = (organizationId: string | null) =>
  useQuery({
    queryKey: qk.apiKeys(organizationId),
    queryFn: () => api.listApiKeys(organizationId ?? ''),
    enabled: !!organizationId,
  });

export function useCreateApiKey(organizationId: string | null) {
  const qc = useQueryClient();
  return useMutation({
    mutationKey: ['createApiKey', organizationId],
    mutationFn: (input: CreateApiKeyInput) => api.createApiKey(input),
    onSuccess: (key) => {
      qc.setQueryData<ApiKey[]>(qk.apiKeys(organizationId), (current) => [key, ...(current ?? [])]);
      qc.invalidateQueries({ queryKey: qk.apiKeys(organizationId) });
    },
  });
}

export function useRevokeApiKey(organizationId: string | null) {
  const qc = useQueryClient();
  return useMutation({
    mutationKey: ['revokeApiKey', organizationId],
    mutationFn: (keyId: string) => api.revokeApiKey(keyId),
    onSuccess: (_result, keyId) => {
      qc.setQueryData<ApiKey[]>(qk.apiKeys(organizationId), (current) =>
        current?.map((key) =>
          key.id === keyId ? { ...key, isActive: false, revokedAt: new Date().toISOString() } : key,
        ),
      );
      qc.invalidateQueries({ queryKey: qk.apiKeys(organizationId) });
    },
  });
}

export const useWebhooks = (organizationId: string | null, projectId?: string | null) =>
  useQuery({
    queryKey: qk.webhooks(organizationId, projectId),
    queryFn: () => {
      const params: api.ListWebhooksParams = { organizationId: organizationId ?? '' };
      if (projectId) params.projectId = projectId;
      return api.listWebhooks(params);
    },
    enabled: !!organizationId,
  });

export function useCreateWebhook(organizationId: string | null, projectId?: string | null) {
  const qc = useQueryClient();
  return useMutation({
    mutationKey: ['createWebhook', organizationId, projectId ?? null],
    mutationFn: (input: api.CreateWebhookInput) => api.createWebhook(input),
    onSuccess: (webhook) => {
      qc.setQueryData<Webhook[]>(qk.webhooks(organizationId, projectId), (current) => [
        webhook,
        ...(current ?? []),
      ]);
      qc.invalidateQueries({ queryKey: qk.webhooks(organizationId, projectId) });
    },
  });
}

export function useUpdateWebhook(organizationId: string | null, projectId?: string | null) {
  const qc = useQueryClient();
  return useMutation({
    mutationKey: ['updateWebhook', organizationId, projectId ?? null],
    mutationFn: (input: api.UpdateWebhookInput) => api.updateWebhook(input),
    onSuccess: (webhook) => {
      qc.setQueryData<Webhook[]>(qk.webhooks(organizationId, projectId), (current) =>
        current?.map((item) => (item.id === webhook.id ? webhook : item)),
      );
      qc.invalidateQueries({ queryKey: qk.webhooks(organizationId, projectId) });
    },
  });
}

export function useDeleteWebhook(organizationId: string | null, projectId?: string | null) {
  const qc = useQueryClient();
  return useMutation({
    mutationKey: ['deleteWebhook', organizationId, projectId ?? null],
    mutationFn: (webhookId: string) => api.deleteWebhook(webhookId),
    onSuccess: (_result, webhookId) => {
      qc.setQueryData<Webhook[]>(qk.webhooks(organizationId, projectId), (current) =>
        current?.filter((webhook) => webhook.id !== webhookId),
      );
      qc.invalidateQueries({ queryKey: qk.webhooks(organizationId, projectId) });
    },
  });
}

export function useTestWebhook(organizationId: string | null, projectId?: string | null) {
  const qc = useQueryClient();
  return useMutation({
    mutationKey: ['testWebhook', organizationId, projectId ?? null],
    mutationFn: (webhookId: string) => api.testWebhook(webhookId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: qk.webhooks(organizationId, projectId) });
    },
  });
}

export const useAuditLogs = (organizationId: string | null, filter: string) =>
  useQuery({
    queryKey: qk.auditLogs(organizationId, filter),
    queryFn: () => api.listAuditLogs({ organizationId: organizationId ?? '', limit: 75 }),
    enabled: !!organizationId,
  });

export const useRecentActivities = (organizationId: string | null, limit = 12) =>
  useQuery({
    queryKey: qk.recentActivities(organizationId, limit),
    queryFn: () => api.listRecentActivities({ organizationId: organizationId ?? '', limit }),
    enabled: !!organizationId,
    staleTime: 5 * 60 * 1000,
  });

export const useAuditLogSinks = (organizationId: string | null) =>
  useQuery<AuditLogSinksResponse>({
    queryKey: qk.auditLogSinks(organizationId),
    queryFn: () => api.listAuditLogSinks(organizationId ?? ''),
    enabled: !!organizationId,
  });

export function useCreateAuditLogSink(organizationId: string | null) {
  const qc = useQueryClient();
  return useMutation<CreatedAuditLogSink, Error, CreateAuditLogSinkInput>({
    mutationKey: ['createAuditLogSink', organizationId],
    mutationFn: (input) => api.createAuditLogSink(input),
    onSuccess: (sink) => {
      qc.setQueryData<AuditLogSinksResponse | undefined>(
        qk.auditLogSinks(organizationId),
        (current) => (current ? { ...current, sinks: [sink, ...current.sinks] } : current),
      );
      qc.invalidateQueries({ queryKey: qk.auditLogSinks(organizationId) });
    },
  });
}

export function useUpdateAuditLogSink(organizationId: string | null) {
  const qc = useQueryClient();
  return useMutation<AuditLogSink, Error, UpdateAuditLogSinkInput>({
    mutationKey: ['updateAuditLogSink', organizationId],
    mutationFn: (input) => api.updateAuditLogSink(input),
    onSuccess: (sink) => {
      qc.setQueryData<AuditLogSinksResponse | undefined>(
        qk.auditLogSinks(organizationId),
        (current) =>
          current
            ? {
                ...current,
                sinks: current.sinks.map((item) => (item.id === sink.id ? sink : item)),
              }
            : current,
      );
      qc.invalidateQueries({ queryKey: qk.auditLogSinks(organizationId) });
    },
  });
}

export function useDeleteAuditLogSink(organizationId: string | null) {
  const qc = useQueryClient();
  return useMutation<{ ok?: boolean }, Error, string>({
    mutationKey: ['deleteAuditLogSink', organizationId],
    mutationFn: (sinkId) => api.deleteAuditLogSink(sinkId),
    onSuccess: (_result, sinkId) => {
      qc.setQueryData<AuditLogSinksResponse | undefined>(
        qk.auditLogSinks(organizationId),
        (current) =>
          current
            ? { ...current, sinks: current.sinks.filter((sink) => sink.id !== sinkId) }
            : current,
      );
      qc.invalidateQueries({ queryKey: qk.auditLogSinks(organizationId) });
    },
  });
}

export function useTestAuditLogSink(organizationId: string | null) {
  const qc = useQueryClient();
  return useMutation<AuditLogSinkTestResult, Error, string>({
    mutationKey: ['testAuditLogSink', organizationId],
    mutationFn: (sinkId) => api.testAuditLogSink(sinkId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: qk.auditLogSinks(organizationId) });
    },
  });
}

export const useAgentPolicy = (organizationId: string | null, enabled = true) =>
  useQuery({
    queryKey: qk.agentPolicy(organizationId),
    queryFn: () => api.getAgentPolicy(organizationId ?? ''),
    enabled: enabled && !!organizationId,
  });

export const useAgentApprovals = (
  organizationId: string | null,
  status: AgentApprovalStatus | 'all' = 'pending',
  enabled = true,
) =>
  useQuery({
    queryKey: qk.agentApprovals(organizationId, status),
    queryFn: () => api.listAgentApprovals({ organizationId: organizationId ?? '', status }),
    enabled: enabled && !!organizationId,
  });

function invalidateAgentApprovalDecisionCaches(
  qc: ReturnType<typeof useQueryClient>,
  organizationId: string | null,
) {
  qc.invalidateQueries({ queryKey: qk.agentApprovals(organizationId, 'pending') });
  qc.invalidateQueries({ queryKey: qk.agentApprovals(organizationId, 'all') });
  qc.invalidateQueries({ queryKey: [server(), 'issues'] });
  qc.invalidateQueries({ queryKey: [server(), 'docs'] });
  qc.invalidateQueries({ queryKey: qk.inbox(false) });
  qc.invalidateQueries({ queryKey: qk.inbox(true) });
}

export function useApproveAgentApproval(organizationId: string | null) {
  const qc = useQueryClient();
  return useMutation({
    mutationKey: ['approveAgentApproval', organizationId],
    mutationFn: (approvalId: string) => api.approveAgentApproval(approvalId),
    onSuccess: (result) => {
      qc.setQueryData<AgentApprovalRequest[]>(
        qk.agentApprovals(organizationId, 'pending'),
        (current) => current?.filter((approval) => approval.id !== result.approval.id),
      );
      invalidateAgentApprovalDecisionCaches(qc, organizationId);
    },
  });
}

export function useRejectAgentApproval(organizationId: string | null) {
  const qc = useQueryClient();
  return useMutation({
    mutationKey: ['rejectAgentApproval', organizationId],
    mutationFn: (approvalId: string) => api.rejectAgentApproval(approvalId),
    onSuccess: (result) => {
      qc.setQueryData<AgentApprovalRequest[]>(
        qk.agentApprovals(organizationId, 'pending'),
        (current) => current?.filter((approval) => approval.id !== result.approval.id),
      );
      invalidateAgentApprovalDecisionCaches(qc, organizationId);
    },
  });
}

export const useOrganizationAgentSettings = (organizationId: string | null) =>
  useQuery({
    queryKey: qk.organizationAgentSettings(organizationId),
    queryFn: () => api.getOrganizationAgentSettings(organizationId ?? ''),
    enabled: !!organizationId,
  });

export function useUpdateOrganizationAgentSettings(organizationId: string | null) {
  const qc = useQueryClient();
  return useMutation({
    mutationKey: ['updateOrganizationAgentSettings', organizationId],
    mutationFn: (input: Omit<UpdateOrganizationAgentSettingsInput, 'organizationId'>) =>
      api.updateOrganizationAgentSettings({
        ...input,
        organizationId: organizationId ?? '',
      }),
    onSuccess: (response) => {
      qc.setQueryData<OrganizationAgentSettingsResponse>(
        qk.organizationAgentSettings(organizationId),
        (current) =>
          current
            ? {
                ...current,
                ...response,
                organizationId: current.organizationId || response.organizationId,
                organizationName: current.organizationName || response.organizationName,
                modelConfigs:
                  response.modelConfigs.length > 0 ? response.modelConfigs : current.modelConfigs,
                access: current.access,
                configIssues:
                  response.configIssues.length > 0 ? response.configIssues : current.configIssues,
                runtimeSummary: current.runtimeSummary,
                serviceStatus:
                  response.serviceStatus.length > 0
                    ? response.serviceStatus
                    : current.serviceStatus,
                recentRuns: current.recentRuns,
                updatedAt: response.updatedAt ?? current.updatedAt,
              }
            : response,
      );
      qc.invalidateQueries({ queryKey: qk.organizationAgentSettings(organizationId) });
      qc.invalidateQueries({ queryKey: qk.adminAgentControl() });
      qc.invalidateQueries({ queryKey: [server(), 'project-ai-agents'] });
    },
  });
}

export const useProjectAgentSettings = (projectId: string | null) =>
  useQuery({
    queryKey: qk.projectAgentSettings(projectId),
    queryFn: () => api.getProjectAgentSettings(projectId ?? ''),
    enabled: !!projectId,
  });

export function useUpdateProjectAgentSettings(projectId: string | null) {
  const qc = useQueryClient();
  return useMutation({
    mutationKey: ['updateProjectAgentSettings', projectId],
    mutationFn: (input: UpdateProjectAgentSettingsInput) =>
      api.updateProjectAgentSettings(projectId ?? '', input),
    onSuccess: (projectSettings) => {
      qc.setQueryData<ProjectAgentSettingsResponse>(
        qk.projectAgentSettings(projectId),
        (current) =>
          current
            ? {
                ...current,
                projectSettings,
              }
            : current,
      );
      qc.invalidateQueries({ queryKey: qk.projectAgentSettings(projectId) });
      qc.invalidateQueries({ queryKey: qk.project(projectId ?? '') });
      qc.invalidateQueries({ queryKey: [server(), 'project-ai-agents'] });
    },
  });
}

export const useWorkspaceCommunicationsSettings = (organizationId: string | null) =>
  useQuery({
    queryKey: qk.workspaceCommunications(organizationId),
    queryFn: () => api.getWorkspaceCommunicationsSettings(organizationId ?? ''),
    enabled: !!organizationId,
  });

export function useUpdateWorkspaceCommunicationsSettings(organizationId: string | null) {
  const qc = useQueryClient();
  return useMutation({
    mutationKey: ['updateWorkspaceCommunicationsSettings', organizationId],
    mutationFn: (input: Omit<UpdateWorkspaceCommunicationsSettingsInput, 'organizationId'>) =>
      api.updateWorkspaceCommunicationsSettings({
        ...input,
        organizationId: organizationId ?? '',
      }),
    onSuccess: (response) => {
      qc.setQueryData<WorkspaceCommunicationsSettingsResponse>(
        qk.workspaceCommunications(organizationId),
        (current) =>
          current
            ? {
                ...current,
                ...response,
                organizationId: current.organizationId || response.organizationId,
                organizationName: current.organizationName || response.organizationName,
                serviceStatus: response.serviceStatus ?? current.serviceStatus,
              }
            : response,
      );
      qc.invalidateQueries({ queryKey: qk.workspaceCommunications(organizationId) });
      invalidateProjectChatBootstrapCaches(qc);
    },
  });
}

export const useWorkspaceIntegrations = (organizationId: string | null) =>
  useQuery<WorkspaceIntegrationStatus[]>({
    queryKey: qk.workspaceIntegrations(organizationId),
    queryFn: () => api.listWorkspaceIntegrationStatuses(organizationId ?? ''),
    enabled: !!organizationId,
  });

export function useDisconnectWorkspaceIntegration(organizationId: string | null) {
  const qc = useQueryClient();
  return useMutation({
    mutationKey: ['disconnectWorkspaceIntegration', organizationId],
    mutationFn: (provider: WorkspaceIntegrationProvider) =>
      api.disconnectWorkspaceIntegration(organizationId ?? '', provider),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: qk.workspaceIntegrations(organizationId) });
    },
  });
}

export function useConnectWorkspaceIntegration(organizationId: string | null) {
  return useMutation({
    mutationKey: ['connectWorkspaceIntegration', organizationId],
    mutationFn: (provider: WorkspaceIntegrationProvider) =>
      api.requestWorkspaceIntegrationAuthorization(organizationId ?? '', provider),
  });
}

export const useAdminStats = (enabled: boolean) =>
  useQuery({ queryKey: qk.adminStats(), queryFn: api.getAdminStats, enabled });

export const useAdminOrganizations = (enabled: boolean, limit = 10) =>
  useQuery({
    queryKey: qk.adminOrganizations(limit),
    queryFn: () => api.listAdminOrganizations({ limit }),
    enabled,
  });

export function useUpdateAdminOrganization(limit = 10) {
  const qc = useQueryClient();
  return useMutation({
    mutationKey: ['adminOrganization'],
    mutationFn: (input: api.UpdateAdminOrganizationInput) => api.updateAdminOrganization(input),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: qk.adminOrganizations(limit) });
      qc.invalidateQueries({ queryKey: qk.adminStats() });
      qc.invalidateQueries({ queryKey: qk.systemAuditLogs() });
    },
  });
}

export const useAdminUsers = (enabled: boolean, limit = 10) =>
  useQuery({
    queryKey: qk.adminUsers(limit),
    queryFn: () => api.listAdminUsers({ limit }),
    enabled,
  });

export function useUpdateAdminUser(limit = 10) {
  const qc = useQueryClient();
  return useMutation({
    mutationKey: ['adminUser'],
    mutationFn: (input: api.UpdateAdminUserInput) => api.updateAdminUser(input),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: qk.adminUsers(limit) });
      qc.invalidateQueries({ queryKey: qk.adminStats() });
      qc.invalidateQueries({ queryKey: qk.systemAuditLogs() });
    },
  });
}

export const useAdminSmtpConfig = (enabled: boolean) =>
  useQuery({
    queryKey: qk.adminSmtpConfig(),
    queryFn: api.getAdminSmtpConfig,
    enabled,
  });

export function useUpdateAdminSmtpConfig() {
  const qc = useQueryClient();
  return useMutation({
    mutationKey: ['adminSmtpConfig'],
    mutationFn: (input: api.UpdateAdminSmtpConfigInput) => api.updateAdminSmtpConfig(input),
    onSuccess: (smtp) => {
      qc.setQueryData(qk.adminSmtpConfig(), smtp);
      qc.invalidateQueries({ queryKey: qk.systemAuditLogs() });
    },
  });
}

export function useTestAdminSmtpConfig() {
  const qc = useQueryClient();
  return useMutation({
    mutationKey: ['adminSmtpConfigTest'],
    mutationFn: (input: api.TestAdminSmtpConfigInput) => api.testAdminSmtpConfig(input),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: qk.systemAuditLogs() });
    },
  });
}

export const useAdminStorageConfig = (enabled: boolean) =>
  useQuery({
    queryKey: qk.adminStorageConfig(),
    queryFn: api.getAdminStorageConfig,
    enabled,
  });

export function useUpdateAdminStorageConfig() {
  const qc = useQueryClient();
  return useMutation({
    mutationKey: ['adminStorageConfig'],
    mutationFn: (input: api.UpdateAdminStorageConfigInput) => api.updateAdminStorageConfig(input),
    onSuccess: (storage) => {
      qc.setQueryData(qk.adminStorageConfig(), storage);
      qc.invalidateQueries({ queryKey: qk.systemAuditLogs() });
    },
  });
}

export const useAdminLivekitConfig = (enabled: boolean) =>
  useQuery({
    queryKey: qk.adminLivekitConfig(),
    queryFn: api.getAdminLivekitConfig,
    enabled,
  });

export function useUpdateAdminLivekitConfig() {
  const qc = useQueryClient();
  return useMutation({
    mutationKey: ['adminLivekitConfig'],
    mutationFn: (input: api.UpdateAdminLivekitConfigInput) => api.updateAdminLivekitConfig(input),
    onSuccess: (livekit) => {
      qc.setQueryData(qk.adminLivekitConfig(), livekit);
      qc.invalidateQueries({ queryKey: qk.adminRealtimeHealth() });
      qc.invalidateQueries({ queryKey: qk.systemAuditLogs() });
    },
  });
}

export function useTestAdminLivekitConfig() {
  const qc = useQueryClient();
  return useMutation({
    mutationKey: ['adminLivekitConfigTest'],
    mutationFn: api.testAdminLivekitConfig,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: qk.systemAuditLogs() });
    },
  });
}

export const useAdminAgentControl = (enabled: boolean) =>
  useQuery({
    queryKey: qk.adminAgentControl(),
    queryFn: api.getAdminAgentControl,
    enabled,
  });

export function useUpdateAdminAgentControl() {
  const qc = useQueryClient();
  return useMutation({
    mutationKey: ['adminAgentControl'],
    mutationFn: (input: api.UpdateAdminAgentControlInput) => api.updateAdminAgentControl(input),
    onSuccess: (settings) => {
      qc.setQueryData<AdminAgentControlResponse>(qk.adminAgentControl(), (current) =>
        current ? { ...current, settings } : current,
      );
      qc.invalidateQueries({ queryKey: qk.adminAgentControl() });
      qc.invalidateQueries({ queryKey: [server(), 'admin', 'aiUsage'] });
      qc.invalidateQueries({ queryKey: qk.systemAuditLogs() });
    },
  });
}

export const useRegistrationPolicy = (enabled: boolean) =>
  useQuery({
    queryKey: qk.adminRegistration(),
    queryFn: api.getRegistrationPolicy,
    enabled,
  });

export function useUpdateRegistrationPolicy() {
  const qc = useQueryClient();
  return useMutation({
    mutationKey: ['adminRegistration'],
    mutationFn: (mode: RegistrationPolicy['mode']) => api.updateRegistrationPolicy(mode),
    onSuccess: (policy) => {
      qc.setQueryData(qk.adminRegistration(), policy);
      qc.invalidateQueries({ queryKey: qk.systemAuditLogs() });
    },
  });
}

export const useAdminVersionStatus = (enabled: boolean) =>
  useQuery({
    queryKey: qk.adminVersion(),
    queryFn: () => api.getAdminVersionStatus(),
    enabled,
  });

export function useRefreshAdminVersionStatus() {
  const qc = useQueryClient();
  return useMutation({
    mutationKey: ['adminVersionRefresh'],
    mutationFn: () => api.getAdminVersionStatus({ refresh: true }),
    onSuccess: (status) => {
      qc.setQueryData(qk.adminVersion(), status);
    },
  });
}

export const useAdminAiUsage = (enabled: boolean, days = 7) =>
  useQuery({
    queryKey: qk.adminAiUsage(days),
    queryFn: () => api.getAdminAiUsage({ days }),
    enabled,
  });

export function useUpdateAdminAiKillSwitch() {
  const qc = useQueryClient();
  return useMutation({
    mutationKey: ['adminAiKillSwitch'],
    mutationFn: (input: api.UpdateAdminAiKillSwitchInput) => api.updateAdminAiKillSwitch(input),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [server(), 'admin', 'aiUsage'] });
      qc.invalidateQueries({ queryKey: qk.systemAuditLogs() });
    },
  });
}

export function useResetAdminAiUsageCounters() {
  const qc = useQueryClient();
  return useMutation({
    mutationKey: ['adminAiUsageResetCounters'],
    mutationFn: (input: api.ResetAdminAiUsageCountersInput) => api.resetAdminAiUsageCounters(input),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [server(), 'admin', 'aiUsage'] });
    },
  });
}

export const useAdminFeatureFlags = (enabled: boolean) =>
  useQuery({
    queryKey: qk.adminFeatureFlags(),
    queryFn: api.listAdminFeatureFlags,
    enabled,
  });

export function useUpdateAdminFeatureFlag() {
  const qc = useQueryClient();
  return useMutation({
    mutationKey: ['adminFeatureFlag'],
    mutationFn: (input: api.UpdateAdminFeatureFlagInput) => api.updateAdminFeatureFlag(input),
    onSuccess: (flag) => {
      qc.setQueryData<AdminFeatureFlag[]>(qk.adminFeatureFlags(), (current) =>
        current?.map((item) => (item.id === flag.id ? flag : item)),
      );
      qc.invalidateQueries({ queryKey: qk.adminFeatureFlags() });
      qc.invalidateQueries({ queryKey: qk.systemAuditLogs() });
    },
  });
}

export const useAdminRealtimeHealth = (enabled: boolean) =>
  useQuery({
    queryKey: qk.adminRealtimeHealth(),
    queryFn: api.getAdminRealtimeHealth,
    enabled,
  });

export const useSystemAuditLogs = (enabled: boolean) =>
  useQuery({
    queryKey: qk.systemAuditLogs(),
    queryFn: () => api.listSystemAuditLogs({ limit: 25 }),
    enabled,
  });

export function useInstantiateTemplate() {
  const qc = useQueryClient();
  return useMutation({
    mutationKey: ['instantiateTemplate'],
    mutationFn: ({
      templateId,
      overrides,
    }: {
      templateId: string;
      overrides?: UseTemplateOverrides;
    }) => api.instantiateTemplate(templateId, overrides),
    onSuccess: (result) => {
      qc.invalidateQueries({ queryKey: qk.templates() });
      if (result.kind === 'project') {
        qc.invalidateQueries({ queryKey: qk.projects() });
      }
      if (result.kind === 'issue') {
        qc.invalidateQueries({ queryKey: [server(), 'issues'] });
      }
      if (result.kind === 'doc') {
        qc.invalidateQueries({ queryKey: [server(), 'docs'] });
      }
    },
  });
}

function invalidateLabelCaches(qc: QueryClient, organizationId: string | null) {
  qc.invalidateQueries({ queryKey: [server(), 'labels', organizationId ?? 'none'] });
  qc.invalidateQueries({ queryKey: [server(), 'issues'] });
  qc.invalidateQueries({ queryKey: [server(), 'issue'] });
}

function invalidateOrganizationCaches(qc: QueryClient, organizationId: string | null) {
  qc.invalidateQueries({ queryKey: qk.organizations() });
  qc.invalidateQueries({ queryKey: qk.organization(organizationId) });
  qc.invalidateQueries({ queryKey: qk.projects() });
}

function invalidateTeamspaceCaches(qc: QueryClient, organizationId: string | null) {
  qc.invalidateQueries({ queryKey: qk.teamspaces(organizationId) });
  qc.invalidateQueries({ queryKey: qk.organization(organizationId) });
  qc.invalidateQueries({ queryKey: qk.projects() });
}

function invalidateTeamspaceMemberCaches(
  qc: QueryClient,
  organizationId: string | null,
  teamspaceId: string | null,
) {
  qc.invalidateQueries({ queryKey: qk.teamspaceMembers(organizationId, teamspaceId) });
  invalidateTeamspaceCaches(qc, organizationId);
}

function invalidateProjectChatBootstrapCaches(qc: QueryClient) {
  const currentServer = server();
  qc.invalidateQueries({
    predicate: ({ queryKey }) =>
      queryKey[0] === currentServer &&
      queryKey[1] === 'project' &&
      queryKey[3] === 'chat' &&
      queryKey[4] === 'bootstrap',
  });
}

export const useOrganizations = () =>
  useQuery({ queryKey: qk.organizations(), queryFn: () => api.listOrganizations() });

export const useOrganization = (organizationId: string | null) =>
  useQuery({
    queryKey: qk.organization(organizationId),
    queryFn: () => api.getOrganization(organizationId ?? ''),
    enabled: !!organizationId,
  });

export const useSsoConfig = (organizationId: string | null) =>
  useQuery<SsoConfigResponse>({
    queryKey: qk.ssoConfig(organizationId),
    queryFn: () => api.getSsoConfig(organizationId ?? ''),
    enabled: !!organizationId,
  });

export function useUpsertSsoConfig(organizationId: string | null) {
  const qc = useQueryClient();
  return useMutation<{ ok?: boolean }, Error, UpsertSsoConfigInput>({
    mutationKey: ['upsertSsoConfig', organizationId],
    mutationFn: (input) => api.upsertSsoConfig(input),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: qk.ssoConfig(organizationId) });
    },
  });
}

export function useDeleteSsoConfig(organizationId: string | null) {
  const qc = useQueryClient();
  return useMutation<{ ok?: boolean }, Error, void>({
    mutationKey: ['deleteSsoConfig', organizationId],
    mutationFn: () => api.deleteSsoConfig(organizationId ?? ''),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: qk.ssoConfig(organizationId) });
    },
  });
}

export const useScimTokens = (organizationId: string | null) =>
  useQuery<ScimTokensResponse>({
    queryKey: qk.scimTokens(organizationId),
    queryFn: () => api.listScimTokens(organizationId ?? ''),
    enabled: !!organizationId,
  });

export function useCreateScimToken(organizationId: string | null) {
  const qc = useQueryClient();
  return useMutation<CreatedScimToken, Error, CreateScimTokenInput>({
    mutationKey: ['createScimToken', organizationId],
    mutationFn: (input) => api.createScimToken(input),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: qk.scimTokens(organizationId) });
    },
  });
}

export function useRevokeScimToken(organizationId: string | null) {
  const qc = useQueryClient();
  return useMutation<{ ok?: boolean }, Error, string>({
    mutationKey: ['revokeScimToken', organizationId],
    mutationFn: (tokenId) => api.revokeScimToken(tokenId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: qk.scimTokens(organizationId) });
    },
  });
}

export function useUpdateOrganization(organizationId: string | null) {
  const qc = useQueryClient();
  return useMutation({
    mutationKey: ['updateOrganization', organizationId],
    mutationFn: (input: Omit<UpdateOrganizationInput, 'organizationId'>) =>
      api.updateOrganization({ ...input, organizationId: organizationId ?? '' }),
    onSuccess: (organization) => {
      qc.setQueryData<Organization>(qk.organization(organization.id), organization);
      qc.setQueryData<OrganizationsResponse | undefined>(qk.organizations(), (current) =>
        current
          ? {
              ...current,
              organizations: current.organizations.map((item) =>
                item.id === organization.id ? { ...item, ...organization } : item,
              ),
            }
          : current,
      );
      invalidateOrganizationCaches(qc, organizationId);
    },
  });
}

export function useDeleteOrganization(organizationId: string | null) {
  const qc = useQueryClient();
  return useMutation({
    mutationKey: ['deleteOrganization', organizationId],
    mutationFn: () => api.deleteOrganization(organizationId ?? ''),
    onSuccess: () => {
      qc.setQueryData<OrganizationsResponse | undefined>(qk.organizations(), (current) =>
        current
          ? {
              ...current,
              organizations: current.organizations.filter((item) => item.id !== organizationId),
            }
          : current,
      );
      invalidateOrganizationCaches(qc, organizationId);
    },
  });
}

export const useTeamspaces = (organizationId: string | null) =>
  useQuery({
    queryKey: qk.teamspaces(organizationId),
    queryFn: () => api.listTeamspaces(organizationId ?? ''),
    enabled: !!organizationId,
  });

export function useCreateTeamspace(organizationId: string | null) {
  const qc = useQueryClient();
  return useMutation({
    mutationKey: ['createTeamspace', organizationId],
    mutationFn: (input: CreateTeamspaceInput) => api.createTeamspace(organizationId ?? '', input),
    onSuccess: (teamspace) => {
      qc.setQueryData<Teamspace[]>(qk.teamspaces(organizationId), (current) => [
        ...(current ?? []),
        teamspace,
      ]);
      invalidateTeamspaceCaches(qc, organizationId);
    },
  });
}

export function useUpdateTeamspace(organizationId: string | null) {
  const qc = useQueryClient();
  return useMutation({
    mutationKey: ['updateTeamspace', organizationId],
    mutationFn: (input: UpdateTeamspaceInput) => api.updateTeamspace(organizationId ?? '', input),
    onSuccess: (teamspace) => {
      qc.setQueryData<Teamspace[]>(qk.teamspaces(organizationId), (current) =>
        current?.map((item) => (item.id === teamspace.id ? { ...item, ...teamspace } : item)),
      );
      invalidateTeamspaceCaches(qc, organizationId);
    },
  });
}

export function useDeleteTeamspace(organizationId: string | null) {
  const qc = useQueryClient();
  return useMutation({
    mutationKey: ['deleteTeamspace', organizationId],
    mutationFn: (teamspaceId: string) => api.deleteTeamspace(organizationId ?? '', teamspaceId),
    onSuccess: (_response, teamspaceId) => {
      qc.setQueryData<Teamspace[]>(qk.teamspaces(organizationId), (current) =>
        current?.filter((item) => item.id !== teamspaceId),
      );
      invalidateTeamspaceCaches(qc, organizationId);
    },
  });
}

export const useTeamspaceMembers = (organizationId: string | null, teamspaceId: string | null) =>
  useQuery({
    queryKey: qk.teamspaceMembers(organizationId, teamspaceId),
    queryFn: () => api.listTeamspaceMembers(organizationId ?? '', teamspaceId ?? ''),
    enabled: !!organizationId && !!teamspaceId,
  });

export function useAddTeamspaceMember(organizationId: string | null, teamspaceId: string | null) {
  const qc = useQueryClient();
  return useMutation({
    mutationKey: ['addTeamspaceMember', organizationId, teamspaceId],
    mutationFn: (input: AddTeamspaceMemberInput) =>
      api.addTeamspaceMember(organizationId ?? '', teamspaceId ?? '', input),
    onSuccess: (member) => {
      qc.setQueryData<TeamspaceMembersResponse | undefined>(
        qk.teamspaceMembers(organizationId, teamspaceId),
        (current) =>
          current
            ? {
                ...current,
                members: [...current.members.filter((item) => item.id !== member.id), member],
              }
            : current,
      );
      invalidateTeamspaceMemberCaches(qc, organizationId, teamspaceId);
    },
  });
}

export function useUpdateTeamspaceMember(
  organizationId: string | null,
  teamspaceId: string | null,
) {
  const qc = useQueryClient();
  return useMutation({
    mutationKey: ['updateTeamspaceMember', organizationId, teamspaceId],
    mutationFn: (input: UpdateTeamspaceMemberInput) =>
      api.updateTeamspaceMember(organizationId ?? '', teamspaceId ?? '', input),
    onSuccess: (member) => {
      qc.setQueryData<TeamspaceMembersResponse | undefined>(
        qk.teamspaceMembers(organizationId, teamspaceId),
        (current) =>
          current
            ? {
                ...current,
                members: current.members.map((item) => (item.id === member.id ? member : item)),
              }
            : current,
      );
      invalidateTeamspaceMemberCaches(qc, organizationId, teamspaceId);
    },
  });
}

export function useRemoveTeamspaceMember(
  organizationId: string | null,
  teamspaceId: string | null,
) {
  const qc = useQueryClient();
  return useMutation({
    mutationKey: ['removeTeamspaceMember', organizationId, teamspaceId],
    mutationFn: (memberId: string) =>
      api.removeTeamspaceMember(organizationId ?? '', teamspaceId ?? '', memberId),
    onSuccess: (_response, memberId) => {
      qc.setQueryData<TeamspaceMembersResponse | undefined>(
        qk.teamspaceMembers(organizationId, teamspaceId),
        (current) =>
          current
            ? {
                ...current,
                members: current.members.filter((item) => item.id !== memberId),
              }
            : current,
      );
      invalidateTeamspaceMemberCaches(qc, organizationId, teamspaceId);
    },
  });
}

export const useDocumentSpaces = (params: DocumentScopeParams = {}) =>
  useQuery({ queryKey: qk.documentSpaces(params), queryFn: () => api.listDocumentSpaces(params) });

export const useDocumentPages = (spaceId?: string | null, params: DocumentScopeParams = {}) =>
  useQuery({
    queryKey: qk.documentPages(spaceId, params),
    queryFn: () => api.listDocumentPages(spaceId, params),
  });

export const useDocumentPage = (pageId: string | null) =>
  useQuery({
    queryKey: qk.documentPage(pageId),
    queryFn: () => api.getDocumentPage(pageId ?? ''),
    enabled: !!pageId,
  });

export const useDocumentTree = (pageId: string | null) =>
  useQuery<DocumentTreeResponse>({
    queryKey: qk.documentTree(pageId),
    queryFn: () => api.getDocumentTree(pageId ?? ''),
    enabled: !!pageId,
  });

export const useDocumentRevisions = (pageId: string | null) =>
  useQuery<DocumentRevision[]>({
    queryKey: qk.documentRevisions(pageId),
    queryFn: () => api.listDocumentRevisions(pageId ?? ''),
    enabled: !!pageId,
  });

export const usePublicDocumentPage = (token: string | null) =>
  useQuery<PublicDocumentPage>({
    queryKey: qk.publicDocumentPage(token),
    queryFn: () => api.getPublicDocumentPage(token ?? ''),
    enabled: !!token,
  });

export const useDocumentAttachments = (pageId: string | null) =>
  useQuery({
    queryKey: qk.documentAttachments(pageId),
    queryFn: () => api.listDocumentAttachments(pageId ?? ''),
    enabled: !!pageId,
  });

export const useSearchDocumentPages = (
  query: string,
  params: { organizationId?: string | null; projectId?: string | null } = {},
) =>
  useQuery({
    queryKey: qk.documentSearch(query, params.organizationId, params.projectId),
    queryFn: () => api.searchDocumentPages(query.trim(), params),
    enabled: query.trim().length >= 2,
  });

export function useCreateDocumentPage() {
  const qc = useQueryClient();
  return useMutation({
    mutationKey: ['createDocumentPage'],
    mutationFn: (input: CreateDocumentPageInput) => api.createDocumentPage(input),
    onSuccess: (page) => {
      qc.setQueryData(qk.documentPage(page.id), page);
      qc.invalidateQueries({ queryKey: [server(), 'docs'] });
    },
  });
}

export function useUpdateDocumentPage(pageId: string | null) {
  const qc = useQueryClient();
  return useMutation({
    mutationKey: ['updateDocumentPage', pageId],
    mutationFn: (input: UpdateDocumentPageInput) => api.updateDocumentPage(pageId ?? '', input),
    onSuccess: (page) => {
      qc.setQueryData(qk.documentPage(page.id), page);
      qc.invalidateQueries({ queryKey: [server(), 'docs'] });
    },
  });
}

export function useUpdateDocumentShare(pageId: string | null) {
  const qc = useQueryClient();
  return useMutation({
    mutationKey: ['updateDocumentShare', pageId],
    mutationFn: (input: UpdateDocumentShareInput) => api.updateDocumentShare(pageId ?? '', input),
    onSuccess: (page) => {
      qc.setQueryData(qk.documentPage(page.id), page);
      qc.invalidateQueries({ queryKey: [server(), 'docs'] });
    },
  });
}

export function useRestoreDocumentRevision(pageId: string | null) {
  const qc = useQueryClient();
  return useMutation({
    mutationKey: ['restoreDocumentRevision', pageId],
    mutationFn: (input: RestoreDocumentRevisionInput) =>
      api.restoreDocumentRevision(pageId ?? '', input),
    onSuccess: (page) => {
      qc.setQueryData(qk.documentPage(page.id), page);
      qc.invalidateQueries({ queryKey: qk.documentRevisions(page.id) });
      qc.invalidateQueries({ queryKey: [server(), 'docs'] });
    },
  });
}

export function useUploadDocumentAttachment(pageId?: string | null) {
  const qc = useQueryClient();
  return useMutation({
    mutationKey: ['uploadDocumentAttachment', pageId ?? 'dynamic'],
    mutationFn: (input: UploadDocumentAttachmentInput) =>
      api.uploadDocumentAttachment(pageId ?? '', input),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: qk.documentAttachments(pageId ?? null) });
      if (pageId) qc.invalidateQueries({ queryKey: qk.documentPage(pageId) });
      qc.invalidateQueries({ queryKey: [server(), 'docs'] });
    },
  });
}

export function useDeleteDocumentAttachment(pageId?: string | null) {
  const qc = useQueryClient();
  return useMutation({
    mutationKey: ['deleteDocumentAttachment', pageId ?? 'dynamic'],
    mutationFn: (attachmentId: string) => api.deleteDocumentAttachment(pageId ?? '', attachmentId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: qk.documentAttachments(pageId ?? null) });
      if (pageId) qc.invalidateQueries({ queryKey: qk.documentPage(pageId) });
      qc.invalidateQueries({ queryKey: [server(), 'docs'] });
    },
  });
}

export const useProjectMembers = (projectId: string | null) =>
  useQuery({
    queryKey: qk.projectMembers(projectId),
    queryFn: () => api.listProjectMembers(projectId ?? ''),
    enabled: !!projectId,
  });

export function useAddProjectMember(projectId: string | null, organizationId?: string | null) {
  const qc = useQueryClient();
  return useMutation({
    mutationKey: ['addProjectMember', projectId],
    mutationFn: (input: Omit<AddProjectMemberInput, 'projectId'>) =>
      api.addProjectMember({ projectId: projectId ?? '', ...input }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: qk.projectMembers(projectId) });
      if (projectId) qc.invalidateQueries({ queryKey: qk.project(projectId) });
      qc.invalidateQueries({ queryKey: qk.projects() });
      if (organizationId)
        qc.invalidateQueries({ queryKey: qk.organizationMembers(organizationId) });
    },
  });
}

export function useUpdateProjectMember(projectId: string | null, organizationId?: string | null) {
  const qc = useQueryClient();
  return useMutation({
    mutationKey: ['updateProjectMember', projectId],
    mutationFn: (input: Omit<UpdateProjectMemberInput, 'projectId'>) =>
      api.updateProjectMember({ projectId: projectId ?? '', ...input }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: qk.projectMembers(projectId) });
      if (projectId) qc.invalidateQueries({ queryKey: qk.project(projectId) });
      qc.invalidateQueries({ queryKey: qk.projects() });
      if (organizationId)
        qc.invalidateQueries({ queryKey: qk.organizationMembers(organizationId) });
    },
  });
}

export function useRemoveProjectMember(projectId: string | null, organizationId?: string | null) {
  const qc = useQueryClient();
  return useMutation({
    mutationKey: ['removeProjectMember', projectId],
    mutationFn: (memberId: string) => api.removeProjectMember(projectId ?? '', memberId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: qk.projectMembers(projectId) });
      if (projectId) qc.invalidateQueries({ queryKey: qk.project(projectId) });
      qc.invalidateQueries({ queryKey: qk.projects() });
      if (organizationId)
        qc.invalidateQueries({ queryKey: qk.organizationMembers(organizationId) });
    },
  });
}

export const useProjectInviteLinks = (projectId: string | null) =>
  useQuery({
    queryKey: qk.projectInviteLinks(projectId),
    queryFn: () => api.listProjectInviteLinks(projectId ?? ''),
    enabled: !!projectId,
  });

export function useCreateProjectInviteLink(projectId: string | null) {
  const qc = useQueryClient();
  return useMutation({
    mutationKey: ['createProjectInviteLink', projectId],
    mutationFn: (input: Omit<CreateProjectInviteLinkInput, 'projectId'>) =>
      api.createProjectInviteLink({ projectId: projectId ?? '', ...input }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: qk.projectInviteLinks(projectId) });
    },
  });
}

export function useRevokeProjectInviteLink(projectId: string | null) {
  const qc = useQueryClient();
  return useMutation({
    mutationKey: ['revokeProjectInviteLink', projectId],
    mutationFn: (linkId: string) => api.revokeProjectInviteLink(projectId ?? '', linkId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: qk.projectInviteLinks(projectId) });
    },
  });
}

export const usePermissionSchemes = (organizationId: string | null) =>
  useQuery({
    queryKey: qk.permissionSchemes(organizationId),
    queryFn: () => api.listPermissionSchemes(organizationId ?? ''),
    enabled: !!organizationId,
  });

export const useProjectPermissionScheme = (projectId: string | null) =>
  useQuery({
    queryKey: qk.projectPermissionScheme(projectId),
    queryFn: () => api.getProjectPermissionScheme(projectId ?? ''),
    enabled: !!projectId,
  });

export function useCreatePermissionScheme(
  organizationId: string | null,
  projectId?: string | null,
) {
  const qc = useQueryClient();
  return useMutation({
    mutationKey: ['createPermissionScheme', organizationId, projectId ?? null],
    mutationFn: (input: CreatePermissionSchemeInput) => api.createPermissionScheme(input),
    onSuccess: (scheme) => {
      qc.setQueryData<PermissionScheme[]>(qk.permissionSchemes(organizationId), (current) => [
        scheme,
        ...(current ?? []),
      ]);
      qc.invalidateQueries({ queryKey: qk.permissionSchemes(organizationId) });
      if (projectId) qc.invalidateQueries({ queryKey: qk.projectPermissionScheme(projectId) });
    },
  });
}

export function useUpdatePermissionScheme(
  organizationId: string | null,
  projectId?: string | null,
) {
  const qc = useQueryClient();
  return useMutation({
    mutationKey: ['updatePermissionScheme', organizationId, projectId ?? null],
    mutationFn: (input: UpdatePermissionSchemeInput) => api.updatePermissionScheme(input),
    onSuccess: (scheme) => {
      qc.setQueryData<PermissionScheme[]>(qk.permissionSchemes(organizationId), (current) =>
        current?.map((item) => (item.id === scheme.id ? scheme : item)),
      );
      qc.invalidateQueries({ queryKey: qk.permissionSchemes(organizationId) });
      if (projectId) qc.invalidateQueries({ queryKey: qk.projectPermissionScheme(projectId) });
    },
  });
}

export function useDeletePermissionScheme(
  organizationId: string | null,
  projectId?: string | null,
) {
  const qc = useQueryClient();
  return useMutation({
    mutationKey: ['deletePermissionScheme', organizationId, projectId ?? null],
    mutationFn: (schemeId: string) => api.deletePermissionScheme(schemeId),
    onSuccess: (_result, schemeId) => {
      qc.setQueryData<PermissionScheme[]>(qk.permissionSchemes(organizationId), (current) =>
        current?.filter((scheme) => scheme.id !== schemeId),
      );
      qc.invalidateQueries({ queryKey: qk.permissionSchemes(organizationId) });
      if (projectId) qc.invalidateQueries({ queryKey: qk.projectPermissionScheme(projectId) });
    },
  });
}

export function useAssignProjectPermissionScheme(
  projectId: string | null,
  organizationId: string | null,
) {
  const qc = useQueryClient();
  return useMutation({
    mutationKey: ['assignProjectPermissionScheme', projectId],
    mutationFn: (schemeId: string | null) =>
      api.assignProjectPermissionScheme(projectId ?? '', schemeId),
    onSuccess: (state) => {
      qc.setQueryData(qk.projectPermissionScheme(projectId), state);
      qc.invalidateQueries({ queryKey: qk.projectPermissionScheme(projectId) });
      qc.invalidateQueries({ queryKey: qk.permissionSchemes(organizationId) });
      qc.invalidateQueries({ queryKey: qk.projectMembers(projectId) });
    },
  });
}

export const useSecuritySchemes = (organizationId: string | null) =>
  useQuery({
    queryKey: qk.securitySchemes(organizationId),
    queryFn: () => api.listSecuritySchemes(organizationId ?? ''),
    enabled: !!organizationId,
  });

export const useProjectSecurityScheme = (projectId: string | null) =>
  useQuery({
    queryKey: qk.projectSecurityScheme(projectId),
    queryFn: () => api.getProjectSecurityScheme(projectId ?? ''),
    enabled: !!projectId,
  });

export function useCreateSecurityScheme(organizationId: string | null, projectId?: string | null) {
  const qc = useQueryClient();
  return useMutation({
    mutationKey: ['createSecurityScheme', organizationId, projectId ?? null],
    mutationFn: (input: CreateSecuritySchemeInput) => api.createSecurityScheme(input),
    onSuccess: (scheme) => {
      qc.setQueryData<SecurityScheme[]>(qk.securitySchemes(organizationId), (current) => [
        scheme,
        ...(current ?? []),
      ]);
      qc.invalidateQueries({ queryKey: qk.securitySchemes(organizationId) });
      if (projectId) qc.invalidateQueries({ queryKey: qk.projectSecurityScheme(projectId) });
    },
  });
}

export function useUpdateSecurityScheme(organizationId: string | null, projectId?: string | null) {
  const qc = useQueryClient();
  return useMutation({
    mutationKey: ['updateSecurityScheme', organizationId, projectId ?? null],
    mutationFn: (input: UpdateSecuritySchemeInput) => api.updateSecurityScheme(input),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: qk.securitySchemes(organizationId) });
      if (projectId) qc.invalidateQueries({ queryKey: qk.projectSecurityScheme(projectId) });
    },
  });
}

export function useDeleteSecurityScheme(organizationId: string | null, projectId?: string | null) {
  const qc = useQueryClient();
  return useMutation({
    mutationKey: ['deleteSecurityScheme', organizationId, projectId ?? null],
    mutationFn: (schemeId: string) => api.deleteSecurityScheme(schemeId),
    onSuccess: (_result, schemeId) => {
      qc.setQueryData<SecurityScheme[]>(qk.securitySchemes(organizationId), (current) =>
        current?.filter((scheme) => scheme.id !== schemeId),
      );
      qc.invalidateQueries({ queryKey: qk.securitySchemes(organizationId) });
      if (projectId) qc.invalidateQueries({ queryKey: qk.projectSecurityScheme(projectId) });
    },
  });
}

export function useAssignProjectSecurityScheme(
  projectId: string | null,
  organizationId: string | null,
) {
  const qc = useQueryClient();
  return useMutation({
    mutationKey: ['assignProjectSecurityScheme', projectId],
    mutationFn: (schemeId: string | null) =>
      api.assignProjectSecurityScheme(projectId ?? '', schemeId),
    onSuccess: (state) => {
      qc.setQueryData(qk.projectSecurityScheme(projectId), state);
      qc.invalidateQueries({ queryKey: qk.projectSecurityScheme(projectId) });
      qc.invalidateQueries({ queryKey: qk.securitySchemes(organizationId) });
    },
  });
}

export function useCreateSecurityLevel(organizationId: string | null) {
  const qc = useQueryClient();
  return useMutation({
    mutationKey: ['createSecurityLevel', organizationId],
    mutationFn: (input: CreateSecurityLevelInput) => api.createSecurityLevel(input),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: qk.securitySchemes(organizationId) });
    },
  });
}

export function useUpdateSecurityLevel(organizationId: string | null) {
  const qc = useQueryClient();
  return useMutation({
    mutationKey: ['updateSecurityLevel', organizationId],
    mutationFn: (input: UpdateSecurityLevelInput) => api.updateSecurityLevel(input),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: qk.securitySchemes(organizationId) });
    },
  });
}

export function useDeleteSecurityLevel(organizationId: string | null) {
  const qc = useQueryClient();
  return useMutation({
    mutationKey: ['deleteSecurityLevel', organizationId],
    mutationFn: ({ schemeId, levelId }: { schemeId: string; levelId: string }) =>
      api.deleteSecurityLevel(schemeId, levelId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: qk.securitySchemes(organizationId) });
    },
  });
}

export const useAutomationRules = (organizationId: string | null, projectId?: string | null) =>
  useQuery({
    queryKey: qk.automationRules(organizationId, projectId),
    queryFn: () =>
      api.listAutomationRules({
        organizationId: organizationId ?? '',
        projectId: projectId ?? null,
      }),
    enabled: !!organizationId,
  });

export const useAutomationExecutions = (ruleId: string | null) =>
  useQuery({
    queryKey: qk.automationExecutions(ruleId),
    queryFn: () => api.listAutomationExecutions(ruleId ?? ''),
    enabled: !!ruleId,
  });

export function useCreateAutomationRule(organizationId: string | null, projectId?: string | null) {
  const qc = useQueryClient();
  return useMutation({
    mutationKey: ['createAutomationRule', organizationId, projectId ?? null],
    mutationFn: (input: CreateAutomationRuleInput) => api.createAutomationRule(input),
    onSuccess: (rule) => {
      qc.setQueryData<AutomationRule[]>(
        qk.automationRules(organizationId, projectId),
        (current) => [rule, ...(current ?? [])],
      );
      qc.invalidateQueries({ queryKey: qk.automationRules(organizationId, projectId) });
    },
  });
}

export function useUpdateAutomationRule(organizationId: string | null, projectId?: string | null) {
  const qc = useQueryClient();
  return useMutation({
    mutationKey: ['updateAutomationRule', organizationId, projectId ?? null],
    mutationFn: (input: UpdateAutomationRuleInput) => api.updateAutomationRule(input),
    onSuccess: (rule) => {
      qc.setQueryData<AutomationRule[]>(qk.automationRules(organizationId, projectId), (current) =>
        current?.map((item) => (item.id === rule.id ? rule : item)),
      );
      qc.invalidateQueries({ queryKey: qk.automationRules(organizationId, projectId) });
      qc.invalidateQueries({ queryKey: qk.automationExecutions(rule.id) });
    },
  });
}

export function useDeleteAutomationRule(organizationId: string | null, projectId?: string | null) {
  const qc = useQueryClient();
  return useMutation({
    mutationKey: ['deleteAutomationRule', organizationId, projectId ?? null],
    mutationFn: (ruleId: string) => api.deleteAutomationRule(ruleId),
    onSuccess: (_result, ruleId) => {
      qc.setQueryData<AutomationRule[]>(qk.automationRules(organizationId, projectId), (current) =>
        current?.filter((rule) => rule.id !== ruleId),
      );
      qc.invalidateQueries({ queryKey: qk.automationRules(organizationId, projectId) });
      qc.removeQueries({ queryKey: qk.automationExecutions(ruleId) });
    },
  });
}

export const useIntakeForms = (projectId?: string | null) =>
  useQuery({
    queryKey: qk.intakeForms(projectId),
    queryFn: () => api.listIntakeForms(projectId),
  });

export const useIntakeForm = (formId: string | null) =>
  useQuery({
    queryKey: qk.intakeForm(formId),
    queryFn: () => api.getIntakeForm(formId ?? ''),
    enabled: !!formId,
  });

export const usePublicIntakeForm = (slug: string | null) =>
  useQuery<PublicIntakeFormResponse>({
    queryKey: qk.publicIntakeForm(slug),
    queryFn: () => api.getPublicIntakeForm(slug ?? ''),
    enabled: !!slug,
  });

export function useSubmitPublicIntakeForm(slug: string | null) {
  return useMutation<
    SubmitPublicIntakeResult,
    Error,
    { payload: Record<string, unknown>; captchaToken?: string | null }
  >({
    mutationKey: ['submitPublicIntakeForm', server(), slug],
    mutationFn: (input) => api.submitPublicIntakeForm(slug ?? '', input),
  });
}

function invalidateIntakeFormCaches(
  qc: QueryClient,
  form: IntakeForm | undefined,
  formId?: string | null,
) {
  qc.invalidateQueries({ queryKey: [server(), 'intakeForms'] });
  if (form?.projectId) qc.invalidateQueries({ queryKey: qk.intakeForms(form.projectId) });
  if (form?.id) qc.invalidateQueries({ queryKey: qk.intakeForm(form.id) });
  if (formId) qc.invalidateQueries({ queryKey: qk.intakeForm(formId) });
}

export function useCreateIntakeForm() {
  const qc = useQueryClient();
  return useMutation({
    mutationKey: ['createIntakeForm'],
    mutationFn: (input: CreateIntakeFormInput) => api.createIntakeForm(input),
    onSuccess: (form) => {
      qc.setQueryData(qk.intakeForm(form.id), form);
      invalidateIntakeFormCaches(qc, form);
    },
  });
}

export function useUpdateIntakeForm() {
  const qc = useQueryClient();
  return useMutation({
    mutationKey: ['updateIntakeForm'],
    mutationFn: (input: UpdateIntakeFormInput) => api.updateIntakeForm(input),
    onSuccess: (form) => {
      qc.setQueryData(qk.intakeForm(form.id), form);
      invalidateIntakeFormCaches(qc, form);
    },
  });
}

export function useDeleteIntakeForm() {
  const qc = useQueryClient();
  return useMutation({
    mutationKey: ['deleteIntakeForm'],
    mutationFn: (form: Pick<IntakeForm, 'id' | 'projectId'>) => api.deleteIntakeForm(form.id),
    onSuccess: (_result, form) => {
      qc.removeQueries({ queryKey: qk.intakeForm(form.id) });
      invalidateIntakeFormCaches(qc, undefined, form.id);
      qc.invalidateQueries({ queryKey: qk.intakeForms(form.projectId) });
    },
  });
}

export function useImportPreview() {
  return useMutation<ImportPreviewResponse, Error, { source: string; input: ImportPreviewInput }>({
    mutationKey: ['importPreview'],
    mutationFn: ({ source, input }) => api.previewImport(source, input),
  });
}

export function useRunImport() {
  const qc = useQueryClient();
  return useMutation<ImportRunResponse, Error, { source: string; input: RunImportInput }>({
    mutationKey: ['runImport'],
    mutationFn: ({ source, input }) => api.runImport(source, input),
    onSuccess: (result) => {
      if (result.jobId) qc.invalidateQueries({ queryKey: qk.importJob(result.jobId) });
    },
  });
}

export const useImportJob = (jobId: string | null, enabled = true) =>
  useQuery<ImportJobStatus>({
    queryKey: qk.importJob(jobId),
    queryFn: () => api.getImportJob(jobId ?? ''),
    enabled: enabled && !!jobId,
  });

export const useOrganizationMembers = (organizationId: string | null, enabled = true) =>
  useQuery({
    queryKey: qk.organizationMembers(organizationId),
    queryFn: () => api.listOrganizationMembers(organizationId ?? ''),
    enabled: enabled && !!organizationId,
  });

export const useAiCapability = (organizationId: string | null, enabled = true) =>
  useQuery<AiCapability>({
    queryKey: qk.aiCapability(organizationId),
    queryFn: () => api.getAiCapability(organizationId),
    enabled,
  });

export const useLabels = (organizationId: string | null, projectId?: string | null) =>
  useQuery({
    queryKey: qk.labels(organizationId, projectId),
    queryFn: () => {
      const input: { organizationId: string; projectId?: string } = {
        organizationId: organizationId ?? '',
      };
      if (projectId) input.projectId = projectId;
      return api.listLabels(input);
    },
    enabled: !!organizationId,
  });

export function useCreateLabel(organizationId: string | null) {
  const qc = useQueryClient();
  return useMutation({
    mutationKey: ['createLabel', organizationId],
    mutationFn: (input: Omit<CreateLabelInput, 'organizationId'>) =>
      api.createLabel({ ...input, organizationId: organizationId ?? '' }),
    onSuccess: (label) => {
      qc.setQueryData<Label[]>(qk.labels(organizationId), (current) => [label, ...(current ?? [])]);
      invalidateLabelCaches(qc, organizationId);
    },
  });
}

export function useUpdateLabel(organizationId: string | null) {
  const qc = useQueryClient();
  return useMutation({
    mutationKey: ['updateLabel', organizationId],
    mutationFn: (input: UpdateLabelInput) => api.updateLabel(input),
    onSuccess: (label) => {
      qc.setQueryData<Label[]>(qk.labels(organizationId), (current) =>
        current?.map((item) => (item.id === label.id ? label : item)),
      );
      invalidateLabelCaches(qc, organizationId);
    },
  });
}

export function useDeleteLabel(organizationId: string | null) {
  const qc = useQueryClient();
  return useMutation({
    mutationKey: ['deleteLabel', organizationId],
    mutationFn: (labelId: string) => api.deleteLabel(labelId),
    onSuccess: (_result, labelId) => {
      qc.setQueryData<Label[]>(qk.labels(organizationId), (current) =>
        current?.filter((item) => item.id !== labelId),
      );
      invalidateLabelCaches(qc, organizationId);
    },
  });
}

export const useCustomFields = (input: ListCustomFieldsInput | null) =>
  useQuery({
    queryKey: qk.customFields(input?.organizationId ?? null, input?.projectId ?? null),
    queryFn: () => api.listCustomFields(input ?? { organizationId: '' }),
    enabled: !!input?.organizationId,
  });

export function useCreateCustomField(input: ListCustomFieldsInput | null) {
  const qc = useQueryClient();
  return useMutation({
    mutationKey: ['createCustomField', input?.organizationId ?? null, input?.projectId ?? null],
    mutationFn: (data: CreateCustomFieldInput) => api.createCustomField(data),
    onSuccess: (field, variables) => {
      const organizationId = field.organizationId ?? variables.organizationId;
      const projectId = field.projectId ?? variables.projectId ?? null;
      qc.setQueryData<CustomField[]>(qk.customFields(organizationId, projectId), (current) => [
        ...(current ?? []),
        field,
      ]);
      qc.invalidateQueries({ queryKey: qk.customFields(organizationId, projectId) });
      qc.invalidateQueries({ queryKey: [server(), 'issue'] });
    },
  });
}

export function useUpdateCustomField(input: ListCustomFieldsInput | null) {
  const qc = useQueryClient();
  return useMutation({
    mutationKey: ['updateCustomField', input?.organizationId ?? null, input?.projectId ?? null],
    mutationFn: ({ fieldId, patch }: { fieldId: string; patch: UpdateCustomFieldInput }) =>
      api.updateCustomField(fieldId, patch),
    onSuccess: (field) => {
      const organizationId = field.organizationId ?? input?.organizationId ?? null;
      const projectId = field.projectId ?? input?.projectId ?? null;
      qc.setQueryData<CustomField[]>(qk.customFields(organizationId, projectId), (current) =>
        current?.map((item) => (item.id === field.id ? field : item)),
      );
      qc.invalidateQueries({ queryKey: qk.customFields(organizationId, projectId) });
      qc.invalidateQueries({ queryKey: [server(), 'issue'] });
    },
  });
}

export function useDeleteCustomField(input: ListCustomFieldsInput | null) {
  const qc = useQueryClient();
  return useMutation({
    mutationKey: ['deleteCustomField', input?.organizationId ?? null, input?.projectId ?? null],
    mutationFn: (fieldId: string) => api.deleteCustomField(fieldId),
    onSuccess: (_result, fieldId) => {
      qc.setQueryData<CustomField[]>(
        qk.customFields(input?.organizationId ?? null, input?.projectId ?? null),
        (current) => current?.filter((item) => item.id !== fieldId),
      );
      qc.invalidateQueries({
        queryKey: qk.customFields(input?.organizationId ?? null, input?.projectId ?? null),
      });
      qc.invalidateQueries({ queryKey: [server(), 'issue'] });
    },
  });
}

export const useProjectComponents = (projectId: string | null) =>
  useQuery({
    queryKey: qk.projectComponents(projectId),
    queryFn: () => api.listProjectComponents(projectId ?? ''),
    enabled: !!projectId,
  });

export const useProjectModules = (projectId: string | null) =>
  useQuery({
    queryKey: qk.projectModules(projectId),
    queryFn: () => api.listProjectModules(projectId ?? ''),
    enabled: !!projectId,
  });

export const useProjectViews = (projectId: string | null, teamId?: string | null) =>
  useQuery({
    queryKey: qk.projectViews(projectId, teamId),
    queryFn: () => api.listProjectViews({ projectId: projectId ?? '', teamId }),
    enabled: !!projectId,
  });

export const useProjectChatBootstrap = (projectId: string | null) =>
  useQuery({
    queryKey: qk.projectChatBootstrap(projectId),
    queryFn: () => api.getProjectChatBootstrap(projectId ?? ''),
    enabled: !!projectId,
    staleTime: 15000,
    refetchInterval: 30000,
  });

export const useLiveCalls = () =>
  useQuery({
    queryKey: qk.liveCalls(),
    queryFn: () => api.listLiveCalls(),
    staleTime: 10000,
    refetchInterval: 15000,
  });

export const useProjectCommunicationsSettings = (projectId: string | null) =>
  useQuery({
    queryKey: qk.projectCommunications(projectId),
    queryFn: () => api.getProjectCommunicationsSettings(projectId ?? ''),
    enabled: !!projectId,
  });

export function useUpdateProjectCommunicationsSettings(projectId: string | null) {
  const qc = useQueryClient();
  return useMutation({
    mutationKey: ['updateProjectCommunicationsSettings', projectId],
    mutationFn: (input: UpdateProjectCommunicationsSettingsInput) =>
      api.updateProjectCommunicationsSettings(projectId ?? '', input),
    onSuccess: (projectSettings) => {
      qc.setQueryData<ProjectCommunicationsSettingsResponse>(
        qk.projectCommunications(projectId),
        (current) =>
          current
            ? {
                ...current,
                projectSettings,
              }
            : current,
      );
      qc.invalidateQueries({ queryKey: qk.projectCommunications(projectId) });
      qc.invalidateQueries({ queryKey: qk.projectChatBootstrap(projectId) });
    },
  });
}

export function useConversationMessages(roomId: string | null) {
  const queryClient = useQueryClient();
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const query = useQuery({
    queryKey: qk.conversationMessages(roomId),
    queryFn: () => api.listConversationMessages({ roomId: roomId ?? '' }),
    enabled: !!roomId,
    staleTime: 10000,
  });
  const pageInfo = query.data?.pageInfo ?? { hasMore: false, nextCursor: null };

  const loadMore = async () => {
    if (!roomId || !pageInfo.hasMore || !pageInfo.nextCursor || isLoadingMore) return;
    try {
      setIsLoadingMore(true);
      const nextPage = await api.listConversationMessages({
        roomId,
        before: pageInfo.nextCursor,
      });
      queryClient.setQueryData<ConversationMessagesPage>(
        qk.conversationMessages(roomId),
        (current) => ({
          messages: mergeOlderConversationMessages(current?.messages, nextPage.messages),
          pageInfo: nextPage.pageInfo,
        }),
      );
    } finally {
      setIsLoadingMore(false);
    }
  };

  return {
    ...query,
    data: query.data?.messages ?? [],
    pageInfo,
    hasMore: pageInfo.hasMore,
    isLoadingMore,
    loadMore,
  };
}

export function useCreateConversationMessage(projectId: string | null, roomId: string | null) {
  const qc = useQueryClient();
  return useMutation({
    mutationKey: ['createConversationMessage', roomId],
    mutationFn: (input: CreateConversationMessageInput) =>
      api.createConversationMessage(roomId ?? '', input),
    onSuccess: (message) => {
      qc.setQueryData<ConversationMessagesPage>(qk.conversationMessages(roomId), (current) => ({
        messages: upsertConversationMessage(current?.messages, message),
        pageInfo: current?.pageInfo ?? { hasMore: false, nextCursor: null },
      }));
      qc.invalidateQueries({ queryKey: qk.projectChatBootstrap(projectId) });
    },
  });
}

export function useUpdateConversationMessage(projectId: string | null, roomId: string | null) {
  const qc = useQueryClient();
  return useMutation({
    mutationKey: ['updateConversationMessage', roomId],
    mutationFn: ({
      messageId,
      input,
    }: {
      messageId: string;
      input: UpdateConversationMessageInput;
    }) => api.updateConversationMessage(roomId ?? '', messageId, input),
    onSuccess: (message) => {
      if (message) {
        qc.setQueryData<ConversationMessagesPage>(qk.conversationMessages(roomId), (current) => ({
          messages: upsertConversationMessage(current?.messages, message),
          pageInfo: current?.pageInfo ?? { hasMore: false, nextCursor: null },
        }));
      }
      qc.invalidateQueries({ queryKey: qk.projectChatBootstrap(projectId) });
    },
  });
}

export function useDeleteConversationMessage(projectId: string | null, roomId: string | null) {
  const qc = useQueryClient();
  return useMutation({
    mutationKey: ['deleteConversationMessage', roomId],
    mutationFn: (messageId: string) => api.deleteConversationMessage(roomId ?? '', messageId),
    onSuccess: (message, messageId) => {
      qc.setQueryData<ConversationMessagesPage>(qk.conversationMessages(roomId), (current) => ({
        messages: message
          ? upsertConversationMessage(current?.messages, message)
          : tombstoneConversationMessage(current?.messages, messageId),
        pageInfo: current?.pageInfo ?? { hasMore: false, nextCursor: null },
      }));
      qc.invalidateQueries({ queryKey: qk.projectChatBootstrap(projectId) });
    },
  });
}

export function useMarkConversationRead(projectId: string | null, roomId: string | null) {
  const qc = useQueryClient();
  return useMutation({
    mutationKey: ['markConversationRead', roomId],
    mutationFn: (lastReadMessageId?: string | null) =>
      api.markConversationRead(roomId ?? '', lastReadMessageId ?? null),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: qk.projectChatBootstrap(projectId) });
    },
  });
}

export function useStartConversationCall(projectId: string | null, roomId: string | null) {
  const qc = useQueryClient();
  return useMutation({
    mutationKey: ['startConversationCall', roomId],
    mutationFn: () => api.startConversationCall(roomId ?? ''),
    onSuccess: (response) => {
      patchProjectChatActiveCallCache(qc, projectId, roomId, response.call);
      qc.invalidateQueries({ queryKey: qk.projectChatBootstrap(projectId) });
      qc.invalidateQueries({ queryKey: qk.liveCalls() });
    },
  });
}

export function useEndConversationCall(projectId: string | null, roomId: string | null) {
  const qc = useQueryClient();
  return useMutation({
    mutationKey: ['endConversationCall', roomId],
    mutationFn: () => api.endConversationCall(roomId ?? ''),
    onSuccess: () => {
      patchProjectChatActiveCallCache(qc, projectId, roomId, null);
      qc.invalidateQueries({ queryKey: qk.projectChatBootstrap(projectId) });
      qc.invalidateQueries({ queryKey: qk.liveCalls() });
    },
  });
}

export function useLeaveConversationCall(projectId: string | null, roomId: string | null) {
  const qc = useQueryClient();
  return useMutation({
    mutationKey: ['leaveConversationCall', roomId],
    mutationFn: (input?: LeaveConversationCallInput) =>
      api.leaveConversationCall(roomId ?? '', input),
    onSuccess: (response) => {
      patchProjectChatActiveCallCache(qc, projectId, roomId, response.call);
      qc.invalidateQueries({ queryKey: qk.projectChatBootstrap(projectId) });
      qc.invalidateQueries({ queryKey: qk.liveCalls() });
    },
  });
}

export function useCreateConversationCallToken(roomId: string | null) {
  return useMutation({
    mutationKey: ['createConversationCallToken', roomId],
    mutationFn: (input?: CreateConversationCallTokenInput) =>
      api.createConversationCallToken(roomId ?? '', input),
  });
}

export function useCreateProjectChatChannel(projectId: string | null) {
  const qc = useQueryClient();
  return useMutation({
    mutationKey: ['createProjectChatChannel', projectId],
    mutationFn: (input: CreateProjectChatChannelInput) =>
      api.createProjectChatChannel(projectId ?? '', input),
    onSuccess: (channel) => {
      qc.setQueryData<ProjectChatBootstrap>(qk.projectChatBootstrap(projectId), (current) =>
        current
          ? {
              ...current,
              channels: [...current.channels, channel],
              lastActiveRoomId: channel.roomId ?? current.lastActiveRoomId,
            }
          : current,
      );
      qc.invalidateQueries({ queryKey: qk.projectChatBootstrap(projectId) });
    },
  });
}

export function useUpdateProjectChatChannel(projectId: string | null) {
  const qc = useQueryClient();
  return useMutation({
    mutationKey: ['updateProjectChatChannel', projectId],
    mutationFn: ({
      channelId,
      input,
    }: {
      channelId: string;
      input: UpdateProjectChatChannelInput;
    }) => api.updateProjectChatChannel(projectId ?? '', channelId, input),
    onSuccess: (channel) => {
      qc.setQueryData<ProjectChatBootstrap>(qk.projectChatBootstrap(projectId), (current) =>
        current
          ? {
              ...current,
              channels: current.channels.map((item) => (item.id === channel.id ? channel : item)),
            }
          : current,
      );
      qc.invalidateQueries({ queryKey: qk.projectChatBootstrap(projectId) });
    },
  });
}

export function useDeleteProjectChatChannel(projectId: string | null) {
  const qc = useQueryClient();
  return useMutation({
    mutationKey: ['deleteProjectChatChannel', projectId],
    mutationFn: (channelId: string) => api.deleteProjectChatChannel(projectId ?? '', channelId),
    onSuccess: (_result, channelId) => {
      qc.setQueryData<ProjectChatBootstrap>(qk.projectChatBootstrap(projectId), (current) =>
        current
          ? {
              ...current,
              channels: current.channels.filter((channel) => channel.id !== channelId),
            }
          : current,
      );
      qc.invalidateQueries({ queryKey: qk.projectChatBootstrap(projectId) });
    },
  });
}

export function useConversationStream(
  projectId: string | null,
  roomId: string | null,
  enabled: boolean,
) {
  const qc = useQueryClient();
  const [isConnected, setIsConnected] = useState(false);

  useEffect(() => {
    if (!enabled || !roomId) {
      setIsConnected(false);
      return undefined;
    }

    const baseUrl = getBaseUrl();
    const cookie = getAuthCookie();
    if (!baseUrl || !cookie) {
      setIsConnected(false);
      return undefined;
    }

    let stream: ChatSse | null = null;
    let cancelled = false;

    const messageListener: ChatSseListener = (event) => {
      if (event.type !== 'message' || !event.data) return;
      try {
        const payload = JSON.parse(String(event.data)) as {
          type?: string;
          data?: Record<string, unknown>;
        };
        if (!payload.type || !payload.data) return;

        if (payload.type === 'connected') {
          setIsConnected(true);
          return;
        }

        if (payload.type === 'call.started' || payload.type === 'call.presence') {
          const activeCall = normalizeSseActiveCall(payload.data.call, roomId);
          patchProjectChatActiveCallCache(qc, projectId, roomId, activeCall);
          qc.invalidateQueries({ queryKey: qk.liveCalls() });
          if (payload.type === 'call.started') {
            qc.invalidateQueries({ queryKey: qk.projectChatBootstrap(projectId) });
          }
          return;
        }

        if (payload.type === 'call.ended') {
          patchProjectChatActiveCallCache(qc, projectId, roomId, null);
          qc.invalidateQueries({ queryKey: qk.projectChatBootstrap(projectId) });
          qc.invalidateQueries({ queryKey: qk.liveCalls() });
          return;
        }

        if (payload.type === 'message.created' || payload.type === 'message.updated') {
          const message = payload.data.message;
          if (isConversationMessage(message)) {
            qc.setQueryData<ConversationMessagesPage>(
              qk.conversationMessages(roomId),
              (current) => ({
                messages: upsertConversationMessage(current?.messages, message),
                pageInfo: current?.pageInfo ?? defaultConversationPage().pageInfo,
              }),
            );
            qc.invalidateQueries({ queryKey: qk.projectChatBootstrap(projectId) });
          }
          return;
        }

        if (payload.type === 'message.deleted') {
          const messageId =
            typeof payload.data.messageId === 'string' ? payload.data.messageId : null;
          if (messageId) {
            qc.setQueryData<ConversationMessagesPage>(
              qk.conversationMessages(roomId),
              (current) => ({
                messages: tombstoneConversationMessage(current?.messages, messageId),
                pageInfo: current?.pageInfo ?? defaultConversationPage().pageInfo,
              }),
            );
            qc.invalidateQueries({ queryKey: qk.projectChatBootstrap(projectId) });
          }
          return;
        }

        if (payload.type === 'message.reaction') {
          const messageId =
            typeof payload.data.messageId === 'string' ? payload.data.messageId : null;
          const reactions = payload.data.reactions;
          if (messageId && Array.isArray(reactions)) {
            qc.setQueryData<ConversationMessagesPage>(
              qk.conversationMessages(roomId),
              (current) => ({
                messages: patchConversationMessageReactions(
                  current?.messages,
                  messageId,
                  reactions as ConversationMessage['reactions'],
                ),
                pageInfo: current?.pageInfo ?? defaultConversationPage().pageInfo,
              }),
            );
          }
          return;
        }

        if (payload.type === 'messages.cleared') {
          qc.invalidateQueries({ queryKey: qk.conversationMessages(roomId) });
          qc.invalidateQueries({ queryKey: qk.projectChatBootstrap(projectId) });
        }
      } catch {
        // Keep the stream alive through malformed transitional payloads.
      }
    };

    const errorListener: ChatSseListener = () => {
      setIsConnected(false);
    };

    void import('react-native-sse')
      .then((mod) => {
        if (cancelled) return;
        const EventSource = mod.default as ChatSseConstructor;
        stream = new EventSource(`${baseUrl}/api/conversations/${roomId}/stream`, {
          headers: {
            Accept: 'text/event-stream',
            Cookie: cookie,
          },
          pollingInterval: 5000,
          timeout: 0,
          timeoutBeforeConnection: 250,
        });
        stream.addEventListener('message', messageListener);
        stream.addEventListener('error', errorListener);
      })
      .catch(() => {
        setIsConnected(false);
      });

    return () => {
      cancelled = true;
      stream?.removeAllEventListeners();
      stream?.close();
      setIsConnected(false);
    };
  }, [enabled, projectId, qc, roomId]);

  return { isConnected };
}

export const useProjectVersions = (projectId: string | null) =>
  useQuery({
    queryKey: qk.projectVersions(projectId),
    queryFn: () => api.listProjectVersions(projectId ?? ''),
    enabled: !!projectId,
  });

export const useProjectWorkflowStatuses = (projectId: string | null) =>
  useQuery({
    queryKey: qk.projectWorkflowStatuses(projectId),
    queryFn: () => api.listProjectWorkflowStatuses(projectId ?? ''),
    enabled: !!projectId,
  });

export const useProjectWorkflowTransitions = (projectId: string | null) =>
  useQuery({
    queryKey: qk.projectWorkflowTransitions(projectId),
    queryFn: () => api.listProjectWorkflowTransitions(projectId ?? ''),
    enabled: !!projectId,
  });

export const useIssues = (filters: IssueFilters = {}) =>
  useQuery({ queryKey: qk.issues(filters), queryFn: () => api.listIssues(filters) });

export const useSavedIssueFilters = (
  organizationId: string | null,
  projectId?: string | null,
  enabled = true,
) =>
  useQuery({
    queryKey: qk.savedIssueFilters(organizationId, projectId),
    queryFn: () =>
      api.listSavedIssueFilters({
        organizationId: organizationId ?? '',
        projectId: projectId ?? null,
        includePublic: true,
      }),
    enabled: enabled && !!organizationId,
  });

export function useCreateSavedIssueFilter(
  organizationId: string | null,
  projectId?: string | null,
) {
  const qc = useQueryClient();
  return useMutation({
    mutationKey: ['createSavedIssueFilter', organizationId, projectId ?? null],
    mutationFn: (input: CreateSavedIssueFilterInput) => api.createSavedIssueFilter(input),
    onSuccess: (filter) => {
      qc.setQueryData<SavedIssueFilter[]>(
        qk.savedIssueFilters(organizationId, projectId),
        (current) => [filter, ...(current ?? [])],
      );
      qc.invalidateQueries({ queryKey: qk.savedIssueFilters(organizationId, projectId) });
    },
  });
}

export function useUpdateSavedIssueFilter(
  organizationId: string | null,
  projectId?: string | null,
) {
  const qc = useQueryClient();
  return useMutation({
    mutationKey: ['updateSavedIssueFilter', organizationId, projectId ?? null],
    mutationFn: ({ filterId, patch }: { filterId: string; patch: UpdateSavedIssueFilterInput }) =>
      api.updateSavedIssueFilter(filterId, patch),
    onSuccess: (filter) => {
      qc.setQueryData<SavedIssueFilter[]>(
        qk.savedIssueFilters(organizationId, projectId),
        (current) => current?.map((item) => (item.id === filter.id ? filter : item)),
      );
      qc.invalidateQueries({ queryKey: qk.savedIssueFilters(organizationId, projectId) });
    },
  });
}

export function useDeleteSavedIssueFilter(
  organizationId: string | null,
  projectId?: string | null,
) {
  const qc = useQueryClient();
  return useMutation({
    mutationKey: ['deleteSavedIssueFilter', organizationId, projectId ?? null],
    mutationFn: (filterId: string) => api.deleteSavedIssueFilter(filterId),
    onSuccess: (_result, filterId) => {
      qc.setQueryData<SavedIssueFilter[]>(
        qk.savedIssueFilters(organizationId, projectId),
        (current) => current?.filter((filter) => filter.id !== filterId),
      );
      qc.invalidateQueries({ queryKey: qk.savedIssueFilters(organizationId, projectId) });
    },
  });
}

export function useMarkSavedIssueFilterUsed(
  organizationId: string | null,
  projectId?: string | null,
) {
  const qc = useQueryClient();
  return useMutation({
    mutationKey: ['markSavedIssueFilterUsed', organizationId, projectId ?? null],
    mutationFn: (filterId: string) => api.markSavedIssueFilterUsed(filterId),
    onSuccess: (filter) => {
      qc.setQueryData<SavedIssueFilter[]>(
        qk.savedIssueFilters(organizationId, projectId),
        (current) => current?.map((item) => (item.id === filter.id ? filter : item)),
      );
      qc.invalidateQueries({ queryKey: qk.savedIssueFilters(organizationId, projectId) });
    },
  });
}

export const useProjectIssues = (projectId: string | null) =>
  useQuery({
    queryKey: qk.issues(projectId ? { projectId } : { projectId: 'none' }),
    queryFn: () => api.listIssues({ projectId: projectId ?? '' }),
    enabled: !!projectId,
  });

export const useMyIssues = (view: MyIssueView = 'assigned') =>
  useQuery({ queryKey: qk.myIssues(view), queryFn: () => api.listMyIssues(view) });

export const useMyWorkload = (window: MyWorkloadWindow = 'this_week') =>
  useQuery<MyWorkloadResponse>({
    queryKey: qk.myWorkload(window),
    queryFn: () => api.getMyWorkload(window),
  });

export const useSearchIssues = (query: string) =>
  useQuery({
    queryKey: qk.search(query),
    queryFn: () => api.searchIssues(query.trim()),
    enabled: query.trim().length >= 2,
  });

export const useSearchHistory = (organizationId: string | null, pinned = false, enabled = true) =>
  useQuery({
    queryKey: qk.searchHistory(organizationId, pinned),
    queryFn: () =>
      api.listSearchHistory({
        organizationId: organizationId ?? '',
        pinned,
        limit: pinned ? 10 : 8,
      }),
    enabled: enabled && !!organizationId,
  });

export function useUpdateSearchHistoryPinned(organizationId: string | null) {
  const qc = useQueryClient();
  return useMutation({
    mutationKey: ['updateSearchHistoryPinned', organizationId],
    mutationFn: ({ id, pinned }: { id: string; pinned: boolean }) =>
      api.updateSearchHistoryPinned(id, pinned),
    onSuccess: (entry) => {
      qc.setQueryData<SearchHistoryEntry[]>(qk.searchHistory(organizationId, true), (current) =>
        entry.pinned
          ? [entry, ...(current ?? []).filter((item) => item.id !== entry.id)]
          : (current ?? []).filter((item) => item.id !== entry.id),
      );
      qc.setQueryData<SearchHistoryEntry[]>(qk.searchHistory(organizationId, false), (current) =>
        entry.pinned
          ? (current ?? []).filter((item) => item.id !== entry.id)
          : [entry, ...(current ?? []).filter((item) => item.id !== entry.id)],
      );
      qc.invalidateQueries({ queryKey: qk.searchHistory(organizationId, true) });
      qc.invalidateQueries({ queryKey: qk.searchHistory(organizationId, false) });
    },
  });
}

export const useIssue = (id: string) =>
  useQuery({ queryKey: qk.issue(id), queryFn: () => api.getIssue(id), enabled: !!id });

export const useIssueSubtasks = (issueId: string | null) =>
  useQuery({
    queryKey: qk.issueSubtasks(issueId),
    queryFn: () => api.listIssues({ parentId: issueId ?? '' }),
    enabled: !!issueId,
  });

export const useIssueComponents = (issueId: string | null) =>
  useQuery({
    queryKey: qk.issueComponents(issueId),
    queryFn: () => api.listIssueComponents(issueId ?? ''),
    enabled: !!issueId,
  });

export const useIssueVersions = (issueId: string | null) =>
  useQuery({
    queryKey: qk.issueVersions(issueId),
    queryFn: () => api.listIssueVersions(issueId ?? ''),
    enabled: !!issueId,
  });

export const useIssueLinks = (issueId: string | null) =>
  useQuery({
    queryKey: qk.issueLinks(issueId),
    queryFn: () => api.listIssueLinks(issueId ?? ''),
    enabled: !!issueId,
  });

export const useIssueDocuments = (issueId: string | null) =>
  useQuery({
    queryKey: qk.issueDocuments(issueId),
    queryFn: () => api.listIssueDocuments(issueId ?? ''),
    enabled: !!issueId,
  });

export const useIssueTimeEntries = (issueId: string | null) =>
  useQuery({
    queryKey: qk.issueTimeEntries(issueId),
    queryFn: () => api.listIssueTimeEntries(issueId ?? ''),
    enabled: !!issueId,
  });

export const useIssueTimeInStatus = (issueId: string | null) =>
  useQuery({
    queryKey: qk.issueTimeInStatus(issueId),
    queryFn: () => api.listIssueTimeInStatus(issueId ?? ''),
    enabled: !!issueId,
  });

export const useIssueAgentSessions = (issueId: string | null, enabled = true) =>
  useQuery<IssueAgentSessionsResponse>({
    queryKey: qk.issueAgentSessions(issueId),
    queryFn: () => api.listIssueAgentSessions(issueId ?? ''),
    enabled: enabled && !!issueId,
    refetchInterval: 10000,
  });

export const useIssueCustomFieldValues = (issueId: string | null) =>
  useQuery({
    queryKey: qk.issueCustomFieldValues(issueId),
    queryFn: () => api.listIssueCustomFieldValues(issueId ?? ''),
    enabled: !!issueId,
  });

export const useSprints = (projectId: string | null) =>
  useQuery({
    queryKey: qk.sprints(projectId),
    queryFn: () => api.listSprints(projectId ?? ''),
    enabled: !!projectId,
  });

export const useSprint = (sprintId: string | null) =>
  useQuery({
    queryKey: qk.sprint(sprintId),
    queryFn: () => api.getSprint(sprintId ?? ''),
    enabled: !!sprintId,
  });

export const useSprintIssues = (sprintId: string | null) =>
  useQuery({
    queryKey: qk.sprintIssues(sprintId),
    queryFn: () => api.listSprintIssues(sprintId ?? ''),
    enabled: !!sprintId,
  });

export const useSprintBurndown = (sprintId: string | null) =>
  useQuery<SprintBurndownAnalytics>({
    queryKey: qk.sprintBurndown(sprintId),
    queryFn: () => api.getSprintBurndown(sprintId ?? ''),
    enabled: !!sprintId,
  });

export const useComments = (issueId: string) =>
  useQuery({
    queryKey: qk.comments(issueId),
    queryFn: () => api.listComments(issueId),
    enabled: !!issueId,
  });

export const useIssueActivities = (issueId: string | null) =>
  useQuery({
    queryKey: qk.issueActivities(issueId),
    queryFn: () => api.listIssueActivities(issueId ?? ''),
    enabled: !!issueId,
    refetchInterval: 30000,
  });

export const useIssueAttachments = (issueId: string | null) =>
  useQuery({
    queryKey: qk.issueAttachments(issueId),
    queryFn: () => api.listIssueAttachments(issueId ?? ''),
    enabled: !!issueId,
  });

export const useIssueWatchers = (issueId: string) =>
  useQuery({
    queryKey: qk.watchers(issueId),
    queryFn: () => api.listIssueWatchers(issueId),
    enabled: !!issueId,
  });

export const useIssueTriage = (issueId: string | null, enabled = true) =>
  useQuery<IssueTriageResponse>({
    queryKey: qk.issueTriage(issueId),
    queryFn: () => api.listIssueTriageSuggestions(issueId ?? ''),
    enabled: enabled && !!issueId,
  });

export const useInbox = (filters: InboxFilters | boolean = {}) =>
  useQuery({ queryKey: qk.inbox(filters), queryFn: () => api.listInbox(filters) });

export const useInboxPage = (filters: InboxFilters | boolean = {}) =>
  useQuery({ queryKey: qk.inboxPage(filters), queryFn: () => api.listInboxPage(filters) });

export const useCatchMeUp = (since?: string | null, enabled = false) =>
  useQuery({
    queryKey: qk.catchMeUp(since),
    queryFn: () => api.getCatchMeUp(since ? { since } : {}),
    enabled,
    staleTime: 60 * 1000,
  });

export const useNotificationPreferences = (organizationId: string | null) =>
  useQuery({
    queryKey: qk.notificationPreferences(organizationId),
    queryFn: () => api.getNotificationPreferences(organizationId ?? ''),
    enabled: !!organizationId,
  });

export const useInitiatives = (workspaceId?: string | null) =>
  useQuery({
    queryKey: qk.initiatives(workspaceId),
    queryFn: () => api.listInitiatives(workspaceId),
  });

export const useInitiative = (initiativeId: string) =>
  useQuery({
    queryKey: qk.initiative(initiativeId),
    queryFn: () => api.getInitiative(initiativeId),
    enabled: !!initiativeId,
  });

export const useInitiativeRollup = (initiativeId: string) =>
  useQuery({
    queryKey: qk.initiativeRollup(initiativeId),
    queryFn: () => api.getInitiativeRollup(initiativeId),
    enabled: !!initiativeId,
  });

export const useInitiativeUpdates = (initiativeId: string) =>
  useQuery({
    queryKey: qk.initiativeUpdates(initiativeId),
    queryFn: () => api.listInitiativeUpdates(initiativeId),
    enabled: !!initiativeId,
  });

export function useCreateInitiative() {
  const qc = useQueryClient();
  return useMutation({
    mutationKey: ['createInitiative'],
    mutationFn: (input: CreateInitiativeInput) => api.createInitiative(input),
    onSuccess: (initiative) => {
      qc.setQueryData<InitiativesListResponse>(
        qk.initiatives(initiative.workspaceId),
        (current) => {
          if (!current) return current;
          return {
            initiatives: [initiative, ...current.initiatives],
            flat: [initiative, ...current.flat],
          };
        },
      );
      qc.invalidateQueries({ queryKey: [server(), 'initiatives'] });
    },
  });
}

export function useCreateInitiativeUpdate(initiativeId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationKey: ['createInitiativeUpdate', initiativeId],
    mutationFn: (input: CreateInitiativeUpdateInput) =>
      api.createInitiativeUpdate(initiativeId, input),
    onSuccess: (update) => {
      qc.setQueryData<InitiativeUpdate[]>(qk.initiativeUpdates(initiativeId), (current) => [
        update,
        ...(current ?? []),
      ]);
      qc.invalidateQueries({ queryKey: qk.initiativeUpdates(initiativeId) });
    },
  });
}

export function useInviteOrganizationMember(organizationId: string | null) {
  const qc = useQueryClient();
  return useMutation({
    mutationKey: ['inviteOrganizationMember', organizationId],
    mutationFn: (input: InviteOrganizationMemberInput) =>
      api.inviteOrganizationMember(organizationId ?? '', input),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: qk.organizationMembers(organizationId) });
    },
  });
}

export function useUpdateOrganizationMemberRole(organizationId: string | null) {
  const qc = useQueryClient();
  return useMutation({
    mutationKey: ['updateOrganizationMemberRole', organizationId],
    mutationFn: (input: UpdateOrganizationMemberRoleInput) =>
      api.updateOrganizationMemberRole(organizationId ?? '', input),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: qk.organizationMembers(organizationId) });
    },
  });
}

export function useRemoveOrganizationMember(organizationId: string | null) {
  const qc = useQueryClient();
  return useMutation({
    mutationKey: ['removeOrganizationMember', organizationId],
    mutationFn: (memberId: string) => api.removeOrganizationMember(organizationId ?? '', memberId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: qk.organizationMembers(organizationId) });
    },
  });
}

export function useAssignOrganizationMemberProjects(organizationId: string | null) {
  const qc = useQueryClient();
  return useMutation({
    mutationKey: ['assignOrganizationMemberProjects', organizationId],
    mutationFn: (input: AssignOrganizationMemberProjectsInput) =>
      api.assignOrganizationMemberProjects(organizationId ?? '', input),
    onSuccess: (_result, input) => {
      qc.invalidateQueries({ queryKey: qk.organizationMembers(organizationId) });
      qc.invalidateQueries({ queryKey: qk.projects() });
      for (const projectId of input.projectIds) {
        qc.invalidateQueries({ queryKey: qk.projectMembers(projectId) });
      }
    },
  });
}

export function useCreateIssue() {
  const qc = useQueryClient();
  return useMutation({
    mutationKey: ['createIssue'],
    mutationFn: (input: CreateIssueInput) => api.createIssue(input),
    onSuccess: (issue) => {
      qc.setQueryData(qk.issue(issue.id), issue);
      invalidateIssueDerivedQueries(qc);
    },
  });
}

export function useCreateSubIssue(parentIssue: Issue | null | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationKey: ['createSubIssue', parentIssue?.id ?? 'none'],
    mutationFn: (title: string) => {
      if (!parentIssue) throw new Error(i18next.t('issueSubtasks.parentMissing'));
      const input: CreateIssueInput = {
        projectId: parentIssue.projectId,
        type: 'task',
        title: title.trim(),
        priority: parentIssue.priority ?? 'medium',
        parentId: parentIssue.id,
      };
      if (parentIssue.sprintId) input.sprintId = parentIssue.sprintId;
      if (parentIssue.epicId) input.epicId = parentIssue.epicId;
      return api.createIssue(input);
    },
    onSuccess: (issue) => {
      if (!parentIssue) return;
      qc.invalidateQueries({ queryKey: qk.issueSubtasks(parentIssue.id) });
      qc.invalidateQueries({ queryKey: qk.issue(parentIssue.id) });
      qc.invalidateQueries({ queryKey: qk.issueActivities(parentIssue.id) });
      qc.invalidateQueries({ queryKey: [server(), 'issues'] });
      qc.invalidateQueries({ queryKey: qk.project(issue.projectId) });
      qc.invalidateQueries({ queryKey: qk.sprints(issue.projectId) });
      qc.invalidateQueries({ queryKey: qk.projects() });
    },
  });
}

export function useUpdateSubIssueStatus(parentIssueId: string | null) {
  const qc = useQueryClient();
  return useMutation({
    mutationKey: ['updateSubIssueStatus', parentIssueId ?? 'none'],
    mutationFn: ({ issueId, status }: { issueId: string; status: IssueStatusCategory }) =>
      api.updateIssue(issueId, { status }),
    onSuccess: (issue) => {
      if (parentIssueId) {
        qc.invalidateQueries({ queryKey: qk.issueSubtasks(parentIssueId) });
        qc.invalidateQueries({ queryKey: qk.issueActivities(parentIssueId) });
      }
      qc.setQueryData(qk.issue(issue.id), issue);
      qc.invalidateQueries({ queryKey: [server(), 'issues'] });
      qc.invalidateQueries({ queryKey: qk.project(issue.projectId) });
      qc.invalidateQueries({ queryKey: qk.sprints(issue.projectId) });
      qc.invalidateQueries({ queryKey: qk.projects() });
    },
  });
}

export function useCreateProject() {
  const qc = useQueryClient();
  return useMutation({
    mutationKey: ['createProject'],
    mutationFn: (input: CreateProjectInput) => api.createProject(input),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: qk.projects() });
      qc.invalidateQueries({ queryKey: [server(), 'issues'] });
    },
  });
}

export function useAcceptProjectInviteLink() {
  const qc = useQueryClient();
  return useMutation({
    mutationKey: ['acceptProjectInviteLink'],
    mutationFn: (projectInviteToken: string) => api.acceptProjectInviteLink(projectInviteToken),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: qk.projects() });
      qc.invalidateQueries({ queryKey: [server(), 'issues'] });
    },
  });
}

export function useUpdateProject(projectId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationKey: ['updateProject', projectId],
    mutationFn: (patch: UpdateProjectInput) => api.updateProject(projectId, patch),
    onSuccess: (project) => {
      qc.setQueryData(qk.project(projectId), project);
      qc.invalidateQueries({ queryKey: qk.projects() });
      qc.invalidateQueries({ queryKey: [server(), 'issues'] });
    },
  });
}

export function useCreateProjectComponent(projectId: string | null) {
  const qc = useQueryClient();
  return useMutation({
    mutationKey: ['createProjectComponent', projectId],
    mutationFn: (input: CreateProjectComponentInput) =>
      api.createProjectComponent(projectId ?? '', input),
    onSuccess: (component) => {
      qc.setQueryData<ProjectComponent[]>(qk.projectComponents(projectId), (current) => [
        ...(current ?? []),
        component,
      ]);
      qc.invalidateQueries({ queryKey: qk.projectComponents(projectId) });
    },
  });
}

export function useUpdateProjectComponent(projectId: string | null) {
  const qc = useQueryClient();
  return useMutation({
    mutationKey: ['updateProjectComponent', projectId],
    mutationFn: ({
      componentId,
      patch,
    }: {
      componentId: string;
      patch: UpdateProjectComponentInput;
    }) => api.updateProjectComponent(projectId ?? '', componentId, patch),
    onSuccess: (component) => {
      qc.setQueryData<ProjectComponent[]>(qk.projectComponents(projectId), (current) =>
        current?.map((item) => (item.id === component.id ? component : item)),
      );
      qc.invalidateQueries({ queryKey: qk.projectComponents(projectId) });
      qc.invalidateQueries({ queryKey: [server(), 'issue'] });
    },
  });
}

export function useDeleteProjectComponent(projectId: string | null) {
  const qc = useQueryClient();
  return useMutation({
    mutationKey: ['deleteProjectComponent', projectId],
    mutationFn: (componentId: string) => api.deleteProjectComponent(projectId ?? '', componentId),
    onSuccess: (_result, componentId) => {
      qc.setQueryData<ProjectComponent[]>(qk.projectComponents(projectId), (current) =>
        current?.filter((item) => item.id !== componentId),
      );
      qc.invalidateQueries({ queryKey: qk.projectComponents(projectId) });
      qc.invalidateQueries({ queryKey: [server(), 'issue'] });
    },
  });
}

export function useCreateProjectModule(projectId: string | null) {
  const qc = useQueryClient();
  return useMutation({
    mutationKey: ['createProjectModule', projectId],
    mutationFn: (input: CreateProjectModuleInput) =>
      api.createProjectModule(projectId ?? '', input),
    onSuccess: (module) => {
      qc.setQueryData<ProjectModule[]>(qk.projectModules(projectId), (current) => [
        module,
        ...(current ?? []),
      ]);
      qc.invalidateQueries({ queryKey: qk.projectModules(projectId) });
    },
  });
}

export function useUpdateProjectModule(projectId: string | null) {
  const qc = useQueryClient();
  return useMutation({
    mutationKey: ['updateProjectModule', projectId],
    mutationFn: ({ moduleId, patch }: { moduleId: string; patch: UpdateProjectModuleInput }) =>
      api.updateProjectModule(projectId ?? '', moduleId, patch),
    onSuccess: (module) => {
      qc.setQueryData<ProjectModule[]>(qk.projectModules(projectId), (current) =>
        current?.map((item) => (item.id === module.id ? module : item)),
      );
      qc.invalidateQueries({ queryKey: qk.projectModules(projectId) });
    },
  });
}

export function useDeleteProjectModule(projectId: string | null) {
  const qc = useQueryClient();
  return useMutation({
    mutationKey: ['deleteProjectModule', projectId],
    mutationFn: (moduleId: string) => api.deleteProjectModule(projectId ?? '', moduleId),
    onSuccess: (_result, moduleId) => {
      qc.setQueryData<ProjectModule[]>(qk.projectModules(projectId), (current) =>
        current?.filter((item) => item.id !== moduleId),
      );
      qc.invalidateQueries({ queryKey: qk.projectModules(projectId) });
    },
  });
}

export function useCreateProjectView(projectId: string | null, teamId?: string | null) {
  const qc = useQueryClient();
  return useMutation({
    mutationKey: ['createProjectView', projectId, teamId ?? null],
    mutationFn: (input: CreateProjectViewInput) => api.createProjectView(projectId ?? '', input),
    onSuccess: (view) => {
      qc.setQueryData<ProjectViewsResponse>(qk.projectViews(projectId, teamId), (current) =>
        current
          ? { ...current, views: [view, ...current.views] }
          : {
              viewerId: '',
              project: { id: projectId ?? '', key: '', name: '', teamId: null },
              views: [view],
            },
      );
      qc.invalidateQueries({ queryKey: qk.projectViews(projectId, teamId) });
    },
  });
}

export function useUpdateProjectView(projectId: string | null, teamId?: string | null) {
  const qc = useQueryClient();
  return useMutation({
    mutationKey: ['updateProjectView', projectId, teamId ?? null],
    mutationFn: ({ viewId, patch }: { viewId: string; patch: UpdateProjectViewInput }) =>
      api.updateProjectView(projectId ?? '', viewId, patch),
    onSuccess: (view) => {
      qc.setQueryData<ProjectViewsResponse>(qk.projectViews(projectId, teamId), (current) =>
        current
          ? { ...current, views: current.views.map((item) => (item.id === view.id ? view : item)) }
          : current,
      );
      qc.invalidateQueries({ queryKey: qk.projectViews(projectId, teamId) });
    },
  });
}

export function useDeleteProjectView(projectId: string | null, teamId?: string | null) {
  const qc = useQueryClient();
  return useMutation({
    mutationKey: ['deleteProjectView', projectId, teamId ?? null],
    mutationFn: (viewId: string) => api.deleteProjectView(projectId ?? '', viewId),
    onSuccess: (_result, viewId) => {
      qc.setQueryData<ProjectViewsResponse>(qk.projectViews(projectId, teamId), (current) =>
        current
          ? { ...current, views: current.views.filter((view) => view.id !== viewId) }
          : current,
      );
      qc.invalidateQueries({ queryKey: qk.projectViews(projectId, teamId) });
    },
  });
}

export function useMarkProjectViewUsed() {
  return useMutation({
    mutationKey: ['markProjectViewUsed'],
    mutationFn: (viewId: string) => api.markProjectViewUsed(viewId),
  });
}

export function useCreateProjectVersion(projectId: string | null) {
  const qc = useQueryClient();
  return useMutation({
    mutationKey: ['createProjectVersion', projectId],
    mutationFn: (input: CreateProjectVersionInput) =>
      api.createProjectVersion(projectId ?? '', input),
    onSuccess: (version) => {
      qc.setQueryData<ProjectVersion[]>(qk.projectVersions(projectId), (current) => [
        ...(current ?? []),
        version,
      ]);
      qc.invalidateQueries({ queryKey: qk.projectVersions(projectId) });
    },
  });
}

export function useUpdateProjectVersion(projectId: string | null) {
  const qc = useQueryClient();
  return useMutation({
    mutationKey: ['updateProjectVersion', projectId],
    mutationFn: ({ versionId, patch }: { versionId: string; patch: UpdateProjectVersionInput }) =>
      api.updateProjectVersion(projectId ?? '', versionId, patch),
    onSuccess: (version) => {
      qc.setQueryData<ProjectVersion[]>(qk.projectVersions(projectId), (current) =>
        current?.map((item) =>
          item.id === version.id ? mergeProjectVersionCounts(item, version) : item,
        ),
      );
      qc.invalidateQueries({ queryKey: qk.projectVersions(projectId) });
      qc.invalidateQueries({ queryKey: [server(), 'issue'] });
    },
  });
}

export function useReleaseProjectVersion(projectId: string | null) {
  const qc = useQueryClient();
  return useMutation({
    mutationKey: ['releaseProjectVersion', projectId],
    mutationFn: ({ versionId, input }: { versionId: string; input?: ReleaseProjectVersionInput }) =>
      api.releaseProjectVersion(projectId ?? '', versionId, input),
    onSuccess: (version) => {
      qc.setQueryData<ProjectVersion[]>(qk.projectVersions(projectId), (current) =>
        current?.map((item) =>
          item.id === version.id ? mergeProjectVersionCounts(item, version) : item,
        ),
      );
      qc.invalidateQueries({ queryKey: qk.projectVersions(projectId) });
      qc.invalidateQueries({ queryKey: [server(), 'issues'] });
      qc.invalidateQueries({ queryKey: [server(), 'issue'] });
    },
  });
}

export function useDeleteProjectVersion(projectId: string | null) {
  const qc = useQueryClient();
  return useMutation({
    mutationKey: ['deleteProjectVersion', projectId],
    mutationFn: (versionId: string) => api.deleteProjectVersion(projectId ?? '', versionId),
    onSuccess: (_result, versionId) => {
      qc.setQueryData<ProjectVersion[]>(qk.projectVersions(projectId), (current) =>
        current?.filter((item) => item.id !== versionId),
      );
      qc.invalidateQueries({ queryKey: qk.projectVersions(projectId) });
      qc.invalidateQueries({ queryKey: [server(), 'issues'] });
      qc.invalidateQueries({ queryKey: [server(), 'issue'] });
    },
  });
}

export function useUpdateProjectWorkflowTransitions(projectId: string | null) {
  const qc = useQueryClient();
  return useMutation({
    mutationKey: ['updateProjectWorkflowTransitions', projectId],
    mutationFn: (transitions: UpdateProjectWorkflowTransitionInput[]) =>
      api.updateProjectWorkflowTransitions(projectId ?? '', transitions),
    onSuccess: (transitions) => {
      qc.setQueryData<ProjectWorkflowTransitionsResponse>(
        qk.projectWorkflowTransitions(projectId),
        (current) => ({
          statuses: current?.statuses ?? [],
          transitions,
        }),
      );
      qc.invalidateQueries({ queryKey: qk.projectWorkflowTransitions(projectId) });
      qc.invalidateQueries({ queryKey: qk.projectWorkflowStatuses(projectId) });
      qc.invalidateQueries({ queryKey: [server(), 'issues'] });
      qc.invalidateQueries({ queryKey: [server(), 'issue'] });
    },
  });
}

export function useCreateSprint(projectId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationKey: ['createSprint', projectId],
    mutationFn: (input: Omit<CreateSprintInput, 'projectId'>) =>
      api.createSprint({ ...input, projectId }),
    onSuccess: (sprint) => {
      qc.setQueryData<Sprint[]>(qk.sprints(projectId), (current) => [sprint, ...(current ?? [])]);
      qc.setQueryData<Sprint>(qk.sprint(sprint.id), sprint);
      qc.invalidateQueries({ queryKey: qk.sprints(projectId) });
      qc.invalidateQueries({ queryKey: qk.project(projectId) });
      qc.invalidateQueries({ queryKey: qk.projects() });
    },
  });
}

export function useUpdateSprint(projectId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationKey: ['updateSprint', projectId],
    mutationFn: ({ sprintId, patch }: { sprintId: string; patch: UpdateSprintInput }) =>
      api.updateSprint(sprintId, patch),
    onSuccess: (sprint) => {
      qc.setQueryData<Sprint[]>(qk.sprints(projectId), (current) =>
        current?.map((item) => (item.id === sprint.id ? sprint : item)),
      );
      qc.setQueryData<Sprint>(qk.sprint(sprint.id), sprint);
      qc.invalidateQueries({ queryKey: qk.sprints(projectId) });
      qc.invalidateQueries({ queryKey: qk.sprint(sprint.id) });
      qc.invalidateQueries({ queryKey: qk.sprintIssues(sprint.id) });
      qc.invalidateQueries({ queryKey: qk.sprintBurndown(sprint.id) });
      qc.invalidateQueries({ queryKey: qk.project(projectId) });
      qc.invalidateQueries({ queryKey: qk.projects() });
      qc.invalidateQueries({ queryKey: [server(), 'issues'] });
    },
  });
}

export function useDeleteSprint(projectId: string | null) {
  const qc = useQueryClient();
  return useMutation({
    mutationKey: ['deleteSprint', projectId],
    mutationFn: (sprintId: string) => api.deleteSprint(sprintId),
    onSuccess: (_result, sprintId) => {
      qc.setQueryData<Sprint[]>(qk.sprints(projectId), (current) =>
        current?.filter((item) => item.id !== sprintId),
      );
      qc.invalidateQueries({ queryKey: qk.sprints(projectId) });
      qc.invalidateQueries({ queryKey: qk.sprint(sprintId) });
      qc.invalidateQueries({ queryKey: qk.sprintBurndown(sprintId) });
      if (projectId) qc.invalidateQueries({ queryKey: qk.project(projectId) });
      qc.invalidateQueries({ queryKey: qk.projects() });
      qc.invalidateQueries({ queryKey: [server(), 'issues'] });
    },
  });
}

export function useAddComment(issueId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationKey: ['addComment', issueId],
    mutationFn: (input: AddCommentInput) => api.addComment(issueId, input),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: qk.comments(issueId) });
      qc.invalidateQueries({ queryKey: qk.issueActivities(issueId) });
    },
  });
}

export function useUpdateComment(issueId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationKey: ['updateComment', issueId],
    mutationFn: (input: UpdateCommentInput) => api.updateComment(issueId, input),
    onSuccess: (comment) => {
      qc.setQueryData<Comment[]>(qk.comments(issueId), (current) =>
        current?.map((item) => {
          if (item.id !== comment.id) return item;
          const next: Comment = { ...item, ...comment };
          if (comment.author === undefined && item.author !== undefined) next.author = item.author;
          if (comment.authorId === undefined && item.authorId !== undefined) {
            next.authorId = item.authorId;
          }
          return next;
        }),
      );
      qc.invalidateQueries({ queryKey: qk.comments(issueId) });
    },
  });
}

export function useDeleteComment(issueId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationKey: ['deleteComment', issueId],
    mutationFn: (commentId: string) => api.deleteComment(issueId, commentId),
    onSuccess: (_result, commentId) => {
      qc.setQueryData<Comment[]>(qk.comments(issueId), (current) =>
        current?.filter((item) => item.id !== commentId),
      );
      qc.invalidateQueries({ queryKey: qk.comments(issueId) });
    },
  });
}

type ToggleCommentReactionMutationInput = ToggleCommentReactionInput & {
  userId: string;
};

export function useToggleCommentReaction(issueId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationKey: ['toggleCommentReaction', issueId],
    mutationFn: ({ commentId, emoji }: ToggleCommentReactionMutationInput) =>
      api.toggleCommentReaction(issueId, { commentId, emoji }),
    onMutate: async ({ commentId, emoji, userId }) => {
      await qc.cancelQueries({ queryKey: qk.comments(issueId) });
      const previous = qc.getQueryData<Comment[]>(qk.comments(issueId));

      qc.setQueryData<Comment[]>(qk.comments(issueId), (current) =>
        current?.map((comment) => {
          if (comment.id !== commentId) return comment;
          const reactions = comment.reactions ?? [];
          const mine = (reaction: CommentReaction) =>
            reaction.emoji === emoji && reaction.userId === userId;
          return {
            ...comment,
            reactions: reactions.some(mine)
              ? reactions.filter((reaction) => !mine(reaction))
              : [...reactions, { emoji, userId, createdAt: new Date().toISOString() }],
          };
        }),
      );

      return { previous };
    },
    onError: (_error, _variables, context) => {
      if (context?.previous) {
        qc.setQueryData(qk.comments(issueId), context.previous);
      }
    },
    onSuccess: (result) => {
      qc.setQueryData<Comment[]>(qk.comments(issueId), (current) =>
        current?.map((comment) =>
          comment.id === result.commentId ? { ...comment, reactions: result.reactions } : comment,
        ),
      );
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: qk.comments(issueId) });
      qc.invalidateQueries({ queryKey: qk.issueActivities(issueId) });
    },
  });
}

export function useUpdateIssue(issueId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationKey: ['updateIssue', issueId],
    mutationFn: (patch: UpdateIssueInput) => api.updateIssue(issueId, patch),
    onSuccess: (issue) => {
      qc.setQueryData(qk.issue(issueId), issue);
      qc.invalidateQueries({ queryKey: [server(), 'issues'] });
      qc.invalidateQueries({ queryKey: qk.issueActivities(issueId) });
      qc.invalidateQueries({ queryKey: qk.issueTimeInStatus(issueId) });
      qc.invalidateQueries({ queryKey: qk.project(issue.projectId) });
      qc.invalidateQueries({ queryKey: qk.sprints(issue.projectId) });
      qc.invalidateQueries({ queryKey: qk.projects() });
    },
  });
}

export function useRunIssueTriage(issueId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationKey: ['runIssueTriage', issueId],
    mutationFn: () => api.runIssueTriage(issueId),
    onSuccess: (result) => {
      qc.setQueryData<IssueTriageResponse>(qk.issueTriage(issueId), (current) => ({
        suggestions: [
          result.suggestion,
          ...(current?.suggestions ?? []).filter((item) => item.id !== result.suggestion.id),
        ].slice(0, 10),
      }));
      qc.invalidateQueries({ queryKey: qk.issueTriage(issueId) });
    },
  });
}

export function useApplyIssueTriage(issueId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationKey: ['applyIssueTriage', issueId],
    mutationFn: (input: ApplyIssueTriageInput) => api.applyIssueTriageSuggestion(issueId, input),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: qk.issue(issueId) });
      qc.invalidateQueries({ queryKey: qk.issueTriage(issueId) });
      qc.invalidateQueries({ queryKey: qk.issueActivities(issueId) });
      qc.invalidateQueries({ queryKey: [server(), 'issues'] });
    },
  });
}

export function useRunIssueAssist() {
  return useMutation({
    mutationKey: ['runIssueAssist'],
    mutationFn: (input: RunIssueAssistInput) => api.runIssueAssist(input),
  });
}

export function useDraftIssueWithAi() {
  return useMutation({
    mutationKey: ['draftIssueWithAi'],
    mutationFn: (input: DraftIssueWithAiInput) => api.draftIssueWithAi(input),
  });
}

export function useAskTaskNebula() {
  return useMutation({
    mutationKey: ['askTaskNebula'],
    mutationFn: (input: AskTaskNebulaInput) => api.askTaskNebula(input),
  });
}

export function useSuggestIssueEstimate(issueId: string | null) {
  return useMutation({
    mutationKey: ['suggestIssueEstimate', issueId ?? 'none'],
    mutationFn: () => api.suggestIssueEstimate(issueId ?? ''),
  });
}

export function useDispatchIssueAgent(issueId: string | null) {
  const qc = useQueryClient();
  return useMutation({
    mutationKey: ['dispatchIssueAgent', issueId ?? 'none'],
    mutationFn: (input: DispatchIssueAgentInput) => api.dispatchIssueAgent(issueId ?? '', input),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: qk.issueAgentSessions(issueId) });
      if (issueId) {
        qc.invalidateQueries({ queryKey: qk.issue(issueId) });
      }
      qc.invalidateQueries({ queryKey: [server(), 'issues'] });
    },
  });
}

export function useAssignIssueToSprint(projectId: string | null) {
  const qc = useQueryClient();
  return useMutation({
    mutationKey: ['assignIssueToSprint', projectId],
    mutationFn: ({ issueId, sprintId }: { issueId: string; sprintId: string | null }) =>
      api.updateIssue(issueId, { sprintId }),
    onSuccess: (issue, variables) => {
      qc.setQueryData(qk.issue(issue.id), issue);
      qc.invalidateQueries({ queryKey: [server(), 'issues'] });
      qc.invalidateQueries({ queryKey: qk.issueActivities(issue.id) });
      qc.invalidateQueries({ queryKey: qk.project(issue.projectId) });
      qc.invalidateQueries({ queryKey: qk.sprints(issue.projectId) });
      if (variables.sprintId) {
        qc.invalidateQueries({ queryKey: qk.sprintIssues(variables.sprintId) });
      }
      if (issue.sprintId) {
        qc.invalidateQueries({ queryKey: qk.sprintIssues(issue.sprintId) });
      }
      qc.invalidateQueries({ queryKey: qk.projects() });
    },
  });
}

export function useSetIssueComponents(issueId?: string | null) {
  const qc = useQueryClient();
  return useMutation({
    mutationKey: ['setIssueComponents', issueId ?? 'dynamic'],
    mutationFn: ({
      targetIssueId,
      componentIds,
    }: {
      targetIssueId?: string;
      projectId?: string | null;
      componentIds: string[];
    }) => api.setIssueComponents(targetIssueId ?? issueId ?? '', componentIds),
    onSuccess: (components, vars) => {
      const targetIssueId = vars.targetIssueId ?? issueId ?? null;
      qc.setQueryData<ProjectComponent[]>(qk.issueComponents(targetIssueId), components);
      qc.invalidateQueries({ queryKey: qk.issueComponents(targetIssueId) });
      if (targetIssueId) qc.invalidateQueries({ queryKey: qk.issue(targetIssueId) });
      qc.invalidateQueries({ queryKey: [server(), 'issues'] });
      if (vars.projectId) {
        qc.invalidateQueries({ queryKey: qk.projectComponents(vars.projectId) });
      }
    },
  });
}

export function useSetIssueVersions(issueId?: string | null) {
  const qc = useQueryClient();
  return useMutation({
    mutationKey: ['setIssueVersions', issueId ?? 'dynamic'],
    mutationFn: ({
      targetIssueId,
      fixVersionIds,
      affectsVersionIds,
    }: {
      targetIssueId?: string;
      projectId?: string | null;
    } & SetIssueVersionsInput) => {
      const input: SetIssueVersionsInput = {};
      if (fixVersionIds !== undefined) input.fixVersionIds = fixVersionIds;
      if (affectsVersionIds !== undefined) input.affectsVersionIds = affectsVersionIds;
      return api.setIssueVersions(targetIssueId ?? issueId ?? '', input);
    },
    onSuccess: (versions: IssueVersions, vars) => {
      const targetIssueId = vars.targetIssueId ?? issueId ?? null;
      qc.setQueryData<IssueVersions>(qk.issueVersions(targetIssueId), versions);
      qc.invalidateQueries({ queryKey: qk.issueVersions(targetIssueId) });
      if (targetIssueId) qc.invalidateQueries({ queryKey: qk.issue(targetIssueId) });
      qc.invalidateQueries({ queryKey: [server(), 'issues'] });
      if (vars.projectId) {
        qc.invalidateQueries({ queryKey: qk.projectVersions(vars.projectId) });
      }
    },
  });
}

export function useSetIssueCustomFieldValue(issueId?: string | null) {
  const qc = useQueryClient();
  return useMutation({
    mutationKey: ['setIssueCustomFieldValue', issueId ?? 'dynamic'],
    mutationFn: ({
      targetIssueId,
      customFieldId,
      value,
    }: {
      targetIssueId?: string;
      projectId?: string | null;
    } & SetIssueCustomFieldValueInput) =>
      api.setIssueCustomFieldValue(targetIssueId ?? issueId ?? '', { customFieldId, value }),
    onSuccess: (_result, vars) => {
      const targetIssueId = vars.targetIssueId ?? issueId ?? null;
      qc.invalidateQueries({ queryKey: qk.issueCustomFieldValues(targetIssueId) });
      if (targetIssueId) qc.invalidateQueries({ queryKey: qk.issue(targetIssueId) });
      qc.invalidateQueries({ queryKey: [server(), 'issues'] });
    },
  });
}

export function useCreateIssueLink(issueId?: string | null) {
  const qc = useQueryClient();
  return useMutation({
    mutationKey: ['createIssueLink', issueId ?? 'dynamic'],
    mutationFn: ({
      targetIssueId,
      type,
      targetIssueKey,
    }: {
      targetIssueKey?: string | null;
    } & CreateIssueLinkInput) =>
      api.createIssueLink(issueId ?? '', { targetIssueId, type }).then((result) => ({
        ...result,
        targetIssueId,
        targetIssueKey: targetIssueKey ?? null,
      })),
    onSuccess: (result) => {
      qc.invalidateQueries({ queryKey: qk.issueLinks(issueId ?? null) });
      qc.invalidateQueries({ queryKey: qk.issueLinks(result.targetIssueId) });
      qc.invalidateQueries({ queryKey: qk.issueActivities(issueId ?? null) });
      if (issueId) qc.invalidateQueries({ queryKey: qk.issue(issueId) });
      qc.invalidateQueries({ queryKey: [server(), 'issues'] });
    },
  });
}

export function useDeleteIssueLink(issueId?: string | null) {
  const qc = useQueryClient();
  return useMutation({
    mutationKey: ['deleteIssueLink', issueId ?? 'dynamic'],
    mutationFn: (linkId: string) => api.deleteIssueLink(issueId ?? '', linkId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: qk.issueLinks(issueId ?? null) });
      qc.invalidateQueries({ queryKey: qk.issueActivities(issueId ?? null) });
      if (issueId) qc.invalidateQueries({ queryKey: qk.issue(issueId) });
      qc.invalidateQueries({ queryKey: [server(), 'issues'] });
    },
  });
}

export function useAttachIssueDocument(issueId?: string | null) {
  const qc = useQueryClient();
  return useMutation({
    mutationKey: ['attachIssueDocument', issueId ?? 'dynamic'],
    mutationFn: (input: AttachIssueDocumentInput) => api.attachIssueDocument(issueId ?? '', input),
    onSuccess: (result) => {
      qc.invalidateQueries({ queryKey: qk.issueDocuments(issueId ?? null) });
      qc.invalidateQueries({ queryKey: qk.issueActivities(issueId ?? null) });
      if (issueId) qc.invalidateQueries({ queryKey: qk.issue(issueId) });
      if (result.page) qc.setQueryData(qk.documentPage(result.page.id), result.page);
      qc.invalidateQueries({ queryKey: [server(), 'docs'] });
    },
  });
}

export function useDetachIssueDocument(issueId?: string | null) {
  const qc = useQueryClient();
  return useMutation({
    mutationKey: ['detachIssueDocument', issueId ?? 'dynamic'],
    mutationFn: (pageId: string) => api.detachIssueDocument(issueId ?? '', pageId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: qk.issueDocuments(issueId ?? null) });
      qc.invalidateQueries({ queryKey: qk.issueActivities(issueId ?? null) });
      if (issueId) qc.invalidateQueries({ queryKey: qk.issue(issueId) });
      qc.invalidateQueries({ queryKey: [server(), 'docs'] });
    },
  });
}

export function useUploadIssueAttachment(issueId?: string | null) {
  const qc = useQueryClient();
  return useMutation({
    mutationKey: ['uploadIssueAttachment', issueId ?? 'dynamic'],
    mutationFn: (input: UploadIssueAttachmentInput) =>
      api.uploadIssueAttachment(issueId ?? '', input),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: qk.issueAttachments(issueId ?? null) });
      qc.invalidateQueries({ queryKey: qk.issueActivities(issueId ?? null) });
      if (issueId) qc.invalidateQueries({ queryKey: qk.issue(issueId) });
    },
  });
}

export function useDeleteIssueAttachment(issueId?: string | null) {
  const qc = useQueryClient();
  return useMutation({
    mutationKey: ['deleteIssueAttachment', issueId ?? 'dynamic'],
    mutationFn: (attachmentId: string) => api.deleteIssueAttachment(issueId ?? '', attachmentId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: qk.issueAttachments(issueId ?? null) });
      qc.invalidateQueries({ queryKey: qk.issueActivities(issueId ?? null) });
      if (issueId) qc.invalidateQueries({ queryKey: qk.issue(issueId) });
    },
  });
}

function invalidateIssueTimeTracking(qc: QueryClient, issueId: string | null) {
  qc.invalidateQueries({ queryKey: qk.issueTimeEntries(issueId) });
  if (issueId) qc.invalidateQueries({ queryKey: qk.issue(issueId) });
  qc.invalidateQueries({ queryKey: [server(), 'issues'] });
}

export function useStartIssueTimer(issueId?: string | null) {
  const qc = useQueryClient();
  return useMutation({
    mutationKey: ['startIssueTimer', issueId ?? 'dynamic'],
    mutationFn: () => api.startIssueTimer(issueId ?? ''),
    onSuccess: () => {
      invalidateIssueTimeTracking(qc, issueId ?? null);
    },
  });
}

export function useStopIssueTimer(issueId?: string | null) {
  const qc = useQueryClient();
  return useMutation({
    mutationKey: ['stopIssueTimer', issueId ?? 'dynamic'],
    mutationFn: (input: StopIssueTimerInput = {}) => api.stopIssueTimer(issueId ?? '', input),
    onSuccess: () => {
      invalidateIssueTimeTracking(qc, issueId ?? null);
    },
  });
}

export function useLogIssueTimeEntry(issueId?: string | null) {
  const qc = useQueryClient();
  return useMutation({
    mutationKey: ['logIssueTimeEntry', issueId ?? 'dynamic'],
    mutationFn: (input: LogIssueTimeEntryInput) => api.logIssueTimeEntry(issueId ?? '', input),
    onSuccess: () => {
      invalidateIssueTimeTracking(qc, issueId ?? null);
    },
  });
}

export function useDeleteIssue(issueId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationKey: ['deleteIssue', issueId],
    mutationFn: () => api.deleteIssue(issueId),
    onSuccess: () => {
      qc.removeQueries({ queryKey: qk.issue(issueId) });
      qc.removeQueries({ queryKey: qk.comments(issueId) });
      qc.removeQueries({ queryKey: qk.watchers(issueId) });
      qc.invalidateQueries({ queryKey: [server(), 'issues'] });
      qc.invalidateQueries({ queryKey: qk.projects() });
    },
  });
}

export function useAddIssueWatcher(issueId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationKey: ['addIssueWatcher', issueId],
    mutationFn: () => api.addIssueWatcher(issueId),
    onSuccess: (watcher) => {
      qc.setQueryData<Watcher[]>(qk.watchers(issueId), (current) => {
        if (!watcher) return current;
        if (current?.some((item) => item.id === watcher.id || item.userId === watcher.userId)) {
          return current;
        }
        return [...(current ?? []), watcher];
      });
      qc.invalidateQueries({ queryKey: qk.watchers(issueId) });
    },
  });
}

export function useRemoveIssueWatcher(issueId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationKey: ['removeIssueWatcher', issueId],
    mutationFn: () => api.removeIssueWatcher(issueId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: qk.watchers(issueId) });
    },
  });
}

export function useMarkNotificationRead() {
  const qc = useQueryClient();
  return useMutation({
    mutationKey: ['markNotificationRead'],
    mutationFn: (notificationId: string) => api.markNotificationRead(notificationId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [server(), 'inbox'] });
    },
  });
}

export function useSnoozeInboxNotification() {
  const qc = useQueryClient();
  return useMutation({
    mutationKey: ['snoozeInboxNotification'],
    mutationFn: api.snoozeInboxNotification,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [server(), 'inbox'] });
    },
  });
}

export function useLoadInboxPage() {
  return useMutation({
    mutationKey: ['loadInboxPage'],
    mutationFn: api.listInboxPage,
  });
}

export function useMarkInboxRead() {
  const qc = useQueryClient();
  return useMutation({
    mutationKey: ['markInboxRead'],
    mutationFn: api.markInboxRead,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [server(), 'inbox'] });
    },
  });
}

export function useUpdateNotificationPreferences(organizationId: string | null) {
  const qc = useQueryClient();
  return useMutation({
    mutationKey: ['updateNotificationPreferences', organizationId],
    mutationFn: (input: UpdateNotificationPreferencesInput) =>
      api.updateNotificationPreferences(input),
    onSuccess: (preferences) => {
      qc.setQueryData<NotificationPreferences>(
        qk.notificationPreferences(organizationId),
        preferences,
      );
      qc.invalidateQueries({ queryKey: qk.notificationPreferences(organizationId) });
    },
  });
}

export function useUpdateUserAppearance() {
  const qc = useQueryClient();
  return useMutation({
    mutationKey: ['updateUserAppearance'],
    mutationFn: (input: UpdateUserAppearanceInput) => api.updateUserAppearance(input),
    onSuccess: (settings) => {
      qc.setQueryData<UserAppearanceSettings>(qk.userAppearance(), settings);
      qc.invalidateQueries({ queryKey: qk.userAppearance() });
    },
  });
}
