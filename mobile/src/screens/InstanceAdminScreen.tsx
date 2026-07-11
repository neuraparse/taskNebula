import { useCallback, useEffect, useMemo, useRef, useState, type ComponentRef } from 'react';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from '@/components/native';
import {
  Activity,
  Check,
  Flag,
  Gauge,
  Percent,
  Radio,
  RefreshCw,
  Rocket,
  ScrollText,
  ShieldAlert,
  UserPlus,
  Wifi,
} from 'lucide-react-native';
import { useTranslation } from 'react-i18next';

import {
  Button,
  EmptyState,
  IconTile,
  Loading,
  Screen,
  ScreenHeader,
  SemanticBadge,
  SurfaceRow,
  TextField,
} from '@/components/ui';
import type {
  AdminAgentProviderBreakdownItem,
  AdminAgentRecentRun,
  AdminAgentWorkspaceCoverage,
  AdminAiUsageOrganization,
  AdminFeatureFlag,
  AdminOrganizationPlan,
  AdminOrganizationStatus,
  AdminOrganizationSummary,
  AdminSystemTestResult,
  AdminUserStatus,
  AdminUserSummary,
  RegistrationMode,
  SystemAuditLogEntry,
} from '@/api/types';
import {
  useAdminAgentControl,
  useAdminAiUsage,
  useAdminFeatureFlags,
  useAdminLivekitConfig,
  useAdminOrganizations,
  useAdminRealtimeHealth,
  useAdminSmtpConfig,
  useAdminStats,
  useAdminStorageConfig,
  useAdminUsers,
  useAdminVersionStatus,
  useMe,
  useRefreshAdminVersionStatus,
  useResetAdminAiUsageCounters,
  useRegistrationPolicy,
  useSystemAuditLogs,
  useTestAdminLivekitConfig,
  useTestAdminSmtpConfig,
  useUpdateAdminAgentControl,
  useUpdateAdminAiKillSwitch,
  useUpdateAdminFeatureFlag,
  useUpdateAdminLivekitConfig,
  useUpdateAdminOrganization,
  useUpdateAdminSmtpConfig,
  useUpdateAdminStorageConfig,
  useUpdateAdminUser,
  useUpdateRegistrationPolicy,
} from '@/hooks/queries';
import type { ThemeColors } from '@/design/theme';
import { useThemeColors, useThemeEffects } from '@/design/theme-context';
import { agentRunKindLabel, auditActionLabel } from '@/lib/audit-actions';
import { relativeTime } from '@/lib/format';
import type { AppStackParamList, InstanceAdminSection } from '@/navigation/types';

type InstanceAdminProps = NativeStackScreenProps<AppStackParamList, 'InstanceAdmin'>;
import { useSession } from '@/stores/session';

const REGISTRATION_MODES: RegistrationMode[] = [
  'allow_registration',
  'invite_only',
  'admin_created_only',
];
const ROLLOUT_STEPS = [0, 25, 50, 100] as const;
const AI_USAGE_WINDOW_DAYS = 7;
const ADMIN_DIRECTORY_LIMIT = 8;
const ADMIN_ORGANIZATION_PLANS: AdminOrganizationPlan[] = [
  'free',
  'starter',
  'growth',
  'enterprise',
];
const AGENT_CONCURRENCY_STEPS = [1, 2, 4, 6, 10, 20, 50] as const;

type Tone = 'blue' | 'violet' | 'cyan' | 'emerald' | 'amber' | 'rose' | 'indigo' | 'neutral';
type Translate = ReturnType<typeof useTranslation>['t'];
type InstanceAdminStyles = ReturnType<typeof createInstanceAdminStyles>;

type SmtpDraft = {
  host: string;
  port: string;
  secure: boolean;
  user: string;
  password: string;
  emailFrom: string;
  testRecipient: string;
};

type StorageDraft = {
  uploadsDir: string;
  s3Bucket: string;
  s3Region: string;
  s3AccessKey: string;
  s3SecretKey: string;
};

type LivekitDraft = {
  url: string;
  apiKey: string;
  apiSecret: string;
};

const EMPTY_SMTP_DRAFT: SmtpDraft = {
  host: '',
  port: '25',
  secure: false,
  user: '',
  password: '',
  emailFrom: '',
  testRecipient: '',
};

const EMPTY_STORAGE_DRAFT: StorageDraft = {
  uploadsDir: '',
  s3Bucket: '',
  s3Region: '',
  s3AccessKey: '',
  s3SecretKey: '',
};

const EMPTY_LIVEKIT_DRAFT: LivekitDraft = {
  url: '',
  apiKey: '',
  apiSecret: '',
};

function errorMessage(error: unknown, fallback: string): string {
  return error instanceof Error ? error.message : fallback;
}

function useInstanceAdminTheme(): { colors: ThemeColors; styles: InstanceAdminStyles } {
  const colors = useThemeColors();
  const styles = useMemo(() => createInstanceAdminStyles(colors), [colors]);
  return { colors, styles };
}

function toneColor(colors: ThemeColors, tone: Tone): string {
  if (tone === 'blue') return colors.accentBlue;
  if (tone === 'violet') return colors.accentViolet;
  if (tone === 'cyan') return colors.accentCyan;
  if (tone === 'emerald') return colors.accentEmerald;
  if (tone === 'amber') return colors.accentAmber;
  if (tone === 'rose') return colors.accentRose;
  if (tone === 'indigo') return colors.accentIndigo;
  return colors.mutedForeground;
}

function compactId(value?: string | null): string {
  if (!value) return '';
  return value.length > 18 ? `${value.slice(0, 8)}...${value.slice(-6)}` : value;
}

function registrationModeLabelKey(mode: RegistrationMode): string {
  if (mode === 'invite_only') return 'admin.registration.mode.invite';
  if (mode === 'admin_created_only') return 'admin.registration.mode.admin';
  return 'admin.registration.mode.allow';
}

function registrationModeDescriptionKey(mode: RegistrationMode): string {
  if (mode === 'invite_only') return 'admin.registration.mode.inviteDesc';
  if (mode === 'admin_created_only') return 'admin.registration.mode.adminDesc';
  return 'admin.registration.mode.allowDesc';
}

function statusTone(active: boolean): Tone {
  return active ? 'emerald' : 'neutral';
}

function organizationStatusTone(status: AdminOrganizationStatus): Tone {
  if (status === 'active') return 'emerald';
  if (status === 'trial') return 'amber';
  if (status === 'suspended') return 'rose';
  return 'neutral';
}

function userStatusTone(status: AdminUserStatus): Tone {
  if (status === 'active') return 'emerald';
  if (status === 'invited') return 'amber';
  if (status === 'inactive') return 'rose';
  return 'neutral';
}

function organizationStatusLabelKey(status: AdminOrganizationStatus): string {
  if (status === 'active') return 'admin.directory.status.active';
  if (status === 'trial') return 'admin.directory.status.trial';
  if (status === 'suspended') return 'admin.directory.status.suspended';
  return 'admin.directory.status.unknown';
}

function userStatusLabelKey(status: AdminUserStatus): string {
  if (status === 'active') return 'admin.directory.status.active';
  if (status === 'inactive') return 'admin.directory.status.inactive';
  if (status === 'invited') return 'admin.directory.status.invited';
  return 'admin.directory.status.unknown';
}

function organizationPlanLabelKey(plan: AdminOrganizationPlan): string {
  if (plan === 'free') return 'admin.directory.plan.free';
  if (plan === 'starter') return 'admin.directory.plan.starter';
  if (plan === 'growth') return 'admin.directory.plan.growth';
  if (plan === 'enterprise') return 'admin.directory.plan.enterprise';
  return 'admin.directory.plan.unknown';
}

function configuredTone(configured: boolean): Tone {
  return configured ? 'emerald' : 'amber';
}

function configuredLabel(t: Translate, configured: boolean): string {
  return configured ? t('admin.system.configured') : t('admin.system.notConfigured');
}

function systemTestLabel(t: Translate, result?: AdminSystemTestResult): string | null {
  if (!result) return null;
  if (!result.success) {
    return result.error
      ? t('admin.system.testFailedWithError', { error: result.error })
      : t('admin.system.testFailed');
  }
  if (result.recipient) return t('admin.system.smtpTestSent', { recipient: result.recipient });
  if (result.roomName) return t('admin.system.livekitTestReady', { room: result.roomName });
  return t('admin.system.testSucceeded');
}

function systemTestTone(result?: AdminSystemTestResult): Tone {
  if (!result) return 'neutral';
  return result.success ? 'emerald' : 'rose';
}

function agentStateTone(state?: string | null): Tone {
  if (state === 'ready' || state === 'completed' || state === 'success') return 'emerald';
  if (state === 'blocked' || state === 'failed' || state === 'error') return 'rose';
  if (state === 'running' || state === 'pending' || state === 'preview') return 'amber';
  if (state === 'disabled' || state === 'cancelled') return 'neutral';
  return 'blue';
}

function agentStateLabelKey(state?: string | null): string {
  if (state === 'ready') return 'admin.agent.state.ready';
  if (state === 'blocked') return 'admin.agent.state.blocked';
  if (state === 'disabled') return 'admin.agent.state.disabled';
  if (state === 'preview') return 'admin.agent.state.preview';
  if (state === 'running') return 'admin.agent.state.running';
  if (state === 'failed') return 'admin.agent.state.failed';
  if (state === 'completed' || state === 'success') return 'admin.agent.state.completed';
  if (state === 'pending') return 'admin.agent.state.pending';
  if (state === 'cancelled') return 'admin.agent.state.cancelled';
  return 'admin.agent.state.unknown';
}

function agentServiceLabelKey(key: string): string | null {
  if (key === 'control-plane') return 'admin.agent.service.controlPlane';
  if (key === 'live-monitoring') return 'admin.agent.service.liveMonitoring';
  if (key === 'write-pipeline') return 'admin.agent.service.writePipeline';
  if (key === 'provider-coverage') return 'admin.agent.service.providerCoverage';
  return null;
}

function limitPercent(used: number, limit: number | null): number | null {
  if (limit === null || limit <= 0) return null;
  return Math.round((used / limit) * 100);
}

function usageLimitText(
  used: number,
  limit: number | null,
  formatter: Intl.NumberFormat,
  t: Translate,
): string {
  if (limit === null) {
    return t('admin.aiUsage.unlimitedUsage', { used: formatter.format(used) });
  }

  return t('admin.aiUsage.usageOfLimit', {
    used: formatter.format(used),
    limit: formatter.format(limit),
    percent: limitPercent(used, limit) ?? 0,
  });
}

function costLimitText(
  used: number,
  limit: number | null,
  formatter: Intl.NumberFormat,
  t: Translate,
): string {
  if (limit === null) {
    return t('admin.aiUsage.unlimitedUsage', { used: formatter.format(used) });
  }

  return t('admin.aiUsage.usageOfLimit', {
    used: formatter.format(used),
    limit: formatter.format(limit),
    percent: limitPercent(used, limit) ?? 0,
  });
}

function MetricCard({ label, value, tone }: { label: string; value: string; tone: Tone }) {
  const { styles } = useInstanceAdminTheme();

  return (
    <View style={styles.metricCard}>
      <SemanticBadge label={label} tone={tone} />
      <Text style={styles.metricValue} numberOfLines={1}>
        {value}
      </Text>
    </View>
  );
}

function PolicyOption({
  mode,
  selected,
  disabled,
  onPress,
}: {
  mode: RegistrationMode;
  selected: boolean;
  disabled: boolean;
  onPress: () => void;
}) {
  const { t } = useTranslation();
  const { colors, styles } = useInstanceAdminTheme();

  return (
    <Pressable
      accessibilityRole="radio"
      accessibilityState={{ selected, disabled }}
      disabled={disabled}
      onPress={onPress}
      style={[
        styles.policyOption,
        selected ? styles.policyOptionActive : null,
        disabled ? styles.disabled : null,
      ]}
      className="active:opacity-80"
    >
      <View style={styles.policyTitleRow}>
        <View className="min-w-0 flex-1 gap-1">
          <Text className="text-foreground text-sm font-semibold" numberOfLines={2}>
            {t(registrationModeLabelKey(mode))}
          </Text>
          <Text className="text-muted-foreground text-xs" numberOfLines={3}>
            {t(registrationModeDescriptionKey(mode))}
          </Text>
        </View>
        <View style={[styles.policyCheck, selected ? styles.policyCheckActive : null]}>
          {selected ? <Check size={14} color={colors.primaryForeground} /> : null}
        </View>
      </View>
    </Pressable>
  );
}

function VersionLine({ label, value }: { label: string; value: string }) {
  const { styles } = useInstanceAdminTheme();

  return (
    <View style={styles.versionLine}>
      <Text style={styles.versionLabel}>{label}</Text>
      <Text style={styles.versionValue} numberOfLines={2}>
        {value}
      </Text>
    </View>
  );
}

function DirectoryPill({
  label,
  tone,
  selected = false,
  disabled,
  onPress,
}: {
  label: string;
  tone: Tone;
  selected?: boolean;
  disabled?: boolean;
  onPress?: (() => void) | undefined;
}) {
  const { colors, styles } = useInstanceAdminTheme();

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected, disabled }}
      disabled={disabled || !onPress}
      onPress={onPress}
      style={[
        styles.directoryPill,
        selected
          ? {
              borderColor: toneColor(colors, tone),
              backgroundColor: `${toneColor(colors, tone)}16`,
            }
          : null,
        disabled ? styles.disabled : null,
      ]}
      className="active:opacity-80"
    >
      <Text
        style={[styles.directoryPillText, selected ? { color: toneColor(colors, tone) } : null]}
        numberOfLines={1}
      >
        {label}
      </Text>
    </Pressable>
  );
}

function RolloutPill({
  value,
  selected,
  disabled,
  onPress,
}: {
  value: number;
  selected: boolean;
  disabled: boolean;
  onPress: () => void;
}) {
  const { t } = useTranslation();
  const { styles } = useInstanceAdminTheme();

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected, disabled }}
      disabled={disabled}
      onPress={onPress}
      style={[
        styles.rolloutPill,
        selected ? styles.rolloutPillActive : null,
        disabled ? styles.disabled : null,
      ]}
      className="active:opacity-80"
    >
      <Text style={[styles.rolloutPillText, selected ? styles.rolloutPillTextActive : null]}>
        {t('admin.flags.rolloutShort', { value })}
      </Text>
    </Pressable>
  );
}

function FeatureFlagRow({
  flag,
  disabled,
  onToggle,
  onRollout,
}: {
  flag: AdminFeatureFlag;
  disabled: boolean;
  onToggle: (flag: AdminFeatureFlag, next: boolean) => void;
  onRollout: (flag: AdminFeatureFlag, next: number) => void;
}) {
  const { t } = useTranslation();
  const { colors, styles } = useInstanceAdminTheme();
  const metadataCount = Object.keys(flag.metadata).length;

  return (
    <View style={styles.flagRow}>
      <View className="flex-row items-start gap-3">
        <IconTile icon={Flag} tone={flag.isEnabled ? 'emerald' : 'neutral'} />
        <View className="min-w-0 flex-1 gap-2">
          <View style={styles.flagTitleRow}>
            <View className="min-w-0 flex-1 gap-1">
              <Text className="text-foreground text-sm font-semibold" numberOfLines={2}>
                {flag.name}
              </Text>
              <Text className="text-muted-foreground text-xs" numberOfLines={1}>
                {flag.key}
              </Text>
            </View>
            <Pressable
              accessibilityRole="switch"
              accessibilityState={{ checked: flag.isEnabled, disabled }}
              disabled={disabled}
              onPress={() => onToggle(flag, !flag.isEnabled)}
              style={[
                styles.flagSwitch,
                flag.isEnabled ? styles.flagSwitchActive : null,
                disabled ? styles.disabled : null,
              ]}
              className="active:opacity-80"
            >
              <Text
                style={[styles.flagSwitchText, flag.isEnabled ? styles.flagSwitchTextActive : null]}
              >
                {flag.isEnabled ? t('admin.flags.enabled') : t('admin.flags.disabled')}
              </Text>
            </Pressable>
          </View>

          {flag.description ? (
            <Text className="text-muted-foreground text-xs" numberOfLines={3}>
              {flag.description}
            </Text>
          ) : null}

          <View style={styles.flagMetaRow}>
            <SemanticBadge
              label={t('admin.flags.rolloutValue', { value: flag.rolloutPercentage })}
              tone={flag.rolloutPercentage > 0 ? 'blue' : 'neutral'}
            />
            {flag.enabledForPlans.length > 0 ? (
              <SemanticBadge
                label={t('admin.flags.planCount', { count: flag.enabledForPlans.length })}
                tone="violet"
              />
            ) : null}
            {flag.enabledForOrganizations.length > 0 ? (
              <SemanticBadge
                label={t('admin.flags.organizationCount', {
                  count: flag.enabledForOrganizations.length,
                })}
                tone="cyan"
              />
            ) : null}
            {metadataCount > 0 ? (
              <SemanticBadge
                label={t('admin.flags.metadataCount', { count: metadataCount })}
                tone="neutral"
              />
            ) : null}
          </View>

          <View style={styles.rolloutHeader}>
            <Percent size={14} color={colors.mutedForeground} />
            <Text className="text-muted-foreground text-xs font-semibold">
              {t('admin.flags.quickRollout')}
            </Text>
          </View>
          <View style={styles.rolloutList}>
            {ROLLOUT_STEPS.map((value) => (
              <RolloutPill
                key={value}
                value={value}
                selected={flag.rolloutPercentage === value}
                disabled={disabled}
                onPress={() => onRollout(flag, value)}
              />
            ))}
          </View>
        </View>
      </View>
    </View>
  );
}

function AdminOrganizationCard({
  organization,
  disabled,
  formatter,
  onSetStatus,
  onSetPlan,
}: {
  organization: AdminOrganizationSummary;
  disabled: boolean;
  formatter: Intl.NumberFormat;
  onSetStatus: (organization: AdminOrganizationSummary, status: AdminOrganizationStatus) => void;
  onSetPlan: (organization: AdminOrganizationSummary, plan: AdminOrganizationPlan) => void;
}) {
  const { t } = useTranslation();
  const { styles } = useInstanceAdminTheme();
  const nextStatus: AdminOrganizationStatus =
    organization.status === 'suspended' ? 'active' : 'suspended';

  return (
    <View style={styles.directoryCard}>
      <View style={styles.directoryHeader}>
        <View className="min-w-0 flex-1 gap-1">
          <Text className="text-foreground text-sm font-semibold" numberOfLines={2}>
            {organization.name}
          </Text>
          <Text className="text-muted-foreground text-xs" numberOfLines={1}>
            {organization.slug}
          </Text>
        </View>
        <View className="items-end gap-1">
          <SemanticBadge
            label={t(organizationStatusLabelKey(organization.status))}
            tone={organizationStatusTone(organization.status)}
          />
          <SemanticBadge label={t(organizationPlanLabelKey(organization.plan))} tone="blue" />
        </View>
      </View>

      <View style={styles.directoryMetaRow}>
        <SemanticBadge
          label={t('admin.directory.memberCount', {
            count: formatter.format(organization.stats.members),
          })}
          tone="cyan"
        />
        <SemanticBadge
          label={t('admin.directory.projectCount', {
            count: formatter.format(organization.stats.projects),
          })}
          tone="violet"
        />
        <SemanticBadge
          label={t('admin.directory.issueCount', {
            count: formatter.format(organization.stats.issues),
          })}
          tone="amber"
        />
      </View>

      <Text className="text-muted-foreground text-xs" numberOfLines={1}>
        {organization.owner
          ? t('admin.directory.ownerLine', {
              owner: organization.owner.name || organization.owner.email,
            })
          : t('admin.directory.noOwner')}
      </Text>

      <View style={styles.directoryPillRow}>
        {ADMIN_ORGANIZATION_PLANS.map((plan) => (
          <DirectoryPill
            key={plan}
            label={t(organizationPlanLabelKey(plan))}
            tone={plan === 'enterprise' ? 'indigo' : 'blue'}
            selected={organization.plan === plan}
            disabled={disabled}
            onPress={organization.plan === plan ? undefined : () => onSetPlan(organization, plan)}
          />
        ))}
      </View>

      <View style={styles.directoryActionRow}>
        <Button
          title={
            organization.status === 'suspended'
              ? t('admin.directory.activateOrg')
              : t('admin.directory.suspendOrg')
          }
          variant={organization.status === 'suspended' ? 'secondary' : 'destructive'}
          icon={ShieldAlert}
          disabled={disabled}
          onPress={() => onSetStatus(organization, nextStatus)}
        />
      </View>
    </View>
  );
}

function AdminUserCard({
  user,
  disabled,
  formatter,
  onSetStatus,
  onSetSuperAdmin,
}: {
  user: AdminUserSummary;
  disabled: boolean;
  formatter: Intl.NumberFormat;
  onSetStatus: (user: AdminUserSummary, status: AdminUserStatus) => void;
  onSetSuperAdmin: (user: AdminUserSummary, enabled: boolean) => void;
}) {
  const { t } = useTranslation();
  const { styles } = useInstanceAdminTheme();
  const actor = user.name || user.email;
  const nextStatus: AdminUserStatus = user.status === 'inactive' ? 'active' : 'inactive';

  return (
    <View style={styles.directoryCard}>
      <View style={styles.directoryHeader}>
        <View className="min-w-0 flex-1 gap-1">
          <Text className="text-foreground text-sm font-semibold" numberOfLines={2}>
            {actor}
          </Text>
          <Text className="text-muted-foreground text-xs" numberOfLines={1}>
            {user.email}
          </Text>
        </View>
        <View className="items-end gap-1">
          <SemanticBadge
            label={t(userStatusLabelKey(user.status))}
            tone={userStatusTone(user.status)}
          />
          <SemanticBadge
            label={
              user.isSuperAdmin
                ? t('admin.directory.superAdmin')
                : t('admin.directory.standardUser')
            }
            tone={user.isSuperAdmin ? 'indigo' : 'neutral'}
          />
        </View>
      </View>

      <View style={styles.directoryMetaRow}>
        <SemanticBadge
          label={t('admin.directory.organizationCount', {
            count: formatter.format(user.organizations.length),
          })}
          tone="cyan"
        />
        <SemanticBadge
          label={t('admin.directory.projectCount', {
            count: formatter.format(user.projectMemberships.length),
          })}
          tone="violet"
        />
      </View>

      <Text className="text-muted-foreground text-xs" numberOfLines={1}>
        {user.organizations.length > 0
          ? user.organizations
              .slice(0, 2)
              .map((membership) => `${membership.organizationName} / ${membership.role}`)
              .join(', ')
          : t('admin.directory.noMemberships')}
      </Text>
      <Text className="text-muted-foreground text-xs" numberOfLines={1}>
        {user.lastSeenAt
          ? t('admin.directory.lastSeen', { time: relativeTime(user.lastSeenAt) })
          : t('admin.directory.created', {
              time: user.createdAt ? relativeTime(user.createdAt) : t('common.none'),
            })}
      </Text>

      <View style={styles.directoryActionRow}>
        <View style={styles.directoryActionButton}>
          <Button
            title={
              user.status === 'inactive'
                ? t('admin.directory.activateUser')
                : t('admin.directory.deactivateUser')
            }
            variant={user.status === 'inactive' ? 'secondary' : 'destructive'}
            icon={UserPlus}
            disabled={disabled}
            onPress={() => onSetStatus(user, nextStatus)}
          />
        </View>
        <View style={styles.directoryActionButton}>
          <Button
            title={
              user.isSuperAdmin
                ? t('admin.directory.revokeSuperAdmin')
                : t('admin.directory.grantSuperAdmin')
            }
            variant={user.isSuperAdmin ? 'destructive' : 'secondary'}
            icon={ShieldAlert}
            disabled={disabled}
            onPress={() => onSetSuperAdmin(user, !user.isSuperAdmin)}
          />
        </View>
      </View>
    </View>
  );
}

function RealtimeServiceCard({
  name,
  metric,
  detail,
  tone,
}: {
  name: string;
  metric: string;
  detail: string;
  tone: Tone;
}) {
  const { colors, styles } = useInstanceAdminTheme();

  return (
    <View style={[styles.serviceCard, tone === 'rose' ? styles.serviceCardDanger : null]}>
      <View style={styles.serviceTitleRow}>
        <View style={styles.serviceNameRow}>
          <View style={[styles.statusDot, { backgroundColor: toneColor(colors, tone) }]} />
          <Text className="text-foreground text-sm font-semibold" numberOfLines={1}>
            {name}
          </Text>
        </View>
        <SemanticBadge label={metric} tone={tone} />
      </View>
      <View style={styles.serviceDetailRow}>
        <Wifi size={14} color={colors.mutedForeground} />
        <Text className="text-muted-foreground text-xs" numberOfLines={2}>
          {detail}
        </Text>
      </View>
    </View>
  );
}

function AiUsageOrgCard({
  organization,
  disabled,
  numberFormatter,
  currencyFormatter,
  onToggle,
  onResetDaily,
}: {
  organization: AdminAiUsageOrganization;
  disabled: boolean;
  numberFormatter: Intl.NumberFormat;
  currencyFormatter: Intl.NumberFormat;
  onToggle: (organization: AdminAiUsageOrganization, enabled: boolean) => void;
  onResetDaily: (organization: AdminAiUsageOrganization) => void;
}) {
  const { t } = useTranslation();
  const { styles } = useInstanceAdminTheme();
  const killSwitchTone: Tone = organization.killSwitchEnabled ? 'rose' : 'emerald';
  const history = organization.history.slice(-AI_USAGE_WINDOW_DAYS);
  const maxHistoryCost = Math.max(...history.map((entry) => entry.cost), 0);

  return (
    <View
      style={[styles.aiOrgCard, organization.killSwitchEnabled ? styles.aiOrgCardDanger : null]}
    >
      <View style={styles.aiOrgHeader}>
        <View className="min-w-0 flex-1 gap-1">
          <Text className="text-foreground text-sm font-semibold" numberOfLines={2}>
            {organization.organizationName}
          </Text>
          <Text className="text-muted-foreground text-xs" numberOfLines={1}>
            {compactId(organization.organizationId)}
          </Text>
        </View>
        <SemanticBadge
          label={
            organization.killSwitchEnabled
              ? t('admin.aiUsage.killSwitchOn')
              : t('admin.aiUsage.killSwitchOff')
          }
          tone={killSwitchTone}
        />
      </View>

      <View style={styles.metricGrid}>
        <MetricCard
          label={t('admin.aiUsage.callsToday')}
          value={numberFormatter.format(organization.actualUsage.callsToday)}
          tone="blue"
        />
        <MetricCard
          label={t('admin.aiUsage.tokensMonth')}
          value={numberFormatter.format(organization.actualUsage.tokensMonth)}
          tone="violet"
        />
        <MetricCard
          label={t('admin.aiUsage.costMonth')}
          value={currencyFormatter.format(organization.actualUsage.costMonthUsd)}
          tone="amber"
        />
        <MetricCard
          label={t('admin.aiUsage.rejectedMonth')}
          value={numberFormatter.format(organization.actualUsage.budgetExhaustedMonth)}
          tone={organization.actualUsage.budgetExhaustedMonth > 0 ? 'rose' : 'neutral'}
        />
      </View>

      <View style={styles.aiLimitPanel}>
        <VersionLine
          label={t('admin.aiUsage.dailyTokens')}
          value={usageLimitText(
            organization.actualUsage.tokensToday,
            organization.limits.dailyTokens,
            numberFormatter,
            t,
          )}
        />
        <VersionLine
          label={t('admin.aiUsage.monthlyTokens')}
          value={usageLimitText(
            organization.actualUsage.tokensMonth,
            organization.limits.monthlyTokens,
            numberFormatter,
            t,
          )}
        />
        <VersionLine
          label={t('admin.aiUsage.dailyCost')}
          value={costLimitText(
            organization.actualUsage.costTodayUsd,
            organization.limits.dailyCostUsd,
            currencyFormatter,
            t,
          )}
        />
        <VersionLine
          label={t('admin.aiUsage.monthlyCost')}
          value={costLimitText(
            organization.actualUsage.costMonthUsd,
            organization.limits.monthlyCostUsd,
            currencyFormatter,
            t,
          )}
        />
        <VersionLine
          label={t('admin.aiUsage.reservedMonthly')}
          value={t('admin.aiUsage.reservedLine', {
            tokens: numberFormatter.format(organization.reservedUsage.monthlyTokens),
            cost: currencyFormatter.format(organization.reservedUsage.monthlyCostUsd),
          })}
        />
        <VersionLine
          label={t('admin.aiUsage.nextReset')}
          value={
            organization.periodResetsAt
              ? relativeTime(organization.periodResetsAt)
              : t('common.none')
          }
        />
      </View>

      {history.length > 0 ? (
        <View style={styles.aiHistoryPanel}>
          <Text className="text-muted-foreground text-xs font-semibold">
            {t('admin.aiUsage.spendHistory')}
          </Text>
          <View style={styles.aiHistoryBars}>
            {history.map((entry) => {
              const height =
                maxHistoryCost > 0 ? Math.max(4, (entry.cost / maxHistoryCost) * 42) : 4;
              return (
                <View key={entry.day} style={styles.aiHistoryBarTrack}>
                  <View style={[styles.aiHistoryBar, { height }]} />
                </View>
              );
            })}
          </View>
        </View>
      ) : null}

      <View style={styles.aiFeaturePanel}>
        <Text className="text-muted-foreground text-xs font-semibold">
          {t('admin.aiUsage.topFeatures')}
        </Text>
        {organization.featureBreakdown.length === 0 ? (
          <Text className="text-muted-foreground text-xs">{t('admin.aiUsage.noFeatureUsage')}</Text>
        ) : null}
        {organization.featureBreakdown.slice(0, 3).map((feature, index) => (
          <View key={`${feature.feature || 'unknown'}-${index}`} style={styles.aiFeatureRow}>
            <Text className="text-foreground text-xs font-semibold" numberOfLines={1}>
              {feature.feature || t('admin.aiUsage.unknownFeature')}
            </Text>
            <Text className="text-muted-foreground text-xs" numberOfLines={1}>
              {t('admin.aiUsage.featureLine', {
                calls: numberFormatter.format(feature.calls),
                cost: currencyFormatter.format(feature.cost),
              })}
            </Text>
          </View>
        ))}
      </View>

      <View style={styles.aiActionRow}>
        <View style={styles.aiActionButton}>
          <Button
            title={
              organization.killSwitchEnabled
                ? t('admin.aiUsage.resumeAi')
                : t('admin.aiUsage.pauseAi')
            }
            variant={organization.killSwitchEnabled ? 'secondary' : 'destructive'}
            icon={ShieldAlert}
            disabled={disabled}
            onPress={() => onToggle(organization, !organization.killSwitchEnabled)}
          />
        </View>
        <View style={styles.aiActionButton}>
          <Button
            title={t('admin.aiUsage.resetDaily')}
            variant="secondary"
            icon={RefreshCw}
            disabled={disabled}
            onPress={() => onResetDaily(organization)}
          />
        </View>
      </View>
    </View>
  );
}

function AgentPolicySwitch({
  title,
  description,
  checked,
  disabled,
  onPress,
}: {
  title: string;
  description: string;
  checked: boolean;
  disabled: boolean;
  onPress: () => void;
}) {
  const { t } = useTranslation();
  const { styles } = useInstanceAdminTheme();

  return (
    <Pressable
      accessibilityRole="switch"
      accessibilityState={{ checked, disabled }}
      disabled={disabled}
      onPress={onPress}
      style={[
        styles.agentPolicyCard,
        checked ? styles.agentPolicyCardActive : null,
        disabled ? styles.disabled : null,
      ]}
      className="active:opacity-80"
    >
      <View className="min-w-0 flex-1 gap-1">
        <Text className="text-foreground text-sm font-semibold" numberOfLines={2}>
          {title}
        </Text>
        <Text className="text-muted-foreground text-xs" numberOfLines={3}>
          {description}
        </Text>
      </View>
      <SemanticBadge
        label={checked ? t('admin.agent.enabled') : t('admin.agent.disabled')}
        tone={checked ? 'emerald' : 'neutral'}
      />
    </Pressable>
  );
}

function AgentProviderBreakdownCard({
  item,
  formatter,
}: {
  item: AdminAgentProviderBreakdownItem;
  formatter: Intl.NumberFormat;
}) {
  const { t } = useTranslation();
  const { styles } = useInstanceAdminTheme();

  return (
    <View style={styles.agentCompactCard}>
      <View style={styles.agentCardHeader}>
        <Text className="text-foreground text-sm font-semibold" numberOfLines={1}>
          {item.provider}
        </Text>
        <SemanticBadge
          label={t('admin.agent.providerReadyBadge', {
            ready: formatter.format(item.ready),
            total: formatter.format(item.enabled),
          })}
          tone={item.blocked > 0 ? 'rose' : item.ready > 0 ? 'emerald' : 'neutral'}
        />
      </View>
      <View style={styles.flagMetaRow}>
        <SemanticBadge
          label={t('admin.agent.providerTotal', { count: formatter.format(item.total) })}
          tone="blue"
        />
        <SemanticBadge
          label={t('admin.agent.providerEnabled', { count: formatter.format(item.enabled) })}
          tone="violet"
        />
        <SemanticBadge
          label={t('admin.agent.providerBlocked', { count: formatter.format(item.blocked) })}
          tone={item.blocked > 0 ? 'rose' : 'neutral'}
        />
      </View>
    </View>
  );
}

function AgentWorkspaceCard({
  workspace,
  formatter,
}: {
  workspace: AdminAgentWorkspaceCoverage;
  formatter: Intl.NumberFormat;
}) {
  const { t } = useTranslation();
  const { styles } = useInstanceAdminTheme();
  const providerDetail = workspace.selectedModelConfigName
    ? workspace.selectedModelConfigName
    : [workspace.provider, workspace.model].filter(Boolean).join(' / ');
  const statusDetail =
    workspace.providerStatus.summary ||
    (workspace.providerStatus.ready
      ? t('admin.agent.providerReady')
      : t('admin.agent.providerBlocked'));

  return (
    <View
      style={[
        styles.agentWorkspaceCard,
        !workspace.providerStatus.ready ? styles.serviceCardDanger : null,
      ]}
    >
      <View style={styles.agentCardHeader}>
        <View className="min-w-0 flex-1 gap-1">
          <Text className="text-foreground text-sm font-semibold" numberOfLines={2}>
            {workspace.organizationName}
          </Text>
          <Text className="text-muted-foreground text-xs" numberOfLines={1}>
            {providerDetail || t('common.none')}
          </Text>
        </View>
        <View className="items-end gap-1">
          <SemanticBadge
            label={
              workspace.workspaceEnabled ? t('admin.agent.enabled') : t('admin.agent.disabled')
            }
            tone={workspace.workspaceEnabled ? 'emerald' : 'neutral'}
          />
          <SemanticBadge
            label={
              workspace.providerStatus.ready
                ? t('admin.agent.providerReady')
                : t('admin.agent.providerBlocked')
            }
            tone={workspace.providerStatus.ready ? 'emerald' : 'rose'}
          />
        </View>
      </View>

      <VersionLine
        label={t('admin.agent.enabledProjects')}
        value={formatter.format(workspace.enabledProjects)}
      />
      <VersionLine label={t('admin.agent.executionMode')} value={workspace.executionMode} />
      <VersionLine label={t('admin.agent.providerStatus')} value={statusDetail} />
      <VersionLine
        label={t('admin.agent.lastRun')}
        value={workspace.lastRunAt ? relativeTime(workspace.lastRunAt) : t('common.none')}
      />
      {workspace.lastFailure ? (
        <Text className="text-destructive text-xs" numberOfLines={3}>
          {t('admin.agent.lastFailure', { error: workspace.lastFailure })}
        </Text>
      ) : null}
    </View>
  );
}

function AgentRunCard({
  run,
  formatter,
}: {
  run: AdminAgentRecentRun;
  formatter: Intl.NumberFormat;
}) {
  const { t } = useTranslation();
  const { styles } = useInstanceAdminTheme();
  const scope = [run.organizationName, run.projectName].filter(Boolean).join(' / ');
  const actor = run.initiatedBy || t('admin.agent.systemActor');

  return (
    <View
      style={[styles.agentCompactCard, run.status === 'failed' ? styles.serviceCardDanger : null]}
    >
      <View style={styles.agentCardHeader}>
        <View className="min-w-0 flex-1 gap-1">
          <Text className="text-foreground text-sm font-semibold" numberOfLines={1}>
            {agentRunKindLabel(run.kind, t)}
          </Text>
          <Text className="text-muted-foreground text-xs" numberOfLines={1}>
            {scope || t('admin.agent.systemScope')}
          </Text>
        </View>
        <View className="items-end gap-1">
          <SemanticBadge
            label={t(agentStateLabelKey(run.status))}
            tone={agentStateTone(run.status)}
          />
          <SemanticBadge
            label={run.dryRun ? t('admin.agent.dryRun') : t('admin.agent.liveRun')}
            tone={run.dryRun ? 'neutral' : 'amber'}
          />
        </View>
      </View>
      {run.summary ? (
        <Text className="text-muted-foreground text-xs" numberOfLines={3}>
          {run.summary}
        </Text>
      ) : null}
      <View style={styles.flagMetaRow}>
        <SemanticBadge
          label={t('admin.agent.writeActions', {
            count: formatter.format(run.writeActionsCount),
          })}
          tone={run.writeActionsCount > 0 ? 'amber' : 'neutral'}
        />
        <SemanticBadge
          label={run.createdAt ? relativeTime(run.createdAt) : t('common.none')}
          tone="neutral"
        />
        <SemanticBadge label={t('admin.agent.initiatedBy', { actor })} tone="blue" />
      </View>
      {run.error ? (
        <Text className="text-destructive text-xs" numberOfLines={3}>
          {run.error}
        </Text>
      ) : null}
    </View>
  );
}

function AuditRow({ log }: { log: SystemAuditLogEntry }) {
  const { t } = useTranslation();
  const { styles } = useInstanceAdminTheme();
  const actor = log.user?.name || log.user?.email || t('admin.audit.unknownUser');
  const when = relativeTime(log.createdAt);
  const resource = [log.resourceType, compactId(log.resourceId)].filter(Boolean).join(' / ');

  return (
    <View style={styles.auditRow}>
      <View className="flex-row items-start gap-3">
        <IconTile icon={ScrollText} tone="indigo" />
        <View className="min-w-0 flex-1 gap-1">
          <View style={styles.auditTitleRow}>
            <Text className="text-foreground text-sm font-semibold" numberOfLines={2}>
              {auditActionLabel(log.action)}
            </Text>
            <SemanticBadge label={log.resourceType} tone="neutral" />
          </View>
          <Text className="text-muted-foreground text-xs" numberOfLines={1}>
            {t('developer.audit.actorLine', { actor })}
          </Text>
          {when ? (
            <Text className="text-muted-foreground text-xs" numberOfLines={1}>
              {t('developer.audit.timeLine', { time: when })}
            </Text>
          ) : null}
          {resource ? (
            <Text className="text-muted-foreground text-xs" numberOfLines={1}>
              {resource}
            </Text>
          ) : null}
        </View>
      </View>
    </View>
  );
}

export function InstanceAdminScreen({ route }: InstanceAdminProps) {
  const { t, i18n } = useTranslation();
  const { colors, styles } = useInstanceAdminTheme();
  const effects = useThemeEffects();
  const routeSection = route.params?.section;
  const scrollRef = useRef<ComponentRef<typeof ScrollView>>(null);
  const sectionOffsetsRef = useRef<Partial<Record<InstanceAdminSection, number>>>({});
  const pendingSectionRef = useRef<InstanceAdminSection | null>(routeSection ?? null);
  const sessionUser = useSession((s) => s.user);
  const meQ = useMe();
  const user = meQ.data ?? sessionUser;
  const isSuperAdmin = user?.isSuperAdmin === true;
  const formatter = useMemo(() => new Intl.NumberFormat(i18n.language), [i18n.language]);
  const currencyFormatter = useMemo(
    () =>
      new Intl.NumberFormat(i18n.language, {
        style: 'currency',
        currency: 'USD',
        maximumFractionDigits: 2,
      }),
    [i18n.language],
  );
  const [smtpDraft, setSmtpDraft] = useState<SmtpDraft>(EMPTY_SMTP_DRAFT);
  const [storageDraft, setStorageDraft] = useState<StorageDraft>(EMPTY_STORAGE_DRAFT);
  const [livekitDraft, setLivekitDraft] = useState<LivekitDraft>(EMPTY_LIVEKIT_DRAFT);

  const statsQ = useAdminStats(isSuperAdmin);
  const organizationsQ = useAdminOrganizations(isSuperAdmin, ADMIN_DIRECTORY_LIMIT);
  const usersQ = useAdminUsers(isSuperAdmin, ADMIN_DIRECTORY_LIMIT);
  const updateOrganization = useUpdateAdminOrganization(ADMIN_DIRECTORY_LIMIT);
  const updateUser = useUpdateAdminUser(ADMIN_DIRECTORY_LIMIT);
  const smtpQ = useAdminSmtpConfig(isSuperAdmin);
  const updateSmtp = useUpdateAdminSmtpConfig();
  const testSmtp = useTestAdminSmtpConfig();
  const storageQ = useAdminStorageConfig(isSuperAdmin);
  const updateStorage = useUpdateAdminStorageConfig();
  const livekitConfigQ = useAdminLivekitConfig(isSuperAdmin);
  const updateLivekit = useUpdateAdminLivekitConfig();
  const testLivekit = useTestAdminLivekitConfig();
  const realtimeQ = useAdminRealtimeHealth(isSuperAdmin);
  const aiUsageQ = useAdminAiUsage(isSuperAdmin, AI_USAGE_WINDOW_DAYS);
  const updateAiKillSwitch = useUpdateAdminAiKillSwitch();
  const resetAiUsageCounters = useResetAdminAiUsageCounters();
  const agentControlQ = useAdminAgentControl(isSuperAdmin);
  const updateAgentControl = useUpdateAdminAgentControl();
  const registrationQ = useRegistrationPolicy(isSuperAdmin);
  const updateRegistration = useUpdateRegistrationPolicy();
  const featureFlagsQ = useAdminFeatureFlags(isSuperAdmin);
  const updateFeatureFlag = useUpdateAdminFeatureFlag();
  const versionQ = useAdminVersionStatus(isSuperAdmin);
  const refreshVersion = useRefreshAdminVersionStatus();
  const auditQ = useSystemAuditLogs(isSuperAdmin);

  const refreshing =
    statsQ.isRefetching ||
    organizationsQ.isRefetching ||
    usersQ.isRefetching ||
    smtpQ.isRefetching ||
    storageQ.isRefetching ||
    livekitConfigQ.isRefetching ||
    realtimeQ.isRefetching ||
    aiUsageQ.isRefetching ||
    agentControlQ.isRefetching ||
    registrationQ.isRefetching ||
    featureFlagsQ.isRefetching ||
    versionQ.isRefetching ||
    auditQ.isRefetching;

  const scrollToAdminSection = useCallback(
    (section: InstanceAdminSection) => {
      if (section === 'overview') {
        scrollRef.current?.scrollTo({ y: 0, animated: effects.animationsEnabled });
        pendingSectionRef.current = null;
        return;
      }

      const offset = sectionOffsetsRef.current[section];
      if (offset === undefined) {
        pendingSectionRef.current = section;
        return;
      }

      scrollRef.current?.scrollTo({
        y: Math.max(offset - 12, 0),
        animated: effects.animationsEnabled,
      });
      pendingSectionRef.current = null;
    },
    [effects.animationsEnabled],
  );

  const handleAdminSectionLayout = useCallback(
    (section: InstanceAdminSection, y: number) => {
      sectionOffsetsRef.current[section] = y;
      if (pendingSectionRef.current === section) {
        requestAnimationFrame(() => scrollToAdminSection(section));
      }
    },
    [scrollToAdminSection],
  );

  const refresh = () => {
    void Promise.all([
      statsQ.refetch(),
      organizationsQ.refetch(),
      usersQ.refetch(),
      smtpQ.refetch(),
      storageQ.refetch(),
      livekitConfigQ.refetch(),
      realtimeQ.refetch(),
      aiUsageQ.refetch(),
      agentControlQ.refetch(),
      registrationQ.refetch(),
      featureFlagsQ.refetch(),
      versionQ.refetch(),
      auditQ.refetch(),
    ]);
  };

  useEffect(() => {
    if (!smtpQ.data) return;
    setSmtpDraft({
      host: smtpQ.data.host,
      port: String(smtpQ.data.port || 25),
      secure: smtpQ.data.secure,
      user: smtpQ.data.user,
      password: '',
      emailFrom: smtpQ.data.emailFrom,
      testRecipient: '',
    });
  }, [smtpQ.data]);

  useEffect(() => {
    if (!storageQ.data) return;
    setStorageDraft({
      uploadsDir: storageQ.data.uploadsDir,
      s3Bucket: storageQ.data.s3Bucket,
      s3Region: storageQ.data.s3Region,
      s3AccessKey: storageQ.data.s3AccessKey,
      s3SecretKey: '',
    });
  }, [storageQ.data]);

  useEffect(() => {
    if (!livekitConfigQ.data) return;
    setLivekitDraft({
      url: livekitConfigQ.data.url,
      apiKey: livekitConfigQ.data.apiKey,
      apiSecret: '',
    });
  }, [livekitConfigQ.data]);

  useEffect(() => {
    if (routeSection) {
      pendingSectionRef.current = routeSection;
      requestAnimationFrame(() => scrollToAdminSection(routeSection));
    }
  }, [routeSection, scrollToAdminSection]);

  if (meQ.isLoading && !isSuperAdmin) {
    return <Loading label={t('admin.loading')} />;
  }

  if (!isSuperAdmin) {
    return (
      <Screen>
        <ScreenHeader
          kicker={t('admin.kicker')}
          title={t('admin.title')}
          subtitle={t('admin.subtitle')}
        />
        <EmptyState
          icon={ShieldAlert}
          title={t('admin.accessDeniedTitle')}
          description={t('admin.accessDeniedDesc')}
        />
      </Screen>
    );
  }

  const stats = statsQ.data;
  const organizations = organizationsQ.data;
  const adminUsers = usersQ.data;
  const smtp = smtpQ.data;
  const storage = storageQ.data;
  const livekitConfig = livekitConfigQ.data;
  const realtime = realtimeQ.data;
  const aiUsage = aiUsageQ.data;
  const aiUsageTotals = aiUsage?.organizations.reduce(
    (total, organization) => ({
      callsToday: total.callsToday + organization.actualUsage.callsToday,
      tokensMonth: total.tokensMonth + organization.actualUsage.tokensMonth,
      costMonthUsd: total.costMonthUsd + organization.actualUsage.costMonthUsd,
      killSwitches: total.killSwitches + (organization.killSwitchEnabled ? 1 : 0),
    }),
    { callsToday: 0, tokensMonth: 0, costMonthUsd: 0, killSwitches: 0 },
  );
  const agentControl = agentControlQ.data;
  const currentAgentConcurrency = agentControl?.settings.maxConcurrentRuns ?? 6;
  const agentConcurrencyOptions = Array.from(
    new Set([...AGENT_CONCURRENCY_STEPS, currentAgentConcurrency]),
  ).sort((left, right) => left - right);
  const registration = registrationQ.data;
  const version = refreshVersion.data ?? versionQ.data;
  const versionStatusLabel = version?.checkDisabled
    ? t('admin.version.statusChecksDisabled')
    : version?.updateAvailable
      ? t('admin.version.statusUpdateAvailable')
      : version
        ? t('admin.version.statusUpToDate')
        : t('admin.version.statusUnknown');
  const versionTone = version?.checkDisabled
    ? 'amber'
    : statusTone(Boolean(version?.updateAvailable));
  const selfUpdate = version?.selfUpdate;
  const mutateFlag = (
    flag: AdminFeatureFlag,
    patch: { isEnabled?: boolean; rolloutPercentage?: number },
  ) => {
    updateFeatureFlag.mutate({ id: flag.id, ...patch });
  };
  const setOrganizationStatus = (
    organization: AdminOrganizationSummary,
    status: AdminOrganizationStatus,
  ) => {
    updateOrganization.mutate({ id: organization.id, status });
  };
  const setOrganizationPlan = (
    organization: AdminOrganizationSummary,
    plan: AdminOrganizationPlan,
  ) => {
    updateOrganization.mutate({ id: organization.id, plan });
  };
  const setUserStatus = (targetUser: AdminUserSummary, status: AdminUserStatus) => {
    updateUser.mutate({ id: targetUser.id, status });
  };
  const setUserSuperAdmin = (targetUser: AdminUserSummary, enabled: boolean) => {
    updateUser.mutate({ id: targetUser.id, isSuperAdmin: enabled });
  };
  const saveSmtpConfig = () => {
    const password = smtpDraft.password.trim();
    updateSmtp.mutate({
      host: smtpDraft.host.trim(),
      port: Number.parseInt(smtpDraft.port, 10) || 25,
      secure: smtpDraft.secure,
      user: smtpDraft.user.trim(),
      emailFrom: smtpDraft.emailFrom.trim(),
      ...(password ? { password } : {}),
    });
  };
  const sendSmtpTest = () => {
    const to = smtpDraft.testRecipient.trim();
    testSmtp.mutate(to ? { to } : {});
  };
  const saveStorageConfig = () => {
    const s3SecretKey = storageDraft.s3SecretKey.trim();
    updateStorage.mutate({
      uploadsDir: storageDraft.uploadsDir.trim(),
      s3Bucket: storageDraft.s3Bucket.trim(),
      s3Region: storageDraft.s3Region.trim(),
      s3AccessKey: storageDraft.s3AccessKey.trim(),
      ...(s3SecretKey ? { s3SecretKey } : {}),
    });
  };
  const saveLivekitConfig = () => {
    const apiSecret = livekitDraft.apiSecret.trim();
    updateLivekit.mutate({
      url: livekitDraft.url.trim(),
      apiKey: livekitDraft.apiKey.trim(),
      ...(apiSecret ? { apiSecret } : {}),
    });
  };
  const toggleAiKillSwitch = (organization: AdminAiUsageOrganization, enabled: boolean) => {
    updateAiKillSwitch.mutate({
      organizationId: organization.organizationId,
      enabled,
      reason: t('admin.aiUsage.mobileReason'),
    });
  };
  const resetDailyAiCounters = (organization: AdminAiUsageOrganization) => {
    resetAiUsageCounters.mutate({ organizationId: organization.organizationId, scope: 'daily' });
  };
  const patchAgentControl = (patch: {
    globalEnabled?: boolean;
    allowWriteActions?: boolean;
    requireSupervisionForAutoMode?: boolean;
    maxConcurrentRuns?: number;
  }) => {
    updateAgentControl.mutate(patch);
  };

  return (
    <Screen>
      <ScreenHeader
        kicker={t('admin.kicker')}
        title={t('admin.title')}
        subtitle={t('admin.subtitle')}
        meta={<SemanticBadge label={t('admin.badgeSuperAdmin')} tone="indigo" />}
      />

      <ScrollView
        ref={scrollRef}
        className="flex-1"
        contentContainerClassName="gap-3 px-4 pb-4"
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={refresh}
            tintColor={colors.primary}
            colors={[colors.primary]}
          />
        }
      >
        <SurfaceRow
          className="gap-3"
          onLayout={(event) => handleAdminSectionLayout('overview', event.nativeEvent.layout.y)}
        >
          <View className="flex-row items-start gap-3">
            <IconTile icon={Gauge} tone="blue" />
            <View className="min-w-0 flex-1 gap-1">
              <Text className="text-muted-foreground text-xs font-medium">
                {t('admin.overview.title')}
              </Text>
              <Text className="text-foreground text-base font-semibold">
                {t('admin.overview.subtitle')}
              </Text>
            </View>
          </View>

          {statsQ.isLoading ? (
            <Text className="text-muted-foreground text-sm">{t('common.loading')}</Text>
          ) : null}
          {statsQ.isError ? (
            <Text className="text-destructive text-sm">
              {errorMessage(statsQ.error, t('errors.unexpectedServerResponse'))}
            </Text>
          ) : null}
          {stats ? (
            <>
              <View style={styles.metricGrid}>
                <MetricCard
                  label={t('admin.overview.organizations')}
                  value={formatter.format(stats.overview.totalOrganizations)}
                  tone="blue"
                />
                <MetricCard
                  label={t('admin.overview.users')}
                  value={formatter.format(stats.overview.totalUsers)}
                  tone="cyan"
                />
                <MetricCard
                  label={t('admin.overview.projects')}
                  value={formatter.format(stats.overview.totalProjects)}
                  tone="violet"
                />
                <MetricCard
                  label={t('admin.overview.issues')}
                  value={formatter.format(stats.overview.totalIssues)}
                  tone="amber"
                />
              </View>
              <View style={styles.metricGrid}>
                <MetricCard
                  label={t('admin.overview.activeUsers')}
                  value={formatter.format(stats.overview.activeUsers)}
                  tone="emerald"
                />
                <MetricCard
                  label={t('admin.overview.superAdmins')}
                  value={formatter.format(stats.overview.superAdmins)}
                  tone="indigo"
                />
                <MetricCard
                  label={t('admin.overview.comments')}
                  value={formatter.format(stats.overview.totalComments)}
                  tone="neutral"
                />
                <MetricCard
                  label={t('admin.overview.newOrganizations')}
                  value={formatter.format(stats.growth.newOrganizations30d)}
                  tone="emerald"
                />
                <MetricCard
                  label={t('admin.overview.newUsers')}
                  value={formatter.format(stats.growth.newUsers30d)}
                  tone="cyan"
                />
              </View>
            </>
          ) : null}
        </SurfaceRow>

        <SurfaceRow
          className="gap-3"
          onLayout={(event) => handleAdminSectionLayout('directory', event.nativeEvent.layout.y)}
        >
          <View className="flex-row items-start gap-3">
            <IconTile icon={UserPlus} tone="cyan" />
            <View className="min-w-0 flex-1 gap-1">
              <Text className="text-muted-foreground text-xs font-medium">
                {t('admin.directory.title')}
              </Text>
              <View style={styles.sectionTitleRow}>
                <Text className="text-foreground text-base font-semibold">
                  {t('admin.directory.subtitle')}
                </Text>
                {organizations ? (
                  <SemanticBadge
                    label={t('admin.directory.shownOfTotal', {
                      shown: formatter.format(organizations.organizations.length),
                      total: formatter.format(organizations.pagination.total),
                    })}
                    tone="neutral"
                  />
                ) : null}
              </View>
            </View>
          </View>

          {organizationsQ.isLoading || usersQ.isLoading ? (
            <Text className="text-muted-foreground text-sm">{t('admin.directory.loading')}</Text>
          ) : null}
          {organizationsQ.isError ? (
            <Text className="text-destructive text-sm">
              {errorMessage(organizationsQ.error, t('admin.directory.loadFailed'))}
            </Text>
          ) : null}
          {usersQ.isError ? (
            <Text className="text-destructive text-sm">
              {errorMessage(usersQ.error, t('admin.directory.loadFailed'))}
            </Text>
          ) : null}
          {updateOrganization.isError ? (
            <Text className="text-destructive text-sm">
              {errorMessage(updateOrganization.error, t('admin.directory.updateFailed'))}
            </Text>
          ) : null}
          {updateUser.isError ? (
            <Text className="text-destructive text-sm">
              {errorMessage(updateUser.error, t('admin.directory.updateFailed'))}
            </Text>
          ) : null}

          {organizations || adminUsers ? (
            <View style={styles.metricGrid}>
              <MetricCard
                label={t('admin.directory.organizations')}
                value={formatter.format(organizations?.pagination.total ?? 0)}
                tone="blue"
              />
              <MetricCard
                label={t('admin.directory.users')}
                value={formatter.format(adminUsers?.pagination.total ?? 0)}
                tone="cyan"
              />
              <MetricCard
                label={t('admin.directory.superAdmins')}
                value={formatter.format(
                  adminUsers?.users.filter((directoryUser) => directoryUser.isSuperAdmin).length ??
                    0,
                )}
                tone="indigo"
              />
              <MetricCard
                label={t('admin.directory.suspendedOrgs')}
                value={formatter.format(
                  organizations?.organizations.filter(
                    (organization) => organization.status === 'suspended',
                  ).length ?? 0,
                )}
                tone="rose"
              />
            </View>
          ) : null}

          <View style={styles.directorySection}>
            <View style={styles.directorySectionHeader}>
              <Text className="text-foreground text-sm font-semibold">
                {t('admin.directory.organizations')}
              </Text>
              {organizations ? (
                <SemanticBadge
                  label={t('admin.directory.limitBadge', { count: ADMIN_DIRECTORY_LIMIT })}
                  tone="neutral"
                />
              ) : null}
            </View>
            {organizations?.organizations.length === 0 ? (
              <View style={styles.inlineNotice}>
                <Text className="text-foreground text-sm font-semibold">
                  {t('admin.directory.emptyOrganizationsTitle')}
                </Text>
                <Text className="text-muted-foreground text-sm">
                  {t('admin.directory.emptyOrganizationsDesc')}
                </Text>
              </View>
            ) : null}
            <View style={styles.directoryList}>
              {organizations?.organizations.map((organization) => (
                <AdminOrganizationCard
                  key={organization.id}
                  organization={organization}
                  disabled={updateOrganization.isPending}
                  formatter={formatter}
                  onSetStatus={setOrganizationStatus}
                  onSetPlan={setOrganizationPlan}
                />
              ))}
            </View>
          </View>

          <View style={styles.directorySection}>
            <View style={styles.directorySectionHeader}>
              <Text className="text-foreground text-sm font-semibold">
                {t('admin.directory.users')}
              </Text>
              {adminUsers ? (
                <SemanticBadge
                  label={t('admin.directory.limitBadge', { count: ADMIN_DIRECTORY_LIMIT })}
                  tone="neutral"
                />
              ) : null}
            </View>
            {adminUsers?.users.length === 0 ? (
              <View style={styles.inlineNotice}>
                <Text className="text-foreground text-sm font-semibold">
                  {t('admin.directory.emptyUsersTitle')}
                </Text>
                <Text className="text-muted-foreground text-sm">
                  {t('admin.directory.emptyUsersDesc')}
                </Text>
              </View>
            ) : null}
            <View style={styles.directoryList}>
              {adminUsers?.users.map((directoryUser) => (
                <AdminUserCard
                  key={directoryUser.id}
                  user={directoryUser}
                  disabled={updateUser.isPending}
                  formatter={formatter}
                  onSetStatus={setUserStatus}
                  onSetSuperAdmin={setUserSuperAdmin}
                />
              ))}
            </View>
          </View>
        </SurfaceRow>

        <SurfaceRow
          className="gap-3"
          onLayout={(event) => handleAdminSectionLayout('system', event.nativeEvent.layout.y)}
        >
          <View className="flex-row items-start gap-3">
            <IconTile icon={ShieldAlert} tone="amber" />
            <View className="min-w-0 flex-1 gap-1">
              <Text className="text-muted-foreground text-xs font-medium">
                {t('admin.system.title')}
              </Text>
              <Text className="text-foreground text-base font-semibold">
                {t('admin.system.subtitle')}
              </Text>
            </View>
          </View>

          {smtpQ.isLoading || storageQ.isLoading || livekitConfigQ.isLoading ? (
            <Text className="text-muted-foreground text-sm">{t('admin.system.loading')}</Text>
          ) : null}
          {smtpQ.isError ? (
            <Text className="text-destructive text-sm">
              {errorMessage(smtpQ.error, t('admin.system.loadFailed'))}
            </Text>
          ) : null}
          {storageQ.isError ? (
            <Text className="text-destructive text-sm">
              {errorMessage(storageQ.error, t('admin.system.loadFailed'))}
            </Text>
          ) : null}
          {livekitConfigQ.isError ? (
            <Text className="text-destructive text-sm">
              {errorMessage(livekitConfigQ.error, t('admin.system.loadFailed'))}
            </Text>
          ) : null}

          <View style={styles.systemGrid}>
            <View style={styles.systemCard}>
              <View style={styles.systemHeader}>
                <View className="min-w-0 flex-1 gap-1">
                  <Text className="text-foreground text-sm font-semibold">
                    {t('admin.system.smtpTitle')}
                  </Text>
                  <Text className="text-muted-foreground text-xs" numberOfLines={2}>
                    {t('admin.system.smtpSubtitle')}
                  </Text>
                </View>
                <SemanticBadge
                  label={configuredLabel(t, smtp?.configured === true)}
                  tone={configuredTone(smtp?.configured === true)}
                />
              </View>
              <View style={styles.systemMetaRow}>
                <SemanticBadge
                  label={smtp?.secure ? t('admin.system.secureOn') : t('admin.system.secureOff')}
                  tone={smtp?.secure ? 'emerald' : 'neutral'}
                />
                {smtp?.passwordPreview ? (
                  <SemanticBadge
                    label={t('admin.system.secretPreview', { preview: smtp.passwordPreview })}
                    tone="neutral"
                  />
                ) : null}
              </View>
              <VersionLine
                label={t('admin.system.updated')}
                value={smtp?.updatedAt ? relativeTime(smtp.updatedAt) : t('common.none')}
              />
              <View style={styles.systemForm}>
                <TextField
                  label={t('admin.system.smtpHost')}
                  value={smtpDraft.host}
                  placeholder={t('admin.system.smtpHostPlaceholder')}
                  autoCapitalize="none"
                  onChangeText={(host) => setSmtpDraft((current) => ({ ...current, host }))}
                />
                <View style={styles.systemTwoColumn}>
                  <View style={styles.systemColumn}>
                    <TextField
                      label={t('admin.system.smtpPort')}
                      value={smtpDraft.port}
                      placeholder={t('admin.system.smtpPortPlaceholder')}
                      keyboardType="number-pad"
                      onChangeText={(port) => setSmtpDraft((current) => ({ ...current, port }))}
                    />
                  </View>
                  <View style={styles.systemColumn}>
                    <Text className="text-foreground text-sm font-medium">
                      {t('admin.system.smtpSecure')}
                    </Text>
                    <DirectoryPill
                      label={
                        smtpDraft.secure ? t('admin.system.secureOn') : t('admin.system.secureOff')
                      }
                      tone={smtpDraft.secure ? 'emerald' : 'neutral'}
                      selected={smtpDraft.secure}
                      disabled={updateSmtp.isPending}
                      onPress={() =>
                        setSmtpDraft((current) => ({ ...current, secure: !current.secure }))
                      }
                    />
                  </View>
                </View>
                <TextField
                  label={t('admin.system.smtpUser')}
                  value={smtpDraft.user}
                  placeholder={t('admin.system.smtpUserPlaceholder')}
                  autoCapitalize="none"
                  onChangeText={(userValue) =>
                    setSmtpDraft((current) => ({ ...current, user: userValue }))
                  }
                />
                <TextField
                  label={t('admin.system.smtpPassword')}
                  value={smtpDraft.password}
                  placeholder={t('admin.system.secretPlaceholder')}
                  secureTextEntry
                  onChangeText={(password) => setSmtpDraft((current) => ({ ...current, password }))}
                />
                <TextField
                  label={t('admin.system.emailFrom')}
                  value={smtpDraft.emailFrom}
                  placeholder={t('admin.system.emailFromPlaceholder')}
                  autoCapitalize="none"
                  keyboardType="email-address"
                  onChangeText={(emailFrom) =>
                    setSmtpDraft((current) => ({ ...current, emailFrom }))
                  }
                />
                <TextField
                  label={t('admin.system.testRecipient')}
                  value={smtpDraft.testRecipient}
                  placeholder={t('admin.system.testRecipientPlaceholder')}
                  autoCapitalize="none"
                  keyboardType="email-address"
                  onChangeText={(testRecipient) =>
                    setSmtpDraft((current) => ({ ...current, testRecipient }))
                  }
                />
              </View>
              {updateSmtp.isError ? (
                <Text className="text-destructive text-sm">
                  {errorMessage(updateSmtp.error, t('admin.system.saveFailed'))}
                </Text>
              ) : null}
              {testSmtp.isError ? (
                <Text className="text-destructive text-sm">
                  {errorMessage(testSmtp.error, t('admin.system.testFailed'))}
                </Text>
              ) : null}
              {systemTestLabel(t, testSmtp.data) ? (
                <SemanticBadge
                  label={systemTestLabel(t, testSmtp.data) ?? ''}
                  tone={systemTestTone(testSmtp.data)}
                />
              ) : null}
              <View style={styles.systemActionRow}>
                <View style={styles.systemActionButton}>
                  <Button
                    title={
                      updateSmtp.isPending ? t('admin.system.saving') : t('admin.system.saveSmtp')
                    }
                    variant="secondary"
                    icon={Check}
                    loading={updateSmtp.isPending}
                    onPress={saveSmtpConfig}
                  />
                </View>
                <View style={styles.systemActionButton}>
                  <Button
                    title={
                      testSmtp.isPending ? t('admin.system.testing') : t('admin.system.testSmtp')
                    }
                    variant="secondary"
                    icon={RefreshCw}
                    loading={testSmtp.isPending}
                    onPress={sendSmtpTest}
                  />
                </View>
              </View>
            </View>

            <View style={styles.systemCard}>
              <View style={styles.systemHeader}>
                <View className="min-w-0 flex-1 gap-1">
                  <Text className="text-foreground text-sm font-semibold">
                    {t('admin.system.storageTitle')}
                  </Text>
                  <Text className="text-muted-foreground text-xs" numberOfLines={2}>
                    {t('admin.system.storageSubtitle')}
                  </Text>
                </View>
                <SemanticBadge
                  label={configuredLabel(t, storage?.configured === true)}
                  tone={configuredTone(storage?.configured === true)}
                />
              </View>
              <View style={styles.systemMetaRow}>
                {storage?.s3SecretKeyPreview ? (
                  <SemanticBadge
                    label={t('admin.system.secretPreview', {
                      preview: storage.s3SecretKeyPreview,
                    })}
                    tone="neutral"
                  />
                ) : null}
              </View>
              <VersionLine
                label={t('admin.system.updated')}
                value={storage?.updatedAt ? relativeTime(storage.updatedAt) : t('common.none')}
              />
              <View style={styles.systemForm}>
                <TextField
                  label={t('admin.system.uploadsDir')}
                  value={storageDraft.uploadsDir}
                  placeholder={t('admin.system.uploadsDirPlaceholder')}
                  autoCapitalize="none"
                  onChangeText={(uploadsDir) =>
                    setStorageDraft((current) => ({ ...current, uploadsDir }))
                  }
                />
                <TextField
                  label={t('admin.system.s3Bucket')}
                  value={storageDraft.s3Bucket}
                  placeholder={t('admin.system.s3BucketPlaceholder')}
                  autoCapitalize="none"
                  onChangeText={(s3Bucket) =>
                    setStorageDraft((current) => ({ ...current, s3Bucket }))
                  }
                />
                <TextField
                  label={t('admin.system.s3Region')}
                  value={storageDraft.s3Region}
                  placeholder={t('admin.system.s3RegionPlaceholder')}
                  autoCapitalize="none"
                  onChangeText={(s3Region) =>
                    setStorageDraft((current) => ({ ...current, s3Region }))
                  }
                />
                <TextField
                  label={t('admin.system.s3AccessKey')}
                  value={storageDraft.s3AccessKey}
                  placeholder={t('admin.system.s3AccessKeyPlaceholder')}
                  autoCapitalize="none"
                  onChangeText={(s3AccessKey) =>
                    setStorageDraft((current) => ({ ...current, s3AccessKey }))
                  }
                />
                <TextField
                  label={t('admin.system.s3SecretKey')}
                  value={storageDraft.s3SecretKey}
                  placeholder={t('admin.system.secretPlaceholder')}
                  secureTextEntry
                  onChangeText={(s3SecretKey) =>
                    setStorageDraft((current) => ({ ...current, s3SecretKey }))
                  }
                />
              </View>
              {updateStorage.isError ? (
                <Text className="text-destructive text-sm">
                  {errorMessage(updateStorage.error, t('admin.system.saveFailed'))}
                </Text>
              ) : null}
              <Button
                title={
                  updateStorage.isPending ? t('admin.system.saving') : t('admin.system.saveStorage')
                }
                variant="secondary"
                icon={Check}
                loading={updateStorage.isPending}
                onPress={saveStorageConfig}
              />
            </View>

            <View style={styles.systemCard}>
              <View style={styles.systemHeader}>
                <View className="min-w-0 flex-1 gap-1">
                  <Text className="text-foreground text-sm font-semibold">
                    {t('admin.system.livekitTitle')}
                  </Text>
                  <Text className="text-muted-foreground text-xs" numberOfLines={2}>
                    {t('admin.system.livekitSubtitle')}
                  </Text>
                </View>
                <SemanticBadge
                  label={configuredLabel(t, livekitConfig?.configured === true)}
                  tone={configuredTone(livekitConfig?.configured === true)}
                />
              </View>
              <View style={styles.systemMetaRow}>
                {livekitConfig?.apiSecretPreview ? (
                  <SemanticBadge
                    label={t('admin.system.secretPreview', {
                      preview: livekitConfig.apiSecretPreview,
                    })}
                    tone="neutral"
                  />
                ) : null}
              </View>
              <VersionLine
                label={t('admin.system.updated')}
                value={
                  livekitConfig?.updatedAt
                    ? relativeTime(livekitConfig.updatedAt)
                    : t('common.none')
                }
              />
              <View style={styles.systemForm}>
                <TextField
                  label={t('admin.system.livekitUrl')}
                  value={livekitDraft.url}
                  placeholder={t('admin.system.livekitUrlPlaceholder')}
                  autoCapitalize="none"
                  onChangeText={(url) => setLivekitDraft((current) => ({ ...current, url }))}
                />
                <TextField
                  label={t('admin.system.livekitApiKey')}
                  value={livekitDraft.apiKey}
                  placeholder={t('admin.system.livekitApiKeyPlaceholder')}
                  autoCapitalize="none"
                  onChangeText={(apiKey) => setLivekitDraft((current) => ({ ...current, apiKey }))}
                />
                <TextField
                  label={t('admin.system.livekitApiSecret')}
                  value={livekitDraft.apiSecret}
                  placeholder={t('admin.system.secretPlaceholder')}
                  secureTextEntry
                  onChangeText={(apiSecret) =>
                    setLivekitDraft((current) => ({ ...current, apiSecret }))
                  }
                />
              </View>
              {updateLivekit.isError ? (
                <Text className="text-destructive text-sm">
                  {errorMessage(updateLivekit.error, t('admin.system.saveFailed'))}
                </Text>
              ) : null}
              {testLivekit.isError ? (
                <Text className="text-destructive text-sm">
                  {errorMessage(testLivekit.error, t('admin.system.testFailed'))}
                </Text>
              ) : null}
              {systemTestLabel(t, testLivekit.data) ? (
                <SemanticBadge
                  label={systemTestLabel(t, testLivekit.data) ?? ''}
                  tone={systemTestTone(testLivekit.data)}
                />
              ) : null}
              <View style={styles.systemActionRow}>
                <View style={styles.systemActionButton}>
                  <Button
                    title={
                      updateLivekit.isPending
                        ? t('admin.system.saving')
                        : t('admin.system.saveLivekit')
                    }
                    variant="secondary"
                    icon={Check}
                    loading={updateLivekit.isPending}
                    onPress={saveLivekitConfig}
                  />
                </View>
                <View style={styles.systemActionButton}>
                  <Button
                    title={
                      testLivekit.isPending
                        ? t('admin.system.testing')
                        : t('admin.system.testLivekit')
                    }
                    variant="secondary"
                    icon={RefreshCw}
                    loading={testLivekit.isPending}
                    onPress={() => testLivekit.mutate()}
                  />
                </View>
              </View>
            </View>
          </View>
        </SurfaceRow>

        <SurfaceRow
          className="gap-3"
          onLayout={(event) => handleAdminSectionLayout('realtime', event.nativeEvent.layout.y)}
        >
          <View className="flex-row items-start gap-3">
            <IconTile icon={Radio} tone="cyan" />
            <View className="min-w-0 flex-1 gap-1">
              <Text className="text-muted-foreground text-xs font-medium">
                {t('admin.realtime.title')}
              </Text>
              <Text className="text-foreground text-base font-semibold">
                {t('admin.realtime.subtitle')}
              </Text>
            </View>
          </View>

          {realtimeQ.isLoading ? (
            <Text className="text-muted-foreground text-sm">{t('admin.realtime.loading')}</Text>
          ) : null}
          {realtimeQ.isError ? (
            <Text className="text-destructive text-sm">
              {errorMessage(realtimeQ.error, t('admin.realtime.loadFailed'))}
            </Text>
          ) : null}
          {realtime ? (
            <>
              <View style={styles.metricGrid}>
                <MetricCard
                  label={t('admin.realtime.channels')}
                  value={formatter.format(realtime.stats.channels)}
                  tone="blue"
                />
                <MetricCard
                  label={t('admin.realtime.rooms')}
                  value={formatter.format(realtime.stats.rooms)}
                  tone="violet"
                />
                <MetricCard
                  label={t('admin.realtime.activeCalls')}
                  value={formatter.format(realtime.stats.activeCalls)}
                  tone="emerald"
                />
                <MetricCard
                  label={t('admin.realtime.readStates')}
                  value={formatter.format(realtime.stats.readStates)}
                  tone="cyan"
                />
              </View>
              <View style={styles.serviceGrid}>
                <RealtimeServiceCard
                  name={t('admin.realtime.redisName')}
                  metric={
                    realtime.services.redis.ready
                      ? t('admin.realtime.ready')
                      : t('admin.realtime.fallback')
                  }
                  detail={
                    realtime.services.redis.ready
                      ? t('admin.realtime.redisReadyDetail')
                      : t('admin.realtime.redisFallbackDetail')
                  }
                  tone={realtime.services.redis.ready ? 'emerald' : 'amber'}
                />
                <RealtimeServiceCard
                  name={t('admin.realtime.livekitName')}
                  metric={
                    realtime.services.livekit.ready
                      ? t('admin.realtime.ready')
                      : t('admin.realtime.blocked')
                  }
                  detail={
                    realtime.services.livekit.ready
                      ? t('admin.realtime.livekitReadyDetail', {
                          url: realtime.services.livekit.url ?? t('common.none'),
                        })
                      : t('admin.realtime.livekitMissingDetail', {
                          missing: realtime.services.livekit.missing.join(', ') || t('common.none'),
                        })
                  }
                  tone={realtime.services.livekit.ready ? 'emerald' : 'rose'}
                />
              </View>
            </>
          ) : null}
        </SurfaceRow>

        <SurfaceRow
          className="gap-3"
          onLayout={(event) => handleAdminSectionLayout('ai-usage', event.nativeEvent.layout.y)}
        >
          <View className="flex-row items-start gap-3">
            <IconTile icon={Activity} tone={aiUsageTotals?.killSwitches ? 'rose' : 'indigo'} />
            <View className="min-w-0 flex-1 gap-1">
              <Text className="text-muted-foreground text-xs font-medium">
                {t('admin.aiUsage.title')}
              </Text>
              <View style={styles.sectionTitleRow}>
                <Text className="text-foreground text-base font-semibold">
                  {t('admin.aiUsage.subtitle')}
                </Text>
                {aiUsage ? (
                  <SemanticBadge
                    label={t('admin.aiUsage.windowBadge', { count: aiUsage.windowDays })}
                    tone="neutral"
                  />
                ) : null}
              </View>
            </View>
          </View>

          {aiUsageQ.isLoading ? (
            <Text className="text-muted-foreground text-sm">{t('admin.aiUsage.loading')}</Text>
          ) : null}
          {aiUsageQ.isError ? (
            <Text className="text-destructive text-sm">
              {errorMessage(aiUsageQ.error, t('admin.aiUsage.loadFailed'))}
            </Text>
          ) : null}
          {updateAiKillSwitch.isError ? (
            <Text className="text-destructive text-sm">
              {errorMessage(updateAiKillSwitch.error, t('admin.aiUsage.updateFailed'))}
            </Text>
          ) : null}
          {resetAiUsageCounters.isError ? (
            <Text className="text-destructive text-sm">
              {errorMessage(resetAiUsageCounters.error, t('admin.aiUsage.resetFailed'))}
            </Text>
          ) : null}
          {aiUsageTotals ? (
            <View style={styles.metricGrid}>
              <MetricCard
                label={t('admin.aiUsage.callsToday')}
                value={formatter.format(aiUsageTotals.callsToday)}
                tone="blue"
              />
              <MetricCard
                label={t('admin.aiUsage.tokensMonth')}
                value={formatter.format(aiUsageTotals.tokensMonth)}
                tone="violet"
              />
              <MetricCard
                label={t('admin.aiUsage.costMonth')}
                value={currencyFormatter.format(aiUsageTotals.costMonthUsd)}
                tone="amber"
              />
              <MetricCard
                label={t('admin.aiUsage.killSwitches')}
                value={formatter.format(aiUsageTotals.killSwitches)}
                tone={aiUsageTotals.killSwitches > 0 ? 'rose' : 'emerald'}
              />
            </View>
          ) : null}
          {aiUsage?.generatedAt ? (
            <Text className="text-muted-foreground text-xs">
              {t('admin.aiUsage.generatedAt', { time: relativeTime(aiUsage.generatedAt) })}
            </Text>
          ) : null}
          {aiUsage?.organizations.length === 0 ? (
            <View style={styles.inlineNotice}>
              <Text className="text-foreground text-sm font-semibold">
                {t('admin.aiUsage.emptyTitle')}
              </Text>
              <Text className="text-muted-foreground text-sm">{t('admin.aiUsage.emptyDesc')}</Text>
            </View>
          ) : null}
          <View style={styles.aiOrgList}>
            {aiUsage?.organizations.map((organization) => (
              <AiUsageOrgCard
                key={organization.organizationId}
                organization={organization}
                disabled={updateAiKillSwitch.isPending || resetAiUsageCounters.isPending}
                numberFormatter={formatter}
                currencyFormatter={currencyFormatter}
                onToggle={toggleAiKillSwitch}
                onResetDaily={resetDailyAiCounters}
              />
            ))}
          </View>
        </SurfaceRow>

        <SurfaceRow
          className="gap-3"
          onLayout={(event) => handleAdminSectionLayout('agents', event.nativeEvent.layout.y)}
        >
          <View className="flex-row items-start gap-3">
            <IconTile
              icon={Activity}
              tone={agentControl?.settings.globalEnabled ? 'emerald' : 'neutral'}
            />
            <View className="min-w-0 flex-1 gap-1">
              <Text className="text-muted-foreground text-xs font-medium">
                {t('admin.agent.title')}
              </Text>
              <View style={styles.sectionTitleRow}>
                <Text className="text-foreground text-base font-semibold">
                  {t('admin.agent.subtitle')}
                </Text>
                {agentControl ? (
                  <SemanticBadge
                    label={
                      agentControl.settings.globalEnabled
                        ? t('admin.agent.globalOn')
                        : t('admin.agent.globalOff')
                    }
                    tone={agentControl.settings.globalEnabled ? 'emerald' : 'neutral'}
                  />
                ) : null}
              </View>
            </View>
          </View>

          {agentControlQ.isLoading ? (
            <Text className="text-muted-foreground text-sm">{t('admin.agent.loading')}</Text>
          ) : null}
          {agentControlQ.isError ? (
            <Text className="text-destructive text-sm">
              {errorMessage(agentControlQ.error, t('admin.agent.loadFailed'))}
            </Text>
          ) : null}
          {updateAgentControl.isError ? (
            <Text className="text-destructive text-sm">
              {errorMessage(updateAgentControl.error, t('admin.agent.updateFailed'))}
            </Text>
          ) : null}

          {agentControl ? (
            <>
              <View style={styles.metricGrid}>
                <MetricCard
                  label={t('admin.agent.enabledWorkspaces')}
                  value={formatter.format(agentControl.stats.enabledWorkspaceCount)}
                  tone="blue"
                />
                <MetricCard
                  label={t('admin.agent.enabledProjects')}
                  value={formatter.format(agentControl.stats.enabledProjectCount)}
                  tone="violet"
                />
                <MetricCard
                  label={t('admin.agent.runningRuns')}
                  value={formatter.format(agentControl.stats.runningRuns)}
                  tone={agentControl.stats.runningRuns > 0 ? 'amber' : 'neutral'}
                />
                <MetricCard
                  label={t('admin.agent.failedRuns')}
                  value={formatter.format(agentControl.stats.failedRuns)}
                  tone={agentControl.stats.failedRuns > 0 ? 'rose' : 'emerald'}
                />
                <MetricCard
                  label={t('admin.agent.readyWorkspaces')}
                  value={formatter.format(agentControl.stats.readyWorkspaceCount)}
                  tone="emerald"
                />
                <MetricCard
                  label={t('admin.agent.blockedWorkspaces')}
                  value={formatter.format(agentControl.stats.blockedWorkspaceCount)}
                  tone={agentControl.stats.blockedWorkspaceCount > 0 ? 'rose' : 'neutral'}
                />
              </View>

              <View style={styles.agentPolicyGrid}>
                <AgentPolicySwitch
                  title={t('admin.agent.globalEnabled')}
                  description={t('admin.agent.globalEnabledDesc')}
                  checked={agentControl.settings.globalEnabled}
                  disabled={updateAgentControl.isPending}
                  onPress={() =>
                    patchAgentControl({
                      globalEnabled: !agentControl.settings.globalEnabled,
                    })
                  }
                />
                <AgentPolicySwitch
                  title={t('admin.agent.writeActionsAllowed')}
                  description={t('admin.agent.writeActionsAllowedDesc')}
                  checked={agentControl.settings.allowWriteActions}
                  disabled={updateAgentControl.isPending}
                  onPress={() =>
                    patchAgentControl({
                      allowWriteActions: !agentControl.settings.allowWriteActions,
                    })
                  }
                />
                <AgentPolicySwitch
                  title={t('admin.agent.supervisionRequired')}
                  description={t('admin.agent.supervisionRequiredDesc')}
                  checked={agentControl.settings.requireSupervisionForAutoMode}
                  disabled={updateAgentControl.isPending}
                  onPress={() =>
                    patchAgentControl({
                      requireSupervisionForAutoMode:
                        !agentControl.settings.requireSupervisionForAutoMode,
                    })
                  }
                />
              </View>

              <View style={styles.directorySection}>
                <View style={styles.directorySectionHeader}>
                  <Text className="text-foreground text-sm font-semibold">
                    {t('admin.agent.maxConcurrentRuns')}
                  </Text>
                  <SemanticBadge
                    label={t('admin.agent.currentConcurrency', {
                      count: formatter.format(agentControl.settings.maxConcurrentRuns),
                    })}
                    tone="blue"
                  />
                </View>
                <View style={styles.directoryPillRow}>
                  {agentConcurrencyOptions.map((value) => (
                    <DirectoryPill
                      key={value}
                      label={formatter.format(value)}
                      tone="blue"
                      selected={agentControl.settings.maxConcurrentRuns === value}
                      disabled={updateAgentControl.isPending}
                      onPress={
                        agentControl.settings.maxConcurrentRuns === value
                          ? undefined
                          : () => patchAgentControl({ maxConcurrentRuns: value })
                      }
                    />
                  ))}
                </View>
              </View>

              <View style={styles.directorySection}>
                <Text className="text-foreground text-sm font-semibold">
                  {t('admin.agent.serviceStatus')}
                </Text>
                {agentControl.serviceStatus.length === 0 ? (
                  <View style={styles.inlineNotice}>
                    <Text className="text-foreground text-sm font-semibold">
                      {t('admin.agent.noServiceStatusTitle')}
                    </Text>
                    <Text className="text-muted-foreground text-sm">
                      {t('admin.agent.noServiceStatusDesc')}
                    </Text>
                  </View>
                ) : null}
                <View style={styles.serviceGrid}>
                  {agentControl.serviceStatus.map((status) => {
                    const labelKey = agentServiceLabelKey(status.key);
                    return (
                      <RealtimeServiceCard
                        key={status.key}
                        name={labelKey ? t(labelKey) : status.label}
                        metric={t(agentStateLabelKey(status.state))}
                        detail={status.detail || t('common.none')}
                        tone={agentStateTone(status.state)}
                      />
                    );
                  })}
                </View>
              </View>

              <View style={styles.directorySection}>
                <Text className="text-foreground text-sm font-semibold">
                  {t('admin.agent.providerBreakdown')}
                </Text>
                {agentControl.providerBreakdown.length === 0 ? (
                  <View style={styles.inlineNotice}>
                    <Text className="text-foreground text-sm font-semibold">
                      {t('admin.agent.noProvidersTitle')}
                    </Text>
                    <Text className="text-muted-foreground text-sm">
                      {t('admin.agent.noProvidersDesc')}
                    </Text>
                  </View>
                ) : null}
                <View style={styles.agentList}>
                  {agentControl.providerBreakdown.map((item) => (
                    <AgentProviderBreakdownCard
                      key={item.provider}
                      item={item}
                      formatter={formatter}
                    />
                  ))}
                </View>
              </View>

              <View style={styles.directorySection}>
                <View style={styles.directorySectionHeader}>
                  <Text className="text-foreground text-sm font-semibold">
                    {t('admin.agent.workspaceCoverage')}
                  </Text>
                  <SemanticBadge
                    label={t('admin.agent.coverageCount', {
                      count: formatter.format(agentControl.workspaceCoverage.length),
                    })}
                    tone="neutral"
                  />
                </View>
                {agentControl.workspaceCoverage.length === 0 ? (
                  <View style={styles.inlineNotice}>
                    <Text className="text-foreground text-sm font-semibold">
                      {t('admin.agent.noWorkspaceCoverageTitle')}
                    </Text>
                    <Text className="text-muted-foreground text-sm">
                      {t('admin.agent.noWorkspaceCoverageDesc')}
                    </Text>
                  </View>
                ) : null}
                <View style={styles.agentList}>
                  {agentControl.workspaceCoverage
                    .slice(0, ADMIN_DIRECTORY_LIMIT)
                    .map((workspace) => (
                      <AgentWorkspaceCard
                        key={workspace.organizationId}
                        workspace={workspace}
                        formatter={formatter}
                      />
                    ))}
                </View>
              </View>

              <View style={styles.directorySection}>
                <View style={styles.directorySectionHeader}>
                  <Text className="text-foreground text-sm font-semibold">
                    {t('admin.agent.recentRuns')}
                  </Text>
                  <SemanticBadge
                    label={t('admin.agent.recentRunCount', {
                      count: formatter.format(agentControl.stats.recentRunCount),
                    })}
                    tone="neutral"
                  />
                </View>
                {agentControl.recentRuns.length === 0 ? (
                  <View style={styles.inlineNotice}>
                    <Text className="text-foreground text-sm font-semibold">
                      {t('admin.agent.noRecentRunsTitle')}
                    </Text>
                    <Text className="text-muted-foreground text-sm">
                      {t('admin.agent.noRecentRunsDesc')}
                    </Text>
                  </View>
                ) : null}
                <View style={styles.agentList}>
                  {agentControl.recentRuns.slice(0, ADMIN_DIRECTORY_LIMIT).map((run) => (
                    <AgentRunCard key={run.id} run={run} formatter={formatter} />
                  ))}
                </View>
              </View>
            </>
          ) : null}
        </SurfaceRow>

        <SurfaceRow
          className="gap-3"
          onLayout={(event) => handleAdminSectionLayout('registration', event.nativeEvent.layout.y)}
        >
          <View className="flex-row items-start gap-3">
            <IconTile icon={UserPlus} tone="emerald" />
            <View className="min-w-0 flex-1 gap-1">
              <Text className="text-muted-foreground text-xs font-medium">
                {t('admin.registration.title')}
              </Text>
              <Text className="text-foreground text-base font-semibold">
                {t('admin.registration.description')}
              </Text>
              {registration?.updatedAt ? (
                <Text className="text-muted-foreground text-xs">
                  {t('admin.registration.updated', { time: relativeTime(registration.updatedAt) })}
                </Text>
              ) : null}
            </View>
          </View>

          {registrationQ.isLoading ? (
            <Text className="text-muted-foreground text-sm">{t('common.loading')}</Text>
          ) : null}
          {registrationQ.isError ? (
            <Text className="text-destructive text-sm">
              {errorMessage(registrationQ.error, t('admin.registration.loadError'))}
            </Text>
          ) : null}
          <View style={styles.policyList}>
            {REGISTRATION_MODES.map((mode) => (
              <PolicyOption
                key={mode}
                mode={mode}
                selected={registration?.mode === mode}
                disabled={updateRegistration.isPending || registrationQ.isLoading}
                onPress={() => updateRegistration.mutate(mode)}
              />
            ))}
          </View>
          {updateRegistration.isError ? (
            <Text className="text-destructive text-sm">
              {errorMessage(updateRegistration.error, t('admin.registration.saveError'))}
            </Text>
          ) : null}
        </SurfaceRow>

        <SurfaceRow
          className="gap-3"
          onLayout={(event) =>
            handleAdminSectionLayout('feature-flags', event.nativeEvent.layout.y)
          }
        >
          <View className="flex-row items-start gap-3">
            <IconTile icon={Flag} tone="violet" />
            <View className="min-w-0 flex-1 gap-1">
              <Text className="text-muted-foreground text-xs font-medium">
                {t('admin.flags.title')}
              </Text>
              <Text className="text-foreground text-base font-semibold">
                {t('admin.flags.subtitle')}
              </Text>
            </View>
          </View>

          {featureFlagsQ.isLoading ? (
            <Text className="text-muted-foreground text-sm">{t('admin.flags.loading')}</Text>
          ) : null}
          {featureFlagsQ.isError ? (
            <Text className="text-destructive text-sm">
              {errorMessage(featureFlagsQ.error, t('admin.flags.loadFailed'))}
            </Text>
          ) : null}
          {updateFeatureFlag.isError ? (
            <Text className="text-destructive text-sm">
              {errorMessage(updateFeatureFlag.error, t('admin.flags.updateFailed'))}
            </Text>
          ) : null}
          {featureFlagsQ.data?.length === 0 ? (
            <View style={styles.inlineNotice}>
              <Text className="text-foreground text-sm font-semibold">
                {t('admin.flags.emptyTitle')}
              </Text>
              <Text className="text-muted-foreground text-sm">{t('admin.flags.emptyDesc')}</Text>
            </View>
          ) : null}
          <View style={styles.flagList}>
            {featureFlagsQ.data?.map((flag) => (
              <FeatureFlagRow
                key={flag.id}
                flag={flag}
                disabled={updateFeatureFlag.isPending}
                onToggle={(item, next) => mutateFlag(item, { isEnabled: next })}
                onRollout={(item, next) => mutateFlag(item, { rolloutPercentage: next })}
              />
            ))}
          </View>
        </SurfaceRow>

        <SurfaceRow
          className="gap-3"
          onLayout={(event) => handleAdminSectionLayout('updates', event.nativeEvent.layout.y)}
        >
          <View className="flex-row items-start gap-3">
            <IconTile icon={Rocket} tone={versionTone} />
            <View className="min-w-0 flex-1 gap-1">
              <Text className="text-muted-foreground text-xs font-medium">
                {t('admin.version.title')}
              </Text>
              <View style={styles.sectionTitleRow}>
                <Text className="text-foreground text-base font-semibold">
                  {t('admin.version.description')}
                </Text>
                <SemanticBadge label={versionStatusLabel} tone={versionTone} />
              </View>
            </View>
          </View>

          {versionQ.isLoading ? (
            <Text className="text-muted-foreground text-sm">{t('common.loading')}</Text>
          ) : null}
          {versionQ.isError ? (
            <Text className="text-destructive text-sm">
              {errorMessage(versionQ.error, t('admin.version.loadError'))}
            </Text>
          ) : null}
          {version ? (
            <View style={styles.versionPanel}>
              <VersionLine
                label={t('admin.version.currentVersion')}
                value={version.current ? `v${version.current}` : t('common.none')}
              />
              <VersionLine
                label={t('admin.version.latestVersion')}
                value={version.latest ? `v${version.latest}` : t('admin.version.statusUnknown')}
              />
              <VersionLine
                label={t('admin.version.dockerImage')}
                value={
                  version.image.latestTag
                    ? `${version.image.repository}:${version.image.latestTag}`
                    : version.image.repository
                }
              />
              <VersionLine
                label={t('admin.version.lastChecked')}
                value={version.checkedAt ? relativeTime(version.checkedAt) : t('common.none')}
              />
              {selfUpdate ? (
                <>
                  <VersionLine
                    label={t('admin.version.selfUpdate')}
                    value={
                      selfUpdate.mode === 'external-webhook'
                        ? t('admin.version.externalMode')
                        : t('admin.version.manualMode')
                    }
                  />
                  {selfUpdate.blockedReason ? (
                    <VersionLine
                      label={t('admin.version.blocked')}
                      value={t('admin.version.blockedReason', {
                        reason: selfUpdate.blockedReason,
                      })}
                    />
                  ) : null}
                  {selfUpdate.manualCommands ? (
                    <Text selectable style={styles.commandText}>
                      {selfUpdate.manualCommands}
                    </Text>
                  ) : null}
                </>
              ) : null}
            </View>
          ) : null}
          <Button
            title={
              refreshVersion.isPending ? t('admin.version.checking') : t('admin.version.checkNow')
            }
            variant="secondary"
            icon={RefreshCw}
            loading={refreshVersion.isPending}
            onPress={() => refreshVersion.mutate()}
          />
          {refreshVersion.isError ? (
            <Text className="text-destructive text-sm">
              {errorMessage(refreshVersion.error, t('admin.version.loadError'))}
            </Text>
          ) : null}
        </SurfaceRow>

        <SurfaceRow
          className="gap-3"
          onLayout={(event) => handleAdminSectionLayout('audit', event.nativeEvent.layout.y)}
        >
          <View className="flex-row items-start gap-3">
            <IconTile icon={Activity} tone="indigo" />
            <View className="min-w-0 flex-1 gap-1">
              <Text className="text-muted-foreground text-xs font-medium">
                {t('admin.audit.title')}
              </Text>
              <Text className="text-foreground text-base font-semibold">
                {t('admin.audit.subtitle')}
              </Text>
            </View>
          </View>
          {auditQ.isLoading ? (
            <Text className="text-muted-foreground text-sm">{t('admin.audit.loading')}</Text>
          ) : null}
          {auditQ.isError ? (
            <Text className="text-destructive text-sm">
              {errorMessage(auditQ.error, t('admin.audit.loadFailed'))}
            </Text>
          ) : null}
          {auditQ.data?.length === 0 ? (
            <View style={styles.inlineNotice}>
              <Text className="text-foreground text-sm font-semibold">
                {t('admin.audit.emptyTitle')}
              </Text>
              <Text className="text-muted-foreground text-sm">{t('admin.audit.emptyDesc')}</Text>
            </View>
          ) : null}
          {auditQ.data?.map((log) => (
            <AuditRow key={log.id} log={log} />
          ))}
        </SurfaceRow>
      </ScrollView>
    </Screen>
  );
}

function createInstanceAdminStyles(colors: ThemeColors) {
  return StyleSheet.create({
    metricGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 8,
    },
    metricCard: {
      minWidth: 132,
      flexGrow: 1,
      flexBasis: '45%',
      gap: 8,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
      borderRadius: 6,
      backgroundColor: colors.surface,
      paddingHorizontal: 10,
      paddingVertical: 10,
    },
    metricValue: {
      color: colors.foreground,
      fontSize: 22,
      fontWeight: '700',
      lineHeight: 28,
    },
    policyList: {
      gap: 8,
    },
    policyOption: {
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
      borderRadius: 6,
      backgroundColor: colors.surface,
      paddingHorizontal: 10,
      paddingVertical: 10,
    },
    policyOptionActive: {
      borderColor: colors.primary,
      backgroundColor: `${colors.primary}12`,
    },
    policyTitleRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
    },
    policyCheck: {
      width: 22,
      height: 22,
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
      borderRadius: 4,
      backgroundColor: colors.card,
    },
    policyCheckActive: {
      borderColor: colors.primary,
      backgroundColor: colors.primary,
    },
    sectionTitleRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      alignItems: 'center',
      gap: 8,
    },
    flagList: {
      gap: 8,
    },
    flagRow: {
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
      borderRadius: 6,
      backgroundColor: colors.surface,
      padding: 10,
    },
    flagTitleRow: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: 10,
    },
    flagSwitch: {
      minWidth: 86,
      alignItems: 'center',
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
      borderRadius: 4,
      backgroundColor: colors.card,
      paddingHorizontal: 10,
      paddingVertical: 7,
    },
    flagSwitchActive: {
      borderColor: colors.accentEmerald,
      backgroundColor: `${colors.accentEmerald}16`,
    },
    flagSwitchText: {
      color: colors.mutedForeground,
      fontSize: 12,
      fontWeight: '700',
      lineHeight: 16,
    },
    flagSwitchTextActive: {
      color: colors.accentEmerald,
    },
    serviceGrid: {
      gap: 8,
    },
    serviceCard: {
      gap: 8,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
      borderRadius: 6,
      backgroundColor: colors.surface,
      padding: 10,
    },
    serviceCardDanger: {
      borderColor: `${colors.accentRose}66`,
      backgroundColor: `${colors.accentRose}10`,
    },
    serviceTitleRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 10,
    },
    serviceNameRow: {
      minWidth: 0,
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
    },
    serviceDetailRow: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: 8,
    },
    aiOrgList: {
      gap: 10,
    },
    aiOrgCard: {
      gap: 10,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
      borderRadius: 6,
      backgroundColor: colors.surface,
      padding: 10,
    },
    aiOrgCardDanger: {
      borderColor: `${colors.accentRose}66`,
      backgroundColor: `${colors.accentRose}10`,
    },
    aiOrgHeader: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      justifyContent: 'space-between',
      gap: 10,
    },
    aiLimitPanel: {
      gap: 8,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
      borderRadius: 6,
      backgroundColor: colors.card,
      padding: 10,
    },
    aiHistoryPanel: {
      gap: 8,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
      borderRadius: 6,
      backgroundColor: colors.card,
      padding: 10,
    },
    aiHistoryBars: {
      height: 48,
      flexDirection: 'row',
      alignItems: 'flex-end',
      gap: 5,
    },
    aiHistoryBarTrack: {
      width: 12,
      flex: 1,
      justifyContent: 'flex-end',
      borderRadius: 4,
      backgroundColor: colors.muted,
      overflow: 'hidden',
    },
    aiHistoryBar: {
      borderRadius: 4,
      backgroundColor: colors.accentAmber,
    },
    aiFeaturePanel: {
      gap: 6,
    },
    aiFeatureRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 10,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
      borderRadius: 6,
      backgroundColor: colors.card,
      paddingHorizontal: 10,
      paddingVertical: 8,
    },
    aiActionRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 8,
    },
    aiActionButton: {
      minWidth: 140,
      flex: 1,
    },
    agentPolicyGrid: {
      gap: 8,
    },
    agentPolicyCard: {
      minHeight: 72,
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
    agentPolicyCardActive: {
      borderColor: `${colors.accentEmerald}66`,
      backgroundColor: `${colors.accentEmerald}10`,
    },
    agentList: {
      gap: 8,
    },
    agentCompactCard: {
      gap: 8,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
      borderRadius: 6,
      backgroundColor: colors.surface,
      padding: 10,
    },
    agentWorkspaceCard: {
      gap: 8,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
      borderRadius: 6,
      backgroundColor: colors.surface,
      padding: 10,
    },
    agentCardHeader: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      justifyContent: 'space-between',
      gap: 10,
    },
    statusDot: {
      width: 8,
      height: 8,
      flexShrink: 0,
      borderRadius: 999,
    },
    flagMetaRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 6,
    },
    systemGrid: {
      gap: 10,
    },
    systemCard: {
      gap: 10,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
      borderRadius: 6,
      backgroundColor: colors.surface,
      padding: 10,
    },
    systemHeader: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      justifyContent: 'space-between',
      gap: 10,
    },
    systemMetaRow: {
      minHeight: 22,
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 6,
    },
    systemForm: {
      gap: 8,
    },
    systemTwoColumn: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 8,
    },
    systemColumn: {
      minWidth: 132,
      flex: 1,
      gap: 6,
    },
    systemActionRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 8,
    },
    systemActionButton: {
      minWidth: 150,
      flex: 1,
    },
    directorySection: {
      gap: 8,
    },
    directorySectionHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 10,
    },
    directoryList: {
      gap: 8,
    },
    directoryCard: {
      gap: 10,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
      borderRadius: 6,
      backgroundColor: colors.surface,
      padding: 10,
    },
    directoryHeader: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      justifyContent: 'space-between',
      gap: 10,
    },
    directoryMetaRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 6,
    },
    directoryPillRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 6,
    },
    directoryPill: {
      minWidth: 74,
      alignItems: 'center',
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
      borderRadius: 4,
      backgroundColor: colors.card,
      paddingHorizontal: 8,
      paddingVertical: 6,
    },
    directoryPillText: {
      color: colors.mutedForeground,
      fontSize: 12,
      fontWeight: '700',
      lineHeight: 16,
    },
    directoryActionRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 8,
    },
    directoryActionButton: {
      minWidth: 150,
      flex: 1,
    },
    rolloutHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
    },
    rolloutList: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 6,
    },
    rolloutPill: {
      minWidth: 54,
      alignItems: 'center',
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
      borderRadius: 4,
      backgroundColor: colors.card,
      paddingHorizontal: 8,
      paddingVertical: 6,
    },
    rolloutPillActive: {
      borderColor: colors.primary,
      backgroundColor: `${colors.primary}14`,
    },
    rolloutPillText: {
      color: colors.mutedForeground,
      fontSize: 12,
      fontWeight: '700',
      lineHeight: 16,
    },
    rolloutPillTextActive: {
      color: colors.primary,
    },
    versionPanel: {
      gap: 8,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
      borderRadius: 6,
      backgroundColor: colors.surface,
      padding: 10,
    },
    versionLine: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      justifyContent: 'space-between',
      gap: 12,
    },
    versionLabel: {
      minWidth: 112,
      flexShrink: 0,
      color: colors.mutedForeground,
      fontSize: 12,
      fontWeight: '700',
      lineHeight: 16,
    },
    versionValue: {
      minWidth: 0,
      flex: 1,
      color: colors.foreground,
      fontSize: 12,
      fontWeight: '600',
      lineHeight: 16,
      textAlign: 'right',
    },
    commandText: {
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
      borderRadius: 6,
      backgroundColor: colors.background,
      color: colors.foreground,
      fontFamily: 'monospace',
      fontSize: 11,
      lineHeight: 16,
      padding: 10,
    },
    auditRow: {
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
      borderRadius: 6,
      backgroundColor: colors.surface,
      padding: 10,
    },
    auditTitleRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      alignItems: 'center',
      gap: 8,
    },
    inlineNotice: {
      gap: 4,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
      borderRadius: 6,
      padding: 12,
    },
    disabled: {
      opacity: 0.5,
    },
  });
}
