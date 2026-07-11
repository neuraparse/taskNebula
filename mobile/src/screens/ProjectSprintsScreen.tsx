import { Alert } from 'react-native';
import { useMemo, useState } from 'react';
import {
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
  type ListRenderItem,
} from '@/components/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import {
  ArrowRight,
  Calendar,
  CheckCircle2,
  Plus,
  Target,
  Timer,
  Trash2,
  X,
  type LucideIcon,
} from 'lucide-react-native';
import { useTranslation } from 'react-i18next';

import type { Sprint, SprintStatus } from '@/api/types';
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
  useCreateSprint,
  useDeleteSprint,
  useProject,
  useProjects,
  useSprints,
} from '@/hooks/queries';
import type { AppStackParamList } from '@/navigation/types';
import type { ThemeColors } from '@/design/theme';
import { useThemeColors } from '@/design/theme-context';

type ProjectSprintsProps = NativeStackScreenProps<AppStackParamList, 'ProjectSprints'>;
type Tone = 'blue' | 'emerald' | 'amber' | 'rose' | 'violet' | 'neutral';
type ProjectSprintsStyles = ReturnType<typeof createProjectSprintsStyles>;

const DAY_MS = 24 * 60 * 60 * 1000;
const KNOWN_SPRINT_STATUSES = ['planned', 'active', 'completed', 'cancelled'] as const;

type KnownSprintStatus = (typeof KNOWN_SPRINT_STATUSES)[number];

const SPRINT_STATUS_ORDER: Record<KnownSprintStatus, number> = {
  active: 0,
  planned: 1,
  completed: 2,
  cancelled: 3,
};

function useProjectSprintsTheme(): { colors: ThemeColors; styles: ProjectSprintsStyles } {
  const colors = useThemeColors();
  const styles = useMemo(() => createProjectSprintsStyles(colors), [colors]);
  return { colors, styles };
}

function isKnownSprintStatus(status: SprintStatus): status is KnownSprintStatus {
  return KNOWN_SPRINT_STATUSES.includes(status as KnownSprintStatus);
}

function sprintTone(status: SprintStatus): Tone {
  if (status === 'active') return 'emerald';
  if (status === 'completed') return 'neutral';
  if (status === 'cancelled') return 'rose';
  return 'blue';
}

function sprintStatusOrder(status: SprintStatus): number {
  return isKnownSprintStatus(status) ? SPRINT_STATUS_ORDER[status] : 4;
}

function padDatePart(value: number): string {
  return String(value).padStart(2, '0');
}

function dateInputValue(offsetDays = 0): string {
  const date = new Date();
  date.setDate(date.getDate() + offsetDays);
  return `${date.getFullYear()}-${padDatePart(date.getMonth() + 1)}-${padDatePart(date.getDate())}`;
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
  return date.toLocaleDateString(language, { day: 'numeric', month: 'short', year: 'numeric' });
}

function sprintDateRange(sprint: Sprint, language: string): string {
  const start = formatSprintDate(sprint.startDate, language);
  const end = formatSprintDate(sprint.endDate, language);
  if (start && end) return `${start} - ${end}`;
  return start || end;
}

function sprintProgress(sprint: Sprint): number {
  if (sprint.status === 'completed') return 100;
  if (sprint.status !== 'active' || !sprint.startDate || !sprint.endDate) return 0;
  const start = new Date(sprint.startDate).getTime();
  const end = new Date(sprint.endDate).getTime();
  if (Number.isNaN(start) || Number.isNaN(end) || end <= start) return 0;
  return Math.min(100, Math.max(0, ((Date.now() - start) / (end - start)) * 100));
}

function daysRemaining(sprint: Sprint): number | null {
  if (!sprint.endDate) return null;
  const end = new Date(sprint.endDate);
  if (Number.isNaN(end.getTime())) return null;
  return Math.max(0, Math.ceil((end.getTime() - Date.now()) / DAY_MS));
}

function SprintStatusBadge({ status }: { status: SprintStatus }) {
  const { t } = useTranslation();
  const label = isKnownSprintStatus(status) ? t(`sprints.status.${status}`) : status;
  return <SemanticBadge label={label} tone={sprintTone(status)} />;
}

function SummaryMetric({
  icon: Icon,
  label,
  tone,
  value,
}: {
  icon: LucideIcon;
  label: string;
  tone: Tone;
  value: number;
}) {
  const { styles } = useProjectSprintsTheme();

  return (
    <View style={styles.summaryMetric}>
      <IconTile icon={Icon} tone={tone} />
      <View style={styles.summaryCopy}>
        <Text style={styles.summaryValue}>{value}</Text>
        <Text style={styles.summaryLabel} numberOfLines={1}>
          {label}
        </Text>
      </View>
    </View>
  );
}

function SprintFact({ icon: Icon, label }: { icon: LucideIcon; label: string }) {
  const { colors, styles } = useProjectSprintsTheme();

  return (
    <View style={styles.fact}>
      <Icon size={14} color={colors.mutedForeground} />
      <Text style={styles.factText} numberOfLines={1}>
        {label}
      </Text>
    </View>
  );
}

function StatTile({
  label,
  tone = 'neutral',
  value,
}: {
  label: string;
  tone?: Tone;
  value: number;
}) {
  const { styles } = useProjectSprintsTheme();

  return (
    <View style={styles.statTile}>
      <Text style={styles.statValue}>{value}</Text>
      <SemanticBadge label={label} tone={tone} />
    </View>
  );
}

function SprintProgress({ progress }: { progress: number }) {
  const { t } = useTranslation();
  const { styles } = useProjectSprintsTheme();
  const rounded = Math.round(progress);
  const progressValue = t('sprints.progressPercent', { percent: rounded });

  return (
    <View style={styles.progressWrap}>
      <View style={styles.progressHeader}>
        <Text style={styles.progressLabel}>{t('sprints.progressTitle')}</Text>
        <Text style={styles.progressValue}>{progressValue}</Text>
      </View>
      <View style={styles.progressTrack}>
        <View style={[styles.progressFill, { width: `${rounded}%` }]} />
      </View>
    </View>
  );
}

function SprintCard({
  deletePending,
  language,
  onDelete,
  onOpen,
  sprint,
}: {
  deletePending: boolean;
  language: string;
  onDelete: () => void;
  onOpen: () => void;
  sprint: Sprint;
}) {
  const { t } = useTranslation();
  const { colors, styles } = useProjectSprintsTheme();
  const issueCount = sprint.issueCount ?? 0;
  const completedCount = sprint.completedCount ?? sprint.completedIssuesCount ?? 0;
  const inProgressCount = sprint.inProgressCount ?? 0;
  const todoCount = sprint.todoCount ?? Math.max(0, issueCount - completedCount - inProgressCount);
  const progress = sprintProgress(sprint);
  const dateRange = sprintDateRange(sprint, language);
  const remaining = sprint.status === 'active' ? daysRemaining(sprint) : null;

  return (
    <View style={styles.cardWrap}>
      <SurfaceRow className="gap-4">
        <Pressable
          accessibilityRole="button"
          onPress={onOpen}
          style={styles.cardPressTarget}
          className="active:opacity-80"
        >
          <View style={styles.cardHeader}>
            <View style={styles.titleWrap}>
              <Text style={styles.sprintName} numberOfLines={2}>
                {sprint.name}
              </Text>
              <SprintStatusBadge status={sprint.status} />
            </View>
            <ArrowRight size={18} color={colors.mutedForeground} />
          </View>

          {sprint.goal ? (
            <View style={styles.goalRow}>
              <Target size={14} color={colors.mutedForeground} />
              <Text style={styles.goalText} numberOfLines={2}>
                {sprint.goal}
              </Text>
            </View>
          ) : null}

          <View style={styles.factRow}>
            {dateRange ? <SprintFact icon={Calendar} label={dateRange} /> : null}
            <SprintFact icon={Timer} label={t('issues.count', { count: issueCount })} />
            {remaining !== null ? (
              <SprintFact
                icon={Timer}
                label={
                  remaining > 0
                    ? t('sprints.daysRemaining', { count: remaining })
                    : t('sprints.ended')
                }
              />
            ) : null}
          </View>

          {sprint.status === 'active' || sprint.status === 'completed' ? (
            <SprintProgress progress={progress} />
          ) : null}
        </Pressable>

        <View style={styles.statGrid}>
          <StatTile label={t('sprints.statsTotal')} value={issueCount} tone="blue" />
          <StatTile label={t('sprints.statsCompleted')} value={completedCount} tone="emerald" />
          <StatTile label={t('sprints.statsInProgress')} value={inProgressCount} tone="violet" />
          <StatTile label={t('sprints.statsTodo')} value={todoCount} />
        </View>

        <View style={styles.cardActions}>
          <Button
            title={t('sprints.open')}
            icon={ArrowRight}
            variant="secondary"
            onPress={onOpen}
            style={styles.cardActionButton}
          />
          <Button
            title={t('sprints.delete')}
            icon={Trash2}
            variant="destructive"
            loading={deletePending}
            disabled={deletePending}
            onPress={onDelete}
            style={styles.cardActionButton}
          />
        </View>
      </SurfaceRow>
    </View>
  );
}

export function ProjectSprintsScreen({ navigation, route }: ProjectSprintsProps) {
  const { i18n, t } = useTranslation();
  const { styles } = useProjectSprintsTheme();
  const { projectId } = route.params;
  const { data: projects } = useProjects();
  const projectFromList = (projects ?? []).find((project) => project.id === projectId);
  const projectQ = useProject(projectId);
  const sprintsQ = useSprints(projectId);
  const createSprint = useCreateSprint(projectId);
  const deleteSprint = useDeleteSprint(projectId);
  const [formOpen, setFormOpen] = useState(false);
  const [name, setName] = useState('');
  const [goal, setGoal] = useState('');
  const [startDate, setStartDate] = useState(dateInputValue);
  const [endDate, setEndDate] = useState(() => dateInputValue(14));
  const [formError, setFormError] = useState<string | null>(null);

  const project = projectQ.data ?? projectFromList;
  const orderedSprints = useMemo(
    () =>
      [...(sprintsQ.data ?? [])].sort((left, right) => {
        const statusDiff = sprintStatusOrder(left.status) - sprintStatusOrder(right.status);
        if (statusDiff !== 0) return statusDiff;
        const leftTime = new Date(left.startDate ?? left.createdAt ?? 0).getTime();
        const rightTime = new Date(right.startDate ?? right.createdAt ?? 0).getTime();
        return rightTime - leftTime;
      }),
    [sprintsQ.data],
  );
  const activeCount = orderedSprints.filter((sprint) => sprint.status === 'active').length;
  const plannedCount = orderedSprints.filter((sprint) => sprint.status === 'planned').length;
  const completedCount = orderedSprints.filter((sprint) => sprint.status === 'completed').length;
  const createBusy = createSprint.isPending;

  const resetForm = () => {
    setName('');
    setGoal('');
    setStartDate(dateInputValue());
    setEndDate(dateInputValue(14));
    setFormError(null);
  };

  const submitSprint = async () => {
    setFormError(null);
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
      navigation.navigate('SprintDetail', { projectId, sprintId: sprint.id });
    } catch {
      setFormError(t('sprints.errors.createFailed'));
    }
  };

  const deleteSprintById = async (sprint: Sprint) => {
    try {
      await deleteSprint.mutateAsync(sprint.id);
    } catch (error) {
      Alert.alert(
        t('sprints.deleteFailed'),
        error instanceof Error ? error.message : t('sprints.deleteFailedDescription'),
      );
    }
  };

  const confirmDeleteSprint = (sprint: Sprint) => {
    Alert.alert(t('sprints.deleteTitle'), t('sprints.deleteMessage', { name: sprint.name }), [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('sprints.delete'),
        style: 'destructive',
        onPress: () => {
          void deleteSprintById(sprint);
        },
      },
    ]);
  };

  if (sprintsQ.isLoading) return <Loading label={t('sprints.loading')} />;

  if (sprintsQ.isError) {
    return (
      <Screen>
        <ErrorView
          message={
            sprintsQ.error instanceof Error ? sprintsQ.error.message : t('sprints.loadFailed')
          }
          onRetry={() => void sprintsQ.refetch()}
        />
      </Screen>
    );
  }

  const renderItem: ListRenderItem<Sprint> = ({ item }) => (
    <SprintCard
      sprint={item}
      language={i18n.language}
      deletePending={deleteSprint.isPending}
      onOpen={() => navigation.navigate('SprintDetail', { projectId, sprintId: item.id })}
      onDelete={() => confirmDeleteSprint(item)}
    />
  );

  const header = (
    <View>
      <ScreenHeader
        kicker={project?.key ?? t('projects.title')}
        title={t('sprints.title')}
        subtitle={project?.name ?? t('sprints.subtitle')}
        meta={
          <SemanticBadge label={t('issues.count', { count: orderedSprints.length })} tone="blue" />
        }
      />

      <View style={styles.summary}>
        <SummaryMetric
          icon={Timer}
          label={t('sprints.statsTotal')}
          tone="blue"
          value={orderedSprints.length}
        />
        <SummaryMetric
          icon={Timer}
          label={t('sprints.status.active')}
          tone="emerald"
          value={activeCount}
        />
        <SummaryMetric
          icon={Timer}
          label={t('sprints.status.planned')}
          tone="violet"
          value={plannedCount}
        />
        <SummaryMetric
          icon={CheckCircle2}
          label={t('sprints.status.completed')}
          tone="neutral"
          value={completedCount}
        />
      </View>

      <View style={styles.headerActions}>
        <Button
          title={formOpen ? t('common.cancel') : t('sprints.new')}
          icon={formOpen ? X : Plus}
          variant={formOpen ? 'secondary' : 'primary'}
          disabled={createBusy}
          onPress={() => {
            setFormError(null);
            if (formOpen) resetForm();
            setFormOpen((open) => !open);
          }}
          style={styles.headerButton}
        />
      </View>

      {formOpen ? (
        <View style={styles.formWrap}>
          <SurfaceRow className="gap-3">
            <View style={styles.formHeader}>
              <IconTile icon={Plus} tone="cyan" />
              <View style={styles.formCopy}>
                <Text style={styles.formTitle}>{t('sprints.new')}</Text>
                <Text style={styles.formSubtitle}>{t('sprints.subtitle')}</Text>
              </View>
            </View>

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
            <View style={styles.dateFields}>
              <View style={styles.dateField}>
                <TextField
                  label={t('sprints.startDateLabel')}
                  value={startDate}
                  onChangeText={setStartDate}
                  placeholder={t('sprints.datePlaceholder')}
                  keyboardType="numbers-and-punctuation"
                  autoCapitalize="none"
                />
              </View>
              <View style={styles.dateField}>
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
            {formError ? <Text style={styles.errorText}>{formError}</Text> : null}
            <View style={styles.formActions}>
              <Button
                title={t('sprints.createButton')}
                icon={Plus}
                loading={createBusy}
                onPress={() => void submitSprint()}
                style={styles.formActionButton}
              />
              <Button
                title={t('common.cancel')}
                icon={X}
                variant="secondary"
                disabled={createBusy}
                onPress={() => {
                  resetForm();
                  setFormOpen(false);
                }}
                style={styles.formActionButton}
              />
            </View>
          </SurfaceRow>
        </View>
      ) : null}
    </View>
  );

  return (
    <Screen>
      <FlatList
        data={orderedSprints}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        ListHeaderComponent={header}
        ListEmptyComponent={
          <View style={styles.emptyWrap}>
            <EmptyState
              icon={Timer}
              title={t('sprints.empty')}
              description={t('sprints.subtitle')}
            />
          </View>
        }
        ItemSeparatorComponent={() => <View style={styles.separator} />}
        contentContainerStyle={styles.listContent}
        refreshControl={
          <RefreshControl
            refreshing={sprintsQ.isRefetching || projectQ.isRefetching}
            onRefresh={() => {
              void sprintsQ.refetch();
              void projectQ.refetch();
            }}
          />
        }
      />
    </Screen>
  );
}

function createProjectSprintsStyles(colors: ThemeColors) {
  return StyleSheet.create({
    listContent: {
      paddingBottom: 32,
    },
    summary: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 8,
      paddingHorizontal: 16,
      paddingVertical: 8,
    },
    summaryMetric: {
      minWidth: 150,
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
      borderRadius: 8,
      backgroundColor: colors.card,
      padding: 12,
    },
    summaryCopy: {
      minWidth: 0,
      flex: 1,
    },
    summaryValue: {
      color: colors.foreground,
      fontSize: 20,
      fontWeight: '700',
      lineHeight: 26,
    },
    summaryLabel: {
      color: colors.mutedForeground,
      fontSize: 12,
      lineHeight: 16,
    },
    headerActions: {
      paddingHorizontal: 16,
      paddingVertical: 8,
    },
    headerButton: {
      alignSelf: 'stretch',
    },
    formWrap: {
      paddingHorizontal: 16,
      paddingVertical: 8,
    },
    formHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
    },
    formCopy: {
      flex: 1,
      minWidth: 0,
    },
    formTitle: {
      color: colors.foreground,
      fontSize: 16,
      fontWeight: '700',
    },
    formSubtitle: {
      color: colors.mutedForeground,
      fontSize: 13,
      lineHeight: 18,
    },
    dateFields: {
      flexDirection: 'row',
      gap: 10,
    },
    dateField: {
      minWidth: 120,
      flex: 1,
    },
    formActions: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 8,
    },
    formActionButton: {
      minWidth: 140,
      flex: 1,
    },
    errorText: {
      color: colors.destructive,
      fontSize: 13,
      lineHeight: 18,
    },
    cardWrap: {
      paddingHorizontal: 16,
    },
    cardPressTarget: {
      gap: 12,
    },
    cardHeader: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      justifyContent: 'space-between',
      gap: 12,
    },
    titleWrap: {
      flex: 1,
      minWidth: 0,
      gap: 8,
    },
    sprintName: {
      color: colors.foreground,
      fontSize: 17,
      fontWeight: '700',
      lineHeight: 23,
    },
    goalRow: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: 8,
    },
    goalText: {
      flex: 1,
      color: colors.mutedForeground,
      fontSize: 14,
      lineHeight: 20,
    },
    factRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 8,
    },
    fact: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
      borderRadius: 6,
      backgroundColor: colors.surface,
      paddingHorizontal: 9,
      paddingVertical: 6,
    },
    factText: {
      maxWidth: 210,
      color: colors.mutedForeground,
      fontSize: 12,
      lineHeight: 16,
    },
    progressWrap: {
      gap: 6,
    },
    progressHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 8,
    },
    progressLabel: {
      color: colors.mutedForeground,
      fontSize: 12,
      lineHeight: 16,
    },
    progressValue: {
      color: colors.foreground,
      fontSize: 12,
      fontWeight: '700',
      lineHeight: 16,
    },
    progressTrack: {
      height: 6,
      overflow: 'hidden',
      borderRadius: 4,
      backgroundColor: colors.muted,
    },
    progressFill: {
      height: 6,
      borderRadius: 4,
      backgroundColor: colors.primary,
    },
    statGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 8,
    },
    statTile: {
      minWidth: 110,
      flex: 1,
      gap: 8,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
      borderRadius: 8,
      backgroundColor: colors.surface,
      padding: 10,
    },
    statValue: {
      color: colors.foreground,
      fontSize: 18,
      fontWeight: '700',
    },
    cardActions: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 8,
    },
    cardActionButton: {
      minWidth: 132,
      flex: 1,
    },
    separator: {
      height: 12,
    },
    emptyWrap: {
      minHeight: 260,
      paddingHorizontal: 16,
    },
  });
}
