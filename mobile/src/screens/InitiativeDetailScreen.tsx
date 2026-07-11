import { useMemo, useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from '@/components/native';
import { useNavigation, type NavigationProp } from '@react-navigation/native';
import {
  AlertCircle,
  Calendar,
  ChevronRight,
  FolderKanban,
  Layers3,
  Send,
  Target,
  TrendingUp,
  type LucideIcon,
} from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';

import type { Initiative, InitiativeUpdate } from '@/api/types';
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
import type { ThemeColors } from '@/design/theme';
import { useThemeColors } from '@/design/theme-context';
import {
  useCreateInitiativeUpdate,
  useInitiative,
  useInitiativeRollup,
  useInitiativeUpdates,
} from '@/hooks/queries';
import { relativeTime } from '@/lib/format';
import type { AppStackParamList } from '@/navigation/types';

type InitiativeDetailProps = NativeStackScreenProps<AppStackParamList, 'InitiativeDetail'>;
type UpdateStatus = 'green' | 'yellow' | 'red';
type InitiativeDetailStyles = ReturnType<typeof createInitiativeDetailStyles>;

const UPDATE_STATUSES = ['green', 'yellow', 'red'] as const;
const INITIATIVE_STATUSES = ['planned', 'active', 'paused', 'complete', 'cancelled'] as const;

function useInitiativeDetailTheme(): {
  colors: ThemeColors;
  styles: InitiativeDetailStyles;
} {
  const colors = useThemeColors();
  const styles = useMemo(() => createInitiativeDetailStyles(colors), [colors]);

  return { colors, styles };
}

function formatDate(value: string | null | undefined, language: string): string {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString(language, { day: 'numeric', month: 'short', year: 'numeric' });
}

function statusTone(status: string): 'blue' | 'emerald' | 'amber' | 'rose' | 'neutral' {
  if (status === 'active') return 'emerald';
  if (status === 'paused') return 'amber';
  if (status === 'complete') return 'blue';
  if (status === 'cancelled') return 'rose';
  return 'neutral';
}

function updateTone(status: string): 'emerald' | 'amber' | 'rose' | 'neutral' {
  if (status === 'green') return 'emerald';
  if (status === 'yellow') return 'amber';
  if (status === 'red') return 'rose';
  return 'neutral';
}

function initiativeStatusLabel(status: string, t: ReturnType<typeof useTranslation>['t']): string {
  if (INITIATIVE_STATUSES.includes(status as (typeof INITIATIVE_STATUSES)[number])) {
    return t(`initiatives.status.${status}`);
  }
  return status;
}

function updateStatusLabel(status: string, t: ReturnType<typeof useTranslation>['t']): string {
  if (UPDATE_STATUSES.includes(status as UpdateStatus)) {
    return t(`initiatives.updateStatus.${status}`);
  }
  return status;
}

function ProgressBar({ percent }: { percent: number }) {
  const { styles } = useInitiativeDetailTheme();
  const width = `${Math.max(0, Math.min(100, percent))}%` as `${number}%`;

  return (
    <View style={styles.progressTrack}>
      <View style={[styles.progressFill, { width }]} />
    </View>
  );
}

function StatTile({ label, value }: { label: string; value: string | number }) {
  const { styles } = useInitiativeDetailTheme();

  return (
    <View style={styles.statTile}>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel} numberOfLines={2}>
        {label}
      </Text>
    </View>
  );
}

function UpdateStatusPill({
  status,
  selected,
  disabled,
  onPress,
}: {
  status: UpdateStatus;
  selected: boolean;
  disabled?: boolean;
  onPress: (status: UpdateStatus) => void;
}) {
  const { t } = useTranslation();
  const { styles } = useInitiativeDetailTheme();

  return (
    <Pressable
      accessibilityRole="button"
      disabled={disabled}
      onPress={() => onPress(status)}
      style={[
        styles.updateStatusPill,
        selected ? styles.updateStatusPillActive : null,
        disabled ? styles.disabled : null,
      ]}
      className="active:opacity-80"
    >
      <Text
        style={[styles.updateStatusPillText, selected ? styles.updateStatusPillTextActive : null]}
      >
        {t(`initiatives.updateStatus.${status}`)}
      </Text>
    </Pressable>
  );
}

function SectionTitle({
  icon: Icon,
  title,
  meta,
}: {
  icon: LucideIcon;
  title: string;
  meta?: string;
}) {
  const { colors, styles } = useInitiativeDetailTheme();

  return (
    <View style={styles.sectionTitle}>
      <View style={styles.sectionTitleLeft}>
        <Icon size={16} color={colors.foreground} />
        <Text className="text-foreground text-base font-semibold">{title}</Text>
      </View>
      {meta ? <SemanticBadge label={meta} /> : null}
    </View>
  );
}

function ChildInitiativeRow({ child }: { child: Initiative }) {
  const { t } = useTranslation();
  const { colors, styles } = useInitiativeDetailTheme();
  const navigation = useNavigation<NavigationProp<AppStackParamList>>();

  return (
    <Pressable
      accessibilityRole="button"
      onPress={() => navigation.navigate('InitiativeDetail', { id: child.id })}
      style={styles.linkedRow}
      className="active:opacity-80"
    >
      <Target size={16} color={colors.mutedForeground} />
      <View className="min-w-0 flex-1">
        <Text className="text-foreground text-sm font-semibold" numberOfLines={1}>
          {child.name}
        </Text>
        <Text style={styles.mutedSmall} numberOfLines={1}>
          {initiativeStatusLabel(child.status, t)}
        </Text>
      </View>
      <ChevronRight size={16} color={colors.mutedForeground} />
    </Pressable>
  );
}

function UpdateCard({ update }: { update: InitiativeUpdate }) {
  const { t } = useTranslation();
  const { colors, styles } = useInitiativeDetailTheme();
  const time = relativeTime(update.createdAt ?? update.weekOf);
  const author = update.authorName ?? t('initiatives.unknownAuthor');

  return (
    <View style={styles.updateCard}>
      <View style={styles.updateHeader}>
        <SemanticBadge
          label={updateStatusLabel(update.status, t)}
          tone={updateTone(update.status)}
        />
        <Text style={styles.updateMeta} numberOfLines={1}>
          {time ? t('initiatives.updateMeta', { author, time }) : author}
        </Text>
      </View>
      <Text className="text-foreground text-sm">{update.summary}</Text>
      {update.blockers ? (
        <View style={styles.updateDetail}>
          <AlertCircle size={14} color={colors.accentAmber} />
          <Text style={styles.updateDetailText}>{update.blockers}</Text>
        </View>
      ) : null}
      {update.nextSteps ? (
        <View style={styles.updateDetail}>
          <TrendingUp size={14} color={colors.primary} />
          <Text style={styles.updateDetailText}>{update.nextSteps}</Text>
        </View>
      ) : null}
    </View>
  );
}

export function InitiativeDetailScreen({ route }: InitiativeDetailProps) {
  const { t, i18n } = useTranslation();
  const { colors, styles } = useInitiativeDetailTheme();
  const { id } = route.params;
  const detailQ = useInitiative(id);
  const rollupQ = useInitiativeRollup(id);
  const updatesQ = useInitiativeUpdates(id);
  const createUpdate = useCreateInitiativeUpdate(id);

  const [status, setStatus] = useState<UpdateStatus>('green');
  const [summary, setSummary] = useState('');
  const [blockers, setBlockers] = useState('');
  const [nextSteps, setNextSteps] = useState('');
  const [summaryError, setSummaryError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);

  const detail = detailQ.data;
  const rollup = rollupQ.data;
  const updates = useMemo(() => updatesQ.data ?? [], [updatesQ.data]);
  const isRefreshing = detailQ.isRefetching || rollupQ.isRefetching || updatesQ.isRefetching;

  const refresh = () => {
    void detailQ.refetch();
    void rollupQ.refetch();
    void updatesQ.refetch();
  };

  const onPostUpdate = async (): Promise<void> => {
    setSummaryError(null);
    setFormError(null);
    const trimmedSummary = summary.trim();
    const trimmedBlockers = blockers.trim();
    const trimmedNextSteps = nextSteps.trim();
    if (!trimmedSummary) {
      setSummaryError(t('initiatives.summaryRequired'));
      return;
    }

    try {
      await createUpdate.mutateAsync({
        status,
        summary: trimmedSummary,
        ...(trimmedBlockers ? { blockers: trimmedBlockers } : {}),
        ...(trimmedNextSteps ? { nextSteps: trimmedNextSteps } : {}),
      });
      setStatus('green');
      setSummary('');
      setBlockers('');
      setNextSteps('');
    } catch (err: unknown) {
      setFormError(err instanceof Error ? err.message : t('initiatives.postUpdateFailed'));
    }
  };

  if (detailQ.isLoading) return <Loading />;
  if (detailQ.isError || !detail) {
    return (
      <Screen>
        <ErrorView
          message={
            detailQ.error instanceof Error ? detailQ.error.message : t('initiatives.loadFailed')
          }
          onRetry={refresh}
        />
      </Screen>
    );
  }

  const initiative = detail.initiative;
  const targetDate = formatDate(initiative.targetDate, i18n.language);

  return (
    <Screen>
      <KeyboardAvoidingView
        className="flex-1"
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          className="flex-1"
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
          refreshControl={<RefreshControl refreshing={isRefreshing} onRefresh={refresh} />}
        >
          <ScreenHeader
            kicker={t('initiatives.detailKicker')}
            title={initiative.name}
            subtitle={initiative.description ?? t('initiatives.noDescription')}
            meta={
              <SemanticBadge
                label={initiativeStatusLabel(initiative.status, t)}
                tone={statusTone(initiative.status)}
              />
            }
          />

          <View style={styles.card}>
            <SectionTitle icon={TrendingUp} title={t('initiatives.rollup')} />
            <View style={styles.progressBlock}>
              <ProgressBar percent={rollup?.percent ?? 0} />
              <Text style={styles.progressPercent}>
                {t('initiatives.percent', { percent: rollup?.percent ?? 0 })}
              </Text>
            </View>
            <View style={styles.statsGrid}>
              <StatTile label={t('initiatives.done')} value={rollup?.done ?? 0} />
              <StatTile label={t('initiatives.total')} value={rollup?.total ?? 0} />
              <StatTile label={t('initiatives.projects')} value={rollup?.projectCount ?? 0} />
            </View>
            <Text style={styles.cardHint}>
              {rollup
                ? t('initiatives.rollupSummary', {
                    done: rollup.done,
                    total: rollup.total,
                    count: rollup.projectCount,
                  })
                : t('initiatives.noRollupData')}
            </Text>
            {targetDate ? (
              <View style={styles.targetDateRow}>
                <Calendar size={15} color={colors.accentAmber} />
                <Text style={styles.targetDateText}>{targetDate}</Text>
              </View>
            ) : null}
          </View>

          <View style={styles.card}>
            <SectionTitle
              icon={FolderKanban}
              title={t('initiatives.linkedProjects')}
              meta={t('initiatives.projectCount', { count: detail.projects.length })}
            />
            {detail.projects.length === 0 ? (
              <Text style={styles.emptyInline}>{t('initiatives.noProjects')}</Text>
            ) : (
              detail.projects.map((project) => {
                const stats = rollup?.perProject?.find(
                  (item) => item.projectId === project.projectId,
                );
                return (
                  <View key={project.projectId} style={styles.linkedRow}>
                    <FolderKanban size={16} color={colors.mutedForeground} />
                    <View className="min-w-0 flex-1">
                      <Text className="text-foreground text-sm font-semibold" numberOfLines={1}>
                        {project.projectName ?? project.projectId}
                      </Text>
                      <Text style={styles.mutedSmall} numberOfLines={1}>
                        {project.projectKey ?? t('common.none')}
                      </Text>
                    </View>
                    <Text style={styles.projectProgress}>
                      {stats
                        ? t('initiatives.doneOfTotal', { done: stats.done, total: stats.total })
                        : t('common.none')}
                    </Text>
                  </View>
                );
              })
            )}
          </View>

          <View style={styles.card}>
            <SectionTitle
              icon={Layers3}
              title={t('initiatives.subInitiatives')}
              meta={t('initiatives.childCount', { count: detail.children.length })}
            />
            {detail.children.length === 0 ? (
              <Text style={styles.emptyInline}>{t('initiatives.noSubInitiatives')}</Text>
            ) : (
              detail.children.map((child) => <ChildInitiativeRow key={child.id} child={child} />)
            )}
          </View>

          <View style={styles.card}>
            <SectionTitle icon={Send} title={t('initiatives.postUpdate')} />
            <View style={styles.updateStatusList}>
              {UPDATE_STATUSES.map((item) => (
                <UpdateStatusPill
                  key={item}
                  status={item}
                  selected={status === item}
                  disabled={createUpdate.isPending}
                  onPress={setStatus}
                />
              ))}
            </View>
            <TextField
              label={t('initiatives.summaryLabel')}
              placeholder={t('initiatives.summaryPlaceholder')}
              value={summary}
              onChangeText={(value) => {
                setSummary(value);
                if (summaryError) setSummaryError(null);
              }}
              editable={!createUpdate.isPending}
              multiline
              className="min-h-12"
              error={summaryError ?? undefined}
            />
            <TextField
              label={t('initiatives.blockersLabel')}
              placeholder={t('initiatives.blockersPlaceholder')}
              value={blockers}
              onChangeText={setBlockers}
              editable={!createUpdate.isPending}
            />
            <TextField
              label={t('initiatives.nextStepsLabel')}
              placeholder={t('initiatives.nextStepsPlaceholder')}
              value={nextSteps}
              onChangeText={setNextSteps}
              editable={!createUpdate.isPending}
            />
            {formError ? <Text style={styles.formError}>{formError}</Text> : null}
            <Button
              title={t('initiatives.postUpdateButton')}
              icon={Send}
              loading={createUpdate.isPending}
              disabled={createUpdate.isPending}
              onPress={onPostUpdate}
            />
          </View>

          <View style={styles.card}>
            <SectionTitle
              icon={Target}
              title={t('initiatives.updates')}
              meta={t('initiatives.updateCount', { count: updates.length })}
            />
            {updatesQ.isLoading ? (
              <Text style={styles.emptyInline}>{t('common.loading')}</Text>
            ) : updates.length === 0 ? (
              <EmptyState
                icon={Target}
                title={t('initiatives.noUpdates')}
                description={t('initiatives.noUpdatesDesc')}
              />
            ) : (
              updates.map((update) => <UpdateCard key={update.id} update={update} />)
            )}
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </Screen>
  );
}

function createInitiativeDetailStyles(colors: ThemeColors) {
  return StyleSheet.create({
    content: {
      gap: 14,
      paddingBottom: 24,
    },
    card: {
      gap: 12,
      marginHorizontal: 16,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
      borderRadius: 6,
      backgroundColor: colors.card,
      padding: 14,
    },
    sectionTitle: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 12,
    },
    sectionTitleLeft: {
      minWidth: 0,
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
    },
    progressBlock: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
    },
    progressTrack: {
      flex: 1,
      height: 10,
      overflow: 'hidden',
      borderRadius: 999,
      backgroundColor: colors.surface2,
    },
    progressFill: {
      height: '100%',
      borderRadius: 999,
      backgroundColor: colors.primary,
    },
    progressPercent: {
      width: 54,
      color: colors.foreground,
      fontSize: 13,
      fontVariant: ['tabular-nums'],
      fontWeight: '700',
      lineHeight: 18,
      textAlign: 'right',
    },
    statsGrid: {
      flexDirection: 'row',
      gap: 10,
    },
    statTile: {
      flex: 1,
      gap: 2,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
      borderRadius: 6,
      backgroundColor: colors.surface,
      paddingHorizontal: 10,
      paddingVertical: 9,
    },
    statValue: {
      color: colors.foreground,
      fontSize: 18,
      fontWeight: '700',
      lineHeight: 24,
    },
    statLabel: {
      color: colors.mutedForeground,
      fontSize: 11,
      lineHeight: 15,
    },
    cardHint: {
      color: colors.mutedForeground,
      fontSize: 12,
      lineHeight: 17,
    },
    targetDateRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
    },
    targetDateText: {
      color: colors.foreground,
      fontSize: 13,
      lineHeight: 18,
    },
    linkedRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
      borderRadius: 6,
      backgroundColor: colors.surface,
      padding: 10,
    },
    mutedSmall: {
      color: colors.mutedForeground,
      fontSize: 12,
      lineHeight: 16,
    },
    projectProgress: {
      color: colors.mutedForeground,
      fontSize: 12,
      fontVariant: ['tabular-nums'],
      lineHeight: 16,
    },
    emptyInline: {
      color: colors.mutedForeground,
      fontSize: 13,
      lineHeight: 18,
    },
    updateStatusList: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 8,
    },
    updateStatusPill: {
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
      borderRadius: 4,
      backgroundColor: colors.card,
      paddingHorizontal: 10,
      paddingVertical: 8,
    },
    updateStatusPillActive: {
      borderColor: colors.primary,
      backgroundColor: colors.primary,
    },
    updateStatusPillText: {
      color: colors.mutedForeground,
      fontSize: 12,
      fontWeight: '600',
      lineHeight: 16,
    },
    updateStatusPillTextActive: {
      color: colors.primaryForeground,
    },
    formError: {
      color: colors.destructive,
      fontSize: 13,
      lineHeight: 18,
    },
    updateCard: {
      gap: 9,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
      borderRadius: 6,
      backgroundColor: colors.surface,
      padding: 12,
    },
    updateHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 10,
    },
    updateMeta: {
      minWidth: 0,
      flex: 1,
      color: colors.mutedForeground,
      fontSize: 12,
      lineHeight: 16,
      textAlign: 'right',
    },
    updateDetail: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: 7,
    },
    updateDetailText: {
      minWidth: 0,
      flex: 1,
      color: colors.mutedForeground,
      fontSize: 13,
      lineHeight: 18,
    },
    disabled: {
      opacity: 0.5,
    },
  });
}
