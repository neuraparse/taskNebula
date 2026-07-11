import { Alert } from 'react-native';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from '@/components/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import {
  CalendarDays,
  Check,
  Clock3,
  LayoutGrid,
  LayoutList,
  ListFilter,
  Plus,
  Save,
  Star,
  Trash2,
  X,
  type LucideIcon,
} from 'lucide-react-native';
import { useTranslation } from 'react-i18next';

import type { Issue, ProjectView, ProjectViewScope, ProjectViewType, Teamspace } from '@/api/types';
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
  defaultIssueListFilters,
  filterIssues,
  hasActiveIssueFilters,
  IssueFilterPanel,
  type IssueListFilters,
} from '@/components/issue-filters';
import { IssueListItem, IssueSeparator } from '@/components/issue-list';
import { ProjectBoard } from '@/components/project-board';
import type { ThemeColors } from '@/design/theme';
import { useThemeColors } from '@/design/theme-context';
import {
  useCreateProjectView,
  useDeleteProjectView,
  useIssues,
  useMarkProjectViewUsed,
  useProject,
  useProjectViews,
  useTeamspaces,
  useUpdateProjectView,
} from '@/hooks/queries';
import {
  buildProjectViewCriteria,
  criteriaSummary,
  filtersFromCriteria,
  sortByViewType,
} from '@/lib/project-views';
import type { AppStackParamList } from '@/navigation/types';

type ProjectViewsProps = NativeStackScreenProps<AppStackParamList, 'ProjectViews'>;
type Tone = 'blue' | 'emerald' | 'amber' | 'rose' | 'violet' | 'neutral';
type ProjectViewsStyles = ReturnType<typeof createProjectViewsStyles>;

const VIEW_TYPES: Array<{ icon: LucideIcon; type: ProjectViewType }> = [
  { type: 'list', icon: LayoutList },
  { type: 'board', icon: LayoutGrid },
  { type: 'timeline', icon: Clock3 },
  { type: 'calendar', icon: CalendarDays },
];

function useProjectViewsTheme(): { colors: ThemeColors; styles: ProjectViewsStyles } {
  const colors = useThemeColors();
  const styles = useMemo(() => createProjectViewsStyles(colors), [colors]);

  return { colors, styles };
}

function formatDate(value: string | null | undefined, language: string): string {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleDateString(language, { day: 'numeric', month: 'short', year: 'numeric' });
}

function scopeTone(scope: ProjectViewScope): Tone {
  if (scope === 'personal') return 'violet';
  if (scope === 'teamspace') return 'amber';
  return 'blue';
}

function viewTypeTone(type: ProjectViewType): Tone {
  if (type === 'board') return 'emerald';
  if (type === 'timeline') return 'amber';
  if (type === 'calendar') return 'violet';
  return 'blue';
}

function issueDate(issue: Issue, language: string): string {
  return formatDate(issue.dueDate, language);
}

function ViewModeButton({
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
  const { colors, styles } = useProjectViewsTheme();

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected }}
      onPress={onPress}
      style={[styles.viewModeButton, selected ? styles.viewModeButtonActive : null]}
      className="active:opacity-80"
    >
      <Icon size={15} color={selected ? colors.primaryForeground : colors.foreground} />
      <Text
        style={[styles.viewModeText, selected ? styles.viewModeTextActive : null]}
        numberOfLines={1}
      >
        {label}
      </Text>
    </Pressable>
  );
}

function ChoiceChip({
  disabled = false,
  label,
  onPress,
  selected,
}: {
  disabled?: boolean;
  label: string;
  onPress: () => void;
  selected: boolean;
}) {
  const { styles } = useProjectViewsTheme();

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled, selected }}
      disabled={disabled}
      onPress={onPress}
      style={[
        styles.choiceChip,
        selected ? styles.choiceChipActive : null,
        disabled ? styles.choiceChipDisabled : null,
      ]}
      className="active:opacity-80"
    >
      <Text
        style={[
          styles.choiceChipText,
          selected ? styles.choiceChipTextActive : null,
          disabled ? styles.choiceChipTextDisabled : null,
        ]}
      >
        {label}
      </Text>
    </Pressable>
  );
}

function TeamspaceSelector({
  activeTeamspaceId,
  loading,
  loadFailed,
  onSelect,
  teamspaces,
}: {
  activeTeamspaceId: string | null;
  loading: boolean;
  loadFailed: boolean;
  onSelect: (teamspaceId: string) => void;
  teamspaces: Teamspace[];
}) {
  const { t } = useTranslation();
  const { styles } = useProjectViewsTheme();

  if (!loading && !loadFailed && teamspaces.length === 0) {
    return null;
  }

  return (
    <SurfaceRow className="gap-3">
      <View style={styles.choiceSection}>
        <Text style={styles.choiceLabel}>{t('projectViews.teamspaceLabel')}</Text>
        <Text style={styles.mutedText}>{t('projectViews.teamspaceSubtitle')}</Text>
        {loading ? (
          <Text style={styles.mutedText}>{t('projectViews.teamspacesLoading')}</Text>
        ) : null}
        {loadFailed ? (
          <Text style={styles.errorText}>{t('projectViews.teamspacesLoadFailed')}</Text>
        ) : null}
        {teamspaces.length > 0 ? (
          <View style={styles.choiceRow}>
            {teamspaces.map((teamspace) => (
              <ChoiceChip
                key={teamspace.id}
                label={teamspace.name}
                selected={activeTeamspaceId === teamspace.id}
                onPress={() => onSelect(teamspace.id)}
              />
            ))}
          </View>
        ) : null}
      </View>
    </SurfaceRow>
  );
}

function ToggleChip({
  label,
  onPress,
  selected,
}: {
  label: string;
  onPress: () => void;
  selected: boolean;
}) {
  const { colors, styles } = useProjectViewsTheme();

  return (
    <Pressable
      accessibilityRole="checkbox"
      accessibilityState={{ checked: selected }}
      onPress={onPress}
      style={[styles.toggleChip, selected ? styles.toggleChipActive : null]}
      className="active:opacity-80"
    >
      <Check size={14} color={selected ? colors.primaryForeground : colors.foreground} />
      <Text style={[styles.toggleChipText, selected ? styles.toggleChipTextActive : null]}>
        {label}
      </Text>
    </Pressable>
  );
}

function SavedViewCard({
  busy,
  onApply,
  onDelete,
  onToggleDefault,
  onTogglePinned,
  selected,
  view,
}: {
  busy: boolean;
  onApply: () => void;
  onDelete: () => void;
  onToggleDefault: () => void;
  onTogglePinned: () => void;
  selected: boolean;
  view: ProjectView;
}) {
  const { t } = useTranslation();
  const { colors, styles } = useProjectViewsTheme();
  const summary = criteriaSummary(view.criteria).slice(0, 3);

  return (
    <SurfaceRow className="gap-3">
      <Pressable
        accessibilityRole="button"
        accessibilityState={{ selected }}
        onPress={onApply}
        style={styles.savedViewBody}
        className="active:opacity-80"
      >
        <View style={styles.savedViewHeader}>
          <View style={styles.savedViewTitleWrap}>
            <Text style={styles.savedViewTitle} numberOfLines={2}>
              {view.name}
            </Text>
            {view.isStarred ? (
              <Star size={14} color={colors.accentAmber} fill={colors.accentAmber} />
            ) : null}
          </View>
          <View style={styles.badgeRow}>
            <SemanticBadge
              label={t(`projectViews.viewType.${view.viewType}`)}
              tone={viewTypeTone(view.viewType)}
            />
            <SemanticBadge
              label={t(`projectViews.scope.${view.scope}`)}
              tone={scopeTone(view.scope)}
            />
            {view.isDefault ? (
              <SemanticBadge label={t('projectViews.default')} tone="emerald" />
            ) : null}
          </View>
        </View>

        {view.description ? (
          <Text style={styles.savedViewDescription} numberOfLines={2}>
            {view.description}
          </Text>
        ) : null}

        {summary.length > 0 ? (
          <View style={styles.criteriaRow}>
            {summary.map((item) => (
              <View key={item} style={styles.criteriaChip}>
                <Text style={styles.criteriaText} numberOfLines={1}>
                  {item}
                </Text>
              </View>
            ))}
          </View>
        ) : null}
      </Pressable>

      {view.isOwned ? (
        <View style={styles.savedViewActions}>
          <Button
            title={view.isStarred ? t('projectViews.unpin') : t('projectViews.pin')}
            variant="secondary"
            icon={Star}
            disabled={busy}
            onPress={onTogglePinned}
            style={styles.savedViewAction}
          />
          <Button
            title={view.isDefault ? t('projectViews.clearDefault') : t('projectViews.setDefault')}
            variant="secondary"
            icon={Check}
            disabled={busy}
            onPress={onToggleDefault}
            style={styles.savedViewAction}
          />
          <Button
            title={t('projectViews.delete')}
            variant="destructive"
            icon={Trash2}
            disabled={busy}
            onPress={onDelete}
            style={styles.savedViewAction}
          />
        </View>
      ) : null}
    </SurfaceRow>
  );
}

function IssuePreviewCard({
  issue,
  language,
  onOpen,
}: {
  issue: Issue;
  language: string;
  onOpen: () => void;
}) {
  const { t } = useTranslation();
  const { styles } = useProjectViewsTheme();
  const dateLabel = issueDate(issue, language);

  return (
    <Pressable
      accessibilityRole="button"
      onPress={onOpen}
      style={styles.previewCard}
      className="active:opacity-80"
    >
      <View style={styles.previewHeader}>
        <Text style={styles.previewKey} numberOfLines={1}>
          {issue.key ?? t('issues.title')}
        </Text>
        {dateLabel ? (
          <SemanticBadge label={dateLabel} tone="amber" />
        ) : (
          <SemanticBadge label={t('projectViews.unscheduled')} />
        )}
      </View>
      <Text style={styles.previewTitle} numberOfLines={2}>
        {issue.title}
      </Text>
      <View style={styles.badgeRow}>
        <SemanticBadge label={t(`issueType.${issue.type}`)} tone="blue" />
        {issue.status?.name ? <SemanticBadge label={issue.status.name} tone="neutral" /> : null}
      </View>
    </Pressable>
  );
}

function TimelineView({
  issues,
  language,
  onOpenIssue,
}: {
  issues: Issue[];
  language: string;
  onOpenIssue: (id: string) => void;
}) {
  const { t } = useTranslation();
  const { styles } = useProjectViewsTheme();
  const scheduled = issues.filter((issue) => issue.dueDate);
  const unscheduled = issues.filter((issue) => !issue.dueDate);

  return (
    <SurfaceRow className="gap-3">
      <View style={styles.sectionHeader}>
        <IconTile icon={Clock3} tone="amber" />
        <View style={styles.sectionCopy}>
          <Text style={styles.sectionTitle}>{t('projectViews.timeline')}</Text>
          <Text style={styles.sectionSubtitle}>
            {t('projectViews.timelineSummary', {
              scheduled: scheduled.length,
              unscheduled: unscheduled.length,
            })}
          </Text>
        </View>
      </View>
      {scheduled.length === 0 ? (
        <Text style={styles.mutedText}>{t('projectViews.noScheduled')}</Text>
      ) : null}
      {scheduled.map((issue) => (
        <IssuePreviewCard
          key={issue.id}
          issue={issue}
          language={language}
          onOpen={() => onOpenIssue(issue.id)}
        />
      ))}
      {unscheduled.length > 0 ? (
        <Text style={styles.mutedText}>
          {t('projectViews.unscheduledCount', { count: unscheduled.length })}
        </Text>
      ) : null}
    </SurfaceRow>
  );
}

function CalendarView({
  issues,
  language,
  onOpenIssue,
}: {
  issues: Issue[];
  language: string;
  onOpenIssue: (id: string) => void;
}) {
  const { t } = useTranslation();
  const { styles } = useProjectViewsTheme();
  const grouped = useMemo(() => {
    const map = new Map<string, Issue[]>();
    for (const issue of issues) {
      if (!issue.dueDate) continue;
      const key = issueDate(issue, language);
      map.set(key, [...(map.get(key) ?? []), issue]);
    }
    return [...map.entries()];
  }, [issues, language]);

  return (
    <SurfaceRow className="gap-3">
      <View style={styles.sectionHeader}>
        <IconTile icon={CalendarDays} tone="violet" />
        <View style={styles.sectionCopy}>
          <Text style={styles.sectionTitle}>{t('projectViews.calendar')}</Text>
          <Text style={styles.sectionSubtitle}>{t('projectViews.calendarSubtitle')}</Text>
        </View>
      </View>
      {grouped.length === 0 ? (
        <Text style={styles.mutedText}>{t('projectViews.noScheduled')}</Text>
      ) : null}
      {grouped.map(([date, dayIssues]) => (
        <View key={date} style={styles.calendarDay}>
          <SemanticBadge label={date} tone="violet" />
          <View style={styles.calendarIssues}>
            {dayIssues.map((issue) => (
              <IssuePreviewCard
                key={issue.id}
                issue={issue}
                language={language}
                onOpen={() => onOpenIssue(issue.id)}
              />
            ))}
          </View>
        </View>
      ))}
    </SurfaceRow>
  );
}

export function ProjectViewsScreen({ navigation, route }: ProjectViewsProps) {
  const { i18n, t } = useTranslation();
  const { styles } = useProjectViewsTheme();
  const { projectId } = route.params;
  const projectQ = useProject(projectId);
  const [activeTeamspaceId, setActiveTeamspaceId] = useState<string | null>(null);
  const teamspacesQ = useTeamspaces(projectQ.data?.organizationId ?? null);
  const viewsQ = useProjectViews(projectId, activeTeamspaceId);
  const issuesQ = useIssues({ projectId });
  const createView = useCreateProjectView(projectId, activeTeamspaceId);
  const updateView = useUpdateProjectView(projectId, activeTeamspaceId);
  const deleteView = useDeleteProjectView(projectId, activeTeamspaceId);
  const markUsed = useMarkProjectViewUsed();
  const defaultAppliedRef = useRef(false);
  const [viewType, setViewType] = useState<ProjectViewType>('list');
  const [filters, setFilters] = useState<IssueListFilters>(defaultIssueListFilters);
  const [selectedViewId, setSelectedViewId] = useState<string | null>(null);
  const [saveOpen, setSaveOpen] = useState(false);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [scope, setScope] = useState<ProjectViewScope>('project');
  const [isPinned, setIsPinned] = useState(true);
  const [isDefault, setIsDefault] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const views = useMemo(() => viewsQ.data?.views ?? [], [viewsQ.data?.views]);
  const teamspaces = useMemo(() => teamspacesQ.data ?? [], [teamspacesQ.data]);
  const activeTeamspace = useMemo(
    () => teamspaces.find((teamspace) => teamspace.id === activeTeamspaceId) ?? null,
    [activeTeamspaceId, teamspaces],
  );
  const issues = useMemo(() => issuesQ.data ?? [], [issuesQ.data]);
  const visibleIssues = useMemo(
    () => sortByViewType(filterIssues(issues, filters), viewType),
    [filters, issues, viewType],
  );
  const hasFilters = hasActiveIssueFilters(filters);
  const busy = createView.isPending || updateView.isPending || deleteView.isPending;
  const projectKey = viewsQ.data?.project.key || projectQ.data?.key || projectId;

  useEffect(() => {
    defaultAppliedRef.current = false;
    setActiveTeamspaceId(null);
  }, [projectId]);

  useEffect(() => {
    defaultAppliedRef.current = false;
  }, [activeTeamspaceId]);

  useEffect(() => {
    if (teamspaces.length === 0) {
      if (activeTeamspaceId) {
        setActiveTeamspaceId(null);
      }
      setScope((current) => (current === 'teamspace' ? 'project' : current));
      return;
    }

    const projectTeamspaceId = viewsQ.data?.project.teamId ?? null;
    const preferredTeamspaceId =
      projectTeamspaceId && teamspaces.some((teamspace) => teamspace.id === projectTeamspaceId)
        ? projectTeamspaceId
        : teamspaces[0]?.id;
    const activeTeamspaceExists = teamspaces.some(
      (teamspace) => teamspace.id === activeTeamspaceId,
    );

    if (!activeTeamspaceExists && preferredTeamspaceId) {
      setActiveTeamspaceId(preferredTeamspaceId);
    }
  }, [activeTeamspaceId, teamspaces, viewsQ.data?.project.teamId]);

  useEffect(() => {
    if (defaultAppliedRef.current) return;
    const defaultView = views.find((view) => view.isDefault);
    if (!defaultView) return;
    defaultAppliedRef.current = true;
    setSelectedViewId(defaultView.id);
    setViewType(defaultView.viewType);
    setFilters(filtersFromCriteria(defaultView.criteria));
  }, [views]);

  const resetSaveForm = () => {
    setName('');
    setDescription('');
    setScope('project');
    setIsPinned(true);
    setIsDefault(false);
    setFormError(null);
  };

  const applyView = (view: ProjectView) => {
    setSelectedViewId(view.id);
    setViewType(view.viewType);
    if (view.scope === 'teamspace' && view.teamspaceId) {
      setActiveTeamspaceId(view.teamspaceId);
    }
    setFilters(filtersFromCriteria(view.criteria));
    markUsed.mutate(view.id);
  };

  const saveCurrentView = async () => {
    setFormError(null);
    const trimmedName = name.trim();
    if (!trimmedName) {
      setFormError(t('projectViews.nameRequired'));
      return;
    }
    const nextTeamspaceId = scope === 'teamspace' ? (activeTeamspace?.id ?? null) : null;
    if (scope === 'teamspace' && !nextTeamspaceId) {
      setFormError(t('projectViews.teamspaceRequired'));
      return;
    }

    try {
      const view = await createView.mutateAsync({
        name: trimmedName,
        description: description.trim() || null,
        query: `project = ${projectKey}`,
        scope,
        isPinned,
        isDefault,
        isPublic: scope !== 'personal',
        viewType,
        criteria: buildProjectViewCriteria({
          filters,
          scope,
          teamspaceId: nextTeamspaceId,
          viewType,
          isDefault,
        }),
      });
      setSelectedViewId(view.id);
      setSaveOpen(false);
      resetSaveForm();
    } catch (error) {
      setFormError(error instanceof Error ? error.message : t('projectViews.errorGeneric'));
    }
  };

  const updateOwnedView = async (
    view: ProjectView,
    patch: Parameters<typeof updateView.mutateAsync>[0]['patch'],
  ) => {
    setActionError(null);
    try {
      await updateView.mutateAsync({ viewId: view.id, patch });
    } catch (error) {
      setActionError(error instanceof Error ? error.message : t('projectViews.errorGeneric'));
    }
  };

  const confirmDelete = (view: ProjectView) => {
    setActionError(null);
    Alert.alert(
      t('projectViews.deleteTitle'),
      t('projectViews.deleteWarning', { name: view.name }),
      [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('projectViews.delete'),
          style: 'destructive',
          onPress: () => {
            deleteView.mutate(view.id, {
              onError: (error) => {
                setActionError(
                  error instanceof Error ? error.message : t('projectViews.errorGeneric'),
                );
              },
            });
          },
        },
      ],
    );
  };

  if ((viewsQ.isLoading || issuesQ.isLoading) && !viewsQ.data && !issuesQ.data) {
    return <Loading label={t('projectViews.loading')} />;
  }

  if (viewsQ.isError && !viewsQ.data) {
    return (
      <Screen>
        <ErrorView
          message={
            viewsQ.error instanceof Error ? viewsQ.error.message : t('projectViews.loadFailed')
          }
          onRetry={() => void viewsQ.refetch()}
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
            refreshing={
              projectQ.isRefetching ||
              teamspacesQ.isRefetching ||
              viewsQ.isRefetching ||
              issuesQ.isRefetching
            }
            onRefresh={() => {
              void projectQ.refetch();
              void teamspacesQ.refetch();
              void viewsQ.refetch();
              void issuesQ.refetch();
            }}
          />
        }
      >
        <ScreenHeader
          kicker={projectQ.data?.key ?? t('projects.title')}
          title={t('projectViews.title')}
          subtitle={t('projectViews.subtitle')}
          meta={
            <SemanticBadge
              label={t('projectViews.viewsCount', { count: views.length })}
              tone="blue"
            />
          }
        />

        <View style={styles.topActions}>
          <Button
            title={t('issues.new')}
            icon={Plus}
            onPress={() => navigation.navigate('NewIssue', { projectId })}
          />
          <Button
            title={saveOpen ? t('common.cancel') : t('projectViews.saveView')}
            variant="secondary"
            icon={saveOpen ? X : Save}
            onPress={() => {
              setSaveOpen((open) => !open);
              setFormError(null);
            }}
          />
        </View>

        {actionError ? (
          <View style={styles.errorPanel}>
            <Text style={styles.errorText}>{actionError}</Text>
          </View>
        ) : null}

        <TeamspaceSelector
          activeTeamspaceId={activeTeamspaceId}
          loading={teamspacesQ.isLoading}
          loadFailed={teamspacesQ.isError}
          teamspaces={teamspaces}
          onSelect={(teamspaceId) => {
            setActiveTeamspaceId(teamspaceId);
            setSelectedViewId(null);
            defaultAppliedRef.current = false;
          }}
        />

        {saveOpen ? (
          <SurfaceRow className="gap-3">
            <View style={styles.sectionHeader}>
              <IconTile icon={Save} tone="violet" />
              <View style={styles.sectionCopy}>
                <Text style={styles.sectionTitle}>{t('projectViews.saveTitle')}</Text>
                <Text style={styles.sectionSubtitle}>{t('projectViews.saveSubtitle')}</Text>
              </View>
            </View>
            <TextField
              label={t('projectViews.nameLabel')}
              placeholder={t('projectViews.namePlaceholder')}
              value={name}
              onChangeText={setName}
              autoCapitalize="sentences"
            />
            <TextField
              label={t('projectViews.descriptionLabel')}
              placeholder={t('projectViews.descriptionPlaceholder')}
              value={description}
              onChangeText={setDescription}
              autoCapitalize="sentences"
            />
            <View style={styles.choiceSection}>
              <Text style={styles.choiceLabel}>{t('projectViews.scopeLabel')}</Text>
              <View style={styles.choiceRow}>
                <ChoiceChip
                  label={t('projectViews.scope.personal')}
                  selected={scope === 'personal'}
                  onPress={() => setScope('personal')}
                />
                <ChoiceChip
                  label={t('projectViews.scope.project')}
                  selected={scope === 'project'}
                  onPress={() => setScope('project')}
                />
                <ChoiceChip
                  label={t('projectViews.scope.teamspace')}
                  selected={scope === 'teamspace'}
                  disabled={!activeTeamspace}
                  onPress={() => setScope('teamspace')}
                />
              </View>
              {scope === 'teamspace' && activeTeamspace ? (
                <Text style={styles.mutedText}>
                  {t('projectViews.activeTeamspace', { name: activeTeamspace.name })}
                </Text>
              ) : null}
            </View>
            <View style={styles.choiceRow}>
              <ToggleChip
                label={t('projectViews.pinSaved')}
                selected={isPinned}
                onPress={() => setIsPinned((current) => !current)}
              />
              <ToggleChip
                label={t('projectViews.defaultSaved')}
                selected={isDefault}
                onPress={() => setIsDefault((current) => !current)}
              />
            </View>
            {formError ? <Text style={styles.errorText}>{formError}</Text> : null}
            <View style={styles.formActions}>
              <Button
                title={t('projectViews.saveView')}
                icon={Save}
                loading={createView.isPending}
                disabled={busy}
                onPress={() => void saveCurrentView()}
                style={styles.formAction}
              />
              <Button
                title={t('common.cancel')}
                variant="secondary"
                icon={X}
                disabled={busy}
                onPress={() => {
                  setSaveOpen(false);
                  resetSaveForm();
                }}
                style={styles.formAction}
              />
            </View>
          </SurfaceRow>
        ) : null}

        <SurfaceRow className="gap-3">
          <View style={styles.sectionHeader}>
            <IconTile icon={ListFilter} tone="blue" />
            <View style={styles.sectionCopy}>
              <Text style={styles.sectionTitle}>{t('projectViews.views')}</Text>
              <Text style={styles.sectionSubtitle}>{t('projectViews.viewsSubtitle')}</Text>
            </View>
          </View>

          {viewsQ.isLoading ? (
            <Text style={styles.mutedText}>{t('projectViews.loading')}</Text>
          ) : null}
          {!viewsQ.isLoading && views.length === 0 ? (
            <Text style={styles.mutedText}>{t('projectViews.emptyViews')}</Text>
          ) : null}
          <View style={styles.savedViewsList}>
            {views.map((view) => (
              <SavedViewCard
                key={view.id}
                view={view}
                selected={selectedViewId === view.id}
                busy={busy}
                onApply={() => applyView(view)}
                onTogglePinned={() => void updateOwnedView(view, { isPinned: !view.isStarred })}
                onToggleDefault={() => void updateOwnedView(view, { isDefault: !view.isDefault })}
                onDelete={() => confirmDelete(view)}
              />
            ))}
          </View>
        </SurfaceRow>

        <SurfaceRow className="gap-3">
          <View style={styles.viewModeGrid}>
            {VIEW_TYPES.map(({ icon, type }) => (
              <ViewModeButton
                key={type}
                icon={icon}
                label={t(`projectViews.viewType.${type}`)}
                selected={viewType === type}
                onPress={() => setViewType(type)}
              />
            ))}
          </View>
        </SurfaceRow>

        <IssueFilterPanel
          filters={filters}
          onChange={(next) => {
            setFilters(next);
            setSelectedViewId(null);
          }}
          onReset={() => {
            setFilters(defaultIssueListFilters);
            setSelectedViewId(null);
          }}
          totalCount={issues.length}
          visibleCount={visibleIssues.length}
        />

        {issuesQ.isError ? (
          <Text style={styles.errorText}>
            {issuesQ.error instanceof Error ? issuesQ.error.message : t('issues.noMatches')}
          </Text>
        ) : null}

        <View style={styles.resultsHeader}>
          <Text style={styles.resultsTitle}>
            {t('projectViews.results', { count: visibleIssues.length })}
          </Text>
          {hasFilters ? <SemanticBadge label={t('issues.filters')} tone="violet" /> : null}
        </View>

        {viewType === 'board' ? (
          visibleIssues.length > 0 ? (
            <ProjectBoard issues={visibleIssues} />
          ) : (
            <EmptyState
              icon={LayoutGrid}
              title={t('projectViews.noIssues')}
              description={t('issues.noMatchesDesc')}
            />
          )
        ) : viewType === 'timeline' ? (
          <TimelineView
            issues={visibleIssues}
            language={i18n.language}
            onOpenIssue={(id) => navigation.navigate('IssueDetail', { id })}
          />
        ) : viewType === 'calendar' ? (
          <CalendarView
            issues={visibleIssues}
            language={i18n.language}
            onOpenIssue={(id) => navigation.navigate('IssueDetail', { id })}
          />
        ) : visibleIssues.length > 0 ? (
          <View style={styles.issueList}>
            {visibleIssues.map((issue, index) => (
              <View key={issue.id}>
                {index > 0 ? <IssueSeparator /> : null}
                <IssueListItem issue={issue} />
              </View>
            ))}
          </View>
        ) : (
          <EmptyState
            icon={LayoutList}
            title={t('projectViews.noIssues')}
            description={t('issues.noMatchesDesc')}
          />
        )}
      </ScrollView>
    </Screen>
  );
}

function createProjectViewsStyles(colors: ThemeColors) {
  return StyleSheet.create({
    content: {
      gap: 12,
      paddingBottom: 20,
    },
    topActions: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 10,
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
    mutedText: {
      color: colors.mutedForeground,
      fontSize: 13,
      lineHeight: 18,
    },
    choiceSection: {
      gap: 8,
    },
    choiceLabel: {
      color: colors.foreground,
      fontSize: 14,
      fontWeight: '700',
      lineHeight: 20,
    },
    choiceRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 8,
    },
    choiceChip: {
      minHeight: 34,
      justifyContent: 'center',
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
      borderRadius: 4,
      backgroundColor: colors.surface,
      paddingHorizontal: 10,
      paddingVertical: 7,
    },
    choiceChipActive: {
      borderColor: colors.primary,
      backgroundColor: colors.primary,
    },
    choiceChipDisabled: {
      opacity: 0.5,
    },
    choiceChipText: {
      color: colors.foreground,
      fontSize: 12,
      fontWeight: '700',
      lineHeight: 16,
    },
    choiceChipTextActive: {
      color: colors.primaryForeground,
    },
    choiceChipTextDisabled: {
      color: colors.mutedForeground,
    },
    toggleChip: {
      minHeight: 38,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 7,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
      borderRadius: 4,
      backgroundColor: colors.surface,
      paddingHorizontal: 10,
      paddingVertical: 8,
    },
    toggleChipActive: {
      borderColor: colors.primary,
      backgroundColor: colors.primary,
    },
    toggleChipText: {
      color: colors.foreground,
      fontSize: 12,
      fontWeight: '700',
      lineHeight: 16,
    },
    toggleChipTextActive: {
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
    savedViewsList: {
      gap: 10,
    },
    savedViewBody: {
      gap: 8,
    },
    savedViewHeader: {
      gap: 8,
    },
    savedViewTitleWrap: {
      minWidth: 0,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
    },
    savedViewTitle: {
      minWidth: 0,
      flex: 1,
      color: colors.foreground,
      fontSize: 15,
      fontWeight: '700',
      lineHeight: 21,
    },
    savedViewDescription: {
      color: colors.mutedForeground,
      fontSize: 13,
      lineHeight: 18,
    },
    badgeRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 6,
    },
    criteriaRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 6,
    },
    criteriaChip: {
      maxWidth: '100%',
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
      borderRadius: 4,
      backgroundColor: colors.surface,
      paddingHorizontal: 8,
      paddingVertical: 4,
    },
    criteriaText: {
      color: colors.mutedForeground,
      fontSize: 11,
      fontWeight: '700',
      lineHeight: 15,
    },
    savedViewActions: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 8,
    },
    savedViewAction: {
      minWidth: 128,
      flex: 1,
    },
    viewModeGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 8,
    },
    viewModeButton: {
      minHeight: 38,
      minWidth: 132,
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 7,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
      borderRadius: 4,
      backgroundColor: colors.surface,
      paddingHorizontal: 10,
      paddingVertical: 8,
    },
    viewModeButtonActive: {
      borderColor: colors.primary,
      backgroundColor: colors.primary,
    },
    viewModeText: {
      minWidth: 0,
      color: colors.foreground,
      fontSize: 12,
      fontWeight: '700',
      lineHeight: 16,
    },
    viewModeTextActive: {
      color: colors.primaryForeground,
    },
    resultsHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 10,
      paddingHorizontal: 16,
    },
    resultsTitle: {
      color: colors.foreground,
      fontSize: 15,
      fontWeight: '700',
      lineHeight: 21,
    },
    issueList: {
      gap: 8,
    },
    previewCard: {
      gap: 8,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
      borderRadius: 6,
      backgroundColor: colors.surface,
      padding: 10,
    },
    previewHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 8,
    },
    previewKey: {
      minWidth: 0,
      flex: 1,
      color: colors.mutedForeground,
      fontSize: 12,
      fontWeight: '700',
      lineHeight: 16,
    },
    previewTitle: {
      color: colors.foreground,
      fontSize: 14,
      fontWeight: '700',
      lineHeight: 19,
    },
    calendarDay: {
      gap: 8,
    },
    calendarIssues: {
      gap: 8,
    },
  });
}
