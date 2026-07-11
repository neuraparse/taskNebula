import { Alert } from 'react-native';
import { useEffect, useMemo, useState } from 'react';
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
  AlertCircle,
  ArrowDown,
  ArrowUp,
  Check,
  Circle,
  Inbox,
  ListTodo,
  Minus,
  Plus,
  Timer,
  X,
  type LucideIcon,
} from 'lucide-react-native';
import { useTranslation } from 'react-i18next';

import type { Issue, IssuePriority, IssueType, Sprint, SprintStatus } from '@/api/types';
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
  apiFiltersFromIssueListFilters,
  defaultIssueListFilters,
  filterIssues,
  hasActiveIssueFilters,
  issueListFiltersFromRouteParams,
  IssueFilterPanel,
  type IssueListFilters,
} from '@/components/issue-filters';
import type { ThemeColors } from '@/design/theme';
import { useThemeColors } from '@/design/theme-context';
import {
  useAssignIssueToSprint,
  useIssues,
  useProject,
  useProjects,
  useSprints,
} from '@/hooks/queries';
import type { AppStackParamList } from '@/navigation/types';

type ProjectBacklogProps = NativeStackScreenProps<AppStackParamList, 'ProjectBacklog'>;
type Tone = 'blue' | 'emerald' | 'amber' | 'rose' | 'violet' | 'neutral';
type ProjectBacklogStyles = ReturnType<typeof createProjectBacklogStyles>;

function useProjectBacklogTheme(): { colors: ThemeColors; styles: ProjectBacklogStyles } {
  const colors = useThemeColors();
  const styles = useMemo(() => createProjectBacklogStyles(colors), [colors]);
  return { colors, styles };
}

const PRIORITY_ICON: Record<IssuePriority, LucideIcon> = {
  critical: AlertCircle,
  high: ArrowUp,
  medium: Minus,
  low: ArrowDown,
  none: Circle,
};

const PRIORITY_TONE: Record<IssuePriority, Tone> = {
  critical: 'rose',
  high: 'amber',
  medium: 'amber',
  low: 'blue',
  none: 'neutral',
};

const ISSUE_TONE: Record<IssueType, Tone> = {
  epic: 'violet',
  story: 'emerald',
  task: 'blue',
  bug: 'rose',
  subtask: 'neutral',
};

function sprintTone(status: SprintStatus): Tone {
  if (status === 'active') return 'emerald';
  if (status === 'planned') return 'blue';
  if (status === 'completed') return 'neutral';
  if (status === 'cancelled') return 'rose';
  return 'neutral';
}

function formatSprintDate(value: string | null | undefined, language: string): string {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleDateString(language, { day: 'numeric', month: 'short' });
}

function sprintRange(sprint: Sprint, language: string): string {
  const start = formatSprintDate(sprint.startDate, language);
  const end = formatSprintDate(sprint.endDate, language);
  if (start && end) return `${start} - ${end}`;
  return start || end;
}

function knownPriority(priority: IssuePriority | null | undefined): IssuePriority {
  return priority ?? 'none';
}

function SelectionBox({ selected }: { selected: boolean }) {
  const { colors, styles } = useProjectBacklogTheme();

  return (
    <View style={[styles.selectionBox, selected ? styles.selectionBoxActive : null]}>
      {selected ? <Check size={14} color={colors.primaryForeground} /> : null}
    </View>
  );
}

function SummaryMetric({ label, value }: { label: string; value: number }) {
  const { styles } = useProjectBacklogTheme();

  return (
    <View style={styles.summaryMetric}>
      <Text style={styles.summaryValue}>{value}</Text>
      <Text style={styles.summaryLabel} numberOfLines={1}>
        {label}
      </Text>
    </View>
  );
}

function SprintChip({
  disabled,
  onPress,
  sprint,
}: {
  disabled: boolean;
  onPress: () => void;
  sprint: Sprint;
}) {
  const { i18n, t } = useTranslation();
  const { colors, styles } = useProjectBacklogTheme();
  const subtitle = sprintRange(sprint, i18n.language);
  const label =
    sprint.status === 'active'
      ? t('backlog.activeSprintLabel', { name: sprint.name })
      : sprint.name;

  return (
    <Pressable
      accessibilityRole="button"
      disabled={disabled}
      onPress={onPress}
      style={[styles.sprintChip, disabled ? styles.disabled : null]}
      className="active:opacity-80"
    >
      <Timer size={14} color={colors.foreground} />
      <View style={styles.sprintChipText}>
        <Text style={styles.sprintChipTitle} numberOfLines={1}>
          {label}
        </Text>
        {subtitle ? (
          <Text style={styles.sprintChipSubtitle} numberOfLines={1}>
            {subtitle}
          </Text>
        ) : null}
      </View>
      <SemanticBadge
        label={
          sprint.status === 'active'
            ? t('sprints.status.active')
            : sprint.status === 'planned'
              ? t('sprints.status.planned')
              : sprint.status
        }
        tone={sprintTone(sprint.status)}
      />
    </Pressable>
  );
}

function BacklogIssueCard({
  busy,
  issue,
  onAssign,
  onOpen,
  onToggle,
  selected,
  sprints,
}: {
  busy: boolean;
  issue: Issue;
  onAssign: (sprintId: string) => void;
  onOpen: () => void;
  onToggle: () => void;
  selected: boolean;
  sprints: Sprint[];
}) {
  const { t } = useTranslation();
  const { colors, styles } = useProjectBacklogTheme();
  const priority = knownPriority(issue.priority);
  const PriorityIcon = PRIORITY_ICON[priority];

  return (
    <SurfaceRow className="gap-3">
      <View style={styles.issueHeader}>
        <Pressable
          accessibilityRole="checkbox"
          accessibilityState={{ checked: selected }}
          onPress={onToggle}
          style={styles.selectTarget}
          className="active:opacity-80"
        >
          <SelectionBox selected={selected} />
        </Pressable>

        <Pressable
          accessibilityRole="button"
          onPress={onOpen}
          style={styles.issueTitleWrap}
          className="active:opacity-80"
        >
          <View style={styles.issueMetaRow}>
            {issue.key ? (
              <Text style={styles.issueKey} numberOfLines={1}>
                {issue.key}
              </Text>
            ) : null}
            <SemanticBadge label={t(`issueType.${issue.type}`)} tone={ISSUE_TONE[issue.type]} />
          </View>
          <Text style={styles.issueTitle} numberOfLines={2}>
            {issue.title}
          </Text>
        </Pressable>
      </View>

      <View style={styles.issueFacts}>
        <View style={styles.issueFact}>
          <PriorityIcon size={14} color={colors.mutedForeground} />
          <SemanticBadge label={t(`priority.${priority}`)} tone={PRIORITY_TONE[priority]} />
        </View>
        {issue.status?.name ? <SemanticBadge label={issue.status.name} tone="neutral" /> : null}
        {issue.estimate ? (
          <SemanticBadge
            label={t('backlog.estimatePoints', { points: issue.estimate })}
            tone="blue"
          />
        ) : null}
      </View>

      <View style={styles.assignWrap}>
        <Text style={styles.assignLabel}>{t('backlog.addToSprint')}</Text>
        {sprints.length > 0 ? (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.issueSprintRail}
          >
            {sprints.map((sprint) => (
              <SprintChip
                key={sprint.id}
                sprint={sprint}
                disabled={busy}
                onPress={() => onAssign(sprint.id)}
              />
            ))}
          </ScrollView>
        ) : (
          <Text style={styles.noSprintText}>{t('backlog.noAssignableSprints')}</Text>
        )}
      </View>
    </SurfaceRow>
  );
}

function BulkPlanner({
  busy,
  onAssignSelected,
  onClear,
  selectedCount,
  sprints,
}: {
  busy: boolean;
  onAssignSelected: (sprintId: string) => void;
  onClear: () => void;
  selectedCount: number;
  sprints: Sprint[];
}) {
  const { t } = useTranslation();
  const { colors, styles } = useProjectBacklogTheme();

  if (selectedCount === 0) return null;

  return (
    <SurfaceRow className="gap-3">
      <View style={styles.bulkHeader}>
        <View style={styles.bulkTitleWrap}>
          <IconTile icon={Timer} tone="amber" />
          <View style={styles.bulkCopy}>
            <Text style={styles.bulkTitle}>
              {t('backlog.selectedTitle', { count: selectedCount })}
            </Text>
            <Text style={styles.bulkSubtitle}>{t('backlog.selectedSubtitle')}</Text>
          </View>
        </View>
        <Pressable
          accessibilityRole="button"
          onPress={onClear}
          style={styles.clearSelectionButton}
          className="active:opacity-80"
        >
          <X size={15} color={colors.foreground} />
        </Pressable>
      </View>

      {sprints.length > 0 ? (
        <View style={styles.bulkSprintGrid}>
          {sprints.map((sprint) => (
            <Button
              key={sprint.id}
              title={
                sprint.status === 'active'
                  ? t('backlog.activeSprintLabel', { name: sprint.name })
                  : sprint.name
              }
              icon={Timer}
              variant="secondary"
              disabled={busy}
              loading={busy}
              onPress={() => onAssignSelected(sprint.id)}
              style={styles.bulkSprintButton}
            />
          ))}
        </View>
      ) : (
        <Text style={styles.noSprintText}>{t('backlog.noAssignableSprints')}</Text>
      )}
    </SurfaceRow>
  );
}

export function ProjectBacklogScreen({ navigation, route }: ProjectBacklogProps) {
  const { t } = useTranslation();
  const { styles } = useProjectBacklogTheme();
  const { projectId } = route.params;
  const { data: projects } = useProjects();
  const projectFromList = (projects ?? []).find((project) => project.id === projectId);
  const projectQ = useProject(projectId);
  const sprintsQ = useSprints(projectId);
  const assignIssue = useAssignIssueToSprint(projectId);
  const defaultBacklogFilters = useMemo<IssueListFilters>(
    () => ({ ...defaultIssueListFilters, sprintId: 'none' }),
    [],
  );
  const routeFilters = useMemo(
    () => issueListFiltersFromRouteParams(route.params, defaultBacklogFilters),
    [defaultBacklogFilters, route.params],
  );
  const [filters, setFilters] = useState<IssueListFilters>(routeFilters);
  const issueApiFilters = useMemo(
    () => ({ projectId, ...apiFiltersFromIssueListFilters(filters) }),
    [filters, projectId],
  );
  const issuesQ = useIssues(issueApiFilters);
  const [selectedIssueIds, setSelectedIssueIds] = useState<string[]>([]);

  const project = projectQ.data ?? projectFromList;
  const allIssues = useMemo(() => issuesQ.data ?? [], [issuesQ.data]);
  const backlogIssues = useMemo(() => allIssues.filter((issue) => !issue.sprintId), [allIssues]);
  const visibleIssues = useMemo(
    () => filterIssues(backlogIssues, { ...filters, sprintId: 'all' }),
    [backlogIssues, filters],
  );
  const assignableSprints = useMemo(
    () =>
      (sprintsQ.data ?? []).filter(
        (sprint) => sprint.status === 'active' || sprint.status === 'planned',
      ),
    [sprintsQ.data],
  );
  const selectedVisibleCount = selectedIssueIds.filter((id) =>
    visibleIssues.some((issue) => issue.id === id),
  ).length;
  const filtered = hasActiveIssueFilters({ ...filters, sprintId: 'all' });
  const activeSprintCount = assignableSprints.filter((sprint) => sprint.status === 'active').length;
  const plannedSprintCount = assignableSprints.filter(
    (sprint) => sprint.status === 'planned',
  ).length;

  const resetFilters = () => {
    setFilters(defaultBacklogFilters);
  };

  useEffect(() => {
    setFilters(routeFilters);
  }, [routeFilters]);

  const toggleIssue = (issueId: string) => {
    setSelectedIssueIds((current) =>
      current.includes(issueId) ? current.filter((id) => id !== issueId) : [...current, issueId],
    );
  };

  const clearSelection = () => {
    setSelectedIssueIds([]);
  };

  const selectAllVisible = () => {
    setSelectedIssueIds((current) => {
      const ids = new Set(current);
      for (const issue of visibleIssues) ids.add(issue.id);
      return [...ids];
    });
  };

  const assignOne = (issueId: string, sprintId: string) => {
    assignIssue.mutate(
      { issueId, sprintId },
      {
        onSuccess: () => {
          setSelectedIssueIds((current) => current.filter((id) => id !== issueId));
        },
        onError: (error) => {
          Alert.alert(
            t('backlog.assignFailedTitle'),
            error instanceof Error ? error.message : t('backlog.assignFailedDescription'),
          );
        },
      },
    );
  };

  const assignSelected = (sprintId: string) => {
    const issueIds = selectedIssueIds.filter((id) =>
      visibleIssues.some((issue) => issue.id === id),
    );
    if (issueIds.length === 0) return;

    Promise.all(issueIds.map((issueId) => assignIssue.mutateAsync({ issueId, sprintId })))
      .then(() => {
        setSelectedIssueIds([]);
      })
      .catch((error: unknown) => {
        Alert.alert(
          t('backlog.assignFailedTitle'),
          error instanceof Error ? error.message : t('backlog.assignFailedDescription'),
        );
      });
  };

  if (issuesQ.isLoading || sprintsQ.isLoading) return <Loading label={t('backlog.loading')} />;

  if (issuesQ.isError || sprintsQ.isError) {
    const error = issuesQ.error ?? sprintsQ.error;
    return (
      <Screen>
        <ErrorView
          message={error instanceof Error ? error.message : t('common.retry')}
          onRetry={() => {
            void issuesQ.refetch();
            void sprintsQ.refetch();
          }}
        />
      </Screen>
    );
  }

  const renderItem: ListRenderItem<Issue> = ({ item }) => (
    <BacklogIssueCard
      busy={assignIssue.isPending}
      issue={item}
      selected={selectedIssueIds.includes(item.id)}
      sprints={assignableSprints}
      onAssign={(sprintId) => assignOne(item.id, sprintId)}
      onOpen={() => navigation.navigate('IssueDetail', { id: item.id })}
      onToggle={() => toggleIssue(item.id)}
    />
  );

  const header = (
    <View>
      <ScreenHeader
        kicker={project?.key ?? t('projects.title')}
        title={t('backlog.title')}
        subtitle={project?.name ?? t('backlog.subtitle')}
        meta={
          <SemanticBadge label={t('issues.count', { count: backlogIssues.length })} tone="blue" />
        }
      />

      <View style={styles.summary}>
        <SummaryMetric value={backlogIssues.length} label={t('backlog.backlogItems')} />
        <SummaryMetric value={activeSprintCount} label={t('backlog.activeSprints')} />
        <SummaryMetric value={plannedSprintCount} label={t('backlog.plannedSprints')} />
      </View>

      <View style={styles.headerActions}>
        <Button
          title={t('issues.new')}
          icon={Plus}
          onPress={() => navigation.navigate('NewIssue', { projectId })}
          style={styles.headerButton}
        />
        <Button
          title={t('backlog.selectVisible')}
          icon={Check}
          variant="secondary"
          onPress={selectAllVisible}
          disabled={visibleIssues.length === 0}
          style={styles.headerButton}
        />
      </View>

      <View style={styles.filtersWrap}>
        <IssueFilterPanel
          filters={{ ...filters, sprintId: 'all' }}
          onChange={(next) => setFilters({ ...next, sprintId: 'none' })}
          onReset={resetFilters}
          totalCount={backlogIssues.length}
          visibleCount={visibleIssues.length}
        />
      </View>

      <View style={styles.bulkWrap}>
        <BulkPlanner
          busy={assignIssue.isPending}
          selectedCount={selectedVisibleCount}
          sprints={assignableSprints}
          onAssignSelected={assignSelected}
          onClear={clearSelection}
        />
      </View>
    </View>
  );

  return (
    <Screen>
      <FlatList
        data={visibleIssues}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        ListHeaderComponent={header}
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl
            refreshing={issuesQ.isRefetching || sprintsQ.isRefetching || projectQ.isRefetching}
            onRefresh={() => {
              void issuesQ.refetch();
              void sprintsQ.refetch();
              void projectQ.refetch();
            }}
          />
        }
        ListEmptyComponent={
          <View style={styles.emptyWrap}>
            <EmptyState
              icon={filtered ? ListTodo : Inbox}
              title={filtered ? t('issues.noMatches') : t('backlog.emptyTitle')}
              description={filtered ? t('issues.noMatchesDesc') : t('backlog.emptyDescription')}
            />
          </View>
        }
      />
    </Screen>
  );
}

function createProjectBacklogStyles(colors: ThemeColors) {
  return StyleSheet.create({
    content: {
      gap: 12,
      paddingBottom: 24,
    },
    summary: {
      flexDirection: 'row',
      gap: 10,
      paddingHorizontal: 16,
      paddingVertical: 8,
    },
    summaryMetric: {
      flex: 1,
      gap: 3,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
      borderRadius: 8,
      backgroundColor: colors.card,
      paddingHorizontal: 12,
      paddingVertical: 10,
    },
    summaryValue: {
      color: colors.foreground,
      fontSize: 22,
      fontWeight: '800',
    },
    summaryLabel: {
      color: colors.mutedForeground,
      fontSize: 12,
      fontWeight: '600',
    },
    headerActions: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 10,
      paddingHorizontal: 16,
      paddingVertical: 8,
    },
    headerButton: {
      minWidth: 142,
    },
    filtersWrap: {
      paddingHorizontal: 16,
      paddingTop: 8,
    },
    bulkWrap: {
      paddingHorizontal: 16,
      paddingTop: 10,
    },
    bulkHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 12,
    },
    bulkTitleWrap: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
    },
    bulkCopy: {
      flex: 1,
      gap: 2,
    },
    bulkTitle: {
      color: colors.foreground,
      fontSize: 16,
      fontWeight: '800',
    },
    bulkSubtitle: {
      color: colors.mutedForeground,
      fontSize: 12,
    },
    clearSelectionButton: {
      height: 34,
      width: 34,
      alignItems: 'center',
      justifyContent: 'center',
      borderRadius: 6,
      backgroundColor: colors.secondary,
    },
    bulkSprintGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 10,
    },
    bulkSprintButton: {
      minWidth: 170,
    },
    issueHeader: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: 10,
    },
    selectTarget: {
      paddingTop: 3,
    },
    selectionBox: {
      height: 24,
      width: 24,
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.borderStrong,
      borderRadius: 6,
      backgroundColor: colors.background,
    },
    selectionBoxActive: {
      borderColor: colors.primary,
      backgroundColor: colors.primary,
    },
    issueTitleWrap: {
      flex: 1,
      gap: 7,
    },
    issueMetaRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      alignItems: 'center',
      gap: 8,
    },
    issueKey: {
      color: colors.mutedForeground,
      fontFamily: 'monospace',
      fontSize: 11,
      fontWeight: '700',
    },
    issueTitle: {
      color: colors.foreground,
      fontSize: 15,
      fontWeight: '700',
      lineHeight: 21,
    },
    issueFacts: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      alignItems: 'center',
      gap: 8,
    },
    issueFact: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
    },
    assignWrap: {
      gap: 8,
    },
    assignLabel: {
      color: colors.mutedForeground,
      fontSize: 12,
      fontWeight: '700',
    },
    issueSprintRail: {
      gap: 8,
      paddingRight: 16,
    },
    sprintChip: {
      width: 230,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 9,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
      borderRadius: 8,
      backgroundColor: colors.secondary,
      paddingHorizontal: 10,
      paddingVertical: 9,
    },
    sprintChipText: {
      minWidth: 0,
      flex: 1,
      gap: 2,
    },
    sprintChipTitle: {
      color: colors.foreground,
      fontSize: 13,
      fontWeight: '700',
    },
    sprintChipSubtitle: {
      color: colors.mutedForeground,
      fontSize: 11,
    },
    noSprintText: {
      color: colors.mutedForeground,
      fontSize: 13,
      lineHeight: 18,
    },
    disabled: {
      opacity: 0.55,
    },
    emptyWrap: {
      padding: 20,
    },
  });
}
