import { useEffect, useMemo, useState } from 'react';
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from '@/components/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import {
  ArrowRight,
  CheckCircle2,
  RotateCcw,
  Trash2,
  Workflow,
  XCircle,
} from 'lucide-react-native';
import { useTranslation } from 'react-i18next';

import type { WorkflowStatus, WorkflowTransition } from '@/api/types';
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
import type { ThemeColors } from '@/design/theme';
import { useThemeColors } from '@/design/theme-context';
import {
  useProject,
  useProjects,
  useProjectWorkflowTransitions,
  useUpdateProjectWorkflowTransitions,
} from '@/hooks/queries';
import type { AppStackParamList } from '@/navigation/types';

type ProjectWorkflowsProps = NativeStackScreenProps<AppStackParamList, 'ProjectWorkflows'>;
type Tone = 'blue' | 'emerald' | 'amber' | 'rose' | 'violet' | 'neutral';
type TransitionDraft = Pick<WorkflowTransition, 'id' | 'fromStatusId' | 'toStatusId'>;
type ProjectWorkflowsStyles = ReturnType<typeof createProjectWorkflowsStyles>;

const KNOWN_CATEGORIES = [
  'backlog',
  'todo',
  'in_progress',
  'in_review',
  'done',
  'blocked',
  'cancelled',
] as const;

function useProjectWorkflowsTheme(): { colors: ThemeColors; styles: ProjectWorkflowsStyles } {
  const colors = useThemeColors();
  const styles = useMemo(() => createProjectWorkflowsStyles(colors), [colors]);
  return { colors, styles };
}

function pairKey(fromStatusId: string, toStatusId: string): string {
  return `${fromStatusId}:${toStatusId}`;
}

function draftKey(transition: Pick<WorkflowTransition, 'fromStatusId' | 'toStatusId'>): string {
  return pairKey(transition.fromStatusId, transition.toStatusId);
}

function stablePairString(
  transitions: Array<Pick<WorkflowTransition, 'fromStatusId' | 'toStatusId'>>,
): string {
  return transitions.map(draftKey).sort().join('|');
}

function categoryTone(category: string): Tone {
  if (category === 'done') return 'emerald';
  if (category === 'blocked' || category === 'cancelled') return 'rose';
  if (category === 'in_progress' || category === 'in_review') return 'violet';
  if (category === 'backlog') return 'neutral';
  return 'blue';
}

function categoryColor(category: string, colors: ThemeColors): string {
  if (category === 'done') return colors.accentEmerald;
  if (category === 'blocked' || category === 'cancelled') return colors.accentRose;
  if (category === 'in_progress' || category === 'in_review') return colors.accentViolet;
  if (category === 'backlog') return colors.mutedForeground;
  return colors.accentBlue;
}

function statusDotColor(status: WorkflowStatus, colors: ThemeColors): string {
  if (status.color?.startsWith('#') || status.color?.startsWith('rgb')) return status.color;
  return categoryColor(status.category, colors);
}

function categoryLabel(category: string, t: ReturnType<typeof useTranslation>['t']): string {
  if (KNOWN_CATEGORIES.includes(category as (typeof KNOWN_CATEGORIES)[number])) {
    return t(`statusCategory.${category}`);
  }
  return category;
}

function StatusLabel({ status }: { status: WorkflowStatus }) {
  const { t } = useTranslation();
  const { colors, styles } = useProjectWorkflowsTheme();

  return (
    <View style={styles.statusLabel}>
      <View style={[styles.statusDot, { backgroundColor: statusDotColor(status, colors) }]} />
      <View style={styles.statusTextWrap}>
        <Text style={styles.statusName} numberOfLines={1}>
          {status.name}
        </Text>
        <SemanticBadge
          label={categoryLabel(status.category, t)}
          tone={categoryTone(status.category)}
        />
      </View>
    </View>
  );
}

function MatrixCell({
  allowed,
  disabled,
  fromStatus,
  onPress,
  selected,
  toStatus,
}: {
  allowed: boolean;
  disabled: boolean;
  fromStatus: WorkflowStatus;
  onPress: () => void;
  selected: boolean;
  toStatus: WorkflowStatus;
}) {
  const { t } = useTranslation();
  const { colors, styles } = useProjectWorkflowsTheme();
  const label = disabled
    ? t('settings.workflows.cellSelfLabel', { name: fromStatus.name })
    : t('settings.workflows.cellLabel', {
        from: fromStatus.name,
        to: toStatus.name,
        status: allowed
          ? t('settings.workflows.allowedTransition')
          : t('settings.workflows.notAllowed'),
      });

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled, selected: allowed }}
      disabled={disabled}
      onPress={onPress}
      style={[
        styles.matrixCell,
        allowed ? styles.matrixCellAllowed : null,
        selected ? styles.matrixCellSelected : null,
        disabled ? styles.matrixCellDisabled : null,
      ]}
      className="active:opacity-80"
    >
      {disabled ? (
        <Text style={styles.selfMark}>{t('settings.workflows.selfMark')}</Text>
      ) : allowed ? (
        <CheckCircle2 size={18} color={colors.success} />
      ) : (
        <XCircle size={18} color={colors.mutedForeground} />
      )}
    </Pressable>
  );
}

function SelectedTransitionCard({
  fromStatus,
  onRemove,
  toStatus,
}: {
  fromStatus: WorkflowStatus | undefined;
  onRemove: () => void;
  toStatus: WorkflowStatus | undefined;
}) {
  const { t } = useTranslation();
  const { colors, styles } = useProjectWorkflowsTheme();

  if (!fromStatus || !toStatus) {
    return (
      <SurfaceRow className="gap-2">
        <Text style={styles.sectionTitle}>{t('settings.workflows.transitionRule')}</Text>
        <Text style={styles.helperText}>{t('settings.workflows.noTransitionSelected')}</Text>
      </SurfaceRow>
    );
  }

  return (
    <SurfaceRow className="gap-3">
      <View style={styles.selectedHeader}>
        <View style={styles.selectedTitleWrap}>
          <IconTile icon={Workflow} tone="violet" />
          <View style={styles.selectedCopy}>
            <Text style={styles.sectionTitle}>{t('settings.workflows.transitionRule')}</Text>
            <Text style={styles.helperText}>{t('settings.workflows.transitionRuleSelected')}</Text>
          </View>
        </View>
        <Button
          title={t('settings.workflows.removeTransition')}
          icon={Trash2}
          variant="destructive"
          onPress={onRemove}
          style={styles.removeButton}
        />
      </View>

      <View style={styles.transitionPath}>
        <StatusLabel status={fromStatus} />
        <ArrowRight size={18} color={colors.mutedForeground} />
        <StatusLabel status={toStatus} />
      </View>
    </SurfaceRow>
  );
}

export function ProjectWorkflowsScreen({ route }: ProjectWorkflowsProps) {
  const { projectId } = route.params;
  const { t } = useTranslation();
  const { colors, styles } = useProjectWorkflowsTheme();
  const { data: projects } = useProjects();
  const projectFromList = (projects ?? []).find((project) => project.id === projectId);
  const projectQ = useProject(projectId);
  const workflowQ = useProjectWorkflowTransitions(projectId);
  const updateTransitions = useUpdateProjectWorkflowTransitions(projectId);
  const [draftTransitions, setDraftTransitions] = useState<TransitionDraft[]>([]);
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const project = projectQ.data ?? projectFromList;
  const statuses = useMemo(
    () =>
      [...(workflowQ.data?.statuses ?? [])].sort((a, b) => (a.position ?? 0) - (b.position ?? 0)),
    [workflowQ.data?.statuses],
  );
  const serverTransitions = useMemo(() => workflowQ.data?.transitions ?? [], [workflowQ.data]);
  const draftKeys = useMemo(() => new Set(draftTransitions.map(draftKey)), [draftTransitions]);
  const serverPairString = useMemo(() => stablePairString(serverTransitions), [serverTransitions]);
  const draftPairString = useMemo(() => stablePairString(draftTransitions), [draftTransitions]);
  const hasChanges = draftPairString !== serverPairString;
  const selectedTransition = selectedKey
    ? draftTransitions.find((transition) => draftKey(transition) === selectedKey)
    : undefined;
  const selectedFromStatus = statuses.find(
    (status) => status.id === selectedTransition?.fromStatusId,
  );
  const selectedToStatus = statuses.find((status) => status.id === selectedTransition?.toStatusId);

  useEffect(() => {
    if (!workflowQ.data) return;
    setDraftTransitions(
      workflowQ.data.transitions.map((transition) => ({
        id: transition.id,
        fromStatusId: transition.fromStatusId,
        toStatusId: transition.toStatusId,
      })),
    );
    setSelectedKey(null);
    setActionError(null);
    setSaved(false);
  }, [workflowQ.data]);

  const toggleTransition = (fromStatusId: string, toStatusId: string) => {
    const key = pairKey(fromStatusId, toStatusId);
    const exists = draftKeys.has(key);
    setSaved(false);
    setActionError(null);

    if (exists) {
      if (selectedKey !== key) {
        setSelectedKey(key);
        return;
      }
      setSelectedKey(null);
      setDraftTransitions((current) =>
        current.filter((transition) => draftKey(transition) !== key),
      );
      return;
    }

    setSelectedKey(key);
    setDraftTransitions((current) => [
      ...current,
      {
        id: `draft_${fromStatusId}_${toStatusId}`,
        fromStatusId,
        toStatusId,
      },
    ]);
  };

  const removeSelectedTransition = () => {
    if (!selectedKey) return;
    setSaved(false);
    setActionError(null);
    setDraftTransitions((current) =>
      current.filter((transition) => draftKey(transition) !== selectedKey),
    );
    setSelectedKey(null);
  };

  const resetDraft = () => {
    setDraftTransitions(
      serverTransitions.map((transition) => ({
        id: transition.id,
        fromStatusId: transition.fromStatusId,
        toStatusId: transition.toStatusId,
      })),
    );
    setSelectedKey(null);
    setActionError(null);
    setSaved(false);
  };

  const saveTransitions = async () => {
    setActionError(null);
    setSaved(false);
    try {
      await updateTransitions.mutateAsync(
        draftTransitions.map((transition) => ({
          fromStatusId: transition.fromStatusId,
          toStatusId: transition.toStatusId,
        })),
      );
      setSaved(true);
    } catch (error) {
      setActionError(
        error instanceof Error ? error.message : t('settings.workflows.saveFailedDescription'),
      );
    }
  };

  if (workflowQ.isLoading) return <Loading label={t('settings.workflows.loading')} />;

  if (workflowQ.isError) {
    return (
      <Screen>
        <ErrorView
          message={
            workflowQ.error instanceof Error
              ? workflowQ.error.message
              : t('settings.workflows.loadFailed')
          }
          onRetry={() => void workflowQ.refetch()}
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
            refreshing={workflowQ.isRefetching || projectQ.isRefetching}
            onRefresh={() => {
              void workflowQ.refetch();
              void projectQ.refetch();
            }}
          />
        }
      >
        <ScreenHeader
          kicker={project?.key ?? t('projects.title')}
          title={t('settings.workflows.title')}
          subtitle={t('settings.workflows.subtitle')}
          meta={
            <SemanticBadge
              label={t('settings.workflows.statusCount', { count: statuses.length })}
              tone="violet"
            />
          }
        />

        {statuses.length === 0 ? (
          <View style={styles.emptyWrap}>
            <EmptyState
              icon={Workflow}
              title={t('settings.workflows.emptyTitle')}
              description={t('settings.workflows.emptyDescription')}
            />
          </View>
        ) : (
          <>
            <SurfaceRow className="gap-3">
              <View style={styles.sectionHeader}>
                <IconTile icon={Workflow} tone="violet" />
                <View style={styles.sectionCopy}>
                  <Text style={styles.sectionTitle}>
                    {t('settings.workflows.allowedTransitions')}
                  </Text>
                  <Text style={styles.helperText}>{t('settings.workflows.matrixHelp')}</Text>
                </View>
              </View>

              <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                <View style={styles.matrix}>
                  <View style={styles.matrixRow}>
                    <View style={styles.matrixCorner}>
                      <Text style={styles.matrixCornerText}>
                        {t('settings.workflows.fromToHeader')}
                      </Text>
                    </View>
                    {statuses.map((toStatus) => (
                      <View key={toStatus.id} style={styles.matrixHeaderCell}>
                        <StatusLabel status={toStatus} />
                      </View>
                    ))}
                  </View>

                  {statuses.map((fromStatus) => (
                    <View key={fromStatus.id} style={styles.matrixRow}>
                      <View style={styles.matrixRowHeader}>
                        <StatusLabel status={fromStatus} />
                      </View>
                      {statuses.map((toStatus) => {
                        const key = pairKey(fromStatus.id, toStatus.id);
                        const allowed = draftKeys.has(key);
                        return (
                          <MatrixCell
                            key={toStatus.id}
                            allowed={allowed}
                            disabled={fromStatus.id === toStatus.id}
                            fromStatus={fromStatus}
                            selected={selectedKey === key}
                            toStatus={toStatus}
                            onPress={() => toggleTransition(fromStatus.id, toStatus.id)}
                          />
                        );
                      })}
                    </View>
                  ))}
                </View>
              </ScrollView>

              <View style={styles.legend}>
                <View style={styles.legendItem}>
                  <CheckCircle2 size={15} color={colors.success} />
                  <Text style={styles.legendText}>{t('settings.workflows.legendAllowed')}</Text>
                </View>
                <View style={styles.legendItem}>
                  <XCircle size={15} color={colors.mutedForeground} />
                  <Text style={styles.legendText}>{t('settings.workflows.legendNotAllowed')}</Text>
                </View>
              </View>
            </SurfaceRow>

            <SelectedTransitionCard
              fromStatus={selectedFromStatus}
              toStatus={selectedToStatus}
              onRemove={removeSelectedTransition}
            />

            <SurfaceRow className="gap-3">
              <Text style={styles.sectionTitle}>{t('settings.workflows.statesTitle')}</Text>
              <View style={styles.statusList}>
                {statuses.map((status) => (
                  <View key={status.id} style={styles.statusRow}>
                    <StatusLabel status={status} />
                    <SemanticBadge
                      label={t('settings.workflows.transitionCount', {
                        count: draftTransitions.filter(
                          (transition) => transition.fromStatusId === status.id,
                        ).length,
                      })}
                      tone={categoryTone(status.category)}
                    />
                  </View>
                ))}
              </View>
            </SurfaceRow>
          </>
        )}

        {saved ? (
          <SurfaceRow className="flex-row items-center gap-2">
            <CheckCircle2 size={16} color={colors.success} />
            <Text style={styles.savedText}>{t('settings.workflows.savedDescription')}</Text>
          </SurfaceRow>
        ) : null}

        {actionError ? <Text style={styles.errorText}>{actionError}</Text> : null}
      </ScrollView>

      <View style={styles.footer}>
        <Button
          title={t('projects.reset')}
          icon={RotateCcw}
          variant="secondary"
          disabled={!hasChanges || updateTransitions.isPending}
          onPress={resetDraft}
        />
        <Button
          title={t('common.save')}
          icon={CheckCircle2}
          loading={updateTransitions.isPending}
          disabled={!hasChanges || updateTransitions.isPending || statuses.length === 0}
          onPress={() => void saveTransitions()}
        />
      </View>
    </Screen>
  );
}

function createProjectWorkflowsStyles(colors: ThemeColors) {
  return StyleSheet.create({
    content: {
      gap: 14,
      paddingBottom: 100,
    },
    emptyWrap: {
      minHeight: 280,
      paddingHorizontal: 16,
    },
    sectionHeader: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: 12,
    },
    sectionCopy: {
      flex: 1,
      minWidth: 0,
      gap: 3,
    },
    sectionTitle: {
      color: colors.foreground,
      fontSize: 15,
      fontWeight: '700',
      lineHeight: 21,
    },
    helperText: {
      color: colors.mutedForeground,
      fontSize: 13,
      lineHeight: 18,
    },
    matrix: {
      gap: 0,
      paddingVertical: 4,
    },
    matrixRow: {
      flexDirection: 'row',
    },
    matrixCorner: {
      width: 132,
      minHeight: 66,
      justifyContent: 'center',
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
      backgroundColor: colors.surface,
      padding: 8,
    },
    matrixCornerText: {
      color: colors.mutedForeground,
      fontSize: 12,
      fontWeight: '700',
      lineHeight: 16,
    },
    matrixHeaderCell: {
      width: 124,
      minHeight: 66,
      justifyContent: 'center',
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
      backgroundColor: colors.surface,
      padding: 8,
    },
    matrixRowHeader: {
      width: 132,
      minHeight: 58,
      justifyContent: 'center',
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
      backgroundColor: colors.surface,
      padding: 8,
    },
    matrixCell: {
      width: 124,
      minHeight: 58,
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
      backgroundColor: colors.card,
    },
    matrixCellAllowed: {
      backgroundColor: `${colors.success}18`,
    },
    matrixCellSelected: {
      borderColor: colors.primary,
      backgroundColor: `${colors.primary}1F`,
    },
    matrixCellDisabled: {
      backgroundColor: colors.muted,
    },
    selfMark: {
      color: colors.mutedForeground,
      fontSize: 16,
      fontWeight: '700',
    },
    statusLabel: {
      minWidth: 0,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
    },
    statusDot: {
      width: 9,
      height: 9,
      borderRadius: 999,
    },
    statusTextWrap: {
      minWidth: 0,
      flex: 1,
      gap: 5,
    },
    statusName: {
      color: colors.foreground,
      fontSize: 13,
      fontWeight: '700',
      lineHeight: 17,
    },
    legend: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 12,
    },
    legendItem: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
    },
    legendText: {
      color: colors.mutedForeground,
      fontSize: 12,
      lineHeight: 16,
    },
    selectedHeader: {
      gap: 12,
    },
    selectedTitleWrap: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
    },
    selectedCopy: {
      flex: 1,
      minWidth: 0,
    },
    removeButton: {
      alignSelf: 'stretch',
    },
    transitionPath: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      alignItems: 'center',
      gap: 10,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
      borderRadius: 8,
      backgroundColor: colors.surface,
      padding: 12,
    },
    statusList: {
      gap: 8,
    },
    statusRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 10,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
      borderRadius: 8,
      backgroundColor: colors.surface,
      padding: 10,
    },
    savedText: {
      color: colors.foreground,
      fontSize: 14,
      fontWeight: '700',
    },
    errorText: {
      color: colors.destructive,
      fontSize: 13,
      lineHeight: 18,
      paddingHorizontal: 16,
    },
    footer: {
      position: 'absolute',
      right: 0,
      bottom: 0,
      left: 0,
      flexDirection: 'row',
      justifyContent: 'flex-end',
      gap: 10,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: colors.border,
      backgroundColor: colors.card,
      padding: 12,
    },
  });
}
