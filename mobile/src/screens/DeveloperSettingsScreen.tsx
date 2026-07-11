import { useEffect, useMemo, useState } from 'react';
import { Alert } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
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
import {
  AlertCircle,
  Check,
  FileText,
  KeyRound,
  Pencil,
  Plus,
  RotateCw,
  Save,
  ScrollText,
  Send,
  Settings,
  Trash2,
  Users,
  Webhook as WebhookIcon,
  X,
} from 'lucide-react-native';
import { useTranslation } from 'react-i18next';

import type { ApiKey, AuditLogEntry, Project, Webhook, WebhookTestResult } from '@/api/types';
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
  useAuditLogs,
  useApiKeys,
  useCreateApiKey,
  useCreateWebhook,
  useDeleteWebhook,
  useProjects,
  useRevokeApiKey,
  useTestWebhook,
  useUpdateWebhook,
  useWebhooks,
} from '@/hooks/queries';
import { auditActionLabel } from '@/lib/audit-actions';
import { formatLocalizedDate, relativeTime } from '@/lib/format';
import type { AppStackParamList, DeveloperSettingsSection } from '@/navigation/types';

type DeveloperSettingsProps = NativeStackScreenProps<AppStackParamList, 'DeveloperSettings'>;
type DeveloperSection = DeveloperSettingsSection;
type AuditFilter = 'all' | 'created' | 'updated' | 'deleted';
type ExpiryPreset = 'never' | '30d' | '90d' | '365d';
type DeveloperSettingsStyles = ReturnType<typeof createDeveloperSettingsStyles>;

interface OrganizationOption {
  id: string;
  projectCount: number;
}

const EXPIRY_PRESETS: ExpiryPreset[] = ['never', '30d', '90d', '365d'];
const AUDIT_FILTERS: AuditFilter[] = ['all', 'created', 'updated', 'deleted'];
const WEBHOOK_EVENTS = [
  'issue.created',
  'issue.updated',
  'issue.deleted',
  'issue.status_changed',
  'issue.assigned',
  'issue.commented',
  'sprint.started',
  'sprint.completed',
  'project.created',
  'project.updated',
] as const;
const DEFAULT_WEBHOOK_EVENTS = ['issue.created', 'issue.updated'];

function useDeveloperSettingsTheme(): {
  colors: ThemeColors;
  styles: DeveloperSettingsStyles;
} {
  const colors = useThemeColors();
  const styles = useMemo(() => createDeveloperSettingsStyles(colors), [colors]);

  return { colors, styles };
}

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

function expiryDateForPreset(preset: ExpiryPreset): string | null {
  if (preset === 'never') return null;
  const date = new Date();
  if (preset === '30d') date.setDate(date.getDate() + 30);
  if (preset === '90d') date.setDate(date.getDate() + 90);
  if (preset === '365d') date.setFullYear(date.getFullYear() + 1);
  return date.toISOString();
}

function isValidWebhookUrl(value: string): boolean {
  try {
    const parsed = new URL(value);
    return parsed.protocol === 'https:' || parsed.protocol === 'http:';
  } catch {
    return false;
  }
}

function sectionLabelKey(section: DeveloperSection): string {
  if (section === 'apiKeys') return 'developer.apiKeys.title';
  if (section === 'webhooks') return 'developer.webhooks.title';
  return 'developer.audit.title';
}

function expiryLabelKey(preset: ExpiryPreset): string {
  if (preset === '30d') return 'developer.apiKeys.expiry30d';
  if (preset === '90d') return 'developer.apiKeys.expiry90d';
  if (preset === '365d') return 'developer.apiKeys.expiry365d';
  return 'developer.apiKeys.expiryNever';
}

function auditFilterLabelKey(filter: AuditFilter): string {
  if (filter === 'created') return 'developer.audit.filterCreated';
  if (filter === 'updated') return 'developer.audit.filterUpdated';
  if (filter === 'deleted') return 'developer.audit.filterDeleted';
  return 'developer.audit.filterAll';
}

function auditTone(action: string): 'blue' | 'amber' | 'rose' | 'neutral' {
  if (action.includes('deleted') || action.includes('revoked')) return 'rose';
  if (action.includes('updated') || action.includes('changed')) return 'amber';
  if (action.includes('created')) return 'blue';
  return 'neutral';
}

function auditIcon(action: string) {
  if (action.startsWith('issue.')) return FileText;
  if (action.startsWith('project.') || action.startsWith('organization.')) return Users;
  if (action.startsWith('webhook.')) return WebhookIcon;
  if (action.startsWith('api_key.')) return KeyRound;
  if (action.startsWith('custom_field.')) return Settings;
  return AlertCircle;
}

function valuePreview(value: unknown): string {
  if (value === null || value === undefined) return 'null';
  if (typeof value === 'string') return value;
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}

function OrganizationPill({
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
  const { styles } = useDeveloperSettingsTheme();

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected }}
      onPress={() => onPress(option.id)}
      style={[styles.orgPill, selected ? styles.orgPillActive : null]}
      className="active:opacity-80"
    >
      <Text style={[styles.orgTitle, selected ? styles.orgTitleActive : null]}>
        {t('team.workspaceIndex', { index: index + 1 })}
      </Text>
      <View style={styles.orgMetaRow}>
        <Text style={[styles.orgMeta, selected ? styles.orgMetaActive : null]} numberOfLines={1}>
          {t('team.projectCount', { count: option.projectCount })}
        </Text>
        <View style={[styles.orgMetaDot, selected ? styles.orgMetaDotActive : null]} />
        <Text style={[styles.orgMeta, selected ? styles.orgMetaActive : null]} numberOfLines={1}>
          {shortId(option.id)}
        </Text>
      </View>
    </Pressable>
  );
}

function SegmentButton({
  section,
  selected,
  onPress,
}: {
  section: DeveloperSection;
  selected: boolean;
  onPress: (section: DeveloperSection) => void;
}) {
  const { t } = useTranslation();
  const { styles } = useDeveloperSettingsTheme();

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected }}
      onPress={() => onPress(section)}
      style={[styles.segmentButton, selected ? styles.segmentButtonActive : null]}
      className="active:opacity-80"
    >
      <Text style={[styles.segmentText, selected ? styles.segmentTextActive : null]}>
        {t(sectionLabelKey(section))}
      </Text>
    </Pressable>
  );
}

function ChoicePill({
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
  const { styles } = useDeveloperSettingsTheme();

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected, disabled }}
      disabled={disabled}
      onPress={onPress}
      style={[
        styles.choicePill,
        selected ? styles.choicePillActive : null,
        disabled ? styles.disabled : null,
      ]}
      className="active:opacity-80"
    >
      <Text style={[styles.choiceText, selected ? styles.choiceTextActive : null]}>{label}</Text>
    </Pressable>
  );
}

function SecretBlock({
  title,
  description,
  value,
  onDone,
}: {
  title: string;
  description: string;
  value: string;
  onDone: () => void;
}) {
  const { t } = useTranslation();
  const { styles } = useDeveloperSettingsTheme();

  return (
    <SurfaceRow className="gap-3">
      <View className="flex-row items-start gap-3">
        <IconTile icon={Check} tone="emerald" />
        <View className="min-w-0 flex-1 gap-1">
          <Text className="text-foreground text-base font-semibold">{title}</Text>
          <Text className="text-muted-foreground text-sm">{description}</Text>
        </View>
      </View>
      <View style={styles.secretBox}>
        <Text selectable style={styles.secretText}>
          {value}
        </Text>
      </View>
      <Button title={t('developer.doneSaved')} icon={Check} onPress={onDone} />
    </SurfaceRow>
  );
}

function ApiKeyCard({
  apiKey,
  revoking,
  onRevoke,
}: {
  apiKey: ApiKey;
  revoking: boolean;
  onRevoke: () => void;
}) {
  const { t } = useTranslation();
  const { styles } = useDeveloperSettingsTheme();
  const createdAt = relativeTime(apiKey.createdAt);
  const lastUsedAt = relativeTime(apiKey.lastUsedAt);

  return (
    <SurfaceRow className="gap-3">
      <View className="flex-row items-start gap-3">
        <IconTile icon={KeyRound} tone={apiKey.isActive ? 'blue' : 'neutral'} />
        <View className="min-w-0 flex-1 gap-2">
          <View className="gap-1">
            <Text className="text-foreground text-base font-semibold" numberOfLines={1}>
              {apiKey.name}
            </Text>
            <View style={styles.badgeRow}>
              <SemanticBadge
                label={
                  apiKey.isActive
                    ? t('developer.apiKeys.statusActive')
                    : t('developer.apiKeys.statusRevoked')
                }
                tone={apiKey.isActive ? 'emerald' : 'neutral'}
              />
              {apiKey.expiresAt ? (
                <SemanticBadge
                  label={t('developer.apiKeys.expires', {
                    date: formatLocalizedDate(apiKey.expiresAt),
                  })}
                  tone="amber"
                />
              ) : null}
            </View>
          </View>
          <View style={styles.codeBox}>
            <Text style={styles.codeText} numberOfLines={1}>
              {apiKey.keyPrefix
                ? t('developer.apiKeys.prefixValue', { prefix: apiKey.keyPrefix })
                : t('developer.apiKeys.hiddenPrefix')}
            </Text>
          </View>
          <View style={styles.metaList}>
            {createdAt ? (
              <Text style={styles.metaText}>{t('developer.createdAt', { time: createdAt })}</Text>
            ) : null}
            {lastUsedAt ? (
              <Text style={styles.metaText}>
                {t('developer.apiKeys.lastUsed', { time: lastUsedAt })}
              </Text>
            ) : (
              <Text style={styles.metaText}>{t('developer.apiKeys.neverUsed')}</Text>
            )}
          </View>
        </View>
      </View>
      {apiKey.isActive ? (
        <Button
          title={t('developer.apiKeys.revoke')}
          variant="destructive"
          icon={Trash2}
          loading={revoking}
          disabled={revoking}
          onPress={onRevoke}
        />
      ) : null}
    </SurfaceRow>
  );
}

function WebhookEventPill({
  event,
  selected,
  disabled,
  onPress,
}: {
  event: string;
  selected: boolean;
  disabled?: boolean;
  onPress: () => void;
}) {
  const { styles } = useDeveloperSettingsTheme();

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected, disabled }}
      disabled={disabled}
      onPress={onPress}
      style={[
        styles.eventPill,
        selected ? styles.eventPillActive : null,
        disabled ? styles.disabled : null,
      ]}
      className="active:opacity-80"
    >
      <Text style={[styles.eventText, selected ? styles.eventTextActive : null]}>{event}</Text>
    </Pressable>
  );
}

function WebhookCard({
  webhook,
  deleting,
  toggling,
  testing,
  testResult,
  onEdit,
  onToggle,
  onTest,
  onDelete,
}: {
  webhook: Webhook;
  deleting: boolean;
  toggling: boolean;
  testing: boolean;
  testResult: WebhookTestResult | undefined;
  onEdit: () => void;
  onToggle: () => void;
  onTest: () => void;
  onDelete: () => void;
}) {
  const { t } = useTranslation();
  const { colors, styles } = useDeveloperSettingsTheme();
  const lastTriggered = relativeTime(webhook.lastTriggeredAt);

  return (
    <SurfaceRow className="gap-3">
      <View className="flex-row items-start gap-3">
        <IconTile icon={WebhookIcon} tone={webhook.isActive ? 'cyan' : 'neutral'} />
        <View className="min-w-0 flex-1 gap-2">
          <View className="gap-1">
            <Text className="text-foreground text-base font-semibold" numberOfLines={1}>
              {webhook.name}
            </Text>
            <View style={styles.badgeRow}>
              <SemanticBadge
                label={
                  webhook.isActive
                    ? t('developer.webhooks.statusActive')
                    : t('developer.webhooks.statusInactive')
                }
                tone={webhook.isActive ? 'emerald' : 'neutral'}
              />
              <SemanticBadge
                label={t('developer.webhooks.stats', {
                  ok: webhook.successCount,
                  failed: webhook.failureCount,
                })}
                tone="blue"
              />
            </View>
          </View>
          <View style={styles.codeBox}>
            <Text style={styles.codeText} numberOfLines={2}>
              {webhook.url}
            </Text>
          </View>
          <View style={styles.badgeRow}>
            {webhook.events.map((event) => (
              <View key={event} style={styles.eventBadge}>
                <Text style={styles.eventBadgeText}>{event}</Text>
              </View>
            ))}
          </View>
          {lastTriggered ? (
            <Text style={styles.metaText}>
              {t('developer.webhooks.lastTriggered', { time: lastTriggered })}
            </Text>
          ) : (
            <Text style={styles.metaText}>{t('developer.webhooks.neverTriggered')}</Text>
          )}
          {testResult ? (
            <Text style={testResult.success ? styles.successText : styles.errorText}>
              {testResult.statusCode
                ? t('developer.webhooks.testResult', {
                    status: testResult.statusCode,
                    ms: testResult.durationMs,
                  })
                : testResult.error || t('developer.webhooks.testNoResponse')}
            </Text>
          ) : null}
        </View>
      </View>
      <View style={styles.actionRow}>
        <Pressable
          accessibilityRole="button"
          disabled={testing}
          onPress={onTest}
          style={[styles.iconButton, testing ? styles.disabled : null]}
        >
          <Send size={16} color={colors.foreground} />
          <Text style={styles.iconButtonText}>
            {testing ? t('developer.webhooks.sending') : t('developer.webhooks.sendTest')}
          </Text>
        </Pressable>
        <Pressable accessibilityRole="button" onPress={onEdit} style={styles.iconButton}>
          <Pencil size={16} color={colors.foreground} />
          <Text style={styles.iconButtonText}>{t('common.edit')}</Text>
        </Pressable>
        <Pressable
          accessibilityRole="switch"
          accessibilityState={{ checked: webhook.isActive, disabled: toggling }}
          disabled={toggling}
          onPress={onToggle}
          style={[styles.iconButton, toggling ? styles.disabled : null]}
        >
          <RotateCw size={16} color={colors.foreground} />
          <Text style={styles.iconButtonText}>
            {webhook.isActive ? t('developer.webhooks.disable') : t('developer.webhooks.enable')}
          </Text>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          disabled={deleting}
          onPress={onDelete}
          style={[styles.iconButton, deleting ? styles.disabled : null]}
        >
          <Trash2 size={16} color={colors.destructive} />
          <Text style={[styles.iconButtonText, styles.destructiveText]}>
            {t('developer.webhooks.delete')}
          </Text>
        </Pressable>
      </View>
    </SurfaceRow>
  );
}

function AuditLogCard({
  expanded,
  log,
  onToggle,
}: {
  expanded: boolean;
  log: AuditLogEntry;
  onToggle: () => void;
}) {
  const { t } = useTranslation();
  const { styles } = useDeveloperSettingsTheme();
  const Icon = auditIcon(log.action);
  const changes = Object.entries(log.changes ?? {});
  const time = relativeTime(log.createdAt);
  const userLabel = log.user?.name || log.user?.email || t('developer.audit.unknownActor');

  return (
    <SurfaceRow className="gap-3">
      <Pressable
        accessibilityRole="button"
        accessibilityState={{ expanded }}
        onPress={onToggle}
        className="active:opacity-80"
      >
        <View className="flex-row items-start gap-3">
          <IconTile icon={Icon} tone={auditTone(log.action)} />
          <View className="min-w-0 flex-1 gap-2">
            <View className="gap-1">
              <Text className="text-foreground text-base font-semibold" numberOfLines={1}>
                {auditActionLabel(log.action)}
              </Text>
              <View style={styles.badgeRow}>
                <SemanticBadge label={log.resourceType} tone="neutral" />
              </View>
            </View>
            <Text style={styles.metaText} numberOfLines={1}>
              {t('developer.audit.actorLine', { actor: userLabel })}
            </Text>
            <Text style={styles.metaText} numberOfLines={1}>
              {time ? t('developer.audit.timeLine', { time }) : log.resourceId}
            </Text>
            <View style={styles.codeBox}>
              <Text style={styles.codeText} numberOfLines={1}>
                {t('developer.audit.resourceLine', {
                  type: log.resourceType,
                  id: log.resourceId,
                })}
              </Text>
            </View>
          </View>
        </View>
      </Pressable>

      {expanded ? (
        <View style={styles.auditDetails}>
          {changes.length > 0 ? (
            changes.map(([field, change]) => (
              <View key={field} style={styles.auditChangeRow}>
                <Text style={styles.auditField} numberOfLines={1}>
                  {field}
                </Text>
                <Text style={styles.auditValue} numberOfLines={2}>
                  {valuePreview(change.from)}
                </Text>
                <Text style={styles.auditArrow}>{t('developer.audit.changeTo')}</Text>
                <Text style={styles.auditValue} numberOfLines={2}>
                  {valuePreview(change.to)}
                </Text>
              </View>
            ))
          ) : (
            <Text style={styles.metaText}>{t('developer.audit.noChanges')}</Text>
          )}
          {log.metadata && Object.keys(log.metadata).length > 0 ? (
            <View style={styles.codeBox}>
              <Text selectable style={styles.codeText}>
                {JSON.stringify(log.metadata, null, 2)}
              </Text>
            </View>
          ) : null}
        </View>
      ) : null}
    </SurfaceRow>
  );
}

export function DeveloperSettingsScreen({ route }: DeveloperSettingsProps) {
  const { t } = useTranslation();
  const { styles } = useDeveloperSettingsTheme();
  const routeSection = route.params?.section;
  const projectsQ = useProjects();
  const organizations = useMemo(() => uniqueOrganizations(projectsQ.data ?? []), [projectsQ.data]);
  const [selectedOrganizationId, setSelectedOrganizationId] = useState<string | null>(null);
  const activeOrganizationId = selectedOrganizationId ?? organizations[0]?.id ?? null;
  const apiKeysQ = useApiKeys(activeOrganizationId);
  const webhooksQ = useWebhooks(activeOrganizationId);
  const [auditFilter, setAuditFilter] = useState<AuditFilter>('all');
  const auditLogsQ = useAuditLogs(activeOrganizationId, auditFilter);
  const createApiKey = useCreateApiKey(activeOrganizationId);
  const revokeApiKey = useRevokeApiKey(activeOrganizationId);
  const createWebhook = useCreateWebhook(activeOrganizationId);
  const updateWebhook = useUpdateWebhook(activeOrganizationId);
  const deleteWebhook = useDeleteWebhook(activeOrganizationId);
  const testWebhook = useTestWebhook(activeOrganizationId);

  const [section, setSection] = useState<DeveloperSection>(routeSection ?? 'apiKeys');
  const [apiKeyName, setApiKeyName] = useState('');
  const [apiKeyExpiry, setApiKeyExpiry] = useState<ExpiryPreset>('never');
  const [createdApiKey, setCreatedApiKey] = useState<string | null>(null);
  const [apiKeyError, setApiKeyError] = useState<string | null>(null);
  const [apiKeyNotice, setApiKeyNotice] = useState<string | null>(null);

  const [webhookEditingId, setWebhookEditingId] = useState<string | null>(null);
  const [webhookName, setWebhookName] = useState('');
  const [webhookUrl, setWebhookUrl] = useState('');
  const [webhookEvents, setWebhookEvents] = useState<string[]>(DEFAULT_WEBHOOK_EVENTS);
  const [createdWebhookSecret, setCreatedWebhookSecret] = useState<string | null>(null);
  const [webhookError, setWebhookError] = useState<string | null>(null);
  const [webhookNotice, setWebhookNotice] = useState<string | null>(null);
  const [testingWebhookId, setTestingWebhookId] = useState<string | null>(null);
  const [testResults, setTestResults] = useState<Record<string, WebhookTestResult>>({});
  const [expandedAuditId, setExpandedAuditId] = useState<string | null>(null);

  const apiKeys = apiKeysQ.data ?? [];
  const webhooks = webhooksQ.data ?? [];
  const auditLogs = useMemo(() => {
    const logs = auditLogsQ.data ?? [];
    if (auditFilter === 'all') return logs;
    return logs.filter((log) => log.action.includes(auditFilter));
  }, [auditFilter, auditLogsQ.data]);
  const isRefreshing =
    projectsQ.isRefetching ||
    apiKeysQ.isRefetching ||
    webhooksQ.isRefetching ||
    auditLogsQ.isRefetching;
  const isSavingWebhook = createWebhook.isPending || updateWebhook.isPending;

  useEffect(() => {
    if (organizations.length === 0) {
      if (selectedOrganizationId) setSelectedOrganizationId(null);
      return;
    }
    if (
      selectedOrganizationId &&
      organizations.some((organization) => organization.id === selectedOrganizationId)
    ) {
      return;
    }
    setSelectedOrganizationId(organizations[0]?.id ?? null);
  }, [organizations, selectedOrganizationId]);

  useEffect(() => {
    if (routeSection) setSection(routeSection);
  }, [routeSection]);

  const refresh = () => {
    void projectsQ.refetch();
    if (activeOrganizationId) {
      void apiKeysQ.refetch();
      void webhooksQ.refetch();
      void auditLogsQ.refetch();
    }
  };

  const submitApiKey = async () => {
    if (!activeOrganizationId) return;
    const name = apiKeyName.trim();
    setApiKeyError(null);
    setApiKeyNotice(null);

    if (!name) {
      setApiKeyError(t('developer.apiKeys.nameRequired'));
      return;
    }

    try {
      const key = await createApiKey.mutateAsync({
        organizationId: activeOrganizationId,
        name,
        expiresAt: expiryDateForPreset(apiKeyExpiry),
      });
      setApiKeyName('');
      setApiKeyExpiry('never');
      setCreatedApiKey(key.key ?? null);
      setApiKeyNotice(t('developer.apiKeys.created'));
    } catch (err: unknown) {
      setApiKeyError(err instanceof Error ? err.message : t('developer.apiKeys.createFailed'));
    }
  };

  const confirmRevokeApiKey = (apiKey: ApiKey) => {
    Alert.alert(
      t('developer.apiKeys.revokeTitle'),
      t('developer.apiKeys.revokeMessage', { name: apiKey.name }),
      [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('developer.apiKeys.revoke'),
          style: 'destructive',
          onPress: () => {
            setApiKeyError(null);
            revokeApiKey.mutate(apiKey.id, {
              onSuccess: () => setApiKeyNotice(t('developer.apiKeys.revoked')),
              onError: (err) =>
                setApiKeyError(
                  err instanceof Error ? err.message : t('developer.apiKeys.revokeFailed'),
                ),
            });
          },
        },
      ],
    );
  };

  const resetWebhookForm = () => {
    setWebhookEditingId(null);
    setWebhookName('');
    setWebhookUrl('');
    setWebhookEvents(DEFAULT_WEBHOOK_EVENTS);
    setWebhookError(null);
  };

  const beginWebhookEdit = (webhook: Webhook) => {
    setSection('webhooks');
    setWebhookEditingId(webhook.id);
    setWebhookName(webhook.name);
    setWebhookUrl(webhook.url);
    setWebhookEvents(webhook.events.length > 0 ? webhook.events : DEFAULT_WEBHOOK_EVENTS);
    setWebhookError(null);
    setWebhookNotice(null);
    setCreatedWebhookSecret(null);
  };

  const toggleWebhookEvent = (event: string) => {
    setWebhookEvents((current) =>
      current.includes(event) ? current.filter((item) => item !== event) : [...current, event],
    );
    setWebhookError(null);
    setWebhookNotice(null);
  };

  const submitWebhook = async () => {
    if (!activeOrganizationId) return;
    const name = webhookName.trim();
    const url = webhookUrl.trim();
    setWebhookError(null);
    setWebhookNotice(null);

    if (!name || !url || webhookEvents.length === 0) {
      setWebhookError(t('developer.webhooks.requiredFields'));
      return;
    }
    if (!isValidWebhookUrl(url)) {
      setWebhookError(t('developer.webhooks.invalidUrl'));
      return;
    }

    try {
      if (webhookEditingId) {
        await updateWebhook.mutateAsync({
          id: webhookEditingId,
          name,
          url,
          events: webhookEvents,
        });
        setWebhookNotice(t('developer.webhooks.updated'));
      } else {
        const webhook = await createWebhook.mutateAsync({
          organizationId: activeOrganizationId,
          name,
          url,
          events: webhookEvents,
        });
        setCreatedWebhookSecret(webhook.secret ?? null);
        setWebhookNotice(t('developer.webhooks.created'));
      }
      resetWebhookForm();
    } catch (err: unknown) {
      setWebhookError(err instanceof Error ? err.message : t('developer.webhooks.saveFailed'));
    }
  };

  const toggleWebhookActive = async (webhook: Webhook) => {
    setWebhookError(null);
    setWebhookNotice(null);
    try {
      await updateWebhook.mutateAsync({ id: webhook.id, isActive: !webhook.isActive });
      setWebhookNotice(
        webhook.isActive ? t('developer.webhooks.disabled') : t('developer.webhooks.enabled'),
      );
    } catch (err: unknown) {
      setWebhookError(err instanceof Error ? err.message : t('developer.webhooks.saveFailed'));
    }
  };

  const sendWebhookTest = async (webhook: Webhook) => {
    setTestingWebhookId(webhook.id);
    setWebhookError(null);
    setWebhookNotice(null);
    try {
      const result = await testWebhook.mutateAsync(webhook.id);
      setTestResults((current) => ({ ...current, [webhook.id]: result }));
      setWebhookNotice(
        result.success ? t('developer.webhooks.testDelivered') : t('developer.webhooks.testFailed'),
      );
    } catch (err: unknown) {
      setTestResults((current) => ({
        ...current,
        [webhook.id]: {
          success: false,
          statusCode: null,
          durationMs: 0,
          error: t('developer.webhooks.testFailed'),
        },
      }));
      setWebhookError(err instanceof Error ? err.message : t('developer.webhooks.testFailed'));
    } finally {
      setTestingWebhookId(null);
    }
  };

  const confirmDeleteWebhook = (webhook: Webhook) => {
    Alert.alert(
      t('developer.webhooks.deleteTitle'),
      t('developer.webhooks.deleteMessage', { name: webhook.name }),
      [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('developer.webhooks.delete'),
          style: 'destructive',
          onPress: () => {
            setWebhookError(null);
            deleteWebhook.mutate(webhook.id, {
              onSuccess: () => setWebhookNotice(t('developer.webhooks.deleted')),
              onError: (err) =>
                setWebhookError(
                  err instanceof Error ? err.message : t('developer.webhooks.deleteFailed'),
                ),
            });
          },
        },
      ],
    );
  };

  if (projectsQ.isLoading) {
    return <Loading label={t('developer.loading')} />;
  }

  if (projectsQ.isError) {
    return (
      <ErrorView
        message={
          projectsQ.error instanceof Error ? projectsQ.error.message : t('developer.loadFailed')
        }
        onRetry={() => void projectsQ.refetch()}
      />
    );
  }

  return (
    <Screen>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        className="flex-1"
      >
        <ScreenHeader
          kicker={t('developer.kicker')}
          title={t('developer.title')}
          subtitle={t('developer.subtitle')}
          meta={
            <SemanticBadge
              label={activeOrganizationId ? shortId(activeOrganizationId) : t('common.none')}
              tone="indigo"
            />
          }
        />
        <ScrollView
          contentContainerClassName="gap-3 px-4 pb-4"
          keyboardShouldPersistTaps="handled"
          refreshControl={<RefreshControl refreshing={isRefreshing} onRefresh={refresh} />}
        >
          <SurfaceRow className="gap-3">
            <View className="flex-row items-start gap-3">
              <IconTile icon={WebhookIcon} tone="indigo" />
              <View className="min-w-0 flex-1 gap-1">
                <Text className="text-muted-foreground text-xs font-medium">
                  {t('team.workspace')}
                </Text>
                <Text className="text-foreground text-base font-semibold">
                  {t('developer.workspaceTitle')}
                </Text>
                <Text className="text-muted-foreground text-sm">
                  {t('developer.workspaceSubtitle')}
                </Text>
              </View>
            </View>
            {organizations.length > 0 ? (
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.orgList}
              >
                {organizations.map((organization, index) => (
                  <OrganizationPill
                    key={organization.id}
                    index={index}
                    option={organization}
                    selected={organization.id === activeOrganizationId}
                    onPress={setSelectedOrganizationId}
                  />
                ))}
              </ScrollView>
            ) : (
              <View style={styles.inlineNotice}>
                <Text className="text-foreground text-sm font-semibold">
                  {t('team.noWorkspace')}
                </Text>
                <Text className="text-muted-foreground text-sm">{t('team.noWorkspaceDesc')}</Text>
              </View>
            )}
          </SurfaceRow>

          <View style={styles.segment}>
            <SegmentButton
              section="apiKeys"
              selected={section === 'apiKeys'}
              onPress={setSection}
            />
            <SegmentButton
              section="webhooks"
              selected={section === 'webhooks'}
              onPress={setSection}
            />
            <SegmentButton section="audit" selected={section === 'audit'} onPress={setSection} />
          </View>

          {section === 'apiKeys' ? (
            <>
              {createdApiKey ? (
                <SecretBlock
                  title={t('developer.apiKeys.createdSecretTitle')}
                  description={t('developer.apiKeys.createdSecretDesc')}
                  value={createdApiKey}
                  onDone={() => setCreatedApiKey(null)}
                />
              ) : null}

              <SurfaceRow className="gap-3">
                <View className="flex-row items-start gap-3">
                  <IconTile icon={KeyRound} tone="blue" />
                  <View className="min-w-0 flex-1 gap-1">
                    <Text className="text-foreground text-base font-semibold">
                      {t('developer.apiKeys.createTitle')}
                    </Text>
                    <Text className="text-muted-foreground text-sm">
                      {t('developer.apiKeys.createSubtitle')}
                    </Text>
                  </View>
                </View>
                <TextField
                  label={t('developer.apiKeys.nameLabel')}
                  placeholder={t('developer.apiKeys.namePlaceholder')}
                  value={apiKeyName}
                  editable={!createApiKey.isPending && !!activeOrganizationId}
                  onChangeText={(value) => {
                    setApiKeyName(value);
                    setApiKeyError(null);
                    setApiKeyNotice(null);
                  }}
                  error={apiKeyError ?? undefined}
                  returnKeyType="send"
                  onSubmitEditing={() => void submitApiKey()}
                />
                <View style={styles.choiceGroup}>
                  <Text className="text-foreground text-sm font-medium">
                    {t('developer.apiKeys.expiryLabel')}
                  </Text>
                  <View style={styles.choiceRow}>
                    {EXPIRY_PRESETS.map((preset) => (
                      <ChoicePill
                        key={preset}
                        label={t(expiryLabelKey(preset))}
                        selected={apiKeyExpiry === preset}
                        disabled={createApiKey.isPending}
                        onPress={() => setApiKeyExpiry(preset)}
                      />
                    ))}
                  </View>
                </View>
                {apiKeyNotice ? <Text style={styles.successText}>{apiKeyNotice}</Text> : null}
                <Button
                  title={t('developer.apiKeys.create')}
                  icon={Plus}
                  loading={createApiKey.isPending}
                  disabled={!activeOrganizationId || createApiKey.isPending}
                  onPress={() => void submitApiKey()}
                />
              </SurfaceRow>

              {apiKeysQ.isLoading ? (
                <Loading label={t('developer.apiKeys.loading')} />
              ) : apiKeysQ.isError ? (
                <ErrorView
                  message={
                    apiKeysQ.error instanceof Error
                      ? apiKeysQ.error.message
                      : t('developer.apiKeys.loadFailed')
                  }
                  onRetry={() => void apiKeysQ.refetch()}
                />
              ) : apiKeys.length === 0 ? (
                <EmptyState
                  icon={KeyRound}
                  title={t('developer.apiKeys.emptyTitle')}
                  description={t('developer.apiKeys.emptyDesc')}
                />
              ) : (
                apiKeys.map((apiKey) => (
                  <ApiKeyCard
                    key={apiKey.id}
                    apiKey={apiKey}
                    revoking={revokeApiKey.isPending}
                    onRevoke={() => confirmRevokeApiKey(apiKey)}
                  />
                ))
              )}
            </>
          ) : section === 'webhooks' ? (
            <>
              {createdWebhookSecret ? (
                <SecretBlock
                  title={t('developer.webhooks.createdSecretTitle')}
                  description={t('developer.webhooks.createdSecretDesc')}
                  value={createdWebhookSecret}
                  onDone={() => setCreatedWebhookSecret(null)}
                />
              ) : null}

              <SurfaceRow className="gap-3">
                <View className="flex-row items-start gap-3">
                  <IconTile icon={WebhookIcon} tone="cyan" />
                  <View className="min-w-0 flex-1 gap-1">
                    <Text className="text-foreground text-base font-semibold">
                      {webhookEditingId
                        ? t('developer.webhooks.editTitle')
                        : t('developer.webhooks.createTitle')}
                    </Text>
                    <Text className="text-muted-foreground text-sm">
                      {t('developer.webhooks.createSubtitle')}
                    </Text>
                  </View>
                </View>
                <TextField
                  label={t('developer.webhooks.nameLabel')}
                  placeholder={t('developer.webhooks.namePlaceholder')}
                  value={webhookName}
                  editable={!isSavingWebhook && !!activeOrganizationId}
                  onChangeText={(value) => {
                    setWebhookName(value);
                    setWebhookError(null);
                    setWebhookNotice(null);
                  }}
                />
                <TextField
                  label={t('developer.webhooks.urlLabel')}
                  placeholder={t('developer.webhooks.urlPlaceholder')}
                  value={webhookUrl}
                  editable={!isSavingWebhook && !!activeOrganizationId}
                  onChangeText={(value) => {
                    setWebhookUrl(value);
                    setWebhookError(null);
                    setWebhookNotice(null);
                  }}
                  autoCapitalize="none"
                  autoCorrect={false}
                  keyboardType="url"
                  textContentType="URL"
                />
                <View style={styles.choiceGroup}>
                  <Text className="text-foreground text-sm font-medium">
                    {t('developer.webhooks.eventsLabel')}
                  </Text>
                  <View style={styles.eventGrid}>
                    {WEBHOOK_EVENTS.map((event) => (
                      <WebhookEventPill
                        key={event}
                        event={event}
                        selected={webhookEvents.includes(event)}
                        disabled={isSavingWebhook}
                        onPress={() => toggleWebhookEvent(event)}
                      />
                    ))}
                  </View>
                </View>
                {webhookError ? <Text style={styles.errorText}>{webhookError}</Text> : null}
                {webhookNotice ? <Text style={styles.successText}>{webhookNotice}</Text> : null}
                <View style={styles.formActions}>
                  {webhookEditingId ? (
                    <Button
                      title={t('common.cancel')}
                      variant="secondary"
                      icon={X}
                      disabled={isSavingWebhook}
                      onPress={resetWebhookForm}
                    />
                  ) : null}
                  <Button
                    title={
                      webhookEditingId
                        ? t('developer.webhooks.save')
                        : t('developer.webhooks.create')
                    }
                    icon={webhookEditingId ? Save : Plus}
                    loading={isSavingWebhook}
                    disabled={!activeOrganizationId || isSavingWebhook}
                    onPress={() => void submitWebhook()}
                  />
                </View>
              </SurfaceRow>

              {webhooksQ.isLoading ? (
                <Loading label={t('developer.webhooks.loading')} />
              ) : webhooksQ.isError ? (
                <ErrorView
                  message={
                    webhooksQ.error instanceof Error
                      ? webhooksQ.error.message
                      : t('developer.webhooks.loadFailed')
                  }
                  onRetry={() => void webhooksQ.refetch()}
                />
              ) : webhooks.length === 0 ? (
                <EmptyState
                  icon={WebhookIcon}
                  title={t('developer.webhooks.emptyTitle')}
                  description={t('developer.webhooks.emptyDesc')}
                />
              ) : (
                webhooks.map((webhook) => (
                  <WebhookCard
                    key={webhook.id}
                    webhook={webhook}
                    deleting={deleteWebhook.isPending}
                    toggling={updateWebhook.isPending}
                    testing={testingWebhookId === webhook.id}
                    testResult={testResults[webhook.id]}
                    onEdit={() => beginWebhookEdit(webhook)}
                    onToggle={() => void toggleWebhookActive(webhook)}
                    onTest={() => void sendWebhookTest(webhook)}
                    onDelete={() => confirmDeleteWebhook(webhook)}
                  />
                ))
              )}
            </>
          ) : (
            <>
              <SurfaceRow className="gap-3">
                <View className="flex-row items-start gap-3">
                  <IconTile icon={ScrollText} tone="amber" />
                  <View className="min-w-0 flex-1 gap-1">
                    <Text className="text-foreground text-base font-semibold">
                      {t('developer.audit.heading')}
                    </Text>
                    <Text className="text-muted-foreground text-sm">
                      {t('developer.audit.subtitle')}
                    </Text>
                  </View>
                  <SemanticBadge
                    label={t('developer.audit.eventCount', { count: auditLogs.length })}
                    tone="neutral"
                  />
                </View>
                <View style={styles.choiceRow}>
                  {AUDIT_FILTERS.map((filter) => (
                    <ChoicePill
                      key={filter}
                      label={t(auditFilterLabelKey(filter))}
                      selected={auditFilter === filter}
                      onPress={() => {
                        setAuditFilter(filter);
                        setExpandedAuditId(null);
                      }}
                    />
                  ))}
                </View>
              </SurfaceRow>

              {auditLogsQ.isLoading ? (
                <Loading label={t('developer.audit.loading')} />
              ) : auditLogsQ.isError ? (
                <ErrorView
                  message={
                    auditLogsQ.error instanceof Error
                      ? auditLogsQ.error.message
                      : t('developer.audit.loadFailed')
                  }
                  onRetry={() => void auditLogsQ.refetch()}
                />
              ) : auditLogs.length === 0 ? (
                <EmptyState
                  icon={ScrollText}
                  title={t('developer.audit.emptyTitle')}
                  description={t('developer.audit.emptyDesc')}
                />
              ) : (
                auditLogs.map((log) => (
                  <AuditLogCard
                    key={log.id}
                    log={log}
                    expanded={expandedAuditId === log.id}
                    onToggle={() =>
                      setExpandedAuditId((current) => (current === log.id ? null : log.id))
                    }
                  />
                ))
              )}
            </>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </Screen>
  );
}

function createDeveloperSettingsStyles(colors: ThemeColors) {
  return StyleSheet.create({
    orgList: {
      gap: 8,
      paddingRight: 4,
    },
    orgPill: {
      minWidth: 164,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
      borderRadius: 6,
      backgroundColor: colors.card,
      paddingHorizontal: 12,
      paddingVertical: 10,
    },
    orgPillActive: {
      borderColor: colors.primary,
      backgroundColor: `${colors.primary}14`,
    },
    orgTitle: {
      color: colors.foreground,
      fontSize: 13,
      fontWeight: '700',
      lineHeight: 18,
    },
    orgTitleActive: {
      color: colors.primary,
    },
    orgMetaRow: {
      marginTop: 3,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
    },
    orgMeta: {
      color: colors.mutedForeground,
      fontSize: 11,
      fontWeight: '600',
      lineHeight: 15,
    },
    orgMetaActive: {
      color: colors.foreground,
    },
    orgMetaDot: {
      width: 3,
      height: 3,
      borderRadius: 999,
      backgroundColor: colors.mutedForeground,
    },
    orgMetaDotActive: {
      backgroundColor: colors.primary,
    },
    inlineNotice: {
      gap: 4,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
      borderRadius: 6,
      padding: 12,
    },
    segment: {
      flexDirection: 'row',
      gap: 8,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
      borderRadius: 8,
      backgroundColor: colors.card,
      padding: 4,
    },
    segmentButton: {
      minHeight: 40,
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      borderRadius: 5,
      paddingHorizontal: 10,
    },
    segmentButtonActive: {
      backgroundColor: colors.primary,
    },
    segmentText: {
      color: colors.mutedForeground,
      fontSize: 13,
      fontWeight: '700',
      lineHeight: 18,
    },
    segmentTextActive: {
      color: colors.primaryForeground,
    },
    choiceGroup: {
      gap: 8,
    },
    choiceRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 8,
    },
    choicePill: {
      minHeight: 36,
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
      borderRadius: 5,
      backgroundColor: colors.card,
      paddingHorizontal: 12,
      paddingVertical: 8,
    },
    choicePillActive: {
      borderColor: colors.primary,
      backgroundColor: colors.primary,
    },
    choiceText: {
      color: colors.mutedForeground,
      fontSize: 12,
      fontWeight: '700',
      lineHeight: 16,
    },
    choiceTextActive: {
      color: colors.primaryForeground,
    },
    secretBox: {
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
      borderRadius: 6,
      backgroundColor: colors.surface,
      padding: 12,
    },
    secretText: {
      color: colors.foreground,
      fontSize: 13,
      fontWeight: '600',
      lineHeight: 20,
    },
    badgeRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 6,
    },
    codeBox: {
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
      borderRadius: 5,
      backgroundColor: colors.surface,
      paddingHorizontal: 10,
      paddingVertical: 8,
    },
    codeText: {
      color: colors.mutedForeground,
      fontSize: 12,
      fontWeight: '600',
      lineHeight: 17,
    },
    metaList: {
      gap: 3,
    },
    metaText: {
      color: colors.mutedForeground,
      fontSize: 12,
      lineHeight: 17,
    },
    actionRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 8,
    },
    iconButton: {
      minHeight: 36,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 6,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
      borderRadius: 5,
      backgroundColor: colors.card,
      paddingHorizontal: 10,
      paddingVertical: 8,
    },
    iconButtonText: {
      color: colors.foreground,
      fontSize: 12,
      fontWeight: '700',
      lineHeight: 16,
    },
    destructiveText: {
      color: colors.destructive,
    },
    formActions: {
      gap: 8,
    },
    eventGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 8,
    },
    eventPill: {
      minHeight: 34,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
      borderRadius: 5,
      backgroundColor: colors.card,
      paddingHorizontal: 10,
      paddingVertical: 8,
    },
    eventPillActive: {
      borderColor: `${colors.accentCyan}80`,
      backgroundColor: `${colors.accentCyan}1A`,
    },
    eventText: {
      color: colors.mutedForeground,
      fontSize: 11,
      fontWeight: '700',
      lineHeight: 15,
    },
    eventTextActive: {
      color: colors.accentCyan,
    },
    eventBadge: {
      borderRadius: 4,
      backgroundColor: colors.muted,
      paddingHorizontal: 7,
      paddingVertical: 3,
    },
    eventBadgeText: {
      color: colors.mutedForeground,
      fontSize: 11,
      fontWeight: '700',
      lineHeight: 15,
    },
    auditDetails: {
      gap: 8,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: colors.border,
      paddingTop: 10,
    },
    auditChangeRow: {
      gap: 5,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
      borderRadius: 5,
      backgroundColor: colors.surface,
      paddingHorizontal: 10,
      paddingVertical: 8,
    },
    auditField: {
      color: colors.foreground,
      fontSize: 12,
      fontWeight: '700',
      lineHeight: 16,
    },
    auditValue: {
      color: colors.mutedForeground,
      fontSize: 12,
      lineHeight: 17,
    },
    auditArrow: {
      color: colors.primary,
      fontSize: 11,
      fontWeight: '700',
      lineHeight: 15,
    },
    successText: {
      color: colors.success,
      fontSize: 13,
      fontWeight: '600',
      lineHeight: 18,
    },
    errorText: {
      color: colors.destructive,
      fontSize: 13,
      fontWeight: '600',
      lineHeight: 18,
    },
    disabled: {
      opacity: 0.5,
    },
  });
}
