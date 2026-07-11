import { useMemo, useState } from 'react';
import { Alert } from 'react-native';
import {
  FlatList,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
  type ListRenderItem,
} from '@/components/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import {
  BarChart3,
  Calendar,
  CheckCircle2,
  CircleDot,
  FolderKanban,
  ListTodo,
  Play,
  Plus,
  Target,
  Timer,
  type LucideIcon,
} from 'lucide-react-native';
import { useTranslation } from 'react-i18next';

import type {
  Issue,
  Sprint,
  SprintBurndownAnalytics,
  SprintBurndownPoint,
  SprintStatus,
} from '@/api/types';
import { IssueListItem, IssueSeparator } from '@/components/issue-list';
import { ProjectBoard } from '@/components/project-board';
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
} from '@/components/ui';
import {
  useProjectWorkflowStatuses,
  useSprint,
  useSprintBurndown,
  useSprintIssues,
  useUpdateSprint,
} from '@/hooks/queries';
import type { AppStackParamList } from '@/navigation/types';
import type { ThemeColors } from '@/design/theme';
import { useThemeColors } from '@/design/theme-context';

type SprintDetailProps = NativeStackScreenProps<AppStackParamList, 'SprintDetail'>;
type SprintViewMode = 'list' | 'board';
type SprintDetailStyles = ReturnType<typeof createSprintDetailStyles>;

const KNOWN_SPRINT_STATUSES = ['planned', 'active', 'completed', 'cancelled'] as const;
const DAY_MS = 24 * 60 * 60 * 1000;

type KnownSprintStatus = (typeof KNOWN_SPRINT_STATUSES)[number];

function useSprintDetailTheme(): { colors: ThemeColors; styles: SprintDetailStyles } {
  const colors = useThemeColors();
  const styles = useMemo(() => createSprintDetailStyles(colors), [colors]);
  return { colors, styles };
}

function isKnownSprintStatus(status: SprintStatus): status is KnownSprintStatus {
  return KNOWN_SPRINT_STATUSES.includes(status as KnownSprintStatus);
}

function sprintTone(status: SprintStatus): 'blue' | 'emerald' | 'neutral' | 'rose' {
  if (status === 'active') return 'emerald';
  if (status === 'completed') return 'neutral';
  if (status === 'cancelled') return 'rose';
  return 'blue';
}

function formatSprintDate(value: string | null | undefined, language: string): string {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleDateString(language, { day: 'numeric', month: 'short', year: 'numeric' });
}

function sprintDateRange(sprint: Sprint, language: string): string {
  const start = formatSprintDate(sprint.startDate, language);
  const end = formatSprintDate(sprint.endDate, language);
  if (start && end) return `${start} - ${end}`;
  return start || end;
}

function formatMetricNumber(value: number, language: string): string {
  return value.toLocaleString(language, { maximumFractionDigits: 1 });
}

function formatBurndownDate(value: string, language: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString(language, { day: 'numeric', month: 'short' });
}

function burndownMax(analytics: SprintBurndownAnalytics): number {
  const values = [
    analytics.totalPoints,
    ...analytics.burndown.map((point) => point.ideal),
    ...analytics.burndown.map((point) => point.actual ?? 0),
  ];
  return Math.max(1, ...values);
}

function burndownBarWidth(value: number, max: number): number {
  if (!Number.isFinite(value) || value <= 0 || max <= 0) return 0;
  return Math.min(100, (value / max) * 100);
}

function daysRemaining(sprint: Sprint): number | null {
  if (!sprint.endDate) return null;
  const end = new Date(sprint.endDate);
  if (Number.isNaN(end.getTime())) return null;
  return Math.ceil((end.getTime() - Date.now()) / DAY_MS);
}

function isDoneIssue(issue: Issue): boolean {
  return issue.status?.category === 'done' || issue.status?.name?.toLowerCase() === 'done';
}

function isInProgressIssue(issue: Issue): boolean {
  return issue.status?.category === 'in_progress';
}

function SprintStatusBadge({ status }: { status: SprintStatus }) {
  const { t } = useTranslation();
  const label = isKnownSprintStatus(status) ? t(`sprints.status.${status}`) : status;
  return <SemanticBadge label={label} tone={sprintTone(status)} />;
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
  const { styles } = useSprintDetailTheme();

  return (
    <Button
      title={label}
      icon={Icon}
      variant={selected ? 'primary' : 'secondary'}
      onPress={onPress}
      style={styles.viewModeButton}
    />
  );
}

function StatTile({
  label,
  tone = 'neutral',
  value,
}: {
  label: string;
  tone?: 'blue' | 'emerald' | 'amber' | 'rose' | 'violet' | 'neutral';
  value: string;
}) {
  const { styles } = useSprintDetailTheme();

  return (
    <View style={styles.statTile}>
      <Text style={styles.statValue} numberOfLines={1}>
        {value}
      </Text>
      <SemanticBadge label={label} tone={tone} />
    </View>
  );
}

function BurndownBar({
  color,
  label,
  max,
  value,
  valueLabel,
}: {
  color: string;
  label: string;
  max: number;
  value: number;
  valueLabel: string;
}) {
  const { styles } = useSprintDetailTheme();
  const width = burndownBarWidth(value, max);

  return (
    <View style={styles.burndownBarRow}>
      <Text style={styles.burndownBarLabel} numberOfLines={1}>
        {label}
      </Text>
      <View style={styles.burndownBarTrack}>
        <View style={[styles.burndownBarFill, { backgroundColor: color, width: `${width}%` }]} />
      </View>
      <Text style={styles.burndownBarValue} numberOfLines={1}>
        {valueLabel}
      </Text>
    </View>
  );
}

function BurndownPointRow({ max, point }: { max: number; point: SprintBurndownPoint }) {
  const { i18n, t } = useTranslation();
  const { colors, styles } = useSprintDetailTheme();
  const actualLabel =
    point.actual === null
      ? t('sprints.burndownFuture')
      : formatMetricNumber(point.actual, i18n.language);

  return (
    <View style={styles.burndownPoint}>
      <Text style={styles.burndownDate} numberOfLines={1}>
        {formatBurndownDate(point.date, i18n.language)}
      </Text>
      <View style={styles.burndownBars}>
        <BurndownBar
          color={colors.accentCyan}
          label={t('sprints.burndownIdeal')}
          max={max}
          value={point.ideal}
          valueLabel={formatMetricNumber(point.ideal, i18n.language)}
        />
        <BurndownBar
          color={colors.accentEmerald}
          label={t('sprints.burndownActual')}
          max={max}
          value={point.actual ?? 0}
          valueLabel={actualLabel}
        />
      </View>
    </View>
  );
}

function SprintBurndownSection({
  analytics,
  errorMessage,
  loading,
}: {
  analytics: SprintBurndownAnalytics | undefined;
  errorMessage: string | null;
  loading: boolean;
}) {
  const { i18n, t } = useTranslation();
  const { styles } = useSprintDetailTheme();
  const visiblePoints = analytics?.burndown.slice(-14) ?? [];
  const max = analytics ? burndownMax(analytics) : 1;

  return (
    <SurfaceRow className="gap-3">
      <View style={styles.sectionHeader}>
        <IconTile icon={BarChart3} tone="violet" />
        <View style={styles.sectionCopy}>
          <Text style={styles.sectionTitle}>{t('sprints.burndownTitle')}</Text>
          <Text style={styles.sectionSubtitle}>{t('sprints.burndownSubtitle')}</Text>
        </View>
      </View>

      {analytics ? (
        <View style={styles.statGrid}>
          <StatTile
            label={t('sprints.burndownTotalPoints')}
            value={formatMetricNumber(analytics.totalPoints, i18n.language)}
            tone="blue"
          />
          <StatTile
            label={t('sprints.burndownCompletedPoints')}
            value={formatMetricNumber(analytics.completedPoints, i18n.language)}
            tone="emerald"
          />
          <StatTile
            label={t('sprints.burndownRemainingPoints')}
            value={formatMetricNumber(analytics.remainingPoints, i18n.language)}
            tone="amber"
          />
          <StatTile
            label={t('sprints.burndownRemainingIssues')}
            value={formatMetricNumber(analytics.remainingIssues, i18n.language)}
            tone="neutral"
          />
        </View>
      ) : null}

      {analytics?.hours ? (
        <View style={styles.hoursBlock}>
          <Text style={styles.hoursTitle}>{t('sprints.burndownHoursTitle')}</Text>
          <View style={styles.statGrid}>
            <StatTile
              label={t('sprints.burndownEstimateHours')}
              value={formatMetricNumber(analytics.hours.totalEstimateHours, i18n.language)}
              tone="blue"
            />
            <StatTile
              label={t('sprints.burndownActualHours')}
              value={formatMetricNumber(analytics.hours.totalActualHours, i18n.language)}
              tone="violet"
            />
            <StatTile
              label={t('sprints.burndownCompletedHours')}
              value={formatMetricNumber(analytics.hours.completedActualHours, i18n.language)}
              tone="emerald"
            />
            <StatTile
              label={t('sprints.burndownRemainingHours')}
              value={formatMetricNumber(analytics.hours.remainingEstimateHours, i18n.language)}
              tone="amber"
            />
          </View>
        </View>
      ) : null}

      {loading && !analytics ? (
        <Text style={styles.burndownMessage}>{t('sprints.burndownLoading')}</Text>
      ) : null}

      {errorMessage && !analytics ? (
        <Text style={styles.errorText}>{errorMessage || t('sprints.burndownLoadFailed')}</Text>
      ) : null}

      {!loading && !errorMessage && visiblePoints.length === 0 ? (
        <Text style={styles.burndownMessage}>{t('sprints.burndownNoData')}</Text>
      ) : null}

      {visiblePoints.length > 0 ? (
        <View style={styles.burndownRows}>
          {visiblePoints.map((point) => (
            <BurndownPointRow key={point.date} point={point} max={max} />
          ))}
        </View>
      ) : null}
    </SurfaceRow>
  );
}

function SprintSummary({
  completed,
  inProgress,
  issues,
  remainingDays,
  sprint,
  todo,
}: {
  completed: number;
  inProgress: number;
  issues: Issue[];
  remainingDays: number | null;
  sprint: Sprint;
  todo: number;
}) {
  const { t } = useTranslation();
  const { colors, styles } = useSprintDetailTheme();
  const remainingValue =
    sprint.status === 'active' && remainingDays !== null
      ? remainingDays > 0
        ? t('sprints.daysRemaining', { count: remainingDays })
        : t('sprints.ended')
      : t('common.none');

  return (
    <SurfaceRow className="gap-3">
      <View style={styles.sectionHeader}>
        <IconTile icon={Timer} tone="cyan" />
        <View style={styles.sectionCopy}>
          <Text style={styles.sectionTitle}>{t('sprints.progressTitle')}</Text>
          <Text style={styles.sectionSubtitle}>
            {t('sprints.issuesCompleted', { completed, total: issues.length })}
          </Text>
        </View>
      </View>

      <View style={styles.statGrid}>
        <StatTile label={t('sprints.statsTotal')} value={String(issues.length)} tone="blue" />
        <StatTile label={t('sprints.statsCompleted')} value={String(completed)} tone="emerald" />
        <StatTile label={t('sprints.statsInProgress')} value={String(inProgress)} tone="violet" />
        <StatTile label={t('sprints.statsTodo')} value={String(todo)} tone="neutral" />
      </View>

      <View style={styles.remainingRow}>
        <Calendar size={14} color={colors.mutedForeground} />
        <Text style={styles.remainingText} numberOfLines={2}>
          {remainingValue}
        </Text>
      </View>
    </SurfaceRow>
  );
}

function SprintHeader({
  actionError,
  canComplete,
  canStart,
  dateRange,
  onComplete,
  onCreateIssue,
  onStart,
  remainingDays,
  sprint,
  updatePending,
}: {
  actionError: string | null;
  canComplete: boolean;
  canStart: boolean;
  dateRange: string;
  onComplete: () => void;
  onCreateIssue: () => void;
  onStart: () => void;
  remainingDays: number | null;
  sprint: Sprint;
  updatePending: boolean;
}) {
  const { t } = useTranslation();
  const { colors, styles } = useSprintDetailTheme();
  const activeRemaining =
    sprint.status === 'active' && remainingDays !== null
      ? remainingDays > 0
        ? t('sprints.daysRemaining', { count: remainingDays })
        : t('sprints.ended')
      : null;

  return (
    <View>
      <ScreenHeader
        kicker={t('sprints.detailTitle')}
        title={sprint.name}
        subtitle={sprint.goal ?? t('sprints.detailsSubtitle')}
        meta={<SprintStatusBadge status={sprint.status} />}
      />

      <View style={styles.metaBlock}>
        <View style={styles.metaRow}>
          <Calendar size={14} color={colors.mutedForeground} />
          <Text style={styles.metaText} numberOfLines={2}>
            {dateRange || t('sprints.noDateRange')}
          </Text>
        </View>
        {sprint.goal ? (
          <View style={styles.metaRow}>
            <Target size={14} color={colors.mutedForeground} />
            <Text style={styles.metaText} numberOfLines={3}>
              {sprint.goal}
            </Text>
          </View>
        ) : null}
        {activeRemaining ? (
          <View style={styles.metaRow}>
            <CircleDot size={14} color={colors.accentEmerald} />
            <Text style={styles.metaText}>{activeRemaining}</Text>
          </View>
        ) : null}
      </View>

      {actionError ? <Text style={styles.errorText}>{actionError}</Text> : null}

      <View style={styles.actions}>
        <Button
          title={t('issues.new')}
          icon={Plus}
          onPress={onCreateIssue}
          style={styles.actionButton}
        />
        {canStart ? (
          <Button
            title={t('sprints.startSprint')}
            icon={Play}
            loading={updatePending}
            onPress={onStart}
            style={styles.actionButton}
          />
        ) : null}
        {canComplete ? (
          <Button
            title={t('sprints.completeSprint')}
            icon={CheckCircle2}
            loading={updatePending}
            onPress={onComplete}
            style={styles.actionButton}
          />
        ) : null}
      </View>
    </View>
  );
}

function SprintIssuesEmpty() {
  const { t } = useTranslation();

  return (
    <EmptyState
      icon={ListTodo}
      title={t('sprints.noIssuesTitle')}
      description={t('sprints.noIssuesDesc')}
    />
  );
}

export function SprintDetailScreen({ navigation, route }: SprintDetailProps) {
  const { i18n, t } = useTranslation();
  const { styles } = useSprintDetailTheme();
  const { projectId, sprintId } = route.params;
  const sprintQ = useSprint(sprintId);
  const issuesQ = useSprintIssues(sprintId);
  const burndownQ = useSprintBurndown(sprintId);
  const [actionError, setActionError] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<SprintViewMode>('board');
  const workflowStatusesQ = useProjectWorkflowStatuses(viewMode === 'board' ? projectId : null);
  const updateSprint = useUpdateSprint(projectId);

  const sprint = sprintQ.data;
  const issues = useMemo(() => issuesQ.data ?? [], [issuesQ.data]);
  const completed = useMemo(() => issues.filter(isDoneIssue).length, [issues]);
  const inProgress = useMemo(() => issues.filter(isInProgressIssue).length, [issues]);
  const todo = Math.max(0, issues.length - completed - inProgress);
  const remainingDays = sprint ? daysRemaining(sprint) : null;
  const dateRange = sprint ? sprintDateRange(sprint, i18n.language) : '';

  const updateStatus = async (status: SprintStatus) => {
    if (!sprint) return;
    setActionError(null);
    try {
      await updateSprint.mutateAsync({ sprintId: sprint.id, patch: { status } });
      void sprintQ.refetch();
      void issuesQ.refetch();
      void burndownQ.refetch();
    } catch (error: unknown) {
      setActionError(error instanceof Error ? error.message : t('sprints.updateFailed'));
    }
  };

  const startSprint = () => {
    if (issues.length === 0) {
      Alert.alert(
        t('sprints.confirmStartNoIssuesTitle'),
        t('sprints.confirmStartNoIssuesMessage'),
        [
          { text: t('common.cancel'), style: 'cancel' },
          { text: t('sprints.startSprint'), onPress: () => void updateStatus('active') },
        ],
      );
      return;
    }
    void updateStatus('active');
  };

  const completeSprint = () => {
    const incomplete = issues.length - completed;
    const message =
      incomplete > 0
        ? t('sprints.confirmCompleteWithIncomplete', { completed, incomplete })
        : t('sprints.confirmCompleteAllDone', { completed });

    Alert.alert(t('sprints.confirmCompleteTitle'), message, [
      { text: t('common.cancel'), style: 'cancel' },
      { text: t('sprints.completeSprint'), onPress: () => void updateStatus('completed') },
    ]);
  };

  if (sprintQ.isLoading || issuesQ.isLoading) return <Loading label={t('sprints.loading')} />;

  if (sprintQ.isError || issuesQ.isError) {
    const message =
      sprintQ.error instanceof Error
        ? sprintQ.error.message
        : issuesQ.error instanceof Error
          ? issuesQ.error.message
          : t('sprints.loadFailed');
    return (
      <Screen>
        <ErrorView
          message={message}
          onRetry={() => {
            void sprintQ.refetch();
            void issuesQ.refetch();
          }}
        />
      </Screen>
    );
  }

  if (!sprint) {
    return (
      <Screen>
        <EmptyState icon={Timer} title={t('sprints.notFound')} />
      </Screen>
    );
  }

  const refreshControl = (
    <RefreshControl
      refreshing={
        sprintQ.isRefetching ||
        issuesQ.isRefetching ||
        burndownQ.isRefetching ||
        workflowStatusesQ.isRefetching
      }
      onRefresh={() => {
        void sprintQ.refetch();
        void issuesQ.refetch();
        void burndownQ.refetch();
        if (viewMode === 'board') void workflowStatusesQ.refetch();
      }}
    />
  );
  const header = (
    <View>
      <SprintHeader
        actionError={actionError}
        canComplete={sprint.status === 'active'}
        canStart={sprint.status === 'planned'}
        dateRange={dateRange}
        onComplete={completeSprint}
        onCreateIssue={() => navigation.navigate('NewIssue', { projectId, sprintId })}
        onStart={startSprint}
        remainingDays={remainingDays}
        sprint={sprint}
        updatePending={updateSprint.isPending}
      />

      <View style={styles.summaryWrap}>
        <SprintSummary
          completed={completed}
          inProgress={inProgress}
          issues={issues}
          remainingDays={remainingDays}
          sprint={sprint}
          todo={todo}
        />
      </View>

      <View style={styles.summaryWrap}>
        <SprintBurndownSection
          analytics={burndownQ.data}
          errorMessage={
            burndownQ.error instanceof Error
              ? burndownQ.error.message
              : burndownQ.isError
                ? t('sprints.burndownLoadFailed')
                : null
          }
          loading={burndownQ.isLoading}
        />
      </View>

      <View style={styles.viewModeWrap}>
        <ViewModeOption
          icon={FolderKanban}
          label={t('projects.viewBoard')}
          selected={viewMode === 'board'}
          onPress={() => setViewMode('board')}
        />
        <ViewModeOption
          icon={ListTodo}
          label={t('projects.viewList')}
          selected={viewMode === 'list'}
          onPress={() => setViewMode('list')}
        />
      </View>
    </View>
  );
  const renderItem: ListRenderItem<Issue> = ({ item }) => <IssueListItem issue={item} />;

  if (viewMode === 'board') {
    return (
      <Screen>
        <ScrollView
          contentContainerStyle={styles.boardScreenContent}
          refreshControl={refreshControl}
        >
          {header}
          <ProjectBoard
            issues={issues}
            workflowStatuses={workflowStatusesQ.data ?? []}
            workflowStatusesError={workflowStatusesQ.isError}
            workflowStatusesLoading={workflowStatusesQ.isLoading}
            onOpenWorkflowSettings={() => navigation.navigate('ProjectWorkflows', { projectId })}
          />
        </ScrollView>
      </Screen>
    );
  }

  return (
    <Screen>
      <FlatList
        data={issues}
        keyExtractor={(issue) => issue.id}
        renderItem={renderItem}
        ItemSeparatorComponent={IssueSeparator}
        ListHeaderComponent={header}
        ListEmptyComponent={<SprintIssuesEmpty />}
        contentContainerStyle={styles.listContent}
        refreshControl={refreshControl}
      />
    </Screen>
  );
}

function createSprintDetailStyles(colors: ThemeColors) {
  return StyleSheet.create({
    metaBlock: {
      gap: 8,
      paddingHorizontal: 16,
      paddingBottom: 12,
    },
    metaRow: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: 8,
    },
    metaText: {
      minWidth: 0,
      flex: 1,
      color: colors.mutedForeground,
      fontSize: 13,
      lineHeight: 18,
    },
    errorText: {
      color: colors.destructive,
      fontSize: 13,
      lineHeight: 18,
      paddingHorizontal: 16,
      paddingBottom: 8,
    },
    actions: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 8,
      paddingHorizontal: 16,
      paddingBottom: 12,
    },
    actionButton: {
      minWidth: 148,
      flexGrow: 1,
    },
    summaryWrap: {
      paddingHorizontal: 16,
      paddingBottom: 12,
    },
    sectionHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
    },
    sectionCopy: {
      minWidth: 0,
      flex: 1,
      gap: 2,
    },
    sectionTitle: {
      color: colors.foreground,
      fontSize: 15,
      fontWeight: '700',
      lineHeight: 20,
    },
    sectionSubtitle: {
      color: colors.mutedForeground,
      fontSize: 13,
      lineHeight: 18,
    },
    statGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 8,
    },
    statTile: {
      minWidth: 130,
      flex: 1,
      gap: 8,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
      borderRadius: 6,
      backgroundColor: colors.surface,
      padding: 10,
    },
    statValue: {
      color: colors.foreground,
      fontSize: 20,
      fontWeight: '700',
      lineHeight: 26,
    },
    remainingRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
    },
    remainingText: {
      minWidth: 0,
      flex: 1,
      color: colors.mutedForeground,
      fontSize: 13,
      lineHeight: 18,
    },
    hoursBlock: {
      gap: 8,
    },
    hoursTitle: {
      color: colors.foreground,
      fontSize: 13,
      fontWeight: '700',
      lineHeight: 18,
    },
    burndownMessage: {
      color: colors.mutedForeground,
      fontSize: 13,
      lineHeight: 18,
    },
    burndownRows: {
      gap: 10,
    },
    burndownPoint: {
      gap: 8,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
      borderRadius: 6,
      backgroundColor: colors.surface,
      padding: 10,
    },
    burndownDate: {
      color: colors.foreground,
      fontSize: 13,
      fontWeight: '700',
      lineHeight: 18,
    },
    burndownBars: {
      gap: 7,
    },
    burndownBarRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
    },
    burndownBarLabel: {
      width: 54,
      color: colors.mutedForeground,
      fontSize: 11,
      fontWeight: '600',
      lineHeight: 14,
    },
    burndownBarTrack: {
      minWidth: 0,
      flex: 1,
      height: 8,
      borderRadius: 999,
      backgroundColor: colors.muted,
      overflow: 'hidden',
    },
    burndownBarFill: {
      height: '100%',
      borderRadius: 999,
    },
    burndownBarValue: {
      width: 56,
      color: colors.foreground,
      fontSize: 11,
      fontWeight: '700',
      lineHeight: 14,
      textAlign: 'right',
    },
    viewModeWrap: {
      flexDirection: 'row',
      gap: 8,
      paddingHorizontal: 16,
      paddingBottom: 12,
    },
    viewModeButton: {
      flex: 1,
    },
    boardScreenContent: {
      paddingBottom: 16,
    },
    boardEmpty: {
      paddingHorizontal: 16,
    },
    listContent: {
      paddingBottom: 16,
    },
  });
}
