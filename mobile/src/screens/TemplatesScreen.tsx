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
import {
  BookOpenText,
  CheckCircle2,
  FileText,
  FolderKanban,
  ListTodo,
  Search,
  Tag,
} from 'lucide-react-native';
import { useTranslation } from 'react-i18next';

import { documentTextToContentJson } from '@/api/endpoints';
import type {
  DocumentSpace,
  Project,
  TemplateCategory,
  TemplateKind,
  WorkTemplate,
} from '@/api/types';
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
  useCreateDocumentPage,
  useDocumentSpaces,
  useInstantiateTemplate,
  useProjects,
  useTemplates,
} from '@/hooks/queries';
import type { AppStackParamList } from '@/navigation/types';

type TemplatesNavigation = NavigationProp<AppStackParamList>;
type FilterValue = 'all' | 'engineering' | 'design' | 'product' | 'qa' | 'ops' | 'general';
type TemplatesScreenStyles = ReturnType<typeof createTemplatesScreenStyles>;

function useTemplatesScreenTheme(): { colors: ThemeColors; styles: TemplatesScreenStyles } {
  const colors = useThemeColors();
  const styles = useMemo(() => createTemplatesScreenStyles(colors), [colors]);
  return { colors, styles };
}

const FILTERS: FilterValue[] = ['all', 'engineering', 'design', 'product', 'qa', 'ops', 'general'];
const KNOWN_CATEGORIES = new Set<FilterValue>(FILTERS.filter((item) => item !== 'all'));

function stringPayload(template: WorkTemplate, keys: string[], fallback = ''): string {
  for (const key of keys) {
    const value = template.payload[key];
    if (typeof value === 'string' && value.trim()) return value;
  }
  return fallback;
}

function deriveProjectKey(value: string): string {
  const fromInitials = value
    .replace(/[^a-zA-Z0-9\s]/g, '')
    .split(/\s+/)
    .filter(Boolean)
    .map((word) => word[0])
    .join('')
    .toUpperCase()
    .slice(0, 10);
  return /^[A-Z][A-Z0-9]{1,9}$/.test(fromInitials) ? fromInitials : 'TPL';
}

function normalizeProjectKey(value: string): string {
  return value
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '')
    .slice(0, 10);
}

function isKnownCategory(value: TemplateCategory): value is Exclude<FilterValue, 'all'> {
  return KNOWN_CATEGORIES.has(String(value).toLowerCase() as FilterValue);
}

function isTemplateKind(value: TemplateKind, kind: 'project' | 'issue' | 'doc'): boolean {
  return String(value).toLowerCase() === kind;
}

function categoryLabelKey(value: FilterValue): string {
  if (value === 'all') return 'templates.filterAll';
  return `templates.category${value[0]?.toUpperCase() ?? ''}${value.slice(1)}`;
}

function templateKindLabel(t: ReturnType<typeof useTranslation>['t'], kind: TemplateKind): string {
  if (isTemplateKind(kind, 'project')) return t('templates.kindProject');
  if (isTemplateKind(kind, 'issue')) return t('templates.kindIssue');
  if (isTemplateKind(kind, 'doc')) return t('templates.kindDoc');
  return String(kind);
}

function templateAccent(template: WorkTemplate, colors: ThemeColors): string {
  if (template.color && /^#[0-9a-f]{6}$/i.test(template.color)) return template.color;
  if (isTemplateKind(template.kind, 'project')) return colors.accentCyan;
  if (isTemplateKind(template.kind, 'issue')) return colors.accentViolet;
  if (isTemplateKind(template.kind, 'doc')) return colors.accentEmerald;
  return colors.accentBlue;
}

function templateIcon(template: WorkTemplate): string | null {
  const icon = template.icon?.trim();
  return icon ? icon.slice(0, 4) : null;
}

function FilterPill({
  label,
  selected,
  onPress,
}: {
  label: string;
  selected: boolean;
  onPress: () => void;
}) {
  const { styles } = useTemplatesScreenTheme();

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected }}
      onPress={onPress}
      style={[styles.filterPill, selected ? styles.filterPillActive : null]}
      className="active:opacity-80"
    >
      <Text style={[styles.filterText, selected ? styles.filterTextActive : null]}>{label}</Text>
    </Pressable>
  );
}

function TargetPill({
  label,
  detail,
  selected,
  onPress,
}: {
  label: string;
  detail?: string | null;
  selected: boolean;
  onPress: () => void;
}) {
  const { styles } = useTemplatesScreenTheme();

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected }}
      onPress={onPress}
      style={[styles.targetPill, selected ? styles.targetPillActive : null]}
      className="active:opacity-80"
    >
      <Text
        style={[styles.targetLabel, selected ? styles.targetLabelActive : null]}
        numberOfLines={1}
      >
        {label}
      </Text>
      {detail ? (
        <Text style={styles.targetDetail} numberOfLines={1}>
          {detail}
        </Text>
      ) : null}
    </Pressable>
  );
}

function TemplateCard({
  template,
  selected,
  onPress,
}: {
  template: WorkTemplate;
  selected: boolean;
  onPress: () => void;
}) {
  const { t } = useTranslation();
  const { colors, styles } = useTemplatesScreenTheme();
  const accent = templateAccent(template, colors);
  const icon = templateIcon(template);
  const category = String(template.category).toLowerCase() as TemplateCategory;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected }}
      onPress={onPress}
      style={[
        styles.templateCard,
        { borderTopColor: accent },
        selected ? styles.templateCardActive : null,
      ]}
      className="active:opacity-80"
    >
      <View style={styles.templateHeader}>
        <View
          style={[
            styles.templateTile,
            { borderColor: `${accent}42`, backgroundColor: `${accent}1F` },
          ]}
        >
          {icon ? (
            <Text style={styles.templateEmoji}>{icon}</Text>
          ) : isTemplateKind(template.kind, 'project') ? (
            <FolderKanban size={18} color={accent} />
          ) : isTemplateKind(template.kind, 'doc') ? (
            <FileText size={18} color={accent} />
          ) : (
            <ListTodo size={18} color={accent} />
          )}
        </View>

        <View className="min-w-0 flex-1 gap-1">
          <Text className="text-foreground text-base font-semibold" numberOfLines={1}>
            {template.name}
          </Text>
          {template.description ? (
            <Text className="text-muted-foreground text-sm" numberOfLines={2}>
              {template.description}
            </Text>
          ) : null}
        </View>
      </View>

      <View style={styles.templateFooter}>
        <View style={styles.templateBadges}>
          <SemanticBadge
            label={
              isKnownCategory(category)
                ? t(categoryLabelKey(category as FilterValue))
                : String(template.category)
            }
            tone="neutral"
          />
          <SemanticBadge label={templateKindLabel(t, template.kind)} tone="blue" />
          {template.isVerified ? (
            <SemanticBadge label={t('templates.verified')} tone="emerald" />
          ) : null}
        </View>
        {template.payload.labels && Array.isArray(template.payload.labels) ? (
          <View style={styles.labelCount}>
            <Tag size={12} color={colors.mutedForeground} />
            <Text style={styles.labelCountText}>{template.payload.labels.length}</Text>
          </View>
        ) : null}
      </View>
    </Pressable>
  );
}

export function TemplatesScreen() {
  const { t } = useTranslation();
  const navigation = useNavigation<TemplatesNavigation>();
  const { colors, styles } = useTemplatesScreenTheme();
  const templatesQ = useTemplates();
  const projectsQ = useProjects();
  const spacesQ = useDocumentSpaces();
  const instantiate = useInstantiateTemplate();
  const createPage = useCreateDocumentPage();

  const templates = useMemo(() => templatesQ.data?.templates ?? [], [templatesQ.data?.templates]);
  const projects = useMemo(() => projectsQ.data ?? [], [projectsQ.data]);
  const writableSpaces = useMemo(
    () => (spacesQ.data ?? []).filter((space) => space.permissions?.canCreate === true),
    [spacesQ.data],
  );

  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<FilterValue>('all');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [key, setKey] = useState('');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [keyManual, setKeyManual] = useState(false);
  const [projectId, setProjectId] = useState<string | null>(null);
  const [spaceId, setSpaceId] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);

  const selected = templates.find((template) => template.id === selectedId) ?? null;
  const isApplying = instantiate.isPending || createPage.isPending;
  const isRefreshing = templatesQ.isRefetching || projectsQ.isRefetching || spacesQ.isRefetching;

  useEffect(() => {
    if (!selected && templates[0]) setSelectedId(templates[0].id);
  }, [selected, templates]);

  useEffect(() => {
    if (!selected) return;
    const initialName = stringPayload(selected, ['name'], selected.name);
    const initialTitle = stringPayload(selected, ['title', 'name'], selected.name);
    const initialDescription = stringPayload(
      selected,
      ['description', 'body', 'content', 'contentText'],
      selected.description ?? '',
    );
    setName(initialName);
    setKey(normalizeProjectKey(stringPayload(selected, ['key'], deriveProjectKey(initialName))));
    setTitle(initialTitle);
    setDescription(initialDescription);
    setKeyManual(false);
    setProjectId((current) => current ?? projects[0]?.id ?? null);
    setSpaceId((current) => current ?? writableSpaces[0]?.id ?? null);
    setFormError(null);
  }, [projects, selected, writableSpaces]);

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return templates.filter((template) => {
      const category = String(template.category).toLowerCase();
      if (filter !== 'all' && category !== filter) return false;
      if (!needle) return true;
      return [
        template.name,
        template.description ?? '',
        template.kind,
        template.category,
        ...((Array.isArray(template.payload.labels) ? template.payload.labels : []) as string[]),
      ]
        .join(' ')
        .toLowerCase()
        .includes(needle);
    });
  }, [filter, query, templates]);

  const refresh = () => {
    void templatesQ.refetch();
    void projectsQ.refetch();
    void spacesQ.refetch();
  };

  const applySelected = async (): Promise<void> => {
    if (!selected) return;
    setFormError(null);

    try {
      if (isTemplateKind(selected.kind, 'project')) {
        if (!name.trim() || !/^[A-Z][A-Z0-9]{1,9}$/.test(key)) {
          setFormError(t('validation.projectKeyInvalid'));
          return;
        }
        const result = await instantiate.mutateAsync({
          templateId: selected.id,
          overrides: {
            name: name.trim(),
            key,
            description: description.trim() || null,
          },
        });
        if (result.resource?.id) navigation.navigate('ProjectDetail', { id: result.resource.id });
        return;
      }

      if (isTemplateKind(selected.kind, 'issue')) {
        if (!projectId) {
          setFormError(t('validation.projectRequired'));
          return;
        }
        if (!title.trim()) {
          setFormError(t('validation.titleRequired'));
          return;
        }
        const result = await instantiate.mutateAsync({
          templateId: selected.id,
          overrides: {
            projectId,
            title: title.trim(),
            description: description.trim() || null,
          },
        });
        if (result.resource?.id) navigation.navigate('IssueDetail', { id: result.resource.id });
        return;
      }

      if (!spaceId) {
        setFormError(t('docs.readOnly'));
        return;
      }
      if (!title.trim()) {
        setFormError(t('validation.titleRequired'));
        return;
      }

      const result = await instantiate.mutateAsync({
        templateId: selected.id,
        overrides: { title: title.trim(), description: description.trim() || null },
      });
      const payload = result.payload ?? selected.payload;
      const content = stringPayload(
        { ...selected, payload },
        ['content', 'contentText', 'body'],
        description,
      );
      const created = await createPage.mutateAsync({
        title: title.trim(),
        spaceId,
        contentJson: documentTextToContentJson(content),
      });
      navigation.navigate('DocumentDetail', { id: created.id });
    } catch {
      setFormError(t('templates.applyFailed'));
    }
  };

  if (templatesQ.isLoading) return <Loading label={t('templates.loading')} />;
  if (templatesQ.isError) {
    return (
      <Screen>
        <ErrorView
          message={
            templatesQ.error instanceof Error
              ? templatesQ.error.message
              : t('templates.applyFailed')
          }
          onRetry={refresh}
        />
      </Screen>
    );
  }

  return (
    <Screen>
      <KeyboardAvoidingView
        className="flex-1"
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          className="flex-1"
          keyboardShouldPersistTaps="handled"
          refreshControl={<RefreshControl refreshing={isRefreshing} onRefresh={refresh} />}
          contentContainerStyle={styles.content}
        >
          <ScreenHeader
            kicker={t('common.appName')}
            title={t('templates.title')}
            subtitle={t('templates.subtitle')}
            meta={<SemanticBadge label={String(templates.length)} tone="blue" />}
          />

          <View style={styles.searchRow}>
            <View style={styles.searchIcon}>
              <Search size={16} color={colors.mutedForeground} />
            </View>
            <TextField
              style={styles.searchInput}
              placeholder={t('templates.searchPlaceholder')}
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
                label={t(categoryLabelKey(item))}
                selected={filter === item}
                onPress={() => setFilter(item)}
              />
            ))}
          </ScrollView>

          {filtered.length === 0 ? (
            <EmptyState
              icon={BookOpenText}
              title={t('templates.noMatch')}
              description={t('templates.noMatchHint')}
            />
          ) : (
            <View style={styles.grid}>
              {filtered.map((template) => (
                <TemplateCard
                  key={template.id}
                  template={template}
                  selected={selected?.id === template.id}
                  onPress={() => setSelectedId(template.id)}
                />
              ))}
            </View>
          )}

          {selected ? (
            <View style={styles.applyPanel}>
              <View style={styles.applyHeader}>
                <CheckCircle2 size={18} color={colors.accentEmerald} />
                <View className="min-w-0 flex-1 gap-1">
                  <Text className="text-foreground text-base font-semibold" numberOfLines={1}>
                    {t('templates.useTemplate')}
                  </Text>
                  <Text className="text-muted-foreground text-sm" numberOfLines={2}>
                    {selected.name}
                  </Text>
                </View>
                <SemanticBadge label={templateKindLabel(t, selected.kind)} tone="blue" />
              </View>

              {isTemplateKind(selected.kind, 'project') ? (
                <View style={styles.formBlock}>
                  <TextField
                    label={t('projects.nameLabel')}
                    value={name}
                    onChangeText={(value) => {
                      setName(value);
                      if (!keyManual) setKey(normalizeProjectKey(deriveProjectKey(value)));
                    }}
                    editable={!isApplying}
                  />
                  <TextField
                    label={t('projects.keyLabel')}
                    value={key}
                    onChangeText={(value) => {
                      setKeyManual(true);
                      setKey(normalizeProjectKey(value));
                    }}
                    autoCapitalize="characters"
                    autoCorrect={false}
                    editable={!isApplying}
                  />
                  <TextField
                    label={t('issue.description')}
                    value={description}
                    onChangeText={setDescription}
                    multiline
                    textAlignVertical="top"
                    editable={!isApplying}
                    style={styles.multiline}
                  />
                </View>
              ) : null}

              {isTemplateKind(selected.kind, 'issue') ? (
                <View style={styles.formBlock}>
                  <Text className="text-foreground text-sm font-medium">{t('issues.project')}</Text>
                  {projects.length === 0 ? (
                    <Text className="text-muted-foreground text-sm">{t('projects.empty')}</Text>
                  ) : (
                    <View style={styles.targetList}>
                      {projects.map((project: Project) => (
                        <TargetPill
                          key={project.id}
                          label={project.name}
                          detail={project.key}
                          selected={projectId === project.id}
                          onPress={() => setProjectId(project.id)}
                        />
                      ))}
                    </View>
                  )}
                  <TextField
                    label={t('issues.titleLabel')}
                    value={title}
                    onChangeText={setTitle}
                    editable={!isApplying}
                  />
                  <TextField
                    label={t('issue.description')}
                    value={description}
                    onChangeText={setDescription}
                    multiline
                    textAlignVertical="top"
                    editable={!isApplying}
                    style={styles.multiline}
                  />
                </View>
              ) : null}

              {isTemplateKind(selected.kind, 'doc') ? (
                <View style={styles.formBlock}>
                  <Text className="text-foreground text-sm font-medium">{t('docs.title')}</Text>
                  {writableSpaces.length === 0 ? (
                    <Text className="text-muted-foreground text-sm">{t('docs.readOnly')}</Text>
                  ) : (
                    <View style={styles.targetList}>
                      {writableSpaces.map((space: DocumentSpace) => (
                        <TargetPill
                          key={space.id}
                          label={space.name}
                          detail={space.scope}
                          selected={spaceId === space.id}
                          onPress={() => setSpaceId(space.id)}
                        />
                      ))}
                    </View>
                  )}
                  <TextField
                    label={t('issues.titleLabel')}
                    value={title}
                    onChangeText={setTitle}
                    editable={!isApplying}
                  />
                  <TextField
                    label={t('issue.description')}
                    value={description}
                    onChangeText={setDescription}
                    multiline
                    textAlignVertical="top"
                    editable={!isApplying}
                    style={styles.multiline}
                  />
                </View>
              ) : null}

              {formError ? <Text className="text-destructive text-sm">{formError}</Text> : null}

              <Button
                title={
                  isTemplateKind(selected.kind, 'project')
                    ? t('projects.create')
                    : isTemplateKind(selected.kind, 'issue')
                      ? t('issues.create')
                      : t('docs.create')
                }
                icon={
                  isTemplateKind(selected.kind, 'project')
                    ? FolderKanban
                    : isTemplateKind(selected.kind, 'issue')
                      ? ListTodo
                      : FileText
                }
                loading={isApplying}
                disabled={isApplying}
                onPress={() => {
                  void applySelected();
                }}
              />
            </View>
          ) : null}
        </ScrollView>
      </KeyboardAvoidingView>
    </Screen>
  );
}

function createTemplatesScreenStyles(colors: ThemeColors) {
  return StyleSheet.create({
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
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
      borderRadius: 999,
      backgroundColor: colors.card,
      paddingHorizontal: 12,
      paddingVertical: 7,
    },
    filterPillActive: {
      borderColor: 'transparent',
      backgroundColor: colors.primary,
    },
    filterText: {
      color: colors.mutedForeground,
      fontSize: 12,
      fontWeight: '600',
      lineHeight: 16,
    },
    filterTextActive: {
      color: colors.primaryForeground,
    },
    grid: {
      gap: 12,
      paddingHorizontal: 16,
    },
    templateCard: {
      gap: 12,
      borderWidth: StyleSheet.hairlineWidth,
      borderTopWidth: 2,
      borderColor: colors.border,
      borderRadius: 6,
      backgroundColor: colors.card,
      padding: 14,
    },
    templateCardActive: {
      borderColor: colors.primary,
    },
    templateHeader: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: 12,
    },
    templateTile: {
      width: 40,
      height: 40,
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: StyleSheet.hairlineWidth,
      borderRadius: 6,
    },
    templateEmoji: {
      fontSize: 20,
      lineHeight: 24,
    },
    templateFooter: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 10,
    },
    templateBadges: {
      minWidth: 0,
      flex: 1,
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 6,
    },
    labelCount: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
    },
    labelCountText: {
      color: colors.mutedForeground,
      fontSize: 11,
      lineHeight: 16,
    },
    applyPanel: {
      gap: 14,
      marginHorizontal: 16,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
      borderRadius: 6,
      backgroundColor: colors.surface,
      padding: 14,
    },
    applyHeader: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: 10,
    },
    formBlock: {
      gap: 12,
    },
    targetList: {
      gap: 8,
    },
    targetPill: {
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
      borderRadius: 6,
      backgroundColor: colors.card,
      paddingHorizontal: 12,
      paddingVertical: 10,
    },
    targetPillActive: {
      borderColor: colors.primary,
      backgroundColor: `${colors.primary}18`,
    },
    targetLabel: {
      color: colors.foreground,
      fontSize: 13,
      fontWeight: '600',
      lineHeight: 18,
    },
    targetLabelActive: {
      color: colors.primary,
    },
    targetDetail: {
      color: colors.mutedForeground,
      fontSize: 11,
      lineHeight: 16,
    },
    multiline: {
      minHeight: 92,
      paddingTop: 10,
    },
  });
}
