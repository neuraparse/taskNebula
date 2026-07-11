import { Alert } from 'react-native';
import { useMemo, useState } from 'react';
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from '@/components/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import {
  CalendarClock,
  Edit3,
  LayoutGrid,
  Layers3,
  List,
  Plus,
  Save,
  Trash2,
  User,
  Users,
  X,
  type LucideIcon,
} from 'lucide-react-native';
import { useTranslation } from 'react-i18next';

import type { ModuleStatus, ProjectMember, ProjectModule } from '@/api/types';
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
import type { ThemeColors } from '@/design/theme';
import { useThemeColors } from '@/design/theme-context';
import {
  useCreateProjectModule,
  useDeleteProjectModule,
  useProject,
  useProjectMembers,
  useProjectModules,
  useUpdateProjectModule,
} from '@/hooks/queries';
import type { AppStackParamList } from '@/navigation/types';

type ProjectModulesProps = NativeStackScreenProps<AppStackParamList, 'ProjectModules'>;
type ViewMode = 'gallery' | 'list';
type ModuleFilter = 'all' | ModuleStatus;
type Tone = 'blue' | 'emerald' | 'amber' | 'rose' | 'violet' | 'neutral';
type ProjectModulesStyles = ReturnType<typeof createProjectModulesStyles>;

const MODULE_STATUSES = [
  'backlog',
  'planned',
  'in_progress',
  'paused',
  'completed',
  'cancelled',
] as const;

const FILTERS: ModuleFilter[] = ['all', ...MODULE_STATUSES];

const STATUS_TONE: Record<(typeof MODULE_STATUSES)[number], Tone> = {
  backlog: 'neutral',
  planned: 'blue',
  in_progress: 'amber',
  paused: 'neutral',
  completed: 'emerald',
  cancelled: 'rose',
};

function useProjectModulesTheme(): {
  colors: ThemeColors;
  colorsByTone: Record<Tone, string>;
  styles: ProjectModulesStyles;
} {
  const colors = useThemeColors();
  const colorsByTone = useMemo(() => createColorsByTone(colors), [colors]);
  const styles = useMemo(() => createProjectModulesStyles(colors), [colors]);
  return { colors, colorsByTone, styles };
}

function createColorsByTone(colors: ThemeColors): Record<Tone, string> {
  return {
    blue: colors.accentBlue,
    emerald: colors.accentEmerald,
    amber: colors.accentAmber,
    rose: colors.accentRose,
    violet: colors.accentViolet,
    neutral: colors.mutedForeground,
  };
}

function isKnownModuleStatus(status: ModuleStatus): status is (typeof MODULE_STATUSES)[number] {
  return MODULE_STATUSES.includes(status as (typeof MODULE_STATUSES)[number]);
}

function statusTone(status: ModuleStatus): Tone {
  return isKnownModuleStatus(status) ? STATUS_TONE[status] : 'neutral';
}

function formatDate(value: string | null | undefined, language: string): string {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleDateString(language, { day: 'numeric', month: 'short' });
}

function dateInputValue(value: string | null | undefined): string {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function isValidDateInput(value: string): boolean {
  if (!value) return true;
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return false;
  const date = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
  return (
    date.getFullYear() === Number(match[1]) &&
    date.getMonth() === Number(match[2]) - 1 &&
    date.getDate() === Number(match[3])
  );
}

function moduleOwner(module: ProjectModule, members: ProjectMember[]): ProjectMember | null {
  return members.find((member) => member.userId === module.ownerId) ?? null;
}

function memberName(member: ProjectMember): string {
  return member.user.name || member.user.email;
}

function moduleStatusLabel(status: ModuleStatus, t: ReturnType<typeof useTranslation>['t']) {
  if (isKnownModuleStatus(status)) return t(`modules.status.${status}`);
  return status;
}

function SummaryMetric({ label, value }: { label: string; value: number }) {
  const { styles } = useProjectModulesTheme();

  return (
    <View style={styles.metric}>
      <Text style={styles.metricValue}>{value}</Text>
      <Text style={styles.metricLabel} numberOfLines={1}>
        {label}
      </Text>
    </View>
  );
}

function SegmentButton({
  icon: Icon,
  label,
  onPress,
  selected,
}: {
  icon: LucideIcon;
  label: string;
  onPress: () => void;
  selected: boolean;
}) {
  const { colors, styles } = useProjectModulesTheme();

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected }}
      onPress={onPress}
      style={[styles.segmentButton, selected ? styles.segmentButtonActive : null]}
      className="active:opacity-80"
    >
      <Icon size={15} color={selected ? colors.primaryForeground : colors.foreground} />
      <Text style={[styles.segmentText, selected ? styles.segmentTextActive : null]}>{label}</Text>
    </Pressable>
  );
}

function FilterChip({
  label,
  onPress,
  selected,
}: {
  label: string;
  onPress: () => void;
  selected: boolean;
}) {
  const { styles } = useProjectModulesTheme();

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected }}
      onPress={onPress}
      style={[styles.filterChip, selected ? styles.filterChipActive : null]}
      className="active:opacity-80"
    >
      <Text style={[styles.filterChipText, selected ? styles.filterChipTextActive : null]}>
        {label}
      </Text>
    </Pressable>
  );
}

function MemberChip({
  label,
  onPress,
  selected,
}: {
  label: string;
  onPress: () => void;
  selected: boolean;
}) {
  const { styles } = useProjectModulesTheme();

  return (
    <Pressable
      accessibilityRole="checkbox"
      accessibilityState={{ checked: selected }}
      onPress={onPress}
      style={[styles.memberChip, selected ? styles.memberChipActive : null]}
      className="active:opacity-80"
    >
      <Text style={[styles.memberChipText, selected ? styles.memberChipTextActive : null]}>
        {label}
      </Text>
    </Pressable>
  );
}

function ModuleMeta({ icon: Icon, label }: { icon: LucideIcon; label: string }) {
  const { colors, styles } = useProjectModulesTheme();

  return (
    <View style={styles.metaItem}>
      <Icon size={13} color={colors.mutedForeground} />
      <Text style={styles.metaText} numberOfLines={1}>
        {label}
      </Text>
    </View>
  );
}

function ModuleCard({
  members,
  module,
  onDelete,
  onEdit,
  view,
}: {
  members: ProjectMember[];
  module: ProjectModule;
  onDelete: () => void;
  onEdit: () => void;
  view: ViewMode;
}) {
  const { i18n, t } = useTranslation();
  const { colorsByTone, styles } = useProjectModulesTheme();
  const owner = moduleOwner(module, members);
  const ownerLabel = owner ? memberName(owner) : t('modules.unassigned');
  const targetDate = formatDate(module.targetDate, i18n.language);
  const compact = view === 'list';

  return (
    <SurfaceRow className={compact ? 'gap-2' : 'gap-3'}>
      <View style={styles.moduleHeader}>
        <View style={styles.moduleTitleWrap}>
          <View
            style={[styles.statusDot, { backgroundColor: colorsByTone[statusTone(module.status)] }]}
          />
          <Text style={styles.moduleTitle} numberOfLines={2}>
            {module.name}
          </Text>
        </View>
        <SemanticBadge
          label={moduleStatusLabel(module.status, t)}
          tone={statusTone(module.status)}
        />
      </View>

      <Text
        style={[styles.moduleDescription, compact ? styles.moduleDescriptionCompact : null]}
        numberOfLines={compact ? 1 : 3}
      >
        {module.description || t('modules.noDescription')}
      </Text>

      <View style={styles.metaGrid}>
        <ModuleMeta icon={User} label={ownerLabel} />
        <ModuleMeta
          icon={Users}
          label={t('modules.membersCount', { count: module.memberIds.length })}
        />
        <ModuleMeta icon={CalendarClock} label={targetDate || t('modules.noTargetDate')} />
      </View>

      <View style={styles.cardActions}>
        <Button
          title={t('common.edit')}
          variant="secondary"
          icon={Edit3}
          onPress={onEdit}
          style={styles.cardAction}
        />
        <Button
          title={t('modules.delete')}
          variant="destructive"
          icon={Trash2}
          onPress={onDelete}
          style={styles.cardAction}
        />
      </View>
    </SurfaceRow>
  );
}

export function ProjectModulesScreen({ route }: ProjectModulesProps) {
  const { t } = useTranslation();
  const { styles } = useProjectModulesTheme();
  const { projectId } = route.params;
  const projectQ = useProject(projectId);
  const modulesQ = useProjectModules(projectId);
  const membersQ = useProjectMembers(projectId);
  const createModule = useCreateProjectModule(projectId);
  const updateModule = useUpdateProjectModule(projectId);
  const deleteModule = useDeleteProjectModule(projectId);
  const [viewMode, setViewMode] = useState<ViewMode>('gallery');
  const [filter, setFilter] = useState<ModuleFilter>('all');
  const [formOpen, setFormOpen] = useState(false);
  const [editingModuleId, setEditingModuleId] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [status, setStatus] = useState<ModuleStatus>('planned');
  const [ownerId, setOwnerId] = useState<string | null>(null);
  const [memberIds, setMemberIds] = useState<string[]>([]);
  const [targetDate, setTargetDate] = useState('');
  const [formError, setFormError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const modules = useMemo(() => modulesQ.data ?? [], [modulesQ.data]);
  const members = useMemo(() => membersQ.data ?? [], [membersQ.data]);
  const filteredModules = useMemo(
    () => modules.filter((module) => filter === 'all' || module.status === filter),
    [filter, modules],
  );
  const activeCount = modules.filter((module) => module.status === 'in_progress').length;
  const completedCount = modules.filter((module) => module.status === 'completed').length;
  const busy = createModule.isPending || updateModule.isPending || deleteModule.isPending;

  const resetForm = () => {
    setEditingModuleId(null);
    setName('');
    setDescription('');
    setStatus('planned');
    setOwnerId(null);
    setMemberIds([]);
    setTargetDate('');
    setFormError(null);
  };

  const openCreateForm = () => {
    resetForm();
    setActionError(null);
    setFormOpen(true);
  };

  const openEditForm = (module: ProjectModule) => {
    setEditingModuleId(module.id);
    setName(module.name);
    setDescription(module.description ?? '');
    setStatus(module.status);
    setOwnerId(module.ownerId ?? null);
    setMemberIds(module.memberIds);
    setTargetDate(dateInputValue(module.targetDate));
    setFormError(null);
    setActionError(null);
    setFormOpen(true);
  };

  const closeForm = () => {
    resetForm();
    setFormOpen(false);
  };

  const toggleMember = (memberId: string) => {
    setMemberIds((current) =>
      current.includes(memberId)
        ? current.filter((currentId) => currentId !== memberId)
        : [...current, memberId],
    );
  };

  const saveModule = async () => {
    setFormError(null);
    setActionError(null);
    const trimmedName = name.trim();
    const trimmedTargetDate = targetDate.trim();
    if (!trimmedName) {
      setFormError(t('modules.nameRequired'));
      return;
    }
    if (!isValidDateInput(trimmedTargetDate)) {
      setFormError(t('modules.invalidTargetDate'));
      return;
    }

    const payload = {
      name: trimmedName,
      description: description.trim() || null,
      status,
      ownerId,
      memberIds,
      targetDate: trimmedTargetDate || null,
    };

    try {
      if (editingModuleId) {
        await updateModule.mutateAsync({ moduleId: editingModuleId, patch: payload });
      } else {
        await createModule.mutateAsync(payload);
      }
      closeForm();
    } catch (error) {
      setFormError(error instanceof Error ? error.message : t('modules.errorGeneric'));
    }
  };

  const confirmDelete = (module: ProjectModule) => {
    setActionError(null);
    Alert.alert(t('modules.deleteTitle'), t('modules.deleteWarning', { name: module.name }), [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('modules.delete'),
        style: 'destructive',
        onPress: () => {
          deleteModule.mutate(module.id, {
            onError: (error) => {
              setActionError(error instanceof Error ? error.message : t('modules.errorGeneric'));
            },
          });
        },
      },
    ]);
  };

  if (modulesQ.isLoading && !modulesQ.data) return <Loading label={t('modules.loading')} />;
  if (modulesQ.isError && !modulesQ.data) {
    return (
      <Screen>
        <ErrorView
          message={
            modulesQ.error instanceof Error ? modulesQ.error.message : t('modules.loadFailed')
          }
          onRetry={() => void modulesQ.refetch()}
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
            refreshing={projectQ.isRefetching || modulesQ.isRefetching || membersQ.isRefetching}
            onRefresh={() => {
              void projectQ.refetch();
              void modulesQ.refetch();
              void membersQ.refetch();
            }}
          />
        }
      >
        <ScreenHeader
          kicker={projectQ.data?.key ?? t('projects.title')}
          title={t('modules.title')}
          subtitle={t('modules.subtitle')}
          meta={<SemanticBadge label={t('modules.count', { count: modules.length })} tone="blue" />}
        />

        <View style={styles.summary}>
          <SummaryMetric label={t('modules.total')} value={modules.length} />
          <SummaryMetric label={t('modules.active')} value={activeCount} />
          <SummaryMetric label={t('modules.completed')} value={completedCount} />
        </View>

        <View style={styles.topActions}>
          <Button
            title={formOpen ? t('common.cancel') : t('modules.new')}
            icon={formOpen ? X : Plus}
            onPress={formOpen ? closeForm : openCreateForm}
          />
        </View>

        {actionError ? (
          <View style={styles.errorPanel}>
            <Text style={styles.errorText}>{actionError}</Text>
          </View>
        ) : null}

        {formOpen ? (
          <SurfaceRow className="gap-3">
            <View style={styles.sectionHeader}>
              <IconTile icon={Layers3} tone="violet" />
              <View style={styles.sectionCopy}>
                <Text style={styles.sectionTitle}>
                  {editingModuleId ? t('modules.editTitle') : t('modules.createTitle')}
                </Text>
                <Text style={styles.sectionSubtitle}>{t('modules.formSubtitle')}</Text>
              </View>
            </View>

            <TextField
              label={t('modules.nameLabel')}
              placeholder={t('modules.namePlaceholder')}
              value={name}
              onChangeText={setName}
              autoCapitalize="sentences"
            />
            <TextField
              label={t('modules.descriptionLabel')}
              placeholder={t('modules.descriptionPlaceholder')}
              value={description}
              onChangeText={setDescription}
              autoCapitalize="sentences"
            />
            <TextField
              label={t('modules.targetDateLabel')}
              placeholder={t('modules.targetDatePlaceholder')}
              value={targetDate}
              onChangeText={setTargetDate}
              keyboardType="numbers-and-punctuation"
              autoCapitalize="none"
            />

            <View style={styles.formGroup}>
              <Text style={styles.formLabel}>{t('modules.statusLabel')}</Text>
              <View style={styles.chipWrap}>
                {MODULE_STATUSES.map((item) => (
                  <FilterChip
                    key={item}
                    label={t(`modules.status.${item}`)}
                    selected={status === item}
                    onPress={() => setStatus(item)}
                  />
                ))}
              </View>
            </View>

            <View style={styles.formGroup}>
              <Text style={styles.formLabel}>{t('modules.ownerLabel')}</Text>
              <View style={styles.chipWrap}>
                <MemberChip
                  label={t('modules.unassigned')}
                  selected={ownerId === null}
                  onPress={() => setOwnerId(null)}
                />
                {members.map((member) => (
                  <MemberChip
                    key={member.userId}
                    label={memberName(member)}
                    selected={ownerId === member.userId}
                    onPress={() => setOwnerId(member.userId)}
                  />
                ))}
              </View>
              {!membersQ.isLoading && members.length === 0 ? (
                <Text style={styles.helperText}>{t('modules.noMembers')}</Text>
              ) : null}
            </View>

            <View style={styles.formGroup}>
              <Text style={styles.formLabel}>{t('modules.membersLabel')}</Text>
              <View style={styles.chipWrap}>
                {members.map((member) => (
                  <MemberChip
                    key={member.userId}
                    label={memberName(member)}
                    selected={memberIds.includes(member.userId)}
                    onPress={() => toggleMember(member.userId)}
                  />
                ))}
              </View>
              {!membersQ.isLoading && members.length === 0 ? (
                <Text style={styles.helperText}>{t('modules.noMembers')}</Text>
              ) : null}
            </View>

            {formError ? <Text style={styles.errorText}>{formError}</Text> : null}

            <View style={styles.formActions}>
              <Button
                title={editingModuleId ? t('modules.save') : t('modules.create')}
                icon={editingModuleId ? Save : Plus}
                loading={createModule.isPending || updateModule.isPending}
                disabled={deleteModule.isPending}
                onPress={() => void saveModule()}
                style={styles.formAction}
              />
              <Button
                title={t('common.cancel')}
                variant="secondary"
                icon={X}
                disabled={busy}
                onPress={closeForm}
                style={styles.formAction}
              />
            </View>
          </SurfaceRow>
        ) : null}

        <SurfaceRow className="gap-3">
          <View style={styles.controlsHeader}>
            <View style={styles.segment}>
              <SegmentButton
                icon={LayoutGrid}
                label={t('modules.viewGallery')}
                selected={viewMode === 'gallery'}
                onPress={() => setViewMode('gallery')}
              />
              <SegmentButton
                icon={List}
                label={t('modules.viewList')}
                selected={viewMode === 'list'}
                onPress={() => setViewMode('list')}
              />
            </View>
          </View>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            <View style={styles.filterRow}>
              {FILTERS.map((item) => (
                <FilterChip
                  key={item}
                  label={item === 'all' ? t('common.all') : t(`modules.status.${item}`)}
                  selected={filter === item}
                  onPress={() => setFilter(item)}
                />
              ))}
            </View>
          </ScrollView>
        </SurfaceRow>

        {modulesQ.isError ? (
          <Text style={styles.errorText}>
            {modulesQ.error instanceof Error ? modulesQ.error.message : t('modules.loadFailed')}
          </Text>
        ) : null}

        <View style={viewMode === 'gallery' ? styles.galleryList : styles.compactList}>
          {filteredModules.map((module) => (
            <ModuleCard
              key={module.id}
              module={module}
              members={members}
              view={viewMode}
              onEdit={() => openEditForm(module)}
              onDelete={() => confirmDelete(module)}
            />
          ))}
        </View>

        {filteredModules.length === 0 ? (
          <EmptyState
            icon={Layers3}
            title={modules.length === 0 ? t('modules.empty') : t('modules.noFilter')}
            description={
              modules.length === 0
                ? t('modules.emptyDescription')
                : t('modules.noFilterDescription')
            }
          />
        ) : null}
      </ScrollView>
    </Screen>
  );
}

function createProjectModulesStyles(colors: ThemeColors) {
  return StyleSheet.create({
    content: {
      gap: 12,
      paddingBottom: 20,
    },
    summary: {
      flexDirection: 'row',
      gap: 8,
      paddingHorizontal: 16,
    },
    metric: {
      flex: 1,
      gap: 2,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
      borderRadius: 6,
      backgroundColor: colors.surface,
      paddingHorizontal: 10,
      paddingVertical: 10,
    },
    metricValue: {
      color: colors.foreground,
      fontSize: 18,
      fontWeight: '700',
      lineHeight: 24,
    },
    metricLabel: {
      color: colors.mutedForeground,
      fontSize: 12,
      lineHeight: 16,
    },
    topActions: {
      paddingHorizontal: 16,
    },
    errorPanel: {
      marginHorizontal: 16,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.destructive,
      borderRadius: 6,
      backgroundColor: `${colors.destructive}14`,
      paddingHorizontal: 12,
      paddingVertical: 10,
    },
    errorText: {
      color: colors.destructive,
      fontSize: 13,
      fontWeight: '600',
      lineHeight: 18,
    },
    sectionHeader: {
      minHeight: 42,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
    },
    sectionCopy: {
      minWidth: 0,
      flex: 1,
      gap: 2,
    },
    sectionTitle: {
      color: colors.foreground,
      fontSize: 16,
      fontWeight: '700',
      lineHeight: 22,
    },
    sectionSubtitle: {
      color: colors.mutedForeground,
      fontSize: 13,
      lineHeight: 18,
    },
    formGroup: {
      gap: 8,
    },
    formLabel: {
      color: colors.foreground,
      fontSize: 14,
      fontWeight: '700',
      lineHeight: 20,
    },
    helperText: {
      color: colors.mutedForeground,
      fontSize: 12,
      lineHeight: 16,
    },
    chipWrap: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 8,
    },
    memberChip: {
      minHeight: 34,
      maxWidth: '100%',
      justifyContent: 'center',
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
      borderRadius: 4,
      backgroundColor: colors.surface,
      paddingHorizontal: 10,
      paddingVertical: 7,
    },
    memberChipActive: {
      borderColor: colors.primary,
      backgroundColor: colors.primary,
    },
    memberChipText: {
      color: colors.foreground,
      fontSize: 12,
      fontWeight: '700',
      lineHeight: 16,
    },
    memberChipTextActive: {
      color: colors.primaryForeground,
    },
    formActions: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 10,
    },
    formAction: {
      minWidth: 144,
      flex: 1,
    },
    controlsHeader: {
      gap: 10,
    },
    segment: {
      flexDirection: 'row',
      gap: 4,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
      borderRadius: 6,
      backgroundColor: colors.surface,
      padding: 4,
    },
    segmentButton: {
      minHeight: 36,
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 7,
      borderRadius: 4,
      paddingHorizontal: 10,
      paddingVertical: 8,
    },
    segmentButtonActive: {
      backgroundColor: colors.primary,
    },
    segmentText: {
      color: colors.foreground,
      fontSize: 13,
      fontWeight: '700',
      lineHeight: 18,
    },
    segmentTextActive: {
      color: colors.primaryForeground,
    },
    filterRow: {
      flexDirection: 'row',
      gap: 8,
    },
    filterChip: {
      minHeight: 32,
      justifyContent: 'center',
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
      borderRadius: 4,
      backgroundColor: colors.surface,
      paddingHorizontal: 10,
      paddingVertical: 6,
    },
    filterChipActive: {
      borderColor: colors.primary,
      backgroundColor: colors.primary,
    },
    filterChipText: {
      color: colors.foreground,
      fontSize: 12,
      fontWeight: '700',
      lineHeight: 16,
    },
    filterChipTextActive: {
      color: colors.primaryForeground,
    },
    galleryList: {
      gap: 10,
      paddingHorizontal: 16,
    },
    compactList: {
      gap: 8,
      paddingHorizontal: 16,
    },
    moduleHeader: {
      minHeight: 28,
      flexDirection: 'row',
      alignItems: 'flex-start',
      justifyContent: 'space-between',
      gap: 10,
    },
    moduleTitleWrap: {
      minWidth: 0,
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
    },
    statusDot: {
      width: 8,
      height: 8,
      borderRadius: 999,
    },
    moduleTitle: {
      minWidth: 0,
      flex: 1,
      color: colors.foreground,
      fontSize: 16,
      fontWeight: '700',
      lineHeight: 22,
    },
    moduleDescription: {
      color: colors.mutedForeground,
      fontSize: 13,
      lineHeight: 18,
    },
    moduleDescriptionCompact: {
      fontSize: 12,
      lineHeight: 16,
    },
    metaGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 8,
    },
    metaItem: {
      maxWidth: '100%',
      minHeight: 28,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
      borderRadius: 4,
      backgroundColor: colors.surface,
      paddingHorizontal: 8,
      paddingVertical: 5,
    },
    metaText: {
      maxWidth: 190,
      color: colors.mutedForeground,
      fontSize: 12,
      fontWeight: '600',
      lineHeight: 16,
    },
    cardActions: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 8,
    },
    cardAction: {
      minWidth: 132,
      flex: 1,
    },
  });
}
