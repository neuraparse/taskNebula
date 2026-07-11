import { Alert } from 'react-native';
import { useCallback, useEffect, useMemo, useState } from 'react';
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
import { Check, Pencil, Plus, Search, Tags, Trash2, X } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';

import type { Label, Project } from '@/api/types';
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
  useCreateLabel,
  useDeleteLabel,
  useLabels,
  useProjects,
  useUpdateLabel,
} from '@/hooks/queries';
import type { ThemeColors } from '@/design/theme';
import { useThemeColors } from '@/design/theme-context';

interface OrganizationOption {
  id: string;
  projectCount: number;
}
type LabelsSettingsStyles = ReturnType<typeof createLabelsSettingsStyles>;

function useLabelsSettingsTheme(): { colors: ThemeColors; styles: LabelsSettingsStyles } {
  const colors = useThemeColors();
  const styles = useMemo(() => createLabelsSettingsStyles(colors), [colors]);
  return { colors, styles };
}

const LABEL_COLOR_PALETTE = [
  '#6B7280',
  '#3B82F6',
  '#8B5CF6',
  '#06B6D4',
  '#10B981',
  '#F59E0B',
  '#F43F5E',
  '#6366F1',
] as const;

function uniqueOrganizations(projects: Project[]): OrganizationOption[] {
  const counts = new Map<string, number>();
  for (const project of projects) {
    counts.set(project.organizationId, (counts.get(project.organizationId) ?? 0) + 1);
  }
  return [...counts].map(([id, projectCount]) => ({ id, projectCount }));
}

function shortId(id: string): string {
  return id.length > 10 ? `${id.slice(0, 6)}...${id.slice(-4)}` : id;
}

function normalizeColor(value: string | null | undefined): string {
  return value && /^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(value)
    ? value
    : LABEL_COLOR_PALETTE[0];
}

function WorkspacePill({
  index,
  option,
  selected,
  onPress,
}: {
  index: number;
  option: OrganizationOption;
  selected: boolean;
  onPress: (id: string) => void;
}) {
  const { t } = useTranslation();
  const { styles } = useLabelsSettingsTheme();

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected }}
      onPress={() => onPress(option.id)}
      style={[styles.workspacePill, selected ? styles.workspacePillActive : null]}
      className="active:opacity-80"
    >
      <Text style={[styles.workspaceTitle, selected ? styles.workspaceTitleActive : null]}>
        {t('team.workspaceIndex', { index: index + 1 })}
      </Text>
      <Text
        style={[styles.workspaceMeta, selected ? styles.workspaceMetaActive : null]}
        numberOfLines={1}
      >
        {t('team.projectCount', { count: option.projectCount })}
      </Text>
      <Text
        style={[styles.workspaceMeta, selected ? styles.workspaceMetaActive : null]}
        numberOfLines={1}
      >
        {shortId(option.id)}
      </Text>
    </Pressable>
  );
}

function ColorSwatch({
  color,
  selected,
  onPress,
}: {
  color: string;
  selected: boolean;
  onPress: () => void;
}) {
  const { t } = useTranslation();
  const { colors, styles } = useLabelsSettingsTheme();

  return (
    <Pressable
      accessibilityRole="radio"
      accessibilityLabel={t('settings.labels.colorOption', { color })}
      accessibilityState={{ checked: selected }}
      onPress={onPress}
      style={[
        styles.colorSwatch,
        { backgroundColor: color },
        selected ? styles.colorSwatchSelected : null,
      ]}
      className="active:opacity-80"
    >
      {selected ? <Check size={14} color={colors.primaryForeground} /> : null}
    </Pressable>
  );
}

function LabelCard({
  label,
  onDelete,
  onEdit,
}: {
  label: Label;
  onDelete: () => void;
  onEdit: () => void;
}) {
  const { t } = useTranslation();
  const { styles } = useLabelsSettingsTheme();
  const color = normalizeColor(label.color);

  return (
    <SurfaceRow className="gap-3">
      <View style={styles.labelHeader}>
        <View style={[styles.labelColorBlock, { backgroundColor: color }]} />
        <View style={styles.labelCopy}>
          <View style={styles.labelTitleRow}>
            <Text style={styles.labelName} numberOfLines={1}>
              {label.name}
            </Text>
            <SemanticBadge
              label={t('settings.labels.usageCount', { count: label.usageCount ?? 0 })}
              tone="neutral"
            />
            {label.projectId ? (
              <SemanticBadge label={t('settings.labels.projectScoped')} tone="indigo" />
            ) : null}
          </View>
          {label.description ? (
            <Text style={styles.labelDescription} numberOfLines={2}>
              {label.description}
            </Text>
          ) : null}
        </View>
      </View>

      <View style={styles.labelActions}>
        <Button
          title={t('common.edit')}
          icon={Pencil}
          variant="secondary"
          onPress={onEdit}
          style={styles.labelActionButton}
        />
        <Button
          title={t('settings.labels.deleteSubmit')}
          icon={Trash2}
          variant="destructive"
          onPress={onDelete}
          style={styles.labelActionButton}
        />
      </View>
    </SurfaceRow>
  );
}

export function LabelsSettingsScreen() {
  const { t } = useTranslation();
  const { colors, styles } = useLabelsSettingsTheme();
  const projectsQ = useProjects();
  const [selectedOrganizationId, setSelectedOrganizationId] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [editingLabel, setEditingLabel] = useState<Label | null>(null);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [color, setColor] = useState<string>(LABEL_COLOR_PALETTE[0]);
  const [formError, setFormError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const organizations = useMemo(() => uniqueOrganizations(projectsQ.data ?? []), [projectsQ.data]);
  const activeOrganizationId = selectedOrganizationId ?? organizations[0]?.id ?? null;
  const labelsQ = useLabels(activeOrganizationId);
  const createLabel = useCreateLabel(activeOrganizationId);
  const updateLabel = useUpdateLabel(activeOrganizationId);
  const deleteLabel = useDeleteLabel(activeOrganizationId);
  const labels = useMemo(() => labelsQ.data ?? [], [labelsQ.data]);
  const visibleLabels = useMemo(() => {
    const search = query.trim().toLowerCase();
    if (!search) return labels;
    return labels.filter((label) =>
      [label.name, label.description, label.projectId]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(search)),
    );
  }, [labels, query]);
  const isSaving = createLabel.isPending || updateLabel.isPending;

  const resetForm = useCallback(() => {
    setEditingLabel(null);
    setName('');
    setDescription('');
    setColor(LABEL_COLOR_PALETTE[0]);
    setFormError(null);
  }, []);

  useEffect(() => {
    if (selectedOrganizationId && organizations.some((org) => org.id === selectedOrganizationId)) {
      return;
    }
    setSelectedOrganizationId(organizations[0]?.id ?? null);
  }, [organizations, selectedOrganizationId]);

  useEffect(() => {
    setQuery('');
    resetForm();
    setNotice(null);
  }, [activeOrganizationId, resetForm]);

  const beginEdit = (label: Label) => {
    setEditingLabel(label);
    setName(label.name);
    setDescription(label.description ?? '');
    setColor(normalizeColor(label.color));
    setFormError(null);
    setNotice(null);
  };

  const saveLabel = async () => {
    if (!activeOrganizationId) return;
    const trimmedName = name.trim();
    const trimmedDescription = description.trim();
    if (!trimmedName) {
      setFormError(t('validation.invalidField'));
      return;
    }

    setFormError(null);
    setNotice(null);
    try {
      if (editingLabel) {
        await updateLabel.mutateAsync({
          labelId: editingLabel.id,
          name: trimmedName,
          color,
          description: trimmedDescription || null,
        });
        setNotice(t('settings.labels.toastUpdated'));
      } else {
        await createLabel.mutateAsync({
          name: trimmedName,
          color,
          description: trimmedDescription || null,
        });
        setNotice(t('settings.labels.toastCreated'));
      }
      resetForm();
    } catch (error) {
      setFormError(error instanceof Error ? error.message : t('settings.labels.errorGeneric'));
    }
  };

  const deleteLabelById = async (label: Label) => {
    setFormError(null);
    setNotice(null);
    try {
      await deleteLabel.mutateAsync(label.id);
      if (editingLabel?.id === label.id) resetForm();
      setNotice(t('settings.labels.toastDeleted'));
    } catch (error) {
      setFormError(error instanceof Error ? error.message : t('settings.labels.errorGeneric'));
    }
  };

  const confirmDelete = (label: Label) => {
    Alert.alert(
      t('settings.labels.deleteTitle'),
      t('settings.labels.deleteWarning', { name: label.name }),
      [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('settings.labels.deleteSubmit'),
          style: 'destructive',
          onPress: () => void deleteLabelById(label),
        },
      ],
    );
  };

  if (projectsQ.isLoading) return <Loading label={t('settings.labels.loading')} />;

  if (projectsQ.isError) {
    return (
      <Screen>
        <ErrorView
          message={projectsQ.error instanceof Error ? projectsQ.error.message : t('common.retry')}
          onRetry={() => void projectsQ.refetch()}
        />
      </Screen>
    );
  }

  if (organizations.length === 0) {
    return (
      <Screen>
        <ScreenHeader
          kicker={t('settings.labels.kicker')}
          title={t('settings.labels.title')}
          subtitle={t('settings.labels.subtitle')}
        />
        <EmptyState
          icon={Tags}
          title={t('team.noWorkspace')}
          description={t('team.noWorkspaceDesc')}
        />
      </Screen>
    );
  }

  if (labelsQ.isError) {
    return (
      <Screen>
        <ScreenHeader
          kicker={t('settings.labels.kicker')}
          title={t('settings.labels.title')}
          subtitle={t('settings.labels.subtitle')}
        />
        <ErrorView
          message={
            labelsQ.error instanceof Error ? labelsQ.error.message : t('settings.labels.loadFailed')
          }
          onRetry={() => void labelsQ.refetch()}
        />
      </Screen>
    );
  }

  const renderItem: ListRenderItem<Label> = ({ item }) => (
    <LabelCard label={item} onEdit={() => beginEdit(item)} onDelete={() => confirmDelete(item)} />
  );

  return (
    <Screen>
      <ScreenHeader
        kicker={t('settings.labels.kicker')}
        title={t('settings.labels.title')}
        subtitle={t('settings.labels.subtitle')}
        meta={
          <SemanticBadge
            label={t('settings.labels.count', { count: visibleLabels.length })}
            tone="blue"
          />
        }
      />

      <FlatList
        data={visibleLabels}
        keyExtractor={(label) => label.id}
        renderItem={renderItem}
        contentContainerStyle={styles.listContent}
        ItemSeparatorComponent={() => <View style={styles.separator} />}
        refreshControl={
          <RefreshControl
            refreshing={projectsQ.isRefetching || labelsQ.isRefetching}
            onRefresh={() => {
              void projectsQ.refetch();
              void labelsQ.refetch();
            }}
          />
        }
        ListHeaderComponent={
          <View style={styles.headerContent}>
            {organizations.length > 1 ? (
              <SurfaceRow className="gap-3">
                <Text style={styles.sectionTitle}>{t('team.workspace')}</Text>
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={styles.workspaceList}
                >
                  {organizations.map((organization, index) => (
                    <WorkspacePill
                      key={organization.id}
                      index={index}
                      option={organization}
                      selected={organization.id === activeOrganizationId}
                      onPress={setSelectedOrganizationId}
                    />
                  ))}
                </ScrollView>
              </SurfaceRow>
            ) : null}

            <SurfaceRow className="gap-3">
              <View style={styles.formHeader}>
                <IconTile icon={Tags} tone="blue" />
                <View style={styles.formCopy}>
                  <Text style={styles.sectionTitle}>
                    {editingLabel
                      ? t('settings.labels.editTitle')
                      : t('settings.labels.createTitle')}
                  </Text>
                  <Text style={styles.helperText}>
                    {editingLabel
                      ? t('settings.labels.editDescription')
                      : t('settings.labels.createDescription')}
                  </Text>
                </View>
              </View>

              <TextField
                label={t('settings.labels.nameLabel')}
                value={name}
                onChangeText={(value) => {
                  setName(value);
                  setFormError(null);
                  setNotice(null);
                }}
                placeholder={t('settings.labels.namePlaceholder')}
                maxLength={100}
                editable={!isSaving}
              />
              <TextField
                label={t('settings.labels.descriptionLabel')}
                value={description}
                onChangeText={(value) => {
                  setDescription(value);
                  setNotice(null);
                }}
                placeholder={t('settings.labels.descriptionPlaceholder')}
                maxLength={2000}
                editable={!isSaving}
                multiline
                className="min-h-12"
              />

              <View style={styles.colorSection}>
                <Text style={styles.inputLabel}>{t('settings.labels.colorLabel')}</Text>
                <View style={styles.palette} accessibilityRole="radiogroup">
                  {LABEL_COLOR_PALETTE.map((paletteColor) => (
                    <ColorSwatch
                      key={paletteColor}
                      color={paletteColor}
                      selected={color === paletteColor}
                      onPress={() => setColor(paletteColor)}
                    />
                  ))}
                </View>
              </View>

              {formError ? <Text style={styles.errorText}>{formError}</Text> : null}
              {notice ? <Text style={styles.noticeText}>{notice}</Text> : null}

              <View style={styles.formActions}>
                {editingLabel ? (
                  <Button
                    title={t('common.cancel')}
                    icon={X}
                    variant="secondary"
                    disabled={isSaving}
                    onPress={resetForm}
                    style={styles.formActionButton}
                  />
                ) : null}
                <Button
                  title={
                    editingLabel
                      ? t('settings.labels.saveSubmit')
                      : t('settings.labels.createSubmit')
                  }
                  icon={editingLabel ? Check : Plus}
                  loading={isSaving}
                  disabled={isSaving || !name.trim() || !activeOrganizationId}
                  onPress={() => void saveLabel()}
                  style={styles.formActionButton}
                />
              </View>
            </SurfaceRow>

            <View style={styles.searchWrap}>
              <TextField
                label={t('common.search')}
                value={query}
                onChangeText={setQuery}
                placeholder={t('settings.labels.searchPlaceholder')}
              />
              <View style={styles.searchIcon}>
                <Search size={15} color={colors.mutedForeground} />
              </View>
            </View>

            {labelsQ.isLoading ? (
              <Text style={styles.helperText}>{t('settings.labels.loading')}</Text>
            ) : null}
          </View>
        }
        ListEmptyComponent={
          !labelsQ.isLoading ? (
            <View style={styles.emptyWrap}>
              <EmptyState
                icon={Tags}
                title={query.trim() ? t('settings.labels.noMatches') : t('settings.labels.empty')}
                description={
                  query.trim()
                    ? t('settings.labels.noMatchesDescription')
                    : t('settings.labels.emptyDescription')
                }
              />
            </View>
          ) : null
        }
      />
    </Screen>
  );
}

function createLabelsSettingsStyles(colors: ThemeColors) {
  return StyleSheet.create({
    listContent: {
      gap: 12,
      paddingHorizontal: 16,
      paddingBottom: 32,
    },
    headerContent: {
      gap: 12,
    },
    separator: {
      height: 0,
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
    workspaceList: {
      gap: 8,
      paddingRight: 4,
    },
    workspacePill: {
      width: 150,
      gap: 5,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
      borderRadius: 8,
      backgroundColor: colors.surface,
      padding: 10,
    },
    workspacePillActive: {
      borderColor: colors.primary,
      backgroundColor: `${colors.primary}1A`,
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
    workspaceMeta: {
      color: colors.mutedForeground,
      fontSize: 12,
      lineHeight: 16,
    },
    workspaceMetaActive: {
      color: colors.foreground,
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
    inputLabel: {
      color: colors.foreground,
      fontSize: 14,
      fontWeight: '600',
      lineHeight: 20,
    },
    colorSection: {
      gap: 8,
    },
    palette: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 10,
    },
    colorSwatch: {
      width: 36,
      height: 36,
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
      borderRadius: 7,
    },
    colorSwatchSelected: {
      borderWidth: 2,
      borderColor: colors.primary,
    },
    formActions: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 8,
    },
    formActionButton: {
      minWidth: 136,
      flex: 1,
    },
    errorText: {
      color: colors.destructive,
      fontSize: 13,
      lineHeight: 18,
    },
    noticeText: {
      color: colors.mutedForeground,
      fontSize: 13,
      lineHeight: 18,
    },
    searchWrap: {
      position: 'relative',
    },
    searchIcon: {
      position: 'absolute',
      right: 12,
      bottom: 15,
    },
    labelHeader: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: 10,
    },
    labelColorBlock: {
      width: 14,
      height: 42,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
      borderRadius: 4,
    },
    labelCopy: {
      flex: 1,
      minWidth: 0,
      gap: 5,
    },
    labelTitleRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      alignItems: 'center',
      gap: 6,
    },
    labelName: {
      maxWidth: 210,
      color: colors.foreground,
      fontSize: 16,
      fontWeight: '700',
      lineHeight: 22,
    },
    labelDescription: {
      color: colors.mutedForeground,
      fontSize: 13,
      lineHeight: 18,
    },
    labelActions: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 8,
    },
    labelActionButton: {
      minWidth: 132,
      flex: 1,
    },
    emptyWrap: {
      minHeight: 260,
    },
  });
}
