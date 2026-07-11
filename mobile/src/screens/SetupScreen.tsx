import { useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from '@/components/native';
import { Controller, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import {
  Database,
  FileSpreadsheet,
  GitBranch,
  KeyRound,
  Layers3,
  Server,
  ShieldAlert,
  ShieldCheck,
  type LucideIcon,
} from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { z } from 'zod';

import { ApiError } from '@/api/client';
import { Button, IconTile, Screen, SemanticBadge, TextField } from '@/components/ui';
import { useThemeColors } from '@/design/theme-context';
import { contentIntentFromSetupResult } from '@/lib/setup-routing';
import type { ImportSourceRouteParam } from '@/navigation/types';
import { useContentLinkIntent } from '@/stores/content-link-intent';
import { useSession } from '@/stores/session';

const setupSchema = z.object({
  name: z.string().min(1, 'nameRequired'),
  email: z.string().min(1, 'emailRequired').email('emailInvalid'),
  password: z.string().min(8, 'passwordMinLength'),
  confirmPassword: z.string().min(8, 'passwordMinLength'),
  organizationName: z.string(),
  importProjectName: z.string(),
  importProjectKey: z.string(),
});

type SetupValues = z.infer<typeof setupSchema>;
type Notice = { tone: 'error'; message: string } | null;
type StartMode = 'blank' | 'import';

const IMPORT_SOURCES: ImportSourceRouteParam[] = ['jira', 'linear', 'plane', 'csv', 'github'];

function projectKeyFromName(value: string): string {
  return value
    .replace(/[^a-zA-Z0-9\s]/g, '')
    .split(/\s+/)
    .filter(Boolean)
    .map((word) => word[0])
    .join('')
    .toUpperCase()
    .slice(0, 10);
}

function normalizeProjectKey(value: string): string {
  return value
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '')
    .slice(0, 10);
}

function alpha(hex: string, opacity: string): string {
  return `${hex}${opacity}`;
}

function importSourceIcon(source: ImportSourceRouteParam): LucideIcon {
  return source === 'github' ? GitBranch : Layers3;
}

function SetupNotice({ notice }: { notice: Notice }) {
  const colors = useThemeColors();
  if (!notice) return null;

  return (
    <View
      style={[
        styles.notice,
        {
          borderColor: alpha(colors.destructive, '55'),
          backgroundColor: alpha(colors.destructive, '14'),
        },
      ]}
    >
      <ShieldAlert size={16} color={colors.destructive} />
      <Text style={[styles.noticeText, { color: colors.destructive }]}>{notice.message}</Text>
    </View>
  );
}

function StartModeCard({
  description,
  icon,
  selected,
  title,
  onPress,
}: {
  description: string;
  icon: LucideIcon;
  selected: boolean;
  title: string;
  onPress: () => void;
}) {
  const colors = useThemeColors();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected }}
      onPress={onPress}
      style={[
        styles.startModeCard,
        {
          borderColor: selected ? alpha(colors.primary, '66') : colors.border,
          backgroundColor: selected ? alpha(colors.primary, '14') : colors.card,
        },
      ]}
      className="active:opacity-80"
    >
      <IconTile icon={icon} tone={selected ? 'blue' : 'neutral'} />
      <View style={styles.startModeCopy}>
        <Text style={[styles.startModeTitle, { color: colors.foreground }]}>{title}</Text>
        <Text style={[styles.startModeDescription, { color: colors.mutedForeground }]}>
          {description}
        </Text>
      </View>
      {selected ? <SemanticBadge label={title} tone="blue" /> : null}
    </Pressable>
  );
}

function ImportSourcePill({
  label,
  selected,
  source,
  onPress,
}: {
  label: string;
  selected: boolean;
  source: ImportSourceRouteParam;
  onPress: () => void;
}) {
  const Icon = importSourceIcon(source);
  const colors = useThemeColors();

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected }}
      onPress={onPress}
      style={[
        styles.sourcePill,
        {
          borderColor: selected ? alpha(colors.primary, '66') : colors.border,
          backgroundColor: selected ? alpha(colors.primary, '14') : colors.card,
        },
      ]}
      className="active:opacity-80"
    >
      <Icon size={14} color={selected ? colors.primary : colors.mutedForeground} />
      <Text
        style={[
          styles.sourcePillText,
          { color: selected ? colors.primary : colors.mutedForeground },
        ]}
      >
        {label}
      </Text>
    </Pressable>
  );
}

export function SetupScreen() {
  const { t } = useTranslation();
  const colors = useThemeColors();
  const completeSetup = useSession((s) => s.completeSetup);
  const forgetServer = useSession((s) => s.forgetServer);
  const serverUrl = useSession((s) => s.serverUrl);
  const setPendingContentLink = useContentLinkIntent((s) => s.setPending);

  const [submitting, setSubmitting] = useState(false);
  const [notice, setNotice] = useState<Notice>(null);
  const [startMode, setStartMode] = useState<StartMode>('blank');
  const [importSource, setImportSource] = useState<ImportSourceRouteParam>('jira');
  const [projectKeyManual, setProjectKeyManual] = useState(false);

  const form = useForm<SetupValues>({
    resolver: zodResolver(setupSchema),
    defaultValues: {
      name: '',
      email: '',
      password: '',
      confirmPassword: '',
      organizationName: '',
      importProjectName: '',
      importProjectKey: '',
    },
  });

  const fieldError = (code?: string): string | undefined => {
    if (!code) return undefined;
    if (code === 'emailInvalid') return t('validation.emailInvalid');
    if (code === 'emailRequired') return t('validation.emailRequired');
    if (code === 'nameRequired') return t('validation.nameRequired');
    if (code === 'passwordMinLength') return t('validation.passwordMinLength');
    return t('validation.invalidField');
  };

  const setupError = (error: unknown): string => {
    if (error instanceof ApiError) {
      if (error.status === 400) return t('setup.alreadyCompleted');
      if (error.status === 503) return t('setup.databaseNotReady');
    }
    return t('setup.failed');
  };

  const onSubmit = async (values: SetupValues): Promise<void> => {
    setNotice(null);
    if (values.password !== values.confirmPassword) {
      setNotice({ tone: 'error', message: t('validation.passwordsNoMatch') });
      return;
    }
    if (startMode === 'import') {
      if (!values.importProjectName.trim()) {
        setNotice({ tone: 'error', message: t('setup.importProjectRequired') });
        return;
      }
      if (!/^[A-Z][A-Z0-9]{1,9}$/.test(values.importProjectKey.trim())) {
        setNotice({ tone: 'error', message: t('setup.importProjectKeyInvalid') });
        return;
      }
    }

    setSubmitting(true);
    try {
      const organizationName = values.organizationName.trim();
      const result = await completeSetup({
        name: values.name.trim(),
        email: values.email.trim().toLowerCase(),
        password: values.password,
        ...(organizationName ? { organizationName } : {}),
        startMode,
        ...(startMode === 'import'
          ? {
              importSource,
              importProjectName: values.importProjectName.trim(),
              importProjectKey: values.importProjectKey.trim().toUpperCase(),
            }
          : {}),
      });
      const setupDestination = contentIntentFromSetupResult(result, serverUrl);
      if (setupDestination) setPendingContentLink(setupDestination);
    } catch (error: unknown) {
      setNotice({ tone: 'error', message: setupError(error) });
    } finally {
      setSubmitting(false);
    }
  };

  const errors = form.formState.errors;

  return (
    <Screen>
      <KeyboardAvoidingView
        className="flex-1"
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          className="flex-1"
          contentContainerStyle={styles.centeredContent}
          keyboardShouldPersistTaps="handled"
        >
          <View className="mb-8 items-center">
            <View className="bg-primary mb-5 h-16 w-16 items-center justify-center rounded-lg">
              <ShieldCheck size={30} color={colors.primaryForeground} />
            </View>
            <Text className="text-foreground text-center text-2xl font-bold">
              {t('setup.title')}
            </Text>
            <Text className="text-muted-foreground mt-2 px-4 text-center text-base">
              {t('setup.subtitle')}
            </Text>
          </View>

          <View className="gap-4">
            <Controller
              control={form.control}
              name="name"
              render={({ field: { onChange, onBlur, value } }) => (
                <TextField
                  label={t('onboarding.name')}
                  placeholder={t('onboarding.namePlaceholder')}
                  value={value}
                  onChangeText={onChange}
                  onBlur={onBlur}
                  autoCapitalize="words"
                  autoCorrect={false}
                  textContentType="name"
                  editable={!submitting}
                  error={fieldError(errors.name?.message)}
                />
              )}
            />

            <Controller
              control={form.control}
              name="email"
              render={({ field: { onChange, onBlur, value } }) => (
                <TextField
                  label={t('onboarding.email')}
                  value={value}
                  onChangeText={onChange}
                  onBlur={onBlur}
                  autoCapitalize="none"
                  autoCorrect={false}
                  keyboardType="email-address"
                  textContentType="emailAddress"
                  editable={!submitting}
                  error={fieldError(errors.email?.message)}
                />
              )}
            />

            <Controller
              control={form.control}
              name="password"
              render={({ field: { onChange, onBlur, value } }) => (
                <TextField
                  label={t('onboarding.password')}
                  value={value}
                  onChangeText={onChange}
                  onBlur={onBlur}
                  secureTextEntry
                  autoCapitalize="none"
                  autoCorrect={false}
                  textContentType="newPassword"
                  editable={!submitting}
                  error={fieldError(errors.password?.message)}
                />
              )}
            />

            <Controller
              control={form.control}
              name="confirmPassword"
              render={({ field: { onChange, onBlur, value } }) => (
                <TextField
                  label={t('onboarding.confirmPassword')}
                  value={value}
                  onChangeText={onChange}
                  onBlur={onBlur}
                  secureTextEntry
                  autoCapitalize="none"
                  autoCorrect={false}
                  textContentType="newPassword"
                  editable={!submitting}
                  error={fieldError(errors.confirmPassword?.message)}
                />
              )}
            />
            <Text className="text-muted-foreground px-1 text-xs">
              {t('onboarding.passwordHint')}
            </Text>

            <Controller
              control={form.control}
              name="organizationName"
              render={({ field: { onChange, onBlur, value } }) => (
                <TextField
                  label={t('setup.organizationName')}
                  placeholder={t('setup.organizationPlaceholder')}
                  value={value}
                  onChangeText={onChange}
                  onBlur={onBlur}
                  autoCapitalize="words"
                  autoCorrect={false}
                  editable={!submitting}
                />
              )}
            />

            <View style={styles.startModeSection}>
              <View style={styles.startModeHeader}>
                <Text style={[styles.sectionTitle, { color: colors.foreground }]}>
                  {t('setup.startModeTitle')}
                </Text>
                <Text style={[styles.sectionSubtitle, { color: colors.mutedForeground }]}>
                  {t('setup.startModeSubtitle')}
                </Text>
              </View>
              <View style={styles.startModeGrid}>
                <StartModeCard
                  icon={Database}
                  title={t('setup.blankTitle')}
                  description={t('setup.blankDescription')}
                  selected={startMode === 'blank'}
                  onPress={() => setStartMode('blank')}
                />
                <StartModeCard
                  icon={FileSpreadsheet}
                  title={t('setup.importTitle')}
                  description={t('setup.importDescription')}
                  selected={startMode === 'import'}
                  onPress={() => setStartMode('import')}
                />
              </View>
            </View>

            {startMode === 'import' ? (
              <View
                style={[
                  styles.importBox,
                  { borderColor: colors.border, backgroundColor: colors.surface },
                ]}
              >
                <Text style={[styles.sectionTitle, { color: colors.foreground }]}>
                  {t('setup.importSourceLabel')}
                </Text>
                <View style={styles.sourceGrid}>
                  {IMPORT_SOURCES.map((source) => (
                    <ImportSourcePill
                      key={source}
                      source={source}
                      label={t(`setup.importSource.${source}.label`)}
                      selected={importSource === source}
                      onPress={() => setImportSource(source)}
                    />
                  ))}
                </View>
                <Text style={[styles.sectionSubtitle, { color: colors.mutedForeground }]}>
                  {t(`setup.importSource.${importSource}.description`)}
                </Text>

                <Controller
                  control={form.control}
                  name="importProjectName"
                  render={({ field: { onChange, onBlur, value } }) => (
                    <TextField
                      label={t('setup.importProjectName')}
                      placeholder={t('setup.importProjectNamePlaceholder')}
                      value={value}
                      onChangeText={(nextValue) => {
                        onChange(nextValue);
                        if (!projectKeyManual) {
                          form.setValue('importProjectKey', projectKeyFromName(nextValue), {
                            shouldValidate: true,
                          });
                        }
                      }}
                      onBlur={onBlur}
                      autoCapitalize="words"
                      autoCorrect={false}
                      editable={!submitting}
                    />
                  )}
                />

                <Controller
                  control={form.control}
                  name="importProjectKey"
                  render={({ field: { onChange, onBlur, value } }) => (
                    <TextField
                      label={t('setup.importProjectKey')}
                      placeholder={t('setup.importProjectKeyPlaceholder')}
                      value={value}
                      onChangeText={(nextValue) => {
                        setProjectKeyManual(true);
                        onChange(normalizeProjectKey(nextValue));
                      }}
                      onBlur={onBlur}
                      autoCapitalize="characters"
                      autoCorrect={false}
                      editable={!submitting}
                    />
                  )}
                />
                <Text style={[styles.sectionSubtitle, { color: colors.mutedForeground }]}>
                  {t('setup.importProjectKeyHint')}
                </Text>
              </View>
            ) : null}

            <SetupNotice notice={notice} />

            <Button
              title={
                startMode === 'import'
                  ? t('setup.createAndImport', {
                      source: t(`setup.importSource.${importSource}.label`),
                    })
                  : t('setup.createAdmin')
              }
              icon={KeyRound}
              loading={submitting}
              disabled={submitting}
              onPress={form.handleSubmit(onSubmit)}
            />
          </View>

          <View className="mt-8 items-center">
            {serverUrl ? (
              <Text className="text-muted-foreground mb-1 text-xs" numberOfLines={1}>
                {serverUrl}
              </Text>
            ) : null}
            <Button
              title={t('onboarding.changeServer')}
              icon={Server}
              variant="ghost"
              disabled={submitting}
              onPress={() => {
                void forgetServer();
              }}
            />
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  centeredContent: {
    flexGrow: 1,
    justifyContent: 'center',
    padding: 24,
  },
  notice: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 6,
    paddingHorizontal: 10,
    paddingVertical: 9,
  },
  noticeText: {
    flex: 1,
    fontSize: 13,
    lineHeight: 18,
  },
  startModeSection: {
    gap: 10,
  },
  startModeHeader: {
    gap: 3,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '700',
    lineHeight: 19,
  },
  sectionSubtitle: {
    fontSize: 12,
    lineHeight: 17,
  },
  startModeGrid: {
    gap: 8,
  },
  startModeCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 6,
    padding: 12,
  },
  startModeCopy: {
    minWidth: 0,
    flex: 1,
    gap: 3,
  },
  startModeTitle: {
    fontSize: 14,
    fontWeight: '700',
    lineHeight: 19,
  },
  startModeDescription: {
    fontSize: 12,
    lineHeight: 17,
  },
  importBox: {
    gap: 10,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 6,
    padding: 12,
  },
  sourceGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  sourcePill: {
    minHeight: 36,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 6,
    paddingHorizontal: 10,
  },
  sourcePillText: {
    fontSize: 12,
    fontWeight: '700',
    lineHeight: 16,
  },
});
