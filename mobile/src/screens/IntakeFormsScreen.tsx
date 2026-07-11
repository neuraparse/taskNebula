import { useCallback, useEffect, useMemo, useRef, useState, type ComponentRef } from 'react';
import { Alert } from 'react-native';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from '@/components/native';
import {
  ArrowDown,
  ArrowUp,
  ClipboardList,
  ExternalLink,
  Eye,
  EyeOff,
  Plus,
  Save,
  ShieldCheck,
  Trash2,
  X,
} from 'lucide-react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useTranslation } from 'react-i18next';

import type { IntakeFieldDefinition, IntakeFieldType, IntakeForm, Project } from '@/api/types';
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
import { useThemeColors, useThemeEffects } from '@/design/theme-context';
import {
  useCreateIntakeForm,
  useDeleteIntakeForm,
  useIntakeForm,
  useIntakeForms,
  useProjects,
  useUpdateIntakeForm,
} from '@/hooks/queries';
import { relativeTime } from '@/lib/format';
import type { AppStackParamList } from '@/navigation/types';

const FIELD_TYPES = ['text', 'textarea', 'email', 'select', 'file'] as const;
const TARGET_STATUSES = ['triage', 'backlog', 'in_progress'] as const;
const FIELD_NAME_RE = /^[a-zA-Z_][a-zA-Z0-9_]*$/;
const SLUG_RE = /^[a-z0-9](?:[a-z0-9-]{0,62}[a-z0-9])?$/;

type SupportedFieldType = (typeof FIELD_TYPES)[number];
type IntakeFormsProps = NativeStackScreenProps<AppStackParamList, 'IntakeForms'>;
type IntakeFormsStyles = ReturnType<typeof createIntakeFormsStyles>;

interface DraftState {
  slug: string;
  title: string;
  description: string;
  fields: IntakeFieldDefinition[];
  fieldKeys: string[];
  isPublic: boolean;
  requiresCaptcha: boolean;
  targetStatus: string;
}

function useIntakeFormsTheme(): { colors: ThemeColors; styles: IntakeFormsStyles } {
  const colors = useThemeColors();
  const styles = useMemo(() => createIntakeFormsStyles(colors), [colors]);

  return { colors, styles };
}

let draftFieldKeySequence = 0;

function nextDraftFieldKey(): string {
  draftFieldKeySequence += 1;
  return `field-${draftFieldKeySequence}`;
}

function sanitizeSlug(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 64);
}

function suggestSlug(value: string): string {
  return sanitizeSlug(value) || 'intake-form';
}

function sanitizeFieldName(value: string): string {
  const cleaned = value.replace(/[^a-zA-Z0-9_]/g, '_');
  if (!cleaned) return '';
  return /^[a-zA-Z_]/.test(cleaned) ? cleaned : `field_${cleaned}`;
}

function defaultFields(t: ReturnType<typeof useTranslation>['t']): IntakeFieldDefinition[] {
  return [
    { name: 'summary', label: t('intakeForms.defaultSummary'), type: 'text', required: true },
    { name: 'details', label: t('intakeForms.defaultDetails'), type: 'textarea' },
    { name: 'email', label: t('intakeForms.defaultEmail'), type: 'email' },
  ];
}

function projectLabel(project: Project | undefined, fallback: string): string {
  if (!project) return fallback;
  return `${project.name} (${project.key})`;
}

function publicIntakePath(slug: string): string {
  return `/intake/${slug}`;
}

function fieldTypeLabel(type: IntakeFieldType, t: ReturnType<typeof useTranslation>['t']): string {
  if (type === 'text') return t('intakeForms.fieldTypeText');
  if (type === 'textarea') return t('intakeForms.fieldTypeTextarea');
  if (type === 'email') return t('intakeForms.fieldTypeEmail');
  if (type === 'select') return t('intakeForms.fieldTypeSelect');
  if (type === 'file') return t('intakeForms.fieldTypeFile');
  return String(type);
}

function targetStatusLabel(status: string, t: ReturnType<typeof useTranslation>['t']): string {
  if (status === 'triage') return t('intakeForms.targetTriage');
  if (status === 'backlog') return t('intakeForms.targetBacklog');
  if (status === 'in_progress') return t('intakeForms.targetInProgress');
  return status;
}

function formToDraft(form: IntakeForm): DraftState {
  return {
    slug: form.slug,
    title: form.title,
    description: form.description ?? '',
    fields: form.fields,
    fieldKeys: form.fields.map(() => nextDraftFieldKey()),
    isPublic: form.isPublic,
    requiresCaptcha: form.requiresCaptcha,
    targetStatus: form.targetStatus,
  };
}

function validateDraft(
  draft: DraftState,
  t: ReturnType<typeof useTranslation>['t'],
): string | null {
  if (!draft.title.trim()) return t('intakeForms.errorTitleRequired');
  if (!SLUG_RE.test(draft.slug.trim())) return t('intakeForms.errorSlugInvalid');
  const names = new Set<string>();
  for (const field of draft.fields) {
    if (!field.label.trim()) return t('intakeForms.errorFieldLabelRequired');
    if (!FIELD_NAME_RE.test(field.name)) return t('intakeForms.errorFieldNameInvalid');
    if (names.has(field.name)) return t('intakeForms.errorFieldNameDuplicate');
    names.add(field.name);
    if (field.type === 'select' && (!field.options || field.options.length === 0)) {
      return t('intakeForms.errorSelectOptionsRequired');
    }
  }
  return null;
}

function TogglePill({
  label,
  selected,
  disabled,
  onPress,
}: {
  label: string;
  selected: boolean;
  disabled?: boolean;
  onPress: () => void;
}) {
  const { styles } = useIntakeFormsTheme();

  return (
    <Pressable
      accessibilityRole="switch"
      accessibilityState={{ checked: selected, disabled }}
      disabled={disabled}
      onPress={onPress}
      style={[
        styles.togglePill,
        selected ? styles.togglePillActive : null,
        disabled ? styles.disabled : null,
      ]}
      className="active:opacity-80"
    >
      <Text style={[styles.togglePillText, selected ? styles.togglePillTextActive : null]}>
        {label}
      </Text>
    </Pressable>
  );
}

function ChoicePill<T extends string>({
  label,
  selected,
  value,
  disabled,
  onPress,
}: {
  label: string;
  selected: boolean;
  value: T;
  disabled?: boolean;
  onPress: (value: T) => void;
}) {
  const { styles } = useIntakeFormsTheme();

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected, disabled }}
      disabled={disabled}
      onPress={() => onPress(value)}
      style={[
        styles.choicePill,
        selected ? styles.choicePillActive : null,
        disabled ? styles.disabled : null,
      ]}
      className="active:opacity-80"
    >
      <Text style={[styles.choicePillText, selected ? styles.choicePillTextActive : null]}>
        {label}
      </Text>
    </Pressable>
  );
}

function FormCard({
  form,
  selected,
  project,
  onDelete,
  onOpen,
  onPress,
}: {
  form: IntakeForm;
  selected: boolean;
  project: Project | undefined;
  onDelete: (form: IntakeForm) => void;
  onOpen: (form: IntakeForm) => void;
  onPress: (form: IntakeForm) => void;
}) {
  const { t } = useTranslation();
  const { colors, styles } = useIntakeFormsTheme();
  const updatedAt = relativeTime(form.updatedAt);

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected }}
      onPress={() => onPress(form)}
      style={[styles.formCard, selected ? styles.formCardActive : null]}
      className="active:opacity-80"
    >
      <View style={styles.formCardHeader}>
        <View style={styles.formCardTitleWrap}>
          <Text style={styles.formTitle} numberOfLines={1}>
            {form.title}
          </Text>
          <Text style={styles.formMeta} numberOfLines={1}>
            {projectLabel(project, form.projectId)} {publicIntakePath(form.slug)}
          </Text>
        </View>
        <View style={styles.formBadges}>
          <SemanticBadge
            label={form.isPublic ? t('intakeForms.public') : t('intakeForms.private')}
            tone={form.isPublic ? 'emerald' : 'neutral'}
          />
          <SemanticBadge
            label={t('intakeForms.fieldCount', { count: form.fields.length })}
            tone="blue"
          />
        </View>
      </View>
      {form.description ? (
        <Text style={styles.formDescription} numberOfLines={2}>
          {form.description}
        </Text>
      ) : null}
      <View style={styles.cardActions}>
        <Text style={styles.updatedText} numberOfLines={1}>
          {updatedAt ? t('intakeForms.updatedAt', { time: updatedAt }) : t('common.none')}
        </Text>
        <View style={styles.iconActions}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t('intakeForms.openPublic')}
            onPress={() => onOpen(form)}
            style={styles.iconButton}
            className="active:opacity-80"
          >
            <ExternalLink size={16} color={colors.mutedForeground} />
          </Pressable>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t('intakeForms.delete')}
            onPress={() => onDelete(form)}
            style={styles.iconButton}
            className="active:opacity-80"
          >
            <Trash2 size={16} color={colors.destructive} />
          </Pressable>
        </View>
      </View>
    </Pressable>
  );
}

function FieldEditor({
  disabled,
  field,
  index,
  isFirst,
  isLast,
  onMove,
  onRemove,
  onUpdate,
}: {
  disabled: boolean;
  field: IntakeFieldDefinition;
  index: number;
  isFirst: boolean;
  isLast: boolean;
  onMove: (index: number, direction: -1 | 1) => void;
  onRemove: (index: number) => void;
  onUpdate: (index: number, patch: Partial<IntakeFieldDefinition>) => void;
}) {
  const { t } = useTranslation();
  const { colors, styles } = useIntakeFormsTheme();
  const optionsValue = (field.options ?? []).join('\n');

  return (
    <SurfaceRow className="gap-3">
      <View style={styles.fieldHeader}>
        <View className="min-w-0 flex-1 gap-1">
          <Text style={styles.fieldTitle} numberOfLines={1}>
            {t('intakeForms.fieldOrdinal', { index: index + 1 })}
          </Text>
          <Text style={styles.formMeta} numberOfLines={1}>
            {field.name || t('intakeForms.fieldNamePlaceholder')}
          </Text>
        </View>
        <View style={styles.iconActions}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t('intakeForms.moveUp')}
            disabled={disabled || isFirst}
            onPress={() => onMove(index, -1)}
            style={[styles.iconButton, disabled || isFirst ? styles.disabled : null]}
          >
            <ArrowUp size={16} color={colors.mutedForeground} />
          </Pressable>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t('intakeForms.moveDown')}
            disabled={disabled || isLast}
            onPress={() => onMove(index, 1)}
            style={[styles.iconButton, disabled || isLast ? styles.disabled : null]}
          >
            <ArrowDown size={16} color={colors.mutedForeground} />
          </Pressable>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t('intakeForms.removeField')}
            disabled={disabled}
            onPress={() => onRemove(index)}
            style={[styles.iconButton, disabled ? styles.disabled : null]}
          >
            <Trash2 size={16} color={colors.destructive} />
          </Pressable>
        </View>
      </View>

      <TextField
        label={t('intakeForms.fieldLabel')}
        value={field.label}
        editable={!disabled}
        onChangeText={(label) => onUpdate(index, { label })}
      />
      <TextField
        label={t('intakeForms.fieldName')}
        value={field.name}
        editable={!disabled}
        autoCapitalize="none"
        autoCorrect={false}
        onChangeText={(name) => onUpdate(index, { name: sanitizeFieldName(name) })}
      />
      <View style={styles.sectionBlock}>
        <Text style={styles.sectionLabel}>{t('intakeForms.fieldType')}</Text>
        <View style={styles.choiceWrap}>
          {FIELD_TYPES.map((type) => (
            <ChoicePill
              key={type}
              label={fieldTypeLabel(type, t)}
              value={type}
              selected={field.type === type}
              disabled={disabled}
              onPress={(nextType: SupportedFieldType) => {
                const patch: Partial<IntakeFieldDefinition> = { type: nextType };
                if (nextType === 'select') patch.options = field.options ?? [];
                onUpdate(index, patch);
              }}
            />
          ))}
        </View>
      </View>
      <TogglePill
        label={t('intakeForms.required')}
        selected={field.required === true}
        disabled={disabled}
        onPress={() => onUpdate(index, { required: !field.required })}
      />
      {field.type === 'select' ? (
        <View style={styles.sectionBlock}>
          <Text style={styles.sectionLabel}>{t('intakeForms.options')}</Text>
          <TextInput
            value={optionsValue}
            editable={!disabled}
            multiline
            placeholder={t('intakeForms.optionsPlaceholder')}
            placeholderTextColor={colors.mutedForeground}
            onChangeText={(value) =>
              onUpdate(index, {
                options: value
                  .split('\n')
                  .map((item) => item.trim())
                  .filter(Boolean),
              })
            }
            style={styles.textArea}
          />
        </View>
      ) : null}
    </SurfaceRow>
  );
}

export function IntakeFormsScreen({ navigation, route }: IntakeFormsProps) {
  const { t } = useTranslation();
  const { colors, styles } = useIntakeFormsTheme();
  const effects = useThemeEffects();
  const routeFormId = route.params?.formId ?? null;
  const scrollRef = useRef<ComponentRef<typeof ScrollView>>(null);
  const editorOffsetRef = useRef<number | null>(null);
  const pendingEditorScrollRef = useRef(routeFormId !== null);
  const projectsQ = useProjects();
  const formsQ = useIntakeForms();
  const createForm = useCreateIntakeForm();
  const updateForm = useUpdateIntakeForm();
  const deleteForm = useDeleteIntakeForm();

  const [createOpen, setCreateOpen] = useState(false);
  const [selectedFormId, setSelectedFormId] = useState<string | null>(routeFormId);
  const [projectId, setProjectId] = useState('');
  const [newTitle, setNewTitle] = useState('');
  const [newSlug, setNewSlug] = useState('');
  const [draft, setDraft] = useState<DraftState | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const projects = useMemo(() => projectsQ.data ?? [], [projectsQ.data]);
  const forms = useMemo(() => formsQ.data ?? [], [formsQ.data]);
  const projectById = useMemo(() => {
    const map = new Map<string, Project>();
    for (const project of projects) map.set(project.id, project);
    return map;
  }, [projects]);
  const selectedFormQ = useIntakeForm(selectedFormId);
  const selectedForm =
    selectedFormQ.data ?? forms.find((form) => form.id === selectedFormId) ?? null;
  const busy = createForm.isPending || updateForm.isPending || deleteForm.isPending;

  const scrollToEditor = useCallback(() => {
    const offset = editorOffsetRef.current;
    if (offset === null) {
      pendingEditorScrollRef.current = true;
      return;
    }
    scrollRef.current?.scrollTo({
      y: Math.max(offset - 12, 0),
      animated: effects.animationsEnabled,
    });
    pendingEditorScrollRef.current = false;
  }, [effects.animationsEnabled]);

  const handleEditorLayout = useCallback(
    (y: number) => {
      editorOffsetRef.current = y;
      if (pendingEditorScrollRef.current) {
        requestAnimationFrame(scrollToEditor);
      }
    },
    [scrollToEditor],
  );

  useEffect(() => {
    if (!projectId && projects[0]?.id) setProjectId(projects[0].id);
  }, [projectId, projects]);

  useEffect(() => {
    if (!routeFormId) return;
    setSelectedFormId(routeFormId);
    pendingEditorScrollRef.current = true;
  }, [routeFormId]);

  useEffect(() => {
    if (!selectedFormId && forms[0]?.id) setSelectedFormId(forms[0].id);
    if (
      selectedFormId &&
      forms.length > 0 &&
      !forms.some((form) => form.id === selectedFormId) &&
      selectedFormQ.isError
    ) {
      setSelectedFormId(forms[0]?.id ?? null);
    }
  }, [forms, selectedFormId, selectedFormQ.isError]);

  useEffect(() => {
    if (!selectedForm) {
      setDraft(null);
      return;
    }
    setDraft(formToDraft(selectedForm));
    setError(null);
    setNotice(null);
    if (routeFormId && selectedForm.id === routeFormId) {
      requestAnimationFrame(scrollToEditor);
    }
  }, [routeFormId, scrollToEditor, selectedForm]);

  const createNewForm = async () => {
    const cleanTitle = newTitle.trim();
    const cleanSlug = sanitizeSlug(newSlug || newTitle);
    if (!projectId || !cleanTitle || !cleanSlug) {
      setError(t('intakeForms.errorProjectSlugTitleRequired'));
      return;
    }
    if (!SLUG_RE.test(cleanSlug)) {
      setError(t('intakeForms.errorSlugInvalid'));
      return;
    }

    setError(null);
    setNotice(null);
    try {
      const form = await createForm.mutateAsync({
        projectId,
        title: cleanTitle,
        slug: cleanSlug,
        fields: defaultFields(t),
        isPublic: true,
        requiresCaptcha: false,
        targetStatus: 'triage',
      });
      setSelectedFormId(form.id);
      setCreateOpen(false);
      setNewTitle('');
      setNewSlug('');
      setNotice(t('intakeForms.created'));
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : t('intakeForms.errorCreate'));
    }
  };

  const updateDraft = (patch: Partial<DraftState>) => {
    setDraft((current) => (current ? { ...current, ...patch } : current));
    setNotice(null);
    setError(null);
  };

  const updateField = (index: number, patch: Partial<IntakeFieldDefinition>) => {
    setDraft((current) => {
      if (!current) return current;
      const fields = current.fields.map((field, itemIndex) => {
        if (itemIndex !== index) return field;
        const next = { ...field, ...patch };
        if (patch.type && patch.type !== 'select') {
          delete next.options;
        }
        return next;
      });
      return { ...current, fields };
    });
    setNotice(null);
    setError(null);
  };

  const addField = () => {
    setDraft((current) => {
      if (!current) return current;
      const index = current.fields.length + 1;
      return {
        ...current,
        fields: [
          ...current.fields,
          {
            name: `field_${index}`,
            label: t('intakeForms.fieldDefaultLabel', { index }),
            type: 'text',
          },
        ],
        fieldKeys: [...current.fieldKeys, nextDraftFieldKey()],
      };
    });
    setNotice(null);
    setError(null);
  };

  const removeField = (index: number) => {
    setDraft((current) =>
      current
        ? {
            ...current,
            fields: current.fields.filter((_field, itemIndex) => itemIndex !== index),
            fieldKeys: current.fieldKeys.filter((_key, itemIndex) => itemIndex !== index),
          }
        : current,
    );
    setNotice(null);
    setError(null);
  };

  const moveField = (index: number, direction: -1 | 1) => {
    setDraft((current) => {
      if (!current) return current;
      const target = index + direction;
      if (target < 0 || target >= current.fields.length) return current;
      const fields = current.fields.slice();
      const fieldKeys = current.fieldKeys.slice();
      const [item] = fields.splice(index, 1);
      const [key] = fieldKeys.splice(index, 1);
      if (!item) return current;
      if (!key) return current;
      fields.splice(target, 0, item);
      fieldKeys.splice(target, 0, key);
      return { ...current, fields, fieldKeys };
    });
    setNotice(null);
    setError(null);
  };

  const saveSelectedForm = async () => {
    if (!selectedForm || !draft) return;
    const validationError = validateDraft(draft, t);
    if (validationError) {
      setError(validationError);
      return;
    }

    setError(null);
    setNotice(null);
    try {
      await updateForm.mutateAsync({
        formId: selectedForm.id,
        title: draft.title.trim(),
        slug: draft.slug.trim(),
        description: draft.description.trim() || null,
        fields: draft.fields,
        isPublic: draft.isPublic,
        requiresCaptcha: draft.requiresCaptcha,
        targetStatus: draft.targetStatus,
      });
      setNotice(t('intakeForms.saved'));
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : t('intakeForms.errorSave'));
    }
  };

  const confirmDelete = (form: IntakeForm) => {
    Alert.alert(t('intakeForms.delete'), form.title, [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('intakeForms.delete'),
        style: 'destructive',
        onPress: () => {
          void deleteForm
            .mutateAsync({ id: form.id, projectId: form.projectId })
            .then(() => {
              setNotice(t('intakeForms.deleted'));
              if (selectedFormId === form.id) setSelectedFormId(null);
            })
            .catch((err: unknown) => {
              setError(err instanceof Error ? err.message : t('intakeForms.errorDelete'));
            });
        },
      },
    ]);
  };

  const openPublicForm = (form: IntakeForm) => {
    navigation.navigate('PublicIntake', { slug: form.slug });
  };

  if (projectsQ.isLoading || formsQ.isLoading) {
    return <Loading label={t('intakeForms.loading')} />;
  }

  if (formsQ.isError) {
    return (
      <Screen>
        <ScreenHeader
          kicker={t('intakeForms.kicker')}
          title={t('intakeForms.title')}
          subtitle={t('intakeForms.subtitle')}
        />
        <ErrorView
          message={
            formsQ.error instanceof Error ? formsQ.error.message : t('intakeForms.errorLoad')
          }
          onRetry={() => void formsQ.refetch()}
        />
      </Screen>
    );
  }

  return (
    <Screen>
      <ScreenHeader
        kicker={t('intakeForms.kicker')}
        title={t('intakeForms.title')}
        subtitle={t('intakeForms.subtitle')}
        meta={
          <SemanticBadge
            label={t('intakeForms.formCount', { count: forms.length })}
            tone="violet"
          />
        }
      />

      <ScrollView
        ref={scrollRef}
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
      >
        <SurfaceRow className="gap-3">
          <View style={styles.headerRow}>
            <View style={styles.headerCopy}>
              <View style={styles.sectionTitle}>
                <IconTile icon={ClipboardList} tone="violet" />
                <View className="min-w-0 flex-1 gap-1">
                  <Text style={styles.panelTitle}>{t('intakeForms.listTitle')}</Text>
                  <Text style={styles.panelSubtitle}>{t('intakeForms.listSubtitle')}</Text>
                </View>
              </View>
            </View>
            <Button
              title={createOpen ? t('common.cancel') : t('intakeForms.newForm')}
              icon={createOpen ? X : Plus}
              variant={createOpen ? 'secondary' : 'primary'}
              disabled={projects.length === 0 || busy}
              onPress={() => {
                setCreateOpen((current) => !current);
                setError(null);
                setNotice(null);
              }}
            />
          </View>

          {createOpen ? (
            <View style={styles.createPanel}>
              <TextField
                label={t('intakeForms.titleLabel')}
                value={newTitle}
                editable={!busy}
                placeholder={t('intakeForms.titlePlaceholder')}
                onChangeText={(value) => {
                  setNewTitle(value);
                  if (!newSlug.trim()) setNewSlug(suggestSlug(value));
                }}
              />
              <TextField
                label={t('intakeForms.slugLabel')}
                value={newSlug}
                editable={!busy}
                autoCapitalize="none"
                autoCorrect={false}
                placeholder={t('intakeForms.slugPlaceholder')}
                onChangeText={(value) => setNewSlug(sanitizeSlug(value))}
              />
              <View style={styles.sectionBlock}>
                <Text style={styles.sectionLabel}>{t('intakeForms.projectLabel')}</Text>
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={styles.choiceWrap}
                >
                  {projects.map((project) => (
                    <ChoicePill
                      key={project.id}
                      label={projectLabel(project, project.id)}
                      value={project.id}
                      selected={projectId === project.id}
                      disabled={busy}
                      onPress={setProjectId}
                    />
                  ))}
                </ScrollView>
              </View>
              <Button
                title={t('intakeForms.create')}
                icon={Plus}
                loading={createForm.isPending}
                disabled={busy || !projectId || !newTitle.trim()}
                onPress={() => void createNewForm()}
              />
            </View>
          ) : null}
        </SurfaceRow>

        {notice ? <Text style={styles.noticeText}>{notice}</Text> : null}
        {error ? <Text style={styles.errorText}>{error}</Text> : null}

        {forms.length === 0 ? (
          <View style={styles.emptyBox}>
            <EmptyState
              icon={ClipboardList}
              title={t('intakeForms.emptyTitle')}
              description={t('intakeForms.emptyDesc')}
            />
          </View>
        ) : (
          <View style={styles.formList}>
            {forms.map((form) => (
              <FormCard
                key={form.id}
                form={form}
                selected={selectedFormId === form.id}
                project={projectById.get(form.projectId)}
                onDelete={confirmDelete}
                onOpen={openPublicForm}
                onPress={(item) => setSelectedFormId(item.id)}
              />
            ))}
          </View>
        )}

        {selectedForm && draft ? (
          <SurfaceRow
            className="gap-4"
            onLayout={(event) => handleEditorLayout(event.nativeEvent.layout.y)}
          >
            <View style={styles.editorHeader}>
              <View className="min-w-0 flex-1 gap-1">
                <Text style={styles.panelTitle} numberOfLines={1}>
                  {t('intakeForms.editorTitle')}
                </Text>
                <Text style={styles.panelSubtitle} numberOfLines={2}>
                  {projectLabel(projectById.get(selectedForm.projectId), selectedForm.projectId)}{' '}
                  {publicIntakePath(draft.slug)}
                </Text>
              </View>
              <SemanticBadge
                label={draft.isPublic ? t('intakeForms.public') : t('intakeForms.private')}
                tone={draft.isPublic ? 'emerald' : 'neutral'}
              />
            </View>

            <TextField
              label={t('intakeForms.titleLabel')}
              value={draft.title}
              editable={!busy}
              onChangeText={(title) => updateDraft({ title })}
            />
            <TextField
              label={t('intakeForms.slugLabel')}
              value={draft.slug}
              editable={!busy}
              autoCapitalize="none"
              autoCorrect={false}
              onChangeText={(slug) => updateDraft({ slug: sanitizeSlug(slug) })}
            />
            <View style={styles.sectionBlock}>
              <Text style={styles.sectionLabel}>{t('intakeForms.descriptionLabel')}</Text>
              <TextInput
                value={draft.description}
                editable={!busy}
                multiline
                placeholder={t('intakeForms.descriptionPlaceholder')}
                placeholderTextColor={colors.mutedForeground}
                onChangeText={(description) => updateDraft({ description })}
                style={styles.textArea}
              />
            </View>

            <View style={styles.statusGrid}>
              <TogglePill
                label={draft.isPublic ? t('intakeForms.public') : t('intakeForms.private')}
                selected={draft.isPublic}
                disabled={busy}
                onPress={() => updateDraft({ isPublic: !draft.isPublic })}
              />
              <TogglePill
                label={t('intakeForms.requiresCaptcha')}
                selected={draft.requiresCaptcha}
                disabled={busy}
                onPress={() => updateDraft({ requiresCaptcha: !draft.requiresCaptcha })}
              />
            </View>

            <View style={styles.sectionBlock}>
              <Text style={styles.sectionLabel}>{t('intakeForms.targetStatus')}</Text>
              <View style={styles.choiceWrap}>
                {TARGET_STATUSES.map((status) => (
                  <ChoicePill
                    key={status}
                    label={targetStatusLabel(status, t)}
                    value={status}
                    selected={draft.targetStatus === status}
                    disabled={busy}
                    onPress={(targetStatus) => updateDraft({ targetStatus })}
                  />
                ))}
              </View>
            </View>

            <View style={styles.sectionHeader}>
              <View className="min-w-0 flex-1">
                <Text style={styles.panelTitle}>{t('intakeForms.fieldsTitle')}</Text>
                <Text style={styles.panelSubtitle}>{t('intakeForms.fieldsSubtitle')}</Text>
              </View>
              <Button
                title={t('intakeForms.addField')}
                icon={Plus}
                variant="secondary"
                disabled={busy}
                onPress={addField}
              />
            </View>

            {draft.fields.length === 0 ? (
              <Text style={styles.panelSubtitle}>{t('intakeForms.noFields')}</Text>
            ) : (
              <View style={styles.fieldList}>
                {draft.fields.map((field, index) => (
                  <FieldEditor
                    key={draft.fieldKeys[index] ?? field.name}
                    field={field}
                    index={index}
                    disabled={busy}
                    isFirst={index === 0}
                    isLast={index === draft.fields.length - 1}
                    onMove={moveField}
                    onRemove={removeField}
                    onUpdate={updateField}
                  />
                ))}
              </View>
            )}

            <View style={styles.editorActions}>
              <View style={styles.editorAction}>
                <Button
                  title={t('intakeForms.openPublic')}
                  icon={draft.isPublic ? Eye : EyeOff}
                  variant="secondary"
                  onPress={() => openPublicForm(selectedForm)}
                />
              </View>
              <View style={styles.editorAction}>
                <Button
                  title={t('intakeForms.save')}
                  icon={Save}
                  loading={updateForm.isPending}
                  disabled={busy}
                  onPress={() => void saveSelectedForm()}
                />
              </View>
            </View>
          </SurfaceRow>
        ) : null}

        <SurfaceRow className="gap-2">
          <View style={styles.sectionTitle}>
            <ShieldCheck size={16} color={colors.accentEmerald} />
            <Text style={styles.panelTitle}>{t('intakeForms.permissionTitle')}</Text>
          </View>
          <Text style={styles.panelSubtitle}>{t('intakeForms.permissionDesc')}</Text>
        </SurfaceRow>
      </ScrollView>
    </Screen>
  );
}

function createIntakeFormsStyles(colors: ThemeColors) {
  return StyleSheet.create({
    content: {
      gap: 12,
      paddingHorizontal: 16,
      paddingBottom: 16,
    },
    headerRow: {
      gap: 12,
    },
    headerCopy: {
      gap: 8,
    },
    sectionTitle: {
      minWidth: 0,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
    },
    panelTitle: {
      color: colors.foreground,
      fontSize: 15,
      fontWeight: '700',
      lineHeight: 20,
    },
    panelSubtitle: {
      color: colors.mutedForeground,
      fontSize: 13,
      lineHeight: 18,
    },
    createPanel: {
      gap: 12,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: colors.border,
      paddingTop: 12,
    },
    sectionBlock: {
      gap: 8,
    },
    sectionLabel: {
      color: colors.foreground,
      fontSize: 13,
      fontWeight: '700',
      lineHeight: 18,
    },
    choiceWrap: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 8,
    },
    choicePill: {
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
      borderRadius: 4,
      backgroundColor: colors.card,
      paddingHorizontal: 10,
      paddingVertical: 7,
    },
    choicePillActive: {
      borderColor: colors.primary,
      backgroundColor: colors.primary,
    },
    choicePillText: {
      color: colors.mutedForeground,
      fontSize: 12,
      fontWeight: '700',
      lineHeight: 16,
    },
    choicePillTextActive: {
      color: colors.primaryForeground,
    },
    togglePill: {
      minHeight: 36,
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
      borderRadius: 4,
      backgroundColor: colors.card,
      paddingHorizontal: 12,
      paddingVertical: 7,
    },
    togglePillActive: {
      borderColor: colors.primary,
      backgroundColor: `${colors.primary}18`,
    },
    togglePillText: {
      color: colors.mutedForeground,
      fontSize: 12,
      fontWeight: '700',
      lineHeight: 16,
    },
    togglePillTextActive: {
      color: colors.primary,
    },
    noticeText: {
      color: colors.accentEmerald,
      fontSize: 13,
      lineHeight: 18,
    },
    errorText: {
      color: colors.destructive,
      fontSize: 13,
      lineHeight: 18,
    },
    emptyBox: {
      minHeight: 260,
    },
    formList: {
      gap: 10,
    },
    formCard: {
      gap: 10,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
      borderRadius: 6,
      backgroundColor: colors.card,
      padding: 12,
    },
    formCardActive: {
      borderColor: colors.primary,
      backgroundColor: `${colors.primary}10`,
    },
    formCardHeader: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      justifyContent: 'space-between',
      gap: 10,
    },
    formCardTitleWrap: {
      minWidth: 0,
      flex: 1,
      gap: 3,
    },
    formTitle: {
      color: colors.foreground,
      fontSize: 15,
      fontWeight: '700',
      lineHeight: 20,
    },
    formMeta: {
      color: colors.mutedForeground,
      fontSize: 12,
      lineHeight: 16,
    },
    formBadges: {
      alignItems: 'flex-end',
      gap: 5,
    },
    formDescription: {
      color: colors.mutedForeground,
      fontSize: 13,
      lineHeight: 18,
    },
    cardActions: {
      minHeight: 36,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 8,
    },
    updatedText: {
      minWidth: 0,
      flex: 1,
      color: colors.mutedForeground,
      fontSize: 12,
      lineHeight: 16,
    },
    iconActions: {
      flexDirection: 'row',
      gap: 6,
    },
    iconButton: {
      width: 34,
      height: 34,
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
      borderRadius: 4,
      backgroundColor: colors.background,
    },
    editorHeader: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      justifyContent: 'space-between',
      gap: 10,
    },
    textArea: {
      minHeight: 92,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
      borderRadius: 6,
      backgroundColor: colors.card,
      color: colors.foreground,
      fontSize: 14,
      lineHeight: 20,
      paddingHorizontal: 10,
      paddingVertical: 10,
      textAlignVertical: 'top',
    },
    statusGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 8,
    },
    sectionHeader: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      justifyContent: 'space-between',
      gap: 10,
    },
    fieldList: {
      gap: 10,
    },
    fieldHeader: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      justifyContent: 'space-between',
      gap: 10,
    },
    fieldTitle: {
      color: colors.foreground,
      fontSize: 14,
      fontWeight: '700',
      lineHeight: 20,
    },
    editorActions: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 8,
    },
    editorAction: {
      minWidth: 148,
      flex: 1,
    },
    disabled: {
      opacity: 0.55,
    },
  });
}
