import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { ScrollView as NativeScrollView } from 'react-native';
import { useRoute, type RouteProp } from '@react-navigation/native';
import { Pressable, ScrollView, StyleSheet, Text, View } from '@/components/native';
import {
  AlertCircle,
  Bot,
  Check,
  Clock3,
  Database,
  ShieldCheck,
  Sparkles,
  X,
} from 'lucide-react-native';
import { useTranslation } from 'react-i18next';

import type {
  AgentApprovalRequest,
  AgentPolicyRule,
  AgentPolicyStatus,
  AgentModelConfig,
  AiOversightMode,
  AiProvider,
  AiSafetyMode,
  Organization,
  OrganizationAgentSettingsResponse,
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
import { useThemeColors, useThemeEffects } from '@/design/theme-context';
import {
  useAgentApprovals,
  useAgentPolicy,
  useApproveAgentApproval,
  useOrganizationAgentSettings,
  useOrganizations,
  useRejectAgentApproval,
  useUpdateOrganizationAgentSettings,
} from '@/hooks/queries';
import { relativeTime } from '@/lib/format';
import type { AppStackParamList } from '@/navigation/types';

type AiFeatureId = 'draft' | 'assist' | 'triage' | 'ask' | 'summary' | 'embedding';
type AiExecutionMode = 'manual' | 'assistive' | 'auto';
type AiTransparencyRoute = RouteProp<AppStackParamList, 'AiTransparency'>;
type AiTransparencyStyles = ReturnType<typeof createAiTransparencyStyles>;
type FeatureSetting = { type: 'assistant' } | { type: 'capability'; key: 'backlog_triage' } | null;

interface AiFeatureCardDefinition {
  id: AiFeatureId;
  defaultModel: string;
  defaultProvider: string;
  defaultOversight: AiOversightMode;
  userFacing: boolean;
  setting: FeatureSetting;
}

const AI_FEATURES: AiFeatureCardDefinition[] = [
  {
    id: 'draft',
    defaultModel: 'Claude Sonnet 4.7',
    defaultProvider: 'anthropic',
    defaultOversight: 'review_required',
    userFacing: true,
    setting: { type: 'assistant' },
  },
  {
    id: 'assist',
    defaultModel: 'Claude Sonnet 4.7',
    defaultProvider: 'anthropic',
    defaultOversight: 'review_required',
    userFacing: true,
    setting: { type: 'assistant' },
  },
  {
    id: 'triage',
    defaultModel: 'Claude Sonnet 4.7',
    defaultProvider: 'anthropic',
    defaultOversight: 'review_required',
    userFacing: true,
    setting: { type: 'capability', key: 'backlog_triage' },
  },
  {
    id: 'ask',
    defaultModel: 'Claude Sonnet 4.7',
    defaultProvider: 'anthropic',
    defaultOversight: 'auto',
    userFacing: true,
    setting: { type: 'assistant' },
  },
  {
    id: 'summary',
    defaultModel: 'Claude Sonnet 4.7',
    defaultProvider: 'anthropic',
    defaultOversight: 'auto',
    userFacing: true,
    setting: { type: 'assistant' },
  },
  {
    id: 'embedding',
    defaultModel: 'text-embedding-3-small',
    defaultProvider: 'openai',
    defaultOversight: 'auto',
    userFacing: false,
    setting: null,
  },
];
const AI_PROVIDERS: AiProvider[] = ['native', 'openai', 'anthropic', 'azure', 'custom'];
const AI_EXECUTION_MODES: AiExecutionMode[] = ['manual', 'assistive', 'auto'];
const AI_SAFETY_MODES: AiSafetyMode[] = ['off', 'warn', 'strict'];
const DAILY_RUN_LIMITS = [10, 25, 50, 100, 250] as const;
const DEFAULT_MODEL_BY_PROVIDER: Record<string, string> = {
  native: 'tasknebula-planner-v1',
  openai: 'gpt-5.4',
  anthropic: 'claude-sonnet-4-7',
  azure: 'gpt-5.4',
  custom: 'custom-model',
};

function useAiTransparencyTheme(): {
  colors: ThemeColors;
  styles: AiTransparencyStyles;
} {
  const colors = useThemeColors();
  const styles = useMemo(() => createAiTransparencyStyles(colors), [colors]);

  return { colors, styles };
}

function organizationLabel(organization: Organization): string {
  return organization.name || organization.id;
}

function providerLabel(provider: string, t: ReturnType<typeof useTranslation>['t']): string {
  if (provider === 'anthropic') return t('aiTransparency.providerAnthropic');
  if (provider === 'openai') return t('aiTransparency.providerOpenai');
  if (provider === 'azure') return t('aiTransparency.providerAzure');
  if (provider === 'native') return t('aiTransparency.providerNative');
  if (provider === 'custom') return t('aiTransparency.providerCustom');
  return provider;
}

function oversightLabel(mode: AiOversightMode, t: ReturnType<typeof useTranslation>['t']): string {
  return mode === 'auto' ? t('aiTransparency.oversightAuto') : t('aiTransparency.oversightReview');
}

function executionModeLabelKey(mode: string): string {
  if (mode === 'assistive') return 'aiTransparency.executionMode.assistive';
  if (mode === 'auto') return 'aiTransparency.executionMode.auto';
  return 'aiTransparency.executionMode.manual';
}

function safetyModeLabelKey(mode: string): string {
  if (mode === 'off') return 'aiTransparency.safetyMode.off';
  if (mode === 'strict') return 'aiTransparency.safetyMode.strict';
  return 'aiTransparency.safetyMode.warn';
}

function featureEnabled(
  feature: AiFeatureCardDefinition,
  data: OrganizationAgentSettingsResponse,
): boolean {
  if (!feature.setting) return true;
  if (feature.setting.type === 'assistant') return data.workspaceSettings.assistantEnabled;
  return data.workspaceSettings.capabilities[feature.setting.key] === true;
}

function featurePatch(feature: AiFeatureCardDefinition, enabled: boolean) {
  if (!feature.setting) return null;
  if (feature.setting.type === 'assistant') return { assistantEnabled: enabled };
  return { capabilities: { [feature.setting.key]: enabled } };
}

function shortId(id: string): string {
  return id.length > 10 ? `${id.slice(0, 6)}...${id.slice(-4)}` : id;
}

function policyEffectLabelKey(effect: AgentPolicyRule['effect']): string {
  if (effect === 'allow') return 'team.agentGovernance.effectAllow';
  if (effect === 'deny') return 'team.agentGovernance.effectDeny';
  return 'team.agentGovernance.effectRequireApproval';
}

function policyEffectTone(effect: AgentPolicyRule['effect']): 'emerald' | 'rose' | 'amber' {
  if (effect === 'allow') return 'emerald';
  if (effect === 'deny') return 'rose';
  return 'amber';
}

function approvalStatusLabelKey(status: AgentApprovalRequest['status']): string {
  if (status === 'approved') return 'team.agentGovernance.statusApproved';
  if (status === 'rejected') return 'team.agentGovernance.statusRejected';
  if (status === 'expired') return 'team.agentGovernance.statusExpired';
  return 'team.agentGovernance.statusPending';
}

function approvalStatusTone(
  status: AgentApprovalRequest['status'],
): 'emerald' | 'rose' | 'amber' | 'neutral' {
  if (status === 'approved') return 'emerald';
  if (status === 'rejected') return 'rose';
  if (status === 'expired') return 'neutral';
  return 'amber';
}

function payloadPreview(value: unknown): string {
  try {
    return JSON.stringify(value ?? {}, null, 2);
  } catch {
    return String(value ?? '');
  }
}

function WorkspacePill({
  organization,
  selected,
  onPress,
}: {
  organization: Organization;
  selected: boolean;
  onPress: (id: string) => void;
}) {
  const { styles } = useAiTransparencyTheme();

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected }}
      onPress={() => onPress(organization.id)}
      style={[styles.workspacePill, selected ? styles.workspacePillActive : null]}
      className="active:opacity-80"
    >
      <Text style={[styles.workspaceTitle, selected ? styles.workspaceTitleActive : null]}>
        {organizationLabel(organization)}
      </Text>
      <Text
        style={[styles.workspaceMeta, selected ? styles.workspaceMetaActive : null]}
        numberOfLines={1}
      >
        {organization.slug ?? organization.id}
      </Text>
    </Pressable>
  );
}

function ToggleRow({
  title,
  description,
  enabled,
  disabled,
  onPress,
}: {
  title: string;
  description: string;
  enabled: boolean;
  disabled?: boolean;
  onPress: () => void;
}) {
  const { colors, styles } = useAiTransparencyTheme();

  return (
    <Pressable
      accessibilityRole="switch"
      accessibilityState={{ checked: enabled, disabled }}
      disabled={disabled}
      onPress={onPress}
      style={[styles.toggleRow, disabled ? styles.disabled : null]}
      className="active:opacity-80"
    >
      <View className="min-w-0 flex-1 gap-1">
        <Text style={styles.cardTitle}>{title}</Text>
        <Text style={styles.cardDescription}>{description}</Text>
      </View>
      <View style={[styles.switchTrack, enabled ? styles.switchTrackActive : null]}>
        <View style={[styles.switchThumb, enabled ? styles.switchThumbActive : null]}>
          {enabled ? (
            <Check size={12} color={colors.primary} />
          ) : (
            <X size={12} color={colors.mutedForeground} />
          )}
        </View>
      </View>
    </Pressable>
  );
}

function ChoicePill<T extends string | number>({
  label,
  value,
  selected,
  disabled,
  onPress,
}: {
  label: string;
  value: T;
  selected: boolean;
  disabled?: boolean;
  onPress: (value: T) => void;
}) {
  const { styles } = useAiTransparencyTheme();

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
      <Text
        style={[styles.choicePillText, selected ? styles.choicePillTextActive : null]}
        numberOfLines={1}
      >
        {label}
      </Text>
    </Pressable>
  );
}

function ModelConfigRow({
  config,
  selected,
  disabled,
  onApply,
}: {
  config: AgentModelConfig;
  selected: boolean;
  disabled: boolean;
  onApply: (config: AgentModelConfig) => void;
}) {
  const { t } = useTranslation();
  const { styles } = useAiTransparencyTheme();

  return (
    <View style={[styles.modelConfigRow, selected ? styles.modelConfigRowActive : null]}>
      <View className="min-w-0 flex-1 gap-1">
        <View style={styles.infoLabelRow}>
          <Text style={styles.cardTitle} numberOfLines={1}>
            {config.name}
          </Text>
          {config.isDefault ? (
            <SemanticBadge label={t('aiTransparency.defaultProfile')} tone="neutral" />
          ) : null}
          {selected ? (
            <SemanticBadge label={t('aiTransparency.appliedProfile')} tone="emerald" />
          ) : null}
        </View>
        <Text style={styles.cardDescription} numberOfLines={1}>
          {t('aiTransparency.profileProviderModel', {
            provider: providerLabel(config.provider, t),
            model: config.model,
          })}
        </Text>
        {config.description ? (
          <Text style={styles.cardDescription} numberOfLines={2}>
            {config.description}
          </Text>
        ) : null}
      </View>
      <Button
        title={selected ? t('aiTransparency.appliedProfile') : t('aiTransparency.applyProfile')}
        variant="secondary"
        disabled={disabled || selected}
        onPress={() => onApply(config)}
      />
    </View>
  );
}

function MetricTile({
  label,
  value,
  tone = 'neutral',
}: {
  label: string;
  value: string;
  tone?: 'neutral' | 'emerald' | 'amber' | 'rose';
}) {
  const { colors, styles } = useAiTransparencyTheme();
  const borderColor =
    tone === 'emerald'
      ? colors.accentEmerald
      : tone === 'amber'
        ? colors.accentAmber
        : tone === 'rose'
          ? colors.destructive
          : colors.border;

  return (
    <View style={[styles.metricTile, { borderColor }]}>
      <Text style={styles.metricValue} numberOfLines={1}>
        {value}
      </Text>
      <Text style={styles.metricLabel} numberOfLines={2}>
        {label}
      </Text>
    </View>
  );
}

function FeatureCard({
  data,
  disabled,
  feature,
  onToggle,
}: {
  data: OrganizationAgentSettingsResponse;
  disabled: boolean;
  feature: AiFeatureCardDefinition;
  onToggle: (feature: AiFeatureCardDefinition, enabled: boolean) => void;
}) {
  const { t } = useTranslation();
  const { colors, styles } = useAiTransparencyTheme();
  const enabled = featureEnabled(feature, data);
  const toggleDisabled = disabled || !data.access.canManage || !feature.setting;

  return (
    <SurfaceRow className="gap-3">
      <View style={styles.featureHeader}>
        <View className="min-w-0 flex-1 gap-1">
          <Text style={styles.cardTitle}>{t(`aiTransparency.features.${feature.id}.name`)}</Text>
          <Text style={styles.cardDescription}>
            {t(`aiTransparency.features.${feature.id}.summary`)}
          </Text>
        </View>
        <SemanticBadge
          label={
            feature.userFacing ? t('aiTransparency.userFacing') : t('aiTransparency.background')
          }
          tone={feature.userFacing ? 'blue' : 'neutral'}
        />
      </View>

      <View style={styles.featureMetaGrid}>
        <MetricTile label={t('aiTransparency.modelLabel')} value={feature.defaultModel} />
        <MetricTile
          label={t('aiTransparency.providerLabel')}
          value={providerLabel(feature.defaultProvider, t)}
          tone={data.providerStatus.ready ? 'emerald' : 'amber'}
        />
        <MetricTile
          label={t('aiTransparency.defaultOversightLabel')}
          value={oversightLabel(feature.defaultOversight, t)}
        />
      </View>

      <View style={styles.infoBlock}>
        <View style={styles.infoLabelRow}>
          <Database size={14} color={colors.primary} />
          <Text style={styles.infoLabel}>{t('aiTransparency.dataSentLabel')}</Text>
        </View>
        <Text style={styles.cardDescription}>
          {t(`aiTransparency.features.${feature.id}.dataSent`)}
        </Text>
      </View>

      <View style={styles.infoBlock}>
        <View style={styles.infoLabelRow}>
          <Clock3 size={14} color={colors.accentAmber} />
          <Text style={styles.infoLabel}>{t('aiTransparency.retentionLabel')}</Text>
        </View>
        <Text style={styles.cardDescription}>
          {t(`aiTransparency.features.${feature.id}.retention`)}
        </Text>
      </View>

      <ToggleRow
        title={enabled ? t('aiTransparency.featureEnabled') : t('aiTransparency.featureDisabled')}
        description={
          feature.setting
            ? t('aiTransparency.featureToggleDesc')
            : t('aiTransparency.featureReadOnlyDesc')
        }
        enabled={enabled}
        disabled={toggleDisabled}
        onPress={() => onToggle(feature, !enabled)}
      />
    </SurfaceRow>
  );
}

function AiAgentGovernancePanel({
  approvals,
  approvalsError,
  canManage,
  decidingId,
  decisionError,
  loadingApprovals,
  loadingPolicy,
  policy,
  policyError,
  onApprove,
  onReject,
}: {
  approvals: AgentApprovalRequest[];
  approvalsError: unknown;
  canManage: boolean;
  decidingId: string | null;
  decisionError: string | null;
  loadingApprovals: boolean;
  loadingPolicy: boolean;
  policy: AgentPolicyStatus | undefined;
  policyError: unknown;
  onApprove: (approval: AgentApprovalRequest) => void;
  onReject: (approval: AgentApprovalRequest) => void;
}) {
  const { t } = useTranslation();
  const { colors, styles } = useAiTransparencyTheme();
  const visibleRules = policy?.rules.slice(0, 6) ?? [];
  const visibleApprovals = approvals.slice(0, 6);
  const decisionBlocked = decidingId !== null;

  return (
    <SurfaceRow className="gap-3">
      <View style={styles.sectionTitle}>
        <IconTile icon={ShieldCheck} tone="amber" />
        <View className="min-w-0 flex-1 gap-1">
          <Text style={styles.panelTitle}>{t('team.agentGovernance.title')}</Text>
          <Text style={styles.panelSubtitle}>{t('team.agentGovernance.description')}</Text>
        </View>
        {policy ? (
          <SemanticBadge
            label={
              policy.enabled
                ? t('team.agentGovernance.enabled')
                : t('team.agentGovernance.disabled')
            }
            tone={policy.enabled ? 'emerald' : 'neutral'}
          />
        ) : null}
      </View>

      {loadingPolicy ? (
        <Text style={styles.cardDescription}>{t('team.agentGovernance.loading')}</Text>
      ) : null}
      {policyError ? (
        <Text style={styles.errorText}>{t('team.agentGovernance.loadFailed')}</Text>
      ) : null}

      {policy ? (
        <>
          <View style={styles.featureMetaGrid}>
            <MetricTile
              label={t('team.agentGovernance.policySource')}
              value={policy.sourcePath || t('team.agentGovernance.noPolicy')}
            />
            <MetricTile
              label={t('team.agentGovernance.lastParsed')}
              value={
                policy.parsedAt
                  ? (relativeTime(policy.parsedAt) ?? t('common.none'))
                  : t('common.none')
              }
            />
            <MetricTile
              label={t('team.agentGovernance.validationErrors')}
              value={String(policy.errors.length)}
              tone={policy.errors.length > 0 ? 'rose' : 'neutral'}
            />
          </View>

          {policy.errors.length > 0 ? (
            <View style={styles.governanceDangerBox}>
              <View style={styles.infoLabelRow}>
                <AlertCircle size={15} color={colors.destructive} />
                <Text style={styles.issueTitle}>{t('team.agentGovernance.validationTitle')}</Text>
              </View>
              {policy.errors.slice(0, 3).map((item, index) => (
                <Text key={`${item.line}-${index}`} style={styles.errorText} numberOfLines={2}>
                  {t('team.agentGovernance.validationLine', {
                    line: item.line,
                    message: item.message || item.raw,
                  })}
                </Text>
              ))}
            </View>
          ) : null}

          <View style={styles.infoBlock}>
            <Text style={styles.infoLabel}>{t('team.agentGovernance.rulesTitle')}</Text>
            {visibleRules.length === 0 ? (
              <Text style={styles.cardDescription}>{t('team.agentGovernance.noRules')}</Text>
            ) : null}
            {visibleRules.map((rule) => (
              <View key={`${rule.line}-${rule.raw}`} style={styles.governanceRuleRow}>
                <View className="min-w-0 flex-1 gap-1">
                  <Text style={styles.cardTitle} numberOfLines={1}>
                    {rule.actorKind}:{rule.actor}
                  </Text>
                  <Text style={styles.cardDescription} numberOfLines={1}>
                    {rule.resource}:{rule.action}
                  </Text>
                </View>
                <View className="items-end gap-1">
                  <SemanticBadge
                    label={t(policyEffectLabelKey(rule.effect))}
                    tone={policyEffectTone(rule.effect)}
                  />
                  <Text style={styles.timestamp}>
                    {t('team.agentGovernance.line', { line: rule.line })}
                  </Text>
                </View>
              </View>
            ))}
          </View>
        </>
      ) : null}

      <View style={styles.infoBlock}>
        <View style={styles.governanceHeader}>
          <Text style={styles.infoLabel}>{t('team.agentGovernance.queueTitle')}</Text>
          <SemanticBadge
            label={t('team.agentGovernance.queueCount', { count: approvals.length })}
            tone={approvals.length > 0 ? 'amber' : 'neutral'}
          />
        </View>
        {loadingApprovals ? (
          <Text style={styles.cardDescription}>{t('team.agentGovernance.queueLoading')}</Text>
        ) : null}
        {approvalsError ? (
          <Text style={styles.errorText}>{t('team.agentGovernance.queueLoadFailed')}</Text>
        ) : null}
        {decisionError ? <Text style={styles.errorText}>{decisionError}</Text> : null}
        {!loadingApprovals && approvals.length === 0 ? (
          <Text style={styles.cardDescription}>{t('team.agentGovernance.queueEmpty')}</Text>
        ) : null}

        {visibleApprovals.map((approval) => {
          const busy = decidingId === approval.id;
          return (
            <View key={approval.id} style={styles.governanceApprovalRow}>
              <View style={styles.governanceHeader}>
                <View className="min-w-0 flex-1 gap-1">
                  <Text style={styles.cardTitle} numberOfLines={1}>
                    {approval.actor}
                  </Text>
                  <Text style={styles.cardDescription} numberOfLines={1}>
                    {approval.resource}:{approval.action}
                  </Text>
                </View>
                <SemanticBadge
                  label={t(approvalStatusLabelKey(approval.status))}
                  tone={approvalStatusTone(approval.status)}
                />
              </View>
              <View style={styles.governanceMetaRow}>
                <SemanticBadge label={approval.targetType} tone="blue" />
                {approval.targetId ? (
                  <SemanticBadge label={shortId(approval.targetId)} tone="neutral" />
                ) : null}
                {approval.requestedAt ? (
                  <SemanticBadge
                    label={relativeTime(approval.requestedAt) ?? t('common.none')}
                    tone="neutral"
                  />
                ) : null}
              </View>
              {approval.matchedRule ? (
                <Text selectable style={styles.governanceCodeText} numberOfLines={2}>
                  {approval.matchedRule}
                </Text>
              ) : null}
              <Text selectable style={styles.governancePayloadText} numberOfLines={6}>
                {payloadPreview(approval.proposedPayload)}
              </Text>
              <View style={styles.governanceDecisionRow}>
                <View style={styles.governanceDecisionButton}>
                  <Button
                    title={t('team.agentGovernance.approve')}
                    icon={Check}
                    loading={busy}
                    disabled={!canManage || decisionBlocked}
                    onPress={() => onApprove(approval)}
                  />
                </View>
                <View style={styles.governanceDecisionButton}>
                  <Button
                    title={t('team.agentGovernance.reject')}
                    variant="secondary"
                    icon={X}
                    disabled={!canManage || decisionBlocked}
                    onPress={() => onReject(approval)}
                  />
                </View>
              </View>
            </View>
          );
        })}
      </View>
    </SurfaceRow>
  );
}

export function AiTransparencyScreen() {
  const { t } = useTranslation();
  const { colors, styles } = useAiTransparencyTheme();
  const effects = useThemeEffects();
  const route = useRoute<AiTransparencyRoute>();
  const scrollRef = useRef<NativeScrollView | null>(null);
  const organizationsQ = useOrganizations();
  const organizations = useMemo(
    () => organizationsQ.data?.organizations ?? [],
    [organizationsQ.data?.organizations],
  );
  const [selectedOrganizationId, setSelectedOrganizationId] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [agentDecisionError, setAgentDecisionError] = useState<string | null>(null);
  const [decidingApprovalId, setDecidingApprovalId] = useState<string | null>(null);
  const [selectedProvider, setSelectedProvider] = useState<AiProvider>('native');
  const [modelDraft, setModelDraft] = useState('');
  const [modelCardsY, setModelCardsY] = useState<number | null>(null);

  useEffect(() => {
    if (selectedOrganizationId && organizations.some((org) => org.id === selectedOrganizationId)) {
      return;
    }
    setSelectedOrganizationId(organizations[0]?.id ?? null);
  }, [organizations, selectedOrganizationId]);

  const settingsQ = useOrganizationAgentSettings(selectedOrganizationId);
  const updateSettings = useUpdateOrganizationAgentSettings(selectedOrganizationId);
  const data = settingsQ.data;
  const busy = updateSettings.isPending || settingsQ.isFetching;
  const updatedAt = relativeTime(data?.updatedAt);
  const userFacingCount = AI_FEATURES.filter((feature) => feature.userFacing).length;
  const canManage = data?.access.canManage === true;
  const governanceEnabled =
    !!selectedOrganizationId && data?.organizationId === selectedOrganizationId && canManage;
  const agentPolicyQ = useAgentPolicy(selectedOrganizationId, governanceEnabled);
  const agentApprovalsQ = useAgentApprovals(selectedOrganizationId, 'pending', governanceEnabled);
  const approveAgentApproval = useApproveAgentApproval(selectedOrganizationId);
  const rejectAgentApproval = useRejectAgentApproval(selectedOrganizationId);
  const providerModelDirty =
    !!data &&
    (selectedProvider !== data.workspaceSettings.provider ||
      modelDraft.trim() !== data.workspaceSettings.model);

  useEffect(() => {
    if (!data) return;
    setSelectedProvider(data.workspaceSettings.provider);
    setModelDraft(data.workspaceSettings.model);
  }, [data]);

  useEffect(() => {
    setAgentDecisionError(null);
    setDecidingApprovalId(null);
  }, [selectedOrganizationId]);

  const scrollToModelCards = useCallback(() => {
    if (modelCardsY === null) return;
    scrollRef.current?.scrollTo({
      y: Math.max(modelCardsY - 12, 0),
      animated: effects.animationsEnabled,
    });
  }, [effects.animationsEnabled, modelCardsY]);

  useEffect(() => {
    if (route.params?.focus !== 'modelCards') return;
    scrollToModelCards();
  }, [route.params?.focus, scrollToModelCards]);

  const updateWorkspacePolicy = async (
    patch: Parameters<typeof updateSettings.mutateAsync>[0],
    successMessage = t('aiTransparency.saved'),
  ) => {
    if (!selectedOrganizationId) return;
    setError(null);
    setNotice(null);
    try {
      await updateSettings.mutateAsync(patch);
      setNotice(successMessage);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : t('aiTransparency.errorSave'));
    }
  };

  const persistOversight = async (next: AiOversightMode) => {
    await updateWorkspacePolicy({ aiOversight: next });
  };

  const toggleFeature = async (feature: AiFeatureCardDefinition, enabled: boolean) => {
    const patch = featurePatch(feature, enabled);
    if (!patch || !selectedOrganizationId) return;
    await updateWorkspacePolicy(patch);
  };

  const selectProvider = (provider: AiProvider) => {
    setSelectedProvider(provider);
    setModelDraft((current) => {
      if (data && provider === data.workspaceSettings.provider) return data.workspaceSettings.model;
      return current.trim() || DEFAULT_MODEL_BY_PROVIDER[provider] || 'custom-model';
    });
  };

  const saveProviderModel = async () => {
    const model = modelDraft.trim();
    if (!model) {
      setError(t('aiTransparency.modelRequired'));
      return;
    }
    await updateWorkspacePolicy(
      {
        modelConfigId: null,
        provider: selectedProvider,
        model,
      },
      t('aiTransparency.providerModelSaved'),
    );
  };

  const applyModelConfig = async (config: AgentModelConfig) => {
    await updateWorkspacePolicy(
      {
        modelConfigId: config.id,
      },
      t('aiTransparency.profileApplied'),
    );
  };

  const decideAgentApproval = async (
    approval: AgentApprovalRequest,
    decision: 'approve' | 'reject',
  ) => {
    setAgentDecisionError(null);
    setDecidingApprovalId(approval.id);
    try {
      if (decision === 'approve') {
        await approveAgentApproval.mutateAsync(approval.id);
      } else {
        await rejectAgentApproval.mutateAsync(approval.id);
      }
    } catch (err: unknown) {
      setAgentDecisionError(
        err instanceof Error ? err.message : t('team.agentGovernance.decisionFailed'),
      );
    } finally {
      setDecidingApprovalId(null);
    }
  };

  if (organizationsQ.isLoading) {
    return <Loading label={t('aiTransparency.loading')} />;
  }

  if (organizationsQ.isError) {
    return (
      <Screen>
        <ScreenHeader
          kicker={t('aiTransparency.kicker')}
          title={t('aiTransparency.title')}
          subtitle={t('aiTransparency.subtitle')}
        />
        <ErrorView
          message={
            organizationsQ.error instanceof Error
              ? organizationsQ.error.message
              : t('aiTransparency.errorLoad')
          }
          onRetry={() => void organizationsQ.refetch()}
        />
      </Screen>
    );
  }

  return (
    <Screen>
      <ScreenHeader
        kicker={t('aiTransparency.kicker')}
        title={t('aiTransparency.title')}
        subtitle={t('aiTransparency.subtitle')}
        meta={
          <SemanticBadge
            label={t('aiTransparency.featureCount', { count: AI_FEATURES.length })}
            tone="indigo"
          />
        }
      />

      <ScrollView ref={scrollRef} contentContainerStyle={styles.content}>
        {organizations.length === 0 ? (
          <EmptyState
            icon={ShieldCheck}
            title={t('aiTransparency.emptyTitle')}
            description={t('aiTransparency.emptyDesc')}
          />
        ) : (
          <>
            <SurfaceRow className="gap-3">
              <View style={styles.sectionTitle}>
                <IconTile icon={Sparkles} tone="indigo" />
                <View className="min-w-0 flex-1 gap-1">
                  <Text style={styles.panelTitle}>{t('aiTransparency.workspaceTitle')}</Text>
                  <Text style={styles.panelSubtitle}>{t('aiTransparency.workspaceSubtitle')}</Text>
                </View>
              </View>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.workspaceList}
              >
                {organizations.map((organization) => (
                  <WorkspacePill
                    key={organization.id}
                    organization={organization}
                    selected={selectedOrganizationId === organization.id}
                    onPress={(id) => {
                      setSelectedOrganizationId(id);
                      setNotice(null);
                      setError(null);
                    }}
                  />
                ))}
              </ScrollView>
            </SurfaceRow>

            {settingsQ.isLoading ? <Loading label={t('aiTransparency.loadingSettings')} /> : null}

            {settingsQ.isError ? (
              <ErrorView
                message={
                  settingsQ.error instanceof Error
                    ? settingsQ.error.message
                    : t('aiTransparency.errorLoad')
                }
                onRetry={() => void settingsQ.refetch()}
              />
            ) : null}

            {notice ? <Text style={styles.noticeText}>{notice}</Text> : null}
            {error ? <Text style={styles.errorText}>{error}</Text> : null}

            {data ? (
              <>
                <SurfaceRow className="gap-3">
                  <View style={styles.sectionTitle}>
                    <IconTile icon={ShieldCheck} tone="emerald" />
                    <View className="min-w-0 flex-1 gap-1">
                      <Text style={styles.panelTitle}>{t('aiTransparency.oversightTitle')}</Text>
                      <Text style={styles.panelSubtitle}>
                        {data.access.canManage
                          ? t('aiTransparency.oversightDesc')
                          : t('aiTransparency.readOnlyDesc')}
                      </Text>
                    </View>
                  </View>
                  <ToggleRow
                    title={
                      data.workspaceSettings.aiOversight === 'auto'
                        ? t('aiTransparency.oversightAutoTitle')
                        : t('aiTransparency.oversightReviewTitle')
                    }
                    description={
                      data.workspaceSettings.aiOversight === 'auto'
                        ? t('aiTransparency.oversightAutoDesc')
                        : t('aiTransparency.oversightReviewDesc')
                    }
                    enabled={data.workspaceSettings.aiOversight === 'auto'}
                    disabled={busy || !data.access.canManage}
                    onPress={() =>
                      void persistOversight(
                        data.workspaceSettings.aiOversight === 'auto' ? 'review_required' : 'auto',
                      )
                    }
                  />
                </SurfaceRow>

                <SurfaceRow className="gap-3">
                  <View style={styles.sectionTitle}>
                    <IconTile icon={Bot} tone="indigo" />
                    <View className="min-w-0 flex-1 gap-1">
                      <Text style={styles.panelTitle}>
                        {t('aiTransparency.workspacePolicyTitle')}
                      </Text>
                      <Text style={styles.panelSubtitle}>
                        {t('aiTransparency.workspacePolicyDesc')}
                      </Text>
                    </View>
                    <SemanticBadge
                      label={
                        data.workspaceSettings.enabled
                          ? t('aiTransparency.workspaceAgentsEnabled')
                          : t('aiTransparency.workspaceAgentsDisabled')
                      }
                      tone={data.workspaceSettings.enabled ? 'emerald' : 'neutral'}
                    />
                  </View>

                  <ToggleRow
                    title={t('aiTransparency.workspaceAgentsTitle')}
                    description={t('aiTransparency.workspaceAgentsDesc')}
                    enabled={data.workspaceSettings.enabled}
                    disabled={busy || !canManage}
                    onPress={() =>
                      void updateWorkspacePolicy({ enabled: !data.workspaceSettings.enabled })
                    }
                  />

                  <View style={styles.infoBlock}>
                    <Text style={styles.infoLabel}>{t('aiTransparency.executionModeTitle')}</Text>
                    <View style={styles.choiceList}>
                      {AI_EXECUTION_MODES.map((mode) => (
                        <ChoicePill
                          key={mode}
                          label={t(executionModeLabelKey(mode))}
                          value={mode}
                          selected={data.workspaceSettings.executionMode === mode}
                          disabled={busy || !canManage}
                          onPress={(nextMode) =>
                            void updateWorkspacePolicy({ executionMode: nextMode })
                          }
                        />
                      ))}
                    </View>
                  </View>

                  <View style={styles.infoBlock}>
                    <Text style={styles.infoLabel}>{t('aiTransparency.dailyRunLimitTitle')}</Text>
                    <View style={styles.choiceList}>
                      {DAILY_RUN_LIMITS.map((limit) => (
                        <ChoicePill
                          key={limit}
                          label={t('aiTransparency.dailyRunLimitValue', { count: limit })}
                          value={limit}
                          selected={data.workspaceSettings.dailyRunLimit === limit}
                          disabled={busy || !canManage}
                          onPress={(nextLimit) =>
                            void updateWorkspacePolicy({ dailyRunLimit: nextLimit })
                          }
                        />
                      ))}
                    </View>
                  </View>

                  <View style={styles.infoBlock}>
                    <Text style={styles.infoLabel}>{t('aiTransparency.writePolicyTitle')}</Text>
                    <ToggleRow
                      title={t('aiTransparency.allowWritesTitle')}
                      description={t('aiTransparency.allowWritesDesc')}
                      enabled={data.workspaceSettings.allowWriteActions}
                      disabled={busy || !canManage}
                      onPress={() =>
                        void updateWorkspacePolicy({
                          allowWriteActions: !data.workspaceSettings.allowWriteActions,
                        })
                      }
                    />
                    <ToggleRow
                      title={t('aiTransparency.requireApprovalTitle')}
                      description={t('aiTransparency.requireApprovalDesc')}
                      enabled={data.workspaceSettings.requireApprovalForWrites}
                      disabled={busy || !canManage || !data.workspaceSettings.allowWriteActions}
                      onPress={() =>
                        void updateWorkspacePolicy({
                          requireApprovalForWrites:
                            !data.workspaceSettings.requireApprovalForWrites,
                        })
                      }
                    />
                  </View>

                  <View style={styles.infoBlock}>
                    <Text style={styles.infoLabel}>{t('aiTransparency.safetyModeTitle')}</Text>
                    <View style={styles.choiceList}>
                      {AI_SAFETY_MODES.map((mode) => (
                        <ChoicePill
                          key={mode}
                          label={t(safetyModeLabelKey(mode))}
                          value={mode}
                          selected={data.workspaceSettings.aiSafetyMode === mode}
                          disabled={busy || !canManage}
                          onPress={(nextMode) =>
                            void updateWorkspacePolicy({ aiSafetyMode: nextMode })
                          }
                        />
                      ))}
                    </View>
                  </View>
                </SurfaceRow>

                {canManage ? (
                  <AiAgentGovernancePanel
                    policy={agentPolicyQ.data}
                    approvals={agentApprovalsQ.data ?? []}
                    decisionError={agentDecisionError}
                    decidingId={decidingApprovalId}
                    loadingPolicy={agentPolicyQ.isLoading}
                    loadingApprovals={agentApprovalsQ.isLoading}
                    policyError={agentPolicyQ.error}
                    approvalsError={agentApprovalsQ.error}
                    canManage={canManage}
                    onApprove={(approval) => void decideAgentApproval(approval, 'approve')}
                    onReject={(approval) => void decideAgentApproval(approval, 'reject')}
                  />
                ) : null}

                <SurfaceRow className="gap-3">
                  <View style={styles.sectionTitle}>
                    <IconTile icon={Database} tone="blue" />
                    <View className="min-w-0 flex-1 gap-1">
                      <Text style={styles.panelTitle}>
                        {t('aiTransparency.providerModelTitle')}
                      </Text>
                      <Text style={styles.panelSubtitle}>
                        {t('aiTransparency.providerModelDesc')}
                      </Text>
                    </View>
                  </View>

                  <View style={styles.choiceList}>
                    {AI_PROVIDERS.map((provider) => (
                      <ChoicePill
                        key={provider}
                        label={providerLabel(provider, t)}
                        value={provider}
                        selected={selectedProvider === provider}
                        disabled={busy || !canManage}
                        onPress={selectProvider}
                      />
                    ))}
                  </View>

                  <TextField
                    label={t('aiTransparency.modelLabel')}
                    placeholder={t('aiTransparency.modelPlaceholder')}
                    value={modelDraft}
                    autoCapitalize="none"
                    autoCorrect={false}
                    editable={canManage && !busy}
                    onChangeText={(value) => {
                      setModelDraft(value);
                      setError(null);
                    }}
                  />

                  <View style={styles.inlineActions}>
                    <Button
                      title={t('aiTransparency.resetProviderModel')}
                      variant="secondary"
                      disabled={!providerModelDirty || busy}
                      onPress={() => {
                        setSelectedProvider(data.workspaceSettings.provider);
                        setModelDraft(data.workspaceSettings.model);
                        setError(null);
                      }}
                    />
                    <Button
                      title={t('aiTransparency.saveProviderModel')}
                      icon={Check}
                      disabled={!providerModelDirty || !canManage || busy || !modelDraft.trim()}
                      loading={updateSettings.isPending}
                      onPress={() => void saveProviderModel()}
                    />
                  </View>

                  <View style={styles.infoBlock}>
                    <Text style={styles.infoLabel}>{t('aiTransparency.savedProfilesTitle')}</Text>
                    <Text style={styles.cardDescription}>
                      {t('aiTransparency.savedProfilesDesc')}
                    </Text>
                    {data.modelConfigs.length === 0 ? (
                      <Text style={styles.cardDescription}>
                        {t('aiTransparency.noSavedProfiles')}
                      </Text>
                    ) : (
                      <View style={styles.modelConfigList}>
                        {data.modelConfigs.map((config) => (
                          <ModelConfigRow
                            key={config.id}
                            config={config}
                            selected={data.workspaceSettings.modelConfigId === config.id}
                            disabled={busy || !canManage}
                            onApply={(nextConfig) => void applyModelConfig(nextConfig)}
                          />
                        ))}
                      </View>
                    )}
                  </View>
                </SurfaceRow>

                <View style={styles.metricGrid}>
                  <MetricTile
                    label={t('aiTransparency.enabledProjects')}
                    value={`${data.runtimeSummary.enabledProjectCount}/${data.runtimeSummary.projectCount}`}
                    tone={data.runtimeSummary.enabledProjectCount > 0 ? 'emerald' : 'neutral'}
                  />
                  <MetricTile
                    label={t('aiTransparency.runningRuns')}
                    value={String(data.runtimeSummary.runningRuns)}
                    tone={data.runtimeSummary.runningRuns > 0 ? 'amber' : 'neutral'}
                  />
                  <MetricTile
                    label={t('aiTransparency.totalRuns')}
                    value={String(data.runtimeSummary.totalRuns)}
                  />
                  <MetricTile
                    label={t('aiTransparency.providerStatus')}
                    value={
                      data.providerStatus.ready
                        ? t('aiTransparency.providerReady')
                        : t('aiTransparency.providerBlocked')
                    }
                    tone={data.providerStatus.ready ? 'emerald' : 'rose'}
                  />
                </View>

                {data.providerStatus.summary ? (
                  <SurfaceRow className="gap-2">
                    <View style={styles.infoLabelRow}>
                      <Bot size={16} color={colors.primary} />
                      <Text style={styles.panelTitle}>{t('aiTransparency.providerSummary')}</Text>
                    </View>
                    <Text style={styles.panelSubtitle}>{data.providerStatus.summary}</Text>
                    {updatedAt ? (
                      <Text style={styles.timestamp}>
                        {t('aiTransparency.updatedAt', { time: updatedAt })}
                      </Text>
                    ) : null}
                  </SurfaceRow>
                ) : null}

                {data.configIssues.length > 0 ? (
                  <SurfaceRow className="gap-3">
                    <View style={styles.infoLabelRow}>
                      <AlertCircle size={16} color={colors.destructive} />
                      <Text style={styles.panelTitle}>{t('aiTransparency.configIssues')}</Text>
                    </View>
                    {data.configIssues.map((issue) => (
                      <View key={`${issue.code}-${issue.title}`} style={styles.issueBox}>
                        <Text style={styles.issueTitle}>{issue.title}</Text>
                        <Text style={styles.cardDescription}>{issue.detail}</Text>
                        {issue.resolution ? (
                          <Text style={styles.cardDescription}>{issue.resolution}</Text>
                        ) : null}
                      </View>
                    ))}
                  </SurfaceRow>
                ) : null}

                <View
                  style={styles.sectionHeader}
                  onLayout={(event) => setModelCardsY(event.nativeEvent.layout.y)}
                >
                  <View className="min-w-0 flex-1 gap-1">
                    <Text style={styles.panelTitle}>{t('aiTransparency.featuresTitle')}</Text>
                    <Text style={styles.panelSubtitle}>
                      {t('aiTransparency.featuresSubtitle', {
                        userFacing: userFacingCount,
                        total: AI_FEATURES.length,
                      })}
                    </Text>
                  </View>
                  <Button
                    title={t('aiTransparency.modelCards')}
                    icon={Sparkles}
                    variant="secondary"
                    onPress={scrollToModelCards}
                  />
                </View>

                <View style={styles.featureList}>
                  {AI_FEATURES.map((feature) => (
                    <FeatureCard
                      key={feature.id}
                      data={data}
                      feature={feature}
                      disabled={busy}
                      onToggle={(item, enabled) => void toggleFeature(item, enabled)}
                    />
                  ))}
                </View>
              </>
            ) : null}
          </>
        )}
      </ScrollView>
    </Screen>
  );
}

function createAiTransparencyStyles(colors: ThemeColors) {
  return StyleSheet.create({
    content: {
      gap: 12,
      paddingHorizontal: 16,
      paddingBottom: 16,
    },
    sectionTitle: {
      minWidth: 0,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
    },
    sectionHeader: {
      minWidth: 0,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
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
    workspaceList: {
      gap: 8,
    },
    workspacePill: {
      minWidth: 140,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
      borderRadius: 4,
      backgroundColor: colors.card,
      paddingHorizontal: 10,
      paddingVertical: 8,
    },
    workspacePillActive: {
      borderColor: colors.primary,
      backgroundColor: `${colors.primary}18`,
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
      fontSize: 11,
      lineHeight: 15,
    },
    workspaceMetaActive: {
      color: colors.primary,
    },
    toggleRow: {
      minHeight: 56,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
    },
    switchTrack: {
      width: 48,
      height: 28,
      justifyContent: 'center',
      borderRadius: 14,
      backgroundColor: colors.muted,
      paddingHorizontal: 3,
    },
    switchTrackActive: {
      backgroundColor: `${colors.primary}22`,
    },
    switchThumb: {
      width: 22,
      height: 22,
      alignItems: 'center',
      justifyContent: 'center',
      borderRadius: 11,
      backgroundColor: colors.card,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
    },
    switchThumbActive: {
      transform: [{ translateX: 20 }],
      borderColor: colors.primary,
    },
    metricGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 8,
    },
    metricTile: {
      minWidth: 148,
      flex: 1,
      borderWidth: StyleSheet.hairlineWidth,
      borderRadius: 4,
      backgroundColor: colors.card,
      padding: 10,
    },
    metricValue: {
      color: colors.foreground,
      fontSize: 16,
      fontWeight: '800',
      lineHeight: 21,
    },
    metricLabel: {
      color: colors.mutedForeground,
      fontSize: 11,
      lineHeight: 15,
    },
    choiceList: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 8,
    },
    choicePill: {
      minHeight: 36,
      minWidth: 102,
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
      borderRadius: 6,
      backgroundColor: colors.card,
      paddingHorizontal: 10,
      paddingVertical: 7,
    },
    choicePillActive: {
      borderColor: colors.primary,
      backgroundColor: `${colors.primary}1A`,
    },
    choicePillText: {
      color: colors.mutedForeground,
      fontSize: 12,
      fontWeight: '700',
      lineHeight: 16,
      textAlign: 'center',
    },
    choicePillTextActive: {
      color: colors.primary,
    },
    inlineActions: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 8,
    },
    modelConfigList: {
      gap: 8,
    },
    modelConfigRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
      borderRadius: 6,
      backgroundColor: colors.surface,
      padding: 10,
    },
    modelConfigRowActive: {
      borderColor: colors.accentEmerald,
      backgroundColor: `${colors.accentEmerald}12`,
    },
    featureList: {
      gap: 10,
    },
    featureHeader: {
      minWidth: 0,
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: 10,
    },
    featureMetaGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 8,
    },
    cardTitle: {
      color: colors.foreground,
      fontSize: 14,
      fontWeight: '700',
      lineHeight: 19,
    },
    cardDescription: {
      color: colors.mutedForeground,
      fontSize: 13,
      lineHeight: 18,
    },
    infoBlock: {
      gap: 6,
    },
    infoLabelRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
    },
    infoLabel: {
      color: colors.foreground,
      fontSize: 12,
      fontWeight: '700',
      lineHeight: 16,
    },
    issueBox: {
      gap: 4,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.destructive,
      borderRadius: 4,
      backgroundColor: `${colors.destructive}10`,
      padding: 10,
    },
    issueTitle: {
      color: colors.foreground,
      fontSize: 13,
      fontWeight: '700',
      lineHeight: 18,
    },
    governanceHeader: {
      minWidth: 0,
      flexDirection: 'row',
      alignItems: 'flex-start',
      justifyContent: 'space-between',
      gap: 10,
    },
    governanceRuleRow: {
      minWidth: 0,
      flexDirection: 'row',
      alignItems: 'flex-start',
      justifyContent: 'space-between',
      gap: 10,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
      borderRadius: 6,
      backgroundColor: colors.surface,
      padding: 10,
    },
    governanceDangerBox: {
      gap: 8,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: `${colors.destructive}66`,
      borderRadius: 6,
      backgroundColor: `${colors.destructive}10`,
      padding: 10,
    },
    governanceApprovalRow: {
      gap: 9,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
      borderRadius: 6,
      backgroundColor: colors.surface,
      padding: 10,
    },
    governanceMetaRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 6,
    },
    governanceCodeText: {
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
      borderRadius: 4,
      backgroundColor: colors.muted,
      color: colors.foreground,
      fontFamily: 'monospace',
      fontSize: 11,
      lineHeight: 16,
      paddingHorizontal: 8,
      paddingVertical: 6,
    },
    governancePayloadText: {
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
      borderRadius: 4,
      backgroundColor: colors.background,
      color: colors.foreground,
      fontFamily: 'monospace',
      fontSize: 11,
      lineHeight: 16,
      padding: 8,
    },
    governanceDecisionRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 8,
    },
    governanceDecisionButton: {
      minWidth: 128,
      flex: 1,
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
    timestamp: {
      color: colors.mutedForeground,
      fontSize: 11,
      lineHeight: 15,
    },
    disabled: {
      opacity: 0.5,
    },
  });
}
