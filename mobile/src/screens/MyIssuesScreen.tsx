import { useEffect, useMemo, useState } from 'react';
import {
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
  type ListRenderItem,
} from '@/components/native';
import {
  useNavigation,
  useRoute,
  type NavigationProp,
  type RouteProp,
} from '@react-navigation/native';
import {
  AlertTriangle,
  AtSign,
  CalendarDays,
  Clock3,
  Eye,
  Inbox,
  ListTodo,
  PenLine,
  UserCheck,
  type LucideIcon,
} from 'lucide-react-native';
import { useTranslation } from 'react-i18next';

import type {
  Issue,
  IssuePriority,
  MyIssueView,
  MyWorkloadResponse,
  MyWorkloadWindow,
} from '@/api/types';
import {
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
import type { ThemeColors } from '@/design/theme';
import { useThemeColors } from '@/design/theme-context';
import { useMyIssues, useMyWorkload } from '@/hooks/queries';
import { relativeTime } from '@/lib/format';
import type { AppStackParamList, AppTabParamList } from '@/navigation/types';

const SCOPE_OPTIONS: Array<{ value: MyIssueView; icon: LucideIcon }> = [
  { value: 'assigned', icon: UserCheck },
  { value: 'created', icon: PenLine },
  { value: 'subscribed', icon: Eye },
  { value: 'mentioned', icon: AtSign },
];

const WORKLOAD_WINDOWS: MyWorkloadWindow[] = ['today', 'this_week', 'this_sprint', 'overdue'];

type MyIssuesRoute = RouteProp<AppTabParamList, 'Issues'>;
type MyIssuesScreenStyles = ReturnType<typeof createMyIssuesScreenStyles>;

function useMyIssuesScreenTheme(): {
  colors: ThemeColors;
  priorityRail: Record<IssuePriority, string>;
  styles: MyIssuesScreenStyles;
} {
  const colors = useThemeColors();
  const priorityRail = useMemo(() => createPriorityRailColors(colors), [colors]);
  const styles = useMemo(() => createMyIssuesScreenStyles(colors), [colors]);
  return { colors, priorityRail, styles };
}

function createPriorityRailColors(colors: ThemeColors): Record<IssuePriority, string> {
  return {
    critical: colors.accentRose,
    high: colors.accentAmber,
    medium: colors.accentBlue,
    low: colors.mutedForeground,
    none: colors.borderStrong,
  };
}

function includesText(value: string | null | undefined, query: string): boolean {
  return Boolean(value?.toLowerCase().includes(query));
}

function filterMyIssues(issues: Issue[], queryInput: string): Issue[] {
  const query = queryInput.trim().toLowerCase();
  if (!query) return issues;
  return issues.filter(
    (issue) =>
      includesText(issue.key, query) ||
      includesText(issue.title, query) ||
      includesText(issue.description, query) ||
      includesText(issue.project?.key, query) ||
      includesText(issue.project?.name, query) ||
      includesText(issue.status?.name, query),
  );
}

function projectLabel(issue: Issue): string {
  return issue.project?.key || issue.project?.name || issue.projectId;
}

function formatDueDate(value: string | null | undefined, language: string): string {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleDateString(language, { day: 'numeric', month: 'short' });
}

function topCounts(counts: Record<string, number>, limit = 3): Array<[string, number]> {
  return Object.entries(counts)
    .filter(([, count]) => count > 0)
    .sort((left, right) => right[1] - left[1])
    .slice(0, limit);
}

function priorityTone(priority: string): 'rose' | 'amber' | 'blue' | 'neutral' {
  if (priority === 'critical' || priority === 'high') return 'rose';
  if (priority === 'medium') return 'amber';
  if (priority === 'low') return 'blue';
  return 'neutral';
}

function ScopeButton({
  icon: Icon,
  label,
  selected,
  value,
  onPress,
}: {
  icon: LucideIcon;
  label: string;
  selected: boolean;
  value: MyIssueView;
  onPress: (value: MyIssueView) => void;
}) {
  const { colors, styles } = useMyIssuesScreenTheme();

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected }}
      onPress={() => onPress(value)}
      style={[styles.scopeButton, selected ? styles.scopeButtonActive : null]}
      className="active:opacity-80"
    >
      <Icon size={14} color={selected ? colors.primary : colors.mutedForeground} />
      <Text
        style={[styles.scopeLabel, selected ? styles.scopeLabelActive : null]}
        numberOfLines={1}
      >
        {label}
      </Text>
    </Pressable>
  );
}

function WorkloadWindowButton({
  label,
  selected,
  value,
  onPress,
}: {
  label: string;
  selected: boolean;
  value: MyWorkloadWindow;
  onPress: (value: MyWorkloadWindow) => void;
}) {
  const { styles } = useMyIssuesScreenTheme();

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected }}
      onPress={() => onPress(value)}
      style={[styles.windowButton, selected ? styles.windowButtonActive : null]}
      className="active:opacity-80"
    >
      <Text
        style={[styles.windowLabel, selected ? styles.windowLabelActive : null]}
        numberOfLines={1}
      >
        {label}
      </Text>
    </Pressable>
  );
}

function WorkloadStat({
  icon: Icon,
  label,
  tone,
  value,
}: {
  icon: LucideIcon;
  label: string;
  tone: 'amber' | 'blue' | 'rose' | 'violet';
  value: number;
}) {
  const { colors, styles } = useMyIssuesScreenTheme();
  const toneColor =
    tone === 'rose'
      ? colors.accentRose
      : tone === 'amber'
        ? colors.accentAmber
        : tone === 'violet'
          ? colors.accentViolet
          : colors.accentBlue;
  return (
    <View style={styles.workloadStat}>
      <Icon size={15} color={toneColor} />
      <View style={styles.workloadStatCopy}>
        <Text style={styles.workloadStatValue}>{value}</Text>
        <Text style={styles.workloadStatLabel} numberOfLines={1}>
          {label}
        </Text>
      </View>
    </View>
  );
}

function priorityCountLabel(priority: string, t: (key: string) => string): string {
  if (
    priority === 'critical' ||
    priority === 'high' ||
    priority === 'medium' ||
    priority === 'low' ||
    priority === 'none'
  ) {
    return t(`priority.${priority}`);
  }
  return priority;
}

function WorkloadIssueRow({ issue }: { issue: Issue }) {
  const { i18n, t } = useTranslation();
  const navigation = useNavigation<NavigationProp<AppStackParamList>>();
  const { priorityRail, styles } = useMyIssuesScreenTheme();
  const priority = issue.priority ?? 'none';
  const dueDate = formatDueDate(issue.dueDate, i18n.language);

  return (
    <Pressable
      accessibilityRole="button"
      onPress={() => navigation.navigate('IssueDetail', { id: issue.id })}
      style={styles.workloadIssueRow}
      className="active:opacity-80"
    >
      <View style={[styles.workloadIssueRail, { backgroundColor: priorityRail[priority] }]} />
      <View style={styles.workloadIssueBody}>
        <View style={styles.workloadIssueMeta}>
          <Text style={styles.issueKey} numberOfLines={1}>
            {issue.key ?? issue.id}
          </Text>
          <Text style={styles.projectLabel} numberOfLines={1}>
            {projectLabel(issue)}
          </Text>
          {dueDate ? (
            <Text style={styles.workloadDueDate} numberOfLines={1}>
              {t('myIssues.workload.dueDate', { date: dueDate })}
            </Text>
          ) : null}
        </View>
        <Text style={styles.workloadIssueTitle} numberOfLines={1}>
          {issue.title}
        </Text>
      </View>
    </Pressable>
  );
}

function MyWorkloadPanel({
  data,
  error,
  loading,
  onWindowChange,
  window,
}: {
  data: MyWorkloadResponse | undefined;
  error: boolean;
  loading: boolean;
  onWindowChange: (value: MyWorkloadWindow) => void;
  window: MyWorkloadWindow;
}) {
  const { t } = useTranslation();
  const { styles } = useMyIssuesScreenTheme();
  const statusCounts = topCounts(data?.countsByStatus ?? {});
  const priorityCounts = topCounts(data?.countsByPriority ?? {});
  const issues = data?.issues.slice(0, 3) ?? [];

  return (
    <SurfaceRow className="gap-3">
      <View style={styles.workloadHeader}>
        <View style={styles.workloadHeaderCopy}>
          <IconTile icon={CalendarDays} tone="blue" />
          <View style={styles.workloadTitleCopy}>
            <Text style={styles.workloadTitle}>{t('myIssues.workload.title')}</Text>
            <Text style={styles.workloadSubtitle}>{t('myIssues.workload.subtitle')}</Text>
          </View>
        </View>
        <SemanticBadge
          label={t('myIssues.workload.total', { count: data?.total ?? 0 })}
          tone="blue"
        />
      </View>

      <View style={styles.windowGrid}>
        {WORKLOAD_WINDOWS.map((option) => (
          <WorkloadWindowButton
            key={option}
            label={t(`myIssues.workload.windows.${option}`)}
            selected={window === option}
            value={option}
            onPress={onWindowChange}
          />
        ))}
      </View>

      <View style={styles.workloadStats}>
        <WorkloadStat
          icon={ListTodo}
          label={t('myIssues.workload.assigned')}
          tone="blue"
          value={data?.total ?? 0}
        />
        <WorkloadStat
          icon={AlertTriangle}
          label={t('myIssues.workload.overdue')}
          tone="rose"
          value={data?.overdue ?? 0}
        />
        <WorkloadStat
          icon={Clock3}
          label={t('myIssues.workload.dueSoon')}
          tone="amber"
          value={data?.dueSoon ?? 0}
        />
      </View>

      {loading ? <Text style={styles.workloadMuted}>{t('myIssues.workload.loading')}</Text> : null}
      {error ? <Text style={styles.workloadError}>{t('myIssues.workload.loadFailed')}</Text> : null}

      {statusCounts.length > 0 || priorityCounts.length > 0 ? (
        <View style={styles.workloadBuckets}>
          {statusCounts.map(([status, count]) => (
            <SemanticBadge
              key={`status-${status}`}
              label={t('myIssues.workload.bucket', { label: status, count })}
              tone="neutral"
            />
          ))}
          {priorityCounts.map(([priority, count]) => (
            <SemanticBadge
              key={`priority-${priority}`}
              label={t('myIssues.workload.bucket', {
                label: priorityCountLabel(priority, t),
                count,
              })}
              tone={priorityTone(priority)}
            />
          ))}
        </View>
      ) : null}

      {!loading && !error && issues.length === 0 ? (
        <Text style={styles.workloadMuted}>{t('myIssues.workload.empty')}</Text>
      ) : null}

      {issues.length > 0 ? (
        <View style={styles.workloadIssueList}>
          {issues.map((issue) => (
            <WorkloadIssueRow key={issue.id} issue={issue} />
          ))}
        </View>
      ) : null}
    </SurfaceRow>
  );
}

function MyIssueRow({ issue }: { issue: Issue }) {
  const { t } = useTranslation();
  const navigation = useNavigation<NavigationProp<AppStackParamList>>();
  const { priorityRail, styles } = useMyIssuesScreenTheme();
  const priority = issue.priority ?? 'none';
  const updatedAt = relativeTime(issue.updatedAt ?? issue.createdAt);

  return (
    <Pressable
      accessibilityRole="button"
      onPress={() => navigation.navigate('IssueDetail', { id: issue.id })}
      className="active:opacity-80"
      style={styles.issueRow}
    >
      <View style={[styles.priorityRail, { backgroundColor: priorityRail[priority] }]} />
      <View style={styles.issueBody}>
        <View style={styles.issueMeta}>
          <View style={styles.issueMetaLeft}>
            {issue.key ? (
              <Text style={styles.issueKey} numberOfLines={1}>
                {issue.key}
              </Text>
            ) : null}
            <Text style={styles.projectLabel} numberOfLines={1}>
              {projectLabel(issue)}
            </Text>
          </View>
          {updatedAt ? (
            <Text style={styles.updatedAt} numberOfLines={1}>
              {updatedAt}
            </Text>
          ) : null}
        </View>

        <Text
          className="text-foreground text-sm font-medium"
          style={styles.issueTitle}
          numberOfLines={2}
        >
          {issue.title}
        </Text>

        <View style={styles.issueFooter}>
          <View style={styles.badges}>
            <SemanticBadge label={t(`issueType.${issue.type}`)} tone="blue" />
            {issue.status?.name ? <SemanticBadge label={issue.status.name} tone="neutral" /> : null}
          </View>
          <SemanticBadge
            label={t(`priority.${priority}`)}
            tone={priority === 'critical' ? 'rose' : 'amber'}
          />
        </View>
      </View>
    </Pressable>
  );
}

function MyIssuesHeader({
  count,
  query,
  scope,
  workload,
  workloadError,
  workloadLoading,
  workloadWindow,
  onQueryChange,
  onScopeChange,
  onWorkloadWindowChange,
}: {
  count: number;
  query: string;
  scope: MyIssueView;
  workload: MyWorkloadResponse | undefined;
  workloadError: boolean;
  workloadLoading: boolean;
  workloadWindow: MyWorkloadWindow;
  onQueryChange: (value: string) => void;
  onScopeChange: (value: MyIssueView) => void;
  onWorkloadWindowChange: (value: MyWorkloadWindow) => void;
}) {
  const { t } = useTranslation();
  const { styles } = useMyIssuesScreenTheme();

  return (
    <View>
      <ScreenHeader
        kicker={t('myIssues.kicker')}
        title={t('myIssues.title')}
        meta={<SemanticBadge label={t('myIssues.count', { count })} tone="violet" />}
      />
      <View style={styles.workloadWrap}>
        <MyWorkloadPanel
          data={workload}
          error={workloadError}
          loading={workloadLoading}
          window={workloadWindow}
          onWindowChange={onWorkloadWindowChange}
        />
      </View>
      <View style={styles.toolbar}>
        <TextField
          label={t('common.search')}
          placeholder={t('myIssues.searchPlaceholder')}
          value={query}
          onChangeText={onQueryChange}
          autoCapitalize="none"
        />
        <View style={styles.scopeGrid}>
          {SCOPE_OPTIONS.map((option) => (
            <ScopeButton
              key={option.value}
              icon={option.icon}
              label={t(`myIssues.scopes.${option.value}`)}
              selected={scope === option.value}
              value={option.value}
              onPress={onScopeChange}
            />
          ))}
        </View>
      </View>
    </View>
  );
}

function MyIssuesEmpty({
  filtered,
  query,
  scope,
  onClearSearch,
}: {
  filtered: boolean;
  query: string;
  scope: MyIssueView;
  onClearSearch: () => void;
}) {
  const { t } = useTranslation();
  const { styles } = useMyIssuesScreenTheme();

  return (
    <View style={styles.emptyWrap}>
      <EmptyState
        icon={filtered ? ListTodo : Inbox}
        title={filtered ? t('myIssues.emptySearch') : t(`myIssues.empty.${scope}`)}
      />
      {query.trim() ? (
        <Pressable
          accessibilityRole="button"
          onPress={onClearSearch}
          style={styles.clearSearchButton}
          className="active:opacity-80"
        >
          <Text style={styles.clearSearchText}>{t('myIssues.clearSearch')}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

export function MyIssuesScreen() {
  const { t } = useTranslation();
  const { styles } = useMyIssuesScreenTheme();
  const route = useRoute<MyIssuesRoute>();
  const routeView = route.params?.view;
  const [scope, setScope] = useState<MyIssueView>(routeView ?? 'assigned');
  const [query, setQuery] = useState('');
  const [workloadWindow, setWorkloadWindow] = useState<MyWorkloadWindow>('this_week');
  const myIssuesQ = useMyIssues(scope);
  const workloadQ = useMyWorkload(workloadWindow);

  const issues = useMemo(() => myIssuesQ.data?.issues ?? [], [myIssuesQ.data?.issues]);
  const visibleIssues = useMemo(() => filterMyIssues(issues, query), [issues, query]);
  const renderItem: ListRenderItem<Issue> = ({ item }) => <MyIssueRow issue={item} />;

  useEffect(() => {
    if (routeView) setScope(routeView);
  }, [routeView]);

  if (myIssuesQ.isLoading) return <Loading />;
  if (myIssuesQ.isError) {
    return (
      <Screen>
        <ErrorView
          message={
            myIssuesQ.error instanceof Error ? myIssuesQ.error.message : t('myIssues.loadFailed')
          }
          onRetry={() => void myIssuesQ.refetch()}
        />
      </Screen>
    );
  }

  return (
    <Screen>
      <FlatList
        data={visibleIssues}
        keyExtractor={(issue) => issue.id}
        renderItem={renderItem}
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl
            refreshing={myIssuesQ.isRefetching || workloadQ.isRefetching}
            onRefresh={() => {
              void myIssuesQ.refetch();
              void workloadQ.refetch();
            }}
          />
        }
        ListHeaderComponent={
          <MyIssuesHeader
            count={visibleIssues.length}
            query={query}
            scope={scope}
            workload={workloadQ.data}
            workloadError={workloadQ.isError}
            workloadLoading={workloadQ.isLoading}
            workloadWindow={workloadWindow}
            onQueryChange={setQuery}
            onScopeChange={(next) => {
              setScope(next);
              setQuery('');
            }}
            onWorkloadWindowChange={setWorkloadWindow}
          />
        }
        ListEmptyComponent={
          <MyIssuesEmpty
            filtered={query.trim().length > 0}
            query={query}
            scope={scope}
            onClearSearch={() => setQuery('')}
          />
        }
      />
    </Screen>
  );
}

function createMyIssuesScreenStyles(colors: ThemeColors) {
  return StyleSheet.create({
    content: {
      gap: 8,
      paddingBottom: 16,
    },
    toolbar: {
      gap: 12,
      paddingHorizontal: 16,
      paddingBottom: 12,
    },
    workloadWrap: {
      paddingHorizontal: 16,
      paddingBottom: 12,
    },
    workloadHeader: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      justifyContent: 'space-between',
      gap: 12,
    },
    workloadHeaderCopy: {
      minWidth: 0,
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
    },
    workloadTitleCopy: {
      minWidth: 0,
      flex: 1,
      gap: 2,
    },
    workloadTitle: {
      color: colors.foreground,
      fontSize: 16,
      fontWeight: '700',
      lineHeight: 22,
    },
    workloadSubtitle: {
      color: colors.mutedForeground,
      fontSize: 13,
      lineHeight: 18,
    },
    windowGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 8,
    },
    windowButton: {
      minWidth: '48%',
      flex: 1,
      alignItems: 'center',
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
      borderRadius: 4,
      backgroundColor: colors.background,
      paddingHorizontal: 10,
      paddingVertical: 8,
    },
    windowButtonActive: {
      borderColor: colors.primary,
      backgroundColor: colors.primary,
    },
    windowLabel: {
      color: colors.mutedForeground,
      fontSize: 12,
      fontWeight: '700',
      lineHeight: 16,
    },
    windowLabelActive: {
      color: colors.primaryForeground,
    },
    workloadStats: {
      flexDirection: 'row',
      gap: 8,
    },
    workloadStat: {
      minWidth: 0,
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
      borderRadius: 4,
      backgroundColor: colors.background,
      paddingHorizontal: 10,
      paddingVertical: 9,
    },
    workloadStatCopy: {
      minWidth: 0,
      flex: 1,
    },
    workloadStatValue: {
      color: colors.foreground,
      fontSize: 16,
      fontWeight: '800',
      lineHeight: 20,
    },
    workloadStatLabel: {
      color: colors.mutedForeground,
      fontSize: 11,
      fontWeight: '600',
      lineHeight: 15,
    },
    workloadBuckets: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 6,
    },
    workloadIssueList: {
      gap: 6,
    },
    workloadIssueRow: {
      flexDirection: 'row',
      overflow: 'hidden',
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
      borderRadius: 4,
      backgroundColor: colors.background,
    },
    workloadIssueRail: {
      width: 3,
    },
    workloadIssueBody: {
      minWidth: 0,
      flex: 1,
      gap: 4,
      paddingHorizontal: 10,
      paddingVertical: 8,
    },
    workloadIssueMeta: {
      minWidth: 0,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 7,
    },
    workloadDueDate: {
      color: colors.accentAmber,
      fontSize: 11,
      fontWeight: '700',
      lineHeight: 15,
    },
    workloadIssueTitle: {
      color: colors.foreground,
      fontSize: 13,
      fontWeight: '600',
      lineHeight: 18,
    },
    workloadMuted: {
      color: colors.mutedForeground,
      fontSize: 13,
      lineHeight: 18,
    },
    workloadError: {
      color: colors.destructive,
      fontSize: 13,
      lineHeight: 18,
    },
    scopeGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 8,
    },
    scopeButton: {
      minWidth: '48%',
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 7,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
      borderRadius: 4,
      backgroundColor: colors.card,
      paddingHorizontal: 10,
      paddingVertical: 10,
    },
    scopeButtonActive: {
      borderColor: `${colors.primary}55`,
      backgroundColor: `${colors.primary}14`,
    },
    scopeLabel: {
      minWidth: 0,
      flexShrink: 1,
      color: colors.mutedForeground,
      fontSize: 12,
      fontWeight: '600',
      lineHeight: 16,
    },
    scopeLabelActive: {
      color: colors.primary,
    },
    issueRow: {
      flexDirection: 'row',
      overflow: 'hidden',
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
      borderRadius: 6,
      backgroundColor: colors.card,
      marginHorizontal: 16,
    },
    priorityRail: {
      width: 4,
      borderTopRightRadius: 999,
      borderBottomRightRadius: 999,
    },
    issueBody: {
      minWidth: 0,
      flex: 1,
      gap: 8,
      paddingHorizontal: 12,
      paddingVertical: 12,
    },
    issueMeta: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 10,
    },
    issueMetaLeft: {
      minWidth: 0,
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 7,
    },
    issueKey: {
      color: colors.mutedForeground,
      fontSize: 11,
      fontWeight: '700',
      lineHeight: 16,
    },
    projectLabel: {
      minWidth: 0,
      color: colors.mutedForeground,
      fontSize: 12,
      lineHeight: 16,
    },
    updatedAt: {
      color: colors.mutedForeground,
      fontSize: 11,
      lineHeight: 16,
    },
    issueTitle: {
      lineHeight: 20,
    },
    issueFooter: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      justifyContent: 'space-between',
      gap: 10,
    },
    badges: {
      minWidth: 0,
      flex: 1,
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 6,
    },
    emptyWrap: {
      flex: 1,
      gap: 12,
    },
    clearSearchButton: {
      alignSelf: 'center',
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
      borderRadius: 4,
      backgroundColor: colors.card,
      paddingHorizontal: 12,
      paddingVertical: 8,
    },
    clearSearchText: {
      color: colors.primary,
      fontSize: 13,
      fontWeight: '600',
      lineHeight: 18,
    },
  });
}
