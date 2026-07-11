import { Linking } from 'react-native';
import { useEffect, useMemo, useState } from 'react';
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from '@/components/native';
import {
  useNavigation,
  useRoute,
  type NavigationProp,
  type RouteProp,
} from '@react-navigation/native';
import {
  Activity,
  AlertTriangle,
  ArrowRight,
  Bell,
  BookOpenText,
  CalendarClock,
  CheckCircle2,
  ChevronRight,
  Eye,
  FileText,
  FolderKanban,
  Gauge,
  GitBranch,
  Layers3,
  LayoutDashboard,
  ListTodo,
  MessageSquare,
  PenLine,
  PhoneCall,
  Pin,
  PinOff,
  Plus,
  RefreshCw,
  Repeat,
  Search,
  ShieldAlert,
  Sparkles,
  Timer,
  UserCheck,
  X,
  Zap,
  type LucideIcon,
} from 'lucide-react-native';
import { useTranslation } from 'react-i18next';

import type {
  CatchMeUpActionItem,
  CatchMeUpDigest,
  DoraAnalytics,
  GlobalLiveCall,
  Issue,
  MyIssueView,
  PinnedItem,
  Project,
  ProjectAnalyticsResponse,
  RecentActivity,
  StandupDigest,
} from '@/api/types';
import {
  Avatar,
  Button,
  EmptyState,
  ErrorView,
  IconTile,
  Loading,
  Screen,
  ScreenHeader,
  SemanticBadge,
} from '@/components/ui';
import type { ThemeColors } from '@/design/theme';
import { useThemeColors } from '@/design/theme-context';
import {
  useInbox,
  useDeletePinnedItem,
  useMyIssues,
  useOrganizations,
  usePinnedItems,
  useProjectAnalytics,
  useProjects,
  useRecentActivities,
  useGenerateStandupPreview,
  useCatchMeUp,
  useDoraAnalytics,
  useLiveCalls,
  useTodayStandup,
} from '@/hooks/queries';
import { getBaseUrl } from '@/api/client';
import { getLastSeen, updateLastSeen } from '@/api/endpoints';
import { isContentDeepLink, parseTaskNebulaDeepLink } from '@/lib/deep-links';
import { roundMetric } from '@/lib/analytics';
import { initials, relativeTime } from '@/lib/format';
import { navigateToContentDeepLink } from '@/navigation/root';
import type { AppStackParamList, AppTabParamList, DashboardRouteNotice } from '@/navigation/types';

type DashboardNavigation = NavigationProp<AppStackParamList & AppTabParamList>;
type DashboardRoute = RouteProp<AppTabParamList, 'Dashboard'>;

type MetricTone = 'blue' | 'violet' | 'cyan' | 'emerald' | 'amber' | 'rose';
type DashboardTranslator = ReturnType<typeof useTranslation>['t'];
type DeadlineItem = { issue: Issue; dueAt: number };
type DashboardWorkView = Extract<MyIssueView, 'assigned' | 'created' | 'subscribed'>;
type DashboardStyles = ReturnType<typeof createDashboardStyles>;

const DAY_MS = 24 * 60 * 60 * 1000;
const HOUR_MS = 60 * 60 * 1000;
const DEADLINE_WINDOW_MS = 14 * DAY_MS;
const CATCH_UP_GAP_MS = 4 * HOUR_MS;

const WORK_VIEW_OPTIONS: Array<{ value: DashboardWorkView; icon: LucideIcon; labelKey: string }> = [
  { value: 'assigned', icon: UserCheck, labelKey: 'dashboard.yourWorkAssigned' },
  { value: 'created', icon: PenLine, labelKey: 'dashboard.yourWorkCreated' },
  { value: 'subscribed', icon: Eye, labelKey: 'dashboard.yourWorkSubscribed' },
];

const ACTIVITY_MESSAGE_KEYS = {
  createdIssue: 'dashboard.activity.messages.createdIssue',
  updatedIssue: 'dashboard.activity.messages.updatedIssue',
  movedTo: 'dashboard.activity.messages.movedTo',
  changedStatus: 'dashboard.activity.messages.changedStatus',
  assignedIssue: 'dashboard.activity.messages.assignedIssue',
  unassignedIssue: 'dashboard.activity.messages.unassignedIssue',
  changedPriorityTo: 'dashboard.activity.messages.changedPriorityTo',
  changedPriority: 'dashboard.activity.messages.changedPriority',
  commentedOn: 'dashboard.activity.messages.commentedOn',
  linkedIssue: 'dashboard.activity.messages.linkedIssue',
  startedSprint: 'dashboard.activity.messages.startedSprint',
  completedSprint: 'dashboard.activity.messages.completedSprint',
  createdProject: 'dashboard.activity.messages.createdProject',
  addedMemberToProject: 'dashboard.activity.messages.addedMemberToProject',
  unknownAction: 'dashboard.activity.messages.unknownAction',
} as const;

const ACTIVITY_PRIORITY_KEYS = {
  critical: 'dashboard.activity.priorities.critical',
  urgent: 'dashboard.activity.priorities.urgent',
  high: 'dashboard.activity.priorities.high',
  medium: 'dashboard.activity.priorities.medium',
  low: 'dashboard.activity.priorities.low',
  none: 'dashboard.activity.priorities.none',
} as const;

type ActivityMessageKey = keyof typeof ACTIVITY_MESSAGE_KEYS;
type ActivityPriorityKey = keyof typeof ACTIVITY_PRIORITY_KEYS;

function byRecentIssue(left: Issue, right: Issue): number {
  return (
    new Date(right.updatedAt ?? right.createdAt ?? 0).getTime() -
    new Date(left.updatedAt ?? left.createdAt ?? 0).getTime()
  );
}

function byRecentProject(left: Project, right: Project): number {
  return left.name.localeCompare(right.name);
}

function issueDueAt(issue: Issue): number | null {
  if (!issue.dueDate) return null;
  const dueAt = new Date(issue.dueDate).getTime();
  return Number.isNaN(dueAt) ? null : dueAt;
}

function formatDeadlineDate(value: string | null | undefined, language: string): string {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleDateString(language, { day: 'numeric', month: 'short' });
}

function formatNumber(value: number, language: string): string {
  return new Intl.NumberFormat(language).format(value);
}

function formatDecimal(value: number, language: string, digits = 1): string {
  return new Intl.NumberFormat(language, {
    maximumFractionDigits: digits,
    minimumFractionDigits: digits,
  }).format(value);
}

function deadlineTone(dueAt: number, now: number): 'rose' | 'amber' | 'neutral' {
  if (dueAt < now) return 'rose';
  if (dueAt <= now + 3 * DAY_MS) return 'amber';
  return 'neutral';
}

function shouldShowCatchUpBanner(lastSeenAt: string | null): lastSeenAt is string {
  if (!lastSeenAt) return false;
  const previous = new Date(lastSeenAt).getTime();
  return !Number.isNaN(previous) && Date.now() - previous > CATCH_UP_GAP_MS;
}

function formatCatchUpGap(lastSeenAt: string, t: DashboardTranslator): string {
  const previous = new Date(lastSeenAt).getTime();
  if (Number.isNaN(previous)) return t('dashboard.catchupGapHours', { count: 4 });
  const hours = Math.max(1, Math.floor((Date.now() - previous) / HOUR_MS));
  if (hours < 24) return t('dashboard.catchupGapHours', { count: hours });
  return t('dashboard.catchupGapDays', { count: Math.floor(hours / 24) });
}

function catchUpUrgencyTone(urgency: CatchMeUpActionItem['urgency']): 'rose' | 'amber' | 'neutral' {
  if (urgency === 'high') return 'rose';
  if (urgency === 'medium') return 'amber';
  return 'neutral';
}

function catchUpUrgencyLabelKey(urgency: CatchMeUpActionItem['urgency']): string {
  if (urgency === 'high') return 'inbox.catchup.urgency.high';
  if (urgency === 'medium') return 'inbox.catchup.urgency.medium';
  return 'inbox.catchup.urgency.low';
}

function catchUpSourceLabel(digest: CatchMeUpDigest, t: DashboardTranslator): string {
  if (digest.source === 'native') return t('inbox.catchup.sourceNative');
  return t('inbox.catchup.sourceOther', { source: digest.source });
}

function pinnedItemIcon(kind: PinnedItem['kind']): LucideIcon {
  if (kind === 'project') return FolderKanban;
  if (kind === 'chat') return MessageSquare;
  if (kind === 'issue' || kind === 'doc') return FileText;
  return Pin;
}

function pinnedHrefUrl(href: string, baseUrl: string | null | undefined): string | null {
  const trimmed = href.trim();
  if (!trimmed) return null;
  if (trimmed.startsWith('/')) return baseUrl ? `${baseUrl}${trimmed}` : null;
  return trimmed;
}

function isActivityMessageKey(value: RecentActivity['messageKey']): value is ActivityMessageKey {
  return typeof value === 'string' && value in ACTIVITY_MESSAGE_KEYS;
}

function isActivityPriorityKey(value: unknown): value is ActivityPriorityKey {
  return typeof value === 'string' && value in ACTIVITY_PRIORITY_KEYS;
}

function normalizeActivityMessageValues(
  values: RecentActivity['messageValues'],
  t: DashboardTranslator,
): Record<string, string | number> {
  const normalized: Record<string, string | number> = {};
  if (!values) return normalized;

  for (const [key, value] of Object.entries(values)) {
    if (value === null || value === undefined) continue;
    if (key === 'priority' && isActivityPriorityKey(value)) {
      normalized[key] = t(ACTIVITY_PRIORITY_KEYS[value]);
    } else {
      normalized[key] = value;
    }
  }

  return normalized;
}

function activityActor(activity: RecentActivity, t: DashboardTranslator): string {
  return activity.user.name || activity.user.email.split('@')[0] || t('dashboard.activity.someone');
}

function activityMessage(activity: RecentActivity, t: DashboardTranslator): string {
  if (isActivityMessageKey(activity.messageKey)) {
    return t(
      ACTIVITY_MESSAGE_KEYS[activity.messageKey],
      normalizeActivityMessageValues(activity.messageValues, t),
    );
  }

  return activity.message?.trim()
    ? activity.message
    : t(ACTIVITY_MESSAGE_KEYS.unknownAction, { action: activity.action });
}

function useDashboardTheme(): { colors: ThemeColors; styles: DashboardStyles } {
  const colors = useThemeColors();
  const styles = useMemo(() => createDashboardStyles(colors), [colors]);
  return { colors, styles };
}

function metricColor(colors: ThemeColors, tone: MetricTone): string {
  const map: Record<MetricTone, string> = {
    blue: colors.accentBlue,
    violet: colors.accentViolet,
    cyan: colors.accentCyan,
    emerald: colors.accentEmerald,
    amber: colors.accentAmber,
    rose: colors.accentRose,
  };
  return map[tone];
}

function MetricCard({
  icon: Icon,
  label,
  tone,
  value,
}: {
  icon: LucideIcon;
  label: string;
  tone: MetricTone;
  value: number;
}) {
  const { colors, styles } = useDashboardTheme();
  const color = metricColor(colors, tone);
  return (
    <View style={[styles.metricCard, { borderTopColor: color }]}>
      <View style={styles.metricTop}>
        <Icon size={16} color={color} />
        <Text style={styles.metricLabel} numberOfLines={1}>
          {label}
        </Text>
      </View>
      <Text style={styles.metricValue}>{value}</Text>
    </View>
  );
}

function SectionHeader({ title, badge }: { title: string; badge?: string | undefined }) {
  const { styles } = useDashboardTheme();

  return (
    <View style={styles.sectionHeader}>
      <Text className="text-foreground text-base font-semibold">{title}</Text>
      {badge ? <SemanticBadge label={badge} tone="neutral" /> : null}
    </View>
  );
}

function WorkScopeButton({
  icon: Icon,
  label,
  selected,
  value,
  onPress,
}: {
  icon: LucideIcon;
  label: string;
  selected: boolean;
  value: DashboardWorkView;
  onPress: (value: DashboardWorkView) => void;
}) {
  const { colors, styles } = useDashboardTheme();

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected }}
      onPress={() => onPress(value)}
      style={[styles.workScopeButton, selected ? styles.workScopeButtonActive : null]}
      className="active:opacity-80"
    >
      <Icon size={14} color={selected ? colors.primary : colors.mutedForeground} />
      <Text
        style={[styles.workScopeLabel, selected ? styles.workScopeLabelActive : null]}
        numberOfLines={1}
      >
        {label}
      </Text>
    </Pressable>
  );
}

function DashboardYourWorkWidget({
  error,
  issues,
  loading,
  onOpenMyIssues,
  onViewChange,
  view,
}: {
  error: boolean;
  issues: Issue[];
  loading: boolean;
  onOpenMyIssues: () => void;
  onViewChange: (value: DashboardWorkView) => void;
  view: DashboardWorkView;
}) {
  const { t } = useTranslation();
  const { colors, styles } = useDashboardTheme();
  const visibleIssues = useMemo(() => [...issues].sort(byRecentIssue).slice(0, 7), [issues]);

  return (
    <View style={styles.yourWorkPanel}>
      <View style={styles.yourWorkHeader}>
        <Text className="text-foreground text-sm font-semibold" numberOfLines={1}>
          {t('dashboard.yourWork')}
        </Text>
        <Pressable
          accessibilityRole="button"
          onPress={onOpenMyIssues}
          style={styles.viewAllButton}
          className="active:opacity-80"
        >
          <Text style={styles.viewAllText}>{t('dashboard.viewAll')}</Text>
          <ArrowRight size={14} color={colors.mutedForeground} />
        </Pressable>
      </View>

      <View style={styles.workScopeGrid}>
        {WORK_VIEW_OPTIONS.map((option) => (
          <WorkScopeButton
            key={option.value}
            icon={option.icon}
            label={t(option.labelKey)}
            selected={view === option.value}
            value={option.value}
            onPress={onViewChange}
          />
        ))}
      </View>

      {loading ? (
        <View style={styles.activityInfoRow}>
          <Activity size={16} color={colors.mutedForeground} />
          <Text style={styles.mutedSmall}>{t('common.loading')}</Text>
        </View>
      ) : null}

      {!loading && error ? (
        <View style={styles.activityInfoRow}>
          <Zap size={16} color={colors.warning} />
          <Text style={styles.activityErrorText}>{t('myIssues.loadFailed')}</Text>
        </View>
      ) : null}

      {!loading && !error && visibleIssues.length === 0 ? (
        <View style={styles.yourWorkEmpty}>
          <ListTodo size={22} color={colors.mutedForeground} />
          <Text style={styles.mutedSmall}>{t('dashboard.noItems')}</Text>
          <Button title={t('dashboard.yourWorkOpenMyIssues')} onPress={onOpenMyIssues} />
        </View>
      ) : null}

      {visibleIssues.length > 0 ? (
        <View style={styles.rows}>
          {visibleIssues.map((issue) => (
            <DashboardIssueRow key={issue.id} issue={issue} />
          ))}
        </View>
      ) : null}
    </View>
  );
}

function QuickAction({
  icon: Icon,
  label,
  onPress,
  tone = 'blue',
}: {
  icon: LucideIcon;
  label: string;
  onPress: () => void;
  tone?: 'blue' | 'cyan' | 'emerald' | 'violet';
}) {
  const { styles } = useDashboardTheme();

  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      className="active:opacity-80"
      style={styles.quickAction}
    >
      <IconTile icon={Icon} tone={tone} />
      <Text style={styles.quickActionLabel} numberOfLines={2}>
        {label}
      </Text>
    </Pressable>
  );
}

function AnalyticsSnapshotMetric({
  label,
  tone,
  value,
}: {
  label: string;
  tone: 'blue' | 'violet' | 'emerald' | 'amber' | 'rose';
  value: string;
}) {
  const { colors, styles } = useDashboardTheme();
  const color = metricColor(colors, tone);
  return (
    <View style={[styles.analyticsSnapshotMetric, { borderTopColor: color }]}>
      <Text style={styles.analyticsSnapshotLabel} numberOfLines={1}>
        {label}
      </Text>
      <Text style={styles.analyticsSnapshotValue} numberOfLines={1}>
        {value}
      </Text>
    </View>
  );
}

function DashboardAnalyticsSnapshot({
  analytics,
  error,
  language,
  loading,
  onOpen,
  projectKey,
}: {
  analytics: ProjectAnalyticsResponse | undefined;
  error: boolean;
  language: string;
  loading: boolean;
  onOpen: () => void;
  projectKey?: string | null;
}) {
  const { t } = useTranslation();
  const { colors, styles } = useDashboardTheme();

  return (
    <View style={styles.analyticsSnapshotPanel}>
      <View style={styles.yourWorkHeader}>
        <View className="min-w-0 flex-1 gap-1">
          <Text className="text-foreground text-sm font-semibold" numberOfLines={1}>
            {t('analytics.title')}
          </Text>
          {projectKey ? <Text style={styles.mutedSmall}>{projectKey}</Text> : null}
        </View>
        <Pressable
          accessibilityRole="button"
          onPress={onOpen}
          style={styles.viewAllButton}
          className="active:opacity-80"
        >
          <Text style={styles.viewAllText}>{t('dashboard.viewAll')}</Text>
          <ArrowRight size={14} color={colors.mutedForeground} />
        </Pressable>
      </View>

      {loading ? (
        <View style={styles.activityInfoRow}>
          <Activity size={16} color={colors.mutedForeground} />
          <Text style={styles.mutedSmall}>{t('analytics.loading')}</Text>
        </View>
      ) : null}

      {!loading && error ? (
        <View style={styles.activityInfoRow}>
          <Zap size={16} color={colors.warning} />
          <Text style={styles.activityErrorText}>{t('analytics.loadFailed')}</Text>
        </View>
      ) : null}

      {analytics ? (
        <View style={styles.analyticsSnapshotGrid}>
          <AnalyticsSnapshotMetric
            label={t('analytics.totalIssues')}
            value={formatNumber(analytics.health.overview.totalIssues, language)}
            tone="blue"
          />
          <AnalyticsSnapshotMetric
            label={t('analytics.overdueIssues')}
            value={formatNumber(analytics.health.overview.overdueIssues, language)}
            tone={analytics.health.overview.overdueIssues > 0 ? 'rose' : 'emerald'}
          />
          <AnalyticsSnapshotMetric
            label={t('analytics.activeSprints')}
            value={formatNumber(analytics.health.sprints.active, language)}
            tone="emerald"
          />
          <AnalyticsSnapshotMetric
            label={t('analytics.avgVelocity')}
            value={t('analytics.velocityValue', {
              issues: formatNumber(
                roundMetric(analytics.velocity.averageVelocity.issues),
                language,
              ),
              points: formatNumber(
                roundMetric(analytics.velocity.averageVelocity.points),
                language,
              ),
            })}
            tone="violet"
          />
        </View>
      ) : null}
    </View>
  );
}

function DashboardDoraSparkline({ tone, values }: { tone: MetricTone; values: number[] }) {
  const { colors, styles } = useDashboardTheme();
  const visibleValues = values.slice(-10);
  if (visibleValues.length === 0) return null;

  const color = metricColor(colors, tone);
  const max = Math.max(...visibleValues.map((value) => Math.abs(value)), 1);

  return (
    <View style={styles.doraSparkline}>
      {visibleValues.map((value, index) => (
        <View
          key={`${index}-${value}`}
          style={[
            styles.doraSparkBar,
            {
              height: Math.max(4, Math.round((Math.abs(value) / max) * 22)),
              backgroundColor: color,
            },
          ]}
        />
      ))}
    </View>
  );
}

function DashboardDoraMetric({
  hint,
  icon: Icon,
  label,
  sparkline,
  tone,
  value,
}: {
  hint: string;
  icon: LucideIcon;
  label: string;
  sparkline: number[];
  tone: MetricTone;
  value: string;
}) {
  const { colors, styles } = useDashboardTheme();
  const color = metricColor(colors, tone);

  return (
    <View style={[styles.doraMetric, { borderTopColor: color }]}>
      <View style={styles.doraMetricTop}>
        <Icon size={15} color={color} />
        <Text style={styles.doraMetricLabel} numberOfLines={1}>
          {label}
        </Text>
      </View>
      <Text style={styles.doraMetricValue} numberOfLines={1}>
        {value}
      </Text>
      <Text style={styles.doraMetricHint} numberOfLines={2}>
        {hint}
      </Text>
      <DashboardDoraSparkline tone={tone} values={sparkline} />
    </View>
  );
}

function DashboardDoraPanel({
  analytics,
  error,
  language,
  loading,
  onOpenIntegrations,
}: {
  analytics: DoraAnalytics | undefined;
  error: boolean;
  language: string;
  loading: boolean;
  onOpenIntegrations: () => void;
}) {
  const { t } = useTranslation();
  const { colors, styles } = useDashboardTheme();
  const metrics = analytics?.connected
    ? [
        {
          icon: GitBranch,
          label: t('analytics.doraDeployFrequency'),
          value: t('analytics.doraPerDayValue', {
            value: formatDecimal(analytics.deployFrequencyPerDay, language, 2),
          }),
          hint: t('analytics.doraDeployFrequencyHint'),
          tone: 'cyan' as const,
          sparkline: analytics.deployFrequencySpark,
        },
        {
          icon: Timer,
          label: t('analytics.doraLeadTime'),
          value: t('analytics.doraHoursValue', {
            value: formatDecimal(analytics.leadTimeHours, language),
          }),
          hint: t('analytics.doraLeadTimeHint'),
          tone: 'violet' as const,
          sparkline: analytics.leadTimeSpark,
        },
        {
          icon: ShieldAlert,
          label: t('analytics.doraChangeFailureRate'),
          value: t('analytics.doraPercentValue', {
            value: formatDecimal(analytics.changeFailureRate * 100, language),
          }),
          hint: t('analytics.doraChangeFailureRateHint'),
          tone: 'rose' as const,
          sparkline: analytics.changeFailureRateSpark,
        },
        {
          icon: Repeat,
          label: t('analytics.doraReworkRate'),
          value: t('analytics.doraPercentValue', {
            value: formatDecimal(analytics.reworkRate * 100, language),
          }),
          hint: t('analytics.doraReworkRateHint'),
          tone: 'amber' as const,
          sparkline: analytics.reworkRateSpark,
        },
        {
          icon: Activity,
          label: t('analytics.doraRecoveryTime'),
          value: t('analytics.doraHoursValue', {
            value: formatDecimal(analytics.recoveryHours, language),
          }),
          hint: t('analytics.doraRecoveryTimeHint'),
          tone: 'emerald' as const,
          sparkline: analytics.recoveryHoursSpark,
        },
      ]
    : [];

  return (
    <View style={styles.doraPanel}>
      <View style={styles.doraHeader}>
        <View style={styles.doraTitleWrap}>
          <GitBranch size={18} color={colors.accentCyan} />
          <View className="min-w-0 flex-1 gap-1">
            <Text className="text-foreground text-sm font-semibold" numberOfLines={1}>
              {t('analytics.doraTitle')}
            </Text>
            <Text style={styles.mutedSmall} numberOfLines={2}>
              {t('analytics.doraSubtitle')}
            </Text>
          </View>
        </View>
        <SemanticBadge
          label={
            analytics
              ? t(analytics.connected ? 'analytics.doraConnected' : 'analytics.doraDisconnected')
              : t('analytics.doraLast30Days')
          }
          tone={analytics?.connected ? 'emerald' : 'neutral'}
        />
      </View>

      {loading && !analytics ? (
        <View style={styles.activityInfoRow}>
          <Activity size={16} color={colors.mutedForeground} />
          <Text style={styles.mutedSmall}>{t('analytics.doraLoading')}</Text>
        </View>
      ) : null}

      {!loading && !analytics && error ? (
        <View style={styles.activityInfoRow}>
          <Zap size={16} color={colors.warning} />
          <Text style={styles.activityErrorText}>{t('analytics.doraLoadFailed')}</Text>
        </View>
      ) : null}

      {analytics && !analytics.connected ? (
        <View style={styles.doraConnectBlock}>
          <Text style={styles.doraConnectTitle}>{t('analytics.doraConnectTitle')}</Text>
          <Text style={styles.doraConnectDescription}>{t('analytics.doraConnectDescription')}</Text>
          <Button
            icon={GitBranch}
            title={t('analytics.doraOpenIntegrations')}
            variant="secondary"
            onPress={onOpenIntegrations}
          />
        </View>
      ) : null}

      {analytics?.connected ? (
        <>
          {error ? (
            <View style={styles.activityInfoRow}>
              <Zap size={16} color={colors.warning} />
              <Text style={styles.activityErrorText}>{t('analytics.doraLoadFailed')}</Text>
            </View>
          ) : null}
          <View style={styles.doraMetricGrid}>
            {metrics.map((metric) => (
              <DashboardDoraMetric
                key={metric.label}
                hint={metric.hint}
                icon={metric.icon}
                label={metric.label}
                sparkline={metric.sparkline}
                tone={metric.tone}
                value={metric.value}
              />
            ))}
          </View>
        </>
      ) : null}
    </View>
  );
}

function DashboardActivityRow({ activity }: { activity: RecentActivity }) {
  const navigation = useNavigation<DashboardNavigation>();
  const { t } = useTranslation();
  const { colors, styles } = useDashboardTheme();
  const actor = activityActor(activity, t);
  const message = activityMessage(activity, t);
  const time = relativeTime(activity.createdAt);
  const issueId = activity.issue?.id ?? null;

  const content = (
    <>
      <Avatar initials={initials(activity.user.name, activity.user.email)} size={30} />
      <View style={styles.activityBody}>
        <Text style={styles.activityLine} numberOfLines={2}>
          <Text style={styles.activityActor}>{actor}</Text>
          <Text style={styles.activityMessage}> {message}</Text>
        </Text>
        {activity.issue ? (
          <View style={styles.activityMetaRow}>
            <SemanticBadge label={activity.issue.key} tone="blue" />
            <Text style={styles.activityIssueTitle} numberOfLines={1}>
              {activity.issue.title}
            </Text>
          </View>
        ) : null}
        {time ? (
          <Text style={styles.activityTime} numberOfLines={1}>
            {time}
          </Text>
        ) : null}
      </View>
      {issueId ? <ChevronRight size={16} color={colors.mutedForeground} /> : null}
    </>
  );

  if (!issueId) {
    return <View style={styles.activityRow}>{content}</View>;
  }

  return (
    <Pressable
      accessibilityRole="button"
      onPress={() => navigation.navigate('IssueDetail', { id: issueId })}
      className="active:opacity-80"
      style={styles.activityRow}
    >
      {content}
    </Pressable>
  );
}

function DashboardIssueRow({ issue }: { issue: Issue }) {
  const navigation = useNavigation<DashboardNavigation>();
  const { colors, styles } = useDashboardTheme();
  const time = relativeTime(issue.updatedAt ?? issue.createdAt);

  return (
    <Pressable
      accessibilityRole="button"
      onPress={() => navigation.navigate('IssueDetail', { id: issue.id })}
      className="active:opacity-80"
      style={styles.issueRow}
    >
      <View style={styles.issueRowTop}>
        <View style={styles.issueMeta}>
          {issue.key ? <SemanticBadge label={issue.key} tone="blue" /> : null}
          {issue.project?.key ? <SemanticBadge label={issue.project.key} tone="cyan" /> : null}
          {issue.status?.name ? <SemanticBadge label={issue.status.name} /> : null}
        </View>
        <ChevronRight size={16} color={colors.mutedForeground} />
      </View>
      <Text className="text-foreground text-sm font-semibold" numberOfLines={2}>
        {issue.title}
      </Text>
      <View style={styles.issueRowFooter}>
        <Text style={styles.mutedSmall} numberOfLines={1}>
          {issue.priority ?? ''}
        </Text>
        {time ? (
          <Text style={styles.mutedSmall} numberOfLines={1}>
            {time}
          </Text>
        ) : null}
      </View>
    </Pressable>
  );
}

function DashboardProjectRow({ project }: { project: Project }) {
  const navigation = useNavigation<DashboardNavigation>();
  const count = project.issueCount ?? 0;
  const { t } = useTranslation();
  const { styles } = useDashboardTheme();

  return (
    <Pressable
      accessibilityRole="button"
      onPress={() => navigation.navigate('ProjectDetail', { id: project.id })}
      className="active:opacity-80"
      style={styles.projectRow}
    >
      <IconTile icon={FolderKanban} tone="cyan" />
      <View className="min-w-0 flex-1 gap-1">
        <Text className="text-foreground text-sm font-semibold" numberOfLines={1}>
          {project.name}
        </Text>
        <Text style={styles.mutedSmall} numberOfLines={1}>
          {project.key}
        </Text>
      </View>
      <SemanticBadge label={t('dashboard.issueCount', { count })} tone="blue" />
    </Pressable>
  );
}

function DashboardLiveCallRow({ call }: { call: GlobalLiveCall }) {
  const navigation = useNavigation<DashboardNavigation>();
  const { t } = useTranslation();
  const { colors, styles } = useDashboardTheme();
  const started = relativeTime(call.startedAt);
  const title = call.room.title || t('dashboard.liveCallsUntitled');
  const subtitle = call.room.subtitle || call.project.name;

  return (
    <Pressable
      accessibilityRole="button"
      onPress={() => {
        if (!call.project.id || !call.roomId) return;
        navigation.navigate('ProjectChat', { projectId: call.project.id, roomId: call.roomId });
      }}
      className="active:opacity-80"
      style={styles.liveCallRow}
    >
      <IconTile icon={PhoneCall} tone="emerald" />
      <View style={styles.liveCallBody}>
        <View style={styles.liveCallTitleRow}>
          <Text style={styles.liveCallTitle} numberOfLines={1}>
            {title}
          </Text>
          <ChevronRight size={16} color={colors.mutedForeground} />
        </View>
        {subtitle ? (
          <Text style={styles.liveCallSubtitle} numberOfLines={1}>
            {subtitle}
          </Text>
        ) : null}
        <View style={styles.liveCallMeta}>
          {call.project.key ? <SemanticBadge label={call.project.key} tone="cyan" /> : null}
          <SemanticBadge
            label={t('dashboard.liveCallsParticipants', { count: call.participantCount })}
            tone="emerald"
          />
          {call.isParticipant ? (
            <SemanticBadge label={t('dashboard.liveCallsJoined')} tone="blue" />
          ) : null}
          {started ? <Text style={styles.mutedSmall}>{started}</Text> : null}
        </View>
      </View>
    </Pressable>
  );
}

function DashboardLiveCallsPanel({ calls, error }: { calls: GlobalLiveCall[]; error: boolean }) {
  const { t } = useTranslation();
  const { colors, styles } = useDashboardTheme();

  return (
    <View style={styles.liveCallsPanel}>
      <View style={styles.liveCallsHeader}>
        <View style={styles.liveCallsTitleWrap}>
          <PhoneCall size={18} color={colors.accentEmerald} />
          <View className="min-w-0 flex-1 gap-1">
            <Text className="text-foreground text-sm font-semibold" numberOfLines={1}>
              {t('dashboard.liveCallsTitle')}
            </Text>
            <Text style={styles.mutedSmall} numberOfLines={1}>
              {t('dashboard.liveCallsSubtitle')}
            </Text>
          </View>
        </View>
        {calls.length > 0 ? (
          <SemanticBadge
            label={t('dashboard.liveCallsCount', { count: calls.length })}
            tone="emerald"
          />
        ) : null}
      </View>

      {error ? (
        <View style={styles.activityInfoRow}>
          <Zap size={16} color={colors.warning} />
          <Text style={styles.activityErrorText}>{t('dashboard.liveCallsLoadFailed')}</Text>
        </View>
      ) : null}

      {calls.length > 0 ? (
        <View style={styles.rows}>
          {calls.map((call) => (
            <DashboardLiveCallRow key={call.id} call={call} />
          ))}
        </View>
      ) : null}
    </View>
  );
}

function DashboardDeadlineRow({
  item,
  language,
  now,
}: {
  item: DeadlineItem;
  language: string;
  now: number;
}) {
  const navigation = useNavigation<DashboardNavigation>();
  const { colors, styles } = useDashboardTheme();
  const { issue, dueAt } = item;
  const dueLabel = formatDeadlineDate(issue.dueDate, language);

  return (
    <Pressable
      accessibilityRole="button"
      onPress={() => navigation.navigate('IssueDetail', { id: issue.id })}
      className="active:opacity-80"
      style={styles.deadlineRow}
    >
      <CalendarClock size={18} color={colors.mutedForeground} />
      <View className="min-w-0 flex-1 gap-1">
        <View style={styles.issueMeta}>
          {issue.key ? <SemanticBadge label={issue.key} tone="blue" /> : null}
          {issue.project?.key ? <SemanticBadge label={issue.project.key} tone="cyan" /> : null}
        </View>
        <Text className="text-foreground text-sm font-semibold" numberOfLines={2}>
          {issue.title}
        </Text>
      </View>
      {dueLabel ? <SemanticBadge label={dueLabel} tone={deadlineTone(dueAt, now)} /> : null}
    </Pressable>
  );
}

function DashboardPinnedRow({
  item,
  onOpen,
  onUnpin,
  unpinning,
  unpinLabel,
}: {
  item: PinnedItem;
  onOpen: (item: PinnedItem) => void;
  onUnpin: (id: string) => void;
  unpinning: boolean;
  unpinLabel: string;
}) {
  const { colors, styles } = useDashboardTheme();
  const Icon = pinnedItemIcon(item.kind);

  return (
    <View style={styles.pinnedRow}>
      <Pressable
        accessibilityRole="button"
        onPress={() => onOpen(item)}
        className="active:opacity-80"
        style={styles.pinnedMain}
      >
        <Icon size={18} color={colors.mutedForeground} />
        <View className="min-w-0 flex-1 gap-1">
          <Text className="text-foreground text-sm font-semibold" numberOfLines={1}>
            {item.title}
          </Text>
          <Text style={styles.mutedSmall} numberOfLines={1}>
            {item.href}
          </Text>
        </View>
      </Pressable>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={unpinLabel}
        disabled={unpinning}
        onPress={() => onUnpin(item.id)}
        style={[styles.unpinButton, unpinning ? styles.disabledAction : null]}
      >
        <PinOff size={16} color={colors.mutedForeground} />
      </Pressable>
    </View>
  );
}

function DashboardCatchUpBanner({
  previousLastSeen,
  digest,
  error,
  expanded,
  loading,
  onDismiss,
  onOpenAction,
  onOpenInbox,
  onRequest,
}: {
  previousLastSeen: string;
  digest?: CatchMeUpDigest | undefined;
  error: boolean;
  expanded: boolean;
  loading: boolean;
  onDismiss: () => void;
  onOpenAction: (action: CatchMeUpActionItem) => void;
  onOpenInbox: () => void;
  onRequest: () => void;
}) {
  const { t } = useTranslation();
  const { colors, styles } = useDashboardTheme();
  const summaryMarkdown = digest?.summaryMarkdown ?? '';
  const hasSummary = summaryMarkdown.trim().length > 0;

  return (
    <View style={styles.catchUpBanner}>
      <View style={styles.catchUpTop}>
        <View style={styles.catchUpTitleRow}>
          <IconTile icon={Sparkles} tone="violet" />
          <View className="min-w-0 flex-1 gap-1">
            <View style={styles.catchUpTitleMetaRow}>
              <Text className="text-foreground text-base font-semibold" numberOfLines={1}>
                {t('dashboard.catchupWelcomeBack')}
              </Text>
              <SemanticBadge
                label={t('dashboard.catchupAway', {
                  gap: formatCatchUpGap(previousLastSeen, t),
                })}
                tone="violet"
              />
            </View>
            <Text style={styles.catchUpPrompt}>{t('inbox.catchup.prompt')}</Text>
          </View>
        </View>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t('dashboard.catchupDismiss')}
          onPress={onDismiss}
          style={styles.catchUpDismiss}
        >
          <X size={16} color={colors.mutedForeground} />
        </Pressable>
      </View>

      {!expanded ? (
        <View style={styles.catchUpActionsRow}>
          <Button title={t('inbox.catchup.action')} icon={Sparkles} onPress={onRequest} />
          <Button
            title={t('dashboard.catchupOpenInbox')}
            icon={ArrowRight}
            onPress={onOpenInbox}
            variant="ghost"
          />
        </View>
      ) : (
        <View style={styles.catchUpExpanded}>
          {loading ? (
            <View style={styles.catchUpStatusRow}>
              <Sparkles size={15} color={colors.accentViolet} />
              <Text style={styles.catchUpPrompt}>{t('inbox.catchup.summarizing')}</Text>
            </View>
          ) : null}

          {!loading && error ? (
            <Text style={styles.catchUpError}>{t('inbox.catchup.loadFailed')}</Text>
          ) : null}

          {!loading && digest && !hasSummary ? (
            <Text style={styles.catchUpPrompt}>{t('inbox.catchup.noSummary')}</Text>
          ) : null}

          {hasSummary ? (
            <View style={styles.catchUpSummaryBox}>
              <Text selectable style={styles.catchUpSummaryText}>
                {summaryMarkdown}
              </Text>
            </View>
          ) : null}

          {digest && digest.actionItems.length > 0 ? (
            <View style={styles.catchUpActionList}>
              <Text style={styles.catchUpSectionLabel}>
                {t('inbox.catchup.suggestedNextSteps')}
              </Text>
              {digest.actionItems.map((action, index) => (
                <Pressable
                  key={`${action.link}-${index}`}
                  accessibilityRole="button"
                  onPress={() => onOpenAction(action)}
                  style={styles.catchUpActionItem}
                  className="active:opacity-80"
                >
                  <View className="min-w-0 flex-1 gap-1">
                    <Text style={styles.catchUpActionTitle} numberOfLines={2}>
                      {action.title}
                    </Text>
                    <Text style={styles.catchUpActionLink} numberOfLines={1}>
                      {action.link}
                    </Text>
                  </View>
                  <SemanticBadge
                    label={t(catchUpUrgencyLabelKey(action.urgency))}
                    tone={catchUpUrgencyTone(action.urgency)}
                  />
                  <ArrowRight size={15} color={colors.mutedForeground} />
                </Pressable>
              ))}
            </View>
          ) : null}

          {digest ? (
            <Text style={styles.catchUpSource}>{catchUpSourceLabel(digest, t)}</Text>
          ) : null}
        </View>
      )}
    </View>
  );
}

function DashboardStandupPanel({
  standup,
  loading,
  generating,
  generateError,
  onGenerate,
}: {
  standup: StandupDigest | null | undefined;
  loading: boolean;
  generating: boolean;
  generateError: boolean;
  onGenerate: () => void;
}) {
  const { t } = useTranslation();
  const { colors, styles } = useDashboardTheme();
  const hasBlockers = !!standup?.blockersMd.trim();

  return (
    <View style={styles.standupPanel}>
      <View style={styles.standupHeader}>
        <View style={styles.standupTitleWrap}>
          <IconTile icon={Sparkles} tone="violet" />
          <Text className="text-foreground text-sm font-semibold" numberOfLines={1}>
            {t('dashboard.standupHeading')}
          </Text>
        </View>
        <Button
          title={standup ? t('dashboard.standupRefresh') : t('dashboard.standupGenerate')}
          icon={standup ? RefreshCw : Sparkles}
          loading={generating}
          onPress={onGenerate}
          variant="secondary"
        />
      </View>

      {loading ? (
        <View style={styles.activityInfoRow}>
          <Activity size={16} color={colors.mutedForeground} />
          <Text style={styles.mutedSmall}>{t('dashboard.standupLoading')}</Text>
        </View>
      ) : standup ? (
        <View style={styles.standupBody}>
          <Text style={styles.standupText}>{standup.contentMd}</Text>
          {hasBlockers ? (
            <View style={styles.standupBlockers}>
              <Text style={styles.standupBlockersTitle}>{t('dashboard.standupBlockers')}</Text>
              <Text style={styles.standupText}>{standup.blockersMd}</Text>
            </View>
          ) : null}
        </View>
      ) : (
        <Text style={styles.mutedSmall}>{t('dashboard.standupEmpty')}</Text>
      )}

      {generateError ? (
        <View style={styles.activityInfoRow}>
          <Zap size={16} color={colors.warning} />
          <Text style={styles.activityErrorText}>{t('dashboard.standupGenerateError')}</Text>
        </View>
      ) : null}
    </View>
  );
}

export function DashboardScreen() {
  const { t, i18n } = useTranslation();
  const navigation = useNavigation<DashboardNavigation>();
  const route = useRoute<DashboardRoute>();
  const { colors, styles } = useDashboardTheme();
  const [routeNotice, setRouteNotice] = useState<DashboardRouteNotice | null>(
    route.params?.notice ?? null,
  );
  const [previousLastSeen, setPreviousLastSeen] = useState<string | null>(null);
  const [catchUpDismissed, setCatchUpDismissed] = useState(false);
  const [catchUpExpanded, setCatchUpExpanded] = useState(false);
  const [dashboardWorkView, setDashboardWorkView] = useState<DashboardWorkView>('assigned');
  const projectsQ = useProjects();
  const analyticsProject = projectsQ.data?.[0] ?? null;
  const analyticsQ = useProjectAnalytics(analyticsProject?.id ?? null);
  const issuesQ = useMyIssues('assigned');
  const workIssuesQ = useMyIssues(dashboardWorkView);
  const inboxQ = useInbox(true);
  const organizationsQ = useOrganizations();
  const pinnedItemsQ = usePinnedItems();
  const deletePinnedItem = useDeletePinnedItem();
  const liveCallsQ = useLiveCalls();

  const projects = useMemo(() => projectsQ.data ?? [], [projectsQ.data]);
  const issues = useMemo(() => issuesQ.data?.issues ?? [], [issuesQ.data?.issues]);
  const workIssues = useMemo(() => workIssuesQ.data?.issues ?? [], [workIssuesQ.data?.issues]);
  const unread = useMemo(() => inboxQ.data ?? [], [inboxQ.data]);
  const pinnedItems = useMemo(() => pinnedItemsQ.data ?? [], [pinnedItemsQ.data]);
  const visiblePinnedItems = useMemo(() => pinnedItems.slice(0, 4), [pinnedItems]);
  const liveCalls = useMemo(() => liveCallsQ.data ?? [], [liveCallsQ.data]);
  const visibleLiveCalls = useMemo(() => liveCalls.slice(0, 4), [liveCalls]);
  const organizations = useMemo(
    () => organizationsQ.data?.organizations ?? [],
    [organizationsQ.data?.organizations],
  );
  const activeOrganizationId = organizations[0]?.id ?? projects[0]?.organizationId ?? null;
  const doraQ = useDoraAnalytics(activeOrganizationId);
  const activitiesQ = useRecentActivities(activeOrganizationId, 8);
  const standupQ = useTodayStandup(activeOrganizationId);
  const generateStandup = useGenerateStandupPreview(activeOrganizationId);
  const catchMeUpQ = useCatchMeUp(previousLastSeen, false);
  const activities = useMemo(() => activitiesQ.data ?? [], [activitiesQ.data]);

  const recentProjects = useMemo(() => [...projects].sort(byRecentProject).slice(0, 3), [projects]);
  const upcomingDeadlines = useMemo<DeadlineItem[]>(() => {
    const now = Date.now();
    const horizon = now + DEADLINE_WINDOW_MS;
    return issues
      .map((issue) => {
        const dueAt = issueDueAt(issue);
        return dueAt === null ? null : { issue, dueAt };
      })
      .filter((item): item is DeadlineItem => !!item && item.dueAt <= horizon)
      .sort((left, right) => left.dueAt - right.dueAt)
      .slice(0, 4);
  }, [issues]);
  const deadlineNow = Date.now();
  const inProgressCount = useMemo(
    () => issues.filter((issue) => issue.status?.category === 'in_progress').length,
    [issues],
  );
  const isLoading =
    projectsQ.isLoading || issuesQ.isLoading || inboxQ.isLoading || organizationsQ.isLoading;
  const isRefreshing =
    projectsQ.isRefetching ||
    analyticsQ.isRefetching ||
    issuesQ.isRefetching ||
    workIssuesQ.isRefetching ||
    inboxQ.isRefetching ||
    organizationsQ.isRefetching ||
    doraQ.isRefetching ||
    pinnedItemsQ.isRefetching ||
    liveCallsQ.isRefetching ||
    standupQ.isRefetching ||
    activitiesQ.isRefetching;
  const hasError = projectsQ.isError || issuesQ.isError || inboxQ.isError || organizationsQ.isError;
  const hasContent =
    projects.length > 0 ||
    issues.length > 0 ||
    workIssues.length > 0 ||
    unread.length > 0 ||
    activities.length > 0 ||
    visiblePinnedItems.length > 0 ||
    visibleLiveCalls.length > 0 ||
    !!activeOrganizationId;
  const showLiveCallsPanel = visibleLiveCalls.length > 0 || (hasContent && liveCallsQ.isError);
  const routeNoticeMeta =
    routeNotice === 'accessDenied'
      ? {
          icon: AlertTriangle,
          color: colors.warning,
          title: t('dashboard.routeNoticeAccessDeniedTitle'),
          description: t('dashboard.routeNoticeAccessDeniedDesc'),
        }
      : routeNotice === 'emailVerified'
        ? {
            icon: CheckCircle2,
            color: colors.success,
            title: t('dashboard.routeNoticeVerifiedTitle'),
            description: t('dashboard.routeNoticeVerifiedDesc'),
          }
        : null;
  const RouteNoticeIcon = routeNoticeMeta?.icon;

  const refresh = () => {
    void projectsQ.refetch();
    void analyticsQ.refetch();
    void issuesQ.refetch();
    void workIssuesQ.refetch();
    void inboxQ.refetch();
    void organizationsQ.refetch();
    void pinnedItemsQ.refetch();
    void liveCallsQ.refetch();
    void standupQ.refetch();
    if (activeOrganizationId) void doraQ.refetch();
    if (activeOrganizationId) void activitiesQ.refetch();
  };

  const openDashboardHref = (href: string) => {
    const target = pinnedHrefUrl(href, getBaseUrl());
    if (!target) return;
    const intent = parseTaskNebulaDeepLink(target);
    if (isContentDeepLink(intent)) {
      navigateToContentDeepLink(intent);
      return;
    }
    void Linking.openURL(target);
  };

  const openPinnedItem = (item: PinnedItem) => {
    openDashboardHref(item.href);
  };

  const openCatchUpAction = (action: CatchMeUpActionItem) => {
    openDashboardHref(action.link);
  };

  const requestCatchUp = () => {
    setCatchUpExpanded(true);
    void catchMeUpQ.refetch();
  };

  useEffect(() => {
    let cancelled = false;

    const syncLastSeen = async () => {
      try {
        const lastSeenAt = await getLastSeen();
        if (!cancelled && shouldShowCatchUpBanner(lastSeenAt)) {
          setPreviousLastSeen(lastSeenAt);
        }
        await updateLastSeen();
      } catch {
        // Last-seen only powers a friendly dashboard banner; keep the dashboard usable on failure.
      }
    };

    void syncLastSeen();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (route.params?.notice) setRouteNotice(route.params.notice);
  }, [route.params]);

  useEffect(() => {
    if (!routeNotice) return undefined;
    const timeout = setTimeout(() => setRouteNotice(null), 6000);
    return () => clearTimeout(timeout);
  }, [routeNotice]);

  if (isLoading) return <Loading />;
  if (hasError && !hasContent) {
    return (
      <Screen>
        <ErrorView message={t('dashboard.loadFailed')} onRetry={refresh} />
      </Screen>
    );
  }

  return (
    <Screen>
      <ScrollView
        className="flex-1"
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={isRefreshing} onRefresh={refresh} />}
      >
        <ScreenHeader
          kicker={t('common.appName')}
          title={t('dashboard.title')}
          subtitle={t('dashboard.subtitle')}
          meta={<SemanticBadge label={t('dashboard.selfHosted')} tone="emerald" />}
        />

        {routeNoticeMeta && RouteNoticeIcon ? (
          <View
            style={[
              styles.routeNotice,
              {
                borderColor: `${routeNoticeMeta.color}55`,
                backgroundColor: `${routeNoticeMeta.color}14`,
              },
            ]}
          >
            <RouteNoticeIcon size={18} color={routeNoticeMeta.color} />
            <View style={styles.routeNoticeBody}>
              <Text style={[styles.routeNoticeTitle, { color: routeNoticeMeta.color }]}>
                {routeNoticeMeta.title}
              </Text>
              <Text style={styles.routeNoticeDesc}>{routeNoticeMeta.description}</Text>
            </View>
          </View>
        ) : null}

        {previousLastSeen && !catchUpDismissed ? (
          <DashboardCatchUpBanner
            previousLastSeen={previousLastSeen}
            digest={catchMeUpQ.data}
            error={catchMeUpQ.isError}
            expanded={catchUpExpanded}
            loading={catchMeUpQ.isFetching}
            onDismiss={() => setCatchUpDismissed(true)}
            onOpenAction={openCatchUpAction}
            onOpenInbox={() => navigation.navigate('Inbox')}
            onRequest={requestCatchUp}
          />
        ) : null}

        <View style={styles.metricsGrid}>
          <MetricCard
            icon={FolderKanban}
            label={t('dashboard.projects')}
            tone="blue"
            value={projects.length}
          />
          <MetricCard
            icon={ListTodo}
            label={t('dashboard.totalIssues')}
            tone="violet"
            value={issues.length}
          />
          <MetricCard
            icon={Gauge}
            label={t('dashboard.inProgress')}
            tone="emerald"
            value={inProgressCount}
          />
          <MetricCard icon={Bell} label={t('dashboard.unread')} tone="cyan" value={unread.length} />
        </View>

        <View style={styles.quickActions}>
          <QuickAction
            icon={FolderKanban}
            label={t('dashboard.quickCreateProject')}
            onPress={() => navigation.navigate('NewProject')}
            tone="cyan"
          />
          <QuickAction
            icon={Plus}
            label={t('dashboard.quickCreateIssue')}
            onPress={() => navigation.navigate('NewIssue')}
            tone="blue"
          />
          <QuickAction
            icon={Search}
            label={t('globalSearch.title')}
            onPress={() => navigation.navigate('Search')}
            tone="violet"
          />
          <QuickAction
            icon={Sparkles}
            label={t('askAi.title')}
            onPress={() => navigation.navigate('AskAi')}
            tone="violet"
          />
          <QuickAction
            icon={FileText}
            label={t('drafts.title')}
            onPress={() => navigation.navigate('Drafts')}
            tone="emerald"
          />
          <QuickAction
            icon={Pin}
            label={t('templates.title')}
            onPress={() => navigation.navigate('Templates')}
            tone="cyan"
          />
          <QuickAction
            icon={BookOpenText}
            label={t('docs.title')}
            onPress={() => navigation.navigate('Docs')}
            tone="emerald"
          />
          <QuickAction
            icon={FolderKanban}
            label={t('dashboard.quickProjects')}
            onPress={() => navigation.navigate('Projects')}
            tone="cyan"
          />
          <QuickAction
            icon={ListTodo}
            label={t('tabs.myIssues')}
            onPress={() => navigation.navigate('Issues')}
            tone="blue"
          />
          <QuickAction
            icon={Layers3}
            label={t('dashboard.quickInitiatives')}
            onPress={() => navigation.navigate('Initiatives')}
            tone="emerald"
          />
          <QuickAction
            icon={Bell}
            label={t('dashboard.quickInbox')}
            onPress={() => navigation.navigate('Inbox')}
            tone="violet"
          />
        </View>

        <View style={styles.section}>
          <DashboardYourWorkWidget
            error={workIssuesQ.isError}
            issues={workIssues}
            loading={workIssuesQ.isLoading}
            view={dashboardWorkView}
            onViewChange={setDashboardWorkView}
            onOpenMyIssues={() =>
              navigation.navigate('MainTabs', {
                screen: 'Issues',
                params: { view: dashboardWorkView },
              })
            }
          />
        </View>

        {showLiveCallsPanel ? (
          <View style={styles.section}>
            <DashboardLiveCallsPanel calls={visibleLiveCalls} error={liveCallsQ.isError} />
          </View>
        ) : null}

        {analyticsProject ? (
          <View style={styles.section}>
            <DashboardAnalyticsSnapshot
              analytics={analyticsQ.data}
              error={analyticsQ.isError}
              language={i18n.language}
              loading={analyticsQ.isLoading}
              projectKey={analyticsProject.key ?? analyticsProject.name}
              onOpen={() =>
                navigation.navigate('ProjectAnalytics', { projectId: analyticsProject.id })
              }
            />
          </View>
        ) : null}

        {activeOrganizationId ? (
          <View style={styles.section}>
            <DashboardDoraPanel
              analytics={doraQ.data}
              error={doraQ.isError}
              language={i18n.language}
              loading={doraQ.isLoading}
              onOpenIntegrations={() =>
                navigation.navigate('OrganizationSettings', { section: 'integrations' })
              }
            />
          </View>
        ) : null}

        {upcomingDeadlines.length > 0 ? (
          <View style={styles.section}>
            <SectionHeader
              title={t('dashboard.upcomingDeadlines')}
              badge={t('issues.count', { count: upcomingDeadlines.length })}
            />
            <View style={styles.rows}>
              {upcomingDeadlines.map((item) => (
                <DashboardDeadlineRow
                  key={item.issue.id}
                  item={item}
                  language={i18n.language}
                  now={deadlineNow}
                />
              ))}
            </View>
          </View>
        ) : null}

        {visiblePinnedItems.length > 0 ? (
          <View style={styles.section}>
            <SectionHeader title={t('dashboard.pinnedItems')} />
            <View style={styles.rows}>
              {visiblePinnedItems.map((item) => (
                <DashboardPinnedRow
                  key={item.id}
                  item={item}
                  onOpen={openPinnedItem}
                  onUnpin={(id) => deletePinnedItem.mutate(id)}
                  unpinning={deletePinnedItem.isPending}
                  unpinLabel={t('dashboard.unpinPinnedItem', { title: item.title })}
                />
              ))}
            </View>
          </View>
        ) : null}

        {activeOrganizationId ? (
          <View style={styles.section}>
            <DashboardStandupPanel
              standup={standupQ.data}
              loading={standupQ.isLoading}
              generating={generateStandup.isPending}
              generateError={generateStandup.isError}
              onGenerate={() => generateStandup.mutate()}
            />
          </View>
        ) : null}

        {activeOrganizationId ? (
          <View style={styles.section}>
            <SectionHeader
              title={t('dashboard.activity.title')}
              badge={
                activities.length > 0
                  ? t('dashboard.activity.eventCount', { count: activities.length })
                  : undefined
              }
            />
            {activitiesQ.isLoading ? (
              <View style={styles.activityInfoRow}>
                <Activity size={16} color={colors.mutedForeground} />
                <Text style={styles.mutedSmall}>{t('dashboard.activity.loading')}</Text>
              </View>
            ) : null}
            {!activitiesQ.isLoading && activitiesQ.isError ? (
              <View style={styles.activityInfoRow}>
                <Zap size={16} color={colors.warning} />
                <Text style={styles.activityErrorText}>{t('dashboard.activity.loadFailed')}</Text>
              </View>
            ) : null}
            {!activitiesQ.isLoading && !activitiesQ.isError && activities.length === 0 ? (
              <View style={styles.activityInfoRow}>
                <Activity size={16} color={colors.mutedForeground} />
                <Text style={styles.mutedSmall}>{t('dashboard.activity.empty')}</Text>
              </View>
            ) : null}
            {activities.length > 0 ? (
              <View style={styles.rows}>
                {activities.map((activity) => (
                  <DashboardActivityRow key={activity.id} activity={activity} />
                ))}
              </View>
            ) : null}
          </View>
        ) : null}

        {recentProjects.length > 0 ? (
          <View style={styles.section}>
            <SectionHeader
              title={t('dashboard.recentProjects')}
              badge={t('projects.count', { count: recentProjects.length })}
            />
            <View style={styles.rows}>
              {recentProjects.map((project) => (
                <DashboardProjectRow key={project.id} project={project} />
              ))}
            </View>
          </View>
        ) : null}

        {!hasContent ? (
          <EmptyState
            icon={LayoutDashboard}
            title={t('dashboard.empty')}
            description={t('dashboard.emptyDesc')}
          />
        ) : null}

        {hasError && hasContent ? (
          <View style={styles.partialError}>
            <Zap size={16} color={colors.warning} />
            <Text style={styles.partialErrorText}>{t('dashboard.partialError')}</Text>
          </View>
        ) : null}
      </ScrollView>
    </Screen>
  );
}

function createDashboardStyles(colors: ThemeColors) {
  return StyleSheet.create({
    content: {
      gap: 16,
      paddingBottom: 20,
    },
    metricsGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 8,
      paddingHorizontal: 16,
    },
    metricCard: {
      width: '48.8%',
      gap: 10,
      borderWidth: StyleSheet.hairlineWidth,
      borderTopWidth: 2,
      borderColor: colors.border,
      borderRadius: 6,
      backgroundColor: colors.card,
      padding: 12,
    },
    metricTop: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 7,
    },
    metricLabel: {
      minWidth: 0,
      flex: 1,
      color: colors.mutedForeground,
      fontSize: 12,
      fontWeight: '600',
      lineHeight: 16,
    },
    metricValue: {
      color: colors.foreground,
      fontSize: 24,
      fontWeight: '700',
      lineHeight: 30,
    },
    quickActions: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 8,
      paddingHorizontal: 16,
    },
    routeNotice: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: 10,
      borderWidth: StyleSheet.hairlineWidth,
      borderRadius: 6,
      marginHorizontal: 16,
      padding: 12,
    },
    routeNoticeBody: {
      minWidth: 0,
      flex: 1,
      gap: 3,
    },
    routeNoticeTitle: {
      fontSize: 13,
      fontWeight: '700',
      lineHeight: 18,
    },
    routeNoticeDesc: {
      color: colors.mutedForeground,
      fontSize: 12,
      lineHeight: 16,
    },
    catchUpBanner: {
      gap: 12,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: `${colors.accentViolet}44`,
      borderRadius: 6,
      backgroundColor: colors.card,
      marginHorizontal: 16,
      padding: 12,
    },
    catchUpTop: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: 10,
    },
    catchUpTitleRow: {
      minWidth: 0,
      flex: 1,
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: 10,
    },
    catchUpTitleMetaRow: {
      minWidth: 0,
      flexDirection: 'row',
      alignItems: 'center',
      flexWrap: 'wrap',
      gap: 8,
    },
    catchUpPrompt: {
      color: colors.mutedForeground,
      fontSize: 12,
      lineHeight: 17,
    },
    catchUpDismiss: {
      width: 32,
      height: 32,
      alignItems: 'center',
      justifyContent: 'center',
      borderRadius: 6,
      backgroundColor: colors.surface,
    },
    catchUpActionsRow: {
      gap: 8,
    },
    catchUpExpanded: {
      gap: 10,
    },
    catchUpStatusRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
    },
    catchUpError: {
      color: colors.warning,
      fontSize: 12,
      lineHeight: 17,
    },
    catchUpSummaryBox: {
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
      borderRadius: 6,
      backgroundColor: colors.surface,
      padding: 10,
    },
    catchUpSummaryText: {
      color: colors.foreground,
      fontSize: 12,
      lineHeight: 18,
    },
    catchUpActionList: {
      gap: 8,
    },
    catchUpSectionLabel: {
      color: colors.mutedForeground,
      fontSize: 11,
      fontWeight: '700',
      lineHeight: 15,
      textTransform: 'uppercase',
    },
    catchUpActionItem: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
      borderRadius: 6,
      backgroundColor: colors.surface,
      padding: 10,
    },
    catchUpActionTitle: {
      color: colors.foreground,
      fontSize: 13,
      fontWeight: '600',
      lineHeight: 18,
    },
    catchUpActionLink: {
      color: colors.mutedForeground,
      fontSize: 11,
      lineHeight: 15,
    },
    catchUpSource: {
      color: colors.mutedForeground,
      fontSize: 11,
      lineHeight: 15,
    },
    quickAction: {
      width: '48.8%',
      minHeight: 96,
      gap: 10,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
      borderRadius: 6,
      backgroundColor: colors.surface,
      padding: 12,
    },
    quickActionLabel: {
      color: colors.foreground,
      fontSize: 13,
      fontWeight: '600',
      lineHeight: 18,
    },
    section: {
      gap: 10,
      paddingHorizontal: 16,
    },
    sectionHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 12,
    },
    yourWorkPanel: {
      gap: 12,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
      borderRadius: 6,
      backgroundColor: colors.card,
      padding: 12,
    },
    yourWorkHeader: {
      minWidth: 0,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 10,
    },
    viewAllButton: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      paddingVertical: 4,
    },
    viewAllText: {
      color: colors.mutedForeground,
      fontSize: 12,
      fontWeight: '600',
      lineHeight: 16,
    },
    workScopeGrid: {
      flexDirection: 'row',
      gap: 6,
    },
    workScopeButton: {
      minWidth: 0,
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 6,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
      borderRadius: 4,
      backgroundColor: colors.surface,
      paddingHorizontal: 8,
      paddingVertical: 9,
    },
    workScopeButtonActive: {
      borderColor: `${colors.primary}55`,
      backgroundColor: `${colors.primary}14`,
    },
    workScopeLabel: {
      minWidth: 0,
      flexShrink: 1,
      color: colors.mutedForeground,
      fontSize: 11,
      fontWeight: '700',
      lineHeight: 15,
    },
    workScopeLabelActive: {
      color: colors.primary,
    },
    yourWorkEmpty: {
      alignItems: 'center',
      gap: 10,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
      borderRadius: 6,
      backgroundColor: colors.surface,
      padding: 12,
    },
    analyticsSnapshotPanel: {
      gap: 12,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
      borderRadius: 6,
      backgroundColor: colors.card,
      padding: 12,
    },
    analyticsSnapshotGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 8,
    },
    analyticsSnapshotMetric: {
      width: '48.7%',
      gap: 6,
      borderWidth: StyleSheet.hairlineWidth,
      borderTopWidth: 2,
      borderColor: colors.border,
      borderRadius: 6,
      backgroundColor: colors.surface,
      padding: 10,
    },
    analyticsSnapshotLabel: {
      color: colors.mutedForeground,
      fontSize: 11,
      fontWeight: '700',
      lineHeight: 15,
    },
    analyticsSnapshotValue: {
      color: colors.foreground,
      fontSize: 15,
      fontWeight: '700',
      lineHeight: 20,
    },
    doraPanel: {
      gap: 12,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
      borderRadius: 6,
      backgroundColor: colors.card,
      padding: 12,
    },
    doraHeader: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      justifyContent: 'space-between',
      gap: 10,
    },
    doraTitleWrap: {
      minWidth: 0,
      flex: 1,
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: 10,
    },
    doraConnectBlock: {
      gap: 10,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
      borderRadius: 6,
      backgroundColor: colors.surface,
      padding: 12,
    },
    doraConnectTitle: {
      color: colors.foreground,
      fontSize: 13,
      fontWeight: '700',
      lineHeight: 18,
    },
    doraConnectDescription: {
      color: colors.mutedForeground,
      fontSize: 12,
      lineHeight: 17,
    },
    doraMetricGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 8,
    },
    doraMetric: {
      width: '48.7%',
      minHeight: 132,
      gap: 6,
      borderWidth: StyleSheet.hairlineWidth,
      borderTopWidth: 2,
      borderColor: colors.border,
      borderRadius: 6,
      backgroundColor: colors.surface,
      padding: 10,
    },
    doraMetricTop: {
      minWidth: 0,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
    },
    doraMetricLabel: {
      minWidth: 0,
      flex: 1,
      color: colors.mutedForeground,
      fontSize: 11,
      fontWeight: '700',
      lineHeight: 15,
    },
    doraMetricValue: {
      color: colors.foreground,
      fontSize: 18,
      fontWeight: '700',
      lineHeight: 23,
    },
    doraMetricHint: {
      minHeight: 32,
      color: colors.mutedForeground,
      fontSize: 11,
      lineHeight: 16,
    },
    doraSparkline: {
      height: 26,
      flexDirection: 'row',
      alignItems: 'flex-end',
      gap: 3,
    },
    doraSparkBar: {
      flex: 1,
      minWidth: 3,
      borderRadius: 2,
      opacity: 0.8,
    },
    rows: {
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
      padding: 12,
    },
    activityBody: {
      minWidth: 0,
      flex: 1,
      gap: 6,
    },
    activityLine: {
      color: colors.mutedForeground,
      fontSize: 13,
      lineHeight: 18,
    },
    activityActor: {
      color: colors.foreground,
      fontWeight: '700',
    },
    activityMessage: {
      color: colors.mutedForeground,
    },
    activityMetaRow: {
      minWidth: 0,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
    },
    activityIssueTitle: {
      minWidth: 0,
      flex: 1,
      color: colors.foreground,
      fontSize: 12,
      fontWeight: '600',
      lineHeight: 16,
    },
    activityTime: {
      color: colors.mutedForeground,
      fontSize: 11,
      lineHeight: 15,
    },
    activityInfoRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
      borderRadius: 6,
      backgroundColor: colors.surface,
      padding: 12,
    },
    activityErrorText: {
      minWidth: 0,
      flex: 1,
      color: colors.warning,
      fontSize: 12,
      lineHeight: 16,
    },
    issueRow: {
      gap: 8,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
      borderRadius: 6,
      backgroundColor: colors.card,
      padding: 12,
    },
    issueRowTop: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      justifyContent: 'space-between',
      gap: 10,
    },
    issueMeta: {
      minWidth: 0,
      flex: 1,
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 6,
    },
    issueRowFooter: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 10,
    },
    projectRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
      borderRadius: 6,
      backgroundColor: colors.card,
      padding: 12,
    },
    liveCallsPanel: {
      gap: 12,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
      borderRadius: 6,
      backgroundColor: colors.card,
      padding: 12,
    },
    liveCallsHeader: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      justifyContent: 'space-between',
      gap: 10,
    },
    liveCallsTitleWrap: {
      minWidth: 0,
      flex: 1,
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: 10,
    },
    liveCallRow: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: 10,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
      borderRadius: 6,
      backgroundColor: colors.surface,
      padding: 10,
    },
    liveCallBody: {
      minWidth: 0,
      flex: 1,
      gap: 6,
    },
    liveCallTitleRow: {
      minWidth: 0,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
    },
    liveCallTitle: {
      minWidth: 0,
      flex: 1,
      color: colors.foreground,
      fontSize: 13,
      fontWeight: '700',
      lineHeight: 18,
    },
    liveCallSubtitle: {
      color: colors.mutedForeground,
      fontSize: 12,
      lineHeight: 16,
    },
    liveCallMeta: {
      minWidth: 0,
      flexDirection: 'row',
      alignItems: 'center',
      flexWrap: 'wrap',
      gap: 6,
    },
    deadlineRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
      borderRadius: 6,
      backgroundColor: colors.card,
      padding: 12,
    },
    pinnedRow: {
      flexDirection: 'row',
      alignItems: 'stretch',
      gap: 8,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
      borderRadius: 6,
      backgroundColor: colors.card,
      padding: 8,
    },
    pinnedMain: {
      minWidth: 0,
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      padding: 4,
    },
    unpinButton: {
      width: 36,
      alignItems: 'center',
      justifyContent: 'center',
      borderRadius: 6,
      backgroundColor: colors.surface,
    },
    disabledAction: {
      opacity: 0.5,
    },
    standupPanel: {
      gap: 12,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
      borderRadius: 6,
      backgroundColor: colors.card,
      padding: 12,
    },
    standupHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      flexWrap: 'wrap',
      gap: 10,
    },
    standupTitleWrap: {
      minWidth: 0,
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
    },
    standupBody: {
      gap: 10,
    },
    standupText: {
      color: colors.foreground,
      fontSize: 12,
      lineHeight: 18,
    },
    standupBlockers: {
      gap: 6,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: `${colors.accentRose}55`,
      borderRadius: 6,
      backgroundColor: `${colors.accentRose}12`,
      padding: 10,
    },
    standupBlockersTitle: {
      color: colors.accentRose,
      fontSize: 12,
      fontWeight: '700',
      lineHeight: 16,
    },
    mutedSmall: {
      color: colors.mutedForeground,
      fontSize: 12,
      lineHeight: 16,
    },
    partialError: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: 8,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: `${colors.warning}55`,
      borderRadius: 6,
      backgroundColor: `${colors.warning}14`,
      marginHorizontal: 16,
      padding: 10,
    },
    partialErrorText: {
      flex: 1,
      color: colors.warning,
      fontSize: 13,
      lineHeight: 18,
    },
  });
}
