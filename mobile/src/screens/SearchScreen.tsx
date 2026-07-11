import { useEffect, useMemo, useState } from 'react';
import {
  FlatList,
  Pressable,
  RefreshControl,
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
import {
  BookOpen,
  Clock3,
  FileText,
  MessageSquareText,
  Pin,
  PinOff,
  Search,
} from 'lucide-react-native';
import { useTranslation } from 'react-i18next';

import type {
  DocumentPageSummary,
  OrganizationMember,
  SearchHistoryEntry,
  SearchResult,
} from '@/api/types';
import {
  EmptyState,
  ErrorView,
  Avatar,
  Screen,
  ScreenHeader,
  SemanticBadge,
  TextField,
} from '@/components/ui';
import type { ThemeColors } from '@/design/theme';
import { useThemeColors } from '@/design/theme-context';
import {
  useOrganizations,
  useOrganizationMembers,
  useSearchDocumentPages,
  useSearchHistory,
  useSearchIssues,
  useUpdateSearchHistoryPinned,
} from '@/hooks/queries';
import type { AppStackParamList } from '@/navigation/types';

type GlobalSearchItem =
  | { kind: 'issue'; result: SearchResult }
  | { kind: 'document'; page: DocumentPageSummary }
  | { kind: 'person'; member: OrganizationMember };
type SearchScreenStyles = ReturnType<typeof createSearchScreenStyles>;

function useSearchScreenTheme(): { colors: ThemeColors; styles: SearchScreenStyles } {
  const colors = useThemeColors();
  const styles = useMemo(() => createSearchScreenStyles(colors), [colors]);
  return { colors, styles };
}

function cleanSnippet(value?: string | null): string {
  return (
    value
      ?.replace(/<[^>]*>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim() ?? ''
  );
}

function useDebouncedValue(value: string, delayMs: number): string {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const handle = setTimeout(() => setDebounced(value), delayMs);
    return () => clearTimeout(handle);
  }, [delayMs, value]);
  return debounced;
}

function memberInitials(name: string | null | undefined, email: string | null | undefined): string {
  const source = (name ?? email ?? '').trim();
  if (!source) return '?';
  const parts = source.split(/\s+/).filter(Boolean);
  const raw =
    parts.length >= 2 ? `${parts[0]?.[0] ?? ''}${parts[1]?.[0] ?? ''}` : source.slice(0, 2);
  return raw.toUpperCase();
}

function memberRoleLabel(role: string, t: ReturnType<typeof useTranslation>['t']): string {
  if (role === 'owner') return t('team.role.owner');
  if (role === 'admin') return t('team.role.admin');
  if (role === 'member') return t('team.role.member');
  if (role === 'viewer') return t('team.role.viewer');
  if (role === 'guest') return t('team.role.guest');
  return role;
}

function SearchResultRow({ result }: { result: SearchResult }) {
  const { t } = useTranslation();
  const navigation = useNavigation<NavigationProp<AppStackParamList>>();
  const { colors, styles } = useSearchScreenTheme();
  const isComment = result.entityType === 'comment';
  const Icon = isComment ? MessageSquareText : FileText;
  const snippet = cleanSnippet(result.snippet);

  return (
    <Pressable
      accessibilityRole="button"
      onPress={() => navigation.navigate('IssueDetail', { id: result.issueId })}
      style={styles.resultRow}
      className="active:opacity-80"
    >
      <View style={styles.resultIcon}>
        <Icon size={17} color={isComment ? colors.accentViolet : colors.accentBlue} />
      </View>
      <View style={styles.resultBody}>
        <View style={styles.resultMeta}>
          {result.key ? <SemanticBadge label={result.key} tone="blue" /> : null}
          <SemanticBadge
            label={isComment ? t('globalSearch.commentResult') : t('globalSearch.issueResult')}
            tone={isComment ? 'violet' : 'cyan'}
          />
        </View>
        <Text className="text-foreground text-sm font-semibold" numberOfLines={2}>
          {result.title}
        </Text>
        {snippet ? (
          <Text style={styles.snippet} numberOfLines={2}>
            {snippet}
          </Text>
        ) : null}
      </View>
    </Pressable>
  );
}

function DocumentSearchResultRow({ page }: { page: DocumentPageSummary }) {
  const { t } = useTranslation();
  const navigation = useNavigation<NavigationProp<AppStackParamList>>();
  const { colors, styles } = useSearchScreenTheme();
  const snippet = cleanSnippet(page.excerpt);

  return (
    <Pressable
      accessibilityRole="button"
      onPress={() => navigation.navigate('DocumentDetail', { id: page.id })}
      style={styles.resultRow}
      className="active:opacity-80"
    >
      <View style={styles.resultIcon}>
        {page.icon ? (
          <Text style={styles.resultIconText}>{page.icon}</Text>
        ) : (
          <BookOpen size={17} color={colors.accentEmerald} />
        )}
      </View>
      <View style={styles.resultBody}>
        <View style={styles.resultMeta}>
          {page.spaceName ? <SemanticBadge label={page.spaceName} tone="cyan" /> : null}
          <SemanticBadge label={t('globalSearch.docResult')} tone="emerald" />
        </View>
        <Text className="text-foreground text-sm font-semibold" numberOfLines={2}>
          {page.title}
        </Text>
        {snippet ? (
          <Text style={styles.snippet} numberOfLines={2}>
            {snippet}
          </Text>
        ) : null}
      </View>
    </Pressable>
  );
}

function PersonSearchResultRow({ member }: { member: OrganizationMember }) {
  const { t } = useTranslation();
  const navigation = useNavigation<NavigationProp<AppStackParamList>>();
  const { styles } = useSearchScreenTheme();
  const displayName = member.name ?? member.email;
  const subtitle = member.name ? member.email : null;

  return (
    <Pressable
      accessibilityRole="button"
      onPress={() => navigation.navigate('MainTabs', { screen: 'Team' })}
      style={styles.resultRow}
      className="active:opacity-80"
    >
      <Avatar initials={memberInitials(member.name, member.email)} size={34} />
      <View style={styles.resultBody}>
        <View style={styles.resultMeta}>
          <SemanticBadge label={t('globalSearch.personResult')} tone="violet" />
          <SemanticBadge label={memberRoleLabel(member.role, t)} tone="neutral" />
        </View>
        <Text className="text-foreground text-sm font-semibold" numberOfLines={2}>
          {displayName}
        </Text>
        {subtitle ? (
          <Text style={styles.snippet} numberOfLines={1}>
            {subtitle}
          </Text>
        ) : null}
      </View>
    </Pressable>
  );
}

function SearchHistoryRow({
  entry,
  toggling,
  onSelect,
  onTogglePinned,
}: {
  entry: SearchHistoryEntry;
  toggling: boolean;
  onSelect: (query: string) => void;
  onTogglePinned: (entry: SearchHistoryEntry) => void;
}) {
  const { t } = useTranslation();
  const { colors, styles } = useSearchScreenTheme();
  const Icon = entry.pinned ? Pin : Clock3;

  return (
    <View style={styles.historyRow}>
      <Pressable
        accessibilityRole="button"
        onPress={() => onSelect(entry.query)}
        style={styles.historyMain}
        className="active:opacity-80"
      >
        <View style={styles.resultIcon}>
          <Icon size={16} color={entry.pinned ? colors.accentAmber : colors.mutedForeground} />
        </View>
        <View style={styles.resultBody}>
          <Text className="text-foreground text-sm font-semibold" numberOfLines={1}>
            {entry.query}
          </Text>
          <Text style={styles.snippet} numberOfLines={1}>
            {t('globalSearch.historyResultCount', { count: entry.resultCount })}
          </Text>
        </View>
      </Pressable>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={
          entry.pinned ? t('globalSearch.unpinQuery') : t('globalSearch.pinQuery')
        }
        disabled={toggling}
        onPress={() => onTogglePinned(entry)}
        style={[styles.historyPinButton, toggling ? styles.disabled : null]}
        className="active:opacity-80"
      >
        {entry.pinned ? (
          <PinOff size={16} color={colors.mutedForeground} />
        ) : (
          <Pin size={16} color={colors.mutedForeground} />
        )}
      </Pressable>
    </View>
  );
}

function SearchHistorySection({
  actionError,
  error,
  loading,
  pinned,
  recents,
  togglingId,
  onSelect,
  onTogglePinned,
}: {
  actionError: string | null;
  error: boolean;
  loading: boolean;
  pinned: SearchHistoryEntry[];
  recents: SearchHistoryEntry[];
  togglingId: string | null;
  onSelect: (query: string) => void;
  onTogglePinned: (entry: SearchHistoryEntry) => void;
}) {
  const { t } = useTranslation();
  const { styles } = useSearchScreenTheme();
  const hasHistory = pinned.length > 0 || recents.length > 0;

  if (loading && !hasHistory) {
    return (
      <EmptyState
        icon={Search}
        title={t('globalSearch.searching')}
        description={t('globalSearch.readyHint')}
      />
    );
  }

  if (!hasHistory) {
    return (
      <EmptyState
        icon={Search}
        title={t('globalSearch.readyTitle')}
        description={t('globalSearch.readyHint')}
      />
    );
  }

  return (
    <View style={styles.historyPanel}>
      {error ? (
        <Text style={styles.historyError}>{t('globalSearch.historyLoadFailed')}</Text>
      ) : null}
      {actionError ? <Text style={styles.historyError}>{actionError}</Text> : null}
      {pinned.length > 0 ? (
        <View style={styles.historyGroup}>
          <Text style={styles.historyGroupTitle}>{t('globalSearch.pinned')}</Text>
          {pinned.map((entry) => (
            <SearchHistoryRow
              key={entry.id}
              entry={entry}
              toggling={togglingId === entry.id}
              onSelect={onSelect}
              onTogglePinned={onTogglePinned}
            />
          ))}
        </View>
      ) : null}
      {recents.length > 0 ? (
        <View style={styles.historyGroup}>
          <Text style={styles.historyGroupTitle}>{t('globalSearch.recents')}</Text>
          {recents.map((entry) => (
            <SearchHistoryRow
              key={entry.id}
              entry={entry}
              toggling={togglingId === entry.id}
              onSelect={onSelect}
              onTogglePinned={onTogglePinned}
            />
          ))}
        </View>
      ) : null}
    </View>
  );
}

function SearchHeader({
  count,
  query,
  onQueryChange,
}: {
  count: number;
  query: string;
  onQueryChange: (value: string) => void;
}) {
  const { t } = useTranslation();
  const { styles } = useSearchScreenTheme();

  return (
    <View>
      <ScreenHeader
        kicker={t('common.appName')}
        title={t('globalSearch.title')}
        meta={<SemanticBadge label={t('globalSearch.resultCount', { count })} tone="cyan" />}
      />
      <View style={styles.searchWrap}>
        <TextField
          label={t('globalSearch.queryLabel')}
          placeholder={t('globalSearch.placeholder')}
          value={query}
          onChangeText={onQueryChange}
          autoCapitalize="none"
          autoCorrect={false}
          returnKeyType="search"
        />
      </View>
    </View>
  );
}

export function SearchScreen() {
  const { t } = useTranslation();
  const { styles } = useSearchScreenTheme();
  const route = useRoute<RouteProp<AppStackParamList, 'Search'>>();
  const routeQuery = route.params?.query?.trim() ?? '';
  const [query, setQuery] = useState(routeQuery);
  const [historyActionError, setHistoryActionError] = useState<string | null>(null);
  const [togglingHistoryId, setTogglingHistoryId] = useState<string | null>(null);
  const debouncedQuery = useDebouncedValue(query, 180);
  const canSearch = debouncedQuery.trim().length >= 2;
  const searchQ = useSearchIssues(debouncedQuery);
  const organizationsQ = useOrganizations();
  const organizationId = organizationsQ.data?.organizations[0]?.id ?? null;
  const memberSearchEnabled = canSearch && !!organizationId;
  const documentSearchQ = useSearchDocumentPages(
    debouncedQuery,
    organizationId ? { organizationId } : {},
  );
  const organizationMembersQ = useOrganizationMembers(organizationId, memberSearchEnabled);
  const showHistory = query.trim().length === 0;
  const pinnedHistoryQ = useSearchHistory(organizationId, true, showHistory);
  const recentHistoryQ = useSearchHistory(organizationId, false, showHistory);
  const updateHistoryPinned = useUpdateSearchHistoryPinned(organizationId);
  const issueResults = useMemo(() => searchQ.data?.results ?? [], [searchQ.data?.results]);
  const documentResults = useMemo(
    () => documentSearchQ.data?.results ?? [],
    [documentSearchQ.data?.results],
  );
  const personResults = useMemo(() => {
    const normalizedQuery = debouncedQuery.trim().toLowerCase();
    if (!normalizedQuery) return [];
    return (organizationMembersQ.data?.members ?? [])
      .filter((member) =>
        [member.name, member.email, member.role]
          .filter(Boolean)
          .join(' ')
          .toLowerCase()
          .includes(normalizedQuery),
      )
      .slice(0, 6);
  }, [debouncedQuery, organizationMembersQ.data?.members]);
  const results = useMemo<GlobalSearchItem[]>(
    () => [
      ...issueResults.map((result) => ({ kind: 'issue' as const, result })),
      ...documentResults.map((page) => ({ kind: 'document' as const, page })),
      ...personResults.map((member) => ({ kind: 'person' as const, member })),
    ],
    [documentResults, issueResults, personResults],
  );
  const pinnedHistory = useMemo(() => pinnedHistoryQ.data ?? [], [pinnedHistoryQ.data]);
  const recentHistory = useMemo(
    () => (recentHistoryQ.data ?? []).filter((entry) => !entry.pinned),
    [recentHistoryQ.data],
  );
  const renderItem: ListRenderItem<GlobalSearchItem> = ({ item }) =>
    item.kind === 'issue' ? (
      <SearchResultRow result={item.result} />
    ) : item.kind === 'document' ? (
      <DocumentSearchResultRow page={item.page} />
    ) : (
      <PersonSearchResultRow member={item.member} />
    );
  const historyLoading =
    showHistory &&
    (organizationsQ.isLoading || pinnedHistoryQ.isLoading || recentHistoryQ.isLoading);
  const historyError = pinnedHistoryQ.isError || recentHistoryQ.isError;
  const searchLoading =
    searchQ.isFetching ||
    documentSearchQ.isFetching ||
    (memberSearchEnabled && organizationMembersQ.isFetching);
  const searchError =
    searchQ.isError &&
    documentSearchQ.isError &&
    (!memberSearchEnabled || organizationMembersQ.isError);

  useEffect(() => {
    setQuery((current) => (current === routeQuery ? current : routeQuery));
  }, [routeQuery]);

  const toggleHistoryPinned = async (entry: SearchHistoryEntry) => {
    setHistoryActionError(null);
    setTogglingHistoryId(entry.id);
    try {
      await updateHistoryPinned.mutateAsync({ id: entry.id, pinned: !entry.pinned });
    } catch {
      setHistoryActionError(t('globalSearch.historyUpdateFailed'));
    } finally {
      setTogglingHistoryId(null);
    }
  };

  if (canSearch && searchError && results.length === 0) {
    const error = searchQ.error ?? documentSearchQ.error;
    return (
      <Screen>
        <SearchHeader count={0} query={query} onQueryChange={setQuery} />
        <ErrorView
          message={error instanceof Error ? error.message : t('globalSearch.loadFailed')}
          onRetry={() => {
            void searchQ.refetch();
            void documentSearchQ.refetch();
            if (memberSearchEnabled) void organizationMembersQ.refetch();
          }}
        />
      </Screen>
    );
  }

  return (
    <Screen>
      <FlatList
        data={results}
        keyExtractor={(item) =>
          item.kind === 'issue'
            ? `issue:${item.result.id}`
            : item.kind === 'document'
              ? `doc:${item.page.id}`
              : `person:${item.member.id}`
        }
        renderItem={renderItem}
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl
            refreshing={searchQ.isRefetching || documentSearchQ.isRefetching}
            onRefresh={() => {
              if (canSearch) {
                void searchQ.refetch();
                void documentSearchQ.refetch();
                if (memberSearchEnabled) void organizationMembersQ.refetch();
              }
            }}
          />
        }
        ListHeaderComponent={
          <SearchHeader
            count={results.length}
            query={query}
            onQueryChange={(value) => {
              setHistoryActionError(null);
              setQuery(value);
            }}
          />
        }
        ListEmptyComponent={
          canSearch ? (
            <EmptyState
              icon={Search}
              title={searchLoading ? t('globalSearch.searching') : t('globalSearch.noResults')}
              description={t('globalSearch.noResultsHint')}
            />
          ) : showHistory ? (
            <SearchHistorySection
              actionError={historyActionError}
              error={historyError}
              loading={historyLoading}
              pinned={pinnedHistory}
              recents={recentHistory}
              togglingId={togglingHistoryId}
              onSelect={(value) => {
                setHistoryActionError(null);
                setQuery(value);
              }}
              onTogglePinned={(entry) => void toggleHistoryPinned(entry)}
            />
          ) : (
            <EmptyState
              icon={Search}
              title={t('globalSearch.readyTitle')}
              description={t('globalSearch.readyHint')}
            />
          )
        }
      />
    </Screen>
  );
}

function createSearchScreenStyles(colors: ThemeColors) {
  return StyleSheet.create({
    content: {
      gap: 8,
      paddingBottom: 16,
    },
    searchWrap: {
      paddingHorizontal: 16,
      paddingBottom: 12,
    },
    resultRow: {
      flexDirection: 'row',
      gap: 12,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
      borderRadius: 6,
      backgroundColor: colors.card,
      marginHorizontal: 16,
      padding: 12,
    },
    historyPanel: {
      gap: 14,
      paddingHorizontal: 16,
    },
    historyGroup: {
      gap: 8,
    },
    historyGroupTitle: {
      color: colors.mutedForeground,
      fontSize: 11,
      fontWeight: '700',
      letterSpacing: 0,
      lineHeight: 15,
      textTransform: 'uppercase',
    },
    historyRow: {
      minHeight: 58,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
      borderRadius: 6,
      backgroundColor: colors.card,
      padding: 8,
    },
    historyMain: {
      minWidth: 0,
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
    },
    historyPinButton: {
      width: 38,
      height: 38,
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
      borderRadius: 6,
      backgroundColor: colors.surface,
    },
    historyError: {
      color: colors.destructive,
      fontSize: 13,
      lineHeight: 18,
    },
    resultIcon: {
      width: 34,
      height: 34,
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
      borderRadius: 6,
      backgroundColor: colors.surface,
    },
    resultIconText: {
      color: colors.foreground,
      fontSize: 16,
      lineHeight: 20,
    },
    resultBody: {
      minWidth: 0,
      flex: 1,
      gap: 7,
    },
    resultMeta: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 6,
    },
    snippet: {
      color: colors.mutedForeground,
      fontSize: 13,
      lineHeight: 18,
    },
    disabled: {
      opacity: 0.5,
    },
  });
}
