import { useEffect, useMemo, useState } from 'react';
import { Alert } from 'react-native';
import {
  FlatList,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
  type ListRenderItem,
} from '@/components/native';
import { useRoute, type RouteProp } from '@react-navigation/native';
import {
  AlertTriangle,
  Bot,
  Check,
  FolderKanban,
  Search,
  Shield,
  ShieldCheck,
  Trash2,
  UserPlus,
  Users,
  X,
} from 'lucide-react-native';
import { useTranslation } from 'react-i18next';

import {
  Avatar,
  Button,
  EmptyState,
  ErrorView,
  Loading,
  Screen,
  ScreenHeader,
  SemanticBadge,
  TextField,
} from '@/components/ui';
import type {
  AgentApprovalRequest,
  AgentPolicyRule,
  AgentPolicyStatus,
  OrganizationMember,
  Project,
} from '@/api/types';
import type { OrganizationRole, ProjectAssignmentRole } from '@/api/endpoints';
import type { ThemeColors } from '@/design/theme';
import { useThemeColors } from '@/design/theme-context';
import {
  useAgentApprovals,
  useAgentPolicy,
  useApproveAgentApproval,
  useAssignOrganizationMemberProjects,
  useInviteOrganizationMember,
  useOrganizationMembers,
  useProjects,
  useRejectAgentApproval,
  useRemoveOrganizationMember,
  useUpdateOrganizationMemberRole,
} from '@/hooks/queries';
import { initials, relativeTime } from '@/lib/format';
import type { AppTabParamList } from '@/navigation/types';
import { useSession } from '@/stores/session';

const ROLE_FILTERS = ['all', 'owner', 'admin', 'member', 'viewer', 'guest'] as const;
const STATUS_FILTERS = ['all', 'active', 'invited', 'suspended'] as const;
const INVITE_ROLES = [
  'member',
  'admin',
  'viewer',
  'guest',
  'owner',
] as const satisfies readonly OrganizationRole[];
const PROJECT_ROLES = [
  'developer',
  'tech_lead',
  'scrum_master',
  'product_owner',
  'qa_engineer',
  'designer',
  'viewer',
] as const satisfies readonly ProjectAssignmentRole[];
const INVITE_EXPIRY_OPTIONS = [1, 7, 14, 30, 90] as const;

type RoleFilter = (typeof ROLE_FILTERS)[number];
type StatusFilter = (typeof STATUS_FILTERS)[number];
type InviteRole = (typeof INVITE_ROLES)[number];
type InviteExpiryDays = (typeof INVITE_EXPIRY_OPTIONS)[number];
type TeamRoute = RouteProp<AppTabParamList, 'Team'>;
type TeamStyles = ReturnType<typeof createTeamStyles>;

interface OrganizationOption {
  id: string;
  projectCount: number;
}

function useTeamTheme(): { colors: ThemeColors; styles: TeamStyles } {
  const colors = useThemeColors();
  const styles = useMemo(() => createTeamStyles(colors), [colors]);

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

function roleTone(role: string): 'blue' | 'violet' | 'emerald' | 'amber' | 'neutral' {
  if (role === 'owner') return 'violet';
  if (role === 'admin') return 'blue';
  if (role === 'member') return 'emerald';
  if (role === 'viewer') return 'amber';
  return 'neutral';
}

function RoleFilterPill({
  role,
  selected,
  onPress,
}: {
  role: RoleFilter;
  selected: boolean;
  onPress: (role: RoleFilter) => void;
}) {
  const { t } = useTranslation();
  const { styles } = useTeamTheme();

  return (
    <Pressable
      accessibilityRole="button"
      onPress={() => onPress(role)}
      style={[styles.roleFilter, selected ? styles.roleFilterActive : null]}
      className="active:opacity-80"
    >
      <Text style={[styles.roleFilterText, selected ? styles.roleFilterTextActive : null]}>
        {role === 'all' ? t('common.all') : t(`team.role.${role}`)}
      </Text>
    </Pressable>
  );
}

function StatusFilterPill({
  status,
  selected,
  onPress,
}: {
  status: StatusFilter;
  selected: boolean;
  onPress: (status: StatusFilter) => void;
}) {
  const { t } = useTranslation();
  const { styles } = useTeamTheme();

  return (
    <Pressable
      accessibilityRole="button"
      onPress={() => onPress(status)}
      style={[styles.roleFilter, selected ? styles.roleFilterActive : null]}
      className="active:opacity-80"
    >
      <Text style={[styles.roleFilterText, selected ? styles.roleFilterTextActive : null]}>
        {status === 'all' ? t('common.all') : t(`team.status.${status}`)}
      </Text>
    </Pressable>
  );
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
  const { styles } = useTeamTheme();

  return (
    <Pressable
      accessibilityRole="button"
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

function memberStatusLabel(member: OrganizationMember, t: ReturnType<typeof useTranslation>['t']) {
  const status = member.memberStatus ?? member.status ?? 'active';
  if (status === 'active') return t('team.status.active');
  if (status === 'invited') return t('team.status.invited');
  if (status === 'suspended') return t('team.status.suspended');
  return status;
}

function roleLabel(role: string, t: ReturnType<typeof useTranslation>['t']) {
  if (role === 'owner') return t('team.role.owner');
  if (role === 'admin') return t('team.role.admin');
  if (role === 'member') return t('team.role.member');
  if (role === 'viewer') return t('team.role.viewer');
  if (role === 'guest') return t('team.role.guest');
  return role;
}

function projectRoleLabel(role: ProjectAssignmentRole, t: ReturnType<typeof useTranslation>['t']) {
  if (role === 'developer') return t('team.projectRoles.developer');
  if (role === 'tech_lead') return t('team.projectRoles.techLead');
  if (role === 'scrum_master') return t('team.projectRoles.scrumMaster');
  if (role === 'product_owner') return t('team.projectRoles.productOwner');
  if (role === 'qa_engineer') return t('team.projectRoles.qaEngineer');
  if (role === 'designer') return t('team.projectRoles.designer');
  return t('team.projectRoles.viewer');
}

function projectDisplayName(project: Project): string {
  return `${project.name} - ${project.key}`;
}

function projectAssignmentSummary(
  addedCount: number,
  skippedCount: number,
  t: ReturnType<typeof useTranslation>['t'],
): string {
  const parts: string[] = [];
  if (addedCount > 0) parts.push(t('team.projects.addedToProjects', { count: addedCount }));
  if (skippedCount > 0) parts.push(t('team.projects.skippedProjects', { count: skippedCount }));
  return parts.join(' ');
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

function isValidEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function InviteRolePill({
  role,
  selected,
  disabled,
  onPress,
}: {
  role: InviteRole;
  selected: boolean;
  disabled?: boolean;
  onPress: (role: InviteRole) => void;
}) {
  const { t } = useTranslation();
  const { styles } = useTeamTheme();

  return (
    <Pressable
      accessibilityRole="button"
      disabled={disabled}
      onPress={() => onPress(role)}
      style={[
        styles.roleFilter,
        selected ? styles.roleFilterActive : null,
        disabled ? styles.disabled : null,
      ]}
      className="active:opacity-80"
    >
      <Text style={[styles.roleFilterText, selected ? styles.roleFilterTextActive : null]}>
        {t(`team.role.${role}`)}
      </Text>
    </Pressable>
  );
}

function InviteExpiryPill({
  days,
  selected,
  disabled,
  onPress,
}: {
  days: InviteExpiryDays;
  selected: boolean;
  disabled?: boolean;
  onPress: (days: InviteExpiryDays) => void;
}) {
  const { t } = useTranslation();
  const { styles } = useTeamTheme();

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected, disabled }}
      disabled={disabled}
      onPress={() => onPress(days)}
      style={[
        styles.roleFilter,
        selected ? styles.roleFilterActive : null,
        disabled ? styles.disabled : null,
      ]}
      className="active:opacity-80"
    >
      <Text style={[styles.roleFilterText, selected ? styles.roleFilterTextActive : null]}>
        {t('team.inviteExpiryOption', { count: days })}
      </Text>
    </Pressable>
  );
}

function ProjectRolePill({
  role,
  selected,
  disabled,
  onPress,
}: {
  role: ProjectAssignmentRole;
  selected: boolean;
  disabled?: boolean | undefined;
  onPress: (role: ProjectAssignmentRole) => void;
}) {
  const { t } = useTranslation();
  const { styles } = useTeamTheme();

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected, disabled }}
      disabled={disabled}
      onPress={() => onPress(role)}
      style={[
        styles.roleFilter,
        selected ? styles.roleFilterActive : null,
        disabled ? styles.disabled : null,
      ]}
      className="active:opacity-80"
    >
      <Text style={[styles.roleFilterText, selected ? styles.roleFilterTextActive : null]}>
        {projectRoleLabel(role, t)}
      </Text>
    </Pressable>
  );
}

function ProjectAssignmentControls({
  disabled,
  projects,
  projectRole,
  selectedProjectIds,
  onChangeProjectRole,
  onRemoveProject,
  onToggleProject,
}: {
  disabled?: boolean;
  projects: Project[];
  projectRole: ProjectAssignmentRole;
  selectedProjectIds: string[];
  onChangeProjectRole: (role: ProjectAssignmentRole) => void;
  onRemoveProject: (id: string) => void;
  onToggleProject: (id: string) => void;
}) {
  const { t } = useTranslation();
  const { colors, styles } = useTeamTheme();
  const selectedProjects = projects.filter((project) => selectedProjectIds.includes(project.id));

  return (
    <View style={styles.projectAssignmentBox}>
      <View style={styles.agentGovernanceHeader}>
        <View style={styles.sectionTitle}>
          <FolderKanban size={15} color={colors.foreground} />
          <Text style={styles.inviteRoleLabel}>{t('team.projects.addToProjects')}</Text>
        </View>
        <SemanticBadge
          label={t('team.projects.selectedCount', { count: selectedProjectIds.length })}
          tone={selectedProjectIds.length > 0 ? 'blue' : 'neutral'}
        />
      </View>
      <Text style={styles.helperText}>{t('team.projects.description')}</Text>

      {projects.length === 0 ? (
        <Text style={styles.helperText}>{t('team.projects.noProjectsYet')}</Text>
      ) : (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.projectList}
        >
          {projects.map((project) => {
            const selected = selectedProjectIds.includes(project.id);
            return (
              <Pressable
                key={project.id}
                accessibilityRole="button"
                accessibilityState={{ selected, disabled }}
                disabled={disabled}
                onPress={() => onToggleProject(project.id)}
                style={[
                  styles.projectChip,
                  selected ? styles.projectChipSelected : null,
                  disabled ? styles.disabled : null,
                ]}
                className="active:opacity-80"
              >
                <Text
                  style={[styles.projectChipText, selected ? styles.projectChipTextSelected : null]}
                  numberOfLines={1}
                >
                  {project.name}
                </Text>
                <Text
                  style={[styles.projectChipMeta, selected ? styles.projectChipMetaSelected : null]}
                  numberOfLines={1}
                >
                  {project.key}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>
      )}

      {selectedProjects.length > 0 ? (
        <View style={styles.selectedProjectList}>
          {selectedProjects.map((project) => (
            <View key={project.id} style={styles.selectedProjectChip}>
              <Text style={styles.selectedProjectText} numberOfLines={1}>
                {projectDisplayName(project)}
              </Text>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={t('team.projects.removeProject', { name: project.name })}
                disabled={disabled}
                onPress={() => onRemoveProject(project.id)}
                style={[styles.selectedProjectRemove, disabled ? styles.disabled : null]}
                className="active:opacity-80"
              >
                <X size={13} color={colors.mutedForeground} />
              </Pressable>
            </View>
          ))}
        </View>
      ) : null}

      <View style={styles.inviteRoleBlock}>
        <Text style={styles.inviteRoleLabel}>{t('team.projects.projectRoleLabel')}</Text>
        <View style={styles.roleFiltersInline}>
          {PROJECT_ROLES.map((role) => (
            <ProjectRolePill
              key={role}
              role={role}
              selected={projectRole === role}
              disabled={disabled}
              onPress={onChangeProjectRole}
            />
          ))}
        </View>
      </View>
    </View>
  );
}

function InviteMemberPanel({
  email,
  error,
  inviteExpiresInDays,
  notice,
  projectRole,
  projects,
  role,
  saving,
  selectedProjectIds,
  onChangeEmail,
  onChangeInviteExpiresInDays,
  onChangeProjectRole,
  onChangeRole,
  onRemoveProject,
  onSubmit,
  onToggleProject,
}: {
  email: string;
  error?: string | null;
  inviteExpiresInDays: InviteExpiryDays;
  notice?: string | null;
  projectRole: ProjectAssignmentRole;
  projects: Project[];
  role: InviteRole;
  saving: boolean;
  selectedProjectIds: string[];
  onChangeEmail: (value: string) => void;
  onChangeInviteExpiresInDays: (days: InviteExpiryDays) => void;
  onChangeProjectRole: (role: ProjectAssignmentRole) => void;
  onChangeRole: (role: InviteRole) => void;
  onRemoveProject: (id: string) => void;
  onSubmit: () => void;
  onToggleProject: (id: string) => void;
}) {
  const { t } = useTranslation();
  const { colors, styles } = useTeamTheme();

  return (
    <View style={styles.invitePanel}>
      <View style={styles.sectionTitle}>
        <UserPlus size={16} color={colors.foreground} />
        <Text className="text-foreground text-base font-semibold">{t('team.inviteMember')}</Text>
      </View>
      <Text style={styles.inviteDescription}>{t('team.inviteDescription')}</Text>
      <TextField
        label={t('onboarding.email')}
        value={email}
        onChangeText={onChangeEmail}
        autoCapitalize="none"
        autoCorrect={false}
        editable={!saving}
        error={error ?? undefined}
        keyboardType="email-address"
        returnKeyType="send"
        textContentType="emailAddress"
        onSubmitEditing={onSubmit}
      />
      <View style={styles.inviteRoleBlock}>
        <Text style={styles.inviteRoleLabel}>{t('team.roleLabel')}</Text>
        <View style={styles.roleFiltersInline}>
          {INVITE_ROLES.map((item) => (
            <InviteRolePill
              key={item}
              role={item}
              selected={role === item}
              disabled={saving}
              onPress={onChangeRole}
            />
          ))}
        </View>
      </View>
      <View style={styles.inviteRoleBlock}>
        <Text style={styles.inviteRoleLabel}>{t('team.inviteExpiry')}</Text>
        <View style={styles.roleFiltersInline}>
          {INVITE_EXPIRY_OPTIONS.map((days) => (
            <InviteExpiryPill
              key={days}
              days={days}
              selected={inviteExpiresInDays === days}
              disabled={saving}
              onPress={onChangeInviteExpiresInDays}
            />
          ))}
        </View>
        <Text style={styles.helperText}>{t('team.inviteExpiryHelp')}</Text>
      </View>
      <ProjectAssignmentControls
        disabled={saving}
        projects={projects}
        projectRole={projectRole}
        selectedProjectIds={selectedProjectIds}
        onChangeProjectRole={onChangeProjectRole}
        onRemoveProject={onRemoveProject}
        onToggleProject={onToggleProject}
      />
      {notice ? <Text style={styles.inviteNotice}>{notice}</Text> : null}
      <Button
        title={t('team.invite')}
        icon={UserPlus}
        loading={saving}
        disabled={saving || !email.trim()}
        onPress={onSubmit}
      />
    </View>
  );
}

function AgentGovernancePanel({
  policy,
  approvals,
  decisionError,
  decidingId,
  loadingPolicy,
  loadingApprovals,
  policyError,
  approvalsError,
  onApprove,
  onReject,
}: {
  policy: AgentPolicyStatus | undefined;
  approvals: AgentApprovalRequest[];
  decisionError: string | null;
  decidingId: string | null;
  loadingPolicy: boolean;
  loadingApprovals: boolean;
  policyError: unknown;
  approvalsError: unknown;
  onApprove: (approval: AgentApprovalRequest) => void;
  onReject: (approval: AgentApprovalRequest) => void;
}) {
  const { t } = useTranslation();
  const { colors, styles } = useTeamTheme();
  const visibleRules = policy?.rules.slice(0, 6) ?? [];
  const visibleApprovals = approvals.slice(0, 6);

  return (
    <View style={styles.agentGovernanceSection}>
      <View style={styles.agentGovernanceHeader}>
        <View style={styles.sectionTitle}>
          <ShieldCheck size={16} color={colors.foreground} />
          <Text className="text-foreground text-base font-semibold">
            {t('team.agentGovernance.title')}
          </Text>
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
      <Text style={styles.inviteDescription}>{t('team.agentGovernance.description')}</Text>

      {loadingPolicy ? (
        <Text style={styles.helperText}>{t('team.agentGovernance.loading')}</Text>
      ) : null}
      {policyError ? (
        <Text style={styles.memberActionError}>{t('team.agentGovernance.loadFailed')}</Text>
      ) : null}
      {policy ? (
        <>
          <View style={styles.agentStatusGrid}>
            <View style={styles.agentStatusTile}>
              <Text style={styles.agentTileLabel}>{t('team.agentGovernance.policySource')}</Text>
              <Text style={styles.agentTileValue} numberOfLines={1}>
                {policy.sourcePath || t('team.agentGovernance.noPolicy')}
              </Text>
            </View>
            <View style={styles.agentStatusTile}>
              <Text style={styles.agentTileLabel}>{t('team.agentGovernance.lastParsed')}</Text>
              <Text style={styles.agentTileValue} numberOfLines={1}>
                {policy.parsedAt ? relativeTime(policy.parsedAt) : t('common.none')}
              </Text>
            </View>
            <View style={styles.agentStatusTile}>
              <Text style={styles.agentTileLabel}>
                {t('team.agentGovernance.validationErrors')}
              </Text>
              <Text
                style={[
                  styles.agentTileValue,
                  policy.errors.length > 0 ? styles.agentTileDanger : null,
                ]}
                numberOfLines={1}
              >
                {policy.errors.length}
              </Text>
            </View>
          </View>

          {policy.errors.length > 0 ? (
            <View style={styles.agentNoticeDanger}>
              <View style={styles.sectionTitle}>
                <AlertTriangle size={15} color={colors.destructive} />
                <Text style={styles.memberActionError}>
                  {t('team.agentGovernance.validationTitle')}
                </Text>
              </View>
              {policy.errors.slice(0, 3).map((error, index) => (
                <Text
                  key={`${error.line}-${index}`}
                  style={styles.memberActionError}
                  numberOfLines={2}
                >
                  {t('team.agentGovernance.validationLine', {
                    line: error.line,
                    message: error.message || error.raw,
                  })}
                </Text>
              ))}
            </View>
          ) : null}

          <View style={styles.agentSubsection}>
            <Text style={styles.inviteRoleLabel}>{t('team.agentGovernance.rulesTitle')}</Text>
            {visibleRules.length === 0 ? (
              <Text style={styles.helperText}>{t('team.agentGovernance.noRules')}</Text>
            ) : null}
            {visibleRules.map((rule) => (
              <View key={`${rule.line}-${rule.raw}`} style={styles.agentRuleRow}>
                <View className="min-w-0 flex-1 gap-1">
                  <Text className="text-foreground text-sm font-semibold" numberOfLines={1}>
                    {rule.actorKind}:{rule.actor}
                  </Text>
                  <Text className="text-muted-foreground text-xs" numberOfLines={1}>
                    {rule.resource}:{rule.action}
                  </Text>
                </View>
                <View className="items-end gap-1">
                  <SemanticBadge
                    label={t(policyEffectLabelKey(rule.effect))}
                    tone={policyEffectTone(rule.effect)}
                  />
                  <Text style={styles.agentLineText}>
                    {t('team.agentGovernance.line', { line: rule.line })}
                  </Text>
                </View>
              </View>
            ))}
          </View>
        </>
      ) : null}

      <View style={styles.agentSubsection}>
        <View style={styles.agentGovernanceHeader}>
          <Text style={styles.inviteRoleLabel}>{t('team.agentGovernance.queueTitle')}</Text>
          <SemanticBadge
            label={t('team.agentGovernance.queueCount', { count: approvals.length })}
            tone={approvals.length > 0 ? 'amber' : 'neutral'}
          />
        </View>
        {loadingApprovals ? (
          <Text style={styles.helperText}>{t('team.agentGovernance.queueLoading')}</Text>
        ) : null}
        {approvalsError ? (
          <Text style={styles.memberActionError}>{t('team.agentGovernance.queueLoadFailed')}</Text>
        ) : null}
        {decisionError ? <Text style={styles.memberActionError}>{decisionError}</Text> : null}
        {!loadingApprovals && approvals.length === 0 ? (
          <Text style={styles.helperText}>{t('team.agentGovernance.queueEmpty')}</Text>
        ) : null}
        {visibleApprovals.map((approval) => {
          const busy = decidingId === approval.id;
          return (
            <View key={approval.id} style={styles.agentApprovalRow}>
              <View style={styles.agentApprovalHeader}>
                <View className="min-w-0 flex-1 gap-1">
                  <Text className="text-foreground text-sm font-semibold" numberOfLines={1}>
                    {approval.actor}
                  </Text>
                  <Text className="text-muted-foreground text-xs" numberOfLines={1}>
                    {approval.resource}:{approval.action}
                  </Text>
                </View>
                <SemanticBadge
                  label={t(approvalStatusLabelKey(approval.status))}
                  tone={approvalStatusTone(approval.status)}
                />
              </View>
              <View style={styles.agentMetaRow}>
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
                <Text style={styles.agentCodeText} numberOfLines={2}>
                  {approval.matchedRule}
                </Text>
              ) : null}
              <Text selectable style={styles.agentPayloadText} numberOfLines={6}>
                {payloadPreview(approval.proposedPayload)}
              </Text>
              <View style={styles.agentDecisionRow}>
                <View style={styles.agentDecisionButton}>
                  <Button
                    title={t('team.agentGovernance.approve')}
                    icon={Check}
                    loading={busy}
                    disabled={busy}
                    onPress={() => onApprove(approval)}
                  />
                </View>
                <View style={styles.agentDecisionButton}>
                  <Button
                    title={t('team.agentGovernance.reject')}
                    variant="secondary"
                    icon={X}
                    disabled={busy}
                    onPress={() => onReject(approval)}
                  />
                </View>
              </View>
            </View>
          );
        })}
      </View>
    </View>
  );
}

function AssignMemberProjectsPanel({
  error,
  member,
  notice,
  projectRole,
  projects,
  saving,
  selectedProjectIds,
  onCancel,
  onChangeProjectRole,
  onRemoveProject,
  onSubmit,
  onToggleProject,
}: {
  error?: string | null;
  member: OrganizationMember;
  notice?: string | null;
  projectRole: ProjectAssignmentRole;
  projects: Project[];
  saving: boolean;
  selectedProjectIds: string[];
  onCancel: () => void;
  onChangeProjectRole: (role: ProjectAssignmentRole) => void;
  onRemoveProject: (id: string) => void;
  onSubmit: () => void;
  onToggleProject: (id: string) => void;
}) {
  const { t } = useTranslation();
  const { colors, styles } = useTeamTheme();
  const displayName = member.name ?? member.email;

  return (
    <View style={styles.assignPanel}>
      <View style={styles.agentGovernanceHeader}>
        <View style={styles.sectionTitle}>
          <FolderKanban size={16} color={colors.foreground} />
          <Text className="text-foreground text-base font-semibold">
            {t('team.projects.assignMemberTitle')}
          </Text>
        </View>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t('common.cancel')}
          onPress={onCancel}
          style={styles.panelCloseButton}
          className="active:opacity-80"
        >
          <X size={16} color={colors.mutedForeground} />
        </Pressable>
      </View>
      <Text style={styles.helperText}>
        {t('team.projects.assignMemberDescription', { name: displayName })}
      </Text>
      <ProjectAssignmentControls
        disabled={saving}
        projects={projects}
        projectRole={projectRole}
        selectedProjectIds={selectedProjectIds}
        onChangeProjectRole={onChangeProjectRole}
        onRemoveProject={onRemoveProject}
        onToggleProject={onToggleProject}
      />
      {error ? <Text style={styles.memberActionError}>{error}</Text> : null}
      {notice ? <Text style={styles.inviteNotice}>{notice}</Text> : null}
      <View style={styles.assignActions}>
        <View style={styles.assignActionButton}>
          <Button
            title={t('common.cancel')}
            variant="secondary"
            disabled={saving}
            onPress={onCancel}
          />
        </View>
        <View style={styles.assignActionButton}>
          <Button
            title={t('team.projects.assign')}
            icon={FolderKanban}
            loading={saving}
            disabled={saving || selectedProjectIds.length === 0}
            onPress={onSubmit}
          />
        </View>
      </View>
    </View>
  );
}

function TeamMemberRow({
  actionError,
  assigning,
  canAssignProjects,
  canManageRoles,
  canRemove,
  member,
  removing,
  updating,
  onAssignProjects,
  onChangeRole,
  onRemove,
}: {
  actionError?: string | null;
  assigning: boolean;
  canAssignProjects: boolean;
  canManageRoles: boolean;
  canRemove: boolean;
  member: OrganizationMember;
  removing: boolean;
  updating: boolean;
  onAssignProjects: (member: OrganizationMember) => void;
  onChangeRole: (member: OrganizationMember, role: InviteRole) => void;
  onRemove: (member: OrganizationMember) => void;
}) {
  const { t } = useTranslation();
  const { colors, styles } = useTeamTheme();
  const displayName = member.name ?? member.email;
  const joinedAt = relativeTime(member.joinedAt);
  const busy = updating || removing || assigning;

  return (
    <View style={styles.memberRow}>
      <Avatar initials={initials(member.name, member.email)} size={42} />
      <View style={styles.memberBody}>
        <View style={styles.memberHeader}>
          <View style={styles.memberIdentity}>
            <Text className="text-foreground text-base font-semibold" numberOfLines={1}>
              {displayName}
            </Text>
            <Text className="text-muted-foreground text-sm" numberOfLines={1}>
              {member.email}
            </Text>
          </View>
          {member.isAgent ? <Bot size={17} color={colors.accentViolet} /> : null}
        </View>

        <View style={styles.memberFooter}>
          <SemanticBadge label={roleLabel(member.role, t)} tone={roleTone(member.role)} />
          <SemanticBadge label={memberStatusLabel(member, t)} />
          {joinedAt ? (
            <Text style={styles.joinedAt} numberOfLines={1}>
              {t('team.joinedAt', { time: joinedAt })}
            </Text>
          ) : null}
        </View>
        {canManageRoles ? (
          <View style={styles.memberManageBlock}>
            <Text style={styles.inviteRoleLabel}>{t('team.roleLabel')}</Text>
            <View style={styles.roleFiltersInline}>
              {INVITE_ROLES.map((role) => (
                <InviteRolePill
                  key={role}
                  role={role}
                  selected={member.role === role}
                  disabled={busy}
                  onPress={(nextRole) => onChangeRole(member, nextRole)}
                />
              ))}
            </View>
          </View>
        ) : null}
        {actionError ? <Text style={styles.memberActionError}>{actionError}</Text> : null}
        {canAssignProjects ? (
          <Button
            title={t('team.projects.addToProjects')}
            variant="secondary"
            icon={FolderKanban}
            loading={assigning}
            disabled={busy}
            onPress={() => onAssignProjects(member)}
          />
        ) : null}
        {canRemove ? (
          <Button
            title={t('team.removeMember')}
            variant="destructive"
            icon={Trash2}
            loading={removing}
            disabled={busy}
            onPress={() => onRemove(member)}
          />
        ) : null}
      </View>
    </View>
  );
}

function TeamEmpty({ filtered }: { filtered: boolean }) {
  const { t } = useTranslation();

  return (
    <EmptyState
      icon={Users}
      title={filtered ? t('team.noMatches') : t('team.empty')}
      description={filtered ? t('team.noMatchesDesc') : t('team.emptyDesc')}
    />
  );
}

export function TeamScreen() {
  const { t } = useTranslation();
  const { colors, styles } = useTeamTheme();
  const route = useRoute<TeamRoute>();
  const routeStatusFilter = route.params?.statusFilter;
  const projectsQ = useProjects();
  const [selectedOrganizationId, setSelectedOrganizationId] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState<RoleFilter>('all');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>(routeStatusFilter ?? 'all');
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState<InviteRole>('member');
  const [inviteExpiresInDays, setInviteExpiresInDays] = useState<InviteExpiryDays>(7);
  const [inviteProjectIds, setInviteProjectIds] = useState<string[]>([]);
  const [inviteProjectRole, setInviteProjectRole] = useState<ProjectAssignmentRole>('developer');
  const [inviteError, setInviteError] = useState<string | null>(null);
  const [inviteNotice, setInviteNotice] = useState<string | null>(null);
  const [assignTargetMember, setAssignTargetMember] = useState<OrganizationMember | null>(null);
  const [assignProjectIds, setAssignProjectIds] = useState<string[]>([]);
  const [assignProjectRole, setAssignProjectRole] = useState<ProjectAssignmentRole>('developer');
  const [assignError, setAssignError] = useState<string | null>(null);
  const [assignNotice, setAssignNotice] = useState<string | null>(null);
  const [memberActionError, setMemberActionError] = useState<{
    memberId: string;
    message: string;
  } | null>(null);
  const [memberNotice, setMemberNotice] = useState<string | null>(null);
  const [updatingMemberId, setUpdatingMemberId] = useState<string | null>(null);
  const [removingMemberId, setRemovingMemberId] = useState<string | null>(null);
  const [agentDecisionError, setAgentDecisionError] = useState<string | null>(null);
  const [decidingApprovalId, setDecidingApprovalId] = useState<string | null>(null);
  const currentUserId = useSession((s) => s.user?.id ?? null);

  const projects = useMemo(() => projectsQ.data ?? [], [projectsQ.data]);
  const organizations = useMemo(() => uniqueOrganizations(projects), [projects]);
  const activeOrganizationId = selectedOrganizationId ?? organizations[0]?.id ?? null;
  const assignableProjects = useMemo(
    () => projects.filter((project) => project.organizationId === activeOrganizationId),
    [activeOrganizationId, projects],
  );
  const membersQ = useOrganizationMembers(activeOrganizationId);
  const inviteMember = useInviteOrganizationMember(activeOrganizationId);
  const assignMemberProjects = useAssignOrganizationMemberProjects(activeOrganizationId);
  const updateMemberRole = useUpdateOrganizationMemberRole(activeOrganizationId);
  const removeMember = useRemoveOrganizationMember(activeOrganizationId);
  const members = useMemo(() => membersQ.data?.members ?? [], [membersQ.data?.members]);
  const canManageMembers = Boolean(
    membersQ.data?.isSuperAdmin ||
      membersQ.data?.userRole === 'owner' ||
      membersQ.data?.userRole === 'admin',
  );
  const canRemoveMembers = Boolean(
    membersQ.data?.isSuperAdmin || membersQ.data?.userRole === 'owner',
  );
  const canAssignProjects = canManageMembers;
  const agentPolicyQ = useAgentPolicy(activeOrganizationId, canManageMembers);
  const agentApprovalsQ = useAgentApprovals(activeOrganizationId, 'pending', canManageMembers);
  const approveAgentApproval = useApproveAgentApproval(activeOrganizationId);
  const rejectAgentApproval = useRejectAgentApproval(activeOrganizationId);
  const visibleMembers = useMemo(() => {
    const search = query.trim().toLowerCase();
    return members.filter((member) => {
      const roleMatches = roleFilter === 'all' || member.role === roleFilter;
      if (!roleMatches) return false;
      const status = member.memberStatus ?? member.status ?? 'active';
      const statusMatches = statusFilter === 'all' || status === statusFilter;
      if (!statusMatches) return false;
      if (!search) return true;
      return [member.name, member.email, member.role, member.memberStatus]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(search));
    });
  }, [members, query, roleFilter, statusFilter]);

  useEffect(() => {
    if (selectedOrganizationId && organizations.some((org) => org.id === selectedOrganizationId)) {
      return;
    }
    setSelectedOrganizationId(organizations[0]?.id ?? null);
  }, [organizations, selectedOrganizationId]);

  useEffect(() => {
    setInviteError(null);
    setInviteNotice(null);
    setInviteExpiresInDays(7);
    setInviteProjectIds([]);
    setInviteProjectRole('developer');
    setAssignTargetMember(null);
    setAssignProjectIds([]);
    setAssignProjectRole('developer');
    setAssignError(null);
    setAssignNotice(null);
    setMemberActionError(null);
    setMemberNotice(null);
    setUpdatingMemberId(null);
    setRemovingMemberId(null);
    setAgentDecisionError(null);
    setDecidingApprovalId(null);
  }, [activeOrganizationId]);

  useEffect(() => {
    if (routeStatusFilter) {
      setStatusFilter(routeStatusFilter);
      setRoleFilter('all');
    }
  }, [routeStatusFilter]);

  useEffect(() => {
    const availableIds = new Set(assignableProjects.map((project) => project.id));
    setInviteProjectIds((current) => current.filter((projectId) => availableIds.has(projectId)));
    setAssignProjectIds((current) => current.filter((projectId) => availableIds.has(projectId)));
  }, [assignableProjects]);

  const toggleInviteProject = (projectId: string) => {
    setInviteProjectIds((current) =>
      current.includes(projectId)
        ? current.filter((id) => id !== projectId)
        : [...current, projectId],
    );
    setInviteNotice(null);
  };

  const toggleAssignProject = (projectId: string) => {
    setAssignProjectIds((current) =>
      current.includes(projectId)
        ? current.filter((id) => id !== projectId)
        : [...current, projectId],
    );
    setAssignError(null);
    setAssignNotice(null);
  };

  const openAssignProjects = (member: OrganizationMember) => {
    setAssignTargetMember(member);
    setAssignProjectIds([]);
    setAssignProjectRole('developer');
    setAssignError(null);
    setAssignNotice(null);
    setMemberActionError(null);
    setMemberNotice(null);
  };

  const closeAssignProjects = () => {
    setAssignTargetMember(null);
    setAssignProjectIds([]);
    setAssignProjectRole('developer');
    setAssignError(null);
    setAssignNotice(null);
  };

  const submitInvite = async () => {
    if (!activeOrganizationId) return;
    const email = inviteEmail.trim().toLowerCase();
    if (!email) {
      setInviteError(t('validation.emailRequired'));
      return;
    }
    if (!isValidEmail(email)) {
      setInviteError(t('validation.emailInvalid'));
      return;
    }

    setInviteError(null);
    setInviteNotice(null);
    setMemberNotice(null);
    try {
      const selectedProjectIds = inviteProjectIds.filter((projectId) =>
        assignableProjects.some((project) => project.id === projectId),
      );
      const invitePayload = {
        email,
        role: inviteRole,
        inviteExpiresInDays,
      };
      const response = await inviteMember.mutateAsync(
        selectedProjectIds.length > 0
          ? {
              ...invitePayload,
              projectIds: selectedProjectIds,
              projectRole: inviteProjectRole,
            }
          : invitePayload,
      );
      const assignmentSummary = projectAssignmentSummary(
        response.addedToProjects?.length ?? 0,
        response.skippedProjects?.length ?? 0,
        t,
      );
      setInviteEmail('');
      setInviteRole('member');
      setInviteExpiresInDays(7);
      setInviteProjectIds([]);
      setInviteProjectRole('developer');
      setInviteNotice(
        [t('team.invitedEmail', { email: response.member.email ?? email }), assignmentSummary]
          .filter(Boolean)
          .join(' '),
      );
    } catch (err: unknown) {
      setInviteError(err instanceof Error ? err.message : t('team.inviteFailed'));
    }
  };

  const submitAssignProjects = async () => {
    if (!activeOrganizationId || !assignTargetMember) return;
    const selectedProjectIds = assignProjectIds.filter((projectId) =>
      assignableProjects.some((project) => project.id === projectId),
    );
    if (selectedProjectIds.length === 0) {
      setAssignError(t('team.projects.selectAtLeastOne'));
      return;
    }

    setAssignError(null);
    setAssignNotice(null);
    setMemberActionError(null);
    setMemberNotice(null);
    try {
      const response = await assignMemberProjects.mutateAsync({
        memberId: assignTargetMember.id,
        projectIds: selectedProjectIds,
        projectRole: assignProjectRole,
      });
      const assignmentSummary = projectAssignmentSummary(
        response.addedToProjects?.length ?? 0,
        response.skippedProjects?.length ?? 0,
        t,
      );
      setAssignNotice(assignmentSummary || t('team.projects.assignmentComplete'));
      setAssignProjectIds([]);
    } catch (err: unknown) {
      setAssignError(err instanceof Error ? err.message : t('team.projects.assignFailed'));
    }
  };

  const changeMemberRole = async (member: OrganizationMember, role: InviteRole) => {
    if (!activeOrganizationId || member.id === currentUserId || member.role === role) return;

    setUpdatingMemberId(member.id);
    setMemberActionError(null);
    setMemberNotice(null);
    try {
      await updateMemberRole.mutateAsync({ memberId: member.id, role });
      setMemberNotice(t('team.roleUpdated'));
    } catch (err: unknown) {
      setMemberActionError({
        memberId: member.id,
        message: err instanceof Error ? err.message : t('team.updateRoleFailed'),
      });
    } finally {
      setUpdatingMemberId(null);
    }
  };

  const removeMemberById = async (member: OrganizationMember) => {
    if (!activeOrganizationId || member.id === currentUserId || member.role === 'owner') return;

    setRemovingMemberId(member.id);
    setMemberActionError(null);
    setMemberNotice(null);
    try {
      await removeMember.mutateAsync(member.id);
      setMemberNotice(t('team.memberRemoved'));
    } catch (err: unknown) {
      setMemberActionError({
        memberId: member.id,
        message: err instanceof Error ? err.message : t('team.removeFailed'),
      });
    } finally {
      setRemovingMemberId(null);
    }
  };

  const confirmRemoveMember = (member: OrganizationMember) => {
    Alert.alert(t('team.removeMember'), member.name ?? member.email, [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('team.removeMember'),
        style: 'destructive',
        onPress: () => void removeMemberById(member),
      },
    ]);
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

  if (projectsQ.isLoading) return <Loading />;
  if (projectsQ.isError) {
    return (
      <Screen>
        <ErrorView
          message={projectsQ.error instanceof Error ? projectsQ.error.message : t('common.retry')}
          onRetry={() => void projectsQ.refetch()}
        />
      </Screen>
    );
  }

  if (organizations.length === 0) {
    return (
      <Screen>
        <ScreenHeader
          kicker={t('common.appName')}
          title={t('team.title')}
          subtitle={t('team.subtitle')}
          meta={<SemanticBadge label={t('team.memberCount', { count: 0 })} tone="violet" />}
        />
        <View style={styles.emptyWrap}>
          <EmptyState
            icon={Users}
            title={t('team.noWorkspace')}
            description={t('team.noWorkspaceDesc')}
          />
        </View>
      </Screen>
    );
  }

  if (membersQ.isError) {
    return (
      <Screen>
        <ScreenHeader
          kicker={t('common.appName')}
          title={t('team.title')}
          subtitle={t('team.subtitle')}
          meta={<SemanticBadge label={t('team.memberCount', { count: 0 })} tone="violet" />}
        />
        <ErrorView
          message={membersQ.error instanceof Error ? membersQ.error.message : t('team.loadFailed')}
          onRetry={() => void membersQ.refetch()}
        />
      </Screen>
    );
  }

  const filtered = Boolean(query.trim()) || roleFilter !== 'all' || statusFilter !== 'all';
  const renderItem: ListRenderItem<OrganizationMember> = ({ item }) => {
    const isCurrentUser = item.id === currentUserId;
    const canManageRow = canManageMembers && !isCurrentUser;
    const canRemoveRow = canRemoveMembers && !isCurrentUser && item.role !== 'owner';

    return (
      <TeamMemberRow
        member={item}
        assigning={assignMemberProjects.isPending && assignTargetMember?.id === item.id}
        canAssignProjects={canAssignProjects}
        canManageRoles={canManageRow}
        canRemove={canRemoveRow}
        updating={updatingMemberId === item.id}
        removing={removingMemberId === item.id}
        actionError={memberActionError?.memberId === item.id ? memberActionError.message : null}
        onAssignProjects={openAssignProjects}
        onChangeRole={(member, role) => void changeMemberRole(member, role)}
        onRemove={confirmRemoveMember}
      />
    );
  };

  return (
    <Screen>
      <ScreenHeader
        kicker={t('common.appName')}
        title={t('team.title')}
        subtitle={t('team.subtitle')}
        meta={
          <SemanticBadge
            label={t('team.memberCount', { count: visibleMembers.length })}
            tone="violet"
          />
        }
      />

      <FlatList
        data={visibleMembers}
        keyExtractor={(member) => member.id}
        renderItem={renderItem}
        contentContainerStyle={styles.listContent}
        refreshControl={
          <RefreshControl
            refreshing={
              projectsQ.isRefetching ||
              membersQ.isRefetching ||
              agentPolicyQ.isRefetching ||
              agentApprovalsQ.isRefetching
            }
            onRefresh={() => {
              void projectsQ.refetch();
              void membersQ.refetch();
              if (canManageMembers) {
                void agentPolicyQ.refetch();
                void agentApprovalsQ.refetch();
              }
            }}
          />
        }
        ListHeaderComponent={
          <View style={styles.headerContent}>
            {organizations.length > 1 ? (
              <View style={styles.section}>
                <View style={styles.sectionTitle}>
                  <Shield size={16} color={colors.foreground} />
                  <Text className="text-foreground text-base font-semibold">
                    {t('team.workspace')}
                  </Text>
                </View>
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={styles.orgList}
                >
                  {organizations.map((org, index) => (
                    <OrganizationPill
                      key={org.id}
                      index={index}
                      option={org}
                      selected={org.id === activeOrganizationId}
                      onPress={setSelectedOrganizationId}
                    />
                  ))}
                </ScrollView>
              </View>
            ) : null}

            {canManageMembers ? (
              <InviteMemberPanel
                email={inviteEmail}
                role={inviteRole}
                inviteExpiresInDays={inviteExpiresInDays}
                error={inviteError}
                notice={inviteNotice}
                projectRole={inviteProjectRole}
                projects={assignableProjects}
                saving={inviteMember.isPending}
                selectedProjectIds={inviteProjectIds}
                onChangeEmail={(value) => {
                  setInviteEmail(value);
                  if (inviteError) setInviteError(null);
                  if (inviteNotice) setInviteNotice(null);
                }}
                onChangeInviteExpiresInDays={setInviteExpiresInDays}
                onChangeProjectRole={setInviteProjectRole}
                onChangeRole={setInviteRole}
                onRemoveProject={(projectId) => {
                  setInviteProjectIds((current) => current.filter((id) => id !== projectId));
                  setInviteNotice(null);
                }}
                onSubmit={() => void submitInvite()}
                onToggleProject={toggleInviteProject}
              />
            ) : null}

            {canAssignProjects && assignTargetMember ? (
              <AssignMemberProjectsPanel
                member={assignTargetMember}
                projects={assignableProjects}
                projectRole={assignProjectRole}
                selectedProjectIds={assignProjectIds}
                saving={assignMemberProjects.isPending}
                error={assignError}
                notice={assignNotice}
                onCancel={closeAssignProjects}
                onChangeProjectRole={(role) => {
                  setAssignProjectRole(role);
                  setAssignError(null);
                  setAssignNotice(null);
                }}
                onRemoveProject={(projectId) => {
                  setAssignProjectIds((current) => current.filter((id) => id !== projectId));
                  setAssignError(null);
                  setAssignNotice(null);
                }}
                onSubmit={() => void submitAssignProjects()}
                onToggleProject={toggleAssignProject}
              />
            ) : null}

            {canManageMembers ? (
              <AgentGovernancePanel
                policy={agentPolicyQ.data}
                approvals={agentApprovalsQ.data ?? []}
                decisionError={agentDecisionError}
                decidingId={decidingApprovalId}
                loadingPolicy={agentPolicyQ.isLoading}
                loadingApprovals={agentApprovalsQ.isLoading}
                policyError={agentPolicyQ.error}
                approvalsError={agentApprovalsQ.error}
                onApprove={(approval) => void decideAgentApproval(approval, 'approve')}
                onReject={(approval) => void decideAgentApproval(approval, 'reject')}
              />
            ) : null}

            {memberNotice ? <Text style={styles.memberNotice}>{memberNotice}</Text> : null}

            <View style={styles.section}>
              <TextField
                label={t('common.search')}
                value={query}
                onChangeText={setQuery}
                placeholder={t('team.searchPlaceholder')}
              />
              <View style={styles.searchIcon}>
                <Search size={15} color={colors.mutedForeground} />
              </View>
            </View>

            <View style={styles.roleFilters}>
              {ROLE_FILTERS.map((role) => (
                <RoleFilterPill
                  key={role}
                  role={role}
                  selected={roleFilter === role}
                  onPress={setRoleFilter}
                />
              ))}
            </View>

            <View style={styles.roleFilters}>
              {STATUS_FILTERS.map((status) => (
                <StatusFilterPill
                  key={status}
                  status={status}
                  selected={statusFilter === status}
                  onPress={setStatusFilter}
                />
              ))}
            </View>
          </View>
        }
        ListEmptyComponent={membersQ.isLoading ? <Loading /> : <TeamEmpty filtered={filtered} />}
      />
    </Screen>
  );
}

function createTeamStyles(colors: ThemeColors) {
  return StyleSheet.create({
    listContent: {
      gap: 12,
      paddingBottom: 16,
    },
    headerContent: {
      gap: 14,
    },
    section: {
      gap: 10,
      paddingHorizontal: 16,
    },
    sectionTitle: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
    },
    orgList: {
      gap: 8,
      paddingRight: 16,
    },
    orgPill: {
      width: 190,
      gap: 3,
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
    orgMeta: {
      color: colors.mutedForeground,
      fontSize: 11,
      lineHeight: 16,
    },
    orgMetaRow: {
      minWidth: 0,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
    },
    orgMetaDot: {
      width: 3,
      height: 3,
      borderRadius: 999,
      backgroundColor: colors.mutedForeground,
    },
    orgMetaDotActive: {
      backgroundColor: colors.foreground,
    },
    orgMetaActive: {
      color: colors.foreground,
    },
    searchIcon: {
      position: 'absolute',
      right: 28,
      bottom: 17,
    },
    roleFilters: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 8,
      paddingHorizontal: 16,
    },
    roleFilter: {
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
      borderRadius: 4,
      backgroundColor: colors.card,
      paddingHorizontal: 10,
      paddingVertical: 7,
    },
    roleFilterActive: {
      borderColor: colors.primary,
      backgroundColor: colors.primary,
    },
    roleFilterText: {
      color: colors.mutedForeground,
      fontSize: 12,
      fontWeight: '700',
      lineHeight: 16,
    },
    roleFilterTextActive: {
      color: colors.primaryForeground,
    },
    disabled: {
      opacity: 0.55,
    },
    invitePanel: {
      gap: 12,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
      borderRadius: 6,
      backgroundColor: colors.card,
      marginHorizontal: 16,
      padding: 12,
    },
    inviteDescription: {
      color: colors.mutedForeground,
      fontSize: 13,
      lineHeight: 18,
    },
    inviteRoleBlock: {
      gap: 8,
    },
    inviteRoleLabel: {
      color: colors.foreground,
      fontSize: 13,
      fontWeight: '600',
      lineHeight: 18,
    },
    roleFiltersInline: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 8,
    },
    inviteNotice: {
      color: colors.accentEmerald,
      fontSize: 13,
      lineHeight: 18,
    },
    helperText: {
      color: colors.mutedForeground,
      fontSize: 13,
      lineHeight: 18,
    },
    projectAssignmentBox: {
      gap: 10,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
      borderRadius: 6,
      backgroundColor: colors.background,
      padding: 10,
    },
    projectList: {
      gap: 8,
      paddingRight: 10,
    },
    projectChip: {
      width: 156,
      gap: 3,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
      borderRadius: 6,
      backgroundColor: colors.card,
      paddingHorizontal: 10,
      paddingVertical: 8,
    },
    projectChipSelected: {
      borderColor: colors.primary,
      backgroundColor: colors.primary,
    },
    projectChipText: {
      color: colors.foreground,
      fontSize: 13,
      fontWeight: '700',
      lineHeight: 18,
    },
    projectChipTextSelected: {
      color: colors.primaryForeground,
    },
    projectChipMeta: {
      color: colors.mutedForeground,
      fontSize: 11,
      fontWeight: '700',
      lineHeight: 15,
    },
    projectChipMetaSelected: {
      color: colors.primaryForeground,
    },
    selectedProjectList: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 6,
    },
    selectedProjectChip: {
      maxWidth: '100%',
      minHeight: 30,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
      borderRadius: 4,
      backgroundColor: colors.muted,
      paddingLeft: 9,
      paddingRight: 5,
      paddingVertical: 4,
    },
    selectedProjectText: {
      maxWidth: 220,
      color: colors.foreground,
      fontSize: 12,
      fontWeight: '700',
      lineHeight: 16,
    },
    selectedProjectRemove: {
      width: 22,
      height: 22,
      alignItems: 'center',
      justifyContent: 'center',
      borderRadius: 4,
    },
    assignPanel: {
      gap: 12,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
      borderRadius: 6,
      backgroundColor: colors.card,
      marginHorizontal: 16,
      padding: 12,
    },
    panelCloseButton: {
      width: 32,
      height: 32,
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
      borderRadius: 6,
      backgroundColor: colors.background,
    },
    assignActions: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 8,
    },
    assignActionButton: {
      minWidth: 130,
      flex: 1,
    },
    agentGovernanceSection: {
      gap: 12,
      marginHorizontal: 16,
    },
    agentGovernanceHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 10,
    },
    agentStatusGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 8,
    },
    agentStatusTile: {
      minWidth: 132,
      flex: 1,
      gap: 4,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
      borderRadius: 6,
      backgroundColor: colors.card,
      paddingHorizontal: 10,
      paddingVertical: 9,
    },
    agentTileLabel: {
      color: colors.mutedForeground,
      fontSize: 11,
      fontWeight: '700',
      lineHeight: 15,
    },
    agentTileValue: {
      color: colors.foreground,
      fontSize: 13,
      fontWeight: '700',
      lineHeight: 18,
    },
    agentTileDanger: {
      color: colors.destructive,
    },
    agentNoticeDanger: {
      gap: 8,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: `${colors.destructive}66`,
      borderRadius: 6,
      backgroundColor: `${colors.destructive}10`,
      padding: 10,
    },
    agentSubsection: {
      gap: 8,
    },
    agentRuleRow: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      justifyContent: 'space-between',
      gap: 10,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
      borderRadius: 6,
      backgroundColor: colors.card,
      padding: 10,
    },
    agentLineText: {
      color: colors.mutedForeground,
      fontSize: 11,
      fontWeight: '600',
      lineHeight: 15,
    },
    agentApprovalRow: {
      gap: 9,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
      borderRadius: 6,
      backgroundColor: colors.card,
      padding: 10,
    },
    agentApprovalHeader: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      justifyContent: 'space-between',
      gap: 10,
    },
    agentMetaRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 6,
    },
    agentCodeText: {
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
    agentPayloadText: {
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
    agentDecisionRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 8,
    },
    agentDecisionButton: {
      minWidth: 128,
      flex: 1,
    },
    memberNotice: {
      color: colors.accentEmerald,
      fontSize: 13,
      lineHeight: 18,
      paddingHorizontal: 16,
    },
    memberRow: {
      flexDirection: 'row',
      gap: 12,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
      borderRadius: 6,
      backgroundColor: colors.card,
      marginHorizontal: 16,
      padding: 12,
    },
    memberBody: {
      minWidth: 0,
      flex: 1,
      gap: 9,
    },
    memberHeader: {
      minWidth: 0,
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: 10,
    },
    memberIdentity: {
      minWidth: 0,
      flex: 1,
      gap: 2,
    },
    memberFooter: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      alignItems: 'center',
      gap: 6,
    },
    memberManageBlock: {
      gap: 8,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
      paddingTop: 10,
    },
    memberActionError: {
      color: colors.destructive,
      fontSize: 12,
      lineHeight: 16,
    },
    joinedAt: {
      color: colors.mutedForeground,
      fontSize: 11,
      lineHeight: 16,
    },
    emptyWrap: {
      paddingHorizontal: 16,
      paddingTop: 12,
    },
  });
}
