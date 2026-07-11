import { useMemo, useState } from 'react';
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from '@/components/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { CalendarDays, ChartGantt, Lightbulb, Plus, Target } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';

import type { Issue, IssuePriority } from '@/api/types';
import {
  Button,
  EmptyState,
  ErrorView,
  Loading,
  Screen,
  ScreenHeader,
  SemanticBadge,
  SurfaceRow,
} from '@/components/ui';
import type { ThemeColors } from '@/design/theme';
import { useThemeColors } from '@/design/theme-context';
import { useIssues, useProject } from '@/hooks/queries';
import type { AppStackParamList } from '@/navigation/types';
import {
  computeRoadmapPlacement,
  getRoadmapPeriod,
  roadmapEndDate,
  roadmapStartDate,
  type RoadmapPeriod,
  type RoadmapPeriodMode,
  type RoadmapPlacement,
} from '@/lib/roadmap';

type ProjectRoadmapProps = NativeStackScreenProps<AppStackParamList, 'ProjectRoadmap'>;
type ProjectRoadmapStyles = ReturnType<typeof createProjectRoadmapStyles>;

const NAME_WIDTH = 194;
const COLUMN_WIDTH = 116;
const ROW_HEIGHT = 58;
const PERIODS: RoadmapPeriodMode[] = ['today', 'weekly', 'monthly', 'quarterly'];

function useProjectRoadmapTheme(): {
  colors: ThemeColors;
  priorityColors: Record<IssuePriority, string>;
  styles: ProjectRoadmapStyles;
} {
  const colors = useThemeColors();
  const priorityColors = useMemo(() => createPriorityColors(colors), [colors]);
  const styles = useMemo(() => createProjectRoadmapStyles(colors), [colors]);
  return { colors, priorityColors, styles };
}

function createPriorityColors(colors: ThemeColors): Record<IssuePriority, string> {
  return {
    critical: colors.accentRose,
    high: colors.accentAmber,
    medium: colors.accentBlue,
    low: colors.accentEmerald,
    none: colors.mutedForeground,
  };
}

interface RoadmapEpic {
  endDate: string | null;
  issue: Issue;
  placement: RoadmapPlacement | null;
  startDate: string | null;
}

function alpha(hex: string, opacity: string): string {
  return `${hex}${opacity}`;
}

function formatDate(value: string | null | undefined, language: string): string {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleDateString(language, { day: 'numeric', month: 'short' });
}

function formatColumnLabel(
  mode: RoadmapPeriodMode,
  date: Date,
  language: string,
  weekOf: (date: string) => string,
): string {
  if (mode === 'today') {
    return date.toLocaleDateString(language, { day: 'numeric', month: 'short' });
  }
  if (mode === 'weekly') {
    return weekOf(date.toLocaleDateString(language, { day: 'numeric', month: 'short' }));
  }
  return date.toLocaleDateString(language, { month: 'short' });
}

function priorityColor(
  priority: IssuePriority | null | undefined,
  priorityColors: Record<IssuePriority, string>,
): string {
  return priorityColors[priority ?? 'none'] ?? priorityColors.medium;
}

function PeriodOption({
  label,
  mode,
  onPress,
  selected,
}: {
  label: string;
  mode: RoadmapPeriodMode;
  onPress: (mode: RoadmapPeriodMode) => void;
  selected: boolean;
}) {
  const { styles } = useProjectRoadmapTheme();

  return (
    <Button
      title={label}
      variant={selected ? 'primary' : 'secondary'}
      onPress={() => onPress(mode)}
      style={styles.periodButton}
    />
  );
}

function SummaryMetric({
  label,
  tone = 'neutral',
  value,
}: {
  label: string;
  tone?: 'blue' | 'emerald' | 'amber' | 'rose' | 'violet' | 'neutral';
  value: number;
}) {
  const { styles } = useProjectRoadmapTheme();

  return (
    <View style={styles.metric}>
      <Text style={styles.metricValue}>{value}</Text>
      <SemanticBadge label={label} tone={tone} />
    </View>
  );
}

function RoadmapSummary({
  epics,
  scheduledCount,
}: {
  epics: RoadmapEpic[];
  scheduledCount: number;
}) {
  const { t } = useTranslation();
  const { colors, styles } = useProjectRoadmapTheme();
  const unscheduledCount = epics.length - scheduledCount;
  const activeCount = epics.filter(
    ({ issue }) =>
      issue.status?.category === 'in_progress' || issue.status?.category === 'in_review',
  ).length;

  return (
    <SurfaceRow className="gap-3">
      <View style={styles.sectionHeader}>
        <Target size={18} color={colors.accentAmber} />
        <View style={styles.sectionCopy}>
          <Text style={styles.sectionTitle}>{t('roadmap.summaryTitle')}</Text>
          <Text style={styles.sectionSubtitle}>{t('roadmap.summarySubtitle')}</Text>
        </View>
      </View>
      <View style={styles.metricGrid}>
        <SummaryMetric label={t('roadmap.epics')} value={epics.length} tone="violet" />
        <SummaryMetric label={t('roadmap.scheduled')} value={scheduledCount} tone="blue" />
        <SummaryMetric label={t('roadmap.active')} value={activeCount} tone="emerald" />
        <SummaryMetric label={t('roadmap.unscheduled')} value={unscheduledCount} tone="amber" />
      </View>
    </SurfaceRow>
  );
}

function RoadmapTimeline({
  epics,
  language,
  mode,
  onOpenIssue,
  period,
}: {
  epics: RoadmapEpic[];
  language: string;
  mode: RoadmapPeriodMode;
  onOpenIssue: (issueId: string) => void;
  period: RoadmapPeriod;
}) {
  const { t } = useTranslation();
  const { colors, priorityColors, styles } = useProjectRoadmapTheme();
  const trackWidth = period.columns.length * COLUMN_WIDTH;
  const totalWidth = NAME_WIDTH + trackWidth;

  return (
    <SurfaceRow className="gap-3">
      <View style={styles.sectionHeader}>
        <ChartGantt size={18} color={colors.accentBlue} />
        <View style={styles.sectionCopy}>
          <Text style={styles.sectionTitle}>{t('roadmap.timelineTitle')}</Text>
          <Text style={styles.sectionSubtitle}>{t('roadmap.timelineSubtitle')}</Text>
        </View>
      </View>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator
        contentContainerStyle={styles.timelineScroll}
      >
        <View style={[styles.timeline, { width: totalWidth }]}>
          <View style={styles.timelineHeader}>
            <View style={styles.nameHeader}>
              <Text style={styles.headerText}>{t('roadmap.epicColumn')}</Text>
            </View>
            {period.columns.map((column) => (
              <View
                key={`${column.start.toISOString()}-${column.end.toISOString()}`}
                style={[
                  styles.columnHeader,
                  { width: COLUMN_WIDTH },
                  column.isCurrent ? styles.currentColumn : null,
                ]}
              >
                <Text style={styles.headerText} numberOfLines={1}>
                  {formatColumnLabel(mode, column.start, language, (date) =>
                    t('roadmap.weekOf', { date }),
                  )}
                </Text>
                {column.isCurrent ? (
                  <SemanticBadge label={t('roadmap.current')} tone="blue" />
                ) : null}
              </View>
            ))}
          </View>

          {epics.map(({ issue, placement }) => {
            const color = priorityColor(issue.priority, priorityColors);
            return (
              <View key={issue.id} style={styles.timelineRow}>
                <Pressable
                  accessibilityRole="button"
                  onPress={() => onOpenIssue(issue.id)}
                  className="active:opacity-80"
                  style={styles.nameButton}
                >
                  {issue.key ? (
                    <Text style={styles.issueKey} numberOfLines={1}>
                      {issue.key}
                    </Text>
                  ) : null}
                  <Text style={styles.issueTitle} numberOfLines={1}>
                    {issue.title}
                  </Text>
                </Pressable>
                <View style={[styles.track, { width: trackWidth }]}>
                  {period.columns.map((column) => (
                    <View
                      key={`${issue.id}-${column.start.toISOString()}`}
                      style={[
                        styles.trackColumn,
                        { width: COLUMN_WIDTH },
                        column.isCurrent ? styles.currentColumn : null,
                      ]}
                    />
                  ))}
                  {placement ? (
                    <Pressable
                      accessibilityRole="button"
                      onPress={() => onOpenIssue(issue.id)}
                      className="active:opacity-80"
                      style={[
                        styles.bar,
                        {
                          backgroundColor: alpha(color, '24'),
                          borderColor: alpha(color, '66'),
                          left: `${placement.left}%`,
                          width: `${placement.width}%`,
                        },
                      ]}
                    >
                      <Text style={[styles.barText, { color }]} numberOfLines={1}>
                        {issue.title}
                      </Text>
                    </Pressable>
                  ) : (
                    <Text style={styles.noDatesText}>{t('roadmap.noDatesSet')}</Text>
                  )}
                </View>
              </View>
            );
          })}
        </View>
      </ScrollView>
    </SurfaceRow>
  );
}

function RoadmapEpicList({
  epics,
  language,
  onOpenIssue,
}: {
  epics: RoadmapEpic[];
  language: string;
  onOpenIssue: (issueId: string) => void;
}) {
  const { t } = useTranslation();
  const { colors, styles } = useProjectRoadmapTheme();

  return (
    <SurfaceRow className="gap-3">
      <View style={styles.sectionHeader}>
        <Lightbulb size={18} color={colors.accentAmber} />
        <View style={styles.sectionCopy}>
          <Text style={styles.sectionTitle}>{t('roadmap.epicListTitle')}</Text>
          <Text style={styles.sectionSubtitle}>{t('roadmap.epicListSubtitle')}</Text>
        </View>
      </View>

      {epics.map(({ issue }) => (
        <Pressable
          key={issue.id}
          accessibilityRole="button"
          onPress={() => onOpenIssue(issue.id)}
          className="active:opacity-80"
          style={styles.epicRow}
        >
          <CalendarDays size={15} color={colors.mutedForeground} />
          <View style={styles.epicCopy}>
            <Text style={styles.issueTitle} numberOfLines={1}>
              {issue.title}
            </Text>
            <Text style={styles.epicMeta} numberOfLines={1}>
              {issue.key ?? t('issueType.epic')}
            </Text>
          </View>
          <SemanticBadge
            label={issue.priority ? t(`priority.${issue.priority}`) : t('priority.none')}
          />
        </Pressable>
      ))}

      <View style={styles.dateLegend}>
        <Text style={styles.legendText}>{t('roadmap.startDate')}</Text>
        <Text style={styles.legendText}>{t('roadmap.targetDate')}</Text>
      </View>
      {epics.map(({ endDate, issue, startDate }) => (
        <View key={`${issue.id}-dates`} style={styles.dateRow}>
          <Text style={styles.dateRowText} numberOfLines={1}>
            {startDate ? formatDate(startDate, language) : t('common.none')}
          </Text>
          <Text style={styles.dateRowText} numberOfLines={1}>
            {endDate ? formatDate(endDate, language) : t('common.none')}
          </Text>
        </View>
      ))}
    </SurfaceRow>
  );
}

export function ProjectRoadmapScreen({ navigation, route }: ProjectRoadmapProps) {
  const { i18n, t } = useTranslation();
  const { styles } = useProjectRoadmapTheme();
  const { projectId } = route.params;
  const [periodMode, setPeriodMode] = useState<RoadmapPeriodMode>('quarterly');
  const projectQ = useProject(projectId);
  const epicsQ = useIssues({ projectId, type: 'epic' });
  const period = useMemo(() => getRoadmapPeriod(periodMode), [periodMode]);
  const epics = useMemo<RoadmapEpic[]>(
    () =>
      (epicsQ.data ?? []).map((issue) => {
        const startDate = roadmapStartDate(issue);
        const endDate = roadmapEndDate(issue);
        return {
          issue,
          startDate,
          endDate,
          placement: computeRoadmapPlacement(startDate, endDate, period),
        };
      }),
    [epicsQ.data, period],
  );
  const scheduledCount = useMemo(
    () => epics.filter((epic) => Boolean(epic.placement)).length,
    [epics],
  );

  if (epicsQ.isLoading) return <Loading label={t('roadmap.loading')} />;

  if (epicsQ.isError) {
    return (
      <Screen>
        <ErrorView
          message={epicsQ.error instanceof Error ? epicsQ.error.message : t('roadmap.loadFailed')}
          onRetry={() => void epicsQ.refetch()}
        />
      </Screen>
    );
  }

  const openIssue = (issueId: string) => navigation.navigate('IssueDetail', { id: issueId });
  const refreshControl = (
    <RefreshControl
      refreshing={epicsQ.isRefetching || projectQ.isRefetching}
      onRefresh={() => {
        void epicsQ.refetch();
        void projectQ.refetch();
      }}
    />
  );

  return (
    <Screen>
      <ScrollView contentContainerStyle={styles.content} refreshControl={refreshControl}>
        <ScreenHeader
          kicker={projectQ.data?.key ?? t('projects.title')}
          title={t('roadmap.title')}
          subtitle={projectQ.data?.name ?? t('roadmap.subtitle')}
          meta={<SemanticBadge label={t('issues.count', { count: epics.length })} tone="violet" />}
        />

        <View style={styles.actions}>
          <Button
            title={t('roadmap.newEpic')}
            icon={Plus}
            onPress={() => navigation.navigate('NewIssue', { projectId, type: 'epic' })}
          />
        </View>

        <View style={styles.sectionWrap}>
          <RoadmapSummary epics={epics} scheduledCount={scheduledCount} />
        </View>

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.periodContent}
        >
          {PERIODS.map((mode) => (
            <PeriodOption
              key={mode}
              label={t(`roadmap.period.${mode}`)}
              mode={mode}
              selected={periodMode === mode}
              onPress={setPeriodMode}
            />
          ))}
        </ScrollView>

        {epics.length === 0 ? (
          <View style={styles.emptyWrap}>
            <EmptyState
              icon={ChartGantt}
              title={t('roadmap.emptyTitle')}
              description={t('roadmap.emptyDesc')}
            />
          </View>
        ) : (
          <>
            <View style={styles.sectionWrap}>
              <RoadmapTimeline
                epics={epics}
                language={i18n.language}
                mode={periodMode}
                onOpenIssue={openIssue}
                period={period}
              />
            </View>
            <View style={styles.sectionWrap}>
              <RoadmapEpicList epics={epics} language={i18n.language} onOpenIssue={openIssue} />
            </View>
          </>
        )}
      </ScrollView>
    </Screen>
  );
}

function createProjectRoadmapStyles(colors: ThemeColors) {
  return StyleSheet.create({
    content: {
      paddingBottom: 18,
    },
    actions: {
      paddingHorizontal: 16,
      paddingBottom: 12,
    },
    sectionWrap: {
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
    metricGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 8,
    },
    metric: {
      minWidth: 122,
      flex: 1,
      gap: 8,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
      borderRadius: 6,
      backgroundColor: colors.surface,
      padding: 10,
    },
    metricValue: {
      color: colors.foreground,
      fontSize: 20,
      fontWeight: '700',
      lineHeight: 26,
    },
    periodContent: {
      gap: 8,
      paddingHorizontal: 16,
      paddingBottom: 12,
    },
    periodButton: {
      minWidth: 118,
    },
    timelineScroll: {
      paddingBottom: 4,
    },
    timeline: {
      overflow: 'hidden',
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
      borderRadius: 6,
      backgroundColor: colors.surface,
    },
    timelineHeader: {
      flexDirection: 'row',
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
    },
    nameHeader: {
      width: NAME_WIDTH,
      justifyContent: 'center',
      borderRightWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
      paddingHorizontal: 10,
    },
    columnHeader: {
      minHeight: 48,
      justifyContent: 'center',
      gap: 4,
      borderRightWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
      paddingHorizontal: 8,
    },
    headerText: {
      color: colors.mutedForeground,
      fontSize: 11,
      fontWeight: '700',
      letterSpacing: 0,
      lineHeight: 15,
      textTransform: 'uppercase',
    },
    currentColumn: {
      backgroundColor: alpha(colors.accentBlue, '14'),
    },
    timelineRow: {
      height: ROW_HEIGHT,
      flexDirection: 'row',
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
    },
    nameButton: {
      width: NAME_WIDTH,
      height: ROW_HEIGHT,
      justifyContent: 'center',
      borderRadius: 0,
      paddingHorizontal: 10,
    },
    track: {
      position: 'relative',
      flexDirection: 'row',
      borderLeftWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
    },
    trackColumn: {
      height: ROW_HEIGHT,
      borderRightWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
    },
    bar: {
      position: 'absolute',
      top: 12,
      height: 34,
      borderWidth: StyleSheet.hairlineWidth,
    },
    noDatesText: {
      position: 'absolute',
      top: 20,
      left: 12,
      color: colors.mutedForeground,
      fontSize: 12,
      fontStyle: 'italic',
      lineHeight: 16,
    },
    emptyWrap: {
      minHeight: 320,
      paddingHorizontal: 16,
    },
    issueKey: {
      color: colors.mutedForeground,
      fontSize: 10,
      fontWeight: '700',
      letterSpacing: 0,
      lineHeight: 13,
    },
    issueTitle: {
      color: colors.foreground,
      fontSize: 13,
      fontWeight: '600',
      lineHeight: 18,
    },
    barText: {
      fontSize: 12,
      fontWeight: '700',
      lineHeight: 16,
    },
    epicRow: {
      minHeight: 48,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
      borderRadius: 6,
      backgroundColor: colors.surface,
      paddingHorizontal: 10,
      paddingVertical: 8,
    },
    epicCopy: {
      minWidth: 0,
      flex: 1,
      gap: 2,
    },
    epicMeta: {
      color: colors.mutedForeground,
      fontSize: 11,
      lineHeight: 15,
    },
    dateLegend: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      gap: 12,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
      paddingTop: 10,
    },
    legendText: {
      flex: 1,
      color: colors.mutedForeground,
      fontSize: 11,
      fontWeight: '700',
      lineHeight: 15,
      textTransform: 'uppercase',
    },
    dateRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      gap: 12,
    },
    dateRowText: {
      flex: 1,
      color: colors.foreground,
      fontSize: 13,
      lineHeight: 18,
    },
  });
}
