import { useMemo, useState } from 'react';
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from '@/components/native';
import { useNavigation, type NavigationProp } from '@react-navigation/native';
import {
  ArrowUpRight,
  Edit3,
  FileText,
  Inbox,
  MessageSquare,
  Search,
  Trash2,
  type LucideIcon,
} from 'lucide-react-native';
import { useTranslation } from 'react-i18next';

import type { DocumentSpace, Draft, DraftEntityType } from '@/api/types';
import {
  Button,
  EmptyState,
  ErrorView,
  IconTile,
  Loading,
  Screen,
  ScreenHeader,
  SemanticBadge,
  TextField,
} from '@/components/ui';
import { useThemeColors } from '@/design/theme-context';
import {
  useDeleteDraft,
  useDocumentSpaces,
  useDrafts,
  useProjects,
  usePromoteDocumentDraft,
  usePromoteDraft,
  useUpdateDraft,
} from '@/hooks/queries';
import { relativeTime } from '@/lib/format';
import type { AppStackParamList } from '@/navigation/types';

type DraftsNavigation = NavigationProp<AppStackParamList>;
type DraftFilter = 'all' | 'issue' | 'doc' | 'other';
type SortKey = 'updated' | 'created';

const FILTERS: DraftFilter[] = ['all', 'issue', 'doc', 'other'];

function draftType(draft: Draft): DraftFilter {
  if (draft.entityType === 'issue' || draft.entityType === 'doc') return draft.entityType;
  return 'other';
}

function draftIcon(type: DraftFilter): LucideIcon {
  if (type === 'issue') return ArrowUpRight;
  if (type === 'doc') return FileText;
  return MessageSquare;
}

function draftTone(type: DraftFilter): 'blue' | 'emerald' | 'violet' | 'neutral' {
  if (type === 'issue') return 'blue';
  if (type === 'doc') return 'emerald';
  if (type === 'other') return 'violet';
  return 'neutral';
}

function typeLabelKey(type: DraftFilter): string {
  if (type === 'all') return 'drafts.typeAll';
  if (type === 'issue') return 'drafts.typeIssue';
  if (type === 'doc') return 'drafts.typeDoc';
  return 'drafts.typeOther';
}

function sortDate(draft: Draft, sort: SortKey): number {
  const value = sort === 'created' ? draft.createdAt : draft.updatedAt;
  return new Date(value ?? 0).getTime();
}

function truncate(value: string | null | undefined, max = 130): string {
  const text = value?.trim() ?? '';
  if (text.length <= max) return text;
  return `${text.slice(0, max).trimEnd()}...`;
}

function alpha(hex: string, opacity: string): string {
  return `${hex}${opacity}`;
}

function metadataString(draft: Draft, key: string): string | null {
  const value = draft.metadata[key];
  return typeof value === 'string' && value.trim() ? value : null;
}

function FilterPill({
  label,
  count,
  selected,
  onPress,
}: {
  label: string;
  count: number;
  selected: boolean;
  onPress: () => void;
}) {
  const colors = useThemeColors();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected }}
      onPress={onPress}
      style={[
        styles.filterPill,
        {
          borderColor: selected ? colors.primary : colors.border,
          backgroundColor: selected ? colors.primary : colors.card,
        },
      ]}
      className="active:opacity-80"
    >
      <Text
        style={[
          styles.filterText,
          { color: selected ? colors.primaryForeground : colors.mutedForeground },
        ]}
      >
        {label}
      </Text>
      <Text
        style={[
          styles.filterCount,
          { color: selected ? colors.primaryForeground : colors.mutedForeground },
        ]}
      >
        {count}
      </Text>
    </Pressable>
  );
}

function SortButton({
  label,
  selected,
  onPress,
}: {
  label: string;
  selected: boolean;
  onPress: () => void;
}) {
  const colors = useThemeColors();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected }}
      onPress={onPress}
      style={[
        styles.sortButton,
        {
          borderColor: selected ? colors.primary : colors.border,
          backgroundColor: selected ? alpha(colors.primary, '18') : colors.card,
        },
      ]}
      className="active:opacity-80"
    >
      <Text
        style={[styles.sortText, { color: selected ? colors.primary : colors.mutedForeground }]}
      >
        {label}
      </Text>
    </Pressable>
  );
}

function DraftCard({
  draft,
  selected,
  onEdit,
  onPromote,
  onDelete,
}: {
  draft: Draft;
  selected: boolean;
  onEdit: () => void;
  onPromote: () => void;
  onDelete: () => void;
}) {
  const { t } = useTranslation();
  const colors = useThemeColors();
  const type = draftType(draft);
  const Icon = draftIcon(type);
  const title = draft.title.trim() || t('drafts.untitled');
  const time = relativeTime(draft.updatedAt ?? draft.createdAt);

  return (
    <View
      style={[
        styles.draftCard,
        {
          borderColor: selected ? colors.primary : colors.border,
          backgroundColor: colors.card,
        },
      ]}
    >
      <View style={styles.draftHeader}>
        <IconTile icon={Icon} tone={draftTone(type)} />
        <View className="min-w-0 flex-1 gap-1">
          <Text className="text-foreground text-base font-semibold" numberOfLines={1}>
            {title}
          </Text>
          <View style={styles.draftMeta}>
            <SemanticBadge label={t(typeLabelKey(type))} tone={draftTone(type)} />
            {time ? (
              <Text style={[styles.metaText, { color: colors.mutedForeground }]} numberOfLines={1}>
                {t('drafts.updatedAt', { time })}
              </Text>
            ) : null}
          </View>
        </View>
      </View>

      {draft.content ? (
        <Text className="text-muted-foreground text-sm" numberOfLines={3}>
          {truncate(draft.content)}
        </Text>
      ) : null}

      <View style={[styles.cardActions, { borderColor: colors.border }]}>
        <Pressable
          accessibilityRole="button"
          onPress={onEdit}
          style={[styles.iconButton, { borderColor: colors.border }]}
        >
          <Edit3 size={16} color={colors.foreground} />
          <Text style={[styles.iconButtonText, { color: colors.foreground }]}>
            {t('common.edit')}
          </Text>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          onPress={onPromote}
          style={[styles.iconButton, { borderColor: colors.border }]}
        >
          <ArrowUpRight size={16} color={colors.foreground} />
          <Text style={[styles.iconButtonText, { color: colors.foreground }]}>
            {t('drafts.promote')}
          </Text>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          onPress={onDelete}
          style={[styles.iconButton, { borderColor: colors.border }]}
        >
          <Trash2 size={16} color={colors.destructive} />
          <Text style={[styles.iconButtonText, { color: colors.destructive }]}>
            {t('drafts.delete')}
          </Text>
        </Pressable>
      </View>
    </View>
  );
}

export function DraftsScreen() {
  const { t } = useTranslation();
  const colors = useThemeColors();
  const navigation = useNavigation<DraftsNavigation>();
  const draftsQ = useDrafts();
  const projectsQ = useProjects();
  const spacesQ = useDocumentSpaces();
  const updateDraft = useUpdateDraft();
  const deleteDraft = useDeleteDraft();
  const promoteDraft = usePromoteDraft();
  const promoteDocumentDraft = usePromoteDocumentDraft();

  const drafts = useMemo(() => draftsQ.data ?? [], [draftsQ.data]);
  const projects = useMemo(() => projectsQ.data ?? [], [projectsQ.data]);
  const writableSpaces = useMemo(
    () => (spacesQ.data ?? []).filter((space) => space.permissions?.canCreate === true),
    [spacesQ.data],
  );
  const [filter, setFilter] = useState<DraftFilter>('all');
  const [sort, setSort] = useState<SortKey>('updated');
  const [query, setQuery] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [editContent, setEditContent] = useState('');
  const [editType, setEditType] = useState<DraftFilter>('issue');
  const [editProjectId, setEditProjectId] = useState<string | null>(null);
  const [editSpaceId, setEditSpaceId] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const counts = useMemo(() => {
    const next: Record<DraftFilter, number> = { all: drafts.length, issue: 0, doc: 0, other: 0 };
    for (const draft of drafts) next[draftType(draft)] += 1;
    return next;
  }, [drafts]);

  const visible = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return drafts
      .filter((draft) => {
        const type = draftType(draft);
        if (filter !== 'all' && type !== filter) return false;
        if (!needle) return true;
        return `${draft.title} ${draft.content ?? ''}`.toLowerCase().includes(needle);
      })
      .sort((left, right) => sortDate(right, sort) - sortDate(left, sort));
  }, [drafts, filter, query, sort]);

  const editingDraft = drafts.find((draft) => draft.id === editingId) ?? null;
  const isSaving = updateDraft.isPending;
  const isDeleting = deleteDraft.isPending;
  const isPromoting = promoteDraft.isPending || promoteDocumentDraft.isPending;
  const isRefreshing = draftsQ.isRefetching || projectsQ.isRefetching || spacesQ.isRefetching;

  const beginEdit = (draft: Draft) => {
    setNotice(null);
    setEditingId(draft.id);
    setEditTitle(draft.title.trim() || t('drafts.untitled'));
    setEditContent(draft.content ?? '');
    setEditType(draftType(draft));
    setEditProjectId(draft.targetProjectId ?? projects[0]?.id ?? null);
    setEditSpaceId(metadataString(draft, 'targetSpaceId') ?? writableSpaces[0]?.id ?? null);
  };

  const refresh = () => {
    void draftsQ.refetch();
    void projectsQ.refetch();
    void spacesQ.refetch();
  };

  const saveEdit = async (): Promise<void> => {
    if (!editingDraft) return;
    setNotice(null);
    try {
      await updateDraft.mutateAsync({
        id: editingDraft.id,
        title: editTitle.trim() || t('drafts.untitled'),
        content: editContent.trim() || null,
        entityType: editType === 'all' ? 'other' : (editType as DraftEntityType),
        targetProjectId: editType === 'issue' ? editProjectId : null,
        metadata:
          editType === 'doc' && editSpaceId
            ? { ...editingDraft.metadata, targetSpaceId: editSpaceId }
            : editingDraft.metadata,
      });
      setEditingId(null);
    } catch {
      setNotice(t('drafts.updateFailed'));
    }
  };

  const deleteSelected = async (draft: Draft): Promise<void> => {
    setNotice(null);
    try {
      await deleteDraft.mutateAsync(draft.id);
      if (editingId === draft.id) setEditingId(null);
    } catch {
      setNotice(t('drafts.deleteFailed'));
    }
  };

  const promoteSelected = async (draft: Draft): Promise<void> => {
    setNotice(null);
    const type = draftType(draft);
    if (type === 'issue') {
      const projectId = draft.targetProjectId ?? projects[0]?.id ?? null;
      if (!projectId) {
        setNotice(t('drafts.noProject'));
        return;
      }

      try {
        const issue = await promoteDraft.mutateAsync({ draft, projectId });
        navigation.navigate('IssueDetail', { id: issue.id });
      } catch {
        setNotice(t('drafts.promoteFailed'));
      }
      return;
    }

    if (type === 'doc') {
      const targetSpaceId = metadataString(draft, 'targetSpaceId') ?? writableSpaces[0]?.id ?? null;
      if (!targetSpaceId) {
        setNotice(t('drafts.noDocSpace'));
        return;
      }

      try {
        const page = await promoteDocumentDraft.mutateAsync({ draft, spaceId: targetSpaceId });
        navigation.navigate('DocumentDetail', { id: page.id });
      } catch {
        setNotice(t('drafts.promoteFailed'));
      }
      return;
    }

    setNotice(t('drafts.promoteUnsupported'));
  };

  if (draftsQ.isLoading) return <Loading label={t('drafts.loading')} />;
  if (draftsQ.isError) {
    return (
      <Screen>
        <ErrorView
          message={draftsQ.error instanceof Error ? draftsQ.error.message : t('drafts.loadFailed')}
          onRetry={refresh}
        />
      </Screen>
    );
  }

  return (
    <Screen>
      <ScrollView
        className="flex-1"
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        refreshControl={<RefreshControl refreshing={isRefreshing} onRefresh={refresh} />}
      >
        <ScreenHeader
          kicker={t('common.appName')}
          title={t('drafts.title')}
          subtitle={t('drafts.subtitle')}
          meta={<SemanticBadge label={String(drafts.length)} tone="blue" />}
        />

        <View style={styles.searchRow}>
          <View style={styles.searchIcon}>
            <Search size={16} color={colors.mutedForeground} />
          </View>
          <TextField
            style={styles.searchInput}
            placeholder={t('drafts.searchPlaceholder')}
            value={query}
            onChangeText={setQuery}
            autoCapitalize="none"
            autoCorrect={false}
          />
        </View>

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.filters}
        >
          {FILTERS.map((item) => (
            <FilterPill
              key={item}
              label={t(typeLabelKey(item))}
              count={counts[item]}
              selected={filter === item}
              onPress={() => setFilter(item)}
            />
          ))}
        </ScrollView>

        <View style={styles.sortTabs}>
          <SortButton
            label={t('drafts.sortUpdated')}
            selected={sort === 'updated'}
            onPress={() => setSort('updated')}
          />
          <SortButton
            label={t('drafts.sortCreated')}
            selected={sort === 'created'}
            onPress={() => setSort('created')}
          />
        </View>

        {notice ? <Text className="text-destructive mx-4 text-sm">{notice}</Text> : null}

        {editingDraft ? (
          <View
            style={[
              styles.editorPanel,
              { borderColor: colors.border, backgroundColor: colors.surface },
            ]}
          >
            <Text className="text-foreground text-base font-semibold">{t('common.edit')}</Text>
            <View style={styles.typeTabs}>
              {(['issue', 'doc', 'other'] as DraftFilter[]).map((item) => (
                <FilterPill
                  key={item}
                  label={t(typeLabelKey(item))}
                  count={counts[item]}
                  selected={editType === item}
                  onPress={() => setEditType(item)}
                />
              ))}
            </View>
            {editType === 'issue' && projects.length > 0 ? (
              <View style={styles.projectList}>
                {projects.map((project) => (
                  <Pressable
                    key={project.id}
                    accessibilityRole="button"
                    accessibilityState={{ selected: editProjectId === project.id }}
                    onPress={() => setEditProjectId(project.id)}
                    style={[
                      styles.projectPill,
                      {
                        borderColor: editProjectId === project.id ? colors.primary : colors.border,
                        backgroundColor:
                          editProjectId === project.id ? alpha(colors.primary, '18') : colors.card,
                      },
                    ]}
                    className="active:opacity-80"
                  >
                    <Text
                      style={[
                        styles.projectPillText,
                        {
                          color: editProjectId === project.id ? colors.primary : colors.foreground,
                        },
                      ]}
                      numberOfLines={1}
                    >
                      {project.name}
                    </Text>
                    <Text
                      style={[styles.projectPillKey, { color: colors.mutedForeground }]}
                      numberOfLines={1}
                    >
                      {project.key}
                    </Text>
                  </Pressable>
                ))}
              </View>
            ) : null}
            {editType === 'doc' ? (
              writableSpaces.length > 0 ? (
                <View style={styles.projectList}>
                  <Text className="text-foreground text-sm font-medium">
                    {t('drafts.spaceLabel')}
                  </Text>
                  {writableSpaces.map((space: DocumentSpace) => (
                    <Pressable
                      key={space.id}
                      accessibilityRole="button"
                      accessibilityState={{ selected: editSpaceId === space.id }}
                      onPress={() => setEditSpaceId(space.id)}
                      style={[
                        styles.projectPill,
                        {
                          borderColor: editSpaceId === space.id ? colors.primary : colors.border,
                          backgroundColor:
                            editSpaceId === space.id ? alpha(colors.primary, '18') : colors.card,
                        },
                      ]}
                      className="active:opacity-80"
                    >
                      <Text
                        style={[
                          styles.projectPillText,
                          {
                            color: editSpaceId === space.id ? colors.primary : colors.foreground,
                          },
                        ]}
                        numberOfLines={1}
                      >
                        {space.name}
                      </Text>
                      <Text
                        style={[styles.projectPillKey, { color: colors.mutedForeground }]}
                        numberOfLines={1}
                      >
                        {space.projectId ? t('docs.projectSpace') : t('docs.organizationSpace')}
                      </Text>
                    </Pressable>
                  ))}
                </View>
              ) : (
                <Text className="text-muted-foreground text-sm">{t('drafts.noDocSpace')}</Text>
              )
            ) : null}
            <TextField
              label={t('issues.titleLabel')}
              value={editTitle}
              onChangeText={setEditTitle}
              editable={!isSaving}
            />
            <TextField
              label={t('issue.description')}
              value={editContent}
              onChangeText={setEditContent}
              multiline
              textAlignVertical="top"
              editable={!isSaving}
              style={styles.contentInput}
            />
            <View style={styles.editorActions}>
              <Button
                title={t('common.cancel')}
                variant="ghost"
                disabled={isSaving}
                onPress={() => setEditingId(null)}
              />
              <Button
                title={t('common.save')}
                loading={isSaving}
                disabled={isSaving}
                onPress={() => {
                  void saveEdit();
                }}
              />
            </View>
          </View>
        ) : null}

        {visible.length === 0 ? (
          <EmptyState
            icon={Inbox}
            title={t('drafts.emptyTitle')}
            description={
              drafts.length > 0 ? t('drafts.emptyFilteredDesc') : t('drafts.emptyDescription')
            }
          />
        ) : (
          <View style={styles.list}>
            {visible.map((draft) => (
              <DraftCard
                key={draft.id}
                draft={draft}
                selected={editingId === draft.id}
                onEdit={() => beginEdit(draft)}
                onPromote={() => {
                  void promoteSelected(draft);
                }}
                onDelete={() => {
                  if (!isDeleting) void deleteSelected(draft);
                }}
              />
            ))}
          </View>
        )}

        {drafts.length === 0 ? (
          <View style={styles.emptyActions}>
            {projects.length > 0 ? (
              <Button
                title={t('issues.create')}
                icon={ArrowUpRight}
                onPress={() => navigation.navigate('NewIssue')}
              />
            ) : (
              <Button
                title={t('projects.new')}
                icon={FileText}
                onPress={() => navigation.navigate('NewProject')}
              />
            )}
          </View>
        ) : null}

        {isPromoting ? <Loading label={t('drafts.promoting')} /> : null}
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: {
    gap: 16,
    paddingBottom: 24,
  },
  searchRow: {
    paddingHorizontal: 16,
  },
  searchIcon: {
    position: 'absolute',
    left: 28,
    top: 16,
    zIndex: 1,
  },
  searchInput: {
    paddingLeft: 38,
  },
  filters: {
    gap: 8,
    paddingHorizontal: 16,
  },
  filterPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  filterText: {
    fontSize: 12,
    fontWeight: '600',
    lineHeight: 16,
  },
  filterCount: {
    fontSize: 11,
    fontWeight: '700',
    lineHeight: 16,
  },
  sortTabs: {
    flexDirection: 'row',
    gap: 8,
    paddingHorizontal: 16,
  },
  sortButton: {
    flex: 1,
    alignItems: 'center',
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 6,
    paddingVertical: 9,
  },
  sortText: {
    fontSize: 13,
    fontWeight: '600',
    lineHeight: 18,
  },
  list: {
    gap: 12,
    paddingHorizontal: 16,
  },
  draftCard: {
    gap: 12,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 6,
    padding: 14,
  },
  draftHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  draftMeta: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: 8,
  },
  metaText: {
    fontSize: 11,
    lineHeight: 16,
  },
  cardActions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingTop: 12,
  },
  iconButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 6,
    paddingHorizontal: 10,
    paddingVertical: 7,
  },
  iconButtonText: {
    fontSize: 12,
    fontWeight: '600',
    lineHeight: 16,
  },
  editorPanel: {
    gap: 12,
    marginHorizontal: 16,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 6,
    padding: 14,
  },
  typeTabs: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  projectList: {
    gap: 8,
  },
  projectPill: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 6,
    paddingHorizontal: 12,
    paddingVertical: 9,
  },
  projectPillText: {
    fontSize: 13,
    fontWeight: '600',
    lineHeight: 18,
  },
  projectPillKey: {
    fontSize: 11,
    lineHeight: 16,
  },
  contentInput: {
    minHeight: 120,
    paddingTop: 10,
  },
  editorActions: {
    gap: 8,
  },
  emptyActions: {
    paddingHorizontal: 16,
  },
});
