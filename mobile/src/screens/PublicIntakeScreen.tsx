import { useMemo, useState } from 'react';
import { Linking } from 'react-native';
import { Pressable, ScrollView, StyleSheet, Text, View } from '@/components/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { CheckCircle2, ExternalLink, FileWarning, Send } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';

import type {
  IntakeFieldDefinition,
  PublicIntakeForm,
  SubmitPublicIntakeResult,
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
import { usePublicIntakeForm, useSubmitPublicIntakeForm } from '@/hooks/queries';
import type { AppStackParamList } from '@/navigation/types';
import { useSession } from '@/stores/session';
import {
  PUBLIC_INTAKE_FIELD_LIMITS,
  canRenderNativePublicIntakeField,
  initialPublicIntakeValues,
  publicIntakeSubmitPayload,
  validatePublicIntakeFields,
  type PublicIntakeFieldErrors,
  type PublicIntakeFieldValues,
} from '@/lib/public-intake';

type PublicIntakeRouteProps = NativeStackScreenProps<AppStackParamList, 'PublicIntake'>;
type PublicIntakeStyles = ReturnType<typeof createPublicIntakeStyles>;
type PublicIntakeScreenProps =
  | PublicIntakeRouteProps
  | {
      slug: string;
      onClose?: () => void;
    };

function getSlug(props: PublicIntakeScreenProps): string {
  return 'route' in props ? props.route.params.slug : props.slug;
}

function publicIntakeUrl(baseUrl: string | null, slug: string): string | null {
  if (!baseUrl) return null;
  return `${baseUrl}/intake/${encodeURIComponent(slug)}`;
}

function publicIntakeFieldMaxLength(field: IntakeFieldDefinition): number | undefined {
  if (field.type === 'text') return PUBLIC_INTAKE_FIELD_LIMITS.text;
  if (field.type === 'textarea') return PUBLIC_INTAKE_FIELD_LIMITS.textarea;
  if (field.type === 'file') return PUBLIC_INTAKE_FIELD_LIMITS.file;
  return undefined;
}

function alpha(hex: string, opacity: string): string {
  return `${hex}${opacity}`;
}

function usePublicIntakeTheme(): { colors: ThemeColors; styles: PublicIntakeStyles } {
  const colors = useThemeColors();
  const styles = useMemo(() => createPublicIntakeStyles(colors), [colors]);
  return { colors, styles };
}

function FieldControl({
  error,
  field,
  onChange,
  value,
}: {
  error?: string;
  field: IntakeFieldDefinition;
  onChange: (value: string) => void;
  value: string;
}) {
  const { t } = useTranslation();
  const { styles } = usePublicIntakeTheme();
  const label = field.required ? `${field.label} ${t('intakeForms.publicRequired')}` : field.label;

  if (field.type === 'select') {
    const options = field.options ?? [];
    return (
      <View style={styles.fieldBlock}>
        <Text style={styles.fieldLabel}>{label}</Text>
        {field.helpText ? <Text style={styles.helpText}>{field.helpText}</Text> : null}
        <View style={styles.optionWrap}>
          {options.length === 0 ? (
            <Text style={styles.helpText}>{t('intakeForms.publicSelectEmpty')}</Text>
          ) : (
            options.map((option) => {
              const selected = value === option;
              return (
                <Pressable
                  key={option}
                  accessibilityRole="button"
                  accessibilityState={{ selected }}
                  onPress={() => onChange(option)}
                  style={[styles.optionButton, selected ? styles.optionButtonSelected : null]}
                  className="active:opacity-80"
                >
                  <Text
                    style={[styles.optionText, selected ? styles.optionTextSelected : null]}
                    numberOfLines={2}
                  >
                    {option}
                  </Text>
                </Pressable>
              );
            })
          )}
        </View>
        {error ? <Text style={styles.errorText}>{error}</Text> : null}
      </View>
    );
  }

  return (
    <View style={styles.fieldBlock}>
      <TextField
        label={label}
        placeholder={field.placeholder ?? undefined}
        value={value}
        onChangeText={onChange}
        autoCapitalize={field.type === 'email' || field.type === 'file' ? 'none' : 'sentences'}
        autoCorrect={field.type !== 'email' && field.type !== 'file'}
        keyboardType={
          field.type === 'email' ? 'email-address' : field.type === 'file' ? 'url' : 'default'
        }
        maxLength={publicIntakeFieldMaxLength(field)}
        multiline={field.type === 'textarea'}
        numberOfLines={field.type === 'textarea' ? 5 : 1}
      />
      {field.helpText ? <Text style={styles.helpText}>{field.helpText}</Text> : null}
      {error ? <Text style={styles.errorText}>{error}</Text> : null}
    </View>
  );
}

function SubmittedState({
  onClose,
  result,
}: {
  onClose?: () => void;
  result: SubmitPublicIntakeResult;
}) {
  const { t } = useTranslation();
  const { styles } = usePublicIntakeTheme();
  return (
    <Screen>
      <View style={styles.centerContent}>
        <EmptyState
          icon={CheckCircle2}
          title={t('intakeForms.publicSubmittedTitle')}
          description={t('intakeForms.publicSubmittedDesc', { issueKey: result.issueKey })}
        />
        {onClose ? (
          <Button title={t('onboarding.signIn')} variant="secondary" onPress={onClose} />
        ) : null}
      </View>
    </Screen>
  );
}

function CaptchaFallback({
  form,
  onClose,
  url,
}: {
  form: PublicIntakeForm;
  onClose?: () => void;
  url: string | null;
}) {
  const { t } = useTranslation();
  const { styles } = usePublicIntakeTheme();
  return (
    <Screen>
      <ScreenHeader
        kicker={t('intakeForms.publicKicker')}
        title={form.title}
        subtitle={t('intakeForms.publicCaptchaDesc')}
        meta={<SemanticBadge label={t('intakeForms.requiresCaptcha')} tone="amber" />}
      />
      <View style={styles.fallbackActions}>
        <Button
          title={t('intakeForms.publicOpenInBrowser')}
          icon={ExternalLink}
          disabled={!url}
          onPress={() => {
            if (url) void Linking.openURL(url);
          }}
        />
        {onClose ? (
          <Button title={t('onboarding.signIn')} variant="secondary" onPress={onClose} />
        ) : null}
      </View>
    </Screen>
  );
}

export function PublicIntakeScreen(props: PublicIntakeScreenProps) {
  const { t } = useTranslation();
  const { colors, styles } = usePublicIntakeTheme();
  const slug = getSlug(props);
  const onClose = 'route' in props ? undefined : props.onClose;
  const serverUrl = useSession((s) => s.serverUrl);
  const formQ = usePublicIntakeForm(slug);
  const submitForm = useSubmitPublicIntakeForm(slug);
  const form = formQ.data?.form;
  const publicUrl = publicIntakeUrl(serverUrl, slug);
  const [values, setValues] = useState<PublicIntakeFieldValues>({});
  const [errors, setErrors] = useState<PublicIntakeFieldErrors>({});
  const [result, setResult] = useState<SubmitPublicIntakeResult | null>(null);

  const fields = useMemo(() => form?.fields ?? [], [form?.fields]);
  const renderableFields = useMemo(
    () => fields.filter((field) => canRenderNativePublicIntakeField(field)),
    [fields],
  );
  const unsupportedRequired = useMemo(
    () => fields.some((field) => field.required && !canRenderNativePublicIntakeField(field)),
    [fields],
  );

  if (formQ.isLoading) return <Loading label={t('intakeForms.publicLoading')} />;
  if (formQ.isError || !form) {
    return (
      <Screen>
        <ErrorView
          message={
            formQ.error instanceof Error ? formQ.error.message : t('intakeForms.publicLoadError')
          }
          onRetry={() => void formQ.refetch()}
        />
      </Screen>
    );
  }

  if (result) return <SubmittedState result={result} {...(onClose ? { onClose } : {})} />;

  if (form.requiresCaptcha && formQ.data?.captchaConfigured) {
    return <CaptchaFallback form={form} url={publicUrl} {...(onClose ? { onClose } : {})} />;
  }

  const updateValue = (name: string, value: string) => {
    setValues((current) => ({ ...current, [name]: value }));
    setErrors((current) => {
      if (!current[name]) return current;
      const next = { ...current };
      delete next[name];
      return next;
    });
  };

  const submit = async () => {
    const nextValues = { ...initialPublicIntakeValues(fields), ...values };
    const nextErrors = validatePublicIntakeFields(fields, nextValues, {
      required: t('intakeForms.publicValidationRequired'),
      email: t('intakeForms.publicValidationEmail'),
      select: t('intakeForms.publicValidationSelect'),
      maxLength: t('validation.invalidField'),
    });
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return;

    try {
      const response = await submitForm.mutateAsync({
        payload: publicIntakeSubmitPayload(fields, nextValues),
      });
      setResult(response);
    } catch {
      setErrors({ _root: t('intakeForms.publicSubmitFailed') });
    }
  };

  return (
    <Screen>
      <ScrollView contentContainerStyle={styles.content}>
        <ScreenHeader
          kicker={t('intakeForms.publicKicker')}
          title={form.title}
          subtitle={form.description ?? t('intakeForms.publicSubtitle')}
          meta={<SemanticBadge label={t('intakeForms.public')} tone="violet" />}
        />

        {unsupportedRequired ? (
          <View style={styles.warningBox}>
            <FileWarning size={18} color={colors.warning} />
            <Text style={styles.warningText}>{t('intakeForms.publicUnsupportedRequired')}</Text>
          </View>
        ) : null}

        <View style={styles.formCard}>
          {renderableFields.length === 0 ? (
            <Text style={styles.helpText}>{t('intakeForms.publicNoFields')}</Text>
          ) : (
            renderableFields.map((field) => (
              <FieldControl
                key={field.name}
                field={field}
                value={values[field.name] ?? ''}
                {...(errors[field.name] ? { error: errors[field.name] } : {})}
                onChange={(value) => updateValue(field.name, value)}
              />
            ))
          )}
        </View>

        {errors._root ? <Text style={styles.errorText}>{errors._root}</Text> : null}

        <View style={styles.actionRow}>
          <Button
            title={
              submitForm.isPending
                ? t('intakeForms.publicSubmitting')
                : t('intakeForms.publicSubmit')
            }
            icon={Send}
            disabled={submitForm.isPending || unsupportedRequired}
            onPress={() => void submit()}
          />
          {publicUrl ? (
            <Button
              title={t('intakeForms.publicOpenInBrowser')}
              variant="secondary"
              icon={ExternalLink}
              onPress={() => void Linking.openURL(publicUrl)}
            />
          ) : null}
          {onClose ? (
            <Button title={t('onboarding.signIn')} variant="ghost" onPress={onClose} />
          ) : null}
        </View>
      </ScrollView>
    </Screen>
  );
}

function createPublicIntakeStyles(colors: ThemeColors) {
  return StyleSheet.create({
    content: {
      gap: 14,
      paddingBottom: 24,
    },
    centerContent: {
      flex: 1,
      justifyContent: 'center',
      gap: 14,
      padding: 16,
    },
    formCard: {
      gap: 14,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
      borderRadius: 6,
      backgroundColor: colors.card,
      marginHorizontal: 16,
      padding: 14,
    },
    fieldBlock: {
      gap: 7,
    },
    fieldLabel: {
      color: colors.foreground,
      fontSize: 13,
      fontWeight: '700',
      lineHeight: 18,
    },
    helpText: {
      color: colors.mutedForeground,
      fontSize: 12,
      lineHeight: 17,
    },
    errorText: {
      color: colors.destructive,
      fontSize: 12,
      lineHeight: 17,
      marginHorizontal: 16,
    },
    optionWrap: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 8,
    },
    optionButton: {
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
      borderRadius: 6,
      backgroundColor: colors.surface,
      paddingHorizontal: 11,
      paddingVertical: 8,
    },
    optionButtonSelected: {
      borderColor: colors.primary,
      backgroundColor: colors.primary,
    },
    optionText: {
      color: colors.foreground,
      fontSize: 13,
      fontWeight: '600',
      lineHeight: 18,
    },
    optionTextSelected: {
      color: colors.primaryForeground,
    },
    warningBox: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: 10,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: alpha(colors.warning, '55'),
      borderRadius: 6,
      backgroundColor: alpha(colors.warning, '12'),
      marginHorizontal: 16,
      padding: 12,
    },
    warningText: {
      flex: 1,
      color: colors.warning,
      fontSize: 13,
      lineHeight: 18,
    },
    actionRow: {
      gap: 10,
      paddingHorizontal: 16,
    },
    fallbackActions: {
      gap: 10,
      paddingHorizontal: 16,
    },
  });
}
