import { useEffect, useMemo, useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from '@/components/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Controller, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { BookOpenText, FileText, Save } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { z } from 'zod';

import type { DocumentSpace } from '@/api/types';
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
import { useThemeColors } from '@/design/theme-context';
import {
  useCreateDocumentPage,
  useDocumentPage,
  useDocumentSpaces,
  useUpdateDocumentPage,
} from '@/hooks/queries';
import {
  documentContentToPlainText,
  documentTextToContentJson,
  normalizeDocumentText,
} from '@/lib/document-content';
import type { AppStackParamList } from '@/navigation/types';

const documentEditorSchema = z.object({
  title: z.string().min(1, 'titleRequired'),
  content: z.string(),
  spaceId: z.string(),
});

type DocumentEditorValues = z.infer<typeof documentEditorSchema>;
type DocumentEditorProps = NativeStackScreenProps<AppStackParamList, 'DocumentEditor'>;

function alpha(hex: string, opacity: string): string {
  return `${hex}${opacity}`;
}

function SpaceOption({
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
        styles.spaceOption,
        {
          borderColor: selected ? alpha(colors.primary, '55') : colors.border,
          backgroundColor: selected ? alpha(colors.primary, '14') : colors.card,
        },
      ]}
      className="active:opacity-80"
    >
      <View className="min-w-0 flex-1 gap-1">
        <Text className="text-foreground text-sm font-semibold" numberOfLines={1}>
          {space.name}
        </Text>
        <Text style={[styles.spaceScope, { color: colors.mutedForeground }]} numberOfLines={1}>
          {space.scope === 'project' ? t('docs.projectDoc') : t('docs.wiki')}
        </Text>
      </View>
    </Pressable>
  );
}

export function DocumentEditorScreen({ navigation, route }: DocumentEditorProps) {
  const { t } = useTranslation();
  const colors = useThemeColors();
  const pageId = route.params.id ?? null;
  const initialSpaceId = route.params.spaceId ?? '';
  const parentId = route.params.parentId ?? null;
  const routeProjectId = route.params.projectId ?? null;
  const isEditing = !!pageId;
  const pageQ = useDocumentPage(pageId);
  const scopeParams = useMemo(
    () => (routeProjectId ? { projectId: routeProjectId } : {}),
    [routeProjectId],
  );
  const spacesQ = useDocumentSpaces(scopeParams);
  const createPage = useCreateDocumentPage();
  const updatePage = useUpdateDocumentPage(pageId);
  const [formError, setFormError] = useState<string | null>(null);

  const form = useForm<DocumentEditorValues>({
    resolver: zodResolver(documentEditorSchema),
    defaultValues: {
      title: '',
      content: '',
      spaceId: initialSpaceId,
    },
  });

  const page = pageQ.data;
  const spaces = useMemo(() => spacesQ.data ?? [], [spacesQ.data]);
  const editableSpaces = useMemo(
    () => spaces.filter((space) => space.permissions?.canCreate === true),
    [spaces],
  );
  const selectedSpaceId = form.watch('spaceId');
  const selectedSpace = spaces.find((space) => space.id === selectedSpaceId) ?? page?.space ?? null;
  const isSaving = createPage.isPending || updatePage.isPending;

  useEffect(() => {
    if (!isEditing || !page) return;
    form.reset({
      title: page.title,
      content: documentContentToPlainText(page.contentJson) || (page.contentText ?? ''),
      spaceId: page.spaceId,
    });
    setFormError(null);
  }, [form, isEditing, page]);

  useEffect(() => {
    if (isEditing) return;
    if (selectedSpaceId && editableSpaces.some((space) => space.id === selectedSpaceId)) return;
    const firstSpace = editableSpaces[0];
    if (firstSpace) {
      form.setValue('spaceId', firstSpace.id, { shouldValidate: true });
    }
  }, [editableSpaces, form, isEditing, selectedSpaceId]);

  const fieldError = (code?: string): string | undefined => {
    if (!code) return undefined;
    if (code === 'titleRequired') return t('validation.titleRequired');
    return t('validation.invalidField');
  };

  const onSubmit = async (values: DocumentEditorValues): Promise<void> => {
    setFormError(null);
    const title = values.title.trim();

    try {
      if (isEditing) {
        if (!page || typeof page.currentRevision !== 'number') {
          setFormError(t('docs.updateFailed'));
          return;
        }

        const originalContentText =
          documentContentToPlainText(page.contentJson) || (page.contentText ?? '');
        const contentJson =
          page.contentJson &&
          normalizeDocumentText(values.content) === normalizeDocumentText(originalContentText)
            ? page.contentJson
            : documentTextToContentJson(values.content);

        const updated = await updatePage.mutateAsync({
          title,
          icon: page.icon ?? null,
          contentJson,
          expectedRevision: page.currentRevision,
        });
        navigation.replace('DocumentDetail', { id: updated.id });
        return;
      }

      if (!values.spaceId) {
        setFormError(t('docs.loadFailed'));
        return;
      }

      const contentJson = documentTextToContentJson(values.content);
      const created = await createPage.mutateAsync({
        title,
        spaceId: values.spaceId,
        parentId,
        contentJson,
      });
      navigation.replace('DocumentDetail', { id: created.id });
    } catch (err: unknown) {
      setFormError(
        err instanceof Error
          ? err.message
          : t(isEditing ? 'docs.updateFailed' : 'docs.createFailed'),
      );
    }
  };

  if ((isEditing && pageQ.isLoading) || (!isEditing && spacesQ.isLoading)) return <Loading />;

  if (isEditing && (pageQ.isError || !page)) {
    return (
      <Screen>
        <ErrorView
          message={pageQ.error instanceof Error ? pageQ.error.message : t('docs.fetchPageFailed')}
          onRetry={() => void pageQ.refetch()}
        />
      </Screen>
    );
  }

  if (isEditing && page?.permissions?.canEdit !== true) {
    return (
      <Screen>
        <EmptyState
          icon={BookOpenText}
          title={t('docs.readOnly')}
          description={t('docs.contentEmptyDesc')}
        />
      </Screen>
    );
  }

  if (!isEditing && !spacesQ.isLoading && editableSpaces.length === 0) {
    return (
      <Screen>
        <EmptyState
          icon={BookOpenText}
          title={t('docs.readOnly')}
          description={t('docs.emptyDesc')}
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
          contentContainerStyle={styles.content}
        >
          <ScreenHeader
            kicker={t('docs.title')}
            title={isEditing ? t('docs.edit') : t(parentId ? 'docs.createSubpage' : 'docs.create')}
            meta={
              selectedSpace ? <SemanticBadge label={selectedSpace.name} tone="cyan" /> : undefined
            }
          />

          {!isEditing ? (
            <View style={styles.section}>
              <View style={styles.sectionTitle}>
                <BookOpenText size={16} color={colors.foreground} />
                <Text className="text-foreground text-base font-semibold">{t('docs.title')}</Text>
              </View>
              <View style={styles.spaceList}>
                {editableSpaces.map((space) => (
                  <SpaceOption
                    key={space.id}
                    space={space}
                    selected={selectedSpaceId === space.id}
                    onPress={(spaceId) =>
                      form.setValue('spaceId', spaceId, { shouldValidate: true })
                    }
                  />
                ))}
              </View>
            </View>
          ) : null}

          <View style={styles.section}>
            <Controller
              control={form.control}
              name="title"
              render={({ field: { onChange, onBlur, value } }) => (
                <TextField
                  label={t('issues.titleLabel')}
                  value={value}
                  onChangeText={onChange}
                  onBlur={onBlur}
                  returnKeyType="next"
                  editable={!isSaving}
                  error={fieldError(form.formState.errors.title?.message)}
                />
              )}
            />
            <Controller
              control={form.control}
              name="content"
              render={({ field: { onChange, onBlur, value } }) => (
                <TextField
                  label={t('issue.description')}
                  value={value}
                  onChangeText={onChange}
                  onBlur={onBlur}
                  multiline
                  textAlignVertical="top"
                  editable={!isSaving}
                  style={styles.contentInput}
                />
              )}
            />
          </View>

          {formError ? <Text className="text-destructive text-sm">{formError}</Text> : null}

          <View style={styles.actions}>
            <Button
              title={isEditing ? t('docs.saveChanges') : t('docs.create')}
              icon={isEditing ? Save : FileText}
              loading={isSaving}
              disabled={isSaving}
              onPress={form.handleSubmit(onSubmit)}
            />
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: {
    gap: 16,
    paddingBottom: 20,
  },
  section: {
    gap: 12,
    paddingHorizontal: 16,
  },
  sectionTitle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  spaceList: {
    gap: 8,
  },
  spaceOption: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 6,
    padding: 12,
  },
  spaceScope: {
    fontSize: 12,
    lineHeight: 16,
  },
  contentInput: {
    minHeight: 220,
    height: 220,
    paddingTop: 12,
  },
  actions: {
    paddingHorizontal: 16,
  },
});
