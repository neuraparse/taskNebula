import { Alert, Image, Linking } from 'react-native';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from '@/components/native';
import {
  AlertTriangle,
  Building2,
  Check,
  KeyRound,
  Layers3,
  MessageSquareText,
  Pencil,
  Plus,
  Radio,
  Save,
  Shield,
  Trash2,
  UserPlus,
  Users,
  Wifi,
  WifiOff,
  X,
} from 'lucide-react-native';
import type { LucideIcon } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';

import type {
  Organization,
  OrganizationMember,
  Teamspace,
  TeamspaceMember,
  WorkspaceIntegrationProvider,
  WorkspaceIntegrationStatus,
  WorkspaceCommunicationsSettings,
} from '@/api/types';
import {
  Avatar,
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
  useAddTeamspaceMember,
  useCreateTeamspace,
  useDeleteOrganization,
  useConnectWorkspaceIntegration,
  useDisconnectWorkspaceIntegration,
  useDeleteTeamspace,
  useOrganization,
  useOrganizationMembers,
  useOrganizations,
  useRemoveTeamspaceMember,
  useTeamspaceMembers,
  useTeamspaces,
  useUpdateOrganization,
  useUpdateWorkspaceCommunicationsSettings,
  useWorkspaceIntegrations,
  useWorkspaceCommunicationsSettings,
  useUpdateTeamspaceMember,
  useUpdateTeamspace,
} from '@/hooks/queries';
import { formatLocalizedDateTime, initials } from '@/lib/format';
import { useSession } from '@/stores/session';
import type { AppStackParamList, OrganizationSettingsSection } from '@/navigation/types';

type OrganizationSettingsProps = NativeStackScreenProps<AppStackParamList, 'OrganizationSettings'>;
type OrganizationSection = OrganizationSettingsSection;
type CommunicationToggleKey = keyof WorkspaceCommunicationsSettings;
type OrganizationSettingsStyles = ReturnType<typeof createOrganizationSettingsStyles>;

const SECTIONS: OrganizationSection[] = [
  'general',
  'teamspaces',
  'communications',
  'integrations',
  'danger',
];
const COMMUNICATION_TOGGLES: Array<{
  key: CommunicationToggleKey;
  icon: LucideIcon;
  labelKey: string;
  descriptionKey: string;
}> = [
  {
    key: 'enabled',
    icon: MessageSquareText,
    labelKey: 'organization.communications.toggle.enabled.label',
    descriptionKey: 'organization.communications.toggle.enabled.description',
  },
  {
    key: 'voiceEnabled',
    icon: Radio,
    labelKey: 'organization.communications.toggle.voice.label',
    descriptionKey: 'organization.communications.toggle.voice.description',
  },
  {
    key: 'issueThreadsEnabled',
    icon: MessageSquareText,
    labelKey: 'organization.communications.toggle.issueThreads.label',
    descriptionKey: 'organization.communications.toggle.issueThreads.description',
  },
  {
    key: 'documentThreadsEnabled',
    icon: MessageSquareText,
    labelKey: 'organization.communications.toggle.documentThreads.label',
    descriptionKey: 'organization.communications.toggle.documentThreads.description',
  },
  {
    key: 'attachmentsEnabled',
    icon: Plus,
    labelKey: 'organization.communications.toggle.attachments.label',
    descriptionKey: 'organization.communications.toggle.attachments.description',
  },
  {
    key: 'unreadTrackingEnabled',
    icon: Check,
    labelKey: 'organization.communications.toggle.unreadTracking.label',
    descriptionKey: 'organization.communications.toggle.unreadTracking.description',
  },
];
const INTEGRATION_PROVIDERS: Array<{
  provider: WorkspaceIntegrationProvider;
  labelKey: string;
  descriptionKey: string;
}> = [
  {
    provider: 'github',
    labelKey: 'organization.integrations.providers.github',
    descriptionKey: 'organization.integrations.descriptions.github',
  },
  {
    provider: 'gitlab',
    labelKey: 'organization.integrations.providers.gitlab',
    descriptionKey: 'organization.integrations.descriptions.gitlab',
  },
  {
    provider: 'jira',
    labelKey: 'organization.integrations.providers.jira',
    descriptionKey: 'organization.integrations.descriptions.jira',
  },
  {
    provider: 'sentry',
    labelKey: 'organization.integrations.providers.sentry',
    descriptionKey: 'organization.integrations.descriptions.sentry',
  },
  {
    provider: 'slack',
    labelKey: 'organization.integrations.providers.slack',
    descriptionKey: 'organization.integrations.descriptions.slack',
  },
];

function useOrganizationSettingsTheme(): {
  colors: ThemeColors;
  styles: OrganizationSettingsStyles;
} {
  const colors = useThemeColors();
  const styles = useMemo(() => createOrganizationSettingsStyles(colors), [colors]);

  return { colors, styles };
}

function shortId(id: string): string {
  return id.length > 10 ? `${id.slice(0, 6)}...${id.slice(-4)}` : id;
}

function slugify(value: string): string {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 100);
}

function organizationSectionLabelKey(section: OrganizationSection): string {
  if (section === 'teamspaces') return 'organization.tabs.teamspaces';
  if (section === 'communications') return 'organization.tabs.communications';
  if (section === 'integrations') return 'organization.tabs.integrations';
  if (section === 'danger') return 'organization.tabs.danger';
  return 'organization.tabs.general';
}

function roleLabel(role: string | null | undefined, t: ReturnType<typeof useTranslation>['t']) {
  if (role === 'owner') return t('team.role.owner');
  if (role === 'admin') return t('team.role.admin');
  if (role === 'member') return t('team.role.member');
  if (role === 'viewer') return t('team.role.viewer');
  if (role === 'guest') return t('team.role.guest');
  return role || t('team.role.member');
}

function planLabel(plan: string, t: ReturnType<typeof useTranslation>['t']) {
  if (plan === 'starter') return t('organization.plan.starter');
  if (plan === 'growth') return t('organization.plan.growth');
  if (plan === 'enterprise') return t('organization.plan.enterprise');
  return t('organization.plan.free');
}

function statusLabel(status: string, t: ReturnType<typeof useTranslation>['t']) {
  if (status === 'trial') return t('organization.status.trial');
  if (status === 'suspended') return t('organization.status.suspended');
  return t('organization.status.active');
}

function statusTone(status: string): 'emerald' | 'amber' | 'rose' {
  if (status === 'trial') return 'amber';
  if (status === 'suspended') return 'rose';
  return 'emerald';
}

function roleTone(
  role: string | null | undefined,
): 'violet' | 'blue' | 'emerald' | 'amber' | 'neutral' {
  if (role === 'owner') return 'violet';
  if (role === 'admin') return 'blue';
  if (role === 'member') return 'emerald';
  if (role === 'viewer') return 'amber';
  return 'neutral';
}

function teamspaceRoleLabel(role: string, t: ReturnType<typeof useTranslation>['t']): string {
  if (role === 'lead') return t('organization.teamspaces.members.roleLead');
  return t('organization.teamspaces.members.roleMember');
}

function teamspaceRoleTone(role: string): 'violet' | 'emerald' {
  return role === 'lead' ? 'violet' : 'emerald';
}

function formatUpdatedAt(
  value: string | undefined,
  t: ReturnType<typeof useTranslation>['t'],
): string {
  const date = formatLocalizedDateTime(value);
  return date ? t('organization.updatedAt', { date }) : t('organization.updatedUnknown');
}

function SectionButton({
  section,
  selected,
  onPress,
}: {
  section: OrganizationSection;
  selected: boolean;
  onPress: (section: OrganizationSection) => void;
}) {
  const { t } = useTranslation();
  const { styles } = useOrganizationSettingsTheme();

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected }}
      onPress={() => onPress(section)}
      style={[styles.segmentButton, selected ? styles.segmentButtonActive : null]}
      className="active:opacity-80"
    >
      <Text style={[styles.segmentText, selected ? styles.segmentTextActive : null]}>
        {t(organizationSectionLabelKey(section))}
      </Text>
    </Pressable>
  );
}

function OrganizationPill({
  organization,
  selected,
  onPress,
}: {
  organization: Organization;
  selected: boolean;
  onPress: (id: string) => void;
}) {
  const { styles } = useOrganizationSettingsTheme();

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected }}
      onPress={() => onPress(organization.id)}
      style={[styles.orgPill, selected ? styles.orgPillActive : null]}
      className="active:opacity-80"
    >
      <Text style={[styles.orgTitle, selected ? styles.orgTitleActive : null]} numberOfLines={1}>
        {organization.name}
      </Text>
      <Text style={[styles.orgMeta, selected ? styles.orgMetaActive : null]} numberOfLines={1}>
        {organization.slug || shortId(organization.id)}
      </Text>
    </Pressable>
  );
}

function LogoPreview({
  url,
  fallbackIcon: FallbackIcon,
}: {
  url: string | null | undefined;
  fallbackIcon: LucideIcon;
}) {
  const { colors, styles } = useOrganizationSettingsTheme();

  return (
    <View style={styles.logoPreview}>
      {url ? (
        <Image source={{ uri: url }} style={styles.logoImage} />
      ) : (
        <FallbackIcon size={20} color={colors.mutedForeground} />
      )}
    </View>
  );
}

function StatItem({
  icon: Icon,
  label,
  value,
}: {
  icon: LucideIcon;
  label: string;
  value: number;
}) {
  const { colors, styles } = useOrganizationSettingsTheme();

  return (
    <View style={styles.statItem}>
      <Icon size={15} color={colors.mutedForeground} />
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

function CommunicationToggleRow({
  label,
  description,
  selected,
  disabled,
  icon: Icon,
  onPress,
}: {
  label: string;
  description: string;
  selected: boolean;
  disabled: boolean;
  icon: LucideIcon;
  onPress: () => void;
}) {
  const { colors, styles } = useOrganizationSettingsTheme();

  return (
    <Pressable
      accessibilityRole="switch"
      accessibilityState={{ checked: selected, disabled }}
      disabled={disabled}
      onPress={onPress}
      style={[
        styles.communicationToggle,
        selected ? styles.communicationToggleActive : null,
        disabled ? styles.disabled : null,
      ]}
      className="active:opacity-80"
    >
      <View style={styles.communicationToggleIcon}>
        <Icon size={17} color={selected ? colors.primary : colors.mutedForeground} />
      </View>
      <View style={styles.communicationToggleCopy}>
        <Text style={styles.communicationToggleTitle} numberOfLines={2}>
          {label}
        </Text>
        <Text style={styles.communicationToggleDescription} numberOfLines={3}>
          {description}
        </Text>
      </View>
      <View
        style={[styles.communicationSwitch, selected ? styles.communicationSwitchActive : null]}
      >
        {selected ? <Check size={13} color={colors.primaryForeground} /> : null}
      </View>
    </Pressable>
  );
}

function CommunicationServiceRow({
  icon: Icon,
  title,
  description,
  badgeLabel,
  ready,
}: {
  icon: LucideIcon;
  title: string;
  description: string;
  badgeLabel: string;
  ready: boolean;
}) {
  const { colors, styles } = useOrganizationSettingsTheme();

  return (
    <View style={styles.communicationServiceRow}>
      <Icon size={17} color={ready ? colors.success : colors.warning} />
      <View style={styles.communicationToggleCopy}>
        <Text style={styles.communicationServiceTitle}>{title}</Text>
        <Text style={styles.communicationToggleDescription}>{description}</Text>
      </View>
      <SemanticBadge label={badgeLabel} tone={ready ? 'emerald' : 'amber'} />
    </View>
  );
}

function IntegrationStatusRow({
  status,
  canManage,
  isMutating,
  onDisconnect,
  onConnect,
}: {
  status: WorkspaceIntegrationStatus;
  canManage: boolean;
  isMutating: boolean;
  onDisconnect: (status: WorkspaceIntegrationStatus) => void;
  onConnect: (status: WorkspaceIntegrationStatus) => void;
}) {
  const { t } = useTranslation();
  const { colors, styles } = useOrganizationSettingsTheme();
  const meta = INTEGRATION_PROVIDERS.find((item) => item.provider === status.provider);
  const label = t(meta?.labelKey ?? 'organization.integrations.providers.github');
  const connection = status.connection;
  const accountLabel =
    connection?.siteName ??
    connection?.externalAccountLabel ??
    connection?.externalAccountId ??
    t('common.none');
  const updatedAt = connection?.updatedAt ?? connection?.createdAt ?? null;
  const updatedAtLabel = formatLocalizedDateTime(updatedAt);

  return (
    <View style={styles.integrationRow}>
      <View style={styles.integrationHeader}>
        <View
          style={[
            styles.integrationIcon,
            status.connected ? styles.integrationIconConnected : null,
          ]}
        >
          {status.connected ? (
            <Wifi size={17} color={colors.success} />
          ) : (
            <WifiOff size={17} color={colors.mutedForeground} />
          )}
        </View>
        <View style={styles.integrationCopy}>
          <View style={styles.integrationTitleRow}>
            <Text style={styles.integrationTitle}>{label}</Text>
            <SemanticBadge
              label={
                status.connected
                  ? t('organization.integrations.connected')
                  : t('organization.integrations.disconnected')
              }
              tone={status.connected ? 'emerald' : 'neutral'}
            />
          </View>
          <Text style={styles.communicationToggleDescription}>
            {t(meta?.descriptionKey ?? 'organization.integrations.descriptions.github')}
          </Text>
          {status.connected ? (
            <Text style={styles.helperText} numberOfLines={2}>
              {t('organization.integrations.account', { label: accountLabel })}
            </Text>
          ) : null}
          {updatedAtLabel ? (
            <Text style={styles.helperText} numberOfLines={1}>
              {t('organization.integrations.updatedAt', {
                date: updatedAtLabel,
              })}
            </Text>
          ) : null}
        </View>
      </View>
      <View style={styles.inlineActions}>
        {status.connected ? (
          <Button
            title={t('organization.integrations.disconnect')}
            icon={Trash2}
            variant="destructive"
            disabled={!canManage || isMutating}
            loading={isMutating}
            onPress={() => onDisconnect(status)}
            style={styles.inlineActionButton}
          />
        ) : (
          <Button
            title={t('organization.integrations.connect')}
            icon={Wifi}
            disabled={!canManage || isMutating}
            loading={isMutating}
            onPress={() => onConnect(status)}
            style={styles.inlineActionButton}
          />
        )}
      </View>
    </View>
  );
}

function TeamspaceCard({
  teamspace,
  canManage,
  onEdit,
  onManageMembers,
  onDelete,
}: {
  teamspace: Teamspace;
  canManage: boolean;
  onEdit: () => void;
  onManageMembers: () => void;
  onDelete: () => void;
}) {
  const { t } = useTranslation();
  const { styles } = useOrganizationSettingsTheme();
  const leadName = teamspace.lead?.name || teamspace.lead?.email || null;

  return (
    <SurfaceRow className="gap-3">
      <View style={styles.teamspaceHeader}>
        <LogoPreview url={teamspace.avatarUrl} fallbackIcon={Shield} />
        <View style={styles.teamspaceCopy}>
          <View style={styles.teamspaceTitleRow}>
            <Text style={styles.teamspaceName} numberOfLines={1}>
              {teamspace.name}
            </Text>
            {teamspace.currentUserRole ? (
              <SemanticBadge
                label={t('organization.teamspaces.role', {
                  role: teamspace.currentUserRole,
                })}
                tone="blue"
              />
            ) : null}
          </View>
          <Text style={styles.teamspaceSlug} numberOfLines={1}>
            {teamspace.slug}
          </Text>
          {teamspace.description ? (
            <Text style={styles.teamspaceDescription} numberOfLines={2}>
              {teamspace.description}
            </Text>
          ) : null}
          <View style={styles.teamspaceMetaRow}>
            <Text style={styles.teamspaceMeta}>
              {t('organization.teamspaces.memberCount', { count: teamspace.memberCount ?? 0 })}
            </Text>
            <Text style={styles.teamspaceMeta}>
              {t('organization.teamspaces.projectCount', { count: teamspace.projectCount ?? 0 })}
            </Text>
            {leadName ? (
              <Text style={styles.teamspaceMeta} numberOfLines={1}>
                {t('organization.teamspaces.lead', { name: leadName })}
              </Text>
            ) : null}
          </View>
        </View>
      </View>

      <View style={styles.inlineActions}>
        <Button
          title={t('organization.teamspaces.members.action')}
          icon={Users}
          variant="secondary"
          onPress={onManageMembers}
          style={styles.inlineActionButton}
        />
        {canManage ? (
          <>
            <Button
              title={t('common.edit')}
              icon={Pencil}
              variant="secondary"
              onPress={onEdit}
              style={styles.inlineActionButton}
            />
            <Button
              title={t('organization.deleteAction')}
              icon={Trash2}
              variant="destructive"
              onPress={onDelete}
              style={styles.inlineActionButton}
            />
          </>
        ) : null}
      </View>
    </SurfaceRow>
  );
}

function MemberRolePill({
  role,
  selected,
  disabled,
  onPress,
}: {
  role: 'lead' | 'member';
  selected: boolean;
  disabled?: boolean;
  onPress: (role: 'lead' | 'member') => void;
}) {
  const { t } = useTranslation();
  const { styles } = useOrganizationSettingsTheme();

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected, disabled }}
      disabled={disabled}
      onPress={() => onPress(role)}
      style={[
        styles.rolePill,
        selected ? styles.rolePillActive : null,
        disabled ? styles.disabled : null,
      ]}
      className="active:opacity-80"
    >
      <Text style={[styles.rolePillText, selected ? styles.rolePillTextActive : null]}>
        {teamspaceRoleLabel(role, t)}
      </Text>
    </Pressable>
  );
}

function OrganizationMemberPill({
  member,
  selected,
  disabled,
  onPress,
}: {
  member: OrganizationMember;
  selected: boolean;
  disabled?: boolean;
  onPress: (id: string) => void;
}) {
  const { styles } = useOrganizationSettingsTheme();

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected, disabled }}
      disabled={disabled}
      onPress={() => onPress(member.id)}
      style={[
        styles.memberPickerPill,
        selected ? styles.memberPickerPillActive : null,
        disabled ? styles.disabled : null,
      ]}
      className="active:opacity-80"
    >
      <Avatar initials={initials(member.name, member.email)} size={28} />
      <View style={styles.memberPickerCopy}>
        <Text style={styles.memberPickerName} numberOfLines={1}>
          {member.name || member.email}
        </Text>
        <Text style={styles.memberPickerEmail} numberOfLines={1}>
          {member.email}
        </Text>
      </View>
    </Pressable>
  );
}

function TeamspaceMemberRow({
  member,
  canManage,
  isCurrentUser,
  isMutating,
  onChangeRole,
  onRemove,
}: {
  member: TeamspaceMember;
  canManage: boolean;
  isCurrentUser: boolean;
  isMutating: boolean;
  onChangeRole: (member: TeamspaceMember, role: 'lead' | 'member') => void;
  onRemove: (member: TeamspaceMember) => void;
}) {
  const { t } = useTranslation();
  const { styles } = useOrganizationSettingsTheme();

  return (
    <View style={styles.memberRow}>
      <View style={styles.memberIdentity}>
        <Avatar initials={initials(member.name, member.email)} size={36} />
        <View style={styles.memberCopy}>
          <Text style={styles.memberName} numberOfLines={1}>
            {member.name || member.email}
          </Text>
          <Text style={styles.memberEmail} numberOfLines={1}>
            {member.email}
          </Text>
        </View>
      </View>
      <View style={styles.memberActions}>
        <SemanticBadge
          label={teamspaceRoleLabel(member.teamRole, t)}
          tone={teamspaceRoleTone(member.teamRole)}
        />
        {canManage ? (
          <View style={styles.memberRoleActions}>
            <Button
              title={t('organization.teamspaces.members.setLead')}
              variant={member.teamRole === 'lead' ? 'primary' : 'secondary'}
              disabled={isMutating || member.teamRole === 'lead'}
              onPress={() => onChangeRole(member, 'lead')}
              style={styles.memberRoleButton}
            />
            <Button
              title={t('organization.teamspaces.members.setMember')}
              variant={member.teamRole === 'member' ? 'primary' : 'secondary'}
              disabled={isMutating || member.teamRole === 'member'}
              onPress={() => onChangeRole(member, 'member')}
              style={styles.memberRoleButton}
            />
            <Button
              title={
                isCurrentUser
                  ? t('organization.teamspaces.members.self')
                  : t('organization.teamspaces.members.remove')
              }
              icon={Trash2}
              variant="destructive"
              disabled={isMutating || isCurrentUser}
              onPress={() => onRemove(member)}
              style={styles.memberRoleButton}
            />
          </View>
        ) : null}
      </View>
    </View>
  );
}

export function OrganizationSettingsScreen({ route }: OrganizationSettingsProps) {
  const { t } = useTranslation();
  const { styles } = useOrganizationSettingsTheme();
  const currentUserId = useSession((state) => state.user?.id ?? null);
  const organizationsQ = useOrganizations();
  const organizations = useMemo(
    () => organizationsQ.data?.organizations ?? [],
    [organizationsQ.data],
  );
  const [selectedOrganizationId, setSelectedOrganizationId] = useState<string | null>(null);
  const [section, setSection] = useState<OrganizationSection>(route.params?.section ?? 'general');
  const activeOrganizationId = selectedOrganizationId ?? organizations[0]?.id ?? null;
  const organizationQ = useOrganization(activeOrganizationId);
  const teamspacesQ = useTeamspaces(activeOrganizationId);
  const communicationsQ = useWorkspaceCommunicationsSettings(activeOrganizationId);
  const integrationsQ = useWorkspaceIntegrations(activeOrganizationId);
  const updateOrganization = useUpdateOrganization(activeOrganizationId);
  const updateCommunications = useUpdateWorkspaceCommunicationsSettings(activeOrganizationId);
  const connectIntegration = useConnectWorkspaceIntegration(activeOrganizationId);
  const disconnectIntegration = useDisconnectWorkspaceIntegration(activeOrganizationId);
  const deleteOrganization = useDeleteOrganization(activeOrganizationId);
  const createTeamspace = useCreateTeamspace(activeOrganizationId);
  const updateTeamspace = useUpdateTeamspace(activeOrganizationId);
  const deleteTeamspace = useDeleteTeamspace(activeOrganizationId);

  const organization =
    organizationQ.data ?? organizations.find((item) => item.id === activeOrganizationId) ?? null;
  const canManageSettings =
    organization?.userRole === 'owner' ||
    organization?.userRole === 'admin' ||
    organization?.role === 'owner' ||
    organization?.role === 'admin' ||
    Boolean(organization?.isSuperAdmin);
  const canDeleteOrganization =
    organization?.userRole === 'owner' ||
    organization?.role === 'owner' ||
    Boolean(organization?.isSuperAdmin);

  const [name, setName] = useState('');
  const [domain, setDomain] = useState('');
  const [logoUrl, setLogoUrl] = useState('');
  const [deleteConfirmationName, setDeleteConfirmationName] = useState('');
  const [notice, setNotice] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [communicationsError, setCommunicationsError] = useState<string | null>(null);
  const [integrationsError, setIntegrationsError] = useState<string | null>(null);
  const lastIntegrationCallbackRef = useRef<string | null>(null);

  const [editingTeamspace, setEditingTeamspace] = useState<Teamspace | null>(null);
  const [teamspaceName, setTeamspaceName] = useState('');
  const [teamspaceSlug, setTeamspaceSlug] = useState('');
  const [teamspaceDescription, setTeamspaceDescription] = useState('');
  const [teamspaceAvatarUrl, setTeamspaceAvatarUrl] = useState('');
  const [teamspaceError, setTeamspaceError] = useState<string | null>(null);
  const [membersTarget, setMembersTarget] = useState<Teamspace | null>(null);
  const [memberToAddId, setMemberToAddId] = useState<string | null>(null);
  const [memberRoleToAdd, setMemberRoleToAdd] = useState<'lead' | 'member'>('member');
  const [memberError, setMemberError] = useState<string | null>(null);

  const teamspaceMembersQ = useTeamspaceMembers(activeOrganizationId, membersTarget?.id ?? null);
  const organizationMembersQ = useOrganizationMembers(
    canManageSettings && membersTarget ? activeOrganizationId : null,
  );
  const addTeamspaceMember = useAddTeamspaceMember(activeOrganizationId, membersTarget?.id ?? null);
  const updateTeamspaceMember = useUpdateTeamspaceMember(
    activeOrganizationId,
    membersTarget?.id ?? null,
  );
  const removeTeamspaceMember = useRemoveTeamspaceMember(
    activeOrganizationId,
    membersTarget?.id ?? null,
  );

  const resetTeamspaceForm = useCallback(() => {
    setEditingTeamspace(null);
    setTeamspaceName('');
    setTeamspaceSlug('');
    setTeamspaceDescription('');
    setTeamspaceAvatarUrl('');
    setTeamspaceError(null);
  }, []);

  useEffect(() => {
    if (route.params?.section) {
      setSection(route.params.section);
    }
  }, [route.params?.section]);

  useEffect(() => {
    if (
      selectedOrganizationId &&
      organizations.some((item) => item.id === selectedOrganizationId)
    ) {
      return;
    }
    setSelectedOrganizationId(organizations[0]?.id ?? null);
  }, [organizations, selectedOrganizationId]);

  useEffect(() => {
    if (!organization) return;
    setName(organization.name);
    setDomain(organization.domain ?? '');
    setLogoUrl(organization.logoUrl ?? '');
    setDeleteConfirmationName('');
    setFormError(null);
    setCommunicationsError(null);
    if (!route.params?.integrationStatus) {
      setNotice(null);
      setIntegrationsError(null);
    }
    setMembersTarget(null);
    resetTeamspaceForm();
  }, [organization, resetTeamspaceForm, route.params?.integrationStatus]);

  useEffect(() => {
    const status = route.params?.integrationStatus;
    if (!status) return;

    const callbackKey = [
      route.params?.integrationProvider ?? 'integration',
      status,
      route.params?.integrationReason ?? '',
    ].join(':');
    if (lastIntegrationCallbackRef.current === callbackKey) return;
    lastIntegrationCallbackRef.current = callbackKey;

    setSection('integrations');
    setFormError(null);
    setCommunicationsError(null);

    if (status === 'connected') {
      setIntegrationsError(null);
      setNotice(t('organization.integrations.connectedNotice'));
      void integrationsQ.refetch();
      return;
    }

    setNotice(null);
    setIntegrationsError(
      route.params?.integrationReason
        ? `${t('organization.integrations.connectFailed')} (${route.params.integrationReason})`
        : t('organization.integrations.connectFailed'),
    );
  }, [
    integrationsQ,
    route.params?.integrationProvider,
    route.params?.integrationReason,
    route.params?.integrationStatus,
    t,
  ]);

  const isOrgSaving = updateOrganization.isPending;
  const isTeamspaceSaving = createTeamspace.isPending || updateTeamspace.isPending;
  const isCommunicationsSaving = updateCommunications.isPending;
  const isIntegrationMutating = connectIntegration.isPending || disconnectIntegration.isPending;
  const isMemberSaving =
    addTeamspaceMember.isPending ||
    updateTeamspaceMember.isPending ||
    removeTeamspaceMember.isPending;

  const teamspaceMemberIds = useMemo(
    () => new Set((teamspaceMembersQ.data?.members ?? []).map((member) => member.id)),
    [teamspaceMembersQ.data?.members],
  );
  const availableOrganizationMembers = useMemo(
    () =>
      (organizationMembersQ.data?.members ?? []).filter((member) => {
        const status = member.memberStatus ?? member.status ?? 'active';
        return status === 'active' && !teamspaceMemberIds.has(member.id);
      }),
    [organizationMembersQ.data?.members, teamspaceMemberIds],
  );

  useEffect(() => {
    if (!membersTarget) {
      setMemberToAddId(null);
      setMemberRoleToAdd('member');
      setMemberError(null);
      return;
    }

    if (
      memberToAddId &&
      availableOrganizationMembers.some((member) => member.id === memberToAddId)
    ) {
      return;
    }

    setMemberToAddId(availableOrganizationMembers[0]?.id ?? null);
  }, [availableOrganizationMembers, memberToAddId, membersTarget]);

  const saveOrganization = async () => {
    if (!activeOrganizationId || !organization) return;
    const trimmedName = name.trim();
    if (!trimmedName) {
      setFormError(t('validation.nameRequired'));
      return;
    }

    setFormError(null);
    setNotice(null);
    try {
      const patch: { name: string; domain?: string; logoUrl: string } = {
        name: trimmedName,
        logoUrl: logoUrl.trim(),
      };
      const trimmedDomain = domain.trim();
      if (trimmedDomain) patch.domain = trimmedDomain;
      await updateOrganization.mutateAsync(patch);
      setNotice(t('organization.updated'));
    } catch (error) {
      setFormError(error instanceof Error ? error.message : t('organization.errorGeneric'));
    }
  };

  const deleteOrganizationById = async () => {
    if (!activeOrganizationId || !organization) return;
    setFormError(null);
    setNotice(null);
    try {
      await deleteOrganization.mutateAsync();
      setSelectedOrganizationId(null);
      setNotice(t('organization.deleted'));
    } catch (error) {
      setFormError(error instanceof Error ? error.message : t('organization.errorGeneric'));
    }
  };

  const confirmDeleteOrganization = () => {
    if (!organization || !canDeleteOrganization) return;
    Alert.alert(
      t('organization.deleteTitle'),
      t('organization.deleteWarning', { name: organization.name }),
      [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('organization.deleteAction'),
          style: 'destructive',
          onPress: () => {
            void deleteOrganizationById();
          },
        },
      ],
    );
  };

  const beginEditTeamspace = (teamspace: Teamspace) => {
    setEditingTeamspace(teamspace);
    setTeamspaceName(teamspace.name);
    setTeamspaceSlug(teamspace.slug);
    setTeamspaceDescription(teamspace.description ?? '');
    setTeamspaceAvatarUrl(teamspace.avatarUrl ?? '');
    setTeamspaceError(null);
    setNotice(null);
    setSection('teamspaces');
  };

  const openTeamspaceMembers = (teamspace: Teamspace) => {
    setMembersTarget(teamspace);
    setMemberError(null);
    setNotice(null);
    setSection('teamspaces');
  };

  const saveTeamspace = async () => {
    if (!activeOrganizationId) return;
    const trimmedName = teamspaceName.trim();
    if (!trimmedName) {
      setTeamspaceError(t('validation.nameRequired'));
      return;
    }

    const payload: {
      name: string;
      slug?: string;
      description?: string;
      avatarUrl?: string;
    } = {
      name: trimmedName,
    };
    const trimmedSlug = teamspaceSlug.trim();
    const trimmedDescription = teamspaceDescription.trim();
    const trimmedAvatarUrl = teamspaceAvatarUrl.trim();
    if (trimmedSlug) payload.slug = trimmedSlug;
    if (trimmedDescription) payload.description = trimmedDescription;
    if (trimmedAvatarUrl) payload.avatarUrl = trimmedAvatarUrl;

    setTeamspaceError(null);
    setNotice(null);
    try {
      if (editingTeamspace) {
        await updateTeamspace.mutateAsync({ teamspaceId: editingTeamspace.id, ...payload });
        setNotice(t('organization.teamspaces.updated'));
      } else {
        await createTeamspace.mutateAsync(payload);
        setNotice(t('organization.teamspaces.created'));
      }
      resetTeamspaceForm();
    } catch (error) {
      setTeamspaceError(error instanceof Error ? error.message : t('organization.errorGeneric'));
    }
  };

  const deleteTeamspaceById = async (teamspaceId: string) => {
    setTeamspaceError(null);
    setNotice(null);
    try {
      await deleteTeamspace.mutateAsync(teamspaceId);
      if (editingTeamspace?.id === teamspaceId) resetTeamspaceForm();
      if (membersTarget?.id === teamspaceId) setMembersTarget(null);
      setNotice(t('organization.teamspaces.deleted'));
    } catch (error) {
      setTeamspaceError(error instanceof Error ? error.message : t('organization.errorGeneric'));
    }
  };

  const confirmDeleteTeamspace = (teamspace: Teamspace) => {
    Alert.alert(
      t('organization.teamspaces.deleteTitle'),
      t('organization.teamspaces.deleteWarning', { name: teamspace.name }),
      [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('organization.deleteAction'),
          style: 'destructive',
          onPress: () => {
            void deleteTeamspaceById(teamspace.id);
          },
        },
      ],
    );
  };

  const toggleCommunicationSetting = async (key: CommunicationToggleKey) => {
    const current = communicationsQ.data?.settings[key];
    if (typeof current !== 'boolean') return;
    if (!canManageSettings) {
      setCommunicationsError(t('organization.communications.manageRestricted'));
      return;
    }

    setCommunicationsError(null);
    setNotice(null);
    try {
      const patch: Partial<WorkspaceCommunicationsSettings> = { [key]: !current };
      await updateCommunications.mutateAsync(patch);
      setNotice(t('organization.communications.updated'));
    } catch (error) {
      setCommunicationsError(
        error instanceof Error ? error.message : t('organization.communications.updateFailed'),
      );
    }
  };

  const connectIntegrationByProvider = async (provider: WorkspaceIntegrationProvider) => {
    if (!canManageSettings) {
      setIntegrationsError(t('organization.integrations.manageRestricted'));
      return;
    }

    setIntegrationsError(null);
    setNotice(null);
    try {
      const result = await connectIntegration.mutateAsync(provider);
      await Linking.openURL(result.authorizeUrl);
    } catch (error) {
      setIntegrationsError(
        error instanceof Error ? error.message : t('organization.integrations.connectFailed'),
      );
    }
  };

  const disconnectIntegrationByProvider = async (provider: WorkspaceIntegrationProvider) => {
    if (!canManageSettings) {
      setIntegrationsError(t('organization.integrations.manageRestricted'));
      return;
    }

    setIntegrationsError(null);
    setNotice(null);
    try {
      await disconnectIntegration.mutateAsync(provider);
      setNotice(t('organization.integrations.disconnectedNotice'));
    } catch (error) {
      setIntegrationsError(
        error instanceof Error ? error.message : t('organization.integrations.disconnectFailed'),
      );
    }
  };

  const confirmDisconnectIntegration = (status: WorkspaceIntegrationStatus) => {
    const meta = INTEGRATION_PROVIDERS.find((item) => item.provider === status.provider);
    const providerLabel = t(meta?.labelKey ?? 'organization.integrations.providers.github');
    Alert.alert(
      t('organization.integrations.disconnectTitle', { provider: providerLabel }),
      t('organization.integrations.disconnectWarning', { provider: providerLabel }),
      [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('organization.integrations.disconnect'),
          style: 'destructive',
          onPress: () => {
            void disconnectIntegrationByProvider(status.provider);
          },
        },
      ],
    );
  };

  const addSelectedMember = async () => {
    if (!membersTarget || !memberToAddId) {
      setMemberError(t('organization.teamspaces.members.selectMember'));
      return;
    }

    setMemberError(null);
    setNotice(null);
    try {
      await addTeamspaceMember.mutateAsync({ userId: memberToAddId, role: memberRoleToAdd });
      setNotice(t('organization.teamspaces.members.added'));
      setMemberToAddId(null);
      setMemberRoleToAdd('member');
    } catch (error) {
      setMemberError(error instanceof Error ? error.message : t('organization.errorGeneric'));
    }
  };

  const changeMemberRole = async (member: TeamspaceMember, role: 'lead' | 'member') => {
    if (!membersTarget || member.teamRole === role) return;

    setMemberError(null);
    setNotice(null);
    try {
      await updateTeamspaceMember.mutateAsync({ memberId: member.id, role });
      setNotice(t('organization.teamspaces.members.updated'));
    } catch (error) {
      setMemberError(error instanceof Error ? error.message : t('organization.errorGeneric'));
    }
  };

  const removeMemberById = async (member: TeamspaceMember) => {
    if (!membersTarget) return;

    setMemberError(null);
    setNotice(null);
    try {
      await removeTeamspaceMember.mutateAsync(member.id);
      setNotice(t('organization.teamspaces.members.removed'));
    } catch (error) {
      setMemberError(error instanceof Error ? error.message : t('organization.errorGeneric'));
    }
  };

  const confirmRemoveMember = (member: TeamspaceMember) => {
    Alert.alert(
      t('organization.teamspaces.members.removeTitle'),
      t('organization.teamspaces.members.removeWarning', {
        name: member.name || member.email,
      }),
      [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('organization.teamspaces.members.remove'),
          style: 'destructive',
          onPress: () => {
            void removeMemberById(member);
          },
        },
      ],
    );
  };

  if (organizationsQ.isLoading) return <Loading label={t('organization.loading')} />;

  if (organizationsQ.isError) {
    return (
      <Screen>
        <ErrorView
          message={
            organizationsQ.error instanceof Error
              ? organizationsQ.error.message
              : t('organization.loadFailed')
          }
          onRetry={() => void organizationsQ.refetch()}
        />
      </Screen>
    );
  }

  if (organizations.length === 0) {
    return (
      <Screen>
        <ScreenHeader
          kicker={t('organization.kicker')}
          title={t('organization.title')}
          subtitle={t('organization.subtitle')}
        />
        <EmptyState
          icon={Building2}
          title={t('organization.empty')}
          description={t('organization.emptyDescription')}
        />
      </Screen>
    );
  }

  const stats = organization?.stats ?? { members: 0, projects: 0, teams: 0, apiKeys: 0 };
  const deleteBlocked = !organization || deleteConfirmationName.trim() !== organization.name;

  return (
    <Screen>
      <ScrollView
        refreshControl={
          <RefreshControl
            refreshing={
              organizationsQ.isRefetching ||
              organizationQ.isRefetching ||
              teamspacesQ.isRefetching ||
              communicationsQ.isRefetching ||
              integrationsQ.isRefetching
            }
            onRefresh={() => {
              void organizationsQ.refetch();
              void organizationQ.refetch();
              void teamspacesQ.refetch();
              void communicationsQ.refetch();
              void integrationsQ.refetch();
            }}
          />
        }
        contentContainerStyle={styles.content}
      >
        <ScreenHeader
          kicker={t('organization.kicker')}
          title={t('organization.title')}
          subtitle={t('organization.subtitle')}
          meta={
            organization ? (
              <SemanticBadge
                label={roleLabel(organization.userRole ?? organization.role, t)}
                tone={roleTone(organization.userRole ?? organization.role)}
              />
            ) : undefined
          }
        />

        {organizations.length > 1 ? (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.orgList}
          >
            {organizations.map((item) => (
              <OrganizationPill
                key={item.id}
                organization={item}
                selected={item.id === activeOrganizationId}
                onPress={setSelectedOrganizationId}
              />
            ))}
          </ScrollView>
        ) : null}

        {organizationQ.isError ? (
          <SurfaceRow>
            <ErrorView
              message={
                organizationQ.error instanceof Error
                  ? organizationQ.error.message
                  : t('organization.loadFailed')
              }
              onRetry={() => void organizationQ.refetch()}
            />
          </SurfaceRow>
        ) : null}

        {organization ? (
          <>
            <SurfaceRow className="gap-3">
              <View style={styles.heroRow}>
                <LogoPreview url={organization.logoUrl} fallbackIcon={Building2} />
                <View style={styles.heroCopy}>
                  <Text style={styles.heroName} numberOfLines={2}>
                    {organization.name}
                  </Text>
                  <Text style={styles.heroMeta} numberOfLines={1}>
                    {organization.slug}
                  </Text>
                </View>
              </View>
              <View style={styles.badgeRow}>
                <SemanticBadge label={planLabel(organization.plan, t)} tone="neutral" />
                <SemanticBadge
                  label={statusLabel(organization.status, t)}
                  tone={statusTone(organization.status)}
                />
                {organization.isSuperAdmin ? (
                  <SemanticBadge label={t('organization.superAdmin')} tone="indigo" />
                ) : null}
              </View>
              <View style={styles.statsGrid}>
                <StatItem
                  icon={Users}
                  value={stats.members}
                  label={t('organization.stats.members')}
                />
                <StatItem
                  icon={Layers3}
                  value={stats.projects}
                  label={t('organization.stats.projects')}
                />
                <StatItem
                  icon={Shield}
                  value={stats.teams}
                  label={t('organization.stats.teamspaces')}
                />
                <StatItem
                  icon={KeyRound}
                  value={stats.apiKeys}
                  label={t('organization.stats.apiKeys')}
                />
              </View>
            </SurfaceRow>

            <View style={styles.segmentWrap}>
              {SECTIONS.map((item) => (
                <SectionButton
                  key={item}
                  section={item}
                  selected={section === item}
                  onPress={setSection}
                />
              ))}
            </View>

            {notice ? <Text style={styles.noticeText}>{notice}</Text> : null}

            {section === 'general' ? (
              <SurfaceRow className="gap-4">
                <View style={styles.sectionHeader}>
                  <IconTile icon={Building2} tone="blue" />
                  <View style={styles.sectionCopy}>
                    <Text style={styles.sectionTitle}>{t('organization.detailsTitle')}</Text>
                    <Text style={styles.helperText}>{t('organization.detailsDescription')}</Text>
                  </View>
                </View>

                {!canManageSettings ? (
                  <Text style={styles.warnText}>{t('organization.manageRestricted')}</Text>
                ) : null}

                <TextField
                  label={t('organization.nameLabel')}
                  value={name}
                  onChangeText={(value) => {
                    setName(value);
                    setFormError(null);
                    setNotice(null);
                  }}
                  editable={canManageSettings && !isOrgSaving}
                  maxLength={255}
                />
                <TextField
                  label={t('organization.slugLabel')}
                  value={organization.slug}
                  editable={false}
                />
                <TextField
                  label={t('organization.domainLabel')}
                  placeholder={t('organization.domainPlaceholder')}
                  value={domain}
                  onChangeText={(value) => {
                    setDomain(value);
                    setNotice(null);
                  }}
                  editable={canManageSettings && !isOrgSaving}
                  maxLength={255}
                />
                <View style={styles.logoFormRow}>
                  <LogoPreview url={logoUrl} fallbackIcon={Building2} />
                  <View style={styles.logoField}>
                    <TextField
                      label={t('organization.logoLabel')}
                      placeholder={t('organization.logoPlaceholder')}
                      value={logoUrl}
                      onChangeText={(value) => {
                        setLogoUrl(value);
                        setNotice(null);
                      }}
                      editable={canManageSettings && !isOrgSaving}
                    />
                  </View>
                </View>

                {formError ? <Text style={styles.errorText}>{formError}</Text> : null}
                <Text style={styles.helperText}>{formatUpdatedAt(organization.updatedAt, t)}</Text>
                <Button
                  title={t('organization.saveChanges')}
                  icon={Save}
                  loading={isOrgSaving}
                  disabled={!canManageSettings || !name.trim() || isOrgSaving}
                  onPress={() => void saveOrganization()}
                />
              </SurfaceRow>
            ) : null}

            {section === 'teamspaces' ? (
              <View style={styles.sectionStack}>
                <SurfaceRow className="gap-4">
                  <View style={styles.sectionHeader}>
                    <IconTile icon={Shield} tone="amber" />
                    <View style={styles.sectionCopy}>
                      <Text style={styles.sectionTitle}>{t('organization.teamspaces.title')}</Text>
                      <Text style={styles.helperText}>
                        {t('organization.teamspaces.description')}
                      </Text>
                    </View>
                  </View>

                  {!canManageSettings ? (
                    <Text style={styles.warnText}>{t('organization.manageRestricted')}</Text>
                  ) : null}

                  <TextField
                    label={t('organization.teamspaces.nameLabel')}
                    value={teamspaceName}
                    onChangeText={(value) => {
                      setTeamspaceName(value);
                      setTeamspaceSlug((current) =>
                        !current || current === slugify(teamspaceName) ? slugify(value) : current,
                      );
                      setTeamspaceError(null);
                      setNotice(null);
                    }}
                    editable={canManageSettings && !isTeamspaceSaving}
                    maxLength={255}
                  />
                  <TextField
                    label={t('organization.teamspaces.slugLabel')}
                    value={teamspaceSlug}
                    onChangeText={(value) => setTeamspaceSlug(slugify(value))}
                    placeholder={t('organization.teamspaces.slugPlaceholder')}
                    editable={canManageSettings && !isTeamspaceSaving}
                    maxLength={100}
                  />
                  <TextField
                    label={t('organization.teamspaces.descriptionLabel')}
                    value={teamspaceDescription}
                    onChangeText={setTeamspaceDescription}
                    placeholder={t('organization.teamspaces.descriptionPlaceholder')}
                    editable={canManageSettings && !isTeamspaceSaving}
                    maxLength={500}
                    multiline
                    className="min-h-12"
                  />
                  <TextField
                    label={t('organization.teamspaces.avatarLabel')}
                    value={teamspaceAvatarUrl}
                    onChangeText={setTeamspaceAvatarUrl}
                    placeholder={t('organization.teamspaces.avatarPlaceholder')}
                    editable={canManageSettings && !isTeamspaceSaving}
                  />

                  {teamspaceError ? <Text style={styles.errorText}>{teamspaceError}</Text> : null}
                  <View style={styles.inlineActions}>
                    {editingTeamspace ? (
                      <Button
                        title={t('common.cancel')}
                        icon={X}
                        variant="secondary"
                        disabled={isTeamspaceSaving}
                        onPress={resetTeamspaceForm}
                        style={styles.inlineActionButton}
                      />
                    ) : null}
                    <Button
                      title={
                        editingTeamspace
                          ? t('organization.teamspaces.save')
                          : t('organization.teamspaces.create')
                      }
                      icon={editingTeamspace ? Check : Plus}
                      loading={isTeamspaceSaving}
                      disabled={!canManageSettings || !teamspaceName.trim() || isTeamspaceSaving}
                      onPress={() => void saveTeamspace()}
                      style={styles.inlineActionButton}
                    />
                  </View>
                </SurfaceRow>

                {membersTarget ? (
                  <SurfaceRow className="gap-4">
                    <View style={styles.sectionHeader}>
                      <IconTile icon={Users} tone="emerald" />
                      <View style={styles.sectionCopy}>
                        <Text style={styles.sectionTitle}>
                          {t('organization.teamspaces.members.title', {
                            name: membersTarget.name,
                          })}
                        </Text>
                        <Text style={styles.helperText}>
                          {t('organization.teamspaces.members.description')}
                        </Text>
                      </View>
                    </View>

                    <Button
                      title={t('organization.teamspaces.members.close')}
                      icon={X}
                      variant="secondary"
                      onPress={() => setMembersTarget(null)}
                    />

                    {memberError ? <Text style={styles.errorText}>{memberError}</Text> : null}

                    {teamspaceMembersQ.isLoading ? (
                      <Text style={styles.helperText}>
                        {t('organization.teamspaces.members.loading')}
                      </Text>
                    ) : null}
                    {teamspaceMembersQ.isError ? (
                      <ErrorView
                        message={
                          teamspaceMembersQ.error instanceof Error
                            ? teamspaceMembersQ.error.message
                            : t('organization.teamspaces.members.loadFailed')
                        }
                        onRetry={() => void teamspaceMembersQ.refetch()}
                      />
                    ) : null}

                    {canManageSettings ? (
                      <View style={styles.memberAddBox}>
                        <Text style={styles.sectionTitle}>
                          {t('organization.teamspaces.members.addTitle')}
                        </Text>
                        <View style={styles.rolePillRow}>
                          <MemberRolePill
                            role="member"
                            selected={memberRoleToAdd === 'member'}
                            disabled={isMemberSaving}
                            onPress={setMemberRoleToAdd}
                          />
                          <MemberRolePill
                            role="lead"
                            selected={memberRoleToAdd === 'lead'}
                            disabled={isMemberSaving}
                            onPress={setMemberRoleToAdd}
                          />
                        </View>
                        {organizationMembersQ.isLoading ? (
                          <Text style={styles.helperText}>
                            {t('organization.teamspaces.members.loadingCandidates')}
                          </Text>
                        ) : null}
                        {organizationMembersQ.isError ? (
                          <Text style={styles.errorText}>
                            {organizationMembersQ.error instanceof Error
                              ? organizationMembersQ.error.message
                              : t('organization.teamspaces.members.loadCandidatesFailed')}
                          </Text>
                        ) : null}
                        {availableOrganizationMembers.length > 0 ? (
                          <ScrollView
                            horizontal
                            showsHorizontalScrollIndicator={false}
                            contentContainerStyle={styles.memberPickerList}
                          >
                            {availableOrganizationMembers.map((member) => (
                              <OrganizationMemberPill
                                key={member.id}
                                member={member}
                                selected={member.id === memberToAddId}
                                disabled={isMemberSaving}
                                onPress={setMemberToAddId}
                              />
                            ))}
                          </ScrollView>
                        ) : !organizationMembersQ.isLoading ? (
                          <Text style={styles.helperText}>
                            {t('organization.teamspaces.members.noCandidates')}
                          </Text>
                        ) : null}
                        <Button
                          title={t('organization.teamspaces.members.addAction')}
                          icon={UserPlus}
                          loading={addTeamspaceMember.isPending}
                          disabled={!memberToAddId || isMemberSaving}
                          onPress={() => void addSelectedMember()}
                        />
                      </View>
                    ) : (
                      <Text style={styles.warnText}>
                        {t('organization.teamspaces.members.manageRestricted')}
                      </Text>
                    )}

                    {(teamspaceMembersQ.data?.members ?? []).length > 0 ? (
                      <View style={styles.memberList}>
                        {(teamspaceMembersQ.data?.members ?? []).map((member) => (
                          <TeamspaceMemberRow
                            key={member.id}
                            member={member}
                            canManage={canManageSettings}
                            isCurrentUser={member.id === currentUserId}
                            isMutating={isMemberSaving}
                            onChangeRole={(item, role) => void changeMemberRole(item, role)}
                            onRemove={confirmRemoveMember}
                          />
                        ))}
                      </View>
                    ) : !teamspaceMembersQ.isLoading && !teamspaceMembersQ.isError ? (
                      <EmptyState
                        icon={Users}
                        title={t('organization.teamspaces.members.empty')}
                        description={t('organization.teamspaces.members.emptyDescription')}
                      />
                    ) : null}
                  </SurfaceRow>
                ) : null}

                {teamspacesQ.isLoading ? (
                  <Text style={styles.helperText}>{t('organization.teamspaces.loading')}</Text>
                ) : null}
                {teamspacesQ.isError ? (
                  <SurfaceRow>
                    <ErrorView
                      message={
                        teamspacesQ.error instanceof Error
                          ? teamspacesQ.error.message
                          : t('organization.teamspaces.loadFailed')
                      }
                      onRetry={() => void teamspacesQ.refetch()}
                    />
                  </SurfaceRow>
                ) : null}
                {(teamspacesQ.data ?? []).length === 0 &&
                !teamspacesQ.isLoading &&
                !teamspacesQ.isError ? (
                  <SurfaceRow>
                    <EmptyState
                      icon={Shield}
                      title={t('organization.teamspaces.empty')}
                      description={t('organization.teamspaces.emptyDescription')}
                    />
                  </SurfaceRow>
                ) : null}
                {(teamspacesQ.data ?? []).map((teamspace) => (
                  <TeamspaceCard
                    key={teamspace.id}
                    teamspace={teamspace}
                    canManage={canManageSettings}
                    onManageMembers={() => openTeamspaceMembers(teamspace)}
                    onEdit={() => beginEditTeamspace(teamspace)}
                    onDelete={() => confirmDeleteTeamspace(teamspace)}
                  />
                ))}
              </View>
            ) : null}

            {section === 'communications' ? (
              <SurfaceRow className="gap-4">
                <View style={styles.sectionHeader}>
                  <IconTile icon={MessageSquareText} tone="cyan" />
                  <View style={styles.sectionCopy}>
                    <Text style={styles.sectionTitle}>
                      {t('organization.communications.title')}
                    </Text>
                    <Text style={styles.helperText}>
                      {t('organization.communications.description')}
                    </Text>
                  </View>
                </View>

                {!canManageSettings ? (
                  <Text style={styles.warnText}>
                    {t('organization.communications.manageRestricted')}
                  </Text>
                ) : null}

                {communicationsQ.isLoading ? (
                  <Text style={styles.helperText}>{t('organization.communications.loading')}</Text>
                ) : null}

                {communicationsQ.isError ? (
                  <ErrorView
                    message={
                      communicationsQ.error instanceof Error
                        ? communicationsQ.error.message
                        : t('organization.communications.loadFailed')
                    }
                    onRetry={() => void communicationsQ.refetch()}
                  />
                ) : null}

                {communicationsError ? (
                  <Text style={styles.errorText}>{communicationsError}</Text>
                ) : null}

                {communicationsQ.data ? (
                  <>
                    <View style={styles.badgeRow}>
                      <SemanticBadge
                        label={
                          communicationsQ.data.settings.enabled
                            ? t('organization.communications.enabled')
                            : t('organization.communications.disabled')
                        }
                        tone={communicationsQ.data.settings.enabled ? 'emerald' : 'neutral'}
                      />
                      <SemanticBadge
                        label={
                          communicationsQ.data.serviceStatus.redisReady
                            ? t('organization.communications.redisFanout')
                            : t('organization.communications.inMemoryFallback')
                        }
                        tone={communicationsQ.data.serviceStatus.redisReady ? 'emerald' : 'amber'}
                      />
                    </View>

                    <View style={styles.communicationToggleList}>
                      {COMMUNICATION_TOGGLES.map((toggle) => (
                        <CommunicationToggleRow
                          key={toggle.key}
                          icon={toggle.icon}
                          label={t(toggle.labelKey)}
                          description={t(toggle.descriptionKey)}
                          selected={communicationsQ.data.settings[toggle.key]}
                          disabled={!canManageSettings || isCommunicationsSaving}
                          onPress={() => void toggleCommunicationSetting(toggle.key)}
                        />
                      ))}
                    </View>

                    <View style={styles.communicationServiceList}>
                      <CommunicationServiceRow
                        icon={communicationsQ.data.serviceStatus.redisReady ? Wifi : WifiOff}
                        title={t('organization.communications.service.redis')}
                        ready={communicationsQ.data.serviceStatus.redisReady}
                        badgeLabel={
                          communicationsQ.data.serviceStatus.redisReady
                            ? t('organization.communications.service.ready')
                            : t('organization.communications.service.fallback')
                        }
                        description={
                          communicationsQ.data.serviceStatus.redisReady
                            ? t('organization.communications.service.redisReady')
                            : t('organization.communications.service.redisFallback')
                        }
                      />
                      <CommunicationServiceRow
                        icon={Radio}
                        title={t('organization.communications.service.livekit')}
                        ready={communicationsQ.data.serviceStatus.livekit.ready}
                        badgeLabel={
                          communicationsQ.data.serviceStatus.livekit.ready
                            ? t('organization.communications.service.ready')
                            : t('organization.communications.service.needsConfig')
                        }
                        description={
                          communicationsQ.data.serviceStatus.livekit.ready
                            ? t('organization.communications.service.livekitReady', {
                                url:
                                  communicationsQ.data.serviceStatus.livekit.url ??
                                  t('common.none'),
                              })
                            : communicationsQ.data.serviceStatus.livekit.missing.length > 0
                              ? t('organization.communications.service.livekitMissing', {
                                  missing:
                                    communicationsQ.data.serviceStatus.livekit.missing.join(', '),
                                })
                              : t('organization.communications.service.livekitNotReady')
                        }
                      />
                    </View>
                  </>
                ) : null}
              </SurfaceRow>
            ) : null}

            {section === 'integrations' ? (
              <SurfaceRow className="gap-4">
                <View style={styles.sectionHeader}>
                  <IconTile icon={KeyRound} tone="violet" />
                  <View style={styles.sectionCopy}>
                    <Text style={styles.sectionTitle}>{t('organization.integrations.title')}</Text>
                    <Text style={styles.helperText}>
                      {t('organization.integrations.description')}
                    </Text>
                  </View>
                </View>

                <Text style={styles.helperText}>
                  {t('organization.integrations.nativeOauthNotice')}
                </Text>

                {!canManageSettings ? (
                  <Text style={styles.warnText}>
                    {t('organization.integrations.manageRestricted')}
                  </Text>
                ) : null}

                {integrationsQ.isLoading ? (
                  <Text style={styles.helperText}>{t('organization.integrations.loading')}</Text>
                ) : null}

                {integrationsQ.isError ? (
                  <ErrorView
                    message={
                      integrationsQ.error instanceof Error
                        ? integrationsQ.error.message
                        : t('organization.integrations.loadFailed')
                    }
                    onRetry={() => void integrationsQ.refetch()}
                  />
                ) : null}

                {integrationsError ? (
                  <Text style={styles.errorText}>{integrationsError}</Text>
                ) : null}

                {integrationsQ.data ? (
                  <View style={styles.integrationList}>
                    {integrationsQ.data.map((status) => (
                      <IntegrationStatusRow
                        key={status.provider}
                        status={status}
                        canManage={canManageSettings}
                        isMutating={isIntegrationMutating}
                        onDisconnect={confirmDisconnectIntegration}
                        onConnect={(item) => void connectIntegrationByProvider(item.provider)}
                      />
                    ))}
                  </View>
                ) : null}
              </SurfaceRow>
            ) : null}

            {section === 'danger' ? (
              <SurfaceRow className="gap-4">
                <View style={styles.sectionHeader}>
                  <IconTile icon={AlertTriangle} tone="rose" />
                  <View style={styles.sectionCopy}>
                    <Text style={styles.dangerTitle}>{t('organization.deleteTitle')}</Text>
                    <Text style={styles.helperText}>{t('organization.dangerDescription')}</Text>
                  </View>
                </View>
                <Text style={styles.dangerText}>{t('organization.cannotRestore')}</Text>
                <TextField
                  label={t('organization.confirmNameLabel')}
                  value={deleteConfirmationName}
                  onChangeText={setDeleteConfirmationName}
                  placeholder={organization.name}
                  editable={canDeleteOrganization && !deleteOrganization.isPending}
                />
                {formError ? <Text style={styles.errorText}>{formError}</Text> : null}
                <Button
                  title={
                    canDeleteOrganization
                      ? t('organization.deleteAction')
                      : t('organization.ownerOnly')
                  }
                  icon={Trash2}
                  variant="destructive"
                  loading={deleteOrganization.isPending}
                  disabled={!canDeleteOrganization || deleteBlocked || deleteOrganization.isPending}
                  onPress={confirmDeleteOrganization}
                />
              </SurfaceRow>
            ) : null}
          </>
        ) : (
          <Loading label={t('organization.loading')} />
        )}
      </ScrollView>
    </Screen>
  );
}

function createOrganizationSettingsStyles(colors: ThemeColors) {
  return StyleSheet.create({
    content: {
      gap: 12,
      paddingBottom: 32,
    },
    orgList: {
      gap: 8,
      paddingHorizontal: 16,
    },
    orgPill: {
      width: 160,
      gap: 5,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
      borderRadius: 8,
      backgroundColor: colors.surface,
      padding: 10,
    },
    orgPillActive: {
      borderColor: colors.primary,
      backgroundColor: `${colors.primary}1A`,
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
    orgMeta: {
      color: colors.mutedForeground,
      fontSize: 12,
      lineHeight: 16,
    },
    orgMetaActive: {
      color: colors.foreground,
    },
    heroRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
    },
    heroCopy: {
      flex: 1,
      minWidth: 0,
      gap: 3,
    },
    heroName: {
      color: colors.foreground,
      fontSize: 18,
      fontWeight: '700',
      lineHeight: 24,
    },
    heroMeta: {
      color: colors.mutedForeground,
      fontSize: 13,
      lineHeight: 18,
    },
    logoPreview: {
      width: 48,
      height: 48,
      alignItems: 'center',
      justifyContent: 'center',
      overflow: 'hidden',
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
      borderRadius: 8,
      backgroundColor: colors.muted,
    },
    logoImage: {
      width: 48,
      height: 48,
    },
    badgeRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 6,
    },
    statsGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 8,
    },
    statItem: {
      minWidth: 128,
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
      borderRadius: 7,
      backgroundColor: colors.surface,
      paddingHorizontal: 10,
      paddingVertical: 9,
    },
    statValue: {
      color: colors.foreground,
      fontSize: 14,
      fontWeight: '700',
      lineHeight: 19,
    },
    statLabel: {
      flex: 1,
      color: colors.mutedForeground,
      fontSize: 12,
      lineHeight: 16,
    },
    segmentWrap: {
      marginHorizontal: 16,
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 6,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
      borderRadius: 8,
      backgroundColor: colors.card,
      padding: 4,
    },
    segmentButton: {
      minHeight: 38,
      minWidth: 104,
      flexGrow: 1,
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: 'transparent',
      borderRadius: 6,
      paddingHorizontal: 8,
    },
    segmentButtonActive: {
      borderColor: colors.border,
      backgroundColor: colors.background,
    },
    segmentText: {
      color: colors.mutedForeground,
      fontSize: 12,
      fontWeight: '700',
      lineHeight: 16,
      textAlign: 'center',
    },
    segmentTextActive: {
      color: colors.foreground,
    },
    sectionStack: {
      gap: 12,
    },
    sectionHeader: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: 10,
    },
    sectionCopy: {
      flex: 1,
      minWidth: 0,
      gap: 3,
    },
    sectionTitle: {
      color: colors.foreground,
      fontSize: 16,
      fontWeight: '700',
      lineHeight: 22,
    },
    helperText: {
      color: colors.mutedForeground,
      fontSize: 13,
      lineHeight: 18,
    },
    warnText: {
      color: colors.warning,
      fontSize: 13,
      lineHeight: 18,
    },
    errorText: {
      color: colors.destructive,
      fontSize: 13,
      lineHeight: 18,
    },
    noticeText: {
      marginHorizontal: 16,
      color: colors.mutedForeground,
      fontSize: 13,
      lineHeight: 18,
    },
    logoFormRow: {
      flexDirection: 'row',
      alignItems: 'flex-end',
      gap: 12,
    },
    logoField: {
      flex: 1,
      minWidth: 0,
    },
    inlineActions: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 8,
    },
    inlineActionButton: {
      minWidth: 132,
      flex: 1,
    },
    disabled: {
      opacity: 0.5,
    },
    rolePillRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 8,
    },
    rolePill: {
      minHeight: 36,
      minWidth: 112,
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
      borderRadius: 7,
      backgroundColor: colors.surface,
      paddingHorizontal: 10,
    },
    rolePillActive: {
      borderColor: colors.primary,
      backgroundColor: `${colors.primary}1A`,
    },
    rolePillText: {
      color: colors.mutedForeground,
      fontSize: 13,
      fontWeight: '700',
      lineHeight: 18,
    },
    rolePillTextActive: {
      color: colors.primary,
    },
    memberAddBox: {
      gap: 10,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
      borderRadius: 8,
      backgroundColor: colors.surface,
      padding: 12,
    },
    memberPickerList: {
      gap: 8,
      paddingRight: 4,
    },
    memberPickerPill: {
      width: 220,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 9,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
      borderRadius: 8,
      backgroundColor: colors.card,
      padding: 9,
    },
    memberPickerPillActive: {
      borderColor: colors.primary,
      backgroundColor: `${colors.primary}14`,
    },
    memberPickerCopy: {
      flex: 1,
      minWidth: 0,
      gap: 2,
    },
    memberPickerName: {
      color: colors.foreground,
      fontSize: 13,
      fontWeight: '700',
      lineHeight: 18,
    },
    memberPickerEmail: {
      color: colors.mutedForeground,
      fontSize: 12,
      lineHeight: 16,
    },
    memberList: {
      gap: 8,
    },
    communicationToggleList: {
      gap: 8,
    },
    communicationToggle: {
      minHeight: 70,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
      borderRadius: 8,
      backgroundColor: colors.surface,
      padding: 12,
    },
    communicationToggleActive: {
      borderColor: `${colors.primary}66`,
      backgroundColor: `${colors.primary}14`,
    },
    communicationToggleIcon: {
      width: 32,
      height: 32,
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
      borderRadius: 7,
      backgroundColor: colors.card,
    },
    communicationToggleCopy: {
      flex: 1,
      minWidth: 0,
      gap: 3,
    },
    communicationToggleTitle: {
      color: colors.foreground,
      fontSize: 14,
      fontWeight: '700',
      lineHeight: 19,
    },
    communicationToggleDescription: {
      color: colors.mutedForeground,
      fontSize: 12,
      lineHeight: 17,
    },
    communicationSwitch: {
      width: 28,
      height: 28,
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
      borderRadius: 14,
      backgroundColor: colors.card,
    },
    communicationSwitchActive: {
      borderColor: colors.primary,
      backgroundColor: colors.primary,
    },
    communicationServiceList: {
      gap: 8,
    },
    communicationServiceRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
      borderRadius: 8,
      backgroundColor: colors.card,
      padding: 12,
    },
    communicationServiceTitle: {
      color: colors.foreground,
      fontSize: 13,
      fontWeight: '700',
      lineHeight: 18,
    },
    integrationList: {
      gap: 8,
    },
    integrationRow: {
      gap: 12,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
      borderRadius: 8,
      backgroundColor: colors.surface,
      padding: 12,
    },
    integrationHeader: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: 10,
    },
    integrationIcon: {
      width: 34,
      height: 34,
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
      borderRadius: 8,
      backgroundColor: colors.card,
    },
    integrationIconConnected: {
      borderColor: `${colors.success}66`,
      backgroundColor: `${colors.success}14`,
    },
    integrationCopy: {
      flex: 1,
      minWidth: 0,
      gap: 4,
    },
    integrationTitleRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      alignItems: 'center',
      gap: 6,
    },
    integrationTitle: {
      color: colors.foreground,
      fontSize: 15,
      fontWeight: '700',
      lineHeight: 21,
    },
    memberRow: {
      gap: 10,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
      borderRadius: 8,
      backgroundColor: colors.surface,
      padding: 12,
    },
    memberIdentity: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
    },
    memberCopy: {
      flex: 1,
      minWidth: 0,
      gap: 2,
    },
    memberName: {
      color: colors.foreground,
      fontSize: 14,
      fontWeight: '700',
      lineHeight: 20,
    },
    memberEmail: {
      color: colors.mutedForeground,
      fontSize: 12,
      lineHeight: 16,
    },
    memberActions: {
      gap: 8,
    },
    memberRoleActions: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 8,
    },
    memberRoleButton: {
      minWidth: 116,
      flex: 1,
    },
    teamspaceHeader: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: 10,
    },
    teamspaceCopy: {
      flex: 1,
      minWidth: 0,
      gap: 5,
    },
    teamspaceTitleRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      alignItems: 'center',
      gap: 6,
    },
    teamspaceName: {
      maxWidth: 220,
      color: colors.foreground,
      fontSize: 16,
      fontWeight: '700',
      lineHeight: 22,
    },
    teamspaceSlug: {
      color: colors.mutedForeground,
      fontSize: 13,
      lineHeight: 18,
    },
    teamspaceDescription: {
      color: colors.mutedForeground,
      fontSize: 13,
      lineHeight: 18,
    },
    teamspaceMetaRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 8,
    },
    teamspaceMeta: {
      color: colors.mutedForeground,
      fontSize: 12,
      lineHeight: 16,
    },
    dangerTitle: {
      color: colors.destructive,
      fontSize: 16,
      fontWeight: '700',
      lineHeight: 22,
    },
    dangerText: {
      color: colors.destructive,
      fontSize: 13,
      lineHeight: 18,
    },
  });
}
