import { useMemo } from 'react';
import { RefreshControl, ScrollView, StyleSheet, Text, View } from '@/components/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import {
  Activity,
  AlertCircle,
  BarChart3,
  Calendar,
  CheckCircle2,
  Clock3,
  Gauge,
  ListChecks,
  Target,
  TrendingUp,
  Users,
  type LucideIcon,
} from 'lucide-react-native';
import { useTranslation } from 'react-i18next';

import type {
  ProjectHealthPriorityBucket,
  ProjectHealthStatusBucket,
  ProjectHealthTypeBucket,
  ProjectForecastAnalytics,
  ProjectThroughputBucket,
  ProjectVelocitySprint,
} from '@/api/types';
import {
  ErrorView,
  IconTile,
  Loading,
  Screen,
  ScreenHeader,
  SemanticBadge,
  SurfaceRow,
} from '@/components/ui';
import type { ThemeColors } from '@/design/theme';
import { useThemeColors } from '@/design/theme-context';
import { useProject, useProjectAnalytics } from '@/hooks/queries';
import { analyticsBarWidth, maxBucketCount, recentBuckets, roundMetric } from '@/lib/analytics';
import type { AppStackParamList } from '@/navigation/types';

type ProjectAnalyticsProps = NativeStackScreenProps<AppStackParamList, 'ProjectAnalytics'>;
type MetricTone = 'blue' | 'emerald' | 'amber' | 'rose' | 'violet' | 'neutral';
type ProjectAnalyticsStyles = ReturnType<typeof createProjectAnalyticsStyles>;

function useProjectAnalyticsTheme(): {
  chartColors: string[];
  colors: ThemeColors;
  styles: ProjectAnalyticsStyles;
} {
  const colors = useThemeColors();
  const chartColors = useMemo(() => createChartColors(colors), [colors]);
  const styles = useMemo(() => createProjectAnalyticsStyles(colors), [colors]);
  return { chartColors, colors, styles };
}

function createChartColors(colors: ThemeColors): string[] {
  return [
    colors.accentBlue,
    colors.accentEmerald,
    colors.accentViolet,
    colors.accentAmber,
    colors.accentCyan,
    colors.accentRose,
  ];
}

const PRIORITIES = ['none', 'low', 'medium', 'high', 'critical'] as const;
const ISSUE_TYPES = ['task', 'story', 'bug', 'epic', 'subtask'] as const;

function alpha(hex: string, opacity: string): string {
  return `${hex}${opacity}`;
}

function formatNumber(value: number, language: string): string {
  return value.toLocaleString(language);
}

function formatDate(value: string | null | undefined, language: string): string {
  if (!value) return '';
  if (value === 'never') return value;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleDateString(language, { day: 'numeric', month: 'short' });
}

function forecastDateLabel(value: string, language: string, neverLabel: string): string {
  if (value === 'never') return neverLabel;
  return formatDate(value, language) || value;
}

function formatPeriod(value: string, language: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString(language, { day: 'numeric', month: 'short' });
}

function sprintRange(sprint: ProjectVelocitySprint, language: string): string {
  const start = formatDate(sprint.startDate, language);
  const end = formatDate(sprint.endDate, language);
  if (start && end) return `${start} - ${end}`;
  return start || end;
}

function isPriority(value: string): value is (typeof PRIORITIES)[number] {
  return PRIORITIES.includes(value as (typeof PRIORITIES)[number]);
}

function isIssueType(value: string): value is (typeof ISSUE_TYPES)[number] {
  return ISSUE_TYPES.includes(value as (typeof ISSUE_TYPES)[number]);
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
  value: string;
}) {
  const { colors, styles } = useProjectAnalyticsTheme();

  return (
    <View style={styles.metricCard}>
      <View style={styles.metricHeader}>
        <SemanticBadge label={label} tone={tone} />
        <Icon size={16} color={colors.mutedForeground} />
      </View>
      <Text style={styles.metricValue} numberOfLines={1}>
        {value}
      </Text>
    </View>
  );
}

function AnalyticsBar({
  color,
  label,
  max,
  value,
}: {
  color: string;
  label: string;
  max: number;
  value: number;
}) {
  const { styles } = useProjectAnalyticsTheme();
  const width = analyticsBarWidth(value, max);

  return (
    <View style={styles.barRow}>
      <View style={styles.barHeader}>
        <Text style={styles.barLabel} numberOfLines={1}>
          {label}
        </Text>
        <Text style={styles.barValue}>{value}</Text>
      </View>
      <View style={styles.barTrack}>
        <View style={[styles.barFill, { backgroundColor: color, width: `${width}%` }]} />
      </View>
    </View>
  );
}

function SectionHeader({
  icon: Icon,
  meta,
  title,
}: {
  icon: LucideIcon;
  meta?: string;
  title: string;
}) {
  const { styles } = useProjectAnalyticsTheme();

  return (
    <View style={styles.sectionHeader}>
      <View style={styles.sectionTitleWrap}>
        <IconTile icon={Icon} tone="blue" />
        <Text style={styles.sectionTitle} numberOfLines={2}>
          {title}
        </Text>
      </View>
      {meta ? <SemanticBadge label={meta} tone="neutral" /> : null}
    </View>
  );
}

function DistributionSection<T>({
  emptyLabel,
  icon,
  items,
  labelFor,
  title,
}: {
  emptyLabel: string;
  icon: LucideIcon;
  items: T[];
  labelFor: (item: T) => string;
  title: string;
}) {
  const { chartColors, styles } = useProjectAnalyticsTheme();
  const max = maxBucketCount(items as Array<T & { count: number }>);

  return (
    <SurfaceRow className="gap-3">
      <SectionHeader icon={icon} title={title} />
      {items.length === 0 ? <Text style={styles.mutedText}>{emptyLabel}</Text> : null}
      {items.map((item, index) => {
        const bucket = item as T & { count: number };
        return (
          <AnalyticsBar
            key={`${labelFor(item)}-${index}`}
            label={labelFor(item)}
            value={bucket.count}
            max={max}
            color={chartColors[index % chartColors.length]!}
          />
        );
      })}
    </SurfaceRow>
  );
}

function VelocitySection({ sprints }: { sprints: ProjectVelocitySprint[] }) {
  const { i18n, t } = useTranslation();
  const { chartColors, colors, styles } = useProjectAnalyticsTheme();
  const visibleSprints = recentBuckets(sprints, 6);
  const maxIssues = maxBucketCount(
    visibleSprints.map((sprint) => ({ count: sprint.completedIssues })),
  );

  return (
    <SurfaceRow className="gap-3">
      <SectionHeader icon={TrendingUp} title={t('analytics.avgVelocity')} />
      {visibleSprints.length === 0 ? (
        <Text style={styles.mutedText}>{t('analytics.noStatusData')}</Text>
      ) : null}
      {visibleSprints.map((sprint, index) => {
        const range = sprintRange(sprint, i18n.language);
        return (
          <View key={sprint.sprintId} style={styles.velocityRow}>
            <View style={styles.velocityHeader}>
              <View style={styles.velocityCopy}>
                <Text style={styles.velocityTitle} numberOfLines={1}>
                  {sprint.sprintName}
                </Text>
                {range ? (
                  <View style={styles.inlineMeta}>
                    <Calendar size={13} color={colors.mutedForeground} />
                    <Text style={styles.inlineMetaText} numberOfLines={1}>
                      {range}
                    </Text>
                  </View>
                ) : null}
              </View>
              <SemanticBadge
                label={t('analytics.velocityValue', {
                  issues: formatNumber(sprint.completedIssues, i18n.language),
                  points: formatNumber(sprint.completedPoints, i18n.language),
                })}
                tone="violet"
              />
            </View>
            <AnalyticsBar
              label={t('analytics.completedIssues')}
              value={sprint.completedIssues}
              max={maxIssues}
              color={chartColors[index % chartColors.length]!}
            />
          </View>
        );
      })}
    </SurfaceRow>
  );
}

function ThroughputSection({
  buckets,
  days,
}: {
  buckets: ProjectThroughputBucket[];
  days: number;
}) {
  const { i18n, t } = useTranslation();
  const { chartColors, styles } = useProjectAnalyticsTheme();
  const visibleBuckets = recentBuckets(buckets, 10);
  const max = maxBucketCount(visibleBuckets);

  return (
    <SurfaceRow className="gap-3">
      <SectionHeader
        icon={Activity}
        title={t('analytics.throughput')}
        meta={t('analytics.windowDays', { count: days })}
      />
      {visibleBuckets.length === 0 ? (
        <Text style={styles.mutedText}>{t('analytics.noThroughputData')}</Text>
      ) : null}
      {visibleBuckets.map((bucket, index) => (
        <AnalyticsBar
          key={bucket.period}
          label={formatPeriod(bucket.period, i18n.language)}
          value={bucket.count}
          max={max}
          color={chartColors[index % chartColors.length]!}
        />
      ))}
    </SurfaceRow>
  );
}

function ForecastSection({ forecast }: { forecast: ProjectForecastAnalytics }) {
  const { i18n, t } = useTranslation();
  const { chartColors, styles } = useProjectAnalyticsTheme();
  const visibleBuckets = forecast.histogram.slice(0, 10);
  const max = maxBucketCount(visibleBuckets);
  const neverLabel = t('analytics.forecastNever');

  return (
    <SurfaceRow className="gap-3">
      <SectionHeader
        icon={Target}
        title={t('analytics.forecastTitle')}
        meta={t('analytics.forecastIterations', {
          count: formatNumber(forecast.iterations, i18n.language),
        })}
      />
      <Text style={styles.mutedText}>{t('analytics.forecastSubtitle')}</Text>

      <View style={styles.forecastGrid}>
        <MetricCard
          icon={ListChecks}
          label={t('analytics.forecastBacklog')}
          value={formatNumber(forecast.backlog, i18n.language)}
          tone="blue"
        />
        <MetricCard
          icon={Clock3}
          label={t('analytics.forecastP50')}
          value={forecastDateLabel(forecast.p50Date, i18n.language, neverLabel)}
          tone="emerald"
        />
        <MetricCard
          icon={Clock3}
          label={t('analytics.forecastP80')}
          value={forecastDateLabel(forecast.p80Date, i18n.language, neverLabel)}
          tone="amber"
        />
        <MetricCard
          icon={Clock3}
          label={t('analytics.forecastP95')}
          value={forecastDateLabel(forecast.p95Date, i18n.language, neverLabel)}
          tone="rose"
        />
      </View>

      <View style={styles.forecastSprintsRow}>
        <SemanticBadge
          label={t('analytics.forecastSprints', { percentile: 'p50', count: forecast.p50Sprints })}
          tone="emerald"
        />
        <SemanticBadge
          label={t('analytics.forecastSprints', { percentile: 'p80', count: forecast.p80Sprints })}
          tone="amber"
        />
        <SemanticBadge
          label={t('analytics.forecastSprints', { percentile: 'p95', count: forecast.p95Sprints })}
          tone="rose"
        />
      </View>

      {forecast.throughputHistory.length > 0 ? (
        <Text style={styles.mutedText}>
          {t('analytics.forecastThroughputHistory', {
            values: forecast.throughputHistory.join(', '),
          })}
        </Text>
      ) : null}

      {visibleBuckets.length === 0 ? (
        <Text style={styles.mutedText}>{t('analytics.forecastNoHistogram')}</Text>
      ) : null}
      {visibleBuckets.map((bucket, index) => (
        <AnalyticsBar
          key={`${bucket.sprints}-${bucket.count}`}
          label={t('analytics.forecastHistogramLabel', { count: bucket.sprints })}
          value={bucket.count}
          max={max}
          color={chartColors[index % chartColors.length]!}
        />
      ))}
    </SurfaceRow>
  );
}

export function ProjectAnalyticsScreen({ route }: ProjectAnalyticsProps) {
  const { i18n, t } = useTranslation();
  const { colors, styles } = useProjectAnalyticsTheme();
  const { projectId } = route.params;
  const projectQ = useProject(projectId);
  const analyticsQ = useProjectAnalytics(projectId);
  const analytics = analyticsQ.data;
  const refreshing = projectQ.isRefetching || analyticsQ.isRefetching;

  const statusBuckets = useMemo(
    () => analytics?.health.issuesByStatus.slice(0, 8) ?? [],
    [analytics?.health.issuesByStatus],
  );
  const priorityBuckets = useMemo(
    () => analytics?.health.issuesByPriority.slice(0, 8) ?? [],
    [analytics?.health.issuesByPriority],
  );
  const typeBuckets = useMemo(
    () => analytics?.health.issuesByType.slice(0, 8) ?? [],
    [analytics?.health.issuesByType],
  );

  if (analyticsQ.isLoading && !analytics) {
    return <Loading label={t('analytics.loading')} />;
  }

  if (analyticsQ.isError && !analytics) {
    return (
      <Screen>
        <ErrorView
          message={t('analytics.loadFailed')}
          onRetry={() => {
            void analyticsQ.refetch();
          }}
        />
      </Screen>
    );
  }

  return (
    <Screen>
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => {
              void projectQ.refetch();
              void analyticsQ.refetch();
            }}
          />
        }
      >
        <ScreenHeader
          kicker={projectQ.data?.key ?? t('projects.title')}
          title={t('analytics.title')}
          subtitle={t('analytics.subtitle')}
          meta={
            analytics ? (
              <SemanticBadge
                label={t('analytics.windowDays', { count: analytics.throughput.days })}
                tone="blue"
              />
            ) : undefined
          }
        />

        {analyticsQ.isError ? (
          <View style={styles.inlineError}>
            <AlertCircle size={16} color={colors.destructive} />
            <Text style={styles.errorText}>{t('analytics.loadFailed')}</Text>
          </View>
        ) : null}

        {analytics ? (
          <>
            <View style={styles.metricGrid}>
              <MetricCard
                icon={ListChecks}
                label={t('analytics.totalIssues')}
                value={formatNumber(analytics.health.overview.totalIssues, i18n.language)}
                tone="blue"
              />
              <MetricCard
                icon={AlertCircle}
                label={t('analytics.overdueIssues')}
                value={formatNumber(analytics.health.overview.overdueIssues, i18n.language)}
                tone={analytics.health.overview.overdueIssues > 0 ? 'rose' : 'neutral'}
              />
              <MetricCard
                icon={Users}
                label={t('analytics.unassignedIssues')}
                value={formatNumber(analytics.health.overview.unassignedIssues, i18n.language)}
                tone={analytics.health.overview.unassignedIssues > 0 ? 'amber' : 'neutral'}
              />
              <MetricCard
                icon={CheckCircle2}
                label={t('analytics.activeSprints')}
                value={formatNumber(analytics.health.sprints.active, i18n.language)}
                tone="emerald"
              />
              <MetricCard
                icon={TrendingUp}
                label={t('analytics.avgVelocity')}
                value={t('analytics.velocityValue', {
                  issues: formatNumber(
                    roundMetric(analytics.velocity.averageVelocity.issues),
                    i18n.language,
                  ),
                  points: formatNumber(
                    roundMetric(analytics.velocity.averageVelocity.points),
                    i18n.language,
                  ),
                })}
                tone="violet"
              />
              <MetricCard
                icon={Gauge}
                label={t('analytics.cycleP90')}
                value={t('analytics.daysValue', {
                  count: formatNumber(roundMetric(analytics.cycleTime.p90), i18n.language),
                })}
                tone="amber"
              />
            </View>

            <VelocitySection sprints={analytics.velocity.sprints} />
            <ForecastSection forecast={analytics.forecast} />

            <DistributionSection<ProjectHealthStatusBucket>
              icon={BarChart3}
              title={t('analytics.statusDistribution')}
              emptyLabel={t('analytics.noStatusData')}
              items={statusBuckets}
              labelFor={(item) => item.name ?? item.category ?? item.status}
            />

            <DistributionSection<ProjectHealthPriorityBucket>
              icon={AlertCircle}
              title={t('issue.priority')}
              emptyLabel={t('analytics.noStatusData')}
              items={priorityBuckets}
              labelFor={(item) =>
                isPriority(item.priority) ? t(`priority.${item.priority}`) : item.priority
              }
            />

            <DistributionSection<ProjectHealthTypeBucket>
              icon={ListChecks}
              title={t('issues.filterType')}
              emptyLabel={t('analytics.noStatusData')}
              items={typeBuckets}
              labelFor={(item) =>
                isIssueType(item.type) ? t(`issueType.${item.type}`) : item.type
              }
            />

            <ThroughputSection
              buckets={analytics.throughput.data}
              days={analytics.throughput.days}
            />
          </>
        ) : null}
      </ScrollView>
    </Screen>
  );
}

function createProjectAnalyticsStyles(colors: ThemeColors) {
  return StyleSheet.create({
    content: {
      gap: 12,
      paddingBottom: 20,
    },
    metricGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 10,
      paddingHorizontal: 16,
    },
    forecastGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 10,
    },
    forecastSprintsRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 6,
    },
    metricCard: {
      minWidth: 148,
      flex: 1,
      gap: 10,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
      borderRadius: 6,
      backgroundColor: colors.card,
      paddingHorizontal: 12,
      paddingVertical: 12,
    },
    metricHeader: {
      minHeight: 24,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 8,
    },
    metricValue: {
      color: colors.foreground,
      fontSize: 20,
      fontWeight: '700',
      lineHeight: 26,
    },
    sectionHeader: {
      minHeight: 42,
      flexDirection: 'row',
      alignItems: 'flex-start',
      justifyContent: 'space-between',
      gap: 12,
    },
    sectionTitleWrap: {
      minWidth: 0,
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
    },
    sectionTitle: {
      minWidth: 0,
      flex: 1,
      color: colors.foreground,
      fontSize: 16,
      fontWeight: '700',
      lineHeight: 22,
    },
    mutedText: {
      color: colors.mutedForeground,
      fontSize: 13,
      lineHeight: 18,
    },
    errorText: {
      color: colors.destructive,
      fontSize: 13,
      fontWeight: '600',
      lineHeight: 18,
    },
    inlineError: {
      marginHorizontal: 16,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: alpha(colors.destructive, '44'),
      borderRadius: 6,
      backgroundColor: alpha(colors.destructive, '14'),
      paddingHorizontal: 12,
      paddingVertical: 10,
    },
    barRow: {
      gap: 6,
    },
    barHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 10,
    },
    barLabel: {
      minWidth: 0,
      flex: 1,
      color: colors.mutedForeground,
      fontSize: 12,
      fontWeight: '600',
      lineHeight: 16,
    },
    barValue: {
      color: colors.foreground,
      fontSize: 12,
      fontWeight: '700',
      lineHeight: 16,
    },
    barTrack: {
      height: 8,
      borderRadius: 999,
      backgroundColor: colors.muted,
      overflow: 'hidden',
    },
    barFill: {
      height: '100%',
      borderRadius: 999,
    },
    velocityRow: {
      gap: 9,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
      borderRadius: 6,
      backgroundColor: colors.surface,
      padding: 10,
    },
    velocityHeader: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      justifyContent: 'space-between',
      gap: 10,
    },
    velocityCopy: {
      minWidth: 0,
      flex: 1,
      gap: 4,
    },
    velocityTitle: {
      color: colors.foreground,
      fontSize: 13,
      fontWeight: '700',
      lineHeight: 18,
    },
    inlineMeta: {
      minWidth: 0,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
    },
    inlineMetaText: {
      minWidth: 0,
      flex: 1,
      color: colors.mutedForeground,
      fontSize: 12,
      fontWeight: '600',
      lineHeight: 16,
    },
  });
}
