/** Typed wrappers over the TaskNebula REST endpoints the app uses. */
import i18next from 'i18next';
import { ApiError, apiFormData, apiJson, apiText } from './client';
import type {
  AdminAgentControlResponse,
  AdminAgentControlSettings,
  AdminAgentControlStats,
  AdminAgentProviderBreakdownItem,
  AdminAgentProviderStatus,
  AdminAgentRecentRun,
  AdminAgentServiceStatus,
  AdminAgentWorkspaceCoverage,
  AgentApprovalDecisionResult,
  AgentApprovalRequest,
  AgentApprovalStatus,
  AgentPolicyParseError,
  AgentPolicyRule,
  AgentPolicyStatus,
  AdminAiActualUsage,
  AdminAiFeatureUsage,
  AdminAiKillSwitchResult,
  AdminAiReservedUsage,
  AdminAiUsageHistoryEntry,
  AdminAiUsageLimits,
  AdminAiUsageOrganization,
  AdminAiUsageResetResult,
  AdminAiUsageResetScope,
  AdminAiUsageResponse,
  AutomationExecution,
  AutomationRule,
  AutomationRuleAction,
  AutomationRuleTrigger,
  AdminDirectoryOwner,
  AdminDirectoryPagination,
  AdminFeatureFlag,
  AdminOrganizationPlan,
  AdminOrganizationStatus,
  AdminOrganizationsResponse,
  AdminOrganizationSummary,
  AdminRealtimeHealth,
  AdminSelfUpdateStatus,
  AdminLivekitConfig,
  AdminSmtpConfig,
  AdminStatsResponse,
  AdminStorageConfig,
  AdminSystemTestResult,
  AdminUserLastActivity,
  AdminUserOrganizationMembership,
  AdminUserProjectMembership,
  AdminUsersResponse,
  AdminUserStatus,
  AdminUserSummary,
  AdminVersionImageStatus,
  AdminVersionStatus,
  AgentSessionProvider,
  AgentSessionState,
  AiEstimateSuggestion,
  AiCapability,
  AiIssueDraftResponse,
  ApiKey,
  AskCitation,
  AskCitationSource,
  AskScope,
  AskTaskNebulaResponse,
  AskUsage,
  AgentModelConfig,
  ApplyIssueTriageResponse,
  AuditLogSink,
  AuditLogSinksResponse,
  AuditLogSinkTestResult,
  AuditLogSinkType,
  AuditLogEntry,
  Comment,
  CommentReaction,
  ComponentDefaultAssigneeType,
  ConversationAttachment,
  ConversationAuthor,
  ConversationCallLeaveResponse,
  ConversationCallPulseResponse,
  ConversationCallStartResponse,
  ConversationCallToken,
  ConversationMessage,
  ConversationMessagesPage,
  ConversationModerationSnapshot,
  ConversationReaction,
  CreatedAuditLogSink,
  CatchMeUpActionItem,
  CatchMeUpDigest,
  CustomField,
  CreateDocumentPageInput,
  DigestFrequency,
  DocumentAttachment,
  DocumentPage,
  DocumentPagesResponse,
  DocumentPageSummary,
  DocumentRevision,
  DocumentRevisionAuthor,
  DocumentSearchResponse,
  DocumentScopeParams,
  DocumentSpace,
  DocumentTreeNode,
  DocumentTreeResponse,
  DispatchIssueAgentResult,
  DoraAnalytics,
  Draft,
  DraftEntityType,
  GlobalLiveCall,
  Initiative,
  InitiativeDetail,
  InitiativeRollup,
  InitiativeRollupProject,
  InitiativeUpdate,
  ImportJobError,
  ImportJobStatus,
  ImportPreviewRecord,
  ImportPreviewResponse,
  ImportRunResponse,
  ImportSource,
  InboxFilters,
  InboxPage,
  IntakeFieldDefinition,
  IntakeForm,
  Issue,
  IssueActivity,
  IssueAgentSession,
  IssueAgentSessionsResponse,
  IssueAttachment,
  IssueAssistAction,
  IssueAssistResult,
  IssueCustomFieldValue,
  IssueDocument,
  IssueLink,
  IssueLinksData,
  IssueLinkType,
  IssueTimeInStatusBucket,
  IssueTriagePayload,
  IssueTriageResponse,
  IssueTriageSuggestion,
  IssueListResponse,
  IssuePriority,
  IssueResolution,
  MyIssueView,
  MyIssuesResponse,
  MyWorkloadResponse,
  MyWorkloadWindow,
  IssueVersions,
  IssueType,
  Label,
  LinkedIssue,
  ModuleStatus,
  NotificationItem,
  NotificationPreferences,
  Organization,
  OrganizationAgentAccess,
  OrganizationAgentConfigIssue,
  OrganizationAgentRecentRun,
  OrganizationAgentRuntimeSummary,
  OrganizationAgentSettingsResponse,
  OrganizationAgentWorkspaceSettings,
  OrganizationMember,
  OrganizationsResponse,
  PermissionScheme,
  PinnedItem,
  PinnedItemKind,
  Project,
  ProjectAnalyticsResponse,
  ProjectAgentAccess,
  ProjectAgentEffectiveSettings,
  ProjectAgentRunAvailability,
  ProjectAgentRuntimeSummary,
  ProjectAgentSettings,
  ProjectAgentSettingsResponse,
  ProjectInviteAcceptResult,
  ProjectInviteLink,
  ProjectCycleTimeAnalytics,
  ProjectForecastAnalytics,
  ProjectForecastHistogramBucket,
  ProjectPermissionSchemeState,
  ProjectRole,
  ProjectSecuritySchemeState,
  ProjectChatActiveCall,
  ProjectChatBootstrap,
  ProjectChatChannel,
  ProjectChatDiscussion,
  ProjectChatPermissions,
  ProjectChatSettings,
  ProjectCommunicationsSettings,
  ProjectCommunicationsSettingsResponse,
  ProjectComponent,
  ProjectHealthAnalytics,
  ProjectHealthPriorityBucket,
  ProjectHealthStatusBucket,
  ProjectHealthTypeBucket,
  ProjectMember,
  ProjectModule,
  ProjectThroughputAnalytics,
  ProjectThroughputBucket,
  ProjectView,
  ProjectViewsResponse,
  ProjectViewScope,
  ProjectViewType,
  ProjectVersion,
  ProjectVersionStatus,
  ProjectVelocityAnalytics,
  ProjectVelocitySprint,
  PublicDocumentAttachment,
  PublicDocumentPage,
  RestoreDocumentRevisionInput,
  PublicIntakeForm,
  PublicIntakeFormResponse,
  RecentActivity,
  RunIssueTriageResponse,
  RegistrationMode,
  RegistrationPolicy,
  SavedIssueFilter,
  SearchHistoryEntry,
  SearchResponse,
  SearchResult,
  CreatedScimToken,
  ScimToken,
  ScimTokensResponse,
  SecurityLevel,
  SecurityLevelMember,
  SecurityLevelMemberType,
  SecurityScheme,
  Sprint,
  SprintBurndownAnalytics,
  SprintBurndownHours,
  SprintBurndownPoint,
  SprintStatus,
  SsoConfig,
  SsoConfigResponse,
  StandupDigest,
  SsoProvider,
  SubmitPublicIntakeResult,
  SystemAuditLogEntry,
  Teamspace,
  TeamspaceLead,
  TeamspaceMember,
  TeamspaceMembersResponse,
  TeamspaceMemberRole,
  TemplateKind,
  TemplatesListResponse,
  TimeEntry,
  UpdateDocumentPageInput,
  UpdateDocumentShareInput,
  UpdateOrganizationAgentSettingsInput,
  UpdateProjectAgentSettingsInput,
  UpdateProjectCommunicationsSettingsInput,
  UpdateWorkspaceCommunicationsSettingsInput,
  UseTemplateOverrides,
  UseTemplateResult,
  User,
  UserAppearanceColorTheme,
  UserAppearanceInterfaceFont,
  UserAppearanceSettings,
  UserAppearanceTheme,
  UserAppearanceVisualStyle,
  Watcher,
  Webhook,
  WebhookTestResult,
  WorkspaceIntegrationAuthorizeResponse,
  WorkspaceIntegrationConnection,
  WorkspaceIntegrationProvider,
  WorkspaceIntegrationStatus,
  WorkspaceCommunicationsServiceStatus,
  WorkspaceCommunicationsSettings,
  WorkspaceCommunicationsSettingsResponse,
  WorkTemplate,
  WorkflowStatus,
  WorkflowTransition,
  ProjectWorkflowTransitionsResponse,
} from './types';

export { documentTextToContentJson } from '@/lib/document-content';

export type {
  CreateDocumentPageInput,
  DraftEntityType,
  RestoreDocumentRevisionInput,
  UpdateDocumentPageInput,
  UpdateDocumentShareInput,
  UpdateOrganizationAgentSettingsInput,
  UpdateProjectAgentSettingsInput,
  UpdateProjectCommunicationsSettingsInput,
  UpdateWorkspaceCommunicationsSettingsInput,
  UseTemplateOverrides,
} from './types';

export const me = () => apiJson<User>('/api/user/me');

export const getAiCapability = (organizationId?: string | null) => {
  const q = new URLSearchParams();
  if (organizationId) q.set('organizationId', organizationId);
  const qs = q.toString();
  return apiJson<RawAiCapability>(`/api/ai/capability${qs ? `?${qs}` : ''}`).then(
    normalizeAiCapability,
  );
};

export interface RunIssueAssistInput {
  issueId: string;
  action: IssueAssistAction;
  customPrompt?: string | null;
  provider?: 'native' | 'openai' | 'anthropic';
}

export const runIssueAssist = (input: RunIssueAssistInput): Promise<IssueAssistResult> =>
  apiJson<RawIssueAssistResult>('/api/ai/issue-assist', {
    method: 'POST',
    body: JSON.stringify(input),
  }).then(normalizeIssueAssistResult);

export const draftIssueWithAi = (input: DraftIssueWithAiInput): Promise<AiIssueDraftResponse> =>
  apiJson<RawAiIssueDraftResponse>('/api/ai/draft-issue', {
    method: 'POST',
    body: JSON.stringify(input),
  }).then(normalizeAiIssueDraftResponse);

export const askTaskNebula = (input: AskTaskNebulaInput): Promise<AskTaskNebulaResponse> =>
  apiText('/api/ask', {
    method: 'POST',
    body: JSON.stringify({
      query: input.query,
      ...(input.organizationId ? { organizationId: input.organizationId } : {}),
      ...(input.projectId ? { projectId: input.projectId } : {}),
      ...(input.scope ? { scope: input.scope } : {}),
    }),
  }).then(parseAskSse);

export interface DispatchIssueAgentInput {
  provider: AgentSessionProvider;
  promptOverride?: string;
}

export interface DraftIssueWithAiInput {
  projectId: string;
  prompt: string;
  provider?: 'native' | 'openai' | 'anthropic';
}

export interface AskTaskNebulaInput {
  query: string;
  organizationId?: string | null;
  projectId?: string | null;
  scope?: AskScope;
}

type RawUser = Partial<User> | null | undefined;
type RawIssue = Omit<Partial<Issue>, 'storyPoints' | 'customFields'> & {
  status?: Issue['status'] | string | null;
  statusName?: string | null;
  statusColor?: string | null;
  reporterId?: string | null;
  project?: Issue['project'];
  storyPoints?: number | string | null;
  estimateHours?: number | string | null;
  actualHours?: number | string | null;
  customFields?: unknown;
};
type RawMyWorkloadResponse = Omit<
  Partial<MyWorkloadResponse>,
  'total' | 'overdue' | 'dueSoon' | 'issues'
> & {
  total?: number | string | null;
  overdue?: number | string | null;
  dueSoon?: number | string | null;
  issues?: unknown;
};
type RawLinkedIssue = Partial<LinkedIssue>;
type RawIssueLink = Omit<Partial<IssueLink>, 'issue'> & {
  issue?: RawLinkedIssue | null;
};
type RawIssueActivity = Partial<Omit<IssueActivity, 'user'>> & {
  user?: RawUser;
  createdAt?: string | Date;
  updatedAt?: string | Date;
};
type RawRecentActivity = Partial<Omit<RecentActivity, 'user' | 'issue' | 'createdAt'>> & {
  user?: RawUser;
  issue?: {
    id?: unknown;
    key?: unknown;
    title?: unknown;
  } | null;
  createdAt?: string | Date;
  messageValues?: unknown;
};
type RawIssueAttachment = Omit<Partial<IssueAttachment>, 'fileSize'> & {
  fileSize?: number | string | null;
  createdAt?: string | Date;
};
type RawUploadIssueAttachmentResponse = {
  attachment?: RawIssueAttachment;
};
type RawDocumentAttachment = Omit<Partial<DocumentAttachment>, 'fileSize'> & {
  fileSize?: number | string | null;
  createdAt?: string | Date;
};
type RawUploadDocumentAttachmentResponse = {
  attachment?: RawDocumentAttachment;
};
type RawTimeEntry = Partial<Omit<TimeEntry, 'durationSeconds'>> & {
  durationSeconds?: number | string | null;
};
type RawIssueTimeInStatusBucket = {
  status?: string | null;
  status_name?: string | null;
  status_category?: string | null;
  total_duration_seconds?: number | string | null;
  entered_at_last?: string | null;
  exit_count?: number | string | null;
};
type RawComment = Omit<Partial<Comment>, 'reactions'> & {
  author?: RawUser;
  createdByUser?: RawUser;
  user?: RawUser;
  reactions?: unknown;
};
type RawToggleCommentReactionResponse = {
  commentId?: string;
  reacted?: boolean;
  reactions?: unknown;
};
type RawIntegrationConnection = {
  id?: unknown;
  provider?: unknown;
  externalAccountId?: unknown;
  externalAccountLabel?: unknown;
  scope?: unknown;
  metadata?: unknown;
  connectedById?: unknown;
  createdAt?: unknown;
  updatedAt?: unknown;
  siteUrl?: unknown;
  siteName?: unknown;
};
type RawIntegrationStatus = RawIntegrationConnection & {
  connected?: unknown;
  connection?: RawIntegrationConnection | null;
};
type RawProjectMember = Partial<ProjectMember> & {
  user?: RawUser;
  userId?: string | null;
  permissions?: unknown;
};
type RawProjectInviteLink = Partial<ProjectInviteLink> & {
  role?: unknown;
  maxUses?: unknown;
  usedCount?: unknown;
  expiresAt?: unknown;
  revokedAt?: unknown;
  createdAt?: unknown;
  updatedAt?: unknown;
  createdBy?: unknown;
  creatorName?: unknown;
  creatorEmail?: unknown;
};
type RawPermissionScheme = Omit<
  Partial<PermissionScheme>,
  'permissions' | 'isDefault' | 'projectCount' | 'createdAt' | 'updatedAt'
> & {
  permissions?: unknown;
  isDefault?: unknown;
  projectCount?: number | string | null;
  createdAt?: string | Date | null;
  updatedAt?: string | Date | null;
};
type RawProjectPermissionSchemeState = Omit<Partial<ProjectPermissionSchemeState>, 'scheme'> & {
  scheme?: RawPermissionScheme | null;
};
type RawSecurityLevelMember = Partial<SecurityLevelMember> & {
  id?: string | null;
  memberType?: SecurityLevelMemberType | null;
  memberValue?: string | null;
};
type RawSecurityLevel = Omit<Partial<SecurityLevel>, 'members' | 'isDefault' | 'sortOrder'> & {
  members?: RawSecurityLevelMember[] | null;
  isDefault?: unknown;
  sortOrder?: number | string | null;
};
type RawSecurityScheme = Omit<
  Partial<SecurityScheme>,
  'levels' | 'isDefault' | 'projectCount' | 'createdAt' | 'updatedAt'
> & {
  levels?: RawSecurityLevel[] | null;
  isDefault?: unknown;
  projectCount?: number | string | null;
  createdAt?: string | Date | null;
  updatedAt?: string | Date | null;
};
type RawProjectSecuritySchemeState = Omit<Partial<ProjectSecuritySchemeState>, 'scheme'> & {
  scheme?: RawSecurityScheme | null;
};
type RawAutomationRule = Omit<
  Partial<AutomationRule>,
  'trigger' | 'conditions' | 'actions' | 'enabled' | 'createdAt' | 'updatedAt'
> & {
  trigger?: unknown;
  conditions?: unknown;
  actions?: unknown;
  enabled?: unknown;
  createdAt?: string | Date | null;
  updatedAt?: string | Date | null;
};
type RawAutomationExecution = Omit<
  Partial<AutomationExecution>,
  'durationMs' | 'triggerPayload' | 'actionResults'
> & {
  triggerPayload?: unknown;
  actionResults?: unknown;
  durationMs?: number | string | null;
};
type RawIntakeForm = Omit<Partial<IntakeForm>, 'fields'> & {
  fields?: unknown;
  createdAt?: string | Date;
  updatedAt?: string | Date;
};
type RawPublicIntakeForm = Omit<Partial<PublicIntakeForm>, 'fields'> & {
  fields?: unknown;
};
type RawImportPreviewRecord = Omit<Partial<ImportPreviewRecord>, 'labels'> & {
  labels?: unknown;
};
type RawImportPreviewResponse = Omit<Partial<ImportPreviewResponse>, 'total' | 'sample'> & {
  total?: number | string | null;
  sample?: unknown;
  suggestedMapping?: unknown;
};
type RawImportJobError = Partial<ImportJobError>;
type RawImportRunResponse = Partial<ImportRunResponse>;
type RawImportJobStatus = Omit<Partial<ImportJobStatus>, 'total' | 'processed' | 'errors'> & {
  total?: number | string | null;
  processed?: number | string | null;
  errors?: unknown;
  createdAt?: string | Date | null;
  finishedAt?: string | Date | null;
};
type RawSsoConfig = Omit<Partial<SsoConfig>, 'attributeMap' | 'createdAt' | 'updatedAt'> & {
  attributeMap?: unknown;
  createdAt?: string | Date | null;
  updatedAt?: string | Date | null;
};
type RawSsoConfigResponse = {
  ssoConfig?: RawSsoConfig | null;
};
type RawScimToken = Omit<Partial<ScimToken>, 'createdAt' | 'lastUsedAt' | 'revokedAt'> & {
  createdAt?: string | Date | null;
  lastUsedAt?: string | Date | null;
  revokedAt?: string | Date | null;
};
type RawScimTokensResponse = {
  tokens?: unknown;
};
type RawCreatedScimToken = Omit<Partial<CreatedScimToken>, 'createdAt'> & {
  createdAt?: string | Date | null;
};
type RawWorkspaceCommunicationsSettings = Partial<WorkspaceCommunicationsSettings>;
type RawWorkspaceCommunicationsServiceStatus = {
  redisReady?: boolean;
  livekit?: {
    ready?: boolean;
    url?: string | null;
    missing?: unknown;
  } | null;
};
type RawWorkspaceCommunicationsSettingsResponse = {
  organizationId?: string;
  organizationName?: string;
  settings?: RawWorkspaceCommunicationsSettings | null;
  serviceStatus?: RawWorkspaceCommunicationsServiceStatus | null;
};
type RawAuditLogSink = Omit<
  Partial<AuditLogSink>,
  'config' | 'successCount' | 'failureCount' | 'createdAt' | 'updatedAt' | 'lastDeliveryAt'
> & {
  config?: unknown;
  successCount?: number | string | null;
  failureCount?: number | string | null;
  createdAt?: string | Date | null;
  updatedAt?: string | Date | null;
  lastDeliveryAt?: string | Date | null;
  signingSecret?: string | null;
};
type RawAuditLogSinksResponse = {
  sinks?: unknown;
};
type RawAuditLogSinkResponse = {
  sink?: RawAuditLogSink | null;
};
type RawAuditLogSinkTestResponse = {
  result?: Partial<AuditLogSinkTestResult> | null;
  error?: string | null;
};
type RawProjectHealthStatusBucket = Partial<Omit<ProjectHealthStatusBucket, 'count'>> & {
  count?: number | string | null;
};
type RawProjectHealthPriorityBucket = Partial<Omit<ProjectHealthPriorityBucket, 'count'>> & {
  count?: number | string | null;
};
type RawProjectHealthTypeBucket = Partial<Omit<ProjectHealthTypeBucket, 'count'>> & {
  count?: number | string | null;
};
type RawProjectHealthAnalytics = {
  overview?: {
    totalIssues?: number | string | null;
    overdueIssues?: number | string | null;
    unassignedIssues?: number | string | null;
  } | null;
  sprints?: {
    total?: number | string | null;
    active?: number | string | null;
    completed?: number | string | null;
  } | null;
  issuesByStatus?: unknown;
  issuesByPriority?: unknown;
  issuesByType?: unknown;
};
type RawProjectVelocitySprint = Partial<
  Omit<ProjectVelocitySprint, 'completedIssues' | 'completedPoints'>
> & {
  completedIssues?: number | string | null;
  completedPoints?: number | string | null;
};
type RawProjectVelocityAnalytics = Omit<
  Partial<ProjectVelocityAnalytics>,
  'sprints' | 'averageVelocity'
> & {
  sprints?: unknown;
  averageVelocity?: {
    issues?: number | string | null;
    points?: number | string | null;
  } | null;
};
type RawProjectThroughputBucket = Partial<Omit<ProjectThroughputBucket, 'count'>> & {
  count?: number | string | null;
};
type RawProjectThroughputAnalytics = Omit<Partial<ProjectThroughputAnalytics>, 'data' | 'days'> & {
  days?: number | string | null;
  data?: unknown;
};
type RawProjectCycleTimeAnalytics = Omit<
  Partial<ProjectCycleTimeAnalytics>,
  'days' | 'sampleSize' | 'values' | 'p50' | 'p90'
> & {
  days?: number | string | null;
  sampleSize?: number | string | null;
  values?: unknown;
  p50?: number | string | null;
  p90?: number | string | null;
};
type RawProjectForecastHistogramBucket = Partial<
  Omit<ProjectForecastHistogramBucket, 'sprints' | 'count'>
> & {
  sprints?: number | string | null;
  count?: number | string | null;
};
type RawProjectForecastAnalytics = Omit<
  Partial<ProjectForecastAnalytics>,
  | 'backlog'
  | 'throughputHistory'
  | 'p50Sprints'
  | 'p80Sprints'
  | 'p95Sprints'
  | 'iterations'
  | 'histogram'
> & {
  backlog?: number | string | null;
  throughputHistory?: unknown;
  p50Sprints?: number | string | null;
  p80Sprints?: number | string | null;
  p95Sprints?: number | string | null;
  iterations?: number | string | null;
  histogram?: unknown;
};
type RawDoraAnalytics = {
  connected?: boolean | null;
  deployFrequencyPerDay?: number | string | null;
  deployFrequencyDelta?: number | string | null;
  deployFrequencySpark?: unknown;
  leadTimeHours?: number | string | null;
  leadTimeDelta?: number | string | null;
  leadTimeSpark?: unknown;
  changeFailureRate?: number | string | null;
  changeFailureRateDelta?: number | string | null;
  changeFailureRateSpark?: unknown;
  reworkRate?: number | string | null;
  reworkRateDelta?: number | string | null;
  reworkRateSpark?: unknown;
  recoveryHours?: number | string | null;
  recoveryHoursDelta?: number | string | null;
  recoveryHoursSpark?: unknown;
};
type RawOrganizationMember = Partial<OrganizationMember> & {
  user?: RawUser;
};
type RawOrganizationStats = {
  members?: number | string | null;
  projects?: number | string | null;
  teams?: number | string | null;
  apiKeys?: number | string | null;
};
type RawOrganization = Partial<Omit<Organization, 'stats'>> & {
  stats?: RawOrganizationStats | null;
};
type RawTeamspace = Partial<Omit<Teamspace, 'memberCount' | 'projectCount' | 'lead'>> & {
  memberCount?: number | string | null;
  projectCount?: number | string | null;
  lead?: Partial<TeamspaceLead> | null;
};
type RawTeamspaceMember = Partial<TeamspaceMember> & {
  teamRole?: TeamspaceMemberRole | null;
};
type RawLabel = Partial<Label> & {
  usageCount?: number | string | null;
};
type RawProjectComponent = Partial<ProjectComponent> & {
  issueCount?: number | string | null;
};
type RawProjectModule = Partial<Omit<ProjectModule, 'memberIds'>> & {
  memberIds?: unknown;
};
type RawProjectView = Partial<Omit<ProjectView, 'criteria'>> & {
  criteria?: unknown;
};
type RawSavedIssueFilter = Omit<Partial<SavedIssueFilter>, 'criteria' | 'usageCount'> & {
  criteria?: unknown;
  usageCount?: number | string | null;
};
type RawProjectViewsResponse = {
  viewerId?: string;
  project?: Partial<ProjectViewsResponse['project']> | null;
  views?: unknown;
};
type RawProjectChatSettings = Partial<ProjectChatSettings>;
type RawProjectCommunicationsSettings = Partial<ProjectCommunicationsSettings>;
type RawProjectCommunicationsSettingsResponse = {
  project?: Partial<ProjectCommunicationsSettingsResponse['project']> | null;
  access?: Partial<ProjectCommunicationsSettingsResponse['access']> | null;
  workspaceSettings?: RawProjectChatSettings | null;
  projectSettings?: RawProjectCommunicationsSettings | null;
  effectiveSettings?: RawProjectChatSettings | null;
};
type RawProjectChatPermissions = Partial<ProjectChatPermissions>;
type RawProjectChatActiveCall = Omit<Partial<ProjectChatActiveCall>, 'participantCount'> & {
  participantCount?: number | string | null;
};
type RawConversationCallToken = Partial<Omit<ConversationCallToken, 'call'>> & {
  call?: RawProjectChatActiveCall | null;
};
type RawConversationCallStartResponse = {
  call?: RawProjectChatActiveCall | null;
  livekit?: ConversationCallStartResponse['livekit'] | null;
};
type RawConversationCallLeaveResponse = {
  success?: boolean;
  call?: RawProjectChatActiveCall | null;
};
type RawGlobalLiveCall = Omit<Partial<GlobalLiveCall>, 'participantCount' | 'project' | 'room'> & {
  participantCount?: number | string | null;
  project?: Partial<GlobalLiveCall['project']> | null;
  room?: Partial<GlobalLiveCall['room']> | null;
};
type RawProjectChatLastMessage = {
  id?: string;
  body?: string | null;
  createdAt?: string | Date | null;
};
type RawProjectChatChannel = Omit<
  Partial<ProjectChatChannel>,
  'unreadCount' | 'participantCount' | 'lastMessage' | 'activeCall'
> & {
  unreadCount?: number | string | null;
  participantCount?: number | string | null;
  lastMessage?: RawProjectChatLastMessage | null;
  activeCall?: RawProjectChatActiveCall | null;
};
type RawProjectChatDiscussion = Omit<
  Partial<ProjectChatDiscussion>,
  'unreadCount' | 'participantCount' | 'latestMessage' | 'activeCall' | 'context'
> & {
  unreadCount?: number | string | null;
  participantCount?: number | string | null;
  latestMessage?: RawProjectChatLastMessage | null;
  activeCall?: RawProjectChatActiveCall | null;
  context?: unknown;
};
type RawProjectChatBootstrap = {
  project?: Partial<ProjectChatBootstrap['project']> | null;
  effectiveSettings?: RawProjectChatSettings | null;
  workspaceSettings?: unknown;
  projectSettings?: unknown;
  permissions?: RawProjectChatPermissions | null;
  channels?: unknown;
  recentDiscussions?: unknown;
  activeCalls?: unknown;
  lastActiveRoomId?: string | null;
};
type RawProjectChannelMutationResponse = {
  channel?: RawProjectChatChannel | null;
  room?: { id?: string | null } | null;
};
type RawConversationAttachment = Omit<Partial<ConversationAttachment>, 'fileSize'> & {
  fileSize?: number | string | null;
};
type RawConversationAuthor = Partial<ConversationAuthor>;
type RawConversationReaction = Omit<Partial<ConversationReaction>, 'count' | 'reactedUserIds'> & {
  count?: number | string | null;
  reactedUserIds?: unknown;
};
type RawConversationModerationSnapshot = Omit<
  Partial<ConversationModerationSnapshot>,
  'deletedAttachments'
> & {
  deletedAttachments?: unknown;
};
type RawConversationMessage = Omit<
  Partial<ConversationMessage>,
  'attachments' | 'mentions' | 'author' | 'moderation' | 'reactions'
> & {
  attachments?: unknown;
  mentions?: unknown;
  author?: RawConversationAuthor | null;
  moderation?: RawConversationModerationSnapshot | null;
  reactions?: unknown;
};
type RawConversationMessagesPage = {
  messages?: unknown;
  pageInfo?: Partial<ConversationMessagesPage['pageInfo']> | null;
};
type RawWorkflowStatus = Partial<WorkflowStatus> & {
  position?: number | string | null;
};
type RawWorkflowTransition = Partial<WorkflowTransition>;
type RawProjectVersion = Partial<ProjectVersion> & {
  sortOrder?: number | string | null;
  issueCount?: number | string | null;
  doneIssueCount?: number | string | null;
};
type RawCustomField = Partial<CustomField> & {
  position?: number | string | null;
};
type RawIssueCustomFieldValue = Partial<Omit<IssueCustomFieldValue, 'field'>> & {
  field?: RawCustomField | null;
};
type RawNotification = Partial<NotificationItem>;
type RawInboxResponse =
  | RawNotification[]
  | {
      notifications?: RawNotification[];
      items?: RawNotification[];
      nextCursor?: unknown;
    };
type RawCatchMeUpActionItem = Partial<CatchMeUpActionItem>;
type RawCatchMeUpDigest = {
  summary_markdown?: unknown;
  action_items?: unknown;
  since?: unknown;
  source?: unknown;
};
type RawNotificationPreferences = Partial<NotificationPreferences>;
type RawUserAppearance = Partial<UserAppearanceSettings>;
type RawWatcher = Partial<Watcher> & {
  user?: RawUser;
};
type RawAiCapability = Partial<AiCapability> & {
  llm?: Partial<AiCapability['llm']> | null;
};
type RawIssueTriagePayload =
  | Partial<IssueTriagePayload>
  | Record<string, unknown>
  | null
  | undefined;
type RawIssueTriageSuggestion = Omit<Partial<IssueTriageSuggestion>, 'payload' | 'confidence'> & {
  payload?: RawIssueTriagePayload;
  confidence?: number | string | null;
};
type RawIssueAssistResult = Partial<Omit<IssueAssistResult, 'labels'>> & {
  labels?: unknown;
};
type RawEstimateNeighbourIssue = {
  id?: unknown;
  key?: unknown;
  title?: unknown;
  actualHours?: number | string | null;
  similarity?: number | string | null;
};
type RawAiEstimateSuggestion = Omit<
  Partial<AiEstimateSuggestion>,
  'estimateHours' | 'p25Hours' | 'p75Hours' | 'sampleSize' | 'neighbours'
> & {
  estimateHours?: number | string | null;
  p25Hours?: number | string | null;
  p75Hours?: number | string | null;
  sampleSize?: number | string | null;
  neighbours?: unknown;
};
type RawIssueAgentSession = Omit<Partial<IssueAgentSession>, 'payload'> & {
  provider?: unknown;
  state?: unknown;
  payload?: unknown;
};
type RawDispatchIssueAgentResult = Partial<DispatchIssueAgentResult> & {
  provider?: unknown;
  runner?: unknown;
};
type RawAiIssueDraft = {
  type?: unknown;
  title?: unknown;
  description?: unknown;
  priority?: unknown;
  labels?: unknown;
  estimate?: number | string | null;
};
type RawAiIssueDraftResponse = {
  draft?: RawAiIssueDraft | null;
  provider?: unknown;
};
type RawAskCitationSource = Partial<AskCitationSource> & {
  type?: unknown;
  id?: unknown;
  key?: unknown;
  title?: unknown;
  snippet?: unknown;
  url?: unknown;
};
type RawAskCitation = Partial<AskCitation> & {
  type?: unknown;
  id?: unknown;
  key?: unknown;
  title?: unknown;
  snippet?: unknown;
  url?: unknown;
  occurrence?: number | string | null;
};
type RawAskUsage = Partial<AskUsage> & {
  inputTokens?: number | string | null;
  outputTokens?: number | string | null;
  costUsd?: number | string | null;
  latencyMs?: number | string | null;
};
type RawAskEvent =
  | { type?: 'sources'; sources?: unknown }
  | { type?: 'token'; text?: unknown }
  | { type?: 'citations'; citations?: unknown }
  | { type?: 'done'; usage?: RawAskUsage | null }
  | { type?: 'error'; error?: unknown; code?: unknown }
  | Record<string, unknown>;
type RawSprint = Partial<Sprint> & {
  issueCount?: number | string | null;
  completedCount?: number | string | null;
  inProgressCount?: number | string | null;
  todoCount?: number | string | null;
  completedIssuesCount?: number | string | null;
  movedToBacklogCount?: number | string | null;
};
type RawSprintBurndownPoint = Partial<Omit<SprintBurndownPoint, 'ideal' | 'actual'>> & {
  ideal?: number | string | null;
  actual?: number | string | null;
};
type RawSprintBurndownHours = Partial<
  Omit<
    SprintBurndownHours,
    'totalEstimateHours' | 'totalActualHours' | 'completedActualHours' | 'remainingEstimateHours'
  >
> & {
  totalEstimateHours?: number | string | null;
  totalActualHours?: number | string | null;
  completedActualHours?: number | string | null;
  remainingEstimateHours?: number | string | null;
};
type RawSprintBurndownAnalytics = Omit<
  Partial<SprintBurndownAnalytics>,
  | 'totalPoints'
  | 'totalIssues'
  | 'completedPoints'
  | 'completedIssues'
  | 'remainingPoints'
  | 'remainingIssues'
  | 'burndown'
  | 'hours'
> & {
  totalPoints?: number | string | null;
  totalIssues?: number | string | null;
  completedPoints?: number | string | null;
  completedIssues?: number | string | null;
  remainingPoints?: number | string | null;
  remainingIssues?: number | string | null;
  burndown?: unknown;
  hours?: RawSprintBurndownHours | null;
};
type RawInitiative = Partial<Initiative> & {
  children?: RawInitiative[];
};
type RawInitiativeProject = {
  projectId?: string | null;
  projectName?: string | null;
  projectKey?: string | null;
  projectStatus?: string | null;
};
type RawInitiativeRollup = Partial<InitiativeRollup> & {
  done?: number | string | null;
  total?: number | string | null;
  percent?: number | string | null;
  projectCount?: number | string | null;
  perProject?: Array<Partial<InitiativeRollupProject>>;
};
type RawInitiativeUpdate = Partial<InitiativeUpdate>;
type RawSearchResult = Partial<SearchResult> & {
  entity_type?: string | null;
  issue_id?: string | null;
  project_id?: string | null;
};
type RawSearchHistoryEntry = Omit<Partial<SearchHistoryEntry>, 'criteria' | 'resultCount'> & {
  criteria?: unknown;
  resultCount?: number | string | null;
};
type RawDocumentSpace = Partial<DocumentSpace>;
type RawDocumentPageSummary = Partial<DocumentPageSummary> & {
  rank?: number | string | null;
  spaceName?: string | null;
};
type RawDocumentRevisionAuthor = Partial<DocumentRevisionAuthor>;
type RawDocumentRevision = Omit<Partial<DocumentRevision>, 'author' | 'revision'> & {
  author?: RawDocumentRevisionAuthor | null;
  revision?: number | string | null;
};
type RawDocumentTreeNode = RawDocumentPageSummary & {
  children?: unknown;
};
type RawIssueDocument = RawDocumentPageSummary & {
  linkId?: string | null;
};
type RawDocumentPage = Partial<DocumentPage> & RawDocumentPageSummary;
type RawPublicDocumentAttachment = Omit<Partial<PublicDocumentAttachment>, 'fileSize'> & {
  fileSize?: number | string | null;
};
type RawPublicDocumentPage = Omit<Partial<PublicDocumentPage>, 'attachments'> & {
  attachments?: unknown;
};
type RawTemplate = Partial<WorkTemplate> & {
  usageCount?: number | string | null;
  payload?: unknown;
};
type RawPinnedItem = Partial<PinnedItem> & {
  createdAt?: string | null;
};
type RawLastSeenResponse = {
  lastSeenAt?: unknown;
};
type RawStandupDigest = Partial<StandupDigest>;
type RawUseTemplateResult = Partial<UseTemplateResult> & {
  payload?: unknown;
  resource?: unknown;
};
type RawDraft = Partial<Draft> & {
  metadata?: unknown;
};
type RawApiKey = Omit<Partial<ApiKey>, 'keyPrefix'> & {
  keyPrefix?: string | null;
  prefix?: string | null;
};
type RawWebhook = Omit<Partial<Webhook>, 'events' | 'successCount' | 'failureCount'> & {
  events?: unknown;
  successCount?: number | string | null;
  failureCount?: number | string | null;
};
type RawWebhookTestResult = Omit<
  Partial<WebhookTestResult>,
  'success' | 'statusCode' | 'durationMs'
> & {
  success?: unknown;
  statusCode?: number | string | null;
  durationMs?: number | string | null;
};
type RawAuditLogEntry = Omit<Partial<AuditLogEntry>, 'changes' | 'metadata' | 'user'> & {
  changes?: unknown;
  metadata?: unknown;
  user?: RawUser;
};
type RawAgentPolicyRule = Omit<Partial<AgentPolicyRule>, 'approvers' | 'line'> & {
  approvers?: unknown;
  line?: number | string | null;
};
type RawAgentPolicyParseError = Partial<Omit<AgentPolicyParseError, 'line'>> & {
  line?: number | string | null;
};
type RawAgentPolicyStatus = Omit<
  Partial<AgentPolicyStatus>,
  'enabled' | 'found' | 'errors' | 'rules'
> & {
  enabled?: unknown;
  found?: unknown;
  errors?: unknown;
  rules?: unknown;
};
type RawAgentApprovalRequest = Omit<Partial<AgentApprovalRequest>, 'proposedPayload'> & {
  proposedPayload?: unknown;
  status?: string | null;
};
type RawRegistrationPolicy = Partial<RegistrationPolicy>;
type RawAdminStatsResponse = {
  overview?: Partial<Record<keyof AdminStatsResponse['overview'], number | string | null>>;
  organizations?: {
    byStatus?: Record<string, number | string | null> | null;
    byPlan?: Record<string, number | string | null> | null;
  };
  growth?: Partial<Record<keyof AdminStatsResponse['growth'], number | string | null>>;
};
type RawAdminDirectoryPagination = Partial<
  Record<keyof AdminDirectoryPagination, number | string | null>
>;
type RawAdminDirectoryOwner = Partial<AdminDirectoryOwner>;
type RawAdminOrganizationSummary = Omit<Partial<AdminOrganizationSummary>, 'stats' | 'owner'> & {
  stats?: Partial<Record<keyof AdminOrganizationSummary['stats'], number | string | null>> | null;
  owner?: RawAdminDirectoryOwner | null;
};
type RawAdminOrganizationsResponse = {
  organizations?: unknown;
  pagination?: RawAdminDirectoryPagination | null;
};
type RawAdminUserOrganizationMembership = Partial<AdminUserOrganizationMembership>;
type RawAdminUserProjectMembership = Partial<AdminUserProjectMembership>;
type RawAdminUserLastActivity = Partial<AdminUserLastActivity>;
type RawAdminUserSummary = Omit<
  Partial<AdminUserSummary>,
  'organizations' | 'projectMemberships' | 'lastActivity'
> & {
  organizations?: unknown;
  projectMemberships?: unknown;
  lastActivity?: RawAdminUserLastActivity | null;
};
type RawAdminUsersResponse = {
  users?: unknown;
  pagination?: RawAdminDirectoryPagination | null;
};
type RawAdminSmtpConfig = Omit<Partial<AdminSmtpConfig>, 'port' | 'secure' | 'configured'> & {
  port?: number | string | null;
  secure?: unknown;
  configured?: unknown;
};
type RawAdminStorageConfig = Omit<Partial<AdminStorageConfig>, 'configured'> & {
  configured?: unknown;
};
type RawAdminLivekitConfig = Omit<Partial<AdminLivekitConfig>, 'configured'> & {
  configured?: unknown;
};
type RawAdminSystemTestResult = Omit<Partial<AdminSystemTestResult>, 'success'> & {
  success?: unknown;
};
type RawAdminAgentControlSettings = Partial<
  Omit<
    AdminAgentControlSettings,
    'globalEnabled' | 'allowWriteActions' | 'requireSupervisionForAutoMode' | 'maxConcurrentRuns'
  >
> & {
  globalEnabled?: unknown;
  allowWriteActions?: unknown;
  requireSupervisionForAutoMode?: unknown;
  maxConcurrentRuns?: number | string | null;
};
type RawAdminAgentControlStats = Partial<
  Record<keyof AdminAgentControlStats, number | string | null>
>;
type RawAdminAgentServiceStatus = Partial<AdminAgentServiceStatus>;
type RawAdminAgentProviderStatus = Omit<
  Partial<AdminAgentProviderStatus>,
  'ready' | 'configured'
> & {
  ready?: unknown;
  configured?: unknown;
};
type RawAdminAgentProviderBreakdownItem = Partial<
  Record<keyof Omit<AdminAgentProviderBreakdownItem, 'provider'>, number | string | null>
>;
type RawAdminAgentWorkspaceCoverage = Omit<
  Partial<AdminAgentWorkspaceCoverage>,
  'workspaceEnabled' | 'enabledProjects' | 'providerStatus'
> & {
  workspaceEnabled?: unknown;
  enabledProjects?: number | string | null;
  providerStatus?: RawAdminAgentProviderStatus | null;
};
type RawAdminAgentRecentRun = Omit<Partial<AdminAgentRecentRun>, 'dryRun' | 'writeActionsCount'> & {
  dryRun?: unknown;
  writeActionsCount?: number | string | null;
};
type RawAdminAgentControlResponse = Omit<
  Partial<AdminAgentControlResponse>,
  'settings' | 'stats' | 'serviceStatus' | 'providerBreakdown' | 'workspaceCoverage' | 'recentRuns'
> & {
  settings?: RawAdminAgentControlSettings | null;
  stats?: RawAdminAgentControlStats | null;
  serviceStatus?: unknown;
  providerBreakdown?: Record<string, RawAdminAgentProviderBreakdownItem> | null;
  workspaceCoverage?: unknown;
  recentRuns?: unknown;
};
type RawAgentModelConfig = Omit<
  Partial<AgentModelConfig>,
  'isDefault' | 'isArchived' | 'revisionCount' | 'createdAt' | 'updatedAt'
> & {
  isDefault?: unknown;
  isArchived?: unknown;
  revisionCount?: number | string | null;
  createdAt?: string | Date | null;
  updatedAt?: string | Date | null;
};
type RawOrganizationAgentWorkspaceSettings = Omit<
  Partial<OrganizationAgentWorkspaceSettings>,
  | 'enabled'
  | 'assistantEnabled'
  | 'allowWriteActions'
  | 'requireApprovalForWrites'
  | 'dailyRunLimit'
  | 'capabilities'
> & {
  enabled?: unknown;
  assistantEnabled?: unknown;
  allowWriteActions?: unknown;
  requireApprovalForWrites?: unknown;
  dailyRunLimit?: number | string | null;
  capabilities?: unknown;
};
type RawOrganizationAgentAccess = Omit<
  Partial<OrganizationAgentAccess>,
  'canView' | 'canManage' | 'isSuperAdmin'
> & {
  canView?: unknown;
  canManage?: unknown;
  isSuperAdmin?: unknown;
};
type RawOrganizationAgentConfigIssue = Omit<Partial<OrganizationAgentConfigIssue>, 'blocksRuns'> & {
  blocksRuns?: unknown;
};
type RawOrganizationAgentRuntimeSummary = Partial<
  Record<
    keyof Pick<
      OrganizationAgentRuntimeSummary,
      'projectCount' | 'enabledProjectCount' | 'runningRuns' | 'totalRuns'
    >,
    number | string | null
  >
> &
  Partial<
    Pick<
      OrganizationAgentRuntimeSummary,
      'lastRunAt' | 'lastCompletedAt' | 'lastFailedAt' | 'lastFailure'
    >
  >;
type RawOrganizationAgentRecentRun = Omit<
  Partial<OrganizationAgentRecentRun>,
  'dryRun' | 'writeActionsCount' | 'createdAt' | 'completedAt'
> & {
  dryRun?: unknown;
  writeActionsCount?: number | string | null;
  createdAt?: string | Date | null;
  completedAt?: string | Date | null;
};
type RawOrganizationAgentSettingsResponse = Omit<
  Partial<OrganizationAgentSettingsResponse>,
  | 'workspaceSettings'
  | 'selectedModelConfig'
  | 'modelConfigs'
  | 'access'
  | 'providerStatus'
  | 'configIssues'
  | 'runtimeSummary'
  | 'serviceStatus'
  | 'recentRuns'
  | 'updatedAt'
> & {
  workspaceSettings?: RawOrganizationAgentWorkspaceSettings | null;
  selectedModelConfig?: RawAgentModelConfig | null;
  modelConfigs?: unknown;
  access?: RawOrganizationAgentAccess | null;
  providerStatus?: RawAdminAgentProviderStatus | null;
  configIssues?: unknown;
  runtimeSummary?: RawOrganizationAgentRuntimeSummary | null;
  serviceStatus?: unknown;
  recentRuns?: unknown;
  updatedAt?: string | Date | null;
};
type RawProjectAgentAccess = Omit<
  Partial<ProjectAgentAccess>,
  'canView' | 'canManage' | 'isSuperAdmin'
> & {
  canView?: unknown;
  canManage?: unknown;
  isSuperAdmin?: unknown;
};
type RawProjectAgentSettings = Omit<
  Partial<ProjectAgentSettings>,
  | 'enabled'
  | 'inheritWorkspaceDefaults'
  | 'allowWriteActions'
  | 'sprintBatchSize'
  | 'sprintLengthDays'
  | 'issueCapacityPerSprint'
  | 'autoAssignToPlannedSprints'
  | 'capabilities'
> & {
  enabled?: unknown;
  inheritWorkspaceDefaults?: unknown;
  allowWriteActions?: unknown;
  sprintBatchSize?: number | string | null;
  sprintLengthDays?: number | string | null;
  issueCapacityPerSprint?: number | string | null;
  autoAssignToPlannedSprints?: unknown;
  capabilities?: unknown;
};
type RawProjectAgentEffectiveSettings = Omit<
  Partial<ProjectAgentEffectiveSettings>,
  | 'enabled'
  | 'allowWriteActions'
  | 'requireApprovalForWrites'
  | 'dailyRunLimit'
  | 'sprintBatchSize'
  | 'sprintLengthDays'
  | 'issueCapacityPerSprint'
  | 'autoAssignToPlannedSprints'
  | 'capabilities'
> & {
  enabled?: unknown;
  allowWriteActions?: unknown;
  requireApprovalForWrites?: unknown;
  dailyRunLimit?: number | string | null;
  sprintBatchSize?: number | string | null;
  sprintLengthDays?: number | string | null;
  issueCapacityPerSprint?: number | string | null;
  autoAssignToPlannedSprints?: unknown;
  capabilities?: unknown;
};
type RawProjectAgentRuntimeSummary = Partial<
  Record<keyof Pick<ProjectAgentRuntimeSummary, 'runningRuns'>, number | string | null>
> &
  Partial<
    Pick<
      ProjectAgentRuntimeSummary,
      'lastRunAt' | 'lastCompletedAt' | 'lastFailedAt' | 'lastFailure'
    >
  >;
type RawProjectAgentRunAvailability = Partial<ProjectAgentRunAvailability> & {
  canRun?: unknown;
};
type RawProjectAgentSettingsResponse = Omit<
  Partial<ProjectAgentSettingsResponse>,
  | 'workspaceSettings'
  | 'selectedModelConfig'
  | 'access'
  | 'projectSettings'
  | 'effectiveSettings'
  | 'providerStatus'
  | 'configIssues'
  | 'runtimeSummary'
  | 'runAvailability'
  | 'serviceStatus'
  | 'lastRunByKind'
  | 'recentRuns'
> & {
  workspaceSettings?: RawOrganizationAgentWorkspaceSettings | null;
  selectedModelConfig?: RawAgentModelConfig | null;
  access?: RawProjectAgentAccess | null;
  projectSettings?: RawProjectAgentSettings | null;
  effectiveSettings?: RawProjectAgentEffectiveSettings | null;
  providerStatus?: RawAdminAgentProviderStatus | null;
  configIssues?: unknown;
  runtimeSummary?: RawProjectAgentRuntimeSummary | null;
  runAvailability?: RawProjectAgentRunAvailability | null;
  serviceStatus?: unknown;
  lastRunByKind?: Record<string, RawOrganizationAgentRecentRun> | null;
  recentRuns?: unknown;
};
type RawAdminVersionImageStatus = Partial<
  Omit<AdminVersionImageStatus, 'latestSizeBytes' | 'updateAvailable'>
> & {
  latestSizeBytes?: number | string | null;
  updateAvailable?: unknown;
};
type RawAdminSelfUpdateStatus = Partial<
  Omit<AdminSelfUpdateStatus, 'enabled' | 'available' | 'webhookConfigured'>
> & {
  enabled?: unknown;
  available?: unknown;
  webhookConfigured?: unknown;
};
type RawAdminVersionStatus = Partial<
  Omit<
    AdminVersionStatus,
    'releaseUpdateAvailable' | 'updateAvailable' | 'checkDisabled' | 'image' | 'selfUpdate'
  >
> & {
  releaseUpdateAvailable?: unknown;
  updateAvailable?: unknown;
  checkDisabled?: unknown;
  image?: RawAdminVersionImageStatus;
  selfUpdate?: RawAdminSelfUpdateStatus | null;
};
type RawAdminAiUsageLimits = Partial<Record<keyof AdminAiUsageLimits, number | string | null>>;
type RawAdminAiReservedUsage = Partial<Record<keyof AdminAiReservedUsage, number | string | null>>;
type RawAdminAiActualUsage = Partial<Record<keyof AdminAiActualUsage, number | string | null>>;
type RawAdminAiUsageHistoryEntry = Partial<
  Omit<AdminAiUsageHistoryEntry, 'calls' | 'tokens' | 'cost'>
> & {
  calls?: number | string | null;
  tokens?: number | string | null;
  cost?: number | string | null;
};
type RawAdminAiFeatureUsage = Partial<Omit<AdminAiFeatureUsage, 'calls' | 'tokens' | 'cost'>> & {
  calls?: number | string | null;
  tokens?: number | string | null;
  cost?: number | string | null;
};
type RawAdminAiUsageOrganization = Omit<
  Partial<AdminAiUsageOrganization>,
  'limits' | 'reservedUsage' | 'actualUsage' | 'history' | 'featureBreakdown'
> & {
  limits?: RawAdminAiUsageLimits | null;
  reservedUsage?: RawAdminAiReservedUsage | null;
  actualUsage?: RawAdminAiActualUsage | null;
  history?: unknown;
  featureBreakdown?: unknown;
};
type RawAdminAiUsageResponse = Omit<Partial<AdminAiUsageResponse>, 'organizations'> & {
  windowDays?: number | string | null;
  organizations?: unknown;
};
type RawAdminAiKillSwitchResult = Partial<AdminAiKillSwitchResult>;
type RawAdminAiUsageResetResult = Partial<AdminAiUsageResetResult> & {
  scope?: string | null;
};
type RawAdminFeatureFlag = Omit<
  Partial<AdminFeatureFlag>,
  'enabledForPlans' | 'enabledForOrganizations' | 'rolloutPercentage' | 'metadata'
> & {
  enabledForPlans?: unknown;
  enabledForOrganizations?: unknown;
  rolloutPercentage?: number | string | null;
  metadata?: unknown;
};
type RawAdminRealtimeHealth = {
  services?: {
    redis?: {
      ready?: unknown;
      mode?: string | null;
    } | null;
    livekit?: {
      ready?: unknown;
      url?: string | null;
      missing?: unknown;
    } | null;
  } | null;
  stats?: {
    channels?: number | string | null;
    rooms?: number | string | null;
    activeCalls?: number | string | null;
    readStates?: number | string | null;
  } | null;
};
type RawSystemAuditLogEntry = Omit<
  Partial<SystemAuditLogEntry>,
  'changes' | 'metadata' | 'user'
> & {
  changes?: unknown;
  metadata?: unknown;
  user?: SystemAuditLogEntry['user'];
};

const priorityValues = new Set<IssuePriority>(['critical', 'high', 'medium', 'low', 'none']);
const issueTypeValues = new Set<IssueType>(['task', 'story', 'bug', 'epic', 'subtask']);
const agentSessionProviders = new Set<AgentSessionProvider>([
  'claude',
  'codex',
  'cursor',
  'devin',
  'copilot',
  'openhands',
  'custom',
]);
const agentSessionStates = new Set<AgentSessionState>([
  'pending',
  'active',
  'awaitingInput',
  'error',
  'complete',
  'stale',
]);
const registrationModes = new Set<RegistrationMode>([
  'allow_registration',
  'invite_only',
  'admin_created_only',
]);
const aiUsageResetScopes = new Set<AdminAiUsageResetScope>(['daily', 'monthly', 'both']);

function normalizeUser(user: RawUser): User | null {
  if (!user?.id || !user.email) return null;
  const normalized: User = {
    id: user.id,
    name: user.name ?? null,
    email: user.email,
    image: user.image ?? null,
  };
  if (user.isSuperAdmin !== undefined) normalized.isSuperAdmin = user.isSuperAdmin;
  if (user.status !== undefined) normalized.status = user.status;
  return normalized;
}

function normalizeIssue(raw: RawIssue): Issue {
  let status: Issue['status'] = null;
  if (typeof raw.status === 'object' && raw.status) {
    status = raw.status;
  } else if (raw.statusName || raw.status) {
    status = {
      id: raw.statusId ?? String(raw.statusName ?? raw.status),
      name: String(raw.statusName ?? raw.status),
      color: raw.statusColor ?? null,
    };
    if (typeof raw.status === 'string') status.category = raw.status;
  }
  const priority = priorityValues.has(raw.priority as IssuePriority)
    ? (raw.priority as IssuePriority)
    : 'medium';
  const projectId = raw.projectId ?? raw.project?.id ?? '';

  const normalized: Issue = {
    id: String(raw.id),
    projectId: String(projectId),
    project: raw.project ?? null,
    type: (raw.type ?? 'task') as IssueType,
    title: raw.title ?? '',
    description: raw.description ?? null,
    priority,
    status,
    statusId: raw.statusId ?? null,
    assigneeId: raw.assigneeId ?? null,
    assignee: normalizeUser(raw.assignee),
    reporter: normalizeUser(raw.reporter),
    labels: Array.isArray(raw.labels) ? raw.labels : [],
    resolution: raw.resolution ?? null,
    resolvedAt: raw.resolvedAt ?? null,
    sprintId: raw.sprintId ?? null,
    epicId: raw.epicId ?? null,
    parentId: raw.parentId ?? null,
    estimate: raw.estimate ?? null,
    dueDate: raw.dueDate ?? null,
  };
  const storyPoints = numericCount(raw.storyPoints);
  const estimateHours = numericCount(raw.estimateHours);
  const actualHours = numericCount(raw.actualHours);
  if (storyPoints !== undefined) normalized.storyPoints = storyPoints;
  if (estimateHours !== undefined) normalized.estimateHours = estimateHours;
  if (actualHours !== undefined) normalized.actualHours = actualHours;
  if (raw.estimateSource !== undefined) normalized.estimateSource = raw.estimateSource;
  if (raw.flagged !== undefined) normalized.flagged = raw.flagged === true;
  if (
    raw.customFields &&
    typeof raw.customFields === 'object' &&
    !Array.isArray(raw.customFields)
  ) {
    normalized.customFields = raw.customFields as Record<string, unknown>;
  } else if (raw.customFields === null) {
    normalized.customFields = null;
  }
  if (raw.key !== undefined) normalized.key = raw.key;
  if (raw.organizationId !== undefined) normalized.organizationId = raw.organizationId;
  if (raw.createdAt !== undefined) normalized.createdAt = raw.createdAt;
  if (raw.updatedAt !== undefined) normalized.updatedAt = raw.updatedAt;
  return normalized;
}

function isMyWorkloadWindow(value: unknown): value is MyWorkloadWindow {
  return (
    value === 'today' || value === 'this_week' || value === 'this_sprint' || value === 'overdue'
  );
}

function numericCountsPayload(value: unknown): Record<string, number> {
  const payload = recordPayload(value);
  const counts: Record<string, number> = {};
  for (const [key, count] of Object.entries(payload)) {
    counts[key] = numericCount(count as number | string | null | undefined) ?? 0;
  }
  return counts;
}

function normalizeMyWorkloadResponse(raw: RawMyWorkloadResponse): MyWorkloadResponse {
  return {
    window: isMyWorkloadWindow(raw.window) ? raw.window : 'this_week',
    total: numericCount(raw.total) ?? 0,
    countsByStatus: numericCountsPayload(raw.countsByStatus),
    countsByPriority: numericCountsPayload(raw.countsByPriority),
    overdue: numericCount(raw.overdue) ?? 0,
    dueSoon: numericCount(raw.dueSoon) ?? 0,
    issues: Array.isArray(raw.issues)
      ? raw.issues.map((issue) => normalizeIssue(issue as RawIssue))
      : [],
  };
}

function normalizeLinkedIssue(raw: RawLinkedIssue | null | undefined): LinkedIssue | null {
  if (!raw?.id || !raw.title) return null;
  return {
    id: raw.id,
    title: raw.title,
    key: raw.key ?? null,
    statusId: raw.statusId ?? null,
    type: raw.type ?? null,
    priority: raw.priority ?? null,
  };
}

function normalizeIssueLink(raw: RawIssueLink): IssueLink | null {
  if (!raw.id || !raw.type || !raw.direction) return null;
  const issue = normalizeLinkedIssue(raw.issue);
  if (!issue) return null;
  const normalized: IssueLink = {
    id: raw.id,
    type: raw.type,
    direction: raw.direction,
    issue,
  };
  if (raw.createdAt !== undefined) normalized.createdAt = raw.createdAt;
  return normalized;
}

function normalizeIssueActivity(raw: RawIssueActivity): IssueActivity | null {
  if (!raw.id || !raw.issueId || !raw.type || !raw.createdAt) return null;
  const normalized: IssueActivity = {
    id: raw.id,
    issueId: raw.issueId,
    type: raw.type,
    field: raw.field ?? null,
    oldValue: raw.oldValue ?? null,
    newValue: raw.newValue ?? null,
    createdAt: String(raw.createdAt),
    user: normalizeUser(raw.user),
  };
  if (raw.userId !== undefined) normalized.userId = raw.userId;
  if (raw.metadata !== undefined) normalized.metadata = raw.metadata;
  if (raw.updatedAt !== undefined) {
    normalized.updatedAt = String(raw.updatedAt);
  }
  return normalized;
}

function normalizeRecentActivityValues(raw: unknown): RecentActivity['messageValues'] | undefined {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return undefined;
  const entries = Object.entries(raw as Record<string, unknown>).filter((entry) => {
    const value = entry[1];
    return (
      value === null ||
      value === undefined ||
      typeof value === 'string' ||
      typeof value === 'number'
    );
  });
  if (entries.length === 0) return undefined;
  return Object.fromEntries(entries) as RecentActivity['messageValues'];
}

function normalizeRecentActivity(raw: RawRecentActivity): RecentActivity | null {
  if (!raw.id || !raw.action || !raw.type || !raw.createdAt) return null;
  const user = normalizeUser(raw.user);
  if (!user) return null;
  const issue =
    raw.issue &&
    typeof raw.issue.id === 'string' &&
    typeof raw.issue.key === 'string' &&
    typeof raw.issue.title === 'string'
      ? {
          id: raw.issue.id,
          key: raw.issue.key,
          title: raw.issue.title,
        }
      : null;

  const activity: RecentActivity = {
    id: String(raw.id),
    action: String(raw.action),
    type: String(raw.type),
    createdAt: String(raw.createdAt),
    user,
    issue,
  };
  if (raw.message !== undefined) activity.message = raw.message;
  if (raw.messageKey !== undefined) activity.messageKey = raw.messageKey;
  const messageValues = normalizeRecentActivityValues(raw.messageValues);
  if (messageValues) activity.messageValues = messageValues;
  if (raw.metadata !== undefined) activity.metadata = raw.metadata;
  return activity;
}

function normalizeIssueAttachment(
  raw: RawIssueAttachment | null | undefined,
): IssueAttachment | null {
  if (!raw) return null;
  if (!raw.id || !raw.issueId || !raw.fileName || !raw.filePath) return null;
  const fileSize = numericCount(raw.fileSize);
  if (fileSize === undefined) return null;
  const normalized: IssueAttachment = {
    id: raw.id,
    issueId: raw.issueId,
    fileName: raw.fileName,
    fileSize,
    mimeType: raw.mimeType ?? null,
    filePath: raw.filePath,
  };
  if (raw.uploadedById !== undefined) normalized.uploadedById = raw.uploadedById;
  if (raw.createdAt !== undefined) normalized.createdAt = String(raw.createdAt);
  return normalized;
}

function normalizeDocumentAttachment(
  raw: RawDocumentAttachment | null | undefined,
): DocumentAttachment | null {
  if (!raw) return null;
  if (!raw.id || !raw.pageId || !raw.fileName || !raw.filePath) return null;
  const fileSize = numericCount(raw.fileSize);
  if (fileSize === undefined) return null;
  const normalized: DocumentAttachment = {
    id: raw.id,
    pageId: raw.pageId,
    fileName: raw.fileName,
    fileSize,
    mimeType: raw.mimeType ?? null,
    filePath: raw.filePath,
  };
  if (raw.uploadedById !== undefined) normalized.uploadedById = raw.uploadedById;
  if (raw.createdAt !== undefined) normalized.createdAt = String(raw.createdAt);
  return normalized;
}

function normalizeTimeEntry(raw: RawTimeEntry): TimeEntry | null {
  if (!raw.id || !raw.issueId || !raw.startedAt) return null;
  const normalized: TimeEntry = {
    id: raw.id,
    issueId: raw.issueId,
    startedAt: raw.startedAt,
    endedAt: raw.endedAt ?? null,
    description: raw.description ?? null,
    source: raw.source ?? null,
    integrationRef: raw.integrationRef ?? null,
  };
  const durationSeconds = numericCount(raw.durationSeconds);
  if (durationSeconds !== undefined) normalized.durationSeconds = durationSeconds;
  if (raw.userId !== undefined) normalized.userId = raw.userId;
  if (raw.createdAt !== undefined) normalized.createdAt = raw.createdAt;
  if (raw.updatedAt !== undefined) normalized.updatedAt = raw.updatedAt;
  return normalized;
}

function normalizeIssueTimeInStatusBucket(
  raw: RawIssueTimeInStatusBucket,
): IssueTimeInStatusBucket | null {
  if (!raw.status) return null;
  const totalDurationSeconds = numericCount(raw.total_duration_seconds);
  const exitCount = numericCount(raw.exit_count);
  if (totalDurationSeconds === undefined || exitCount === undefined) return null;
  return {
    status: raw.status,
    statusName: raw.status_name ?? raw.status,
    statusCategory: raw.status_category ?? null,
    totalDurationSeconds,
    enteredAtLast: raw.entered_at_last ?? null,
    exitCount,
  };
}

function normalizeNotification(raw: RawNotification): NotificationItem {
  const issueTitle = raw.issue?.title ?? undefined;
  const projectName = raw.project?.name ?? undefined;
  const normalized: NotificationItem = {
    id: String(raw.id),
    type: String(raw.type ?? 'notification'),
    read: raw.read ?? raw.isRead ?? false,
    isRead: raw.isRead ?? raw.read ?? false,
    actor: normalizeUser(raw.actor),
    issue: raw.issue ?? null,
    project: raw.project ?? null,
    projectId: raw.projectId ?? raw.project?.id ?? null,
    issueId: raw.issueId ?? raw.issue?.id ?? null,
  };
  const title = raw.title ?? issueTitle ?? projectName;
  const message = raw.message ?? issueTitle ?? projectName;
  if (title !== undefined) normalized.title = title;
  if (message !== undefined) normalized.message = message;
  if (raw.actorType !== undefined) normalized.actorType = raw.actorType;
  if (raw.link !== undefined) normalized.link = raw.link;
  if (raw.snoozedUntil !== undefined) normalized.snoozedUntil = raw.snoozedUntil;
  if (raw.createdAt !== undefined) normalized.createdAt = raw.createdAt;
  return normalized;
}

function normalizeCatchMeUpActionItem(raw: RawCatchMeUpActionItem): CatchMeUpActionItem | null {
  if (typeof raw.title !== 'string' || typeof raw.link !== 'string') return null;
  return {
    title: raw.title,
    link: raw.link,
    urgency: typeof raw.urgency === 'string' ? raw.urgency : 'low',
  };
}

function normalizeCatchMeUpDigest(raw: RawCatchMeUpDigest): CatchMeUpDigest {
  const actionItems = Array.isArray(raw.action_items)
    ? raw.action_items
        .map((item) => normalizeCatchMeUpActionItem(item as RawCatchMeUpActionItem))
        .filter((item): item is CatchMeUpActionItem => item !== null)
    : [];

  return {
    summaryMarkdown: typeof raw.summary_markdown === 'string' ? raw.summary_markdown : '',
    actionItems,
    since: typeof raw.since === 'string' ? raw.since : null,
    source: typeof raw.source === 'string' ? raw.source : 'native',
  };
}

function booleanPreference(value: boolean | undefined, fallback: boolean): boolean {
  return typeof value === 'boolean' ? value : fallback;
}

function normalizeDigestFrequency(value: DigestFrequency | undefined): DigestFrequency {
  if (value === 'daily' || value === 'weekly') return value;
  return 'none';
}

function normalizeNotificationPreferences(
  raw: RawNotificationPreferences,
  organizationId: string,
): NotificationPreferences {
  const normalized: NotificationPreferences = {
    organizationId: raw.organizationId ?? organizationId,
    enableInApp: booleanPreference(raw.enableInApp, true),
    enableEmail: booleanPreference(raw.enableEmail, true),
    digestFrequency: normalizeDigestFrequency(raw.digestFrequency),
    emailOnAssigned: booleanPreference(raw.emailOnAssigned, true),
    emailOnMentioned: booleanPreference(raw.emailOnMentioned, true),
    emailOnCommented: booleanPreference(raw.emailOnCommented, false),
    emailOnStatusChanged: booleanPreference(raw.emailOnStatusChanged, false),
    emailOnIssueCreated: booleanPreference(raw.emailOnIssueCreated, false),
    emailOnSprintStarted: booleanPreference(raw.emailOnSprintStarted, true),
    emailOnSprintCompleted: booleanPreference(raw.emailOnSprintCompleted, true),
    emailOnProjectCreated: booleanPreference(raw.emailOnProjectCreated, false),
    emailOnProjectArchived: booleanPreference(raw.emailOnProjectArchived, false),
    inAppOnAssigned: booleanPreference(raw.inAppOnAssigned, true),
    inAppOnMentioned: booleanPreference(raw.inAppOnMentioned, true),
    inAppOnCommented: booleanPreference(raw.inAppOnCommented, true),
    inAppOnStatusChanged: booleanPreference(raw.inAppOnStatusChanged, true),
    inAppOnIssueCreated: booleanPreference(raw.inAppOnIssueCreated, true),
    inAppOnSprintStarted: booleanPreference(raw.inAppOnSprintStarted, true),
    inAppOnSprintCompleted: booleanPreference(raw.inAppOnSprintCompleted, true),
    inAppOnProjectCreated: booleanPreference(raw.inAppOnProjectCreated, true),
    inAppOnProjectArchived: booleanPreference(raw.inAppOnProjectArchived, true),
    doNotDisturb: booleanPreference(raw.doNotDisturb, false),
    doNotDisturbStart: raw.doNotDisturbStart ?? null,
    doNotDisturbEnd: raw.doNotDisturbEnd ?? null,
  };
  if (raw.id !== undefined) normalized.id = raw.id;
  if (raw.userId !== undefined) normalized.userId = raw.userId;
  if (raw.createdAt !== undefined) normalized.createdAt = raw.createdAt;
  if (raw.updatedAt !== undefined) normalized.updatedAt = raw.updatedAt;
  return normalized;
}

const DEFAULT_USER_APPEARANCE: UserAppearanceSettings = {
  userId: '',
  theme: 'system',
  colorTheme: 'default',
  visualStyle: 'modern',
  interfaceFont: 'ibm',
  animationsEnabled: true,
  gradientsEnabled: true,
  updatedAt: null,
};

const USER_APPEARANCE_THEMES: readonly UserAppearanceTheme[] = ['light', 'dark', 'system'];
const USER_APPEARANCE_COLOR_THEMES: readonly UserAppearanceColorTheme[] = [
  'default',
  'ocean',
  'forest',
  'sunset',
  'purple',
  'rose',
];
const USER_APPEARANCE_VISUAL_STYLES: readonly UserAppearanceVisualStyle[] = [
  'modern',
  'minimal',
  'glass',
];
const USER_APPEARANCE_INTERFACE_FONTS: readonly UserAppearanceInterfaceFont[] = ['brand', 'ibm'];

function normalizeAppearanceValue<T extends string>(
  value: unknown,
  allowed: readonly T[],
  fallback: T,
): T {
  return typeof value === 'string' && allowed.includes(value as T) ? (value as T) : fallback;
}

function normalizeUserAppearance(raw: RawUserAppearance): UserAppearanceSettings {
  return {
    userId: typeof raw.userId === 'string' ? raw.userId : DEFAULT_USER_APPEARANCE.userId,
    theme: normalizeAppearanceValue(
      raw.theme,
      USER_APPEARANCE_THEMES,
      DEFAULT_USER_APPEARANCE.theme,
    ),
    colorTheme: normalizeAppearanceValue(
      raw.colorTheme,
      USER_APPEARANCE_COLOR_THEMES,
      DEFAULT_USER_APPEARANCE.colorTheme,
    ),
    visualStyle: normalizeAppearanceValue(
      raw.visualStyle,
      USER_APPEARANCE_VISUAL_STYLES,
      DEFAULT_USER_APPEARANCE.visualStyle,
    ),
    interfaceFont: normalizeAppearanceValue(
      raw.interfaceFont,
      USER_APPEARANCE_INTERFACE_FONTS,
      DEFAULT_USER_APPEARANCE.interfaceFont,
    ),
    animationsEnabled: booleanPreference(
      raw.animationsEnabled,
      DEFAULT_USER_APPEARANCE.animationsEnabled,
    ),
    gradientsEnabled: booleanPreference(
      raw.gradientsEnabled,
      DEFAULT_USER_APPEARANCE.gradientsEnabled,
    ),
    updatedAt: typeof raw.updatedAt === 'string' ? raw.updatedAt : null,
  };
}

function normalizeWatcher(raw: RawWatcher): Watcher | null {
  if (!raw.id || !raw.userId) return null;
  const normalized: Watcher = {
    id: String(raw.id),
    userId: String(raw.userId),
    issueId: raw.issueId ?? null,
    projectId: raw.projectId ?? null,
    user: normalizeUser(raw.user),
  };
  if (raw.createdAt !== undefined) normalized.createdAt = raw.createdAt;
  return normalized;
}

function normalizeAiCapability(raw: RawAiCapability | null | undefined): AiCapability {
  const llm = (raw?.llm ?? {}) as Partial<AiCapability['llm']>;
  return {
    platformEnabled: raw?.platformEnabled === true,
    llm: {
      provider: (llm.provider ?? 'native') as AiCapability['llm']['provider'],
      model: String(llm.model ?? ''),
      configured: llm.configured === true,
      source: typeof llm.source === 'string' ? llm.source : null,
    },
    assistantEnabled: raw?.assistantEnabled === true,
    canDraft: raw?.canDraft === true,
    agentsEnabled: raw?.agentsEnabled === true,
    canRunAgents: raw?.canRunAgents === true,
  };
}

function normalizeIssueTriagePayload(raw: RawIssueTriagePayload): IssueTriagePayload {
  const payload = recordPayload(raw);
  const labels = Array.isArray(payload.labels)
    ? payload.labels.filter((label): label is string => typeof label === 'string')
    : undefined;
  const priority = typeof payload.priority === 'string' ? payload.priority : undefined;
  const suggestedAssigneeId =
    typeof payload.suggested_assignee_id === 'string'
      ? payload.suggested_assignee_id
      : payload.suggested_assignee_id === null
        ? null
        : undefined;
  const teamId =
    typeof payload.team_id === 'string'
      ? payload.team_id
      : payload.team_id === null
        ? null
        : undefined;
  const confidence = numericCount(
    typeof payload.confidence === 'number' || typeof payload.confidence === 'string'
      ? payload.confidence
      : undefined,
  );
  const rationale = typeof payload.rationale === 'string' ? payload.rationale : undefined;

  return {
    ...(labels ? { labels } : {}),
    ...(priority ? { priority } : {}),
    ...(suggestedAssigneeId !== undefined ? { suggested_assignee_id: suggestedAssigneeId } : {}),
    ...(teamId !== undefined ? { team_id: teamId } : {}),
    ...(confidence !== undefined ? { confidence } : {}),
    ...(rationale ? { rationale } : {}),
  };
}

function normalizeIssueTriageSuggestion(
  raw: RawIssueTriageSuggestion | null | undefined,
): IssueTriageSuggestion | null {
  if (!raw?.id || !raw.issueId) return null;
  const confidence = numericCount(raw.confidence) ?? 0;
  return {
    id: String(raw.id),
    issueId: String(raw.issueId),
    payload: normalizeIssueTriagePayload(raw.payload),
    confidence,
    appliedAt: raw.appliedAt ?? null,
    dismissedAt: raw.dismissedAt ?? null,
    createdAt: raw.createdAt ?? '',
  };
}

function normalizeIssueAssistResult(raw: RawIssueAssistResult): IssueAssistResult {
  const labels = Array.isArray(raw.labels)
    ? raw.labels.filter((label): label is string => typeof label === 'string')
    : undefined;
  return {
    text: String(raw.text ?? ''),
    ...(labels ? { labels } : {}),
    provider: (raw.provider ?? 'native') as IssueAssistResult['provider'],
  };
}

function normalizeEstimateNeighbour(
  raw: RawEstimateNeighbourIssue,
): NonNullable<AiEstimateSuggestion['neighbours']>[number] | null {
  if (typeof raw.id !== 'string' || typeof raw.key !== 'string' || typeof raw.title !== 'string') {
    return null;
  }
  return {
    id: raw.id,
    key: raw.key,
    title: raw.title,
    actualHours: numericCount(raw.actualHours) ?? 0,
    similarity: numericCount(raw.similarity) ?? 0,
  };
}

function normalizeAiEstimateSuggestion(raw: RawAiEstimateSuggestion): AiEstimateSuggestion {
  const neighbours = Array.isArray(raw.neighbours)
    ? raw.neighbours
        .map((item) => normalizeEstimateNeighbour(item as RawEstimateNeighbourIssue))
        .filter((item): item is NonNullable<typeof item> => item !== null)
    : undefined;
  return {
    estimateHours: numericCount(raw.estimateHours) ?? null,
    p25Hours: numericCount(raw.p25Hours) ?? null,
    p75Hours: numericCount(raw.p75Hours) ?? null,
    reason: typeof raw.reason === 'string' ? raw.reason : 'not_enough_data',
    rationale: typeof raw.rationale === 'string' ? raw.rationale : '',
    sampleSize: numericCount(raw.sampleSize) ?? 0,
    ...(neighbours ? { neighbours } : {}),
  };
}

function normalizeIssueAgentSession(raw: RawIssueAgentSession): IssueAgentSession | null {
  if (!raw.id || !raw.issueId) return null;
  const provider = agentSessionProviders.has(raw.provider as AgentSessionProvider)
    ? (raw.provider as AgentSessionProvider)
    : 'custom';
  const state = agentSessionStates.has(raw.state as AgentSessionState)
    ? (raw.state as AgentSessionState)
    : 'pending';
  return {
    id: String(raw.id),
    issueId: String(raw.issueId),
    provider,
    externalId: typeof raw.externalId === 'string' ? raw.externalId : null,
    state,
    payload: recordPayload(raw.payload),
    startedAt: typeof raw.startedAt === 'string' ? raw.startedAt : '',
    updatedAt: typeof raw.updatedAt === 'string' ? raw.updatedAt : '',
    finishedAt: typeof raw.finishedAt === 'string' ? raw.finishedAt : null,
  };
}

function normalizeDispatchIssueAgentResult(
  raw: RawDispatchIssueAgentResult,
): DispatchIssueAgentResult {
  const provider = agentSessionProviders.has(raw.provider as AgentSessionProvider)
    ? (raw.provider as AgentSessionProvider)
    : 'custom';
  return {
    sessionId: String(raw.sessionId ?? ''),
    provider,
    state: typeof raw.state === 'string' ? raw.state : 'pending',
    ...(raw.runner === 'local_cli' ? { runner: 'local_cli' as const } : {}),
    ...(typeof raw.callbackUrl === 'string' ? { callbackUrl: raw.callbackUrl } : {}),
  };
}

function normalizeAiIssueDraftResponse(raw: RawAiIssueDraftResponse): AiIssueDraftResponse {
  const draft = raw.draft ?? {};
  const labels = Array.isArray(draft.labels)
    ? draft.labels.filter((label): label is string => typeof label === 'string')
    : [];
  const type = issueTypeValues.has(draft.type as IssueType) ? (draft.type as IssueType) : 'task';
  const priority = priorityValues.has(draft.priority as IssuePriority)
    ? (draft.priority as IssuePriority)
    : 'medium';
  return {
    draft: {
      type,
      title: typeof draft.title === 'string' ? draft.title : '',
      description: typeof draft.description === 'string' ? draft.description : null,
      priority,
      labels,
      estimate: numericCount(draft.estimate) ?? null,
    },
    provider: (typeof raw.provider === 'string'
      ? raw.provider
      : 'native') as AiIssueDraftResponse['provider'],
  };
}

function normalizeAskSource(raw: RawAskCitationSource): AskCitationSource | null {
  if (
    (raw.type !== 'issue' && raw.type !== 'doc') ||
    typeof raw.id !== 'string' ||
    typeof raw.title !== 'string'
  ) {
    return null;
  }
  const source: AskCitationSource = {
    type: raw.type,
    id: raw.id,
    title: raw.title,
    snippet: typeof raw.snippet === 'string' ? raw.snippet : '',
  };
  if (typeof raw.key === 'string') source.key = raw.key;
  if (typeof raw.url === 'string') source.url = raw.url;
  return source;
}

function normalizeAskCitation(raw: RawAskCitation): AskCitation | null {
  const source = normalizeAskSource(raw);
  if (!source || typeof raw.key !== 'string') return null;
  return {
    ...source,
    key: raw.key,
    occurrence: numericCount(raw.occurrence) ?? 0,
  };
}

function normalizeAskUsage(raw: RawAskUsage | null | undefined): AskUsage | null {
  if (!raw) return null;
  return {
    model: typeof raw.model === 'string' ? raw.model : '',
    inputTokens: numericCount(raw.inputTokens) ?? 0,
    outputTokens: numericCount(raw.outputTokens) ?? 0,
    costUsd: numericCount(raw.costUsd) ?? 0,
    latencyMs: numericCount(raw.latencyMs) ?? 0,
    reranked: raw.reranked === true,
    promptHash: typeof raw.promptHash === 'string' ? raw.promptHash : '',
  };
}

function parseAskSse(text: string): AskTaskNebulaResponse {
  let answer = '';
  let usage: AskUsage | null = null;
  const sources: AskCitationSource[] = [];
  const citations: AskCitation[] = [];
  let streamError: string | null = null;

  for (const frame of text.split(/\n\n+/)) {
    const dataLines = frame
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter((line) => line.startsWith('data:'))
      .map((line) => line.slice(5).trim());
    if (dataLines.length === 0) continue;

    let event: RawAskEvent;
    try {
      event = JSON.parse(dataLines.join('\n')) as RawAskEvent;
    } catch {
      continue;
    }

    if (event.type === 'sources' && Array.isArray(event.sources)) {
      sources.splice(
        0,
        sources.length,
        ...event.sources
          .map((source) => normalizeAskSource(source as RawAskCitationSource))
          .filter((source): source is AskCitationSource => source !== null),
      );
    } else if (event.type === 'token' && typeof event.text === 'string') {
      answer += event.text;
    } else if (event.type === 'citations' && Array.isArray(event.citations)) {
      citations.splice(
        0,
        citations.length,
        ...event.citations
          .map((citation) => normalizeAskCitation(citation as RawAskCitation))
          .filter((citation): citation is AskCitation => citation !== null),
      );
    } else if (event.type === 'done') {
      usage = normalizeAskUsage(event.usage as RawAskUsage | null | undefined);
    } else if (event.type === 'error') {
      streamError = typeof event.error === 'string' ? event.error : 'Ask stream failed';
    }
  }

  if (streamError) {
    throw new ApiError(500, streamError);
  }

  return {
    answer: answer.trim(),
    sources,
    citations,
    usage,
  };
}

function numericCount(value: number | string | null | undefined): number | undefined {
  if (value === null || value === undefined) return undefined;
  const next = Number(value);
  return Number.isFinite(next) ? next : undefined;
}

function numericArray(value: unknown): number[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => numericCount(item as number | string | null | undefined))
    .filter((item): item is number => item !== undefined);
}

function numericRecord(value: Record<string, number | string | null> | null | undefined) {
  const result: Record<string, number> = {};
  if (!value) return result;
  for (const [key, count] of Object.entries(value)) {
    result[key] = numericCount(count) ?? 0;
  }
  return result;
}

function recordPayload(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  return value as Record<string, unknown>;
}

function optionalRecordPayload(value: unknown): Record<string, unknown> | null {
  const record = recordPayload(value);
  return Object.keys(record).length > 0 ? record : null;
}

function stringArrayPayload(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === 'string')
    : [];
}

function normalizeDraft(raw: RawDraft): Draft | null {
  if (!raw.id) return null;
  const normalized: Draft = {
    id: String(raw.id),
    title: raw.title ?? '',
    content: raw.content ?? null,
    entityType: raw.entityType ?? 'other',
    metadata: recordPayload(raw.metadata),
  };
  if (raw.organizationId !== undefined) normalized.organizationId = raw.organizationId;
  if (raw.targetProjectId !== undefined) normalized.targetProjectId = raw.targetProjectId;
  if (raw.createdAt !== undefined) normalized.createdAt = raw.createdAt;
  if (raw.updatedAt !== undefined) normalized.updatedAt = raw.updatedAt;
  return normalized;
}

function normalizeApiKey(raw: RawApiKey): ApiKey | null {
  if (!raw.id || !raw.name) return null;
  const keyPrefix = raw.keyPrefix ?? raw.prefix ?? '';
  const normalized: ApiKey = {
    id: String(raw.id),
    name: raw.name,
    keyPrefix: String(keyPrefix),
    isActive: raw.isActive !== false,
    lastUsedAt: raw.lastUsedAt ?? null,
    expiresAt: raw.expiresAt ?? null,
    revokedAt: raw.revokedAt ?? null,
  };
  if (raw.createdAt !== undefined) normalized.createdAt = raw.createdAt;
  if (typeof raw.key === 'string') normalized.key = raw.key;
  return normalized;
}

function normalizeWebhook(raw: RawWebhook): Webhook | null {
  if (!raw.id || !raw.name || !raw.url) return null;
  const normalized: Webhook = {
    id: String(raw.id),
    name: raw.name,
    url: raw.url,
    events: Array.isArray(raw.events)
      ? raw.events.filter((event): event is string => typeof event === 'string')
      : [],
    isActive: raw.isActive !== false,
    lastTriggeredAt: raw.lastTriggeredAt ?? null,
    successCount: numericCount(raw.successCount) ?? 0,
    failureCount: numericCount(raw.failureCount) ?? 0,
  };
  if (raw.createdAt !== undefined) normalized.createdAt = raw.createdAt;
  if (raw.updatedAt !== undefined) normalized.updatedAt = raw.updatedAt;
  if (typeof raw.secret === 'string') normalized.secret = raw.secret;
  return normalized;
}

function normalizeWebhookTestResult(raw: RawWebhookTestResult): WebhookTestResult {
  const statusNumber = numericCount(raw.statusCode);
  const result: WebhookTestResult = {
    success: raw.success === true,
    statusCode: statusNumber ?? null,
    durationMs: numericCount(raw.durationMs) ?? 0,
  };
  if (raw.responseSnippet !== undefined) result.responseSnippet = raw.responseSnippet;
  if (raw.error !== undefined) result.error = raw.error;
  return result;
}

function normalizeAuditLogEntry(raw: RawAuditLogEntry): AuditLogEntry | null {
  if (!raw.id || !raw.action || !raw.resourceType || !raw.resourceId) return null;
  const normalized: AuditLogEntry = {
    id: String(raw.id),
    action: raw.action,
    resourceType: raw.resourceType,
    resourceId: raw.resourceId,
    projectId: raw.projectId ?? null,
    issueId: raw.issueId ?? null,
    changes:
      raw.changes && typeof raw.changes === 'object' && !Array.isArray(raw.changes)
        ? (raw.changes as AuditLogEntry['changes'])
        : null,
    metadata:
      raw.metadata && typeof raw.metadata === 'object' && !Array.isArray(raw.metadata)
        ? (raw.metadata as Record<string, unknown>)
        : null,
    user: normalizeUser(raw.user),
  };
  if (raw.createdAt !== undefined) normalized.createdAt = raw.createdAt;
  return normalized;
}

function normalizeAgentPolicyRule(raw: RawAgentPolicyRule): AgentPolicyRule | null {
  if (!raw.actor || !raw.resource || !raw.action || !raw.effect) return null;
  return {
    actor: raw.actor,
    actorKind: raw.actorKind ?? 'unknown',
    resource: raw.resource,
    action: raw.action,
    effect: raw.effect,
    approvers: stringArrayPayload(raw.approvers),
    raw: raw.raw ?? '',
    line: numericCount(raw.line) ?? 0,
    ...(raw.sourcePath ? { sourcePath: raw.sourcePath } : {}),
  };
}

function normalizeAgentPolicyError(raw: RawAgentPolicyParseError): AgentPolicyParseError | null {
  if (!raw.message && !raw.raw) return null;
  return {
    line: numericCount(raw.line) ?? 0,
    message: raw.message ?? '',
    raw: raw.raw ?? '',
  };
}

function normalizeAgentPolicyStatus(raw: RawAgentPolicyStatus): AgentPolicyStatus {
  const rules = Array.isArray(raw.rules)
    ? raw.rules
        .map((rule) => normalizeAgentPolicyRule(rule as RawAgentPolicyRule))
        .filter((rule): rule is AgentPolicyRule => rule !== null)
    : [];
  const errors = Array.isArray(raw.errors)
    ? raw.errors
        .map((error) => normalizeAgentPolicyError(error as RawAgentPolicyParseError))
        .filter((error): error is AgentPolicyParseError => error !== null)
    : [];

  return {
    enabled: raw.enabled === true,
    found: raw.found === true,
    sourcePath: raw.sourcePath ?? null,
    parsedAt: raw.parsedAt ?? null,
    errors,
    rules,
  };
}

function normalizeAgentApprovalStatus(value: string | null | undefined): AgentApprovalStatus {
  if (value === 'approved' || value === 'rejected' || value === 'expired') return value;
  return 'pending';
}

function normalizeAgentApprovalRequest(raw: RawAgentApprovalRequest): AgentApprovalRequest | null {
  if (!raw.id || !raw.workspaceId || !raw.actor || !raw.resource || !raw.action) return null;
  return {
    id: String(raw.id),
    workspaceId: raw.workspaceId,
    projectId: raw.projectId ?? null,
    requestedBy: raw.requestedBy ?? null,
    actor: raw.actor,
    resource: raw.resource,
    action: raw.action,
    targetType: raw.targetType ?? 'unknown',
    targetId: raw.targetId ?? null,
    proposedPayload: raw.proposedPayload ?? {},
    matchedRule: raw.matchedRule ?? null,
    decisionReason: raw.decisionReason ?? null,
    status: normalizeAgentApprovalStatus(raw.status),
    requestedAt: raw.requestedAt ?? null,
    expiresAt: raw.expiresAt ?? null,
    decidedBy: raw.decidedBy ?? null,
    decidedAt: raw.decidedAt ?? null,
    ...(raw.createdAt !== undefined ? { createdAt: raw.createdAt } : {}),
    ...(raw.updatedAt !== undefined ? { updatedAt: raw.updatedAt } : {}),
  };
}

function normalizeAgentApprovalDecision(raw: {
  approval?: RawAgentApprovalRequest;
  result?: unknown;
}): AgentApprovalDecisionResult {
  const approval = normalizeAgentApprovalRequest(raw.approval ?? {});
  if (!approval) throw new Error(i18next.t('team.agentGovernance.decisionFailed'));
  const result = optionalRecordPayload(raw.result);
  return {
    approval,
    ...(result ? { result } : {}),
  };
}

function normalizeRegistrationPolicy(
  raw: RawRegistrationPolicy | null | undefined,
): RegistrationPolicy {
  const mode = registrationModes.has(raw?.mode as RegistrationMode)
    ? (raw?.mode as RegistrationMode)
    : 'allow_registration';
  const normalized: RegistrationPolicy = { mode };
  if (raw?.updatedAt !== undefined) normalized.updatedAt = raw.updatedAt;
  if (raw?.updatedBy !== undefined) normalized.updatedBy = raw.updatedBy;
  return normalized;
}

function normalizeAdminStats(raw: RawAdminStatsResponse): AdminStatsResponse {
  return {
    overview: {
      totalOrganizations: numericCount(raw.overview?.totalOrganizations) ?? 0,
      totalUsers: numericCount(raw.overview?.totalUsers) ?? 0,
      activeUsers: numericCount(raw.overview?.activeUsers) ?? 0,
      superAdmins: numericCount(raw.overview?.superAdmins) ?? 0,
      totalProjects: numericCount(raw.overview?.totalProjects) ?? 0,
      totalIssues: numericCount(raw.overview?.totalIssues) ?? 0,
      totalComments: numericCount(raw.overview?.totalComments) ?? 0,
    },
    organizations: {
      byStatus: numericRecord(raw.organizations?.byStatus),
      byPlan: numericRecord(raw.organizations?.byPlan),
    },
    growth: {
      newOrganizations30d: numericCount(raw.growth?.newOrganizations30d) ?? 0,
      newUsers30d: numericCount(raw.growth?.newUsers30d) ?? 0,
    },
  };
}

function normalizeAdminPagination(
  raw: RawAdminDirectoryPagination | null | undefined,
): AdminDirectoryPagination {
  return {
    page: numericCount(raw?.page) ?? 1,
    limit: numericCount(raw?.limit) ?? 20,
    total: numericCount(raw?.total) ?? 0,
    totalPages: numericCount(raw?.totalPages) ?? 0,
  };
}

function normalizeAdminDirectoryOwner(
  raw: RawAdminDirectoryOwner | null | undefined,
): AdminDirectoryOwner | null {
  if (!raw?.id || !raw.email) return null;
  return {
    id: String(raw.id),
    name: raw.name ?? null,
    email: raw.email,
    image: raw.image ?? null,
  };
}

function normalizeAdminOrganizationSummary(
  raw: RawAdminOrganizationSummary,
): AdminOrganizationSummary | null {
  if (!raw.id || !raw.name) return null;
  const normalized: AdminOrganizationSummary = {
    id: String(raw.id),
    name: raw.name,
    slug: raw.slug ?? String(raw.id),
    plan: (raw.plan ?? 'free') as AdminOrganizationPlan,
    status: (raw.status ?? 'active') as AdminOrganizationStatus,
    domain: raw.domain ?? null,
    logoUrl: raw.logoUrl ?? null,
    stats: {
      members: numericCount(raw.stats?.members) ?? 0,
      projects: numericCount(raw.stats?.projects) ?? 0,
      issues: numericCount(raw.stats?.issues) ?? 0,
    },
    owner: normalizeAdminDirectoryOwner(raw.owner),
  };
  if (raw.createdAt !== undefined) normalized.createdAt = raw.createdAt;
  if (raw.updatedAt !== undefined) normalized.updatedAt = raw.updatedAt;
  return normalized;
}

function normalizeAdminOrganizationsResponse(
  raw: RawAdminOrganizationsResponse,
): AdminOrganizationsResponse {
  const organizations = Array.isArray(raw.organizations)
    ? raw.organizations
        .map((organization) =>
          normalizeAdminOrganizationSummary(organization as RawAdminOrganizationSummary),
        )
        .filter((organization): organization is AdminOrganizationSummary => organization !== null)
    : [];

  return {
    organizations,
    pagination: normalizeAdminPagination(raw.pagination),
  };
}

function normalizeAdminUserOrganizationMembership(
  raw: RawAdminUserOrganizationMembership,
): AdminUserOrganizationMembership | null {
  if (!raw.organizationId || !raw.organizationName) return null;
  return {
    organizationId: String(raw.organizationId),
    organizationName: raw.organizationName,
    role: raw.role ?? 'member',
  };
}

function normalizeAdminUserProjectMembership(
  raw: RawAdminUserProjectMembership,
): AdminUserProjectMembership | null {
  if (!raw.projectId || !raw.projectKey || !raw.projectName || !raw.organizationId) return null;
  return {
    projectId: String(raw.projectId),
    projectKey: raw.projectKey,
    projectName: raw.projectName,
    organizationId: raw.organizationId,
    organizationName: raw.organizationName ?? null,
    role: raw.role ?? 'member',
  };
}

function normalizeAdminUserLastActivity(
  raw: RawAdminUserLastActivity | null | undefined,
): AdminUserLastActivity | null {
  if (!raw?.action || !raw.resourceType || !raw.createdAt) return null;
  return {
    action: raw.action,
    resourceType: raw.resourceType,
    resourceId: raw.resourceId ?? null,
    projectId: raw.projectId ?? null,
    createdAt: raw.createdAt,
    scope: raw.scope ?? 'workspace',
  };
}

function normalizeAdminUserSummary(raw: RawAdminUserSummary): AdminUserSummary | null {
  if (!raw.id || !raw.email) return null;
  const organizations = Array.isArray(raw.organizations)
    ? raw.organizations
        .map((membership) =>
          normalizeAdminUserOrganizationMembership(
            membership as RawAdminUserOrganizationMembership,
          ),
        )
        .filter((membership): membership is AdminUserOrganizationMembership => membership !== null)
    : [];
  const projectMemberships = Array.isArray(raw.projectMemberships)
    ? raw.projectMemberships
        .map((membership) =>
          normalizeAdminUserProjectMembership(membership as RawAdminUserProjectMembership),
        )
        .filter((membership): membership is AdminUserProjectMembership => membership !== null)
    : [];

  const normalized: AdminUserSummary = {
    id: String(raw.id),
    name: raw.name ?? null,
    email: raw.email,
    image: raw.image ?? null,
    status: (raw.status ?? 'active') as AdminUserStatus,
    isSuperAdmin: raw.isSuperAdmin === true,
    superAdminGrantedAt: raw.superAdminGrantedAt ?? null,
    emailVerified: raw.emailVerified ?? null,
    lastSeenAt: raw.lastSeenAt ?? null,
    organizations,
    projectMemberships,
    lastActivity: normalizeAdminUserLastActivity(raw.lastActivity),
  };
  if (raw.createdAt !== undefined) normalized.createdAt = raw.createdAt;
  return normalized;
}

function normalizeAdminUsersResponse(raw: RawAdminUsersResponse): AdminUsersResponse {
  const users = Array.isArray(raw.users)
    ? raw.users
        .map((user) => normalizeAdminUserSummary(user as RawAdminUserSummary))
        .filter((user): user is AdminUserSummary => user !== null)
    : [];

  return {
    users,
    pagination: normalizeAdminPagination(raw.pagination),
  };
}

function normalizeAdminSmtpConfig(raw: RawAdminSmtpConfig | null | undefined): AdminSmtpConfig {
  return {
    host: raw?.host ?? '',
    port: numericCount(raw?.port) ?? 25,
    secure: raw?.secure === true,
    user: raw?.user ?? '',
    passwordPreview: raw?.passwordPreview ?? null,
    emailFrom: raw?.emailFrom ?? '',
    updatedAt: raw?.updatedAt ?? null,
    updatedBy: raw?.updatedBy ?? null,
    configured: raw?.configured === true,
  };
}

function normalizeAdminStorageConfig(
  raw: RawAdminStorageConfig | null | undefined,
): AdminStorageConfig {
  return {
    uploadsDir: raw?.uploadsDir ?? '',
    s3Bucket: raw?.s3Bucket ?? '',
    s3Region: raw?.s3Region ?? '',
    s3AccessKey: raw?.s3AccessKey ?? '',
    s3SecretKeyPreview: raw?.s3SecretKeyPreview ?? null,
    updatedAt: raw?.updatedAt ?? null,
    updatedBy: raw?.updatedBy ?? null,
    configured: raw?.configured === true,
  };
}

function normalizeAdminLivekitConfig(
  raw: RawAdminLivekitConfig | null | undefined,
): AdminLivekitConfig {
  return {
    url: raw?.url ?? '',
    apiKey: raw?.apiKey ?? '',
    apiSecretPreview: raw?.apiSecretPreview ?? null,
    updatedAt: raw?.updatedAt ?? null,
    updatedBy: raw?.updatedBy ?? null,
    configured: raw?.configured === true,
  };
}

function normalizeAdminSystemTestResult(raw: RawAdminSystemTestResult): AdminSystemTestResult {
  const normalized: AdminSystemTestResult = {
    success: raw.success === true,
    source: raw.source ?? null,
    error: raw.error ?? null,
  };
  if (raw.messageId !== undefined) normalized.messageId = raw.messageId;
  if (raw.recipient !== undefined) normalized.recipient = raw.recipient;
  if (raw.url !== undefined) normalized.url = raw.url;
  if (raw.roomName !== undefined) normalized.roomName = raw.roomName;
  if (raw.tokenPreview !== undefined) normalized.tokenPreview = raw.tokenPreview;
  return normalized;
}

function boundedNumber(
  value: number | string | null | undefined,
  fallback: number,
  min: number,
  max: number,
): number {
  const normalized = numericCount(value);
  if (normalized === undefined) return fallback;
  return Math.min(Math.max(Math.round(normalized), min), max);
}

function normalizeAdminAgentControlSettings(
  raw: RawAdminAgentControlSettings | null | undefined,
): AdminAgentControlSettings {
  return {
    globalEnabled: raw?.globalEnabled === true,
    allowWriteActions: typeof raw?.allowWriteActions === 'boolean' ? raw.allowWriteActions : true,
    requireSupervisionForAutoMode:
      typeof raw?.requireSupervisionForAutoMode === 'boolean'
        ? raw.requireSupervisionForAutoMode
        : true,
    maxConcurrentRuns: boundedNumber(raw?.maxConcurrentRuns, 6, 1, 50),
  };
}

function normalizeAdminAgentControlStats(
  raw: RawAdminAgentControlStats | null | undefined,
): AdminAgentControlStats {
  return {
    enabledWorkspaceCount: numericCount(raw?.enabledWorkspaceCount) ?? 0,
    enabledProjectCount: numericCount(raw?.enabledProjectCount) ?? 0,
    recentRunCount: numericCount(raw?.recentRunCount) ?? 0,
    runningRuns: numericCount(raw?.runningRuns) ?? 0,
    failedRuns: numericCount(raw?.failedRuns) ?? 0,
    readyWorkspaceCount: numericCount(raw?.readyWorkspaceCount) ?? 0,
    blockedWorkspaceCount: numericCount(raw?.blockedWorkspaceCount) ?? 0,
  };
}

function normalizeAdminAgentServiceStatus(
  raw: RawAdminAgentServiceStatus,
): AdminAgentServiceStatus | null {
  if (!raw.key) return null;
  return {
    key: String(raw.key),
    label: raw.label ?? String(raw.key),
    state: raw.state ?? 'unknown',
    detail: raw.detail ?? '',
  };
}

function normalizeAdminAgentProviderStatus(
  raw: RawAdminAgentProviderStatus | null | undefined,
): AdminAgentProviderStatus {
  return {
    ready: raw?.ready === true,
    summary: raw?.summary ?? '',
    configured: raw?.configured === true,
    source: raw?.source ?? null,
    label: raw?.label ?? null,
    updatedAt: raw?.updatedAt ?? null,
  };
}

function communicationFlag(value: unknown, fallback = true): boolean {
  return typeof value === 'boolean' ? value : fallback;
}

function normalizeWorkspaceCommunicationsSettings(
  raw: RawWorkspaceCommunicationsSettings | null | undefined,
): WorkspaceCommunicationsSettings {
  return {
    enabled: communicationFlag(raw?.enabled),
    voiceEnabled: communicationFlag(raw?.voiceEnabled),
    issueThreadsEnabled: communicationFlag(raw?.issueThreadsEnabled),
    documentThreadsEnabled: communicationFlag(raw?.documentThreadsEnabled),
    attachmentsEnabled: communicationFlag(raw?.attachmentsEnabled),
    unreadTrackingEnabled: communicationFlag(raw?.unreadTrackingEnabled),
  };
}

function normalizeWorkspaceCommunicationsServiceStatus(
  raw: RawWorkspaceCommunicationsServiceStatus | null | undefined,
): WorkspaceCommunicationsServiceStatus {
  const livekit = raw?.livekit ?? null;
  const missing = Array.isArray(livekit?.missing)
    ? livekit.missing.map((item) => String(item)).filter(Boolean)
    : [];

  return {
    redisReady: raw?.redisReady === true,
    livekit: {
      ready: livekit?.ready === true,
      url: livekit?.url ? String(livekit.url) : null,
      missing,
    },
  };
}

function normalizeWorkspaceCommunicationsSettingsResponse(
  raw: RawWorkspaceCommunicationsSettingsResponse,
): WorkspaceCommunicationsSettingsResponse {
  return {
    organizationId: raw.organizationId ?? '',
    organizationName: raw.organizationName ?? '',
    settings: normalizeWorkspaceCommunicationsSettings(raw.settings),
    serviceStatus: normalizeWorkspaceCommunicationsServiceStatus(raw.serviceStatus),
  };
}

function normalizeAdminAgentProviderBreakdown(
  raw: Record<string, RawAdminAgentProviderBreakdownItem> | null | undefined,
): AdminAgentProviderBreakdownItem[] {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return [];
  return Object.entries(raw)
    .map(([provider, item]) => ({
      provider,
      total: numericCount(item?.total) ?? 0,
      enabled: numericCount(item?.enabled) ?? 0,
      ready: numericCount(item?.ready) ?? 0,
      blocked: numericCount(item?.blocked) ?? 0,
    }))
    .sort(
      (left, right) =>
        right.enabled - left.enabled ||
        right.total - left.total ||
        left.provider.localeCompare(right.provider),
    );
}

function normalizeAdminAgentWorkspaceCoverage(
  raw: RawAdminAgentWorkspaceCoverage,
): AdminAgentWorkspaceCoverage | null {
  if (!raw.organizationId) return null;
  return {
    organizationId: String(raw.organizationId),
    organizationName: raw.organizationName ?? String(raw.organizationId),
    workspaceEnabled: raw.workspaceEnabled === true,
    enabledProjects: numericCount(raw.enabledProjects) ?? 0,
    provider: raw.provider ?? 'native',
    model: raw.model ?? '',
    selectedModelConfigId: raw.selectedModelConfigId ?? null,
    selectedModelConfigName: raw.selectedModelConfigName ?? null,
    executionMode: raw.executionMode ?? 'manual',
    providerStatus: normalizeAdminAgentProviderStatus(raw.providerStatus),
    lastRunAt: raw.lastRunAt ?? null,
    lastFailure: raw.lastFailure ?? null,
  };
}

function normalizeAdminAgentRecentRun(raw: RawAdminAgentRecentRun): AdminAgentRecentRun | null {
  if (!raw.id) return null;
  return {
    id: String(raw.id),
    kind: raw.kind ?? 'unknown',
    status: raw.status ?? 'unknown',
    dryRun: raw.dryRun === true,
    summary: raw.summary ?? null,
    writeActionsCount: numericCount(raw.writeActionsCount) ?? 0,
    createdAt: raw.createdAt ?? null,
    error: raw.error ?? null,
    organizationId: raw.organizationId ?? null,
    organizationName: raw.organizationName ?? null,
    projectId: raw.projectId ?? null,
    projectName: raw.projectName ?? null,
    initiatedBy: raw.initiatedBy ?? null,
  };
}

function normalizeAdminAgentControlResponse(
  raw: RawAdminAgentControlResponse,
): AdminAgentControlResponse {
  const serviceStatus = Array.isArray(raw.serviceStatus)
    ? raw.serviceStatus
        .map((status) => normalizeAdminAgentServiceStatus(status as RawAdminAgentServiceStatus))
        .filter((status): status is AdminAgentServiceStatus => status !== null)
    : [];
  const workspaceCoverage = Array.isArray(raw.workspaceCoverage)
    ? raw.workspaceCoverage
        .map((coverage) =>
          normalizeAdminAgentWorkspaceCoverage(coverage as RawAdminAgentWorkspaceCoverage),
        )
        .filter((coverage): coverage is AdminAgentWorkspaceCoverage => coverage !== null)
    : [];
  const recentRuns = Array.isArray(raw.recentRuns)
    ? raw.recentRuns
        .map((run) => normalizeAdminAgentRecentRun(run as RawAdminAgentRecentRun))
        .filter((run): run is AdminAgentRecentRun => run !== null)
    : [];

  return {
    settings: normalizeAdminAgentControlSettings(raw.settings),
    stats: normalizeAdminAgentControlStats(raw.stats),
    serviceStatus,
    providerBreakdown: normalizeAdminAgentProviderBreakdown(raw.providerBreakdown),
    workspaceCoverage,
    recentRuns,
  };
}

function booleanMap(value: unknown): Record<string, boolean> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>).map(([key, enabled]) => [
      key,
      enabled === true,
    ]),
  );
}

function normalizeAgentModelConfig(
  raw: RawAgentModelConfig | null | undefined,
): AgentModelConfig | null {
  if (!raw?.id || !raw.organizationId || !raw.name || !raw.provider || !raw.model) return null;
  return {
    id: String(raw.id),
    organizationId: String(raw.organizationId),
    name: String(raw.name),
    provider: String(raw.provider),
    model: String(raw.model),
    description: raw.description ?? null,
    isDefault: raw.isDefault === true,
    isArchived: raw.isArchived === true,
    revisionCount: numericCount(raw.revisionCount) ?? 0,
    createdAt: raw.createdAt ? String(raw.createdAt) : null,
    updatedAt: raw.updatedAt ? String(raw.updatedAt) : null,
  };
}

function normalizeOrganizationAgentWorkspaceSettings(
  raw: RawOrganizationAgentWorkspaceSettings | null | undefined,
): OrganizationAgentWorkspaceSettings {
  return {
    enabled: raw?.enabled === true,
    assistantEnabled: raw?.assistantEnabled !== false,
    modelConfigId: raw?.modelConfigId ?? null,
    provider: raw?.provider ?? 'native',
    model: raw?.model ?? 'native',
    executionMode: raw?.executionMode ?? 'manual',
    allowWriteActions: raw?.allowWriteActions === true,
    requireApprovalForWrites: raw?.requireApprovalForWrites !== false,
    aiOversight: raw?.aiOversight === 'auto' ? 'auto' : 'review_required',
    aiSafetyMode: raw?.aiSafetyMode ?? 'warn',
    dailyRunLimit: numericCount(raw?.dailyRunLimit) ?? 25,
    capabilities: booleanMap(raw?.capabilities),
  };
}

function normalizeOrganizationAgentAccess(
  raw: RawOrganizationAgentAccess | null | undefined,
): OrganizationAgentAccess {
  return {
    canView: raw?.canView !== false,
    canManage: raw?.canManage === true,
    orgRole: raw?.orgRole ?? null,
    isSuperAdmin: raw?.isSuperAdmin === true,
  };
}

function normalizeOrganizationAgentConfigIssue(
  raw: RawOrganizationAgentConfigIssue,
): OrganizationAgentConfigIssue | null {
  if (!raw.code && !raw.title && !raw.detail) return null;
  return {
    code: raw.code ?? '',
    scope: raw.scope ?? 'workspace',
    severity: raw.severity ?? 'info',
    title: raw.title ?? '',
    detail: raw.detail ?? '',
    resolution: raw.resolution ?? '',
    blocksRuns: raw.blocksRuns === true,
  };
}

function normalizeOrganizationAgentRuntimeSummary(
  raw: RawOrganizationAgentRuntimeSummary | null | undefined,
): OrganizationAgentRuntimeSummary {
  return {
    projectCount: numericCount(raw?.projectCount) ?? 0,
    enabledProjectCount: numericCount(raw?.enabledProjectCount) ?? 0,
    runningRuns: numericCount(raw?.runningRuns) ?? 0,
    totalRuns: numericCount(raw?.totalRuns) ?? 0,
    lastRunAt: raw?.lastRunAt ?? null,
    lastCompletedAt: raw?.lastCompletedAt ?? null,
    lastFailedAt: raw?.lastFailedAt ?? null,
    lastFailure: raw?.lastFailure ?? null,
  };
}

function normalizeOrganizationAgentRecentRun(
  raw: RawOrganizationAgentRecentRun,
): OrganizationAgentRecentRun | null {
  if (!raw.id || !raw.kind || !raw.status) return null;
  return {
    id: String(raw.id),
    kind: String(raw.kind),
    status: String(raw.status),
    dryRun: raw.dryRun === true,
    summary: raw.summary ?? null,
    writeActionsCount: numericCount(raw.writeActionsCount) ?? 0,
    createdAt: raw.createdAt ? String(raw.createdAt) : null,
    completedAt: raw.completedAt ? String(raw.completedAt) : null,
    error: raw.error ?? null,
    projectId: raw.projectId ?? null,
    projectName: raw.projectName ?? null,
    initiatedBy: raw.initiatedBy ?? null,
  };
}

function normalizeOrganizationAgentSettingsResponse(
  raw: RawOrganizationAgentSettingsResponse,
): OrganizationAgentSettingsResponse {
  const modelConfigs = Array.isArray(raw.modelConfigs)
    ? raw.modelConfigs
        .map((config) => normalizeAgentModelConfig(config as RawAgentModelConfig))
        .filter((config): config is AgentModelConfig => config !== null)
    : [];
  const serviceStatus = Array.isArray(raw.serviceStatus)
    ? raw.serviceStatus
        .map((status) => normalizeAdminAgentServiceStatus(status as RawAdminAgentServiceStatus))
        .filter((status): status is AdminAgentServiceStatus => status !== null)
    : [];
  const configIssues = Array.isArray(raw.configIssues)
    ? raw.configIssues
        .map((issue) =>
          normalizeOrganizationAgentConfigIssue(issue as RawOrganizationAgentConfigIssue),
        )
        .filter((issue): issue is OrganizationAgentConfigIssue => issue !== null)
    : [];
  const recentRuns = Array.isArray(raw.recentRuns)
    ? raw.recentRuns
        .map((run) => normalizeOrganizationAgentRecentRun(run as RawOrganizationAgentRecentRun))
        .filter((run): run is OrganizationAgentRecentRun => run !== null)
    : [];

  return {
    organizationId: raw.organizationId ?? '',
    organizationName: raw.organizationName ?? '',
    workspaceSettings: normalizeOrganizationAgentWorkspaceSettings(raw.workspaceSettings),
    selectedModelConfig: normalizeAgentModelConfig(raw.selectedModelConfig),
    modelConfigs,
    access: normalizeOrganizationAgentAccess(raw.access),
    providerStatus: normalizeAdminAgentProviderStatus(raw.providerStatus),
    configIssues,
    runtimeSummary: normalizeOrganizationAgentRuntimeSummary(raw.runtimeSummary),
    serviceStatus,
    recentRuns,
    updatedAt: raw.updatedAt ? String(raw.updatedAt) : null,
  };
}

function normalizeProjectAgentAccess(
  raw: RawProjectAgentAccess | null | undefined,
): ProjectAgentAccess {
  return {
    canView: raw?.canView !== false,
    canManage: raw?.canManage === true,
    orgRole: raw?.orgRole ?? null,
    projectRole: raw?.projectRole ?? null,
    isSuperAdmin: raw?.isSuperAdmin === true,
  };
}

function normalizeProjectAgentSettings(
  raw: RawProjectAgentSettings | null | undefined,
): ProjectAgentSettings {
  return {
    enabled: raw?.enabled === true,
    inheritWorkspaceDefaults: raw?.inheritWorkspaceDefaults !== false,
    executionMode: raw?.executionMode ?? 'manual',
    allowWriteActions: raw?.allowWriteActions === true,
    sprintBatchSize: numericCount(raw?.sprintBatchSize) ?? 2,
    sprintLengthDays: numericCount(raw?.sprintLengthDays) ?? 14,
    issueCapacityPerSprint: numericCount(raw?.issueCapacityPerSprint) ?? 12,
    autoAssignToPlannedSprints: raw?.autoAssignToPlannedSprints === true,
    capabilities: booleanMap(raw?.capabilities),
  };
}

function normalizeProjectAgentEffectiveSettings(
  raw: RawProjectAgentEffectiveSettings | null | undefined,
): ProjectAgentEffectiveSettings {
  return {
    enabled: raw?.enabled === true,
    allowWriteActions: raw?.allowWriteActions === true,
    executionMode: raw?.executionMode ?? 'manual',
    provider: raw?.provider ?? 'native',
    model: raw?.model ?? 'native',
    requireApprovalForWrites: raw?.requireApprovalForWrites !== false,
    dailyRunLimit: numericCount(raw?.dailyRunLimit) ?? 25,
    sprintBatchSize: numericCount(raw?.sprintBatchSize) ?? 2,
    sprintLengthDays: numericCount(raw?.sprintLengthDays) ?? 14,
    issueCapacityPerSprint: numericCount(raw?.issueCapacityPerSprint) ?? 12,
    autoAssignToPlannedSprints: raw?.autoAssignToPlannedSprints === true,
    capabilities: booleanMap(raw?.capabilities),
  };
}

function normalizeProjectAgentRuntimeSummary(
  raw: RawProjectAgentRuntimeSummary | null | undefined,
): ProjectAgentRuntimeSummary {
  return {
    runningRuns: numericCount(raw?.runningRuns) ?? 0,
    lastRunAt: raw?.lastRunAt ?? null,
    lastCompletedAt: raw?.lastCompletedAt ?? null,
    lastFailedAt: raw?.lastFailedAt ?? null,
    lastFailure: raw?.lastFailure ?? null,
  };
}

function normalizeProjectAgentRunAvailability(
  raw: RawProjectAgentRunAvailability | null | undefined,
): ProjectAgentRunAvailability {
  return {
    canRun: raw?.canRun === true,
    reason: raw?.reason ?? null,
  };
}

function normalizeProjectAgentSettingsResponse(
  raw: RawProjectAgentSettingsResponse,
): ProjectAgentSettingsResponse {
  const project = (raw.project ?? {}) as Partial<ProjectAgentSettingsResponse['project']>;
  const configIssues = Array.isArray(raw.configIssues)
    ? raw.configIssues
        .map((issue) =>
          normalizeOrganizationAgentConfigIssue(issue as RawOrganizationAgentConfigIssue),
        )
        .filter((issue): issue is OrganizationAgentConfigIssue => issue !== null)
    : [];
  const serviceStatus = Array.isArray(raw.serviceStatus)
    ? raw.serviceStatus
        .map((status) => normalizeAdminAgentServiceStatus(status as RawAdminAgentServiceStatus))
        .filter((status): status is AdminAgentServiceStatus => status !== null)
    : [];
  const recentRuns = Array.isArray(raw.recentRuns)
    ? raw.recentRuns
        .map((run) => normalizeOrganizationAgentRecentRun(run as RawOrganizationAgentRecentRun))
        .filter((run): run is OrganizationAgentRecentRun => run !== null)
    : [];
  const lastRunByKind = Object.fromEntries(
    Object.entries(raw.lastRunByKind ?? {})
      .map(([kind, run]) => [kind, normalizeOrganizationAgentRecentRun(run)])
      .filter((entry): entry is [string, OrganizationAgentRecentRun] => entry[1] !== null),
  );

  return {
    project: {
      id: project.id ?? '',
      key: project.key ?? '',
      name: project.name ?? '',
    },
    access: normalizeProjectAgentAccess(raw.access),
    workspaceSettings: normalizeOrganizationAgentWorkspaceSettings(raw.workspaceSettings),
    selectedModelConfig: normalizeAgentModelConfig(raw.selectedModelConfig),
    projectSettings: normalizeProjectAgentSettings(raw.projectSettings),
    effectiveSettings: normalizeProjectAgentEffectiveSettings(raw.effectiveSettings),
    providerStatus: normalizeAdminAgentProviderStatus(raw.providerStatus),
    configIssues,
    runtimeSummary: normalizeProjectAgentRuntimeSummary(raw.runtimeSummary),
    runAvailability: normalizeProjectAgentRunAvailability(raw.runAvailability),
    serviceStatus,
    lastRunByKind,
    recentRuns,
  };
}

function normalizeAdminVersionImage(
  raw: RawAdminVersionImageStatus | undefined,
): AdminVersionImageStatus {
  return {
    repository: raw?.repository ?? 'neuraparse/tasknebula',
    latestTag: raw?.latestTag ?? null,
    latestTagUrl: raw?.latestTagUrl ?? null,
    latestPushedAt: raw?.latestPushedAt ?? null,
    latestDigest: raw?.latestDigest ?? null,
    latestSizeBytes: numericCount(raw?.latestSizeBytes) ?? null,
    updateAvailable: raw?.updateAvailable === true,
    checkedAt: raw?.checkedAt ?? null,
  };
}

function normalizeAdminSelfUpdate(
  raw: RawAdminSelfUpdateStatus | null | undefined,
): AdminSelfUpdateStatus | null {
  if (!raw) return null;
  return {
    enabled: raw.enabled === true,
    available: raw.available === true,
    mode: raw.mode ?? 'manual',
    blockedReason: raw.blockedReason ?? null,
    targetVersion: raw.targetVersion ?? null,
    repository: raw.repository ?? 'neuraparse/tasknebula',
    digest: raw.digest ?? null,
    imageRef: raw.imageRef ?? null,
    webhookConfigured: raw.webhookConfigured === true,
    manualCommands: raw.manualCommands ?? '',
  };
}

function normalizeAdminVersionStatus(raw: RawAdminVersionStatus): AdminVersionStatus {
  return {
    current: raw.current ?? '',
    latest: raw.latest ?? null,
    releaseUpdateAvailable: raw.releaseUpdateAvailable === true,
    updateAvailable: raw.updateAvailable === true,
    releaseUrl: raw.releaseUrl ?? null,
    publishedAt: raw.publishedAt ?? null,
    notes: raw.notes ?? null,
    checkedAt: raw.checkedAt ?? null,
    image: normalizeAdminVersionImage(raw.image),
    checkDisabled: raw.checkDisabled === true,
    selfUpdate: normalizeAdminSelfUpdate(raw.selfUpdate),
  };
}

function nullableNumeric(value: number | string | null | undefined): number | null {
  return value === null || value === undefined ? null : (numericCount(value) ?? null);
}

function normalizeAdminAiUsageLimits(
  raw: RawAdminAiUsageLimits | null | undefined,
): AdminAiUsageLimits {
  return {
    dailyTokens: nullableNumeric(raw?.dailyTokens),
    monthlyTokens: nullableNumeric(raw?.monthlyTokens),
    dailyCostUsd: nullableNumeric(raw?.dailyCostUsd),
    monthlyCostUsd: nullableNumeric(raw?.monthlyCostUsd),
  };
}

function normalizeAdminAiReservedUsage(
  raw: RawAdminAiReservedUsage | null | undefined,
): AdminAiReservedUsage {
  return {
    dailyTokens: numericCount(raw?.dailyTokens) ?? 0,
    monthlyTokens: numericCount(raw?.monthlyTokens) ?? 0,
    dailyCostUsd: numericCount(raw?.dailyCostUsd) ?? 0,
    monthlyCostUsd: numericCount(raw?.monthlyCostUsd) ?? 0,
  };
}

function normalizeAdminAiActualUsage(
  raw: RawAdminAiActualUsage | null | undefined,
): AdminAiActualUsage {
  return {
    callsToday: numericCount(raw?.callsToday) ?? 0,
    callsMonth: numericCount(raw?.callsMonth) ?? 0,
    tokensToday: numericCount(raw?.tokensToday) ?? 0,
    tokensMonth: numericCount(raw?.tokensMonth) ?? 0,
    costTodayUsd: numericCount(raw?.costTodayUsd) ?? 0,
    costMonthUsd: numericCount(raw?.costMonthUsd) ?? 0,
    budgetExhaustedMonth: numericCount(raw?.budgetExhaustedMonth) ?? 0,
    errorsMonth: numericCount(raw?.errorsMonth) ?? 0,
  };
}

function normalizeAdminAiUsageHistoryEntry(
  raw: RawAdminAiUsageHistoryEntry,
): AdminAiUsageHistoryEntry | null {
  if (!raw.day) return null;
  return {
    day: String(raw.day).slice(0, 10),
    calls: numericCount(raw.calls) ?? 0,
    tokens: numericCount(raw.tokens) ?? 0,
    cost: numericCount(raw.cost) ?? 0,
  };
}

function normalizeAdminAiFeatureUsage(raw: RawAdminAiFeatureUsage): AdminAiFeatureUsage | null {
  if (typeof raw.feature !== 'string') return null;
  return {
    feature: raw.feature,
    calls: numericCount(raw.calls) ?? 0,
    tokens: numericCount(raw.tokens) ?? 0,
    cost: numericCount(raw.cost) ?? 0,
  };
}

function normalizeAdminAiUsageOrganization(
  raw: RawAdminAiUsageOrganization,
): AdminAiUsageOrganization | null {
  if (!raw.organizationId) return null;
  const history = Array.isArray(raw.history)
    ? raw.history
        .map((entry) => normalizeAdminAiUsageHistoryEntry(entry as RawAdminAiUsageHistoryEntry))
        .filter((entry): entry is AdminAiUsageHistoryEntry => entry !== null)
    : [];
  const featureBreakdown = Array.isArray(raw.featureBreakdown)
    ? raw.featureBreakdown
        .map((entry) => normalizeAdminAiFeatureUsage(entry as RawAdminAiFeatureUsage))
        .filter((entry): entry is AdminAiFeatureUsage => entry !== null)
    : [];

  return {
    organizationId: String(raw.organizationId),
    organizationName: raw.organizationName ?? String(raw.organizationId),
    limits: normalizeAdminAiUsageLimits(raw.limits),
    reservedUsage: normalizeAdminAiReservedUsage(raw.reservedUsage),
    actualUsage: normalizeAdminAiActualUsage(raw.actualUsage),
    killSwitchEnabled: raw.killSwitchEnabled === true,
    periodResetsAt: raw.periodResetsAt ?? null,
    history,
    featureBreakdown,
  };
}

function normalizeAdminAiUsageResponse(raw: RawAdminAiUsageResponse): AdminAiUsageResponse {
  const organizations = Array.isArray(raw.organizations)
    ? raw.organizations
        .map((org) => normalizeAdminAiUsageOrganization(org as RawAdminAiUsageOrganization))
        .filter((org): org is AdminAiUsageOrganization => org !== null)
    : [];

  return {
    generatedAt: raw.generatedAt ?? null,
    windowDays: numericCount(raw.windowDays) ?? 7,
    dayStart: raw.dayStart ?? null,
    monthStart: raw.monthStart ?? null,
    organizations,
  };
}

function normalizeAdminAiKillSwitchResult(
  raw: RawAdminAiKillSwitchResult,
): AdminAiKillSwitchResult {
  if (!raw.organizationId) throw new Error(i18next.t('admin.aiUsage.updateFailed'));
  return {
    ok: raw.ok === true,
    organizationId: String(raw.organizationId),
    killSwitchEnabled: raw.killSwitchEnabled === true,
  };
}

function normalizeAdminAiUsageResetResult(
  raw: RawAdminAiUsageResetResult,
): AdminAiUsageResetResult {
  const scope = aiUsageResetScopes.has(raw.scope as AdminAiUsageResetScope)
    ? (raw.scope as AdminAiUsageResetScope)
    : 'daily';
  const normalized: AdminAiUsageResetResult = {
    ok: raw.ok === true,
    scope,
  };
  if (raw.organizationId !== undefined) normalized.organizationId = raw.organizationId;
  return normalized;
}

function normalizeAdminFeatureFlag(raw: RawAdminFeatureFlag): AdminFeatureFlag | null {
  if (!raw.id || !raw.key || !raw.name) return null;
  const normalized: AdminFeatureFlag = {
    id: String(raw.id),
    key: raw.key,
    name: raw.name,
    description: raw.description ?? null,
    isEnabled: raw.isEnabled === true,
    enabledForPlans: stringArrayPayload(raw.enabledForPlans),
    enabledForOrganizations: stringArrayPayload(raw.enabledForOrganizations),
    rolloutPercentage: numericCount(raw.rolloutPercentage) ?? 0,
    metadata: recordPayload(raw.metadata),
    createdBy: raw.createdBy ?? null,
    updatedBy: raw.updatedBy ?? null,
  };
  if (raw.createdAt !== undefined) normalized.createdAt = raw.createdAt;
  if (raw.updatedAt !== undefined) normalized.updatedAt = raw.updatedAt;
  return normalized;
}

function normalizeAdminRealtimeHealth(raw: RawAdminRealtimeHealth): AdminRealtimeHealth {
  const redis = raw.services?.redis ?? null;
  const livekit = raw.services?.livekit ?? null;
  return {
    services: {
      redis: {
        ready: redis?.ready === true,
        mode: redis?.mode ?? 'unknown',
      },
      livekit: {
        ready: livekit?.ready === true,
        url: livekit?.url ?? null,
        missing: stringArrayPayload(livekit?.missing),
      },
    },
    stats: {
      channels: numericCount(raw.stats?.channels) ?? 0,
      rooms: numericCount(raw.stats?.rooms) ?? 0,
      activeCalls: numericCount(raw.stats?.activeCalls) ?? 0,
      readStates: numericCount(raw.stats?.readStates) ?? 0,
    },
  };
}

function normalizeSystemAuditLogEntry(raw: RawSystemAuditLogEntry): SystemAuditLogEntry | null {
  if (!raw.id || !raw.action || !raw.resourceType) return null;
  const normalized: SystemAuditLogEntry = {
    id: String(raw.id),
    action: raw.action,
    resourceType: raw.resourceType,
    resourceId: raw.resourceId ?? null,
    organizationId: raw.organizationId ?? null,
    changes:
      raw.changes && typeof raw.changes === 'object' && !Array.isArray(raw.changes)
        ? (raw.changes as SystemAuditLogEntry['changes'])
        : null,
    metadata: optionalRecordPayload(raw.metadata),
    ipAddress: raw.ipAddress ?? null,
    userAgent: raw.userAgent ?? null,
    user: raw.user ?? null,
  };
  if (raw.createdAt !== undefined) normalized.createdAt = raw.createdAt;
  return normalized;
}

function normalizeTemplateKind(value: unknown): TemplateKind {
  return typeof value === 'string' && value.trim().length > 0 ? value : 'project';
}

function normalizePinnedItemKind(value: unknown): PinnedItemKind {
  return typeof value === 'string' && value.trim().length > 0 ? value : 'custom';
}

function normalizePinnedItem(raw: RawPinnedItem): PinnedItem | null {
  if (!raw.id || !raw.title || !raw.href) return null;
  return {
    id: String(raw.id),
    userId: raw.userId ?? null,
    kind: normalizePinnedItemKind(raw.kind),
    entityId: raw.entityId ?? null,
    title: raw.title,
    href: raw.href,
    pinnedAt: raw.pinnedAt ?? raw.createdAt ?? '',
  };
}

function normalizeStandupDigest(raw: RawStandupDigest | null | undefined): StandupDigest | null {
  if (!raw?.id || !raw.date || typeof raw.contentMd !== 'string') return null;
  return {
    id: String(raw.id),
    date: raw.date,
    contentMd: raw.contentMd,
    blockersMd: typeof raw.blockersMd === 'string' ? raw.blockersMd : '',
    createdAt: raw.createdAt ?? '',
  };
}

function normalizeLastSeen(response: RawLastSeenResponse | undefined): string | null {
  return typeof response?.lastSeenAt === 'string' && response.lastSeenAt.trim().length > 0
    ? response.lastSeenAt
    : null;
}

function normalizeTemplate(raw: RawTemplate): WorkTemplate | null {
  if (!raw.id || !raw.name) return null;
  const normalized: WorkTemplate = {
    id: String(raw.id),
    organizationId: raw.organizationId ?? null,
    name: raw.name,
    description: raw.description ?? null,
    category: raw.category ?? 'general',
    icon: raw.icon ?? null,
    color: raw.color ?? null,
    kind: normalizeTemplateKind(raw.kind),
    payload: recordPayload(raw.payload),
    usageCount: numericCount(raw.usageCount) ?? 0,
    isPublic: raw.isPublic === true,
    isVerified: raw.isVerified === true,
  };
  if (raw.createdBy !== undefined) normalized.createdBy = raw.createdBy;
  if (raw.createdAt !== undefined) normalized.createdAt = raw.createdAt;
  if (raw.updatedAt !== undefined) normalized.updatedAt = raw.updatedAt;
  return normalized;
}

function normalizeTemplateResource(value: unknown): UseTemplateResult['resource'] | undefined {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return undefined;
  const raw = value as Record<string, unknown>;
  if (typeof raw.id !== 'string' || raw.id.length === 0) return undefined;
  const resource: NonNullable<UseTemplateResult['resource']> = { id: raw.id };
  if (typeof raw.key === 'string') resource.key = raw.key;
  if (typeof raw.name === 'string') resource.name = raw.name;
  if (typeof raw.title === 'string') resource.title = raw.title;
  if (typeof raw.projectId === 'string') resource.projectId = raw.projectId;
  return resource;
}

function normalizeUseTemplateResult(raw: RawUseTemplateResult): UseTemplateResult {
  const result: UseTemplateResult = {
    kind: normalizeTemplateKind(raw.kind),
  };
  const resource = normalizeTemplateResource(raw.resource);
  const payload = recordPayload(raw.payload);
  if (resource) result.resource = resource;
  if (Object.keys(payload).length > 0) result.payload = payload;
  if (typeof raw.templateId === 'string') result.templateId = raw.templateId;
  if (typeof raw.message === 'string') result.message = raw.message;
  return result;
}

function normalizeSprint(raw: RawSprint): Sprint | null {
  if (!raw.id || !raw.projectId || !raw.name) return null;
  const normalized: Sprint = {
    id: String(raw.id),
    projectId: String(raw.projectId),
    name: raw.name,
    goal: raw.goal ?? null,
    startDate: raw.startDate ?? null,
    endDate: raw.endDate ?? null,
    status: raw.status ?? 'planned',
  };
  if (raw.createdAt !== undefined) normalized.createdAt = raw.createdAt;
  if (raw.updatedAt !== undefined) normalized.updatedAt = raw.updatedAt;
  if (raw.createdBy !== undefined) normalized.createdBy = raw.createdBy;
  if (raw.updatedBy !== undefined) normalized.updatedBy = raw.updatedBy;
  const issueCount = numericCount(raw.issueCount);
  const completedCount = numericCount(raw.completedCount);
  const inProgressCount = numericCount(raw.inProgressCount);
  const todoCount = numericCount(raw.todoCount);
  const completedIssuesCount = numericCount(raw.completedIssuesCount);
  const movedToBacklogCount = numericCount(raw.movedToBacklogCount);
  if (issueCount !== undefined) normalized.issueCount = issueCount;
  if (completedCount !== undefined) normalized.completedCount = completedCount;
  if (inProgressCount !== undefined) normalized.inProgressCount = inProgressCount;
  if (todoCount !== undefined) normalized.todoCount = todoCount;
  if (completedIssuesCount !== undefined) normalized.completedIssuesCount = completedIssuesCount;
  if (movedToBacklogCount !== undefined) normalized.movedToBacklogCount = movedToBacklogCount;
  return normalized;
}

function normalizeSprintBurndownPoint(raw: RawSprintBurndownPoint): SprintBurndownPoint | null {
  if (!raw.date) return null;
  return {
    date: String(raw.date),
    ideal: numericCount(raw.ideal) ?? 0,
    actual: raw.actual === null ? null : (numericCount(raw.actual) ?? null),
  };
}

function normalizeSprintBurndownHours(
  raw: RawSprintBurndownHours | null | undefined,
): SprintBurndownHours | null {
  if (!raw) return null;
  return {
    totalEstimateHours: numericCount(raw.totalEstimateHours) ?? 0,
    totalActualHours: numericCount(raw.totalActualHours) ?? 0,
    completedActualHours: numericCount(raw.completedActualHours) ?? 0,
    remainingEstimateHours: numericCount(raw.remainingEstimateHours) ?? 0,
  };
}

function normalizeSprintBurndownAnalytics(
  raw: RawSprintBurndownAnalytics,
): SprintBurndownAnalytics {
  return {
    sprintName: raw.sprintName ?? '',
    startDate: raw.startDate ?? null,
    endDate: raw.endDate ?? null,
    totalPoints: numericCount(raw.totalPoints) ?? 0,
    totalIssues: numericCount(raw.totalIssues) ?? 0,
    completedPoints: numericCount(raw.completedPoints) ?? 0,
    completedIssues: numericCount(raw.completedIssues) ?? 0,
    remainingPoints: numericCount(raw.remainingPoints) ?? 0,
    remainingIssues: numericCount(raw.remainingIssues) ?? 0,
    burndown: Array.isArray(raw.burndown)
      ? raw.burndown
          .map((point) => normalizeSprintBurndownPoint(point as RawSprintBurndownPoint))
          .filter((point): point is SprintBurndownPoint => point !== null)
      : [],
    hours: normalizeSprintBurndownHours(raw.hours),
  };
}

function normalizeInitiative(raw: RawInitiative): Initiative | null {
  if (!raw.id || !raw.workspaceId || !raw.name) return null;
  const normalized: Initiative = {
    id: String(raw.id),
    workspaceId: String(raw.workspaceId),
    name: raw.name,
    slug: raw.slug ?? null,
    description: raw.description ?? null,
    status: raw.status ?? 'planned',
    targetDate: raw.targetDate ?? null,
    color: raw.color ?? null,
    parentInitiativeId: raw.parentInitiativeId ?? null,
    children: Array.isArray(raw.children)
      ? raw.children
          .map((child) => normalizeInitiative(child))
          .filter((child): child is Initiative => child !== null)
      : [],
  };
  if (raw.sortOrder !== undefined) normalized.sortOrder = raw.sortOrder;
  if (raw.createdAt !== undefined) normalized.createdAt = raw.createdAt;
  if (raw.updatedAt !== undefined) normalized.updatedAt = raw.updatedAt;
  return normalized;
}

function normalizeInitiativeProject(
  raw: RawInitiativeProject,
): InitiativeDetail['projects'][number] | null {
  if (!raw.projectId) return null;
  return {
    projectId: String(raw.projectId),
    projectName: raw.projectName ?? null,
    projectKey: raw.projectKey ?? null,
    projectStatus: raw.projectStatus ?? null,
  };
}

function normalizeInitiativeRollup(raw: RawInitiativeRollup): InitiativeRollup {
  const perProject = Array.isArray(raw.perProject)
    ? raw.perProject
        .map((project) => ({
          projectId: String(project.projectId ?? ''),
          projectName: project.projectName ?? null,
          projectKey: project.projectKey ?? null,
          done: numericCount(project.done) ?? 0,
          total: numericCount(project.total) ?? 0,
          percent: numericCount(project.percent) ?? 0,
        }))
        .filter((project) => project.projectId.length > 0)
    : [];

  const normalized: InitiativeRollup = {
    initiativeId: String(raw.initiativeId ?? ''),
    done: numericCount(raw.done) ?? 0,
    total: numericCount(raw.total) ?? 0,
    percent: numericCount(raw.percent) ?? 0,
    projectCount: numericCount(raw.projectCount) ?? perProject.length,
    perProject,
  };
  const subtreeSize = numericCount(raw.subtreeSize);
  if (subtreeSize !== undefined) normalized.subtreeSize = subtreeSize;
  return normalized;
}

function normalizeInitiativeUpdate(raw: RawInitiativeUpdate): InitiativeUpdate | null {
  if (!raw.id || !raw.status || !raw.summary) return null;
  const normalized: InitiativeUpdate = {
    id: String(raw.id),
    status: raw.status,
    summary: raw.summary,
    blockers: raw.blockers ?? null,
    nextSteps: raw.nextSteps ?? null,
  };
  if (raw.initiativeId !== undefined) normalized.initiativeId = raw.initiativeId;
  if (raw.weekOf !== undefined) normalized.weekOf = raw.weekOf;
  if (raw.createdAt !== undefined) normalized.createdAt = raw.createdAt;
  if (raw.authorId !== undefined) normalized.authorId = raw.authorId;
  if (raw.authorName !== undefined) normalized.authorName = raw.authorName;
  if (raw.authorImage !== undefined) normalized.authorImage = raw.authorImage;
  return normalized;
}

function normalizeCommentReaction(raw: unknown): CommentReaction | null {
  if (!raw || typeof raw !== 'object') return null;
  const reaction = raw as Partial<CommentReaction>;
  if (typeof reaction.emoji !== 'string' || typeof reaction.userId !== 'string') return null;
  const normalized: CommentReaction = {
    emoji: reaction.emoji,
    userId: reaction.userId,
  };
  if (typeof reaction.createdAt === 'string') normalized.createdAt = reaction.createdAt;
  return normalized;
}

function normalizeCommentReactions(raw: unknown): CommentReaction[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((reaction) => normalizeCommentReaction(reaction))
    .filter((reaction): reaction is CommentReaction => reaction !== null);
}

function normalizeComment(raw: RawComment): Comment {
  const author = normalizeUser(raw.author ?? raw.createdByUser ?? raw.user);
  const authorId = raw.authorId ?? raw.createdBy ?? author?.id;
  const createdAt = raw.createdAt;
  const updatedAt = raw.updatedAt;
  const edited =
    raw.edited ??
    (createdAt && updatedAt
      ? new Date(updatedAt).getTime() > new Date(createdAt).getTime()
      : false);

  const normalized: Comment = {
    id: String(raw.id),
    issueId: String(raw.issueId),
    content: raw.content ?? '',
    author,
    parentId: raw.parentId ?? null,
    edited,
  };
  if (authorId !== undefined) normalized.authorId = authorId;
  if (raw.createdBy !== undefined) normalized.createdBy = raw.createdBy;
  if (raw.updatedBy !== undefined) normalized.updatedBy = raw.updatedBy;
  if (raw.mentions !== undefined) {
    normalized.mentions = Array.isArray(raw.mentions)
      ? raw.mentions.filter((mention): mention is string => typeof mention === 'string')
      : [];
  }
  if (raw.reactions !== undefined) normalized.reactions = normalizeCommentReactions(raw.reactions);
  if (createdAt !== undefined) normalized.createdAt = createdAt;
  if (updatedAt !== undefined) normalized.updatedAt = updatedAt;
  return normalized;
}

function normalizeProjectMember(raw: RawProjectMember): ProjectMember | null {
  const user = normalizeUser(raw.user);
  const userId = raw.userId ?? user?.id;
  if (!user || !userId) return null;

  const normalized: ProjectMember = {
    id: String(raw.id ?? userId),
    userId,
    user,
  };
  if (raw.role !== undefined) normalized.role = raw.role;
  if (raw.permissions && typeof raw.permissions === 'object' && !Array.isArray(raw.permissions)) {
    normalized.permissions = Object.fromEntries(
      Object.entries(raw.permissions as Record<string, unknown>).map(([key, value]) => [
        key,
        value === true || value === 'true',
      ]),
    );
  }
  return normalized;
}

const PROJECT_ROLE_VALUES: readonly ProjectRole[] = [
  'product_owner',
  'scrum_master',
  'tech_lead',
  'developer',
  'qa_engineer',
  'designer',
  'viewer',
];

function normalizeProjectRoleValue(value: unknown): ProjectRole {
  return PROJECT_ROLE_VALUES.includes(value as ProjectRole) ? (value as ProjectRole) : 'developer';
}

function normalizeProjectInviteLink(raw: RawProjectInviteLink): ProjectInviteLink | null {
  if (!raw.id || !raw.expiresAt) return null;
  const maxUses = Number(raw.maxUses);
  const usedCount = Number(raw.usedCount);
  return {
    id: String(raw.id),
    role: normalizeProjectRoleValue(raw.role),
    maxUses: Number.isFinite(maxUses) ? maxUses : 1,
    usedCount: Number.isFinite(usedCount) ? usedCount : 0,
    expiresAt: String(raw.expiresAt),
    revokedAt: raw.revokedAt ? String(raw.revokedAt) : null,
    createdAt: raw.createdAt ? String(raw.createdAt) : null,
    updatedAt: raw.updatedAt ? String(raw.updatedAt) : null,
    createdBy: raw.createdBy ? String(raw.createdBy) : null,
    creatorName: typeof raw.creatorName === 'string' ? raw.creatorName : null,
    creatorEmail: typeof raw.creatorEmail === 'string' ? raw.creatorEmail : null,
  };
}

function normalizePermissionScheme(raw: RawPermissionScheme): PermissionScheme | null {
  if (!raw.id || !raw.name) return null;
  const permissions =
    raw.permissions && typeof raw.permissions === 'object' && !Array.isArray(raw.permissions)
      ? Object.fromEntries(
          Object.entries(raw.permissions as Record<string, unknown>).map(([role, values]) => [
            role,
            Array.isArray(values)
              ? values.filter((value): value is string => typeof value === 'string')
              : [],
          ]),
        )
      : {};
  return {
    id: String(raw.id),
    name: String(raw.name),
    description: raw.description ?? null,
    isDefault: raw.isDefault === true,
    permissions,
    createdAt: raw.createdAt ? String(raw.createdAt) : null,
    updatedAt: raw.updatedAt ? String(raw.updatedAt) : null,
    projectCount: numericCount(raw.projectCount) ?? 0,
  };
}

function normalizeProjectPermissionSchemeState(
  raw: RawProjectPermissionSchemeState,
): ProjectPermissionSchemeState {
  const scheme = raw.scheme ? normalizePermissionScheme(raw.scheme) : null;
  return {
    projectId: raw.projectId ?? '',
    assignedSchemeId: raw.assignedSchemeId ?? null,
    effectiveSchemeId: raw.effectiveSchemeId ?? null,
    source: raw.source ?? 'none',
    scheme: scheme
      ? {
          id: scheme.id,
          name: scheme.name,
          description: scheme.description,
          isDefault: scheme.isDefault,
        }
      : null,
  };
}

function normalizeSecurityLevelMember(raw: RawSecurityLevelMember): SecurityLevelMember | null {
  if (!raw.memberType) return null;
  return {
    id: raw.id ? String(raw.id) : null,
    memberType: String(raw.memberType),
    memberValue:
      raw.memberValue === null || raw.memberValue === undefined ? null : String(raw.memberValue),
  };
}

function normalizeSecurityLevel(raw: RawSecurityLevel): SecurityLevel | null {
  if (!raw.id || !raw.name) return null;
  return {
    id: String(raw.id),
    schemeId: raw.schemeId ? String(raw.schemeId) : '',
    name: String(raw.name),
    description: raw.description ?? null,
    sortOrder: numericCount(raw.sortOrder) ?? 0,
    isDefault: raw.isDefault === true,
    members: (raw.members ?? [])
      .map((member) => normalizeSecurityLevelMember(member))
      .filter((member): member is SecurityLevelMember => member !== null),
  };
}

function normalizeSecurityScheme(raw: RawSecurityScheme): SecurityScheme | null {
  if (!raw.id || !raw.name) return null;
  return {
    id: String(raw.id),
    name: String(raw.name),
    description: raw.description ?? null,
    isDefault: raw.isDefault === true,
    levels: (raw.levels ?? [])
      .map((level) => normalizeSecurityLevel(level))
      .filter((level): level is SecurityLevel => level !== null),
    createdAt: raw.createdAt ? String(raw.createdAt) : null,
    updatedAt: raw.updatedAt ? String(raw.updatedAt) : null,
    projectCount: numericCount(raw.projectCount) ?? 0,
  };
}

function normalizeProjectSecuritySchemeState(
  raw: RawProjectSecuritySchemeState,
): ProjectSecuritySchemeState {
  const scheme = raw.scheme ? normalizeSecurityScheme(raw.scheme) : null;
  return {
    projectId: raw.projectId ?? '',
    assignedSchemeId: raw.assignedSchemeId ?? null,
    effectiveSchemeId: raw.effectiveSchemeId ?? null,
    source: raw.source ?? 'none',
    scheme: scheme
      ? {
          id: scheme.id,
          name: scheme.name,
          description: scheme.description,
          isDefault: scheme.isDefault,
        }
      : null,
  };
}

function normalizeAutomationTrigger(value: unknown): AutomationRuleTrigger {
  const record = normalizeRecord(value);
  const trigger: AutomationRuleTrigger = {
    type: typeof record.type === 'string' ? record.type : 'issue_created',
  };
  if (typeof record.event === 'string') trigger.event = record.event;
  if (typeof record.field === 'string') trigger.field = record.field;
  return trigger;
}

function normalizeAutomationConditions(value: unknown): Array<Record<string, unknown>> {
  if (!Array.isArray(value)) return [];
  return value
    .filter((item) => item && typeof item === 'object' && !Array.isArray(item))
    .map((item) => normalizeRecord(item));
}

function normalizeAutomationActions(value: unknown): AutomationRuleAction[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => {
      const record = normalizeRecord(item);
      return typeof record.type === 'string'
        ? ({ ...record, type: record.type } as AutomationRuleAction)
        : null;
    })
    .filter((action): action is AutomationRuleAction => action !== null);
}

function normalizeAutomationRule(raw: RawAutomationRule): AutomationRule | null {
  if (!raw.id || !raw.name) return null;
  return {
    id: String(raw.id),
    organizationId: raw.organizationId ? String(raw.organizationId) : '',
    projectId: raw.projectId === null || raw.projectId === undefined ? null : String(raw.projectId),
    name: String(raw.name),
    description: raw.description ?? null,
    enabled: raw.enabled !== false,
    trigger: normalizeAutomationTrigger(raw.trigger),
    conditions: normalizeAutomationConditions(raw.conditions),
    actions: normalizeAutomationActions(raw.actions),
    createdAt: raw.createdAt ? String(raw.createdAt) : null,
    updatedAt: raw.updatedAt ? String(raw.updatedAt) : null,
  };
}

function normalizeAutomationExecution(raw: RawAutomationExecution): AutomationExecution | null {
  if (!raw.id || !raw.ruleId) return null;
  return {
    id: String(raw.id),
    ruleId: String(raw.ruleId),
    triggeredAt: raw.triggeredAt ? String(raw.triggeredAt) : '',
    triggerPayload: raw.triggerPayload ?? null,
    status: raw.status ? String(raw.status) : 'unknown',
    actionResults: raw.actionResults ?? null,
    durationMs: raw.durationMs === null ? null : (numericCount(raw.durationMs) ?? null),
    error: raw.error ?? null,
  };
}

function normalizeIntakeField(value: unknown): IntakeFieldDefinition | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const raw = value as Partial<IntakeFieldDefinition>;
  if (!raw.name || !raw.label || !raw.type) return null;
  const field: IntakeFieldDefinition = {
    name: String(raw.name),
    label: String(raw.label),
    type: String(raw.type),
  };
  if (raw.required !== undefined) field.required = raw.required === true;
  if (Array.isArray(raw.options)) {
    field.options = raw.options
      .map((option) => String(option).trim())
      .filter((option) => option.length > 0);
  }
  if (raw.placeholder !== undefined && raw.placeholder !== null) {
    field.placeholder = String(raw.placeholder);
  }
  if (raw.helpText !== undefined && raw.helpText !== null) {
    field.helpText = String(raw.helpText);
  }
  return field;
}

function normalizeIntakeForm(raw: RawIntakeForm): IntakeForm | null {
  if (!raw.id || !raw.workspaceId || !raw.projectId || !raw.slug || !raw.title) return null;
  const normalized: IntakeForm = {
    id: String(raw.id),
    workspaceId: String(raw.workspaceId),
    projectId: String(raw.projectId),
    slug: String(raw.slug),
    title: String(raw.title),
    description: raw.description ?? null,
    fields: Array.isArray(raw.fields)
      ? raw.fields
          .map((field) => normalizeIntakeField(field))
          .filter((field): field is IntakeFieldDefinition => field !== null)
      : [],
    isPublic: raw.isPublic !== false,
    requiresCaptcha: raw.requiresCaptcha === true,
    targetStatus: raw.targetStatus ?? 'triage',
  };
  if (raw.autoAssignUserId !== undefined) normalized.autoAssignUserId = raw.autoAssignUserId;
  if (raw.customStyling !== undefined) normalized.customStyling = raw.customStyling;
  if (raw.createdAt !== undefined) normalized.createdAt = String(raw.createdAt);
  if (raw.updatedAt !== undefined) normalized.updatedAt = String(raw.updatedAt);
  return normalized;
}

function normalizePublicIntakeForm(raw: RawPublicIntakeForm): PublicIntakeForm | null {
  if (!raw.id || !raw.slug || !raw.title) return null;
  const normalized: PublicIntakeForm = {
    id: String(raw.id),
    slug: String(raw.slug),
    title: String(raw.title),
    description: raw.description ?? null,
    fields: Array.isArray(raw.fields)
      ? raw.fields
          .map((field) => normalizeIntakeField(field))
          .filter((field): field is IntakeFieldDefinition => field !== null)
      : [],
    isPublic: raw.isPublic !== false,
    requiresCaptcha: raw.requiresCaptcha === true,
  };
  if (raw.customStyling !== undefined) normalized.customStyling = raw.customStyling;
  return normalized;
}

function normalizeImportPreviewRecord(raw: RawImportPreviewRecord): ImportPreviewRecord | null {
  if (!raw.key || !raw.title) return null;
  const record: ImportPreviewRecord = {
    key: String(raw.key),
    title: String(raw.title),
    description: raw.description ?? null,
    status: raw.status ?? null,
    priority: raw.priority ?? null,
    labels: Array.isArray(raw.labels)
      ? raw.labels.filter((label): label is string => typeof label === 'string')
      : [],
    assigneeEmail: raw.assigneeEmail ?? null,
  };
  if (raw.parentKey !== undefined) record.parentKey = raw.parentKey;
  if (raw.createdAt !== undefined) record.createdAt = raw.createdAt;
  return record;
}

function normalizeImportPreviewResponse(raw: RawImportPreviewResponse): ImportPreviewResponse {
  const suggestedMapping =
    raw.suggestedMapping &&
    typeof raw.suggestedMapping === 'object' &&
    !Array.isArray(raw.suggestedMapping)
      ? Object.fromEntries(
          Object.entries(raw.suggestedMapping as Record<string, unknown>).filter(
            (entry): entry is [string, string] => typeof entry[1] === 'string',
          ),
        )
      : {};
  return {
    source: raw.source ?? 'csv',
    total: numericCount(raw.total) ?? 0,
    sample: Array.isArray(raw.sample)
      ? raw.sample
          .map((item) => normalizeImportPreviewRecord(item as RawImportPreviewRecord))
          .filter((item): item is ImportPreviewRecord => item !== null)
      : [],
    suggestedMapping,
  };
}

function normalizeImportJobError(raw: RawImportJobError): ImportJobError | null {
  if (!raw.message) return null;
  const error: ImportJobError = { message: String(raw.message) };
  if (raw.key !== undefined) error.key = String(raw.key);
  return error;
}

function normalizeImportRunResponse(raw: RawImportRunResponse): ImportRunResponse {
  return {
    jobId: raw.jobId ?? '',
    status: raw.status ?? 'pending',
  };
}

function normalizeImportJobStatus(raw: RawImportJobStatus): ImportJobStatus {
  return {
    id: raw.id ?? '',
    workspaceId: raw.workspaceId ?? '',
    source: raw.source ?? 'csv',
    status: raw.status ?? 'pending',
    total: numericCount(raw.total) ?? 0,
    processed: numericCount(raw.processed) ?? 0,
    errors: Array.isArray(raw.errors)
      ? raw.errors
          .map((item) => normalizeImportJobError(item as RawImportJobError))
          .filter((item): item is ImportJobError => item !== null)
      : [],
    ...(raw.mapping && typeof raw.mapping === 'object' && !Array.isArray(raw.mapping)
      ? { mapping: raw.mapping as Record<string, unknown> }
      : {}),
    createdAt: raw.createdAt ? String(raw.createdAt) : null,
    finishedAt: raw.finishedAt ? String(raw.finishedAt) : null,
  };
}

function normalizeAttributeMap(value: unknown): Record<string, string> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>).filter(
      (entry): entry is [string, string] => typeof entry[1] === 'string',
    ),
  );
}

function normalizeSsoProvider(value: unknown): SsoProvider {
  return value === 'oidc' ? 'oidc' : 'saml';
}

function normalizeSsoConfig(raw: RawSsoConfig | null | undefined): SsoConfig | null {
  if (!raw?.id || !raw.workspaceId) return null;
  return {
    id: String(raw.id),
    workspaceId: String(raw.workspaceId),
    provider: normalizeSsoProvider(raw.provider),
    entryPointUrl: raw.entryPointUrl ? String(raw.entryPointUrl) : '',
    issuer: raw.issuer ? String(raw.issuer) : '',
    cert: raw.cert ? String(raw.cert) : '',
    audience: raw.audience ? String(raw.audience) : '',
    attributeMap: normalizeAttributeMap(raw.attributeMap),
    enabled: raw.enabled === true,
    hasPrivateKey: raw.hasPrivateKey === true,
    createdAt: raw.createdAt ? String(raw.createdAt) : null,
    updatedAt: raw.updatedAt ? String(raw.updatedAt) : null,
  };
}

function normalizeSsoConfigResponse(raw: RawSsoConfigResponse): SsoConfigResponse {
  return { ssoConfig: normalizeSsoConfig(raw.ssoConfig) };
}

function normalizeScimToken(raw: RawScimToken): ScimToken | null {
  if (!raw.id || !raw.name || !raw.createdAt) return null;
  return {
    id: String(raw.id),
    name: String(raw.name),
    createdAt: String(raw.createdAt),
    lastUsedAt: raw.lastUsedAt ? String(raw.lastUsedAt) : null,
    revokedAt: raw.revokedAt ? String(raw.revokedAt) : null,
  };
}

function normalizeScimTokensResponse(raw: RawScimTokensResponse): ScimTokensResponse {
  return {
    tokens: Array.isArray(raw.tokens)
      ? raw.tokens
          .map((item) => normalizeScimToken(item as RawScimToken))
          .filter((item): item is ScimToken => item !== null)
      : [],
  };
}

function normalizeCreatedScimToken(raw: RawCreatedScimToken): CreatedScimToken {
  return {
    id: raw.id ? String(raw.id) : '',
    name: raw.name ? String(raw.name) : '',
    token: raw.token ? String(raw.token) : '',
    createdAt: raw.createdAt ? String(raw.createdAt) : new Date(0).toISOString(),
  };
}

function normalizeRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function normalizeAuditLogSink(raw: RawAuditLogSink): AuditLogSink | null {
  if (!raw.id || !raw.name || !raw.type || !raw.createdAt) return null;
  return {
    id: String(raw.id),
    type: String(raw.type) as AuditLogSinkType,
    name: String(raw.name),
    config: normalizeRecord(raw.config),
    enabled: raw.enabled === true,
    lastDeliveryAt: raw.lastDeliveryAt ? String(raw.lastDeliveryAt) : null,
    lastError: raw.lastError ? String(raw.lastError) : null,
    successCount: numericCount(raw.successCount) ?? 0,
    failureCount: numericCount(raw.failureCount) ?? 0,
    createdAt: String(raw.createdAt),
    updatedAt: raw.updatedAt ? String(raw.updatedAt) : null,
  };
}

function normalizeCreatedAuditLogSink(raw: RawAuditLogSink): CreatedAuditLogSink {
  const sink = normalizeAuditLogSink(raw) ?? {
    id: raw.id ? String(raw.id) : '',
    type: raw.type ? (String(raw.type) as AuditLogSinkType) : 'webhook',
    name: raw.name ? String(raw.name) : '',
    config: normalizeRecord(raw.config),
    enabled: raw.enabled === true,
    lastDeliveryAt: null,
    lastError: null,
    successCount: 0,
    failureCount: 0,
    createdAt: raw.createdAt ? String(raw.createdAt) : new Date(0).toISOString(),
    updatedAt: raw.updatedAt ? String(raw.updatedAt) : null,
  };
  return { ...sink, signingSecret: raw.signingSecret ? String(raw.signingSecret) : '' };
}

function normalizeAuditLogSinksResponse(raw: RawAuditLogSinksResponse): AuditLogSinksResponse {
  return {
    sinks: Array.isArray(raw.sinks)
      ? raw.sinks
          .map((item) => normalizeAuditLogSink(item as RawAuditLogSink))
          .filter((item): item is AuditLogSink => item !== null)
      : [],
  };
}

function normalizeAuditLogSinkResponse(raw: RawAuditLogSinkResponse): AuditLogSink {
  const sink = normalizeAuditLogSink(raw.sink ?? {});
  if (!sink) throw new Error(i18next.t('auditLogStreaming.invalidSinkResponse'));
  return sink;
}

function normalizeAuditLogSinkTestResponse(
  raw: RawAuditLogSinkTestResponse,
): AuditLogSinkTestResult {
  const result = raw.result ?? {};
  return {
    ok: result.ok === true,
    statusCode:
      typeof result.statusCode === 'number'
        ? result.statusCode
        : (numericCount(result.statusCode as number | string | null | undefined) ?? null),
    error: result.error ? String(result.error) : raw.error ? String(raw.error) : null,
  };
}

function normalizeProjectHealthStatusBucket(
  raw: RawProjectHealthStatusBucket,
): ProjectHealthStatusBucket | null {
  if (!raw.status) return null;
  return {
    status: String(raw.status),
    name: raw.name ?? null,
    color: raw.color ?? null,
    category: raw.category ?? null,
    count: numericCount(raw.count) ?? 0,
  };
}

function normalizeProjectHealthPriorityBucket(
  raw: RawProjectHealthPriorityBucket,
): ProjectHealthPriorityBucket | null {
  if (!raw.priority) return null;
  return {
    priority: String(raw.priority),
    count: numericCount(raw.count) ?? 0,
  };
}

function normalizeProjectHealthTypeBucket(
  raw: RawProjectHealthTypeBucket,
): ProjectHealthTypeBucket | null {
  if (!raw.type) return null;
  return {
    type: String(raw.type),
    count: numericCount(raw.count) ?? 0,
  };
}

function normalizeProjectHealthAnalytics(raw: RawProjectHealthAnalytics): ProjectHealthAnalytics {
  return {
    overview: {
      totalIssues: numericCount(raw.overview?.totalIssues) ?? 0,
      overdueIssues: numericCount(raw.overview?.overdueIssues) ?? 0,
      unassignedIssues: numericCount(raw.overview?.unassignedIssues) ?? 0,
    },
    sprints: {
      total: numericCount(raw.sprints?.total) ?? 0,
      active: numericCount(raw.sprints?.active) ?? 0,
      completed: numericCount(raw.sprints?.completed) ?? 0,
    },
    issuesByStatus: Array.isArray(raw.issuesByStatus)
      ? raw.issuesByStatus
          .map((item) => normalizeProjectHealthStatusBucket(item as RawProjectHealthStatusBucket))
          .filter((item): item is ProjectHealthStatusBucket => item !== null)
      : [],
    issuesByPriority: Array.isArray(raw.issuesByPriority)
      ? raw.issuesByPriority
          .map((item) =>
            normalizeProjectHealthPriorityBucket(item as RawProjectHealthPriorityBucket),
          )
          .filter((item): item is ProjectHealthPriorityBucket => item !== null)
      : [],
    issuesByType: Array.isArray(raw.issuesByType)
      ? raw.issuesByType
          .map((item) => normalizeProjectHealthTypeBucket(item as RawProjectHealthTypeBucket))
          .filter((item): item is ProjectHealthTypeBucket => item !== null)
      : [],
  };
}

function normalizeProjectVelocitySprint(
  raw: RawProjectVelocitySprint,
): ProjectVelocitySprint | null {
  if (!raw.sprintId || !raw.sprintName) return null;
  return {
    sprintId: String(raw.sprintId),
    sprintName: raw.sprintName,
    startDate: raw.startDate ?? null,
    endDate: raw.endDate ?? null,
    completedIssues: numericCount(raw.completedIssues) ?? 0,
    completedPoints: numericCount(raw.completedPoints) ?? 0,
  };
}

function normalizeProjectVelocityAnalytics(
  raw: RawProjectVelocityAnalytics,
): ProjectVelocityAnalytics {
  return {
    sprints: Array.isArray(raw.sprints)
      ? raw.sprints
          .map((item) => normalizeProjectVelocitySprint(item as RawProjectVelocitySprint))
          .filter((item): item is ProjectVelocitySprint => item !== null)
      : [],
    averageVelocity: {
      issues: numericCount(raw.averageVelocity?.issues) ?? 0,
      points: numericCount(raw.averageVelocity?.points) ?? 0,
    },
  };
}

function normalizeProjectThroughputBucket(
  raw: RawProjectThroughputBucket,
): ProjectThroughputBucket | null {
  if (!raw.period) return null;
  return {
    period: String(raw.period),
    count: numericCount(raw.count) ?? 0,
  };
}

function normalizeProjectThroughputAnalytics(
  raw: RawProjectThroughputAnalytics,
): ProjectThroughputAnalytics {
  return {
    projectId: raw.projectId ?? '',
    bucket: raw.bucket ?? 'week',
    days: numericCount(raw.days) ?? 60,
    data: Array.isArray(raw.data)
      ? raw.data
          .map((item) => normalizeProjectThroughputBucket(item as RawProjectThroughputBucket))
          .filter((item): item is ProjectThroughputBucket => item !== null)
      : [],
  };
}

function normalizeProjectCycleTimeAnalytics(
  raw: RawProjectCycleTimeAnalytics,
): ProjectCycleTimeAnalytics {
  return {
    projectId: raw.projectId ?? '',
    days: numericCount(raw.days) ?? 30,
    sampleSize: numericCount(raw.sampleSize) ?? 0,
    values: Array.isArray(raw.values)
      ? raw.values
          .map((value) => numericCount(value as number | string | null))
          .filter((value): value is number => value !== undefined)
      : [],
    p50: numericCount(raw.p50) ?? 0,
    p90: numericCount(raw.p90) ?? 0,
  };
}

function normalizeProjectForecastHistogramBucket(
  raw: RawProjectForecastHistogramBucket,
): ProjectForecastHistogramBucket | null {
  const sprints = numericCount(raw.sprints);
  if (sprints === undefined) return null;
  return {
    sprints,
    count: numericCount(raw.count) ?? 0,
  };
}

function normalizeProjectForecastAnalytics(
  raw: RawProjectForecastAnalytics,
): ProjectForecastAnalytics {
  return {
    projectId: raw.projectId ?? '',
    backlog: numericCount(raw.backlog) ?? 0,
    throughputHistory: Array.isArray(raw.throughputHistory)
      ? raw.throughputHistory
          .map((value) => numericCount(value as number | string | null))
          .filter((value): value is number => value !== undefined)
      : [],
    p50Date: raw.p50Date ?? '',
    p80Date: raw.p80Date ?? '',
    p95Date: raw.p95Date ?? '',
    p50Sprints: numericCount(raw.p50Sprints) ?? 0,
    p80Sprints: numericCount(raw.p80Sprints) ?? 0,
    p95Sprints: numericCount(raw.p95Sprints) ?? 0,
    iterations: numericCount(raw.iterations) ?? 0,
    histogram: Array.isArray(raw.histogram)
      ? raw.histogram
          .map((item) =>
            normalizeProjectForecastHistogramBucket(item as RawProjectForecastHistogramBucket),
          )
          .filter((item): item is ProjectForecastHistogramBucket => item !== null)
      : [],
  };
}

function normalizeDoraAnalytics(raw: RawDoraAnalytics): DoraAnalytics {
  return {
    connected: raw.connected === true,
    deployFrequencyPerDay: numericCount(raw.deployFrequencyPerDay) ?? 0,
    deployFrequencyDelta:
      raw.deployFrequencyDelta === null ? null : (numericCount(raw.deployFrequencyDelta) ?? null),
    deployFrequencySpark: numericArray(raw.deployFrequencySpark),
    leadTimeHours: numericCount(raw.leadTimeHours) ?? 0,
    leadTimeDelta: raw.leadTimeDelta === null ? null : (numericCount(raw.leadTimeDelta) ?? null),
    leadTimeSpark: numericArray(raw.leadTimeSpark),
    changeFailureRate: numericCount(raw.changeFailureRate) ?? 0,
    changeFailureRateDelta:
      raw.changeFailureRateDelta === null
        ? null
        : (numericCount(raw.changeFailureRateDelta) ?? null),
    changeFailureRateSpark: numericArray(raw.changeFailureRateSpark),
    reworkRate: numericCount(raw.reworkRate) ?? 0,
    reworkRateDelta:
      raw.reworkRateDelta === null ? null : (numericCount(raw.reworkRateDelta) ?? null),
    reworkRateSpark: numericArray(raw.reworkRateSpark),
    recoveryHours: numericCount(raw.recoveryHours) ?? 0,
    recoveryHoursDelta:
      raw.recoveryHoursDelta === null ? null : (numericCount(raw.recoveryHoursDelta) ?? null),
    recoveryHoursSpark: numericArray(raw.recoveryHoursSpark),
  };
}

function normalizeOrganizationMember(raw: RawOrganizationMember): OrganizationMember | null {
  let user = normalizeUser(raw.user);
  if (!user && raw.id && raw.email) {
    user = {
      id: raw.id,
      name: raw.name ?? null,
      email: raw.email,
      image: raw.image ?? null,
    };
  }
  if (!user) return null;
  const normalized: OrganizationMember = {
    id: user.id,
    name: user.name,
    email: user.email,
    image: user.image ?? null,
    role: raw.role ?? 'member',
    memberStatus: raw.memberStatus ?? raw.status ?? null,
  };
  if (raw.status !== undefined) normalized.status = raw.status;
  if (raw.joinedAt !== undefined) normalized.joinedAt = raw.joinedAt;
  if (raw.isAgent !== undefined) normalized.isAgent = raw.isAgent;
  if (raw.agentProvider !== undefined) normalized.agentProvider = raw.agentProvider;
  return normalized;
}

function normalizeOrganization(raw: RawOrganization): Organization | null {
  if (!raw.id || !raw.name || !raw.slug) return null;
  const normalized: Organization = {
    id: raw.id,
    name: raw.name,
    slug: raw.slug,
    plan: raw.plan ?? 'free',
    status: raw.status ?? 'active',
  };
  if (raw.domain !== undefined) normalized.domain = raw.domain;
  if (raw.logoUrl !== undefined) normalized.logoUrl = raw.logoUrl;
  if (raw.settings !== undefined) normalized.settings = raw.settings;
  if (raw.role !== undefined) normalized.role = raw.role;
  if (raw.userRole !== undefined) normalized.userRole = raw.userRole;
  if (raw.isSuperAdmin !== undefined) normalized.isSuperAdmin = raw.isSuperAdmin;
  if (raw.createdAt !== undefined) normalized.createdAt = raw.createdAt;
  if (raw.updatedAt !== undefined) normalized.updatedAt = raw.updatedAt;
  if (raw.stats) {
    normalized.stats = {
      members: Number(raw.stats.members ?? 0),
      projects: Number(raw.stats.projects ?? 0),
      teams: Number(raw.stats.teams ?? 0),
      apiKeys: Number(raw.stats.apiKeys ?? 0),
    };
  }
  return normalized;
}

function normalizeTeamspace(raw: RawTeamspace): Teamspace | null {
  if (!raw.id || !raw.organizationId || !raw.name || !raw.slug) return null;
  const normalized: Teamspace = {
    id: raw.id,
    organizationId: raw.organizationId,
    name: raw.name,
    slug: raw.slug,
  };
  if (raw.description !== undefined) normalized.description = raw.description;
  if (raw.avatarUrl !== undefined) normalized.avatarUrl = raw.avatarUrl;
  if (raw.leadId !== undefined) normalized.leadId = raw.leadId;
  if (raw.settings !== undefined) normalized.settings = raw.settings;
  if (raw.isMember !== undefined) normalized.isMember = raw.isMember;
  if (raw.currentUserRole !== undefined) normalized.currentUserRole = raw.currentUserRole;
  if (raw.memberCount !== undefined && raw.memberCount !== null) {
    normalized.memberCount = Number(raw.memberCount);
  }
  if (raw.projectCount !== undefined && raw.projectCount !== null) {
    normalized.projectCount = Number(raw.projectCount);
  }
  if (raw.lead) {
    normalized.lead = {
      id: raw.lead.id ?? '',
      name: raw.lead.name ?? null,
      email: raw.lead.email ?? null,
      image: raw.lead.image ?? null,
    };
  } else if (raw.lead === null) {
    normalized.lead = null;
  }
  if (raw.createdAt !== undefined) normalized.createdAt = raw.createdAt;
  if (raw.updatedAt !== undefined) normalized.updatedAt = raw.updatedAt;
  return normalized;
}

function normalizeTeamspaceMember(raw: RawTeamspaceMember): TeamspaceMember | null {
  if (!raw.id || !raw.email) return null;
  const normalized: TeamspaceMember = {
    id: raw.id,
    teamRole: raw.teamRole ?? 'member',
    name: raw.name ?? null,
    email: raw.email,
    image: raw.image ?? null,
    status: raw.status ?? null,
  };
  if (raw.joinedAt !== undefined) normalized.joinedAt = raw.joinedAt;
  return normalized;
}

function normalizeLabel(raw: RawLabel): Label | null {
  if (!raw.id || !raw.organizationId || !raw.name) return null;
  const normalized: Label = {
    id: raw.id,
    organizationId: raw.organizationId,
    name: raw.name,
  };
  if (raw.projectId !== undefined) normalized.projectId = raw.projectId;
  if (raw.color !== undefined) normalized.color = raw.color;
  if (raw.description !== undefined) normalized.description = raw.description;
  if (raw.createdAt !== undefined) normalized.createdAt = raw.createdAt;
  if (raw.updatedAt !== undefined) normalized.updatedAt = raw.updatedAt;
  if (raw.createdBy !== undefined) normalized.createdBy = raw.createdBy;
  if (raw.usageCount !== undefined && raw.usageCount !== null) {
    normalized.usageCount = Number(raw.usageCount);
  }
  return normalized;
}

function normalizeProjectComponent(raw: RawProjectComponent): ProjectComponent | null {
  if (!raw.id || !raw.organizationId || !raw.projectId || !raw.name) return null;
  const normalized: ProjectComponent = {
    id: raw.id,
    organizationId: raw.organizationId,
    projectId: raw.projectId,
    name: raw.name,
    description: raw.description ?? null,
    leadId: raw.leadId ?? null,
    defaultAssigneeType: raw.defaultAssigneeType ?? 'project_default',
    archived: raw.archived ?? false,
  };
  const issueCount = numericCount(raw.issueCount);
  if (issueCount !== undefined) normalized.issueCount = issueCount;
  if (raw.createdAt !== undefined) normalized.createdAt = raw.createdAt;
  if (raw.updatedAt !== undefined) normalized.updatedAt = raw.updatedAt;
  return normalized;
}

function normalizeProjectModule(raw: RawProjectModule): ProjectModule | null {
  if (!raw.id || !raw.projectId || !raw.name) return null;
  return {
    id: raw.id,
    projectId: raw.projectId,
    name: raw.name,
    description: raw.description ?? null,
    status: raw.status ?? 'backlog',
    ownerId: raw.ownerId ?? null,
    memberIds: Array.isArray(raw.memberIds)
      ? raw.memberIds.filter((memberId): memberId is string => typeof memberId === 'string')
      : [],
    targetDate: raw.targetDate ?? null,
    ...(raw.createdAt !== undefined ? { createdAt: raw.createdAt } : {}),
    ...(raw.updatedAt !== undefined ? { updatedAt: raw.updatedAt } : {}),
  };
}

function objectRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function isProjectViewType(value: unknown): value is ProjectViewType {
  return value === 'list' || value === 'board' || value === 'timeline' || value === 'calendar';
}

function isProjectViewScope(value: unknown): value is ProjectViewScope {
  return value === 'personal' || value === 'project' || value === 'teamspace';
}

function normalizeProjectView(raw: RawProjectView): ProjectView | null {
  if (!raw.id || !raw.userId || !raw.name) return null;
  const viewType = isProjectViewType(raw.viewType) ? raw.viewType : 'list';
  const scope = isProjectViewScope(raw.scope) ? raw.scope : 'project';
  return {
    id: raw.id,
    userId: raw.userId,
    name: raw.name,
    description: raw.description ?? null,
    query: raw.query ?? '',
    criteria: objectRecord(raw.criteria),
    isPublic: raw.isPublic ?? false,
    isStarred: raw.isStarred ?? false,
    viewType,
    lastUsedAt: raw.lastUsedAt ?? null,
    updatedAt: raw.updatedAt ?? '',
    scope,
    teamspaceId: raw.teamspaceId ?? null,
    isDefault: raw.isDefault ?? false,
    isOwned: raw.isOwned ?? false,
  };
}

function normalizeProjectViewsResponse(raw: RawProjectViewsResponse): ProjectViewsResponse {
  const project = raw.project ?? {};
  return {
    viewerId: raw.viewerId ?? '',
    project: {
      id: project.id ?? '',
      key: project.key ?? '',
      name: project.name ?? '',
      teamId: project.teamId ?? null,
    },
    views: Array.isArray(raw.views)
      ? raw.views
          .map((view) => normalizeProjectView(view as RawProjectView))
          .filter((view): view is ProjectView => view !== null)
      : [],
  };
}

function isSortOrder(value: unknown): value is 'asc' | 'desc' {
  return value === 'asc' || value === 'desc';
}

function normalizeSavedIssueFilter(raw: RawSavedIssueFilter): SavedIssueFilter | null {
  if (!raw.id || !raw.organizationId || !raw.name) return null;
  const viewType = isProjectViewType(raw.viewType) ? raw.viewType : 'list';
  return {
    id: String(raw.id),
    userId: raw.userId ? String(raw.userId) : '',
    organizationId: String(raw.organizationId),
    projectId: raw.projectId ?? null,
    name: String(raw.name),
    description: raw.description ?? null,
    query: raw.query ?? '',
    criteria: objectRecord(raw.criteria),
    isPublic: raw.isPublic ?? false,
    isStarred: raw.isStarred ?? false,
    viewType,
    sortBy: raw.sortBy ?? 'created_at',
    sortOrder: isSortOrder(raw.sortOrder) ? raw.sortOrder : 'desc',
    usageCount: numericCount(raw.usageCount) ?? 0,
    lastUsedAt: raw.lastUsedAt ?? null,
    createdAt: raw.createdAt ?? '',
    updatedAt: raw.updatedAt ?? '',
  };
}

function normalizeProjectChatSettings(
  raw: RawProjectChatSettings | null | undefined,
): ProjectChatSettings {
  return {
    enabled: raw?.enabled ?? true,
    voiceEnabled: raw?.voiceEnabled ?? false,
    issueThreadsEnabled: raw?.issueThreadsEnabled ?? true,
    documentThreadsEnabled: raw?.documentThreadsEnabled ?? true,
    attachmentsEnabled: raw?.attachmentsEnabled ?? false,
    unreadTrackingEnabled: raw?.unreadTrackingEnabled ?? true,
  };
}

function normalizeProjectCommunicationsBaseSettings(
  raw: RawProjectChatSettings | null | undefined,
): ProjectChatSettings {
  return {
    enabled: raw?.enabled ?? true,
    voiceEnabled: raw?.voiceEnabled ?? true,
    issueThreadsEnabled: raw?.issueThreadsEnabled ?? true,
    documentThreadsEnabled: raw?.documentThreadsEnabled ?? true,
    attachmentsEnabled: raw?.attachmentsEnabled ?? true,
    unreadTrackingEnabled: raw?.unreadTrackingEnabled ?? true,
  };
}

function normalizeProjectCommunicationsSettings(
  raw: RawProjectCommunicationsSettings | null | undefined,
): ProjectCommunicationsSettings {
  return {
    ...normalizeProjectCommunicationsBaseSettings(raw),
    inheritWorkspaceDefaults: raw?.inheritWorkspaceDefaults ?? true,
  };
}

function normalizeProjectCommunicationsResponse(
  raw: RawProjectCommunicationsSettingsResponse,
): ProjectCommunicationsSettingsResponse {
  const project = raw.project ?? {};
  const access = raw.access ?? {};
  return {
    project: {
      id: project.id ?? '',
      key: project.key ?? '',
      name: project.name ?? '',
    },
    access: {
      canView: access.canView === true,
      canManage: access.canManage === true,
    },
    workspaceSettings: normalizeProjectCommunicationsBaseSettings(raw.workspaceSettings),
    projectSettings: normalizeProjectCommunicationsSettings(raw.projectSettings),
    effectiveSettings: normalizeProjectCommunicationsBaseSettings(raw.effectiveSettings),
  };
}

function normalizeProjectChatPermissions(
  raw: RawProjectChatPermissions | null | undefined,
): ProjectChatPermissions {
  return {
    canBrowseProject: raw?.canBrowseProject ?? true,
    canAdministerProject: raw?.canAdministerProject ?? false,
    canBrowseChat: raw?.canBrowseChat ?? true,
    canCreateChannels: raw?.canCreateChannels ?? false,
    canPostMessages: raw?.canPostMessages ?? false,
    canModerateMessages: raw?.canModerateMessages ?? false,
    canStartCalls: raw?.canStartCalls ?? false,
    canManageCalls: raw?.canManageCalls ?? false,
  };
}

function normalizeProjectChatActiveCall(
  raw: RawProjectChatActiveCall | null | undefined,
): ProjectChatActiveCall | null {
  if (!raw?.id) return null;
  const call: ProjectChatActiveCall = {
    id: raw.id,
    participantCount: numericCount(raw.participantCount) ?? 0,
  };
  if (raw.roomId !== undefined) call.roomId = raw.roomId;
  if (raw.livekitRoomName !== undefined) call.livekitRoomName = raw.livekitRoomName;
  return call;
}

function normalizeConversationCallToken(raw: RawConversationCallToken): ConversationCallToken {
  return {
    participantIdentity: raw.participantIdentity ?? '',
    roomName: raw.roomName ?? '',
    token: raw.token ?? '',
    url: raw.url ?? '',
    call: normalizeProjectChatActiveCall(raw.call),
  };
}

function normalizeGlobalLiveCall(raw: RawGlobalLiveCall): GlobalLiveCall | null {
  if (!raw.id || !raw.roomId) return null;
  const project = raw.project ?? {};
  const room = raw.room ?? {};
  return {
    id: raw.id,
    roomId: raw.roomId,
    livekitRoomName: raw.livekitRoomName ?? '',
    participantCount: numericCount(raw.participantCount) ?? 0,
    startedAt: raw.startedAt ?? '',
    joinedParticipantId: raw.joinedParticipantId ?? null,
    isParticipant: raw.isParticipant ?? false,
    project: {
      id: project.id ?? '',
      key: project.key ?? '',
      name: project.name ?? '',
      path: project.path ?? '',
    },
    room: {
      id: room.id ?? raw.roomId,
      kind: room.kind ?? 'channel',
      title: room.title ?? '',
      subtitle: room.subtitle ?? '',
      href: room.href ?? '',
    },
  };
}

function normalizeProjectChatLastMessage(
  raw: RawProjectChatLastMessage | null | undefined,
): ProjectChatChannel['lastMessage'] {
  if (!raw?.id || !raw.createdAt) return null;
  return {
    id: raw.id,
    body: raw.body ?? '',
    createdAt: String(raw.createdAt),
  };
}

function normalizeProjectChatChannel(
  raw: RawProjectChatChannel,
  roomIdOverride?: string | null,
): ProjectChatChannel | null {
  if (!raw.id || !raw.name) return null;
  const channel: ProjectChatChannel = {
    id: raw.id,
    name: raw.name,
    slug: raw.slug ?? raw.name.toLowerCase().replace(/\s+/g, '-'),
    description: raw.description ?? null,
    roomId: roomIdOverride ?? raw.roomId ?? null,
    unreadCount: numericCount(raw.unreadCount) ?? 0,
    participantCount: numericCount(raw.participantCount) ?? 0,
    lastMessage: normalizeProjectChatLastMessage(raw.lastMessage),
    activeCall: normalizeProjectChatActiveCall(raw.activeCall),
  };
  if (raw.isDefault !== undefined) channel.isDefault = raw.isDefault;
  if (raw.isArchived !== undefined) channel.isArchived = raw.isArchived;
  const position = numericCount(raw.position);
  if (position !== undefined) channel.position = position;
  return channel;
}

function normalizeProjectChannelMutationResponse(
  raw: RawProjectChannelMutationResponse,
): ProjectChatChannel | null {
  return normalizeProjectChatChannel(raw.channel ?? {}, raw.room?.id ?? null);
}

function normalizeProjectChatDiscussion(
  raw: RawProjectChatDiscussion,
): ProjectChatDiscussion | null {
  if (!raw.id) return null;
  const context =
    raw.context && typeof raw.context === 'object' && !Array.isArray(raw.context)
      ? objectRecord(raw.context)
      : null;
  return {
    id: raw.id,
    kind: raw.kind ?? 'channel',
    title: raw.title ?? null,
    unreadCount: numericCount(raw.unreadCount) ?? 0,
    participantCount: numericCount(raw.participantCount) ?? 0,
    latestMessage: normalizeProjectChatLastMessage(raw.latestMessage),
    activeCall: normalizeProjectChatActiveCall(raw.activeCall),
    context,
  };
}

function normalizeProjectChatBootstrap(raw: RawProjectChatBootstrap): ProjectChatBootstrap {
  const project = raw.project ?? {};
  return {
    project: {
      id: project.id ?? '',
      key: project.key ?? '',
      name: project.name ?? '',
    },
    effectiveSettings: normalizeProjectChatSettings(raw.effectiveSettings),
    workspaceSettings: objectRecord(raw.workspaceSettings),
    projectSettings: objectRecord(raw.projectSettings),
    permissions: normalizeProjectChatPermissions(raw.permissions),
    channels: Array.isArray(raw.channels)
      ? raw.channels
          .map((channel) => normalizeProjectChatChannel(channel as RawProjectChatChannel))
          .filter((channel): channel is ProjectChatChannel => channel !== null)
      : [],
    recentDiscussions: Array.isArray(raw.recentDiscussions)
      ? raw.recentDiscussions
          .map((discussion) =>
            normalizeProjectChatDiscussion(discussion as RawProjectChatDiscussion),
          )
          .filter((discussion): discussion is ProjectChatDiscussion => discussion !== null)
      : [],
    activeCalls: Array.isArray(raw.activeCalls)
      ? raw.activeCalls
          .map((call) => normalizeProjectChatActiveCall(call as RawProjectChatActiveCall))
          .filter((call): call is ProjectChatActiveCall => call !== null)
      : [],
    lastActiveRoomId: raw.lastActiveRoomId ?? null,
  };
}

function normalizeConversationAttachment(
  raw: RawConversationAttachment,
): ConversationAttachment | null {
  if (!raw.id || !raw.fileName) return null;
  return {
    id: raw.id,
    fileName: raw.fileName,
    fileSize: numericCount(raw.fileSize) ?? 0,
    mimeType: raw.mimeType ?? 'application/octet-stream',
    filePath: raw.filePath ?? '',
    uploadedById: raw.uploadedById ?? '',
    uploadedAt: raw.uploadedAt ?? '',
  };
}

function normalizeConversationAuthor(
  raw: RawConversationAuthor | null | undefined,
): ConversationAuthor {
  return {
    id: raw?.id ?? '',
    name: raw?.name ?? null,
    email: raw?.email ?? null,
    image: raw?.image ?? null,
  };
}

function normalizeConversationReaction(raw: RawConversationReaction): ConversationReaction | null {
  if (!raw.emoji) return null;
  return {
    emoji: raw.emoji,
    count: numericCount(raw.count) ?? 0,
    reactedUserIds: Array.isArray(raw.reactedUserIds)
      ? raw.reactedUserIds.filter((userId): userId is string => typeof userId === 'string')
      : [],
    reactedByCurrentUser: raw.reactedByCurrentUser ?? false,
  };
}

function normalizeConversationModerationSnapshot(
  raw: RawConversationModerationSnapshot | null | undefined,
): ConversationModerationSnapshot | null {
  if (!raw?.deletedAt) return null;
  return {
    deletedBody: raw.deletedBody ?? '',
    deletedByName: raw.deletedByName ?? null,
    deletedById: raw.deletedById ?? null,
    deletedAt: raw.deletedAt,
    deletedAttachments: Array.isArray(raw.deletedAttachments)
      ? raw.deletedAttachments
          .map((attachment) =>
            normalizeConversationAttachment(attachment as RawConversationAttachment),
          )
          .filter((attachment): attachment is ConversationAttachment => attachment !== null)
      : [],
  };
}

function normalizeConversationMessage(raw: RawConversationMessage): ConversationMessage | null {
  if (!raw.id || !raw.roomId) return null;
  return {
    id: raw.id,
    roomId: raw.roomId,
    body: raw.body ?? '',
    attachments: Array.isArray(raw.attachments)
      ? raw.attachments
          .map((attachment) =>
            normalizeConversationAttachment(attachment as RawConversationAttachment),
          )
          .filter((attachment): attachment is ConversationAttachment => attachment !== null)
      : [],
    mentions: Array.isArray(raw.mentions)
      ? raw.mentions.filter((mention): mention is string => typeof mention === 'string')
      : [],
    deletedAt: raw.deletedAt ?? null,
    editedAt: raw.editedAt ?? null,
    createdAt: raw.createdAt ?? '',
    author: normalizeConversationAuthor(raw.author),
    canDelete: raw.canDelete ?? false,
    canEdit: raw.canEdit ?? false,
    moderation: normalizeConversationModerationSnapshot(raw.moderation),
    reactions: Array.isArray(raw.reactions)
      ? raw.reactions
          .map((reaction) => normalizeConversationReaction(reaction as RawConversationReaction))
          .filter((reaction): reaction is ConversationReaction => reaction !== null)
      : [],
  };
}

function normalizeConversationMessagesPage(
  raw: RawConversationMessagesPage,
): ConversationMessagesPage {
  return {
    messages: Array.isArray(raw.messages)
      ? raw.messages
          .map((message) => normalizeConversationMessage(message as RawConversationMessage))
          .filter((message): message is ConversationMessage => message !== null)
      : [],
    pageInfo: {
      hasMore: raw.pageInfo?.hasMore ?? false,
      nextCursor: raw.pageInfo?.nextCursor ?? null,
    },
  };
}

function normalizeWorkflowStatus(raw: RawWorkflowStatus): WorkflowStatus | null {
  if (!raw.id || !raw.name) return null;
  const normalized: WorkflowStatus = {
    id: raw.id,
    name: raw.name,
    category: raw.category ?? 'todo',
    color: raw.color ?? null,
  };
  const position = numericCount(raw.position);
  if (raw.workflowId !== undefined) normalized.workflowId = raw.workflowId;
  if (position !== undefined) normalized.position = position;
  if (raw.createdAt !== undefined) normalized.createdAt = raw.createdAt;
  if (raw.updatedAt !== undefined) normalized.updatedAt = raw.updatedAt;
  return normalized;
}

function normalizeWorkflowTransition(raw: RawWorkflowTransition): WorkflowTransition | null {
  if (!raw.id || !raw.fromStatusId || !raw.toStatusId) return null;
  const transition: WorkflowTransition = {
    id: String(raw.id),
    fromStatusId: String(raw.fromStatusId),
    toStatusId: String(raw.toStatusId),
    name: raw.name ?? null,
  };
  if (raw.workflowId !== undefined) transition.workflowId = String(raw.workflowId);
  if (raw.conditions !== undefined) transition.conditions = raw.conditions;
  if (raw.validators !== undefined) transition.validators = raw.validators;
  if (raw.postActions !== undefined) transition.postActions = raw.postActions;
  if (raw.createdAt !== undefined) transition.createdAt = raw.createdAt;
  if (raw.updatedAt !== undefined) transition.updatedAt = raw.updatedAt;
  return transition;
}

function normalizeProjectVersion(raw: RawProjectVersion): ProjectVersion | null {
  if (!raw.id || !raw.organizationId || !raw.projectId || !raw.name) return null;
  const normalized: ProjectVersion = {
    id: raw.id,
    organizationId: raw.organizationId,
    projectId: raw.projectId,
    name: raw.name,
    description: raw.description ?? null,
    status: raw.status ?? 'unreleased',
    startDate: raw.startDate ?? null,
    releaseDate: raw.releaseDate ?? null,
    releasedAt: raw.releasedAt ?? null,
  };
  const sortOrder = numericCount(raw.sortOrder);
  const issueCount = numericCount(raw.issueCount);
  const doneIssueCount = numericCount(raw.doneIssueCount);
  if (sortOrder !== undefined) normalized.sortOrder = sortOrder;
  if (issueCount !== undefined) normalized.issueCount = issueCount;
  if (doneIssueCount !== undefined) normalized.doneIssueCount = doneIssueCount;
  if (raw.createdBy !== undefined) normalized.createdBy = raw.createdBy;
  if (raw.createdAt !== undefined) normalized.createdAt = raw.createdAt;
  if (raw.updatedAt !== undefined) normalized.updatedAt = raw.updatedAt;
  return normalized;
}

function normalizeCustomField(raw: RawCustomField): CustomField | null {
  if (!raw.id || !raw.name || !raw.type) return null;
  const normalized: CustomField = {
    id: raw.id,
    name: raw.name,
    type: raw.type,
    isRequired: raw.isRequired ?? false,
  };
  const position = numericCount(raw.position);
  if (raw.organizationId !== undefined) normalized.organizationId = raw.organizationId;
  if (raw.projectId !== undefined) normalized.projectId = raw.projectId;
  if (raw.description !== undefined) normalized.description = raw.description;
  if (raw.defaultValue !== undefined) normalized.defaultValue = raw.defaultValue;
  if (raw.options !== undefined) normalized.options = raw.options;
  if (position !== undefined) normalized.position = position;
  if (raw.isActive !== undefined) normalized.isActive = raw.isActive;
  if (raw.createdAt !== undefined) normalized.createdAt = raw.createdAt;
  if (raw.updatedAt !== undefined) normalized.updatedAt = raw.updatedAt;
  return normalized;
}

function normalizeIssueCustomFieldValue(
  raw: RawIssueCustomFieldValue,
): IssueCustomFieldValue | null {
  if (!raw.id || !raw.customFieldId || !raw.field) return null;
  const field = normalizeCustomField(raw.field);
  if (!field) return null;
  const normalized: IssueCustomFieldValue = {
    id: raw.id,
    customFieldId: raw.customFieldId,
    value: raw.value ?? null,
    field,
  };
  if (raw.createdAt !== undefined) normalized.createdAt = raw.createdAt;
  if (raw.updatedAt !== undefined) normalized.updatedAt = raw.updatedAt;
  return normalized;
}

function normalizeSearchResult(raw: RawSearchResult): SearchResult | null {
  const issueId = raw.issueId ?? raw.issue_id ?? raw.id;
  if (!raw.id || !issueId) return null;
  return {
    id: String(raw.id),
    entityType: raw.entityType ?? raw.entity_type ?? 'issue',
    issueId: String(issueId),
    key: raw.key ?? null,
    title: raw.title ?? raw.key ?? String(issueId),
    snippet: raw.snippet ?? null,
    projectId: raw.projectId ?? raw.project_id ?? null,
    score: raw.score ?? null,
  };
}

function normalizeSearchHistoryEntry(raw: RawSearchHistoryEntry): SearchHistoryEntry | null {
  if (!raw.id || !raw.organizationId || !raw.query) return null;
  return {
    id: String(raw.id),
    organizationId: String(raw.organizationId),
    projectId: raw.projectId ?? null,
    query: String(raw.query),
    criteria: recordPayload(raw.criteria),
    resultCount: numericCount(raw.resultCount) ?? 0,
    pinned: raw.pinned === true,
    ...(raw.createdAt !== undefined ? { createdAt: raw.createdAt } : {}),
  };
}

function normalizeDocumentSpace(raw: RawDocumentSpace): DocumentSpace | null {
  if (!raw.id || !raw.organizationId || !raw.name) return null;
  const normalized: DocumentSpace = {
    id: raw.id,
    organizationId: raw.organizationId,
    projectId: raw.projectId ?? null,
    scope: raw.scope ?? 'organization',
    name: raw.name,
    description: raw.description ?? null,
    isDefault: raw.isDefault ?? false,
  };
  if (raw.slug !== undefined) normalized.slug = raw.slug;
  if (raw.permissions !== undefined) normalized.permissions = raw.permissions;
  return normalized;
}

function normalizeDocumentPageSummary(raw: RawDocumentPageSummary): DocumentPageSummary | null {
  if (!raw.id || !raw.spaceId || !raw.title) return null;
  const normalized: DocumentPageSummary = {
    id: raw.id,
    spaceId: raw.spaceId,
    title: raw.title,
    projectId: raw.projectId ?? null,
    parentId: raw.parentId ?? null,
    icon: raw.icon ?? null,
    excerpt: raw.excerpt ?? null,
    isArchived: raw.isArchived ?? false,
    spaceName: raw.spaceName ?? null,
  };
  if (raw.slug !== undefined) normalized.slug = raw.slug;
  if (raw.organizationId !== undefined) normalized.organizationId = raw.organizationId;
  if (raw.currentRevision !== undefined) normalized.currentRevision = raw.currentRevision;
  if (raw.position !== undefined) normalized.position = raw.position;
  if (raw.createdAt !== undefined) normalized.createdAt = raw.createdAt;
  if (raw.updatedAt !== undefined) normalized.updatedAt = raw.updatedAt;
  if (raw.createdBy !== undefined) normalized.createdBy = raw.createdBy;
  if (raw.updatedBy !== undefined) normalized.updatedBy = raw.updatedBy;
  return normalized;
}

function normalizeIssueDocument(raw: RawIssueDocument): IssueDocument | null {
  const summary = normalizeDocumentPageSummary(raw);
  if (!summary) return null;
  const normalized: IssueDocument = { ...summary };
  if (raw.linkId !== undefined) normalized.linkId = raw.linkId;
  return normalized;
}

function normalizeDocumentPage(raw: RawDocumentPage): DocumentPage | null {
  const summary = normalizeDocumentPageSummary(raw);
  if (!summary) return null;
  const normalized: DocumentPage = {
    ...summary,
    contentText: raw.contentText ?? '',
    backlinks: raw.backlinks ?? [],
    relatedIssues: raw.relatedIssues ?? [],
  };
  if (raw.contentJson !== undefined) normalized.contentJson = raw.contentJson;
  if (raw.permissions !== undefined) normalized.permissions = raw.permissions;
  if (raw.revisionCount !== undefined) normalized.revisionCount = raw.revisionCount;
  if (raw.share !== undefined) normalized.share = raw.share;
  if (raw.space) {
    const space = normalizeDocumentSpace(raw.space);
    if (space) normalized.space = space;
  }
  return normalized;
}

function normalizeDocumentTreeNode(raw: RawDocumentTreeNode): DocumentTreeNode | null {
  const summary = normalizeDocumentPageSummary(raw);
  if (!summary) return null;

  return {
    ...summary,
    children: Array.isArray(raw.children)
      ? raw.children
          .map((child) => normalizeDocumentTreeNode(child as RawDocumentTreeNode))
          .filter((child): child is DocumentTreeNode => child !== null)
      : [],
  };
}

function normalizeDocumentRevisionAuthor(
  raw: RawDocumentRevisionAuthor | null | undefined,
): DocumentRevisionAuthor | null {
  if (!raw?.id) return null;
  const normalized: DocumentRevisionAuthor = { id: String(raw.id) };
  if (raw.name !== undefined) normalized.name = raw.name ?? null;
  if (raw.email !== undefined) normalized.email = raw.email ?? null;
  if (raw.image !== undefined) normalized.image = raw.image ?? null;
  return normalized;
}

function normalizeDocumentRevision(raw: RawDocumentRevision): DocumentRevision | null {
  if (!raw.id || !raw.pageId || !raw.title) return null;
  const revision = numericCount(raw.revision);
  if (!revision || revision <= 0) return null;

  const normalized: DocumentRevision = {
    id: String(raw.id),
    pageId: String(raw.pageId),
    revision,
    title: String(raw.title),
    excerpt: raw.excerpt ?? null,
    changeSummary: raw.changeSummary ?? null,
  };
  if (raw.contentText !== undefined) normalized.contentText = raw.contentText ?? '';
  if (raw.createdAt !== undefined) normalized.createdAt = String(raw.createdAt);
  if (raw.createdBy !== undefined) normalized.createdBy = raw.createdBy ?? null;
  if (raw.author !== undefined) normalized.author = normalizeDocumentRevisionAuthor(raw.author);
  return normalized;
}

function normalizePublicDocumentAttachment(
  raw: RawPublicDocumentAttachment | null | undefined,
): PublicDocumentAttachment | null {
  if (!raw?.id || !raw.fileName || !raw.publicUrl) return null;
  return {
    id: String(raw.id),
    fileName: String(raw.fileName),
    fileSize: numericCount(raw.fileSize) ?? 0,
    mimeType: raw.mimeType ? String(raw.mimeType) : 'application/octet-stream',
    publicUrl: String(raw.publicUrl),
  };
}

function normalizePublicDocumentPage(raw: RawPublicDocumentPage): PublicDocumentPage | null {
  if (!raw.id || !raw.title || !raw.slug || !raw.updatedAt) return null;
  const normalized: PublicDocumentPage = {
    id: String(raw.id),
    title: String(raw.title),
    slug: String(raw.slug),
    excerpt: raw.excerpt ?? null,
    updatedAt: String(raw.updatedAt),
    publishedAt: raw.publishedAt ?? null,
    allowSearchIndexing: raw.allowSearchIndexing === true,
    includeAttachments: raw.includeAttachments === true,
    attachments: Array.isArray(raw.attachments)
      ? raw.attachments
          .map((attachment) =>
            normalizePublicDocumentAttachment(attachment as RawPublicDocumentAttachment),
          )
          .filter((attachment): attachment is PublicDocumentAttachment => attachment !== null)
      : [],
  };
  if (raw.contentJson !== undefined) normalized.contentJson = raw.contentJson;
  return normalized;
}

export const listProjects = (organizationId?: string) =>
  apiJson<Project[] | { projects: Project[] }>(
    `/api/projects${organizationId ? `?organizationId=${encodeURIComponent(organizationId)}` : ''}`,
  ).then((r) => (Array.isArray(r) ? r : (r.projects ?? [])));

export interface CreateDraftInput {
  title?: string | null;
  content?: string | null;
  entityType?: DraftEntityType;
  organizationId?: string | null;
  targetProjectId?: string | null;
  metadata?: Record<string, unknown>;
}

export interface UpdateDraftInput extends CreateDraftInput {
  id: string;
}

export const listDrafts = () =>
  apiJson<{ drafts?: RawDraft[] }>('/api/drafts').then((response) =>
    (response.drafts ?? [])
      .map((draft) => normalizeDraft(draft))
      .filter((draft): draft is Draft => draft !== null),
  );

export const createDraft = (input: CreateDraftInput) =>
  apiJson<{ draft?: RawDraft }>('/api/drafts', {
    method: 'POST',
    body: JSON.stringify(input),
  }).then((response) => {
    const draft = normalizeDraft(response.draft ?? {});
    if (!draft) throw new Error(i18next.t('drafts.createFailed'));
    return draft;
  });

export const updateDraft = ({ id, ...patch }: UpdateDraftInput) =>
  apiJson<{ draft?: RawDraft }>(`/api/drafts/${encodeURIComponent(id)}`, {
    method: 'PATCH',
    body: JSON.stringify(patch),
  }).then((response) => {
    const draft = normalizeDraft(response.draft ?? {});
    if (!draft) throw new Error(i18next.t('drafts.updateFailed'));
    return draft;
  });

export const deleteDraft = (draftId: string) =>
  apiJson<{ success?: boolean }>(`/api/drafts/${encodeURIComponent(draftId)}`, {
    method: 'DELETE',
  });

export interface CreateApiKeyInput {
  organizationId: string;
  name: string;
  expiresAt?: string | null;
}

export const listApiKeys = (organizationId: string) =>
  apiJson<{ apiKeys?: RawApiKey[] }>(
    `/api/api-keys?organizationId=${encodeURIComponent(organizationId)}`,
  ).then((response) =>
    (response.apiKeys ?? [])
      .map((key) => normalizeApiKey(key))
      .filter((key): key is ApiKey => key !== null),
  );

export const createApiKey = (input: CreateApiKeyInput) =>
  apiJson<{ apiKey?: RawApiKey }>('/api/api-keys', {
    method: 'POST',
    body: JSON.stringify({
      name: input.name,
      organizationId: input.organizationId,
      expiresAt: input.expiresAt || undefined,
    }),
  }).then((response) => {
    const key = normalizeApiKey(response.apiKey ?? {});
    if (!key) throw new Error(i18next.t('developer.apiKeys.createFailed'));
    return key;
  });

export const revokeApiKey = (keyId: string) =>
  apiJson<{ message?: string }>(`/api/api-keys/${encodeURIComponent(keyId)}`, {
    method: 'DELETE',
  });

export interface ListWebhooksParams {
  organizationId: string;
  projectId?: string | null;
}

export interface CreateWebhookInput {
  organizationId: string;
  projectId?: string | null;
  name: string;
  url: string;
  events: string[];
}

export interface UpdateWebhookInput {
  id: string;
  name?: string;
  url?: string;
  events?: string[];
  isActive?: boolean;
}

export const listWebhooks = ({ organizationId, projectId }: ListWebhooksParams) => {
  const q = new URLSearchParams({ organizationId });
  if (projectId) q.set('projectId', projectId);
  return apiJson<{ webhooks?: RawWebhook[] }>(`/api/webhooks?${q.toString()}`).then((response) =>
    (response.webhooks ?? [])
      .map((webhook) => normalizeWebhook(webhook))
      .filter((webhook): webhook is Webhook => webhook !== null),
  );
};

export const createWebhook = (input: CreateWebhookInput) =>
  apiJson<{ webhook?: RawWebhook }>('/api/webhooks', {
    method: 'POST',
    body: JSON.stringify({
      name: input.name,
      url: input.url,
      organizationId: input.organizationId,
      projectId: input.projectId || undefined,
      events: input.events,
    }),
  }).then((response) => {
    const webhook = normalizeWebhook(response.webhook ?? {});
    if (!webhook) throw new Error(i18next.t('developer.webhooks.saveFailed'));
    return webhook;
  });

export const updateWebhook = ({ id, ...patch }: UpdateWebhookInput) =>
  apiJson<RawWebhook>(`/api/webhooks/${encodeURIComponent(id)}`, {
    method: 'PATCH',
    body: JSON.stringify(patch),
  }).then((response) => {
    const webhook = normalizeWebhook(response);
    if (!webhook) throw new Error(i18next.t('developer.webhooks.saveFailed'));
    return webhook;
  });

export const deleteWebhook = (webhookId: string) =>
  apiJson<{ message?: string }>(`/api/webhooks/${encodeURIComponent(webhookId)}`, {
    method: 'DELETE',
  });

export const testWebhook = (webhookId: string) =>
  apiJson<RawWebhookTestResult>(`/api/webhooks/${encodeURIComponent(webhookId)}/test`, {
    method: 'POST',
  }).then((response) => normalizeWebhookTestResult(response));

export const WORKSPACE_INTEGRATION_PROVIDERS: WorkspaceIntegrationProvider[] = [
  'github',
  'gitlab',
  'jira',
  'sentry',
  'slack',
];

const INTEGRATION_STATUS_PATHS: Record<WorkspaceIntegrationProvider, string> = {
  github: '/api/integrations/github/status',
  gitlab: '/api/integrations/gitlab/status',
  jira: '/api/integrations/jira',
  sentry: '/api/integrations/sentry/status',
  slack: '/api/integrations/slack/status',
};

const INTEGRATION_DELETE_PATHS: Record<WorkspaceIntegrationProvider, string> = {
  github: '/api/integrations/github',
  gitlab: '/api/integrations/gitlab',
  jira: '/api/integrations/jira',
  sentry: '/api/integrations/sentry',
  slack: '/api/integrations/slack',
};

function optionalString(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value : null;
}

function optionalDateString(value: unknown): string | null {
  if (typeof value === 'string' && value.trim()) return value;
  if (value instanceof Date) return value.toISOString();
  return null;
}

function normalizeIntegrationConnection(
  provider: WorkspaceIntegrationProvider,
  raw: RawIntegrationConnection | null | undefined,
): WorkspaceIntegrationConnection | null {
  if (!raw || typeof raw.id !== 'string') return null;
  const metadata =
    raw.metadata && typeof raw.metadata === 'object' && !Array.isArray(raw.metadata)
      ? (raw.metadata as Record<string, unknown>)
      : null;

  return {
    id: raw.id,
    provider,
    externalAccountId: optionalString(raw.externalAccountId),
    externalAccountLabel: optionalString(raw.externalAccountLabel),
    scope: optionalString(raw.scope),
    metadata,
    connectedById: optionalString(raw.connectedById),
    createdAt: optionalDateString(raw.createdAt),
    updatedAt: optionalDateString(raw.updatedAt),
    siteUrl: optionalString(raw.siteUrl),
    siteName: optionalString(raw.siteName),
  };
}

function normalizeIntegrationStatus(
  provider: WorkspaceIntegrationProvider,
  raw: RawIntegrationStatus,
): WorkspaceIntegrationStatus {
  const source = raw.connection ?? raw;
  const connection = normalizeIntegrationConnection(provider, source);
  return {
    provider,
    connected: raw.connected === true && connection !== null,
    connection,
  };
}

export const getWorkspaceIntegrationStatus = (
  organizationId: string,
  provider: WorkspaceIntegrationProvider,
) =>
  apiJson<RawIntegrationStatus>(
    `${INTEGRATION_STATUS_PATHS[provider]}?organizationId=${encodeURIComponent(organizationId)}`,
  ).then((response) => normalizeIntegrationStatus(provider, response));

export const listWorkspaceIntegrationStatuses = (organizationId: string) =>
  Promise.all(
    WORKSPACE_INTEGRATION_PROVIDERS.map((provider) =>
      getWorkspaceIntegrationStatus(organizationId, provider),
    ),
  );

export const disconnectWorkspaceIntegration = (
  organizationId: string,
  provider: WorkspaceIntegrationProvider,
) =>
  apiJson<{ ok?: boolean; alreadyDisconnected?: boolean }>(
    `${INTEGRATION_DELETE_PATHS[provider]}?organizationId=${encodeURIComponent(organizationId)}`,
    { method: 'DELETE' },
  );

export const requestWorkspaceIntegrationAuthorization = (
  organizationId: string,
  provider: WorkspaceIntegrationProvider,
) =>
  apiJson<WorkspaceIntegrationAuthorizeResponse>(
    `/api/integrations/mobile/authorize?organizationId=${encodeURIComponent(
      organizationId,
    )}&provider=${encodeURIComponent(provider)}`,
  );

export interface ListAuditLogsParams {
  organizationId: string;
  resourceType?: string;
  resourceId?: string;
  projectId?: string;
  issueId?: string;
  limit?: number;
}

export const listAuditLogs = ({
  organizationId,
  resourceType,
  resourceId,
  projectId,
  issueId,
  limit = 50,
}: ListAuditLogsParams) => {
  const q = new URLSearchParams({ organizationId, limit: String(limit) });
  if (resourceType) q.set('resourceType', resourceType);
  if (resourceId) q.set('resourceId', resourceId);
  if (projectId) q.set('projectId', projectId);
  if (issueId) q.set('issueId', issueId);

  return apiJson<{ auditLogs?: RawAuditLogEntry[] }>(`/api/audit-logs?${q.toString()}`).then(
    (response) =>
      (response.auditLogs ?? [])
        .map((entry) => normalizeAuditLogEntry(entry))
        .filter((entry): entry is AuditLogEntry => entry !== null),
  );
};

export interface ListRecentActivitiesParams {
  organizationId: string;
  limit?: number;
}

export const listRecentActivities = ({
  organizationId,
  limit = 20,
}: ListRecentActivitiesParams) => {
  const q = new URLSearchParams({ organizationId, limit: String(limit) });
  return apiJson<{ activities?: RawRecentActivity[] }>(
    `/api/activities/recent?${q.toString()}`,
  ).then((response) =>
    (response.activities ?? [])
      .map((activity) => normalizeRecentActivity(activity))
      .filter((activity): activity is RecentActivity => activity !== null),
  );
};

export const getAgentPolicy = (organizationId: string) =>
  apiJson<RawAgentPolicyStatus>(
    `/api/agent-policy?organizationId=${encodeURIComponent(organizationId)}`,
  ).then((response) => normalizeAgentPolicyStatus(response));

export interface ListAgentApprovalsParams {
  organizationId: string;
  status?: AgentApprovalStatus | 'all';
}

export const listAgentApprovals = ({
  organizationId,
  status = 'pending',
}: ListAgentApprovalsParams) =>
  apiJson<{ approvals?: RawAgentApprovalRequest[] }>(
    `/api/agent-approvals?organizationId=${encodeURIComponent(organizationId)}&status=${encodeURIComponent(status)}`,
  ).then((response) =>
    (response.approvals ?? [])
      .map((approval) => normalizeAgentApprovalRequest(approval))
      .filter((approval): approval is AgentApprovalRequest => approval !== null),
  );

export const approveAgentApproval = (approvalId: string) =>
  apiJson<{ approval?: RawAgentApprovalRequest; result?: unknown }>(
    `/api/agent-approvals/${encodeURIComponent(approvalId)}/approve`,
    { method: 'POST' },
  ).then((response) => normalizeAgentApprovalDecision(response));

export const rejectAgentApproval = (approvalId: string) =>
  apiJson<{ approval?: RawAgentApprovalRequest; result?: unknown }>(
    `/api/agent-approvals/${encodeURIComponent(approvalId)}/reject`,
    { method: 'POST' },
  ).then((response) => normalizeAgentApprovalDecision(response));

export const getAdminStats = () =>
  apiJson<RawAdminStatsResponse>('/api/admin/stats').then((response) =>
    normalizeAdminStats(response),
  );

export interface ListAdminOrganizationsParams {
  page?: number;
  limit?: number;
  status?: AdminOrganizationStatus;
  plan?: AdminOrganizationPlan;
  search?: string;
}

export const listAdminOrganizations = ({
  page = 1,
  limit = 10,
  status,
  plan,
  search,
}: ListAdminOrganizationsParams = {}) => {
  const q = new URLSearchParams({ page: String(page), limit: String(limit) });
  if (status) q.set('status', status);
  if (plan) q.set('plan', plan);
  const trimmed = search?.trim();
  if (trimmed) q.set('search', trimmed);

  return apiJson<RawAdminOrganizationsResponse>(`/api/admin/organizations?${q.toString()}`).then(
    (response) => normalizeAdminOrganizationsResponse(response),
  );
};

export interface UpdateAdminOrganizationInput {
  id: string;
  name?: string;
  slug?: string;
  plan?: AdminOrganizationPlan;
  status?: AdminOrganizationStatus;
  domain?: string;
  logoUrl?: string;
}

export const updateAdminOrganization = ({ id, ...patch }: UpdateAdminOrganizationInput) =>
  apiJson<RawAdminOrganizationSummary>(`/api/admin/organizations/${encodeURIComponent(id)}`, {
    method: 'PATCH',
    body: JSON.stringify(patch),
  }).then((response) => {
    const organization = normalizeAdminOrganizationSummary(response);
    if (!organization) throw new Error(i18next.t('admin.directory.updateFailed'));
    return organization;
  });

export interface ListAdminUsersParams {
  page?: number;
  limit?: number;
  status?: AdminUserStatus;
  search?: string;
}

export const listAdminUsers = ({
  page = 1,
  limit = 10,
  status,
  search,
}: ListAdminUsersParams = {}) => {
  const q = new URLSearchParams({ page: String(page), limit: String(limit) });
  if (status) q.set('status', status);
  const trimmed = search?.trim();
  if (trimmed) q.set('search', trimmed);

  return apiJson<RawAdminUsersResponse>(`/api/admin/users?${q.toString()}`).then((response) =>
    normalizeAdminUsersResponse(response),
  );
};

export interface UpdateAdminUserInput {
  id: string;
  status?: AdminUserStatus;
  isSuperAdmin?: boolean;
}

export const updateAdminUser = ({ id, ...patch }: UpdateAdminUserInput) =>
  apiJson<RawAdminUserSummary>(`/api/admin/users/${encodeURIComponent(id)}`, {
    method: 'PATCH',
    body: JSON.stringify(patch),
  }).then((response) => {
    const user = normalizeAdminUserSummary(response);
    if (!user) throw new Error(i18next.t('admin.directory.updateFailed'));
    return user;
  });

export const getAdminSmtpConfig = () =>
  apiJson<{ smtp?: RawAdminSmtpConfig }>('/api/admin/system/smtp').then((response) =>
    normalizeAdminSmtpConfig(response.smtp),
  );

export interface UpdateAdminSmtpConfigInput {
  host: string;
  port: number;
  secure: boolean;
  user: string;
  password?: string;
  emailFrom: string;
}

export const updateAdminSmtpConfig = (input: UpdateAdminSmtpConfigInput) =>
  apiJson<{ smtp?: RawAdminSmtpConfig }>('/api/admin/system/smtp', {
    method: 'PUT',
    body: JSON.stringify(input),
  }).then((response) => normalizeAdminSmtpConfig(response.smtp));

export interface TestAdminSmtpConfigInput {
  to?: string;
}

export const testAdminSmtpConfig = (input: TestAdminSmtpConfigInput = {}) =>
  apiJson<RawAdminSystemTestResult>('/api/admin/system/smtp/test', {
    method: 'POST',
    body: JSON.stringify(input),
  }).then((response) => normalizeAdminSystemTestResult(response));

export const getAdminStorageConfig = () =>
  apiJson<{ storage?: RawAdminStorageConfig }>('/api/admin/system/storage').then((response) =>
    normalizeAdminStorageConfig(response.storage),
  );

export interface UpdateAdminStorageConfigInput {
  uploadsDir: string;
  s3Bucket: string;
  s3Region: string;
  s3AccessKey: string;
  s3SecretKey?: string;
}

export const updateAdminStorageConfig = (input: UpdateAdminStorageConfigInput) =>
  apiJson<{ storage?: RawAdminStorageConfig }>('/api/admin/system/storage', {
    method: 'PUT',
    body: JSON.stringify(input),
  }).then((response) => normalizeAdminStorageConfig(response.storage));

export const getAdminLivekitConfig = () =>
  apiJson<{ livekit?: RawAdminLivekitConfig }>('/api/admin/system/livekit').then((response) =>
    normalizeAdminLivekitConfig(response.livekit),
  );

export interface UpdateAdminLivekitConfigInput {
  url: string;
  apiKey: string;
  apiSecret?: string;
}

export const updateAdminLivekitConfig = (input: UpdateAdminLivekitConfigInput) =>
  apiJson<{ livekit?: RawAdminLivekitConfig }>('/api/admin/system/livekit', {
    method: 'PUT',
    body: JSON.stringify(input),
  }).then((response) => normalizeAdminLivekitConfig(response.livekit));

export const testAdminLivekitConfig = () =>
  apiJson<RawAdminSystemTestResult>('/api/admin/system/livekit/test', {
    method: 'POST',
  }).then((response) => normalizeAdminSystemTestResult(response));

export const getAdminAgentControl = () =>
  apiJson<RawAdminAgentControlResponse>('/api/admin/agent-control').then((response) =>
    normalizeAdminAgentControlResponse(response),
  );

export interface UpdateAdminAgentControlInput {
  globalEnabled?: boolean;
  allowWriteActions?: boolean;
  requireSupervisionForAutoMode?: boolean;
  maxConcurrentRuns?: number;
}

export const updateAdminAgentControl = (input: UpdateAdminAgentControlInput) =>
  apiJson<{ settings?: RawAdminAgentControlSettings }>('/api/admin/agent-control', {
    method: 'PATCH',
    body: JSON.stringify(input),
  }).then((response) => normalizeAdminAgentControlSettings(response.settings));

export const getOrganizationAgentSettings = (organizationId: string) =>
  apiJson<RawOrganizationAgentSettingsResponse>(
    `/api/organizations/${encodeURIComponent(organizationId)}/ai-agents`,
  ).then((response) => normalizeOrganizationAgentSettingsResponse(response));

export const updateOrganizationAgentSettings = ({
  organizationId,
  ...patch
}: UpdateOrganizationAgentSettingsInput) =>
  apiJson<RawOrganizationAgentSettingsResponse>(
    `/api/organizations/${encodeURIComponent(organizationId)}/ai-agents`,
    {
      method: 'PATCH',
      body: JSON.stringify(patch),
    },
  ).then((response) => normalizeOrganizationAgentSettingsResponse(response));

export const getProjectAgentSettings = (projectId: string) =>
  apiJson<RawProjectAgentSettingsResponse>(
    `/api/projects/${encodeURIComponent(projectId)}/agents`,
  ).then((response) => normalizeProjectAgentSettingsResponse(response));

export const updateProjectAgentSettings = (
  projectId: string,
  patch: UpdateProjectAgentSettingsInput,
) =>
  apiJson<{ projectId?: string; projectSettings?: RawProjectAgentSettings }>(
    `/api/projects/${encodeURIComponent(projectId)}/agents`,
    {
      method: 'PATCH',
      body: JSON.stringify(patch),
    },
  ).then((response) => normalizeProjectAgentSettings(response.projectSettings));

export const getWorkspaceCommunicationsSettings = (organizationId: string) =>
  apiJson<RawWorkspaceCommunicationsSettingsResponse>(
    `/api/organizations/${encodeURIComponent(organizationId)}/communications`,
  ).then((response) => normalizeWorkspaceCommunicationsSettingsResponse(response));

export const updateWorkspaceCommunicationsSettings = ({
  organizationId,
  ...patch
}: UpdateWorkspaceCommunicationsSettingsInput) =>
  apiJson<RawWorkspaceCommunicationsSettingsResponse>(
    `/api/organizations/${encodeURIComponent(organizationId)}/communications`,
    {
      method: 'PATCH',
      body: JSON.stringify(patch),
    },
  ).then((response) => normalizeWorkspaceCommunicationsSettingsResponse(response));

export const getRegistrationPolicy = () =>
  apiJson<{ registration?: RawRegistrationPolicy }>('/api/admin/system/registration').then(
    (response) => normalizeRegistrationPolicy(response.registration),
  );

export const updateRegistrationPolicy = (mode: RegistrationMode) =>
  apiJson<{ registration?: RawRegistrationPolicy }>('/api/admin/system/registration', {
    method: 'PUT',
    body: JSON.stringify({ mode }),
  }).then((response) => normalizeRegistrationPolicy(response.registration));

export interface GetAdminVersionStatusParams {
  refresh?: boolean;
}

export const getAdminVersionStatus = ({ refresh = false }: GetAdminVersionStatusParams = {}) =>
  apiJson<RawAdminVersionStatus>(`/api/admin/version${refresh ? '?refresh=true' : ''}`).then(
    (response) => normalizeAdminVersionStatus(response),
  );

export interface GetAdminAiUsageParams {
  days?: number;
  organizationId?: string;
}

export const getAdminAiUsage = ({ days = 7, organizationId }: GetAdminAiUsageParams = {}) => {
  const q = new URLSearchParams({ days: String(days) });
  if (organizationId) q.set('organizationId', organizationId);

  return apiJson<RawAdminAiUsageResponse>(`/api/admin/ai-usage?${q.toString()}`).then((response) =>
    normalizeAdminAiUsageResponse(response),
  );
};

export interface UpdateAdminAiKillSwitchInput {
  organizationId: string;
  enabled: boolean;
  reason?: string;
  dailyTokenLimit?: number | null;
  monthlyTokenLimit?: number | null;
  dailyCostUsdLimit?: number | null;
  monthlyCostUsdLimit?: number | null;
}

export const updateAdminAiKillSwitch = (input: UpdateAdminAiKillSwitchInput) =>
  apiJson<RawAdminAiKillSwitchResult>('/api/admin/ai-usage/kill-switch', {
    method: 'POST',
    body: JSON.stringify(input),
  }).then((response) => normalizeAdminAiKillSwitchResult(response));

export interface ResetAdminAiUsageCountersInput {
  scope?: AdminAiUsageResetScope;
  organizationId?: string;
}

export const resetAdminAiUsageCounters = (input: ResetAdminAiUsageCountersInput = {}) =>
  apiJson<RawAdminAiUsageResetResult>('/api/admin/ai-usage/reset-counters', {
    method: 'POST',
    body: JSON.stringify(input),
  }).then((response) => normalizeAdminAiUsageResetResult(response));

export const listAdminFeatureFlags = () =>
  apiJson<{ featureFlags?: RawAdminFeatureFlag[] }>('/api/admin/feature-flags').then((response) =>
    (response.featureFlags ?? [])
      .map((flag) => normalizeAdminFeatureFlag(flag))
      .filter((flag): flag is AdminFeatureFlag => flag !== null),
  );

export interface UpdateAdminFeatureFlagInput {
  id: string;
  isEnabled?: boolean;
  rolloutPercentage?: number;
  enabledForPlans?: string[];
  enabledForOrganizations?: string[];
}

export const updateAdminFeatureFlag = ({ id, ...patch }: UpdateAdminFeatureFlagInput) =>
  apiJson<RawAdminFeatureFlag>(`/api/admin/feature-flags/${encodeURIComponent(id)}`, {
    method: 'PATCH',
    body: JSON.stringify(patch),
  }).then((response) => {
    const flag = normalizeAdminFeatureFlag(response);
    if (!flag) throw new Error(i18next.t('admin.flags.updateFailed'));
    return flag;
  });

export const getAdminRealtimeHealth = () =>
  apiJson<RawAdminRealtimeHealth>('/api/admin/realtime-health').then((response) =>
    normalizeAdminRealtimeHealth(response),
  );

export interface ListSystemAuditLogsParams {
  search?: string;
  resourceType?: string;
  limit?: number;
}

export const listSystemAuditLogs = ({
  search,
  resourceType,
  limit = 25,
}: ListSystemAuditLogsParams = {}) => {
  const q = new URLSearchParams({ limit: String(limit) });
  const trimmed = search?.trim();
  if (trimmed) q.set('search', trimmed);
  if (resourceType && resourceType !== 'all') q.set('resourceType', resourceType);

  return apiJson<{ auditLogs?: RawSystemAuditLogEntry[] }>(
    `/api/admin/audit-logs?${q.toString()}`,
  ).then((response) =>
    (response.auditLogs ?? [])
      .map((entry) => normalizeSystemAuditLogEntry(entry))
      .filter((entry): entry is SystemAuditLogEntry => entry !== null),
  );
};

export interface ListTemplatesParams {
  organizationId?: string;
  kind?: TemplateKind;
}

export const listTemplates = (params: ListTemplatesParams = {}) => {
  const q = new URLSearchParams();
  if (params.organizationId) q.set('organizationId', params.organizationId);
  if (params.kind) q.set('kind', params.kind);
  const qs = q.toString();

  return apiJson<{
    templates?: RawTemplate[];
    canAdminister?: boolean;
    adminOrganizationIds?: string[];
    memberOrganizationIds?: string[];
  }>(`/api/templates${qs ? `?${qs}` : ''}`).then(
    (response): TemplatesListResponse => ({
      templates: (response.templates ?? [])
        .map((template) => normalizeTemplate(template))
        .filter((template): template is WorkTemplate => template !== null),
      canAdminister: response.canAdminister === true,
      adminOrganizationIds: response.adminOrganizationIds ?? [],
      memberOrganizationIds: response.memberOrganizationIds ?? [],
    }),
  );
};

export const instantiateTemplate = (templateId: string, overrides?: UseTemplateOverrides) =>
  apiJson<RawUseTemplateResult>(`/api/templates/${encodeURIComponent(templateId)}/use`, {
    method: 'POST',
    body: JSON.stringify({ overrides: overrides ?? {} }),
  }).then((response) => normalizeUseTemplateResult(response));

export const listPinnedItems = () =>
  apiJson<{ items?: RawPinnedItem[] }>('/api/pinned-items').then((response) =>
    (response.items ?? [])
      .map((item) => normalizePinnedItem(item))
      .filter((item): item is PinnedItem => item !== null),
  );

export const deletePinnedItem = (id: string) =>
  apiJson<{ success?: boolean }>(`/api/pinned-items/${encodeURIComponent(id)}`, {
    method: 'DELETE',
  });

export const getLastSeen = () =>
  apiJson<RawLastSeenResponse>('/api/user/last-seen').then((response) =>
    normalizeLastSeen(response),
  );

export const updateLastSeen = () =>
  apiJson<RawLastSeenResponse>('/api/user/last-seen', { method: 'POST' }).then((response) =>
    normalizeLastSeen(response),
  );

export const getTodayStandup = (organizationId?: string | null) => {
  const q = new URLSearchParams();
  if (organizationId) q.set('organizationId', organizationId);
  const qs = q.toString();
  return apiJson<RawStandupDigest | undefined>(
    `/api/users/me/standup/today${qs ? `?${qs}` : ''}`,
  ).then((response) => normalizeStandupDigest(response));
};

export const generateStandupPreview = (organizationId?: string | null) =>
  apiJson<RawStandupDigest>('/api/users/me/standup/preview', {
    method: 'POST',
    body: JSON.stringify(organizationId ? { organizationId } : {}),
  }).then((response) => {
    const digest = normalizeStandupDigest(response);
    if (!digest) throw new Error(i18next.t('dashboard.standupGenerateError'));
    return digest;
  });

function documentScopeQuery(params: DocumentScopeParams = {}): URLSearchParams {
  const q = new URLSearchParams();
  if (params.organizationId) q.set('organizationId', params.organizationId);
  if (params.projectId) q.set('projectId', params.projectId);
  return q;
}

export const listDocumentSpaces = (params: DocumentScopeParams = {}) => {
  const q = documentScopeQuery(params);
  const qs = q.toString();
  return apiJson<{ spaces?: RawDocumentSpace[] }>(`/api/docs/spaces${qs ? `?${qs}` : ''}`).then(
    (response) =>
      (response.spaces ?? [])
        .map((space) => normalizeDocumentSpace(space))
        .filter((space): space is DocumentSpace => space !== null),
  );
};

export const listDocumentPages = (spaceId?: string | null, params: DocumentScopeParams = {}) => {
  const q = documentScopeQuery(params);
  if (spaceId) q.set('spaceId', spaceId);
  const qs = q.toString();
  return apiJson<{
    space?: RawDocumentSpace | null;
    permissions?: DocumentPagesResponse['permissions'];
    pages?: RawDocumentPageSummary[];
  }>(`/api/docs/pages${qs ? `?${qs}` : ''}`).then((response) => ({
    space: response.space ? normalizeDocumentSpace(response.space) : null,
    permissions: response.permissions,
    pages: (response.pages ?? [])
      .map((page) => normalizeDocumentPageSummary(page))
      .filter((page): page is DocumentPageSummary => page !== null),
  }));
};

export const getDocumentPage = (pageId: string) =>
  apiJson<RawDocumentPage>(`/api/docs/pages/${encodeURIComponent(pageId)}`).then((page) =>
    normalizeDocumentPage(page),
  );

export const getDocumentTree = (pageId: string) =>
  apiJson<{
    tree?: RawDocumentTreeNode[];
    currentPageId?: string;
    space?: RawDocumentSpace | null;
  }>(`/api/docs/pages/${encodeURIComponent(pageId)}/tree`).then(
    (response): DocumentTreeResponse => {
      const space = response.space ? normalizeDocumentSpace(response.space) : null;
      return {
        tree: (response.tree ?? [])
          .map((node) => normalizeDocumentTreeNode(node))
          .filter((node): node is DocumentTreeNode => node !== null),
        currentPageId: response.currentPageId ?? pageId,
        space,
      };
    },
  );

export const getPublicDocumentPage = (token: string) =>
  apiJson<{ page?: RawPublicDocumentPage }>(`/api/public/docs/${encodeURIComponent(token)}`).then(
    (response) => {
      const page = normalizePublicDocumentPage(response.page ?? {});
      if (!page) throw new Error(i18next.t('publicShare.errorInvalidResponse'));
      return page;
    },
  );

export const createDocumentPage = (input: CreateDocumentPageInput) =>
  apiJson<RawDocumentPage>('/api/docs/pages', {
    method: 'POST',
    body: JSON.stringify(input),
  }).then((page) => {
    const normalized = normalizeDocumentPage(page);
    if (!normalized) throw new Error(i18next.t('docs.createFailed'));
    return normalized;
  });

export const updateDocumentPage = (pageId: string, input: UpdateDocumentPageInput) =>
  apiJson<RawDocumentPage>(`/api/docs/pages/${encodeURIComponent(pageId)}`, {
    method: 'PATCH',
    body: JSON.stringify(input),
  }).then((page) => {
    const normalized = normalizeDocumentPage(page);
    if (!normalized) throw new Error(i18next.t('docs.updateFailed'));
    return normalized;
  });

export const updateDocumentShare = (pageId: string, input: UpdateDocumentShareInput) =>
  apiJson<RawDocumentPage>(`/api/docs/pages/${encodeURIComponent(pageId)}/share`, {
    method: 'PATCH',
    body: JSON.stringify(input),
  }).then((page) => {
    const normalized = normalizeDocumentPage(page);
    if (!normalized) throw new Error(i18next.t('docs.shareUpdateFailed'));
    return normalized;
  });

export const listDocumentRevisions = (pageId: string) =>
  apiJson<{ revisions?: RawDocumentRevision[] }>(
    `/api/docs/pages/${encodeURIComponent(pageId)}/revisions`,
  ).then((response) =>
    (response.revisions ?? [])
      .map((revision) => normalizeDocumentRevision(revision))
      .filter((revision): revision is DocumentRevision => revision !== null),
  );

export const restoreDocumentRevision = (pageId: string, input: RestoreDocumentRevisionInput) => {
  const body: RestoreDocumentRevisionInput = {};
  if (input.revision !== undefined) body.revision = input.revision;
  if (input.revisionId !== undefined) body.revisionId = input.revisionId;

  return apiJson<RawDocumentPage>(`/api/docs/pages/${encodeURIComponent(pageId)}/restore`, {
    method: 'POST',
    body: JSON.stringify(body),
  }).then((page) => {
    const normalized = normalizeDocumentPage(page);
    if (!normalized) throw new Error(i18next.t('docs.revisionRestoreFailed'));
    return normalized;
  });
};

export const listDocumentAttachments = (pageId: string) =>
  apiJson<{ attachments?: RawDocumentAttachment[] }>(
    `/api/docs/pages/${encodeURIComponent(pageId)}/attachments`,
  ).then((response) =>
    (response.attachments ?? [])
      .map((attachment) => normalizeDocumentAttachment(attachment))
      .filter((attachment): attachment is DocumentAttachment => attachment !== null),
  );

export interface UploadDocumentAttachmentInput {
  uri: string;
  name: string;
  type?: string | null;
  size?: number | null;
}

export const uploadDocumentAttachment = (pageId: string, input: UploadDocumentAttachmentInput) => {
  const formData = new FormData();
  formData.append('file', {
    uri: input.uri,
    name: input.name,
    type: input.type ?? 'application/octet-stream',
  } as unknown as Blob);

  return apiFormData<RawUploadDocumentAttachmentResponse>(
    `/api/docs/pages/${encodeURIComponent(pageId)}/attachments`,
    formData,
    { method: 'POST' },
  ).then((response) => {
    const attachment = normalizeDocumentAttachment(response.attachment);
    if (!attachment) throw new Error(i18next.t('docs.attachmentUploadFailed'));
    return attachment;
  });
};

export const deleteDocumentAttachment = (pageId: string, attachmentId: string) =>
  apiJson<{ success: boolean }>(
    `/api/docs/pages/${encodeURIComponent(pageId)}/attachments?attachmentId=${encodeURIComponent(attachmentId)}`,
    { method: 'DELETE' },
  );

export const searchDocumentPages = (
  query: string,
  params: { organizationId?: string | null; projectId?: string | null } = {},
) => {
  const q = new URLSearchParams({ q: query.trim(), limit: '30' });
  if (params.organizationId) q.set('organizationId', params.organizationId);
  if (params.projectId) q.set('projectId', params.projectId);
  return apiJson<DocumentSearchResponse | { results?: RawDocumentPageSummary[] }>(
    `/api/docs/search?${q.toString()}`,
  ).then((response) => ({
    results: (response.results ?? [])
      .map((page) => normalizeDocumentPageSummary(page))
      .filter((page): page is DocumentPageSummary => page !== null),
  }));
};

export const listIssueDocuments = (issueId: string) =>
  apiJson<{ docs?: RawIssueDocument[] }>(`/api/issues/${encodeURIComponent(issueId)}/docs`).then(
    (response) =>
      (response.docs ?? [])
        .map((doc) => normalizeIssueDocument(doc))
        .filter((doc): doc is IssueDocument => doc !== null),
  );

export interface AttachIssueDocumentInput {
  pageId?: string;
  createNew?: boolean;
  title?: string;
}

export interface AttachIssueDocumentResult {
  page?: DocumentPage;
  link?: { id?: string; pageId?: string; issueId?: string };
}

export const attachIssueDocument = (issueId: string, input: AttachIssueDocumentInput) =>
  apiJson<{
    page?: RawDocumentPage;
    link?: { id?: string; pageId?: string; issueId?: string };
    id?: string;
    pageId?: string;
  }>(`/api/issues/${encodeURIComponent(issueId)}/docs`, {
    method: 'POST',
    body: JSON.stringify(input),
  }).then((response): AttachIssueDocumentResult => {
    const page = response.page ? normalizeDocumentPage(response.page) : undefined;
    const link: NonNullable<AttachIssueDocumentResult['link']> = response.link
      ? { ...response.link }
      : { issueId };
    if (!response.link) {
      if (response.id !== undefined) link.id = response.id;
      if (response.pageId !== undefined) link.pageId = response.pageId;
    }
    return {
      ...(page ? { page } : {}),
      link,
    };
  });

export const detachIssueDocument = (issueId: string, pageId: string) =>
  apiJson<{ success: boolean }>(
    `/api/issues/${encodeURIComponent(issueId)}/docs?pageId=${encodeURIComponent(pageId)}`,
    { method: 'DELETE' },
  );

export const getProject = (projectId: string) => apiJson<Project>(`/api/projects/${projectId}`);

export const getProjectHealthAnalytics = (projectId: string) =>
  apiJson<RawProjectHealthAnalytics>(
    `/api/analytics/project-health?projectId=${encodeURIComponent(projectId)}`,
  ).then((response) => normalizeProjectHealthAnalytics(response));

export const getProjectVelocityAnalytics = (projectId: string) =>
  apiJson<RawProjectVelocityAnalytics>(
    `/api/analytics/velocity?projectId=${encodeURIComponent(projectId)}`,
  ).then((response) => normalizeProjectVelocityAnalytics(response));

export const getProjectThroughputAnalytics = (
  projectId: string,
  { days = 60, bucket = 'week' }: { days?: number; bucket?: 'day' | 'week' } = {},
) =>
  apiJson<RawProjectThroughputAnalytics>(
    `/api/analytics/throughput?projectId=${encodeURIComponent(projectId)}&days=${encodeURIComponent(String(days))}&bucket=${encodeURIComponent(bucket)}`,
  ).then((response) => normalizeProjectThroughputAnalytics(response));

export const getProjectCycleTimeAnalytics = (
  projectId: string,
  { days = 30 }: { days?: number } = {},
) =>
  apiJson<RawProjectCycleTimeAnalytics>(
    `/api/analytics/cycle-time?projectId=${encodeURIComponent(projectId)}&days=${encodeURIComponent(String(days))}`,
  ).then((response) => normalizeProjectCycleTimeAnalytics(response));

export const getProjectForecastAnalytics = (projectId: string) =>
  apiJson<RawProjectForecastAnalytics>(
    `/api/analytics/forecast?projectId=${encodeURIComponent(projectId)}`,
  ).then((response) => normalizeProjectForecastAnalytics(response));

export const getDoraAnalytics = (organizationId: string): Promise<DoraAnalytics> =>
  apiJson<RawDoraAnalytics>(
    `/api/analytics/dora?organizationId=${encodeURIComponent(organizationId)}`,
  ).then((response) => normalizeDoraAnalytics(response));

export const getProjectAnalytics = async (projectId: string): Promise<ProjectAnalyticsResponse> => {
  const [health, velocity, throughput, cycleTime, forecast] = await Promise.all([
    getProjectHealthAnalytics(projectId),
    getProjectVelocityAnalytics(projectId),
    getProjectThroughputAnalytics(projectId),
    getProjectCycleTimeAnalytics(projectId),
    getProjectForecastAnalytics(projectId),
  ]);

  return { health, velocity, throughput, cycleTime, forecast };
};

export const acceptProjectInviteLink = (projectInviteToken: string) =>
  apiJson<ProjectInviteAcceptResult>('/api/project-invite-links/accept', {
    method: 'POST',
    body: JSON.stringify({ projectInviteToken }),
  });

export const listProjectComponents = (projectId: string) =>
  apiJson<{ components?: RawProjectComponent[]; total?: number }>(
    `/api/projects/${encodeURIComponent(projectId)}/components`,
  ).then((response) =>
    (response.components ?? [])
      .map((component) => normalizeProjectComponent(component))
      .filter((component): component is ProjectComponent => component !== null),
  );

export interface CreateProjectModuleInput {
  name: string;
  description?: string | null;
  status?: ModuleStatus;
  ownerId?: string | null;
  memberIds?: string[];
  targetDate?: string | null;
}

export interface UpdateProjectModuleInput {
  name?: string;
  description?: string | null;
  status?: ModuleStatus;
  ownerId?: string | null;
  memberIds?: string[];
  targetDate?: string | null;
}

function toModuleTargetDate(value: string | null | undefined): string | null | undefined {
  if (value === undefined) return undefined;
  if (value === null || value.trim() === '') return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toISOString();
}

function projectModuleBody(
  input: CreateProjectModuleInput | UpdateProjectModuleInput,
): Record<string, unknown> {
  const body: Record<string, unknown> = {};
  if (input.name !== undefined) body.name = input.name;
  if (input.description !== undefined) body.description = input.description;
  if (input.status !== undefined) body.status = input.status;
  if (input.ownerId !== undefined) body.ownerId = input.ownerId;
  if (input.memberIds !== undefined) body.memberIds = input.memberIds;
  if (input.targetDate !== undefined) body.targetDate = toModuleTargetDate(input.targetDate);
  return body;
}

export const listProjectModules = (projectId: string) =>
  apiJson<{ modules?: RawProjectModule[] }>(
    `/api/projects/${encodeURIComponent(projectId)}/modules`,
  ).then((response) =>
    (response.modules ?? [])
      .map((module) => normalizeProjectModule(module))
      .filter((module): module is ProjectModule => module !== null),
  );

export const createProjectModule = (projectId: string, input: CreateProjectModuleInput) =>
  apiJson<{ module?: RawProjectModule }>(`/api/projects/${encodeURIComponent(projectId)}/modules`, {
    method: 'POST',
    body: JSON.stringify(projectModuleBody(input)),
  }).then((response) => {
    const module = normalizeProjectModule(response.module ?? {});
    if (!module) throw new Error(i18next.t('modules.errorGeneric'));
    return module;
  });

export const updateProjectModule = (
  projectId: string,
  moduleId: string,
  patch: UpdateProjectModuleInput,
) =>
  apiJson<{ module?: RawProjectModule }>(
    `/api/projects/${encodeURIComponent(projectId)}/modules/${encodeURIComponent(moduleId)}`,
    {
      method: 'PATCH',
      body: JSON.stringify(projectModuleBody(patch)),
    },
  ).then((response) => {
    const module = normalizeProjectModule(response.module ?? {});
    if (!module) throw new Error(i18next.t('modules.errorGeneric'));
    return module;
  });

export const deleteProjectModule = (projectId: string, moduleId: string) =>
  apiJson<{ success: boolean }>(
    `/api/projects/${encodeURIComponent(projectId)}/modules/${encodeURIComponent(moduleId)}`,
    { method: 'DELETE' },
  );

export interface ListProjectViewsInput {
  projectId: string;
  teamId?: string | null | undefined;
  includePublic?: boolean | undefined;
}

export interface CreateProjectViewInput {
  name: string;
  description?: string | null;
  query?: string;
  criteria: Record<string, unknown>;
  viewType?: ProjectViewType;
  isPublic?: boolean;
  isPinned?: boolean;
  isDefault?: boolean;
  scope?: ProjectViewScope;
}

export interface UpdateProjectViewInput {
  name?: string;
  description?: string | null;
  query?: string;
  criteria?: Record<string, unknown>;
  viewType?: ProjectViewType;
  isPublic?: boolean;
  isPinned?: boolean;
  isDefault?: boolean;
  scope?: ProjectViewScope;
}

function projectViewsPath({ projectId, teamId, includePublic }: ListProjectViewsInput): string {
  const params = new URLSearchParams();
  if (teamId) params.set('teamId', teamId);
  if (includePublic === false) params.set('includePublic', 'false');
  const query = params.toString();
  return `/api/projects/${encodeURIComponent(projectId)}/views${query ? `?${query}` : ''}`;
}

export const listProjectViews = (input: ListProjectViewsInput) =>
  apiJson<RawProjectViewsResponse>(projectViewsPath(input)).then((response) =>
    normalizeProjectViewsResponse(response),
  );

export const createProjectView = (projectId: string, input: CreateProjectViewInput) =>
  apiJson<{ view?: RawProjectView }>(`/api/projects/${encodeURIComponent(projectId)}/views`, {
    method: 'POST',
    body: JSON.stringify(input),
  }).then((response) => {
    const view = normalizeProjectView(response.view ?? {});
    if (!view) throw new Error(i18next.t('projectViews.errorGeneric'));
    return view;
  });

export const updateProjectView = (
  projectId: string,
  viewId: string,
  patch: UpdateProjectViewInput,
) =>
  apiJson<{ view?: RawProjectView }>(
    `/api/projects/${encodeURIComponent(projectId)}/views/${encodeURIComponent(viewId)}`,
    {
      method: 'PATCH',
      body: JSON.stringify(patch),
    },
  ).then((response) => {
    const view = normalizeProjectView(response.view ?? {});
    if (!view) throw new Error(i18next.t('projectViews.errorGeneric'));
    return view;
  });

export const deleteProjectView = (projectId: string, viewId: string) =>
  apiJson<{ success: boolean }>(
    `/api/projects/${encodeURIComponent(projectId)}/views/${encodeURIComponent(viewId)}`,
    { method: 'DELETE' },
  );

export const markProjectViewUsed = (viewId: string) =>
  apiJson<{ success?: boolean }>(`/api/saved-filters/${encodeURIComponent(viewId)}/use`, {
    method: 'POST',
  });

export interface ListConversationMessagesInput {
  roomId: string;
  before?: string | null;
  limit?: number;
}

export interface CreateConversationMessageInput {
  body: string;
  parentMessageId?: string | null;
}

export interface UpdateConversationMessageInput {
  body?: string;
  reactionEmoji?: string;
}

export interface CreateConversationCallTokenInput {
  clientSessionId?: string | null;
}

export interface LeaveConversationCallInput {
  participantIdentity?: string | null;
}

export interface PulseConversationCallInput {
  participantIdentity?: string | null;
}

export interface CreateProjectChatChannelInput {
  name: string;
  description?: string | null;
}

export interface UpdateProjectChatChannelInput {
  name?: string;
  description?: string | null;
  isArchived?: boolean;
}

function conversationMessagesPath({
  roomId,
  before,
  limit,
}: ListConversationMessagesInput): string {
  const params = new URLSearchParams();
  if (before) params.set('before', before);
  if (limit !== undefined) params.set('limit', String(limit));
  const query = params.toString();
  return `/api/conversations/${encodeURIComponent(roomId)}/messages${query ? `?${query}` : ''}`;
}

export const getProjectChatBootstrap = (projectId: string) =>
  apiJson<RawProjectChatBootstrap>(
    `/api/projects/${encodeURIComponent(projectId)}/chat/bootstrap`,
  ).then((response) => normalizeProjectChatBootstrap(response));

export const getProjectCommunicationsSettings = (projectId: string) =>
  apiJson<RawProjectCommunicationsSettingsResponse>(
    `/api/projects/${encodeURIComponent(projectId)}/communications`,
  ).then((response) => normalizeProjectCommunicationsResponse(response));

export const updateProjectCommunicationsSettings = (
  projectId: string,
  patch: UpdateProjectCommunicationsSettingsInput,
) =>
  apiJson<{ projectSettings?: RawProjectCommunicationsSettings }>(
    `/api/projects/${encodeURIComponent(projectId)}/communications`,
    {
      method: 'PATCH',
      body: JSON.stringify(patch),
    },
  ).then((response) => normalizeProjectCommunicationsSettings(response.projectSettings));

export const listConversationMessages = (input: ListConversationMessagesInput) =>
  apiJson<RawConversationMessagesPage>(conversationMessagesPath(input)).then((response) =>
    normalizeConversationMessagesPage(response),
  );

export const createConversationMessage = (roomId: string, input: CreateConversationMessageInput) =>
  apiJson<{ message?: RawConversationMessage }>(
    `/api/conversations/${encodeURIComponent(roomId)}/messages`,
    {
      method: 'POST',
      body: JSON.stringify({
        body: input.body,
        parentMessageId: input.parentMessageId ?? null,
      }),
    },
  ).then((response) => {
    const message = normalizeConversationMessage(response.message ?? {});
    if (!message) throw new Error(i18next.t('chat.errorGeneric'));
    return message;
  });

export const updateConversationMessage = (
  roomId: string,
  messageId: string,
  input: UpdateConversationMessageInput,
) =>
  apiJson<{ message?: RawConversationMessage | null }>(
    `/api/conversations/${encodeURIComponent(roomId)}/messages/${encodeURIComponent(messageId)}`,
    {
      method: 'PATCH',
      body: JSON.stringify(input),
    },
  ).then((response) => {
    if (!response.message) return null;
    return normalizeConversationMessage(response.message);
  });

export const deleteConversationMessage = (roomId: string, messageId: string) =>
  apiJson<{ success?: boolean; message?: RawConversationMessage | null }>(
    `/api/conversations/${encodeURIComponent(roomId)}/messages/${encodeURIComponent(messageId)}`,
    { method: 'DELETE' },
  ).then((response) => {
    if (!response.message) return null;
    return normalizeConversationMessage(response.message);
  });

export const markConversationRead = (roomId: string, lastReadMessageId?: string | null) =>
  apiJson<{ success?: boolean }>(`/api/conversations/${encodeURIComponent(roomId)}/read`, {
    method: 'POST',
    body: JSON.stringify({ lastReadMessageId: lastReadMessageId ?? null }),
  });

export const listLiveCalls = () =>
  apiJson<{ calls?: unknown }>('/api/chat/live-calls').then((response) =>
    Array.isArray(response.calls)
      ? response.calls
          .map((call) => normalizeGlobalLiveCall(call as RawGlobalLiveCall))
          .filter((call): call is GlobalLiveCall => call !== null)
      : [],
  );

export const startConversationCall = (roomId: string): Promise<ConversationCallStartResponse> =>
  apiJson<RawConversationCallStartResponse>(
    `/api/conversations/${encodeURIComponent(roomId)}/call/start`,
    { method: 'POST' },
  ).then((response) => {
    const output: ConversationCallStartResponse = {
      call: normalizeProjectChatActiveCall(response.call),
    };
    if (response.livekit) output.livekit = response.livekit;
    return output;
  });

export const endConversationCall = (roomId: string) =>
  apiJson<{ success?: boolean }>(`/api/conversations/${encodeURIComponent(roomId)}/call/end`, {
    method: 'POST',
  });

export const leaveConversationCall = (
  roomId: string,
  input: LeaveConversationCallInput = {},
): Promise<ConversationCallLeaveResponse> =>
  apiJson<RawConversationCallLeaveResponse>(
    `/api/conversations/${encodeURIComponent(roomId)}/call/leave`,
    {
      method: 'POST',
      body: JSON.stringify({ participantIdentity: input.participantIdentity ?? null }),
    },
  ).then((response) => ({
    success: response.success ?? true,
    call: normalizeProjectChatActiveCall(response.call),
  }));

export const pulseConversationCall = (
  roomId: string,
  input: PulseConversationCallInput = {},
): Promise<ConversationCallPulseResponse> =>
  apiJson<ConversationCallPulseResponse>(
    `/api/conversations/${encodeURIComponent(roomId)}/call/pulse`,
    {
      method: 'POST',
      body: JSON.stringify({ participantIdentity: input.participantIdentity ?? null }),
    },
  ).then((response) => ({
    success: response.success ?? true,
    result: response.result
      ? {
          callId: response.result.callId,
          roomId: response.result.roomId,
          touchedAt: String(response.result.touchedAt),
        }
      : null,
  }));

export const createConversationCallToken = (
  roomId: string,
  input: CreateConversationCallTokenInput = {},
) =>
  apiJson<RawConversationCallToken>(`/api/conversations/${encodeURIComponent(roomId)}/call/token`, {
    method: 'POST',
    body: JSON.stringify({ clientSessionId: input.clientSessionId ?? null }),
  }).then((response) => normalizeConversationCallToken(response));

export const createProjectChatChannel = (projectId: string, input: CreateProjectChatChannelInput) =>
  apiJson<RawProjectChannelMutationResponse>(
    `/api/projects/${encodeURIComponent(projectId)}/channels`,
    {
      method: 'POST',
      body: JSON.stringify(input),
    },
  ).then((response) => {
    const channel = normalizeProjectChannelMutationResponse(response);
    if (!channel) throw new Error(i18next.t('chat.channelErrorGeneric'));
    return channel;
  });

export const updateProjectChatChannel = (
  projectId: string,
  channelId: string,
  input: UpdateProjectChatChannelInput,
) =>
  apiJson<RawProjectChannelMutationResponse>(
    `/api/projects/${encodeURIComponent(projectId)}/channels/${encodeURIComponent(channelId)}`,
    {
      method: 'PATCH',
      body: JSON.stringify(input),
    },
  ).then((response) => {
    const channel = normalizeProjectChannelMutationResponse(response);
    if (!channel) throw new Error(i18next.t('chat.channelErrorGeneric'));
    return channel;
  });

export const deleteProjectChatChannel = (projectId: string, channelId: string) =>
  apiJson<{ success?: boolean }>(
    `/api/projects/${encodeURIComponent(projectId)}/channels/${encodeURIComponent(channelId)}`,
    { method: 'DELETE' },
  );

export const listProjectWorkflowStatuses = (projectId: string) =>
  apiJson<{ statuses?: RawWorkflowStatus[]; total?: number }>(
    `/api/projects/${encodeURIComponent(projectId)}/workflow-statuses`,
  ).then((response) =>
    (response.statuses ?? [])
      .map((status) => normalizeWorkflowStatus(status))
      .filter((status): status is WorkflowStatus => status !== null),
  );

export const listProjectWorkflowTransitions = (
  projectId: string,
): Promise<ProjectWorkflowTransitionsResponse> =>
  apiJson<{ statuses?: RawWorkflowStatus[]; transitions?: RawWorkflowTransition[] }>(
    `/api/projects/${encodeURIComponent(projectId)}/workflow-transitions`,
  ).then((response) => ({
    statuses: (response.statuses ?? [])
      .map((status) => normalizeWorkflowStatus(status))
      .filter((status): status is WorkflowStatus => status !== null),
    transitions: (response.transitions ?? [])
      .map((transition) => normalizeWorkflowTransition(transition))
      .filter((transition): transition is WorkflowTransition => transition !== null),
  }));

export interface UpdateProjectWorkflowTransitionInput {
  fromStatusId: string;
  toStatusId: string;
}

export const updateProjectWorkflowTransitions = (
  projectId: string,
  transitions: UpdateProjectWorkflowTransitionInput[],
) =>
  apiJson<{ transitions?: RawWorkflowTransition[] }>(
    `/api/projects/${encodeURIComponent(projectId)}/workflow-transitions`,
    {
      method: 'PUT',
      body: JSON.stringify({ transitions }),
    },
  ).then((response) =>
    (response.transitions ?? [])
      .map((transition) => normalizeWorkflowTransition(transition))
      .filter((transition): transition is WorkflowTransition => transition !== null),
  );

export interface ListCustomFieldsInput {
  organizationId: string;
  projectId?: string | null | undefined;
}

export type ManageableCustomFieldType =
  | 'text'
  | 'number'
  | 'date'
  | 'select'
  | 'multi_select'
  | 'checkbox'
  | 'url'
  | 'email';

export interface CreateCustomFieldInput {
  organizationId: string;
  projectId?: string | null | undefined;
  name: string;
  description?: string | null | undefined;
  type: ManageableCustomFieldType;
  isRequired?: boolean;
  defaultValue?: string | null | undefined;
  options?: string | null | undefined;
}

export interface UpdateCustomFieldInput {
  name?: string;
  description?: string | null | undefined;
  isRequired?: boolean;
  defaultValue?: string | null | undefined;
  options?: string | null | undefined;
  position?: number;
  isActive?: boolean;
}

function customFieldCreateBody(input: CreateCustomFieldInput) {
  return {
    ...input,
    projectId: input.projectId ?? undefined,
    description: input.description ?? undefined,
    defaultValue: input.defaultValue ?? undefined,
    options: input.options ?? undefined,
  };
}

function customFieldUpdateBody(patch: UpdateCustomFieldInput) {
  return {
    ...patch,
    description: patch.description === null ? '' : patch.description,
    defaultValue: patch.defaultValue === null ? '' : patch.defaultValue,
    options: patch.options === null ? '' : patch.options,
  };
}

export const listCustomFields = ({ organizationId, projectId }: ListCustomFieldsInput) => {
  const params = new URLSearchParams({ organizationId });
  if (projectId) params.append('projectId', projectId);
  return apiJson<{ customFields?: RawCustomField[]; total?: number }>(
    `/api/custom-fields?${params.toString()}`,
  ).then((response) =>
    (response.customFields ?? [])
      .map((field) => normalizeCustomField(field))
      .filter((field): field is CustomField => field !== null),
  );
};

export const createCustomField = (input: CreateCustomFieldInput) =>
  apiJson<RawCustomField>('/api/custom-fields', {
    method: 'POST',
    body: JSON.stringify(customFieldCreateBody(input)),
  }).then((response) => {
    const field = normalizeCustomField(response);
    if (!field) throw new Error(i18next.t('settings.customFields.error_generic'));
    return field;
  });

export const updateCustomField = (fieldId: string, patch: UpdateCustomFieldInput) =>
  apiJson<RawCustomField>(`/api/custom-fields/${encodeURIComponent(fieldId)}`, {
    method: 'PATCH',
    body: JSON.stringify(customFieldUpdateBody(patch)),
  }).then((response) => {
    const field = normalizeCustomField(response);
    if (!field) throw new Error(i18next.t('settings.customFields.error_generic'));
    return field;
  });

export const deleteCustomField = (fieldId: string) =>
  apiJson<{ message?: string }>(`/api/custom-fields/${encodeURIComponent(fieldId)}`, {
    method: 'DELETE',
  });

export interface CreateProjectComponentInput {
  name: string;
  description?: string | null;
  leadId?: string | null;
  defaultAssigneeType?: ComponentDefaultAssigneeType;
}

export interface UpdateProjectComponentInput {
  name?: string;
  description?: string | null;
  leadId?: string | null;
  defaultAssigneeType?: ComponentDefaultAssigneeType;
  archived?: boolean;
}

export const createProjectComponent = (projectId: string, input: CreateProjectComponentInput) =>
  apiJson<{ component?: RawProjectComponent }>(
    `/api/projects/${encodeURIComponent(projectId)}/components`,
    {
      method: 'POST',
      body: JSON.stringify(input),
    },
  ).then((response) => {
    const component = normalizeProjectComponent(response.component ?? {});
    if (!component) throw new Error(i18next.t('settings.components.error_generic'));
    return component;
  });

export const updateProjectComponent = (
  projectId: string,
  componentId: string,
  patch: UpdateProjectComponentInput,
) =>
  apiJson<{ component?: RawProjectComponent }>(
    `/api/projects/${encodeURIComponent(projectId)}/components/${encodeURIComponent(componentId)}`,
    {
      method: 'PATCH',
      body: JSON.stringify(patch),
    },
  ).then((response) => {
    const component = normalizeProjectComponent(response.component ?? {});
    if (!component) throw new Error(i18next.t('settings.components.error_generic'));
    return component;
  });

export const deleteProjectComponent = (projectId: string, componentId: string) =>
  apiJson<{ success: boolean }>(
    `/api/projects/${encodeURIComponent(projectId)}/components/${encodeURIComponent(componentId)}`,
    { method: 'DELETE' },
  );

export const listProjectVersions = (projectId: string) =>
  apiJson<{ versions?: RawProjectVersion[]; total?: number }>(
    `/api/projects/${encodeURIComponent(projectId)}/versions`,
  ).then((response) =>
    (response.versions ?? [])
      .map((version) => normalizeProjectVersion(version))
      .filter((version): version is ProjectVersion => version !== null),
  );

export interface CreateProjectVersionInput {
  name: string;
  description?: string | null;
  startDate?: string | null;
  releaseDate?: string | null;
}

export interface UpdateProjectVersionInput {
  name?: string;
  description?: string | null;
  startDate?: string | null;
  releaseDate?: string | null;
  status?: ProjectVersionStatus;
  sortOrder?: number;
}

export interface ReleaseProjectVersionInput {
  moveOpenIssuesToVersionId?: string;
}

export const createProjectVersion = (projectId: string, input: CreateProjectVersionInput) =>
  apiJson<{ version?: RawProjectVersion }>(
    `/api/projects/${encodeURIComponent(projectId)}/versions`,
    {
      method: 'POST',
      body: JSON.stringify(input),
    },
  ).then((response) => {
    const version = normalizeProjectVersion(response.version ?? {});
    if (!version) throw new Error(i18next.t('settings.versions.error_generic'));
    return version;
  });

export const updateProjectVersion = (
  projectId: string,
  versionId: string,
  patch: UpdateProjectVersionInput,
) =>
  apiJson<{ version?: RawProjectVersion }>(
    `/api/projects/${encodeURIComponent(projectId)}/versions/${encodeURIComponent(versionId)}`,
    {
      method: 'PATCH',
      body: JSON.stringify(patch),
    },
  ).then((response) => {
    const version = normalizeProjectVersion(response.version ?? {});
    if (!version) throw new Error(i18next.t('settings.versions.error_generic'));
    return version;
  });

export const releaseProjectVersion = (
  projectId: string,
  versionId: string,
  input: ReleaseProjectVersionInput = {},
) =>
  apiJson<{ version?: RawProjectVersion; movedIssueCount?: number }>(
    `/api/projects/${encodeURIComponent(projectId)}/versions/${encodeURIComponent(versionId)}/release`,
    {
      method: 'POST',
      body: JSON.stringify(input),
    },
  ).then((response) => {
    const version = normalizeProjectVersion(response.version ?? {});
    if (!version) throw new Error(i18next.t('settings.versions.error_generic'));
    return version;
  });

export const deleteProjectVersion = (projectId: string, versionId: string) =>
  apiJson<{ success: boolean }>(
    `/api/projects/${encodeURIComponent(projectId)}/versions/${encodeURIComponent(versionId)}`,
    { method: 'DELETE' },
  );

export interface CreatePermissionSchemeInput {
  organizationId: string;
  name: string;
  description?: string | null;
  baseRole?: ProjectRole | null;
  isDefault?: boolean;
}

export interface UpdatePermissionSchemeInput {
  schemeId: string;
  name?: string;
  description?: string | null;
  isDefault?: boolean;
}

export const listPermissionSchemes = (organizationId: string) =>
  apiJson<RawPermissionScheme[]>(
    `/api/permission-schemes?organizationId=${encodeURIComponent(organizationId)}`,
  ).then((response) =>
    response
      .map((scheme) => normalizePermissionScheme(scheme))
      .filter((scheme): scheme is PermissionScheme => scheme !== null),
  );

export const createPermissionScheme = ({
  organizationId,
  name,
  description,
  baseRole,
  isDefault,
}: CreatePermissionSchemeInput) =>
  apiJson<RawPermissionScheme>('/api/permission-schemes', {
    method: 'POST',
    body: JSON.stringify({
      organizationId,
      name,
      description: description || undefined,
      baseRole: baseRole || undefined,
      isDefault: isDefault === true,
    }),
  }).then((response) => {
    const scheme = normalizePermissionScheme(response);
    if (!scheme) throw new Error(i18next.t('settings.permissionSchemes.error_generic'));
    return scheme;
  });

export const updatePermissionScheme = ({ schemeId, ...patch }: UpdatePermissionSchemeInput) =>
  apiJson<RawPermissionScheme>(`/api/permission-schemes/${encodeURIComponent(schemeId)}`, {
    method: 'PATCH',
    body: JSON.stringify({
      ...patch,
      description: patch.description === null ? null : patch.description,
    }),
  }).then((response) => {
    const scheme = normalizePermissionScheme(response);
    if (!scheme) throw new Error(i18next.t('settings.permissionSchemes.error_generic'));
    return scheme;
  });

export const deletePermissionScheme = (schemeId: string) =>
  apiJson<{ success?: boolean }>(`/api/permission-schemes/${encodeURIComponent(schemeId)}`, {
    method: 'DELETE',
  });

export const getProjectPermissionScheme = (projectId: string) =>
  apiJson<RawProjectPermissionSchemeState>(
    `/api/projects/${encodeURIComponent(projectId)}/permission-scheme`,
  ).then((response) => normalizeProjectPermissionSchemeState(response));

export const assignProjectPermissionScheme = (projectId: string, schemeId: string | null) =>
  apiJson<RawProjectPermissionSchemeState>(
    `/api/projects/${encodeURIComponent(projectId)}/permission-scheme`,
    {
      method: 'PATCH',
      body: JSON.stringify({ schemeId }),
    },
  ).then((response) => normalizeProjectPermissionSchemeState(response));

export interface CreateSecuritySchemeInput {
  organizationId: string;
  name: string;
  description?: string | null;
  isDefault?: boolean;
}

export interface UpdateSecuritySchemeInput {
  schemeId: string;
  name?: string;
  description?: string | null;
  isDefault?: boolean;
}

export interface SecurityLevelMemberInput {
  type: SecurityLevelMemberType;
  value?: string | null;
}

export interface CreateSecurityLevelInput {
  schemeId: string;
  name: string;
  description?: string | null;
  isDefault?: boolean;
  members: SecurityLevelMemberInput[];
}

export interface UpdateSecurityLevelInput {
  schemeId: string;
  levelId: string;
  name?: string;
  description?: string | null;
  isDefault?: boolean;
  members?: SecurityLevelMemberInput[];
}

export const listSecuritySchemes = (organizationId: string) =>
  apiJson<RawSecurityScheme[]>(
    `/api/security-schemes?organizationId=${encodeURIComponent(organizationId)}`,
  ).then((response) =>
    response
      .map((scheme) => normalizeSecurityScheme(scheme))
      .filter((scheme): scheme is SecurityScheme => scheme !== null),
  );

export const createSecurityScheme = ({
  organizationId,
  name,
  description,
  isDefault,
}: CreateSecuritySchemeInput) =>
  apiJson<RawSecurityScheme>('/api/security-schemes', {
    method: 'POST',
    body: JSON.stringify({
      organizationId,
      name,
      description: description || undefined,
      isDefault: isDefault === true,
    }),
  }).then((response) => {
    const scheme = normalizeSecurityScheme(response);
    if (!scheme) throw new Error(i18next.t('settings.securitySchemes.error_generic'));
    return scheme;
  });

export const updateSecurityScheme = ({ schemeId, ...patch }: UpdateSecuritySchemeInput) =>
  apiJson<RawSecurityScheme>(`/api/security-schemes/${encodeURIComponent(schemeId)}`, {
    method: 'PATCH',
    body: JSON.stringify({
      ...patch,
      description: patch.description === null ? null : patch.description,
    }),
  }).then((response) => {
    const scheme = normalizeSecurityScheme(response);
    if (!scheme) throw new Error(i18next.t('settings.securitySchemes.error_generic'));
    return scheme;
  });

export const deleteSecurityScheme = (schemeId: string) =>
  apiJson<{ success?: boolean }>(`/api/security-schemes/${encodeURIComponent(schemeId)}`, {
    method: 'DELETE',
  });

export const getProjectSecurityScheme = (projectId: string) =>
  apiJson<RawProjectSecuritySchemeState>(
    `/api/projects/${encodeURIComponent(projectId)}/security-scheme`,
  ).then((response) => normalizeProjectSecuritySchemeState(response));

export const assignProjectSecurityScheme = (projectId: string, schemeId: string | null) =>
  apiJson<RawProjectSecuritySchemeState>(
    `/api/projects/${encodeURIComponent(projectId)}/security-scheme`,
    {
      method: 'PATCH',
      body: JSON.stringify({ schemeId }),
    },
  ).then((response) => normalizeProjectSecuritySchemeState(response));

const serializeSecurityMembers = (members: SecurityLevelMemberInput[]) =>
  members.map((member) => ({
    type: member.type,
    value: member.value || undefined,
  }));

export const createSecurityLevel = ({
  schemeId,
  name,
  description,
  isDefault,
  members,
}: CreateSecurityLevelInput) =>
  apiJson<RawSecurityLevel>(`/api/security-schemes/${encodeURIComponent(schemeId)}/levels`, {
    method: 'POST',
    body: JSON.stringify({
      name,
      description: description || null,
      isDefault: isDefault === true,
      members: serializeSecurityMembers(members),
    }),
  }).then((response) => {
    const level = normalizeSecurityLevel(response);
    if (!level) throw new Error(i18next.t('settings.securitySchemes.error_generic'));
    return level;
  });

export const updateSecurityLevel = ({
  schemeId,
  levelId,
  members,
  ...patch
}: UpdateSecurityLevelInput) =>
  apiJson<RawSecurityLevel>(
    `/api/security-schemes/${encodeURIComponent(schemeId)}/levels/${encodeURIComponent(levelId)}`,
    {
      method: 'PATCH',
      body: JSON.stringify({
        ...patch,
        description: patch.description === null ? null : patch.description,
        members: members ? serializeSecurityMembers(members) : undefined,
      }),
    },
  ).then((response) => {
    const level = normalizeSecurityLevel(response);
    if (!level) throw new Error(i18next.t('settings.securitySchemes.error_generic'));
    return level;
  });

export const deleteSecurityLevel = (schemeId: string, levelId: string) =>
  apiJson<{ success?: boolean }>(
    `/api/security-schemes/${encodeURIComponent(schemeId)}/levels/${encodeURIComponent(levelId)}`,
    { method: 'DELETE' },
  );

export interface ListAutomationRulesInput {
  organizationId: string;
  projectId?: string | null;
}

export interface CreateAutomationRuleInput extends ListAutomationRulesInput {
  name: string;
  description?: string | null;
  enabled?: boolean;
  trigger: AutomationRuleTrigger;
  conditions?: Array<Record<string, unknown>>;
  actions: AutomationRuleAction[];
}

export interface UpdateAutomationRuleInput {
  ruleId: string;
  name?: string;
  description?: string | null;
  enabled?: boolean;
  trigger?: AutomationRuleTrigger;
  conditions?: Array<Record<string, unknown>>;
  actions?: AutomationRuleAction[];
}

export const listAutomationRules = ({ organizationId, projectId }: ListAutomationRulesInput) => {
  const params = new URLSearchParams({ organizationId });
  if (projectId) params.set('projectId', projectId);
  return apiJson<RawAutomationRule[]>(`/api/automation-rules?${params.toString()}`).then(
    (response) =>
      response
        .map((rule) => normalizeAutomationRule(rule))
        .filter((rule): rule is AutomationRule => rule !== null),
  );
};

export const createAutomationRule = ({
  organizationId,
  projectId,
  name,
  description,
  enabled,
  trigger,
  conditions,
  actions,
}: CreateAutomationRuleInput) =>
  apiJson<RawAutomationRule>('/api/automation-rules', {
    method: 'POST',
    body: JSON.stringify({
      organizationId,
      projectId: projectId || null,
      name,
      description: description || null,
      enabled: enabled ?? true,
      trigger,
      conditions: conditions ?? [],
      actions,
    }),
  }).then((response) => {
    const rule = normalizeAutomationRule(response);
    if (!rule) throw new Error(i18next.t('settings.automation.error_generic'));
    return rule;
  });

export const updateAutomationRule = ({ ruleId, ...patch }: UpdateAutomationRuleInput) =>
  apiJson<RawAutomationRule>(`/api/automation-rules/${encodeURIComponent(ruleId)}`, {
    method: 'PATCH',
    body: JSON.stringify({
      ...patch,
      description: patch.description === null ? null : patch.description,
    }),
  }).then((response) => {
    const rule = normalizeAutomationRule(response);
    if (!rule) throw new Error(i18next.t('settings.automation.error_generic'));
    return rule;
  });

export const deleteAutomationRule = (ruleId: string) =>
  apiJson<{ success?: boolean }>(`/api/automation-rules/${encodeURIComponent(ruleId)}`, {
    method: 'DELETE',
  });

export const listAutomationExecutions = (ruleId: string, limit = 50) =>
  apiJson<RawAutomationExecution[]>(
    `/api/automation-rules/${encodeURIComponent(ruleId)}/executions?limit=${encodeURIComponent(
      String(limit),
    )}`,
  ).then((response) =>
    response
      .map((execution) => normalizeAutomationExecution(execution))
      .filter((execution): execution is AutomationExecution => execution !== null),
  );

export const listProjectMembers = (projectId: string) =>
  apiJson<RawProjectMember[] | { members?: RawProjectMember[] }>(
    `/api/projects/${encodeURIComponent(projectId)}/members`,
  ).then((r) =>
    (Array.isArray(r) ? r : (r.members ?? []))
      .map((member) => normalizeProjectMember(member))
      .filter((member): member is ProjectMember => member !== null),
  );

export interface AddProjectMemberInput {
  projectId: string;
  userId: string;
  role: ProjectRole;
}

export interface UpdateProjectMemberInput {
  projectId: string;
  memberId: string;
  role?: ProjectRole | null;
  permissions?: Record<string, boolean>;
  resetToDefaults?: boolean;
}

export const addProjectMember = ({ projectId, userId, role }: AddProjectMemberInput) =>
  apiJson<unknown>(`/api/projects/${encodeURIComponent(projectId)}/members`, {
    method: 'POST',
    body: JSON.stringify({ userId, role }),
  });

export const updateProjectMember = ({
  projectId,
  memberId,
  role,
  permissions,
  resetToDefaults,
}: UpdateProjectMemberInput) =>
  apiJson<unknown>(
    `/api/projects/${encodeURIComponent(projectId)}/members/${encodeURIComponent(memberId)}`,
    {
      method: 'PATCH',
      body: JSON.stringify({
        role,
        permissions,
        resetToDefaults: resetToDefaults === true,
      }),
    },
  );

export const removeProjectMember = (projectId: string, memberId: string) =>
  apiJson<unknown>(
    `/api/projects/${encodeURIComponent(projectId)}/members/${encodeURIComponent(memberId)}`,
    { method: 'DELETE' },
  );

export interface CreateProjectInviteLinkInput {
  projectId: string;
  role: ProjectRole;
  expiresInDays?: number;
  maxUses?: number;
}

export interface ProjectInviteLinkCreateResult {
  link: ProjectInviteLink | null;
  inviteUrl: string | null;
}

export const listProjectInviteLinks = (projectId: string) =>
  apiJson<{ links?: RawProjectInviteLink[] }>(
    `/api/projects/${encodeURIComponent(projectId)}/invite-links`,
  ).then((response) =>
    (response.links ?? [])
      .map((link) => normalizeProjectInviteLink(link))
      .filter((link): link is ProjectInviteLink => link !== null),
  );

export const createProjectInviteLink = ({
  projectId,
  role,
  expiresInDays,
  maxUses,
}: CreateProjectInviteLinkInput) =>
  apiJson<{ link?: RawProjectInviteLink; inviteUrl?: unknown }>(
    `/api/projects/${encodeURIComponent(projectId)}/invite-links`,
    {
      method: 'POST',
      body: JSON.stringify({ role, expiresInDays, maxUses }),
    },
  ).then(
    (response): ProjectInviteLinkCreateResult => ({
      link: response.link ? normalizeProjectInviteLink(response.link) : null,
      inviteUrl: typeof response.inviteUrl === 'string' ? response.inviteUrl : null,
    }),
  );

export const revokeProjectInviteLink = (projectId: string, linkId: string) =>
  apiJson<{ link?: RawProjectInviteLink }>(
    `/api/projects/${encodeURIComponent(projectId)}/invite-links/${encodeURIComponent(linkId)}`,
    { method: 'DELETE' },
  ).then((response) => (response.link ? normalizeProjectInviteLink(response.link) : null));

export const listIntakeForms = (projectId?: string | null) => {
  const params = new URLSearchParams();
  if (projectId) params.set('projectId', projectId);
  const suffix = params.toString() ? `?${params.toString()}` : '';
  return apiJson<{ forms?: RawIntakeForm[] }>(`/api/intake-forms${suffix}`).then((response) =>
    (response.forms ?? [])
      .map((form) => normalizeIntakeForm(form))
      .filter((form): form is IntakeForm => form !== null),
  );
};

export const getIntakeForm = (formId: string) =>
  apiJson<{ form?: RawIntakeForm }>(`/api/intake-forms/${encodeURIComponent(formId)}`).then(
    (response) => {
      const form = normalizeIntakeForm(response.form ?? {});
      if (!form) throw new Error(i18next.t('intakeForms.errorInvalidResponse'));
      return form;
    },
  );

export interface CreateIntakeFormInput {
  projectId: string;
  slug: string;
  title: string;
  description?: string | null;
  fields: IntakeFieldDefinition[];
  isPublic?: boolean;
  requiresCaptcha?: boolean;
  targetStatus?: string;
  autoAssignUserId?: string | null;
  customStyling?: Record<string, unknown>;
}

export const createIntakeForm = (input: CreateIntakeFormInput) =>
  apiJson<{ form?: RawIntakeForm }>('/api/intake-forms', {
    method: 'POST',
    body: JSON.stringify(input),
  }).then((response) => {
    const form = normalizeIntakeForm(response.form ?? {});
    if (!form) throw new Error(i18next.t('intakeForms.errorInvalidResponse'));
    return form;
  });

export interface UpdateIntakeFormInput {
  formId: string;
  slug?: string;
  title?: string;
  description?: string | null;
  fields?: IntakeFieldDefinition[];
  isPublic?: boolean;
  requiresCaptcha?: boolean;
  targetStatus?: string;
  autoAssignUserId?: string | null;
  customStyling?: Record<string, unknown>;
}

export const updateIntakeForm = ({ formId, ...patch }: UpdateIntakeFormInput) =>
  apiJson<{ form?: RawIntakeForm }>(`/api/intake-forms/${encodeURIComponent(formId)}`, {
    method: 'PATCH',
    body: JSON.stringify(patch),
  }).then((response) => {
    const form = normalizeIntakeForm(response.form ?? {});
    if (!form) throw new Error(i18next.t('intakeForms.errorInvalidResponse'));
    return form;
  });

export const deleteIntakeForm = (formId: string) =>
  apiJson<{ success: boolean }>(`/api/intake-forms/${encodeURIComponent(formId)}`, {
    method: 'DELETE',
  });

export const getPublicIntakeForm = (slug: string) =>
  apiJson<{
    form?: RawPublicIntakeForm;
    captchaConfigured?: boolean;
  }>(`/api/public/intake/${encodeURIComponent(slug)}`).then(
    (response): PublicIntakeFormResponse => {
      const form = normalizePublicIntakeForm(response.form ?? {});
      if (!form) throw new Error(i18next.t('intakeForms.errorInvalidResponse'));
      return {
        form,
        captchaConfigured: response.captchaConfigured === true,
      };
    },
  );

export const submitPublicIntakeForm = (
  slug: string,
  input: { payload: Record<string, unknown>; captchaToken?: string | null },
) =>
  apiJson<SubmitPublicIntakeResult>(`/api/public/intake/${encodeURIComponent(slug)}`, {
    method: 'POST',
    body: JSON.stringify({
      payload: input.payload,
      ...(input.captchaToken ? { captchaToken: input.captchaToken } : {}),
    }),
  });

export type ImportPreviewInput = Record<string, unknown>;

export const previewImport = (source: ImportSource, input: ImportPreviewInput) =>
  apiJson<RawImportPreviewResponse>(`/api/import/${encodeURIComponent(source)}/preview`, {
    method: 'POST',
    body: JSON.stringify(input),
  }).then((response) => normalizeImportPreviewResponse(response));

export interface RunImportInput {
  workspaceId: string;
  projectId: string;
  mapping: {
    columns?: Record<string, string>;
    config?: Record<string, unknown>;
  };
  csvText?: string;
}

export const runImport = (source: ImportSource, input: RunImportInput) =>
  apiJson<RawImportRunResponse>(`/api/import/${encodeURIComponent(source)}/run`, {
    method: 'POST',
    body: JSON.stringify(input),
  }).then((response) => normalizeImportRunResponse(response));

export const getImportJob = (jobId: string) =>
  apiJson<RawImportJobStatus>(`/api/import/jobs/${encodeURIComponent(jobId)}`).then((response) =>
    normalizeImportJobStatus(response),
  );

export interface UpsertSsoConfigInput {
  organizationId: string;
  provider?: SsoProvider;
  entryPointUrl: string;
  issuer: string;
  cert: string;
  privateKey?: string | null;
  audience: string;
  attributeMap: Record<string, string>;
  enabled: boolean;
}

export const getSsoConfig = (organizationId: string) =>
  apiJson<RawSsoConfigResponse>(
    `/api/sso/configs?organizationId=${encodeURIComponent(organizationId)}`,
  ).then((response) => normalizeSsoConfigResponse(response));

export const upsertSsoConfig = (input: UpsertSsoConfigInput) =>
  apiJson<{ ok?: boolean }>('/api/sso/configs', {
    method: 'POST',
    body: JSON.stringify({
      ...input,
      provider: input.provider ?? 'saml',
    }),
  });

export const deleteSsoConfig = (organizationId: string) =>
  apiJson<{ ok?: boolean }>(
    `/api/sso/configs?organizationId=${encodeURIComponent(organizationId)}`,
    {
      method: 'DELETE',
    },
  );

export interface CreateScimTokenInput {
  organizationId: string;
  name: string;
}

export const listScimTokens = (organizationId: string) =>
  apiJson<RawScimTokensResponse>(
    `/api/sso/tokens?organizationId=${encodeURIComponent(organizationId)}`,
  ).then((response) => normalizeScimTokensResponse(response));

export const createScimToken = (input: CreateScimTokenInput) =>
  apiJson<RawCreatedScimToken>('/api/sso/tokens', {
    method: 'POST',
    body: JSON.stringify(input),
  }).then((response) => normalizeCreatedScimToken(response));

export const revokeScimToken = (tokenId: string) =>
  apiJson<{ ok?: boolean }>(`/api/sso/tokens/${encodeURIComponent(tokenId)}`, {
    method: 'DELETE',
  });

export interface CreateAuditLogSinkInput {
  organizationId: string;
  type: AuditLogSinkType;
  name: string;
  config: Record<string, unknown>;
  enabled?: boolean;
}

export interface UpdateAuditLogSinkInput {
  sinkId: string;
  name?: string;
  config?: Record<string, unknown>;
  enabled?: boolean;
}

export const listAuditLogSinks = (organizationId: string) =>
  apiJson<RawAuditLogSinksResponse>(
    `/api/admin/audit-log-sinks?organizationId=${encodeURIComponent(organizationId)}`,
  ).then((response) => normalizeAuditLogSinksResponse(response));

export const createAuditLogSink = (input: CreateAuditLogSinkInput) =>
  apiJson<RawAuditLogSinkResponse>('/api/admin/audit-log-sinks', {
    method: 'POST',
    body: JSON.stringify(input),
  }).then((response) => normalizeCreatedAuditLogSink(response.sink ?? {}));

export const updateAuditLogSink = ({ sinkId, ...patch }: UpdateAuditLogSinkInput) =>
  apiJson<RawAuditLogSinkResponse>(`/api/admin/audit-log-sinks/${encodeURIComponent(sinkId)}`, {
    method: 'PATCH',
    body: JSON.stringify(patch),
  }).then((response) => normalizeAuditLogSinkResponse(response));

export const deleteAuditLogSink = (sinkId: string) =>
  apiJson<{ ok?: boolean }>(`/api/admin/audit-log-sinks/${encodeURIComponent(sinkId)}`, {
    method: 'DELETE',
  });

export const testAuditLogSink = (sinkId: string) =>
  apiJson<RawAuditLogSinkTestResponse>(
    `/api/admin/audit-log-sinks/${encodeURIComponent(sinkId)}/test`,
    { method: 'POST' },
  ).then((response) => normalizeAuditLogSinkTestResponse(response));

export const listLabels = ({
  organizationId,
  projectId,
  q: search,
}: {
  organizationId: string;
  projectId?: string;
  q?: string;
}) => {
  const params = new URLSearchParams({ organizationId });
  if (projectId) params.set('projectId', projectId);
  if (search) params.set('q', search);
  return apiJson<{ labels?: RawLabel[] }>(`/api/labels?${params.toString()}`).then((r) =>
    (r.labels ?? [])
      .map((label) => normalizeLabel(label))
      .filter((label): label is Label => label !== null),
  );
};

export interface CreateLabelInput {
  organizationId: string;
  projectId?: string | null;
  name: string;
  color?: string;
  description?: string | null;
}

export const createLabel = (input: CreateLabelInput) =>
  apiJson<RawLabel>('/api/labels', {
    method: 'POST',
    body: JSON.stringify(input),
  }).then((raw) => {
    const label = normalizeLabel(raw);
    if (!label) throw new Error(i18next.t('settings.labels.errorInvalidResponse'));
    return label;
  });

export interface UpdateLabelInput {
  labelId: string;
  name?: string;
  color?: string;
  description?: string | null;
}

export const updateLabel = ({ labelId, ...patch }: UpdateLabelInput) =>
  apiJson<RawLabel>(`/api/labels/${encodeURIComponent(labelId)}`, {
    method: 'PATCH',
    body: JSON.stringify(patch),
  }).then((raw) => {
    const label = normalizeLabel(raw);
    if (!label) throw new Error(i18next.t('settings.labels.errorInvalidResponse'));
    return label;
  });

export const deleteLabel = (labelId: string) =>
  apiJson<{ success?: boolean; id?: string }>(`/api/labels/${encodeURIComponent(labelId)}`, {
    method: 'DELETE',
  });

export const listOrganizations = () =>
  apiJson<{ canCreateOrganizations?: boolean; organizations?: RawOrganization[] }>(
    '/api/organizations',
  ).then(
    (response): OrganizationsResponse => ({
      canCreateOrganizations: response.canCreateOrganizations ?? false,
      organizations: (response.organizations ?? [])
        .map((organization) => normalizeOrganization(organization))
        .filter((organization): organization is Organization => organization !== null),
    }),
  );

export const getOrganization = (organizationId: string) =>
  apiJson<RawOrganization>(`/api/organizations/${encodeURIComponent(organizationId)}`).then(
    (raw) => {
      const organization = normalizeOrganization(raw);
      if (!organization) throw new Error(i18next.t('organization.errorInvalidResponse'));
      return organization;
    },
  );

export interface UpdateOrganizationInput {
  organizationId: string;
  name?: string;
  slug?: string;
  domain?: string;
  logoUrl?: string;
}

export const updateOrganization = ({ organizationId, ...patch }: UpdateOrganizationInput) =>
  apiJson<RawOrganization>(`/api/organizations/${encodeURIComponent(organizationId)}`, {
    method: 'PATCH',
    body: JSON.stringify(patch),
  }).then((raw) => {
    const organization = normalizeOrganization(raw);
    if (!organization) throw new Error(i18next.t('organization.errorInvalidResponse'));
    return organization;
  });

export const deleteOrganization = (organizationId: string) =>
  apiJson<{ success?: boolean }>(`/api/organizations/${encodeURIComponent(organizationId)}`, {
    method: 'DELETE',
  });

export const listTeamspaces = (organizationId: string) =>
  apiJson<{ teams?: RawTeamspace[] }>(
    `/api/organizations/${encodeURIComponent(organizationId)}/teams`,
  ).then((response) =>
    (response.teams ?? [])
      .map((teamspace) => normalizeTeamspace(teamspace))
      .filter((teamspace): teamspace is Teamspace => teamspace !== null),
  );

export interface CreateTeamspaceInput {
  name: string;
  slug?: string;
  description?: string;
  avatarUrl?: string;
  leadId?: string | null;
}

export const createTeamspace = (organizationId: string, input: CreateTeamspaceInput) =>
  apiJson<{ team?: RawTeamspace }>(
    `/api/organizations/${encodeURIComponent(organizationId)}/teams`,
    {
      method: 'POST',
      body: JSON.stringify(input),
    },
  ).then((response) => {
    const teamspace = normalizeTeamspace(response.team ?? {});
    if (!teamspace) throw new Error(i18next.t('organization.teamspaces.errorInvalidResponse'));
    return teamspace;
  });

export interface UpdateTeamspaceInput {
  teamspaceId: string;
  name?: string;
  slug?: string;
  description?: string;
  avatarUrl?: string;
  leadId?: string | null;
}

export const updateTeamspace = (
  organizationId: string,
  { teamspaceId, ...patch }: UpdateTeamspaceInput,
) =>
  apiJson<{ team?: RawTeamspace }>(
    `/api/organizations/${encodeURIComponent(organizationId)}/teams/${encodeURIComponent(teamspaceId)}`,
    {
      method: 'PATCH',
      body: JSON.stringify(patch),
    },
  ).then((response) => {
    const teamspace = normalizeTeamspace(response.team ?? {});
    if (!teamspace) throw new Error(i18next.t('organization.teamspaces.errorInvalidResponse'));
    return teamspace;
  });

export const deleteTeamspace = (organizationId: string, teamspaceId: string) =>
  apiJson<{ success?: boolean }>(
    `/api/organizations/${encodeURIComponent(organizationId)}/teams/${encodeURIComponent(teamspaceId)}`,
    { method: 'DELETE' },
  );

export const listTeamspaceMembers = (organizationId: string, teamspaceId: string) =>
  apiJson<{ team?: RawTeamspace; members?: RawTeamspaceMember[] }>(
    `/api/organizations/${encodeURIComponent(organizationId)}/teams/${encodeURIComponent(teamspaceId)}/members`,
  ).then(
    (response): TeamspaceMembersResponse => ({
      team: response.team ? normalizeTeamspace(response.team) : null,
      members: (response.members ?? [])
        .map((member) => normalizeTeamspaceMember(member))
        .filter((member): member is TeamspaceMember => member !== null),
    }),
  );

export interface AddTeamspaceMemberInput {
  userId: string;
  role: 'lead' | 'member';
}

export const addTeamspaceMember = (
  organizationId: string,
  teamspaceId: string,
  input: AddTeamspaceMemberInput,
) =>
  apiJson<{ member?: RawTeamspaceMember }>(
    `/api/organizations/${encodeURIComponent(organizationId)}/teams/${encodeURIComponent(teamspaceId)}/members`,
    {
      method: 'POST',
      body: JSON.stringify(input),
    },
  ).then((response) => {
    const member = normalizeTeamspaceMember(response.member ?? {});
    if (!member) throw new Error(i18next.t('organization.teamspaces.members.errorInvalidResponse'));
    return member;
  });

export interface UpdateTeamspaceMemberInput {
  memberId: string;
  role: 'lead' | 'member';
}

export const updateTeamspaceMember = (
  organizationId: string,
  teamspaceId: string,
  { memberId, role }: UpdateTeamspaceMemberInput,
) =>
  apiJson<{ member?: RawTeamspaceMember }>(
    `/api/organizations/${encodeURIComponent(organizationId)}/teams/${encodeURIComponent(teamspaceId)}/members/${encodeURIComponent(memberId)}`,
    {
      method: 'PATCH',
      body: JSON.stringify({ role }),
    },
  ).then((response) => {
    const member = normalizeTeamspaceMember(response.member ?? {});
    if (!member) throw new Error(i18next.t('organization.teamspaces.members.errorInvalidResponse'));
    return member;
  });

export const removeTeamspaceMember = (
  organizationId: string,
  teamspaceId: string,
  memberId: string,
) =>
  apiJson<{ success?: boolean }>(
    `/api/organizations/${encodeURIComponent(organizationId)}/teams/${encodeURIComponent(teamspaceId)}/members/${encodeURIComponent(memberId)}`,
    { method: 'DELETE' },
  );

export const listOrganizationMembers = (organizationId: string) =>
  apiJson<{
    members?: RawOrganizationMember[];
    userRole?: string | null;
    isSuperAdmin?: boolean;
    registrationMode?: string;
  }>(`/api/organizations/${encodeURIComponent(organizationId)}/members`).then((r) => ({
    members: (r.members ?? [])
      .map((member) => normalizeOrganizationMember(member))
      .filter((member): member is OrganizationMember => member !== null),
    userRole: r.userRole ?? null,
    isSuperAdmin: r.isSuperAdmin ?? false,
    registrationMode: r.registrationMode,
  }));

export type OrganizationRole = 'owner' | 'admin' | 'member' | 'viewer' | 'guest';
export type ProjectAssignmentRole =
  | 'product_owner'
  | 'scrum_master'
  | 'tech_lead'
  | 'developer'
  | 'qa_engineer'
  | 'designer'
  | 'viewer';

export interface InviteOrganizationMemberInput {
  email: string;
  role: OrganizationRole;
  inviteExpiresInDays?: number;
  projectIds?: string[];
  projectRole?: ProjectAssignmentRole;
}

export interface InviteOrganizationMemberResponse {
  member: OrganizationMember;
  addedToProjects?: string[];
  skippedProjects?: string[];
  invitationResent?: boolean;
  inviteExpiresAt?: string | null;
  inviteExpiresInDays?: number | null;
}

export const inviteOrganizationMember = (
  organizationId: string,
  input: InviteOrganizationMemberInput,
) =>
  apiJson<InviteOrganizationMemberResponse>(
    `/api/organizations/${encodeURIComponent(organizationId)}/members`,
    {
      method: 'POST',
      body: JSON.stringify({
        email: input.email.trim().toLowerCase(),
        role: input.role,
        inviteExpiresInDays: input.inviteExpiresInDays,
        projectIds: input.projectIds,
        projectRole: input.projectRole,
      }),
    },
  ).then((response) => {
    const member = normalizeOrganizationMember(response.member);
    return {
      ...response,
      member: member ?? response.member,
    };
  });

export interface UpdateOrganizationMemberRoleInput {
  memberId: string;
  role: OrganizationRole;
}

export interface UpdateOrganizationMemberRoleResponse {
  member: OrganizationMember;
}

export const updateOrganizationMemberRole = (
  organizationId: string,
  { memberId, role }: UpdateOrganizationMemberRoleInput,
) =>
  apiJson<UpdateOrganizationMemberRoleResponse>(
    `/api/organizations/${encodeURIComponent(organizationId)}/members/${encodeURIComponent(memberId)}`,
    {
      method: 'PATCH',
      body: JSON.stringify({ role }),
    },
  ).then((response) => {
    const member = normalizeOrganizationMember(response.member);
    return {
      member: member ?? response.member,
    };
  });

export const removeOrganizationMember = (organizationId: string, memberId: string) =>
  apiJson<{ success: boolean }>(
    `/api/organizations/${encodeURIComponent(organizationId)}/members/${encodeURIComponent(memberId)}`,
    { method: 'DELETE' },
  );

export interface AssignOrganizationMemberProjectsInput {
  memberId: string;
  projectIds: string[];
  projectRole: ProjectAssignmentRole;
}

export interface AssignOrganizationMemberProjectsResponse {
  addedToProjects?: string[];
  skippedProjects?: string[];
}

export const assignOrganizationMemberProjects = (
  organizationId: string,
  input: AssignOrganizationMemberProjectsInput,
) =>
  apiJson<AssignOrganizationMemberProjectsResponse>(
    `/api/organizations/${encodeURIComponent(organizationId)}/members/${encodeURIComponent(input.memberId)}/projects`,
    {
      method: 'POST',
      body: JSON.stringify({
        projectIds: input.projectIds,
        projectRole: input.projectRole,
      }),
    },
  );

export interface CreateProjectInput {
  name: string;
  key: string;
  description?: string | null;
}

export const createProject = (input: CreateProjectInput) =>
  apiJson<Project>('/api/projects', { method: 'POST', body: JSON.stringify(input) });

export interface UpdateProjectInput {
  name?: string;
  key?: string;
  description?: string | null;
  status?: string;
  visibility?: string;
}

export const updateProject = (projectId: string, patch: UpdateProjectInput) =>
  apiJson<Project>(`/api/projects/${projectId}`, {
    method: 'PATCH',
    body: JSON.stringify(patch),
  });

export interface InitiativesListResponse {
  initiatives: Initiative[];
  flat: Initiative[];
}

export const listInitiatives = (workspaceId?: string | null) => {
  const q = workspaceId ? `?workspaceId=${encodeURIComponent(workspaceId)}` : '';
  return apiJson<{ initiatives?: RawInitiative[]; flat?: RawInitiative[] }>(
    `/api/initiatives${q}`,
  ).then((response) => ({
    initiatives: (response.initiatives ?? [])
      .map((initiative) => normalizeInitiative(initiative))
      .filter((initiative): initiative is Initiative => initiative !== null),
    flat: (response.flat ?? [])
      .map((initiative) => normalizeInitiative(initiative))
      .filter((initiative): initiative is Initiative => initiative !== null),
  }));
};

export interface CreateInitiativeInput {
  workspaceId: string;
  name: string;
  description?: string | null;
  status?: string;
  targetDate?: string | null;
  parentInitiativeId?: string | null;
}

export const createInitiative = (input: CreateInitiativeInput) =>
  apiJson<{ initiative?: RawInitiative }>('/api/initiatives', {
    method: 'POST',
    body: JSON.stringify(input),
  }).then((response) => {
    const initiative = normalizeInitiative(response.initiative ?? {});
    if (!initiative) throw new Error(i18next.t('errors.invalidInitiativeResponse'));
    return initiative;
  });

export const getInitiative = (initiativeId: string) =>
  apiJson<{
    initiative?: RawInitiative;
    projects?: RawInitiativeProject[];
    children?: RawInitiative[];
  }>(`/api/initiatives/${encodeURIComponent(initiativeId)}`).then((response) => {
    const initiative = normalizeInitiative(response.initiative ?? {});
    if (!initiative) throw new Error(i18next.t('errors.invalidInitiativeResponse'));
    return {
      initiative,
      projects: (response.projects ?? [])
        .map((project) => normalizeInitiativeProject(project))
        .filter((project): project is InitiativeDetail['projects'][number] => project !== null),
      children: (response.children ?? [])
        .map((child) => normalizeInitiative(child))
        .filter((child): child is Initiative => child !== null),
    };
  });

export const getInitiativeRollup = (initiativeId: string) =>
  apiJson<RawInitiativeRollup>(`/api/initiatives/${encodeURIComponent(initiativeId)}/roll-up`).then(
    (rollup) => normalizeInitiativeRollup(rollup),
  );

export const listInitiativeUpdates = (initiativeId: string) =>
  apiJson<{ updates?: RawInitiativeUpdate[] }>(
    `/api/initiatives/${encodeURIComponent(initiativeId)}/updates`,
  ).then((response) =>
    (response.updates ?? [])
      .map((update) => normalizeInitiativeUpdate(update))
      .filter((update): update is InitiativeUpdate => update !== null),
  );

export interface CreateInitiativeUpdateInput {
  status: 'green' | 'yellow' | 'red';
  summary: string;
  blockers?: string | null;
  nextSteps?: string | null;
}

export const createInitiativeUpdate = (initiativeId: string, input: CreateInitiativeUpdateInput) =>
  apiJson<{ update?: RawInitiativeUpdate }>(
    `/api/initiatives/${encodeURIComponent(initiativeId)}/updates`,
    {
      method: 'POST',
      body: JSON.stringify(input),
    },
  ).then((response) => {
    const update = normalizeInitiativeUpdate(response.update ?? {});
    if (!update) throw new Error(i18next.t('errors.invalidInitiativeUpdateResponse'));
    return update;
  });

export const listSprints = (projectId: string) =>
  apiJson<RawSprint[] | { sprints?: RawSprint[] }>(
    `/api/sprints?projectId=${encodeURIComponent(projectId)}`,
  ).then((r) =>
    (Array.isArray(r) ? r : (r.sprints ?? []))
      .map((sprint) => normalizeSprint(sprint))
      .filter((sprint): sprint is Sprint => sprint !== null),
  );

export const getSprint = (sprintId: string) =>
  apiJson<RawSprint>(`/api/sprints/${encodeURIComponent(sprintId)}`).then((raw) => {
    const sprint = normalizeSprint(raw);
    if (!sprint) throw new Error(i18next.t('sprints.errors.invalidResponse'));
    return sprint;
  });

export const listSprintIssues = (sprintId: string) =>
  apiJson<IssueListResponse | Issue[]>(`/api/sprints/${encodeURIComponent(sprintId)}/issues`).then(
    (response) =>
      (Array.isArray(response) ? response : (response.issues ?? [])).map(normalizeIssue),
  );

export const getSprintBurndown = (sprintId: string, unit?: 'points' | 'hours') => {
  const q = new URLSearchParams({ sprintId });
  if (unit) q.set('unit', unit);
  return apiJson<RawSprintBurndownAnalytics>(`/api/analytics/burndown?${q.toString()}`).then(
    normalizeSprintBurndownAnalytics,
  );
};

export interface CreateSprintInput {
  projectId: string;
  name: string;
  goal?: string | null;
  startDate: string;
  endDate: string;
}

export const createSprint = (input: CreateSprintInput) =>
  apiJson<RawSprint>('/api/sprints', {
    method: 'POST',
    body: JSON.stringify(input),
  }).then((raw) => {
    const sprint = normalizeSprint(raw);
    if (!sprint) throw new Error(i18next.t('sprints.errors.invalidResponse'));
    return sprint;
  });

export interface UpdateSprintInput {
  name?: string;
  goal?: string | null;
  startDate?: string;
  endDate?: string;
  status?: SprintStatus;
}

export const updateSprint = (sprintId: string, patch: UpdateSprintInput) =>
  apiJson<RawSprint>(`/api/sprints/${encodeURIComponent(sprintId)}`, {
    method: 'PATCH',
    body: JSON.stringify(patch),
  }).then((raw) => {
    const sprint = normalizeSprint(raw);
    if (!sprint) throw new Error(i18next.t('sprints.errors.invalidResponse'));
    return sprint;
  });

export const deleteSprint = (sprintId: string) =>
  apiJson<{ success?: boolean }>(`/api/sprints/${encodeURIComponent(sprintId)}`, {
    method: 'DELETE',
  });

export interface IssueFilters {
  projectId?: string;
  assigneeId?: string;
  status?: string;
  sprintId?: string;
  parentId?: string;
  type?: IssueType;
}

export const listIssues = (filters: IssueFilters = {}) => {
  const q = new URLSearchParams();
  for (const [k, v] of Object.entries(filters)) if (v) q.set(k, String(v));
  const qs = q.toString();
  return apiJson<IssueListResponse | Issue[]>(`/api/issues${qs ? `?${qs}` : ''}`).then((r) =>
    (Array.isArray(r) ? r : (r.issues ?? [])).map((issue) => normalizeIssue(issue)),
  );
};

export interface ListSavedIssueFiltersInput {
  organizationId: string;
  projectId?: string | null;
  includePublic?: boolean;
}

export interface CreateSavedIssueFilterInput {
  organizationId: string;
  projectId?: string | null;
  name: string;
  description?: string | null;
  query: string;
  criteria: Record<string, unknown>;
  isPublic?: boolean;
  isStarred?: boolean;
  viewType?: ProjectViewType;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

export type UpdateSavedIssueFilterInput = Partial<
  Pick<
    CreateSavedIssueFilterInput,
    | 'name'
    | 'description'
    | 'query'
    | 'criteria'
    | 'isPublic'
    | 'isStarred'
    | 'viewType'
    | 'sortBy'
    | 'sortOrder'
  >
>;

function savedIssueFiltersPath({
  organizationId,
  projectId,
  includePublic = true,
}: ListSavedIssueFiltersInput): string {
  const q = new URLSearchParams({ organizationId });
  if (projectId) q.set('projectId', projectId);
  if (includePublic) q.set('includePublic', 'true');
  return `/api/saved-filters?${q.toString()}`;
}

export const listSavedIssueFilters = (input: ListSavedIssueFiltersInput) =>
  apiJson<{ filters?: RawSavedIssueFilter[] }>(savedIssueFiltersPath(input)).then((response) =>
    (response.filters ?? [])
      .map((filter) => normalizeSavedIssueFilter(filter))
      .filter((filter): filter is SavedIssueFilter => filter !== null),
  );

export const createSavedIssueFilter = (input: CreateSavedIssueFilterInput) =>
  apiJson<{ filter?: RawSavedIssueFilter }>('/api/saved-filters', {
    method: 'POST',
    body: JSON.stringify(input),
  }).then((response) => {
    const filter = normalizeSavedIssueFilter(response.filter ?? {});
    if (!filter) throw new Error(i18next.t('issues.savedFilters.errorGeneric'));
    return filter;
  });

export const updateSavedIssueFilter = (filterId: string, patch: UpdateSavedIssueFilterInput) =>
  apiJson<{ filter?: RawSavedIssueFilter }>(`/api/saved-filters/${encodeURIComponent(filterId)}`, {
    method: 'PATCH',
    body: JSON.stringify(patch),
  }).then((response) => {
    const filter = normalizeSavedIssueFilter(response.filter ?? {});
    if (!filter) throw new Error(i18next.t('issues.savedFilters.errorGeneric'));
    return filter;
  });

export const deleteSavedIssueFilter = (filterId: string) =>
  apiJson<{ success?: boolean }>(`/api/saved-filters/${encodeURIComponent(filterId)}`, {
    method: 'DELETE',
  });

export const markSavedIssueFilterUsed = (filterId: string) =>
  apiJson<{ filter?: RawSavedIssueFilter }>(
    `/api/saved-filters/${encodeURIComponent(filterId)}/use`,
    {
      method: 'POST',
    },
  ).then((response) => {
    const filter = normalizeSavedIssueFilter(response.filter ?? {});
    if (!filter) throw new Error(i18next.t('issues.savedFilters.errorGeneric'));
    return filter;
  });

export const listMyIssues = (view: MyIssueView = 'assigned') => {
  const q = new URLSearchParams({ view });
  return apiJson<MyIssuesResponse>(`/api/issues/my-issues?${q.toString()}`).then((response) => ({
    view: response.view,
    issues: (response.issues ?? []).map((issue) => normalizeIssue(issue)),
  }));
};

export const getMyWorkload = (window: MyWorkloadWindow = 'this_week') => {
  const q = new URLSearchParams({ window });
  return apiJson<RawMyWorkloadResponse>(`/api/metrics/my-workload?${q.toString()}`).then(
    normalizeMyWorkloadResponse,
  );
};

export const searchIssues = (query: string, limit = 20) =>
  apiJson<SearchResponse>('/api/search/hybrid', {
    method: 'POST',
    body: JSON.stringify({ query, limit }),
  }).then((response) => ({
    count: response.count,
    query: response.query,
    results: (response.results ?? [])
      .map((result) => normalizeSearchResult(result))
      .filter((result): result is SearchResult => result !== null),
  }));

export interface ListSearchHistoryInput {
  organizationId: string;
  projectId?: string | null;
  pinned?: boolean;
  limit?: number;
}

export const listSearchHistory = ({
  organizationId,
  projectId,
  pinned,
  limit = 10,
}: ListSearchHistoryInput) => {
  const q = new URLSearchParams({ organizationId, limit: String(limit) });
  if (projectId) q.set('projectId', projectId);
  if (pinned) q.set('pinned', 'true');
  return apiJson<{ history?: RawSearchHistoryEntry[] }>(`/api/search-history?${q.toString()}`).then(
    (response) =>
      (response.history ?? [])
        .map((entry) => normalizeSearchHistoryEntry(entry))
        .filter((entry): entry is SearchHistoryEntry => entry !== null),
  );
};

export const updateSearchHistoryPinned = (id: string, pinned: boolean) =>
  apiJson<{ item?: RawSearchHistoryEntry }>('/api/search-history', {
    method: 'PATCH',
    body: JSON.stringify({ id, pinned }),
  }).then((response) => {
    const entry = normalizeSearchHistoryEntry(response.item ?? {});
    if (!entry) throw new Error(i18next.t('globalSearch.historyUpdateFailed'));
    return entry;
  });

export const getIssue = (issueId: string) =>
  apiJson<RawIssue>(`/api/issues/${issueId}`).then((issue) => normalizeIssue(issue));

export interface CreateIssueInput {
  projectId: string;
  type: IssueType;
  title: string;
  description?: string;
  priority?: IssuePriority;
  assigneeId?: string;
  labels?: string[];
  sprintId?: string;
  epicId?: string;
  parentId?: string;
  statusId?: string;
  estimate?: number;
  dueDate?: string;
}

export const createIssue = (input: CreateIssueInput) =>
  apiJson<RawIssue>('/api/issues', { method: 'POST', body: JSON.stringify(input) }).then((issue) =>
    normalizeIssue(issue),
  );

export interface UpdateIssueInput {
  title?: string;
  description?: string;
  status?: string;
  statusId?: string;
  priority?: IssuePriority;
  assigneeId?: string | null;
  labels?: string[];
  resolution?: IssueResolution | null;
  sprintId?: string | null;
  epicId?: string | null;
  parentId?: string | null;
  estimate?: number | null;
  estimateHours?: number | null;
  estimateSource?: Issue['estimateSource'] | null;
  storyPoints?: number | null;
  flagged?: boolean;
  dueDate?: string | null;
  customFields?: Record<string, unknown>;
}

export const updateIssue = (issueId: string, patch: UpdateIssueInput) =>
  apiJson<RawIssue>(`/api/issues/${issueId}`, {
    method: 'PATCH',
    body: JSON.stringify(patch),
  }).then((issue) => normalizeIssue(issue));

export const suggestIssueEstimate = (issueId: string) =>
  apiJson<RawAiEstimateSuggestion>(`/api/issues/${encodeURIComponent(issueId)}/ai-estimate`, {
    method: 'POST',
  }).then(normalizeAiEstimateSuggestion);

export const listIssueAgentSessions = (issueId: string): Promise<IssueAgentSessionsResponse> =>
  apiJson<{ sessions?: RawIssueAgentSession[] }>(
    `/api/issues/${encodeURIComponent(issueId)}/agent-sessions`,
  ).then((response) => ({
    sessions: (response.sessions ?? [])
      .map((session) => normalizeIssueAgentSession(session))
      .filter((session): session is IssueAgentSession => session !== null),
  }));

export const dispatchIssueAgent = (
  issueId: string,
  input: DispatchIssueAgentInput,
): Promise<DispatchIssueAgentResult> =>
  apiJson<RawDispatchIssueAgentResult>(
    `/api/issues/${encodeURIComponent(issueId)}/dispatch-agent`,
    {
      method: 'POST',
      body: JSON.stringify({
        provider: input.provider,
        prompt_override: input.promptOverride?.trim() || undefined,
      }),
    },
  ).then(normalizeDispatchIssueAgentResult);

export const deleteIssue = (issueId: string) =>
  apiJson<{ success: boolean; id: string }>(`/api/issues/${issueId}`, { method: 'DELETE' });

export const listIssueComponents = (issueId: string) =>
  apiJson<{ components?: RawProjectComponent[] }>(
    `/api/issues/${encodeURIComponent(issueId)}/components`,
  ).then((response) =>
    (response.components ?? [])
      .map((component) => normalizeProjectComponent(component))
      .filter((component): component is ProjectComponent => component !== null),
  );

export const setIssueComponents = (issueId: string, componentIds: string[]) =>
  apiJson<{ components?: RawProjectComponent[] }>(
    `/api/issues/${encodeURIComponent(issueId)}/components`,
    {
      method: 'PUT',
      body: JSON.stringify({ componentIds }),
    },
  ).then((response) =>
    (response.components ?? [])
      .map((component) => normalizeProjectComponent(component))
      .filter((component): component is ProjectComponent => component !== null),
  );

export const listIssueVersions = (issueId: string) =>
  apiJson<{ fixVersions?: RawProjectVersion[]; affectsVersions?: RawProjectVersion[] }>(
    `/api/issues/${encodeURIComponent(issueId)}/versions`,
  ).then(
    (response): IssueVersions => ({
      fixVersions: (response.fixVersions ?? [])
        .map((version) => normalizeProjectVersion(version))
        .filter((version): version is ProjectVersion => version !== null),
      affectsVersions: (response.affectsVersions ?? [])
        .map((version) => normalizeProjectVersion(version))
        .filter((version): version is ProjectVersion => version !== null),
    }),
  );

export const listIssueLinks = (issueId: string) =>
  apiJson<{ outbound?: RawIssueLink[]; inbound?: RawIssueLink[] }>(
    `/api/issues/${encodeURIComponent(issueId)}/links`,
  ).then(
    (response): IssueLinksData => ({
      outbound: (response.outbound ?? [])
        .map((link) => normalizeIssueLink(link))
        .filter((link): link is IssueLink => link !== null),
      inbound: (response.inbound ?? [])
        .map((link) => normalizeIssueLink(link))
        .filter((link): link is IssueLink => link !== null),
    }),
  );

export interface CreateIssueLinkInput {
  targetIssueId: string;
  type: IssueLinkType;
}

export const createIssueLink = (issueId: string, input: CreateIssueLinkInput) =>
  apiJson<{ id: string }>(`/api/issues/${encodeURIComponent(issueId)}/links`, {
    method: 'POST',
    body: JSON.stringify(input),
  });

export const deleteIssueLink = (issueId: string, linkId: string) =>
  apiJson<{ success: boolean }>(
    `/api/issues/${encodeURIComponent(issueId)}/links?linkId=${encodeURIComponent(linkId)}`,
    { method: 'DELETE' },
  );

export const listIssueActivities = (issueId: string) =>
  apiJson<{ activities?: RawIssueActivity[]; total?: number | string | null }>(
    `/api/issues/${encodeURIComponent(issueId)}/activities`,
  ).then((response) =>
    (response.activities ?? [])
      .map((activity) => normalizeIssueActivity(activity))
      .filter((activity): activity is IssueActivity => activity !== null),
  );

export const listIssueAttachments = (issueId: string) =>
  apiJson<{ attachments?: RawIssueAttachment[] }>(
    `/api/issues/${encodeURIComponent(issueId)}/attachments`,
  ).then((response) =>
    (response.attachments ?? [])
      .map((attachment) => normalizeIssueAttachment(attachment))
      .filter((attachment): attachment is IssueAttachment => attachment !== null),
  );

export interface UploadIssueAttachmentInput {
  uri: string;
  name: string;
  type?: string | null;
  size?: number | null;
}

export const uploadIssueAttachment = (issueId: string, input: UploadIssueAttachmentInput) => {
  const formData = new FormData();
  formData.append('file', {
    uri: input.uri,
    name: input.name,
    type: input.type ?? 'application/octet-stream',
  } as unknown as Blob);

  return apiFormData<RawUploadIssueAttachmentResponse>(
    `/api/issues/${encodeURIComponent(issueId)}/attachments`,
    formData,
    { method: 'POST' },
  ).then((response) => {
    const attachment = normalizeIssueAttachment(response.attachment);
    if (!attachment) throw new Error(i18next.t('issueAttachments.uploadFailed'));
    return attachment;
  });
};

export const deleteIssueAttachment = (issueId: string, attachmentId: string) =>
  apiJson<{ success: boolean }>(
    `/api/issues/${encodeURIComponent(issueId)}/attachments?attachmentId=${encodeURIComponent(attachmentId)}`,
    { method: 'DELETE' },
  );

export const listIssueTimeEntries = (issueId: string) =>
  apiJson<{ entries?: RawTimeEntry[] }>(
    `/api/issues/${encodeURIComponent(issueId)}/time-entries`,
  ).then((response) =>
    (response.entries ?? [])
      .map((entry) => normalizeTimeEntry(entry))
      .filter((entry): entry is TimeEntry => entry !== null),
  );

export const listIssueTimeInStatus = (issueId: string) =>
  apiJson<RawIssueTimeInStatusBucket[]>(
    `/api/issues/${encodeURIComponent(issueId)}/time-in-status`,
  ).then((response) =>
    response
      .map((bucket) => normalizeIssueTimeInStatusBucket(bucket))
      .filter((bucket): bucket is IssueTimeInStatusBucket => bucket !== null),
  );

export interface StartIssueTimerResult {
  entry: TimeEntry;
}

export const startIssueTimer = (issueId: string) =>
  apiJson<{ entry?: RawTimeEntry }>(`/api/issues/${encodeURIComponent(issueId)}/timer/start`, {
    method: 'POST',
  }).then((response): StartIssueTimerResult => {
    const entry = normalizeTimeEntry(response.entry ?? {});
    if (!entry) throw new Error(i18next.t('timeTracking.error_generic'));
    return { entry };
  });

export interface StopIssueTimerInput {
  description?: string;
}

export interface StopIssueTimerResult {
  entry: TimeEntry;
  actualHours?: number;
}

export const stopIssueTimer = (issueId: string, input: StopIssueTimerInput = {}) =>
  apiJson<{ entry?: RawTimeEntry; actualHours?: number | string | null }>(
    `/api/issues/${encodeURIComponent(issueId)}/timer/stop`,
    {
      method: 'POST',
      body: JSON.stringify(input),
    },
  ).then((response): StopIssueTimerResult => {
    const entry = normalizeTimeEntry(response.entry ?? {});
    if (!entry) throw new Error(i18next.t('timeTracking.error_generic'));
    const result: StopIssueTimerResult = { entry };
    const actualHours = numericCount(response.actualHours);
    if (actualHours !== undefined) result.actualHours = actualHours;
    return result;
  });

export interface LogIssueTimeEntryInput {
  durationSeconds: number;
  description?: string;
}

export interface LogIssueTimeEntryResult {
  entry: TimeEntry;
  actualHours?: number;
}

export const logIssueTimeEntry = (issueId: string, input: LogIssueTimeEntryInput) =>
  apiJson<{ entry?: RawTimeEntry; actualHours?: number | string | null }>(
    `/api/issues/${encodeURIComponent(issueId)}/time-entries`,
    {
      method: 'POST',
      body: JSON.stringify(input),
    },
  ).then((response): LogIssueTimeEntryResult => {
    const entry = normalizeTimeEntry(response.entry ?? {});
    if (!entry) throw new Error(i18next.t('timeTracking.error_generic'));
    const result: LogIssueTimeEntryResult = { entry };
    const actualHours = numericCount(response.actualHours);
    if (actualHours !== undefined) result.actualHours = actualHours;
    return result;
  });

export const listIssueCustomFieldValues = (issueId: string) =>
  apiJson<{ customFieldValues?: RawIssueCustomFieldValue[] }>(
    `/api/issues/${encodeURIComponent(issueId)}/custom-fields`,
  ).then((response) =>
    (response.customFieldValues ?? [])
      .map((fieldValue) => normalizeIssueCustomFieldValue(fieldValue))
      .filter((fieldValue): fieldValue is IssueCustomFieldValue => fieldValue !== null),
  );

export interface SetIssueCustomFieldValueInput {
  customFieldId: string;
  value: string | null;
}

export interface SetIssueCustomFieldValueResult {
  id?: string;
  customFieldId: string;
  value: string | null;
}

export const setIssueCustomFieldValue = (issueId: string, input: SetIssueCustomFieldValueInput) =>
  apiJson<SetIssueCustomFieldValueResult>(
    `/api/issues/${encodeURIComponent(issueId)}/custom-fields`,
    {
      method: 'POST',
      body: JSON.stringify(input),
    },
  );

export interface SetIssueVersionsInput {
  fixVersionIds?: string[];
  affectsVersionIds?: string[];
}

export const setIssueVersions = (issueId: string, input: SetIssueVersionsInput) =>
  apiJson<{ fixVersions?: RawProjectVersion[]; affectsVersions?: RawProjectVersion[] }>(
    `/api/issues/${encodeURIComponent(issueId)}/versions`,
    {
      method: 'PUT',
      body: JSON.stringify(input),
    },
  ).then(
    (response): IssueVersions => ({
      fixVersions: (response.fixVersions ?? [])
        .map((version) => normalizeProjectVersion(version))
        .filter((version): version is ProjectVersion => version !== null),
      affectsVersions: (response.affectsVersions ?? [])
        .map((version) => normalizeProjectVersion(version))
        .filter((version): version is ProjectVersion => version !== null),
    }),
  );

export const listIssueTriageSuggestions = (issueId: string): Promise<IssueTriageResponse> =>
  apiJson<{ suggestions?: RawIssueTriageSuggestion[] }>(
    `/api/issues/${encodeURIComponent(issueId)}/triage`,
  ).then((response) => ({
    suggestions: (response.suggestions ?? [])
      .map((suggestion) => normalizeIssueTriageSuggestion(suggestion))
      .filter((suggestion): suggestion is IssueTriageSuggestion => suggestion !== null),
  }));

export const runIssueTriage = (issueId: string): Promise<RunIssueTriageResponse> =>
  apiJson<{ suggestion?: RawIssueTriageSuggestion; payload?: RawIssueTriagePayload }>(
    `/api/issues/${encodeURIComponent(issueId)}/triage`,
    { method: 'POST' },
  ).then((response) => {
    const suggestion = normalizeIssueTriageSuggestion(response.suggestion);
    if (!suggestion) throw new Error(i18next.t('issueTriage.runFailed'));
    return {
      suggestion,
      payload: normalizeIssueTriagePayload(response.payload ?? suggestion.payload),
    };
  });

export interface ApplyIssueTriageInput {
  suggestionId?: string;
  approved?: boolean;
}

export const applyIssueTriageSuggestion = (
  issueId: string,
  input: ApplyIssueTriageInput,
): Promise<ApplyIssueTriageResponse> =>
  apiJson<Partial<ApplyIssueTriageResponse> & { applied?: Record<string, unknown> }>(
    `/api/issues/${encodeURIComponent(issueId)}/triage/apply`,
    {
      method: 'POST',
      body: JSON.stringify(input),
    },
  ).then((response) => ({
    success: response.success === true,
    applied: response.applied ?? {},
    suggestionId: String(response.suggestionId ?? input.suggestionId ?? ''),
    autoApplied: response.autoApplied === true,
    threshold: numericCount(response.threshold) ?? 0,
  }));

export const listIssueWatchers = (issueId: string) =>
  apiJson<{ watchers?: RawWatcher[] }>(`/api/watchers?issueId=${encodeURIComponent(issueId)}`).then(
    (r) =>
      (r.watchers ?? [])
        .map((watcher) => normalizeWatcher(watcher))
        .filter((watcher): watcher is Watcher => watcher !== null),
  );

export const addIssueWatcher = (issueId: string) =>
  apiJson<RawWatcher>('/api/watchers', {
    method: 'POST',
    body: JSON.stringify({ issueId }),
  }).then((watcher) => normalizeWatcher(watcher));

export const removeIssueWatcher = (issueId: string) =>
  apiJson<{ message?: string }>(`/api/watchers?issueId=${encodeURIComponent(issueId)}`, {
    method: 'DELETE',
  });

export const listComments = (issueId: string) =>
  apiJson<Comment[] | { comments: Comment[] }>(`/api/issues/${issueId}/comments`).then((r) =>
    (Array.isArray(r) ? r : (r.comments ?? [])).map((comment) => normalizeComment(comment)),
  );

export interface CreateCommentInput {
  content: string;
  mentions?: string[];
}

export type AddCommentInput = string | CreateCommentInput;

function commentPayload(input: AddCommentInput): CreateCommentInput {
  const payload = typeof input === 'string' ? { content: input } : input;
  const mentions = payload.mentions?.filter((mention) => mention.trim().length > 0);
  return mentions && mentions.length > 0
    ? { content: payload.content, mentions }
    : { content: payload.content };
}

export const addComment = (issueId: string, input: AddCommentInput) =>
  apiJson<RawComment>(`/api/issues/${issueId}/comments`, {
    method: 'POST',
    body: JSON.stringify(commentPayload(input)),
  }).then((comment) => normalizeComment(comment));

export interface UpdateCommentInput {
  commentId: string;
  content: string;
  mentions?: string[];
}

export interface ToggleCommentReactionInput {
  commentId: string;
  emoji: string;
}

export interface ToggleCommentReactionResponse {
  commentId: string;
  reacted: boolean;
  reactions: CommentReaction[];
}

export const updateComment = (
  issueId: string,
  { commentId, content, mentions }: UpdateCommentInput,
) => {
  const input: CreateCommentInput = mentions === undefined ? { content } : { content, mentions };
  return apiJson<RawComment>(`/api/issues/${issueId}/comments/${commentId}`, {
    method: 'PATCH',
    body: JSON.stringify(commentPayload(input)),
  }).then((comment) => normalizeComment(comment));
};

export const deleteComment = (issueId: string, commentId: string) =>
  apiJson<{ success: boolean; id: string }>(`/api/issues/${issueId}/comments/${commentId}`, {
    method: 'DELETE',
  });

export const toggleCommentReaction = (
  issueId: string,
  { commentId, emoji }: ToggleCommentReactionInput,
): Promise<ToggleCommentReactionResponse> =>
  apiJson<RawToggleCommentReactionResponse>(
    `/api/issues/${encodeURIComponent(issueId)}/comments/${encodeURIComponent(commentId)}/reactions`,
    {
      method: 'POST',
      body: JSON.stringify({ emoji }),
    },
  ).then((response) => ({
    commentId: String(response.commentId ?? commentId),
    reacted: response.reacted === true,
    reactions: normalizeCommentReactions(response.reactions),
  }));

type NotificationPreferencesResponse =
  | RawNotificationPreferences
  | { preferences?: RawNotificationPreferences };
type UserAppearanceResponse = RawUserAppearance | { settings?: RawUserAppearance };

function preferencesFromResponse(
  response: NotificationPreferencesResponse,
  organizationId: string,
): NotificationPreferences {
  const wrapped = response as { preferences?: RawNotificationPreferences };
  const raw = wrapped.preferences ?? (response as RawNotificationPreferences);
  return normalizeNotificationPreferences(raw, organizationId);
}

function userAppearanceFromResponse(response: UserAppearanceResponse): UserAppearanceSettings {
  const wrapped = response as { settings?: RawUserAppearance };
  return normalizeUserAppearance(wrapped.settings ?? (response as RawUserAppearance));
}

export type UpdateNotificationPreferencesInput = Pick<NotificationPreferences, 'organizationId'> &
  Partial<
    Omit<NotificationPreferences, 'id' | 'userId' | 'organizationId' | 'createdAt' | 'updatedAt'>
  >;

export type UpdateUserAppearanceInput = Partial<{
  theme: UserAppearanceTheme | null;
  colorTheme: UserAppearanceColorTheme | null;
  visualStyle: UserAppearanceVisualStyle | null;
  interfaceFont: UserAppearanceInterfaceFont | null;
  animationsEnabled: boolean;
  gradientsEnabled: boolean;
}>;

export const getUserAppearance = () =>
  apiJson<UserAppearanceResponse>('/api/user/appearance').then(userAppearanceFromResponse);

export const updateUserAppearance = (input: UpdateUserAppearanceInput) =>
  apiJson<UserAppearanceResponse>('/api/user/appearance', {
    method: 'PUT',
    body: JSON.stringify(input),
  }).then(userAppearanceFromResponse);

export const getNotificationPreferences = (organizationId: string) =>
  apiJson<NotificationPreferencesResponse>(
    `/api/notification-preferences?organizationId=${encodeURIComponent(organizationId)}`,
  ).then((response) => preferencesFromResponse(response, organizationId));

export const updateNotificationPreferences = (input: UpdateNotificationPreferencesInput) =>
  apiJson<NotificationPreferencesResponse>('/api/notification-preferences', {
    method: 'POST',
    body: JSON.stringify(input),
  }).then((response) => preferencesFromResponse(response, input.organizationId));

function normalizeInboxFilters(filters: InboxFilters | boolean = {}): InboxFilters {
  return typeof filters === 'boolean' ? { unreadOnly: filters } : filters;
}

function inboxQuery(filters: InboxFilters | boolean = {}): string {
  const normalizedFilters = normalizeInboxFilters(filters);
  const q = new URLSearchParams();
  if (normalizedFilters.unreadOnly) q.set('unread', 'true');
  if (normalizedFilters.snoozed) q.set('snoozed', 'true');
  if (normalizedFilters.actorType) q.set('actor_type', normalizedFilters.actorType);
  if (normalizedFilters.notificationType) {
    q.set('notification_type', normalizedFilters.notificationType);
  }
  if (normalizedFilters.projectId) q.set('project', normalizedFilters.projectId);
  if (normalizedFilters.since) q.set('since', normalizedFilters.since);
  if (normalizedFilters.until) q.set('until', normalizedFilters.until);
  if (normalizedFilters.cursor) q.set('cursor', normalizedFilters.cursor);
  if (
    typeof normalizedFilters.limit === 'number' &&
    Number.isFinite(normalizedFilters.limit) &&
    normalizedFilters.limit > 0
  ) {
    q.set('limit', String(Math.floor(normalizedFilters.limit)));
  }
  return q.toString();
}

function normalizeInboxPage(response: RawInboxResponse): InboxPage {
  if (Array.isArray(response)) {
    return { items: response.map((item) => normalizeNotification(item)), nextCursor: null };
  }
  const items = response.items ?? response.notifications ?? [];
  return {
    items: items.map((item) => normalizeNotification(item)),
    nextCursor: typeof response.nextCursor === 'string' ? response.nextCursor : null,
  };
}

export const listInboxPage = (filters: InboxFilters | boolean = {}) => {
  const qs = inboxQuery(filters);
  return apiJson<RawInboxResponse>(`/api/inbox${qs ? `?${qs}` : ''}`).then((response) =>
    normalizeInboxPage(response),
  );
};

export const listInbox = (filters: InboxFilters | boolean = {}) =>
  listInboxPage(filters).then((page) => page.items);

export interface GetCatchMeUpInput {
  since?: string | null;
}

export const getCatchMeUp = ({ since }: GetCatchMeUpInput = {}) => {
  const q = new URLSearchParams();
  if (since) q.set('since', since);
  const qs = q.toString();
  return apiJson<RawCatchMeUpDigest>(`/api/inbox/catch-me-up${qs ? `?${qs}` : ''}`).then(
    (response) => normalizeCatchMeUpDigest(response),
  );
};

export const markNotificationRead = (notificationId: string) =>
  apiJson<RawNotification>(`/api/inbox/${encodeURIComponent(notificationId)}/mark-read`, {
    method: 'POST',
  }).then((item) => normalizeNotification(item));

export interface SnoozeInboxNotificationInput {
  notificationId: string;
  until: string | null;
}

export const snoozeInboxNotification = ({ notificationId, until }: SnoozeInboxNotificationInput) =>
  apiJson<RawNotification>(`/api/inbox/${encodeURIComponent(notificationId)}/snooze`, {
    method: 'POST',
    body: JSON.stringify({ until }),
  }).then((item) => normalizeNotification(item));

export const markInboxRead = () =>
  apiJson<{ success: boolean; count?: number }>('/api/inbox/mark-all-read', { method: 'POST' });
