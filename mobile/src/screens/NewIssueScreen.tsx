import { useEffect, useMemo, useState } from 'react';
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
  Boxes,
  Calendar,
  Check,
  CircleDot,
  FolderKanban,
  GitBranch,
  Plus,
  Sparkles,
  Tag,
  Timer,
  User,
  Zap,
  type LucideIcon,
} from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { z } from 'zod';

import type {
  IssuePriority,
  IssueStatusCategory,
  IssueType,
  Issue,
  Project,
  Sprint,
  SprintStatus,
  WorkflowStatus,
} from '@/api/types';
import {
  Button,
  EmptyState,
  ErrorView,
  Loading,
  Screen,
  ScreenHeader,
  SemanticBadge,
  TextField,
} from '@/components/ui';
import {
  AssigneeOption,
  ComponentOption,
  LabelOption,
  SelectedComponentChip,
  SelectedLabelChip,
} from '@/components/issue-metadata-pickers';
import type { ThemeColors } from '@/design/theme';
import { useThemeColors } from '@/design/theme-context';
import {
  useCreateIssue,
  useAiCapability,
  useDraftIssueWithAi,
  useLabels,
  useProjectMembers,
  useProjectComponents,
  useProjectIssues,
  useProjects,
  useProjectWorkflowStatuses,
  useSetIssueComponents,
  useSprints,
} from '@/hooks/queries';
import type { AppStackParamList } from '@/navigation/types';

const ISSUE_TYPES = ['task', 'story', 'bug', 'epic'] as const satisfies readonly IssueType[];
const PRIORITIES = [
  'medium',
  'high',
  'low',
  'critical',
  'none',
] as const satisfies readonly IssuePriority[];
const KNOWN_SPRINT_STATUSES = ['planned', 'active', 'completed', 'cancelled'] as const;
const STATUS_CATEGORIES = ['backlog', 'todo', 'in_progress', 'in_review', 'done'] as const;

type KnownSprintStatus = (typeof KNOWN_SPRINT_STATUSES)[number];
type KnownStatusCategory = (typeof STATUS_CATEGORIES)[number];

const newIssueSchema = z.object({
  projectId: z.string().min(1, 'projectRequired'),
  title: z.string().min(1, 'titleRequired'),
  description: z.string(),
  type: z.enum(ISSUE_TYPES),
  priority: z.enum(PRIORITIES),
  assigneeId: z.string(),
  sprintId: z.string(),
  statusId: z.string(),
  epicId: z.string(),
  parentId: z.string(),
  estimate: z.string(),
  dueDate: z.string(),
  labels: z.array(z.string()),
  componentIds: z.array(z.string()),
});

type NewIssueValues = z.infer<typeof newIssueSchema>;
type NewIssueProps = NativeStackScreenProps<AppStackParamList, 'NewIssue'>;
type NewIssueStyles = ReturnType<typeof createNewIssueStyles>;

function useNewIssueTheme(): { colors: ThemeColors; styles: NewIssueStyles } {
  const colors = useThemeColors();
  const styles = useMemo(() => createNewIssueStyles(colors), [colors]);
  return { colors, styles };
}

function isKnownSprintStatus(status: SprintStatus): status is KnownSprintStatus {
  return KNOWN_SPRINT_STATUSES.includes(status as KnownSprintStatus);
}

function isKnownStatusCategory(value: string): value is KnownStatusCategory {
  return STATUS_CATEGORIES.includes(value as KnownStatusCategory);
}

function statusCategoryLabel(
  category: IssueStatusCategory,
  t: ReturnType<typeof useTranslation>['t'],
): string {
  return isKnownStatusCategory(category) ? t(`statusCategory.${category}`) : category;
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

function dueDateInputToIso(value: string): string | null {
  const parsed = parseDateInput(value);
  if (!parsed) return null;
  return new Date(
    Date.UTC(parsed.getFullYear(), parsed.getMonth(), parsed.getDate(), 12),
  ).toISOString();
}

function parseEstimateInput(value: string): number | null {
  const trimmed = value.trim();
  if (!trimmed) return null;
  const estimate = Number(trimmed.replace(',', '.'));
  if (!Number.isFinite(estimate) || estimate < 0) return Number.NaN;
  return estimate;
}

function ChoiceButton<T extends string>({
  label,
  value,
  selected,
  onPress,
}: {
  label: string;
  value: T;
  selected: boolean;
  onPress: (value: T) => void;
}) {
  const { styles } = useNewIssueTheme();

  return (
    <Pressable
      accessibilityRole="button"
      onPress={() => onPress(value)}
      style={[styles.choiceButton, selected ? styles.choiceButtonActive : null]}
      className="active:opacity-80"
    >
      <Text style={[styles.choiceText, selected ? styles.choiceTextActive : null]}>{label}</Text>
    </Pressable>
  );
}

function ProjectOption({
  project,
  selected,
  onPress,
}: {
  project: Project;
  selected: boolean;
  onPress: (projectId: string) => void;
}) {
  const { styles } = useNewIssueTheme();

  return (
    <Pressable
      accessibilityRole="button"
      onPress={() => onPress(project.id)}
      style={[styles.projectOption, selected ? styles.projectOptionActive : null]}
      className="active:opacity-80"
    >
      <View className="min-w-0 flex-1 gap-1">
        <Text className="text-foreground text-sm font-semibold" numberOfLines={1}>
          {project.name}
        </Text>
        <Text style={styles.projectKey} numberOfLines={1}>
          {project.key}
        </Text>
      </View>
      {selected ? <SemanticBadge label={project.key} tone="blue" /> : null}
    </Pressable>
  );
}

function SprintOption({
  language,
  onPress,
  selected,
  sprint,
}: {
  language: string;
  onPress: (sprintId: string) => void;
  selected: boolean;
  sprint: Sprint;
}) {
  const { t } = useTranslation();
  const { colors, styles } = useNewIssueTheme();
  const dateRange = sprintDateRange(sprint, language);
  const statusLabel = isKnownSprintStatus(sprint.status)
    ? t(`sprints.status.${sprint.status}`)
    : sprint.status;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected }}
      onPress={() => onPress(sprint.id)}
      style={[styles.sprintOption, selected ? styles.sprintOptionActive : null]}
      className="active:opacity-80"
    >
      <View className="min-w-0 flex-1 gap-1">
        <Text className="text-foreground text-sm font-semibold" numberOfLines={1}>
          {sprint.name}
        </Text>
        <View style={styles.sprintMeta}>
          {dateRange ? (
            <View style={styles.sprintDate}>
              <Calendar size={13} color={colors.mutedForeground} />
              <Text style={styles.sprintMetaText} numberOfLines={1}>
                {dateRange}
              </Text>
            </View>
          ) : null}
          <Text style={styles.sprintMetaText} numberOfLines={1}>
            {t('issues.count', { count: sprint.issueCount ?? 0 })}
          </Text>
        </View>
      </View>
      <SemanticBadge label={statusLabel} tone={sprint.status === 'active' ? 'emerald' : 'blue'} />
    </Pressable>
  );
}

function WorkflowStatusOption({
  onPress,
  selected,
  status,
}: {
  onPress: (statusId: string) => void;
  selected: boolean;
  status: WorkflowStatus;
}) {
  const { t } = useTranslation();
  const { colors, styles } = useNewIssueTheme();

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected }}
      onPress={() => onPress(status.id)}
      style={[styles.statusOption, selected ? styles.statusOptionActive : null]}
      className="active:opacity-80"
    >
      <View
        style={[styles.statusDot, { backgroundColor: status.color ?? colors.mutedForeground }]}
      />
      <View className="min-w-0 flex-1 gap-1">
        <Text className="text-foreground text-sm font-semibold" numberOfLines={1}>
          {status.name}
        </Text>
        <Text style={styles.statusMetaText} numberOfLines={1}>
          {statusCategoryLabel(status.category, t)}
        </Text>
      </View>
      {selected ? (
        <SemanticBadge label={statusCategoryLabel(status.category, t)} tone="blue" />
      ) : null}
    </Pressable>
  );
}

function IssueRelationPicker({
  candidates,
  emptyLabel,
  icon: Icon,
  loading,
  noneLabel,
  noResultsLabel,
  onChange,
  searchPlaceholder,
  selectedId,
  title,
}: {
  candidates: Issue[];
  emptyLabel: string;
  icon: LucideIcon;
  loading: boolean;
  noneLabel: string;
  noResultsLabel: string;
  onChange: (issueId: string) => void;
  searchPlaceholder: string;
  selectedId: string;
  title: string;
}) {
  const { t } = useTranslation();
  const { colors, styles } = useNewIssueTheme();
  const [search, setSearch] = useState('');
  const visibleCandidates = useMemo(() => {
    const query = search.trim().toLocaleLowerCase();
    const filtered = query
      ? candidates.filter((candidate) => {
          const key = candidate.key?.toLocaleLowerCase() ?? '';
          const issueTitle = candidate.title.toLocaleLowerCase();
          return key.includes(query) || issueTitle.includes(query);
        })
      : candidates;
    return filtered.slice(0, 8);
  }, [candidates, search]);
  const empty = !loading && candidates.length === 0;
  const noResults = !loading && candidates.length > 0 && visibleCandidates.length === 0;

  return (
    <View style={styles.section}>
      <View style={styles.sectionTitle}>
        <Icon size={16} color={colors.foreground} />
        <Text className="text-foreground text-base font-semibold">{title}</Text>
      </View>
      <TextField
        value={search}
        onChangeText={setSearch}
        placeholder={searchPlaceholder}
        autoCapitalize="none"
      />
      <View style={styles.relationList}>
        <ChoiceButton label={noneLabel} value="" selected={!selectedId} onPress={onChange} />
        {visibleCandidates.map((candidate) => {
          const selected = selectedId === candidate.id;
          return (
            <Pressable
              key={candidate.id}
              accessibilityRole="button"
              accessibilityState={{ selected }}
              onPress={() => onChange(candidate.id)}
              style={[styles.relationOption, selected ? styles.relationOptionActive : null]}
              className="active:opacity-80"
            >
              <Icon size={15} color={selected ? colors.primary : colors.mutedForeground} />
              <View style={styles.relationBody}>
                <View style={styles.relationTitleRow}>
                  {candidate.key ? (
                    <Text style={styles.relationKey} numberOfLines={1}>
                      {candidate.key}
                    </Text>
                  ) : null}
                  <Text style={styles.relationTitle} numberOfLines={1}>
                    {candidate.title}
                  </Text>
                </View>
                {candidate.status?.name ? (
                  <Text style={styles.relationMeta} numberOfLines={1}>
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
      {empty ? <Text style={styles.helperText}>{emptyLabel}</Text> : null}
      {noResults ? <Text style={styles.helperText}>{noResultsLabel}</Text> : null}
    </View>
  );
}

export function NewIssueScreen({ navigation, route }: NewIssueProps) {
  const { i18n, t } = useTranslation();
  const { colors, styles } = useNewIssueTheme();
  const initialProjectId = route.params?.projectId ?? '';
  const initialSprintId = route.params?.sprintId ?? '';
  const initialTypeParam = route.params?.type;
  const initialIssueType: NewIssueValues['type'] =
    initialTypeParam && ISSUE_TYPES.includes(initialTypeParam) ? initialTypeParam : 'task';
  const projectsQ = useProjects();
  const createIssue = useCreateIssue();
  const draftIssueWithAi = useDraftIssueWithAi();
  const setIssueComponents = useSetIssueComponents();
  const [formError, setFormError] = useState<string | null>(null);
  const [estimateError, setEstimateError] = useState<string | null>(null);
  const [dueDateError, setDueDateError] = useState<string | null>(null);
  const [labelDraft, setLabelDraft] = useState('');
  const [labelError, setLabelError] = useState<string | null>(null);
  const [aiPrompt, setAiPrompt] = useState('');
  const [aiDraftError, setAiDraftError] = useState<string | null>(null);
  const [aiDraftProvider, setAiDraftProvider] = useState<string | null>(null);

  const form = useForm<NewIssueValues>({
    resolver: zodResolver(newIssueSchema),
    defaultValues: {
      projectId: initialProjectId,
      title: '',
      description: '',
      type: initialIssueType,
      priority: 'medium',
      assigneeId: '',
      sprintId: initialSprintId,
      statusId: '',
      epicId: '',
      parentId: '',
      estimate: '',
      dueDate: '',
      labels: [],
      componentIds: [],
    },
  });

  const projects = useMemo(() => projectsQ.data ?? [], [projectsQ.data]);
  const selectedProjectId = form.watch('projectId');
  const selectedType = form.watch('type');
  const selectedPriority = form.watch('priority');
  const selectedAssigneeId = form.watch('assigneeId');
  const selectedSprintId = form.watch('sprintId');
  const selectedStatusId = form.watch('statusId');
  const selectedEpicId = form.watch('epicId');
  const selectedParentId = form.watch('parentId');
  const selectedLabels = form.watch('labels');
  const selectedComponentIds = form.watch('componentIds');
  const selectedProject = projects.find((project) => project.id === selectedProjectId);
  const aiCapabilityQ = useAiCapability(
    selectedProject?.organizationId ?? null,
    !!selectedProject?.organizationId,
  );
  const membersQ = useProjectMembers(selectedProjectId || null);
  const labelsQ = useLabels(selectedProject?.organizationId ?? null, selectedProjectId || null);
  const componentsQ = useProjectComponents(selectedProjectId || null);
  const workflowStatusesQ = useProjectWorkflowStatuses(selectedProjectId || null);
  const projectIssuesQ = useProjectIssues(selectedProjectId || null);
  const sprintsQ = useSprints(selectedProjectId || null);
  const projectMembers = useMemo(() => membersQ.data ?? [], [membersQ.data]);
  const labels = useMemo(() => labelsQ.data ?? [], [labelsQ.data]);
  const components = useMemo(
    () => (componentsQ.data ?? []).filter((component) => !component.archived),
    [componentsQ.data],
  );
  const selectedComponents = useMemo(
    () => components.filter((component) => selectedComponentIds.includes(component.id)),
    [components, selectedComponentIds],
  );
  const sprints = useMemo(
    () =>
      (sprintsQ.data ?? []).filter(
        (sprint) => sprint.status !== 'completed' && sprint.status !== 'cancelled',
      ),
    [sprintsQ.data],
  );
  const workflowStatuses = useMemo(
    () =>
      [...(workflowStatusesQ.data ?? [])].sort(
        (left, right) =>
          (left.position ?? Number.MAX_SAFE_INTEGER) - (right.position ?? Number.MAX_SAFE_INTEGER),
      ),
    [workflowStatusesQ.data],
  );
  const projectIssues = useMemo(() => projectIssuesQ.data ?? [], [projectIssuesQ.data]);
  const epicCandidates = useMemo(
    () => projectIssues.filter((issue) => issue.type === 'epic'),
    [projectIssues],
  );
  const parentCandidates = projectIssues;

  useEffect(() => {
    if (selectedProjectId) return;
    const fallbackProjectId = initialProjectId || projects[0]?.id;
    if (fallbackProjectId) {
      form.setValue('projectId', fallbackProjectId, { shouldValidate: true });
    }
  }, [form, initialProjectId, projects, selectedProjectId]);

  useEffect(() => {
    if (!selectedSprintId || sprintsQ.isLoading) return;
    if (!sprints.some((sprint) => sprint.id === selectedSprintId)) {
      form.setValue('sprintId', '', { shouldValidate: true });
    }
  }, [form, selectedSprintId, sprints, sprintsQ.isLoading]);

  useEffect(() => {
    if (workflowStatusesQ.isLoading) return;
    if (selectedStatusId && workflowStatuses.some((status) => status.id === selectedStatusId)) {
      return;
    }
    form.setValue('statusId', workflowStatuses[0]?.id ?? '', { shouldValidate: true });
  }, [form, selectedStatusId, workflowStatuses, workflowStatusesQ.isLoading]);

  useEffect(() => {
    if (selectedType === 'epic' && selectedEpicId) {
      form.setValue('epicId', '', { shouldValidate: true });
    }
  }, [form, selectedEpicId, selectedType]);

  useEffect(() => {
    if (projectIssuesQ.isLoading) return;
    if (selectedEpicId && !epicCandidates.some((issue) => issue.id === selectedEpicId)) {
      form.setValue('epicId', '', { shouldValidate: true });
    }
    if (selectedParentId && !parentCandidates.some((issue) => issue.id === selectedParentId)) {
      form.setValue('parentId', '', { shouldValidate: true });
    }
  }, [
    epicCandidates,
    form,
    parentCandidates,
    projectIssuesQ.isLoading,
    selectedEpicId,
    selectedParentId,
  ]);

  const fieldError = (code?: string): string | undefined => {
    if (!code) return undefined;
    if (code === 'projectRequired') return t('validation.projectRequired');
    if (code === 'titleRequired') return t('validation.titleRequired');
    return t('validation.invalidField');
  };

  const selectProject = (projectId: string) => {
    form.setValue('projectId', projectId, { shouldValidate: true });
    form.setValue('assigneeId', '', { shouldValidate: true });
    form.setValue('sprintId', '', { shouldValidate: true });
    form.setValue('statusId', '', { shouldValidate: true });
    form.setValue('epicId', '', { shouldValidate: true });
    form.setValue('parentId', '', { shouldValidate: true });
    form.setValue('labels', [], { shouldValidate: true });
    form.setValue('componentIds', [], { shouldValidate: true });
    setLabelDraft('');
    setLabelError(null);
    setEstimateError(null);
    setDueDateError(null);
  };

  const toggleLabel = (name: string) => {
    setLabelError(null);
    const nextLabels = selectedLabels.includes(name)
      ? selectedLabels.filter((label) => label !== name)
      : [...selectedLabels, name];
    form.setValue('labels', nextLabels, { shouldValidate: true });
  };

  const toggleComponent = (componentId: string) => {
    const nextComponentIds = selectedComponentIds.includes(componentId)
      ? selectedComponentIds.filter((id) => id !== componentId)
      : [...selectedComponentIds, componentId];
    form.setValue('componentIds', nextComponentIds, { shouldValidate: true });
  };

  const addDraftLabel = () => {
    const next = labelDraft.trim();
    if (!next) return;
    if (next.length > 100) {
      setLabelError(t('validation.labelTooLong'));
      return;
    }
    if (!selectedLabels.includes(next)) {
      form.setValue('labels', [...selectedLabels, next], { shouldValidate: true });
    }
    setLabelDraft('');
    setLabelError(null);
  };

  const applyAiDraft = async (): Promise<void> => {
    const prompt = aiPrompt.trim();
    if (!selectedProjectId || prompt.length < 3) {
      setAiDraftError(t('aiDraft.promptTooShort'));
      return;
    }
    setAiDraftError(null);
    setAiDraftProvider(null);
    try {
      const result = await draftIssueWithAi.mutateAsync({ projectId: selectedProjectId, prompt });
      const draft = result.draft;
      const nextType = ISSUE_TYPES.includes(draft.type as (typeof ISSUE_TYPES)[number])
        ? (draft.type as NewIssueValues['type'])
        : 'task';
      form.setValue('title', draft.title, { shouldValidate: true });
      form.setValue('description', draft.description ?? '', { shouldValidate: true });
      form.setValue('type', nextType, { shouldValidate: true });
      form.setValue('priority', draft.priority, { shouldValidate: true });
      if (draft.estimate !== null) {
        form.setValue('estimate', String(draft.estimate), { shouldValidate: true });
        setEstimateError(null);
      }
      if (draft.labels.length > 0) {
        form.setValue('labels', Array.from(new Set([...selectedLabels, ...draft.labels])), {
          shouldValidate: true,
        });
        setLabelError(null);
      }
      setAiDraftProvider(result.provider);
    } catch (err: unknown) {
      setAiDraftError(err instanceof Error ? err.message : t('aiDraft.failed'));
    }
  };

  const onSubmit = async (values: NewIssueValues): Promise<void> => {
    setFormError(null);
    setEstimateError(null);
    setDueDateError(null);
    const description = values.description.trim();
    const estimate = parseEstimateInput(values.estimate);
    const dueDate = values.dueDate.trim() ? dueDateInputToIso(values.dueDate) : null;
    if (Number.isNaN(estimate)) {
      setEstimateError(t('issue.invalidEstimate'));
      return;
    }
    if (values.dueDate.trim() && !dueDate) {
      setDueDateError(t('issue.invalidDueDate'));
      return;
    }
    try {
      const input = {
        projectId: values.projectId,
        type: values.type,
        title: values.title.trim(),
        priority: values.priority,
      };
      const issue = await createIssue.mutateAsync({
        ...input,
        ...(description ? { description } : {}),
        ...(values.assigneeId ? { assigneeId: values.assigneeId } : {}),
        ...(values.sprintId ? { sprintId: values.sprintId } : {}),
        ...(values.statusId ? { statusId: values.statusId } : {}),
        ...(values.epicId ? { epicId: values.epicId } : {}),
        ...(values.parentId ? { parentId: values.parentId } : {}),
        ...(estimate !== null ? { estimate } : {}),
        ...(dueDate ? { dueDate } : {}),
        ...(values.labels.length > 0 ? { labels: values.labels } : {}),
      });
      if (values.componentIds.length > 0) {
        try {
          await setIssueComponents.mutateAsync({
            targetIssueId: issue.id,
            projectId: values.projectId,
            componentIds: values.componentIds,
          });
        } catch {
          navigation.replace('IssueDetail', { id: issue.id });
          return;
        }
      }
      navigation.replace('IssueDetail', { id: issue.id });
    } catch (err: unknown) {
      setFormError(err instanceof Error ? err.message : t('issues.createFailed'));
    }
  };

  if (projectsQ.isLoading) return <Loading />;
  if (projectsQ.isError) {
    return (
      <Screen>
        <ErrorView
          message={projectsQ.error instanceof Error ? projectsQ.error.message : t('common.retry')}
          onRetry={() => void projectsQ.refetch()}
        />
      </Screen>
    );
  }

  if (projects.length === 0) {
    return (
      <Screen>
        <EmptyState
          icon={FolderKanban}
          title={t('projects.empty')}
          description={t('projects.emptyDesc')}
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
          className="flex-1"
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={styles.content}
        >
          <ScreenHeader
            kicker={t('common.appName')}
            title={t('issues.new')}
            subtitle={t('issues.newSubtitle')}
            meta={
              selectedProject ? (
                <SemanticBadge label={selectedProject.key} tone="blue" />
              ) : undefined
            }
          />

          <View style={styles.section}>
            <View style={styles.sectionTitle}>
              <FolderKanban size={16} color={colors.foreground} />
              <Text className="text-foreground text-base font-semibold">{t('issues.project')}</Text>
            </View>
            <View style={styles.projectList}>
              {projects.map((project) => (
                <ProjectOption
                  key={project.id}
                  project={project}
                  selected={project.id === selectedProjectId}
                  onPress={(projectId) => {
                    selectProject(projectId);
                  }}
                />
              ))}
            </View>
            {fieldError(form.formState.errors.projectId?.message) ? (
              <Text className="text-destructive text-xs">
                {fieldError(form.formState.errors.projectId?.message)}
              </Text>
            ) : null}
          </View>

          {aiCapabilityQ.data?.canDraft === true ? (
            <View style={styles.aiDraftPanel}>
              <View style={styles.sectionTitle}>
                <Sparkles size={16} color={colors.foreground} />
                <Text className="text-foreground text-base font-semibold">
                  {t('aiDraft.title')}
                </Text>
                {aiDraftProvider ? (
                  <SemanticBadge
                    label={t('aiDraft.provider', { provider: aiDraftProvider })}
                    tone="blue"
                  />
                ) : null}
              </View>
              <Text style={styles.helperText}>{t('aiDraft.description')}</Text>
              <TextField
                label={t('aiDraft.promptLabel')}
                placeholder={t('aiDraft.promptPlaceholder')}
                value={aiPrompt}
                onChangeText={(value) => {
                  setAiPrompt(value);
                  setAiDraftError(null);
                }}
                editable={!draftIssueWithAi.isPending && !createIssue.isPending}
                multiline
                className="min-h-20 py-2"
              />
              <Button
                title={draftIssueWithAi.isPending ? t('aiDraft.generating') : t('aiDraft.generate')}
                icon={Sparkles}
                loading={draftIssueWithAi.isPending}
                disabled={
                  draftIssueWithAi.isPending || createIssue.isPending || aiPrompt.trim().length < 3
                }
                onPress={() => void applyAiDraft()}
              />
              {aiDraftError ? <Text style={styles.errorText}>{aiDraftError}</Text> : null}
            </View>
          ) : null}

          <View style={styles.section}>
            <Controller
              control={form.control}
              name="title"
              render={({ field: { onChange, onBlur, value } }) => (
                <TextField
                  label={t('issues.titleLabel')}
                  placeholder={t('issues.titlePlaceholder')}
                  value={value}
                  onChangeText={onChange}
                  onBlur={onBlur}
                  returnKeyType="next"
                  editable={!createIssue.isPending}
                  error={fieldError(form.formState.errors.title?.message)}
                />
              )}
            />

            <Controller
              control={form.control}
              name="description"
              render={({ field: { onChange, onBlur, value } }) => (
                <TextField
                  label={t('issue.description')}
                  placeholder={t('issues.descriptionPlaceholder')}
                  value={value}
                  onChangeText={onChange}
                  onBlur={onBlur}
                  multiline
                  className="min-h-12"
                  editable={!createIssue.isPending}
                />
              )}
            />
          </View>

          <View style={styles.section}>
            <Controller
              control={form.control}
              name="estimate"
              render={({ field: { onChange, onBlur, value } }) => (
                <TextField
                  label={t('issue.estimate')}
                  placeholder={t('issue.estimatePlaceholder')}
                  value={value}
                  onChangeText={(next) => {
                    onChange(next);
                    if (estimateError) setEstimateError(null);
                  }}
                  onBlur={onBlur}
                  keyboardType="decimal-pad"
                  editable={!createIssue.isPending}
                  error={estimateError ?? undefined}
                />
              )}
            />
            <Controller
              control={form.control}
              name="dueDate"
              render={({ field: { onChange, onBlur, value } }) => (
                <TextField
                  label={t('issue.dueDate')}
                  placeholder={t('issue.dueDatePlaceholder')}
                  value={value}
                  onChangeText={(next) => {
                    onChange(next);
                    if (dueDateError) setDueDateError(null);
                  }}
                  onBlur={onBlur}
                  keyboardType="numbers-and-punctuation"
                  autoCapitalize="none"
                  editable={!createIssue.isPending}
                  error={dueDateError ?? undefined}
                />
              )}
            />
          </View>

          <View style={styles.section}>
            <View style={styles.sectionTitle}>
              <Timer size={16} color={colors.foreground} />
              <Text className="text-foreground text-base font-semibold">{t('sprints.title')}</Text>
            </View>
            <View style={styles.sprintList}>
              <ChoiceButton
                label={t('sprints.backlog')}
                value=""
                selected={!selectedSprintId}
                onPress={(value) => form.setValue('sprintId', value, { shouldValidate: true })}
              />
              {sprints.map((sprint) => (
                <SprintOption
                  key={sprint.id}
                  sprint={sprint}
                  language={i18n.language}
                  selected={selectedSprintId === sprint.id}
                  onPress={(sprintId) =>
                    form.setValue('sprintId', sprintId, { shouldValidate: true })
                  }
                />
              ))}
            </View>
            {!sprintsQ.isLoading && sprints.length === 0 ? (
              <Text style={styles.helperText}>{t('sprints.empty')}</Text>
            ) : null}
          </View>

          <View style={styles.section}>
            <View style={styles.sectionTitle}>
              <CircleDot size={16} color={colors.foreground} />
              <Text className="text-foreground text-base font-semibold">{t('issue.workflow')}</Text>
            </View>
            <View style={styles.statusList}>
              {workflowStatuses.map((status) => (
                <WorkflowStatusOption
                  key={status.id}
                  status={status}
                  selected={selectedStatusId === status.id}
                  onPress={(statusId) =>
                    form.setValue('statusId', statusId, { shouldValidate: true })
                  }
                />
              ))}
            </View>
            {workflowStatusesQ.isLoading ? (
              <Text style={styles.helperText}>{t('common.loading')}</Text>
            ) : null}
            {workflowStatusesQ.isError ? (
              <Text style={styles.errorText}>{t('issue.workflowStatusesLoadFailed')}</Text>
            ) : null}
          </View>

          {selectedType !== 'epic' ? (
            <IssueRelationPicker
              candidates={epicCandidates}
              emptyLabel={t('issueEpic.empty')}
              icon={Zap}
              loading={projectIssuesQ.isLoading}
              noneLabel={t('issueEpic.none')}
              noResultsLabel={t('issueEpic.noResults')}
              searchPlaceholder={t('issueEpic.searchPlaceholder')}
              selectedId={selectedEpicId}
              title={t('issueEpic.title')}
              onChange={(issueId) => form.setValue('epicId', issueId, { shouldValidate: true })}
            />
          ) : null}

          <IssueRelationPicker
            candidates={parentCandidates}
            emptyLabel={t('issueParent.empty')}
            icon={GitBranch}
            loading={projectIssuesQ.isLoading}
            noneLabel={t('issueParent.none')}
            noResultsLabel={t('issueParent.noResults')}
            searchPlaceholder={t('issueParent.searchPlaceholder')}
            selectedId={selectedParentId}
            title={t('issueParent.title')}
            onChange={(issueId) => form.setValue('parentId', issueId, { shouldValidate: true })}
          />

          <View style={styles.section}>
            <View style={styles.sectionTitle}>
              <User size={16} color={colors.foreground} />
              <Text className="text-foreground text-base font-semibold">{t('issue.assignee')}</Text>
            </View>
            <View style={styles.assigneeList}>
              <AssigneeOption
                member={null}
                selected={!selectedAssigneeId}
                onPress={(userId) => form.setValue('assigneeId', userId, { shouldValidate: true })}
              />
              {projectMembers.map((member) => (
                <AssigneeOption
                  key={member.userId}
                  member={member}
                  selected={selectedAssigneeId === member.userId}
                  onPress={(userId) =>
                    form.setValue('assigneeId', userId, { shouldValidate: true })
                  }
                />
              ))}
            </View>
            {!membersQ.isLoading && projectMembers.length === 0 ? (
              <Text style={styles.helperText}>{t('issues.noAssignableMembers')}</Text>
            ) : null}
          </View>

          <View style={styles.section}>
            <View style={styles.sectionTitle}>
              <Boxes size={16} color={colors.foreground} />
              <Text className="text-foreground text-base font-semibold">
                {t('issueSidebar.components.label')}
              </Text>
            </View>
            {selectedComponents.length > 0 ? (
              <View style={styles.selectedLabels}>
                {selectedComponents.map((component) => (
                  <SelectedComponentChip
                    key={component.id}
                    component={component}
                    onRemove={toggleComponent}
                  />
                ))}
              </View>
            ) : null}
            <View style={styles.componentList}>
              {components.map((component) => (
                <ComponentOption
                  key={component.id}
                  component={component}
                  selected={selectedComponentIds.includes(component.id)}
                  onPress={toggleComponent}
                />
              ))}
            </View>
            {!componentsQ.isLoading && components.length === 0 ? (
              <Text style={styles.helperText}>{t('issueSidebar.components.empty')}</Text>
            ) : null}
          </View>

          <View style={styles.section}>
            <View style={styles.sectionTitle}>
              <Tag size={16} color={colors.foreground} />
              <Text className="text-foreground text-base font-semibold">{t('issue.labels')}</Text>
            </View>
            {selectedLabels.length > 0 ? (
              <View style={styles.selectedLabels}>
                {selectedLabels.map((label) => (
                  <SelectedLabelChip key={label} name={label} onRemove={toggleLabel} />
                ))}
              </View>
            ) : null}
            <View style={styles.labelList}>
              {labels.map((label) => (
                <LabelOption
                  key={label.id}
                  label={label}
                  selected={selectedLabels.includes(label.name)}
                  onPress={toggleLabel}
                />
              ))}
            </View>
            {!labelsQ.isLoading && labels.length === 0 ? (
              <Text style={styles.helperText}>{t('issues.noLabels')}</Text>
            ) : null}
            <View style={styles.addLabelRow}>
              <View className="flex-1">
                <TextField
                  value={labelDraft}
                  onChangeText={(value) => {
                    setLabelDraft(value);
                    if (labelError) setLabelError(null);
                  }}
                  placeholder={t('issues.labelPlaceholder')}
                  editable={!createIssue.isPending}
                  error={labelError ?? undefined}
                  returnKeyType="done"
                  onSubmitEditing={addDraftLabel}
                />
              </View>
              <Button
                title={t('issues.addLabel')}
                variant="secondary"
                icon={Plus}
                disabled={!labelDraft.trim()}
                onPress={addDraftLabel}
              />
            </View>
          </View>

          <View style={styles.section}>
            <View style={styles.sectionTitle}>
              <Tag size={16} color={colors.foreground} />
              <Text className="text-foreground text-base font-semibold">{t('issues.type')}</Text>
            </View>
            <View style={styles.choiceGrid}>
              {ISSUE_TYPES.map((type) => (
                <ChoiceButton
                  key={type}
                  label={t(`issueType.${type}`)}
                  value={type}
                  selected={selectedType === type}
                  onPress={(value) => form.setValue('type', value, { shouldValidate: true })}
                />
              ))}
            </View>
          </View>

          <View style={styles.section}>
            <View style={styles.sectionTitle}>
              <Tag size={16} color={colors.foreground} />
              <Text className="text-foreground text-base font-semibold">{t('issue.priority')}</Text>
            </View>
            <View style={styles.choiceGrid}>
              {PRIORITIES.map((priority) => (
                <ChoiceButton
                  key={priority}
                  label={t(`priority.${priority}`)}
                  value={priority}
                  selected={selectedPriority === priority}
                  onPress={(value) => form.setValue('priority', value, { shouldValidate: true })}
                />
              ))}
            </View>
          </View>

          {formError ? <Text className="text-destructive px-4 text-sm">{formError}</Text> : null}
        </ScrollView>

        <View style={styles.footer}>
          <Button
            title={t('issues.create')}
            icon={Plus}
            loading={createIssue.isPending || setIssueComponents.isPending}
            disabled={createIssue.isPending || setIssueComponents.isPending}
            onPress={form.handleSubmit(onSubmit)}
          />
        </View>
      </KeyboardAvoidingView>
    </Screen>
  );
}

function createNewIssueStyles(colors: ThemeColors) {
  return StyleSheet.create({
    content: {
      gap: 16,
      paddingBottom: 24,
    },
    section: {
      gap: 10,
      paddingHorizontal: 16,
    },
    aiDraftPanel: {
      gap: 10,
      marginHorizontal: 16,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
      borderRadius: 6,
      backgroundColor: colors.card,
      padding: 12,
    },
    sectionTitle: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
    },
    projectList: {
      gap: 8,
    },
    sprintList: {
      gap: 8,
    },
    sprintOption: {
      minHeight: 66,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
      borderRadius: 6,
      backgroundColor: colors.card,
      padding: 10,
    },
    sprintOptionActive: {
      borderColor: colors.primary,
      backgroundColor: `${colors.primary}14`,
    },
    sprintMeta: {
      minHeight: 18,
      flexDirection: 'row',
      flexWrap: 'wrap',
      alignItems: 'center',
      gap: 8,
    },
    sprintDate: {
      minWidth: 0,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 5,
    },
    sprintMetaText: {
      color: colors.mutedForeground,
      fontSize: 12,
      lineHeight: 16,
    },
    statusList: {
      gap: 8,
    },
    statusOption: {
      minHeight: 56,
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
    statusOptionActive: {
      borderColor: colors.primary,
      backgroundColor: `${colors.primary}14`,
    },
    statusDot: {
      width: 10,
      height: 10,
      borderRadius: 999,
    },
    statusMetaText: {
      color: colors.mutedForeground,
      fontSize: 12,
      lineHeight: 16,
    },
    relationList: {
      gap: 8,
    },
    relationOption: {
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
    relationOptionActive: {
      borderColor: colors.primary,
      backgroundColor: `${colors.primary}14`,
    },
    relationBody: {
      minWidth: 0,
      flex: 1,
      gap: 3,
    },
    relationTitleRow: {
      minWidth: 0,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
    },
    relationKey: {
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
    relationTitle: {
      minWidth: 0,
      flex: 1,
      color: colors.foreground,
      fontSize: 13,
      fontWeight: '700',
      lineHeight: 18,
    },
    relationMeta: {
      color: colors.mutedForeground,
      fontSize: 12,
      lineHeight: 16,
    },
    projectOption: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
      borderRadius: 6,
      backgroundColor: colors.card,
      padding: 12,
    },
    projectOptionActive: {
      borderColor: colors.primary,
      backgroundColor: `${colors.primary}14`,
    },
    projectKey: {
      color: colors.mutedForeground,
      fontSize: 11,
      fontWeight: '600',
      letterSpacing: 0,
      lineHeight: 16,
      textTransform: 'uppercase',
    },
    assigneeList: {
      gap: 8,
    },
    componentList: {
      gap: 8,
    },
    assigneeOption: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
      borderRadius: 6,
      backgroundColor: colors.card,
      padding: 10,
    },
    assigneeOptionActive: {
      borderColor: colors.primary,
      backgroundColor: `${colors.primary}14`,
    },
    assigneeAvatar: {
      width: 32,
      height: 32,
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
      borderRadius: 999,
      backgroundColor: colors.surface,
    },
    assigneeInitials: {
      color: colors.foreground,
      fontSize: 11,
      fontWeight: '700',
      lineHeight: 14,
    },
    assigneeRole: {
      color: colors.mutedForeground,
      fontSize: 11,
      lineHeight: 16,
    },
    helperText: {
      color: colors.mutedForeground,
      fontSize: 13,
      lineHeight: 18,
    },
    errorText: {
      color: colors.destructive,
      fontSize: 12,
      lineHeight: 16,
    },
    selectedLabels: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 8,
    },
    selectedLabel: {
      maxWidth: '100%',
      minHeight: 30,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      borderRadius: 4,
      backgroundColor: colors.primary,
      paddingHorizontal: 10,
      paddingVertical: 6,
    },
    selectedLabelText: {
      minWidth: 0,
      color: colors.primaryForeground,
      fontSize: 12,
      fontWeight: '700',
      lineHeight: 16,
    },
    labelList: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 8,
    },
    labelOption: {
      maxWidth: '100%',
      minHeight: 32,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 7,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
      borderRadius: 4,
      backgroundColor: colors.card,
      paddingHorizontal: 10,
      paddingVertical: 7,
    },
    labelOptionActive: {
      borderColor: colors.primary,
      backgroundColor: `${colors.primary}14`,
    },
    labelSwatch: {
      width: 9,
      height: 9,
      borderRadius: 999,
    },
    labelOptionText: {
      minWidth: 0,
      color: colors.foreground,
      fontSize: 12,
      fontWeight: '600',
      lineHeight: 16,
    },
    labelOptionTextActive: {
      color: colors.primary,
    },
    addLabelRow: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: 10,
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
    footer: {
      borderTopWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
      backgroundColor: colors.background,
      padding: 12,
    },
  });
}
