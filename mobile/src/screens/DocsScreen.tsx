import { useEffect, useMemo, useState } from 'react';
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
import { useNavigation, type NavigationProp } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { BookOpenText, FileText, Plus, Search } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';

import type { DocumentPageSummary, DocumentSpace } from '@/api/types';
import {
  EmptyState,
  ErrorView,
  Loading,
  Screen,
  ScreenHeader,
  SemanticBadge,
  TextField,
  Button,
} from '@/components/ui';
import { useThemeColors } from '@/design/theme-context';
import { useDocumentPages, useDocumentSpaces, useSearchDocumentPages } from '@/hooks/queries';
import { relativeTime } from '@/lib/format';
import type { AppStackParamList } from '@/navigation/types';

type DocsScreenProps =
  | NativeStackScreenProps<AppStackParamList, 'Docs'>
  | NativeStackScreenProps<AppStackParamList, 'ProjectDocs'>;

function alpha(hex: string, opacity: string): string {
  return `${hex}${opacity}`;
}

function SpaceButton({
  selected,
  space,
  onPress,
}: {
  selected: boolean;
  space: DocumentSpace;
  onPress: (spaceId: string) => void;
}) {
  const { t } = useTranslation();
  const colors = useThemeColors();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected }}
      onPress={() => onPress(space.id)}
      style={[
        styles.spaceButton,
        {
          borderColor: selected ? alpha(colors.primary, '55') : colors.border,
          backgroundColor: selected ? alpha(colors.primary, '14') : colors.card,
        },
      ]}
      className="active:opacity-80"
    >
      <Text
        style={[styles.spaceName, { color: selected ? colors.primary : colors.foreground }]}
        numberOfLines={1}
      >
        {space.name}
      </Text>
      <Text style={[styles.spaceScope, { color: colors.mutedForeground }]} numberOfLines={1}>
        {space.scope === 'project' ? t('docs.projectDoc') : t('docs.wiki')}
      </Text>
    </Pressable>
  );
}

function DocPageRow({ page }: { page: DocumentPageSummary }) {
  const { t } = useTranslation();
  const colors = useThemeColors();
  const navigation = useNavigation<NavigationProp<AppStackParamList>>();
  const updated = page.updatedAt ? relativeTime(page.updatedAt) : '';

  return (
    <Pressable
      accessibilityRole="button"
      onPress={() => navigation.navigate('DocumentDetail', { id: page.id })}
      style={[styles.pageRow, { borderColor: colors.border, backgroundColor: colors.card }]}
      className="active:opacity-80"
    >
      <View
        style={[styles.pageIcon, { borderColor: colors.border, backgroundColor: colors.surface }]}
      >
        <Text style={[styles.pageIconText, { color: colors.foreground }]}>
          {page.icon || page.title.slice(0, 1).toUpperCase()}
        </Text>
      </View>
      <View style={styles.pageBody}>
        <View style={styles.pageMeta}>
          {page.spaceName ? <SemanticBadge label={page.spaceName} tone="cyan" /> : null}
          {updated ? (
            <SemanticBadge label={t('docs.updated', { date: updated })} tone="neutral" />
          ) : null}
        </View>
        <Text className="text-foreground text-base font-semibold" numberOfLines={2}>
          {page.title}
        </Text>
        {page.excerpt ? (
          <Text style={[styles.excerpt, { color: colors.mutedForeground }]} numberOfLines={2}>
            {page.excerpt}
          </Text>
        ) : null}
      </View>
    </Pressable>
  );
}

export function DocsScreen({ route }: DocsScreenProps) {
  const { t } = useTranslation();
  const colors = useThemeColors();
  const navigation = useNavigation<NavigationProp<AppStackParamList>>();
  const projectId = route.name === 'ProjectDocs' ? route.params.projectId : null;
  const routeSpaceId = route.params?.spaceId ?? null;
  const [activeSpaceId, setActiveSpaceId] = useState<string | null>(routeSpaceId);
  const [query, setQuery] = useState('');
  const scopeParams = useMemo(() => (projectId ? { projectId } : {}), [projectId]);
  const spacesQ = useDocumentSpaces(scopeParams);
  const pagesQ = useDocumentPages(activeSpaceId, scopeParams);
  const searchQ = useSearchDocumentPages(query, scopeParams);
  const spaces = useMemo(() => spacesQ.data ?? [], [spacesQ.data]);
  const basePages = useMemo(() => pagesQ.data?.pages ?? [], [pagesQ.data?.pages]);
  const searchResults = useMemo(() => searchQ.data?.results ?? [], [searchQ.data?.results]);
  const searching = query.trim().length >= 2;
  const pages = searching ? searchResults : basePages;
  const isLoading = spacesQ.isLoading || pagesQ.isLoading;
  const isRefreshing = spacesQ.isRefetching || pagesQ.isRefetching || searchQ.isRefetching;
  const hasError = spacesQ.isError || pagesQ.isError || searchQ.isError;
  const createSpaceId = activeSpaceId ?? pagesQ.data?.space?.id ?? null;
  const canCreate = !searching && !!createSpaceId && pagesQ.data?.permissions?.canCreate === true;

  useEffect(() => {
    setActiveSpaceId(routeSpaceId);
  }, [projectId, routeSpaceId]);

  useEffect(() => {
    if (activeSpaceId || spaces.length === 0) return;
    const preferredSpace = projectId
      ? (spaces.find((space) => space.projectId === projectId) ??
        spaces.find((space) => space.scope === 'project'))
      : spaces[0];
    setActiveSpaceId(preferredSpace?.id ?? null);
  }, [activeSpaceId, projectId, spaces]);

  const refresh = () => {
    void spacesQ.refetch();
    void pagesQ.refetch();
    if (searching) void searchQ.refetch();
  };

  const renderItem: ListRenderItem<DocumentPageSummary> = ({ item }) => <DocPageRow page={item} />;

  if (isLoading) return <Loading />;
  if (hasError && pages.length === 0) {
    return (
      <Screen>
        <ErrorView message={t('docs.loadFailed')} onRetry={refresh} />
      </Screen>
    );
  }

  return (
    <Screen>
      <FlatList
        data={pages}
        keyExtractor={(page) => page.id}
        renderItem={renderItem}
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={isRefreshing} onRefresh={refresh} />}
        ListHeaderComponent={
          <View>
            <ScreenHeader
              kicker={projectId ? t('docs.projectDoc') : t('common.appName')}
              title={t('docs.title')}
              meta={<SemanticBadge label={String(pages.length)} tone="cyan" />}
            />
            <View style={styles.toolbar}>
              <TextField
                label={t('common.search')}
                placeholder={t('docs.searchPlaceholder')}
                value={query}
                onChangeText={setQuery}
                autoCapitalize="none"
                autoCorrect={false}
              />
              {canCreate ? (
                <Button
                  title={t('docs.create')}
                  icon={Plus}
                  variant="secondary"
                  onPress={() =>
                    navigation.navigate('DocumentEditor', {
                      spaceId: createSpaceId,
                      projectId,
                    })
                  }
                />
              ) : null}
            </View>
            {!searching && spaces.length > 0 ? (
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.spaces}
              >
                {spaces.map((space) => (
                  <SpaceButton
                    key={space.id}
                    space={space}
                    selected={activeSpaceId === space.id}
                    onPress={setActiveSpaceId}
                  />
                ))}
              </ScrollView>
            ) : null}
          </View>
        }
        ListEmptyComponent={
          <EmptyState
            icon={searching ? Search : BookOpenText}
            title={searching ? t('docs.noMatches') : t('docs.empty')}
            description={searching ? t('docs.noMatchesDesc') : t('docs.emptyDesc')}
          />
        }
      />
      {hasError && pages.length > 0 ? (
        <View
          style={[
            styles.partialError,
            {
              borderColor: alpha(colors.warning, '55'),
              backgroundColor: alpha(colors.warning, '14'),
            },
          ]}
        >
          <FileText size={16} color={colors.warning} />
          <Text style={[styles.partialErrorText, { color: colors.warning }]}>
            {t('docs.loadFailed')}
          </Text>
        </View>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: {
    gap: 8,
    paddingBottom: 18,
  },
  toolbar: {
    paddingHorizontal: 16,
    paddingBottom: 12,
  },
  spaces: {
    gap: 8,
    paddingHorizontal: 16,
    paddingBottom: 12,
  },
  spaceButton: {
    width: 168,
    gap: 3,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 6,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  spaceName: {
    fontSize: 13,
    fontWeight: '700',
    lineHeight: 18,
  },
  spaceScope: {
    fontSize: 11,
    lineHeight: 15,
  },
  pageRow: {
    flexDirection: 'row',
    gap: 12,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 6,
    marginHorizontal: 16,
    padding: 12,
  },
  pageIcon: {
    width: 34,
    height: 34,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 6,
  },
  pageIconText: {
    fontSize: 17,
    lineHeight: 22,
  },
  pageBody: {
    minWidth: 0,
    flex: 1,
    gap: 7,
  },
  pageMeta: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  excerpt: {
    fontSize: 13,
    lineHeight: 18,
  },
  partialError: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 6,
    margin: 16,
    padding: 10,
  },
  partialErrorText: {
    flex: 1,
    fontSize: 13,
    lineHeight: 18,
  },
});
