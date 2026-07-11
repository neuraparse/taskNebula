import { useEffect, useMemo, useState } from 'react';
import { Alert } from 'react-native';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from '@/components/native';
import {
  Activity,
  CheckCircle2,
  Database,
  FlaskConical,
  Plus,
  RadioTower,
  RefreshCw,
  Send,
  Trash2,
} from 'lucide-react-native';
import { useTranslation } from 'react-i18next';

import type {
  AuditLogSink,
  AuditLogSinkTestResult,
  AuditLogSinkType,
  Organization,
} from '@/api/types';
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
import { useThemeColors } from '@/design/theme-context';
import {
  useAuditLogSinks,
  useCreateAuditLogSink,
  useDeleteAuditLogSink,
  useOrganizations,
  useTestAuditLogSink,
  useUpdateAuditLogSink,
} from '@/hooks/queries';
import { formatLocalizedDateTime } from '@/lib/format';

const SINK_TYPES = ['webhook', 'splunk_hec', 'datadog', 's3'] as const;

type KnownSinkType = (typeof SINK_TYPES)[number];
type AuditLogStreamingStyles = ReturnType<typeof createAuditLogStreamingStyles>;

function useAuditLogStreamingTheme(): {
  colors: ThemeColors;
  styles: AuditLogStreamingStyles;
} {
  const colors = useThemeColors();
  const styles = useMemo(() => createAuditLogStreamingStyles(colors), [colors]);
  return { colors, styles };
}

interface SinkFormState {
  type: KnownSinkType;
  name: string;
  configJson: string;
}

const DEFAULT_CONFIG: Record<KnownSinkType, string> = {
  webhook: JSON.stringify({ url: 'https://siem.example.com/ingest' }, null, 2),
  splunk_hec: JSON.stringify(
    {
      url: 'https://splunk.example.com:8088/services/collector',
      token: 'YOUR_SPLUNK_HEC_TOKEN',
      index: 'main',
    },
    null,
    2,
  ),
  datadog: JSON.stringify({ apiKey: 'YOUR_DATADOG_API_KEY', site: 'datadoghq.com' }, null, 2),
  s3: JSON.stringify({ bucket: 'tasknebula-audit', region: 'us-east-1', prefix: 'audit' }, null, 2),
};

function emptyForm(): SinkFormState {
  return {
    type: 'webhook',
    name: '',
    configJson: DEFAULT_CONFIG.webhook,
  };
}

function organizationLabel(organization: Organization): string {
  return organization.name || organization.slug || organization.id;
}

function sinkTypeLabelKey(type: AuditLogSinkType): string {
  if (type === 'splunk_hec') return 'auditLogStreaming.type.splunk_hec';
  if (type === 'datadog') return 'auditLogStreaming.type.datadog';
  if (type === 's3') return 'auditLogStreaming.type.s3';
  return 'auditLogStreaming.type.webhook';
}

function sinkIcon(type: AuditLogSinkType) {
  if (type === 's3') return Database;
  if (type === 'datadog') return Activity;
  if (type === 'splunk_hec') return RadioTower;
  return Send;
}

function compactMeta(parts: Array<string | null | undefined>): string {
  return parts.filter((part): part is string => Boolean(part)).join(' · ');
}

function formatDate(value: string | null | undefined, fallback: string): string {
  return formatLocalizedDateTime(value, fallback);
}

function countsMeta(sink: AuditLogSink, t: ReturnType<typeof useTranslation>['t']): string {
  return compactMeta([
    t('auditLogStreaming.successCount', { count: sink.successCount }),
    t('auditLogStreaming.failureCount', { count: sink.failureCount }),
    sink.lastDeliveryAt
      ? t('auditLogStreaming.lastDelivery', {
          date: formatDate(sink.lastDeliveryAt, t('auditLogStreaming.dateUnknown')),
        })
      : t('auditLogStreaming.neverDelivered'),
  ]);
}

function testResultLabel(
  result: AuditLogSinkTestResult,
  t: ReturnType<typeof useTranslation>['t'],
): string {
  if (result.ok) {
    return t('auditLogStreaming.testOk', { status: result.statusCode ?? t('common.none') });
  }
  if (result.error) return result.error;
  return t('auditLogStreaming.testFailed', { status: result.statusCode ?? t('common.none') });
}

function OrganizationPill({
  organization,
  selected,
  disabled,
  onPress,
}: {
  organization: Organization;
  selected: boolean;
  disabled: boolean;
  onPress: (organizationId: string) => void;
}) {
  const { styles } = useAuditLogStreamingTheme();

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected, disabled }}
      disabled={disabled}
      onPress={() => onPress(organization.id)}
      style={[
        styles.orgPill,
        selected ? styles.orgPillActive : null,
        disabled ? styles.disabled : null,
      ]}
      className="active:opacity-80"
    >
      <Text
        style={[styles.orgPillTitle, selected ? styles.orgPillTitleActive : null]}
        numberOfLines={1}
      >
        {organizationLabel(organization)}
      </Text>
      <Text
        style={[styles.orgPillMeta, selected ? styles.orgPillMetaActive : null]}
        numberOfLines={1}
      >
        {organization.slug || organization.id}
      </Text>
    </Pressable>
  );
}

function TypePill({
  type,
  selected,
  disabled,
  onPress,
}: {
  type: KnownSinkType;
  selected: boolean;
  disabled: boolean;
  onPress: (type: KnownSinkType) => void;
}) {
  const { t } = useTranslation();
  const { colors, styles } = useAuditLogStreamingTheme();
  const Icon = sinkIcon(type);
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected, disabled }}
      disabled={disabled}
      onPress={() => onPress(type)}
      style={[
        styles.typePill,
        selected ? styles.typePillActive : null,
        disabled ? styles.disabled : null,
      ]}
      className="active:opacity-80"
    >
      <Icon size={14} color={selected ? colors.primaryForeground : colors.mutedForeground} />
      <Text style={[styles.typePillText, selected ? styles.typePillTextActive : null]}>
        {t(sinkTypeLabelKey(type))}
      </Text>
    </Pressable>
  );
}

function SinkRow({
  sink,
  disabled,
  testResult,
  onToggle,
  onTest,
  onDelete,
}: {
  sink: AuditLogSink;
  disabled: boolean;
  testResult: AuditLogSinkTestResult | null;
  onToggle: (sink: AuditLogSink) => void;
  onTest: (sink: AuditLogSink) => void;
  onDelete: (sink: AuditLogSink) => void;
}) {
  const { t } = useTranslation();
  const { styles } = useAuditLogStreamingTheme();
  const Icon = sinkIcon(sink.type);
  return (
    <View style={styles.sinkRow}>
      <View style={styles.sinkHeader}>
        <IconTile icon={Icon} tone={sink.enabled ? 'emerald' : 'neutral'} />
        <View className="min-w-0 flex-1 gap-1">
          <View style={styles.titleRow}>
            <Text style={styles.sinkName} numberOfLines={1}>
              {sink.name}
            </Text>
            <SemanticBadge
              label={
                sink.enabled ? t('auditLogStreaming.enabled') : t('auditLogStreaming.disabled')
              }
              tone={sink.enabled ? 'emerald' : 'neutral'}
            />
          </View>
          <Text style={styles.panelSubtitle}>{t(sinkTypeLabelKey(sink.type))}</Text>
          <Text style={styles.panelSubtitle}>{countsMeta(sink, t)}</Text>
        </View>
      </View>

      {sink.lastError ? <Text style={styles.errorText}>{sink.lastError}</Text> : null}
      {testResult ? (
        <Text style={testResult.ok ? styles.noticeText : styles.errorText}>
          {testResultLabel(testResult, t)}
        </Text>
      ) : null}
      <Text style={styles.configPreview} numberOfLines={4}>
        {JSON.stringify(sink.config, null, 2)}
      </Text>

      <View style={styles.actionRow}>
        <Button
          title={sink.enabled ? t('auditLogStreaming.disable') : t('auditLogStreaming.enable')}
          icon={RefreshCw}
          variant="secondary"
          disabled={disabled}
          onPress={() => onToggle(sink)}
        />
        <Button
          title={t('auditLogStreaming.test')}
          icon={FlaskConical}
          variant="secondary"
          disabled={disabled}
          onPress={() => onTest(sink)}
        />
        <Button
          title={t('auditLogStreaming.delete')}
          icon={Trash2}
          variant="destructive"
          disabled={disabled}
          onPress={() => onDelete(sink)}
        />
      </View>
    </View>
  );
}

export function AuditLogStreamingScreen() {
  const { t } = useTranslation();
  const { colors, styles } = useAuditLogStreamingTheme();
  const organizationsQ = useOrganizations();
  const organizations = useMemo(
    () => organizationsQ.data?.organizations ?? [],
    [organizationsQ.data?.organizations],
  );
  const [organizationId, setOrganizationId] = useState<string | null>(null);
  const sinksQ = useAuditLogSinks(organizationId);
  const createSink = useCreateAuditLogSink(organizationId);
  const updateSink = useUpdateAuditLogSink(organizationId);
  const deleteSink = useDeleteAuditLogSink(organizationId);
  const testSink = useTestAuditLogSink(organizationId);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<SinkFormState>(() => emptyForm());
  const [revealedSecret, setRevealedSecret] = useState<string | null>(null);
  const [testResults, setTestResults] = useState<Record<string, AuditLogSinkTestResult>>({});
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const sinks = sinksQ.data?.sinks ?? [];
  const isBusy =
    createSink.isPending || updateSink.isPending || deleteSink.isPending || testSink.isPending;
  const activeCount = sinks.filter((sink) => sink.enabled).length;

  useEffect(() => {
    if (organizationId && organizations.some((organization) => organization.id === organizationId))
      return;
    setOrganizationId(organizations[0]?.id ?? null);
  }, [organizationId, organizations]);

  const selectType = (type: KnownSinkType) => {
    setForm((current) => ({
      ...current,
      type,
      configJson: DEFAULT_CONFIG[type],
    }));
  };

  const parseConfig = (): Record<string, unknown> | null => {
    try {
      const parsed = JSON.parse(form.configJson) as unknown;
      if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
        setError(t('auditLogStreaming.configMustBeObject'));
        return null;
      }
      return parsed as Record<string, unknown>;
    } catch {
      setError(t('auditLogStreaming.invalidJson'));
      return null;
    }
  };

  const createAuditSink = async () => {
    if (!organizationId) {
      setError(t('auditLogStreaming.errorOrganizationRequired'));
      return;
    }
    const name = form.name.trim();
    if (!name) {
      setError(t('auditLogStreaming.errorNameRequired'));
      return;
    }
    const config = parseConfig();
    if (!config) return;
    setError(null);
    setNotice(null);
    try {
      const result = await createSink.mutateAsync({
        organizationId,
        type: form.type,
        name,
        config,
        enabled: true,
      });
      setRevealedSecret(result.signingSecret);
      setForm(emptyForm());
      setShowForm(false);
      setNotice(t('auditLogStreaming.createdNotice'));
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : t('auditLogStreaming.createFailed'));
    }
  };

  const toggleSink = async (sink: AuditLogSink) => {
    setError(null);
    setNotice(null);
    try {
      await updateSink.mutateAsync({ sinkId: sink.id, enabled: !sink.enabled });
      setNotice(t('auditLogStreaming.updatedNotice'));
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : t('auditLogStreaming.updateFailed'));
    }
  };

  const testAuditSink = async (sink: AuditLogSink) => {
    setError(null);
    setNotice(null);
    try {
      const result = await testSink.mutateAsync(sink.id);
      setTestResults((current) => ({ ...current, [sink.id]: result }));
      setNotice(
        result.ok ? t('auditLogStreaming.testNoticeOk') : t('auditLogStreaming.testNoticeFailed'),
      );
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : t('auditLogStreaming.testRequestFailed'));
    }
  };

  const confirmDelete = (sink: AuditLogSink) => {
    Alert.alert(
      t('auditLogStreaming.deleteTitle'),
      t('auditLogStreaming.deleteDescription', { name: sink.name }),
      [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('auditLogStreaming.delete'),
          style: 'destructive',
          onPress: () => {
            void deleteAuditSink(sink.id);
          },
        },
      ],
    );
  };

  const deleteAuditSink = async (sinkId: string) => {
    setError(null);
    setNotice(null);
    try {
      await deleteSink.mutateAsync(sinkId);
      setNotice(t('auditLogStreaming.deletedNotice'));
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : t('auditLogStreaming.deleteFailed'));
    }
  };

  if (organizationsQ.isLoading) {
    return <Loading label={t('auditLogStreaming.loadingOrganizations')} />;
  }

  if (organizationsQ.isError) {
    return (
      <Screen>
        <ScreenHeader
          kicker={t('auditLogStreaming.kicker')}
          title={t('auditLogStreaming.title')}
          subtitle={t('auditLogStreaming.subtitle')}
        />
        <ErrorView
          message={t('auditLogStreaming.organizationsLoadFailed')}
          onRetry={() => void organizationsQ.refetch()}
        />
      </Screen>
    );
  }

  return (
    <Screen>
      <ScreenHeader
        kicker={t('auditLogStreaming.kicker')}
        title={t('auditLogStreaming.title')}
        subtitle={t('auditLogStreaming.subtitle')}
        meta={
          <SemanticBadge
            label={t('auditLogStreaming.activeCount', { count: activeCount })}
            tone="cyan"
          />
        }
      />

      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        {organizations.length === 0 ? (
          <EmptyState
            icon={RadioTower}
            title={t('auditLogStreaming.emptyTitle')}
            description={t('auditLogStreaming.emptyDescription')}
          />
        ) : (
          <>
            <SurfaceRow className="gap-3">
              <View style={styles.sectionHeader}>
                <IconTile icon={RadioTower} tone="cyan" />
                <View className="min-w-0 flex-1 gap-1">
                  <Text style={styles.panelTitle}>{t('auditLogStreaming.organizationTitle')}</Text>
                  <Text style={styles.panelSubtitle}>
                    {t('auditLogStreaming.organizationSubtitle')}
                  </Text>
                </View>
              </View>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.pillWrap}
              >
                {organizations.map((organization) => (
                  <OrganizationPill
                    key={organization.id}
                    organization={organization}
                    selected={organizationId === organization.id}
                    disabled={isBusy}
                    onPress={(nextOrganizationId) => {
                      setOrganizationId(nextOrganizationId);
                      setRevealedSecret(null);
                      setNotice(null);
                      setError(null);
                    }}
                  />
                ))}
              </ScrollView>
            </SurfaceRow>

            {revealedSecret ? (
              <View style={styles.secretBox}>
                <View style={styles.sectionHeader}>
                  <CheckCircle2 size={18} color={colors.accentAmber} />
                  <View className="min-w-0 flex-1 gap-1">
                    <Text style={styles.panelTitle}>{t('auditLogStreaming.secretTitle')}</Text>
                    <Text style={styles.panelSubtitle}>
                      {t('auditLogStreaming.secretDescription')}
                    </Text>
                  </View>
                </View>
                <Text style={styles.secretText}>{revealedSecret}</Text>
                <Button
                  title={t('auditLogStreaming.secretCopied')}
                  variant="secondary"
                  onPress={() => setRevealedSecret(null)}
                />
              </View>
            ) : null}

            {notice ? <Text style={styles.noticeText}>{notice}</Text> : null}
            {error ? <Text style={styles.errorText}>{error}</Text> : null}

            <SurfaceRow className="gap-3">
              <View style={styles.sectionHeader}>
                <IconTile icon={Plus} tone="indigo" />
                <View className="min-w-0 flex-1 gap-1">
                  <Text style={styles.panelTitle}>{t('auditLogStreaming.addTitle')}</Text>
                  <Text style={styles.panelSubtitle}>{t('auditLogStreaming.addSubtitle')}</Text>
                </View>
              </View>
              <Button
                title={showForm ? t('common.cancel') : t('auditLogStreaming.addSink')}
                icon={showForm ? RefreshCw : Plus}
                variant="secondary"
                disabled={isBusy}
                onPress={() => {
                  setShowForm((current) => !current);
                  setError(null);
                }}
              />

              {showForm ? (
                <View style={styles.formBlock}>
                  <TextField
                    label={t('auditLogStreaming.name')}
                    placeholder={t('auditLogStreaming.namePlaceholder')}
                    value={form.name}
                    editable={!isBusy}
                    onChangeText={(value) => setForm((current) => ({ ...current, name: value }))}
                  />
                  <View style={styles.typeGrid}>
                    {SINK_TYPES.map((type) => (
                      <TypePill
                        key={type}
                        type={type}
                        selected={form.type === type}
                        disabled={isBusy}
                        onPress={selectType}
                      />
                    ))}
                  </View>
                  <Text style={styles.sectionLabel}>{t('auditLogStreaming.configJson')}</Text>
                  <TextInput
                    value={form.configJson}
                    editable={!isBusy}
                    multiline
                    placeholder={t('auditLogStreaming.configPlaceholder')}
                    placeholderTextColor={colors.mutedForeground}
                    onChangeText={(value) =>
                      setForm((current) => ({ ...current, configJson: value }))
                    }
                    style={styles.configInput}
                  />
                  <Button
                    title={t('auditLogStreaming.create')}
                    icon={Plus}
                    loading={createSink.isPending}
                    disabled={isBusy}
                    onPress={() => void createAuditSink()}
                  />
                </View>
              ) : null}
            </SurfaceRow>

            <SurfaceRow className="gap-3">
              <View style={styles.sectionHeader}>
                <IconTile icon={RadioTower} tone="emerald" />
                <View className="min-w-0 flex-1 gap-1">
                  <Text style={styles.panelTitle}>{t('auditLogStreaming.sinksTitle')}</Text>
                  <Text style={styles.panelSubtitle}>
                    {t('auditLogStreaming.sinkCount', { count: sinks.length })}
                  </Text>
                </View>
              </View>

              {sinksQ.isLoading ? (
                <Loading label={t('auditLogStreaming.loadingSinks')} />
              ) : sinksQ.isError ? (
                <ErrorView
                  message={
                    sinksQ.error instanceof Error
                      ? sinksQ.error.message
                      : t('auditLogStreaming.sinksLoadFailed')
                  }
                  onRetry={() => void sinksQ.refetch()}
                />
              ) : sinks.length === 0 ? (
                <EmptyState
                  icon={RadioTower}
                  title={t('auditLogStreaming.noSinksTitle')}
                  description={t('auditLogStreaming.noSinksDescription')}
                />
              ) : (
                <View style={styles.sinkList}>
                  {sinks.map((sink) => (
                    <SinkRow
                      key={sink.id}
                      sink={sink}
                      disabled={isBusy}
                      testResult={testResults[sink.id] ?? null}
                      onToggle={(item) => void toggleSink(item)}
                      onTest={(item) => void testAuditSink(item)}
                      onDelete={confirmDelete}
                    />
                  ))}
                </View>
              )}
            </SurfaceRow>
          </>
        )}
      </ScrollView>
    </Screen>
  );
}

function createAuditLogStreamingStyles(colors: ThemeColors) {
  return StyleSheet.create({
    content: {
      gap: 12,
      paddingHorizontal: 16,
      paddingBottom: 16,
    },
    sectionHeader: {
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
    sectionLabel: {
      color: colors.foreground,
      fontSize: 13,
      fontWeight: '700',
      lineHeight: 18,
    },
    pillWrap: {
      flexDirection: 'row',
      gap: 8,
    },
    orgPill: {
      minWidth: 140,
      maxWidth: 220,
      gap: 2,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
      borderRadius: 4,
      backgroundColor: colors.card,
      paddingHorizontal: 10,
      paddingVertical: 8,
    },
    orgPillActive: {
      borderColor: colors.primary,
      backgroundColor: colors.primary,
    },
    orgPillTitle: {
      color: colors.foreground,
      fontSize: 13,
      fontWeight: '700',
      lineHeight: 18,
    },
    orgPillTitleActive: {
      color: colors.primaryForeground,
    },
    orgPillMeta: {
      color: colors.mutedForeground,
      fontSize: 12,
      lineHeight: 16,
    },
    orgPillMetaActive: {
      color: colors.primaryForeground,
    },
    secretBox: {
      gap: 10,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.accentAmber,
      borderRadius: 6,
      backgroundColor: `${colors.accentAmber}12`,
      padding: 12,
    },
    secretText: {
      color: colors.foreground,
      fontSize: 12,
      fontFamily: 'monospace',
      lineHeight: 17,
    },
    formBlock: {
      gap: 10,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: colors.border,
      paddingTop: 12,
    },
    typeGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 8,
    },
    typePill: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
      borderRadius: 4,
      backgroundColor: colors.card,
      paddingHorizontal: 10,
      paddingVertical: 8,
    },
    typePillActive: {
      borderColor: colors.primary,
      backgroundColor: colors.primary,
    },
    typePillText: {
      color: colors.mutedForeground,
      fontSize: 12,
      fontWeight: '700',
      lineHeight: 16,
    },
    typePillTextActive: {
      color: colors.primaryForeground,
    },
    configInput: {
      minHeight: 170,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
      borderRadius: 6,
      backgroundColor: colors.card,
      color: colors.foreground,
      padding: 12,
      textAlignVertical: 'top',
    },
    sinkList: {
      gap: 10,
    },
    sinkRow: {
      gap: 10,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
      borderRadius: 4,
      padding: 10,
    },
    sinkHeader: {
      minWidth: 0,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
    },
    titleRow: {
      minWidth: 0,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
    },
    sinkName: {
      flex: 1,
      color: colors.foreground,
      fontSize: 13,
      fontWeight: '700',
      lineHeight: 18,
    },
    configPreview: {
      color: colors.mutedForeground,
      fontSize: 12,
      fontFamily: 'monospace',
      lineHeight: 17,
    },
    actionRow: {
      gap: 8,
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
    disabled: {
      opacity: 0.5,
    },
  });
}
