import { useEffect, useMemo, useState } from 'react';
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
import { ChevronRight, Layers3, Plus, Target, TrendingUp } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';

import type { Initiative, Project } from '@/api/types';
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
  useCreateInitiative,
  useInitiativeRollup,
  useInitiatives,
  useProjects,
} from '@/hooks/queries';
import type { AppStackParamList, AppTabParamList } from '@/navigation/types';

type InitiativesNavigation = NavigationProp<AppStackParamList & AppTabParamList>;
type InitiativeStatusChoice = 'planned' | 'active' | 'paused' | 'complete' | 'cancelled';
type InitiativesStyles = ReturnType<typeof createInitiativesStyles>;

const INITIATIVE_STATUSES = ['planned', 'active', 'paused', 'complete', 'cancelled'] as const;

interface WorkspaceOption {
  id: string;
  projectCount: number;
}

function useInitiativesTheme(): { colors: ThemeColors; styles: InitiativesStyles } {
  const colors = useThemeColors();
  const styles = useMemo(() => createInitiativesStyles(colors), [colors]);

  return { colors, styles };
}

function uniqueWorkspaces(projects: Project[], initiatives: Initiative[]): WorkspaceOption[] {
  const counts = new Map<string, number>();
  for (const project of projects) {
    counts.set(project.organizationId, (counts.get(project.organizationId) ?? 0) + 1);
  }
  for (const initiative of initiatives) {
    if (!counts.has(initiative.workspaceId)) counts.set(initiative.workspaceId, 0);
  }
  return [...counts].map(([id, projectCount]) => ({ id, projectCount }));
}

function shortId(id: string): string {
  return id.length > 10 ? `${id.slice(0, 6)}...${id.slice(-4)}` : id;
}

function parseDateInput(value: string): string | null {
  const trimmed = value.trim();
  if (!trimmed) return null;
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(trimmed);
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(year, month - 1, day);
  if (date.getFullYear() !== year || date.getMonth() !== month - 1 || date.getDate() !== day) {
    return null;
  }
  return trimmed;
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

function statusLabel(status: string, t: ReturnType<typeof useTranslation>['t']): string {
  if (INITIATIVE_STATUSES.includes(status as InitiativeStatusChoice)) {
    return t(`initiatives.status.${status}`);
  }
  return status;
}

function WorkspacePill({
  index,
  option,
  selected,
  onPress,
}: {
  index: number;
  option: WorkspaceOption;
  selected: boolean;
  onPress: (workspaceId: string) => void;
}) {
  const { t } = useTranslation();
  const { styles } = useInitiativesTheme();

  return (
    <Pressable
      accessibilityRole="button"
      onPress={() => onPress(option.id)}
      style={[styles.workspacePill, selected ? styles.workspacePillActive : null]}
      className="active:opacity-80"
    >
      <Text style={[styles.workspaceTitle, selected ? styles.workspaceTitleActive : null]}>
        {t('initiatives.workspaceIndex', { index: index + 1 })}
      </Text>
      <View style={styles.workspaceMetaRow}>
        <Text
          style={[styles.workspaceMeta, selected ? styles.workspaceMetaActive : null]}
          numberOfLines={1}
        >
          {t('initiatives.projectCount', { count: option.projectCount })}
        </Text>
        <View style={[styles.workspaceMetaDot, selected ? styles.workspaceMetaDotActive : null]} />
        <Text
          style={[styles.workspaceMeta, selected ? styles.workspaceMetaActive : null]}
          numberOfLines={1}
        >
          {shortId(option.id)}
        </Text>
      </View>
    </Pressable>
  );
}

function StatusPill({
  status,
  selected,
  disabled,
  onPress,
}: {
  status: InitiativeStatusChoice;
  selected: boolean;
  disabled?: boolean;
  onPress: (status: InitiativeStatusChoice) => void;
}) {
  const { t } = useTranslation();
  const { styles } = useInitiativesTheme();

  return (
    <Pressable
      accessibilityRole="button"
      disabled={disabled}
      onPress={() => onPress(status)}
      style={[
        styles.statusPill,
        selected ? styles.statusPillActive : null,
        disabled ? styles.disabled : null,
      ]}
      className="active:opacity-80"
    >
      <Text style={[styles.statusPillText, selected ? styles.statusPillTextActive : null]}>
        {t(`initiatives.status.${status}`)}
      </Text>
    </Pressable>
  );
}

function ProgressBar({ percent }: { percent: number }) {
  const { styles } = useInitiativesTheme();
  const width = `${Math.max(0, Math.min(100, percent))}%` as `${number}%`;

  return (
    <View style={styles.progressTrack}>
      <View style={[styles.progressFill, { width }]} />
    </View>
  );
}

function InitiativeRow({ node, depth }: { node: Initiative; depth: number }) {
  const { t, i18n } = useTranslation();
  const { colors, styles } = useInitiativesTheme();
  const navigation = useNavigation<InitiativesNavigation>();
  const rollupQ = useInitiativeRollup(node.id);
  const rollup = rollupQ.data;
  const childCount = node.children?.length ?? 0;
  const targetDate = formatDate(node.targetDate, i18n.language);

  return (
    <View>
      <Pressable
        accessibilityRole="button"
        onPress={() => navigation.navigate('InitiativeDetail', { id: node.id })}
        style={[styles.initiativeRow, { paddingLeft: 12 + depth * 16 }]}
        className="active:opacity-80"
      >
        <View style={styles.rowIcon}>
          <Target size={16} color={colors.mutedForeground} />
        </View>
        <View style={styles.initiativeBody}>
          <View style={styles.initiativeTopLine}>
            <Text className="text-foreground text-base font-semibold" numberOfLines={1}>
              {node.name}
            </Text>
            <ChevronRight size={16} color={colors.mutedForeground} />
          </View>
          {node.description ? (
            <Text className="text-muted-foreground text-sm" numberOfLines={2}>
              {node.description}
            </Text>
          ) : null}
          <View style={styles.initiativeMeta}>
            <SemanticBadge label={statusLabel(node.status, t)} tone={statusTone(node.status)} />
            {childCount > 0 ? (
              <SemanticBadge label={t('initiatives.childCount', { count: childCount })} />
            ) : null}
            {targetDate ? <SemanticBadge label={targetDate} tone="amber" /> : null}
          </View>
          <View style={styles.rollupLine}>
            <ProgressBar percent={rollup?.percent ?? 0} />
            <Text style={styles.percentText}>
              {rollupQ.isLoading
                ? t('common.loading')
                : t('initiatives.percent', { percent: rollup?.percent ?? 0 })}
            </Text>
          </View>
        </View>
      </Pressable>

      {node.children?.map((child) => (
        <InitiativeRow key={child.id} node={child} depth={depth + 1} />
      ))}
    </View>
  );
}

export function InitiativesScreen() {
  const { t } = useTranslation();
  const { colors, styles } = useInitiativesTheme();
  const [selectedWorkspaceId, setSelectedWorkspaceId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [targetDate, setTargetDate] = useState('');
  const [status, setStatus] = useState<InitiativeStatusChoice>('planned');
  const [nameError, setNameError] = useState<string | null>(null);
  const [targetDateError, setTargetDateError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);

  const projectsQ = useProjects();
  const initiativesQ = useInitiatives(selectedWorkspaceId);
  const createInitiative = useCreateInitiative();
  const projects = useMemo(() => projectsQ.data ?? [], [projectsQ.data]);
  const initiativesData = initiativesQ.data;
  const initiatives = useMemo(() => initiativesData?.initiatives ?? [], [initiativesData]);
  const flatInitiatives = useMemo(() => initiativesData?.flat ?? [], [initiativesData]);
  const workspaceOptions = useMemo(
    () => uniqueWorkspaces(projects, flatInitiatives),
    [flatInitiatives, projects],
  );

  useEffect(() => {
    if (selectedWorkspaceId || workspaceOptions.length === 0) return;
    setSelectedWorkspaceId(workspaceOptions[0]?.id ?? null);
  }, [selectedWorkspaceId, workspaceOptions]);

  const isLoading =
    initiativesQ.isLoading || (projectsQ.isLoading && workspaceOptions.length === 0);
  const isRefreshing = initiativesQ.isRefetching || projectsQ.isRefetching;

  const refresh = () => {
    void initiativesQ.refetch();
    void projectsQ.refetch();
  };

  const resetForm = () => {
    setName('');
    setDescription('');
    setTargetDate('');
    setStatus('planned');
    setNameError(null);
    setTargetDateError(null);
    setFormError(null);
  };

  const onCreate = async (): Promise<void> => {
    setNameError(null);
    setTargetDateError(null);
    setFormError(null);
    const trimmedName = name.trim();
    const trimmedDescription = description.trim();
    const parsedTargetDate = targetDate.trim() ? parseDateInput(targetDate) : null;

    if (!trimmedName) {
      setNameError(t('initiatives.nameRequired'));
      return;
    }
    if (targetDate.trim() && !parsedTargetDate) {
      setTargetDateError(t('initiatives.invalidTargetDate'));
      return;
    }
    if (!selectedWorkspaceId) {
      setFormError(t('initiatives.noWorkspaceDesc'));
      return;
    }

    try {
      await createInitiative.mutateAsync({
        workspaceId: selectedWorkspaceId,
        name: trimmedName,
        status,
        ...(trimmedDescription ? { description: trimmedDescription } : {}),
        ...(parsedTargetDate ? { targetDate: parsedTargetDate } : {}),
      });
      resetForm();
      setCreating(false);
    } catch (err: unknown) {
      setFormError(err instanceof Error ? err.message : t('initiatives.createFailed'));
    }
  };

  if (isLoading) return <Loading />;
  if (initiativesQ.isError) {
    return (
      <Screen>
        <ErrorView
          message={
            initiativesQ.error instanceof Error
              ? initiativesQ.error.message
              : t('initiatives.loadFailed')
          }
          onRetry={refresh}
        />
      </Screen>
    );
  }

  const canCreate = Boolean(selectedWorkspaceId);

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
            kicker={t('common.appName')}
            title={t('initiatives.title')}
            subtitle={t('initiatives.subtitle')}
            meta={
              <SemanticBadge
                label={t('initiatives.count', { count: flatInitiatives.length })}
                tone="blue"
              />
            }
          />

          <View style={styles.workspaceSection}>
            <Text className="text-foreground text-base font-semibold">
              {t('initiatives.workspace')}
            </Text>
            {workspaceOptions.length > 0 ? (
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.workspaceList}
              >
                {workspaceOptions.map((option, index) => (
                  <WorkspacePill
                    key={option.id}
                    index={index}
                    option={option}
                    selected={selectedWorkspaceId === option.id}
                    onPress={setSelectedWorkspaceId}
                  />
                ))}
              </ScrollView>
            ) : (
              <View style={styles.noWorkspaceCard}>
                <Layers3 size={18} color={colors.mutedForeground} />
                <View className="min-w-0 flex-1">
                  <Text className="text-foreground text-sm font-semibold">
                    {t('initiatives.noWorkspace')}
                  </Text>
                  <Text className="text-muted-foreground text-sm">
                    {t('initiatives.noWorkspaceDesc')}
                  </Text>
                </View>
              </View>
            )}
          </View>

          <View style={styles.actions}>
            <Button
              title={creating ? t('common.cancel') : t('initiatives.new')}
              variant={creating ? 'secondary' : 'primary'}
              {...(!creating ? { icon: Plus } : {})}
              disabled={!canCreate && !creating}
              onPress={() => {
                if (creating) {
                  resetForm();
                  setCreating(false);
                  return;
                }
                setCreating(true);
              }}
            />
          </View>

          {creating ? (
            <View style={styles.createPanel}>
              <TextField
                label={t('initiatives.nameLabel')}
                placeholder={t('initiatives.namePlaceholder')}
                value={name}
                onChangeText={(value) => {
                  setName(value);
                  if (nameError) setNameError(null);
                }}
                editable={!createInitiative.isPending}
                error={nameError ?? undefined}
              />
              <TextField
                label={t('initiatives.descriptionLabel')}
                placeholder={t('initiatives.descriptionPlaceholder')}
                value={description}
                onChangeText={setDescription}
                editable={!createInitiative.isPending}
                multiline
                className="min-h-12"
              />
              <TextField
                label={t('initiatives.targetDateLabel')}
                placeholder={t('initiatives.targetDatePlaceholder')}
                value={targetDate}
                onChangeText={(value) => {
                  setTargetDate(value);
                  if (targetDateError) setTargetDateError(null);
                }}
                editable={!createInitiative.isPending}
                keyboardType="numbers-and-punctuation"
                autoCapitalize="none"
                error={targetDateError ?? undefined}
              />
              <View style={styles.statusBlock}>
                <Text style={styles.statusLabel}>{t('initiatives.statusLabel')}</Text>
                <View style={styles.statusList}>
                  {INITIATIVE_STATUSES.map((item) => (
                    <StatusPill
                      key={item}
                      status={item}
                      selected={status === item}
                      disabled={createInitiative.isPending}
                      onPress={setStatus}
                    />
                  ))}
                </View>
              </View>
              {formError ? <Text style={styles.formError}>{formError}</Text> : null}
              <Button
                title={t('initiatives.create')}
                icon={Plus}
                loading={createInitiative.isPending}
                disabled={createInitiative.isPending || !canCreate}
                onPress={onCreate}
              />
            </View>
          ) : null}

          <View style={styles.treeCard}>
            <View style={styles.treeHeader}>
              <View style={styles.treeTitle}>
                <TrendingUp size={16} color={colors.foreground} />
                <Text className="text-foreground text-base font-semibold">
                  {t('initiatives.tree')}
                </Text>
              </View>
              <SemanticBadge label={t('initiatives.count', { count: flatInitiatives.length })} />
            </View>
            {initiatives.length === 0 ? (
              <EmptyState
                icon={Layers3}
                title={t('initiatives.empty')}
                description={t('initiatives.emptyDesc')}
              />
            ) : (
              initiatives.map((initiative) => (
                <InitiativeRow key={initiative.id} node={initiative} depth={0} />
              ))
            )}
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </Screen>
  );
}

function createInitiativesStyles(colors: ThemeColors) {
  return StyleSheet.create({
    content: {
      gap: 14,
      paddingBottom: 24,
    },
    workspaceSection: {
      gap: 10,
      paddingHorizontal: 16,
    },
    workspaceList: {
      gap: 10,
      paddingRight: 16,
    },
    workspacePill: {
      minWidth: 170,
      gap: 4,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
      borderRadius: 6,
      backgroundColor: colors.card,
      paddingHorizontal: 12,
      paddingVertical: 10,
    },
    workspacePillActive: {
      borderColor: colors.primary,
      backgroundColor: `${colors.primary}14`,
    },
    workspaceTitle: {
      color: colors.foreground,
      fontSize: 13,
      fontWeight: '700',
      lineHeight: 18,
    },
    workspaceTitleActive: {
      color: colors.primary,
    },
    workspaceMetaRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
    },
    workspaceMeta: {
      color: colors.mutedForeground,
      fontSize: 11,
      lineHeight: 15,
    },
    workspaceMetaActive: {
      color: colors.foreground,
    },
    workspaceMetaDot: {
      width: 3,
      height: 3,
      borderRadius: 2,
      backgroundColor: colors.mutedForeground,
    },
    workspaceMetaDotActive: {
      backgroundColor: colors.primary,
    },
    noWorkspaceCard: {
      flexDirection: 'row',
      gap: 10,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
      borderRadius: 6,
      backgroundColor: colors.card,
      padding: 12,
    },
    actions: {
      paddingHorizontal: 16,
    },
    createPanel: {
      gap: 14,
      marginHorizontal: 16,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
      borderRadius: 6,
      backgroundColor: colors.card,
      padding: 14,
    },
    statusBlock: {
      gap: 8,
    },
    statusLabel: {
      color: colors.foreground,
      fontSize: 14,
      fontWeight: '600',
      lineHeight: 20,
    },
    statusList: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 8,
    },
    statusPill: {
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
      borderRadius: 4,
      backgroundColor: colors.card,
      paddingHorizontal: 10,
      paddingVertical: 8,
    },
    statusPillActive: {
      borderColor: colors.primary,
      backgroundColor: colors.primary,
    },
    statusPillText: {
      color: colors.mutedForeground,
      fontSize: 12,
      fontWeight: '600',
      lineHeight: 16,
    },
    statusPillTextActive: {
      color: colors.primaryForeground,
    },
    formError: {
      color: colors.destructive,
      fontSize: 13,
      lineHeight: 18,
    },
    treeCard: {
      marginHorizontal: 16,
      overflow: 'hidden',
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
      borderRadius: 6,
      backgroundColor: colors.card,
    },
    treeHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 12,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
      paddingHorizontal: 12,
      paddingVertical: 12,
    },
    treeTitle: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
    },
    initiativeRow: {
      flexDirection: 'row',
      gap: 10,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
      paddingRight: 12,
      paddingVertical: 12,
    },
    rowIcon: {
      width: 28,
      height: 28,
      alignItems: 'center',
      justifyContent: 'center',
      borderRadius: 6,
      backgroundColor: colors.surface,
    },
    initiativeBody: {
      minWidth: 0,
      flex: 1,
      gap: 7,
    },
    initiativeTopLine: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 8,
    },
    initiativeMeta: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 6,
    },
    rollupLine: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
    },
    progressTrack: {
      flex: 1,
      height: 7,
      overflow: 'hidden',
      borderRadius: 999,
      backgroundColor: colors.surface2,
    },
    progressFill: {
      height: '100%',
      borderRadius: 999,
      backgroundColor: colors.primary,
    },
    percentText: {
      width: 72,
      color: colors.mutedForeground,
      fontSize: 11,
      fontVariant: ['tabular-nums'],
      lineHeight: 16,
      textAlign: 'right',
    },
    disabled: {
      opacity: 0.5,
    },
  });
}
