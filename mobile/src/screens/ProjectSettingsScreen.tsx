import { useCallback, useEffect, useMemo, useRef, useState, type ComponentRef } from 'react';
import { Alert, Share } from 'react-native';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from '@/components/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Controller, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import {
  Archive,
  ArchiveRestore,
  BookOpen,
  Bot,
  Boxes,
  Bug,
  CalendarDays,
  Check,
  Eye,
  Flame,
  FolderCog,
  Hash,
  History,
  KeyRound,
  Layers,
  Link,
  List,
  Lightbulb,
  Lock,
  Mail,
  MessageSquareText,
  Pencil,
  Pin,
  Plus,
  RotateCcw,
  RotateCw,
  Rocket,
  Send,
  Shield,
  Sparkles,
  Star,
  Target,
  Trash2,
  ToggleLeft,
  Type,
  UserPlus,
  Users,
  Webhook as WebhookIcon,
  Workflow,
  X,
  Zap,
  type LucideIcon,
} from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { z } from 'zod';

import {
  Avatar,
  Button,
  ErrorView,
  IconTile,
  Loading,
  Screen,
  ScreenHeader,
  SemanticBadge,
  SurfaceRow,
  TextField,
} from '@/components/ui';
import type { ThemeColors } from '@/design/theme';
import { useThemeColors, useThemeEffects } from '@/design/theme-context';
import type {
  AutomationRule,
  ComponentDefaultAssigneeType,
  CustomField,
  PermissionScheme,
  ProjectComponent,
  ProjectInviteLink,
  ProjectMember,
  ProjectRole,
  ProjectVersion,
  SecurityLevel,
  SecurityLevelMemberType,
  SecurityScheme,
  Webhook,
  WebhookTestResult,
} from '@/api/types';
import {
  useAddProjectMember,
  useAssignProjectPermissionScheme,
  useAssignProjectSecurityScheme,
  useAutomationExecutions,
  useAutomationRules,
  useCreateAutomationRule,
  useCreateCustomField,
  useCreatePermissionScheme,
  useCreateProjectInviteLink,
  useCreateProjectComponent,
  useCreateProjectVersion,
  useCreateSecurityLevel,
  useCreateSecurityScheme,
  useCreateWebhook,
  useCustomFields,
  useDeleteAutomationRule,
  useDeleteCustomField,
  useDeletePermissionScheme,
  useDeleteProjectComponent,
  useDeleteProjectVersion,
  useDeleteSecurityLevel,
  useDeleteSecurityScheme,
  useDeleteWebhook,
  usePermissionSchemes,
  useProject,
  useProjectAgentSettings,
  useProjectComponents,
  useProjectCommunicationsSettings,
  useProjectInviteLinks,
  useProjectPermissionScheme,
  useProjectSecurityScheme,
  useProjectMembers,
  useProjectVersions,
  useOrganizationMembers,
  useReleaseProjectVersion,
  useRemoveProjectMember,
  useRevokeProjectInviteLink,
  useSecuritySchemes,
  useTestWebhook,
  useUpdateAutomationRule,
  useUpdateCustomField,
  useUpdatePermissionScheme,
  useUpdateProject,
  useUpdateProjectAgentSettings,
  useUpdateProjectComponent,
  useUpdateProjectCommunicationsSettings,
  useUpdateProjectMember,
  useUpdateProjectVersion,
  useUpdateSecurityScheme,
  useUpdateWebhook,
  useWebhooks,
} from '@/hooks/queries';
import { initials } from '@/lib/format';
import {
  DEFAULT_ESTIMATE_SCALE,
  PRESET_ESTIMATE_SCALES,
  SUBKINDS_BY_KIND,
  WORK_ITEM_COLOR_SWATCHES,
  WORK_ITEM_CUSTOM_PROPERTY_TYPES,
  WORK_ITEM_ICON_OPTIONS,
  isCustomSubKind,
  kindOfSubKind,
  makeCustomScale,
  useProjectSchemaSettings,
  type EstimateKind,
  type EstimateScale,
  type EstimateSubKind,
  type WorkItemCustomProperty,
  type WorkItemCustomPropertyType,
  type WorkItemIcon,
  type WorkItemTypeDefinition,
} from '@/lib/project-schema-settings';
import type { AppStackParamList, ProjectSettingsSection } from '@/navigation/types';

const PROJECT_STATUSES = ['active', 'on_hold', 'archived'] as const;
const PROJECT_VISIBILITY = ['private', 'internal', 'public'] as const;
const VERSION_STATUSES = ['unreleased', 'released', 'archived'] as const;
const DEFAULT_ASSIGNEE_TYPES = [
  'project_default',
  'component_lead',
  'unassigned',
] as const satisfies readonly ComponentDefaultAssigneeType[];
const CUSTOM_FIELD_TYPES = [
  'text',
  'number',
  'date',
  'select',
  'multi_select',
  'checkbox',
  'url',
  'email',
] as const;
const ESTIMATE_KINDS = ['points', 'categories', 'time'] as const satisfies readonly EstimateKind[];
const MIN_CUSTOM_ESTIMATE_VALUES = 2;
const MAX_CUSTOM_ESTIMATE_VALUES = 32;
const PROJECT_WEBHOOK_EVENTS = [
  'issue.created',
  'issue.updated',
  'issue.deleted',
  'issue.status_changed',
  'issue.assigned',
  'issue.commented',
  'sprint.started',
  'sprint.completed',
  'project.created',
  'project.updated',
] as const;
const PROJECT_DEFAULT_WEBHOOK_EVENTS = ['issue.created', 'issue.updated'];
const PROJECT_COMMUNICATION_TOGGLES = [
  {
    key: 'enabled',
    labelKey: 'settings.projectComms.enabled_label',
    descKey: 'settings.projectComms.enabled_desc',
  },
  {
    key: 'inheritWorkspaceDefaults',
    labelKey: 'settings.projectComms.inherit_label',
    descKey: 'settings.projectComms.inherit_desc',
  },
  {
    key: 'voiceEnabled',
    labelKey: 'settings.projectComms.voice_label',
    descKey: 'settings.projectComms.voice_desc',
  },
  {
    key: 'issueThreadsEnabled',
    labelKey: 'settings.projectComms.issue_threads_label',
    descKey: 'settings.projectComms.issue_threads_desc',
  },
  {
    key: 'documentThreadsEnabled',
    labelKey: 'settings.projectComms.document_threads_label',
    descKey: 'settings.projectComms.document_threads_desc',
  },
  {
    key: 'attachmentsEnabled',
    labelKey: 'settings.projectComms.attachments_label',
    descKey: 'settings.projectComms.attachments_desc',
  },
  {
    key: 'unreadTrackingEnabled',
    labelKey: 'settings.projectComms.unread_label',
    descKey: 'settings.projectComms.unread_desc',
  },
] as const;
const PROJECT_AGENT_EXECUTION_MODES = ['manual', 'assistive', 'auto'] as const;
const PROJECT_AGENT_CAPABILITIES = [
  'project_tracking',
  'backlog_triage',
  'sprint_planning',
  'bulk_sprint_creation',
] as const;
const PROJECT_SCHEME_BASE_ROLES = [
  'developer',
  'tech_lead',
  'scrum_master',
  'product_owner',
  'qa_engineer',
  'designer',
  'viewer',
] as const;
const DEFAULT_PERMISSION_SCHEME_VALUE = '__default__';
const DEFAULT_SECURITY_SCHEME_VALUE = '__default_security__';
const SECURITY_LEVEL_MEMBER_TYPES = [
  'project_role',
  'reporter',
  'assignee',
  'project_lead',
  'user',
  'anyone',
] as const satisfies readonly SecurityLevelMemberType[];
const AUTOMATION_TRIGGER_TYPES = [
  'issue_created',
  'issue_updated',
  'issue_transitioned',
  'issue_assigned',
  'issue_commented',
  'schedule',
] as const;
const AUTOMATION_ACTION_TYPES = [
  'assign_issue',
  'transition_issue',
  'add_comment',
  'update_field',
  'send_notification',
  'send_email',
] as const;
const PROJECT_MEMBER_PERMISSION_TOGGLES = [
  {
    key: 'canBrowseProject',
    labelKey: 'settings.projectMembers.permission_browse',
    descKey: 'settings.projectMembers.permission_browse_desc',
  },
  {
    key: 'canAdministerProject',
    labelKey: 'settings.projectMembers.permission_admin',
    descKey: 'settings.projectMembers.permission_admin_desc',
  },
  {
    key: 'canCreateIssues',
    labelKey: 'settings.projectMembers.permission_create_issues',
    descKey: 'settings.projectMembers.permission_create_issues_desc',
  },
  {
    key: 'canEditIssues',
    labelKey: 'settings.projectMembers.permission_edit_issues',
    descKey: 'settings.projectMembers.permission_edit_issues_desc',
  },
  {
    key: 'canDeleteIssues',
    labelKey: 'settings.projectMembers.permission_delete_issues',
    descKey: 'settings.projectMembers.permission_delete_issues_desc',
  },
  {
    key: 'canManageSprints',
    labelKey: 'settings.projectMembers.permission_manage_sprints',
    descKey: 'settings.projectMembers.permission_manage_sprints_desc',
  },
  {
    key: 'canBrowseDocs',
    labelKey: 'settings.projectMembers.permission_browse_docs',
    descKey: 'settings.projectMembers.permission_browse_docs_desc',
  },
  {
    key: 'canBrowseChat',
    labelKey: 'settings.projectMembers.permission_browse_chat',
    descKey: 'settings.projectMembers.permission_browse_chat_desc',
  },
  {
    key: 'canManageMembers',
    labelKey: 'settings.projectMembers.permission_manage_members',
    descKey: 'settings.projectMembers.permission_manage_members_desc',
  },
  {
    key: 'canInviteMembers',
    labelKey: 'settings.projectMembers.permission_invite_members',
    descKey: 'settings.projectMembers.permission_invite_members_desc',
  },
  {
    key: 'canChangeRoles',
    labelKey: 'settings.projectMembers.permission_change_roles',
    descKey: 'settings.projectMembers.permission_change_roles_desc',
  },
  {
    key: 'canManageWorkflow',
    labelKey: 'settings.projectMembers.permission_manage_workflow',
    descKey: 'settings.projectMembers.permission_manage_workflow_desc',
  },
] as const;

const PROJECT_INVITE_EXPIRY_OPTIONS = [1, 7, 14, 30, 90] as const;
const PROJECT_INVITE_MAX_USE_OPTIONS = [1, 2, 5, 10, 25] as const;

const projectSettingsSchema = z.object({
  name: z.string().min(1, 'nameRequired'),
  key: z
    .string()
    .min(1, 'projectKeyRequired')
    .max(20, 'projectKeyInvalid')
    .regex(/^[A-Za-z][A-Za-z0-9_-]*$/, 'projectKeyInvalid'),
  description: z.string(),
  status: z.enum(PROJECT_STATUSES),
  visibility: z.enum(PROJECT_VISIBILITY),
});

type ProjectSettingsValues = z.infer<typeof projectSettingsSchema>;
type ProjectSettingsProps = NativeStackScreenProps<AppStackParamList, 'ProjectSettings'>;
type ProjectSettingsStyles = ReturnType<typeof createProjectSettingsStyles>;

function useProjectSettingsTheme(): { colors: ThemeColors; styles: ProjectSettingsStyles } {
  const colors = useThemeColors();
  const styles = useMemo(() => createProjectSettingsStyles(colors), [colors]);
  return { colors, styles };
}
type VersionStatusValue = (typeof VERSION_STATUSES)[number];
type CustomFieldFormType = (typeof CUSTOM_FIELD_TYPES)[number];
type ProjectCommunicationToggleKey = (typeof PROJECT_COMMUNICATION_TOGGLES)[number]['key'];
type ProjectAgentExecutionMode = (typeof PROJECT_AGENT_EXECUTION_MODES)[number];
type ProjectAgentCapability = (typeof PROJECT_AGENT_CAPABILITIES)[number];
type PermissionSchemeBaseRole = (typeof PROJECT_SCHEME_BASE_ROLES)[number];
type PermissionSchemeChoiceValue = typeof DEFAULT_PERMISSION_SCHEME_VALUE | string;
type SecuritySchemeChoiceValue = typeof DEFAULT_SECURITY_SCHEME_VALUE | string;
type SecurityLevelMemberFormType = (typeof SECURITY_LEVEL_MEMBER_TYPES)[number];
type AutomationTriggerType = (typeof AUTOMATION_TRIGGER_TYPES)[number];
type AutomationActionType = (typeof AUTOMATION_ACTION_TYPES)[number];
type ProjectMemberPermissionKey = (typeof PROJECT_MEMBER_PERMISSION_TOGGLES)[number]['key'];

function projectRoleLabel(role: ProjectRole, t: ReturnType<typeof useTranslation>['t']): string {
  if (role === 'developer') return t('team.projectRoles.developer');
  if (role === 'tech_lead') return t('team.projectRoles.techLead');
  if (role === 'scrum_master') return t('team.projectRoles.scrumMaster');
  if (role === 'product_owner') return t('team.projectRoles.productOwner');
  if (role === 'qa_engineer') return t('team.projectRoles.qaEngineer');
  if (role === 'designer') return t('team.projectRoles.designer');
  if (role === 'viewer') return t('team.projectRoles.viewer');
  return role;
}

function normalizeProjectRole(value: string | null | undefined): PermissionSchemeBaseRole {
  return PROJECT_SCHEME_BASE_ROLES.includes(value as PermissionSchemeBaseRole)
    ? (value as PermissionSchemeBaseRole)
    : 'viewer';
}

function projectInviteLinkStatus(
  link: ProjectInviteLink,
): 'active' | 'revoked' | 'expired' | 'used' {
  if (link.revokedAt) return 'revoked';
  if (new Date(link.expiresAt).getTime() <= Date.now()) return 'expired';
  if (link.usedCount >= link.maxUses) return 'used';
  return 'active';
}

function projectInviteLinkStatusTone(
  status: ReturnType<typeof projectInviteLinkStatus>,
): 'emerald' | 'rose' | 'amber' | 'neutral' {
  if (status === 'active') return 'emerald';
  if (status === 'revoked') return 'rose';
  if (status === 'expired') return 'amber';
  return 'neutral';
}

function defaultAssigneeLabel(
  type: ComponentDefaultAssigneeType,
  t: ReturnType<typeof useTranslation>['t'],
) {
  if (type === 'component_lead') return t('settings.components.assignee_component_lead');
  if (type === 'unassigned') return t('settings.components.assignee_unassigned');
  return t('settings.components.assignee_project_default');
}

function componentLeadName(
  component: ProjectComponent,
  members: ProjectMember[],
  fallback: string,
): string {
  const member = members.find((item) => item.userId === component.leadId);
  return member?.user.name ?? member?.user.email ?? fallback;
}

function ChoiceButton<T extends string>({
  label,
  selected,
  value,
  disabled = false,
  onPress,
}: {
  label: string;
  selected: boolean;
  value: T;
  disabled?: boolean;
  onPress: (value: T) => void;
}) {
  const { styles } = useProjectSettingsTheme();

  return (
    <Pressable
      accessibilityRole="button"
      disabled={disabled}
      onPress={() => onPress(value)}
      style={[
        styles.choiceButton,
        selected ? styles.choiceButtonActive : null,
        disabled ? styles.disabled : null,
      ]}
      className="active:opacity-80"
    >
      <Text style={[styles.choiceText, selected ? styles.choiceTextActive : null]}>{label}</Text>
    </Pressable>
  );
}

const WORK_ITEM_ICON_COMPONENTS: Record<WorkItemIcon, LucideIcon> = {
  book: BookOpen,
  bug: Bug,
  pin: Pin,
  sparkles: Sparkles,
  target: Target,
  flame: Flame,
  lightbulb: Lightbulb,
  rocket: Rocket,
};

const DEFAULT_WORK_ITEM_I18N_KEYS: Record<string, { name: string; description: string }> = {
  'default-story': {
    name: 'settings.workItemTypes.default_story_name',
    description: 'settings.workItemTypes.default_story_description',
  },
  'default-bug': {
    name: 'settings.workItemTypes.default_bug_name',
    description: 'settings.workItemTypes.default_bug_description',
  },
  'default-task': {
    name: 'settings.workItemTypes.default_task_name',
    description: 'settings.workItemTypes.default_task_description',
  },
  'default-epic': {
    name: 'settings.workItemTypes.default_epic_name',
    description: 'settings.workItemTypes.default_epic_description',
  },
};

function workItemTypeName(
  type: WorkItemTypeDefinition,
  t: ReturnType<typeof useTranslation>['t'],
): string {
  const keys = type.isDefault ? DEFAULT_WORK_ITEM_I18N_KEYS[type.id] : null;
  return keys ? t(keys.name) : type.name;
}

function workItemTypeDescription(
  type: WorkItemTypeDefinition,
  t: ReturnType<typeof useTranslation>['t'],
): string {
  const keys = type.isDefault ? DEFAULT_WORK_ITEM_I18N_KEYS[type.id] : null;
  return keys ? t(keys.description) : (type.description ?? '');
}

function workItemIconLabel(icon: WorkItemIcon, t: ReturnType<typeof useTranslation>['t']): string {
  if (icon === 'book') return t('settings.workItemTypes.icon_book');
  if (icon === 'bug') return t('settings.workItemTypes.icon_bug');
  if (icon === 'sparkles') return t('settings.workItemTypes.icon_sparkles');
  if (icon === 'target') return t('settings.workItemTypes.icon_target');
  if (icon === 'flame') return t('settings.workItemTypes.icon_flame');
  if (icon === 'lightbulb') return t('settings.workItemTypes.icon_lightbulb');
  if (icon === 'rocket') return t('settings.workItemTypes.icon_rocket');
  return t('settings.workItemTypes.icon_pin');
}

function workItemColorLabel(color: string, t: ReturnType<typeof useTranslation>['t']): string {
  if (color === '#3B82F6') return t('settings.workItemTypes.color_blue');
  if (color === '#EF4444') return t('settings.workItemTypes.color_red');
  if (color === '#8B5CF6') return t('settings.workItemTypes.color_purple');
  if (color === '#10B981') return t('settings.workItemTypes.color_green');
  if (color === '#F59E0B') return t('settings.workItemTypes.color_amber');
  return color;
}

function workItemPropertyTypeLabel(
  type: WorkItemCustomPropertyType,
  t: ReturnType<typeof useTranslation>['t'],
): string {
  if (type === 'number') return t('settings.workItemTypes.property_type_number');
  if (type === 'dropdown') return t('settings.workItemTypes.property_type_dropdown');
  if (type === 'date') return t('settings.workItemTypes.property_type_date');
  if (type === 'member') return t('settings.workItemTypes.property_type_member');
  if (type === 'url') return t('settings.workItemTypes.property_type_url');
  if (type === 'boolean') return t('settings.workItemTypes.property_type_boolean');
  return t('settings.workItemTypes.property_type_text');
}

function workItemPropertyTypeIcon(type: WorkItemCustomPropertyType): LucideIcon {
  if (type === 'number') return Hash;
  if (type === 'dropdown') return List;
  if (type === 'date') return CalendarDays;
  if (type === 'member') return Users;
  if (type === 'url') return Link;
  if (type === 'boolean') return ToggleLeft;
  return Type;
}

function estimateKindLabel(kind: EstimateKind, t: ReturnType<typeof useTranslation>['t']): string {
  if (kind === 'categories') return t('settings.estimates.kind_categories');
  if (kind === 'time') return t('settings.estimates.kind_time');
  return t('settings.estimates.kind_points');
}

function estimateSubKindLabel(
  subKind: EstimateSubKind,
  t: ReturnType<typeof useTranslation>['t'],
): string {
  if (subKind === 'points-linear') return t('settings.estimates.subkind_points_linear');
  if (subKind === 'points-fibonacci') return t('settings.estimates.subkind_points_fibonacci');
  if (subKind === 'points-squares') return t('settings.estimates.subkind_points_squares');
  if (subKind === 'points-custom') return t('settings.estimates.subkind_points_custom');
  if (subKind === 'categories-tshirt') return t('settings.estimates.subkind_categories_tshirt');
  if (subKind === 'categories-difficulty') {
    return t('settings.estimates.subkind_categories_difficulty');
  }
  if (subKind === 'categories-custom') return t('settings.estimates.subkind_categories_custom');
  if (subKind === 'time-custom') return t('settings.estimates.subkind_time_custom');
  return t('settings.estimates.subkind_time_preset');
}

function defaultEstimateCustomValues(
  kind: EstimateKind,
  t: ReturnType<typeof useTranslation>['t'],
): string[] {
  if (kind === 'categories') {
    return [
      t('settings.estimates.default_small'),
      t('settings.estimates.default_medium'),
      t('settings.estimates.default_large'),
    ];
  }
  if (kind === 'time') return ['30m', '1h', '2h'];
  return ['1', '2', '3'];
}

function localizedEstimateValues(
  subKind: EstimateSubKind,
  values: string[],
  t: ReturnType<typeof useTranslation>['t'],
): string[] {
  if (subKind !== 'categories-difficulty') return values;
  return values.map((value) => {
    if (value === 'easy') return t('settings.estimates.default_easy');
    if (value === 'medium') return t('settings.estimates.default_medium');
    if (value === 'hard') return t('settings.estimates.default_hard');
    if (value === 'very-hard') return t('settings.estimates.default_very_hard');
    return value;
  });
}

function localizedPresetEstimateScale(
  subKind: EstimateSubKind,
  t: ReturnType<typeof useTranslation>['t'],
): EstimateScale | null {
  const preset = PRESET_ESTIMATE_SCALES[subKind];
  if (!preset) return null;
  return {
    ...preset,
    values: localizedEstimateValues(subKind, preset.values, t),
  };
}

function normalizeStatus(value: string | null | undefined): ProjectSettingsValues['status'] {
  return PROJECT_STATUSES.includes(value as ProjectSettingsValues['status'])
    ? (value as ProjectSettingsValues['status'])
    : 'active';
}

function normalizeVisibility(
  value: string | null | undefined,
): ProjectSettingsValues['visibility'] {
  return PROJECT_VISIBILITY.includes(value as ProjectSettingsValues['visibility'])
    ? (value as ProjectSettingsValues['visibility'])
    : 'internal';
}

function normalizeVersionStatus(value: string | null | undefined): VersionStatusValue {
  return VERSION_STATUSES.includes(value as VersionStatusValue)
    ? (value as VersionStatusValue)
    : 'unreleased';
}

function versionStatusTone(status: string): 'blue' | 'emerald' | 'neutral' {
  if (status === 'released') return 'emerald';
  if (status === 'archived') return 'neutral';
  return 'blue';
}

function versionStatusLabel(status: string, t: ReturnType<typeof useTranslation>['t']): string {
  if (status === 'released') return t('settings.versions.status_released');
  if (status === 'archived') return t('settings.versions.status_archived');
  if (status === 'unreleased') return t('settings.versions.status_unreleased');
  return status;
}

function normalizeCustomFieldFormType(value: string | null | undefined): CustomFieldFormType {
  return CUSTOM_FIELD_TYPES.includes(value as CustomFieldFormType)
    ? (value as CustomFieldFormType)
    : 'text';
}

function isOptionsCustomFieldType(type: string): boolean {
  return type === 'select' || type === 'multi_select';
}

function customFieldTypeLabel(type: string, t: ReturnType<typeof useTranslation>['t']): string {
  if (type === 'number') return t('settings.customFields.type_number');
  if (type === 'date') return t('settings.customFields.type_date');
  if (type === 'select') return t('settings.customFields.type_select');
  if (type === 'multi_select') return t('settings.customFields.type_multi_select');
  if (type === 'checkbox') return t('settings.customFields.type_checkbox');
  if (type === 'url') return t('settings.customFields.type_url');
  if (type === 'email') return t('settings.customFields.type_email');
  if (type === 'text') return t('settings.customFields.type_text');
  return type;
}

function customFieldTypeTone(
  type: string,
): 'blue' | 'violet' | 'cyan' | 'emerald' | 'amber' | 'indigo' | 'neutral' {
  if (type === 'number' || type === 'email') return 'cyan';
  if (type === 'date') return 'amber';
  if (type === 'select' || type === 'multi_select') return 'violet';
  if (type === 'checkbox') return 'emerald';
  if (type === 'url') return 'indigo';
  if (type === 'text') return 'blue';
  return 'neutral';
}

function customFieldTypeIcon(type: string) {
  if (type === 'number') return Hash;
  if (type === 'date') return CalendarDays;
  if (type === 'select') return List;
  if (type === 'multi_select') return Layers;
  if (type === 'checkbox') return ToggleLeft;
  if (type === 'url') return Link;
  if (type === 'email') return Mail;
  return Type;
}

function parseCustomFieldOptions(value: string | null | undefined): string[] {
  const raw = value?.trim();
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (Array.isArray(parsed)) {
      return parsed.map((item) => String(item).trim()).filter(Boolean);
    }
  } catch {
    // Older servers or web forms may carry plain newline-separated option text.
  }
  return raw
    .split(/\r?\n|,/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function customFieldOptionsInput(value: string | null | undefined): string {
  const options = parseCustomFieldOptions(value);
  return options.length > 0 ? options.join('\n') : (value ?? '');
}

function customFieldOptionsJson(value: string): string | null {
  const options = parseCustomFieldOptions(value);
  return options.length > 0 ? JSON.stringify(options) : null;
}

function isValidWebhookUrl(value: string): boolean {
  try {
    const parsed = new URL(value);
    return parsed.protocol === 'https:' || parsed.protocol === 'http:';
  } catch {
    return false;
  }
}

function formatWebhookTimestamp(value: string | null | undefined, language: string): string | null {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toLocaleString(language);
}

function projectAgentExecutionLabel(
  mode: string,
  t: ReturnType<typeof useTranslation>['t'],
): string {
  if (mode === 'assistive') return t('settings.projectAi.mode_assistive');
  if (mode === 'auto') return t('settings.projectAi.mode_auto');
  return t('settings.projectAi.mode_manual');
}

function projectAgentCapabilityLabel(
  capability: ProjectAgentCapability,
  t: ReturnType<typeof useTranslation>['t'],
): string {
  if (capability === 'backlog_triage') return t('settings.projectAi.capability_backlog_triage');
  if (capability === 'sprint_planning') return t('settings.projectAi.capability_sprint_planning');
  if (capability === 'bulk_sprint_creation') {
    return t('settings.projectAi.capability_bulk_sprint_creation');
  }
  return t('settings.projectAi.capability_project_tracking');
}

function projectAgentCapabilityDescription(
  capability: ProjectAgentCapability,
  t: ReturnType<typeof useTranslation>['t'],
): string {
  if (capability === 'backlog_triage') {
    return t('settings.projectAi.capability_backlog_triage_desc');
  }
  if (capability === 'sprint_planning') {
    return t('settings.projectAi.capability_sprint_planning_desc');
  }
  if (capability === 'bulk_sprint_creation') {
    return t('settings.projectAi.capability_bulk_sprint_creation_desc');
  }
  return t('settings.projectAi.capability_project_tracking_desc');
}

function permissionSchemeSourceLabel(
  source: string | null | undefined,
  t: ReturnType<typeof useTranslation>['t'],
): string {
  if (source === 'project') return t('settings.permissionSchemes.explicit_source');
  if (source === 'organization-default') return t('settings.permissionSchemes.default_source');
  return t('settings.permissionSchemes.none_source');
}

function permissionSchemeSourceTone(
  source: string | null | undefined,
): 'blue' | 'emerald' | 'neutral' {
  if (source === 'project') return 'blue';
  if (source === 'organization-default') return 'emerald';
  return 'neutral';
}

function securityMemberTypeLabel(
  type: SecurityLevelMemberType,
  t: ReturnType<typeof useTranslation>['t'],
): string {
  if (type === 'reporter') return t('settings.securitySchemes.member_reporter');
  if (type === 'assignee') return t('settings.securitySchemes.member_assignee');
  if (type === 'project_lead') return t('settings.securitySchemes.member_project_lead');
  if (type === 'project_role') return t('settings.securitySchemes.member_project_role');
  if (type === 'user') return t('settings.securitySchemes.member_user');
  if (type === 'anyone') return t('settings.securitySchemes.member_anyone');
  return type;
}

function securityMemberValueLabel(
  memberType: SecurityLevelMemberType,
  memberValue: string | null,
  t: ReturnType<typeof useTranslation>['t'],
): string {
  if (memberType === 'project_role' && memberValue) return projectRoleLabel(memberValue, t);
  if (memberType === 'user' && memberValue) {
    return t('settings.securitySchemes.member_user_value', { value: memberValue });
  }
  return securityMemberTypeLabel(memberType, t);
}

function automationTriggerLabel(
  trigger: string,
  t: ReturnType<typeof useTranslation>['t'],
): string {
  if (trigger === 'issue_updated') return t('settings.automation.trigger_issue_updated');
  if (trigger === 'issue_transitioned') {
    return t('settings.automation.trigger_issue_transitioned');
  }
  if (trigger === 'issue_assigned') return t('settings.automation.trigger_issue_assigned');
  if (trigger === 'issue_commented') return t('settings.automation.trigger_issue_commented');
  if (trigger === 'schedule') return t('settings.automation.trigger_schedule');
  return t('settings.automation.trigger_issue_created');
}

function automationActionLabel(action: string, t: ReturnType<typeof useTranslation>['t']): string {
  if (action === 'transition_issue') return t('settings.automation.action_transition_issue');
  if (action === 'add_comment') return t('settings.automation.action_add_comment');
  if (action === 'update_field') return t('settings.automation.action_update_field');
  if (action === 'send_notification') return t('settings.automation.action_send_notification');
  if (action === 'send_email') return t('settings.automation.action_send_email');
  return t('settings.automation.action_assign_issue');
}

function automationStatusTone(status: string): 'emerald' | 'rose' | 'amber' | 'blue' | 'neutral' {
  if (status === 'success') return 'emerald';
  if (status === 'failed') return 'rose';
  if (status === 'matched') return 'blue';
  if (status === 'skipped') return 'neutral';
  return 'amber';
}

function formatAutomationDuration(durationMs: number | null): string {
  if (durationMs === null) return '';
  if (durationMs < 1000) return `${durationMs}ms`;
  return `${(durationMs / 1000).toFixed(2)}s`;
}

function dateInputValue(value: string | null | undefined): string {
  if (!value) return '';
  return value.slice(0, 10);
}

function isValidDateInput(value: string): boolean {
  const trimmed = value.trim();
  if (!trimmed) return true;
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(trimmed);
  if (!match) return false;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(year, month - 1, day);
  return date.getFullYear() === year && date.getMonth() === month - 1 && date.getDate() === day;
}

function formatVersionDate(value: string | null | undefined, language: string): string {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleDateString(language, { day: 'numeric', month: 'short', year: 'numeric' });
}

export function ProjectSettingsScreen({ navigation, route }: ProjectSettingsProps) {
  const { t, i18n } = useTranslation();
  const { colors, styles } = useProjectSettingsTheme();
  const effects = useThemeEffects();
  const { id, section: routeSection } = route.params;
  const scrollRef = useRef<ComponentRef<typeof ScrollView>>(null);
  const sectionOffsetsRef = useRef<Partial<Record<ProjectSettingsSection, number>>>({});
  const pendingSectionRef = useRef<ProjectSettingsSection | null>(routeSection ?? null);
  const projectQ = useProject(id);
  const customFieldScope = useMemo(
    () =>
      projectQ.data?.organizationId
        ? { organizationId: projectQ.data.organizationId, projectId: id }
        : null,
    [id, projectQ.data?.organizationId],
  );
  const [automationExecutionsRuleId, setAutomationExecutionsRuleId] = useState<string | null>(null);
  const updateProject = useUpdateProject(id);
  const membersQ = useProjectMembers(id);
  const organizationMembersQ = useOrganizationMembers(customFieldScope?.organizationId ?? null);
  const componentsQ = useProjectComponents(id);
  const versionsQ = useProjectVersions(id);
  const customFieldsQ = useCustomFields(customFieldScope);
  const projectAgentsQ = useProjectAgentSettings(id);
  const projectCommsQ = useProjectCommunicationsSettings(id);
  const projectWebhooksQ = useWebhooks(customFieldScope?.organizationId ?? null, id);
  const permissionSchemesQ = usePermissionSchemes(customFieldScope?.organizationId ?? null);
  const projectPermissionSchemeQ = useProjectPermissionScheme(id);
  const securitySchemesQ = useSecuritySchemes(customFieldScope?.organizationId ?? null);
  const projectSecuritySchemeQ = useProjectSecurityScheme(id);
  const automationRulesQ = useAutomationRules(customFieldScope?.organizationId ?? null, id);
  const automationExecutionsQ = useAutomationExecutions(automationExecutionsRuleId);
  const createComponent = useCreateProjectComponent(id);
  const updateComponent = useUpdateProjectComponent(id);
  const deleteComponent = useDeleteProjectComponent(id);
  const createVersion = useCreateProjectVersion(id);
  const updateVersion = useUpdateProjectVersion(id);
  const releaseVersion = useReleaseProjectVersion(id);
  const deleteVersion = useDeleteProjectVersion(id);
  const createCustomField = useCreateCustomField(customFieldScope);
  const updateCustomField = useUpdateCustomField(customFieldScope);
  const deleteCustomField = useDeleteCustomField(customFieldScope);
  const createProjectWebhook = useCreateWebhook(customFieldScope?.organizationId ?? null, id);
  const updateProjectWebhook = useUpdateWebhook(customFieldScope?.organizationId ?? null, id);
  const deleteProjectWebhook = useDeleteWebhook(customFieldScope?.organizationId ?? null, id);
  const testProjectWebhook = useTestWebhook(customFieldScope?.organizationId ?? null, id);
  const createPermissionScheme = useCreatePermissionScheme(
    customFieldScope?.organizationId ?? null,
    id,
  );
  const updatePermissionScheme = useUpdatePermissionScheme(
    customFieldScope?.organizationId ?? null,
    id,
  );
  const deletePermissionScheme = useDeletePermissionScheme(
    customFieldScope?.organizationId ?? null,
    id,
  );
  const assignPermissionScheme = useAssignProjectPermissionScheme(
    id,
    customFieldScope?.organizationId ?? null,
  );
  const createSecurityScheme = useCreateSecurityScheme(
    customFieldScope?.organizationId ?? null,
    id,
  );
  const updateSecurityScheme = useUpdateSecurityScheme(
    customFieldScope?.organizationId ?? null,
    id,
  );
  const deleteSecurityScheme = useDeleteSecurityScheme(
    customFieldScope?.organizationId ?? null,
    id,
  );
  const assignSecurityScheme = useAssignProjectSecurityScheme(
    id,
    customFieldScope?.organizationId ?? null,
  );
  const addProjectMember = useAddProjectMember(id, customFieldScope?.organizationId ?? null);
  const updateProjectMember = useUpdateProjectMember(id, customFieldScope?.organizationId ?? null);
  const removeProjectMember = useRemoveProjectMember(id, customFieldScope?.organizationId ?? null);
  const projectInviteLinksQ = useProjectInviteLinks(id);
  const createProjectInviteLink = useCreateProjectInviteLink(id);
  const revokeProjectInviteLink = useRevokeProjectInviteLink(id);
  const createSecurityLevel = useCreateSecurityLevel(customFieldScope?.organizationId ?? null);
  const deleteSecurityLevel = useDeleteSecurityLevel(customFieldScope?.organizationId ?? null);
  const createAutomationRule = useCreateAutomationRule(
    customFieldScope?.organizationId ?? null,
    id,
  );
  const updateAutomationRule = useUpdateAutomationRule(
    customFieldScope?.organizationId ?? null,
    id,
  );
  const deleteAutomationRule = useDeleteAutomationRule(
    customFieldScope?.organizationId ?? null,
    id,
  );
  const updateProjectAgents = useUpdateProjectAgentSettings(id);
  const updateProjectComms = useUpdateProjectCommunicationsSettings(id);
  const schemaSettings = useProjectSchemaSettings(id);
  const [formError, setFormError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [workItemTypeEditingId, setWorkItemTypeEditingId] = useState<string | null>(null);
  const [workItemTypeSaved, setWorkItemTypeSaved] = useState<string | null>(null);
  const [estimateActiveKind, setEstimateActiveKind] = useState<EstimateKind>(
    DEFAULT_ESTIMATE_SCALE.kind,
  );
  const [estimateSelectedSubKind, setEstimateSelectedSubKind] = useState<EstimateSubKind>(
    DEFAULT_ESTIMATE_SCALE.subKind,
  );
  const [estimateCustomValues, setEstimateCustomValues] = useState<Record<EstimateKind, string[]>>({
    points: ['1', '2', '3'],
    categories: [],
    time: ['30m', '1h', '2h'],
  });
  const [estimateSaved, setEstimateSaved] = useState<string | null>(null);
  const [componentName, setComponentName] = useState('');
  const [componentDescription, setComponentDescription] = useState('');
  const [componentLeadId, setComponentLeadId] = useState('');
  const [componentDefaultAssigneeType, setComponentDefaultAssigneeType] =
    useState<ComponentDefaultAssigneeType>('project_default');
  const [editingComponentId, setEditingComponentId] = useState<string | null>(null);
  const [componentError, setComponentError] = useState<string | null>(null);
  const [componentSaved, setComponentSaved] = useState<string | null>(null);
  const [versionName, setVersionName] = useState('');
  const [versionDescription, setVersionDescription] = useState('');
  const [versionStartDate, setVersionStartDate] = useState('');
  const [versionReleaseDate, setVersionReleaseDate] = useState('');
  const [versionStatus, setVersionStatus] = useState<VersionStatusValue>('unreleased');
  const [editingVersionId, setEditingVersionId] = useState<string | null>(null);
  const [versionError, setVersionError] = useState<string | null>(null);
  const [versionSaved, setVersionSaved] = useState<string | null>(null);
  const [customFieldName, setCustomFieldName] = useState('');
  const [customFieldDescription, setCustomFieldDescription] = useState('');
  const [customFieldType, setCustomFieldType] = useState<CustomFieldFormType>('text');
  const [customFieldRequired, setCustomFieldRequired] = useState(false);
  const [customFieldOptions, setCustomFieldOptions] = useState('');
  const [editingCustomFieldId, setEditingCustomFieldId] = useState<string | null>(null);
  const [customFieldError, setCustomFieldError] = useState<string | null>(null);
  const [customFieldSaved, setCustomFieldSaved] = useState<string | null>(null);
  const [webhookEditingId, setWebhookEditingId] = useState<string | null>(null);
  const [webhookName, setWebhookName] = useState('');
  const [webhookUrl, setWebhookUrl] = useState('');
  const [webhookEvents, setWebhookEvents] = useState<string[]>(PROJECT_DEFAULT_WEBHOOK_EVENTS);
  const [webhookError, setWebhookError] = useState<string | null>(null);
  const [webhookSaved, setWebhookSaved] = useState<string | null>(null);
  const [webhookSecret, setWebhookSecret] = useState<string | null>(null);
  const [testingWebhookId, setTestingWebhookId] = useState<string | null>(null);
  const [webhookTestResults, setWebhookTestResults] = useState<Record<string, WebhookTestResult>>(
    {},
  );
  const [schemeName, setSchemeName] = useState('');
  const [schemeDescription, setSchemeDescription] = useState('');
  const [schemeBaseRole, setSchemeBaseRole] = useState<PermissionSchemeBaseRole>('developer');
  const [schemeIsDefault, setSchemeIsDefault] = useState(false);
  const [schemeError, setSchemeError] = useState<string | null>(null);
  const [schemeSaved, setSchemeSaved] = useState<string | null>(null);
  const [securitySchemeName, setSecuritySchemeName] = useState('');
  const [securitySchemeDescription, setSecuritySchemeDescription] = useState('');
  const [securitySchemeIsDefault, setSecuritySchemeIsDefault] = useState(false);
  const [securityLevelSchemeId, setSecurityLevelSchemeId] = useState('');
  const [securityLevelName, setSecurityLevelName] = useState('');
  const [securityLevelDescription, setSecurityLevelDescription] = useState('');
  const [securityLevelIsDefault, setSecurityLevelIsDefault] = useState(false);
  const [securityLevelMemberType, setSecurityLevelMemberType] =
    useState<SecurityLevelMemberFormType>('project_role');
  const [securityLevelMemberRole, setSecurityLevelMemberRole] =
    useState<PermissionSchemeBaseRole>('developer');
  const [securityLevelMemberValue, setSecurityLevelMemberValue] = useState('');
  const [securityError, setSecurityError] = useState<string | null>(null);
  const [securitySaved, setSecuritySaved] = useState<string | null>(null);
  const [automationEditingRuleId, setAutomationEditingRuleId] = useState<string | null>(null);
  const [automationName, setAutomationName] = useState('');
  const [automationDescription, setAutomationDescription] = useState('');
  const [automationTriggerType, setAutomationTriggerType] =
    useState<AutomationTriggerType>('issue_created');
  const [automationActionType, setAutomationActionType] =
    useState<AutomationActionType>('assign_issue');
  const [automationEnabled, setAutomationEnabled] = useState(true);
  const [automationError, setAutomationError] = useState<string | null>(null);
  const [automationSaved, setAutomationSaved] = useState<string | null>(null);
  const [projectCommsError, setProjectCommsError] = useState<string | null>(null);
  const [projectCommsSaved, setProjectCommsSaved] = useState<string | null>(null);
  const [projectAgentError, setProjectAgentError] = useState<string | null>(null);
  const [projectAgentSaved, setProjectAgentSaved] = useState<string | null>(null);
  const [selectedProjectMemberId, setSelectedProjectMemberId] = useState<string | null>(null);
  const [projectMemberRole, setProjectMemberRole] = useState<PermissionSchemeBaseRole>('developer');
  const [projectMemberPermissions, setProjectMemberPermissions] = useState<Record<string, boolean>>(
    {},
  );
  const [projectMemberCandidateUserId, setProjectMemberCandidateUserId] = useState('');
  const [projectMemberCandidateRole, setProjectMemberCandidateRole] =
    useState<PermissionSchemeBaseRole>('developer');
  const [projectMemberError, setProjectMemberError] = useState<string | null>(null);
  const [projectMemberSaved, setProjectMemberSaved] = useState<string | null>(null);
  const [projectInviteLinkRole, setProjectInviteLinkRole] =
    useState<PermissionSchemeBaseRole>('developer');
  const [projectInviteLinkExpiresInDays, setProjectInviteLinkExpiresInDays] = useState(7);
  const [projectInviteLinkMaxUses, setProjectInviteLinkMaxUses] = useState(1);
  const [createdProjectInviteUrl, setCreatedProjectInviteUrl] = useState<string | null>(null);
  const [agentSprintBatchSize, setAgentSprintBatchSize] = useState('');
  const [agentSprintLengthDays, setAgentSprintLengthDays] = useState('');
  const [agentIssueCapacity, setAgentIssueCapacity] = useState('');

  const scrollToSettingsSection = useCallback(
    (section: ProjectSettingsSection) => {
      if (section === 'general') {
        scrollRef.current?.scrollTo({ y: 0, animated: effects.animationsEnabled });
        pendingSectionRef.current = null;
        return;
      }

      const offset = sectionOffsetsRef.current[section];
      if (offset === undefined) {
        pendingSectionRef.current = section;
        return;
      }

      scrollRef.current?.scrollTo({
        y: Math.max(offset - 12, 0),
        animated: effects.animationsEnabled,
      });
      pendingSectionRef.current = null;
    },
    [effects.animationsEnabled],
  );

  const handleSettingsSectionLayout = useCallback(
    (section: ProjectSettingsSection, y: number) => {
      sectionOffsetsRef.current[section] = y;
      if (pendingSectionRef.current === section) {
        requestAnimationFrame(() => scrollToSettingsSection(section));
      }
    },
    [scrollToSettingsSection],
  );

  const form = useForm<ProjectSettingsValues>({
    resolver: zodResolver(projectSettingsSchema),
    defaultValues: {
      name: '',
      key: '',
      description: '',
      status: 'active',
      visibility: 'internal',
    },
  });

  useEffect(() => {
    if (routeSection) {
      pendingSectionRef.current = routeSection;
      requestAnimationFrame(() => scrollToSettingsSection(routeSection));
    }
  }, [routeSection, scrollToSettingsSection]);

  useEffect(() => {
    const project = projectQ.data;
    if (!project) return;
    form.reset({
      name: project.name ?? '',
      key: project.key ?? '',
      description: project.description ?? '',
      status: normalizeStatus(project.status),
      visibility: normalizeVisibility(project.visibility),
    });
    setFormError(null);
    setSaved(false);
  }, [form, projectQ.data]);

  useEffect(() => {
    const settings = projectAgentsQ.data?.projectSettings;
    if (!settings) return;
    setAgentSprintBatchSize(String(settings.sprintBatchSize));
    setAgentSprintLengthDays(String(settings.sprintLengthDays));
    setAgentIssueCapacity(String(settings.issueCapacityPerSprint));
    setProjectAgentError(null);
    setProjectAgentSaved(null);
  }, [projectAgentsQ.data?.projectSettings]);

  useEffect(() => {
    const scale = schemaSettings.estimateScale;
    const kind = kindOfSubKind(scale.subKind);
    setEstimateActiveKind(kind);
    setEstimateSelectedSubKind(scale.subKind);
    setEstimateCustomValues({
      points:
        scale.subKind === 'points-custom'
          ? [...scale.values]
          : defaultEstimateCustomValues('points', t),
      categories:
        scale.subKind === 'categories-custom'
          ? [...scale.values]
          : defaultEstimateCustomValues('categories', t),
      time:
        scale.subKind === 'time-custom'
          ? [...scale.values]
          : defaultEstimateCustomValues('time', t),
    });
  }, [schemaSettings.estimateScale, t]);

  const values = form.watch();
  const project = projectQ.data;
  const workItemTypes = schemaSettings.workItemTypes;
  const projectMembers = useMemo(() => membersQ.data ?? [], [membersQ.data]);
  const components = useMemo(() => componentsQ.data ?? [], [componentsQ.data]);
  const versions = useMemo(() => versionsQ.data ?? [], [versionsQ.data]);
  const customFields = useMemo(() => customFieldsQ.data ?? [], [customFieldsQ.data]);
  const projectWebhooks = useMemo(() => projectWebhooksQ.data ?? [], [projectWebhooksQ.data]);
  const permissionSchemes = useMemo(() => permissionSchemesQ.data ?? [], [permissionSchemesQ.data]);
  const securitySchemes = useMemo(() => securitySchemesQ.data ?? [], [securitySchemesQ.data]);
  const automationRules = useMemo(() => automationRulesQ.data ?? [], [automationRulesQ.data]);
  const projectMemberCandidates = useMemo(() => {
    const existingUserIds = new Set(projectMembers.map((member) => member.userId));
    return (organizationMembersQ.data?.members ?? []).filter(
      (member) => !existingUserIds.has(member.id) && member.memberStatus !== 'suspended',
    );
  }, [organizationMembersQ.data?.members, projectMembers]);
  const projectInviteLinks = useMemo(
    () => projectInviteLinksQ.data ?? [],
    [projectInviteLinksQ.data],
  );
  const editingComponent = components.find((component) => component.id === editingComponentId);
  const editingVersion = versions.find((version) => version.id === editingVersionId);
  const editingCustomField = customFields.find((field) => field.id === editingCustomFieldId);
  const editingProjectWebhook = projectWebhooks.find((webhook) => webhook.id === webhookEditingId);
  const editingAutomationRule = automationRules.find((rule) => rule.id === automationEditingRuleId);
  const selectedProjectMember = projectMembers.find(
    (member) => member.id === selectedProjectMemberId,
  );
  const componentMutating =
    createComponent.isPending || updateComponent.isPending || deleteComponent.isPending;
  const versionMutating =
    createVersion.isPending ||
    updateVersion.isPending ||
    releaseVersion.isPending ||
    deleteVersion.isPending;
  const customFieldMutating =
    createCustomField.isPending || updateCustomField.isPending || deleteCustomField.isPending;
  const projectAgentMutating = updateProjectAgents.isPending || projectAgentsQ.isFetching;
  const projectCommsMutating = updateProjectComms.isPending || projectCommsQ.isFetching;
  const webhookMutating =
    createProjectWebhook.isPending ||
    updateProjectWebhook.isPending ||
    deleteProjectWebhook.isPending ||
    testProjectWebhook.isPending;
  const schemeMutating =
    createPermissionScheme.isPending ||
    updatePermissionScheme.isPending ||
    deletePermissionScheme.isPending ||
    assignPermissionScheme.isPending;
  const securityMutating =
    createSecurityScheme.isPending ||
    updateSecurityScheme.isPending ||
    deleteSecurityScheme.isPending ||
    assignSecurityScheme.isPending ||
    createSecurityLevel.isPending ||
    deleteSecurityLevel.isPending;
  const automationMutating =
    createAutomationRule.isPending ||
    updateAutomationRule.isPending ||
    deleteAutomationRule.isPending;
  const projectMemberMutating =
    addProjectMember.isPending || updateProjectMember.isPending || removeProjectMember.isPending;
  const projectInviteLinkMutating =
    createProjectInviteLink.isPending || revokeProjectInviteLink.isPending;
  const hasChanges = project
    ? values.name.trim() !== (project.name ?? '') ||
      values.key.trim().toUpperCase() !== (project.key ?? '') ||
      values.description.trim() !== (project.description ?? '') ||
      values.status !== normalizeStatus(project.status) ||
      values.visibility !== normalizeVisibility(project.visibility)
    : false;
  const permissionSchemeState = projectPermissionSchemeQ.data;
  const permissionSchemeLoading =
    permissionSchemesQ.isLoading || projectPermissionSchemeQ.isLoading;
  const permissionSchemeLoadError = projectPermissionSchemeQ.isError
    ? projectPermissionSchemeQ.error instanceof Error
      ? projectPermissionSchemeQ.error.message
      : t('settings.permissionSchemes.load_failed')
    : permissionSchemesQ.isError
      ? permissionSchemesQ.error instanceof Error
        ? permissionSchemesQ.error.message
        : t('settings.permissionSchemes.load_failed')
      : null;
  const securitySchemeState = projectSecuritySchemeQ.data;
  const securitySchemeLoading = securitySchemesQ.isLoading || projectSecuritySchemeQ.isLoading;
  const securitySchemeLoadError = projectSecuritySchemeQ.isError
    ? projectSecuritySchemeQ.error instanceof Error
      ? projectSecuritySchemeQ.error.message
      : t('settings.securitySchemes.load_failed')
    : securitySchemesQ.isError
      ? securitySchemesQ.error instanceof Error
        ? securitySchemesQ.error.message
        : t('settings.securitySchemes.load_failed')
      : null;

  useEffect(() => {
    if (!selectedProjectMemberId) return;
    if (projectMembers.some((member) => member.id === selectedProjectMemberId)) return;
    setSelectedProjectMemberId(null);
    setProjectMemberPermissions({});
  }, [projectMembers, selectedProjectMemberId]);

  const fieldError = (code?: string): string | undefined => {
    if (!code) return undefined;
    if (code === 'nameRequired') return t('validation.nameRequired');
    if (code === 'projectKeyRequired') return t('validation.projectKeyRequired');
    if (code === 'projectKeyInvalid') return t('validation.projectKeyInvalid');
    return t('validation.invalidField');
  };

  const resetForm = () => {
    if (!project) return;
    form.reset({
      name: project.name ?? '',
      key: project.key ?? '',
      description: project.description ?? '',
      status: normalizeStatus(project.status),
      visibility: normalizeVisibility(project.visibility),
    });
    setFormError(null);
    setSaved(false);
  };

  const onSubmit = async (data: ProjectSettingsValues): Promise<void> => {
    setFormError(null);
    setSaved(false);
    try {
      await updateProject.mutateAsync({
        name: data.name.trim(),
        key: data.key.trim().toUpperCase(),
        description: data.description.trim() || null,
        status: data.status,
        visibility: data.visibility,
      });
      setSaved(true);
    } catch (err: unknown) {
      setFormError(err instanceof Error ? err.message : t('projects.updateFailed'));
    }
  };

  const resetComponentForm = () => {
    setComponentName('');
    setComponentDescription('');
    setComponentLeadId('');
    setComponentDefaultAssigneeType('project_default');
    setEditingComponentId(null);
    setComponentError(null);
  };

  const beginComponentEdit = (component: ProjectComponent) => {
    setComponentName(component.name);
    setComponentDescription(component.description ?? '');
    setComponentLeadId(component.leadId ?? '');
    setComponentDefaultAssigneeType(component.defaultAssigneeType);
    setEditingComponentId(component.id);
    setComponentError(null);
    setComponentSaved(null);
  };

  const saveComponent = async (): Promise<void> => {
    const name = componentName.trim();
    if (!name) {
      setComponentError(t('validation.invalidField'));
      return;
    }
    setComponentError(null);
    setComponentSaved(null);

    try {
      const input = {
        name,
        description: componentDescription.trim() || null,
        leadId: componentLeadId || null,
        defaultAssigneeType: componentDefaultAssigneeType,
      };
      if (editingComponentId) {
        await updateComponent.mutateAsync({
          componentId: editingComponentId,
          patch: input,
        });
        setComponentSaved(t('settings.components.toast_updated'));
      } else {
        await createComponent.mutateAsync(input);
        setComponentSaved(t('settings.components.toast_created'));
      }
      resetComponentForm();
    } catch (err: unknown) {
      setComponentError(
        err instanceof Error ? err.message : t('settings.components.error_generic'),
      );
    }
  };

  const toggleComponentArchived = async (component: ProjectComponent): Promise<void> => {
    setComponentError(null);
    setComponentSaved(null);
    try {
      await updateComponent.mutateAsync({
        componentId: component.id,
        patch: { archived: !component.archived },
      });
      setComponentSaved(
        t(
          component.archived
            ? 'settings.components.toast_restored'
            : 'settings.components.toast_archived',
        ),
      );
    } catch (err: unknown) {
      setComponentError(
        err instanceof Error ? err.message : t('settings.components.error_generic'),
      );
    }
  };

  const deleteComponentById = async (component: ProjectComponent): Promise<void> => {
    setComponentError(null);
    setComponentSaved(null);
    try {
      await deleteComponent.mutateAsync(component.id);
      if (editingComponentId === component.id) resetComponentForm();
      setComponentSaved(t('settings.components.toast_deleted'));
    } catch (err: unknown) {
      setComponentError(
        err instanceof Error ? err.message : t('settings.components.error_generic'),
      );
    }
  };

  const confirmDeleteComponent = (component: ProjectComponent) => {
    Alert.alert(
      t('settings.components.delete_title'),
      t('settings.components.delete_warning', { name: component.name }),
      [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('settings.components.delete_submit'),
          style: 'destructive',
          onPress: () => void deleteComponentById(component),
        },
      ],
    );
  };

  const resetVersionForm = () => {
    setVersionName('');
    setVersionDescription('');
    setVersionStartDate('');
    setVersionReleaseDate('');
    setVersionStatus('unreleased');
    setEditingVersionId(null);
    setVersionError(null);
  };

  const beginVersionEdit = (version: ProjectVersion) => {
    setVersionName(version.name);
    setVersionDescription(version.description ?? '');
    setVersionStartDate(dateInputValue(version.startDate));
    setVersionReleaseDate(dateInputValue(version.releaseDate));
    setVersionStatus(normalizeVersionStatus(version.status));
    setEditingVersionId(version.id);
    setVersionError(null);
    setVersionSaved(null);
  };

  const saveVersion = async (): Promise<void> => {
    const name = versionName.trim();
    const startDate = versionStartDate.trim();
    const releaseDate = versionReleaseDate.trim();
    if (!name) {
      setVersionError(t('validation.invalidField'));
      return;
    }
    if (!isValidDateInput(startDate) || !isValidDateInput(releaseDate)) {
      setVersionError(t('settings.versions.date_invalid'));
      return;
    }
    setVersionError(null);
    setVersionSaved(null);

    try {
      const input = {
        name,
        description: versionDescription.trim() || null,
        startDate: startDate || null,
        releaseDate: releaseDate || null,
      };
      if (editingVersionId) {
        await updateVersion.mutateAsync({
          versionId: editingVersionId,
          patch: { ...input, status: versionStatus },
        });
        setVersionSaved(t('settings.versions.toast_updated'));
      } else {
        await createVersion.mutateAsync(input);
        setVersionSaved(t('settings.versions.toast_created'));
      }
      resetVersionForm();
    } catch (err: unknown) {
      setVersionError(err instanceof Error ? err.message : t('settings.versions.error_generic'));
    }
  };

  const releaseVersionById = async (version: ProjectVersion): Promise<void> => {
    setVersionError(null);
    setVersionSaved(null);
    try {
      await releaseVersion.mutateAsync({ versionId: version.id });
      setVersionSaved(t('settings.versions.toast_released'));
    } catch (err: unknown) {
      setVersionError(err instanceof Error ? err.message : t('settings.versions.error_generic'));
    }
  };

  const toggleVersionArchived = async (version: ProjectVersion): Promise<void> => {
    setVersionError(null);
    setVersionSaved(null);
    const isArchived = version.status === 'archived';
    try {
      await updateVersion.mutateAsync({
        versionId: version.id,
        patch: { status: isArchived ? 'unreleased' : 'archived' },
      });
      setVersionSaved(
        t(isArchived ? 'settings.versions.toast_restored' : 'settings.versions.toast_archived'),
      );
      if (editingVersionId === version.id && !isArchived) resetVersionForm();
    } catch (err: unknown) {
      setVersionError(err instanceof Error ? err.message : t('settings.versions.error_generic'));
    }
  };

  const deleteVersionById = async (version: ProjectVersion): Promise<void> => {
    setVersionError(null);
    setVersionSaved(null);
    try {
      await deleteVersion.mutateAsync(version.id);
      if (editingVersionId === version.id) resetVersionForm();
      setVersionSaved(t('settings.versions.toast_deleted'));
    } catch (err: unknown) {
      setVersionError(err instanceof Error ? err.message : t('settings.versions.error_generic'));
    }
  };

  const confirmDeleteVersion = (version: ProjectVersion) => {
    Alert.alert(
      t('settings.versions.delete_title'),
      t('settings.versions.delete_warning', { name: version.name }),
      [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('settings.versions.delete_submit'),
          style: 'destructive',
          onPress: () => void deleteVersionById(version),
        },
      ],
    );
  };

  const resetCustomFieldForm = () => {
    setCustomFieldName('');
    setCustomFieldDescription('');
    setCustomFieldType('text');
    setCustomFieldRequired(false);
    setCustomFieldOptions('');
    setEditingCustomFieldId(null);
    setCustomFieldError(null);
  };

  const beginCustomFieldEdit = (field: CustomField) => {
    setCustomFieldName(field.name);
    setCustomFieldDescription(field.description ?? '');
    setCustomFieldType(normalizeCustomFieldFormType(field.type));
    setCustomFieldRequired(field.isRequired);
    setCustomFieldOptions(customFieldOptionsInput(field.options));
    setEditingCustomFieldId(field.id);
    setCustomFieldError(null);
    setCustomFieldSaved(null);
  };

  const saveCustomField = async (): Promise<void> => {
    const name = customFieldName.trim();
    const description = customFieldDescription.trim();
    const options = isOptionsCustomFieldType(customFieldType)
      ? customFieldOptionsJson(customFieldOptions)
      : null;
    if (!name) {
      setCustomFieldError(t('validation.invalidField'));
      return;
    }
    if (isOptionsCustomFieldType(customFieldType) && !options) {
      setCustomFieldError(t('settings.customFields.options_required'));
      return;
    }
    if (!customFieldScope) {
      setCustomFieldError(t('settings.customFields.error_generic'));
      return;
    }
    setCustomFieldError(null);
    setCustomFieldSaved(null);

    try {
      if (editingCustomFieldId) {
        await updateCustomField.mutateAsync({
          fieldId: editingCustomFieldId,
          patch: {
            name,
            description,
            isRequired: customFieldRequired,
            options: options ?? '',
          },
        });
        setCustomFieldSaved(t('settings.customFields.toast_updated'));
      } else {
        await createCustomField.mutateAsync({
          organizationId: customFieldScope.organizationId,
          projectId: customFieldScope.projectId,
          name,
          description: description || undefined,
          type: customFieldType,
          isRequired: customFieldRequired,
          options: options ?? undefined,
        });
        setCustomFieldSaved(t('settings.customFields.toast_created'));
      }
      resetCustomFieldForm();
    } catch (err: unknown) {
      setCustomFieldError(
        err instanceof Error ? err.message : t('settings.customFields.error_generic'),
      );
    }
  };

  const deleteCustomFieldById = async (field: CustomField): Promise<void> => {
    setCustomFieldError(null);
    setCustomFieldSaved(null);
    try {
      await deleteCustomField.mutateAsync(field.id);
      if (editingCustomFieldId === field.id) resetCustomFieldForm();
      setCustomFieldSaved(t('settings.customFields.toast_deleted'));
    } catch (err: unknown) {
      setCustomFieldError(
        err instanceof Error ? err.message : t('settings.customFields.error_generic'),
      );
    }
  };

  const confirmDeleteCustomField = (field: CustomField) => {
    Alert.alert(
      t('settings.customFields.delete_title'),
      t('settings.customFields.delete_warning', { name: field.name }),
      [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('settings.customFields.delete_submit'),
          style: 'destructive',
          onPress: () => void deleteCustomFieldById(field),
        },
      ],
    );
  };

  const resetProjectMemberEditor = () => {
    setSelectedProjectMemberId(null);
    setProjectMemberRole('developer');
    setProjectMemberPermissions({});
    setProjectMemberError(null);
  };

  const beginProjectMemberEdit = (member: ProjectMember) => {
    setSelectedProjectMemberId(member.id);
    setProjectMemberRole(normalizeProjectRole(member.role));
    setProjectMemberPermissions({ ...(member.permissions ?? {}) });
    setProjectMemberError(null);
    setProjectMemberSaved(null);
  };

  const toggleProjectMemberPermission = (key: ProjectMemberPermissionKey) => {
    setProjectMemberPermissions((current) => ({
      ...current,
      [key]: !current[key],
    }));
    setProjectMemberError(null);
    setProjectMemberSaved(null);
  };

  const saveProjectMember = async (): Promise<void> => {
    if (!selectedProjectMember) return;
    setProjectMemberError(null);
    setProjectMemberSaved(null);
    try {
      await updateProjectMember.mutateAsync({
        memberId: selectedProjectMember.id,
        role: projectMemberRole,
        permissions: projectMemberPermissions,
      });
      setProjectMemberSaved(t('settings.projectMembers.updated'));
    } catch (err: unknown) {
      setProjectMemberError(
        err instanceof Error ? err.message : t('settings.projectMembers.update_failed'),
      );
    }
  };

  const resetProjectMemberDefaults = async (): Promise<void> => {
    if (!selectedProjectMember) return;
    setProjectMemberError(null);
    setProjectMemberSaved(null);
    try {
      await updateProjectMember.mutateAsync({
        memberId: selectedProjectMember.id,
        role: projectMemberRole,
        resetToDefaults: true,
      });
      resetProjectMemberEditor();
      setProjectMemberSaved(t('settings.projectMembers.reset_done'));
    } catch (err: unknown) {
      setProjectMemberError(
        err instanceof Error ? err.message : t('settings.projectMembers.reset_failed'),
      );
    }
  };

  const addMemberToProject = async (): Promise<void> => {
    if (!projectMemberCandidateUserId) {
      setProjectMemberError(t('settings.projectMembers.add_required'));
      return;
    }
    setProjectMemberError(null);
    setProjectMemberSaved(null);
    try {
      await addProjectMember.mutateAsync({
        userId: projectMemberCandidateUserId,
        role: projectMemberCandidateRole,
      });
      setProjectMemberCandidateUserId('');
      setProjectMemberCandidateRole('developer');
      setProjectMemberSaved(t('settings.projectMembers.added'));
    } catch (err: unknown) {
      setProjectMemberError(
        err instanceof Error ? err.message : t('settings.projectMembers.add_failed'),
      );
    }
  };

  const createProjectInviteLinkForProject = async (): Promise<void> => {
    setProjectMemberError(null);
    setProjectMemberSaved(null);
    setCreatedProjectInviteUrl(null);
    try {
      const result = await createProjectInviteLink.mutateAsync({
        role: projectInviteLinkRole,
        expiresInDays: projectInviteLinkExpiresInDays,
        maxUses: projectInviteLinkMaxUses,
      });
      if (!result.inviteUrl) {
        throw new Error(t('settings.projectMembers.invite_link_create_failed'));
      }
      setCreatedProjectInviteUrl(result.inviteUrl);
      setProjectMemberSaved(t('settings.projectMembers.invite_link_created'));
    } catch (err: unknown) {
      setProjectMemberError(
        err instanceof Error ? err.message : t('settings.projectMembers.invite_link_create_failed'),
      );
    }
  };

  const shareCreatedProjectInviteLink = async (): Promise<void> => {
    if (!createdProjectInviteUrl) return;
    setProjectMemberError(null);
    try {
      await Share.share({
        title: t('settings.projectMembers.invite_link_share_title'),
        message: createdProjectInviteUrl,
        url: createdProjectInviteUrl,
      });
    } catch {
      setProjectMemberError(t('settings.projectMembers.invite_link_share_failed'));
    }
  };

  const removeProjectMemberById = async (member: ProjectMember): Promise<void> => {
    setProjectMemberError(null);
    setProjectMemberSaved(null);
    try {
      await removeProjectMember.mutateAsync(member.id);
      if (selectedProjectMemberId === member.id) resetProjectMemberEditor();
      setProjectMemberSaved(t('settings.projectMembers.removed'));
    } catch (err: unknown) {
      setProjectMemberError(
        err instanceof Error ? err.message : t('settings.projectMembers.remove_failed'),
      );
    }
  };

  const confirmRemoveProjectMember = (member: ProjectMember) => {
    const name = member.user.name ?? member.user.email;
    Alert.alert(
      t('settings.projectMembers.remove_title'),
      t('settings.projectMembers.remove_warning', { name }),
      [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('settings.projectMembers.remove_submit'),
          style: 'destructive',
          onPress: () => void removeProjectMemberById(member),
        },
      ],
    );
  };

  const revokeProjectInviteLinkById = async (link: ProjectInviteLink): Promise<void> => {
    setProjectMemberError(null);
    setProjectMemberSaved(null);
    try {
      await revokeProjectInviteLink.mutateAsync(link.id);
      setProjectMemberSaved(t('settings.projectMembers.invite_link_revoked'));
    } catch (err: unknown) {
      setProjectMemberError(
        err instanceof Error ? err.message : t('settings.projectMembers.invite_link_revoke_failed'),
      );
    }
  };

  const confirmRevokeProjectInviteLink = (link: ProjectInviteLink) => {
    Alert.alert(
      t('settings.projectMembers.invite_link_revoke_title'),
      t('settings.projectMembers.invite_link_revoke_warning'),
      [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('settings.projectMembers.invite_link_revoke_submit'),
          style: 'destructive',
          onPress: () => void revokeProjectInviteLinkById(link),
        },
      ],
    );
  };

  const resetPermissionSchemeForm = () => {
    setSchemeName('');
    setSchemeDescription('');
    setSchemeBaseRole('developer');
    setSchemeIsDefault(false);
    setSchemeError(null);
  };

  const createProjectPermissionScheme = async (): Promise<void> => {
    const name = schemeName.trim();
    if (!name) {
      setSchemeError(t('settings.permissionSchemes.name_required'));
      return;
    }
    if (!customFieldScope) {
      setSchemeError(t('settings.permissionSchemes.error_generic'));
      return;
    }

    setSchemeError(null);
    setSchemeSaved(null);
    try {
      await createPermissionScheme.mutateAsync({
        organizationId: customFieldScope.organizationId,
        name,
        description: schemeDescription.trim() || null,
        baseRole: schemeBaseRole,
        isDefault: schemeIsDefault,
      });
      resetPermissionSchemeForm();
      setSchemeSaved(t('settings.permissionSchemes.created'));
    } catch (err: unknown) {
      setSchemeError(
        err instanceof Error ? err.message : t('settings.permissionSchemes.error_generic'),
      );
    }
  };

  const assignPermissionSchemeToProject = async (
    value: PermissionSchemeChoiceValue,
  ): Promise<void> => {
    const schemeId = value === DEFAULT_PERMISSION_SCHEME_VALUE ? null : value;
    const currentAssigned = projectPermissionSchemeQ.data?.assignedSchemeId ?? null;
    if (schemeId === currentAssigned) return;

    setSchemeError(null);
    setSchemeSaved(null);
    try {
      await assignPermissionScheme.mutateAsync(schemeId);
      setSchemeSaved(
        schemeId
          ? t('settings.permissionSchemes.assigned_to_project')
          : t('settings.permissionSchemes.follows_default'),
      );
    } catch (err: unknown) {
      setSchemeError(
        err instanceof Error ? err.message : t('settings.permissionSchemes.assign_failed'),
      );
    }
  };

  const setPermissionSchemeDefault = async (scheme: PermissionScheme): Promise<void> => {
    if (scheme.isDefault) return;

    setSchemeError(null);
    setSchemeSaved(null);
    try {
      await updatePermissionScheme.mutateAsync({
        schemeId: scheme.id,
        isDefault: true,
      });
      setSchemeSaved(t('settings.permissionSchemes.default_updated'));
    } catch (err: unknown) {
      setSchemeError(
        err instanceof Error ? err.message : t('settings.permissionSchemes.save_failed'),
      );
    }
  };

  const deletePermissionSchemeById = async (scheme: PermissionScheme): Promise<void> => {
    if (scheme.projectCount > 0) {
      setSchemeError(t('settings.permissionSchemes.delete_in_use'));
      return;
    }

    setSchemeError(null);
    setSchemeSaved(null);
    try {
      await deletePermissionScheme.mutateAsync(scheme.id);
      setSchemeSaved(t('settings.permissionSchemes.deleted'));
    } catch (err: unknown) {
      setSchemeError(
        err instanceof Error ? err.message : t('settings.permissionSchemes.delete_failed'),
      );
    }
  };

  const confirmDeletePermissionScheme = (scheme: PermissionScheme) => {
    Alert.alert(
      t('settings.permissionSchemes.delete_title'),
      t('settings.permissionSchemes.delete_warning', { name: scheme.name }),
      [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('settings.permissionSchemes.delete_submit'),
          style: 'destructive',
          onPress: () => void deletePermissionSchemeById(scheme),
        },
      ],
    );
  };

  const resetSecuritySchemeForm = () => {
    setSecuritySchemeName('');
    setSecuritySchemeDescription('');
    setSecuritySchemeIsDefault(false);
    setSecurityError(null);
  };

  const resetSecurityLevelForm = () => {
    setSecurityLevelName('');
    setSecurityLevelDescription('');
    setSecurityLevelIsDefault(false);
    setSecurityLevelMemberType('project_role');
    setSecurityLevelMemberRole('developer');
    setSecurityLevelMemberValue('');
    setSecurityError(null);
  };

  const createProjectSecurityScheme = async (): Promise<void> => {
    const name = securitySchemeName.trim();
    if (!name) {
      setSecurityError(t('settings.securitySchemes.name_required'));
      return;
    }
    if (!customFieldScope) {
      setSecurityError(t('settings.securitySchemes.error_generic'));
      return;
    }

    setSecurityError(null);
    setSecuritySaved(null);
    try {
      const scheme = await createSecurityScheme.mutateAsync({
        organizationId: customFieldScope.organizationId,
        name,
        description: securitySchemeDescription.trim() || null,
        isDefault: securitySchemeIsDefault,
      });
      resetSecuritySchemeForm();
      setSecurityLevelSchemeId(scheme.id);
      setSecuritySaved(t('settings.securitySchemes.created'));
    } catch (err: unknown) {
      setSecurityError(
        err instanceof Error ? err.message : t('settings.securitySchemes.error_generic'),
      );
    }
  };

  const assignSecuritySchemeToProject = async (value: SecuritySchemeChoiceValue): Promise<void> => {
    const schemeId = value === DEFAULT_SECURITY_SCHEME_VALUE ? null : value;
    const currentAssigned = securitySchemeState?.assignedSchemeId ?? null;
    if (schemeId === currentAssigned) return;

    setSecurityError(null);
    setSecuritySaved(null);
    try {
      await assignSecurityScheme.mutateAsync(schemeId);
      setSecuritySaved(
        schemeId
          ? t('settings.securitySchemes.assigned_to_project')
          : t('settings.securitySchemes.follows_default'),
      );
    } catch (err: unknown) {
      setSecurityError(
        err instanceof Error ? err.message : t('settings.securitySchemes.assign_failed'),
      );
    }
  };

  const setSecuritySchemeDefault = async (scheme: SecurityScheme): Promise<void> => {
    if (scheme.isDefault) return;

    setSecurityError(null);
    setSecuritySaved(null);
    try {
      await updateSecurityScheme.mutateAsync({ schemeId: scheme.id, isDefault: true });
      setSecuritySaved(t('settings.securitySchemes.default_updated'));
    } catch (err: unknown) {
      setSecurityError(
        err instanceof Error ? err.message : t('settings.securitySchemes.save_failed'),
      );
    }
  };

  const deleteSecuritySchemeById = async (scheme: SecurityScheme): Promise<void> => {
    if (scheme.projectCount > 0) {
      setSecurityError(t('settings.securitySchemes.delete_in_use'));
      return;
    }

    setSecurityError(null);
    setSecuritySaved(null);
    try {
      await deleteSecurityScheme.mutateAsync(scheme.id);
      if (securityLevelSchemeId === scheme.id) setSecurityLevelSchemeId('');
      setSecuritySaved(t('settings.securitySchemes.deleted'));
    } catch (err: unknown) {
      setSecurityError(
        err instanceof Error ? err.message : t('settings.securitySchemes.delete_failed'),
      );
    }
  };

  const confirmDeleteSecurityScheme = (scheme: SecurityScheme) => {
    Alert.alert(
      t('settings.securitySchemes.delete_title'),
      t('settings.securitySchemes.delete_warning', { name: scheme.name }),
      [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('settings.securitySchemes.delete_submit'),
          style: 'destructive',
          onPress: () => void deleteSecuritySchemeById(scheme),
        },
      ],
    );
  };

  const createProjectSecurityLevel = async (): Promise<void> => {
    const schemeId = securityLevelSchemeId || securitySchemes[0]?.id;
    const name = securityLevelName.trim();
    const memberValue =
      securityLevelMemberType === 'project_role'
        ? securityLevelMemberRole
        : securityLevelMemberValue.trim();

    if (!schemeId || !name) {
      setSecurityError(t('settings.securitySchemes.level_required'));
      return;
    }
    if (securityLevelMemberType === 'user' && !memberValue) {
      setSecurityError(t('settings.securitySchemes.member_value_required'));
      return;
    }

    setSecurityError(null);
    setSecuritySaved(null);
    try {
      await createSecurityLevel.mutateAsync({
        schemeId,
        name,
        description: securityLevelDescription.trim() || null,
        isDefault: securityLevelIsDefault,
        members: [
          {
            type: securityLevelMemberType,
            value:
              securityLevelMemberType === 'project_role' || securityLevelMemberType === 'user'
                ? memberValue
                : null,
          },
        ],
      });
      resetSecurityLevelForm();
      setSecurityLevelSchemeId(schemeId);
      setSecuritySaved(t('settings.securitySchemes.level_created'));
    } catch (err: unknown) {
      setSecurityError(
        err instanceof Error ? err.message : t('settings.securitySchemes.save_failed'),
      );
    }
  };

  const deleteSecurityLevelById = async (
    scheme: SecurityScheme,
    level: SecurityLevel,
  ): Promise<void> => {
    setSecurityError(null);
    setSecuritySaved(null);
    try {
      await deleteSecurityLevel.mutateAsync({ schemeId: scheme.id, levelId: level.id });
      setSecuritySaved(t('settings.securitySchemes.level_deleted'));
    } catch (err: unknown) {
      setSecurityError(
        err instanceof Error ? err.message : t('settings.securitySchemes.delete_failed'),
      );
    }
  };

  const confirmDeleteSecurityLevel = (scheme: SecurityScheme, level: SecurityLevel) => {
    Alert.alert(
      t('settings.securitySchemes.delete_level_title'),
      t('settings.securitySchemes.delete_level_warning', { name: level.name }),
      [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('settings.securitySchemes.delete_level_submit'),
          style: 'destructive',
          onPress: () => void deleteSecurityLevelById(scheme, level),
        },
      ],
    );
  };

  const resetAutomationForm = () => {
    setAutomationEditingRuleId(null);
    setAutomationName('');
    setAutomationDescription('');
    setAutomationTriggerType('issue_created');
    setAutomationActionType('assign_issue');
    setAutomationEnabled(true);
    setAutomationError(null);
  };

  const beginAutomationEdit = (rule: AutomationRule) => {
    setAutomationEditingRuleId(rule.id);
    setAutomationName(rule.name);
    setAutomationDescription(rule.description ?? '');
    setAutomationTriggerType(
      AUTOMATION_TRIGGER_TYPES.includes(rule.trigger.type as AutomationTriggerType)
        ? (rule.trigger.type as AutomationTriggerType)
        : 'issue_created',
    );
    const firstAction = rule.actions[0]?.type;
    setAutomationActionType(
      AUTOMATION_ACTION_TYPES.includes(firstAction as AutomationActionType)
        ? (firstAction as AutomationActionType)
        : 'assign_issue',
    );
    setAutomationEnabled(rule.enabled);
    setAutomationError(null);
    setAutomationSaved(null);
  };

  const saveAutomationRule = async (): Promise<void> => {
    const name = automationName.trim();
    if (!name) {
      setAutomationError(t('settings.automation.name_required'));
      return;
    }
    if (!customFieldScope) {
      setAutomationError(t('settings.automation.error_generic'));
      return;
    }

    setAutomationError(null);
    setAutomationSaved(null);
    try {
      const input = {
        name,
        description: automationDescription.trim() || null,
        enabled: automationEnabled,
        trigger: { type: automationTriggerType },
        conditions: [],
        actions: [{ type: automationActionType }],
      };
      if (automationEditingRuleId) {
        await updateAutomationRule.mutateAsync({ ruleId: automationEditingRuleId, ...input });
        setAutomationSaved(t('settings.automation.updated'));
      } else {
        await createAutomationRule.mutateAsync({
          organizationId: customFieldScope.organizationId,
          projectId: id,
          ...input,
        });
        setAutomationSaved(t('settings.automation.created'));
      }
      resetAutomationForm();
    } catch (err: unknown) {
      setAutomationError(err instanceof Error ? err.message : t('settings.automation.save_failed'));
    }
  };

  const toggleAutomationRule = async (rule: AutomationRule): Promise<void> => {
    setAutomationError(null);
    setAutomationSaved(null);
    try {
      await updateAutomationRule.mutateAsync({ ruleId: rule.id, enabled: !rule.enabled });
      setAutomationSaved(
        rule.enabled ? t('settings.automation.disabled') : t('settings.automation.enabled'),
      );
    } catch (err: unknown) {
      setAutomationError(
        err instanceof Error ? err.message : t('settings.automation.toggle_failed'),
      );
    }
  };

  const deleteAutomationRuleById = async (rule: AutomationRule): Promise<void> => {
    setAutomationError(null);
    setAutomationSaved(null);
    try {
      await deleteAutomationRule.mutateAsync(rule.id);
      if (automationEditingRuleId === rule.id) resetAutomationForm();
      if (automationExecutionsRuleId === rule.id) setAutomationExecutionsRuleId(null);
      setAutomationSaved(t('settings.automation.deleted'));
    } catch (err: unknown) {
      setAutomationError(
        err instanceof Error ? err.message : t('settings.automation.delete_failed'),
      );
    }
  };

  const confirmDeleteAutomationRule = (rule: AutomationRule) => {
    Alert.alert(
      t('settings.automation.delete_title'),
      t('settings.automation.delete_warning', { name: rule.name }),
      [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('settings.automation.delete_submit'),
          style: 'destructive',
          onPress: () => void deleteAutomationRuleById(rule),
        },
      ],
    );
  };

  const toggleProjectCommunication = async (key: ProjectCommunicationToggleKey): Promise<void> => {
    const data = projectCommsQ.data;
    if (!data) return;
    if (!data.access.canManage) {
      setProjectCommsError(t('settings.projectComms.manage_restricted'));
      return;
    }

    setProjectCommsError(null);
    setProjectCommsSaved(null);
    try {
      await updateProjectComms.mutateAsync({ [key]: !data.projectSettings[key] });
      setProjectCommsSaved(t('settings.projectComms.updated'));
    } catch (err: unknown) {
      setProjectCommsError(
        err instanceof Error ? err.message : t('settings.projectComms.update_failed'),
      );
    }
  };

  const updateProjectAgentPolicy = async (
    patch: Parameters<typeof updateProjectAgents.mutateAsync>[0],
  ): Promise<void> => {
    if (!projectAgentsQ.data?.access.canManage) {
      setProjectAgentError(t('settings.projectAi.manage_restricted'));
      return;
    }

    setProjectAgentError(null);
    setProjectAgentSaved(null);
    try {
      await updateProjectAgents.mutateAsync(patch);
      setProjectAgentSaved(t('settings.projectAi.updated'));
    } catch (err: unknown) {
      setProjectAgentError(
        err instanceof Error ? err.message : t('settings.projectAi.update_failed'),
      );
    }
  };

  const toggleProjectAgentSetting = (
    key:
      | 'enabled'
      | 'inheritWorkspaceDefaults'
      | 'allowWriteActions'
      | 'autoAssignToPlannedSprints',
  ) => {
    const settings = projectAgentsQ.data?.projectSettings;
    if (!settings) return;
    void updateProjectAgentPolicy({ [key]: !settings[key] });
  };

  const updateProjectAgentExecutionMode = (mode: ProjectAgentExecutionMode) => {
    const settings = projectAgentsQ.data?.projectSettings;
    if (!settings || settings.executionMode === mode) return;
    void updateProjectAgentPolicy({ executionMode: mode });
  };

  const toggleProjectAgentCapability = (capability: ProjectAgentCapability) => {
    const settings = projectAgentsQ.data?.projectSettings;
    if (!settings) return;
    void updateProjectAgentPolicy({
      capabilities: {
        [capability]: !settings.capabilities[capability],
      },
    });
  };

  const saveProjectAgentCapacity = () => {
    const sprintBatchSize = Number(agentSprintBatchSize);
    const sprintLengthDays = Number(agentSprintLengthDays);
    const issueCapacityPerSprint = Number(agentIssueCapacity);
    if (
      !Number.isInteger(sprintBatchSize) ||
      sprintBatchSize < 1 ||
      sprintBatchSize > 6 ||
      !Number.isInteger(sprintLengthDays) ||
      sprintLengthDays < 7 ||
      sprintLengthDays > 30 ||
      !Number.isInteger(issueCapacityPerSprint) ||
      issueCapacityPerSprint < 3 ||
      issueCapacityPerSprint > 50
    ) {
      setProjectAgentError(t('settings.projectAi.capacity_invalid'));
      return;
    }

    void updateProjectAgentPolicy({
      sprintBatchSize,
      sprintLengthDays,
      issueCapacityPerSprint,
    });
  };

  const resetWebhookForm = () => {
    setWebhookEditingId(null);
    setWebhookName('');
    setWebhookUrl('');
    setWebhookEvents(PROJECT_DEFAULT_WEBHOOK_EVENTS);
    setWebhookError(null);
  };

  const beginWebhookEdit = (webhook: Webhook) => {
    setWebhookEditingId(webhook.id);
    setWebhookName(webhook.name);
    setWebhookUrl(webhook.url);
    setWebhookEvents(webhook.events.length > 0 ? webhook.events : PROJECT_DEFAULT_WEBHOOK_EVENTS);
    setWebhookError(null);
    setWebhookSaved(null);
    setWebhookSecret(null);
  };

  const toggleWebhookEvent = (event: string) => {
    setWebhookEvents((current) =>
      current.includes(event) ? current.filter((item) => item !== event) : [...current, event],
    );
    setWebhookError(null);
    setWebhookSaved(null);
  };

  const submitProjectWebhook = async (): Promise<void> => {
    if (!customFieldScope) return;
    const name = webhookName.trim();
    const url = webhookUrl.trim();
    setWebhookError(null);
    setWebhookSaved(null);
    setWebhookSecret(null);

    if (!name || !url || webhookEvents.length === 0) {
      setWebhookError(t('developer.webhooks.requiredFields'));
      return;
    }
    if (!isValidWebhookUrl(url)) {
      setWebhookError(t('developer.webhooks.invalidUrl'));
      return;
    }

    try {
      if (webhookEditingId) {
        await updateProjectWebhook.mutateAsync({
          id: webhookEditingId,
          name,
          url,
          events: webhookEvents,
        });
        setWebhookSaved(t('developer.webhooks.updated'));
      } else {
        const webhook = await createProjectWebhook.mutateAsync({
          organizationId: customFieldScope.organizationId,
          projectId: id,
          name,
          url,
          events: webhookEvents,
        });
        setWebhookSecret(webhook.secret ?? null);
        setWebhookSaved(t('developer.webhooks.created'));
      }
      resetWebhookForm();
    } catch (err: unknown) {
      setWebhookError(err instanceof Error ? err.message : t('developer.webhooks.saveFailed'));
    }
  };

  const toggleProjectWebhookActive = async (webhook: Webhook): Promise<void> => {
    setWebhookError(null);
    setWebhookSaved(null);
    try {
      await updateProjectWebhook.mutateAsync({ id: webhook.id, isActive: !webhook.isActive });
      setWebhookSaved(
        webhook.isActive ? t('developer.webhooks.disabled') : t('developer.webhooks.enabled'),
      );
    } catch (err: unknown) {
      setWebhookError(err instanceof Error ? err.message : t('developer.webhooks.saveFailed'));
    }
  };

  const sendProjectWebhookTest = async (webhook: Webhook): Promise<void> => {
    setTestingWebhookId(webhook.id);
    setWebhookError(null);
    setWebhookSaved(null);
    try {
      const result = await testProjectWebhook.mutateAsync(webhook.id);
      setWebhookTestResults((current) => ({ ...current, [webhook.id]: result }));
      setWebhookSaved(
        result.success ? t('developer.webhooks.testDelivered') : t('developer.webhooks.testFailed'),
      );
    } catch (err: unknown) {
      setWebhookTestResults((current) => ({
        ...current,
        [webhook.id]: {
          success: false,
          statusCode: null,
          durationMs: 0,
          error: t('developer.webhooks.testFailed'),
        },
      }));
      setWebhookError(err instanceof Error ? err.message : t('developer.webhooks.testFailed'));
    } finally {
      setTestingWebhookId(null);
    }
  };

  const deleteProjectWebhookById = async (webhook: Webhook): Promise<void> => {
    setWebhookError(null);
    setWebhookSaved(null);
    try {
      await deleteProjectWebhook.mutateAsync(webhook.id);
      if (webhookEditingId === webhook.id) resetWebhookForm();
      setWebhookSaved(t('developer.webhooks.deleted'));
    } catch (err: unknown) {
      setWebhookError(err instanceof Error ? err.message : t('developer.webhooks.deleteFailed'));
    }
  };

  const confirmDeleteProjectWebhook = (webhook: Webhook) => {
    Alert.alert(
      t('developer.webhooks.deleteTitle'),
      t('developer.webhooks.deleteMessage', { name: webhook.name }),
      [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('developer.webhooks.delete'),
          style: 'destructive',
          onPress: () => void deleteProjectWebhookById(webhook),
        },
      ],
    );
  };

  const createWorkItemType = () => {
    const created = schemaSettings.addWorkItemType({
      name: t('settings.workItemTypes.new_type_name'),
      icon: 'pin',
      color: '#64748B',
    });
    setWorkItemTypeEditingId(created.id);
    setWorkItemTypeSaved(t('settings.workItemTypes.created'));
  };

  const confirmDeleteWorkItemType = (type: WorkItemTypeDefinition) => {
    if (type.isDefault) return;
    Alert.alert(
      t('settings.workItemTypes.delete_title'),
      t('settings.workItemTypes.delete_warning', { name: workItemTypeName(type, t) }),
      [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('settings.workItemTypes.delete_submit'),
          style: 'destructive',
          onPress: () => {
            schemaSettings.removeWorkItemType(type.id);
            if (workItemTypeEditingId === type.id) setWorkItemTypeEditingId(null);
            setWorkItemTypeSaved(t('settings.workItemTypes.deleted'));
          },
        },
      ],
    );
  };

  const addWorkItemCustomProperty = (typeId: string) => {
    schemaSettings.addCustomProperty(typeId, {
      name: t('settings.workItemTypes.new_property_name'),
      type: 'text',
      required: false,
    });
    setWorkItemTypeSaved(t('settings.workItemTypes.updated'));
  };

  const updateWorkItemCustomProperty = (
    typeId: string,
    property: WorkItemCustomProperty,
    patch: Partial<Omit<WorkItemCustomProperty, 'id'>>,
  ) => {
    const nextPatch =
      patch.type === 'dropdown' && (!patch.options || patch.options.length === 0)
        ? {
            ...patch,
            options: [t('settings.workItemTypes.option_n', { index: 1 })],
          }
        : patch;
    schemaSettings.updateCustomProperty(typeId, property.id, nextPatch);
    setWorkItemTypeSaved(null);
  };

  const removeWorkItemCustomProperty = (typeId: string, propertyId: string) => {
    schemaSettings.removeCustomProperty(typeId, propertyId);
    setWorkItemTypeSaved(t('settings.workItemTypes.updated'));
  };

  const handleEstimateKindChange = (kind: EstimateKind) => {
    setEstimateActiveKind(kind);
    const firstPreset = SUBKINDS_BY_KIND[kind].find((subKind) => !isCustomSubKind(subKind));
    if (firstPreset) setEstimateSelectedSubKind(firstPreset);
    setEstimateSaved(null);
  };

  const updateEstimateCustomValue = (kind: EstimateKind, index: number, value: string) => {
    setEstimateCustomValues((current) => {
      const valuesForKind = [...current[kind]];
      valuesForKind[index] = value;
      return { ...current, [kind]: valuesForKind };
    });
    setEstimateSaved(null);
  };

  const addEstimateCustomValue = (kind: EstimateKind) => {
    setEstimateCustomValues((current) => {
      if (current[kind].length >= MAX_CUSTOM_ESTIMATE_VALUES) return current;
      return { ...current, [kind]: [...current[kind], ''] };
    });
    setEstimateSaved(null);
  };

  const removeEstimateCustomValue = (kind: EstimateKind, index: number) => {
    setEstimateCustomValues((current) => {
      if (current[kind].length <= MIN_CUSTOM_ESTIMATE_VALUES) return current;
      return {
        ...current,
        [kind]: current[kind].filter((_, valueIndex) => valueIndex !== index),
      };
    });
    setEstimateSaved(null);
  };

  const estimateDraftScale = (): EstimateScale | null => {
    if (isCustomSubKind(estimateSelectedSubKind)) {
      const kind = kindOfSubKind(estimateSelectedSubKind);
      const valuesForKind = estimateCustomValues[kind].map((value) => value.trim()).filter(Boolean);
      if (valuesForKind.length < MIN_CUSTOM_ESTIMATE_VALUES) return null;
      return makeCustomScale(kind, valuesForKind);
    }
    return localizedPresetEstimateScale(estimateSelectedSubKind, t);
  };

  const saveEstimateScale = () => {
    const scale = estimateDraftScale();
    if (!scale) {
      setEstimateSaved(t('settings.estimates.custom_minimum'));
      return;
    }
    schemaSettings.updateEstimateScale(scale);
    setEstimateSaved(t('settings.estimates.saved'));
  };

  const resetEstimateScale = () => {
    schemaSettings.resetEstimateScale();
    setEstimateSaved(t('settings.estimates.reset_done'));
  };

  if (projectQ.isLoading) return <Loading />;
  if (projectQ.isError || !project) {
    return (
      <Screen>
        <ErrorView
          message={
            projectQ.error instanceof Error ? projectQ.error.message : t('projects.loadFailed')
          }
          onRetry={() => void projectQ.refetch()}
        />
      </Screen>
    );
  }

  return (
    <Screen>
      <KeyboardAvoidingView
        className="flex-1"
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          ref={scrollRef}
          className="flex-1"
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={styles.content}
        >
          <ScreenHeader
            kicker={project.key}
            title={t('projects.settings')}
            subtitle={t('projects.settingsSubtitle')}
            meta={<SemanticBadge label={values.status} tone="blue" />}
          />

          <SurfaceRow className="gap-3">
            <View className="flex-row items-start gap-3">
              <IconTile icon={FolderCog} tone="blue" />
              <View className="flex-1 gap-1">
                <Text className="text-foreground text-sm font-semibold">
                  {t('projects.generalSettings')}
                </Text>
                <Text className="text-muted-foreground text-sm" style={styles.helpText}>
                  {t('projects.generalSettingsDesc')}
                </Text>
              </View>
            </View>
          </SurfaceRow>

          <SurfaceRow
            className="gap-3"
            onPress={() => navigation.navigate('ProjectWorkflows', { projectId: id })}
          >
            <View className="flex-row items-start gap-3">
              <IconTile icon={Workflow} tone="violet" />
              <View className="min-w-0 flex-1 gap-1">
                <Text className="text-foreground text-sm font-semibold">
                  {t('settings.workflows.title')}
                </Text>
                <Text className="text-muted-foreground text-sm" style={styles.helpText}>
                  {t('settings.workflows.subtitle')}
                </Text>
              </View>
            </View>
            <Text className="text-muted-foreground text-xs">
              {t('settings.workflows.openDescription')}
            </Text>
          </SurfaceRow>

          <SurfaceRow
            className="gap-3"
            onLayout={(event) =>
              handleSettingsSectionLayout('permissions', event.nativeEvent.layout.y)
            }
          >
            <View className="flex-row items-start gap-3">
              <IconTile icon={Users} tone="blue" />
              <View className="min-w-0 flex-1 gap-1">
                <Text className="text-foreground text-sm font-semibold">
                  {t('settings.projectMembers.title')}
                </Text>
                <Text className="text-muted-foreground text-sm" style={styles.helpText}>
                  {t('settings.projectMembers.subtitle')}
                </Text>
              </View>
              <SemanticBadge
                label={t('settings.projectMembers.member_count', { count: projectMembers.length })}
                tone="blue"
              />
            </View>

            <View style={styles.componentForm}>
              <View style={styles.componentSubsection}>
                <Text className="text-foreground text-sm font-semibold">
                  {t('settings.projectMembers.add_title')}
                </Text>
                {organizationMembersQ.isLoading ? (
                  <Text style={styles.helperText}>
                    {t('settings.projectMembers.candidates_loading')}
                  </Text>
                ) : organizationMembersQ.isError ? (
                  <Text className="text-destructive text-sm">
                    {organizationMembersQ.error instanceof Error
                      ? organizationMembersQ.error.message
                      : t('settings.projectMembers.candidates_failed')}
                  </Text>
                ) : (
                  <>
                    <View style={styles.choiceGrid}>
                      {projectMemberCandidates.slice(0, 12).map((member) => (
                        <ChoiceButton
                          key={member.id}
                          label={member.name ?? member.email}
                          value={member.id}
                          selected={projectMemberCandidateUserId === member.id}
                          disabled={projectMemberMutating}
                          onPress={(value) => {
                            setProjectMemberCandidateUserId(value);
                            setProjectMemberError(null);
                            setProjectMemberSaved(null);
                          }}
                        />
                      ))}
                    </View>
                    {projectMemberCandidates.length === 0 ? (
                      <Text style={styles.helperText}>
                        {t('settings.projectMembers.no_candidates')}
                      </Text>
                    ) : null}
                    <View style={styles.choiceGrid}>
                      {PROJECT_SCHEME_BASE_ROLES.map((role) => (
                        <ChoiceButton
                          key={role}
                          label={projectRoleLabel(role, t)}
                          value={role}
                          selected={projectMemberCandidateRole === role}
                          disabled={projectMemberMutating}
                          onPress={setProjectMemberCandidateRole}
                        />
                      ))}
                    </View>
                    <View style={styles.componentActions}>
                      <Button
                        title={t('settings.projectMembers.add_submit')}
                        icon={UserPlus}
                        loading={addProjectMember.isPending}
                        disabled={projectMemberMutating || !projectMemberCandidateUserId}
                        onPress={() => void addMemberToProject()}
                      />
                    </View>
                  </>
                )}
              </View>

              <View style={styles.componentSubsection}>
                <View className="flex-row items-start gap-3">
                  <IconTile icon={Link} tone="cyan" />
                  <View className="min-w-0 flex-1 gap-1">
                    <Text className="text-foreground text-sm font-semibold">
                      {t('settings.projectMembers.invite_link_title')}
                    </Text>
                    <Text className="text-muted-foreground text-xs" style={styles.helpText}>
                      {t('settings.projectMembers.invite_link_description')}
                    </Text>
                  </View>
                </View>

                <Text className="text-foreground text-sm font-semibold">
                  {t('settings.projectMembers.role_label')}
                </Text>
                <View style={styles.choiceGrid}>
                  {PROJECT_SCHEME_BASE_ROLES.map((role) => (
                    <ChoiceButton
                      key={role}
                      label={projectRoleLabel(role, t)}
                      value={role}
                      selected={projectInviteLinkRole === role}
                      disabled={projectInviteLinkMutating}
                      onPress={setProjectInviteLinkRole}
                    />
                  ))}
                </View>

                <Text className="text-foreground text-sm font-semibold">
                  {t('settings.projectMembers.invite_link_expiry_label')}
                </Text>
                <View style={styles.choiceGrid}>
                  {PROJECT_INVITE_EXPIRY_OPTIONS.map((days) => (
                    <ChoiceButton
                      key={days}
                      label={t('settings.projectMembers.invite_link_days', { count: days })}
                      value={String(days)}
                      selected={projectInviteLinkExpiresInDays === days}
                      disabled={projectInviteLinkMutating}
                      onPress={(value) => setProjectInviteLinkExpiresInDays(Number(value))}
                    />
                  ))}
                </View>

                <Text className="text-foreground text-sm font-semibold">
                  {t('settings.projectMembers.invite_link_max_uses_label')}
                </Text>
                <View style={styles.choiceGrid}>
                  {PROJECT_INVITE_MAX_USE_OPTIONS.map((uses) => (
                    <ChoiceButton
                      key={uses}
                      label={t('settings.projectMembers.invite_link_uses', { count: uses })}
                      value={String(uses)}
                      selected={projectInviteLinkMaxUses === uses}
                      disabled={projectInviteLinkMutating}
                      onPress={(value) => setProjectInviteLinkMaxUses(Number(value))}
                    />
                  ))}
                </View>

                <View style={styles.componentActions}>
                  <Button
                    title={t('settings.projectMembers.invite_link_create')}
                    icon={Link}
                    loading={createProjectInviteLink.isPending}
                    disabled={projectInviteLinkMutating}
                    onPress={() => void createProjectInviteLinkForProject()}
                  />
                </View>

                {createdProjectInviteUrl ? (
                  <View style={styles.secretBox}>
                    <Text className="text-foreground text-sm font-semibold">
                      {t('settings.projectMembers.invite_link_created')}
                    </Text>
                    <Text selectable style={styles.secretValue}>
                      {createdProjectInviteUrl}
                    </Text>
                    <View style={styles.componentActions}>
                      <Button
                        title={t('settings.projectMembers.invite_link_share')}
                        variant="secondary"
                        icon={Send}
                        onPress={() => void shareCreatedProjectInviteLink()}
                      />
                    </View>
                  </View>
                ) : null}

                <Text className="text-foreground text-sm font-semibold">
                  {t('settings.projectMembers.invite_link_active')}
                </Text>
                <View style={styles.componentList}>
                  {projectInviteLinks.slice(0, 5).map((link) => {
                    const status = projectInviteLinkStatus(link);
                    const inactive = status !== 'active';
                    return (
                      <View key={link.id} style={styles.componentRow}>
                        <View className="min-w-0 flex-1 gap-1">
                          <View className="flex-row items-center gap-2">
                            <SemanticBadge
                              label={t(`settings.projectMembers.invite_link_status_${status}`)}
                              tone={projectInviteLinkStatusTone(status)}
                            />
                            <Text className="text-foreground text-sm font-semibold">
                              {projectRoleLabel(link.role, t)}
                            </Text>
                          </View>
                          <Text className="text-muted-foreground text-xs" numberOfLines={2}>
                            {t('settings.projectMembers.invite_link_meta', {
                              used: link.usedCount,
                              max: link.maxUses,
                              date: formatVersionDate(link.expiresAt, i18n.language),
                            })}
                          </Text>
                          {link.creatorName || link.creatorEmail ? (
                            <Text className="text-muted-foreground text-xs" numberOfLines={1}>
                              {t('settings.projectMembers.invite_link_created_by', {
                                name: link.creatorName ?? link.creatorEmail,
                              })}
                            </Text>
                          ) : null}
                        </View>
                        <View style={styles.componentRowActions}>
                          <Pressable
                            accessibilityRole="button"
                            accessibilityLabel={t(
                              'settings.projectMembers.invite_link_revoke_submit',
                            )}
                            disabled={inactive || projectInviteLinkMutating}
                            onPress={() => confirmRevokeProjectInviteLink(link)}
                            style={[
                              styles.iconAction,
                              styles.iconActionDanger,
                              inactive || projectInviteLinkMutating ? styles.disabled : null,
                            ]}
                            className="active:opacity-80"
                          >
                            <X size={15} color={colors.destructive} />
                          </Pressable>
                        </View>
                      </View>
                    );
                  })}
                  {projectInviteLinksQ.isLoading ? (
                    <Text style={styles.helperText}>
                      {t('settings.projectMembers.invite_link_loading')}
                    </Text>
                  ) : null}
                  {!projectInviteLinksQ.isLoading && projectInviteLinks.length === 0 ? (
                    <Text style={styles.helperText}>
                      {t('settings.projectMembers.invite_link_empty')}
                    </Text>
                  ) : null}
                  {projectInviteLinksQ.isError ? (
                    <Text className="text-destructive text-sm">
                      {projectInviteLinksQ.error instanceof Error
                        ? projectInviteLinksQ.error.message
                        : t('settings.projectMembers.invite_link_load_failed')}
                    </Text>
                  ) : null}
                </View>
              </View>

              {selectedProjectMember ? (
                <View style={styles.componentSubsection}>
                  <View className="flex-row items-center gap-2">
                    <Avatar
                      initials={initials(
                        selectedProjectMember.user.name,
                        selectedProjectMember.user.email,
                      )}
                      size={30}
                    />
                    <View className="min-w-0 flex-1">
                      <Text className="text-foreground text-sm font-semibold" numberOfLines={1}>
                        {selectedProjectMember.user.name ?? selectedProjectMember.user.email}
                      </Text>
                      <Text className="text-muted-foreground text-xs" numberOfLines={1}>
                        {selectedProjectMember.user.email}
                      </Text>
                    </View>
                  </View>
                  <Text className="text-foreground text-sm font-semibold">
                    {t('settings.projectMembers.role_label')}
                  </Text>
                  <View style={styles.choiceGrid}>
                    {PROJECT_SCHEME_BASE_ROLES.map((role) => (
                      <ChoiceButton
                        key={role}
                        label={projectRoleLabel(role, t)}
                        value={role}
                        selected={projectMemberRole === role}
                        disabled={projectMemberMutating}
                        onPress={(value) => {
                          setProjectMemberRole(value);
                          setProjectMemberError(null);
                          setProjectMemberSaved(null);
                        }}
                      />
                    ))}
                  </View>

                  <Text className="text-foreground text-sm font-semibold">
                    {t('settings.projectMembers.permissions_label')}
                  </Text>
                  <View style={styles.toggleList}>
                    {PROJECT_MEMBER_PERMISSION_TOGGLES.map((permission) => {
                      const selected = projectMemberPermissions[permission.key] === true;
                      return (
                        <Pressable
                          key={permission.key}
                          accessibilityRole="switch"
                          accessibilityState={{
                            checked: selected,
                            disabled: projectMemberMutating,
                          }}
                          disabled={projectMemberMutating}
                          onPress={() => toggleProjectMemberPermission(permission.key)}
                          style={[
                            styles.toggleRow,
                            selected ? styles.toggleRowActive : null,
                            projectMemberMutating ? styles.disabled : null,
                          ]}
                          className="active:opacity-80"
                        >
                          <View className="min-w-0 flex-1 gap-1">
                            <Text className="text-foreground text-sm font-semibold">
                              {t(permission.labelKey)}
                            </Text>
                            <Text className="text-muted-foreground text-xs" style={styles.helpText}>
                              {t(permission.descKey)}
                            </Text>
                          </View>
                          <View
                            style={[styles.switchTrack, selected ? styles.switchTrackActive : null]}
                          >
                            {selected ? <Check size={13} color={colors.primaryForeground} /> : null}
                          </View>
                        </Pressable>
                      );
                    })}
                  </View>

                  <View style={styles.componentActions}>
                    <Button
                      title={t('common.cancel')}
                      variant="secondary"
                      icon={X}
                      disabled={projectMemberMutating}
                      onPress={resetProjectMemberEditor}
                    />
                    <Button
                      title={t('settings.projectMembers.reset_submit')}
                      variant="secondary"
                      icon={RotateCcw}
                      loading={updateProjectMember.isPending}
                      disabled={projectMemberMutating}
                      onPress={() => void resetProjectMemberDefaults()}
                    />
                    <Button
                      title={t('settings.projectMembers.save_submit')}
                      icon={Check}
                      loading={updateProjectMember.isPending}
                      disabled={projectMemberMutating}
                      onPress={() => void saveProjectMember()}
                    />
                  </View>
                </View>
              ) : null}

              {projectMemberError ? (
                <Text className="text-destructive text-sm">{projectMemberError}</Text>
              ) : null}
              {projectMemberSaved ? (
                <Text className="text-muted-foreground text-sm">{projectMemberSaved}</Text>
              ) : null}
            </View>

            <View style={styles.componentList}>
              {projectMembers.map((member) => (
                <View key={member.id} style={styles.componentRow}>
                  <View className="min-w-0 flex-1 gap-1">
                    <View className="flex-row items-center gap-2">
                      <Avatar initials={initials(member.user.name, member.user.email)} size={28} />
                      <Text className="text-foreground text-base font-semibold" numberOfLines={1}>
                        {member.user.name ?? member.user.email}
                      </Text>
                    </View>
                    <Text className="text-muted-foreground text-xs" numberOfLines={1}>
                      {member.user.email}
                    </Text>
                    <SemanticBadge
                      label={projectRoleLabel(member.role ?? 'viewer', t)}
                      tone={member.role === 'product_owner' ? 'violet' : 'blue'}
                    />
                  </View>
                  <View style={styles.componentRowActions}>
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel={t('common.edit')}
                      disabled={projectMemberMutating}
                      onPress={() => beginProjectMemberEdit(member)}
                      style={[styles.iconAction, projectMemberMutating ? styles.disabled : null]}
                      className="active:opacity-80"
                    >
                      <Pencil size={15} color={colors.foreground} />
                    </Pressable>
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel={t('settings.projectMembers.remove_submit')}
                      disabled={projectMemberMutating}
                      onPress={() => confirmRemoveProjectMember(member)}
                      style={[
                        styles.iconAction,
                        styles.iconActionDanger,
                        projectMemberMutating ? styles.disabled : null,
                      ]}
                      className="active:opacity-80"
                    >
                      <Trash2 size={15} color={colors.destructive} />
                    </Pressable>
                  </View>
                </View>
              ))}
              {membersQ.isLoading ? (
                <Text style={styles.helperText}>{t('settings.projectMembers.loading')}</Text>
              ) : null}
              {!membersQ.isLoading && projectMembers.length === 0 ? (
                <Text style={styles.helperText}>{t('settings.projectMembers.empty')}</Text>
              ) : null}
              {membersQ.isError ? (
                <Text className="text-destructive text-sm">
                  {membersQ.error instanceof Error
                    ? membersQ.error.message
                    : t('settings.projectMembers.load_failed')}
                </Text>
              ) : null}
            </View>
          </SurfaceRow>

          <SurfaceRow
            className="gap-3"
            onLayout={(event) => handleSettingsSectionLayout('schemes', event.nativeEvent.layout.y)}
          >
            <View className="flex-row items-start gap-3">
              <IconTile icon={Shield} tone="amber" />
              <View className="min-w-0 flex-1 gap-1">
                <Text className="text-foreground text-sm font-semibold">
                  {t('settings.permissionSchemes.title')}
                </Text>
                <Text className="text-muted-foreground text-sm" style={styles.helpText}>
                  {t('settings.permissionSchemes.subtitle')}
                </Text>
              </View>
              {permissionSchemeState ? (
                <SemanticBadge
                  label={permissionSchemeSourceLabel(permissionSchemeState.source, t)}
                  tone={permissionSchemeSourceTone(permissionSchemeState.source)}
                />
              ) : null}
            </View>

            {permissionSchemeLoading ? (
              <Text style={styles.helperText}>{t('settings.permissionSchemes.loading')}</Text>
            ) : permissionSchemeLoadError ? (
              <Text className="text-destructive text-sm">{permissionSchemeLoadError}</Text>
            ) : (
              <View style={styles.componentForm}>
                <View style={styles.agentSummaryGrid}>
                  <View style={styles.agentSummaryBox}>
                    <Text style={styles.agentSummaryLabel}>
                      {t('settings.permissionSchemes.effective_label')}
                    </Text>
                    <Text style={styles.agentSummaryValue} numberOfLines={1}>
                      {permissionSchemeState?.scheme?.name ?? t('settings.permissionSchemes.none')}
                    </Text>
                  </View>
                  <View style={styles.agentSummaryBox}>
                    <Text style={styles.agentSummaryLabel}>
                      {t('settings.permissionSchemes.source_label')}
                    </Text>
                    <Text style={styles.agentSummaryValue} numberOfLines={1}>
                      {permissionSchemeSourceLabel(permissionSchemeState?.source, t)}
                    </Text>
                  </View>
                </View>

                <View style={styles.componentSubsection}>
                  <Text className="text-foreground text-sm font-semibold">
                    {t('settings.permissionSchemes.assignment_label')}
                  </Text>
                  <View style={styles.choiceGrid}>
                    <ChoiceButton
                      label={t('settings.permissionSchemes.use_default')}
                      value={DEFAULT_PERMISSION_SCHEME_VALUE}
                      selected={!permissionSchemeState?.assignedSchemeId}
                      disabled={schemeMutating}
                      onPress={(value) => void assignPermissionSchemeToProject(value)}
                    />
                    {permissionSchemes.map((scheme) => (
                      <ChoiceButton
                        key={scheme.id}
                        label={scheme.name}
                        value={scheme.id}
                        selected={permissionSchemeState?.assignedSchemeId === scheme.id}
                        disabled={schemeMutating}
                        onPress={(value) => void assignPermissionSchemeToProject(value)}
                      />
                    ))}
                  </View>
                </View>

                <View style={styles.componentSubsection}>
                  <Text className="text-foreground text-sm font-semibold">
                    {t('settings.permissionSchemes.create_title')}
                  </Text>
                  <TextField
                    label={t('settings.permissionSchemes.name_label')}
                    placeholder={t('settings.permissionSchemes.name_placeholder')}
                    value={schemeName}
                    onChangeText={(value) => {
                      setSchemeName(value);
                      setSchemeError(null);
                      setSchemeSaved(null);
                    }}
                    editable={!schemeMutating}
                  />
                  <TextField
                    label={t('settings.permissionSchemes.description_label')}
                    placeholder={t('settings.permissionSchemes.description_placeholder')}
                    value={schemeDescription}
                    onChangeText={(value) => {
                      setSchemeDescription(value);
                      setSchemeSaved(null);
                    }}
                    editable={!schemeMutating}
                    multiline
                    className="min-h-12"
                  />
                  <View style={styles.componentSubsection}>
                    <Text className="text-foreground text-sm font-semibold">
                      {t('settings.permissionSchemes.base_role_label')}
                    </Text>
                    <View style={styles.choiceGrid}>
                      {PROJECT_SCHEME_BASE_ROLES.map((role) => (
                        <ChoiceButton
                          key={role}
                          label={projectRoleLabel(role, t)}
                          value={role}
                          selected={schemeBaseRole === role}
                          disabled={schemeMutating}
                          onPress={setSchemeBaseRole}
                        />
                      ))}
                    </View>
                  </View>
                  <View style={styles.componentSubsection}>
                    <Text className="text-foreground text-sm font-semibold">
                      {t('settings.permissionSchemes.default_label')}
                    </Text>
                    <View style={styles.choiceGrid}>
                      <ChoiceButton
                        label={t('settings.permissionSchemes.default_no')}
                        value="false"
                        selected={!schemeIsDefault}
                        disabled={schemeMutating}
                        onPress={() => setSchemeIsDefault(false)}
                      />
                      <ChoiceButton
                        label={t('settings.permissionSchemes.default_yes')}
                        value="true"
                        selected={schemeIsDefault}
                        disabled={schemeMutating}
                        onPress={() => setSchemeIsDefault(true)}
                      />
                    </View>
                  </View>
                  <View style={styles.componentActions}>
                    <Button
                      title={t('settings.permissionSchemes.create_submit')}
                      icon={Shield}
                      loading={createPermissionScheme.isPending}
                      disabled={!customFieldScope || schemeMutating || !schemeName.trim()}
                      onPress={() => void createProjectPermissionScheme()}
                    />
                  </View>
                </View>

                {schemeError ? (
                  <Text className="text-destructive text-sm">{schemeError}</Text>
                ) : null}
                {schemeSaved ? (
                  <Text className="text-muted-foreground text-sm">{schemeSaved}</Text>
                ) : null}

                <View style={styles.componentList}>
                  {permissionSchemes.map((scheme) => {
                    const isAssigned = permissionSchemeState?.assignedSchemeId === scheme.id;
                    const isEffective = permissionSchemeState?.effectiveSchemeId === scheme.id;
                    const deleteDisabled = schemeMutating || scheme.projectCount > 0;
                    return (
                      <View key={scheme.id} style={styles.componentRow}>
                        <View className="min-w-0 flex-1 gap-1">
                          <View className="flex-row items-center gap-2">
                            <Text
                              className="text-foreground text-base font-semibold"
                              numberOfLines={1}
                            >
                              {scheme.name}
                            </Text>
                            {scheme.isDefault ? (
                              <SemanticBadge
                                label={t('settings.permissionSchemes.default_badge')}
                                tone="emerald"
                              />
                            ) : null}
                          </View>
                          <View className="flex-row flex-wrap gap-2">
                            {isAssigned ? (
                              <SemanticBadge
                                label={t('settings.permissionSchemes.assigned')}
                                tone="blue"
                              />
                            ) : null}
                            {isEffective ? (
                              <SemanticBadge
                                label={t('settings.permissionSchemes.effective')}
                                tone="amber"
                              />
                            ) : null}
                          </View>
                          {scheme.description ? (
                            <Text className="text-muted-foreground text-sm" numberOfLines={2}>
                              {scheme.description}
                            </Text>
                          ) : null}
                          <Text className="text-muted-foreground text-xs">
                            {t('settings.permissionSchemes.project_count', {
                              count: scheme.projectCount,
                            })}
                          </Text>
                        </View>
                        <View style={styles.componentRowActions}>
                          <Pressable
                            accessibilityRole="button"
                            accessibilityLabel={t('settings.permissionSchemes.set_default')}
                            disabled={schemeMutating || scheme.isDefault}
                            onPress={() => void setPermissionSchemeDefault(scheme)}
                            style={[
                              styles.iconAction,
                              schemeMutating || scheme.isDefault ? styles.disabled : null,
                            ]}
                            className="active:opacity-80"
                          >
                            <Star size={15} color={colors.foreground} />
                          </Pressable>
                          <Pressable
                            accessibilityRole="button"
                            accessibilityLabel={t('settings.permissionSchemes.delete_submit')}
                            disabled={deleteDisabled}
                            onPress={() => confirmDeletePermissionScheme(scheme)}
                            style={[
                              styles.iconAction,
                              styles.iconActionDanger,
                              deleteDisabled ? styles.disabled : null,
                            ]}
                            className="active:opacity-80"
                          >
                            <Trash2 size={15} color={colors.destructive} />
                          </Pressable>
                        </View>
                      </View>
                    );
                  })}
                  {permissionSchemes.length === 0 ? (
                    <Text style={styles.helperText}>{t('settings.permissionSchemes.empty')}</Text>
                  ) : null}
                </View>
              </View>
            )}
          </SurfaceRow>

          <SurfaceRow
            className="gap-3"
            onLayout={(event) =>
              handleSettingsSectionLayout('security', event.nativeEvent.layout.y)
            }
          >
            <View className="flex-row items-start gap-3">
              <IconTile icon={Lock} tone="rose" />
              <View className="min-w-0 flex-1 gap-1">
                <Text className="text-foreground text-sm font-semibold">
                  {t('settings.securitySchemes.title')}
                </Text>
                <Text className="text-muted-foreground text-sm" style={styles.helpText}>
                  {t('settings.securitySchemes.subtitle')}
                </Text>
              </View>
              {securitySchemeState ? (
                <SemanticBadge
                  label={permissionSchemeSourceLabel(securitySchemeState.source, t)}
                  tone={permissionSchemeSourceTone(securitySchemeState.source)}
                />
              ) : null}
            </View>

            {securitySchemeLoading ? (
              <Text style={styles.helperText}>{t('settings.securitySchemes.loading')}</Text>
            ) : securitySchemeLoadError ? (
              <Text className="text-destructive text-sm">{securitySchemeLoadError}</Text>
            ) : (
              <View style={styles.componentForm}>
                <View style={styles.agentSummaryGrid}>
                  <View style={styles.agentSummaryBox}>
                    <Text style={styles.agentSummaryLabel}>
                      {t('settings.securitySchemes.effective_label')}
                    </Text>
                    <Text style={styles.agentSummaryValue} numberOfLines={1}>
                      {securitySchemeState?.scheme?.name ?? t('settings.securitySchemes.none')}
                    </Text>
                  </View>
                  <View style={styles.agentSummaryBox}>
                    <Text style={styles.agentSummaryLabel}>
                      {t('settings.securitySchemes.source_label')}
                    </Text>
                    <Text style={styles.agentSummaryValue} numberOfLines={1}>
                      {permissionSchemeSourceLabel(securitySchemeState?.source, t)}
                    </Text>
                  </View>
                </View>

                <View style={styles.componentSubsection}>
                  <Text className="text-foreground text-sm font-semibold">
                    {t('settings.securitySchemes.assignment_label')}
                  </Text>
                  <View style={styles.choiceGrid}>
                    <ChoiceButton
                      label={t('settings.securitySchemes.use_default')}
                      value={DEFAULT_SECURITY_SCHEME_VALUE}
                      selected={!securitySchemeState?.assignedSchemeId}
                      disabled={securityMutating}
                      onPress={(value) => void assignSecuritySchemeToProject(value)}
                    />
                    {securitySchemes.map((scheme) => (
                      <ChoiceButton
                        key={scheme.id}
                        label={scheme.name}
                        value={scheme.id}
                        selected={securitySchemeState?.assignedSchemeId === scheme.id}
                        disabled={securityMutating}
                        onPress={(value) => void assignSecuritySchemeToProject(value)}
                      />
                    ))}
                  </View>
                </View>

                <View style={styles.componentSubsection}>
                  <Text className="text-foreground text-sm font-semibold">
                    {t('settings.securitySchemes.create_title')}
                  </Text>
                  <TextField
                    label={t('settings.securitySchemes.name_label')}
                    placeholder={t('settings.securitySchemes.name_placeholder')}
                    value={securitySchemeName}
                    onChangeText={(value) => {
                      setSecuritySchemeName(value);
                      setSecurityError(null);
                      setSecuritySaved(null);
                    }}
                    editable={!securityMutating}
                  />
                  <TextField
                    label={t('settings.securitySchemes.description_label')}
                    placeholder={t('settings.securitySchemes.description_placeholder')}
                    value={securitySchemeDescription}
                    onChangeText={(value) => {
                      setSecuritySchemeDescription(value);
                      setSecuritySaved(null);
                    }}
                    editable={!securityMutating}
                    multiline
                    className="min-h-12"
                  />
                  <View style={styles.choiceGrid}>
                    <ChoiceButton
                      label={t('settings.securitySchemes.default_no')}
                      value="false"
                      selected={!securitySchemeIsDefault}
                      disabled={securityMutating}
                      onPress={() => setSecuritySchemeIsDefault(false)}
                    />
                    <ChoiceButton
                      label={t('settings.securitySchemes.default_yes')}
                      value="true"
                      selected={securitySchemeIsDefault}
                      disabled={securityMutating}
                      onPress={() => setSecuritySchemeIsDefault(true)}
                    />
                  </View>
                  <View style={styles.componentActions}>
                    <Button
                      title={t('settings.securitySchemes.create_submit')}
                      icon={Lock}
                      loading={createSecurityScheme.isPending}
                      disabled={!customFieldScope || securityMutating || !securitySchemeName.trim()}
                      onPress={() => void createProjectSecurityScheme()}
                    />
                  </View>
                </View>

                {securitySchemes.length > 0 ? (
                  <View style={styles.componentSubsection}>
                    <Text className="text-foreground text-sm font-semibold">
                      {t('settings.securitySchemes.level_create_title')}
                    </Text>
                    <View style={styles.choiceGrid}>
                      {securitySchemes.map((scheme) => (
                        <ChoiceButton
                          key={scheme.id}
                          label={scheme.name}
                          value={scheme.id}
                          selected={(securityLevelSchemeId || securitySchemes[0]?.id) === scheme.id}
                          disabled={securityMutating}
                          onPress={setSecurityLevelSchemeId}
                        />
                      ))}
                    </View>
                    <TextField
                      label={t('settings.securitySchemes.level_name_label')}
                      placeholder={t('settings.securitySchemes.level_name_placeholder')}
                      value={securityLevelName}
                      onChangeText={(value) => {
                        setSecurityLevelName(value);
                        setSecurityError(null);
                        setSecuritySaved(null);
                      }}
                      editable={!securityMutating}
                    />
                    <TextField
                      label={t('settings.securitySchemes.description_label')}
                      placeholder={t('settings.securitySchemes.level_description_placeholder')}
                      value={securityLevelDescription}
                      onChangeText={(value) => {
                        setSecurityLevelDescription(value);
                        setSecuritySaved(null);
                      }}
                      editable={!securityMutating}
                      multiline
                      className="min-h-12"
                    />
                    <View style={styles.componentSubsection}>
                      <Text className="text-foreground text-sm font-semibold">
                        {t('settings.securitySchemes.member_type_label')}
                      </Text>
                      <View style={styles.choiceGrid}>
                        {SECURITY_LEVEL_MEMBER_TYPES.map((memberType) => (
                          <ChoiceButton
                            key={memberType}
                            label={securityMemberTypeLabel(memberType, t)}
                            value={memberType}
                            selected={securityLevelMemberType === memberType}
                            disabled={securityMutating}
                            onPress={(value) => {
                              setSecurityLevelMemberType(value);
                              setSecurityError(null);
                              setSecuritySaved(null);
                            }}
                          />
                        ))}
                      </View>
                    </View>
                    {securityLevelMemberType === 'project_role' ? (
                      <View style={styles.choiceGrid}>
                        {PROJECT_SCHEME_BASE_ROLES.map((role) => (
                          <ChoiceButton
                            key={role}
                            label={projectRoleLabel(role, t)}
                            value={role}
                            selected={securityLevelMemberRole === role}
                            disabled={securityMutating}
                            onPress={setSecurityLevelMemberRole}
                          />
                        ))}
                      </View>
                    ) : null}
                    {securityLevelMemberType === 'user' ? (
                      <TextField
                        label={t('settings.securitySchemes.member_value_label')}
                        placeholder={t('settings.securitySchemes.member_value_placeholder')}
                        value={securityLevelMemberValue}
                        onChangeText={(value) => {
                          setSecurityLevelMemberValue(value);
                          setSecurityError(null);
                          setSecuritySaved(null);
                        }}
                        editable={!securityMutating}
                        autoCapitalize="none"
                      />
                    ) : null}
                    <View style={styles.choiceGrid}>
                      <ChoiceButton
                        label={t('settings.securitySchemes.level_default_no')}
                        value="false"
                        selected={!securityLevelIsDefault}
                        disabled={securityMutating}
                        onPress={() => setSecurityLevelIsDefault(false)}
                      />
                      <ChoiceButton
                        label={t('settings.securitySchemes.level_default_yes')}
                        value="true"
                        selected={securityLevelIsDefault}
                        disabled={securityMutating}
                        onPress={() => setSecurityLevelIsDefault(true)}
                      />
                    </View>
                    <View style={styles.componentActions}>
                      <Button
                        title={t('settings.securitySchemes.level_create_submit')}
                        icon={Lock}
                        loading={createSecurityLevel.isPending}
                        disabled={securityMutating || !securityLevelName.trim()}
                        onPress={() => void createProjectSecurityLevel()}
                      />
                    </View>
                  </View>
                ) : null}

                {securityError ? (
                  <Text className="text-destructive text-sm">{securityError}</Text>
                ) : null}
                {securitySaved ? (
                  <Text className="text-muted-foreground text-sm">{securitySaved}</Text>
                ) : null}

                <View style={styles.componentList}>
                  {securitySchemes.map((scheme) => {
                    const isAssigned = securitySchemeState?.assignedSchemeId === scheme.id;
                    const isEffective = securitySchemeState?.effectiveSchemeId === scheme.id;
                    const deleteDisabled = securityMutating || scheme.projectCount > 0;
                    return (
                      <View key={scheme.id} style={styles.componentRow}>
                        <View className="min-w-0 flex-1 gap-2">
                          <View className="gap-1">
                            <View className="flex-row items-center gap-2">
                              <Text
                                className="text-foreground text-base font-semibold"
                                numberOfLines={1}
                              >
                                {scheme.name}
                              </Text>
                              {scheme.isDefault ? (
                                <SemanticBadge
                                  label={t('settings.securitySchemes.default_badge')}
                                  tone="emerald"
                                />
                              ) : null}
                            </View>
                            <View className="flex-row flex-wrap gap-2">
                              {isAssigned ? (
                                <SemanticBadge
                                  label={t('settings.securitySchemes.assigned')}
                                  tone="blue"
                                />
                              ) : null}
                              {isEffective ? (
                                <SemanticBadge
                                  label={t('settings.securitySchemes.effective')}
                                  tone="amber"
                                />
                              ) : null}
                              <SemanticBadge
                                label={t('settings.securitySchemes.level_count', {
                                  count: scheme.levels.length,
                                })}
                                tone="neutral"
                              />
                            </View>
                          </View>
                          {scheme.description ? (
                            <Text className="text-muted-foreground text-sm" numberOfLines={2}>
                              {scheme.description}
                            </Text>
                          ) : null}
                          <Text className="text-muted-foreground text-xs">
                            {t('settings.securitySchemes.project_count', {
                              count: scheme.projectCount,
                            })}
                          </Text>
                          {scheme.levels.length > 0 ? (
                            <View style={styles.nestedList}>
                              {scheme.levels.map((level) => (
                                <View key={level.id} style={styles.nestedRow}>
                                  <View className="min-w-0 flex-1 gap-1">
                                    <View className="flex-row items-center gap-2">
                                      <Text
                                        className="text-foreground text-sm font-semibold"
                                        numberOfLines={1}
                                      >
                                        {level.name}
                                      </Text>
                                      {level.isDefault ? (
                                        <SemanticBadge
                                          label={t('settings.securitySchemes.default_badge')}
                                          tone="emerald"
                                        />
                                      ) : null}
                                    </View>
                                    <View className="flex-row flex-wrap gap-2">
                                      {level.members.map((member, index) => (
                                        <SemanticBadge
                                          key={member.id ?? `${member.memberType}-${index}`}
                                          label={securityMemberValueLabel(
                                            member.memberType,
                                            member.memberValue,
                                            t,
                                          )}
                                          tone="violet"
                                        />
                                      ))}
                                    </View>
                                  </View>
                                  <Pressable
                                    accessibilityRole="button"
                                    accessibilityLabel={t(
                                      'settings.securitySchemes.delete_level_submit',
                                    )}
                                    disabled={securityMutating}
                                    onPress={() => confirmDeleteSecurityLevel(scheme, level)}
                                    style={[
                                      styles.iconAction,
                                      styles.iconActionDanger,
                                      securityMutating ? styles.disabled : null,
                                    ]}
                                    className="active:opacity-80"
                                  >
                                    <Trash2 size={15} color={colors.destructive} />
                                  </Pressable>
                                </View>
                              ))}
                            </View>
                          ) : null}
                        </View>
                        <View style={styles.componentRowActions}>
                          <Pressable
                            accessibilityRole="button"
                            accessibilityLabel={t('settings.securitySchemes.set_default')}
                            disabled={securityMutating || scheme.isDefault}
                            onPress={() => void setSecuritySchemeDefault(scheme)}
                            style={[
                              styles.iconAction,
                              securityMutating || scheme.isDefault ? styles.disabled : null,
                            ]}
                            className="active:opacity-80"
                          >
                            <Star size={15} color={colors.foreground} />
                          </Pressable>
                          <Pressable
                            accessibilityRole="button"
                            accessibilityLabel={t('settings.securitySchemes.delete_submit')}
                            disabled={deleteDisabled}
                            onPress={() => confirmDeleteSecurityScheme(scheme)}
                            style={[
                              styles.iconAction,
                              styles.iconActionDanger,
                              deleteDisabled ? styles.disabled : null,
                            ]}
                            className="active:opacity-80"
                          >
                            <Trash2 size={15} color={colors.destructive} />
                          </Pressable>
                        </View>
                      </View>
                    );
                  })}
                  {securitySchemes.length === 0 ? (
                    <Text style={styles.helperText}>{t('settings.securitySchemes.empty')}</Text>
                  ) : null}
                </View>
              </View>
            )}
          </SurfaceRow>

          <SurfaceRow
            className="gap-3"
            onLayout={(event) =>
              handleSettingsSectionLayout('automation', event.nativeEvent.layout.y)
            }
          >
            <View className="flex-row items-start gap-3">
              <IconTile icon={Zap} tone="violet" />
              <View className="min-w-0 flex-1 gap-1">
                <Text className="text-foreground text-sm font-semibold">
                  {t('settings.automation.title')}
                </Text>
                <Text className="text-muted-foreground text-sm" style={styles.helpText}>
                  {t('settings.automation.subtitle')}
                </Text>
              </View>
              <SemanticBadge
                label={t('settings.automation.rule_count', { count: automationRules.length })}
                tone={automationRules.some((rule) => rule.enabled) ? 'emerald' : 'neutral'}
              />
            </View>

            <View style={styles.componentForm}>
              <TextField
                label={t('settings.automation.name_label')}
                placeholder={t('settings.automation.name_placeholder')}
                value={automationName}
                onChangeText={(value) => {
                  setAutomationName(value);
                  setAutomationError(null);
                  setAutomationSaved(null);
                }}
                editable={!automationMutating}
              />
              <TextField
                label={t('settings.automation.description_label')}
                placeholder={t('settings.automation.description_placeholder')}
                value={automationDescription}
                onChangeText={(value) => {
                  setAutomationDescription(value);
                  setAutomationSaved(null);
                }}
                editable={!automationMutating}
                multiline
                className="min-h-12"
              />
              <View style={styles.componentSubsection}>
                <Text className="text-foreground text-sm font-semibold">
                  {t('settings.automation.trigger_label')}
                </Text>
                <View style={styles.choiceGrid}>
                  {AUTOMATION_TRIGGER_TYPES.map((trigger) => (
                    <ChoiceButton
                      key={trigger}
                      label={automationTriggerLabel(trigger, t)}
                      value={trigger}
                      selected={automationTriggerType === trigger}
                      disabled={automationMutating}
                      onPress={setAutomationTriggerType}
                    />
                  ))}
                </View>
              </View>
              <View style={styles.componentSubsection}>
                <Text className="text-foreground text-sm font-semibold">
                  {t('settings.automation.action_label')}
                </Text>
                <View style={styles.choiceGrid}>
                  {AUTOMATION_ACTION_TYPES.map((action) => (
                    <ChoiceButton
                      key={action}
                      label={automationActionLabel(action, t)}
                      value={action}
                      selected={automationActionType === action}
                      disabled={automationMutating}
                      onPress={setAutomationActionType}
                    />
                  ))}
                </View>
              </View>
              <View style={styles.choiceGrid}>
                <ChoiceButton
                  label={t('settings.automation.enabled_no')}
                  value="false"
                  selected={!automationEnabled}
                  disabled={automationMutating}
                  onPress={() => setAutomationEnabled(false)}
                />
                <ChoiceButton
                  label={t('settings.automation.enabled_yes')}
                  value="true"
                  selected={automationEnabled}
                  disabled={automationMutating}
                  onPress={() => setAutomationEnabled(true)}
                />
              </View>

              {automationError ? (
                <Text className="text-destructive text-sm">{automationError}</Text>
              ) : null}
              {automationSaved ? (
                <Text className="text-muted-foreground text-sm">{automationSaved}</Text>
              ) : null}

              <View style={styles.componentActions}>
                {editingAutomationRule ? (
                  <Button
                    title={t('common.cancel')}
                    variant="secondary"
                    icon={X}
                    disabled={automationMutating}
                    onPress={resetAutomationForm}
                  />
                ) : null}
                <Button
                  title={
                    editingAutomationRule
                      ? t('settings.automation.save_submit')
                      : t('settings.automation.create_submit')
                  }
                  icon={editingAutomationRule ? Check : Zap}
                  loading={createAutomationRule.isPending || updateAutomationRule.isPending}
                  disabled={!customFieldScope || automationMutating || !automationName.trim()}
                  onPress={() => void saveAutomationRule()}
                />
              </View>
            </View>

            <View style={styles.componentList}>
              {automationRulesQ.isLoading ? (
                <Text style={styles.helperText}>{t('settings.automation.loading')}</Text>
              ) : null}
              {automationRulesQ.isError ? (
                <Text className="text-destructive text-sm">
                  {automationRulesQ.error instanceof Error
                    ? automationRulesQ.error.message
                    : t('settings.automation.load_failed')}
                </Text>
              ) : null}
              {!automationRulesQ.isLoading && automationRules.length === 0 ? (
                <Text style={styles.helperText}>{t('settings.automation.empty')}</Text>
              ) : null}
              {automationRules.map((rule) => {
                const firstAction = rule.actions[0]?.type ?? 'assign_issue';
                return (
                  <View key={rule.id} style={styles.componentRow}>
                    <View className="min-w-0 flex-1 gap-1">
                      <View className="flex-row items-center gap-2">
                        <Text className="text-foreground text-base font-semibold" numberOfLines={1}>
                          {rule.name}
                        </Text>
                        <SemanticBadge
                          label={
                            rule.enabled
                              ? t('settings.automation.enabled_badge')
                              : t('settings.automation.disabled_badge')
                          }
                          tone={rule.enabled ? 'emerald' : 'neutral'}
                        />
                      </View>
                      {rule.description ? (
                        <Text className="text-muted-foreground text-sm" numberOfLines={2}>
                          {rule.description}
                        </Text>
                      ) : null}
                      <View className="flex-row flex-wrap gap-2">
                        <SemanticBadge
                          label={automationTriggerLabel(rule.trigger.type, t)}
                          tone="violet"
                        />
                        <SemanticBadge label={automationActionLabel(firstAction, t)} tone="blue" />
                      </View>
                    </View>
                    <View style={styles.componentRowActions}>
                      <Pressable
                        accessibilityRole="button"
                        accessibilityLabel={t('settings.automation.view_executions')}
                        disabled={automationMutating}
                        onPress={() =>
                          setAutomationExecutionsRuleId(
                            automationExecutionsRuleId === rule.id ? null : rule.id,
                          )
                        }
                        style={[styles.iconAction, automationMutating ? styles.disabled : null]}
                        className="active:opacity-80"
                      >
                        <History size={15} color={colors.foreground} />
                      </Pressable>
                      <Pressable
                        accessibilityRole="button"
                        accessibilityLabel={t('common.edit')}
                        disabled={automationMutating}
                        onPress={() => beginAutomationEdit(rule)}
                        style={[styles.iconAction, automationMutating ? styles.disabled : null]}
                        className="active:opacity-80"
                      >
                        <Pencil size={15} color={colors.foreground} />
                      </Pressable>
                      <Pressable
                        accessibilityRole="switch"
                        accessibilityState={{ checked: rule.enabled, disabled: automationMutating }}
                        disabled={automationMutating}
                        onPress={() => void toggleAutomationRule(rule)}
                        style={[styles.iconAction, automationMutating ? styles.disabled : null]}
                        className="active:opacity-80"
                      >
                        <RotateCw size={15} color={colors.foreground} />
                      </Pressable>
                      <Pressable
                        accessibilityRole="button"
                        accessibilityLabel={t('settings.automation.delete_submit')}
                        disabled={automationMutating}
                        onPress={() => confirmDeleteAutomationRule(rule)}
                        style={[
                          styles.iconAction,
                          styles.iconActionDanger,
                          automationMutating ? styles.disabled : null,
                        ]}
                        className="active:opacity-80"
                      >
                        <Trash2 size={15} color={colors.destructive} />
                      </Pressable>
                    </View>
                  </View>
                );
              })}
            </View>

            {automationExecutionsRuleId ? (
              <View style={styles.componentSubsection}>
                <Text className="text-foreground text-sm font-semibold">
                  {t('settings.automation.executions_title')}
                </Text>
                {automationExecutionsQ.isLoading ? (
                  <Text style={styles.helperText}>
                    {t('settings.automation.executions_loading')}
                  </Text>
                ) : automationExecutionsQ.isError ? (
                  <Text className="text-destructive text-sm">
                    {automationExecutionsQ.error instanceof Error
                      ? automationExecutionsQ.error.message
                      : t('settings.automation.executions_failed')}
                  </Text>
                ) : (automationExecutionsQ.data ?? []).length === 0 ? (
                  <Text style={styles.helperText}>{t('settings.automation.executions_empty')}</Text>
                ) : (
                  <View style={styles.nestedList}>
                    {(automationExecutionsQ.data ?? []).slice(0, 8).map((execution) => {
                      const timestamp = formatWebhookTimestamp(
                        execution.triggeredAt,
                        i18n.language,
                      );
                      const duration = formatAutomationDuration(execution.durationMs);
                      return (
                        <View key={execution.id} style={styles.nestedRow}>
                          <View className="min-w-0 flex-1 gap-1">
                            <View className="flex-row items-center gap-2">
                              <SemanticBadge
                                label={execution.status}
                                tone={automationStatusTone(execution.status)}
                              />
                              {duration ? <SemanticBadge label={duration} tone="neutral" /> : null}
                            </View>
                            <Text className="text-muted-foreground text-xs" numberOfLines={1}>
                              {timestamp ?? execution.triggeredAt}
                            </Text>
                            {execution.error ? (
                              <Text className="text-destructive text-xs" numberOfLines={2}>
                                {execution.error}
                              </Text>
                            ) : null}
                          </View>
                        </View>
                      );
                    })}
                  </View>
                )}
              </View>
            ) : null}
          </SurfaceRow>

          <SurfaceRow
            className="gap-3"
            onLayout={(event) =>
              handleSettingsSectionLayout('chat-calls', event.nativeEvent.layout.y)
            }
          >
            <View className="flex-row items-start gap-3">
              <IconTile icon={MessageSquareText} tone="emerald" />
              <View className="min-w-0 flex-1 gap-1">
                <Text className="text-foreground text-sm font-semibold">
                  {t('settings.projectComms.title')}
                </Text>
                <Text className="text-muted-foreground text-sm" style={styles.helpText}>
                  {t('settings.projectComms.subtitle')}
                </Text>
              </View>
              {projectCommsQ.data ? (
                <SemanticBadge
                  label={
                    projectCommsQ.data.effectiveSettings.enabled
                      ? t('settings.projectComms.live')
                      : t('settings.projectComms.disabled')
                  }
                  tone={projectCommsQ.data.effectiveSettings.enabled ? 'emerald' : 'neutral'}
                />
              ) : null}
            </View>

            {projectCommsQ.isLoading ? (
              <Text style={styles.helperText}>{t('settings.projectComms.loading')}</Text>
            ) : projectCommsQ.isError || !projectCommsQ.data ? (
              <Text className="text-destructive text-sm">
                {projectCommsQ.error instanceof Error
                  ? projectCommsQ.error.message
                  : t('settings.projectComms.load_failed')}
              </Text>
            ) : (
              <View style={styles.toggleList}>
                {PROJECT_COMMUNICATION_TOGGLES.map((toggle) => {
                  const selected = projectCommsQ.data.projectSettings[toggle.key];
                  const effective =
                    toggle.key === 'inheritWorkspaceDefaults'
                      ? selected
                      : projectCommsQ.data.effectiveSettings[toggle.key];
                  const disabled = projectCommsMutating || !projectCommsQ.data.access.canManage;
                  return (
                    <Pressable
                      key={toggle.key}
                      accessibilityRole="switch"
                      accessibilityState={{ checked: selected, disabled }}
                      disabled={disabled}
                      onPress={() => void toggleProjectCommunication(toggle.key)}
                      style={[
                        styles.toggleRow,
                        selected ? styles.toggleRowActive : null,
                        disabled ? styles.disabled : null,
                      ]}
                      className="active:opacity-80"
                    >
                      <View className="min-w-0 flex-1 gap-1">
                        <View className="flex-row items-center gap-2">
                          <Text className="text-foreground text-sm font-semibold">
                            {t(toggle.labelKey)}
                          </Text>
                          {toggle.key !== 'inheritWorkspaceDefaults' ? (
                            <SemanticBadge
                              label={
                                effective
                                  ? t('settings.projectComms.effective_on')
                                  : t('settings.projectComms.effective_off')
                              }
                              tone={effective ? 'emerald' : 'neutral'}
                            />
                          ) : null}
                        </View>
                        <Text className="text-muted-foreground text-xs" style={styles.helpText}>
                          {t(toggle.descKey)}
                        </Text>
                      </View>
                      <View
                        style={[styles.switchTrack, selected ? styles.switchTrackActive : null]}
                      >
                        {selected ? <Check size={13} color={colors.primaryForeground} /> : null}
                      </View>
                    </Pressable>
                  );
                })}
                {!projectCommsQ.data.access.canManage ? (
                  <Text style={styles.helperText}>
                    {t('settings.projectComms.manage_restricted')}
                  </Text>
                ) : null}
              </View>
            )}

            {projectCommsError ? (
              <Text className="text-destructive text-sm">{projectCommsError}</Text>
            ) : null}
            {projectCommsSaved ? (
              <Text className="text-muted-foreground text-sm">{projectCommsSaved}</Text>
            ) : null}
          </SurfaceRow>

          <SurfaceRow
            className="gap-3"
            onLayout={(event) =>
              handleSettingsSectionLayout('ai-agents', event.nativeEvent.layout.y)
            }
          >
            <View className="flex-row items-start gap-3">
              <IconTile icon={Bot} tone="violet" />
              <View className="min-w-0 flex-1 gap-1">
                <Text className="text-foreground text-sm font-semibold">
                  {t('settings.projectAi.title')}
                </Text>
                <Text className="text-muted-foreground text-sm" style={styles.helpText}>
                  {t('settings.projectAi.subtitle')}
                </Text>
              </View>
              {projectAgentsQ.data ? (
                <SemanticBadge
                  label={
                    projectAgentsQ.data.effectiveSettings.enabled
                      ? t('settings.projectAi.active')
                      : t('settings.projectAi.inactive')
                  }
                  tone={projectAgentsQ.data.effectiveSettings.enabled ? 'emerald' : 'neutral'}
                />
              ) : null}
            </View>

            {projectAgentsQ.isLoading ? (
              <Text style={styles.helperText}>{t('settings.projectAi.loading')}</Text>
            ) : projectAgentsQ.isError || !projectAgentsQ.data ? (
              <Text className="text-destructive text-sm">
                {projectAgentsQ.error instanceof Error
                  ? projectAgentsQ.error.message
                  : t('settings.projectAi.load_failed')}
              </Text>
            ) : (
              <View style={styles.componentForm}>
                <View style={styles.agentSummaryGrid}>
                  <View style={styles.agentSummaryBox}>
                    <Text style={styles.agentSummaryLabel}>{t('settings.projectAi.provider')}</Text>
                    <Text style={styles.agentSummaryValue} numberOfLines={1}>
                      {t('settings.projectAi.provider_value', {
                        provider: projectAgentsQ.data.effectiveSettings.provider,
                        model: projectAgentsQ.data.effectiveSettings.model,
                      })}
                    </Text>
                  </View>
                  <View style={styles.agentSummaryBox}>
                    <Text style={styles.agentSummaryLabel}>{t('settings.projectAi.running')}</Text>
                    <Text style={styles.agentSummaryValue}>
                      {projectAgentsQ.data.runtimeSummary.runningRuns}
                    </Text>
                  </View>
                  <View style={styles.agentSummaryBox}>
                    <Text style={styles.agentSummaryLabel}>{t('settings.projectAi.run_gate')}</Text>
                    <Text style={styles.agentSummaryValue} numberOfLines={1}>
                      {projectAgentsQ.data.runAvailability.canRun
                        ? t('settings.projectAi.runnable')
                        : t('settings.projectAi.blocked')}
                    </Text>
                  </View>
                </View>

                <View style={styles.toggleList}>
                  {(
                    [
                      [
                        'enabled',
                        'settings.projectAi.enabled_label',
                        'settings.projectAi.enabled_desc',
                      ],
                      [
                        'inheritWorkspaceDefaults',
                        'settings.projectAi.inherit_label',
                        'settings.projectAi.inherit_desc',
                      ],
                      [
                        'allowWriteActions',
                        'settings.projectAi.allow_writes_label',
                        'settings.projectAi.allow_writes_desc',
                      ],
                      [
                        'autoAssignToPlannedSprints',
                        'settings.projectAi.auto_assign_label',
                        'settings.projectAi.auto_assign_desc',
                      ],
                    ] as const
                  ).map(([key, labelKey, descKey]) => {
                    const selected = projectAgentsQ.data.projectSettings[key];
                    const disabled = projectAgentMutating || !projectAgentsQ.data.access.canManage;
                    return (
                      <Pressable
                        key={key}
                        accessibilityRole="switch"
                        accessibilityState={{ checked: selected, disabled }}
                        disabled={disabled}
                        onPress={() => toggleProjectAgentSetting(key)}
                        style={[
                          styles.toggleRow,
                          selected ? styles.toggleRowActive : null,
                          disabled ? styles.disabled : null,
                        ]}
                        className="active:opacity-80"
                      >
                        <View className="min-w-0 flex-1 gap-1">
                          <Text className="text-foreground text-sm font-semibold">
                            {t(labelKey)}
                          </Text>
                          <Text className="text-muted-foreground text-xs" style={styles.helpText}>
                            {t(descKey)}
                          </Text>
                        </View>
                        <View
                          style={[styles.switchTrack, selected ? styles.switchTrackActive : null]}
                        >
                          {selected ? <Check size={13} color={colors.primaryForeground} /> : null}
                        </View>
                      </Pressable>
                    );
                  })}
                </View>

                <View style={styles.componentSubsection}>
                  <Text className="text-foreground text-sm font-semibold">
                    {t('settings.projectAi.execution_mode')}
                  </Text>
                  <View style={styles.choiceGrid}>
                    {PROJECT_AGENT_EXECUTION_MODES.map((mode) => (
                      <ChoiceButton
                        key={mode}
                        label={projectAgentExecutionLabel(mode, t)}
                        value={mode}
                        selected={projectAgentsQ.data.projectSettings.executionMode === mode}
                        disabled={projectAgentMutating || !projectAgentsQ.data.access.canManage}
                        onPress={updateProjectAgentExecutionMode}
                      />
                    ))}
                  </View>
                </View>

                <View style={styles.componentSubsection}>
                  <Text className="text-foreground text-sm font-semibold">
                    {t('settings.projectAi.capabilities')}
                  </Text>
                  <View style={styles.toggleList}>
                    {PROJECT_AGENT_CAPABILITIES.map((capability) => {
                      const selected =
                        projectAgentsQ.data.projectSettings.capabilities[capability] === true;
                      const disabled =
                        projectAgentMutating || !projectAgentsQ.data.access.canManage;
                      return (
                        <Pressable
                          key={capability}
                          accessibilityRole="switch"
                          accessibilityState={{ checked: selected, disabled }}
                          disabled={disabled}
                          onPress={() => toggleProjectAgentCapability(capability)}
                          style={[
                            styles.toggleRow,
                            selected ? styles.toggleRowActive : null,
                            disabled ? styles.disabled : null,
                          ]}
                          className="active:opacity-80"
                        >
                          <View className="min-w-0 flex-1 gap-1">
                            <Text className="text-foreground text-sm font-semibold">
                              {projectAgentCapabilityLabel(capability, t)}
                            </Text>
                            <Text className="text-muted-foreground text-xs" style={styles.helpText}>
                              {projectAgentCapabilityDescription(capability, t)}
                            </Text>
                          </View>
                          <View
                            style={[styles.switchTrack, selected ? styles.switchTrackActive : null]}
                          >
                            {selected ? <Check size={13} color={colors.primaryForeground} /> : null}
                          </View>
                        </Pressable>
                      );
                    })}
                  </View>
                </View>

                <View style={styles.componentSubsection}>
                  <Text className="text-foreground text-sm font-semibold">
                    {t('settings.projectAi.capacity')}
                  </Text>
                  <View style={styles.agentCapacityGrid}>
                    <View style={styles.agentCapacityField}>
                      <TextField
                        label={t('settings.projectAi.sprint_batch')}
                        placeholder={t('settings.projectAi.sprint_batch_placeholder')}
                        value={agentSprintBatchSize}
                        onChangeText={(value) => {
                          setAgentSprintBatchSize(value.replace(/[^0-9]/g, '').slice(0, 2));
                          setProjectAgentError(null);
                          setProjectAgentSaved(null);
                        }}
                        editable={!projectAgentMutating && projectAgentsQ.data.access.canManage}
                        keyboardType="number-pad"
                      />
                    </View>
                    <View style={styles.agentCapacityField}>
                      <TextField
                        label={t('settings.projectAi.sprint_length')}
                        placeholder={t('settings.projectAi.sprint_length_placeholder')}
                        value={agentSprintLengthDays}
                        onChangeText={(value) => {
                          setAgentSprintLengthDays(value.replace(/[^0-9]/g, '').slice(0, 2));
                          setProjectAgentError(null);
                          setProjectAgentSaved(null);
                        }}
                        editable={!projectAgentMutating && projectAgentsQ.data.access.canManage}
                        keyboardType="number-pad"
                      />
                    </View>
                    <View style={styles.agentCapacityField}>
                      <TextField
                        label={t('settings.projectAi.issue_capacity')}
                        placeholder={t('settings.projectAi.issue_capacity_placeholder')}
                        value={agentIssueCapacity}
                        onChangeText={(value) => {
                          setAgentIssueCapacity(value.replace(/[^0-9]/g, '').slice(0, 2));
                          setProjectAgentError(null);
                          setProjectAgentSaved(null);
                        }}
                        editable={!projectAgentMutating && projectAgentsQ.data.access.canManage}
                        keyboardType="number-pad"
                      />
                    </View>
                  </View>
                  <View style={styles.componentActions}>
                    <Button
                      title={t('settings.projectAi.save_capacity')}
                      icon={Check}
                      loading={updateProjectAgents.isPending}
                      disabled={projectAgentMutating || !projectAgentsQ.data.access.canManage}
                      onPress={saveProjectAgentCapacity}
                    />
                  </View>
                </View>

                {projectAgentsQ.data.configIssues.slice(0, 3).map((issue) => (
                  <View key={`${issue.code}-${issue.scope}`} style={styles.agentIssueBox}>
                    <View className="flex-row items-center gap-2">
                      <SemanticBadge
                        label={
                          issue.blocksRuns
                            ? t('settings.projectAi.blocks_runs')
                            : t('settings.projectAi.needs_review')
                        }
                        tone={issue.blocksRuns ? 'rose' : 'amber'}
                      />
                      <Text className="text-foreground text-sm font-semibold" numberOfLines={1}>
                        {issue.title || issue.code}
                      </Text>
                    </View>
                    {issue.detail ? <Text style={styles.helperText}>{issue.detail}</Text> : null}
                  </View>
                ))}

                {!projectAgentsQ.data.access.canManage ? (
                  <Text style={styles.helperText}>{t('settings.projectAi.manage_restricted')}</Text>
                ) : null}
              </View>
            )}

            {projectAgentError ? (
              <Text className="text-destructive text-sm">{projectAgentError}</Text>
            ) : null}
            {projectAgentSaved ? (
              <Text className="text-muted-foreground text-sm">{projectAgentSaved}</Text>
            ) : null}
          </SurfaceRow>

          <View style={styles.section}>
            <Controller
              control={form.control}
              name="name"
              render={({ field: { onBlur, onChange, value } }) => (
                <TextField
                  label={t('projects.nameLabel')}
                  placeholder={t('projects.namePlaceholder')}
                  value={value}
                  onBlur={onBlur}
                  onChangeText={(next) => {
                    setSaved(false);
                    onChange(next);
                  }}
                  editable={!updateProject.isPending}
                  error={fieldError(form.formState.errors.name?.message)}
                />
              )}
            />

            <Controller
              control={form.control}
              name="key"
              render={({ field: { onBlur, onChange, value } }) => (
                <TextField
                  label={t('projects.keyLabel')}
                  placeholder={t('projects.keyPlaceholder')}
                  value={value}
                  onBlur={onBlur}
                  onChangeText={(next) => {
                    setSaved(false);
                    onChange(
                      next
                        .replace(/[^A-Za-z0-9_-]/g, '')
                        .toUpperCase()
                        .slice(0, 20),
                    );
                  }}
                  autoCapitalize="characters"
                  editable={!updateProject.isPending}
                  error={fieldError(form.formState.errors.key?.message)}
                />
              )}
            />

            <Controller
              control={form.control}
              name="description"
              render={({ field: { onBlur, onChange, value } }) => (
                <TextField
                  label={t('projects.descriptionLabel')}
                  placeholder={t('projects.descriptionPlaceholder')}
                  value={value}
                  onBlur={onBlur}
                  onChangeText={(next) => {
                    setSaved(false);
                    onChange(next);
                  }}
                  editable={!updateProject.isPending}
                  multiline
                  className="min-h-12"
                />
              )}
            />
          </View>

          <SurfaceRow className="gap-3">
            <View className="flex-row items-center gap-2">
              <KeyRound size={16} color={colors.primary} />
              <Text className="text-foreground text-base font-semibold">
                {t('projects.statusLabel')}
              </Text>
            </View>
            <View style={styles.choiceGrid}>
              {PROJECT_STATUSES.map((status) => (
                <ChoiceButton
                  key={status}
                  label={t(`projectStatus.${status}`)}
                  value={status}
                  selected={values.status === status}
                  onPress={(next) => {
                    setSaved(false);
                    form.setValue('status', next, { shouldValidate: true });
                  }}
                />
              ))}
            </View>
          </SurfaceRow>

          <SurfaceRow className="gap-3">
            <View className="flex-row items-center gap-2">
              <Eye size={16} color={colors.primary} />
              <Text className="text-foreground text-base font-semibold">
                {t('projects.visibilityLabel')}
              </Text>
            </View>
            <View style={styles.choiceGrid}>
              {PROJECT_VISIBILITY.map((visibility) => (
                <ChoiceButton
                  key={visibility}
                  label={t(`projectVisibility.${visibility}`)}
                  value={visibility}
                  selected={values.visibility === visibility}
                  onPress={(next) => {
                    setSaved(false);
                    form.setValue('visibility', next, { shouldValidate: true });
                  }}
                />
              ))}
            </View>
          </SurfaceRow>

          <SurfaceRow
            className="gap-3"
            onLayout={(event) =>
              handleSettingsSectionLayout('components', event.nativeEvent.layout.y)
            }
          >
            <View className="flex-row items-start gap-3">
              <IconTile icon={Boxes} tone="cyan" />
              <View className="min-w-0 flex-1 gap-1">
                <Text className="text-foreground text-sm font-semibold">
                  {t('settings.components.title')}
                </Text>
                <Text className="text-muted-foreground text-sm" style={styles.helpText}>
                  {t('settings.components.subtitle')}
                </Text>
              </View>
            </View>

            <View style={styles.componentForm}>
              <TextField
                label={t('settings.components.name_label')}
                placeholder={t('settings.components.name_placeholder')}
                value={componentName}
                onChangeText={(value) => {
                  setComponentName(value);
                  setComponentError(null);
                  setComponentSaved(null);
                }}
                editable={!componentMutating}
              />
              <TextField
                label={t('settings.components.description_label')}
                placeholder={t('settings.components.description_placeholder')}
                value={componentDescription}
                onChangeText={(value) => {
                  setComponentDescription(value);
                  setComponentSaved(null);
                }}
                editable={!componentMutating}
                multiline
                className="min-h-12"
              />

              <View style={styles.componentSubsection}>
                <Text className="text-foreground text-sm font-semibold">
                  {t('settings.components.lead_label')}
                </Text>
                <View style={styles.choiceGrid}>
                  <ChoiceButton
                    label={t('settings.components.lead_none')}
                    value=""
                    selected={!componentLeadId}
                    onPress={setComponentLeadId}
                  />
                  {projectMembers.map((member) => (
                    <ChoiceButton
                      key={member.userId}
                      label={member.user.name ?? member.user.email}
                      value={member.userId}
                      selected={componentLeadId === member.userId}
                      onPress={setComponentLeadId}
                    />
                  ))}
                </View>
              </View>

              <View style={styles.componentSubsection}>
                <Text className="text-foreground text-sm font-semibold">
                  {t('settings.components.default_assignee_label')}
                </Text>
                <View style={styles.choiceGrid}>
                  {DEFAULT_ASSIGNEE_TYPES.map((type) => (
                    <ChoiceButton
                      key={type}
                      label={defaultAssigneeLabel(type, t)}
                      value={type}
                      selected={componentDefaultAssigneeType === type}
                      onPress={setComponentDefaultAssigneeType}
                    />
                  ))}
                </View>
              </View>

              {componentError ? (
                <Text className="text-destructive text-sm">{componentError}</Text>
              ) : null}
              {componentSaved ? (
                <Text className="text-muted-foreground text-sm">{componentSaved}</Text>
              ) : null}

              <View style={styles.componentActions}>
                {editingComponent ? (
                  <Button
                    title={t('common.cancel')}
                    variant="secondary"
                    icon={X}
                    disabled={componentMutating}
                    onPress={resetComponentForm}
                  />
                ) : null}
                <Button
                  title={
                    editingComponent
                      ? t('settings.components.save_submit')
                      : t('settings.components.create_submit')
                  }
                  icon={editingComponent ? Check : Boxes}
                  loading={createComponent.isPending || updateComponent.isPending}
                  disabled={componentMutating || !componentName.trim()}
                  onPress={() => void saveComponent()}
                />
              </View>
            </View>

            <View style={styles.componentList}>
              {components.map((component) => (
                <View key={component.id} style={styles.componentRow}>
                  <View className="min-w-0 flex-1 gap-1">
                    <View className="flex-row items-center gap-2">
                      <Text className="text-foreground text-base font-semibold" numberOfLines={1}>
                        {component.name}
                      </Text>
                      {component.archived ? (
                        <SemanticBadge
                          label={t('settings.components.col_archived')}
                          tone="neutral"
                        />
                      ) : null}
                    </View>
                    {component.description ? (
                      <Text className="text-muted-foreground text-sm" numberOfLines={2}>
                        {component.description}
                      </Text>
                    ) : null}
                    <Text className="text-muted-foreground text-xs" numberOfLines={1}>
                      {componentLeadName(
                        component,
                        projectMembers,
                        t('settings.components.lead_none'),
                      )}
                    </Text>
                    <Text className="text-muted-foreground text-xs" numberOfLines={1}>
                      {defaultAssigneeLabel(component.defaultAssigneeType, t)}
                    </Text>
                    <Text className="text-muted-foreground text-xs">
                      {t('issues.count', { count: component.issueCount ?? 0 })}
                    </Text>
                  </View>
                  <View style={styles.componentRowActions}>
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel={t('common.edit')}
                      disabled={componentMutating}
                      onPress={() => beginComponentEdit(component)}
                      style={[styles.iconAction, componentMutating ? styles.disabled : null]}
                      className="active:opacity-80"
                    >
                      <Pencil size={15} color={colors.foreground} />
                    </Pressable>
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel={t(
                        component.archived
                          ? 'settings.components.toast_restored'
                          : 'settings.components.toast_archived',
                      )}
                      disabled={componentMutating}
                      onPress={() => void toggleComponentArchived(component)}
                      style={[styles.iconAction, componentMutating ? styles.disabled : null]}
                      className="active:opacity-80"
                    >
                      {component.archived ? (
                        <ArchiveRestore size={15} color={colors.foreground} />
                      ) : (
                        <Archive size={15} color={colors.foreground} />
                      )}
                    </Pressable>
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel={t('settings.components.delete_submit')}
                      disabled={componentMutating}
                      onPress={() => confirmDeleteComponent(component)}
                      style={[
                        styles.iconAction,
                        styles.iconActionDanger,
                        componentMutating ? styles.disabled : null,
                      ]}
                      className="active:opacity-80"
                    >
                      <Trash2 size={15} color={colors.destructive} />
                    </Pressable>
                  </View>
                </View>
              ))}
              {componentsQ.isLoading ? (
                <Text style={styles.helperText}>{t('common.loading')}</Text>
              ) : null}
              {!componentsQ.isLoading && components.length === 0 ? (
                <Text style={styles.helperText}>{t('settings.components.empty')}</Text>
              ) : null}
              {componentsQ.isError ? (
                <Text className="text-destructive text-sm">
                  {componentsQ.error instanceof Error
                    ? componentsQ.error.message
                    : t('settings.components.error_generic')}
                </Text>
              ) : null}
            </View>
          </SurfaceRow>

          <SurfaceRow
            className="gap-3"
            onLayout={(event) =>
              handleSettingsSectionLayout('custom-fields', event.nativeEvent.layout.y)
            }
          >
            <View className="flex-row items-start gap-3">
              <IconTile icon={Type} tone="rose" />
              <View className="min-w-0 flex-1 gap-1">
                <Text className="text-foreground text-sm font-semibold">
                  {t('settings.customFields.title')}
                </Text>
                <Text className="text-muted-foreground text-sm" style={styles.helpText}>
                  {t('settings.customFields.subtitle')}
                </Text>
              </View>
            </View>

            <View style={styles.componentForm}>
              <TextField
                label={t('settings.customFields.name_label')}
                placeholder={t('settings.customFields.name_placeholder')}
                value={customFieldName}
                onChangeText={(value) => {
                  setCustomFieldName(value);
                  setCustomFieldError(null);
                  setCustomFieldSaved(null);
                }}
                editable={!customFieldMutating}
              />
              <TextField
                label={t('settings.customFields.description_label')}
                placeholder={t('settings.customFields.description_placeholder')}
                value={customFieldDescription}
                onChangeText={(value) => {
                  setCustomFieldDescription(value);
                  setCustomFieldSaved(null);
                }}
                editable={!customFieldMutating}
                multiline
                className="min-h-12"
              />

              <View style={styles.componentSubsection}>
                <Text className="text-foreground text-sm font-semibold">
                  {t('settings.customFields.type_label')}
                </Text>
                <View style={styles.choiceGrid}>
                  {CUSTOM_FIELD_TYPES.map((type) => (
                    <ChoiceButton
                      key={type}
                      label={customFieldTypeLabel(type, t)}
                      value={type}
                      selected={customFieldType === type}
                      disabled={!!editingCustomField || customFieldMutating}
                      onPress={(next) => {
                        setCustomFieldType(next);
                        setCustomFieldError(null);
                        setCustomFieldSaved(null);
                      }}
                    />
                  ))}
                </View>
                {editingCustomField ? (
                  <Text style={styles.helperText}>{t('settings.customFields.type_locked')}</Text>
                ) : null}
              </View>

              {isOptionsCustomFieldType(customFieldType) ? (
                <TextField
                  label={t('settings.customFields.options_label')}
                  placeholder={t('settings.customFields.options_placeholder')}
                  value={customFieldOptions}
                  onChangeText={(value) => {
                    setCustomFieldOptions(value);
                    setCustomFieldError(null);
                    setCustomFieldSaved(null);
                  }}
                  editable={!customFieldMutating}
                  multiline
                  className="min-h-20"
                />
              ) : null}

              <View style={styles.componentSubsection}>
                <Text className="text-foreground text-sm font-semibold">
                  {t('settings.customFields.required_label')}
                </Text>
                <View style={styles.choiceGrid}>
                  <ChoiceButton
                    label={t('settings.customFields.required_no')}
                    value="false"
                    selected={!customFieldRequired}
                    disabled={customFieldMutating}
                    onPress={() => setCustomFieldRequired(false)}
                  />
                  <ChoiceButton
                    label={t('settings.customFields.required_yes')}
                    value="true"
                    selected={customFieldRequired}
                    disabled={customFieldMutating}
                    onPress={() => setCustomFieldRequired(true)}
                  />
                </View>
              </View>

              {customFieldError ? (
                <Text className="text-destructive text-sm">{customFieldError}</Text>
              ) : null}
              {customFieldSaved ? (
                <Text className="text-muted-foreground text-sm">{customFieldSaved}</Text>
              ) : null}

              <View style={styles.componentActions}>
                {editingCustomField ? (
                  <Button
                    title={t('common.cancel')}
                    variant="secondary"
                    icon={X}
                    disabled={customFieldMutating}
                    onPress={resetCustomFieldForm}
                  />
                ) : null}
                <Button
                  title={
                    editingCustomField
                      ? t('settings.customFields.save_submit')
                      : t('settings.customFields.create_submit')
                  }
                  icon={editingCustomField ? Check : Type}
                  loading={createCustomField.isPending || updateCustomField.isPending}
                  disabled={
                    customFieldMutating ||
                    !customFieldName.trim() ||
                    (isOptionsCustomFieldType(customFieldType) && !customFieldOptions.trim())
                  }
                  onPress={() => void saveCustomField()}
                />
              </View>
            </View>

            <View style={styles.componentList}>
              {customFields.map((field) => {
                const FieldIcon = customFieldTypeIcon(field.type);
                const optionCount = parseCustomFieldOptions(field.options).length;
                return (
                  <View key={field.id} style={styles.componentRow}>
                    <View className="min-w-0 flex-1 gap-1">
                      <View className="flex-row items-center gap-2">
                        <FieldIcon size={15} color={colors.mutedForeground} />
                        <Text className="text-foreground text-base font-semibold" numberOfLines={1}>
                          {field.name}
                        </Text>
                      </View>
                      <View className="flex-row flex-wrap items-center gap-2">
                        <SemanticBadge
                          label={customFieldTypeLabel(field.type, t)}
                          tone={customFieldTypeTone(field.type)}
                        />
                        {field.isRequired ? (
                          <SemanticBadge
                            label={t('settings.customFields.required_chip')}
                            tone="rose"
                          />
                        ) : null}
                      </View>
                      {field.description ? (
                        <Text className="text-muted-foreground text-sm" numberOfLines={2}>
                          {field.description}
                        </Text>
                      ) : null}
                      {isOptionsCustomFieldType(field.type) ? (
                        <Text className="text-muted-foreground text-xs">
                          {t('settings.customFields.option_count', { count: optionCount })}
                        </Text>
                      ) : null}
                    </View>
                    <View style={styles.componentRowActions}>
                      <Pressable
                        accessibilityRole="button"
                        accessibilityLabel={t('common.edit')}
                        disabled={customFieldMutating}
                        onPress={() => beginCustomFieldEdit(field)}
                        style={[styles.iconAction, customFieldMutating ? styles.disabled : null]}
                        className="active:opacity-80"
                      >
                        <Pencil size={15} color={colors.foreground} />
                      </Pressable>
                      <Pressable
                        accessibilityRole="button"
                        accessibilityLabel={t('settings.customFields.delete_submit')}
                        disabled={customFieldMutating}
                        onPress={() => confirmDeleteCustomField(field)}
                        style={[
                          styles.iconAction,
                          styles.iconActionDanger,
                          customFieldMutating ? styles.disabled : null,
                        ]}
                        className="active:opacity-80"
                      >
                        <Trash2 size={15} color={colors.destructive} />
                      </Pressable>
                    </View>
                  </View>
                );
              })}
              {customFieldsQ.isLoading ? (
                <Text style={styles.helperText}>{t('common.loading')}</Text>
              ) : null}
              {!customFieldsQ.isLoading && customFields.length === 0 ? (
                <Text style={styles.helperText}>{t('settings.customFields.empty')}</Text>
              ) : null}
              {customFieldsQ.isError ? (
                <Text className="text-destructive text-sm">
                  {customFieldsQ.error instanceof Error
                    ? customFieldsQ.error.message
                    : t('settings.customFields.error_generic')}
                </Text>
              ) : null}
            </View>
          </SurfaceRow>

          <SurfaceRow
            className="gap-3"
            onLayout={(event) =>
              handleSettingsSectionLayout('work-item-types', event.nativeEvent.layout.y)
            }
          >
            <View className="flex-row items-start gap-3">
              <IconTile icon={Layers} tone="violet" />
              <View className="min-w-0 flex-1 gap-1">
                <Text className="text-foreground text-sm font-semibold">
                  {t('settings.workItemTypes.title')}
                </Text>
                <Text className="text-muted-foreground text-sm" style={styles.helpText}>
                  {t('settings.workItemTypes.subtitle')}
                </Text>
              </View>
              <SemanticBadge
                label={t('settings.workItemTypes.type_count', { count: workItemTypes.length })}
                tone="violet"
              />
            </View>

            <View style={styles.componentActions}>
              <Button
                title={t('settings.workItemTypes.reset')}
                variant="secondary"
                icon={RotateCcw}
                disabled={!schemaSettings.isHydrated}
                onPress={() => {
                  schemaSettings.resetWorkItemTypes();
                  setWorkItemTypeEditingId(null);
                  setWorkItemTypeSaved(t('settings.workItemTypes.reset_done'));
                }}
              />
              <Button
                title={t('settings.workItemTypes.new_type')}
                icon={Plus}
                disabled={!schemaSettings.isHydrated}
                onPress={createWorkItemType}
              />
            </View>

            <View style={styles.componentList}>
              {workItemTypes.map((type) => {
                const displayName = workItemTypeName(type, t);
                const displayDescription = workItemTypeDescription(type, t);
                const TypeIcon = WORK_ITEM_ICON_COMPONENTS[type.icon];
                const isEditing = workItemTypeEditingId === type.id;
                return (
                  <View key={type.id} style={styles.componentRow}>
                    <View className="min-w-0 flex-1 gap-3">
                      <View className="flex-row items-start gap-3">
                        <View
                          style={[
                            styles.workItemIconTile,
                            { borderColor: `${type.color}55`, backgroundColor: `${type.color}18` },
                          ]}
                        >
                          <TypeIcon size={17} color={type.color} />
                        </View>
                        <View className="min-w-0 flex-1 gap-1">
                          <View className="flex-row flex-wrap items-center gap-2">
                            <Text
                              className="text-foreground text-base font-semibold"
                              numberOfLines={1}
                            >
                              {displayName}
                            </Text>
                            <View
                              style={[styles.colorDot, { backgroundColor: type.color }]}
                              accessibilityLabel={workItemColorLabel(type.color, t)}
                            />
                            {type.isDefault ? (
                              <SemanticBadge
                                label={t('settings.workItemTypes.default_badge')}
                                tone="emerald"
                              />
                            ) : null}
                          </View>
                          {displayDescription ? (
                            <Text className="text-muted-foreground text-sm" numberOfLines={2}>
                              {displayDescription}
                            </Text>
                          ) : null}
                          <Text className="text-muted-foreground text-xs">
                            {t('settings.workItemTypes.property_count', {
                              count: type.customProperties.length,
                            })}
                          </Text>
                        </View>
                      </View>

                      {isEditing ? (
                        <View style={styles.typeEditor}>
                          <View style={styles.componentSubsection}>
                            <Text className="text-foreground text-sm font-semibold">
                              {t('settings.workItemTypes.icon_label')}
                            </Text>
                            <View style={styles.iconChoiceGrid}>
                              {WORK_ITEM_ICON_OPTIONS.map((icon) => {
                                const Icon = WORK_ITEM_ICON_COMPONENTS[icon];
                                const selected = type.icon === icon;
                                return (
                                  <Pressable
                                    key={icon}
                                    accessibilityRole="button"
                                    accessibilityLabel={workItemIconLabel(icon, t)}
                                    onPress={() => {
                                      schemaSettings.updateWorkItemType(type.id, { icon });
                                      setWorkItemTypeSaved(null);
                                    }}
                                    style={[
                                      styles.iconChoice,
                                      selected ? styles.iconChoiceActive : null,
                                    ]}
                                    className="active:opacity-80"
                                  >
                                    <Icon
                                      size={17}
                                      color={
                                        selected ? colors.primaryForeground : colors.foreground
                                      }
                                    />
                                  </Pressable>
                                );
                              })}
                            </View>
                          </View>

                          <View style={styles.componentSubsection}>
                            <Text className="text-foreground text-sm font-semibold">
                              {t('settings.workItemTypes.color_label')}
                            </Text>
                            <View style={styles.choiceGrid}>
                              {WORK_ITEM_COLOR_SWATCHES.map((color) => (
                                <Pressable
                                  key={color}
                                  accessibilityRole="button"
                                  accessibilityLabel={t('settings.workItemTypes.set_color', {
                                    color: workItemColorLabel(color, t),
                                  })}
                                  onPress={() => {
                                    schemaSettings.updateWorkItemType(type.id, { color });
                                    setWorkItemTypeSaved(null);
                                  }}
                                  style={[
                                    styles.colorSwatch,
                                    {
                                      backgroundColor: color,
                                      borderColor:
                                        type.color === color ? colors.foreground : colors.border,
                                    },
                                  ]}
                                  className="active:opacity-80"
                                />
                              ))}
                            </View>
                          </View>

                          <TextField
                            label={t('settings.workItemTypes.name_label')}
                            placeholder={t('settings.workItemTypes.name_placeholder')}
                            value={type.isDefault ? displayName : type.name}
                            editable={!type.isDefault}
                            onChangeText={(value) => {
                              schemaSettings.updateWorkItemType(type.id, { name: value });
                              setWorkItemTypeSaved(null);
                            }}
                          />
                          <TextField
                            label={t('settings.workItemTypes.description_label')}
                            placeholder={t('settings.workItemTypes.description_placeholder')}
                            value={type.isDefault ? displayDescription : (type.description ?? '')}
                            editable={!type.isDefault}
                            onChangeText={(value) => {
                              schemaSettings.updateWorkItemType(type.id, { description: value });
                              setWorkItemTypeSaved(null);
                            }}
                            multiline
                            className="min-h-12"
                          />
                          {type.isDefault ? (
                            <Text style={styles.helperText}>
                              {t('settings.workItemTypes.default_locked')}
                            </Text>
                          ) : null}

                          <View style={styles.componentSubsection}>
                            <View className="flex-row items-center justify-between gap-3">
                              <View className="min-w-0 flex-1">
                                <Text className="text-foreground text-sm font-semibold">
                                  {t('settings.workItemTypes.properties_title')}
                                </Text>
                                <Text className="text-muted-foreground text-xs">
                                  {t('settings.workItemTypes.properties_hint', {
                                    type: displayName.toLowerCase(),
                                  })}
                                </Text>
                              </View>
                              <Button
                                title={t('settings.workItemTypes.add_property')}
                                variant="secondary"
                                icon={Plus}
                                onPress={() => addWorkItemCustomProperty(type.id)}
                              />
                            </View>

                            {type.customProperties.length === 0 ? (
                              <Text style={styles.helperText}>
                                {t('settings.workItemTypes.no_properties')}
                              </Text>
                            ) : (
                              <View style={styles.nestedList}>
                                {type.customProperties.map((property) => {
                                  const PropertyIcon = workItemPropertyTypeIcon(property.type);
                                  const options = property.options ?? [];
                                  return (
                                    <View key={property.id} style={styles.propertyEditor}>
                                      <View className="flex-row items-start gap-2">
                                        <PropertyIcon size={15} color={colors.mutedForeground} />
                                        <View className="min-w-0 flex-1 gap-2">
                                          <TextField
                                            label={t('settings.workItemTypes.property_name_label')}
                                            placeholder={t(
                                              'settings.workItemTypes.property_name_placeholder',
                                            )}
                                            value={property.name}
                                            onChangeText={(value) =>
                                              updateWorkItemCustomProperty(type.id, property, {
                                                name: value,
                                              })
                                            }
                                          />
                                          <View style={styles.choiceGrid}>
                                            {WORK_ITEM_CUSTOM_PROPERTY_TYPES.map((propertyType) => (
                                              <ChoiceButton
                                                key={propertyType}
                                                label={workItemPropertyTypeLabel(propertyType, t)}
                                                value={propertyType}
                                                selected={property.type === propertyType}
                                                onPress={(nextType) =>
                                                  updateWorkItemCustomProperty(type.id, property, {
                                                    type: nextType,
                                                  })
                                                }
                                              />
                                            ))}
                                          </View>
                                          <View style={styles.choiceGrid}>
                                            <ChoiceButton
                                              label={t('settings.workItemTypes.optional')}
                                              value="false"
                                              selected={!property.required}
                                              onPress={() =>
                                                updateWorkItemCustomProperty(type.id, property, {
                                                  required: false,
                                                })
                                              }
                                            />
                                            <ChoiceButton
                                              label={t('settings.workItemTypes.required')}
                                              value="true"
                                              selected={property.required}
                                              onPress={() =>
                                                updateWorkItemCustomProperty(type.id, property, {
                                                  required: true,
                                                })
                                              }
                                            />
                                          </View>
                                          {property.type === 'dropdown' ? (
                                            <View style={styles.componentSubsection}>
                                              <Text className="text-foreground text-sm font-semibold">
                                                {t('settings.workItemTypes.options_label')}
                                              </Text>
                                              {options.map((option, index) => (
                                                <View
                                                  key={`${property.id}-option-${index}`}
                                                  className="flex-row items-end gap-2"
                                                >
                                                  <View className="min-w-0 flex-1">
                                                    <TextField
                                                      label={t(
                                                        'settings.workItemTypes.option_label',
                                                        {
                                                          index: index + 1,
                                                        },
                                                      )}
                                                      placeholder={t(
                                                        'settings.workItemTypes.option_n',
                                                        { index: index + 1 },
                                                      )}
                                                      value={option}
                                                      onChangeText={(value) => {
                                                        const nextOptions = [...options];
                                                        nextOptions[index] = value;
                                                        updateWorkItemCustomProperty(
                                                          type.id,
                                                          property,
                                                          {
                                                            options: nextOptions,
                                                          },
                                                        );
                                                      }}
                                                    />
                                                  </View>
                                                  <Pressable
                                                    accessibilityRole="button"
                                                    accessibilityLabel={t(
                                                      'settings.workItemTypes.remove_option',
                                                    )}
                                                    disabled={options.length <= 1}
                                                    onPress={() => {
                                                      const nextOptions = options.filter(
                                                        (_, optionIndex) => optionIndex !== index,
                                                      );
                                                      updateWorkItemCustomProperty(
                                                        type.id,
                                                        property,
                                                        {
                                                          options: nextOptions,
                                                        },
                                                      );
                                                    }}
                                                    style={[
                                                      styles.iconAction,
                                                      styles.iconActionDanger,
                                                      options.length <= 1 ? styles.disabled : null,
                                                    ]}
                                                    className="active:opacity-80"
                                                  >
                                                    <X size={15} color={colors.destructive} />
                                                  </Pressable>
                                                </View>
                                              ))}
                                              <View style={styles.componentActions}>
                                                <Button
                                                  title={t('settings.workItemTypes.add_option')}
                                                  variant="secondary"
                                                  icon={Plus}
                                                  onPress={() =>
                                                    updateWorkItemCustomProperty(
                                                      type.id,
                                                      property,
                                                      {
                                                        options: [
                                                          ...options,
                                                          t('settings.workItemTypes.option_n', {
                                                            index: options.length + 1,
                                                          }),
                                                        ],
                                                      },
                                                    )
                                                  }
                                                />
                                              </View>
                                            </View>
                                          ) : null}
                                        </View>
                                        <Pressable
                                          accessibilityRole="button"
                                          accessibilityLabel={t(
                                            'settings.workItemTypes.remove_property',
                                          )}
                                          onPress={() =>
                                            removeWorkItemCustomProperty(type.id, property.id)
                                          }
                                          style={[styles.iconAction, styles.iconActionDanger]}
                                          className="active:opacity-80"
                                        >
                                          <Trash2 size={15} color={colors.destructive} />
                                        </Pressable>
                                      </View>
                                    </View>
                                  );
                                })}
                              </View>
                            )}
                          </View>
                        </View>
                      ) : null}
                    </View>

                    <View style={styles.componentRowActions}>
                      <Pressable
                        accessibilityRole="button"
                        accessibilityLabel={t('common.edit')}
                        onPress={() => setWorkItemTypeEditingId(isEditing ? null : type.id)}
                        style={styles.iconAction}
                        className="active:opacity-80"
                      >
                        <Pencil size={15} color={colors.foreground} />
                      </Pressable>
                      <Pressable
                        accessibilityRole="button"
                        accessibilityLabel={t('settings.workItemTypes.delete_submit')}
                        disabled={!!type.isDefault}
                        onPress={() => confirmDeleteWorkItemType(type)}
                        style={[
                          styles.iconAction,
                          styles.iconActionDanger,
                          type.isDefault ? styles.disabled : null,
                        ]}
                        className="active:opacity-80"
                      >
                        <Trash2 size={15} color={colors.destructive} />
                      </Pressable>
                    </View>
                  </View>
                );
              })}
            </View>

            {workItemTypeSaved ? (
              <Text className="text-muted-foreground text-sm">{workItemTypeSaved}</Text>
            ) : null}
          </SurfaceRow>

          <SurfaceRow
            className="gap-3"
            onLayout={(event) =>
              handleSettingsSectionLayout('estimates', event.nativeEvent.layout.y)
            }
          >
            <View className="flex-row items-start gap-3">
              <IconTile icon={Hash} tone="cyan" />
              <View className="min-w-0 flex-1 gap-1">
                <Text className="text-foreground text-sm font-semibold">
                  {t('settings.estimates.title')}
                </Text>
                <Text className="text-muted-foreground text-sm" style={styles.helpText}>
                  {t('settings.estimates.subtitle')}
                </Text>
              </View>
              <SemanticBadge
                label={estimateSubKindLabel(schemaSettings.estimateScale.subKind, t)}
                tone="cyan"
              />
            </View>

            <View style={styles.componentForm}>
              <View style={styles.componentSubsection}>
                <Text className="text-foreground text-sm font-semibold">
                  {t('settings.estimates.kind_label')}
                </Text>
                <View style={styles.choiceGrid}>
                  {ESTIMATE_KINDS.map((kind) => (
                    <ChoiceButton
                      key={kind}
                      label={estimateKindLabel(kind, t)}
                      value={kind}
                      selected={estimateActiveKind === kind}
                      onPress={handleEstimateKindChange}
                    />
                  ))}
                </View>
              </View>

              <View style={styles.toggleList}>
                {SUBKINDS_BY_KIND[estimateActiveKind].map((subKind) => {
                  const selected = estimateSelectedSubKind === subKind;
                  const preset = localizedPresetEstimateScale(subKind, t);
                  return (
                    <Pressable
                      key={subKind}
                      accessibilityRole="radio"
                      accessibilityState={{ checked: selected }}
                      onPress={() => {
                        setEstimateSelectedSubKind(subKind);
                        setEstimateSaved(null);
                      }}
                      style={[styles.toggleRow, selected ? styles.toggleRowActive : null]}
                      className="active:opacity-80"
                    >
                      <View className="min-w-0 flex-1 gap-2">
                        <Text className="text-foreground text-sm font-semibold">
                          {estimateSubKindLabel(subKind, t)}
                        </Text>
                        {preset ? (
                          <View className="flex-row flex-wrap gap-2">
                            {preset.values.map((value, index) => (
                              <SemanticBadge
                                key={`${subKind}-${index}-${value}`}
                                label={value}
                                tone="neutral"
                              />
                            ))}
                          </View>
                        ) : (
                          <Text style={styles.helperText}>
                            {t('settings.estimates.custom_hint')}
                          </Text>
                        )}
                      </View>
                      <View
                        style={[styles.switchTrack, selected ? styles.switchTrackActive : null]}
                      >
                        {selected ? <Check size={13} color={colors.primaryForeground} /> : null}
                      </View>
                    </Pressable>
                  );
                })}
              </View>

              {isCustomSubKind(estimateSelectedSubKind) ? (
                <View style={styles.componentSubsection}>
                  <Text className="text-foreground text-sm font-semibold">
                    {t('settings.estimates.custom_values')}
                  </Text>
                  {estimateCustomValues[estimateActiveKind].map((value, index) => (
                    <View
                      key={`${estimateActiveKind}-${index}`}
                      className="flex-row items-end gap-2"
                    >
                      <View className="min-w-0 flex-1">
                        <TextField
                          label={t('settings.estimates.value_label', { index: index + 1 })}
                          placeholder={t('settings.estimates.value_placeholder', {
                            index: index + 1,
                          })}
                          value={value}
                          onChangeText={(next) =>
                            updateEstimateCustomValue(estimateActiveKind, index, next)
                          }
                        />
                      </View>
                      <Pressable
                        accessibilityRole="button"
                        accessibilityLabel={t('settings.estimates.remove_value', {
                          index: index + 1,
                        })}
                        disabled={
                          estimateCustomValues[estimateActiveKind].length <=
                          MIN_CUSTOM_ESTIMATE_VALUES
                        }
                        onPress={() => removeEstimateCustomValue(estimateActiveKind, index)}
                        style={[
                          styles.iconAction,
                          styles.iconActionDanger,
                          estimateCustomValues[estimateActiveKind].length <=
                          MIN_CUSTOM_ESTIMATE_VALUES
                            ? styles.disabled
                            : null,
                        ]}
                        className="active:opacity-80"
                      >
                        <X size={15} color={colors.destructive} />
                      </Pressable>
                    </View>
                  ))}
                  <View style={styles.componentActions}>
                    <Button
                      title={t('settings.estimates.add_value')}
                      variant="secondary"
                      icon={Plus}
                      disabled={
                        estimateCustomValues[estimateActiveKind].length >=
                        MAX_CUSTOM_ESTIMATE_VALUES
                      }
                      onPress={() => addEstimateCustomValue(estimateActiveKind)}
                    />
                  </View>
                </View>
              ) : null}

              {estimateSaved ? (
                <Text className="text-muted-foreground text-sm">{estimateSaved}</Text>
              ) : null}

              <View style={styles.componentActions}>
                <Button
                  title={t('settings.estimates.reset')}
                  variant="secondary"
                  icon={RotateCcw}
                  onPress={resetEstimateScale}
                />
                <Button
                  title={t('settings.estimates.save_scale')}
                  icon={Check}
                  disabled={!estimateDraftScale()}
                  onPress={saveEstimateScale}
                />
              </View>
            </View>
          </SurfaceRow>

          <SurfaceRow
            className="gap-3"
            onLayout={(event) =>
              handleSettingsSectionLayout('versions', event.nativeEvent.layout.y)
            }
          >
            <View className="flex-row items-start gap-3">
              <IconTile icon={CalendarDays} tone="indigo" />
              <View className="min-w-0 flex-1 gap-1">
                <Text className="text-foreground text-sm font-semibold">
                  {t('settings.versions.title')}
                </Text>
                <Text className="text-muted-foreground text-sm" style={styles.helpText}>
                  {t('settings.versions.subtitle')}
                </Text>
              </View>
            </View>

            <View style={styles.componentForm}>
              <TextField
                label={t('settings.versions.name_label')}
                placeholder={t('settings.versions.name_placeholder')}
                value={versionName}
                onChangeText={(value) => {
                  setVersionName(value);
                  setVersionError(null);
                  setVersionSaved(null);
                }}
                editable={!versionMutating}
              />
              <TextField
                label={t('settings.versions.description_label')}
                placeholder={t('settings.versions.description_placeholder')}
                value={versionDescription}
                onChangeText={(value) => {
                  setVersionDescription(value);
                  setVersionSaved(null);
                }}
                editable={!versionMutating}
                multiline
                className="min-h-12"
              />
              <View style={styles.dateGrid}>
                <View style={styles.dateField}>
                  <TextField
                    label={t('settings.versions.start_date_label')}
                    placeholder={t('settings.versions.start_date_placeholder')}
                    value={versionStartDate}
                    onChangeText={(value) => {
                      setVersionStartDate(value);
                      setVersionError(null);
                      setVersionSaved(null);
                    }}
                    editable={!versionMutating}
                    autoCapitalize="none"
                  />
                </View>
                <View style={styles.dateField}>
                  <TextField
                    label={t('settings.versions.release_date_label')}
                    placeholder={t('settings.versions.release_date_placeholder')}
                    value={versionReleaseDate}
                    onChangeText={(value) => {
                      setVersionReleaseDate(value);
                      setVersionError(null);
                      setVersionSaved(null);
                    }}
                    editable={!versionMutating}
                    autoCapitalize="none"
                  />
                </View>
              </View>

              {editingVersion ? (
                <View style={styles.componentSubsection}>
                  <Text className="text-foreground text-sm font-semibold">
                    {t('settings.versions.status_label')}
                  </Text>
                  <View style={styles.choiceGrid}>
                    {VERSION_STATUSES.map((status) => (
                      <ChoiceButton
                        key={status}
                        label={versionStatusLabel(status, t)}
                        value={status}
                        selected={versionStatus === status}
                        onPress={setVersionStatus}
                      />
                    ))}
                  </View>
                </View>
              ) : null}

              {versionError ? (
                <Text className="text-destructive text-sm">{versionError}</Text>
              ) : null}
              {versionSaved ? (
                <Text className="text-muted-foreground text-sm">{versionSaved}</Text>
              ) : null}

              <View style={styles.componentActions}>
                {editingVersion ? (
                  <Button
                    title={t('common.cancel')}
                    variant="secondary"
                    icon={X}
                    disabled={versionMutating}
                    onPress={resetVersionForm}
                  />
                ) : null}
                <Button
                  title={
                    editingVersion
                      ? t('settings.versions.save_submit')
                      : t('settings.versions.create_submit')
                  }
                  icon={editingVersion ? Check : CalendarDays}
                  loading={createVersion.isPending || updateVersion.isPending}
                  disabled={versionMutating || !versionName.trim()}
                  onPress={() => void saveVersion()}
                />
              </View>
            </View>

            <View style={styles.componentList}>
              {versions.map((version) => {
                const startDate = formatVersionDate(version.startDate, i18n.language);
                const releaseDate = formatVersionDate(version.releaseDate, i18n.language);
                const status = normalizeVersionStatus(version.status);
                return (
                  <View key={version.id} style={styles.componentRow}>
                    <View className="min-w-0 flex-1 gap-1">
                      <View className="flex-row items-center gap-2">
                        <Text className="text-foreground text-base font-semibold" numberOfLines={1}>
                          {version.name}
                        </Text>
                        <SemanticBadge
                          label={versionStatusLabel(status, t)}
                          tone={versionStatusTone(status)}
                        />
                      </View>
                      {version.description ? (
                        <Text className="text-muted-foreground text-sm" numberOfLines={2}>
                          {version.description}
                        </Text>
                      ) : null}
                      {startDate ? (
                        <Text className="text-muted-foreground text-xs" numberOfLines={1}>
                          {t('settings.versions.date_start', { date: startDate })}
                        </Text>
                      ) : null}
                      {releaseDate ? (
                        <Text className="text-muted-foreground text-xs" numberOfLines={1}>
                          {t('settings.versions.date_release', { date: releaseDate })}
                        </Text>
                      ) : null}
                      <Text className="text-muted-foreground text-xs">
                        {t('settings.versions.progress', {
                          done: version.doneIssueCount ?? 0,
                          total: version.issueCount ?? 0,
                        })}
                      </Text>
                    </View>
                    <View style={styles.componentRowActions}>
                      <Pressable
                        accessibilityRole="button"
                        accessibilityLabel={t('common.edit')}
                        disabled={versionMutating}
                        onPress={() => beginVersionEdit(version)}
                        style={[styles.iconAction, versionMutating ? styles.disabled : null]}
                        className="active:opacity-80"
                      >
                        <Pencil size={15} color={colors.foreground} />
                      </Pressable>
                      {status !== 'released' && status !== 'archived' ? (
                        <Pressable
                          accessibilityRole="button"
                          accessibilityLabel={t('settings.versions.release_submit')}
                          disabled={versionMutating}
                          onPress={() => void releaseVersionById(version)}
                          style={[styles.iconAction, versionMutating ? styles.disabled : null]}
                          className="active:opacity-80"
                        >
                          <Rocket size={15} color={colors.foreground} />
                        </Pressable>
                      ) : null}
                      <Pressable
                        accessibilityRole="button"
                        accessibilityLabel={t(
                          status === 'archived'
                            ? 'settings.versions.restore_submit'
                            : 'settings.versions.archive_submit',
                        )}
                        disabled={versionMutating}
                        onPress={() => void toggleVersionArchived(version)}
                        style={[styles.iconAction, versionMutating ? styles.disabled : null]}
                        className="active:opacity-80"
                      >
                        {status === 'archived' ? (
                          <ArchiveRestore size={15} color={colors.foreground} />
                        ) : (
                          <Archive size={15} color={colors.foreground} />
                        )}
                      </Pressable>
                      <Pressable
                        accessibilityRole="button"
                        accessibilityLabel={t('settings.versions.delete_submit')}
                        disabled={versionMutating}
                        onPress={() => confirmDeleteVersion(version)}
                        style={[
                          styles.iconAction,
                          styles.iconActionDanger,
                          versionMutating ? styles.disabled : null,
                        ]}
                        className="active:opacity-80"
                      >
                        <Trash2 size={15} color={colors.destructive} />
                      </Pressable>
                    </View>
                  </View>
                );
              })}
              {versionsQ.isLoading ? (
                <Text style={styles.helperText}>{t('common.loading')}</Text>
              ) : null}
              {!versionsQ.isLoading && versions.length === 0 ? (
                <Text style={styles.helperText}>{t('settings.versions.empty')}</Text>
              ) : null}
              {versionsQ.isError ? (
                <Text className="text-destructive text-sm">
                  {versionsQ.error instanceof Error
                    ? versionsQ.error.message
                    : t('settings.versions.error_generic')}
                </Text>
              ) : null}
            </View>
          </SurfaceRow>

          <SurfaceRow
            className="gap-3"
            onLayout={(event) =>
              handleSettingsSectionLayout('webhooks', event.nativeEvent.layout.y)
            }
          >
            <View className="flex-row items-start gap-3">
              <IconTile icon={WebhookIcon} tone="indigo" />
              <View className="min-w-0 flex-1 gap-1">
                <Text className="text-foreground text-sm font-semibold">
                  {t('developer.webhooks.title')}
                </Text>
                <Text className="text-muted-foreground text-sm" style={styles.helpText}>
                  {t('developer.webhooks.createSubtitle')}
                </Text>
              </View>
            </View>

            <View style={styles.componentForm}>
              {webhookSecret ? (
                <View style={styles.secretBox}>
                  <Text className="text-foreground text-sm font-semibold">
                    {t('developer.webhooks.createdSecretTitle')}
                  </Text>
                  <Text style={styles.helperText}>{t('developer.webhooks.createdSecretDesc')}</Text>
                  <Text selectable style={styles.secretValue}>
                    {webhookSecret}
                  </Text>
                  <View style={styles.componentActions}>
                    <Button
                      title={t('developer.doneSaved')}
                      variant="secondary"
                      icon={Check}
                      onPress={() => setWebhookSecret(null)}
                    />
                  </View>
                </View>
              ) : null}

              <TextField
                label={t('developer.webhooks.nameLabel')}
                placeholder={t('developer.webhooks.namePlaceholder')}
                value={webhookName}
                onChangeText={(value) => {
                  setWebhookName(value);
                  setWebhookError(null);
                  setWebhookSaved(null);
                }}
                editable={!webhookMutating}
              />
              <TextField
                label={t('developer.webhooks.urlLabel')}
                placeholder={t('developer.webhooks.urlPlaceholder')}
                value={webhookUrl}
                onChangeText={(value) => {
                  setWebhookUrl(value);
                  setWebhookError(null);
                  setWebhookSaved(null);
                }}
                editable={!webhookMutating}
                autoCapitalize="none"
                keyboardType="url"
              />

              <View style={styles.componentSubsection}>
                <Text className="text-foreground text-sm font-semibold">
                  {t('developer.webhooks.eventsLabel')}
                </Text>
                <View style={styles.choiceGrid}>
                  {PROJECT_WEBHOOK_EVENTS.map((event) => (
                    <ChoiceButton
                      key={event}
                      label={event}
                      value={event}
                      selected={webhookEvents.includes(event)}
                      disabled={webhookMutating}
                      onPress={toggleWebhookEvent}
                    />
                  ))}
                </View>
              </View>

              {webhookError ? (
                <Text className="text-destructive text-sm">{webhookError}</Text>
              ) : null}
              {webhookSaved ? (
                <Text className="text-muted-foreground text-sm">{webhookSaved}</Text>
              ) : null}

              <View style={styles.componentActions}>
                {editingProjectWebhook ? (
                  <Button
                    title={t('common.cancel')}
                    variant="secondary"
                    icon={X}
                    disabled={webhookMutating}
                    onPress={resetWebhookForm}
                  />
                ) : null}
                <Button
                  title={
                    editingProjectWebhook
                      ? t('developer.webhooks.save')
                      : t('developer.webhooks.create')
                  }
                  icon={editingProjectWebhook ? Check : WebhookIcon}
                  loading={createProjectWebhook.isPending || updateProjectWebhook.isPending}
                  disabled={
                    !customFieldScope ||
                    webhookMutating ||
                    !webhookName.trim() ||
                    !webhookUrl.trim() ||
                    webhookEvents.length === 0
                  }
                  onPress={() => void submitProjectWebhook()}
                />
              </View>
            </View>

            <View style={styles.componentList}>
              {projectWebhooks.map((webhook) => {
                const lastTriggered = formatWebhookTimestamp(
                  webhook.lastTriggeredAt,
                  i18n.language,
                );
                const testResult = webhookTestResults[webhook.id];
                const isTesting = testingWebhookId === webhook.id;
                return (
                  <View key={webhook.id} style={styles.componentRow}>
                    <View className="min-w-0 flex-1 gap-2">
                      <View className="gap-1">
                        <View className="flex-row items-center gap-2">
                          <Text
                            className="text-foreground text-base font-semibold"
                            numberOfLines={1}
                          >
                            {webhook.name}
                          </Text>
                          <SemanticBadge
                            label={
                              webhook.isActive
                                ? t('developer.webhooks.statusActive')
                                : t('developer.webhooks.statusInactive')
                            }
                            tone={webhook.isActive ? 'emerald' : 'neutral'}
                          />
                        </View>
                        <SemanticBadge
                          label={t('developer.webhooks.stats', {
                            ok: webhook.successCount,
                            failed: webhook.failureCount,
                          })}
                          tone="blue"
                        />
                      </View>
                      <Text className="text-muted-foreground text-xs" numberOfLines={2}>
                        {webhook.url}
                      </Text>
                      <View className="flex-row flex-wrap gap-2">
                        {webhook.events.map((event) => (
                          <SemanticBadge key={event} label={event} tone="neutral" />
                        ))}
                      </View>
                      <Text className="text-muted-foreground text-xs">
                        {lastTriggered
                          ? t('developer.webhooks.lastTriggered', { time: lastTriggered })
                          : t('developer.webhooks.neverTriggered')}
                      </Text>
                      {testResult ? (
                        <Text
                          className={
                            testResult.success
                              ? 'text-muted-foreground text-xs'
                              : 'text-destructive text-xs'
                          }
                        >
                          {testResult.statusCode
                            ? t('developer.webhooks.testResult', {
                                status: testResult.statusCode,
                                ms: testResult.durationMs,
                              })
                            : testResult.error || t('developer.webhooks.testNoResponse')}
                        </Text>
                      ) : null}
                    </View>
                    <View style={styles.componentRowActions}>
                      <Pressable
                        accessibilityRole="button"
                        accessibilityLabel={t('developer.webhooks.sendTest')}
                        disabled={webhookMutating}
                        onPress={() => void sendProjectWebhookTest(webhook)}
                        style={[styles.iconAction, webhookMutating ? styles.disabled : null]}
                        className="active:opacity-80"
                      >
                        <Send
                          size={15}
                          color={isTesting ? colors.mutedForeground : colors.foreground}
                        />
                      </Pressable>
                      <Pressable
                        accessibilityRole="button"
                        accessibilityLabel={t('common.edit')}
                        disabled={webhookMutating}
                        onPress={() => beginWebhookEdit(webhook)}
                        style={[styles.iconAction, webhookMutating ? styles.disabled : null]}
                        className="active:opacity-80"
                      >
                        <Pencil size={15} color={colors.foreground} />
                      </Pressable>
                      <Pressable
                        accessibilityRole="switch"
                        accessibilityState={{
                          checked: webhook.isActive,
                          disabled: webhookMutating,
                        }}
                        disabled={webhookMutating}
                        onPress={() => void toggleProjectWebhookActive(webhook)}
                        style={[styles.iconAction, webhookMutating ? styles.disabled : null]}
                        className="active:opacity-80"
                      >
                        <RotateCw size={15} color={colors.foreground} />
                      </Pressable>
                      <Pressable
                        accessibilityRole="button"
                        accessibilityLabel={t('developer.webhooks.delete')}
                        disabled={webhookMutating}
                        onPress={() => confirmDeleteProjectWebhook(webhook)}
                        style={[
                          styles.iconAction,
                          styles.iconActionDanger,
                          webhookMutating ? styles.disabled : null,
                        ]}
                        className="active:opacity-80"
                      >
                        <Trash2 size={15} color={colors.destructive} />
                      </Pressable>
                    </View>
                  </View>
                );
              })}
              {projectWebhooksQ.isLoading ? (
                <Text style={styles.helperText}>{t('developer.webhooks.loading')}</Text>
              ) : null}
              {!projectWebhooksQ.isLoading && projectWebhooks.length === 0 ? (
                <Text style={styles.helperText}>{t('developer.webhooks.emptyDesc')}</Text>
              ) : null}
              {projectWebhooksQ.isError ? (
                <Text className="text-destructive text-sm">
                  {projectWebhooksQ.error instanceof Error
                    ? projectWebhooksQ.error.message
                    : t('developer.webhooks.loadFailed')}
                </Text>
              ) : null}
            </View>
          </SurfaceRow>

          {saved ? (
            <SurfaceRow className="flex-row items-center gap-2">
              <Check size={16} color={colors.success} />
              <Text className="text-foreground text-sm font-semibold">{t('projects.updated')}</Text>
            </SurfaceRow>
          ) : null}

          {formError ? <Text className="text-destructive px-4 text-sm">{formError}</Text> : null}
        </ScrollView>

        <View style={styles.footer}>
          <Button
            title={t('projects.reset')}
            variant="secondary"
            icon={RotateCcw}
            disabled={!hasChanges || updateProject.isPending}
            onPress={resetForm}
          />
          <Button
            title={t('common.save')}
            icon={Check}
            loading={updateProject.isPending}
            disabled={!hasChanges || updateProject.isPending}
            onPress={form.handleSubmit(onSubmit)}
          />
        </View>
      </KeyboardAvoidingView>
    </Screen>
  );
}

function createProjectSettingsStyles(colors: ThemeColors) {
  return StyleSheet.create({
    content: {
      gap: 14,
      paddingBottom: 24,
    },
    section: {
      gap: 12,
      paddingHorizontal: 16,
    },
    helpText: {
      lineHeight: 20,
    },
    choiceGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 8,
    },
    choiceButton: {
      minWidth: 96,
      alignItems: 'center',
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
      borderRadius: 4,
      backgroundColor: colors.card,
      paddingHorizontal: 12,
      paddingVertical: 9,
    },
    choiceButtonActive: {
      borderColor: colors.primary,
      backgroundColor: colors.primary,
    },
    choiceText: {
      color: colors.mutedForeground,
      fontSize: 13,
      fontWeight: '600',
      lineHeight: 18,
    },
    choiceTextActive: {
      color: colors.primaryForeground,
    },
    componentForm: {
      gap: 10,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: colors.border,
      paddingTop: 12,
    },
    workItemIconTile: {
      width: 36,
      height: 36,
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: StyleSheet.hairlineWidth,
      borderRadius: 6,
    },
    colorDot: {
      width: 11,
      height: 11,
      borderRadius: 2,
    },
    typeEditor: {
      gap: 12,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: colors.border,
      paddingTop: 12,
    },
    iconChoiceGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 8,
    },
    iconChoice: {
      width: 42,
      height: 38,
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
      borderRadius: 4,
      backgroundColor: colors.card,
    },
    iconChoiceActive: {
      borderColor: colors.primary,
      backgroundColor: colors.primary,
    },
    colorSwatch: {
      width: 34,
      height: 34,
      borderWidth: 2,
      borderRadius: 17,
    },
    propertyEditor: {
      gap: 10,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
      borderRadius: 6,
      backgroundColor: colors.surface,
      padding: 10,
    },
    dateGrid: {
      flexDirection: 'row',
      gap: 10,
    },
    dateField: {
      flex: 1,
      minWidth: 0,
    },
    componentSubsection: {
      gap: 8,
    },
    agentSummaryGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 8,
    },
    agentSummaryBox: {
      minWidth: 112,
      flex: 1,
      gap: 3,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
      borderRadius: 6,
      backgroundColor: colors.surface,
      padding: 10,
    },
    agentSummaryLabel: {
      color: colors.mutedForeground,
      fontSize: 11,
      fontWeight: '700',
      lineHeight: 15,
    },
    agentSummaryValue: {
      color: colors.foreground,
      fontSize: 14,
      fontWeight: '700',
      lineHeight: 19,
    },
    agentCapacityGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 10,
    },
    agentCapacityField: {
      minWidth: 150,
      flex: 1,
    },
    agentIssueBox: {
      gap: 6,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: `${colors.warning}55`,
      borderRadius: 6,
      backgroundColor: `${colors.warning}12`,
      padding: 10,
    },
    toggleList: {
      gap: 8,
    },
    toggleRow: {
      minHeight: 74,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
      borderRadius: 6,
      backgroundColor: colors.surface,
      padding: 10,
    },
    toggleRowActive: {
      borderColor: `${colors.primary}55`,
      backgroundColor: `${colors.primary}10`,
    },
    switchTrack: {
      width: 38,
      height: 26,
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
      borderRadius: 13,
      backgroundColor: colors.card,
    },
    switchTrackActive: {
      borderColor: colors.primary,
      backgroundColor: colors.primary,
    },
    componentActions: {
      flexDirection: 'row',
      justifyContent: 'flex-end',
      gap: 10,
    },
    secretBox: {
      gap: 8,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: `${colors.primary}55`,
      borderRadius: 6,
      backgroundColor: `${colors.primary}12`,
      padding: 10,
    },
    secretValue: {
      color: colors.foreground,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
      borderRadius: 4,
      backgroundColor: colors.card,
      fontFamily: Platform.select({ ios: 'Menlo', android: 'monospace', default: 'monospace' }),
      fontSize: 12,
      lineHeight: 18,
      padding: 8,
    },
    componentList: {
      gap: 10,
    },
    nestedList: {
      gap: 8,
      paddingTop: 4,
    },
    nestedRow: {
      minHeight: 54,
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: 8,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
      borderRadius: 6,
      backgroundColor: colors.card,
      padding: 8,
    },
    componentRow: {
      minHeight: 92,
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: 10,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
      borderRadius: 6,
      backgroundColor: colors.surface,
      padding: 10,
    },
    componentRowActions: {
      width: 38,
      gap: 7,
    },
    iconAction: {
      width: 34,
      height: 32,
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
      borderRadius: 4,
      backgroundColor: colors.card,
    },
    iconActionDanger: {
      borderColor: `${colors.destructive}66`,
      backgroundColor: `${colors.destructive}14`,
    },
    helperText: {
      color: colors.mutedForeground,
      fontSize: 13,
      lineHeight: 18,
    },
    disabled: {
      opacity: 0.5,
    },
    footer: {
      flexDirection: 'row',
      gap: 10,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
      backgroundColor: colors.background,
      padding: 12,
    },
  });
}
