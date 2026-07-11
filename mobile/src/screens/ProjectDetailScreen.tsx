import {
  FlatList,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
  type ListRenderItem,
} from '@/components/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import {
  Activity,
  ArrowRight,
  BarChart3,
  BookOpenText,
  Calendar,
  ChartGantt,
  CheckCircle2,
  FolderKanban,
  Inbox,
  Layers3,
  ListTodo,
  LayoutList,
  MessageCircle,
  Play,
  Plus,
  Settings,
  Timer,
  X,
  type LucideIcon,
} from 'lucide-react-native';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';

import {
  Button,
  EmptyState,
  ErrorView,
  IconTile,
  Loading,
  Screen,
  ScreenHeader,
  SemanticBadge,
  SurfaceRow,
  TextField,
} from '@/components/ui';
import {
  apiFiltersFromIssueListFilters,
  defaultIssueListFilters,
  filterIssues,
  hasActiveIssueFilters,
  issueListFiltersFromRouteParams,
  IssueFilterPanel,
  type IssueListFilters,
} from '@/components/issue-filters';
import { FeaturedIssueCard, IssueListItem, IssueSeparator } from '@/components/issue-list';
import { ProjectBoard } from '@/components/project-board';
import type { ThemeColors } from '@/design/theme';
import { useThemeColors } from '@/design/theme-context';
import {
  useCreateSprint,
  useIssues,
  useProject,
  useProjectAnalytics,
  useProjectWorkflowStatuses,
  useProjects,
  useSprints,
  useUpdateSprint,
} from '@/hooks/queries';
import type { Issue, Project, ProjectAnalyticsResponse, Sprint, SprintStatus } from '@/api/types';
import type { AppStackParamList } from '@/navigation/types';

type ProjectDetailProps = NativeStackScreenProps<AppStackParamList, 'ProjectDetail'>;
type ProjectViewMode = 'list' | 'board';
type ProjectDetailStyles = ReturnType<typeof createProjectDetailStyles>;

function useProjectDetailTheme(): { colors: ThemeColors; styles: ProjectDetailStyles } {
  const colors = useThemeColors();
  const styles = useMemo(() => createProjectDetailStyles(colors), [colors]);
  return { colors, styles };
}

const DAY_MS = 24 * 60 * 60 * 1000;
const KNOWN_SPRINT_STATUSES = ['planned', 'active', 'completed', 'cancelled'] as const;

type KnownSprintStatus = (typeof KNOWN_SPRINT_STATUSES)[number];

const SPRINT_STATUS_ORDER: Record<KnownSprintStatus, number> = {
  active: 0,
  planned: 1,
  completed: 2,
  cancelled: 3,
};

function isKnownSprintStatus(status: SprintStatus): status is KnownSprintStatus {
  return KNOWN_SPRINT_STATUSES.includes(status as KnownSprintStatus);
}

function sprintTone(status: SprintStatus): 'blue' | 'emerald' | 'neutral' | 'rose' {
  if (status === 'active') return 'emerald';
  if (status === 'completed') return 'neutral';
  if (status === 'cancelled') return 'rose';
  return 'blue';
}

function padDatePart(value: number): string {
  return String(value).padStart(2, '0');
}

function dateInputValue(offsetDays = 0): string {
  const date = new Date();
  date.setDate(date.getDate() + offsetDays);
  const year = date.getFullYear();
  const month = padDatePart(date.getMonth() + 1);
  const day = padDatePart(date.getDate());
  return `${year}-${month}-${day}`;
}

function parseDateInput(value: string): Date | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value.trim());
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

function sprintStatusOrder(status: SprintStatus): number {
  return isKnownSprintStatus(status) ? SPRINT_STATUS_ORDER[status] : 4;
}

function uniqueCount(values: Array<string | null | undefined>): number {
  return new Set(values.filter(Boolean)).size;
}

function SummaryMetric({ value, label }: { value: number; label: string }) {
  const { styles } = useProjectDetailTheme();

  return (
    <View style={styles.metric}>
      <Text style={styles.metricValue}>{value}</Text>
      <Text style={styles.metricLabel} numberOfLines={1}>
        {label}
      </Text>
    </View>
  );
}

function ViewModeOption({
  icon: Icon,
  label,
  selected,
  onPress,
}: {
  icon: LucideIcon;
  label: string;
  selected: boolean;
  onPress: () => void;
}) {
  const { colors, styles } = useProjectDetailTheme();

  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={[styles.viewModeOption, selected ? styles.viewModeOptionActive : null]}
      className="active:opacity-80"
    >
      <Icon size={15} color={selected ? colors.primaryForeground : colors.foreground} />
      <Text style={[styles.viewModeText, selected ? styles.viewModeTextActive : null]}>
        {label}
      </Text>
    </Pressable>
  );
}

function ProjectViewModeSwitch({
  mode,
  onChange,
}: {
  mode: ProjectViewMode;
  onChange: (mode: ProjectViewMode) => void;
}) {
  const { t } = useTranslation();
  const { styles } = useProjectDetailTheme();

  return (
    <View style={styles.viewModeSwitch}>
      <ViewModeOption
        icon={ListTodo}
        label={t('projects.viewList')}
        selected={mode === 'list'}
        onPress={() => onChange('list')}
      />
      <ViewModeOption
        icon={FolderKanban}
        label={t('projects.viewBoard')}
        selected={mode === 'board'}
        onPress={() => onChange('board')}
      />
    </View>
  );
}

function SprintStatusBadge({ status }: { status: SprintStatus }) {
  const { t } = useTranslation();
  const label = isKnownSprintStatus(status) ? t(`sprints.status.${status}`) : status;
  return <SemanticBadge label={label} tone={sprintTone(status)} />;
}

function SprintFilterButton({
  label,
  selected,
  onPress,
}: {
  label: string;
  selected: boolean;
  onPress: () => void;
}) {
  const { styles } = useProjectDetailTheme();

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected }}
      onPress={onPress}
      style={[styles.sprintFilterButton, selected ? styles.sprintFilterButtonActive : null]}
      className="active:opacity-80"
    >
      <Text
        style={[styles.sprintFilterText, selected ? styles.sprintFilterTextActive : null]}
        numberOfLines={1}
      >
        {label}
      </Text>
    </Pressable>
  );
}

function SprintActionButton({
  disabled,
  icon: Icon,
  label,
  onPress,
}: {
  disabled?: boolean;
  icon: LucideIcon;
  label: string;
  onPress: () => void;
}) {
  const { colors, styles } = useProjectDetailTheme();

  return (
    <Pressable
      accessibilityRole="button"
      disabled={disabled}
      onPress={onPress}
      style={[styles.sprintActionButton, disabled ? styles.sprintActionButtonDisabled : null]}
      className="active:opacity-80"
    >
      <Icon size={14} color={colors.foreground} />
      <Text style={styles.sprintActionText} numberOfLines={1}>
        {label}
      </Text>
    </Pressable>
  );
}

function SprintCard({
  busy,
  language,
  onComplete,
  onOpen,
  onSelect,
  onStart,
  selected,
  sprint,
}: {
  busy: boolean;
  language: string;
  onComplete: () => void;
  onOpen: () => void;
  onSelect: () => void;
  onStart: () => void;
  selected: boolean;
  sprint: Sprint;
}) {
  const { t } = useTranslation();
  const { colors, styles } = useProjectDetailTheme();
  const canStart = sprint.status === 'planned';
  const canComplete = sprint.status === 'active';
  const dateRange = sprintDateRange(sprint, language);

  return (
    <View style={[styles.sprintCard, selected ? styles.sprintCardSelected : null]}>
      <Pressable
        accessibilityRole="button"
        accessibilityState={{ selected }}
        onPress={onSelect}
        style={styles.sprintCardBody}
        className="active:opacity-80"
      >
        <View style={styles.sprintCardHeader}>
          <Text style={styles.sprintName} numberOfLines={2}>
            {sprint.name}
          </Text>
          <SprintStatusBadge status={sprint.status} />
        </View>

        {sprint.goal ? (
          <Text style={styles.sprintGoal} numberOfLines={2}>
            {sprint.goal}
          </Text>
        ) : null}

        <View style={styles.sprintMetaRow}>
          {dateRange ? (
            <View style={styles.sprintDateWrap}>
              <Calendar size={13} color={colors.mutedForeground} />
              <Text style={styles.sprintDateText} numberOfLines={1}>
                {dateRange}
              </Text>
            </View>
          ) : null}
          <SemanticBadge label={t('issues.count', { count: sprint.issueCount ?? 0 })} />
        </View>
      </Pressable>

      <View style={styles.sprintActionRow}>
        <SprintActionButton
          icon={ArrowRight}
          label={t('sprints.open')}
          disabled={busy}
          onPress={onOpen}
        />
        {canStart ? (
          <SprintActionButton
            icon={Play}
            label={t('sprints.startSprint')}
            disabled={busy}
            onPress={onStart}
          />
        ) : null}
        {canComplete ? (
          <SprintActionButton
            icon={CheckCircle2}
            label={t('sprints.completeSprint')}
            disabled={busy}
            onPress={onComplete}
          />
        ) : null}
      </View>
    </View>
  );
}

function SprintPanel({
  filters,
  loading,
  loadError,
  onFiltersChange,
  onOpenSprint,
  projectId,
  sprints,
}: {
  filters: IssueListFilters;
  loading: boolean;
  loadError: boolean;
  onFiltersChange: (filters: IssueListFilters) => void;
  onOpenSprint: (sprintId: string) => void;
  projectId: string;
  sprints: Sprint[];
}) {
  const { i18n, t } = useTranslation();
  const { colors, styles } = useProjectDetailTheme();
  const createSprint = useCreateSprint(projectId);
  const updateSprint = useUpdateSprint(projectId);
  const [formOpen, setFormOpen] = useState(false);
  const [name, setName] = useState('');
  const [goal, setGoal] = useState('');
  const [startDate, setStartDate] = useState(dateInputValue);
  const [endDate, setEndDate] = useState(() => dateInputValue(14));
  const [formError, setFormError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const busy = createSprint.isPending || updateSprint.isPending;
  const orderedSprints = useMemo(
    () =>
      [...sprints].sort((left, right) => {
        const statusDiff = sprintStatusOrder(left.status) - sprintStatusOrder(right.status);
        if (statusDiff !== 0) return statusDiff;
        const leftTime = new Date(left.startDate ?? left.createdAt ?? 0).getTime();
        const rightTime = new Date(right.startDate ?? right.createdAt ?? 0).getTime();
        return rightTime - leftTime;
      }),
    [sprints],
  );

  const setSprintFilter = (sprintId: IssueListFilters['sprintId']) => {
    onFiltersChange({ ...filters, sprintId });
  };

  const resetForm = () => {
    setName('');
    setGoal('');
    setStartDate(dateInputValue());
    setEndDate(dateInputValue(14));
    setFormError(null);
  };

  const submitSprint = async () => {
    setFormError(null);
    setActionError(null);
    const trimmedName = name.trim();
    const trimmedStart = startDate.trim();
    const trimmedEnd = endDate.trim();
    if (!trimmedName || !trimmedStart || !trimmedEnd) {
      setFormError(t('sprints.errors.requiredFields'));
      return;
    }
    const parsedStart = parseDateInput(trimmedStart);
    const parsedEnd = parseDateInput(trimmedEnd);
    if (!parsedStart || !parsedEnd) {
      setFormError(t('sprints.errors.invalidDate'));
      return;
    }
    const duration = Math.round((parsedEnd.getTime() - parsedStart.getTime()) / DAY_MS);
    if (duration < 1) {
      setFormError(t('sprints.errors.endAfterStart'));
      return;
    }
    if (duration > 90) {
      setFormError(t('sprints.errors.durationRange'));
      return;
    }

    try {
      const sprint = await createSprint.mutateAsync({
        name: trimmedName,
        goal: goal.trim() || null,
        startDate: trimmedStart,
        endDate: trimmedEnd,
      });
      resetForm();
      setFormOpen(false);
      setSprintFilter(sprint.id);
    } catch {
      setFormError(t('sprints.errors.createFailed'));
    }
  };

  const updateStatus = async (sprint: Sprint, status: SprintStatus) => {
    setActionError(null);
    setFormError(null);
    try {
      await updateSprint.mutateAsync({ sprintId: sprint.id, patch: { status } });
    } catch {
      setActionError(t('sprints.updateFailed'));
    }
  };

  return (
    <SurfaceRow className="gap-3">
      <View style={styles.sprintPanelHeader}>
        <View style={styles.sprintPanelTitle}>
          <IconTile icon={Timer} tone="cyan" />
          <View style={styles.sprintTitleCopy}>
            <Text style={styles.sprintPanelHeading}>{t('sprints.title')}</Text>
            <Text style={styles.sprintPanelSubheading} numberOfLines={2}>
              {t('sprints.subtitle')}
            </Text>
          </View>
        </View>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={formOpen ? t('common.cancel') : t('sprints.new')}
          onPress={() => {
            setActionError(null);
            setFormOpen((open) => !open);
          }}
          style={styles.sprintIconButton}
          className="active:opacity-80"
        >
          {formOpen ? (
            <X size={17} color={colors.foreground} />
          ) : (
            <Plus size={17} color={colors.foreground} />
          )}
        </Pressable>
      </View>

      <View style={styles.sprintFilterRow}>
        <SprintFilterButton
          label={t('common.all')}
          selected={filters.sprintId === 'all'}
          onPress={() => setSprintFilter('all')}
        />
        <SprintFilterButton
          label={t('sprints.backlog')}
          selected={filters.sprintId === 'none'}
          onPress={() => setSprintFilter('none')}
        />
      </View>

      {formOpen ? (
        <View style={styles.sprintForm}>
          <TextField
            label={t('sprints.nameLabel')}
            value={name}
            onChangeText={setName}
            placeholder={t('sprints.namePlaceholder')}
            autoCapitalize="sentences"
          />
          <TextField
            label={t('sprints.goalLabel')}
            value={goal}
            onChangeText={setGoal}
            placeholder={t('sprints.goalPlaceholder')}
            autoCapitalize="sentences"
          />
          <View style={styles.sprintDateFields}>
            <View style={styles.sprintDateField}>
              <TextField
                label={t('sprints.startDateLabel')}
                value={startDate}
                onChangeText={setStartDate}
                placeholder={t('sprints.datePlaceholder')}
                keyboardType="numbers-and-punctuation"
                autoCapitalize="none"
              />
            </View>
            <View style={styles.sprintDateField}>
              <TextField
                label={t('sprints.endDateLabel')}
                value={endDate}
                onChangeText={setEndDate}
                placeholder={t('sprints.datePlaceholder')}
                keyboardType="numbers-and-punctuation"
                autoCapitalize="none"
              />
            </View>
          </View>
          {formError ? <Text style={styles.sprintErrorText}>{formError}</Text> : null}
          <View style={styles.sprintFormActions}>
            <Button
              title={t('sprints.createButton')}
              icon={Plus}
              loading={createSprint.isPending}
              disabled={updateSprint.isPending}
              onPress={() => void submitSprint()}
              style={styles.sprintFormAction}
            />
            <Button
              title={t('common.cancel')}
              icon={X}
              variant="secondary"
              disabled={busy}
              onPress={() => {
                resetForm();
                setFormOpen(false);
              }}
              style={styles.sprintFormAction}
            />
          </View>
        </View>
      ) : null}

      {loadError ? <Text style={styles.sprintErrorText}>{t('sprints.loadFailed')}</Text> : null}
      {actionError ? <Text style={styles.sprintErrorText}>{actionError}</Text> : null}
      {loading ? <Text style={styles.sprintMutedText}>{t('sprints.loading')}</Text> : null}

      {orderedSprints.length > 0 ? (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.sprintListContent}
        >
          {orderedSprints.map((sprint) => (
            <SprintCard
              key={sprint.id}
              sprint={sprint}
              language={i18n.language}
              busy={busy}
              selected={filters.sprintId === sprint.id}
              onSelect={() => setSprintFilter(filters.sprintId === sprint.id ? 'all' : sprint.id)}
              onOpen={() => onOpenSprint(sprint.id)}
              onStart={() => void updateStatus(sprint, 'active')}
              onComplete={() => void updateStatus(sprint, 'completed')}
            />
          ))}
        </ScrollView>
      ) : !loading ? (
        <Text style={styles.sprintMutedText}>{t('sprints.empty')}</Text>
      ) : null}
    </SurfaceRow>
  );
}

function AnalyticsMetric({
  label,
  tone = 'neutral',
  value,
}: {
  label: string;
  tone?: 'blue' | 'emerald' | 'amber' | 'rose' | 'violet' | 'neutral';
  value: string;
}) {
  const { styles } = useProjectDetailTheme();

  return (
    <View style={styles.analyticsMetric}>
      <SemanticBadge label={label} tone={tone} />
      <Text style={styles.analyticsMetricValue} numberOfLines={1}>
        {value}
      </Text>
    </View>
  );
}

function AnalyticsBar({ label, max, value }: { label: string; max: number; value: number }) {
  const { styles } = useProjectDetailTheme();
  const widthPercent = max > 0 ? Math.max(6, Math.round((value / max) * 100)) : 0;

  return (
    <View style={styles.analyticsBarRow}>
      <View style={styles.analyticsBarLabelWrap}>
        <Text style={styles.analyticsBarLabel} numberOfLines={1}>
          {label}
        </Text>
        <Text style={styles.analyticsBarCount}>{value}</Text>
      </View>
      <View style={styles.analyticsBarTrack}>
        <View style={[styles.analyticsBarFill, { width: `${widthPercent}%` }]} />
      </View>
    </View>
  );
}

function ProjectAnalyticsPanel({
  analytics,
  error,
  loading,
}: {
  analytics: ProjectAnalyticsResponse | undefined;
  error: boolean;
  loading: boolean;
}) {
  const { t } = useTranslation();
  const { colors, styles } = useProjectDetailTheme();
  const maxStatus = Math.max(
    ...(analytics?.health.issuesByStatus.map((item) => item.count) ?? [0]),
  );
  const maxThroughput = Math.max(...(analytics?.throughput.data.map((item) => item.count) ?? [0]));
  const recentThroughput = analytics?.throughput.data.slice(-6) ?? [];

  return (
    <SurfaceRow className="gap-3">
      <View style={styles.analyticsHeader}>
        <View style={styles.sprintPanelTitle}>
          <IconTile icon={BarChart3} tone="violet" />
          <View style={styles.sprintTitleCopy}>
            <Text style={styles.sprintPanelHeading}>{t('analytics.title')}</Text>
            <Text style={styles.sprintPanelSubheading} numberOfLines={2}>
              {t('analytics.subtitle')}
            </Text>
          </View>
        </View>
        {analytics ? (
          <SemanticBadge
            label={t('analytics.windowDays', { count: analytics.throughput.days })}
            tone="neutral"
          />
        ) : null}
      </View>

      {loading ? <Text style={styles.sprintMutedText}>{t('analytics.loading')}</Text> : null}
      {error ? <Text style={styles.sprintErrorText}>{t('analytics.loadFailed')}</Text> : null}

      {analytics ? (
        <>
          <View style={styles.analyticsGrid}>
            <AnalyticsMetric
              label={t('analytics.totalIssues')}
              value={String(analytics.health.overview.totalIssues)}
              tone="blue"
            />
            <AnalyticsMetric
              label={t('analytics.overdueIssues')}
              value={String(analytics.health.overview.overdueIssues)}
              tone={analytics.health.overview.overdueIssues > 0 ? 'rose' : 'neutral'}
            />
            <AnalyticsMetric
              label={t('analytics.unassignedIssues')}
              value={String(analytics.health.overview.unassignedIssues)}
              tone={analytics.health.overview.unassignedIssues > 0 ? 'amber' : 'neutral'}
            />
            <AnalyticsMetric
              label={t('analytics.activeSprints')}
              value={String(analytics.health.sprints.active)}
              tone="emerald"
            />
            <AnalyticsMetric
              label={t('analytics.avgVelocity')}
              value={t('analytics.velocityValue', {
                issues: analytics.velocity.averageVelocity.issues,
                points: analytics.velocity.averageVelocity.points,
              })}
              tone="violet"
            />
            <AnalyticsMetric
              label={t('analytics.cycleP90')}
              value={t('analytics.daysValue', {
                count: Math.round(analytics.cycleTime.p90 * 10) / 10,
              })}
              tone="amber"
            />
          </View>

          <View style={styles.analyticsSection}>
            <Text style={styles.analyticsSectionTitle}>{t('analytics.statusDistribution')}</Text>
            {analytics.health.issuesByStatus.length === 0 ? (
              <Text style={styles.sprintMutedText}>{t('analytics.noStatusData')}</Text>
            ) : null}
            {analytics.health.issuesByStatus.slice(0, 5).map((item) => (
              <AnalyticsBar
                key={item.status}
                label={item.name ?? item.category ?? item.status}
                value={item.count}
                max={maxStatus}
              />
            ))}
          </View>

          <View style={styles.analyticsSection}>
            <View style={styles.analyticsSectionHeader}>
              <Text style={styles.analyticsSectionTitle}>{t('analytics.throughput')}</Text>
              <View style={styles.analyticsInlineMeta}>
                <Activity size={13} color={colors.mutedForeground} />
                <Text style={styles.analyticsInlineMetaText}>{t('analytics.completedIssues')}</Text>
              </View>
            </View>
            {recentThroughput.length === 0 ? (
              <Text style={styles.sprintMutedText}>{t('analytics.noThroughputData')}</Text>
            ) : null}
            {recentThroughput.map((item) => (
              <AnalyticsBar
                key={item.period}
                label={item.period}
                value={item.count}
                max={maxThroughput}
              />
            ))}
          </View>
        </>
      ) : null}
    </SurfaceRow>
  );
}

function ProjectDetailHeader({
  analytics,
  analyticsError,
  analyticsLoading,
  filters,
  issues,
  onCreateIssue,
  onOpenAnalytics,
  onFiltersChange,
  onOpenBacklog,
  onOpenChat,
  onOpenDocs,
  onOpenModules,
  onOpenViews,
  onOpenSettings,
  onOpenRoadmap,
  onOpenSprints,
  onOpenSprint,
  onResetFilters,
  onViewModeChange,
  project,
  projectId,
  sprints,
  sprintsError,
  sprintsLoading,
  totalCount,
  viewMode,
}: {
  analytics: ProjectAnalyticsResponse | undefined;
  analyticsError: boolean;
  analyticsLoading: boolean;
  filters: IssueListFilters;
  issues: Issue[];
  onCreateIssue: () => void;
  onOpenAnalytics: () => void;
  onOpenBacklog: () => void;
  onFiltersChange: (filters: IssueListFilters) => void;
  onOpenModules: () => void;
  onOpenChat: () => void;
  onOpenDocs: () => void;
  onOpenViews: () => void;
  onOpenSettings: () => void;
  onOpenRoadmap: () => void;
  onOpenSprints: () => void;
  onOpenSprint: (sprintId: string) => void;
  onResetFilters: () => void;
  onViewModeChange: (mode: ProjectViewMode) => void;
  project: Project | undefined;
  projectId: string;
  sprints: Sprint[];
  sprintsError: boolean;
  sprintsLoading: boolean;
  totalCount: number;
  viewMode: ProjectViewMode;
}) {
  const { t } = useTranslation();
  const { styles } = useProjectDetailTheme();
  const latest = issues[0];
  const statusCount = useMemo(
    () => uniqueCount(issues.map((issue) => issue.status?.name ?? issue.status?.category)),
    [issues],
  );
  const priorityCount = useMemo(() => uniqueCount(issues.map((issue) => issue.priority)), [issues]);

  return (
    <View>
      <ScreenHeader
        kicker={project?.key ?? t('projects.title')}
        title={project?.name ?? t('projects.title')}
        subtitle={project?.description ?? t('projects.subtitle')}
        meta={<SemanticBadge label={t('issues.count', { count: issues.length })} tone="blue" />}
      />

      <View style={styles.summary}>
        <SummaryMetric value={issues.length} label={t('projects.issues')} />
        <SummaryMetric value={statusCount} label={t('issue.status')} />
        <SummaryMetric value={priorityCount} label={t('issue.priority')} />
      </View>

      <View style={styles.headerActions}>
        <Button title={t('issues.new')} icon={Plus} onPress={onCreateIssue} />
        <Button
          title={t('backlog.title')}
          variant="secondary"
          icon={Inbox}
          onPress={onOpenBacklog}
        />
        <Button
          title={t('sprints.title')}
          variant="secondary"
          icon={Timer}
          onPress={onOpenSprints}
        />
        <Button
          title={t('analytics.title')}
          variant="secondary"
          icon={BarChart3}
          onPress={onOpenAnalytics}
        />
        <Button
          title={t('modules.title')}
          variant="secondary"
          icon={Layers3}
          onPress={onOpenModules}
        />
        <Button
          title={t('chat.title')}
          variant="secondary"
          icon={MessageCircle}
          onPress={onOpenChat}
        />
        <Button
          title={t('docs.title')}
          variant="secondary"
          icon={BookOpenText}
          onPress={onOpenDocs}
        />
        <Button
          title={t('projectViews.title')}
          variant="secondary"
          icon={LayoutList}
          onPress={onOpenViews}
        />
        <Button
          title={t('projects.settings')}
          variant="secondary"
          icon={Settings}
          onPress={onOpenSettings}
        />
        <Button
          title={t('roadmap.title')}
          variant="secondary"
          icon={ChartGantt}
          onPress={onOpenRoadmap}
        />
      </View>

      <View style={styles.sprintPanelWrap}>
        <SprintPanel
          filters={filters}
          loading={sprintsLoading}
          loadError={sprintsError}
          onFiltersChange={onFiltersChange}
          onOpenSprint={onOpenSprint}
          projectId={projectId}
          sprints={sprints}
        />
      </View>

      <View style={styles.analyticsWrap}>
        <ProjectAnalyticsPanel
          analytics={analytics}
          error={analyticsError}
          loading={analyticsLoading}
        />
      </View>

      <View style={styles.viewModeWrap}>
        <ProjectViewModeSwitch mode={viewMode} onChange={onViewModeChange} />
      </View>

      <View style={styles.filterWrap}>
        <IssueFilterPanel
          filters={filters}
          onChange={onFiltersChange}
          onReset={onResetFilters}
          totalCount={totalCount}
          visibleCount={issues.length}
        />
      </View>

      {viewMode === 'list' && latest ? (
        <View style={styles.featuredWrap}>
          <FeaturedIssueCard issue={latest} />
        </View>
      ) : null}
    </View>
  );
}

function ProjectIssuesEmpty({ filtered }: { filtered: boolean }) {
  const { t } = useTranslation();

  return (
    <EmptyState
      icon={ListTodo}
      title={filtered ? t('issues.noMatches') : t('issues.empty')}
      description={filtered ? t('issues.noMatchesDesc') : t('issues.emptyDesc')}
    />
  );
}

export function ProjectDetailScreen({ navigation, route }: ProjectDetailProps) {
  const { t } = useTranslation();
  const { styles } = useProjectDetailTheme();
  const { id } = route.params;
  const { data: projects } = useProjects();
  const projectFromList = (projects ?? []).find((p) => p.id === id);
  const projectQ = useProject(id);
  const project = projectQ.data ?? projectFromList;
  const routeFilters = useMemo(() => issueListFiltersFromRouteParams(route.params), [route.params]);
  const [filters, setFilters] = useState<IssueListFilters>(routeFilters);
  const [viewMode, setViewMode] = useState<ProjectViewMode>(route.params.viewMode ?? 'list');
  const boardDefaultSprintApplied = useRef(false);

  const apiFilters = useMemo(
    () => ({ projectId: id, ...apiFiltersFromIssueListFilters(filters) }),
    [filters, id],
  );
  const { data, isLoading, isError, error, refetch, isRefetching } = useIssues(apiFilters);
  const sprintsQ = useSprints(id);
  const analyticsQ = useProjectAnalytics(id);
  const workflowStatusesQ = useProjectWorkflowStatuses(viewMode === 'board' ? id : null);
  const issues = useMemo(() => data ?? [], [data]);
  const visibleIssues = useMemo(() => filterIssues(issues, filters), [filters, issues]);
  const filtered = hasActiveIssueFilters(filters);

  useEffect(() => {
    if (route.params.viewMode) setViewMode(route.params.viewMode);
  }, [route.params.viewMode]);

  useEffect(() => {
    setFilters(routeFilters);
  }, [routeFilters]);

  useEffect(() => {
    boardDefaultSprintApplied.current = false;
  }, [id, route.params.sprintId, route.params.viewMode]);

  useEffect(() => {
    if (boardDefaultSprintApplied.current) return;
    if (route.params.viewMode !== 'board') return;
    if (route.params.sprintId) return;
    if (sprintsQ.isLoading) return;

    const activeSprint = (sprintsQ.data ?? []).find((sprint) => sprint.status === 'active');
    boardDefaultSprintApplied.current = true;
    if (!activeSprint) return;

    setFilters((current) =>
      current.sprintId === 'all' ? { ...current, sprintId: activeSprint.id } : current,
    );
  }, [id, route.params.sprintId, route.params.viewMode, sprintsQ.data, sprintsQ.isLoading]);

  if (isLoading) return <Loading />;
  if (isError) {
    return (
      <Screen>
        <ErrorView
          message={error instanceof Error ? error.message : t('common.retry')}
          onRetry={() => void refetch()}
        />
      </Screen>
    );
  }

  const renderItem: ListRenderItem<Issue> = ({ item }) => <IssueListItem issue={item} />;
  const header = (
    <ProjectDetailHeader
      analytics={analyticsQ.data}
      analyticsError={analyticsQ.isError}
      analyticsLoading={analyticsQ.isLoading}
      filters={filters}
      issues={visibleIssues}
      project={project}
      projectId={id}
      sprints={sprintsQ.data ?? []}
      sprintsError={sprintsQ.isError}
      sprintsLoading={sprintsQ.isLoading}
      totalCount={issues.length}
      viewMode={viewMode}
      onCreateIssue={() =>
        navigation.navigate('NewIssue', {
          projectId: id,
          ...(filters.sprintId !== 'all' && filters.sprintId !== 'none'
            ? { sprintId: filters.sprintId }
            : {}),
        })
      }
      onFiltersChange={setFilters}
      onOpenAnalytics={() => navigation.navigate('ProjectAnalytics', { projectId: id })}
      onOpenBacklog={() => navigation.navigate('ProjectBacklog', { projectId: id })}
      onOpenChat={() => navigation.navigate('ProjectChat', { projectId: id })}
      onOpenDocs={() => navigation.navigate('ProjectDocs', { projectId: id })}
      onOpenModules={() => navigation.navigate('ProjectModules', { projectId: id })}
      onOpenViews={() => navigation.navigate('ProjectViews', { projectId: id })}
      onOpenSettings={() => navigation.navigate('ProjectSettings', { id })}
      onOpenRoadmap={() => navigation.navigate('ProjectRoadmap', { projectId: id })}
      onOpenSprints={() => navigation.navigate('ProjectSprints', { projectId: id })}
      onOpenSprint={(sprintId) => navigation.navigate('SprintDetail', { projectId: id, sprintId })}
      onResetFilters={() => setFilters(defaultIssueListFilters)}
      onViewModeChange={setViewMode}
    />
  );
  const refreshControl = (
    <RefreshControl
      refreshing={
        isRefetching ||
        projectQ.isRefetching ||
        sprintsQ.isRefetching ||
        analyticsQ.isRefetching ||
        workflowStatusesQ.isRefetching
      }
      onRefresh={() => {
        void refetch();
        void projectQ.refetch();
        void sprintsQ.refetch();
        void analyticsQ.refetch();
        if (viewMode === 'board') void workflowStatusesQ.refetch();
      }}
    />
  );

  if (viewMode === 'board') {
    return (
      <Screen>
        <ScrollView
          contentContainerStyle={styles.boardScreenContent}
          refreshControl={refreshControl}
        >
          {header}
          <ProjectBoard
            issues={visibleIssues}
            workflowStatuses={workflowStatusesQ.data ?? []}
            workflowStatusesError={workflowStatusesQ.isError}
            workflowStatusesLoading={workflowStatusesQ.isLoading}
            onOpenWorkflowSettings={() =>
              navigation.navigate('ProjectWorkflows', { projectId: id })
            }
          />
        </ScrollView>
      </Screen>
    );
  }

  return (
    <Screen>
      <FlatList
        data={visibleIssues}
        keyExtractor={(i) => i.id}
        renderItem={renderItem}
        ItemSeparatorComponent={IssueSeparator}
        ListHeaderComponent={header}
        contentContainerStyle={styles.listContent}
        refreshControl={refreshControl}
        ListEmptyComponent={<ProjectIssuesEmpty filtered={filtered} />}
      />
    </Screen>
  );
}

function createProjectDetailStyles(colors: ThemeColors) {
  return StyleSheet.create({
    listContent: {
      paddingBottom: 16,
    },
    boardScreenContent: {
      paddingBottom: 16,
    },
    boardEmpty: {
      paddingHorizontal: 16,
      paddingTop: 8,
    },
    summary: {
      flexDirection: 'row',
      gap: 8,
      paddingHorizontal: 16,
      paddingBottom: 12,
    },
    metric: {
      flex: 1,
      gap: 2,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
      borderRadius: 6,
      backgroundColor: colors.surface,
      paddingHorizontal: 10,
      paddingVertical: 10,
    },
    metricValue: {
      color: colors.foreground,
      fontSize: 18,
      fontWeight: '700',
      lineHeight: 24,
    },
    metricLabel: {
      color: colors.mutedForeground,
      fontSize: 12,
      lineHeight: 16,
    },
    featuredWrap: {
      paddingHorizontal: 16,
      paddingBottom: 12,
    },
    headerActions: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 10,
      paddingHorizontal: 16,
      paddingBottom: 12,
    },
    viewModeWrap: {
      paddingHorizontal: 16,
      paddingBottom: 12,
    },
    sprintPanelWrap: {
      paddingHorizontal: 16,
      paddingBottom: 12,
    },
    analyticsWrap: {
      paddingHorizontal: 16,
      paddingBottom: 12,
    },
    viewModeSwitch: {
      flexDirection: 'row',
      gap: 4,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
      borderRadius: 6,
      backgroundColor: colors.card,
      padding: 4,
    },
    viewModeOption: {
      minHeight: 36,
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 7,
      borderRadius: 4,
      paddingHorizontal: 10,
      paddingVertical: 8,
    },
    viewModeOptionActive: {
      backgroundColor: colors.primary,
    },
    viewModeText: {
      color: colors.foreground,
      fontSize: 13,
      fontWeight: '700',
      lineHeight: 18,
    },
    viewModeTextActive: {
      color: colors.primaryForeground,
    },
    filterWrap: {
      paddingHorizontal: 16,
      paddingBottom: 12,
    },
    sprintPanelHeader: {
      minHeight: 44,
      flexDirection: 'row',
      alignItems: 'flex-start',
      justifyContent: 'space-between',
      gap: 12,
    },
    sprintPanelTitle: {
      minWidth: 0,
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
    },
    sprintTitleCopy: {
      minWidth: 0,
      flex: 1,
      gap: 2,
    },
    sprintPanelHeading: {
      color: colors.foreground,
      fontSize: 16,
      fontWeight: '700',
      lineHeight: 22,
    },
    sprintPanelSubheading: {
      color: colors.mutedForeground,
      fontSize: 13,
      lineHeight: 18,
    },
    analyticsHeader: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      justifyContent: 'space-between',
      gap: 10,
    },
    analyticsGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 8,
    },
    analyticsMetric: {
      minWidth: 132,
      flex: 1,
      gap: 8,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
      borderRadius: 6,
      backgroundColor: colors.surface,
      paddingHorizontal: 10,
      paddingVertical: 10,
    },
    analyticsMetricValue: {
      color: colors.foreground,
      fontSize: 17,
      fontWeight: '700',
      lineHeight: 23,
    },
    analyticsSection: {
      gap: 8,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
      borderRadius: 6,
      backgroundColor: colors.surface,
      padding: 10,
    },
    analyticsSectionHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 10,
    },
    analyticsSectionTitle: {
      color: colors.foreground,
      fontSize: 13,
      fontWeight: '700',
      lineHeight: 18,
    },
    analyticsInlineMeta: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
    },
    analyticsInlineMetaText: {
      color: colors.mutedForeground,
      fontSize: 11,
      fontWeight: '600',
      lineHeight: 15,
    },
    analyticsBarRow: {
      gap: 5,
    },
    analyticsBarLabelWrap: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 10,
    },
    analyticsBarLabel: {
      minWidth: 0,
      flex: 1,
      color: colors.mutedForeground,
      fontSize: 12,
      fontWeight: '600',
      lineHeight: 16,
    },
    analyticsBarCount: {
      color: colors.foreground,
      fontSize: 12,
      fontWeight: '700',
      lineHeight: 16,
    },
    analyticsBarTrack: {
      height: 7,
      borderRadius: 999,
      backgroundColor: colors.muted,
      overflow: 'hidden',
    },
    analyticsBarFill: {
      height: '100%',
      borderRadius: 999,
      backgroundColor: colors.primary,
    },
    sprintIconButton: {
      width: 38,
      height: 38,
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
      borderRadius: 5,
      backgroundColor: colors.surface,
    },
    sprintFilterRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 8,
    },
    sprintFilterButton: {
      minHeight: 34,
      minWidth: 108,
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
      borderRadius: 4,
      backgroundColor: colors.surface,
      paddingHorizontal: 10,
      paddingVertical: 7,
    },
    sprintFilterButtonActive: {
      borderColor: colors.primary,
      backgroundColor: colors.primary,
    },
    sprintFilterText: {
      color: colors.mutedForeground,
      fontSize: 12,
      fontWeight: '700',
      lineHeight: 16,
    },
    sprintFilterTextActive: {
      color: colors.primaryForeground,
    },
    sprintForm: {
      gap: 10,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
      borderRadius: 6,
      backgroundColor: colors.surface,
      padding: 10,
    },
    sprintDateFields: {
      flexDirection: 'row',
      gap: 10,
    },
    sprintDateField: {
      minWidth: 0,
      flex: 1,
    },
    sprintFormActions: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 10,
    },
    sprintFormAction: {
      minWidth: 132,
      flexGrow: 1,
    },
    sprintErrorText: {
      color: colors.destructive,
      fontSize: 12,
      lineHeight: 17,
    },
    sprintMutedText: {
      color: colors.mutedForeground,
      fontSize: 13,
      lineHeight: 18,
    },
    sprintListContent: {
      gap: 10,
      paddingRight: 4,
    },
    sprintCard: {
      width: 278,
      gap: 8,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
      borderRadius: 6,
      backgroundColor: colors.surface,
      padding: 10,
    },
    sprintCardSelected: {
      borderColor: colors.primary,
      backgroundColor: colors.surface2,
    },
    sprintCardBody: {
      gap: 8,
    },
    sprintCardHeader: {
      minHeight: 26,
      flexDirection: 'row',
      alignItems: 'flex-start',
      justifyContent: 'space-between',
      gap: 8,
    },
    sprintName: {
      minWidth: 0,
      flex: 1,
      color: colors.foreground,
      fontSize: 14,
      fontWeight: '700',
      lineHeight: 20,
    },
    sprintGoal: {
      color: colors.mutedForeground,
      fontSize: 12,
      lineHeight: 17,
    },
    sprintMetaRow: {
      minHeight: 22,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 8,
    },
    sprintDateWrap: {
      minWidth: 0,
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
    },
    sprintDateText: {
      minWidth: 0,
      flex: 1,
      color: colors.mutedForeground,
      fontSize: 12,
      lineHeight: 16,
    },
    sprintActionRow: {
      flexDirection: 'row',
      gap: 8,
    },
    sprintActionButton: {
      minHeight: 34,
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 6,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
      borderRadius: 4,
      backgroundColor: colors.card,
      paddingHorizontal: 8,
      paddingVertical: 7,
    },
    sprintActionButtonDisabled: {
      opacity: 0.5,
    },
    sprintActionText: {
      minWidth: 0,
      flexShrink: 1,
      color: colors.foreground,
      fontSize: 12,
      fontWeight: '700',
      lineHeight: 16,
    },
  });
}
