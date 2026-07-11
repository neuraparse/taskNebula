import { useCallback, useEffect, useMemo, useRef, useState, type ComponentRef } from 'react';
import {
  useNavigation,
  useRoute,
  type NavigationProp,
  type RouteProp,
} from '@react-navigation/native';
import { Pressable, ScrollView, StyleSheet, Text, View } from '@/components/native';
import {
  Activity,
  Bell,
  Building2,
  Check,
  ClipboardList,
  FileJson,
  KeyRound,
  Languages,
  LogOut,
  Mail,
  Moon,
  RadioTower,
  RefreshCw,
  Save,
  Server,
  ShieldCheck,
  Sparkles,
  Smartphone,
  Tags,
  UploadCloud,
} from 'lucide-react-native';
import { useTranslation } from 'react-i18next';

import {
  Avatar,
  Button,
  IconTile,
  Screen,
  ScreenHeader,
  SemanticBadge,
  SurfaceRow,
  TextField,
} from '@/components/ui';
import type {
  UpdateNotificationPreferencesInput,
  UpdateUserAppearanceInput,
} from '@/api/endpoints';
import type {
  DigestFrequency,
  NotificationPreferences,
  Project,
  UserAppearanceColorTheme,
  UserAppearanceInterfaceFont,
  UserAppearanceSettings,
  UserAppearanceTheme,
  UserAppearanceVisualStyle,
} from '@/api/types';
import { config } from '@/config/env';
import {
  useMe,
  useNotificationPreferences,
  useProjects,
  useServerHealth,
  useUpdateNotificationPreferences,
  useUpdateUserAppearance,
  useUserAppearance,
} from '@/hooks/queries';
import type { HealthResponse } from '@/api/types';
import { isSupportedLocale, localeLabels, locales, type Locale } from '@/i18n/resources';
import { initials } from '@/lib/format';
import {
  getStoredLocalePreference,
  persistLocalePreference,
  resolveDeviceLocale,
} from '@/lib/locale-preference';
import { useSession } from '@/stores/session';
import type { ThemeColors } from '@/design/theme';
import { useThemeColors, useThemeEffects } from '@/design/theme-context';
import type { AppStackParamList, AppTabParamList } from '@/navigation/types';

type ProfileNavigation = NavigationProp<AppStackParamList>;
type ProfileRoute = RouteProp<AppTabParamList, 'Profile'>;
type ProfileStyles = ReturnType<typeof createProfileStyles>;

interface OrganizationOption {
  id: string;
  projectCount: number;
}

type AppearanceDraft = Pick<
  UserAppearanceSettings,
  | 'theme'
  | 'colorTheme'
  | 'visualStyle'
  | 'interfaceFont'
  | 'animationsEnabled'
  | 'gradientsEnabled'
>;

type AppearanceDraftKey = keyof AppearanceDraft;

type NotificationBooleanKey =
  | 'enableInApp'
  | 'enableEmail'
  | 'emailOnAssigned'
  | 'emailOnMentioned'
  | 'emailOnCommented'
  | 'emailOnStatusChanged'
  | 'emailOnIssueCreated'
  | 'emailOnSprintStarted'
  | 'emailOnSprintCompleted'
  | 'emailOnProjectCreated'
  | 'emailOnProjectArchived'
  | 'inAppOnAssigned'
  | 'inAppOnMentioned'
  | 'inAppOnCommented'
  | 'inAppOnStatusChanged'
  | 'inAppOnIssueCreated'
  | 'inAppOnSprintStarted'
  | 'inAppOnSprintCompleted'
  | 'inAppOnProjectCreated'
  | 'inAppOnProjectArchived'
  | 'doNotDisturb';

type NotificationEvent = {
  labelKey: string;
  descKey: string;
  emailKey: NotificationBooleanKey;
  inAppKey: NotificationBooleanKey;
};

const DIGEST_OPTIONS = ['none', 'daily', 'weekly'] as const;

const APPEARANCE_THEME_OPTIONS: Array<{ value: UserAppearanceTheme; labelKey: string }> = [
  { value: 'light', labelKey: 'settings.appearance.mode_light' },
  { value: 'dark', labelKey: 'settings.appearance.mode_dark' },
  { value: 'system', labelKey: 'settings.appearance.mode_system' },
];

const APPEARANCE_COLOR_THEME_OPTIONS: Array<{
  value: UserAppearanceColorTheme;
  labelKey: string;
  swatches: string[];
}> = [
  {
    value: 'default',
    labelKey: 'settings.appearance.theme_default',
    swatches: ['#3b82f6', '#60a5fa'],
  },
  { value: 'ocean', labelKey: 'settings.appearance.theme_ocean', swatches: ['#0891b2', '#22d3ee'] },
  {
    value: 'forest',
    labelKey: 'settings.appearance.theme_forest',
    swatches: ['#16a34a', '#4ade80'],
  },
  {
    value: 'sunset',
    labelKey: 'settings.appearance.theme_sunset',
    swatches: ['#ea580c', '#fb923c'],
  },
  {
    value: 'purple',
    labelKey: 'settings.appearance.theme_purple',
    swatches: ['#9333ea', '#c084fc'],
  },
  { value: 'rose', labelKey: 'settings.appearance.theme_rose', swatches: ['#e11d48', '#fb7185'] },
];

const APPEARANCE_VISUAL_STYLE_OPTIONS: Array<{
  value: UserAppearanceVisualStyle;
  labelKey: string;
}> = [
  { value: 'modern', labelKey: 'settings.appearance.style_modern' },
  { value: 'glass', labelKey: 'settings.appearance.style_glass' },
  { value: 'minimal', labelKey: 'settings.appearance.style_minimal' },
];

const APPEARANCE_FONT_OPTIONS: Array<{ value: UserAppearanceInterfaceFont; labelKey: string }> = [
  { value: 'brand', labelKey: 'settings.appearance.font_brand' },
  { value: 'ibm', labelKey: 'settings.appearance.font_ibm' },
];

const NOTIFICATION_EVENT_GROUPS: Array<{ titleKey: string; rows: NotificationEvent[] }> = [
  {
    titleKey: 'settings.notifications.group_direct',
    rows: [
      {
        labelKey: 'settings.notifications.row_assigned_label',
        descKey: 'settings.notifications.row_assigned_desc',
        emailKey: 'emailOnAssigned',
        inAppKey: 'inAppOnAssigned',
      },
      {
        labelKey: 'settings.notifications.row_mentions_label',
        descKey: 'settings.notifications.row_mentions_desc',
        emailKey: 'emailOnMentioned',
        inAppKey: 'inAppOnMentioned',
      },
    ],
  },
  {
    titleKey: 'settings.notifications.group_activity',
    rows: [
      {
        labelKey: 'settings.notifications.row_comments_label',
        descKey: 'settings.notifications.row_comments_desc',
        emailKey: 'emailOnCommented',
        inAppKey: 'inAppOnCommented',
      },
      {
        labelKey: 'settings.notifications.row_status_label',
        descKey: 'settings.notifications.row_status_desc',
        emailKey: 'emailOnStatusChanged',
        inAppKey: 'inAppOnStatusChanged',
      },
      {
        labelKey: 'settings.notifications.row_new_issues_label',
        descKey: 'settings.notifications.row_new_issues_desc',
        emailKey: 'emailOnIssueCreated',
        inAppKey: 'inAppOnIssueCreated',
      },
    ],
  },
  {
    titleKey: 'settings.notifications.group_sprint',
    rows: [
      {
        labelKey: 'settings.notifications.row_sprint_start_label',
        descKey: 'settings.notifications.row_sprint_start_desc',
        emailKey: 'emailOnSprintStarted',
        inAppKey: 'inAppOnSprintStarted',
      },
      {
        labelKey: 'settings.notifications.row_sprint_complete_label',
        descKey: 'settings.notifications.row_sprint_complete_desc',
        emailKey: 'emailOnSprintCompleted',
        inAppKey: 'inAppOnSprintCompleted',
      },
    ],
  },
  {
    titleKey: 'settings.notifications.group_lifecycle',
    rows: [
      {
        labelKey: 'settings.notifications.row_new_projects_label',
        descKey: 'settings.notifications.row_new_projects_desc',
        emailKey: 'emailOnProjectCreated',
        inAppKey: 'inAppOnProjectCreated',
      },
      {
        labelKey: 'settings.notifications.row_project_archived_label',
        descKey: 'settings.notifications.row_project_archived_desc',
        emailKey: 'emailOnProjectArchived',
        inAppKey: 'inAppOnProjectArchived',
      },
    ],
  },
];

const QUIET_TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;

function useProfileTheme(): { colors: ThemeColors; styles: ProfileStyles } {
  const colors = useThemeColors();
  const styles = useMemo(() => createProfileStyles(colors), [colors]);

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

function optionalQuietTime(value: string | null): string | null {
  const trimmed = value?.trim() ?? '';
  return trimmed.length > 0 ? trimmed : null;
}

function isValidQuietTime(value: string | null): boolean {
  const trimmed = optionalQuietTime(value);
  return !trimmed || QUIET_TIME_RE.test(trimmed);
}

function healthTone(status?: HealthResponse['status']): 'emerald' | 'amber' | 'rose' | 'neutral' {
  if (status === 'healthy') return 'emerald';
  if (status === 'degraded') return 'amber';
  if (status === 'unhealthy') return 'rose';
  return 'neutral';
}

function healthLabel(
  status: HealthResponse['status'] | undefined,
  t: ReturnType<typeof useTranslation>['t'],
): string {
  if (status === 'healthy') return t('profile.health.statusHealthy');
  if (status === 'degraded') return t('profile.health.statusDegraded');
  if (status === 'unhealthy') return t('profile.health.statusUnhealthy');
  return t('profile.health.statusUnknown');
}

function checkLabel(key: string, t: ReturnType<typeof useTranslation>['t']): string {
  if (key === 'database') return t('profile.health.checkDatabase');
  if (key === 'memory') return t('profile.health.checkMemory');
  if (key === 'redis') return t('profile.health.checkRedis');
  if (key === 'livekit') return t('profile.health.checkLivekit');
  if (key === 'smtp') return t('profile.health.checkSmtp');
  return key;
}

function checkStateLabel(value: unknown, t: ReturnType<typeof useTranslation>['t']): string {
  if (value === 'ok') return t('profile.health.checkOk');
  if (value === 'warning') return t('profile.health.checkWarning');
  if (value === 'error') return t('profile.health.checkError');
  if (value === 'skipped') return t('profile.health.checkSkipped');
  return t('profile.health.checkUnknown');
}

function checkStateTone(value: unknown): 'emerald' | 'amber' | 'rose' | 'neutral' {
  if (value === 'ok') return 'emerald';
  if (value === 'warning') return 'amber';
  if (value === 'error') return 'rose';
  return 'neutral';
}

function uptimeLabel(
  seconds: number | undefined,
  t: ReturnType<typeof useTranslation>['t'],
): string {
  if (seconds === undefined || Number.isNaN(seconds)) return t('common.none');
  if (seconds < 60)
    return t('profile.health.uptimeSeconds', { count: Math.max(1, Math.round(seconds)) });
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return t('profile.health.uptimeMinutes', { count: minutes });
  const hours = Math.round(minutes / 60);
  if (hours < 24) return t('profile.health.uptimeHours', { count: hours });
  return t('profile.health.uptimeDays', { count: Math.round(hours / 24) });
}

function notificationPreferencesPayload(
  draft: NotificationPreferences,
): UpdateNotificationPreferencesInput {
  return {
    organizationId: draft.organizationId,
    enableInApp: draft.enableInApp,
    enableEmail: draft.enableEmail,
    digestFrequency: draft.digestFrequency,
    emailOnAssigned: draft.emailOnAssigned,
    emailOnMentioned: draft.emailOnMentioned,
    emailOnCommented: draft.emailOnCommented,
    emailOnStatusChanged: draft.emailOnStatusChanged,
    emailOnIssueCreated: draft.emailOnIssueCreated,
    emailOnSprintStarted: draft.emailOnSprintStarted,
    emailOnSprintCompleted: draft.emailOnSprintCompleted,
    emailOnProjectCreated: draft.emailOnProjectCreated,
    emailOnProjectArchived: draft.emailOnProjectArchived,
    inAppOnAssigned: draft.inAppOnAssigned,
    inAppOnMentioned: draft.inAppOnMentioned,
    inAppOnCommented: draft.inAppOnCommented,
    inAppOnStatusChanged: draft.inAppOnStatusChanged,
    inAppOnIssueCreated: draft.inAppOnIssueCreated,
    inAppOnSprintStarted: draft.inAppOnSprintStarted,
    inAppOnSprintCompleted: draft.inAppOnSprintCompleted,
    inAppOnProjectCreated: draft.inAppOnProjectCreated,
    inAppOnProjectArchived: draft.inAppOnProjectArchived,
    doNotDisturb: draft.doNotDisturb,
    doNotDisturbStart: draft.doNotDisturb ? optionalQuietTime(draft.doNotDisturbStart) : null,
    doNotDisturbEnd: draft.doNotDisturb ? optionalQuietTime(draft.doNotDisturbEnd) : null,
  };
}

function appearanceDraftFromSettings(settings: UserAppearanceSettings): AppearanceDraft {
  return {
    theme: settings.theme,
    colorTheme: settings.colorTheme,
    visualStyle: settings.visualStyle,
    interfaceFont: settings.interfaceFont,
    animationsEnabled: settings.animationsEnabled,
    gradientsEnabled: settings.gradientsEnabled,
  };
}

function appearancePayload(draft: AppearanceDraft): UpdateUserAppearanceInput {
  return {
    theme: draft.theme,
    colorTheme: draft.colorTheme,
    visualStyle: draft.visualStyle,
    interfaceFont: draft.interfaceFont,
    animationsEnabled: draft.animationsEnabled,
    gradientsEnabled: draft.gradientsEnabled,
  };
}

function LanguagePill({
  label,
  selected,
  onPress,
}: {
  label: string;
  selected: boolean;
  onPress: () => void;
}) {
  const { styles } = useProfileTheme();

  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={[styles.languagePill, selected ? styles.languagePillActive : null]}
      className="active:opacity-80"
    >
      <Text style={[styles.languagePillText, selected ? styles.languagePillTextActive : null]}>
        {label}
      </Text>
    </Pressable>
  );
}

function WorkspacePill({
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
  const { styles } = useProfileTheme();

  return (
    <Pressable
      accessibilityRole="button"
      onPress={() => onPress(option.id)}
      style={[styles.workspacePill, selected ? styles.workspacePillActive : null]}
      className="active:opacity-80"
    >
      <Text style={[styles.workspaceTitle, selected ? styles.workspaceTitleActive : null]}>
        {t('team.workspaceIndex', { index: index + 1 })}
      </Text>
      <View style={styles.workspaceMetaRow}>
        <Text
          style={[styles.workspaceMeta, selected ? styles.workspaceMetaActive : null]}
          numberOfLines={1}
        >
          {t('team.projectCount', { count: option.projectCount })}
        </Text>
        <View style={[styles.workspaceMetaDot, selected ? styles.workspaceMetaDotActive : null]} />
        <Text
          style={[styles.workspaceMeta, selected ? styles.workspaceMetaActive : null]}
          numberOfLines={1}
        >
          {shortId(option.id)}
        </Text>
      </View>
    </Pressable>
  );
}

function SwitchRow({
  title,
  description,
  selected,
  disabled,
  onPress,
  icon: Icon,
}: {
  title: string;
  description: string;
  selected: boolean;
  disabled?: boolean;
  onPress: () => void;
  icon: typeof Bell;
}) {
  const { colors, styles } = useProfileTheme();

  return (
    <Pressable
      accessibilityRole="switch"
      accessibilityState={{ checked: selected, disabled }}
      disabled={disabled}
      onPress={onPress}
      style={[
        styles.switchRow,
        selected ? styles.switchRowActive : null,
        disabled ? styles.disabled : null,
      ]}
      className="active:opacity-80"
    >
      <View style={styles.switchIcon}>
        <Icon size={17} color={selected ? colors.primary : colors.mutedForeground} />
      </View>
      <View className="min-w-0 flex-1 gap-0.5">
        <Text className="text-foreground text-sm font-semibold" numberOfLines={1}>
          {title}
        </Text>
        <Text className="text-muted-foreground text-xs" numberOfLines={2}>
          {description}
        </Text>
      </View>
      <View style={[styles.switchKnob, selected ? styles.switchKnobActive : null]}>
        {selected ? <Check size={13} color={colors.primaryForeground} /> : null}
      </View>
    </Pressable>
  );
}

function DigestPill({
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
  const { styles } = useProfileTheme();

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected, disabled }}
      disabled={disabled}
      onPress={onPress}
      style={[
        styles.digestPill,
        selected ? styles.digestPillActive : null,
        disabled ? styles.disabled : null,
      ]}
      className="active:opacity-80"
    >
      <Text
        style={[styles.digestPillText, selected ? styles.digestPillTextActive : null]}
        numberOfLines={2}
      >
        {label}
      </Text>
    </Pressable>
  );
}

function ColorThemePill({
  label,
  swatches,
  selected,
  onPress,
}: {
  label: string;
  swatches: string[];
  selected: boolean;
  onPress: () => void;
}) {
  const { styles } = useProfileTheme();

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected }}
      onPress={onPress}
      style={[styles.colorThemePill, selected ? styles.colorThemePillActive : null]}
      className="active:opacity-80"
    >
      <View style={styles.colorThemeSwatches}>
        {swatches.map((swatch) => (
          <View key={swatch} style={[styles.colorThemeSwatch, { backgroundColor: swatch }]} />
        ))}
      </View>
      <Text
        style={[styles.colorThemeText, selected ? styles.colorThemeTextActive : null]}
        numberOfLines={2}
      >
        {label}
      </Text>
    </Pressable>
  );
}

function ChannelToggle({
  label,
  selected,
  disabled,
  onPress,
  accessibilityLabel,
}: {
  label: string;
  selected: boolean;
  disabled?: boolean;
  onPress: () => void;
  accessibilityLabel: string;
}) {
  const { styles } = useProfileTheme();

  return (
    <Pressable
      accessibilityLabel={accessibilityLabel}
      accessibilityRole="switch"
      accessibilityState={{ checked: selected, disabled }}
      disabled={disabled}
      onPress={onPress}
      style={[
        styles.channelToggle,
        selected ? styles.channelToggleActive : null,
        disabled ? styles.disabled : null,
      ]}
      className="active:opacity-80"
    >
      <Text style={[styles.channelToggleText, selected ? styles.channelToggleTextActive : null]}>
        {label}
      </Text>
    </Pressable>
  );
}

function ServerDiagnosticsCard() {
  const { t } = useTranslation();
  const { styles } = useProfileTheme();
  const healthQ = useServerHealth();
  const health = healthQ.data;
  const checks = Object.entries(health?.checks ?? {});

  return (
    <SurfaceRow className="gap-3">
      <View className="flex-row items-start gap-3">
        <IconTile icon={Activity} tone={healthTone(health?.status)} />
        <View className="min-w-0 flex-1 gap-1">
          <Text className="text-muted-foreground text-xs font-medium">
            {t('profile.health.kicker')}
          </Text>
          <View style={styles.healthTitleRow}>
            <Text className="text-foreground text-base font-semibold">
              {t('profile.health.title')}
            </Text>
            <SemanticBadge
              label={healthLabel(health?.status, t)}
              tone={healthTone(health?.status)}
            />
          </View>
          <Text className="text-muted-foreground text-sm">
            {healthQ.isLoading
              ? t('profile.health.checking')
              : healthQ.isError
                ? t('profile.health.loadFailed')
                : t('profile.health.subtitle')}
          </Text>
        </View>
      </View>

      {health ? (
        <View style={styles.healthMetrics}>
          <View style={styles.healthMetric}>
            <Text style={styles.healthMetricLabel}>{t('profile.health.version')}</Text>
            <Text style={styles.healthMetricValue} numberOfLines={1}>
              {health.version ? `v${health.version}` : t('common.none')}
            </Text>
          </View>
          <View style={styles.healthMetric}>
            <Text style={styles.healthMetricLabel}>{t('profile.health.uptime')}</Text>
            <Text style={styles.healthMetricValue} numberOfLines={1}>
              {uptimeLabel(health.uptime, t)}
            </Text>
          </View>
        </View>
      ) : null}

      {checks.length > 0 ? (
        <View style={styles.healthChecks}>
          {checks.map(([key, value]) => (
            <View key={key} style={styles.healthCheck}>
              <Text style={styles.healthCheckLabel} numberOfLines={1}>
                {checkLabel(key, t)}
              </Text>
              <SemanticBadge label={checkStateLabel(value, t)} tone={checkStateTone(value)} />
            </View>
          ))}
        </View>
      ) : null}

      {healthQ.isError ? (
        <Text className="text-destructive text-sm">
          {healthQ.error instanceof Error ? healthQ.error.message : t('profile.health.loadFailed')}
        </Text>
      ) : null}

      <Button
        title={t('profile.health.refresh')}
        variant="secondary"
        icon={RefreshCw}
        loading={healthQ.isFetching}
        onPress={() => void healthQ.refetch()}
      />
    </SurfaceRow>
  );
}

export function ProfileScreen() {
  const { t, i18n } = useTranslation();
  const { styles } = useProfileTheme();
  const effects = useThemeEffects();
  const navigation = useNavigation<ProfileNavigation>();
  const route = useRoute<ProfileRoute>();
  const scrollRef = useRef<ComponentRef<typeof ScrollView>>(null);
  const appearanceOffsetRef = useRef<number | null>(null);
  const notificationOffsetRef = useRef<number | null>(null);
  const pendingAppearanceScrollRef = useRef(route.params?.focus === 'appearance');
  const pendingNotificationScrollRef = useRef(route.params?.focus === 'notifications');
  const [storedLocale, setStoredLocale] = useState<Locale | null>(() =>
    getStoredLocalePreference(),
  );
  const [selectedOrganizationId, setSelectedOrganizationId] = useState<string | null>(null);
  const [appearanceDraft, setAppearanceDraft] = useState<AppearanceDraft | null>(null);
  const [appearanceMessage, setAppearanceMessage] = useState<string | null>(null);
  const [appearanceError, setAppearanceError] = useState<string | null>(null);
  const [notificationDraft, setNotificationDraft] = useState<NotificationPreferences | null>(null);
  const [notificationMessage, setNotificationMessage] = useState<string | null>(null);
  const [notificationError, setNotificationError] = useState<string | null>(null);
  const sessionUser = useSession((s) => s.user);
  const serverUrl = useSession((s) => s.serverUrl);
  const signOut = useSession((s) => s.signOut);
  const forgetServer = useSession((s) => s.forgetServer);
  const { data: me } = useMe();
  const appearanceQ = useUserAppearance();
  const updateUserAppearance = useUpdateUserAppearance();
  const projectsQ = useProjects();
  const organizationOptions = useMemo(
    () => uniqueOrganizations(projectsQ.data ?? []),
    [projectsQ.data],
  );
  const notificationPreferencesQ = useNotificationPreferences(selectedOrganizationId);
  const updateNotificationPreferences = useUpdateNotificationPreferences(selectedOrganizationId);

  const user = me ?? sessionUser;
  const currentLocale = isSupportedLocale(i18n.resolvedLanguage)
    ? i18n.resolvedLanguage
    : isSupportedLocale(i18n.language)
      ? i18n.language
      : resolveDeviceLocale();

  useEffect(() => {
    if (organizationOptions.length === 0) {
      if (selectedOrganizationId) setSelectedOrganizationId(null);
      return;
    }
    if (
      selectedOrganizationId &&
      organizationOptions.some((item) => item.id === selectedOrganizationId)
    ) {
      return;
    }
    setSelectedOrganizationId(organizationOptions[0]?.id ?? null);
  }, [organizationOptions, selectedOrganizationId]);

  useEffect(() => {
    if (!appearanceQ.data) {
      setAppearanceDraft(null);
      return;
    }
    setAppearanceDraft(appearanceDraftFromSettings(appearanceQ.data));
    setAppearanceError(null);
    setAppearanceMessage(null);
  }, [appearanceQ.data]);

  useEffect(() => {
    if (!notificationPreferencesQ.data) {
      setNotificationDraft(null);
      return;
    }
    setNotificationDraft(notificationPreferencesQ.data);
    setNotificationError(null);
    setNotificationMessage(null);
  }, [notificationPreferencesQ.data]);

  const scrollToAppearance = useCallback(() => {
    const offset = appearanceOffsetRef.current;
    if (offset === null) {
      pendingAppearanceScrollRef.current = true;
      return;
    }
    pendingAppearanceScrollRef.current = false;
    scrollRef.current?.scrollTo({
      y: Math.max(offset - 12, 0),
      animated: effects.animationsEnabled,
    });
  }, [effects.animationsEnabled]);

  const scrollToNotifications = useCallback(() => {
    const offset = notificationOffsetRef.current;
    if (offset === null) {
      pendingNotificationScrollRef.current = true;
      return;
    }
    pendingNotificationScrollRef.current = false;
    scrollRef.current?.scrollTo({
      y: Math.max(offset - 12, 0),
      animated: effects.animationsEnabled,
    });
  }, [effects.animationsEnabled]);

  const handleAppearanceLayout = useCallback(
    (offset: number) => {
      appearanceOffsetRef.current = offset;
      if (pendingAppearanceScrollRef.current) {
        requestAnimationFrame(scrollToAppearance);
      }
    },
    [scrollToAppearance],
  );

  const handleNotificationLayout = useCallback(
    (offset: number) => {
      notificationOffsetRef.current = offset;
      if (pendingNotificationScrollRef.current) {
        requestAnimationFrame(scrollToNotifications);
      }
    },
    [scrollToNotifications],
  );

  useEffect(() => {
    if (route.params?.focus !== 'appearance') return;
    requestAnimationFrame(scrollToAppearance);
  }, [route.params?.focus, scrollToAppearance]);

  useEffect(() => {
    if (route.params?.focus !== 'notifications') return;
    requestAnimationFrame(scrollToNotifications);
  }, [route.params?.focus, scrollToNotifications]);

  const selectLocale = (locale: Locale | null) => {
    const nextLocale = persistLocalePreference(locale);
    setStoredLocale(locale);
    void i18n.changeLanguage(nextLocale);
  };

  const updateAppearanceDraft = <K extends AppearanceDraftKey>(
    key: K,
    value: AppearanceDraft[K],
  ) => {
    setAppearanceDraft((current) => (current ? { ...current, [key]: value } : current));
    setAppearanceMessage(null);
    setAppearanceError(null);
  };

  const saveAppearance = async (): Promise<void> => {
    if (!appearanceDraft) return;
    setAppearanceError(null);
    setAppearanceMessage(null);

    try {
      await updateUserAppearance.mutateAsync(appearancePayload(appearanceDraft));
      setAppearanceMessage(t('settings.appearance.saved_toast_desc'));
    } catch (err: unknown) {
      setAppearanceError(
        err instanceof Error ? err.message : t('settings.appearance.update_failed'),
      );
    }
  };

  const updateNotificationDraft = <K extends keyof NotificationPreferences>(
    key: K,
    value: NotificationPreferences[K],
  ) => {
    setNotificationDraft((current) => (current ? { ...current, [key]: value } : current));
    setNotificationMessage(null);
    setNotificationError(null);
  };

  const toggleNotificationDraft = (key: NotificationBooleanKey) => {
    setNotificationDraft((current) => (current ? { ...current, [key]: !current[key] } : current));
    setNotificationMessage(null);
    setNotificationError(null);
  };

  const saveNotificationPreferences = async (): Promise<void> => {
    if (!notificationDraft) return;
    setNotificationError(null);
    setNotificationMessage(null);

    if (
      notificationDraft.doNotDisturb &&
      (!isValidQuietTime(notificationDraft.doNotDisturbStart) ||
        !isValidQuietTime(notificationDraft.doNotDisturbEnd))
    ) {
      setNotificationError(t('validation.invalidField'));
      return;
    }

    try {
      await updateNotificationPreferences.mutateAsync(
        notificationPreferencesPayload(notificationDraft),
      );
      setNotificationMessage(t('settings.notifications.saved_toast_desc'));
    } catch (err: unknown) {
      setNotificationError(
        err instanceof Error ? err.message : t('settings.notifications.update_failed'),
      );
    }
  };

  const setDigestFrequency = (digestFrequency: DigestFrequency) => {
    updateNotificationDraft('digestFrequency', digestFrequency);
  };

  return (
    <Screen>
      <ScreenHeader
        kicker={t('common.appName')}
        title={t('profile.title')}
        subtitle={t('profile.subtitle')}
        meta={<SemanticBadge label={config.appVersion} tone="indigo" />}
      />
      <ScrollView ref={scrollRef} contentContainerClassName="gap-3 px-4 pb-4">
        <SurfaceRow className="gap-3">
          <View className="flex-row items-center gap-3">
            <Avatar initials={initials(user?.name, user?.email)} size={52} />
            <View className="flex-1 gap-1">
              <Text className="text-muted-foreground text-xs font-medium">
                {t('profile.account')}
              </Text>
              {user?.name ? (
                <Text className="text-foreground text-lg font-semibold">{user.name}</Text>
              ) : null}
              {user?.email ? (
                <Text className="text-muted-foreground text-sm" numberOfLines={1}>
                  {user.email}
                </Text>
              ) : null}
            </View>
          </View>
        </SurfaceRow>

        <SurfaceRow className="gap-3">
          <View className="flex-row items-center gap-3">
            <IconTile icon={Server} tone="blue" />
            <View className="flex-1 gap-1">
              <Text className="text-muted-foreground text-xs font-medium">
                {t('profile.server')}
              </Text>
              <Text className="text-foreground text-base" numberOfLines={1}>
                {serverUrl ?? t('common.none')}
              </Text>
            </View>
          </View>
        </SurfaceRow>

        <ServerDiagnosticsCard />

        {user?.isSuperAdmin === true ? (
          <SurfaceRow className="gap-3" onPress={() => navigation.navigate('InstanceAdmin')}>
            <View className="flex-row items-start gap-3">
              <IconTile icon={ShieldCheck} tone="rose" />
              <View className="min-w-0 flex-1 gap-1">
                <Text className="text-muted-foreground text-xs font-medium">
                  {t('admin.kicker')}
                </Text>
                <Text className="text-foreground text-base font-semibold">
                  {t('admin.profileTitle')}
                </Text>
                <Text className="text-muted-foreground text-sm">{t('admin.profileSubtitle')}</Text>
              </View>
            </View>
          </SurfaceRow>
        ) : null}

        <SurfaceRow className="gap-3" onPress={() => navigation.navigate('DeveloperSettings')}>
          <View className="flex-row items-start gap-3">
            <IconTile icon={KeyRound} tone="indigo" />
            <View className="min-w-0 flex-1 gap-1">
              <Text className="text-muted-foreground text-xs font-medium">
                {t('developer.kicker')}
              </Text>
              <Text className="text-foreground text-base font-semibold">
                {t('developer.profileTitle')}
              </Text>
              <Text className="text-muted-foreground text-sm">
                {t('developer.profileSubtitle')}
              </Text>
            </View>
          </View>
        </SurfaceRow>

        <SurfaceRow className="gap-3" onPress={() => navigation.navigate('ApiDocs')}>
          <View className="flex-row items-start gap-3">
            <IconTile icon={FileJson} tone="blue" />
            <View className="min-w-0 flex-1 gap-1">
              <Text className="text-muted-foreground text-xs font-medium">
                {t('apiDocs.kicker')}
              </Text>
              <Text className="text-foreground text-base font-semibold">{t('apiDocs.title')}</Text>
              <Text className="text-muted-foreground text-sm">{t('apiDocs.profileSubtitle')}</Text>
            </View>
          </View>
        </SurfaceRow>

        <SurfaceRow
          className="gap-3"
          onPress={() => navigation.navigate('OrganizationSettings', { section: 'general' })}
        >
          <View className="flex-row items-start gap-3">
            <IconTile icon={Building2} tone="violet" />
            <View className="min-w-0 flex-1 gap-1">
              <Text className="text-muted-foreground text-xs font-medium">
                {t('organization.kicker')}
              </Text>
              <Text className="text-foreground text-base font-semibold">
                {t('organization.title')}
              </Text>
              <Text className="text-muted-foreground text-sm">
                {t('organization.profileSubtitle')}
              </Text>
            </View>
          </View>
        </SurfaceRow>

        <SurfaceRow className="gap-3" onPress={() => navigation.navigate('SsoSettings')}>
          <View className="flex-row items-start gap-3">
            <IconTile icon={ShieldCheck} tone="indigo" />
            <View className="min-w-0 flex-1 gap-1">
              <Text className="text-muted-foreground text-xs font-medium">{t('sso.kicker')}</Text>
              <Text className="text-foreground text-base font-semibold">{t('sso.title')}</Text>
              <Text className="text-muted-foreground text-sm">{t('sso.profileSubtitle')}</Text>
            </View>
          </View>
        </SurfaceRow>

        <SurfaceRow className="gap-3" onPress={() => navigation.navigate('AuditLogStreaming')}>
          <View className="flex-row items-start gap-3">
            <IconTile icon={RadioTower} tone="cyan" />
            <View className="min-w-0 flex-1 gap-1">
              <Text className="text-muted-foreground text-xs font-medium">
                {t('auditLogStreaming.kicker')}
              </Text>
              <Text className="text-foreground text-base font-semibold">
                {t('auditLogStreaming.title')}
              </Text>
              <Text className="text-muted-foreground text-sm">
                {t('auditLogStreaming.profileSubtitle')}
              </Text>
            </View>
          </View>
        </SurfaceRow>

        <SurfaceRow className="gap-3" onPress={() => navigation.navigate('LabelsSettings')}>
          <View className="flex-row items-start gap-3">
            <IconTile icon={Tags} tone="blue" />
            <View className="min-w-0 flex-1 gap-1">
              <Text className="text-muted-foreground text-xs font-medium">
                {t('settings.labels.kicker')}
              </Text>
              <Text className="text-foreground text-base font-semibold">
                {t('settings.labels.title')}
              </Text>
              <Text className="text-muted-foreground text-sm">
                {t('settings.labels.profileSubtitle')}
              </Text>
            </View>
          </View>
        </SurfaceRow>

        <SurfaceRow className="gap-3" onPress={() => navigation.navigate('AiTransparency')}>
          <View className="flex-row items-start gap-3">
            <IconTile icon={Sparkles} tone="indigo" />
            <View className="min-w-0 flex-1 gap-1">
              <Text className="text-muted-foreground text-xs font-medium">
                {t('aiTransparency.kicker')}
              </Text>
              <Text className="text-foreground text-base font-semibold">
                {t('aiTransparency.title')}
              </Text>
              <Text className="text-muted-foreground text-sm">
                {t('aiTransparency.profileSubtitle')}
              </Text>
            </View>
          </View>
        </SurfaceRow>

        <SurfaceRow className="gap-3" onPress={() => navigation.navigate('ImportSettings')}>
          <View className="flex-row items-start gap-3">
            <IconTile icon={UploadCloud} tone="cyan" />
            <View className="min-w-0 flex-1 gap-1">
              <Text className="text-muted-foreground text-xs font-medium">
                {t('importWizard.kicker')}
              </Text>
              <Text className="text-foreground text-base font-semibold">
                {t('importWizard.title')}
              </Text>
              <Text className="text-muted-foreground text-sm">
                {t('importWizard.profileSubtitle')}
              </Text>
            </View>
          </View>
        </SurfaceRow>

        <SurfaceRow className="gap-3" onPress={() => navigation.navigate('IntakeForms')}>
          <View className="flex-row items-start gap-3">
            <IconTile icon={ClipboardList} tone="cyan" />
            <View className="min-w-0 flex-1 gap-1">
              <Text className="text-muted-foreground text-xs font-medium">
                {t('intakeForms.kicker')}
              </Text>
              <Text className="text-foreground text-base font-semibold">
                {t('intakeForms.title')}
              </Text>
              <Text className="text-muted-foreground text-sm">
                {t('intakeForms.profileSubtitle')}
              </Text>
            </View>
          </View>
        </SurfaceRow>

        <SurfaceRow
          className="gap-4"
          onLayout={(event) => handleAppearanceLayout(event.nativeEvent.layout.y)}
        >
          <View className="flex-row items-start gap-3">
            <IconTile icon={Moon} tone="indigo" />
            <View className="min-w-0 flex-1 gap-1">
              <Text className="text-muted-foreground text-xs font-medium">
                {t('settings.appearance.kicker')}
              </Text>
              <Text className="text-foreground text-base font-semibold">
                {t('settings.appearance.title')}
              </Text>
              <Text className="text-muted-foreground text-sm">
                {t('settings.appearance.subtitle')}
              </Text>
            </View>
          </View>

          {appearanceQ.isLoading ? (
            <Text className="text-muted-foreground text-sm">
              {t('settings.appearance.skeleton_loading')}
            </Text>
          ) : null}

          {appearanceQ.isError ? (
            <View className="gap-2">
              <Text className="text-destructive text-sm">
                {appearanceQ.error instanceof Error
                  ? appearanceQ.error.message
                  : t('settings.appearance.load_error')}
              </Text>
              <Button
                title={t('common.retry')}
                variant="secondary"
                onPress={() => void appearanceQ.refetch()}
              />
            </View>
          ) : null}

          {appearanceDraft ? (
            <>
              <Text className="text-muted-foreground text-sm">
                {t('settings.appearance.sync_note')}
              </Text>

              <View style={styles.notificationSection}>
                <Text className="text-foreground text-sm font-semibold">
                  {t('settings.appearance.mode_heading')}
                </Text>
                <Text className="text-muted-foreground text-sm">
                  {t('settings.appearance.mode_desc')}
                </Text>
                <View style={styles.digestList}>
                  {APPEARANCE_THEME_OPTIONS.map((option) => (
                    <DigestPill
                      key={option.value}
                      label={t(option.labelKey)}
                      selected={appearanceDraft.theme === option.value}
                      onPress={() => updateAppearanceDraft('theme', option.value)}
                    />
                  ))}
                </View>
              </View>

              <View style={styles.notificationSection}>
                <Text className="text-foreground text-sm font-semibold">
                  {t('settings.appearance.color_theme_heading')}
                </Text>
                <Text className="text-muted-foreground text-sm">
                  {t('settings.appearance.color_theme_desc')}
                </Text>
                <View style={styles.colorThemeGrid}>
                  {APPEARANCE_COLOR_THEME_OPTIONS.map((option) => (
                    <ColorThemePill
                      key={option.value}
                      label={t(option.labelKey)}
                      swatches={option.swatches}
                      selected={appearanceDraft.colorTheme === option.value}
                      onPress={() => updateAppearanceDraft('colorTheme', option.value)}
                    />
                  ))}
                </View>
              </View>

              <View style={styles.notificationSection}>
                <Text className="text-foreground text-sm font-semibold">
                  {t('settings.appearance.visual_style_heading')}
                </Text>
                <Text className="text-muted-foreground text-sm">
                  {t('settings.appearance.visual_style_desc')}
                </Text>
                <View style={styles.digestList}>
                  {APPEARANCE_VISUAL_STYLE_OPTIONS.map((option) => (
                    <DigestPill
                      key={option.value}
                      label={t(option.labelKey)}
                      selected={appearanceDraft.visualStyle === option.value}
                      onPress={() => updateAppearanceDraft('visualStyle', option.value)}
                    />
                  ))}
                </View>
              </View>

              <View style={styles.notificationSection}>
                <Text className="text-foreground text-sm font-semibold">
                  {t('settings.appearance.font_heading')}
                </Text>
                <Text className="text-muted-foreground text-sm">
                  {t('settings.appearance.font_desc')}
                </Text>
                <View style={styles.digestList}>
                  {APPEARANCE_FONT_OPTIONS.map((option) => (
                    <DigestPill
                      key={option.value}
                      label={t(option.labelKey)}
                      selected={appearanceDraft.interfaceFont === option.value}
                      onPress={() => updateAppearanceDraft('interfaceFont', option.value)}
                    />
                  ))}
                </View>
              </View>

              <View style={styles.notificationSection}>
                <View style={styles.switchList}>
                  <SwitchRow
                    icon={Activity}
                    title={t('settings.appearance.animations_title')}
                    description={t('settings.appearance.animations_desc')}
                    selected={appearanceDraft.animationsEnabled}
                    onPress={() =>
                      updateAppearanceDraft('animationsEnabled', !appearanceDraft.animationsEnabled)
                    }
                  />
                  <SwitchRow
                    icon={Sparkles}
                    title={t('settings.appearance.gradients_title')}
                    description={t('settings.appearance.gradients_desc')}
                    selected={appearanceDraft.gradientsEnabled}
                    onPress={() =>
                      updateAppearanceDraft('gradientsEnabled', !appearanceDraft.gradientsEnabled)
                    }
                  />
                </View>
              </View>

              {appearanceError ? (
                <Text className="text-destructive text-sm">{appearanceError}</Text>
              ) : null}
              {appearanceMessage ? (
                <Text className="text-muted-foreground text-sm">{appearanceMessage}</Text>
              ) : null}
              <Button
                title={t('settings.appearance.save_changes')}
                icon={Save}
                loading={updateUserAppearance.isPending}
                disabled={updateUserAppearance.isPending}
                onPress={() => void saveAppearance()}
              />
            </>
          ) : null}
        </SurfaceRow>

        <SurfaceRow
          className="gap-4"
          onLayout={(event) => handleNotificationLayout(event.nativeEvent.layout.y)}
        >
          <View className="flex-row items-start gap-3">
            <IconTile icon={Bell} tone="cyan" />
            <View className="min-w-0 flex-1 gap-1">
              <Text className="text-muted-foreground text-xs font-medium">
                {t('settings.notifications.kicker')}
              </Text>
              <Text className="text-foreground text-base font-semibold">
                {t('settings.notifications.title')}
              </Text>
              <Text className="text-muted-foreground text-sm">
                {t('settings.notifications.subtitle')}
              </Text>
            </View>
          </View>

          <View className="gap-2">
            <Text className="text-foreground text-sm font-semibold">{t('team.workspace')}</Text>
            {organizationOptions.length > 0 ? (
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.workspaceList}
              >
                {organizationOptions.map((option, index) => (
                  <WorkspacePill
                    key={option.id}
                    index={index}
                    option={option}
                    selected={selectedOrganizationId === option.id}
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
          </View>

          {notificationPreferencesQ.isLoading ? (
            <Text className="text-muted-foreground text-sm">
              {t('settings.notifications.skeleton_loading')}
            </Text>
          ) : null}

          {notificationPreferencesQ.isError ? (
            <View className="gap-2">
              <Text className="text-destructive text-sm">
                {notificationPreferencesQ.error instanceof Error
                  ? notificationPreferencesQ.error.message
                  : t('settings.notifications.load_error')}
              </Text>
              <Button
                title={t('common.retry')}
                variant="secondary"
                onPress={() => void notificationPreferencesQ.refetch()}
              />
            </View>
          ) : null}

          {notificationDraft ? (
            <>
              <View style={styles.notificationSection}>
                <Text className="text-foreground text-sm font-semibold">
                  {t('settings.notifications.channels_heading')}
                </Text>
                <Text className="text-muted-foreground text-sm">
                  {t('settings.notifications.channels_desc')}
                </Text>
                <View style={styles.switchList}>
                  <SwitchRow
                    icon={Smartphone}
                    title={t('settings.notifications.channel_inapp_title')}
                    description={t('settings.notifications.channel_inapp_desc')}
                    selected={notificationDraft.enableInApp}
                    onPress={() => toggleNotificationDraft('enableInApp')}
                  />
                  <SwitchRow
                    icon={Mail}
                    title={t('settings.notifications.channel_email_title')}
                    description={t('settings.notifications.channel_email_desc')}
                    selected={notificationDraft.enableEmail}
                    onPress={() => toggleNotificationDraft('enableEmail')}
                  />
                </View>
              </View>

              <View style={styles.notificationSection}>
                <Text className="text-foreground text-sm font-semibold">
                  {t('settings.notifications.digest_heading')}
                </Text>
                <Text className="text-muted-foreground text-sm">
                  {t('settings.notifications.digest_desc')}
                </Text>
                <View style={styles.digestList}>
                  {DIGEST_OPTIONS.map((option) => (
                    <DigestPill
                      key={option}
                      label={t(`settings.notifications.digest_${option}`)}
                      selected={notificationDraft.digestFrequency === option}
                      disabled={!notificationDraft.enableEmail}
                      onPress={() => setDigestFrequency(option)}
                    />
                  ))}
                </View>
              </View>

              <View style={styles.notificationSection}>
                <SwitchRow
                  icon={Moon}
                  title={t('settings.notifications.dnd_heading')}
                  description={t('settings.notifications.dnd_desc')}
                  selected={notificationDraft.doNotDisturb}
                  disabled={!notificationDraft.enableEmail}
                  onPress={() => toggleNotificationDraft('doNotDisturb')}
                />
                <View style={styles.quietHoursGrid}>
                  <View style={styles.quietHoursField}>
                    <TextField
                      label={t('settings.notifications.dnd_from')}
                      placeholder={t('settings.notifications.quiet_start_placeholder')}
                      value={notificationDraft.doNotDisturbStart ?? ''}
                      editable={notificationDraft.doNotDisturb && notificationDraft.enableEmail}
                      onChangeText={(value) =>
                        updateNotificationDraft('doNotDisturbStart', value || null)
                      }
                      error={
                        notificationDraft.doNotDisturb &&
                        !isValidQuietTime(notificationDraft.doNotDisturbStart)
                          ? t('validation.invalidField')
                          : undefined
                      }
                      keyboardType="numbers-and-punctuation"
                    />
                  </View>
                  <View style={styles.quietHoursField}>
                    <TextField
                      label={t('settings.notifications.dnd_to')}
                      placeholder={t('settings.notifications.quiet_end_placeholder')}
                      value={notificationDraft.doNotDisturbEnd ?? ''}
                      editable={notificationDraft.doNotDisturb && notificationDraft.enableEmail}
                      onChangeText={(value) =>
                        updateNotificationDraft('doNotDisturbEnd', value || null)
                      }
                      error={
                        notificationDraft.doNotDisturb &&
                        !isValidQuietTime(notificationDraft.doNotDisturbEnd)
                          ? t('validation.invalidField')
                          : undefined
                      }
                      keyboardType="numbers-and-punctuation"
                    />
                  </View>
                </View>
                <Text className="text-muted-foreground text-xs">
                  {t('settings.notifications.quiet_hours_note')}
                </Text>
              </View>

              <View style={styles.notificationSection}>
                <Text className="text-foreground text-sm font-semibold">
                  {t('settings.notifications.events_heading')}
                </Text>
                <Text className="text-muted-foreground text-sm">
                  {t('settings.notifications.events_desc')}
                </Text>
                <View style={styles.eventHeader}>
                  <View className="flex-1" />
                  <Text style={styles.eventHeaderLabel}>
                    {t('settings.notifications.col_email')}
                  </Text>
                  <Text style={styles.eventHeaderLabel}>
                    {t('settings.notifications.col_inapp')}
                  </Text>
                </View>
                {NOTIFICATION_EVENT_GROUPS.map((group) => (
                  <View key={group.titleKey} style={styles.eventGroup}>
                    <Text className="text-muted-foreground text-xs font-semibold">
                      {t(group.titleKey)}
                    </Text>
                    {group.rows.map((row) => {
                      const label = t(row.labelKey);
                      return (
                        <View key={row.labelKey} style={styles.eventRow}>
                          <View className="min-w-0 flex-1 gap-0.5">
                            <Text
                              className="text-foreground text-sm font-semibold"
                              numberOfLines={2}
                            >
                              {label}
                            </Text>
                            <Text className="text-muted-foreground text-xs" numberOfLines={2}>
                              {t(row.descKey)}
                            </Text>
                          </View>
                          <View style={styles.eventActions}>
                            <ChannelToggle
                              label={t('settings.notifications.col_email')}
                              selected={Boolean(notificationDraft[row.emailKey])}
                              disabled={!notificationDraft.enableEmail}
                              onPress={() => toggleNotificationDraft(row.emailKey)}
                              accessibilityLabel={`${t('settings.notifications.col_email')}: ${label}`}
                            />
                            <ChannelToggle
                              label={t('settings.notifications.col_inapp')}
                              selected={Boolean(notificationDraft[row.inAppKey])}
                              disabled={!notificationDraft.enableInApp}
                              onPress={() => toggleNotificationDraft(row.inAppKey)}
                              accessibilityLabel={`${t('settings.notifications.col_inapp')}: ${label}`}
                            />
                          </View>
                        </View>
                      );
                    })}
                  </View>
                ))}
              </View>

              {notificationError ? (
                <Text className="text-destructive text-sm">{notificationError}</Text>
              ) : null}
              {notificationMessage ? (
                <Text className="text-muted-foreground text-sm">{notificationMessage}</Text>
              ) : null}
              <Button
                title={t('settings.notifications.save_changes')}
                icon={Save}
                loading={updateNotificationPreferences.isPending}
                disabled={!selectedOrganizationId || updateNotificationPreferences.isPending}
                onPress={() => void saveNotificationPreferences()}
              />
            </>
          ) : null}
        </SurfaceRow>

        <SurfaceRow className="gap-3">
          <View className="flex-row items-start gap-3">
            <IconTile icon={Languages} tone="violet" />
            <View className="flex-1 gap-1">
              <Text className="text-muted-foreground text-xs font-medium">
                {t('profile.language')}
              </Text>
              <Text className="text-foreground text-base">
                {localeLabels[storedLocale ?? currentLocale]}
              </Text>
              <Text className="text-muted-foreground text-sm">{t('profile.languageSubtitle')}</Text>
            </View>
          </View>
          <View style={styles.languageGrid}>
            <LanguagePill
              label={t('profile.deviceLanguage')}
              selected={!storedLocale}
              onPress={() => selectLocale(null)}
            />
            {locales.map((locale) => (
              <LanguagePill
                key={locale}
                label={localeLabels[locale]}
                selected={storedLocale === locale}
                onPress={() => selectLocale(locale)}
              />
            ))}
          </View>
        </SurfaceRow>

        <View className="gap-3">
          <Button
            title={t('profile.switchServer')}
            variant="secondary"
            icon={Server}
            onPress={() => void forgetServer()}
          />
          <Button
            title={t('profile.signOut')}
            variant="destructive"
            icon={LogOut}
            onPress={() => void signOut()}
          />
        </View>

        <Text className="text-muted-foreground text-center text-xs">
          {t('profile.version')} {config.appVersion}
        </Text>
      </ScrollView>
    </Screen>
  );
}

function createProfileStyles(colors: ThemeColors) {
  return StyleSheet.create({
    workspaceList: {
      gap: 8,
      paddingRight: 4,
    },
    workspacePill: {
      minWidth: 164,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
      borderRadius: 6,
      backgroundColor: colors.card,
      paddingHorizontal: 12,
      paddingVertical: 10,
    },
    workspacePillActive: {
      borderColor: colors.primary,
      backgroundColor: `${colors.primary}14`,
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
    workspaceMetaRow: {
      marginTop: 3,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
    },
    workspaceMeta: {
      color: colors.mutedForeground,
      fontSize: 11,
      fontWeight: '600',
      lineHeight: 15,
    },
    workspaceMetaActive: {
      color: colors.foreground,
    },
    workspaceMetaDot: {
      width: 3,
      height: 3,
      borderRadius: 999,
      backgroundColor: colors.mutedForeground,
    },
    workspaceMetaDotActive: {
      backgroundColor: colors.primary,
    },
    inlineNotice: {
      gap: 4,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
      borderRadius: 6,
      padding: 12,
    },
    healthTitleRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      alignItems: 'center',
      gap: 8,
    },
    healthMetrics: {
      flexDirection: 'row',
      gap: 8,
    },
    healthMetric: {
      minWidth: 0,
      flex: 1,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
      borderRadius: 6,
      backgroundColor: colors.surface,
      paddingHorizontal: 10,
      paddingVertical: 9,
    },
    healthMetricLabel: {
      color: colors.mutedForeground,
      fontSize: 11,
      fontWeight: '700',
      lineHeight: 15,
    },
    healthMetricValue: {
      marginTop: 2,
      color: colors.foreground,
      fontSize: 14,
      fontWeight: '700',
      lineHeight: 19,
    },
    healthChecks: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 8,
    },
    healthCheck: {
      minWidth: 128,
      flexGrow: 1,
      flexBasis: '30%',
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 8,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
      borderRadius: 6,
      paddingHorizontal: 10,
      paddingVertical: 8,
    },
    healthCheckLabel: {
      minWidth: 0,
      flex: 1,
      color: colors.foreground,
      fontSize: 12,
      fontWeight: '700',
      lineHeight: 16,
    },
    notificationSection: {
      gap: 8,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: colors.border,
      paddingTop: 12,
    },
    switchList: {
      gap: 8,
    },
    switchRow: {
      minHeight: 64,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
      borderRadius: 6,
      paddingHorizontal: 10,
      paddingVertical: 9,
    },
    switchRowActive: {
      borderColor: `${colors.primary}66`,
      backgroundColor: `${colors.primary}0D`,
    },
    switchIcon: {
      width: 28,
      height: 28,
      alignItems: 'center',
      justifyContent: 'center',
      borderRadius: 4,
      backgroundColor: colors.muted,
    },
    switchKnob: {
      width: 22,
      height: 22,
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
      borderRadius: 4,
      backgroundColor: colors.card,
    },
    switchKnobActive: {
      borderColor: colors.primary,
      backgroundColor: colors.primary,
    },
    digestList: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 8,
    },
    digestPill: {
      minWidth: 92,
      alignItems: 'center',
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
      borderRadius: 4,
      backgroundColor: colors.card,
      paddingHorizontal: 10,
      paddingVertical: 8,
    },
    digestPillActive: {
      borderColor: colors.primary,
      backgroundColor: colors.primary,
    },
    digestPillText: {
      color: colors.mutedForeground,
      fontSize: 12,
      fontWeight: '700',
      lineHeight: 16,
      textAlign: 'center',
    },
    digestPillTextActive: {
      color: colors.primaryForeground,
    },
    colorThemeGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 8,
    },
    colorThemePill: {
      width: 104,
      minHeight: 72,
      justifyContent: 'space-between',
      gap: 8,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
      borderRadius: 6,
      backgroundColor: colors.card,
      paddingHorizontal: 10,
      paddingVertical: 9,
    },
    colorThemePillActive: {
      borderColor: colors.primary,
      backgroundColor: `${colors.primary}14`,
    },
    colorThemeSwatches: {
      flexDirection: 'row',
      gap: 5,
    },
    colorThemeSwatch: {
      height: 18,
      flex: 1,
      borderRadius: 4,
    },
    colorThemeText: {
      color: colors.mutedForeground,
      fontSize: 12,
      fontWeight: '700',
      lineHeight: 16,
      textAlign: 'center',
    },
    colorThemeTextActive: {
      color: colors.primary,
    },
    quietHoursGrid: {
      flexDirection: 'row',
      gap: 8,
    },
    quietHoursField: {
      minWidth: 0,
      flex: 1,
    },
    eventHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
    },
    eventHeaderLabel: {
      width: 62,
      color: colors.mutedForeground,
      fontSize: 11,
      fontWeight: '700',
      lineHeight: 15,
      textAlign: 'center',
    },
    eventGroup: {
      gap: 8,
    },
    eventRow: {
      minHeight: 58,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: colors.border,
      paddingBottom: 8,
    },
    eventActions: {
      flexDirection: 'row',
      gap: 8,
    },
    channelToggle: {
      width: 62,
      minHeight: 34,
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
      borderRadius: 4,
      backgroundColor: colors.card,
      paddingHorizontal: 4,
    },
    channelToggleActive: {
      borderColor: colors.primary,
      backgroundColor: colors.primary,
    },
    channelToggleText: {
      color: colors.mutedForeground,
      fontSize: 10,
      fontWeight: '800',
      lineHeight: 13,
      textAlign: 'center',
    },
    channelToggleTextActive: {
      color: colors.primaryForeground,
    },
    disabled: {
      opacity: 0.45,
    },
    languageGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 8,
    },
    languagePill: {
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
      borderRadius: 4,
      backgroundColor: colors.card,
      paddingHorizontal: 10,
      paddingVertical: 7,
    },
    languagePillActive: {
      borderColor: colors.primary,
      backgroundColor: colors.primary,
    },
    languagePillText: {
      color: colors.mutedForeground,
      fontSize: 12,
      fontWeight: '600',
      lineHeight: 16,
    },
    languagePillTextActive: {
      color: colors.primaryForeground,
    },
  });
}
