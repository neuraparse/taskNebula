import { useMemo, useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from '@/components/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Controller, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { FolderKanban, KeyRound, Plus } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { z } from 'zod';

import {
  Button,
  IconTile,
  Screen,
  ScreenHeader,
  SemanticBadge,
  SurfaceRow,
  TextField,
} from '@/components/ui';
import type { ThemeColors } from '@/design/theme';
import { useThemeColors } from '@/design/theme-context';
import { useCreateProject } from '@/hooks/queries';
import type { AppStackParamList } from '@/navigation/types';

const projectSchema = z.object({
  name: z.string().min(1, 'nameRequired'),
  key: z
    .string()
    .min(2, 'projectKeyRequired')
    .max(10, 'projectKeyInvalid')
    .regex(/^[A-Za-z][A-Za-z0-9]*$/, 'projectKeyInvalid'),
  description: z.string(),
});

type NewProjectValues = z.infer<typeof projectSchema>;
type NewProjectProps = NativeStackScreenProps<AppStackParamList, 'NewProject'>;
type NewProjectStyles = ReturnType<typeof createNewProjectStyles>;

function useNewProjectTheme(): { colors: ThemeColors; styles: NewProjectStyles } {
  const colors = useThemeColors();
  const styles = useMemo(() => createNewProjectStyles(colors), [colors]);
  return { colors, styles };
}

function suggestProjectKey(name: string): string {
  const words = name
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .split(/[^A-Za-z0-9]+/)
    .filter(Boolean);

  const source = words.length > 1 ? words.map((word) => word[0]).join('') : (words[0] ?? '');
  const sanitized = source.replace(/[^A-Za-z0-9]/g, '').toUpperCase();
  const startsWithLetter = /^[A-Z]/.test(sanitized);
  const candidate = (startsWithLetter ? sanitized : `P${sanitized}`).slice(0, 10);

  if (candidate.length >= 2) return candidate;
  return 'PRJ';
}

export function NewProjectScreen({ navigation }: NewProjectProps) {
  const { t } = useTranslation();
  const { colors, styles } = useNewProjectTheme();
  const createProject = useCreateProject();
  const [formError, setFormError] = useState<string | null>(null);
  const [keyEdited, setKeyEdited] = useState(false);

  const form = useForm<NewProjectValues>({
    resolver: zodResolver(projectSchema),
    defaultValues: {
      name: '',
      key: '',
      description: '',
    },
  });

  const keyValue = form.watch('key');

  const fieldError = (code?: string): string | undefined => {
    if (!code) return undefined;
    if (code === 'nameRequired') return t('validation.nameRequired');
    if (code === 'projectKeyRequired') return t('validation.projectKeyRequired');
    if (code === 'projectKeyInvalid') return t('validation.projectKeyInvalid');
    return t('validation.invalidField');
  };

  const onSubmit = async (values: NewProjectValues): Promise<void> => {
    setFormError(null);
    const description = values.description.trim();
    try {
      const project = await createProject.mutateAsync({
        name: values.name.trim(),
        key: values.key.trim().toUpperCase(),
        description: description || null,
      });
      navigation.replace('ProjectDetail', { id: project.id });
    } catch (err: unknown) {
      setFormError(err instanceof Error ? err.message : t('projects.createFailed'));
    }
  };

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
            kicker={t('common.appName')}
            title={t('projects.new')}
            subtitle={t('projects.newSubtitle')}
            meta={
              keyValue ? <SemanticBadge label={keyValue.toUpperCase()} tone="blue" /> : undefined
            }
          />

          <SurfaceRow className="gap-3">
            <View className="flex-row items-start gap-3">
              <IconTile icon={FolderKanban} tone="blue" />
              <View className="flex-1 gap-1">
                <Text className="text-foreground text-sm font-semibold">
                  {t('projects.projectModel')}
                </Text>
                <Text className="text-muted-foreground text-sm" style={styles.helpText}>
                  {t('projects.projectModelDesc')}
                </Text>
              </View>
            </View>
          </SurfaceRow>

          <View style={styles.section}>
            <Controller
              control={form.control}
              name="name"
              render={({ field: { onBlur, onChange, value } }) => (
                <TextField
                  label={t('projects.nameLabel')}
                  placeholder={t('projects.namePlaceholder')}
                  value={value}
                  onBlur={onBlur}
                  onChangeText={(next) => {
                    onChange(next);
                    if (!keyEdited) {
                      form.setValue('key', suggestProjectKey(next), { shouldValidate: true });
                    }
                  }}
                  editable={!createProject.isPending}
                  error={fieldError(form.formState.errors.name?.message)}
                />
              )}
            />

            <Controller
              control={form.control}
              name="key"
              render={({ field: { onBlur, onChange, value } }) => (
                <TextField
                  label={t('projects.keyLabel')}
                  placeholder={t('projects.keyPlaceholder')}
                  value={value}
                  onBlur={onBlur}
                  onChangeText={(next) => {
                    setKeyEdited(true);
                    onChange(
                      next
                        .replace(/[^A-Za-z0-9]/g, '')
                        .toUpperCase()
                        .slice(0, 10),
                    );
                  }}
                  autoCapitalize="characters"
                  editable={!createProject.isPending}
                  error={fieldError(form.formState.errors.key?.message)}
                />
              )}
            />

            <Controller
              control={form.control}
              name="description"
              render={({ field: { onBlur, onChange, value } }) => (
                <TextField
                  label={t('projects.descriptionLabel')}
                  placeholder={t('projects.descriptionPlaceholder')}
                  value={value}
                  onBlur={onBlur}
                  onChangeText={onChange}
                  editable={!createProject.isPending}
                  multiline
                  className="min-h-12"
                />
              )}
            />
          </View>

          <SurfaceRow className="gap-2">
            <View className="flex-row items-center gap-2">
              <KeyRound size={16} color={colors.primary} />
              <Text className="text-foreground text-sm font-semibold">
                {t('projects.keyRules')}
              </Text>
            </View>
            <Text className="text-muted-foreground text-sm" style={styles.helpText}>
              {t('projects.keyRulesDesc')}
            </Text>
          </SurfaceRow>

          {formError ? <Text className="text-destructive px-4 text-sm">{formError}</Text> : null}
        </ScrollView>

        <View style={styles.footer}>
          <Button
            title={t('projects.create')}
            icon={Plus}
            loading={createProject.isPending}
            disabled={createProject.isPending}
            onPress={form.handleSubmit(onSubmit)}
          />
        </View>
      </KeyboardAvoidingView>
    </Screen>
  );
}

function createNewProjectStyles(colors: ThemeColors) {
  return StyleSheet.create({
    content: {
      gap: 14,
      paddingBottom: 24,
    },
    section: {
      gap: 12,
      paddingHorizontal: 16,
    },
    helpText: {
      lineHeight: 20,
    },
    footer: {
      borderTopWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
      backgroundColor: colors.background,
      padding: 12,
    },
  });
}
