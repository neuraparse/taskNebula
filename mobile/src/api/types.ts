/**
 * API DTOs — a focused subset of TaskNebula's REST surface that the mobile
 * app consumes. Kept intentionally permissive (optional fields) because a
 * self-hosted instance may be on an older/newer version than the app.
 */
export interface User {
  id: string;
  name: string | null;
  email: string;
  image?: string | null;
  isSuperAdmin?: boolean;
  status?: string;
  emailVerified?: string | null;
  emailVerificationRequired?: boolean;
}

export interface Project {
  id: string;
  key: string;
  name: string;
  description?: string | null;
  organizationId: string;
  status?: string | null;
  visibility?: string | null;
  color?: string | null;
  icon?: string | null;
  issueCount?: number;
  sprintCount?: number;
  updatedAt?: string;
}

export type RecentActivityMessageKey =
  | 'createdIssue'
  | 'updatedIssue'
  | 'movedTo'
  | 'changedStatus'
  | 'assignedIssue'
  | 'unassignedIssue'
  | 'changedPriorityTo'
  | 'changedPriority'
  | 'commentedOn'
  | 'linkedIssue'
  | 'startedSprint'
  | 'completedSprint'
  | 'createdProject'
  | 'addedMemberToProject'
  | 'unknownAction';

export interface RecentActivity {
  id: string;
  action: string;
  type: string;
  message?: string | null;
  messageKey?: RecentActivityMessageKey | string | null;
  messageValues?: Record<string, string | number | null | undefined>;
  user: User;
  issue: {
    id: string;
    key: string;
    title: string;
  } | null;
  createdAt: string;
  metadata?: unknown;
}

export interface ProjectHealthOverview {
  totalIssues: number;
  overdueIssues: number;
  unassignedIssues: number;
}

export interface ProjectHealthSprints {
  total: number;
  active: number;
  completed: number;
}

export interface ProjectHealthStatusBucket {
  status: string;
  name: string | null;
  color: string | null;
  category: string | null;
  count: number;
}

export interface ProjectHealthPriorityBucket {
  priority: string;
  count: number;
}

export interface ProjectHealthTypeBucket {
  type: string;
  count: number;
}

export interface ProjectHealthAnalytics {
  overview: ProjectHealthOverview;
  sprints: ProjectHealthSprints;
  issuesByStatus: ProjectHealthStatusBucket[];
  issuesByPriority: ProjectHealthPriorityBucket[];
  issuesByType: ProjectHealthTypeBucket[];
}

export interface ProjectVelocitySprint {
  sprintId: string;
  sprintName: string;
  startDate: string | null;
  endDate: string | null;
  completedIssues: number;
  completedPoints: number;
}

export interface ProjectVelocityAnalytics {
  sprints: ProjectVelocitySprint[];
  averageVelocity: {
    issues: number;
    points: number;
  };
}

export interface ProjectThroughputBucket {
  period: string;
  count: number;
}

export interface ProjectThroughputAnalytics {
  projectId: string;
  bucket: 'day' | 'week' | string;
  days: number;
  data: ProjectThroughputBucket[];
}

export interface ProjectCycleTimeAnalytics {
  projectId: string;
  days: number;
  sampleSize: number;
  values: number[];
  p50: number;
  p90: number;
}

export interface ProjectForecastHistogramBucket {
  sprints: number;
  count: number;
}

export interface ProjectForecastAnalytics {
  projectId: string;
  backlog: number;
  throughputHistory: number[];
  p50Date: string;
  p80Date: string;
  p95Date: string;
  p50Sprints: number;
  p80Sprints: number;
  p95Sprints: number;
  iterations: number;
  histogram: ProjectForecastHistogramBucket[];
}

export interface ProjectAnalyticsResponse {
  health: ProjectHealthAnalytics;
  velocity: ProjectVelocityAnalytics;
  throughput: ProjectThroughputAnalytics;
  cycleTime: ProjectCycleTimeAnalytics;
  forecast: ProjectForecastAnalytics;
}

export interface DoraAnalytics {
  connected: boolean;
  deployFrequencyPerDay: number;
  deployFrequencyDelta: number | null;
  deployFrequencySpark: number[];
  leadTimeHours: number;
  leadTimeDelta: number | null;
  leadTimeSpark: number[];
  changeFailureRate: number;
  changeFailureRateDelta: number | null;
  changeFailureRateSpark: number[];
  reworkRate: number;
  reworkRateDelta: number | null;
  reworkRateSpark: number[];
  recoveryHours: number;
  recoveryHoursDelta: number | null;
  recoveryHoursSpark: number[];
}

export type EstimateReason = 'similar_issues' | 'project_median' | 'not_enough_data' | string;

export interface EstimateNeighbourIssue {
  id: string;
  key: string;
  title: string;
  actualHours: number;
  similarity: number;
}

export interface AiEstimateSuggestion {
  estimateHours: number | null;
  p25Hours: number | null;
  p75Hours: number | null;
  reason: EstimateReason;
  rationale: string;
  sampleSize: number;
  neighbours?: EstimateNeighbourIssue[];
}

export type AgentSessionProvider =
  | 'claude'
  | 'codex'
  | 'cursor'
  | 'devin'
  | 'copilot'
  | 'openhands'
  | 'custom';

export type AgentSessionState =
  | 'pending'
  | 'active'
  | 'awaitingInput'
  | 'error'
  | 'complete'
  | 'stale';

export interface IssueAgentSession {
  id: string;
  issueId: string;
  provider: AgentSessionProvider;
  externalId: string | null;
  state: AgentSessionState;
  payload: Record<string, unknown>;
  startedAt: string;
  updatedAt: string;
  finishedAt: string | null;
}

export interface IssueAgentSessionsResponse {
  sessions: IssueAgentSession[];
}

export interface DispatchIssueAgentResult {
  sessionId: string;
  provider: AgentSessionProvider;
  state: string;
  runner?: 'local_cli';
  callbackUrl?: string;
}

export interface AiIssueDraft {
  type: IssueType;
  title: string;
  description: string | null;
  priority: IssuePriority;
  labels: string[];
  estimate: number | null;
}

export interface AiIssueDraftResponse {
  draft: AiIssueDraft;
  provider: AiProvider;
}

export type AskScope = 'all' | 'issues' | 'docs';
export type AskCitationType = 'issue' | 'doc';

export interface AskCitationSource {
  type: AskCitationType;
  id: string;
  key?: string;
  title: string;
  snippet: string;
  url?: string;
}

export interface AskCitation extends AskCitationSource {
  key: string;
  occurrence: number;
}

export interface AskUsage {
  model: string;
  inputTokens: number;
  outputTokens: number;
  costUsd: number;
  latencyMs: number;
  reranked: boolean;
  promptHash: string;
}

export interface AskTaskNebulaResponse {
  answer: string;
  sources: AskCitationSource[];
  citations: AskCitation[];
  usage: AskUsage | null;
}

export interface ProjectMember {
  id: string;
  userId: string;
  role?: string | null;
  permissions?: Record<string, boolean>;
  user: User;
}

export type ProjectRole =
  | 'product_owner'
  | 'scrum_master'
  | 'tech_lead'
  | 'developer'
  | 'qa_engineer'
  | 'designer'
  | 'viewer'
  | string;

export interface PermissionScheme {
  id: string;
  name: string;
  description: string | null;
  isDefault: boolean;
  permissions: Record<string, string[]>;
  createdAt: string | null;
  updatedAt: string | null;
  projectCount: number;
}

export interface ProjectPermissionSchemeState {
  projectId: string;
  assignedSchemeId: string | null;
  effectiveSchemeId: string | null;
  source: 'project' | 'organization-default' | 'none' | string;
  scheme: Pick<PermissionScheme, 'id' | 'name' | 'description' | 'isDefault'> | null;
}

export type SecurityLevelMemberType =
  | 'reporter'
  | 'assignee'
  | 'project_lead'
  | 'project_role'
  | 'user'
  | 'anyone'
  | string;

export interface SecurityLevelMember {
  id: string | null;
  memberType: SecurityLevelMemberType;
  memberValue: string | null;
}

export interface SecurityLevel {
  id: string;
  schemeId: string;
  name: string;
  description: string | null;
  sortOrder: number;
  isDefault: boolean;
  members: SecurityLevelMember[];
}

export interface SecurityScheme {
  id: string;
  name: string;
  description: string | null;
  isDefault: boolean;
  levels: SecurityLevel[];
  createdAt: string | null;
  updatedAt: string | null;
  projectCount: number;
}

export interface ProjectSecuritySchemeState {
  projectId: string;
  assignedSchemeId: string | null;
  effectiveSchemeId: string | null;
  source: 'project' | 'organization-default' | 'none' | string;
  scheme: Pick<SecurityScheme, 'id' | 'name' | 'description' | 'isDefault'> | null;
}

export interface AutomationRuleTrigger {
  type: string;
  event?: string;
  field?: string;
}

export interface AutomationRuleAction {
  type: string;
  [key: string]: unknown;
}

export interface AutomationRule {
  id: string;
  organizationId: string;
  projectId: string | null;
  name: string;
  description: string | null;
  enabled: boolean;
  trigger: AutomationRuleTrigger;
  conditions: Array<Record<string, unknown>>;
  actions: AutomationRuleAction[];
  createdAt: string | null;
  updatedAt: string | null;
}

export interface AutomationExecution {
  id: string;
  ruleId: string;
  triggeredAt: string;
  triggerPayload: unknown;
  status: string;
  actionResults: unknown;
  durationMs: number | null;
  error: string | null;
}

export interface ProjectInviteAcceptResult {
  invite: {
    projectId?: string;
    projectKey: string;
    projectName?: string;
    organizationId?: string;
    role?: string;
  };
  redirectTo?: string;
}

export interface ProjectInviteLink {
  id: string;
  role: ProjectRole;
  maxUses: number;
  usedCount: number;
  expiresAt: string;
  revokedAt: string | null;
  createdAt: string | null;
  updatedAt: string | null;
  createdBy: string | null;
  creatorName?: string | null;
  creatorEmail?: string | null;
}

export type ModuleStatus =
  | 'backlog'
  | 'planned'
  | 'in_progress'
  | 'paused'
  | 'completed'
  | 'cancelled'
  | string;

export interface ProjectModule {
  id: string;
  projectId: string;
  name: string;
  description?: string | null;
  status: ModuleStatus;
  ownerId?: string | null;
  memberIds: string[];
  targetDate?: string | null;
  createdAt?: string;
  updatedAt?: string;
}

export type ProjectViewType = 'list' | 'board' | 'timeline' | 'calendar';
export type ProjectViewScope = 'personal' | 'project' | 'teamspace';

export interface ProjectView {
  id: string;
  userId: string;
  name: string;
  description: string | null;
  query: string;
  criteria: Record<string, unknown>;
  isPublic: boolean;
  isStarred: boolean;
  viewType: ProjectViewType;
  lastUsedAt: string | null;
  updatedAt: string;
  scope: ProjectViewScope;
  teamspaceId: string | null;
  isDefault: boolean;
  isOwned: boolean;
}

export interface ProjectViewsResponse {
  viewerId: string;
  project: {
    id: string;
    key: string;
    name: string;
    teamId: string | null;
  };
  views: ProjectView[];
}

export interface SavedIssueFilter {
  id: string;
  userId: string;
  organizationId: string;
  projectId: string | null;
  name: string;
  description: string | null;
  query: string;
  criteria: Record<string, unknown>;
  isPublic: boolean;
  isStarred: boolean;
  viewType: ProjectViewType;
  sortBy: string;
  sortOrder: 'asc' | 'desc';
  usageCount: number;
  lastUsedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export type ConversationRoomKind = 'channel' | 'issue_thread' | 'document_thread' | string;

export interface ProjectChatSettings {
  enabled: boolean;
  voiceEnabled: boolean;
  issueThreadsEnabled: boolean;
  documentThreadsEnabled: boolean;
  attachmentsEnabled: boolean;
  unreadTrackingEnabled: boolean;
}

export interface ProjectCommunicationsSettings extends ProjectChatSettings {
  inheritWorkspaceDefaults: boolean;
}

export interface ProjectCommunicationsSettingsResponse {
  project: {
    id: string;
    key: string;
    name: string;
  };
  access: {
    canView: boolean;
    canManage: boolean;
  };
  workspaceSettings: ProjectChatSettings;
  projectSettings: ProjectCommunicationsSettings;
  effectiveSettings: ProjectChatSettings;
}

export interface UpdateProjectCommunicationsSettingsInput {
  enabled?: boolean | undefined;
  inheritWorkspaceDefaults?: boolean | undefined;
  voiceEnabled?: boolean | undefined;
  issueThreadsEnabled?: boolean | undefined;
  documentThreadsEnabled?: boolean | undefined;
  attachmentsEnabled?: boolean | undefined;
  unreadTrackingEnabled?: boolean | undefined;
}

export interface WorkspaceCommunicationsSettings {
  enabled: boolean;
  voiceEnabled: boolean;
  issueThreadsEnabled: boolean;
  documentThreadsEnabled: boolean;
  attachmentsEnabled: boolean;
  unreadTrackingEnabled: boolean;
}

export interface WorkspaceCommunicationsServiceStatus {
  redisReady: boolean;
  livekit: {
    ready: boolean;
    url: string | null;
    missing: string[];
  };
}

export interface WorkspaceCommunicationsSettingsResponse {
  organizationId: string;
  organizationName: string;
  settings: WorkspaceCommunicationsSettings;
  serviceStatus: WorkspaceCommunicationsServiceStatus;
}

export interface UpdateWorkspaceCommunicationsSettingsInput {
  organizationId: string;
  enabled?: boolean;
  voiceEnabled?: boolean;
  issueThreadsEnabled?: boolean;
  documentThreadsEnabled?: boolean;
  attachmentsEnabled?: boolean;
  unreadTrackingEnabled?: boolean;
}

export interface ProjectChatPermissions {
  canBrowseProject: boolean;
  canAdministerProject: boolean;
  canBrowseChat: boolean;
  canCreateChannels: boolean;
  canPostMessages: boolean;
  canModerateMessages: boolean;
  canStartCalls: boolean;
  canManageCalls: boolean;
}

export interface ProjectChatLastMessage {
  id: string;
  body: string;
  createdAt: string;
}

export interface ProjectChatActiveCall {
  id: string;
  roomId?: string;
  participantCount: number;
  livekitRoomName?: string;
}

export interface ConversationCallToken {
  participantIdentity: string;
  roomName: string;
  token: string;
  url: string;
  call: ProjectChatActiveCall | null;
}

export interface ConversationCallStartResponse {
  call: ProjectChatActiveCall | null;
  livekit?: WorkspaceCommunicationsServiceStatus['livekit'];
}

export interface ConversationCallLeaveResponse {
  success: boolean;
  call: ProjectChatActiveCall | null;
}

export interface ConversationCallPulseResponse {
  success: boolean;
  result: {
    callId: string;
    roomId: string;
    touchedAt: string;
  } | null;
}

export interface GlobalLiveCall {
  id: string;
  roomId: string;
  livekitRoomName: string;
  participantCount: number;
  startedAt: string;
  joinedParticipantId: string | null;
  isParticipant: boolean;
  project: {
    id: string;
    key: string;
    name: string;
    path: string;
  };
  room: {
    id: string;
    kind: ConversationRoomKind;
    title: string;
    subtitle: string;
    href: string;
  };
}

export interface ProjectChatChannel {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  roomId: string | null;
  unreadCount: number;
  participantCount: number;
  lastMessage: ProjectChatLastMessage | null;
  activeCall: ProjectChatActiveCall | null;
  isDefault?: boolean;
  isArchived?: boolean;
  position?: number;
}

export interface ProjectChatDiscussion {
  id: string;
  kind: ConversationRoomKind;
  title: string | null;
  unreadCount: number;
  participantCount: number;
  latestMessage: ProjectChatLastMessage | null;
  activeCall: ProjectChatActiveCall | null;
  context: Record<string, unknown> | null;
}

export interface ProjectChatBootstrap {
  project: {
    id: string;
    key: string;
    name: string;
  };
  effectiveSettings: ProjectChatSettings;
  workspaceSettings?: Record<string, unknown>;
  projectSettings?: Record<string, unknown>;
  permissions: ProjectChatPermissions;
  channels: ProjectChatChannel[];
  recentDiscussions: ProjectChatDiscussion[];
  activeCalls: ProjectChatActiveCall[];
  lastActiveRoomId: string | null;
}

export type IntakeFieldType = 'text' | 'textarea' | 'email' | 'select' | 'file' | string;

export interface IntakeFieldDefinition {
  name: string;
  label: string;
  type: IntakeFieldType;
  required?: boolean;
  options?: string[];
  placeholder?: string;
  helpText?: string;
}

export interface IntakeForm {
  id: string;
  workspaceId: string;
  projectId: string;
  slug: string;
  title: string;
  description: string | null;
  fields: IntakeFieldDefinition[];
  isPublic: boolean;
  requiresCaptcha: boolean;
  targetStatus: string;
  autoAssignUserId?: string | null;
  customStyling?: Record<string, unknown>;
  createdAt?: string;
  updatedAt?: string;
}

export interface PublicIntakeForm {
  id: string;
  slug: string;
  title: string;
  description: string | null;
  fields: IntakeFieldDefinition[];
  isPublic: boolean;
  requiresCaptcha: boolean;
  customStyling?: Record<string, unknown>;
}

export interface PublicIntakeFormResponse {
  form: PublicIntakeForm;
  captchaConfigured: boolean;
}

export interface SubmitPublicIntakeResult {
  success: boolean;
  submissionId: string;
  issueKey: string;
}

export interface ConversationAttachment {
  id: string;
  fileName: string;
  fileSize: number;
  mimeType: string;
  filePath: string;
  uploadedById: string;
  uploadedAt: string;
}

export interface ConversationReaction {
  emoji: string;
  count: number;
  reactedUserIds: string[];
  reactedByCurrentUser: boolean;
}

export interface ConversationAuthor {
  id: string;
  name: string | null;
  email: string | null;
  image: string | null;
}

export interface ConversationModerationSnapshot {
  deletedBody: string;
  deletedByName: string | null;
  deletedById: string | null;
  deletedAt: string;
  deletedAttachments: ConversationAttachment[];
}

export interface ConversationMessage {
  id: string;
  roomId: string;
  body: string;
  attachments: ConversationAttachment[];
  mentions: string[];
  deletedAt: string | null;
  editedAt: string | null;
  createdAt: string;
  author: ConversationAuthor;
  canDelete: boolean;
  canEdit: boolean;
  moderation: ConversationModerationSnapshot | null;
  reactions: ConversationReaction[];
  optimistic?: boolean;
}

export interface ConversationMessagesPage {
  messages: ConversationMessage[];
  pageInfo: {
    hasMore: boolean;
    nextCursor: string | null;
  };
}

export interface ConversationPresence {
  roomId: string;
  userId: string;
  name: string | null;
  image: string | null;
  lastSeenAt: string;
}

export type PinnedItemKind = 'issue' | 'doc' | 'project' | 'chat' | 'custom' | 'view' | string;

export interface PinnedItem {
  id: string;
  userId?: string | null;
  kind: PinnedItemKind;
  entityId: string | null;
  title: string;
  href: string;
  pinnedAt: string;
}

export interface StandupDigest {
  id: string;
  date: string;
  contentMd: string;
  blockersMd: string;
  createdAt: string;
}

export type TemplateKind = 'project' | 'issue' | 'doc' | string;
export type TemplateCategory =
  | 'engineering'
  | 'design'
  | 'product'
  | 'qa'
  | 'ops'
  | 'general'
  | string;

export interface WorkTemplate {
  id: string;
  organizationId: string | null;
  name: string;
  description: string | null;
  category: TemplateCategory;
  icon: string | null;
  color: string | null;
  kind: TemplateKind;
  payload: Record<string, unknown>;
  usageCount: number;
  isPublic: boolean;
  isVerified: boolean;
  createdBy?: string | null;
  createdAt?: string;
  updatedAt?: string;
}

export interface TemplatesListResponse {
  templates: WorkTemplate[];
  canAdminister: boolean;
  adminOrganizationIds: string[];
  memberOrganizationIds: string[];
}

export interface UseTemplateOverrides {
  name?: string;
  key?: string;
  title?: string;
  projectId?: string;
  description?: string | null;
}

export interface UseTemplateResult {
  kind: TemplateKind;
  resource?: {
    id: string;
    key?: string | null;
    name?: string | null;
    title?: string | null;
    projectId?: string | null;
  };
  payload?: Record<string, unknown>;
  templateId?: string;
  message?: string;
}

export type DraftEntityType = 'issue' | 'doc' | 'other' | string;

export interface Draft {
  id: string;
  title: string;
  content: string | null;
  entityType: DraftEntityType;
  organizationId?: string | null;
  targetProjectId?: string | null;
  metadata: Record<string, unknown>;
  createdAt?: string;
  updatedAt?: string;
}

export interface ApiKey {
  id: string;
  name: string;
  keyPrefix: string;
  isActive: boolean;
  lastUsedAt: string | null;
  expiresAt: string | null;
  revokedAt: string | null;
  createdAt?: string;
  key?: string;
}

export interface Webhook {
  id: string;
  name: string;
  url: string;
  events: string[];
  isActive: boolean;
  lastTriggeredAt: string | null;
  successCount: number;
  failureCount: number;
  createdAt?: string;
  updatedAt?: string;
  secret?: string;
}

export interface WebhookTestResult {
  success: boolean;
  statusCode: number | null;
  responseSnippet?: string;
  durationMs: number;
  error?: string;
}

export interface AuditLogChange {
  from?: unknown;
  to?: unknown;
}

export interface AuditLogEntry {
  id: string;
  action: string;
  resourceType: string;
  resourceId: string;
  projectId: string | null;
  issueId: string | null;
  changes: Record<string, AuditLogChange> | null;
  metadata: Record<string, unknown> | null;
  createdAt?: string;
  user: User | null;
}

export type AgentPolicyEffect = 'allow' | 'deny' | 'require_approval' | string;
export type AgentApprovalStatus = 'pending' | 'approved' | 'rejected' | 'expired' | string;

export interface AgentPolicyRule {
  actor: string;
  actorKind: 'agent' | 'unknown' | string;
  resource: string;
  action: string;
  effect: AgentPolicyEffect;
  approvers: string[];
  raw: string;
  line: number;
  sourcePath?: string;
}

export interface AgentPolicyParseError {
  line: number;
  message: string;
  raw: string;
}

export interface AgentPolicyStatus {
  enabled: boolean;
  found: boolean;
  sourcePath: string | null;
  parsedAt: string | null;
  errors: AgentPolicyParseError[];
  rules: AgentPolicyRule[];
}

export interface AgentApprovalRequest {
  id: string;
  workspaceId: string;
  projectId: string | null;
  requestedBy: string | null;
  actor: string;
  resource: string;
  action: string;
  targetType: string;
  targetId: string | null;
  proposedPayload: unknown;
  matchedRule: string | null;
  decisionReason: string | null;
  status: AgentApprovalStatus;
  requestedAt: string | null;
  expiresAt: string | null;
  decidedBy: string | null;
  decidedAt: string | null;
  createdAt?: string;
  updatedAt?: string;
}

export interface AgentApprovalDecisionResult {
  approval: AgentApprovalRequest;
  result?: Record<string, unknown>;
}

export type RegistrationMode = 'allow_registration' | 'invite_only' | 'admin_created_only';

export interface RegistrationPolicy {
  mode: RegistrationMode;
  updatedAt?: string;
  updatedBy?: string;
}

export interface AdminStatsOverview {
  totalOrganizations: number;
  totalUsers: number;
  activeUsers: number;
  superAdmins: number;
  totalProjects: number;
  totalIssues: number;
  totalComments: number;
}

export interface AdminStatsResponse {
  overview: AdminStatsOverview;
  organizations: {
    byStatus: Record<string, number>;
    byPlan: Record<string, number>;
  };
  growth: {
    newOrganizations30d: number;
    newUsers30d: number;
  };
}

export interface AdminDirectoryPagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export type AdminOrganizationPlan = 'free' | 'starter' | 'growth' | 'enterprise' | string;
export type AdminOrganizationStatus = 'active' | 'trial' | 'suspended' | string;
export type AdminUserStatus = 'active' | 'inactive' | 'invited' | string;

export interface AdminDirectoryOwner {
  id: string;
  name: string | null;
  email: string;
  image: string | null;
}

export interface AdminOrganizationSummary {
  id: string;
  name: string;
  slug: string;
  plan: AdminOrganizationPlan;
  status: AdminOrganizationStatus;
  domain: string | null;
  logoUrl: string | null;
  stats: {
    members: number;
    projects: number;
    issues: number;
  };
  owner: AdminDirectoryOwner | null;
  createdAt?: string;
  updatedAt?: string;
}

export interface AdminOrganizationsResponse {
  organizations: AdminOrganizationSummary[];
  pagination: AdminDirectoryPagination;
}

export interface AdminUserOrganizationMembership {
  organizationId: string;
  organizationName: string;
  role: string;
}

export interface AdminUserProjectMembership {
  projectId: string;
  projectKey: string;
  projectName: string;
  organizationId: string;
  organizationName: string | null;
  role: string;
}

export interface AdminUserLastActivity {
  action: string;
  resourceType: string;
  resourceId: string | null;
  projectId: string | null;
  createdAt: string;
  scope: 'system' | 'workspace' | string;
}

export interface AdminUserSummary {
  id: string;
  name: string | null;
  email: string;
  image: string | null;
  status: AdminUserStatus;
  isSuperAdmin: boolean;
  superAdminGrantedAt: string | null;
  emailVerified: string | null;
  lastSeenAt: string | null;
  createdAt?: string;
  organizations: AdminUserOrganizationMembership[];
  projectMemberships: AdminUserProjectMembership[];
  lastActivity: AdminUserLastActivity | null;
}

export interface AdminUsersResponse {
  users: AdminUserSummary[];
  pagination: AdminDirectoryPagination;
}

export interface AdminSmtpConfig {
  host: string;
  port: number;
  secure: boolean;
  user: string;
  passwordPreview: string | null;
  emailFrom: string;
  updatedAt: string | null;
  updatedBy: string | null;
  configured: boolean;
}

export interface AdminStorageConfig {
  uploadsDir: string;
  s3Bucket: string;
  s3Region: string;
  s3AccessKey: string;
  s3SecretKeyPreview: string | null;
  updatedAt: string | null;
  updatedBy: string | null;
  configured: boolean;
}

export interface AdminLivekitConfig {
  url: string;
  apiKey: string;
  apiSecretPreview: string | null;
  updatedAt: string | null;
  updatedBy: string | null;
  configured: boolean;
}

export interface AdminSystemTestResult {
  success: boolean;
  source: 'db' | 'env' | string | null;
  error: string | null;
  messageId?: string;
  recipient?: string;
  url?: string;
  roomName?: string;
  tokenPreview?: string;
}

export interface AdminAgentControlSettings {
  globalEnabled: boolean;
  allowWriteActions: boolean;
  requireSupervisionForAutoMode: boolean;
  maxConcurrentRuns: number;
}

export interface AdminAgentControlStats {
  enabledWorkspaceCount: number;
  enabledProjectCount: number;
  recentRunCount: number;
  runningRuns: number;
  failedRuns: number;
  readyWorkspaceCount: number;
  blockedWorkspaceCount: number;
}

export interface AdminAgentServiceStatus {
  key: string;
  label: string;
  state: string;
  detail: string;
}

export interface AdminAgentProviderBreakdownItem {
  provider: string;
  total: number;
  enabled: number;
  ready: number;
  blocked: number;
}

export interface AdminAgentProviderStatus {
  ready: boolean;
  summary: string;
  configured: boolean;
  source: 'workspace' | 'platform' | 'server_env' | string | null;
  label: string | null;
  updatedAt: string | null;
}

export interface AdminAgentWorkspaceCoverage {
  organizationId: string;
  organizationName: string;
  workspaceEnabled: boolean;
  enabledProjects: number;
  provider: string;
  model: string;
  selectedModelConfigId: string | null;
  selectedModelConfigName: string | null;
  executionMode: string;
  providerStatus: AdminAgentProviderStatus;
  lastRunAt: string | null;
  lastFailure: string | null;
}

export interface AdminAgentRecentRun {
  id: string;
  kind: string;
  status: string;
  dryRun: boolean;
  summary: string | null;
  writeActionsCount: number;
  createdAt: string | null;
  error: string | null;
  organizationId: string | null;
  organizationName: string | null;
  projectId: string | null;
  projectName: string | null;
  initiatedBy: string | null;
}

export interface AdminAgentControlResponse {
  settings: AdminAgentControlSettings;
  stats: AdminAgentControlStats;
  serviceStatus: AdminAgentServiceStatus[];
  providerBreakdown: AdminAgentProviderBreakdownItem[];
  workspaceCoverage: AdminAgentWorkspaceCoverage[];
  recentRuns: AdminAgentRecentRun[];
}

export type AiProvider = 'native' | 'openai' | 'anthropic' | 'azure' | 'custom' | string;
export type AiOversightMode = 'auto' | 'review_required';
export type AiSafetyMode = 'off' | 'warn' | 'strict' | string;

export interface AgentModelConfig {
  id: string;
  organizationId: string;
  name: string;
  provider: AiProvider;
  model: string;
  description: string | null;
  isDefault: boolean;
  isArchived: boolean;
  revisionCount: number;
  createdAt: string | null;
  updatedAt: string | null;
}

export interface OrganizationAgentWorkspaceSettings {
  enabled: boolean;
  assistantEnabled: boolean;
  modelConfigId: string | null;
  provider: AiProvider;
  model: string;
  executionMode: 'manual' | 'assistive' | 'auto' | string;
  allowWriteActions: boolean;
  requireApprovalForWrites: boolean;
  aiOversight: AiOversightMode;
  aiSafetyMode: AiSafetyMode;
  dailyRunLimit: number;
  capabilities: Record<string, boolean>;
}

export interface OrganizationAgentAccess {
  canView: boolean;
  canManage: boolean;
  orgRole: string | null;
  isSuperAdmin: boolean;
}

export interface OrganizationAgentConfigIssue {
  code: string;
  scope: string;
  severity: 'error' | 'warning' | 'info' | string;
  title: string;
  detail: string;
  resolution: string;
  blocksRuns: boolean;
}

export interface OrganizationAgentRuntimeSummary {
  projectCount: number;
  enabledProjectCount: number;
  runningRuns: number;
  totalRuns: number;
  lastRunAt: string | null;
  lastCompletedAt: string | null;
  lastFailedAt: string | null;
  lastFailure: string | null;
}

export interface OrganizationAgentRecentRun {
  id: string;
  kind: string;
  status: string;
  dryRun: boolean;
  summary: string | null;
  writeActionsCount: number;
  createdAt: string | null;
  completedAt: string | null;
  error: string | null;
  projectId: string | null;
  projectName: string | null;
  initiatedBy: string | null;
}

export interface OrganizationAgentSettingsResponse {
  organizationId: string;
  organizationName: string;
  workspaceSettings: OrganizationAgentWorkspaceSettings;
  selectedModelConfig: AgentModelConfig | null;
  modelConfigs: AgentModelConfig[];
  access: OrganizationAgentAccess;
  providerStatus: AdminAgentProviderStatus;
  configIssues: OrganizationAgentConfigIssue[];
  runtimeSummary: OrganizationAgentRuntimeSummary;
  serviceStatus: AdminAgentServiceStatus[];
  recentRuns: OrganizationAgentRecentRun[];
  updatedAt: string | null;
}

export interface AiCapability {
  platformEnabled: boolean;
  llm: {
    provider: AiProvider;
    model: string;
    configured: boolean;
    source: string | null;
  };
  assistantEnabled: boolean;
  canDraft: boolean;
  agentsEnabled: boolean;
  canRunAgents: boolean;
}

export interface IssueTriagePayload {
  labels?: string[];
  priority?: string;
  suggested_assignee_id?: string | null;
  team_id?: string | null;
  confidence?: number;
  rationale?: string;
}

export interface IssueTriageSuggestion {
  id: string;
  issueId: string;
  payload: IssueTriagePayload;
  confidence: number;
  appliedAt: string | null;
  dismissedAt: string | null;
  createdAt: string;
}

export interface IssueTriageResponse {
  suggestions: IssueTriageSuggestion[];
}

export interface RunIssueTriageResponse {
  suggestion: IssueTriageSuggestion;
  payload: IssueTriagePayload;
}

export interface ApplyIssueTriageResponse {
  success: boolean;
  applied: Record<string, unknown>;
  suggestionId: string;
  autoApplied: boolean;
  threshold: number;
}

export type IssueAssistAction = 'summarize' | 'rewrite' | 'suggest_next' | 'suggest_labels';

export interface IssueAssistResult {
  text: string;
  labels?: string[];
  provider: AiProvider;
}

export interface ProjectAgentAccess {
  canView: boolean;
  canManage: boolean;
  orgRole: string | null;
  projectRole: string | null;
  isSuperAdmin: boolean;
}

export interface ProjectAgentSettings {
  enabled: boolean;
  inheritWorkspaceDefaults: boolean;
  executionMode: 'manual' | 'assistive' | 'auto' | string;
  allowWriteActions: boolean;
  sprintBatchSize: number;
  sprintLengthDays: number;
  issueCapacityPerSprint: number;
  autoAssignToPlannedSprints: boolean;
  capabilities: Record<string, boolean>;
}

export interface ProjectAgentEffectiveSettings {
  enabled: boolean;
  allowWriteActions: boolean;
  executionMode: 'manual' | 'assistive' | 'auto' | string;
  provider: AiProvider;
  model: string;
  requireApprovalForWrites: boolean;
  dailyRunLimit: number;
  sprintBatchSize: number;
  sprintLengthDays: number;
  issueCapacityPerSprint: number;
  autoAssignToPlannedSprints: boolean;
  capabilities: Record<string, boolean>;
}

export interface ProjectAgentRuntimeSummary {
  runningRuns: number;
  lastRunAt: string | null;
  lastCompletedAt: string | null;
  lastFailedAt: string | null;
  lastFailure: string | null;
}

export interface ProjectAgentRunAvailability {
  canRun: boolean;
  reason: string | null;
}

export interface ProjectAgentSettingsResponse {
  project: {
    id: string;
    key: string;
    name: string;
  };
  access: ProjectAgentAccess;
  workspaceSettings: OrganizationAgentWorkspaceSettings;
  selectedModelConfig: AgentModelConfig | null;
  projectSettings: ProjectAgentSettings;
  effectiveSettings: ProjectAgentEffectiveSettings;
  providerStatus: AdminAgentProviderStatus;
  configIssues: OrganizationAgentConfigIssue[];
  runtimeSummary: ProjectAgentRuntimeSummary;
  runAvailability: ProjectAgentRunAvailability;
  serviceStatus: AdminAgentServiceStatus[];
  lastRunByKind: Record<string, OrganizationAgentRecentRun>;
  recentRuns: OrganizationAgentRecentRun[];
}

export interface UpdateOrganizationAgentSettingsInput {
  organizationId: string;
  enabled?: boolean;
  assistantEnabled?: boolean;
  modelConfigId?: string | null;
  provider?: AiProvider;
  model?: string;
  executionMode?: 'manual' | 'assistive' | 'auto' | string;
  allowWriteActions?: boolean;
  requireApprovalForWrites?: boolean;
  aiOversight?: AiOversightMode;
  aiSafetyMode?: AiSafetyMode;
  dailyRunLimit?: number;
  capabilities?: Record<string, boolean>;
}

export interface UpdateProjectAgentSettingsInput {
  enabled?: boolean;
  inheritWorkspaceDefaults?: boolean;
  executionMode?: 'manual' | 'assistive' | 'auto' | string;
  allowWriteActions?: boolean;
  sprintBatchSize?: number;
  sprintLengthDays?: number;
  issueCapacityPerSprint?: number;
  autoAssignToPlannedSprints?: boolean;
  capabilities?: Record<string, boolean>;
}

export type WorkspaceIntegrationProvider = 'github' | 'gitlab' | 'jira' | 'sentry' | 'slack';

export interface WorkspaceIntegrationConnection {
  id: string;
  provider: WorkspaceIntegrationProvider;
  externalAccountId: string | null;
  externalAccountLabel: string | null;
  scope: string | null;
  metadata: Record<string, unknown> | null;
  connectedById: string | null;
  createdAt: string | null;
  updatedAt: string | null;
  siteUrl?: string | null;
  siteName?: string | null;
}

export interface WorkspaceIntegrationStatus {
  provider: WorkspaceIntegrationProvider;
  connected: boolean;
  connection: WorkspaceIntegrationConnection | null;
}

export interface WorkspaceIntegrationAuthorizeResponse {
  provider: WorkspaceIntegrationProvider;
  authorizeUrl: string;
}

export type ImportSource = 'csv' | 'linear' | 'jira' | 'github' | string;
export type ImportJobStatusValue = 'pending' | 'running' | 'completed' | 'failed' | string;

export interface ImportPreviewRecord {
  key: string;
  title: string;
  description: string | null;
  status: string | null;
  priority: string | null;
  labels: string[];
  assigneeEmail: string | null;
  parentKey?: string | null;
  createdAt?: string | null;
}

export interface ImportPreviewResponse {
  source: ImportSource;
  total: number;
  sample: ImportPreviewRecord[];
  suggestedMapping: Record<string, string>;
}

export interface ImportJobError {
  key?: string;
  message: string;
}

export interface ImportRunResponse {
  jobId: string;
  status: ImportJobStatusValue;
}

export interface ImportJobStatus {
  id: string;
  workspaceId: string;
  source: ImportSource;
  status: ImportJobStatusValue;
  total: number;
  processed: number;
  errors: ImportJobError[];
  mapping?: Record<string, unknown>;
  createdAt?: string | null;
  finishedAt?: string | null;
}

export type SsoProvider = 'saml' | 'oidc';

export interface SsoConfig {
  id: string;
  workspaceId: string;
  provider: SsoProvider;
  entryPointUrl: string;
  issuer: string;
  cert: string;
  audience: string;
  attributeMap: Record<string, string>;
  enabled: boolean;
  hasPrivateKey: boolean;
  createdAt?: string | null;
  updatedAt?: string | null;
}

export interface SsoConfigResponse {
  ssoConfig: SsoConfig | null;
}

export interface ScimToken {
  id: string;
  name: string;
  createdAt: string;
  lastUsedAt: string | null;
  revokedAt: string | null;
}

export interface ScimTokensResponse {
  tokens: ScimToken[];
}

export interface CreatedScimToken {
  id: string;
  name: string;
  token: string;
  createdAt: string;
}

export type AuditLogSinkType = 'webhook' | 'splunk_hec' | 'datadog' | 's3' | string;

export interface AuditLogSink {
  id: string;
  type: AuditLogSinkType;
  name: string;
  config: Record<string, unknown>;
  enabled: boolean;
  lastDeliveryAt: string | null;
  lastError: string | null;
  successCount: number;
  failureCount: number;
  createdAt: string;
  updatedAt: string | null;
}

export interface CreatedAuditLogSink extends AuditLogSink {
  signingSecret: string;
}

export interface AuditLogSinksResponse {
  sinks: AuditLogSink[];
}

export interface AuditLogSinkTestResult {
  ok: boolean;
  statusCode: number | null;
  error: string | null;
}

export interface AdminVersionImageStatus {
  repository: string;
  latestTag: string | null;
  latestTagUrl: string | null;
  latestPushedAt: string | null;
  latestDigest: string | null;
  latestSizeBytes: number | null;
  updateAvailable: boolean;
  checkedAt: string | null;
}

export interface AdminSelfUpdateStatus {
  enabled: boolean;
  available: boolean;
  mode: 'external-webhook' | 'manual' | string;
  blockedReason: string | null;
  targetVersion: string | null;
  repository: string;
  digest: string | null;
  imageRef: string | null;
  webhookConfigured: boolean;
  manualCommands: string;
}

export interface AdminVersionStatus {
  current: string;
  latest: string | null;
  releaseUpdateAvailable: boolean;
  updateAvailable: boolean;
  releaseUrl: string | null;
  publishedAt: string | null;
  notes: string | null;
  checkedAt: string | null;
  image: AdminVersionImageStatus;
  checkDisabled: boolean;
  selfUpdate: AdminSelfUpdateStatus | null;
}

export interface AdminAiUsageLimits {
  dailyTokens: number | null;
  monthlyTokens: number | null;
  dailyCostUsd: number | null;
  monthlyCostUsd: number | null;
}

export interface AdminAiReservedUsage {
  dailyTokens: number;
  monthlyTokens: number;
  dailyCostUsd: number;
  monthlyCostUsd: number;
}

export interface AdminAiActualUsage {
  callsToday: number;
  callsMonth: number;
  tokensToday: number;
  tokensMonth: number;
  costTodayUsd: number;
  costMonthUsd: number;
  budgetExhaustedMonth: number;
  errorsMonth: number;
}

export interface AdminAiUsageHistoryEntry {
  day: string;
  calls: number;
  tokens: number;
  cost: number;
}

export interface AdminAiFeatureUsage {
  feature: string;
  calls: number;
  tokens: number;
  cost: number;
}

export interface AdminAiUsageOrganization {
  organizationId: string;
  organizationName: string;
  limits: AdminAiUsageLimits;
  reservedUsage: AdminAiReservedUsage;
  actualUsage: AdminAiActualUsage;
  killSwitchEnabled: boolean;
  periodResetsAt: string | null;
  history: AdminAiUsageHistoryEntry[];
  featureBreakdown: AdminAiFeatureUsage[];
}

export interface AdminAiUsageResponse {
  generatedAt: string | null;
  windowDays: number;
  dayStart: string | null;
  monthStart: string | null;
  organizations: AdminAiUsageOrganization[];
}

export type AdminAiUsageResetScope = 'daily' | 'monthly' | 'both';

export interface AdminAiKillSwitchResult {
  ok: boolean;
  organizationId: string;
  killSwitchEnabled: boolean;
}

export interface AdminAiUsageResetResult {
  ok: boolean;
  scope: AdminAiUsageResetScope;
  organizationId?: string;
}

export interface AdminFeatureFlag {
  id: string;
  key: string;
  name: string;
  description: string | null;
  isEnabled: boolean;
  enabledForPlans: string[];
  enabledForOrganizations: string[];
  rolloutPercentage: number;
  metadata: Record<string, unknown>;
  createdBy: string | null;
  updatedBy: string | null;
  createdAt?: string;
  updatedAt?: string;
}

export interface AdminRealtimeHealth {
  services: {
    redis: {
      ready: boolean;
      mode: string;
    };
    livekit: {
      ready: boolean;
      url: string | null;
      missing: string[];
    };
  };
  stats: {
    channels: number;
    rooms: number;
    activeCalls: number;
    readStates: number;
  };
}

export interface SystemAuditLogEntry {
  id: string;
  action: string;
  resourceType: string;
  resourceId: string | null;
  organizationId: string | null;
  changes: Record<string, AuditLogChange> | null;
  metadata: Record<string, unknown> | null;
  ipAddress: string | null;
  userAgent: string | null;
  createdAt?: string;
  user: {
    id: string | null;
    name: string | null;
    email: string | null;
    image?: string | null;
  } | null;
}

export interface OrganizationMember {
  id: string;
  name: string | null;
  email: string;
  image?: string | null;
  status?: string | null;
  role: 'owner' | 'admin' | 'member' | 'viewer' | 'guest' | string;
  memberStatus?: string | null;
  joinedAt?: string;
  isAgent?: boolean;
  agentProvider?: string | null;
}

export type OrganizationPlan = 'free' | 'starter' | 'growth' | 'enterprise' | string;
export type OrganizationStatus = 'active' | 'trial' | 'suspended' | string;
export type OrganizationRole = 'owner' | 'admin' | 'member' | 'viewer' | 'guest' | string;

export interface OrganizationStats {
  members: number;
  projects: number;
  teams: number;
  apiKeys: number;
}

export interface Organization {
  id: string;
  name: string;
  slug: string;
  domain?: string | null;
  logoUrl?: string | null;
  plan: OrganizationPlan;
  status: OrganizationStatus;
  settings?: Record<string, unknown>;
  role?: OrganizationRole | null;
  userRole?: OrganizationRole | null;
  isSuperAdmin?: boolean;
  stats?: OrganizationStats;
  createdAt?: string;
  updatedAt?: string;
}

export interface OrganizationsResponse {
  canCreateOrganizations: boolean;
  organizations: Organization[];
}

export interface TeamspaceLead {
  id: string;
  name?: string | null;
  email?: string | null;
  image?: string | null;
}

export interface Teamspace {
  id: string;
  organizationId: string;
  name: string;
  slug: string;
  description?: string | null;
  avatarUrl?: string | null;
  leadId?: string | null;
  settings?: Record<string, unknown>;
  isMember?: boolean;
  currentUserRole?: 'lead' | 'member' | string | null;
  memberCount?: number;
  projectCount?: number;
  lead?: TeamspaceLead | null;
  createdAt?: string;
  updatedAt?: string;
}

export type TeamspaceMemberRole = 'lead' | 'member' | string;

export interface TeamspaceMember {
  id: string;
  teamRole: TeamspaceMemberRole;
  joinedAt?: string;
  name: string | null;
  email: string;
  image?: string | null;
  status?: string | null;
}

export interface TeamspaceMembersResponse {
  team: Teamspace | null;
  members: TeamspaceMember[];
}

export interface Label {
  id: string;
  organizationId: string;
  projectId?: string | null;
  name: string;
  color?: string | null;
  description?: string | null;
  usageCount?: number;
  createdAt?: string;
  updatedAt?: string;
  createdBy?: string | null;
}

export type ComponentDefaultAssigneeType =
  | 'project_default'
  | 'component_lead'
  | 'unassigned'
  | string;

export interface ProjectComponent {
  id: string;
  organizationId: string;
  projectId: string;
  name: string;
  description?: string | null;
  leadId?: string | null;
  defaultAssigneeType: ComponentDefaultAssigneeType;
  archived: boolean;
  issueCount?: number;
  createdAt?: string;
  updatedAt?: string;
}

export type ProjectVersionStatus = 'unreleased' | 'released' | 'archived' | string;

export interface ProjectVersion {
  id: string;
  organizationId: string;
  projectId: string;
  name: string;
  description?: string | null;
  status: ProjectVersionStatus;
  startDate?: string | null;
  releaseDate?: string | null;
  releasedAt?: string | null;
  sortOrder?: number;
  issueCount?: number;
  doneIssueCount?: number;
  createdBy?: string | null;
  createdAt?: string;
  updatedAt?: string;
}

export interface IssueVersions {
  fixVersions: ProjectVersion[];
  affectsVersions: ProjectVersion[];
}

export type IssueLinkType =
  | 'blocks'
  | 'blocked_by'
  | 'relates_to'
  | 'duplicates'
  | 'duplicated_by'
  | 'parent_of'
  | 'child_of';

export type IssueLinkDirection = 'outbound' | 'inbound';

export interface LinkedIssue {
  id: string;
  key?: string | null;
  title: string;
  statusId?: string | null;
  type?: IssueType | string | null;
  priority?: IssuePriority | string | null;
}

export interface IssueLink {
  id: string;
  type: IssueLinkType;
  direction: IssueLinkDirection;
  issue: LinkedIssue;
  createdAt?: string;
}

export interface IssueLinksData {
  outbound: IssueLink[];
  inbound: IssueLink[];
}

export interface IssueActivity {
  id: string;
  issueId: string;
  userId?: string | null;
  type: string;
  field?: string | null;
  oldValue?: string | null;
  newValue?: string | null;
  metadata?: unknown;
  createdAt: string;
  updatedAt?: string;
  user?: User | null;
}

export interface IssueAttachment {
  id: string;
  issueId: string;
  fileName: string;
  fileSize: number;
  mimeType?: string | null;
  filePath: string;
  uploadedById?: string | null;
  createdAt?: string;
}

export interface DocumentAttachment {
  id: string;
  pageId: string;
  fileName: string;
  fileSize: number;
  mimeType?: string | null;
  filePath: string;
  uploadedById?: string | null;
  createdAt?: string;
}

export type TimeEntrySource = 'manual' | 'timer' | 'github_inferred' | 'integration' | string;
export type EstimateSource = 'manual' | 'ai_suggest' | string;

export interface TimeEntry {
  id: string;
  issueId: string;
  userId?: string | null;
  startedAt: string;
  endedAt?: string | null;
  durationSeconds?: number | null;
  description?: string | null;
  source?: TimeEntrySource | null;
  integrationRef?: string | null;
  createdAt?: string;
  updatedAt?: string;
}

export interface IssueTimeInStatusBucket {
  status: string;
  statusName: string;
  statusCategory?: string | null;
  totalDurationSeconds: number;
  enteredAtLast?: string | null;
  exitCount: number;
}

export type CustomFieldType =
  | 'text'
  | 'number'
  | 'date'
  | 'select'
  | 'multi_select'
  | 'checkbox'
  | 'url'
  | 'email'
  | string;

export interface CustomField {
  id: string;
  organizationId?: string | null;
  projectId?: string | null;
  name: string;
  description?: string | null;
  type: CustomFieldType;
  isRequired: boolean;
  defaultValue?: string | null;
  options?: string | null;
  position?: number;
  isActive?: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export interface IssueCustomFieldValue {
  id: string;
  customFieldId: string;
  value: string | null;
  createdAt?: string;
  updatedAt?: string;
  field: CustomField;
}

export type IssueType = 'story' | 'task' | 'bug' | 'epic' | 'subtask';
export type IssuePriority = 'critical' | 'high' | 'medium' | 'low' | 'none';
export type IssueResolution =
  | 'fixed'
  | 'wont_do'
  | 'duplicate'
  | 'cannot_reproduce'
  | 'done'
  | string;
export type IssueStatusCategory =
  | 'backlog'
  | 'todo'
  | 'in_progress'
  | 'in_review'
  | 'done'
  | 'cancelled'
  | string;

export interface IssueStatus {
  id: string;
  name: string;
  category?: IssueStatusCategory;
  color?: string | null;
}

export interface WorkflowStatus {
  id: string;
  workflowId?: string;
  name: string;
  category: IssueStatusCategory;
  color: string | null;
  position?: number;
  createdAt?: string;
  updatedAt?: string;
}

export interface WorkflowTransition {
  id: string;
  workflowId?: string;
  name?: string | null;
  fromStatusId: string;
  toStatusId: string;
  conditions?: unknown;
  validators?: unknown;
  postActions?: unknown;
  createdAt?: string;
  updatedAt?: string;
}

export interface ProjectWorkflowTransitionsResponse {
  statuses: WorkflowStatus[];
  transitions: WorkflowTransition[];
}

export interface IssueProjectSummary {
  id?: string;
  key?: string | null;
  name?: string | null;
}

export interface Issue {
  id: string;
  key?: string;
  projectId: string;
  project?: IssueProjectSummary | null;
  organizationId?: string;
  type: IssueType;
  title: string;
  description?: string | null;
  priority?: IssuePriority | null;
  status?: IssueStatus | null;
  statusId?: string | null;
  assigneeId?: string | null;
  assignee?: User | null;
  reporter?: User | null;
  labels?: string[];
  resolution?: IssueResolution | null;
  resolvedAt?: string | null;
  sprintId?: string | null;
  epicId?: string | null;
  parentId?: string | null;
  estimate?: number | null;
  estimateHours?: number | null;
  actualHours?: number | null;
  estimateSource?: EstimateSource | null;
  storyPoints?: number | null;
  flagged?: boolean;
  dueDate?: string | null;
  customFields?: Record<string, unknown> | null;
  createdAt?: string;
  updatedAt?: string;
}

export interface IssueListResponse {
  issues: Issue[];
  total?: number;
}

export type MyIssueView = 'assigned' | 'created' | 'subscribed' | 'mentioned';

export interface MyIssuesResponse {
  issues: Issue[];
  view?: MyIssueView;
}

export type MyWorkloadWindow = 'today' | 'this_week' | 'this_sprint' | 'overdue';

export interface MyWorkloadResponse {
  window: MyWorkloadWindow;
  total: number;
  countsByStatus: Record<string, number>;
  countsByPriority: Record<string, number>;
  overdue: number;
  dueSoon: number;
  issues: Issue[];
}

export type SearchEntityType = 'issue' | 'comment' | string;

export interface SearchResult {
  id: string;
  entityType: SearchEntityType;
  issueId: string;
  key?: string | null;
  title: string;
  snippet?: string | null;
  projectId?: string | null;
  score?: number | null;
}

export interface SearchResponse {
  results: SearchResult[];
  count?: number;
  query?: string;
}

export interface SearchHistoryEntry {
  id: string;
  organizationId: string;
  projectId: string | null;
  query: string;
  criteria: Record<string, unknown>;
  resultCount: number;
  pinned: boolean;
  createdAt?: string;
}

export type DocumentSpaceScope = 'organization' | 'project' | string;

export interface DocumentPermissions {
  canBrowse?: boolean;
  canCreate?: boolean;
  canEdit?: boolean;
  canDelete?: boolean;
}

export interface DocumentSpace {
  id: string;
  organizationId: string;
  projectId?: string | null;
  scope: DocumentSpaceScope;
  name: string;
  slug?: string;
  description?: string | null;
  isDefault?: boolean;
  permissions?: DocumentPermissions;
}

export interface DocumentScopeParams {
  organizationId?: string | null;
  projectId?: string | null;
}

export interface DocumentPageSummary {
  id: string;
  spaceId: string;
  organizationId?: string;
  projectId?: string | null;
  parentId?: string | null;
  title: string;
  slug?: string;
  icon?: string | null;
  excerpt?: string | null;
  currentRevision?: number;
  position?: number;
  isArchived?: boolean;
  createdAt?: string;
  updatedAt?: string;
  createdBy?: string;
  updatedBy?: string;
  spaceName?: string | null;
}

export interface DocumentShareSettings {
  canManagePublic: boolean;
  internalPath: string;
  public: {
    enabled: boolean;
    urlPath: string | null;
    allowSearchIndexing: boolean;
    includeAttachments: boolean;
    publishedAt: string | null;
  };
}

export interface PublicDocumentAttachment {
  id: string;
  fileName: string;
  fileSize: number;
  mimeType: string;
  publicUrl: string;
}

export interface PublicDocumentPage {
  id: string;
  title: string;
  slug: string;
  excerpt?: string | null;
  updatedAt: string;
  publishedAt?: string | null;
  allowSearchIndexing: boolean;
  includeAttachments: boolean;
  contentJson?: Record<string, unknown>;
  attachments: PublicDocumentAttachment[];
}

export interface IssueDocument extends DocumentPageSummary {
  linkId?: string | null;
}

export interface DocumentPage extends DocumentPageSummary {
  contentJson?: Record<string, unknown>;
  contentText?: string;
  permissions?: DocumentPermissions;
  backlinks?: Array<{ id: string; title: string; slug?: string; projectId?: string | null }>;
  relatedIssues?: Array<{
    linkId?: string;
    id: string;
    key?: string;
    title: string;
    projectId?: string;
    priority?: string;
    statusId?: string;
  }>;
  revisionCount?: number;
  space?: DocumentSpace;
  share?: DocumentShareSettings;
}

export interface DocumentPagesResponse {
  space?: DocumentSpace | null;
  permissions?: DocumentPermissions;
  pages: DocumentPageSummary[];
}

export interface DocumentSearchResponse {
  results: DocumentPageSummary[];
}

export interface DocumentTreeNode extends DocumentPageSummary {
  children: DocumentTreeNode[];
}

export interface DocumentTreeResponse {
  tree: DocumentTreeNode[];
  currentPageId: string;
  space?: DocumentSpace | null;
}

export interface DocumentRevisionAuthor {
  id: string;
  name?: string | null;
  email?: string | null;
  image?: string | null;
}

export interface DocumentRevision {
  id: string;
  pageId: string;
  revision: number;
  title: string;
  contentText?: string;
  excerpt?: string | null;
  changeSummary?: string | null;
  createdAt?: string;
  createdBy?: string | null;
  author?: DocumentRevisionAuthor | null;
}

export interface CreateDocumentPageInput {
  title: string;
  icon?: string | null;
  parentId?: string | null;
  spaceId?: string;
  organizationId?: string;
  projectId?: string;
  changeSummary?: string;
  contentJson?: Record<string, unknown>;
}

export interface UpdateDocumentPageInput {
  title?: string;
  icon?: string | null;
  contentJson?: Record<string, unknown>;
  changeSummary?: string;
  expectedRevision: number;
}

export interface UpdateDocumentShareInput {
  enablePublic?: boolean;
  allowSearchIndexing?: boolean;
  includeAttachments?: boolean;
  regenerateToken?: boolean;
}

export interface RestoreDocumentRevisionInput {
  revision?: number;
  revisionId?: string;
}

export interface CommentReaction {
  emoji: string;
  userId: string;
  createdAt?: string;
}

export interface Comment {
  id: string;
  issueId: string;
  content: string;
  author?: User | null;
  authorId?: string;
  createdBy?: string;
  updatedBy?: string | null;
  parentId?: string | null;
  mentions?: string[];
  reactions?: CommentReaction[];
  edited?: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export interface NotificationItem {
  id: string;
  type: string;
  title?: string;
  message?: string;
  read?: boolean;
  isRead?: boolean;
  actorType?: 'user' | 'agent' | 'webhook' | 'system' | string;
  actor?: User | null;
  issue?: {
    id: string;
    key?: string | null;
    title?: string | null;
  } | null;
  project?: {
    id: string;
    key?: string | null;
    name?: string | null;
  } | null;
  projectId?: string | null;
  issueId?: string | null;
  link?: string | null;
  snoozedUntil?: string | null;
  createdAt?: string;
}

export type InboxActorType = 'user' | 'agent' | 'webhook' | 'system';
export type InboxNotificationType =
  | 'mention'
  | 'assignment'
  | 'due'
  | 'status'
  | 'comment'
  | 'reaction';

export interface InboxFilters {
  actorType?: InboxActorType | null;
  notificationType?: InboxNotificationType | null;
  projectId?: string | null;
  since?: string | null;
  until?: string | null;
  cursor?: string | null;
  limit?: number;
  snoozed?: boolean;
  unreadOnly?: boolean;
}

export interface InboxPage {
  items: NotificationItem[];
  nextCursor: string | null;
}

export type CatchMeUpUrgency = 'high' | 'medium' | 'low' | string;

export interface CatchMeUpActionItem {
  title: string;
  link: string;
  urgency: CatchMeUpUrgency;
}

export type CatchMeUpSource = 'native' | 'anthropic' | 'openai' | string;

export interface CatchMeUpDigest {
  summaryMarkdown: string;
  actionItems: CatchMeUpActionItem[];
  since: string | null;
  source: CatchMeUpSource;
}

export type DigestFrequency = 'none' | 'daily' | 'weekly' | string;

export interface NotificationPreferences {
  id?: string;
  userId?: string;
  organizationId: string;
  enableInApp: boolean;
  enableEmail: boolean;
  digestFrequency: DigestFrequency;
  emailOnAssigned: boolean;
  emailOnMentioned: boolean;
  emailOnCommented: boolean;
  emailOnStatusChanged: boolean;
  emailOnIssueCreated: boolean;
  emailOnSprintStarted: boolean;
  emailOnSprintCompleted: boolean;
  emailOnProjectCreated: boolean;
  emailOnProjectArchived: boolean;
  inAppOnAssigned: boolean;
  inAppOnMentioned: boolean;
  inAppOnCommented: boolean;
  inAppOnStatusChanged: boolean;
  inAppOnIssueCreated: boolean;
  inAppOnSprintStarted: boolean;
  inAppOnSprintCompleted: boolean;
  inAppOnProjectCreated: boolean;
  inAppOnProjectArchived: boolean;
  doNotDisturb: boolean;
  doNotDisturbStart: string | null;
  doNotDisturbEnd: string | null;
  createdAt?: string;
  updatedAt?: string;
}

export type UserAppearanceTheme = 'light' | 'dark' | 'system';
export type UserAppearanceColorTheme =
  | 'default'
  | 'ocean'
  | 'forest'
  | 'sunset'
  | 'purple'
  | 'rose';
export type UserAppearanceVisualStyle = 'modern' | 'minimal' | 'glass';
export type UserAppearanceInterfaceFont = 'brand' | 'ibm';

export interface UserAppearanceSettings {
  userId: string;
  theme: UserAppearanceTheme;
  colorTheme: UserAppearanceColorTheme;
  visualStyle: UserAppearanceVisualStyle;
  interfaceFont: UserAppearanceInterfaceFont;
  animationsEnabled: boolean;
  gradientsEnabled: boolean;
  updatedAt: string | null;
}

export interface Watcher {
  id: string;
  userId: string;
  issueId?: string | null;
  projectId?: string | null;
  createdAt?: string;
  user?: User | null;
}

export type SprintStatus = 'planned' | 'active' | 'completed' | 'cancelled' | string;

export interface Sprint {
  id: string;
  projectId: string;
  name: string;
  goal?: string | null;
  startDate?: string | null;
  endDate?: string | null;
  status: SprintStatus;
  createdAt?: string;
  updatedAt?: string;
  createdBy?: string | null;
  updatedBy?: string | null;
  issueCount?: number;
  completedCount?: number;
  inProgressCount?: number;
  todoCount?: number;
  completedIssuesCount?: number;
  movedToBacklogCount?: number;
}

export interface SprintBurndownPoint {
  date: string;
  ideal: number;
  actual: number | null;
}

export interface SprintBurndownHours {
  totalEstimateHours: number;
  totalActualHours: number;
  completedActualHours: number;
  remainingEstimateHours: number;
}

export interface SprintBurndownAnalytics {
  sprintName: string;
  startDate: string | null;
  endDate: string | null;
  totalPoints: number;
  totalIssues: number;
  completedPoints: number;
  completedIssues: number;
  remainingPoints: number;
  remainingIssues: number;
  burndown: SprintBurndownPoint[];
  hours: SprintBurndownHours | null;
}

export type InitiativeStatus = 'planned' | 'active' | 'paused' | 'complete' | 'cancelled' | string;

export interface Initiative {
  id: string;
  workspaceId: string;
  name: string;
  slug?: string | null;
  description?: string | null;
  status: InitiativeStatus;
  targetDate?: string | null;
  color?: string | null;
  parentInitiativeId?: string | null;
  sortOrder?: number | null;
  children?: Initiative[];
  createdAt?: string;
  updatedAt?: string;
}

export interface InitiativeProject {
  projectId: string;
  projectName?: string | null;
  projectKey?: string | null;
  projectStatus?: string | null;
}

export interface InitiativeDetail {
  initiative: Initiative;
  projects: InitiativeProject[];
  children: Initiative[];
}

export interface InitiativeRollupProject {
  projectId: string;
  projectName?: string | null;
  projectKey?: string | null;
  done: number;
  total: number;
  percent: number;
}

export interface InitiativeRollup {
  initiativeId: string;
  subtreeSize?: number;
  done: number;
  total: number;
  percent: number;
  projectCount: number;
  perProject?: InitiativeRollupProject[];
}

export type InitiativeUpdateStatus = 'green' | 'yellow' | 'red' | string;

export interface InitiativeUpdate {
  id: string;
  initiativeId?: string;
  status: InitiativeUpdateStatus;
  summary: string;
  blockers?: string | null;
  nextSteps?: string | null;
  weekOf?: string;
  createdAt?: string;
  authorId?: string | null;
  authorName?: string | null;
  authorImage?: string | null;
}

export interface HealthResponse {
  status: 'healthy' | 'degraded' | 'unhealthy';
  timestamp?: string;
  version?: string;
  uptime?: number;
  checks?: Record<string, unknown>;
  details?: Record<string, string>;
}
