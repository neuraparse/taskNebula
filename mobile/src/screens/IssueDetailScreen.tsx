import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { Alert, Linking } from 'react-native';
import { errorCodes, isErrorWithCode, pick } from '@react-native-documents/picker';
import {
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  Text,
  View,
  StyleSheet,
  type ListRenderItem,
} from '@/components/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import {
  Boxes,
  Calendar,
  Check,
  CheckCircle2,
  Clock,
  CircleDot,
  ExternalLink,
  Eye,
  EyeOff,
  File,
  FileText,
  Flag,
  GitBranch,
  History,
  Link2,
  MessageSquare,
  Milestone,
  Pencil,
  Play,
  Plus,
  Send,
  SlidersHorizontal,
  SmilePlus,
  Sparkles,
  Square,
  Tag,
  Timer,
  Trash2,
  Unlink2,
  Upload,
  User,
  Workflow,
  X,
  Zap,
  type LucideIcon,
} from 'lucide-react-native';
import { useTranslation } from 'react-i18next';

import {
  Avatar,
  Button,
  ErrorView,
  Loading,
  Screen,
  SemanticBadge,
  TextField,
} from '@/components/ui';
import {
  AssigneeOption,
  ComponentOption,
  LabelOption,
  SelectedComponentChip,
  SelectedLabelChip,
  SelectedVersionChip,
  VersionOption,
} from '@/components/issue-metadata-pickers';
import {
  useAddComment,
  useAddIssueWatcher,
  useAiCapability,
  useApplyIssueTriage,
  useAttachIssueDocument,
  useComments,
  useCreateSubIssue,
  useCustomFields,
  useDeleteComment,
  useDeleteIssueAttachment,
  useDeleteIssue,
  useDetachIssueDocument,
  useDispatchIssueAgent,
  useIssue,
  useIssueAgentSessions,
  useIssueActivities,
  useIssueAttachments,
  useIssueComponents,
  useIssueDocuments,
  useIssueLinks,
  useIssueSubtasks,
  useIssueCustomFieldValues,
  useIssueTimeEntries,
  useIssueTimeInStatus,
  useIssueTriage,
  useIssueVersions,
  useIssueWatchers,
  useIssues,
  useLabels,
  useMe,
  useProject,
  useProjectComponents,
  useProjectIssues,
  useProjectMembers,
  useProjectWorkflowStatuses,
  useProjectVersions,
  useSprints,
  useSearchDocumentPages,
  useRemoveIssueWatcher,
  useCreateIssueLink,
  useLogIssueTimeEntry,
  useSetIssueComponents,
  useSetIssueCustomFieldValue,
  useSetIssueVersions,
  useRunIssueTriage,
  useRunIssueAssist,
  useSuggestIssueEstimate,
  useStartIssueTimer,
  useStopIssueTimer,
  useDeleteIssueLink,
  useToggleCommentReaction,
  useUploadIssueAttachment,
  useUpdateComment,
  useUpdateIssue,
  useUpdateSubIssueStatus,
} from '@/hooks/queries';
import type {
  Comment,
  CommentReaction,
  CustomField,
  AiEstimateSuggestion,
  AgentSessionProvider,
  AgentSessionState,
  DocumentPageSummary,
  Issue,
  IssueAgentSession,
  IssueActivity,
  IssueAttachment,
  IssueCustomFieldValue,
  IssueDocument,
  IssueLink,
  IssueLinkDirection,
  IssueLinkType,
  IssuePriority,
  IssueAssistAction,
  IssueAssistResult,
  IssueTriageSuggestion,
  Label,
  ProjectComponent,
  ProjectMember,
  ProjectVersion,
  IssueResolution,
  Sprint,
  Watcher,
  WorkflowStatus,
} from '@/api/types';
import type { AppStackParamList } from '@/navigation/types';
import { initials, relativeTime } from '@/lib/format';
import { useSession } from '@/stores/session';
import type { ThemeColors } from '@/design/theme';
import { useThemeColors } from '@/design/theme-context';
import { getBaseUrl } from '@/api/client';

const PRIORITY_HEX: Record<NonNullable<Issue['priority']>, string> = {
  none: '#9ca3af',
  low: '#9ca3af',
  medium: '#f59e0b',
  high: '#f97316',
  critical: '#ef4444',
};

const ISSUE_TONE: Record<Issue['type'], 'violet' | 'emerald' | 'blue' | 'rose' | 'cyan'> = {
  epic: 'violet',
  story: 'emerald',
  task: 'blue',
  bug: 'rose',
  subtask: 'cyan',
};

const PRIORITIES = [
  'critical',
  'high',
  'medium',
  'low',
  'none',
] as const satisfies readonly IssuePriority[];
const STATUS_CATEGORIES = ['backlog', 'todo', 'in_progress', 'in_review', 'done'] as const;
const ISSUE_ASSIST_ACTIONS: {
  key: IssueAssistAction;
  icon: LucideIcon;
  labelKey: string;
  hintKey: string;
}[] = [
  {
    key: 'summarize',
    icon: FileText,
    labelKey: 'issueAssist.summarize',
    hintKey: 'issueAssist.summarizeHint',
  },
  {
    key: 'rewrite',
    icon: Pencil,
    labelKey: 'issueAssist.rewrite',
    hintKey: 'issueAssist.rewriteHint',
  },
  {
    key: 'suggest_next',
    icon: Workflow,
    labelKey: 'issueAssist.suggestNext',
    hintKey: 'issueAssist.suggestNextHint',
  },
  {
    key: 'suggest_labels',
    icon: Tag,
    labelKey: 'issueAssist.suggestLabels',
    hintKey: 'issueAssist.suggestLabelsHint',
  },
];
const AGENT_SESSION_PROVIDERS = [
  'codex',
  'claude',
  'cursor',
  'devin',
  'copilot',
  'openhands',
  'custom',
] as const satisfies readonly AgentSessionProvider[];
const RESOLUTION_VALUES = [
  'fixed',
  'wont_do',
  'duplicate',
  'cannot_reproduce',
  'done',
] as const satisfies readonly IssueResolution[];
const ISSUE_LINK_TYPES = [
  'blocks',
  'blocked_by',
  'relates_to',
  'duplicates',
  'duplicated_by',
] as const satisfies readonly IssueLinkType[];
const KNOWN_SPRINT_STATUSES = ['planned', 'active', 'completed', 'cancelled'] as const;
const COMMENT_REACTION_EMOJIS = ['👍', '👎', '🎉', '❤️', '😄', '😕', '🚀', '👀'] as const;
const MAX_ATTACHMENT_SIZE_BYTES = 10 * 1024 * 1024;

type KnownSprintStatus = (typeof KNOWN_SPRINT_STATUSES)[number];
type KnownIssueResolution = (typeof RESOLUTION_VALUES)[number];
type EditableIssueLinkType = (typeof ISSUE_LINK_TYPES)[number];
type KnownStatusCategory = (typeof STATUS_CATEGORIES)[number];
type IssueDetailStyles = ReturnType<typeof createIssueDetailStyles>;

interface CommentReactionGroup {
  emoji: string;
  count: number;
  reactedByMe: boolean;
}

function useIssueDetailTheme(): { colors: ThemeColors; styles: IssueDetailStyles } {
  const colors = useThemeColors();
  const styles = useMemo(() => createIssueDetailStyles(colors), [colors]);
  return { colors, styles };
}

function isKnownStatusCategory(value: string): value is KnownStatusCategory {
  return STATUS_CATEGORIES.includes(value as KnownStatusCategory);
}

function isKnownSprintStatus(status: Sprint['status']): status is KnownSprintStatus {
  return KNOWN_SPRINT_STATUSES.includes(status as KnownSprintStatus);
}

function groupCommentReactions(
  reactions: CommentReaction[] | undefined,
  currentUserId: string | null,
): CommentReactionGroup[] {
  const groups = new Map<string, CommentReactionGroup>();
  for (const reaction of reactions ?? []) {
    const group = groups.get(reaction.emoji) ?? {
      emoji: reaction.emoji,
      count: 0,
      reactedByMe: false,
    };
    group.count += 1;
    if (currentUserId && reaction.userId === currentUserId) {
      group.reactedByMe = true;
    }
    groups.set(reaction.emoji, group);
  }
  return Array.from(groups.values());
}

function projectMemberMentionId(member: ProjectMember): string {
  return member.userId || member.user.id;
}

function projectMemberName(member: ProjectMember): string {
  return member.user.name ?? member.user.email;
}

function mentionToken(name: string): string {
  return `@${name}`;
}

function mentionedMembers(
  mentionIds: string[] | undefined,
  members: ProjectMember[],
): ProjectMember[] {
  if (!mentionIds || mentionIds.length === 0) return [];
  const seen = new Set<string>();
  const result: ProjectMember[] = [];
  for (const mentionId of mentionIds) {
    if (seen.has(mentionId)) continue;
    const member = members.find(
      (candidate) =>
        candidate.userId === mentionId ||
        candidate.user.id === mentionId ||
        candidate.id === mentionId,
    );
    if (member) {
      seen.add(mentionId);
      result.push(member);
    }
  }
  return result;
}

function appendMentionText(value: string, member: ProjectMember): string {
  const token = mentionToken(projectMemberName(member));
  if (value.includes(token)) return value;
  const prefix = value.trimEnd();
  return `${prefix}${prefix ? ' ' : ''}${token} `;
}

function sprintTone(status: Sprint['status']): 'blue' | 'emerald' | 'neutral' | 'rose' {
  if (status === 'active') return 'emerald';
  if (status === 'completed') return 'neutral';
  if (status === 'cancelled') return 'rose';
  return 'blue';
}

function formatSprintDate(value: string | null | undefined, language: string): string {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleDateString(language, { day: 'numeric', month: 'short' });
}

function sprintDateRange(sprint: Sprint, language: string): string {
  const start = formatSprintDate(sprint.startDate, language);
  const end = formatSprintDate(sprint.endDate, language);
  if (start && end) return `${start} - ${end}`;
  return start || end;
}

function normalizeResolution(
  value: IssueResolution | null | undefined,
): KnownIssueResolution | null {
  return RESOLUTION_VALUES.includes(value as KnownIssueResolution)
    ? (value as KnownIssueResolution)
    : null;
}

function resolutionLabel(
  value: IssueResolution | null | undefined,
  t: ReturnType<typeof useTranslation>['t'],
): string {
  const resolution = normalizeResolution(value);
  return resolution
    ? t(`issueSidebar.resolution.values.${resolution}`)
    : t('issueSidebar.resolution.unresolved');
}

function statusCategoryLabel(
  category: WorkflowStatus['category'],
  t: ReturnType<typeof useTranslation>['t'],
): string {
  return isKnownStatusCategory(category) ? t(`statusCategory.${category}`) : category;
}

function issueLinkTypeLabel(
  type: IssueLinkType,
  direction: IssueLinkDirection,
  t: ReturnType<typeof useTranslation>['t'],
): string {
  if (direction === 'inbound') {
    if (type === 'blocks') return t('issueLinks.type.blockedBy');
    if (type === 'blocked_by') return t('issueLinks.type.blocks');
    if (type === 'duplicates') return t('issueLinks.type.duplicatedBy');
    if (type === 'duplicated_by') return t('issueLinks.type.duplicates');
    if (type === 'parent_of') return t('issueLinks.type.childOf');
    if (type === 'child_of') return t('issueLinks.type.parentOf');
  }
  if (type === 'blocks') return t('issueLinks.type.blocks');
  if (type === 'blocked_by') return t('issueLinks.type.blockedBy');
  if (type === 'relates_to') return t('issueLinks.type.relatesTo');
  if (type === 'duplicates') return t('issueLinks.type.duplicates');
  if (type === 'duplicated_by') return t('issueLinks.type.duplicatedBy');
  if (type === 'parent_of') return t('issueLinks.type.parentOf');
  if (type === 'child_of') return t('issueLinks.type.childOf');
  return type;
}

function priorityDisplayLabel(
  value: string | null | undefined,
  t: ReturnType<typeof useTranslation>['t'],
): string {
  return PRIORITIES.includes(value as IssuePriority)
    ? t(`priority.${value}`)
    : (value ?? t('common.none'));
}

function parseDateInput(value: string): Date | null {
  const trimmed = value.trim();
  if (!trimmed) return null;
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(trimmed);
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(year, month - 1, day);
  if (date.getFullYear() !== year || date.getMonth() !== month - 1 || date.getDate() !== day) {
    return null;
  }
  return date;
}

function dateToInputValue(value: string | null | undefined): string {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${date.getFullYear()}-${month}-${day}`;
}

function dueDateInputToIso(value: string): string | null {
  const parsed = parseDateInput(value);
  if (!parsed) return null;
  return new Date(
    Date.UTC(parsed.getFullYear(), parsed.getMonth(), parsed.getDate(), 12),
  ).toISOString();
}

function issueCustomFieldString(
  customFields: Issue['customFields'] | null | undefined,
  key: 'environment' | 'startDate',
): string | null {
  const value = customFields?.[key];
  return typeof value === 'string' ? value : null;
}

function mergeIssueCustomField(
  customFields: Issue['customFields'] | null | undefined,
  key: 'environment' | 'startDate',
  value: string | null,
): Record<string, unknown> {
  const next =
    customFields && typeof customFields === 'object' && !Array.isArray(customFields)
      ? { ...customFields }
      : {};
  if (value === null) {
    delete next[key];
  } else {
    next[key] = value;
  }
  return next;
}

function parseStoryPointsInput(value: string): number | null {
  const trimmed = value.trim();
  if (!trimmed) return null;
  if (!/^\d+$/.test(trimmed)) return Number.NaN;
  return Number(trimmed);
}

function parseDurationInput(value: string): number | null {
  const trimmed = value.trim().toLowerCase();
  if (!trimmed || /[+-]/.test(trimmed)) return null;
  if (/^\d+(?:\.\d+)?$/.test(trimmed)) {
    const minutes = Number(trimmed);
    return Number.isFinite(minutes) && minutes > 0 ? Math.round(minutes * 60) : null;
  }
  const compact = trimmed.replace(/\s+/g, '');
  let seconds = 0;
  let matched = false;
  let consumed = 0;
  const pattern = /(\d+(?:\.\d+)?)(h(?:ours?|rs?)?|m(?:in(?:utes?)?)?|s(?:ec(?:onds?)?)?)/gi;
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(compact)) !== null) {
    if (match.index !== consumed) return null;
    const amount = Number(match[1]);
    if (!Number.isFinite(amount) || amount <= 0) return null;
    const unit = match[2]?.[0]?.toLowerCase();
    if (unit === 'h') seconds += amount * 3600;
    else if (unit === 'm') seconds += amount * 60;
    else if (unit === 's') seconds += amount;
    matched = true;
    consumed = match.index + match[0].length;
  }
  if (!matched || consumed !== compact.length || seconds <= 0) return null;
  return Math.round(seconds);
}

function formatDurationSeconds(totalSeconds: number): string {
  if (!Number.isFinite(totalSeconds) || totalSeconds <= 0) return '0m';
  const total = Math.floor(totalSeconds);
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const seconds = total % 60;
  if (hours > 0 && minutes > 0) return `${hours}h ${minutes}m`;
  if (hours > 0) return `${hours}h`;
  if (minutes > 0) return `${minutes}m`;
  return `${seconds}s`;
}

function formatHours(value: number): string {
  return String(Number(value.toFixed(2)));
}

function formatAttachmentSize(bytes: number, t: ReturnType<typeof useTranslation>['t']): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return t('issueAttachments.sizeBytes', { count: 0 });
  if (bytes < 1024) return t('issueAttachments.sizeBytes', { count: bytes });
  const units = [
    t('issueAttachments.sizeKb'),
    t('issueAttachments.sizeMb'),
    t('issueAttachments.sizeGb'),
  ];
  let value = bytes / 1024;
  let unitIndex = 0;
  while (value >= 1024 && unitIndex < units.length - 1) {
    value /= 1024;
    unitIndex += 1;
  }
  return t('issueAttachments.sizeValue', {
    value: Number(value.toFixed(1)),
    unit: units[unitIndex],
  });
}

function parseEstimateInput(value: string): number | null {
  const trimmed = value.trim();
  if (!trimmed) return null;
  const estimate = Number(trimmed.replace(',', '.'));
  if (!Number.isFinite(estimate) || estimate < 0) return Number.NaN;
  return estimate;
}

function formatEstimateValue(value: number | null | undefined): string {
  if (value === null || value === undefined) return '';
  return Number.isInteger(value) ? String(value) : String(value);
}

function sameStringSet(left: string[], right: string[]): boolean {
  if (left.length !== right.length) return false;
  const sortedLeft = [...left].sort();
  const sortedRight = [...right].sort();
  return sortedLeft.every((value, index) => value === sortedRight[index]);
}

function collectExcludedParentIds(
  issues: ReadonlyArray<Pick<Issue, 'id' | 'parentId'>>,
  issueId: string,
): Set<string> {
  const excluded = new Set<string>([issueId]);
  let changed = true;

  while (changed) {
    changed = false;
    for (const candidate of issues) {
      if (candidate.parentId && excluded.has(candidate.parentId) && !excluded.has(candidate.id)) {
        excluded.add(candidate.id);
        changed = true;
      }
    }
  }

  return excluded;
}

type CustomFieldDrafts = Record<string, string>;
type IssueCustomFieldItem = {
  field: CustomField;
  value: string | null;
};

const EDITABLE_CUSTOM_FIELD_TYPES = new Set([
  'text',
  'number',
  'date',
  'select',
  'multi_select',
  'checkbox',
  'url',
  'email',
]);

function isEditableCustomField(field: CustomField): boolean {
  return EDITABLE_CUSTOM_FIELD_TYPES.has(field.type);
}

function customFieldOptions(field: CustomField): string[] {
  if (!field.options) return [];
  try {
    const parsed = JSON.parse(field.options) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((option): option is string => typeof option === 'string' && !!option);
  } catch {
    return [];
  }
}

function customFieldDraftsFromValues(
  fields: CustomField[],
  values: IssueCustomFieldValue[],
): CustomFieldDrafts {
  const valueByFieldId = new Map(values.map((value) => [value.customFieldId, value.value]));
  return Object.fromEntries(fields.map((field) => [field.id, valueByFieldId.get(field.id) ?? '']));
}

function customFieldItemsFromData(
  fields: CustomField[],
  values: IssueCustomFieldValue[],
): IssueCustomFieldItem[] {
  const byId = new Map<string, CustomField>();
  for (const field of fields) byId.set(field.id, field);
  for (const value of values) byId.set(value.customFieldId, value.field);

  const valueByFieldId = new Map(values.map((value) => [value.customFieldId, value.value]));
  return Array.from(byId.values())
    .sort((left, right) => {
      const leftPosition = left.position ?? Number.MAX_SAFE_INTEGER;
      const rightPosition = right.position ?? Number.MAX_SAFE_INTEGER;
      if (leftPosition !== rightPosition) return leftPosition - rightPosition;
      return left.name.localeCompare(right.name);
    })
    .map((field) => ({
      field,
      value: valueByFieldId.get(field.id) ?? null,
    }));
}

function splitMultiSelectValue(value: string): string[] {
  return value
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
}

function toggleMultiSelectValue(value: string, option: string): string {
  const selected = splitMultiSelectValue(value);
  const next = selected.includes(option)
    ? selected.filter((item) => item !== option)
    : [...selected, option];
  return next.join(', ');
}

function normalizeCustomFieldDraft(field: CustomField, draft: string): string | null {
  const trimmed = draft.trim();
  if (!trimmed) return null;
  if (field.type === 'number') return trimmed.replace(',', '.');
  return trimmed;
}

function customFieldValidationError(
  field: CustomField,
  draft: string,
  t: ReturnType<typeof useTranslation>['t'],
): string | null {
  const normalized = normalizeCustomFieldDraft(field, draft);
  if (!normalized) {
    return field.isRequired ? t('issueCustomFields.requiredValue', { name: field.name }) : null;
  }
  if (field.type === 'number' && !Number.isFinite(Number(normalized))) {
    return t('issueCustomFields.invalidNumber', { name: field.name });
  }
  if (field.type === 'date' && !parseDateInput(normalized)) {
    return t('issueCustomFields.invalidDate', { name: field.name });
  }
  return null;
}

function formatCustomFieldValue(
  field: CustomField,
  value: string | null,
  t: ReturnType<typeof useTranslation>['t'],
): string {
  if (!value) return t('common.none');
  if (field.type === 'checkbox') {
    return value === 'true'
      ? t('issueCustomFields.booleanTrue')
      : t('issueCustomFields.booleanFalse');
  }
  if (field.type === 'multi_select') {
    const selected = splitMultiSelectValue(value);
    return selected.length > 0 ? selected.join(', ') : t('common.none');
  }
  return value;
}

function userDisplayName(user: Issue['assignee'] | Issue['reporter']): string | null {
  if (!user) return null;
  return user.name ?? user.email;
}

function DetailRow({
  icon: Icon,
  label,
  children,
}: {
  icon: LucideIcon;
  label: string;
  children: ReactNode;
}) {
  const { colors, styles } = useIssueDetailTheme();

  return (
    <View style={styles.detailRow}>
      <View style={styles.detailLabel}>
        <Icon size={15} color={colors.mutedForeground} />
        <Text style={styles.detailLabelText}>{label}</Text>
      </View>
      <View style={styles.detailValue}>{children}</View>
    </View>
  );
}

function PersonValue({
  user,
  fallback,
}: {
  user: Issue['assignee'] | Issue['reporter'];
  fallback: string;
}) {
  const { styles } = useIssueDetailTheme();
  const displayName = userDisplayName(user);

  if (!user || !displayName) {
    return <Text style={styles.mutedValue}>{fallback}</Text>;
  }

  return (
    <View style={styles.personValue}>
      <Avatar initials={initials(user.name, user.email)} size={22} />
      <Text className="text-foreground text-sm" numberOfLines={1} style={styles.personName}>
        {displayName}
      </Text>
    </View>
  );
}

function IssueReferenceValue({
  issue,
  issueId,
  loading,
  fallback,
  loadingLabel,
  unavailableLabel,
  onOpenIssue,
}: {
  issue: Issue | null;
  issueId: string | null | undefined;
  loading: boolean;
  fallback: string;
  loadingLabel: string;
  unavailableLabel: string;
  onOpenIssue: (issueId: string) => void;
}) {
  const { styles } = useIssueDetailTheme();

  if (!issueId) {
    return <Text style={styles.mutedValue}>{fallback}</Text>;
  }

  if (!issue) {
    return <Text style={styles.mutedValue}>{loading ? loadingLabel : unavailableLabel}</Text>;
  }

  return (
    <Pressable
      accessibilityRole="button"
      onPress={() => onOpenIssue(issue.id)}
      style={styles.parentDetailLink}
      className="active:opacity-80"
    >
      {issue.key ? (
        <Text style={styles.parentDetailKey} numberOfLines={1}>
          {issue.key}
        </Text>
      ) : null}
      <Text style={styles.parentDetailTitle} numberOfLines={2}>
        {issue.title}
      </Text>
    </Pressable>
  );
}

function ParentIssuePicker({
  candidates,
  selectedId,
  loading,
  disabled,
  onChange,
}: {
  candidates: Issue[];
  selectedId: string;
  loading: boolean;
  disabled: boolean;
  onChange: (parentId: string) => void;
}) {
  const { t } = useTranslation();
  const { colors, styles } = useIssueDetailTheme();
  const [search, setSearch] = useState('');
  const visibleCandidates = useMemo(() => {
    const query = search.trim().toLocaleLowerCase();
    const filtered = query
      ? candidates.filter((candidate) => {
          const key = candidate.key?.toLocaleLowerCase() ?? '';
          const title = candidate.title.toLocaleLowerCase();
          return key.includes(query) || title.includes(query);
        })
      : candidates;
    return filtered.slice(0, 8);
  }, [candidates, search]);
  const empty = !loading && candidates.length === 0;
  const noResults = !loading && candidates.length > 0 && visibleCandidates.length === 0;

  return (
    <View style={styles.editorSection}>
      <SectionTitle icon={GitBranch} title={t('issueParent.title')} />
      <TextField
        value={search}
        onChangeText={setSearch}
        placeholder={t('issueParent.searchPlaceholder')}
        editable={!disabled}
        autoCapitalize="none"
      />
      <View style={styles.parentChoiceList}>
        <ChoiceButton
          label={t('issueParent.none')}
          value=""
          selected={!selectedId}
          disabled={disabled}
          onPress={onChange}
        />
        {visibleCandidates.map((candidate) => {
          const selected = selectedId === candidate.id;
          return (
            <Pressable
              key={candidate.id}
              accessibilityRole="button"
              accessibilityState={{ selected, disabled }}
              disabled={disabled}
              onPress={() => onChange(candidate.id)}
              style={[
                styles.parentChoice,
                selected ? styles.parentChoiceActive : null,
                disabled ? styles.choiceButtonDisabled : null,
              ]}
              className="active:opacity-80"
            >
              <View style={styles.parentChoiceBody}>
                <View style={styles.parentChoiceTitleRow}>
                  {candidate.key ? (
                    <Text style={styles.parentChoiceKey} numberOfLines={1}>
                      {candidate.key}
                    </Text>
                  ) : null}
                  <Text style={styles.parentChoiceTitle} numberOfLines={1}>
                    {candidate.title}
                  </Text>
                </View>
                {candidate.status?.name ? (
                  <Text style={styles.parentChoiceMeta} numberOfLines={1}>
                    {candidate.status.name}
                  </Text>
                ) : null}
              </View>
              {selected ? <Check size={15} color={colors.primary} /> : null}
            </Pressable>
          );
        })}
      </View>
      {loading ? <Text style={styles.helperText}>{t('common.loading')}</Text> : null}
      {empty ? <Text style={styles.helperText}>{t('issueParent.empty')}</Text> : null}
      {noResults ? <Text style={styles.helperText}>{t('issueParent.noResults')}</Text> : null}
    </View>
  );
}

function EpicIssuePicker({
  candidates,
  selectedId,
  loading,
  disabled,
  onChange,
}: {
  candidates: Issue[];
  selectedId: string;
  loading: boolean;
  disabled: boolean;
  onChange: (epicId: string) => void;
}) {
  const { t } = useTranslation();
  const { colors, styles } = useIssueDetailTheme();
  const [search, setSearch] = useState('');
  const visibleCandidates = useMemo(() => {
    const query = search.trim().toLocaleLowerCase();
    const filtered = query
      ? candidates.filter((candidate) => {
          const key = candidate.key?.toLocaleLowerCase() ?? '';
          const title = candidate.title.toLocaleLowerCase();
          return key.includes(query) || title.includes(query);
        })
      : candidates;
    return filtered.slice(0, 8);
  }, [candidates, search]);
  const empty = !loading && candidates.length === 0;
  const noResults = !loading && candidates.length > 0 && visibleCandidates.length === 0;

  return (
    <View style={styles.editorSection}>
      <SectionTitle icon={Zap} title={t('issueEpic.title')} />
      <TextField
        value={search}
        onChangeText={setSearch}
        placeholder={t('issueEpic.searchPlaceholder')}
        editable={!disabled}
        autoCapitalize="none"
      />
      <View style={styles.parentChoiceList}>
        <ChoiceButton
          label={t('issueEpic.none')}
          value=""
          selected={!selectedId}
          disabled={disabled}
          onPress={onChange}
        />
        {visibleCandidates.map((candidate) => {
          const selected = selectedId === candidate.id;
          return (
            <Pressable
              key={candidate.id}
              accessibilityRole="button"
              accessibilityState={{ selected, disabled }}
              disabled={disabled}
              onPress={() => onChange(candidate.id)}
              style={[
                styles.parentChoice,
                selected ? styles.parentChoiceActive : null,
                disabled ? styles.choiceButtonDisabled : null,
              ]}
              className="active:opacity-80"
            >
              <Zap size={15} color={colors.primary} />
              <View style={styles.parentChoiceBody}>
                <View style={styles.parentChoiceTitleRow}>
                  {candidate.key ? (
                    <Text style={styles.parentChoiceKey} numberOfLines={1}>
                      {candidate.key}
                    </Text>
                  ) : null}
                  <Text style={styles.parentChoiceTitle} numberOfLines={1}>
                    {candidate.title}
                  </Text>
                </View>
                {candidate.status?.name ? (
                  <Text style={styles.parentChoiceMeta} numberOfLines={1}>
                    {candidate.status.name}
                  </Text>
                ) : null}
              </View>
              {selected ? <Check size={15} color={colors.primary} /> : null}
            </Pressable>
          );
        })}
      </View>
      {loading ? <Text style={styles.helperText}>{t('common.loading')}</Text> : null}
      {empty ? <Text style={styles.helperText}>{t('issueEpic.empty')}</Text> : null}
      {noResults ? <Text style={styles.helperText}>{t('issueEpic.noResults')}</Text> : null}
    </View>
  );
}

function IssueLabelChips({ labels, fallback }: { labels: string[]; fallback: string }) {
  const { styles } = useIssueDetailTheme();

  if (labels.length === 0) {
    return <Text style={styles.mutedValue}>{fallback}</Text>;
  }

  return (
    <View style={styles.labelList}>
      {labels.map((label) => (
        <View key={label} style={styles.labelChip}>
          <Text style={styles.labelText} numberOfLines={1}>
            {label}
          </Text>
        </View>
      ))}
    </View>
  );
}

function IssueComponentChips({
  components,
  fallback,
}: {
  components: ProjectComponent[];
  fallback: string;
}) {
  const { styles } = useIssueDetailTheme();

  if (components.length === 0) {
    return <Text style={styles.mutedValue}>{fallback}</Text>;
  }

  return (
    <View style={styles.labelList}>
      {components.map((component) => (
        <View key={component.id} style={styles.labelChip}>
          <Text style={styles.labelText} numberOfLines={1}>
            {component.name}
          </Text>
        </View>
      ))}
    </View>
  );
}

function IssueVersionChips({
  versions,
  fallback,
}: {
  versions: ProjectVersion[];
  fallback: string;
}) {
  const { styles } = useIssueDetailTheme();

  if (versions.length === 0) {
    return <Text style={styles.mutedValue}>{fallback}</Text>;
  }

  return (
    <View style={styles.labelList}>
      {versions.map((version) => (
        <View key={version.id} style={styles.labelChip}>
          <Text style={styles.labelText} numberOfLines={1}>
            {version.name}
          </Text>
        </View>
      ))}
    </View>
  );
}

function watcherName(watcher: Watcher, fallback: string): string {
  return watcher.user?.name ?? watcher.user?.email ?? fallback;
}

function WatchersPanel({
  error,
  loading,
  mutating,
  watching,
  watchError,
  watchers,
  onToggleWatch,
}: {
  error: boolean;
  loading: boolean;
  mutating: boolean;
  watching: boolean;
  watchError: string | null | undefined;
  watchers: Watcher[];
  onToggleWatch: () => void;
}) {
  const { t } = useTranslation();
  const { colors, styles } = useIssueDetailTheme();
  const visibleWatchers = watchers.slice(0, 4);
  const fallback = t('common.none');

  return (
    <View style={styles.watchPanel}>
      <View style={styles.watchHeader}>
        <SectionTitle icon={Eye} title={t('issue.watchers')} />
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={watching ? t('issue.stopWatching') : t('issue.watch')}
          disabled={mutating}
          onPress={onToggleWatch}
          style={[
            styles.inlineAction,
            watching ? styles.inlineActionPrimary : null,
            mutating ? styles.inlineActionDisabled : null,
          ]}
          className="active:opacity-80"
        >
          {watching ? (
            <EyeOff size={14} color={colors.primary} />
          ) : (
            <Eye size={14} color={colors.foreground} />
          )}
          <Text style={[styles.inlineActionText, watching ? styles.inlineActionPrimaryText : null]}>
            {watching ? t('issue.unwatch') : t('issue.watch')}
          </Text>
        </Pressable>
      </View>

      {loading ? <Text style={styles.helperText}>{t('common.loading')}</Text> : null}
      {!loading && error ? (
        <Text style={styles.commentError}>{t('issue.watchersLoadFailed')}</Text>
      ) : null}
      {!loading && !error && watchers.length === 0 ? (
        <Text style={styles.helperText}>{t('issue.noOneWatching')}</Text>
      ) : null}
      {!loading && !error && watchers.length > 0 ? (
        <View style={styles.watcherSummary}>
          <View style={styles.watcherAvatars}>
            {visibleWatchers.map((watcher) => (
              <Avatar
                key={watcher.id}
                initials={initials(watcher.user?.name, watcher.user?.email)}
                size={24}
              />
            ))}
          </View>
          <Text style={styles.watcherCount}>
            {t('issue.watchingCount', { count: watchers.length })}
          </Text>
        </View>
      ) : null}
      {!loading && !error && visibleWatchers.length > 0 ? (
        <View style={styles.watcherChips}>
          {visibleWatchers.map((watcher) => (
            <View key={watcher.id} style={styles.watcherChip}>
              <Text style={styles.watcherChipText} numberOfLines={1}>
                {watcherName(watcher, fallback)}
              </Text>
            </View>
          ))}
        </View>
      ) : null}
      {watchError ? <Text style={styles.commentError}>{watchError}</Text> : null}
    </View>
  );
}

function latestPendingTriageSuggestion(
  suggestions: IssueTriageSuggestion[] | undefined,
): IssueTriageSuggestion | null {
  return (
    suggestions?.find((suggestion) => !suggestion.appliedAt && !suggestion.dismissedAt) ?? null
  );
}

type LocalAgentRunPayload = {
  command?: string;
  status?: string;
  exitCode?: number | null;
};

function readLocalAgentRun(payload: Record<string, unknown>): LocalAgentRunPayload | null {
  if (!payload.localRun || typeof payload.localRun !== 'object') return null;
  const localRun = payload.localRun as Record<string, unknown>;
  const result: LocalAgentRunPayload = {
    exitCode: typeof localRun.exitCode === 'number' ? localRun.exitCode : null,
  };
  if (typeof localRun.command === 'string') result.command = localRun.command;
  if (typeof localRun.status === 'string') result.status = localRun.status;
  return result;
}

function agentStateTone(
  state: AgentSessionState,
): 'emerald' | 'amber' | 'rose' | 'blue' | 'neutral' {
  if (state === 'complete') return 'emerald';
  if (state === 'awaitingInput') return 'amber';
  if (state === 'error' || state === 'stale') return 'rose';
  if (state === 'active') return 'blue';
  return 'neutral';
}

function isAgentSessionProvider(value: unknown): value is AgentSessionProvider {
  return AGENT_SESSION_PROVIDERS.includes(value as AgentSessionProvider);
}

function IssueTriagePanel({
  issueId,
  organizationId,
}: {
  issueId: string;
  organizationId: string | null;
}) {
  const { t } = useTranslation();
  const { styles } = useIssueDetailTheme();
  const capabilityQ = useAiCapability(organizationId, !!organizationId);
  const canRunAgents = capabilityQ.data?.canRunAgents === true;
  const triageQ = useIssueTriage(issueId, canRunAgents);
  const runTriage = useRunIssueTriage(issueId);
  const applyTriage = useApplyIssueTriage(issueId);
  const latest = latestPendingTriageSuggestion(triageQ.data?.suggestions);
  const busy = runTriage.isPending || applyTriage.isPending;
  const error =
    triageQ.isError || runTriage.isError || applyTriage.isError
      ? triageQ.isError
        ? t('issueTriage.loadFailed')
        : runTriage.isError
          ? t('issueTriage.runFailed')
          : t('issueTriage.applyFailed')
      : null;

  if (!canRunAgents) return null;

  const labels = latest?.payload.labels ?? [];

  return (
    <View style={styles.triagePanel}>
      <View style={styles.triageHeader}>
        <View style={styles.triageHeaderText}>
          <SectionTitle icon={Zap} title={t('issueTriage.title')} />
          <Text style={styles.helperText}>{t('issueTriage.description')}</Text>
        </View>
        <SemanticBadge label={t('issueTriage.badge')} tone="violet" />
      </View>

      {triageQ.isLoading ? <Text style={styles.helperText}>{t('issueTriage.loading')}</Text> : null}

      {!triageQ.isLoading && !latest ? (
        <Text style={styles.helperText}>{t('issueTriage.empty')}</Text>
      ) : null}

      {latest ? (
        <View style={styles.triageSuggestion}>
          <View style={styles.triageSuggestionMeta}>
            <SemanticBadge
              label={t('issueTriage.confidence', { value: latest.confidence })}
              tone="cyan"
            />
            {latest.payload.priority ? (
              <SemanticBadge
                label={t('issueTriage.priorityValue', { value: latest.payload.priority })}
                tone="amber"
              />
            ) : null}
          </View>
          {labels.length > 0 ? (
            <View style={styles.triageLabels}>
              {labels.map((label) => (
                <SemanticBadge key={label} label={label} tone="neutral" />
              ))}
            </View>
          ) : null}
          {latest.payload.rationale ? (
            <Text style={styles.triageRationale}>{latest.payload.rationale}</Text>
          ) : null}
        </View>
      ) : null}

      {error ? <Text style={styles.commentError}>{error}</Text> : null}

      <View style={styles.triageActions}>
        <Button
          title={busy ? t('issueTriage.working') : t('issueTriage.runAgain')}
          variant="secondary"
          icon={Zap}
          loading={runTriage.isPending}
          disabled={busy}
          onPress={() => runTriage.mutate()}
        />
        {latest ? (
          <>
            <Button
              title={t('issueTriage.apply')}
              loading={applyTriage.isPending}
              disabled={busy}
              onPress={() => applyTriage.mutate({ suggestionId: latest.id })}
            />
            <Button
              title={t('issueTriage.applyOverride')}
              variant="ghost"
              disabled={busy}
              onPress={() => applyTriage.mutate({ suggestionId: latest.id, approved: true })}
            />
          </>
        ) : null}
      </View>
    </View>
  );
}

function IssueAssistPanel({
  issueId,
  organizationId,
  onApplyDescription,
  onApplyLabels,
}: {
  issueId: string;
  organizationId: string | null;
  onApplyDescription: (text: string) => void;
  onApplyLabels: (labels: string[]) => void;
}) {
  const { t } = useTranslation();
  const { colors, styles } = useIssueDetailTheme();
  const capabilityQ = useAiCapability(organizationId, !!organizationId);
  const canDraft = capabilityQ.data?.canDraft === true;
  const runAssist = useRunIssueAssist();
  const [activeAction, setActiveAction] = useState<IssueAssistAction | null>(null);
  const [result, setResult] = useState<{
    action: IssueAssistAction;
    output: IssueAssistResult;
  } | null>(null);

  if (!canDraft) return null;

  const runAction = (action: IssueAssistAction) => {
    setActiveAction(action);
    runAssist.mutate(
      { issueId, action },
      {
        onSuccess: (output) => setResult({ action, output }),
        onSettled: () => setActiveAction(null),
      },
    );
  };

  const labels = result?.output.labels ?? [];
  const canApplyDescription = result?.action === 'rewrite' && result.output.text.trim().length > 0;
  const canApplyLabels = result?.action === 'suggest_labels' && labels.length > 0;

  return (
    <View style={styles.assistPanel}>
      <View style={styles.triageHeader}>
        <View style={styles.triageHeaderText}>
          <SectionTitle icon={Zap} title={t('issueAssist.title')} />
          <Text style={styles.helperText}>{t('issueAssist.description')}</Text>
        </View>
        <SemanticBadge label={t('issueAssist.badge')} tone="violet" />
      </View>

      <View style={styles.assistActionGrid}>
        {ISSUE_ASSIST_ACTIONS.map(({ key, icon: Icon, labelKey, hintKey }) => {
          const loading = runAssist.isPending && activeAction === key;
          return (
            <Pressable
              key={key}
              accessibilityRole="button"
              disabled={runAssist.isPending}
              onPress={() => runAction(key)}
              style={[
                styles.assistAction,
                runAssist.isPending ? styles.inlineActionDisabled : null,
              ]}
              className="active:opacity-80"
            >
              <View style={styles.assistActionTitle}>
                <Icon size={14} color={colors.primary} />
                <Text style={styles.assistActionLabel}>
                  {loading ? t('issueAssist.working') : t(labelKey)}
                </Text>
              </View>
              <Text style={styles.assistActionHint}>{t(hintKey)}</Text>
            </Pressable>
          );
        })}
      </View>

      {runAssist.isError ? (
        <Text style={styles.commentError}>{t('issueAssist.runFailed')}</Text>
      ) : null}

      {result ? (
        <View style={styles.assistResult}>
          <View style={styles.triageSuggestionMeta}>
            <SemanticBadge label={t('issueAssist.result')} tone="cyan" />
            <SemanticBadge label={result.output.provider} tone="neutral" />
          </View>
          {labels.length > 0 ? (
            <View style={styles.triageLabels}>
              {labels.map((label) => (
                <SemanticBadge key={label} label={label} tone="neutral" />
              ))}
            </View>
          ) : (
            <Text style={styles.assistResultText}>{result.output.text}</Text>
          )}
          {canApplyDescription || canApplyLabels ? (
            <View style={styles.triageActions}>
              {canApplyDescription ? (
                <Button
                  title={t('issueAssist.applyDescription')}
                  variant="secondary"
                  onPress={() => onApplyDescription(result.output.text)}
                />
              ) : null}
              {canApplyLabels ? (
                <Button
                  title={t('issueAssist.applyLabels')}
                  variant="secondary"
                  onPress={() => onApplyLabels(labels)}
                />
              ) : null}
            </View>
          ) : null}
        </View>
      ) : null}
    </View>
  );
}

function IssueAgentPanel({ issue }: { issue: Issue }) {
  const { t } = useTranslation();
  const { styles } = useIssueDetailTheme();
  const assigneeAgentProvider = (issue.assignee as { agentProvider?: unknown } | null)
    ?.agentProvider;
  const [selectedProvider, setSelectedProvider] = useState<AgentSessionProvider>(
    isAgentSessionProvider(assigneeAgentProvider) ? assigneeAgentProvider : 'codex',
  );
  const [promptOverride, setPromptOverride] = useState('');
  const [agentError, setAgentError] = useState<string | null>(null);
  const sessionsQ = useIssueAgentSessions(issue.id);
  const dispatchAgent = useDispatchIssueAgent(issue.id);
  const sessions = sessionsQ.data?.sessions ?? [];
  const latestSession = sessions[0] ?? null;
  const latestLocalRun = latestSession ? readLocalAgentRun(latestSession.payload) : null;

  useEffect(() => {
    if (isAgentSessionProvider(assigneeAgentProvider)) {
      setSelectedProvider(assigneeAgentProvider);
    }
  }, [assigneeAgentProvider]);

  const runnerStatusLabel = (status: string) => {
    if (status === 'running') return t('issueAgent.runnerStatuses.running');
    if (status === 'completed') return t('issueAgent.runnerStatuses.completed');
    if (status === 'failed') return t('issueAgent.runnerStatuses.failed');
    return status;
  };

  const dispatch = async () => {
    setAgentError(null);
    const trimmedPrompt = promptOverride.trim();
    try {
      await dispatchAgent.mutateAsync({
        provider: selectedProvider,
        ...(trimmedPrompt ? { promptOverride: trimmedPrompt } : {}),
      });
      setPromptOverride('');
    } catch {
      setAgentError(t('issueAgent.dispatchFailed'));
    }
  };

  const renderSession = (session: IssueAgentSession) => {
    const localRun = readLocalAgentRun(session.payload);
    return (
      <View key={session.id} style={styles.agentSessionRow}>
        <View style={styles.agentSessionBody}>
          <View style={styles.agentSessionHeader}>
            <Text style={styles.agentSessionProvider} numberOfLines={1}>
              {t(`issueAgent.providers.${session.provider}`)}
            </Text>
            <SemanticBadge
              label={t(`issueAgent.states.${session.state}`)}
              tone={agentStateTone(session.state)}
            />
          </View>
          <Text style={styles.agentSessionMeta} numberOfLines={2}>
            {localRun?.command
              ? t('issueAgent.localRunner', { command: localRun.command })
              : t('issueAgent.webhookRunner')}
            {localRun?.status
              ? t('issueAgent.runnerStatusSuffix', {
                  status: runnerStatusLabel(localRun.status),
                })
              : ''}
          </Text>
        </View>
        <Text style={styles.agentSessionTime} numberOfLines={1}>
          {relativeTime(session.updatedAt || session.startedAt)}
        </Text>
      </View>
    );
  };

  return (
    <View style={styles.agentPanel}>
      <View style={styles.triageHeader}>
        <View style={styles.triageHeaderText}>
          <SectionTitle icon={Workflow} title={t('issueAgent.title')} />
          <Text style={styles.helperText}>{t('issueAgent.description')}</Text>
        </View>
        <SemanticBadge label={t('issueAgent.beta')} tone="blue" />
      </View>

      {latestSession ? (
        <View style={styles.agentLatest}>
          <View style={styles.agentLatestRow}>
            <Text style={styles.agentLatestLabel}>{t('issueAgent.sessionStatus')}</Text>
            <SemanticBadge
              label={t(`issueAgent.states.${latestSession.state}`)}
              tone={agentStateTone(latestSession.state)}
            />
          </View>
          <View style={styles.agentLatestRow}>
            <Text style={styles.agentLatestLabel}>{t('issueAgent.provider')}</Text>
            <Text style={styles.agentLatestValue} numberOfLines={1}>
              {t(`issueAgent.providers.${latestSession.provider}`)}
            </Text>
          </View>
          <View style={styles.agentLatestRow}>
            <Text style={styles.agentLatestLabel}>{t('issueAgent.runner')}</Text>
            <Text style={styles.agentLatestValue} numberOfLines={1}>
              {latestLocalRun?.command
                ? t('issueAgent.localRunner', { command: latestLocalRun.command })
                : t('issueAgent.webhookRunner')}
            </Text>
          </View>
          {latestLocalRun?.status ? (
            <View style={styles.agentLatestRow}>
              <Text style={styles.agentLatestLabel}>{t('issueAgent.runnerStatus')}</Text>
              <Text style={styles.agentLatestValue} numberOfLines={1}>
                {runnerStatusLabel(latestLocalRun.status)}
              </Text>
            </View>
          ) : null}
          {latestLocalRun?.exitCode !== null && latestLocalRun?.exitCode !== undefined ? (
            <View style={styles.agentLatestRow}>
              <Text style={styles.agentLatestLabel}>{t('issueAgent.exitCode')}</Text>
              <Text style={styles.agentLatestValue} numberOfLines={1}>
                {String(latestLocalRun.exitCode)}
              </Text>
            </View>
          ) : null}
        </View>
      ) : null}

      <View style={styles.agentDispatchBox}>
        <Text style={styles.agentFieldLabel}>{t('issueAgent.provider')}</Text>
        <View style={styles.agentProviderGrid}>
          {AGENT_SESSION_PROVIDERS.map((provider) => {
            const selected = selectedProvider === provider;
            return (
              <Pressable
                key={provider}
                accessibilityRole="button"
                onPress={() => setSelectedProvider(provider)}
                disabled={dispatchAgent.isPending}
                style={[
                  styles.agentProviderPill,
                  selected ? styles.agentProviderPillActive : null,
                  dispatchAgent.isPending ? styles.inlineActionDisabled : null,
                ]}
                className="active:opacity-80"
              >
                <Text
                  style={[
                    styles.agentProviderText,
                    selected ? styles.agentProviderTextActive : null,
                  ]}
                  numberOfLines={1}
                >
                  {t(`issueAgent.providers.${provider}`)}
                </Text>
              </Pressable>
            );
          })}
        </View>
        <TextField
          label={t('issueAgent.promptLabel')}
          placeholder={t('issueAgent.promptPlaceholder')}
          value={promptOverride}
          onChangeText={(value) => {
            setPromptOverride(value);
            setAgentError(null);
          }}
          editable={!dispatchAgent.isPending}
          multiline
          className="min-h-20 py-2"
        />
        <Button
          title={dispatchAgent.isPending ? t('issueAgent.dispatching') : t('issueAgent.dispatch')}
          icon={Play}
          loading={dispatchAgent.isPending}
          disabled={dispatchAgent.isPending}
          onPress={() => void dispatch()}
        />
      </View>

      {agentError ? <Text style={styles.commentError}>{agentError}</Text> : null}
      {sessionsQ.isError ? (
        <Text style={styles.commentError}>{t('issueAgent.loadFailed')}</Text>
      ) : null}

      <View style={styles.agentSessions}>
        <View style={styles.agentSessionsHeader}>
          <Text style={styles.agentFieldLabel}>{t('issueAgent.latestSessions')}</Text>
          {sessionsQ.isFetching ? (
            <Text style={styles.agentSessionMeta}>{t('common.loading')}</Text>
          ) : null}
        </View>
        {sessionsQ.isLoading ? <Text style={styles.helperText}>{t('common.loading')}</Text> : null}
        {!sessionsQ.isLoading && !sessionsQ.isError && sessions.length === 0 ? (
          <Text style={styles.helperText}>{t('issueAgent.noSessions')}</Text>
        ) : null}
        {sessions.slice(0, 4).map(renderSession)}
      </View>
    </View>
  );
}

function TimeTrackingPanel({ issue }: { issue: Issue }) {
  const { t } = useTranslation();
  const { styles } = useIssueDetailTheme();
  const entriesQ = useIssueTimeEntries(issue.id);
  const startTimer = useStartIssueTimer(issue.id);
  const stopTimer = useStopIssueTimer(issue.id);
  const logTime = useLogIssueTimeEntry(issue.id);
  const updateIssue = useUpdateIssue(issue.id);
  const suggestEstimate = useSuggestIssueEstimate(issue.id);
  const [estimateDraft, setEstimateDraft] = useState('');
  const [estimateDraftSource, setEstimateDraftSource] =
    useState<NonNullable<Issue['estimateSource']>>('manual');
  const [estimateSuggestion, setEstimateSuggestion] = useState<AiEstimateSuggestion | null>(null);
  const [manualDuration, setManualDuration] = useState('');
  const [manualNote, setManualNote] = useState('');
  const [stopNote, setStopNote] = useState('');
  const [timeError, setTimeError] = useState<string | null>(null);
  const [tick, setTick] = useState(0);

  const runningEntry = useMemo(
    () => (entriesQ.data ?? []).find((entry) => !entry.endedAt) ?? null,
    [entriesQ.data],
  );

  useEffect(() => {
    setEstimateDraft(
      issue.estimateHours === null || issue.estimateHours === undefined
        ? ''
        : String(issue.estimateHours),
    );
    setEstimateDraftSource(issue.estimateSource === 'ai_suggest' ? 'ai_suggest' : 'manual');
  }, [issue.estimateHours, issue.estimateSource]);

  useEffect(() => {
    if (!runningEntry) return;
    const timer = setInterval(() => setTick((current) => current + 1), 1000);
    return () => clearInterval(timer);
  }, [runningEntry]);

  const actualHours = issue.actualHours ?? 0;
  const estimateHours = issue.estimateHours ?? 0;
  const remainingHours = Math.max(0, estimateHours - actualHours);
  const elapsedLabel = useMemo(() => {
    if (!runningEntry) return null;
    const startedAt = new Date(runningEntry.startedAt).getTime();
    if (Number.isNaN(startedAt)) return null;
    void tick;
    return formatDurationSeconds(Math.max(0, Math.floor((Date.now() - startedAt) / 1000)));
  }, [runningEntry, tick]);

  const busy =
    startTimer.isPending ||
    stopTimer.isPending ||
    logTime.isPending ||
    updateIssue.isPending ||
    suggestEstimate.isPending;
  const estimateDirty =
    estimateDraft.trim() !==
    (issue.estimateHours === null || issue.estimateHours === undefined
      ? ''
      : String(issue.estimateHours));

  const saveEstimate = async (
    source: NonNullable<Issue['estimateSource']> = estimateDraftSource,
  ) => {
    const trimmed = estimateDraft.trim();
    const nextValue = trimmed ? Number(trimmed.replace(',', '.')) : null;
    if (trimmed && (!Number.isFinite(nextValue) || (nextValue ?? 0) < 0)) {
      setTimeError(t('timeTracking.invalidEstimate'));
      return;
    }
    setTimeError(null);
    try {
      await updateIssue.mutateAsync({
        estimateHours: nextValue,
        estimateSource: nextValue === null ? null : source,
      });
    } catch (err: unknown) {
      setTimeError(err instanceof Error ? err.message : t('timeTracking.saveEstimateFailed'));
    }
  };

  const requestAiEstimate = async () => {
    setTimeError(null);
    try {
      const suggestion = await suggestEstimate.mutateAsync();
      setEstimateSuggestion(suggestion);
      if (suggestion.estimateHours !== null) {
        setEstimateDraft(String(suggestion.estimateHours));
        setEstimateDraftSource('ai_suggest');
      }
    } catch (err: unknown) {
      setTimeError(err instanceof Error ? err.message : t('timeTracking.suggestFailed'));
    }
  };

  const start = async () => {
    setTimeError(null);
    try {
      await startTimer.mutateAsync();
    } catch (err: unknown) {
      setTimeError(err instanceof Error ? err.message : t('timeTracking.startFailed'));
    }
  };

  const stop = async () => {
    setTimeError(null);
    try {
      const input = stopNote.trim() ? { description: stopNote.trim() } : {};
      await stopTimer.mutateAsync(input);
      setStopNote('');
    } catch (err: unknown) {
      setTimeError(err instanceof Error ? err.message : t('timeTracking.stopFailed'));
    }
  };

  const logManual = async () => {
    const durationSeconds = parseDurationInput(manualDuration);
    if (!durationSeconds) {
      setTimeError(t('timeTracking.parseFailed'));
      return;
    }
    setTimeError(null);
    try {
      const input = {
        durationSeconds,
        ...(manualNote.trim() ? { description: manualNote.trim() } : {}),
      };
      await logTime.mutateAsync(input);
      setManualDuration('');
      setManualNote('');
    } catch (err: unknown) {
      setTimeError(err instanceof Error ? err.message : t('timeTracking.logFailed'));
    }
  };

  return (
    <View style={styles.timePanel}>
      <View style={styles.timePanelHeader}>
        <SectionTitle icon={Clock} title={t('timeTracking.title')} />
        {runningEntry ? (
          <View style={styles.runningBadge}>
            <Text style={styles.runningBadgeText}>{elapsedLabel ?? t('timeTracking.running')}</Text>
          </View>
        ) : null}
      </View>

      <View style={styles.timeStats}>
        <View style={styles.timeStat}>
          <Text style={styles.timeStatLabel}>{t('timeTracking.estimateLabel')}</Text>
          <Text style={styles.timeStatValue}>{formatHours(estimateHours)}</Text>
        </View>
        <View style={styles.timeStat}>
          <Text style={styles.timeStatLabel}>{t('timeTracking.actualLabel')}</Text>
          <Text style={styles.timeStatValue}>{formatHours(actualHours)}</Text>
        </View>
        <View style={styles.timeStat}>
          <Text style={styles.timeStatLabel}>{t('timeTracking.remainingLabel')}</Text>
          <Text style={styles.timeStatValue}>{formatHours(remainingHours)}</Text>
        </View>
      </View>

      <View style={styles.timeActionBlock}>
        <TextField
          label={t('timeTracking.estimateInputLabel')}
          placeholder={t('timeTracking.estimatePlaceholder')}
          value={estimateDraft}
          onChangeText={(value) => {
            setEstimateDraft(value);
            setEstimateDraftSource('manual');
            setTimeError(null);
          }}
          editable={!busy}
          keyboardType="decimal-pad"
        />
        <Button
          title={t('timeTracking.saveEstimate')}
          variant="secondary"
          icon={Check}
          loading={updateIssue.isPending}
          disabled={!estimateDirty || busy}
          onPress={() => void saveEstimate()}
        />
        <Button
          title={t('timeTracking.aiSuggest')}
          variant="secondary"
          icon={Sparkles}
          loading={suggestEstimate.isPending}
          disabled={busy}
          onPress={() => void requestAiEstimate()}
        />
      </View>

      {estimateSuggestion ? (
        <View style={styles.timeSuggestion}>
          <Text style={styles.timeSuggestionTitle}>
            {estimateSuggestion.estimateHours !== null
              ? t('timeTracking.suggested', {
                  hours: formatHours(estimateSuggestion.estimateHours),
                })
              : t('timeTracking.noSuggestion')}
          </Text>
          {estimateSuggestion.p25Hours !== null && estimateSuggestion.p75Hours !== null ? (
            <Text style={styles.timeSuggestionMeta}>
              {t('timeTracking.suggestedRange', {
                p25: formatHours(estimateSuggestion.p25Hours),
                p75: formatHours(estimateSuggestion.p75Hours),
              })}
            </Text>
          ) : null}
          {estimateSuggestion.rationale ? (
            <Text style={styles.timeSuggestionText}>{estimateSuggestion.rationale}</Text>
          ) : null}
          <Text style={styles.timeSuggestionMeta}>
            {t('timeTracking.sampleSize', { count: estimateSuggestion.sampleSize })}
          </Text>
          {estimateSuggestion.estimateHours !== null ? (
            <Button
              title={t('timeTracking.applySuggestion')}
              variant="secondary"
              icon={Check}
              loading={updateIssue.isPending}
              disabled={busy}
              onPress={() => void saveEstimate('ai_suggest')}
            />
          ) : null}
        </View>
      ) : null}

      {runningEntry ? (
        <View style={styles.timeActionBlock}>
          <TextField
            label={t('timeTracking.stopNoteLabel')}
            placeholder={t('timeTracking.notePlaceholder')}
            value={stopNote}
            onChangeText={setStopNote}
            editable={!busy}
          />
          <Button
            title={t('timeTracking.stopTimer')}
            variant="destructive"
            icon={Square}
            loading={stopTimer.isPending}
            disabled={busy}
            onPress={() => void stop()}
          />
        </View>
      ) : (
        <Button
          title={t('timeTracking.startTimer')}
          icon={Play}
          loading={startTimer.isPending}
          disabled={busy}
          onPress={() => void start()}
        />
      )}

      <View style={styles.timeActionBlock}>
        <TextField
          label={t('timeTracking.logLabel')}
          placeholder={t('timeTracking.logPlaceholder')}
          value={manualDuration}
          onChangeText={(value) => {
            setManualDuration(value);
            setTimeError(null);
          }}
          editable={!busy}
          autoCapitalize="none"
        />
        <TextField
          label={t('timeTracking.noteLabel')}
          placeholder={t('timeTracking.notePlaceholder')}
          value={manualNote}
          onChangeText={setManualNote}
          editable={!busy}
          multiline
          className="min-h-12"
        />
        <Button
          title={t('timeTracking.logButton')}
          variant="secondary"
          icon={Clock}
          loading={logTime.isPending}
          disabled={!manualDuration.trim() || busy}
          onPress={() => void logManual()}
        />
      </View>

      {entriesQ.isLoading ? <Text style={styles.helperText}>{t('common.loading')}</Text> : null}
      {entriesQ.isError ? (
        <Text style={styles.commentError}>{t('timeTracking.loadFailed')}</Text>
      ) : null}
      {timeError ? <Text style={styles.commentError}>{timeError}</Text> : null}
    </View>
  );
}

function TimeInStatusPanel({ issueId }: { issueId: string }) {
  const { t } = useTranslation();
  const { styles } = useIssueDetailTheme();
  const bucketsQ = useIssueTimeInStatus(issueId);

  return (
    <View style={styles.timeInStatusPanel}>
      <SectionTitle icon={Clock} title={t('timeInStatus.title')} />
      {bucketsQ.isLoading ? <Text style={styles.helperText}>{t('common.loading')}</Text> : null}
      {bucketsQ.isError ? (
        <Text style={styles.commentError}>{t('timeInStatus.loadFailed')}</Text>
      ) : null}
      {!bucketsQ.isLoading && !bucketsQ.isError && bucketsQ.data?.length === 0 ? (
        <Text style={styles.helperText}>{t('timeInStatus.empty')}</Text>
      ) : null}
      {bucketsQ.data && bucketsQ.data.length > 0 ? (
        <View style={styles.timeInStatusList}>
          {bucketsQ.data.map((bucket) => (
            <View key={bucket.status} style={styles.timeInStatusRow}>
              <Text style={styles.timeInStatusName} numberOfLines={1}>
                {bucket.statusName}
              </Text>
              <View style={styles.timeInStatusValue}>
                <Text style={styles.timeInStatusDuration} numberOfLines={1}>
                  {formatDurationSeconds(bucket.totalDurationSeconds)}
                </Text>
                {bucket.exitCount > 0 ? (
                  <Text style={styles.timeInStatusVisits} numberOfLines={1}>
                    {t('timeInStatus.visitCount', { count: bucket.exitCount + 1 })}
                  </Text>
                ) : null}
              </View>
            </View>
          ))}
        </View>
      ) : null}
    </View>
  );
}

function IssueSubtasksPanel({
  issue,
  onOpenIssue,
}: {
  issue: Issue;
  onOpenIssue: (issueId: string) => void;
}) {
  const { t } = useTranslation();
  const { colors, styles } = useIssueDetailTheme();
  const subtasksQ = useIssueSubtasks(issue.id);
  const createSubIssue = useCreateSubIssue(issue);
  const updateSubIssueStatus = useUpdateSubIssueStatus(issue.id);
  const [adding, setAdding] = useState(false);
  const [title, setTitle] = useState('');
  const [subtaskError, setSubtaskError] = useState<string | null>(null);

  const subtasks = subtasksQ.data ?? [];
  const completed = subtasks.filter((subtask) => subtask.status?.category === 'done').length;
  const progress = subtasks.length > 0 ? completed / subtasks.length : 0;
  const busy = createSubIssue.isPending || updateSubIssueStatus.isPending;

  const create = async () => {
    const trimmed = title.trim();
    if (!trimmed) return;
    setSubtaskError(null);
    try {
      await createSubIssue.mutateAsync(trimmed);
      setTitle('');
      setAdding(false);
    } catch (err: unknown) {
      setSubtaskError(err instanceof Error ? err.message : t('issueSubtasks.createFailed'));
    }
  };

  const toggleComplete = async (subtask: Issue) => {
    setSubtaskError(null);
    try {
      await updateSubIssueStatus.mutateAsync({
        issueId: subtask.id,
        status: subtask.status?.category === 'done' ? 'backlog' : 'done',
      });
    } catch (err: unknown) {
      setSubtaskError(err instanceof Error ? err.message : t('issueSubtasks.completeFailed'));
    }
  };

  return (
    <View style={styles.subtasksPanel}>
      <View style={styles.subtasksHeader}>
        <SectionTitle icon={CheckCircle2} title={t('issueSubtasks.title')} />
        {subtasks.length > 0 ? (
          <Text style={styles.subtasksProgressText}>
            {t('issueSubtasks.progress', { completed, total: subtasks.length })}
          </Text>
        ) : null}
      </View>

      {subtasks.length > 0 ? (
        <View style={styles.subtasksProgressTrack}>
          <View style={[styles.subtasksProgressFill, { flex: progress }]} />
          <View style={{ flex: Math.max(0, 1 - progress) }} />
        </View>
      ) : null}

      {subtasksQ.isLoading ? <Text style={styles.helperText}>{t('common.loading')}</Text> : null}
      {subtasksQ.isError ? (
        <Text style={styles.commentError}>{t('issueSubtasks.loadFailed')}</Text>
      ) : null}
      {!subtasksQ.isLoading && !subtasksQ.isError && subtasks.length === 0 && !adding ? (
        <Text style={styles.helperText}>{t('issueSubtasks.empty')}</Text>
      ) : null}

      {subtasks.length > 0 ? (
        <View style={styles.subtaskList}>
          {subtasks.map((subtask) => {
            const done = subtask.status?.category === 'done';
            return (
              <View key={subtask.id} style={styles.subtaskRow}>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={
                    done ? t('issueSubtasks.markIncomplete') : t('issueSubtasks.markComplete')
                  }
                  disabled={busy}
                  onPress={() => void toggleComplete(subtask)}
                  style={styles.subtaskCheck}
                >
                  {done ? (
                    <CheckCircle2 size={18} color={colors.success} />
                  ) : (
                    <Square size={18} color={colors.mutedForeground} />
                  )}
                </Pressable>
                <Pressable
                  accessibilityRole="button"
                  onPress={() => onOpenIssue(subtask.id)}
                  style={styles.subtaskOpen}
                >
                  <View style={styles.subtaskBody}>
                    <View style={styles.subtaskTitleRow}>
                      <Text style={styles.subtaskKey} numberOfLines={1}>
                        {subtask.key ?? subtask.id}
                      </Text>
                      {subtask.priority ? (
                        <SemanticBadge label={priorityDisplayLabel(subtask.priority, t)} />
                      ) : null}
                    </View>
                    <Text
                      style={[styles.subtaskTitle, done ? styles.subtaskTitleDone : null]}
                      numberOfLines={2}
                    >
                      {subtask.title}
                    </Text>
                    <Text style={styles.subtaskMeta} numberOfLines={1}>
                      {subtask.status?.name ?? t('common.none')}
                    </Text>
                  </View>
                </Pressable>
              </View>
            );
          })}
        </View>
      ) : null}

      {adding ? (
        <View style={styles.subtaskCreateBox}>
          <TextField
            label={t('issueSubtasks.titleLabel')}
            placeholder={t('issueSubtasks.placeholder')}
            value={title}
            onChangeText={(value) => {
              setTitle(value);
              if (subtaskError) setSubtaskError(null);
            }}
            editable={!busy}
          />
          <View style={styles.subtaskCreateActions}>
            <Button
              title={t('common.cancel')}
              variant="ghost"
              icon={X}
              disabled={busy}
              onPress={() => {
                setAdding(false);
                setTitle('');
                setSubtaskError(null);
              }}
            />
            <Button
              title={t('issueSubtasks.create')}
              icon={Plus}
              loading={createSubIssue.isPending}
              disabled={!title.trim() || busy}
              onPress={() => void create()}
            />
          </View>
        </View>
      ) : (
        <Button
          title={t('issueSubtasks.add')}
          variant="secondary"
          icon={Plus}
          disabled={busy}
          onPress={() => setAdding(true)}
        />
      )}

      {subtaskError ? <Text style={styles.commentError}>{subtaskError}</Text> : null}
    </View>
  );
}

function IssueDocsPanel({
  issue,
  onOpenDocument,
}: {
  issue: Issue;
  onOpenDocument: (pageId: string) => void;
}) {
  const { t } = useTranslation();
  const { colors, styles } = useIssueDetailTheme();
  const docsQ = useIssueDocuments(issue.id);
  const attachDoc = useAttachIssueDocument(issue.id);
  const detachDoc = useDetachIssueDocument(issue.id);
  const [search, setSearch] = useState('');
  const [docsError, setDocsError] = useState<string | null>(null);
  const searchQ = useSearchDocumentPages(search, {
    organizationId: issue.organizationId ?? null,
    projectId: issue.projectId,
  });
  const linkedDocIds = useMemo(
    () => new Set((docsQ.data ?? []).map((doc) => doc.id)),
    [docsQ.data],
  );
  const availableResults = useMemo(
    () => (searchQ.data?.results ?? []).filter((doc) => !linkedDocIds.has(doc.id)).slice(0, 6),
    [linkedDocIds, searchQ.data?.results],
  );
  const busy = attachDoc.isPending || detachDoc.isPending;

  const createSpecDoc = async () => {
    setDocsError(null);
    try {
      const result = await attachDoc.mutateAsync({
        createNew: true,
        title: t('issueDocs.specTitle', { key: issue.key ?? issue.title }),
      });
      if (result.page?.id) onOpenDocument(result.page.id);
    } catch (err: unknown) {
      setDocsError(err instanceof Error ? err.message : t('issueDocs.createFailed'));
    }
  };

  const attachExistingDoc = async (doc: DocumentPageSummary) => {
    setDocsError(null);
    try {
      await attachDoc.mutateAsync({ pageId: doc.id });
      setSearch('');
    } catch (err: unknown) {
      setDocsError(err instanceof Error ? err.message : t('issueDocs.attachFailed'));
    }
  };

  const confirmDetachDoc = (doc: IssueDocument) => {
    Alert.alert(
      t('issueDocs.unlinkConfirmTitle'),
      t('issueDocs.unlinkConfirmMessage', { title: doc.title }),
      [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('issueDocs.unlink'),
          style: 'destructive',
          onPress: () => {
            void detachDocAsync(doc);
          },
        },
      ],
    );
  };

  const detachDocAsync = async (doc: IssueDocument) => {
    setDocsError(null);
    try {
      await detachDoc.mutateAsync(doc.id);
    } catch (err: unknown) {
      setDocsError(err instanceof Error ? err.message : t('issueDocs.detachFailed'));
    }
  };

  return (
    <View style={styles.docsPanel}>
      <View style={styles.docsHeader}>
        <SectionTitle icon={FileText} title={t('issueDocs.title')} />
        <Pressable
          accessibilityRole="button"
          onPress={() => void createSpecDoc()}
          disabled={busy}
          style={[styles.inlineAction, busy ? styles.inlineActionDisabled : null]}
          className="active:opacity-80"
        >
          <Plus size={14} color={colors.foreground} />
          <Text style={styles.inlineActionText}>{t('issueDocs.createSpec')}</Text>
        </Pressable>
      </View>

      <TextField
        placeholder={t('issueDocs.searchPlaceholder')}
        value={search}
        onChangeText={(value) => {
          setSearch(value);
          setDocsError(null);
        }}
        editable={!busy}
        autoCapitalize="none"
        autoCorrect={false}
      />

      {search.trim().length >= 2 ? (
        <View style={styles.docSearchResults}>
          {searchQ.isLoading ? <Text style={styles.helperText}>{t('common.loading')}</Text> : null}
          {!searchQ.isLoading && availableResults.length === 0 ? (
            <Text style={styles.helperText}>{t('issueDocs.noMatches')}</Text>
          ) : null}
          {availableResults.map((doc) => (
            <Pressable
              key={doc.id}
              accessibilityRole="button"
              disabled={busy}
              onPress={() => void attachExistingDoc(doc)}
              style={[styles.docSearchRow, busy ? styles.choiceButtonDisabled : null]}
              className="active:opacity-80"
            >
              <DocumentGlyph doc={doc} />
              <View style={styles.docBody}>
                <Text style={styles.docTitle} numberOfLines={1}>
                  {doc.title}
                </Text>
                <Text style={styles.docMeta} numberOfLines={1}>
                  {docMetaLabel(doc, t)}
                </Text>
              </View>
              <Link2 size={15} color={colors.mutedForeground} />
            </Pressable>
          ))}
        </View>
      ) : null}

      {docsQ.isLoading ? <Text style={styles.helperText}>{t('common.loading')}</Text> : null}
      {docsQ.isError ? <Text style={styles.commentError}>{t('issueDocs.loadFailed')}</Text> : null}
      {!docsQ.isLoading && !docsQ.isError && docsQ.data?.length === 0 ? (
        <Text style={styles.helperText}>{t('issueDocs.empty')}</Text>
      ) : null}
      {docsQ.data && docsQ.data.length > 0 ? (
        <View style={styles.docList}>
          {docsQ.data.map((doc) => (
            <View key={doc.id} style={styles.docRow}>
              <Pressable
                accessibilityRole="button"
                onPress={() => onOpenDocument(doc.id)}
                style={styles.docOpen}
                className="active:opacity-80"
              >
                <DocumentGlyph doc={doc} />
                <View style={styles.docBody}>
                  <Text style={styles.docTitle} numberOfLines={1}>
                    {doc.title}
                  </Text>
                  <Text style={styles.docMeta} numberOfLines={1}>
                    {docMetaLabel(doc, t)}
                  </Text>
                </View>
              </Pressable>
              <View style={styles.docActions}>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={t('issueDocs.open')}
                  onPress={() => onOpenDocument(doc.id)}
                  style={styles.docAction}
                  className="active:opacity-80"
                >
                  <ExternalLink size={14} color={colors.mutedForeground} />
                </Pressable>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={t('issueDocs.unlink')}
                  onPress={() => confirmDetachDoc(doc)}
                  disabled={busy}
                  style={[styles.docAction, busy ? styles.inlineActionDisabled : null]}
                  className="active:opacity-80"
                >
                  <Unlink2 size={14} color={colors.destructive} />
                </Pressable>
              </View>
            </View>
          ))}
        </View>
      ) : null}
      {docsError ? <Text style={styles.commentError}>{docsError}</Text> : null}
    </View>
  );
}

function DocumentGlyph({ doc }: { doc: Pick<DocumentPageSummary, 'icon'> }) {
  const { colors, styles } = useIssueDetailTheme();

  return (
    <View style={styles.docGlyph}>
      {doc.icon ? (
        <Text style={styles.docGlyphText} numberOfLines={1}>
          {doc.icon}
        </Text>
      ) : (
        <FileText size={15} color={colors.mutedForeground} />
      )}
    </View>
  );
}

function docMetaLabel(doc: DocumentPageSummary, t: ReturnType<typeof useTranslation>['t']): string {
  const kind = doc.projectId ? t('issueDocs.kindProject') : t('issueDocs.kindWiki');
  const updated = doc.updatedAt ? relativeTime(doc.updatedAt) : '';
  return updated ? t('issueDocs.updated', { kind, date: updated }) : kind;
}

function IssueAttachmentsPanel({ issueId }: { issueId: string }) {
  const { t } = useTranslation();
  const { colors, styles } = useIssueDetailTheme();
  const attachmentsQ = useIssueAttachments(issueId);
  const uploadAttachment = useUploadIssueAttachment(issueId);
  const deleteAttachment = useDeleteIssueAttachment(issueId);
  const [attachmentError, setAttachmentError] = useState<string | null>(null);

  const uploadPickedAttachment = async () => {
    setAttachmentError(null);
    try {
      const [file] = await pick();
      if (file.size !== null && file.size > MAX_ATTACHMENT_SIZE_BYTES) {
        setAttachmentError(t('issueAttachments.maxSize'));
        return;
      }
      if (file.error) {
        setAttachmentError(t('issueAttachments.uploadFailed'));
        return;
      }

      const uriFileName = decodeURIComponent(file.uri.split('/').filter(Boolean).pop() ?? '');
      const fileName = file.name ?? (uriFileName || `attachment-${Date.now()}`);
      await uploadAttachment.mutateAsync({
        uri: file.uri,
        name: fileName,
        type: file.type,
        size: file.size,
      });
    } catch (err: unknown) {
      if (isErrorWithCode(err) && err.code === errorCodes.OPERATION_CANCELED) return;
      setAttachmentError(err instanceof Error ? err.message : t('issueAttachments.uploadFailed'));
    }
  };

  const openAttachment = async (attachment: IssueAttachment) => {
    setAttachmentError(null);
    const fileName = attachment.filePath.split('/').filter(Boolean).pop();
    const baseUrl = getBaseUrl();
    if (!fileName || !baseUrl) {
      setAttachmentError(t('issueAttachments.openFailed'));
      return;
    }
    try {
      await Linking.openURL(`${baseUrl}/api/uploads/${encodeURIComponent(fileName)}`);
    } catch {
      setAttachmentError(t('issueAttachments.openFailed'));
    }
  };

  const confirmDeleteAttachment = (attachment: IssueAttachment) => {
    Alert.alert(
      t('issueAttachments.deleteConfirmTitle'),
      t('issueAttachments.deleteConfirmMessage', { name: attachment.fileName }),
      [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('issueAttachments.delete'),
          style: 'destructive',
          onPress: () => {
            void deleteAttachmentAsync(attachment);
          },
        },
      ],
    );
  };

  const deleteAttachmentAsync = async (attachment: IssueAttachment) => {
    setAttachmentError(null);
    try {
      await deleteAttachment.mutateAsync(attachment.id);
    } catch (err: unknown) {
      setAttachmentError(err instanceof Error ? err.message : t('issueAttachments.deleteFailed'));
    }
  };

  return (
    <View style={styles.attachmentsPanel}>
      <View style={styles.attachmentsHeader}>
        <View style={styles.attachmentsHeaderText}>
          <SectionTitle icon={File} title={t('issueAttachments.title')} />
          {attachmentsQ.data && attachmentsQ.data.length > 0 ? (
            <Text style={styles.activityCount}>
              {t('issueAttachments.count', { count: attachmentsQ.data.length })}
            </Text>
          ) : null}
        </View>
        <Button
          title={t('issueAttachments.browse')}
          icon={Upload}
          variant="secondary"
          loading={uploadAttachment.isPending}
          disabled={uploadAttachment.isPending}
          onPress={() => {
            void uploadPickedAttachment();
          }}
        />
      </View>
      <Text style={styles.helperText}>{t('issueAttachments.maxSize')}</Text>

      {attachmentsQ.isLoading ? <Text style={styles.helperText}>{t('common.loading')}</Text> : null}
      {attachmentsQ.isError ? (
        <Text style={styles.commentError}>{t('issueAttachments.loadFailed')}</Text>
      ) : null}
      {!attachmentsQ.isLoading && !attachmentsQ.isError && attachmentsQ.data?.length === 0 ? (
        <Text style={styles.helperText}>{t('issueAttachments.empty')}</Text>
      ) : null}

      {attachmentsQ.data && attachmentsQ.data.length > 0 ? (
        <View style={styles.attachmentList}>
          {attachmentsQ.data.map((attachment) => (
            <View key={attachment.id} style={styles.attachmentRow}>
              <Pressable
                accessibilityRole="button"
                onPress={() => void openAttachment(attachment)}
                style={styles.attachmentOpen}
                className="active:opacity-80"
              >
                <View style={styles.attachmentIcon}>
                  <File size={15} color={colors.mutedForeground} />
                </View>
                <View style={styles.attachmentBody}>
                  <Text style={styles.attachmentName} numberOfLines={1}>
                    {attachment.fileName}
                  </Text>
                  <Text style={styles.attachmentMeta} numberOfLines={1}>
                    {formatAttachmentSize(attachment.fileSize, t)}
                  </Text>
                </View>
              </Pressable>
              <View style={styles.docActions}>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={t('issueAttachments.open')}
                  onPress={() => void openAttachment(attachment)}
                  style={styles.docAction}
                  className="active:opacity-80"
                >
                  <ExternalLink size={14} color={colors.mutedForeground} />
                </Pressable>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={t('issueAttachments.delete')}
                  onPress={() => confirmDeleteAttachment(attachment)}
                  disabled={deleteAttachment.isPending}
                  style={[
                    styles.docAction,
                    deleteAttachment.isPending ? styles.inlineActionDisabled : null,
                  ]}
                  className="active:opacity-80"
                >
                  <Trash2 size={14} color={colors.destructive} />
                </Pressable>
              </View>
            </View>
          ))}
        </View>
      ) : null}
      {attachmentError ? <Text style={styles.commentError}>{attachmentError}</Text> : null}
    </View>
  );
}

const ACTIVITY_PREVIEW_LIMIT = 7;

function IssueActivityPanel({ issueId }: { issueId: string }) {
  const { t } = useTranslation();
  const { styles } = useIssueDetailTheme();
  const activitiesQ = useIssueActivities(issueId);
  const [showAll, setShowAll] = useState(false);
  const activities = activitiesQ.data ?? [];
  const visibleActivities = showAll ? activities : activities.slice(0, ACTIVITY_PREVIEW_LIMIT);

  return (
    <View style={styles.activityPanel}>
      <View style={styles.activityHeader}>
        <SectionTitle icon={History} title={t('issueActivity.title')} />
        {activities.length > 0 ? (
          <Text style={styles.activityCount}>
            {t('issueActivity.count', { count: activities.length })}
          </Text>
        ) : null}
      </View>

      {activitiesQ.isLoading ? <Text style={styles.helperText}>{t('common.loading')}</Text> : null}
      {activitiesQ.isError ? (
        <Text style={styles.commentError}>{t('issueActivity.loadFailed')}</Text>
      ) : null}
      {!activitiesQ.isLoading && !activitiesQ.isError && activities.length === 0 ? (
        <Text style={styles.helperText}>{t('issueActivity.empty')}</Text>
      ) : null}

      {visibleActivities.length > 0 ? (
        <View style={styles.activityList}>
          {visibleActivities.map((activity) => (
            <View key={activity.id} style={styles.activityRow}>
              <View style={styles.activityDot} />
              <View style={styles.activityBody}>
                <Text style={styles.activityDescription}>{activityDescription(activity, t)}</Text>
                <Text style={styles.activityMeta} numberOfLines={1}>
                  {t('issueActivity.actorAndDate', {
                    actor: activityActor(activity, t),
                    date: relativeTime(activity.createdAt) || t('time.justNow'),
                  })}
                </Text>
              </View>
            </View>
          ))}
        </View>
      ) : null}

      {activities.length > ACTIVITY_PREVIEW_LIMIT ? (
        <Pressable
          accessibilityRole="button"
          onPress={() => setShowAll((current) => !current)}
          style={styles.activityToggle}
          className="active:opacity-80"
        >
          <Text style={styles.activityToggleText}>
            {showAll
              ? t('issueActivity.showLess')
              : t('issueActivity.showMore', {
                  count: activities.length - ACTIVITY_PREVIEW_LIMIT,
                })}
          </Text>
        </Pressable>
      ) : null}
    </View>
  );
}

function activityActor(activity: IssueActivity, t: ReturnType<typeof useTranslation>['t']): string {
  return activity.user?.name || activity.user?.email || t('issueActivity.unknownUser');
}

function activityValue(
  value: string | null | undefined,
  t: ReturnType<typeof useTranslation>['t'],
) {
  return value?.trim() || t('issueActivity.emptyValue');
}

function activityDescription(
  activity: IssueActivity,
  t: ReturnType<typeof useTranslation>['t'],
): string {
  if (activity.type === 'created') return t('issueActivity.createdIssue');
  if (activity.type === 'commented') return t('issueActivity.addedComment');
  if (activity.type === 'linked') return t('issueActivity.linkedIssue');
  if (activity.type === 'mentioned') return t('issueActivity.mentionedUser');
  if (activity.type === 'assigned') {
    return t('issueActivity.assignedIssue', {
      assignee: activityValue(activity.newValue, t),
    });
  }
  if (activity.type === 'status_changed') {
    return t('issueActivity.statusChanged', {
      oldValue: activityValue(activity.oldValue, t),
      newValue: activityValue(activity.newValue, t),
    });
  }
  if (activity.type === 'updated' && activity.field) {
    if (activity.oldValue && activity.newValue) {
      return t('issueActivity.fieldChangedFromTo', {
        field: activity.field,
        oldValue: activity.oldValue,
        newValue: activity.newValue,
      });
    }
    if (activity.newValue) {
      return t('issueActivity.fieldChangedTo', {
        field: activity.field,
        newValue: activity.newValue,
      });
    }
    return t('issueActivity.fieldChanged', { field: activity.field });
  }
  return t('issueActivity.unknownAction', { action: activity.type });
}

function IssueLinksPanel({
  issueId,
  projectId,
  onOpenIssue,
}: {
  issueId: string;
  projectId: string;
  onOpenIssue: (issueId: string) => void;
}) {
  const { t } = useTranslation();
  const { colors, styles } = useIssueDetailTheme();
  const linksQ = useIssueLinks(issueId);
  const projectIssuesQ = useIssues({ projectId });
  const createLink = useCreateIssueLink(issueId);
  const deleteLink = useDeleteIssueLink(issueId);
  const [adding, setAdding] = useState(false);
  const [linkType, setLinkType] = useState<EditableIssueLinkType>('relates_to');
  const [targetIssueId, setTargetIssueId] = useState('');
  const [targetSearch, setTargetSearch] = useState('');
  const [linkError, setLinkError] = useState<string | null>(null);
  const [deletingLinkId, setDeletingLinkId] = useState<string | null>(null);

  const allLinks = useMemo(
    () => [...(linksQ.data?.outbound ?? []), ...(linksQ.data?.inbound ?? [])],
    [linksQ.data?.inbound, linksQ.data?.outbound],
  );
  const availableIssues = useMemo(
    () => (projectIssuesQ.data ?? []).filter((issue) => issue.id !== issueId),
    [issueId, projectIssuesQ.data],
  );
  const filteredIssues = useMemo(() => {
    const query = targetSearch.trim().toLowerCase();
    const issues = query
      ? availableIssues.filter((issue) =>
          `${issue.key ?? ''} ${issue.title}`.toLowerCase().includes(query),
        )
      : availableIssues;
    return issues.slice(0, 8);
  }, [availableIssues, targetSearch]);
  const selectedIssue = availableIssues.find((issue) => issue.id === targetIssueId) ?? null;

  const resetCreateState = () => {
    setAdding(false);
    setLinkType('relates_to');
    setTargetIssueId('');
    setTargetSearch('');
    setLinkError(null);
  };

  const createSelectedLink = async () => {
    if (!selectedIssue) {
      setLinkError(t('issueLinks.targetRequired'));
      return;
    }
    setLinkError(null);
    try {
      await createLink.mutateAsync({
        targetIssueId: selectedIssue.id,
        targetIssueKey: selectedIssue.key ?? null,
        type: linkType,
      });
      resetCreateState();
    } catch (err: unknown) {
      setLinkError(err instanceof Error ? err.message : t('issueLinks.createFailed'));
    }
  };

  const removeLink = async (linkId: string) => {
    setDeletingLinkId(linkId);
    setLinkError(null);
    try {
      await deleteLink.mutateAsync(linkId);
    } catch (err: unknown) {
      setLinkError(err instanceof Error ? err.message : t('issueLinks.removeFailed'));
    } finally {
      setDeletingLinkId(null);
    }
  };

  return (
    <View style={styles.linksPanel}>
      <View style={styles.linksHeader}>
        <SectionTitle icon={Link2} title={t('issueLinks.title')} />
        <Pressable
          accessibilityRole="button"
          onPress={() => {
            setAdding((current) => !current);
            setLinkError(null);
          }}
          disabled={createLink.isPending}
          style={[styles.inlineAction, createLink.isPending ? styles.inlineActionDisabled : null]}
          className="active:opacity-80"
        >
          {adding ? (
            <X size={14} color={colors.foreground} />
          ) : (
            <Plus size={14} color={colors.foreground} />
          )}
          <Text style={styles.inlineActionText}>
            {adding ? t('common.cancel') : t('issueLinks.add')}
          </Text>
        </Pressable>
      </View>

      {linksQ.isLoading ? <Text style={styles.helperText}>{t('common.loading')}</Text> : null}
      {linksQ.isError ? (
        <Text style={styles.commentError}>{t('issueLinks.loadFailed')}</Text>
      ) : null}
      {!linksQ.isLoading && !linksQ.isError && allLinks.length === 0 ? (
        <Text style={styles.helperText}>{t('issueLinks.empty')}</Text>
      ) : null}
      {allLinks.length > 0 ? (
        <View style={styles.issueLinkList}>
          {allLinks.map((link) => (
            <IssueLinkRow
              key={link.id}
              link={link}
              deleting={deleteLink.isPending && deletingLinkId === link.id}
              onOpenIssue={onOpenIssue}
              onRemove={(linkId) => void removeLink(linkId)}
            />
          ))}
        </View>
      ) : null}

      {adding ? (
        <View style={styles.issueLinkCreatePanel}>
          <View style={styles.editorSection}>
            <SectionTitle icon={Link2} title={t('issueLinks.relationshipLabel')} />
            <View style={styles.choiceGrid}>
              {ISSUE_LINK_TYPES.map((type) => (
                <ChoiceButton
                  key={type}
                  label={issueLinkTypeLabel(type, 'outbound', t)}
                  value={type}
                  selected={linkType === type}
                  disabled={createLink.isPending}
                  onPress={setLinkType}
                />
              ))}
            </View>
          </View>

          <TextField
            label={t('issueLinks.issueLabel')}
            placeholder={t('issueLinks.searchPlaceholder')}
            value={targetSearch}
            onChangeText={(value) => {
              setTargetSearch(value);
              setLinkError(null);
            }}
            editable={!createLink.isPending}
            autoCapitalize="none"
            autoCorrect={false}
          />

          {projectIssuesQ.isLoading ? (
            <Text style={styles.helperText}>{t('common.loading')}</Text>
          ) : null}
          {!projectIssuesQ.isLoading && filteredIssues.length === 0 ? (
            <Text style={styles.helperText}>{t('issueLinks.noIssueFound')}</Text>
          ) : null}
          {filteredIssues.length > 0 ? (
            <View style={styles.issueLinkTargetList}>
              {filteredIssues.map((target) => (
                <Pressable
                  key={target.id}
                  accessibilityRole="button"
                  accessibilityState={{ selected: targetIssueId === target.id }}
                  disabled={createLink.isPending}
                  onPress={() => {
                    setTargetIssueId(target.id);
                    setLinkError(null);
                  }}
                  style={[
                    styles.issueLinkTarget,
                    targetIssueId === target.id ? styles.issueLinkTargetActive : null,
                    createLink.isPending ? styles.choiceButtonDisabled : null,
                  ]}
                  className="active:opacity-80"
                >
                  <View style={styles.issueLinkTargetBody}>
                    <Text style={styles.issueLinkKey} numberOfLines={1}>
                      {target.key ?? t('issueLinks.noKey')}
                    </Text>
                    <Text style={styles.issueLinkTargetTitle} numberOfLines={2}>
                      {target.title}
                    </Text>
                  </View>
                  <Text style={styles.issueLinkPriority} numberOfLines={1}>
                    {priorityDisplayLabel(target.priority, t)}
                  </Text>
                </Pressable>
              ))}
            </View>
          ) : null}

          {selectedIssue ? (
            <Text style={styles.helperText}>
              {t('issueLinks.preview', {
                relationship: issueLinkTypeLabel(linkType, 'outbound', t),
                key: selectedIssue.key ?? t('issueLinks.noKey'),
              })}
            </Text>
          ) : null}
          {linkError ? <Text style={styles.commentError}>{linkError}</Text> : null}
          <View style={styles.editActions}>
            <Button
              title={t('common.cancel')}
              variant="secondary"
              icon={X}
              disabled={createLink.isPending}
              onPress={resetCreateState}
            />
            <Button
              title={t('issueLinks.create')}
              icon={Link2}
              loading={createLink.isPending}
              disabled={!selectedIssue || createLink.isPending}
              onPress={() => void createSelectedLink()}
            />
          </View>
        </View>
      ) : null}
    </View>
  );
}

function IssueLinkRow({
  link,
  deleting,
  onOpenIssue,
  onRemove,
}: {
  link: IssueLink;
  deleting: boolean;
  onOpenIssue: (issueId: string) => void;
  onRemove: (linkId: string) => void;
}) {
  const { t } = useTranslation();
  const { colors, styles } = useIssueDetailTheme();

  return (
    <View style={styles.issueLinkRow}>
      <Pressable
        accessibilityRole="button"
        onPress={() => onOpenIssue(link.issue.id)}
        style={styles.issueLinkOpen}
        className="active:opacity-80"
      >
        <View style={styles.issueLinkRowTop}>
          <Text style={styles.issueLinkRelationship} numberOfLines={1}>
            {issueLinkTypeLabel(link.type, link.direction, t)}
          </Text>
          <ExternalLink size={13} color={colors.mutedForeground} />
        </View>
        <View style={styles.issueLinkTitleRow}>
          <Text style={styles.issueLinkKey} numberOfLines={1}>
            {link.issue.key ?? t('issueLinks.noKey')}
          </Text>
          <Text style={styles.issueLinkTitle} numberOfLines={2}>
            {link.issue.title}
          </Text>
        </View>
        <Text style={styles.issueLinkPriority} numberOfLines={1}>
          {priorityDisplayLabel(link.issue.priority, t)}
        </Text>
      </Pressable>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={t('issueLinks.remove')}
        onPress={() => onRemove(link.id)}
        disabled={deleting}
        style={[styles.issueLinkRemove, deleting ? styles.inlineActionDisabled : null]}
        className="active:opacity-80"
      >
        <X size={14} color={colors.destructive} />
      </Pressable>
    </View>
  );
}

function ChoiceButton<T extends string>({
  label,
  value,
  selected,
  disabled,
  onPress,
}: {
  label: string;
  value: T;
  selected: boolean;
  disabled?: boolean;
  onPress: (value: T) => void;
}) {
  const { styles } = useIssueDetailTheme();

  return (
    <Pressable
      accessibilityRole="button"
      disabled={disabled}
      onPress={() => onPress(value)}
      style={[
        styles.choiceButton,
        selected ? styles.choiceButtonActive : null,
        disabled ? styles.choiceButtonDisabled : null,
      ]}
      className="active:opacity-80"
    >
      <Text style={[styles.choiceText, selected ? styles.choiceTextActive : null]}>{label}</Text>
    </Pressable>
  );
}

function WorkflowStatusOption({
  status,
  selected,
  disabled,
  onPress,
}: {
  status: WorkflowStatus;
  selected: boolean;
  disabled?: boolean;
  onPress: (statusId: string) => void;
}) {
  const { t } = useTranslation();
  const { colors, styles } = useIssueDetailTheme();

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected }}
      disabled={disabled}
      onPress={() => onPress(status.id)}
      style={[
        styles.workflowStatusOption,
        selected ? styles.workflowStatusOptionActive : null,
        disabled ? styles.choiceButtonDisabled : null,
      ]}
      className="active:opacity-80"
    >
      <View
        style={[
          styles.workflowStatusDot,
          { backgroundColor: status.color ?? colors.mutedForeground },
        ]}
      />
      <View className="min-w-0 flex-1 gap-0.5">
        <Text style={styles.workflowStatusName} numberOfLines={1}>
          {status.name}
        </Text>
        <Text style={styles.workflowStatusMeta} numberOfLines={1}>
          {statusCategoryLabel(status.category, t)}
        </Text>
      </View>
      {selected ? <Check size={15} color={colors.primary} /> : null}
    </Pressable>
  );
}

function CustomFieldEditor({
  field,
  value,
  disabled,
  onChange,
}: {
  field: CustomField;
  value: string;
  disabled?: boolean;
  onChange: (fieldId: string, value: string) => void;
}) {
  const { t } = useTranslation();
  const { styles } = useIssueDetailTheme();
  const options = customFieldOptions(field);
  const selectedMultiOptions = new Set(splitMultiSelectValue(value));
  const isDisabled = disabled === true;

  const changeValue = (nextValue: string) => onChange(field.id, nextValue);

  let control: ReactNode;
  if (!isEditableCustomField(field)) {
    control = <Text style={styles.helperText}>{t('issueCustomFields.unsupported')}</Text>;
  } else if (field.type === 'select') {
    control =
      options.length > 0 ? (
        <View style={styles.choiceGrid}>
          <ChoiceButton
            label={t('common.none')}
            value=""
            selected={!value}
            disabled={isDisabled}
            onPress={changeValue}
          />
          {options.map((option) => (
            <ChoiceButton
              key={option}
              label={option}
              value={option}
              selected={value === option}
              disabled={isDisabled}
              onPress={changeValue}
            />
          ))}
        </View>
      ) : (
        <Text style={styles.helperText}>{t('issueCustomFields.noOptions')}</Text>
      );
  } else if (field.type === 'multi_select') {
    control =
      options.length > 0 ? (
        <View style={styles.choiceGrid}>
          <ChoiceButton
            label={t('common.none')}
            value=""
            selected={!value}
            disabled={isDisabled}
            onPress={changeValue}
          />
          {options.map((option) => (
            <ChoiceButton
              key={option}
              label={option}
              value={option}
              selected={selectedMultiOptions.has(option)}
              disabled={isDisabled}
              onPress={() => changeValue(toggleMultiSelectValue(value, option))}
            />
          ))}
        </View>
      ) : (
        <TextField
          value={value}
          onChangeText={changeValue}
          placeholder={t('issueCustomFields.multiSelectPlaceholder')}
          editable={!isDisabled}
          autoCapitalize="none"
        />
      );
  } else if (field.type === 'checkbox') {
    control = (
      <View style={styles.choiceGrid}>
        <ChoiceButton
          label={t('common.none')}
          value=""
          selected={!value}
          disabled={isDisabled}
          onPress={changeValue}
        />
        <ChoiceButton
          label={t('issueCustomFields.booleanTrue')}
          value="true"
          selected={value === 'true'}
          disabled={isDisabled}
          onPress={changeValue}
        />
        <ChoiceButton
          label={t('issueCustomFields.booleanFalse')}
          value="false"
          selected={value === 'false'}
          disabled={isDisabled}
          onPress={changeValue}
        />
      </View>
    );
  } else {
    const keyboardType =
      field.type === 'number'
        ? 'decimal-pad'
        : field.type === 'email'
          ? 'email-address'
          : field.type === 'url'
            ? 'url'
            : field.type === 'date'
              ? 'numbers-and-punctuation'
              : 'default';
    control = (
      <TextField
        value={value}
        onChangeText={changeValue}
        placeholder={
          field.type === 'date'
            ? t('issueCustomFields.datePlaceholder')
            : t('issueCustomFields.enterPlaceholder', { name: field.name.toLowerCase() })
        }
        editable={!isDisabled}
        keyboardType={keyboardType}
        autoCapitalize={field.type === 'email' || field.type === 'url' ? 'none' : 'sentences'}
      />
    );
  }

  return (
    <View style={styles.customFieldEditor}>
      <View style={styles.customFieldHeading}>
        <Text style={styles.customFieldLabel}>
          {field.name}
          {field.isRequired ? (
            <Text style={styles.requiredMarker}>{t('issueCustomFields.requiredMarker')}</Text>
          ) : null}
        </Text>
      </View>
      {field.description ? (
        <Text style={styles.customFieldDescription}>{field.description}</Text>
      ) : null}
      {control}
    </View>
  );
}

function SectionTitle({ icon: Icon, title }: { icon: LucideIcon; title: string }) {
  const { colors, styles } = useIssueDetailTheme();

  return (
    <View style={styles.sectionTitle}>
      <Icon size={16} color={colors.foreground} />
      <Text className="text-foreground text-base font-semibold">{title}</Text>
    </View>
  );
}

function commentAuthorId(comment: Comment): string | null {
  return comment.authorId ?? comment.createdBy ?? comment.author?.id ?? null;
}

function wasCommentEdited(comment: Comment): boolean {
  if (comment.edited !== undefined) return comment.edited;
  if (!comment.createdAt || !comment.updatedAt) return false;
  return new Date(comment.updatedAt).getTime() > new Date(comment.createdAt).getTime();
}

function CommentActionButton({
  label,
  icon: Icon,
  disabled,
  tone = 'neutral',
  onPress,
}: {
  label: string;
  icon: LucideIcon;
  disabled?: boolean;
  tone?: 'neutral' | 'primary' | 'destructive';
  onPress: () => void;
}) {
  const { colors, styles } = useIssueDetailTheme();
  const iconColor =
    tone === 'destructive'
      ? colors.destructive
      : tone === 'primary'
        ? colors.primaryForeground
        : colors.foreground;

  return (
    <Pressable
      accessibilityRole="button"
      disabled={disabled}
      onPress={onPress}
      style={[
        styles.commentAction,
        tone === 'primary' ? styles.commentActionPrimary : null,
        tone === 'destructive' ? styles.commentActionDestructive : null,
        disabled ? styles.commentActionDisabled : null,
      ]}
      className="active:opacity-80"
    >
      <Icon size={13} color={iconColor} />
      <Text
        style={[
          styles.commentActionText,
          tone === 'primary' ? styles.commentActionPrimaryText : null,
          tone === 'destructive' ? styles.commentActionDestructiveText : null,
        ]}
      >
        {label}
      </Text>
    </Pressable>
  );
}

function IssueHeader({
  issue,
  editing,
  draftTitle,
  draftDescription,
  draftPriority,
  draftAssigneeId,
  draftSprintId,
  draftEpicId,
  draftParentId,
  draftEstimate,
  draftDueDate,
  draftStartDate,
  draftStoryPoints,
  draftEnvironment,
  draftFlagged,
  draftResolution,
  draftLabels,
  draftComponentIds,
  draftFixVersionIds,
  draftAffectsVersionIds,
  draftCustomFieldValues,
  labelDraft,
  labelError,
  estimateError,
  dueDateError,
  startDateError,
  storyPointsError,
  projectMembers,
  sprints,
  sprintName,
  epicIssue,
  epicCandidates,
  parentIssue,
  parentCandidates,
  labels,
  components,
  issueComponents,
  workflowStatuses,
  versions,
  fixVersions,
  affectsVersions,
  customFields,
  customFieldValues,
  organizationId,
  membersLoading,
  sprintsLoading,
  epicCandidatesLoading,
  parentCandidatesLoading,
  labelsLoading,
  componentsLoading,
  workflowStatusesLoading,
  workflowStatusesError,
  versionsLoading,
  customFieldsLoading,
  customFieldsError,
  customFieldValuesLoading,
  customFieldValuesError,
  editError,
  titleError,
  updating,
  deleting,
  watchers,
  watchersLoading,
  watchersError,
  watching,
  watchMutating,
  watchError,
  onBeginEdit,
  onCancelEdit,
  onDeleteIssue,
  onOpenIssue,
  onOpenDocument,
  onToggleWatch,
  onSaveEdit,
  onChangeTitle,
  onChangeDescription,
  onChangePriority,
  onChangeAssignee,
  onChangeSprint,
  onChangeEpic,
  onChangeParent,
  onChangeEstimate,
  onChangeDueDate,
  onChangeStartDate,
  onChangeStoryPoints,
  onChangeEnvironment,
  onChangeFlagged,
  onChangeResolution,
  onToggleLabel,
  onToggleComponent,
  onToggleFixVersion,
  onToggleAffectsVersion,
  onChangeCustomFieldValue,
  onChangeLabelDraft,
  onAddLabel,
  onApplyDescription,
  onApplyLabels,
  onChangeStatusId,
  onChangeStatusCategory,
}: {
  issue: Issue;
  editing: boolean;
  draftTitle: string;
  draftDescription: string;
  draftPriority: IssuePriority;
  draftAssigneeId: string;
  draftSprintId: string;
  draftEpicId: string;
  draftParentId: string;
  draftEstimate: string;
  draftDueDate: string;
  draftStartDate: string;
  draftStoryPoints: string;
  draftEnvironment: string;
  draftFlagged: boolean;
  draftResolution: KnownIssueResolution | null;
  draftLabels: string[];
  draftComponentIds: string[];
  draftFixVersionIds: string[];
  draftAffectsVersionIds: string[];
  draftCustomFieldValues: CustomFieldDrafts;
  labelDraft: string;
  labelError?: string | null;
  estimateError?: string | null;
  dueDateError?: string | null;
  startDateError?: string | null;
  storyPointsError?: string | null;
  projectMembers: ProjectMember[];
  sprints: Sprint[];
  sprintName: string | null;
  epicIssue: Issue | null;
  epicCandidates: Issue[];
  parentIssue: Issue | null;
  parentCandidates: Issue[];
  labels: Label[];
  components: ProjectComponent[];
  issueComponents: ProjectComponent[];
  workflowStatuses: WorkflowStatus[];
  versions: ProjectVersion[];
  fixVersions: ProjectVersion[];
  affectsVersions: ProjectVersion[];
  customFields: CustomField[];
  customFieldValues: IssueCustomFieldValue[];
  organizationId: string | null;
  membersLoading: boolean;
  sprintsLoading: boolean;
  epicCandidatesLoading: boolean;
  parentCandidatesLoading: boolean;
  labelsLoading: boolean;
  componentsLoading: boolean;
  workflowStatusesLoading: boolean;
  workflowStatusesError: boolean;
  versionsLoading: boolean;
  customFieldsLoading: boolean;
  customFieldsError: boolean;
  customFieldValuesLoading: boolean;
  customFieldValuesError: boolean;
  editError?: string | null;
  titleError?: string | undefined;
  updating: boolean;
  deleting: boolean;
  watchers: Watcher[];
  watchersLoading: boolean;
  watchersError: boolean;
  watching: boolean;
  watchMutating: boolean;
  watchError: string | null | undefined;
  onBeginEdit: () => void;
  onCancelEdit: () => void;
  onDeleteIssue: () => void;
  onOpenIssue: (issueId: string) => void;
  onOpenDocument: (pageId: string) => void;
  onToggleWatch: () => void;
  onSaveEdit: () => void;
  onChangeTitle: (value: string) => void;
  onChangeDescription: (value: string) => void;
  onChangePriority: (value: IssuePriority) => void;
  onChangeAssignee: (userId: string) => void;
  onChangeSprint: (sprintId: string) => void;
  onChangeEpic: (epicId: string) => void;
  onChangeParent: (parentId: string) => void;
  onChangeEstimate: (value: string) => void;
  onChangeDueDate: (value: string) => void;
  onChangeStartDate: (value: string) => void;
  onChangeStoryPoints: (value: string) => void;
  onChangeEnvironment: (value: string) => void;
  onChangeFlagged: (value: boolean) => void;
  onChangeResolution: (value: KnownIssueResolution | null) => void;
  onToggleLabel: (name: string) => void;
  onToggleComponent: (componentId: string) => void;
  onToggleFixVersion: (versionId: string) => void;
  onToggleAffectsVersion: (versionId: string) => void;
  onChangeCustomFieldValue: (fieldId: string, value: string) => void;
  onChangeLabelDraft: (value: string) => void;
  onAddLabel: () => void;
  onApplyDescription: (text: string) => void;
  onApplyLabels: (labels: string[]) => void;
  onChangeStatusId: (statusId: string) => void;
  onChangeStatusCategory: (value: (typeof STATUS_CATEGORIES)[number]) => void;
}) {
  const { i18n, t } = useTranslation();
  const { colors, styles } = useIssueDetailTheme();
  const none = t('common.none');
  const currentStatusCategory = issue.status?.category;
  const selectedComponents = components.filter((component) =>
    draftComponentIds.includes(component.id),
  );
  const selectedFixVersions = versions.filter((version) => draftFixVersionIds.includes(version.id));
  const selectedAffectsVersions = versions.filter((version) =>
    draftAffectsVersionIds.includes(version.id),
  );
  const customFieldItems = customFieldItemsFromData(customFields, customFieldValues);
  const visibleCustomFieldItems = customFieldItems.filter((item) => item.value);

  return (
    <View style={styles.header}>
      <View style={styles.chips}>
        {issue.key ? <SemanticBadge label={issue.key} tone={ISSUE_TONE[issue.type]} /> : null}
        {issue.status?.name ? <SemanticBadge label={issue.status.name} /> : null}
        <SemanticBadge label={issue.type} tone={ISSUE_TONE[issue.type]} />
        {issue.priority ? <Flag size={16} color={PRIORITY_HEX[issue.priority]} /> : null}
      </View>

      {editing ? (
        <View style={styles.editPanel}>
          <TextField
            label={t('issues.titleLabel')}
            value={draftTitle}
            onChangeText={onChangeTitle}
            editable={!updating}
            error={titleError}
          />
          <TextField
            label={t('issue.description')}
            placeholder={t('issues.descriptionPlaceholder')}
            value={draftDescription}
            onChangeText={onChangeDescription}
            editable={!updating}
            multiline
            className="min-h-12"
          />
          <View style={styles.fieldPair}>
            <View style={styles.fieldPairItem}>
              <TextField
                label={t('issue.estimate')}
                placeholder={t('issue.estimatePlaceholder')}
                value={draftEstimate}
                onChangeText={onChangeEstimate}
                editable={!updating}
                keyboardType="decimal-pad"
                error={estimateError ?? undefined}
              />
            </View>
            <View style={styles.fieldPairItem}>
              <TextField
                label={t('issue.dueDate')}
                placeholder={t('issue.dueDatePlaceholder')}
                value={draftDueDate}
                onChangeText={onChangeDueDate}
                editable={!updating}
                keyboardType="numbers-and-punctuation"
                autoCapitalize="none"
                error={dueDateError ?? undefined}
              />
            </View>
          </View>
          <View style={styles.fieldPair}>
            <View style={styles.fieldPairItem}>
              <TextField
                label={t('issueFields.storyPoints')}
                placeholder={t('issueFields.storyPointsShort')}
                value={draftStoryPoints}
                onChangeText={onChangeStoryPoints}
                editable={!updating}
                keyboardType="number-pad"
                error={storyPointsError ?? undefined}
              />
            </View>
            <View style={styles.fieldPairItem}>
              <TextField
                label={t('issueFields.startDate')}
                placeholder={t('issue.dueDatePlaceholder')}
                value={draftStartDate}
                onChangeText={onChangeStartDate}
                editable={!updating}
                keyboardType="numbers-and-punctuation"
                autoCapitalize="none"
                error={startDateError ?? undefined}
              />
            </View>
          </View>
          <TextField
            label={t('issueFields.environment')}
            placeholder={t('issueFields.environmentPlaceholder')}
            value={draftEnvironment}
            onChangeText={onChangeEnvironment}
            editable={!updating}
            autoCapitalize="sentences"
          />
          <View style={styles.editorSection}>
            <SectionTitle icon={Flag} title={t('issue.priority')} />
            <View style={styles.choiceGrid}>
              {PRIORITIES.map((priority) => (
                <ChoiceButton
                  key={priority}
                  label={t(`priority.${priority}`)}
                  value={priority}
                  selected={draftPriority === priority}
                  disabled={updating}
                  onPress={onChangePriority}
                />
              ))}
            </View>
          </View>
          <View style={styles.editorSection}>
            <SectionTitle icon={Flag} title={t('issueFields.flagged')} />
            <View style={styles.choiceGrid}>
              <ChoiceButton
                label={t('issueFields.flag')}
                value="true"
                selected={draftFlagged}
                disabled={updating}
                onPress={() => onChangeFlagged(true)}
              />
              <ChoiceButton
                label={t('issueFields.unflag')}
                value="false"
                selected={!draftFlagged}
                disabled={updating}
                onPress={() => onChangeFlagged(false)}
              />
            </View>
          </View>
          <View style={styles.editorSection}>
            <SectionTitle icon={CheckCircle2} title={t('issueSidebar.resolution.label')} />
            <View style={styles.choiceGrid}>
              <ChoiceButton
                label={t('issueSidebar.resolution.unresolved')}
                value=""
                selected={draftResolution === null}
                disabled={updating}
                onPress={() => onChangeResolution(null)}
              />
              {RESOLUTION_VALUES.map((resolution) => (
                <ChoiceButton
                  key={resolution}
                  label={t(`issueSidebar.resolution.values.${resolution}`)}
                  value={resolution}
                  selected={draftResolution === resolution}
                  disabled={updating}
                  onPress={onChangeResolution}
                />
              ))}
            </View>
          </View>
          <View style={styles.editorSection}>
            <SectionTitle icon={User} title={t('issue.assignee')} />
            <View style={styles.assigneeList}>
              <AssigneeOption
                member={null}
                selected={!draftAssigneeId}
                disabled={updating}
                onPress={onChangeAssignee}
              />
              {projectMembers.map((member) => (
                <AssigneeOption
                  key={member.userId}
                  member={member}
                  selected={draftAssigneeId === member.userId}
                  disabled={updating}
                  onPress={onChangeAssignee}
                />
              ))}
            </View>
            {!membersLoading && projectMembers.length === 0 ? (
              <Text style={styles.helperText}>{t('issues.noAssignableMembers')}</Text>
            ) : null}
          </View>
          <View style={styles.editorSection}>
            <SectionTitle icon={Timer} title={t('sprints.label')} />
            <View style={styles.sprintChoiceList}>
              <ChoiceButton
                label={t('sprints.backlog')}
                value=""
                selected={!draftSprintId}
                disabled={updating}
                onPress={onChangeSprint}
              />
              {sprints.map((sprint) => {
                const dateRange = sprintDateRange(sprint, i18n.language);
                const statusLabel = isKnownSprintStatus(sprint.status)
                  ? t(`sprints.status.${sprint.status}`)
                  : sprint.status;
                return (
                  <Pressable
                    key={sprint.id}
                    accessibilityRole="button"
                    accessibilityState={{ selected: draftSprintId === sprint.id }}
                    disabled={updating}
                    onPress={() => onChangeSprint(sprint.id)}
                    style={[
                      styles.sprintChoice,
                      draftSprintId === sprint.id ? styles.sprintChoiceActive : null,
                      updating ? styles.choiceButtonDisabled : null,
                    ]}
                    className="active:opacity-80"
                  >
                    <View style={styles.sprintChoiceCopy}>
                      <Text style={styles.sprintChoiceName} numberOfLines={1}>
                        {sprint.name}
                      </Text>
                      {dateRange ? (
                        <Text style={styles.sprintChoiceMeta} numberOfLines={1}>
                          {dateRange}
                        </Text>
                      ) : null}
                    </View>
                    <SemanticBadge label={statusLabel} tone={sprintTone(sprint.status)} />
                  </Pressable>
                );
              })}
            </View>
            {!sprintsLoading && sprints.length === 0 ? (
              <Text style={styles.helperText}>{t('sprints.empty')}</Text>
            ) : null}
          </View>
          <EpicIssuePicker
            candidates={epicCandidates}
            selectedId={draftEpicId}
            loading={epicCandidatesLoading}
            disabled={updating}
            onChange={onChangeEpic}
          />
          <ParentIssuePicker
            candidates={parentCandidates}
            selectedId={draftParentId}
            loading={parentCandidatesLoading}
            disabled={updating}
            onChange={onChangeParent}
          />
          <View style={styles.editorSection}>
            <SectionTitle icon={Tag} title={t('issue.labels')} />
            {draftLabels.length > 0 ? (
              <View style={styles.selectedLabels}>
                {draftLabels.map((label) => (
                  <SelectedLabelChip
                    key={label}
                    name={label}
                    disabled={updating}
                    onRemove={onToggleLabel}
                  />
                ))}
              </View>
            ) : null}
            <View style={styles.labelListEditor}>
              {labels.map((label) => (
                <LabelOption
                  key={label.id}
                  label={label}
                  selected={draftLabels.includes(label.name)}
                  disabled={updating}
                  onPress={onToggleLabel}
                />
              ))}
            </View>
            {!labelsLoading && labels.length === 0 ? (
              <Text style={styles.helperText}>{t('issues.noLabels')}</Text>
            ) : null}
            <View style={styles.addLabelRow}>
              <View className="flex-1">
                <TextField
                  value={labelDraft}
                  onChangeText={onChangeLabelDraft}
                  placeholder={t('issues.labelPlaceholder')}
                  editable={!updating}
                  error={labelError ?? undefined}
                  returnKeyType="done"
                  onSubmitEditing={onAddLabel}
                />
              </View>
              <Button
                title={t('issues.addLabel')}
                variant="secondary"
                icon={Plus}
                disabled={updating || !labelDraft.trim()}
                onPress={onAddLabel}
              />
            </View>
          </View>
          <View style={styles.editorSection}>
            <SectionTitle icon={Boxes} title={t('issueSidebar.components.label')} />
            {selectedComponents.length > 0 ? (
              <View style={styles.selectedLabels}>
                {selectedComponents.map((component) => (
                  <SelectedComponentChip
                    key={component.id}
                    component={component}
                    disabled={updating}
                    onRemove={onToggleComponent}
                  />
                ))}
              </View>
            ) : null}
            <View style={styles.componentListEditor}>
              {components.map((component) => (
                <ComponentOption
                  key={component.id}
                  component={component}
                  selected={draftComponentIds.includes(component.id)}
                  disabled={updating}
                  onPress={onToggleComponent}
                />
              ))}
            </View>
            {!componentsLoading && components.length === 0 ? (
              <Text style={styles.helperText}>{t('issueSidebar.components.empty')}</Text>
            ) : null}
          </View>
          <View style={styles.editorSection}>
            <SectionTitle icon={Milestone} title={t('issueSidebar.versions.fixLabel')} />
            {selectedFixVersions.length > 0 ? (
              <View style={styles.selectedLabels}>
                {selectedFixVersions.map((version) => (
                  <SelectedVersionChip
                    key={version.id}
                    version={version}
                    disabled={updating}
                    onRemove={onToggleFixVersion}
                  />
                ))}
              </View>
            ) : null}
            <View style={styles.componentListEditor}>
              {versions.map((version) => (
                <VersionOption
                  key={version.id}
                  version={version}
                  selected={draftFixVersionIds.includes(version.id)}
                  disabled={updating}
                  onPress={onToggleFixVersion}
                />
              ))}
            </View>
            {!versionsLoading && versions.length === 0 ? (
              <Text style={styles.helperText}>{t('issueSidebar.versions.empty')}</Text>
            ) : null}
          </View>
          <View style={styles.editorSection}>
            <SectionTitle icon={Milestone} title={t('issueSidebar.versions.affectsLabel')} />
            {selectedAffectsVersions.length > 0 ? (
              <View style={styles.selectedLabels}>
                {selectedAffectsVersions.map((version) => (
                  <SelectedVersionChip
                    key={version.id}
                    version={version}
                    disabled={updating}
                    onRemove={onToggleAffectsVersion}
                  />
                ))}
              </View>
            ) : null}
            <View style={styles.componentListEditor}>
              {versions.map((version) => (
                <VersionOption
                  key={version.id}
                  version={version}
                  selected={draftAffectsVersionIds.includes(version.id)}
                  disabled={updating}
                  onPress={onToggleAffectsVersion}
                />
              ))}
            </View>
            {!versionsLoading && versions.length === 0 ? (
              <Text style={styles.helperText}>{t('issueSidebar.versions.empty')}</Text>
            ) : null}
          </View>
          <View style={styles.editorSection}>
            <SectionTitle icon={SlidersHorizontal} title={t('issueCustomFields.title')} />
            {customFieldsLoading || customFieldValuesLoading ? (
              <Text style={styles.helperText}>{t('common.loading')}</Text>
            ) : null}
            {customFieldsError || customFieldValuesError ? (
              <Text style={styles.commentError}>{t('issueCustomFields.loadFailed')}</Text>
            ) : null}
            {customFieldItems.map(({ field }) => (
              <CustomFieldEditor
                key={field.id}
                field={field}
                value={draftCustomFieldValues[field.id] ?? ''}
                disabled={updating}
                onChange={onChangeCustomFieldValue}
              />
            ))}
            {!customFieldsLoading && !customFieldValuesLoading && customFieldItems.length === 0 ? (
              <Text style={styles.helperText}>{t('issueCustomFields.empty')}</Text>
            ) : null}
          </View>
          {editError ? <Text className="text-destructive text-sm">{editError}</Text> : null}
          <View style={styles.editActions}>
            <Button
              title={t('common.cancel')}
              variant="secondary"
              icon={X}
              disabled={updating}
              onPress={onCancelEdit}
            />
            <Button
              title={t('common.save')}
              icon={Check}
              loading={updating}
              disabled={updating}
              onPress={onSaveEdit}
            />
          </View>
        </View>
      ) : (
        <>
          <View style={styles.titleBlock}>
            <Text className="text-foreground text-xl font-semibold" style={styles.title}>
              {issue.title}
            </Text>
            <View style={styles.titleActions}>
              <Pressable
                accessibilityRole="button"
                onPress={onBeginEdit}
                disabled={deleting}
                style={[styles.inlineAction, deleting ? styles.inlineActionDisabled : null]}
                className="active:opacity-80"
              >
                <Pencil size={14} color={colors.foreground} />
                <Text style={styles.inlineActionText}>{t('common.edit')}</Text>
              </Pressable>
              <Pressable
                accessibilityRole="button"
                onPress={onDeleteIssue}
                disabled={deleting}
                style={[
                  styles.inlineAction,
                  styles.inlineActionDestructive,
                  deleting ? styles.inlineActionDisabled : null,
                ]}
                className="active:opacity-80"
              >
                <Trash2 size={14} color={colors.destructive} />
                <Text style={styles.inlineActionDestructiveText}>{t('issue.deleteIssue')}</Text>
              </Pressable>
            </View>
          </View>

          {issue.description ? (
            <Text className="text-muted-foreground text-sm" style={styles.description}>
              {issue.description}
            </Text>
          ) : null}
        </>
      )}

      <View style={styles.details}>
        <DetailRow icon={User} label={t('issue.assignee')}>
          <PersonValue user={issue.assignee} fallback={none} />
        </DetailRow>
        <DetailRow icon={User} label={t('issue.reporter')}>
          <PersonValue user={issue.reporter} fallback={none} />
        </DetailRow>
        <DetailRow icon={Flag} label={t('issue.priority')}>
          <Text className="text-foreground text-sm">{issue.priority ?? none}</Text>
        </DetailRow>
        <DetailRow icon={Flag} label={t('issueFields.flagged')}>
          <Text
            className={issue.flagged ? 'text-foreground text-sm' : 'text-muted-foreground text-sm'}
          >
            {issue.flagged ? t('issueFields.flagged') : t('issueFields.unflagged')}
          </Text>
        </DetailRow>
        <DetailRow icon={CircleDot} label={t('issue.status')}>
          <Text className="text-foreground text-sm">{issue.status?.name ?? none}</Text>
        </DetailRow>
        <DetailRow icon={CheckCircle2} label={t('issueSidebar.resolution.label')}>
          <View style={styles.resolutionValue}>
            <Text
              className={
                issue.resolution ? 'text-foreground text-sm' : 'text-muted-foreground text-sm'
              }
              numberOfLines={1}
            >
              {resolutionLabel(issue.resolution, t)}
            </Text>
            {issue.resolution && issue.resolvedAt ? (
              <Text style={styles.resolvedAtText} numberOfLines={1}>
                {t('issueSidebar.resolution.resolvedOn', {
                  date: formatSprintDate(issue.resolvedAt, i18n.language),
                })}
              </Text>
            ) : null}
          </View>
        </DetailRow>
        <DetailRow icon={Timer} label={t('sprints.label')}>
          <Text className="text-foreground text-sm" numberOfLines={1}>
            {sprintName ?? t('sprints.backlog')}
          </Text>
        </DetailRow>
        <DetailRow icon={Zap} label={t('issueEpic.title')}>
          <IssueReferenceValue
            issue={epicIssue}
            issueId={issue.epicId}
            loading={epicCandidatesLoading}
            fallback={none}
            loadingLabel={t('common.loading')}
            unavailableLabel={t('issueEpic.unavailable')}
            onOpenIssue={onOpenIssue}
          />
        </DetailRow>
        <DetailRow icon={GitBranch} label={t('issueParent.title')}>
          <IssueReferenceValue
            issue={parentIssue}
            issueId={issue.parentId}
            loading={parentCandidatesLoading}
            fallback={none}
            loadingLabel={t('common.loading')}
            unavailableLabel={t('issueParent.unavailable')}
            onOpenIssue={onOpenIssue}
          />
        </DetailRow>
        <DetailRow icon={Timer} label={t('issue.estimate')}>
          <Text className="text-foreground text-sm">
            {issue.estimate !== null && issue.estimate !== undefined ? issue.estimate : none}
          </Text>
        </DetailRow>
        <DetailRow icon={Timer} label={t('issueFields.storyPoints')}>
          <Text className="text-foreground text-sm">
            {issue.storyPoints !== null && issue.storyPoints !== undefined
              ? issue.storyPoints
              : none}
          </Text>
        </DetailRow>
        <DetailRow icon={Calendar} label={t('issueFields.startDate')}>
          <Text className="text-foreground text-sm">
            {formatSprintDate(
              issueCustomFieldString(issue.customFields, 'startDate'),
              i18n.language,
            ) || none}
          </Text>
        </DetailRow>
        <DetailRow icon={Calendar} label={t('issue.dueDate')}>
          <Text className="text-foreground text-sm">
            {formatSprintDate(issue.dueDate, i18n.language) || none}
          </Text>
        </DetailRow>
        <DetailRow icon={SlidersHorizontal} label={t('issueFields.environment')}>
          <Text
            className={
              issueCustomFieldString(issue.customFields, 'environment')
                ? 'text-foreground text-sm'
                : 'text-muted-foreground text-sm'
            }
            numberOfLines={2}
            style={styles.customFieldDetailText}
          >
            {issueCustomFieldString(issue.customFields, 'environment') ?? none}
          </Text>
        </DetailRow>
        <DetailRow icon={Calendar} label={t('issue.created')}>
          <Text className="text-foreground text-sm">{relativeTime(issue.createdAt) || none}</Text>
        </DetailRow>
        <DetailRow icon={Calendar} label={t('issue.updated')}>
          <Text className="text-foreground text-sm">{relativeTime(issue.updatedAt) || none}</Text>
        </DetailRow>
        <DetailRow icon={Tag} label={t('issue.labels')}>
          <IssueLabelChips labels={issue.labels ?? []} fallback={none} />
        </DetailRow>
        <DetailRow icon={Boxes} label={t('issueSidebar.components.label')}>
          <IssueComponentChips components={issueComponents} fallback={none} />
        </DetailRow>
        <DetailRow icon={Milestone} label={t('issueSidebar.versions.fixLabel')}>
          <IssueVersionChips versions={fixVersions} fallback={none} />
        </DetailRow>
        <DetailRow icon={Milestone} label={t('issueSidebar.versions.affectsLabel')}>
          <IssueVersionChips versions={affectsVersions} fallback={none} />
        </DetailRow>
        {customFieldValuesLoading ? (
          <DetailRow icon={SlidersHorizontal} label={t('issueCustomFields.title')}>
            <Text style={styles.mutedValue}>{t('common.loading')}</Text>
          </DetailRow>
        ) : null}
        {customFieldValuesError ? (
          <DetailRow icon={SlidersHorizontal} label={t('issueCustomFields.title')}>
            <Text style={styles.commentError}>{t('issueCustomFields.loadFailed')}</Text>
          </DetailRow>
        ) : null}
        {visibleCustomFieldItems.map(({ field, value }) => (
          <DetailRow key={field.id} icon={SlidersHorizontal} label={field.name}>
            <Text
              className={value ? 'text-foreground text-sm' : 'text-muted-foreground text-sm'}
              numberOfLines={2}
              style={styles.customFieldDetailText}
            >
              {formatCustomFieldValue(field, value, t)}
            </Text>
          </DetailRow>
        ))}
      </View>

      <IssueTriagePanel issueId={issue.id} organizationId={organizationId} />

      <IssueAssistPanel
        issueId={issue.id}
        organizationId={organizationId}
        onApplyDescription={onApplyDescription}
        onApplyLabels={onApplyLabels}
      />

      <IssueAgentPanel issue={issue} />

      <TimeTrackingPanel issue={issue} />

      <TimeInStatusPanel issueId={issue.id} />

      <IssueSubtasksPanel issue={issue} onOpenIssue={onOpenIssue} />

      <IssueDocsPanel issue={issue} onOpenDocument={onOpenDocument} />

      <IssueAttachmentsPanel issueId={issue.id} />

      <IssueActivityPanel issueId={issue.id} />

      <IssueLinksPanel issueId={issue.id} projectId={issue.projectId} onOpenIssue={onOpenIssue} />

      <WatchersPanel
        error={watchersError}
        loading={watchersLoading}
        mutating={watchMutating}
        watching={watching}
        watchError={watchError}
        watchers={watchers}
        onToggleWatch={onToggleWatch}
      />

      <View style={styles.workflowPanel}>
        <SectionTitle icon={Workflow} title={t('issue.workflow')} />
        {workflowStatuses.length > 0 ? (
          <View style={styles.workflowStatusList}>
            {workflowStatuses.map((status) => (
              <WorkflowStatusOption
                key={status.id}
                status={status}
                selected={issue.statusId === status.id || issue.status?.id === status.id}
                disabled={updating}
                onPress={onChangeStatusId}
              />
            ))}
          </View>
        ) : (
          <View style={styles.choiceGrid}>
            {STATUS_CATEGORIES.map((status) => (
              <ChoiceButton
                key={status}
                label={t(`statusCategory.${status}`)}
                value={status}
                selected={currentStatusCategory === status}
                disabled={updating}
                onPress={onChangeStatusCategory}
              />
            ))}
          </View>
        )}
        {workflowStatusesLoading ? (
          <Text style={styles.helperText}>{t('common.loading')}</Text>
        ) : null}
        {workflowStatusesError ? (
          <Text style={styles.commentError}>{t('issue.workflowStatusesLoadFailed')}</Text>
        ) : null}
        {!editing && editError ? (
          <Text className="text-destructive text-sm">{editError}</Text>
        ) : null}
      </View>

      <View style={styles.commentsTitle}>
        <MessageSquare size={16} color={colors.foreground} />
        <Text className="text-foreground text-base font-semibold">{t('issue.comments')}</Text>
      </View>
    </View>
  );
}

function CommentMentionPicker({
  members,
  selectedIds,
  loading,
  disabled,
  onToggleMention,
}: {
  members: ProjectMember[];
  selectedIds: string[];
  loading: boolean;
  disabled: boolean;
  onToggleMention: (member: ProjectMember) => void;
}) {
  const { t } = useTranslation();
  const { styles } = useIssueDetailTheme();
  const selectedMentionMembers = mentionedMembers(selectedIds, members);
  const selectedMemberIds = new Set(
    selectedMentionMembers.map((member) => projectMemberMentionId(member)),
  );
  const visibleMembers = [
    ...selectedMentionMembers,
    ...members
      .filter((member) => !selectedMemberIds.has(projectMemberMentionId(member)))
      .slice(0, Math.max(0, 8 - selectedMentionMembers.length)),
  ];

  if (!loading && visibleMembers.length === 0) return null;

  return (
    <View style={styles.commentMentionPanel}>
      <View style={styles.commentMentionHeader}>
        <Text style={styles.commentMentionTitle}>{t('issue.mentions')}</Text>
        {selectedMentionMembers.length > 0 ? (
          <Text style={styles.commentMentionCount}>
            {t('issue.mentionCount', { count: selectedMentionMembers.length })}
          </Text>
        ) : null}
      </View>
      {loading ? <Text style={styles.helperText}>{t('common.loading')}</Text> : null}
      {visibleMembers.length > 0 ? (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.commentMentionList}
        >
          {visibleMembers.map((member) => {
            const mentionId = projectMemberMentionId(member);
            const isSelected = selectedIds.includes(mentionId);
            const name = projectMemberName(member);
            return (
              <Pressable
                key={member.id}
                accessibilityRole="button"
                accessibilityState={{ selected: isSelected, disabled }}
                accessibilityLabel={t('issue.toggleMention', { name })}
                disabled={disabled}
                onPress={() => onToggleMention(member)}
                style={[
                  styles.commentMentionChip,
                  isSelected ? styles.commentMentionChipActive : null,
                  disabled ? styles.commentActionDisabled : null,
                ]}
              >
                <Avatar initials={initials(member.user.name, member.user.email)} size={20} />
                <Text
                  numberOfLines={1}
                  style={[
                    styles.commentMentionChipText,
                    isSelected ? styles.commentMentionChipTextActive : null,
                  ]}
                >
                  {mentionToken(name)}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>
      ) : null}
    </View>
  );
}

function CommentMentionChips({
  mentionIds,
  members,
}: {
  mentionIds?: string[] | undefined;
  members: ProjectMember[];
}) {
  const { styles } = useIssueDetailTheme();
  const selected = mentionedMembers(mentionIds, members);
  if (selected.length === 0) return null;
  return (
    <View style={styles.commentMentionChips}>
      {selected.map((member) => (
        <View key={member.id} style={styles.commentMentionReadChip}>
          <Text style={styles.commentMentionReadChipText}>
            {mentionToken(projectMemberName(member))}
          </Text>
        </View>
      ))}
    </View>
  );
}

function CommentRow({
  comment,
  currentUserId,
  draft,
  editing,
  error,
  saving,
  deleting,
  reactionBusy,
  projectMembers,
  membersLoading,
  selectedMentionIds,
  fallback,
  reactionError,
  onBeginEdit,
  onCancelEdit,
  onChangeDraft,
  onDelete,
  onSaveEdit,
  onToggleMention,
  onToggleReaction,
}: {
  comment: Comment;
  currentUserId: string | null;
  draft: string;
  editing: boolean;
  error?: string | null;
  saving: boolean;
  deleting: boolean;
  reactionBusy: boolean;
  projectMembers: ProjectMember[];
  membersLoading: boolean;
  selectedMentionIds: string[];
  fallback: string;
  reactionError?: string | null;
  onBeginEdit: (comment: Comment) => void;
  onCancelEdit: () => void;
  onChangeDraft: (value: string) => void;
  onDelete: (comment: Comment) => void;
  onSaveEdit: (comment: Comment) => void;
  onToggleMention: (member: ProjectMember) => void;
  onToggleReaction: (comment: Comment, emoji: string) => void;
}) {
  const { t } = useTranslation();
  const { colors, styles } = useIssueDetailTheme();
  const [reactionPickerOpen, setReactionPickerOpen] = useState(false);
  const canModify = currentUserId !== null && commentAuthorId(comment) === currentUserId;
  const edited = wasCommentEdited(comment);
  const reactionGroups = groupCommentReactions(comment.reactions, currentUserId);
  const canReact = currentUserId !== null;

  const toggleReaction = (emoji: string) => {
    if (!canReact || reactionBusy) return;
    setReactionPickerOpen(false);
    onToggleReaction(comment, emoji);
  };

  return (
    <View style={styles.commentRow}>
      <Avatar initials={initials(comment.author?.name, comment.author?.email)} size={32} />
      <View className="flex-1 gap-2">
        <View className="flex-row items-center gap-2">
          <Text className="text-foreground text-sm font-semibold">
            {comment.author?.name ?? comment.author?.email ?? fallback}
          </Text>
          {comment.createdAt ? (
            <Text className="text-muted-foreground text-xs">{relativeTime(comment.createdAt)}</Text>
          ) : null}
          {edited ? <Text style={styles.commentEdited}>{t('issue.commentEdited')}</Text> : null}
        </View>
        {editing ? (
          <View style={styles.commentEditor}>
            <TextField
              label={t('issue.commentLabel')}
              value={draft}
              onChangeText={onChangeDraft}
              placeholder={t('issue.commentPlaceholder')}
              editable={!saving}
              multiline
              className="min-h-12"
            />
            <CommentMentionPicker
              members={projectMembers}
              selectedIds={selectedMentionIds}
              loading={membersLoading}
              disabled={saving}
              onToggleMention={onToggleMention}
            />
            {error ? <Text style={styles.commentError}>{error}</Text> : null}
            <View style={styles.commentActions}>
              <CommentActionButton
                label={t('common.cancel')}
                icon={X}
                disabled={saving}
                onPress={onCancelEdit}
              />
              <CommentActionButton
                label={t('common.save')}
                icon={Check}
                tone="primary"
                disabled={saving || !draft.trim()}
                onPress={() => onSaveEdit(comment)}
              />
            </View>
          </View>
        ) : (
          <>
            <Text className="text-foreground text-sm">{comment.content}</Text>
            <CommentMentionChips mentionIds={comment.mentions} members={projectMembers} />
            {error ? <Text style={styles.commentError}>{error}</Text> : null}
            {canReact || reactionGroups.length > 0 ? (
              <View style={styles.commentReactions}>
                {reactionGroups.map((group) => (
                  <Pressable
                    key={`${comment.id}-${group.emoji}`}
                    accessibilityRole="button"
                    accessibilityState={{ selected: group.reactedByMe, disabled: reactionBusy }}
                    accessibilityLabel={t('issue.reactionSummary', {
                      emoji: group.emoji,
                      count: group.count,
                    })}
                    disabled={!canReact || reactionBusy}
                    onPress={() => toggleReaction(group.emoji)}
                    style={[
                      styles.commentReactionPill,
                      group.reactedByMe ? styles.commentReactionPillActive : null,
                      reactionBusy ? styles.commentActionDisabled : null,
                    ]}
                  >
                    <Text style={styles.commentReactionEmoji}>{group.emoji}</Text>
                    <Text
                      style={[
                        styles.commentReactionCount,
                        group.reactedByMe ? styles.commentReactionCountActive : null,
                      ]}
                    >
                      {group.count}
                    </Text>
                  </Pressable>
                ))}
                {canReact ? (
                  <Pressable
                    accessibilityRole="button"
                    accessibilityState={{ expanded: reactionPickerOpen, disabled: reactionBusy }}
                    accessibilityLabel={t('issue.addReaction')}
                    disabled={reactionBusy}
                    onPress={() => setReactionPickerOpen((open) => !open)}
                    style={[
                      styles.commentReactionAdd,
                      reactionPickerOpen ? styles.commentReactionAddActive : null,
                      reactionBusy ? styles.commentActionDisabled : null,
                    ]}
                  >
                    <SmilePlus
                      size={15}
                      color={reactionPickerOpen ? colors.primary : colors.mutedForeground}
                    />
                  </Pressable>
                ) : null}
              </View>
            ) : null}
            {canReact && reactionPickerOpen ? (
              <View style={styles.commentReactionPicker}>
                {COMMENT_REACTION_EMOJIS.map((emoji) => {
                  const mine = reactionGroups.some(
                    (group) => group.emoji === emoji && group.reactedByMe,
                  );
                  return (
                    <Pressable
                      key={`${comment.id}-${emoji}-picker`}
                      accessibilityRole="button"
                      accessibilityState={{ selected: mine, disabled: reactionBusy }}
                      accessibilityLabel={t('issue.selectReaction', { emoji })}
                      disabled={reactionBusy}
                      onPress={() => toggleReaction(emoji)}
                      style={[
                        styles.commentReactionChoice,
                        mine ? styles.commentReactionChoiceActive : null,
                        reactionBusy ? styles.commentActionDisabled : null,
                      ]}
                    >
                      <Text style={styles.commentReactionChoiceText}>{emoji}</Text>
                    </Pressable>
                  );
                })}
              </View>
            ) : null}
            {reactionError ? <Text style={styles.commentError}>{reactionError}</Text> : null}
            {canModify ? (
              <View style={styles.commentActions}>
                <CommentActionButton
                  label={t('common.edit')}
                  icon={Pencil}
                  disabled={deleting}
                  onPress={() => onBeginEdit(comment)}
                />
                <CommentActionButton
                  label={t('issue.deleteComment')}
                  icon={Trash2}
                  tone="destructive"
                  disabled={deleting}
                  onPress={() => onDelete(comment)}
                />
              </View>
            ) : null}
          </>
        )}
      </View>
    </View>
  );
}

type IssueDetailProps = NativeStackScreenProps<AppStackParamList, 'IssueDetail'>;

export function IssueDetailScreen({ navigation, route }: IssueDetailProps) {
  const { t } = useTranslation();
  const { styles } = useIssueDetailTheme();
  const { id } = route.params;

  const issueQ = useIssue(id);
  const issueProjectId = issueQ.data?.projectId ?? '';
  const projectQ = useProject(issueProjectId);
  const parentIssuesQ = useProjectIssues(issueProjectId || null);
  const organizationId = issueQ.data?.organizationId ?? projectQ.data?.organizationId ?? null;
  const membersQ = useProjectMembers(issueProjectId || null);
  const labelsQ = useLabels(organizationId, issueProjectId || null);
  const customFieldsQ = useCustomFields(
    organizationId && issueProjectId ? { organizationId, projectId: issueProjectId } : null,
  );
  const componentsQ = useProjectComponents(issueProjectId || null);
  const issueComponentsQ = useIssueComponents(id);
  const issueCustomFieldValuesQ = useIssueCustomFieldValues(id);
  const workflowStatusesQ = useProjectWorkflowStatuses(issueProjectId || null);
  const projectVersionsQ = useProjectVersions(issueProjectId || null);
  const issueVersionsQ = useIssueVersions(id);
  const sprintsQ = useSprints(issueProjectId || null);
  const commentsQ = useComments(id);
  const watchersQ = useIssueWatchers(id);
  const meQ = useMe();
  const addComment = useAddComment(id);
  const addIssueWatcher = useAddIssueWatcher(id);
  const updateComment = useUpdateComment(id);
  const deleteComment = useDeleteComment(id);
  const toggleCommentReaction = useToggleCommentReaction(id);
  const updateIssue = useUpdateIssue(id);
  const setIssueComponents = useSetIssueComponents(id);
  const setIssueVersions = useSetIssueVersions(id);
  const setIssueCustomFieldValue = useSetIssueCustomFieldValue(id);
  const deleteIssue = useDeleteIssue(id);
  const removeIssueWatcher = useRemoveIssueWatcher(id);
  const sessionUser = useSession((s) => s.user);
  const projectIssues = useMemo(() => parentIssuesQ.data ?? [], [parentIssuesQ.data]);
  const epicIssue = useMemo(() => {
    const epicId = issueQ.data?.epicId;
    if (!epicId) return null;
    return projectIssues.find((candidate) => candidate.id === epicId) ?? null;
  }, [issueQ.data?.epicId, projectIssues]);
  const epicCandidates = useMemo(() => {
    const currentIssueId = issueQ.data?.id;
    return projectIssues.filter(
      (candidate) => candidate.type === 'epic' && candidate.id !== currentIssueId,
    );
  }, [issueQ.data?.id, projectIssues]);
  const parentIssue = useMemo(() => {
    const parentId = issueQ.data?.parentId;
    if (!parentId) return null;
    return projectIssues.find((candidate) => candidate.id === parentId) ?? null;
  }, [issueQ.data?.parentId, projectIssues]);
  const parentCandidates = useMemo(() => {
    const currentIssue = issueQ.data;
    if (!currentIssue) return [];
    const excludedIds = collectExcludedParentIds(projectIssues, currentIssue.id);
    return projectIssues.filter((candidate) => !excludedIds.has(candidate.id));
  }, [issueQ.data, projectIssues]);
  const projectMembers = useMemo(() => membersQ.data ?? [], [membersQ.data]);
  const labels = useMemo(() => labelsQ.data ?? [], [labelsQ.data]);
  const issueComponents = useMemo(() => issueComponentsQ.data ?? [], [issueComponentsQ.data]);
  const issueCustomFieldValues = useMemo(
    () => issueCustomFieldValuesQ.data ?? [],
    [issueCustomFieldValuesQ.data],
  );
  const customFields = useMemo(
    () =>
      customFieldItemsFromData(customFieldsQ.data ?? [], issueCustomFieldValues).map(
        (item) => item.field,
      ),
    [customFieldsQ.data, issueCustomFieldValues],
  );
  const components = useMemo(() => {
    const selectedIds = new Set(issueComponents.map((component) => component.id));
    return (componentsQ.data ?? []).filter(
      (component) => !component.archived || selectedIds.has(component.id),
    );
  }, [componentsQ.data, issueComponents]);
  const workflowStatuses = useMemo(() => workflowStatusesQ.data ?? [], [workflowStatusesQ.data]);
  const fixVersions = useMemo(
    () => issueVersionsQ.data?.fixVersions ?? [],
    [issueVersionsQ.data?.fixVersions],
  );
  const affectsVersions = useMemo(
    () => issueVersionsQ.data?.affectsVersions ?? [],
    [issueVersionsQ.data?.affectsVersions],
  );
  const versions = useMemo(() => {
    const selectedIds = new Set([
      ...fixVersions.map((version) => version.id),
      ...affectsVersions.map((version) => version.id),
    ]);
    const byId = new Map<string, ProjectVersion>();
    for (const version of projectVersionsQ.data ?? []) {
      if (version.status !== 'archived' || selectedIds.has(version.id)) {
        byId.set(version.id, version);
      }
    }
    for (const version of [...fixVersions, ...affectsVersions]) {
      if (!byId.has(version.id)) byId.set(version.id, version);
    }
    return Array.from(byId.values());
  }, [affectsVersions, fixVersions, projectVersionsQ.data]);
  const allSprints = useMemo(() => sprintsQ.data ?? [], [sprintsQ.data]);
  const editableSprints = useMemo(
    () =>
      allSprints.filter(
        (sprint) =>
          sprint.status === 'active' ||
          sprint.status === 'planned' ||
          sprint.id === issueQ.data?.sprintId,
      ),
    [allSprints, issueQ.data?.sprintId],
  );
  const currentSprintName =
    allSprints.find((sprint) => sprint.id === issueQ.data?.sprintId)?.name ?? null;
  const watchers = useMemo(() => watchersQ.data ?? [], [watchersQ.data]);
  const currentUserId = meQ.data?.id ?? sessionUser?.id ?? null;
  const isWatchingIssue = useMemo(
    () => currentUserId !== null && watchers.some((watcher) => watcher.userId === currentUserId),
    [currentUserId, watchers],
  );

  const [draft, setDraft] = useState('');
  const [draftMentionIds, setDraftMentionIds] = useState<string[]>([]);
  const [editingCommentId, setEditingCommentId] = useState<string | null>(null);
  const [commentDraft, setCommentDraft] = useState('');
  const [commentMentionIds, setCommentMentionIds] = useState<string[]>([]);
  const [commentError, setCommentError] = useState<{ commentId: string; message: string } | null>(
    null,
  );
  const [commentReactionError, setCommentReactionError] = useState<{
    commentId: string;
    message: string;
  } | null>(null);
  const [deletingCommentId, setDeletingCommentId] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [draftTitle, setDraftTitle] = useState('');
  const [draftDescription, setDraftDescription] = useState('');
  const [draftPriority, setDraftPriority] = useState<IssuePriority>('medium');
  const [draftAssigneeId, setDraftAssigneeId] = useState('');
  const [draftSprintId, setDraftSprintId] = useState('');
  const [draftEpicId, setDraftEpicId] = useState('');
  const [draftParentId, setDraftParentId] = useState('');
  const [draftEstimate, setDraftEstimate] = useState('');
  const [draftDueDate, setDraftDueDate] = useState('');
  const [draftStartDate, setDraftStartDate] = useState('');
  const [draftStoryPoints, setDraftStoryPoints] = useState('');
  const [draftEnvironment, setDraftEnvironment] = useState('');
  const [draftFlagged, setDraftFlagged] = useState(false);
  const [draftResolution, setDraftResolution] = useState<KnownIssueResolution | null>(null);
  const [draftLabels, setDraftLabels] = useState<string[]>([]);
  const [draftComponentIds, setDraftComponentIds] = useState<string[]>([]);
  const [draftFixVersionIds, setDraftFixVersionIds] = useState<string[]>([]);
  const [draftAffectsVersionIds, setDraftAffectsVersionIds] = useState<string[]>([]);
  const [draftCustomFieldValues, setDraftCustomFieldValues] = useState<CustomFieldDrafts>({});
  const [labelDraft, setLabelDraft] = useState('');
  const [labelError, setLabelError] = useState<string | null>(null);
  const [estimateError, setEstimateError] = useState<string | null>(null);
  const [dueDateError, setDueDateError] = useState<string | null>(null);
  const [startDateError, setStartDateError] = useState<string | null>(null);
  const [storyPointsError, setStoryPointsError] = useState<string | null>(null);
  const [titleError, setTitleError] = useState<string | undefined>();
  const [editError, setEditError] = useState<string | null>(null);
  const [watchError, setWatchError] = useState<string | null>(null);

  useEffect(() => {
    const issue = issueQ.data;
    if (!issue || editing) return;
    setDraftTitle(issue.title);
    setDraftDescription(issue.description ?? '');
    setDraftPriority(issue.priority ?? 'medium');
    setDraftAssigneeId(issue.assigneeId ?? '');
    setDraftSprintId(issue.sprintId ?? '');
    setDraftEpicId(issue.epicId ?? '');
    setDraftParentId(issue.parentId ?? '');
    setDraftEstimate(formatEstimateValue(issue.estimate));
    setDraftDueDate(dateToInputValue(issue.dueDate));
    setDraftStartDate(dateToInputValue(issueCustomFieldString(issue.customFields, 'startDate')));
    setDraftStoryPoints(formatEstimateValue(issue.storyPoints));
    setDraftEnvironment(issueCustomFieldString(issue.customFields, 'environment') ?? '');
    setDraftFlagged(issue.flagged === true);
    setDraftResolution(normalizeResolution(issue.resolution));
    setDraftLabels(issue.labels ?? []);
    setDraftComponentIds(issueComponents.map((component) => component.id));
    setDraftFixVersionIds(fixVersions.map((version) => version.id));
    setDraftAffectsVersionIds(affectsVersions.map((version) => version.id));
    setDraftCustomFieldValues(customFieldDraftsFromValues(customFields, issueCustomFieldValues));
    setLabelDraft('');
    setLabelError(null);
    setEstimateError(null);
    setDueDateError(null);
    setStartDateError(null);
    setStoryPointsError(null);
  }, [
    affectsVersions,
    customFields,
    editing,
    fixVersions,
    issueComponents,
    issueCustomFieldValues,
    issueQ.data,
  ]);

  const beginEdit = () => {
    const issue = issueQ.data;
    if (!issue) return;
    setDraftTitle(issue.title);
    setDraftDescription(issue.description ?? '');
    setDraftPriority(issue.priority ?? 'medium');
    setDraftAssigneeId(issue.assigneeId ?? '');
    setDraftSprintId(issue.sprintId ?? '');
    setDraftEpicId(issue.epicId ?? '');
    setDraftParentId(issue.parentId ?? '');
    setDraftEstimate(formatEstimateValue(issue.estimate));
    setDraftDueDate(dateToInputValue(issue.dueDate));
    setDraftStartDate(dateToInputValue(issueCustomFieldString(issue.customFields, 'startDate')));
    setDraftStoryPoints(formatEstimateValue(issue.storyPoints));
    setDraftEnvironment(issueCustomFieldString(issue.customFields, 'environment') ?? '');
    setDraftFlagged(issue.flagged === true);
    setDraftResolution(normalizeResolution(issue.resolution));
    setDraftLabels(issue.labels ?? []);
    setDraftComponentIds(issueComponents.map((component) => component.id));
    setDraftFixVersionIds(fixVersions.map((version) => version.id));
    setDraftAffectsVersionIds(affectsVersions.map((version) => version.id));
    setDraftCustomFieldValues(customFieldDraftsFromValues(customFields, issueCustomFieldValues));
    setLabelDraft('');
    setLabelError(null);
    setEstimateError(null);
    setDueDateError(null);
    setStartDateError(null);
    setStoryPointsError(null);
    setTitleError(undefined);
    setEditError(null);
    setEditing(true);
  };

  const cancelEdit = () => {
    setEditing(false);
    setLabelDraft('');
    setLabelError(null);
    setEstimateError(null);
    setDueDateError(null);
    setStartDateError(null);
    setStoryPointsError(null);
    setTitleError(undefined);
    setEditError(null);
  };

  const toggleIssueLabel = (name: string) => {
    setLabelError(null);
    setDraftLabels((current) =>
      current.includes(name) ? current.filter((label) => label !== name) : [...current, name],
    );
  };

  const toggleIssueComponent = (componentId: string) => {
    setDraftComponentIds((current) =>
      current.includes(componentId)
        ? current.filter((selectedId) => selectedId !== componentId)
        : [...current, componentId],
    );
  };

  const toggleFixVersion = (versionId: string) => {
    setDraftFixVersionIds((current) =>
      current.includes(versionId)
        ? current.filter((selectedId) => selectedId !== versionId)
        : [...current, versionId],
    );
  };

  const toggleAffectsVersion = (versionId: string) => {
    setDraftAffectsVersionIds((current) =>
      current.includes(versionId)
        ? current.filter((selectedId) => selectedId !== versionId)
        : [...current, versionId],
    );
  };

  const changeCustomFieldValue = (fieldId: string, value: string) => {
    setDraftCustomFieldValues((current) => ({ ...current, [fieldId]: value }));
    setEditError(null);
  };

  const addIssueLabel = () => {
    const next = labelDraft.trim();
    if (!next) return;
    if (next.length > 100) {
      setLabelError(t('validation.labelTooLong'));
      return;
    }
    setDraftLabels((current) => (current.includes(next) ? current : [...current, next]));
    setLabelDraft('');
    setLabelError(null);
  };

  const saveEdit = async () => {
    const title = draftTitle.trim();
    if (!title) {
      setTitleError(t('validation.titleRequired'));
      return;
    }

    setTitleError(undefined);
    setEstimateError(null);
    setDueDateError(null);
    setStartDateError(null);
    setStoryPointsError(null);
    setEditError(null);
    const estimate = parseEstimateInput(draftEstimate);
    const dueDate = draftDueDate.trim() ? dueDateInputToIso(draftDueDate) : null;
    const storyPoints = parseStoryPointsInput(draftStoryPoints);
    const startDate = draftStartDate.trim() ? dueDateInputToIso(draftStartDate) : null;
    if (Number.isNaN(estimate)) {
      setEstimateError(t('issue.invalidEstimate'));
      return;
    }
    if (draftDueDate.trim() && !dueDate) {
      setDueDateError(t('issue.invalidDueDate'));
      return;
    }
    if (Number.isNaN(storyPoints)) {
      setStoryPointsError(t('issueFields.invalidStoryPoints'));
      return;
    }
    if (draftStartDate.trim() && !startDate) {
      setStartDateError(t('issueFields.invalidStartDate'));
      return;
    }
    const currentCustomFieldValueById = new Map(
      issueCustomFieldValues.map((fieldValue) => [fieldValue.customFieldId, fieldValue.value]),
    );
    const customFieldUpdates = [];
    for (const field of customFields) {
      if (!isEditableCustomField(field)) continue;
      const draftValue = draftCustomFieldValues[field.id] ?? '';
      const validationError = customFieldValidationError(field, draftValue, t);
      if (validationError) {
        setEditError(validationError);
        return;
      }
      const nextValue = normalizeCustomFieldDraft(field, draftValue);
      const currentValue = normalizeCustomFieldDraft(
        field,
        currentCustomFieldValueById.get(field.id) ?? '',
      );
      if (nextValue !== currentValue) {
        customFieldUpdates.push({ customFieldId: field.id, value: nextValue });
      }
    }
    try {
      const currentResolution = normalizeResolution(issueQ.data?.resolution);
      const currentStartDate = issueCustomFieldString(issueQ.data?.customFields, 'startDate');
      const currentEnvironment = issueCustomFieldString(issueQ.data?.customFields, 'environment');
      const nextEnvironment = draftEnvironment.trim() || null;
      let nextIssueCustomFields = issueQ.data?.customFields ?? {};
      if (startDate !== currentStartDate) {
        nextIssueCustomFields = mergeIssueCustomField(
          nextIssueCustomFields,
          'startDate',
          startDate,
        );
      }
      if (nextEnvironment !== currentEnvironment) {
        nextIssueCustomFields = mergeIssueCustomField(
          nextIssueCustomFields,
          'environment',
          nextEnvironment,
        );
      }
      await updateIssue.mutateAsync({
        title,
        description: draftDescription.trim(),
        priority: draftPriority,
        assigneeId: draftAssigneeId || null,
        sprintId: draftSprintId || null,
        epicId: draftEpicId || null,
        parentId: draftParentId || null,
        estimate,
        dueDate,
        labels: draftLabels,
        ...(storyPoints !== (issueQ.data?.storyPoints ?? null) ? { storyPoints } : {}),
        ...(draftFlagged !== (issueQ.data?.flagged === true) ? { flagged: draftFlagged } : {}),
        ...(startDate !== currentStartDate || nextEnvironment !== currentEnvironment
          ? { customFields: nextIssueCustomFields }
          : {}),
        ...(draftResolution !== currentResolution ? { resolution: draftResolution } : {}),
      });
      const currentComponentIds = issueComponents.map((component) => component.id);
      const componentsChanged = !sameStringSet(currentComponentIds, draftComponentIds);
      if (componentsChanged) {
        await setIssueComponents.mutateAsync({
          targetIssueId: id,
          projectId: issueProjectId,
          componentIds: draftComponentIds,
        });
      }
      const currentFixVersionIds = fixVersions.map((version) => version.id);
      const currentAffectsVersionIds = affectsVersions.map((version) => version.id);
      const fixVersionsChanged = !sameStringSet(currentFixVersionIds, draftFixVersionIds);
      const affectsVersionsChanged = !sameStringSet(
        currentAffectsVersionIds,
        draftAffectsVersionIds,
      );
      if (fixVersionsChanged || affectsVersionsChanged) {
        await setIssueVersions.mutateAsync({
          targetIssueId: id,
          projectId: issueProjectId,
          ...(fixVersionsChanged ? { fixVersionIds: draftFixVersionIds } : {}),
          ...(affectsVersionsChanged ? { affectsVersionIds: draftAffectsVersionIds } : {}),
        });
      }
      for (const customFieldUpdate of customFieldUpdates) {
        await setIssueCustomFieldValue.mutateAsync({
          targetIssueId: id,
          ...customFieldUpdate,
        });
      }
      setEditing(false);
    } catch (err: unknown) {
      setEditError(err instanceof Error ? err.message : t('issue.updateFailed'));
    }
  };

  const changeStatusId = async (statusId: string) => {
    const issue = issueQ.data;
    if (!issue || issue.statusId === statusId || issue.status?.id === statusId) return;
    setEditError(null);
    try {
      await updateIssue.mutateAsync({ statusId });
    } catch (err: unknown) {
      setEditError(err instanceof Error ? err.message : t('issue.updateFailed'));
    }
  };

  const changeStatusCategory = async (status: (typeof STATUS_CATEGORIES)[number]) => {
    const issue = issueQ.data;
    if (!issue || issue.status?.category === status) return;
    setEditError(null);
    try {
      await updateIssue.mutateAsync({ status });
    } catch (err: unknown) {
      setEditError(err instanceof Error ? err.message : t('issue.updateFailed'));
    }
  };

  const submit = async () => {
    const content = draft.trim();
    if (!content) return;
    try {
      await addComment.mutateAsync({ content, mentions: draftMentionIds });
      setDraft('');
      setDraftMentionIds([]);
    } catch {
      // mutation error surfaces via TanStack state; keep the draft intact.
    }
  };

  const beginCommentEdit = (comment: Comment) => {
    setEditingCommentId(comment.id);
    setCommentDraft(comment.content);
    setCommentMentionIds(comment.mentions ?? []);
    setCommentError(null);
  };

  const cancelCommentEdit = () => {
    setEditingCommentId(null);
    setCommentDraft('');
    setCommentMentionIds([]);
    setCommentError(null);
  };

  const saveCommentEdit = async (comment: Comment) => {
    const content = commentDraft.trim();
    if (!content) {
      setCommentError({ commentId: comment.id, message: t('issue.commentRequired') });
      return;
    }

    setCommentError(null);
    try {
      await updateComment.mutateAsync({
        commentId: comment.id,
        content,
        mentions: commentMentionIds,
      });
      setEditingCommentId(null);
      setCommentDraft('');
      setCommentMentionIds([]);
    } catch (err: unknown) {
      setCommentError({
        commentId: comment.id,
        message: err instanceof Error ? err.message : t('issue.commentUpdateFailed'),
      });
    }
  };

  const deleteCommentById = async (commentId: string) => {
    setDeletingCommentId(commentId);
    setCommentError(null);
    try {
      await deleteComment.mutateAsync(commentId);
      if (editingCommentId === commentId) {
        setEditingCommentId(null);
        setCommentDraft('');
        setCommentMentionIds([]);
      }
    } catch (err: unknown) {
      setCommentError({
        commentId,
        message: err instanceof Error ? err.message : t('issue.commentDeleteFailed'),
      });
    } finally {
      setDeletingCommentId(null);
    }
  };

  const confirmDeleteComment = (comment: Comment) => {
    Alert.alert(t('issue.deleteCommentTitle'), t('issue.deleteCommentMessage'), [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('issue.deleteComment'),
        style: 'destructive',
        onPress: () => void deleteCommentById(comment.id),
      },
    ]);
  };

  const toggleCommentReactionByEmoji = async (comment: Comment, emoji: string) => {
    if (!currentUserId) return;
    setCommentReactionError(null);
    try {
      await toggleCommentReaction.mutateAsync({
        commentId: comment.id,
        emoji,
        userId: currentUserId,
      });
    } catch (err: unknown) {
      setCommentReactionError({
        commentId: comment.id,
        message: err instanceof Error ? err.message : t('issue.reactionFailed'),
      });
    }
  };

  const toggleDraftMention = (member: ProjectMember) => {
    const mentionId = projectMemberMentionId(member);
    const selected = draftMentionIds.includes(mentionId);
    setDraftMentionIds((current) =>
      selected ? current.filter((currentId) => currentId !== mentionId) : [...current, mentionId],
    );
    if (!selected) {
      setDraft((value) => appendMentionText(value, member));
    }
  };

  const toggleEditingMention = (member: ProjectMember) => {
    const mentionId = projectMemberMentionId(member);
    const selected = commentMentionIds.includes(mentionId);
    setCommentMentionIds((current) =>
      selected ? current.filter((currentId) => currentId !== mentionId) : [...current, mentionId],
    );
    if (!selected) {
      setCommentDraft((value) => appendMentionText(value, member));
    }
  };

  const deleteCurrentIssue = async () => {
    setEditError(null);
    try {
      await deleteIssue.mutateAsync();
      if (navigation.canGoBack()) {
        navigation.goBack();
      } else {
        navigation.navigate('MainTabs');
      }
    } catch (err: unknown) {
      setEditError(err instanceof Error ? err.message : t('issue.deleteIssueFailed'));
    }
  };

  const confirmDeleteIssue = () => {
    Alert.alert(t('issue.deleteIssue'), t('issue.deleteIssueMessage'), [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('issue.deleteIssue'),
        style: 'destructive',
        onPress: () => void deleteCurrentIssue(),
      },
    ]);
  };

  const toggleIssueWatch = async () => {
    setWatchError(null);
    try {
      if (isWatchingIssue) {
        await removeIssueWatcher.mutateAsync();
      } else {
        await addIssueWatcher.mutateAsync();
      }
    } catch {
      setWatchError(t(isWatchingIssue ? 'issue.unwatchFailed' : 'issue.watchFailed'));
    }
  };

  if (issueQ.isLoading) return <Loading />;
  if (issueQ.isError || !issueQ.data) {
    return (
      <Screen>
        <ErrorView
          message={issueQ.error instanceof Error ? issueQ.error.message : t('common.retry')}
          onRetry={() => void issueQ.refetch()}
        />
      </Screen>
    );
  }

  const issue = issueQ.data;
  const comments = commentsQ.data ?? [];
  const none = t('common.none');
  const watchMutating = addIssueWatcher.isPending || removeIssueWatcher.isPending;

  const renderItem: ListRenderItem<Comment> = ({ item }) => (
    <CommentRow
      comment={item}
      currentUserId={currentUserId}
      draft={editingCommentId === item.id ? commentDraft : ''}
      editing={editingCommentId === item.id}
      error={commentError?.commentId === item.id ? commentError.message : null}
      saving={updateComment.isPending && editingCommentId === item.id}
      deleting={deleteComment.isPending && deletingCommentId === item.id}
      reactionBusy={toggleCommentReaction.isPending}
      projectMembers={projectMembers}
      membersLoading={membersQ.isLoading}
      selectedMentionIds={editingCommentId === item.id ? commentMentionIds : []}
      fallback={none}
      reactionError={
        commentReactionError?.commentId === item.id ? commentReactionError.message : null
      }
      onBeginEdit={beginCommentEdit}
      onCancelEdit={cancelCommentEdit}
      onChangeDraft={(value) => {
        setCommentDraft(value);
        if (commentError?.commentId === item.id) setCommentError(null);
      }}
      onDelete={confirmDeleteComment}
      onSaveEdit={(comment) => void saveCommentEdit(comment)}
      onToggleMention={toggleEditingMention}
      onToggleReaction={(comment, emoji) => void toggleCommentReactionByEmoji(comment, emoji)}
    />
  );

  return (
    <Screen>
      <KeyboardAvoidingView
        className="flex-1"
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 96 : 0}
      >
        <FlatList
          data={comments}
          keyExtractor={(c) => c.id}
          renderItem={renderItem}
          contentContainerStyle={styles.listContent}
          ListHeaderComponent={
            <IssueHeader
              issue={issue}
              editing={editing}
              draftTitle={draftTitle}
              draftDescription={draftDescription}
              draftPriority={draftPriority}
              draftAssigneeId={draftAssigneeId}
              draftSprintId={draftSprintId}
              draftEpicId={draftEpicId}
              draftParentId={draftParentId}
              draftEstimate={draftEstimate}
              draftDueDate={draftDueDate}
              draftStartDate={draftStartDate}
              draftStoryPoints={draftStoryPoints}
              draftEnvironment={draftEnvironment}
              draftFlagged={draftFlagged}
              draftResolution={draftResolution}
              draftLabels={draftLabels}
              draftComponentIds={draftComponentIds}
              draftFixVersionIds={draftFixVersionIds}
              draftAffectsVersionIds={draftAffectsVersionIds}
              draftCustomFieldValues={draftCustomFieldValues}
              labelDraft={labelDraft}
              labelError={labelError}
              estimateError={estimateError}
              dueDateError={dueDateError}
              startDateError={startDateError}
              storyPointsError={storyPointsError}
              projectMembers={projectMembers}
              sprints={editableSprints}
              sprintName={currentSprintName}
              epicIssue={epicIssue}
              epicCandidates={epicCandidates}
              parentIssue={parentIssue}
              parentCandidates={parentCandidates}
              labels={labels}
              components={components}
              issueComponents={issueComponents}
              workflowStatuses={workflowStatuses}
              versions={versions}
              fixVersions={fixVersions}
              affectsVersions={affectsVersions}
              customFields={customFields}
              customFieldValues={issueCustomFieldValues}
              organizationId={organizationId}
              membersLoading={membersQ.isLoading}
              sprintsLoading={sprintsQ.isLoading}
              epicCandidatesLoading={parentIssuesQ.isLoading}
              parentCandidatesLoading={parentIssuesQ.isLoading}
              labelsLoading={labelsQ.isLoading}
              componentsLoading={componentsQ.isLoading || issueComponentsQ.isLoading}
              workflowStatusesLoading={workflowStatusesQ.isLoading}
              workflowStatusesError={workflowStatusesQ.isError}
              versionsLoading={projectVersionsQ.isLoading || issueVersionsQ.isLoading}
              customFieldsLoading={customFieldsQ.isLoading}
              customFieldsError={customFieldsQ.isError}
              customFieldValuesLoading={issueCustomFieldValuesQ.isLoading}
              customFieldValuesError={issueCustomFieldValuesQ.isError}
              titleError={titleError}
              editError={editError}
              updating={
                updateIssue.isPending ||
                setIssueComponents.isPending ||
                setIssueVersions.isPending ||
                setIssueCustomFieldValue.isPending
              }
              deleting={deleteIssue.isPending}
              watchers={watchers}
              watchersLoading={watchersQ.isLoading}
              watchersError={watchersQ.isError}
              watching={isWatchingIssue}
              watchMutating={watchMutating}
              watchError={watchError}
              onBeginEdit={beginEdit}
              onCancelEdit={cancelEdit}
              onDeleteIssue={confirmDeleteIssue}
              onOpenIssue={(issueId) => navigation.push('IssueDetail', { id: issueId })}
              onOpenDocument={(pageId) => navigation.push('DocumentDetail', { id: pageId })}
              onToggleWatch={() => void toggleIssueWatch()}
              onSaveEdit={() => void saveEdit()}
              onChangeTitle={(value) => {
                setDraftTitle(value);
                if (titleError) setTitleError(undefined);
              }}
              onChangeDescription={setDraftDescription}
              onChangePriority={setDraftPriority}
              onChangeAssignee={setDraftAssigneeId}
              onChangeSprint={setDraftSprintId}
              onChangeEpic={(epicId) => {
                setDraftEpicId(epicId);
                setEditError(null);
              }}
              onChangeParent={(parentId) => {
                setDraftParentId(parentId);
                setEditError(null);
              }}
              onChangeEstimate={(value) => {
                setDraftEstimate(value);
                if (estimateError) setEstimateError(null);
              }}
              onChangeDueDate={(value) => {
                setDraftDueDate(value);
                if (dueDateError) setDueDateError(null);
              }}
              onChangeStartDate={(value) => {
                setDraftStartDate(value);
                if (startDateError) setStartDateError(null);
              }}
              onChangeStoryPoints={(value) => {
                setDraftStoryPoints(value);
                if (storyPointsError) setStoryPointsError(null);
              }}
              onChangeEnvironment={setDraftEnvironment}
              onChangeFlagged={setDraftFlagged}
              onChangeResolution={setDraftResolution}
              onToggleLabel={toggleIssueLabel}
              onToggleComponent={toggleIssueComponent}
              onToggleFixVersion={toggleFixVersion}
              onToggleAffectsVersion={toggleAffectsVersion}
              onChangeCustomFieldValue={changeCustomFieldValue}
              onChangeLabelDraft={(value) => {
                setLabelDraft(value);
                if (labelError) setLabelError(null);
              }}
              onAddLabel={addIssueLabel}
              onApplyDescription={(text) => {
                if (!editing) beginEdit();
                setDraftDescription(text);
                setEditError(null);
              }}
              onApplyLabels={(suggestedLabels) => {
                if (!editing) beginEdit();
                setDraftLabels((current) =>
                  Array.from(new Set([...current, ...suggestedLabels])).slice(0, 16),
                );
                setEditError(null);
              }}
              onChangeStatusId={(statusId) => void changeStatusId(statusId)}
              onChangeStatusCategory={(status) => void changeStatusCategory(status)}
            />
          }
          ListEmptyComponent={
            <Text className="text-muted-foreground py-6 text-center text-sm">
              {t('issue.noComments')}
            </Text>
          }
        />
        <View className="border-border bg-background flex-row items-end gap-2 border-t p-3">
          <View className="flex-1">
            <TextField
              value={draft}
              onChangeText={setDraft}
              placeholder={t('issue.commentPlaceholder')}
              multiline
              className="min-h-12"
            />
            <CommentMentionPicker
              members={projectMembers}
              selectedIds={draftMentionIds}
              loading={membersQ.isLoading}
              disabled={addComment.isPending}
              onToggleMention={toggleDraftMention}
            />
          </View>
          <Button
            title={t('issue.addComment')}
            icon={Send}
            loading={addComment.isPending}
            disabled={!draft.trim()}
            onPress={() => void submit()}
          />
        </View>
      </KeyboardAvoidingView>
    </Screen>
  );
}

function createIssueDetailStyles(colors: ThemeColors) {
  return StyleSheet.create({
    listContent: {
      padding: 16,
    },
    header: {
      gap: 16,
    },
    chips: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      alignItems: 'center',
      gap: 8,
    },
    title: {
      lineHeight: 28,
    },
    titleBlock: {
      gap: 10,
    },
    titleActions: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 8,
    },
    inlineAction: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
      borderRadius: 4,
      backgroundColor: colors.card,
      paddingHorizontal: 10,
      paddingVertical: 7,
    },
    inlineActionText: {
      color: colors.foreground,
      fontSize: 12,
      fontWeight: '600',
      lineHeight: 16,
    },
    inlineActionPrimary: {
      borderColor: `${colors.primary}55`,
      backgroundColor: `${colors.primary}14`,
    },
    inlineActionPrimaryText: {
      color: colors.primary,
    },
    inlineActionDisabled: {
      opacity: 0.55,
    },
    inlineActionDestructive: {
      borderColor: `${colors.destructive}66`,
      backgroundColor: `${colors.destructive}14`,
    },
    inlineActionDestructiveText: {
      color: colors.destructive,
      fontSize: 12,
      fontWeight: '600',
      lineHeight: 16,
    },
    description: {
      lineHeight: 22,
    },
    editPanel: {
      gap: 12,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
      borderRadius: 6,
      backgroundColor: colors.card,
      padding: 12,
    },
    editorSection: {
      gap: 10,
    },
    fieldPair: {
      flexDirection: 'row',
      gap: 10,
    },
    fieldPairItem: {
      minWidth: 0,
      flex: 1,
    },
    assigneeList: {
      gap: 8,
    },
    sprintChoiceList: {
      gap: 8,
    },
    sprintChoice: {
      minHeight: 58,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
      borderRadius: 6,
      backgroundColor: colors.card,
      paddingHorizontal: 10,
      paddingVertical: 9,
    },
    sprintChoiceActive: {
      borderColor: colors.primary,
      backgroundColor: `${colors.primary}14`,
    },
    sprintChoiceCopy: {
      minWidth: 0,
      flex: 1,
      gap: 2,
    },
    sprintChoiceName: {
      color: colors.foreground,
      fontSize: 13,
      fontWeight: '700',
      lineHeight: 18,
    },
    sprintChoiceMeta: {
      color: colors.mutedForeground,
      fontSize: 12,
      lineHeight: 16,
    },
    parentChoiceList: {
      gap: 8,
    },
    parentChoice: {
      minHeight: 58,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
      borderRadius: 6,
      backgroundColor: colors.card,
      paddingHorizontal: 10,
      paddingVertical: 9,
    },
    parentChoiceActive: {
      borderColor: colors.primary,
      backgroundColor: `${colors.primary}14`,
    },
    parentChoiceBody: {
      minWidth: 0,
      flex: 1,
      gap: 3,
    },
    parentChoiceTitleRow: {
      minWidth: 0,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
    },
    parentChoiceKey: {
      maxWidth: 92,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
      borderRadius: 2,
      backgroundColor: colors.muted,
      color: colors.mutedForeground,
      fontSize: 11,
      fontWeight: '700',
      lineHeight: 15,
      paddingHorizontal: 6,
      paddingVertical: 2,
    },
    parentChoiceTitle: {
      minWidth: 0,
      flex: 1,
      color: colors.foreground,
      fontSize: 13,
      fontWeight: '700',
      lineHeight: 18,
    },
    parentChoiceMeta: {
      color: colors.mutedForeground,
      fontSize: 12,
      lineHeight: 16,
    },
    selectedLabels: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 8,
    },
    labelListEditor: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 8,
    },
    componentListEditor: {
      gap: 8,
    },
    customFieldEditor: {
      gap: 6,
    },
    customFieldHeading: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
    },
    customFieldLabel: {
      color: colors.foreground,
      fontSize: 13,
      fontWeight: '700',
      lineHeight: 18,
    },
    requiredMarker: {
      color: colors.destructive,
    },
    customFieldDescription: {
      color: colors.mutedForeground,
      fontSize: 12,
      lineHeight: 16,
    },
    helperText: {
      color: colors.mutedForeground,
      fontSize: 13,
      lineHeight: 18,
    },
    addLabelRow: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: 10,
    },
    editActions: {
      flexDirection: 'row',
      justifyContent: 'flex-end',
      gap: 10,
    },
    details: {
      borderTopWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
      paddingTop: 6,
    },
    detailRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 12,
      paddingVertical: 9,
    },
    detailLabel: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
    },
    detailLabelText: {
      color: colors.mutedForeground,
      fontSize: 14,
      lineHeight: 20,
    },
    detailValue: {
      minWidth: 0,
      flex: 1,
      alignItems: 'flex-end',
    },
    mutedValue: {
      color: colors.mutedForeground,
      fontSize: 14,
      lineHeight: 20,
    },
    personValue: {
      minWidth: 0,
      maxWidth: '100%',
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'flex-end',
      gap: 8,
    },
    personName: {
      minWidth: 0,
      flexShrink: 1,
      textAlign: 'right',
    },
    resolutionValue: {
      minWidth: 0,
      alignItems: 'flex-end',
      gap: 2,
    },
    resolvedAtText: {
      color: colors.mutedForeground,
      fontSize: 11,
      lineHeight: 15,
      textAlign: 'right',
    },
    customFieldDetailText: {
      flexShrink: 1,
      textAlign: 'right',
    },
    parentDetailLink: {
      minWidth: 0,
      maxWidth: '100%',
      alignItems: 'flex-end',
      gap: 3,
    },
    parentDetailKey: {
      maxWidth: 120,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
      borderRadius: 2,
      backgroundColor: colors.muted,
      color: colors.mutedForeground,
      fontSize: 11,
      fontWeight: '700',
      lineHeight: 15,
      paddingHorizontal: 6,
      paddingVertical: 2,
    },
    parentDetailTitle: {
      color: colors.foreground,
      fontSize: 13,
      fontWeight: '700',
      lineHeight: 18,
      textAlign: 'right',
    },
    labelList: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      justifyContent: 'flex-end',
      gap: 4,
    },
    labelChip: {
      maxWidth: 112,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
      borderRadius: 2,
      backgroundColor: colors.muted,
      paddingHorizontal: 6,
      paddingVertical: 2,
    },
    labelText: {
      color: colors.mutedForeground,
      fontSize: 11,
      lineHeight: 15,
    },
    timePanel: {
      gap: 12,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
      paddingTop: 14,
    },
    timePanelHeader: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 10,
    },
    runningBadge: {
      minHeight: 28,
      justifyContent: 'center',
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.primary,
      borderRadius: 999,
      backgroundColor: `${colors.primary}14`,
      paddingHorizontal: 10,
      paddingVertical: 4,
    },
    runningBadgeText: {
      color: colors.primary,
      fontSize: 12,
      fontWeight: '700',
      lineHeight: 16,
    },
    timeStats: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 8,
    },
    timeStat: {
      minWidth: 92,
      flex: 1,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
      borderRadius: 6,
      backgroundColor: colors.card,
      paddingHorizontal: 10,
      paddingVertical: 9,
    },
    timeStatLabel: {
      color: colors.mutedForeground,
      fontSize: 11,
      lineHeight: 15,
    },
    timeStatValue: {
      color: colors.foreground,
      fontSize: 15,
      fontWeight: '700',
      lineHeight: 20,
    },
    timeActionBlock: {
      gap: 10,
    },
    timeSuggestion: {
      gap: 8,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
      borderRadius: 6,
      backgroundColor: colors.card,
      padding: 10,
    },
    timeSuggestionTitle: {
      color: colors.foreground,
      fontSize: 13,
      fontWeight: '700',
      lineHeight: 18,
    },
    timeSuggestionText: {
      color: colors.foreground,
      fontSize: 12,
      lineHeight: 17,
    },
    timeSuggestionMeta: {
      color: colors.mutedForeground,
      fontSize: 11,
      lineHeight: 15,
    },
    timeInStatusPanel: {
      gap: 10,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
      paddingTop: 14,
    },
    timeInStatusList: {
      gap: 8,
    },
    timeInStatusRow: {
      minHeight: 42,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 12,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
      borderRadius: 6,
      backgroundColor: colors.card,
      paddingHorizontal: 10,
      paddingVertical: 8,
    },
    timeInStatusName: {
      minWidth: 0,
      flex: 1,
      color: colors.foreground,
      fontSize: 13,
      fontWeight: '700',
      lineHeight: 18,
    },
    timeInStatusValue: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
    },
    timeInStatusDuration: {
      color: colors.mutedForeground,
      fontSize: 12,
      fontWeight: '700',
      lineHeight: 16,
    },
    timeInStatusVisits: {
      color: colors.mutedForeground,
      fontSize: 11,
      lineHeight: 15,
    },
    subtasksPanel: {
      gap: 10,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
      paddingTop: 14,
    },
    subtasksHeader: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 10,
    },
    subtasksProgressText: {
      color: colors.mutedForeground,
      fontSize: 12,
      fontWeight: '700',
      lineHeight: 16,
    },
    subtasksProgressTrack: {
      height: 6,
      flexDirection: 'row',
      overflow: 'hidden',
      borderRadius: 999,
      backgroundColor: colors.muted,
    },
    subtasksProgressFill: {
      backgroundColor: colors.primary,
    },
    subtaskList: {
      gap: 8,
    },
    subtaskRow: {
      minHeight: 58,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
      borderRadius: 6,
      backgroundColor: colors.card,
      paddingHorizontal: 10,
      paddingVertical: 8,
    },
    subtaskCheck: {
      width: 32,
      height: 32,
      alignItems: 'center',
      justifyContent: 'center',
    },
    subtaskOpen: {
      minWidth: 0,
      flex: 1,
    },
    subtaskBody: {
      minWidth: 0,
      gap: 4,
    },
    subtaskTitleRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
    },
    subtaskKey: {
      color: colors.mutedForeground,
      fontSize: 11,
      fontWeight: '700',
      lineHeight: 15,
    },
    subtaskTitle: {
      color: colors.foreground,
      fontSize: 13,
      fontWeight: '700',
      lineHeight: 18,
    },
    subtaskTitleDone: {
      color: colors.mutedForeground,
      textDecorationLine: 'line-through',
    },
    subtaskMeta: {
      color: colors.mutedForeground,
      fontSize: 12,
      lineHeight: 16,
    },
    subtaskCreateBox: {
      gap: 10,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
      borderRadius: 6,
      backgroundColor: colors.surface,
      padding: 10,
    },
    subtaskCreateActions: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      justifyContent: 'flex-end',
      gap: 8,
    },
    docsPanel: {
      gap: 10,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
      paddingTop: 14,
    },
    docsHeader: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 10,
    },
    docSearchResults: {
      gap: 8,
    },
    docSearchRow: {
      minHeight: 50,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
      borderRadius: 6,
      backgroundColor: colors.card,
      paddingHorizontal: 10,
      paddingVertical: 8,
    },
    docList: {
      gap: 8,
    },
    docRow: {
      minHeight: 58,
      flexDirection: 'row',
      alignItems: 'stretch',
      gap: 8,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
      borderRadius: 6,
      backgroundColor: colors.card,
      padding: 10,
    },
    docOpen: {
      minWidth: 0,
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
    },
    docGlyph: {
      width: 32,
      height: 32,
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
      borderRadius: 6,
      backgroundColor: colors.background,
    },
    docGlyphText: {
      color: colors.foreground,
      fontSize: 15,
      lineHeight: 19,
    },
    docBody: {
      minWidth: 0,
      flex: 1,
      gap: 2,
    },
    docTitle: {
      color: colors.foreground,
      fontSize: 13,
      fontWeight: '700',
      lineHeight: 18,
    },
    docMeta: {
      color: colors.mutedForeground,
      fontSize: 11,
      lineHeight: 15,
    },
    docActions: {
      flexDirection: 'row',
      alignItems: 'center',
      borderLeftWidth: StyleSheet.hairlineWidth,
      borderLeftColor: colors.border,
    },
    docAction: {
      width: 34,
      alignItems: 'center',
      justifyContent: 'center',
    },
    attachmentsPanel: {
      gap: 10,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
      paddingTop: 14,
    },
    attachmentsHeader: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 10,
    },
    attachmentsHeaderText: {
      minWidth: 0,
      flex: 1,
      gap: 4,
    },
    attachmentList: {
      gap: 8,
    },
    attachmentRow: {
      minHeight: 58,
      flexDirection: 'row',
      alignItems: 'stretch',
      gap: 8,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
      borderRadius: 6,
      backgroundColor: colors.card,
      padding: 10,
    },
    attachmentOpen: {
      minWidth: 0,
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
    },
    attachmentIcon: {
      width: 32,
      height: 32,
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
      borderRadius: 6,
      backgroundColor: colors.background,
    },
    attachmentBody: {
      minWidth: 0,
      flex: 1,
      gap: 2,
    },
    attachmentName: {
      color: colors.foreground,
      fontSize: 13,
      fontWeight: '700',
      lineHeight: 18,
    },
    attachmentMeta: {
      color: colors.mutedForeground,
      fontSize: 11,
      lineHeight: 15,
    },
    activityPanel: {
      gap: 10,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
      paddingTop: 14,
    },
    activityHeader: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 10,
    },
    activityCount: {
      color: colors.mutedForeground,
      fontSize: 12,
      lineHeight: 16,
    },
    activityList: {
      gap: 8,
    },
    activityRow: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: 10,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
      borderRadius: 6,
      backgroundColor: colors.card,
      paddingHorizontal: 10,
      paddingVertical: 9,
    },
    activityDot: {
      width: 8,
      height: 8,
      borderRadius: 999,
      backgroundColor: colors.primary,
      marginTop: 5,
    },
    activityBody: {
      minWidth: 0,
      flex: 1,
      gap: 3,
    },
    activityDescription: {
      color: colors.foreground,
      fontSize: 13,
      lineHeight: 18,
    },
    activityMeta: {
      color: colors.mutedForeground,
      fontSize: 11,
      lineHeight: 15,
    },
    activityToggle: {
      alignSelf: 'flex-start',
      paddingVertical: 4,
    },
    activityToggleText: {
      color: colors.primary,
      fontSize: 12,
      fontWeight: '700',
      lineHeight: 16,
    },
    linksPanel: {
      gap: 10,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
      paddingTop: 14,
    },
    linksHeader: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 10,
    },
    issueLinkList: {
      gap: 8,
    },
    issueLinkRow: {
      minHeight: 72,
      flexDirection: 'row',
      alignItems: 'stretch',
      gap: 8,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
      borderRadius: 6,
      backgroundColor: colors.card,
      padding: 10,
    },
    issueLinkOpen: {
      minWidth: 0,
      flex: 1,
      gap: 6,
    },
    issueLinkRowTop: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 8,
    },
    issueLinkRelationship: {
      minWidth: 0,
      flex: 1,
      color: colors.primary,
      fontSize: 12,
      fontWeight: '700',
      lineHeight: 16,
    },
    issueLinkTitleRow: {
      minWidth: 0,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
    },
    issueLinkKey: {
      maxWidth: 92,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
      borderRadius: 2,
      backgroundColor: colors.muted,
      color: colors.mutedForeground,
      fontSize: 11,
      fontWeight: '700',
      lineHeight: 15,
      paddingHorizontal: 6,
      paddingVertical: 2,
    },
    issueLinkTitle: {
      minWidth: 0,
      flex: 1,
      color: colors.foreground,
      fontSize: 13,
      fontWeight: '700',
      lineHeight: 18,
    },
    issueLinkPriority: {
      alignSelf: 'flex-start',
      color: colors.mutedForeground,
      fontSize: 11,
      lineHeight: 15,
    },
    issueLinkRemove: {
      width: 34,
      alignItems: 'center',
      justifyContent: 'center',
      borderLeftWidth: StyleSheet.hairlineWidth,
      borderLeftColor: colors.border,
    },
    issueLinkCreatePanel: {
      gap: 12,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
      borderRadius: 6,
      backgroundColor: colors.card,
      padding: 12,
    },
    issueLinkTargetList: {
      gap: 8,
    },
    issueLinkTarget: {
      minHeight: 58,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
      borderRadius: 6,
      backgroundColor: colors.background,
      paddingHorizontal: 10,
      paddingVertical: 9,
    },
    issueLinkTargetActive: {
      borderColor: colors.primary,
      backgroundColor: `${colors.primary}14`,
    },
    issueLinkTargetBody: {
      minWidth: 0,
      flex: 1,
      gap: 4,
    },
    issueLinkTargetTitle: {
      color: colors.foreground,
      fontSize: 13,
      fontWeight: '700',
      lineHeight: 18,
    },
    watchPanel: {
      gap: 10,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
      paddingTop: 14,
    },
    watchHeader: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 10,
    },
    watcherSummary: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
    },
    watcherAvatars: {
      flexDirection: 'row',
      gap: 4,
    },
    watcherCount: {
      minWidth: 0,
      flex: 1,
      color: colors.mutedForeground,
      fontSize: 13,
      lineHeight: 18,
    },
    watcherChips: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 6,
    },
    watcherChip: {
      maxWidth: 150,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
      borderRadius: 4,
      backgroundColor: colors.card,
      paddingHorizontal: 8,
      paddingVertical: 4,
    },
    watcherChipText: {
      color: colors.foreground,
      fontSize: 12,
      lineHeight: 16,
    },
    triagePanel: {
      gap: 10,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
      paddingTop: 14,
    },
    triageHeader: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      alignItems: 'flex-start',
      justifyContent: 'space-between',
      gap: 10,
    },
    triageHeaderText: {
      minWidth: 0,
      flex: 1,
      gap: 4,
    },
    triageSuggestion: {
      gap: 8,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
      borderRadius: 6,
      backgroundColor: colors.card,
      padding: 10,
    },
    triageSuggestionMeta: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 6,
    },
    triageLabels: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 6,
    },
    triageRationale: {
      color: colors.mutedForeground,
      fontSize: 13,
      fontStyle: 'italic',
      lineHeight: 18,
    },
    triageActions: {
      gap: 8,
    },
    assistPanel: {
      gap: 10,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
      paddingTop: 14,
    },
    assistActionGrid: {
      gap: 8,
    },
    assistAction: {
      gap: 4,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
      borderRadius: 6,
      backgroundColor: colors.card,
      paddingHorizontal: 10,
      paddingVertical: 9,
    },
    assistActionTitle: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
    },
    assistActionLabel: {
      minWidth: 0,
      flex: 1,
      color: colors.foreground,
      fontSize: 13,
      fontWeight: '700',
      lineHeight: 18,
    },
    assistActionHint: {
      color: colors.mutedForeground,
      fontSize: 12,
      lineHeight: 16,
    },
    assistResult: {
      gap: 8,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
      borderRadius: 6,
      backgroundColor: colors.surface,
      padding: 10,
    },
    assistResultText: {
      color: colors.foreground,
      fontSize: 13,
      lineHeight: 19,
    },
    agentPanel: {
      gap: 10,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
      paddingTop: 14,
    },
    agentLatest: {
      gap: 8,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
      borderRadius: 6,
      backgroundColor: colors.surface,
      padding: 10,
    },
    agentLatestRow: {
      minHeight: 24,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 12,
    },
    agentLatestLabel: {
      color: colors.mutedForeground,
      fontSize: 11,
      lineHeight: 15,
    },
    agentLatestValue: {
      minWidth: 0,
      flex: 1,
      color: colors.foreground,
      textAlign: 'right',
      fontSize: 12,
      fontWeight: '700',
      lineHeight: 16,
    },
    agentDispatchBox: {
      gap: 10,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
      borderRadius: 6,
      backgroundColor: colors.card,
      padding: 10,
    },
    agentFieldLabel: {
      color: colors.foreground,
      fontSize: 12,
      fontWeight: '700',
      lineHeight: 16,
    },
    agentProviderGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 8,
    },
    agentProviderPill: {
      minHeight: 34,
      justifyContent: 'center',
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
      borderRadius: 6,
      backgroundColor: colors.background,
      paddingHorizontal: 10,
      paddingVertical: 7,
    },
    agentProviderPillActive: {
      borderColor: colors.primary,
      backgroundColor: `${colors.primary}14`,
    },
    agentProviderText: {
      color: colors.mutedForeground,
      fontSize: 12,
      fontWeight: '700',
      lineHeight: 16,
    },
    agentProviderTextActive: {
      color: colors.primary,
    },
    agentSessions: {
      gap: 8,
    },
    agentSessionsHeader: {
      minHeight: 22,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 8,
    },
    agentSessionRow: {
      minHeight: 60,
      flexDirection: 'row',
      alignItems: 'flex-start',
      justifyContent: 'space-between',
      gap: 10,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
      borderRadius: 6,
      backgroundColor: colors.card,
      padding: 10,
    },
    agentSessionBody: {
      minWidth: 0,
      flex: 1,
      gap: 4,
    },
    agentSessionHeader: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      alignItems: 'center',
      gap: 6,
    },
    agentSessionProvider: {
      maxWidth: 120,
      color: colors.foreground,
      fontSize: 13,
      fontWeight: '700',
      lineHeight: 18,
    },
    agentSessionMeta: {
      color: colors.mutedForeground,
      fontSize: 11,
      lineHeight: 15,
    },
    agentSessionTime: {
      maxWidth: 96,
      color: colors.mutedForeground,
      textAlign: 'right',
      fontSize: 11,
      lineHeight: 15,
    },
    workflowPanel: {
      gap: 10,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
      paddingTop: 14,
    },
    workflowStatusList: {
      gap: 8,
    },
    workflowStatusOption: {
      minHeight: 48,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
      borderRadius: 6,
      backgroundColor: colors.card,
      paddingHorizontal: 10,
      paddingVertical: 8,
    },
    workflowStatusOptionActive: {
      borderColor: colors.primary,
      backgroundColor: `${colors.primary}14`,
    },
    workflowStatusDot: {
      width: 10,
      height: 10,
      borderRadius: 999,
    },
    workflowStatusName: {
      color: colors.foreground,
      fontSize: 13,
      fontWeight: '700',
      lineHeight: 18,
    },
    workflowStatusMeta: {
      color: colors.mutedForeground,
      fontSize: 11,
      lineHeight: 15,
    },
    sectionTitle: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
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
    choiceButtonDisabled: {
      opacity: 0.55,
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
    commentsTitle: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      paddingTop: 2,
    },
    commentRow: {
      flexDirection: 'row',
      gap: 12,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
      paddingVertical: 12,
    },
    commentEdited: {
      color: colors.mutedForeground,
      fontSize: 12,
      lineHeight: 16,
    },
    commentEditor: {
      gap: 8,
    },
    commentError: {
      color: colors.destructive,
      fontSize: 12,
      lineHeight: 16,
    },
    commentMentionPanel: {
      gap: 6,
    },
    commentMentionHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 8,
    },
    commentMentionTitle: {
      color: colors.mutedForeground,
      fontSize: 12,
      fontWeight: '700',
      lineHeight: 16,
    },
    commentMentionCount: {
      color: colors.mutedForeground,
      fontSize: 12,
      lineHeight: 16,
    },
    commentMentionList: {
      gap: 6,
      paddingRight: 4,
    },
    commentMentionChip: {
      maxWidth: 180,
      minHeight: 30,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
      borderRadius: 4,
      backgroundColor: colors.card,
      paddingHorizontal: 8,
      paddingVertical: 5,
    },
    commentMentionChipActive: {
      borderColor: `${colors.primary}66`,
      backgroundColor: `${colors.primary}14`,
    },
    commentMentionChipText: {
      color: colors.foreground,
      fontSize: 12,
      fontWeight: '600',
      lineHeight: 16,
    },
    commentMentionChipTextActive: {
      color: colors.primary,
    },
    commentMentionChips: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 6,
    },
    commentMentionReadChip: {
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: `${colors.info}66`,
      borderRadius: 4,
      backgroundColor: `${colors.info}12`,
      paddingHorizontal: 8,
      paddingVertical: 4,
    },
    commentMentionReadChipText: {
      color: colors.info,
      fontSize: 12,
      fontWeight: '700',
      lineHeight: 16,
    },
    commentReactions: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      alignItems: 'center',
      gap: 6,
    },
    commentReactionPill: {
      minHeight: 28,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 5,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
      borderRadius: 999,
      backgroundColor: colors.card,
      paddingHorizontal: 9,
      paddingVertical: 4,
    },
    commentReactionPillActive: {
      borderColor: `${colors.primary}66`,
      backgroundColor: `${colors.primary}14`,
    },
    commentReactionEmoji: {
      fontSize: 14,
      lineHeight: 18,
    },
    commentReactionCount: {
      color: colors.mutedForeground,
      fontSize: 12,
      fontWeight: '700',
      lineHeight: 16,
    },
    commentReactionCountActive: {
      color: colors.primary,
    },
    commentReactionAdd: {
      width: 30,
      height: 28,
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: StyleSheet.hairlineWidth,
      borderStyle: 'dashed',
      borderColor: colors.border,
      borderRadius: 999,
      backgroundColor: colors.card,
    },
    commentReactionAddActive: {
      borderColor: `${colors.primary}88`,
      backgroundColor: `${colors.primary}12`,
    },
    commentReactionPicker: {
      alignSelf: 'flex-start',
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 6,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
      borderRadius: 6,
      backgroundColor: colors.surface,
      padding: 6,
    },
    commentReactionChoice: {
      width: 32,
      height: 32,
      alignItems: 'center',
      justifyContent: 'center',
      borderRadius: 4,
    },
    commentReactionChoiceActive: {
      backgroundColor: `${colors.primary}14`,
    },
    commentReactionChoiceText: {
      fontSize: 18,
      lineHeight: 22,
    },
    commentActions: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 8,
    },
    commentAction: {
      minHeight: 32,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
      borderRadius: 4,
      backgroundColor: colors.card,
      paddingHorizontal: 10,
      paddingVertical: 6,
    },
    commentActionPrimary: {
      borderColor: colors.primary,
      backgroundColor: colors.primary,
    },
    commentActionDestructive: {
      borderColor: `${colors.destructive}66`,
      backgroundColor: `${colors.destructive}14`,
    },
    commentActionDisabled: {
      opacity: 0.55,
    },
    commentActionText: {
      color: colors.foreground,
      fontSize: 12,
      fontWeight: '600',
      lineHeight: 16,
    },
    commentActionPrimaryText: {
      color: colors.primaryForeground,
    },
    commentActionDestructiveText: {
      color: colors.destructive,
    },
  });
}
