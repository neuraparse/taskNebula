import {
  FlatList,
  Pressable,
  RefreshControl,
  ScrollView,
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
import { Alert } from 'react-native';
import { Bookmark, Globe2, Lock, ListTodo, Plus, Save, Star, Trash2 } from 'lucide-react-native';
import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';

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
  apiFiltersFromIssueListFilters,
  defaultIssueListFilters,
  filterIssues,
  hasActiveIssueFilters,
  issueListFiltersFromRouteParams,
  IssueFilterPanel,
  type IssueListFilters,
} from '@/components/issue-filters';
import { FeaturedIssueCard, IssueListItem, IssueSeparator } from '@/components/issue-list';
import type { ThemeColors } from '@/design/theme';
import { useThemeColors } from '@/design/theme-context';
import {
  useCreateSavedIssueFilter,
  useDeleteSavedIssueFilter,
  useIssues,
  useMarkSavedIssueFilterUsed,
  useMe,
  useOrganizations,
  useSavedIssueFilters,
  useUpdateSavedIssueFilter,
} from '@/hooks/queries';
import { filtersFromCriteria } from '@/lib/project-views';
import type { Issue, SavedIssueFilter } from '@/api/types';
import type { AppStackParamList } from '@/navigation/types';

type IssuesListRoute = RouteProp<AppStackParamList, 'IssuesList'>;
type IssuesScreenStyles = ReturnType<typeof createIssuesScreenStyles>;

function useIssuesScreenTheme(): { colors: ThemeColors; styles: IssuesScreenStyles } {
  const colors = useThemeColors();
  const styles = useMemo(() => createIssuesScreenStyles(colors), [colors]);
  return { colors, styles };
}

function buildSavedIssueFilterCriteria(filters: IssueListFilters): Record<string, unknown> {
  return {
    search: filters.query,
    query: filters.query,
    status: filters.status,
    sprintId: filters.sprintId,
    type: filters.type,
    visibleColumns: ['key', 'title', 'status', 'priority', 'assignee', 'updatedAt'],
    sort: {
      field: 'updatedAt',
      direction: 'desc',
    },
  };
}

function savedIssueFilterQuery(filters: IssueListFilters): string {
  const parts: string[] = [];
  const query = filters.query.trim();
  if (query) parts.push(`search:${query}`);
  if (filters.status !== 'all') parts.push(`status:${filters.status}`);
  if (filters.type !== 'all') parts.push(`type:${filters.type}`);
  if (filters.sprintId !== 'all') parts.push(`sprint:${filters.sprintId}`);
  return parts.join(' ') || 'issues:all';
}

function useIssueFilterSummary() {
  const { t } = useTranslation();

  return (filters: IssueListFilters) => {
    const parts: string[] = [];
    const query = filters.query.trim();
    if (query) parts.push(query);
    if (filters.status !== 'all') parts.push(t(`statusCategory.${filters.status}`));
    if (filters.type !== 'all') parts.push(t(`issueType.${filters.type}`));
    if (filters.sprintId === 'none') {
      parts.push(t('issues.savedFilters.noSprint'));
    } else if (filters.sprintId !== 'all') {
      parts.push(t('issues.savedFilters.sprintSelected'));
    }
    return parts.length > 0 ? parts.join(' / ') : t('issues.savedFilters.allIssues');
  };
}

function SavedFilterCard({
  currentUserId,
  filter,
  onApply,
  onDelete,
  onToggleStar,
  summary,
}: {
  currentUserId: string | null;
  filter: SavedIssueFilter;
  onApply: (filter: SavedIssueFilter) => void;
  onDelete: (filter: SavedIssueFilter) => void;
  onToggleStar: (filter: SavedIssueFilter) => void;
  summary: string;
}) {
  const { t } = useTranslation();
  const { colors, styles } = useIssuesScreenTheme();
  const isOwned = !filter.userId || filter.userId === currentUserId;
  const VisibilityIcon = filter.isPublic ? Globe2 : Lock;

  return (
    <View style={styles.savedFilterCard}>
      <Pressable
        accessibilityRole="button"
        onPress={() => onApply(filter)}
        style={styles.savedFilterApply}
        className="active:opacity-80"
      >
        <View style={styles.savedFilterTitleRow}>
          <VisibilityIcon size={13} color={colors.mutedForeground} />
          <Text style={styles.savedFilterName} numberOfLines={1}>
            {filter.name}
          </Text>
          {filter.isStarred ? (
            <Star size={13} color={colors.accentAmber} fill={colors.accentAmber} />
          ) : null}
        </View>
        <Text style={styles.savedFilterSummary} numberOfLines={2}>
          {summary}
        </Text>
        <Text style={styles.savedFilterMeta} numberOfLines={1}>
          {filter.isPublic ? t('issues.savedFilters.public') : t('issues.savedFilters.private')}
          {filter.usageCount > 0
            ? ` / ${t('issues.savedFilters.usageCount', { count: filter.usageCount })}`
            : ''}
        </Text>
      </Pressable>
      {isOwned ? (
        <View style={styles.savedFilterActions}>
          <Pressable
            accessibilityLabel={
              filter.isStarred ? t('issues.savedFilters.unstar') : t('issues.savedFilters.star')
            }
            accessibilityRole="button"
            onPress={() => onToggleStar(filter)}
            style={styles.savedFilterIconButton}
            className="active:opacity-80"
          >
            <Star
              size={15}
              color={filter.isStarred ? colors.accentAmber : colors.mutedForeground}
              fill={filter.isStarred ? colors.accentAmber : 'transparent'}
            />
          </Pressable>
          <Pressable
            accessibilityLabel={t('issues.savedFilters.delete')}
            accessibilityRole="button"
            onPress={() => onDelete(filter)}
            style={styles.savedFilterIconButton}
            className="active:opacity-80"
          >
            <Trash2 size={15} color={colors.destructive} />
          </Pressable>
        </View>
      ) : null}
    </View>
  );
}

function SavedIssueFiltersPanel({
  filters,
  issues,
  onFiltersChange,
}: {
  filters: IssueListFilters;
  issues: Issue[];
  onFiltersChange: (filters: IssueListFilters) => void;
}) {
  const { t } = useTranslation();
  const { styles } = useIssuesScreenTheme();
  const summarize = useIssueFilterSummary();
  const meQ = useMe();
  const organizationsQ = useOrganizations();
  const organizationId =
    organizationsQ.data?.organizations[0]?.id ??
    issues.find((issue) => issue.organizationId)?.organizationId ??
    null;
  const currentUserId = meQ.data?.id ?? null;
  const savedFiltersQ = useSavedIssueFilters(organizationId, null, !!organizationId);
  const createFilter = useCreateSavedIssueFilter(organizationId, null);
  const updateFilter = useUpdateSavedIssueFilter(organizationId, null);
  const deleteFilter = useDeleteSavedIssueFilter(organizationId, null);
  const markFilterUsed = useMarkSavedIssueFilterUsed(organizationId, null);
  const [saveName, setSaveName] = useState('');
  const [actionError, setActionError] = useState<string | null>(null);
  const savedFilters = savedFiltersQ.data ?? [];
  const busy = createFilter.isPending || updateFilter.isPending || deleteFilter.isPending;

  const saveCurrentFilter = () => {
    setActionError(null);
    const name = saveName.trim();
    if (!organizationId) {
      setActionError(t('issues.savedFilters.errorNoOrganization'));
      return;
    }
    if (!name) {
      setActionError(t('issues.savedFilters.errorNameRequired'));
      return;
    }

    createFilter.mutate(
      {
        organizationId,
        projectId: null,
        name,
        query: savedIssueFilterQuery(filters),
        criteria: buildSavedIssueFilterCriteria(filters),
        isStarred: true,
        viewType: 'list',
        sortBy: 'updated_at',
        sortOrder: 'desc',
      },
      {
        onSuccess: () => {
          setSaveName('');
        },
        onError: (error) => {
          setActionError(
            error instanceof Error ? error.message : t('issues.savedFilters.errorGeneric'),
          );
        },
      },
    );
  };

  const applySavedFilter = (filter: SavedIssueFilter) => {
    setActionError(null);
    onFiltersChange(filtersFromCriteria(filter.criteria));
    if (!filter.userId || filter.userId === currentUserId) {
      markFilterUsed.mutate(filter.id);
    }
  };

  const toggleStar = (filter: SavedIssueFilter) => {
    setActionError(null);
    updateFilter.mutate(
      { filterId: filter.id, patch: { isStarred: !filter.isStarred } },
      {
        onError: (error) => {
          setActionError(
            error instanceof Error ? error.message : t('issues.savedFilters.errorGeneric'),
          );
        },
      },
    );
  };

  const confirmDelete = (filter: SavedIssueFilter) => {
    setActionError(null);
    Alert.alert(
      t('issues.savedFilters.deleteTitle'),
      t('issues.savedFilters.deleteWarning', { name: filter.name }),
      [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('issues.savedFilters.delete'),
          style: 'destructive',
          onPress: () => {
            deleteFilter.mutate(filter.id, {
              onError: (error) => {
                setActionError(
                  error instanceof Error ? error.message : t('issues.savedFilters.errorGeneric'),
                );
              },
            });
          },
        },
      ],
    );
  };

  return (
    <SurfaceRow className="gap-3">
      <View style={styles.savedHeader}>
        <View style={styles.savedHeaderCopy}>
          <IconTile icon={Bookmark} tone="blue" />
          <View style={styles.savedTitleCopy}>
            <Text style={styles.savedTitle}>{t('issues.savedFilters.title')}</Text>
            <Text style={styles.savedSubtitle}>{t('issues.savedFilters.subtitle')}</Text>
          </View>
        </View>
        <SemanticBadge label={t('issues.savedFilters.current')} tone="blue" />
      </View>

      <View style={styles.saveForm}>
        <View style={styles.saveField}>
          <TextField
            label={t('issues.savedFilters.nameLabel')}
            placeholder={t('issues.savedFilters.namePlaceholder')}
            value={saveName}
            onChangeText={setSaveName}
            autoCapitalize="sentences"
          />
        </View>
        <Button
          title={t('issues.savedFilters.save')}
          icon={Save}
          loading={createFilter.isPending}
          disabled={busy || !organizationId}
          onPress={saveCurrentFilter}
          style={styles.saveButton}
        />
      </View>

      <Text style={styles.currentFilterSummary}>{summarize(filters)}</Text>

      {actionError ? <Text style={styles.savedError}>{actionError}</Text> : null}
      {!organizationId && !organizationsQ.isLoading ? (
        <Text style={styles.savedError}>{t('issues.savedFilters.errorNoOrganization')}</Text>
      ) : null}
      {savedFiltersQ.isError ? (
        <Text style={styles.savedError}>{t('issues.savedFilters.loadFailed')}</Text>
      ) : null}
      {savedFiltersQ.isLoading || organizationsQ.isLoading ? (
        <Text style={styles.savedMuted}>{t('issues.savedFilters.loading')}</Text>
      ) : null}
      {organizationId &&
      !savedFiltersQ.isLoading &&
      !organizationsQ.isLoading &&
      savedFilters.length === 0 ? (
        <Text style={styles.savedMuted}>{t('issues.savedFilters.empty')}</Text>
      ) : null}

      {savedFilters.length > 0 ? (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.savedFilterList}
        >
          {savedFilters.map((filter) => (
            <SavedFilterCard
              key={filter.id}
              currentUserId={currentUserId}
              filter={filter}
              onApply={applySavedFilter}
              onDelete={confirmDelete}
              onToggleStar={toggleStar}
              summary={summarize(filtersFromCriteria(filter.criteria))}
            />
          ))}
        </ScrollView>
      ) : null}
    </SurfaceRow>
  );
}

function IssuesListHeader({
  filters,
  issues,
  onFiltersChange,
  onResetFilters,
  totalCount,
}: {
  filters: IssueListFilters;
  issues: Issue[];
  onFiltersChange: (filters: IssueListFilters) => void;
  onResetFilters: () => void;
  totalCount: number;
}) {
  const { t } = useTranslation();
  const { styles } = useIssuesScreenTheme();
  const navigation = useNavigation<NavigationProp<AppStackParamList>>();
  const latest = issues[0];

  return (
    <View>
      <ScreenHeader
        kicker={t('common.appName')}
        title={t('issues.title')}
        subtitle={t('issues.subtitle')}
        meta={<SemanticBadge label={t('issues.count', { count: issues.length })} tone="violet" />}
      />
      <View style={styles.headerActions}>
        <Button
          title={t('issues.new')}
          icon={Plus}
          onPress={() => navigation.navigate('NewIssue')}
        />
      </View>
      <View style={styles.filterWrap}>
        <IssueFilterPanel
          filters={filters}
          onChange={onFiltersChange}
          onReset={onResetFilters}
          totalCount={totalCount}
          visibleCount={issues.length}
        />
      </View>
      <View style={styles.savedFiltersWrap}>
        <SavedIssueFiltersPanel
          filters={filters}
          issues={issues}
          onFiltersChange={onFiltersChange}
        />
      </View>
      {latest ? (
        <View style={styles.featuredWrap}>
          <FeaturedIssueCard issue={latest} />
        </View>
      ) : null}
    </View>
  );
}

function IssueListEmpty({ filtered }: { filtered: boolean }) {
  const { t } = useTranslation();

  return (
    <EmptyState
      icon={ListTodo}
      title={filtered ? t('issues.noMatches') : t('issues.empty')}
      description={filtered ? t('issues.noMatchesDesc') : t('issues.emptyDesc')}
    />
  );
}

function IssuesList({
  issues,
  filters,
  onFiltersChange,
  onResetFilters,
  refetch,
  totalCount,
  isRefetching,
}: {
  issues: Issue[];
  filters: IssueListFilters;
  onFiltersChange: (filters: IssueListFilters) => void;
  onResetFilters: () => void;
  refetch: () => unknown;
  totalCount: number;
  isRefetching: boolean;
}) {
  const { styles } = useIssuesScreenTheme();
  const renderItem: ListRenderItem<Issue> = ({ item }) => <IssueListItem issue={item} />;
  const filtered = hasActiveIssueFilters(filters);

  return (
    <FlatList
      data={issues}
      keyExtractor={(i) => i.id}
      renderItem={renderItem}
      ItemSeparatorComponent={IssueSeparator}
      ListHeaderComponent={
        <IssuesListHeader
          filters={filters}
          issues={issues}
          onFiltersChange={onFiltersChange}
          onResetFilters={onResetFilters}
          totalCount={totalCount}
        />
      }
      contentContainerStyle={styles.listContent}
      refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={() => void refetch()} />}
      ListEmptyComponent={<IssueListEmpty filtered={filtered} />}
    />
  );
}

export function IssuesScreen() {
  const { t } = useTranslation();
  const route = useRoute<IssuesListRoute>();
  const routeFilters = useMemo(() => issueListFiltersFromRouteParams(route.params), [route.params]);
  const [filters, setFilters] = useState<IssueListFilters>(routeFilters);
  const apiFilters = useMemo(() => apiFiltersFromIssueListFilters(filters), [filters]);
  const { data, isLoading, isError, error, refetch, isRefetching } = useIssues(apiFilters);
  const issues = useMemo(() => data ?? [], [data]);
  const visibleIssues = useMemo(() => filterIssues(issues, filters), [filters, issues]);

  useEffect(() => {
    setFilters(routeFilters);
  }, [routeFilters]);

  if (isLoading) return <Loading />;
  if (isError) {
    return (
      <Screen>
        <ErrorView
          message={error instanceof Error ? error.message : t('common.retry')}
          onRetry={() => void refetch()}
        />
      </Screen>
    );
  }

  return (
    <Screen>
      <IssuesList
        issues={visibleIssues}
        filters={filters}
        onFiltersChange={setFilters}
        onResetFilters={() => setFilters(defaultIssueListFilters)}
        refetch={refetch}
        totalCount={issues.length}
        isRefetching={isRefetching}
      />
    </Screen>
  );
}

function createIssuesScreenStyles(colors: ThemeColors) {
  return StyleSheet.create({
    listContent: {
      paddingBottom: 16,
    },
    featuredWrap: {
      paddingHorizontal: 16,
      paddingBottom: 12,
    },
    headerActions: {
      paddingHorizontal: 16,
      paddingBottom: 12,
    },
    filterWrap: {
      paddingHorizontal: 16,
      paddingBottom: 12,
    },
    savedFiltersWrap: {
      paddingHorizontal: 16,
      paddingBottom: 12,
    },
    savedHeader: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      justifyContent: 'space-between',
      gap: 12,
    },
    savedHeaderCopy: {
      minWidth: 0,
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
    },
    savedTitleCopy: {
      minWidth: 0,
      flex: 1,
      gap: 2,
    },
    savedTitle: {
      color: colors.foreground,
      fontSize: 16,
      fontWeight: '700',
      lineHeight: 22,
    },
    savedSubtitle: {
      color: colors.mutedForeground,
      fontSize: 13,
      lineHeight: 18,
    },
    saveForm: {
      flexDirection: 'row',
      alignItems: 'flex-end',
      gap: 10,
    },
    saveField: {
      minWidth: 0,
      flex: 1,
    },
    saveButton: {
      minWidth: 112,
    },
    currentFilterSummary: {
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
      borderRadius: 4,
      backgroundColor: colors.background,
      color: colors.mutedForeground,
      fontSize: 12,
      fontWeight: '600',
      lineHeight: 16,
      paddingHorizontal: 10,
      paddingVertical: 8,
    },
    savedMuted: {
      color: colors.mutedForeground,
      fontSize: 13,
      lineHeight: 18,
    },
    savedError: {
      color: colors.destructive,
      fontSize: 13,
      lineHeight: 18,
    },
    savedFilterList: {
      gap: 10,
      paddingRight: 2,
    },
    savedFilterCard: {
      width: 246,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
      borderRadius: 4,
      backgroundColor: colors.card,
    },
    savedFilterApply: {
      gap: 6,
      padding: 10,
    },
    savedFilterTitleRow: {
      minWidth: 0,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
    },
    savedFilterName: {
      minWidth: 0,
      flex: 1,
      color: colors.foreground,
      fontSize: 13,
      fontWeight: '700',
      lineHeight: 18,
    },
    savedFilterSummary: {
      color: colors.mutedForeground,
      fontSize: 12,
      lineHeight: 16,
    },
    savedFilterMeta: {
      color: colors.mutedForeground,
      fontSize: 11,
      fontWeight: '600',
      lineHeight: 15,
    },
    savedFilterActions: {
      flexDirection: 'row',
      justifyContent: 'flex-end',
      gap: 4,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: colors.border,
      paddingHorizontal: 6,
      paddingVertical: 5,
    },
    savedFilterIconButton: {
      width: 34,
      height: 30,
      alignItems: 'center',
      justifyContent: 'center',
      borderRadius: 4,
    },
  });
}
