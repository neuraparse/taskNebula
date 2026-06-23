'use client';

import type { ComponentType } from 'react';
import { useEffect, useMemo, useState } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useFormatter, useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useToast } from '@/hooks/use-toast';
import { CreateFeatureFlagDialog } from '@/components/admin/create-feature-flag-dialog';
import { CreateOrganizationAdminDialog } from '@/components/admin/create-organization-admin-dialog';
import { CreateUserDialog } from '@/components/admin/create-user-dialog';
import { EditFeatureFlagDialog } from '@/components/admin/edit-feature-flag-dialog';
import { FeatureFlagRuntimeTest } from '@/components/admin/feature-flag-runtime-test';
import { EditOrganizationDialog } from '@/components/admin/edit-organization-dialog';
import { EditUserDialog } from '@/components/admin/edit-user-dialog';
import { AgentOpsPanel } from '@/components/admin/agent-ops-panel';
import { IntegrationsAdminPanel } from '@/components/admin/integrations-admin-panel';
import { RealtimeHealthPanel } from '@/components/admin/realtime-health-panel';
import { SystemCredentialsPanel } from '@/components/admin/system-credentials-panel';
import { EmailPreviewPanel } from '@/components/admin/email-preview-panel';
import { VersionPanel } from '@/components/admin/version-panel';
import { VersionUpdateBanner } from '@/components/admin/version-update-banner';
import {
  useDeleteFeatureFlag,
  useFeatureFlags,
  useUpdateFeatureFlag,
} from '@/lib/hooks/use-feature-flags';
import { cn } from '@/lib/utils';
import {
  Activity,
  BarChart3,
  Bot,
  Building2,
  Crown,
  Edit,
  Flag,
  FolderKanban,
  Gauge,
  Mail,
  MoreVertical,
  Plug,
  Radio,
  Rocket,
  Scroll,
  ShieldCheck,
  Search,
  Trash2,
  Users,
} from 'lucide-react';

type StatsResponse = {
  overview?: {
    totalOrganizations: number;
    totalUsers: number;
    activeUsers: number;
    superAdmins: number;
    totalProjects: number;
    totalIssues: number;
    totalComments: number;
  };
  organizations?: {
    byStatus?: Record<string, number>;
    byPlan?: Record<string, number>;
  };
  growth?: {
    newOrganizations30d: number;
    newUsers30d: number;
  };
};

type OrganizationItem = {
  id: string;
  name: string;
  slug: string;
  plan: string;
  status: string;
  owner?: { id: string; name: string | null; email: string | null } | null;
  stats?: { members: number; projects: number; issues: number };
};

type UserItem = {
  id: string;
  name: string | null;
  email: string;
  emailVerified?: string | null;
  lastSeenAt?: string | null;
  createdAt?: string;
  status: string;
  isSuperAdmin: boolean;
  organizations?: Array<{ organizationId: string; organizationName: string; role: string }>;
  projectMemberships?: Array<{
    projectId: string;
    projectKey: string;
    projectName: string;
    organizationId: string;
    organizationName: string | null;
    role: string;
  }>;
  lastActivity?: {
    action: string;
    resourceType: string;
    resourceId: string | null;
    projectId: string | null;
    createdAt: string;
    scope: 'system' | 'workspace';
  } | null;
};

type AdminFeatureFlag = {
  id: string;
  key: string;
  name: string;
  description: string | null;
  isEnabled: boolean;
  enabledForPlans: string[];
  enabledForOrganizations: string[];
  rolloutPercentage: number;
  metadata: Record<string, unknown>;
};

type AdminAuditLog = {
  id: string;
  action: string;
  resourceType: string;
  resourceId: string | null;
  changes: Record<string, { from?: unknown; to?: unknown }> | null;
  metadata: Record<string, unknown> | null;
  organizationId?: string | null;
  ipAddress?: string | null;
  userAgent?: string | null;
  createdAt: string;
  user: {
    id: string | null;
    name: string | null;
    email: string | null;
    image?: string | null;
  } | null;
};

type NavItem = {
  key: string;
  labelKey: string;
  icon: ComponentType<{ className?: string }>;
};

const NAV: NavItem[] = [
  { key: 'overview', labelKey: 'nav.overview', icon: Gauge },
  { key: 'organizations', labelKey: 'nav.organizations', icon: Building2 },
  { key: 'users', labelKey: 'nav.users', icon: Users },
  { key: 'feature-flags', labelKey: 'nav.featureFlags', icon: Flag },
  { key: 'agents', labelKey: 'nav.agentControl', icon: Bot },
  { key: 'integrations', labelKey: 'nav.integrations', icon: Plug },
  { key: 'system', labelKey: 'nav.system', icon: ShieldCheck },
  { key: 'updates', labelKey: 'nav.updates', icon: Rocket },
  { key: 'realtime', labelKey: 'nav.realtimeHealth', icon: Radio },
  { key: 'audit', labelKey: 'nav.auditLogs', icon: Scroll },
];

const DEFAULT_CHIP_CLASS = 'chip';

const orgStatusChipClass: Record<string, string> = {
  active: 'chip-emerald',
  trial: 'chip-amber',
  suspended: 'chip-rose',
};

const userStatusChipClass: Record<string, string> = {
  active: 'chip-emerald',
  invited: 'chip-amber',
  inactive: 'chip',
  suspended: 'chip-rose',
};

const ADMIN_TABLE_CLASS = 'w-full border-collapse text-sm';
const ADMIN_TABLE_HEADER_CELL_CLASS =
  'text-muted-foreground h-9 px-3 py-2 text-left align-middle text-[11px] font-medium uppercase tracking-wider whitespace-nowrap';
const ADMIN_TABLE_CELL_CLASS = 'px-3 py-3 align-middle';
const ADMIN_TABLE_ROW_CLASS =
  'border-border/50 border-b transition-colors hover:bg-accent/60 last:border-b-0';

const auditSeverity = (action: string): 'critical' | 'high' | 'medium' | 'low' => {
  if (/delete|revoke|suspend|purge/i.test(action)) return 'critical';
  if (/update|change|rotate|disable|enable/i.test(action)) return 'high';
  if (/create|invite|add/i.test(action)) return 'medium';
  return 'low';
};

export function AdminDashboardClient() {
  const t = useTranslations('pagesAdmin');
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  // Admin's Agent control tab is always visible to super-admins — this is
  // where the platform master toggle lives, so hiding it would create a
  // chicken-and-egg (can't enable AI because the toggle is hidden).
  const visibleNav = NAV;
  const validTabs = useMemo(() => visibleNav.map((item) => item.key), [visibleNav]);
  const requestedTab = searchParams.get('tab');
  const initialTab = requestedTab && validTabs.includes(requestedTab) ? requestedTab : 'overview';
  const [activeTab, setActiveTab] = useState(initialTab);
  const [editOrgId, setEditOrgId] = useState<string | null>(null);
  const [editUserId, setEditUserId] = useState<string | null>(null);
  const [editFlagId, setEditFlagId] = useState<string | null>(null);
  const [deleteOrg, setDeleteOrg] = useState<OrganizationItem | null>(null);
  const [deleteUser, setDeleteUser] = useState<UserItem | null>(null);
  const [deleteFlag, setDeleteFlag] = useState<{ id: string; name: string } | null>(null);

  const [orgSearch, setOrgSearch] = useState('');
  const [orgStatus, setOrgStatus] = useState('all');
  const [orgPlan, setOrgPlan] = useState('all');
  const [userSearch, setUserSearch] = useState('');
  const [userStatus, setUserStatus] = useState('all');
  const [flagSearch, setFlagSearch] = useState('');
  const [flagState, setFlagState] = useState('all');
  const [auditSearch, setAuditSearch] = useState('');
  const [auditResourceType, setAuditResourceType] = useState('all');

  const { toast } = useToast();
  const queryClient = useQueryClient();

  useEffect(() => {
    setActiveTab(initialTab);
  }, [initialTab]);

  function handleTabChange(nextTab: string) {
    setActiveTab(nextTab);
    const params = new URLSearchParams(searchParams.toString());
    params.set('tab', nextTab);
    router.replace(`${pathname}?${params.toString()}`, { scroll: false });
  }

  const { data: stats, isLoading: statsLoading } = useQuery({
    queryKey: ['admin-stats'],
    queryFn: async () => {
      const response = await fetch('/api/admin/stats');
      const payload = await response.json().catch(() => ({ error: 'Failed to fetch stats' }));
      if (!response.ok) throw new Error(payload.error || 'Failed to fetch stats');
      return payload as StatsResponse;
    },
  });

  const {
    data: orgsData,
    isLoading: orgsLoading,
    error: orgsError,
  } = useQuery({
    queryKey: ['admin-organizations', orgSearch, orgStatus, orgPlan],
    queryFn: async () => {
      const params = new URLSearchParams({ limit: '50' });
      if (orgSearch.trim()) params.set('search', orgSearch.trim());
      if (orgStatus !== 'all') params.set('status', orgStatus);
      if (orgPlan !== 'all') params.set('plan', orgPlan);
      const response = await fetch(`/api/admin/organizations?${params.toString()}`);
      const payload = await response
        .json()
        .catch(() => ({ error: 'Failed to fetch organizations' }));
      if (!response.ok) throw new Error(payload.error || 'Failed to fetch organizations');
      return payload as { organizations: OrganizationItem[]; pagination: { total: number } };
    },
  });

  const {
    data: usersData,
    isLoading: usersLoading,
    error: usersError,
  } = useQuery({
    queryKey: ['admin-users', userSearch, userStatus],
    queryFn: async () => {
      const params = new URLSearchParams({ limit: '50' });
      if (userSearch.trim()) params.set('search', userSearch.trim());
      if (userStatus !== 'all') params.set('status', userStatus);
      const response = await fetch(`/api/admin/users?${params.toString()}`);
      const payload = await response.json().catch(() => ({ error: 'Failed to fetch users' }));
      if (!response.ok) throw new Error(payload.error || 'Failed to fetch users');
      return payload as { users: UserItem[]; pagination: { total: number } };
    },
  });

  const {
    data: auditData,
    isLoading: auditLoading,
    error: auditError,
  } = useQuery({
    queryKey: ['admin-audit-logs', auditSearch, auditResourceType],
    queryFn: async () => {
      const params = new URLSearchParams({ limit: '50' });
      if (auditSearch.trim()) params.set('search', auditSearch.trim());
      if (auditResourceType !== 'all') params.set('resourceType', auditResourceType);
      const response = await fetch(`/api/admin/audit-logs?${params.toString()}`);
      const payload = await response.json().catch(() => ({ error: 'Failed to fetch audit logs' }));
      if (!response.ok) throw new Error(payload.error || 'Failed to fetch audit logs');
      return payload as { auditLogs: AdminAuditLog[] };
    },
    enabled: activeTab === 'audit',
  });

  const { data: featureFlags, isLoading: flagsLoading, error: flagsError } = useFeatureFlags();
  const deleteFeatureFlag = useDeleteFeatureFlag();
  const updateFeatureFlag = useUpdateFeatureFlag();

  const deleteOrgMutation = useMutation({
    mutationFn: async (organizationId: string) => {
      const response = await fetch(`/api/admin/organizations/${organizationId}`, {
        method: 'DELETE',
      });
      const payload = await response
        .json()
        .catch(() => ({ error: 'Failed to delete organization' }));
      if (!response.ok) throw new Error(payload.error || 'Failed to delete organization');
      return payload;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-organizations'] });
      queryClient.invalidateQueries({ queryKey: ['admin-stats'] });
      queryClient.invalidateQueries({ queryKey: ['admin-audit-logs'] });
      toast({
        title: t('orgs.deletedTitle'),
        description: t('orgs.deletedDescription'),
      });
      setDeleteOrg(null);
    },
    onError: (mutationError: Error) => {
      toast({
        title: t('orgs.deleteFailedTitle'),
        description: mutationError.message,
        variant: 'destructive',
      });
    },
  });

  const deleteUserMutation = useMutation({
    mutationFn: async (userId: string) => {
      const response = await fetch(`/api/admin/users/${userId}`, {
        method: 'DELETE',
      });
      const payload = await response.json().catch(() => ({ error: t('users.deleteFailedTitle') }));
      if (!response.ok) throw new Error(payload.error || t('users.deleteFailedTitle'));
      return payload;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-users'] });
      queryClient.invalidateQueries({ queryKey: ['admin-stats'] });
      queryClient.invalidateQueries({ queryKey: ['admin-audit-logs'] });
      toast({
        title: t('users.deletedTitle'),
        description: t('users.deletedDescription'),
      });
      setDeleteUser(null);
    },
    onError: (mutationError: Error) => {
      toast({
        title: t('users.deleteFailedTitle'),
        description: mutationError.message,
        variant: 'destructive',
      });
    },
  });

  const selectedFlag = featureFlags?.find((flag: AdminFeatureFlag) => flag.id === editFlagId);
  const filteredFlags = (featureFlags || []).filter((flag: AdminFeatureFlag) => {
    const searchTerm = flagSearch.trim().toLowerCase();
    const matchesSearch =
      !searchTerm ||
      flag.name.toLowerCase().includes(searchTerm) ||
      flag.key.toLowerCase().includes(searchTerm) ||
      (flag.description || '').toLowerCase().includes(searchTerm);
    const matchesState =
      flagState === 'all' ||
      (flagState === 'enabled' && flag.isEnabled) ||
      (flagState === 'disabled' && !flag.isEnabled);
    return matchesSearch && matchesState;
  });

  async function handleToggleFlag(flag: AdminFeatureFlag, next: boolean) {
    try {
      await updateFeatureFlag.mutateAsync({ flagId: flag.id, data: { isEnabled: next } });
      queryClient.invalidateQueries({ queryKey: ['admin-audit-logs'] });
      toast({
        title: next ? t('flags.enabledTitle') : t('flags.disabledTitle'),
        description: next
          ? t('flags.enabledDescription', { name: flag.name })
          : t('flags.disabledDescription', { name: flag.name }),
      });
    } catch (error) {
      toast({
        title: t('flags.updateFailedTitle'),
        description: error instanceof Error ? error.message : t('flags.updateFailedTitle'),
        variant: 'destructive',
      });
    }
  }

  async function handleConfirmDeleteFlag() {
    if (!deleteFlag) return;
    try {
      await deleteFeatureFlag.mutateAsync(deleteFlag.id);
      queryClient.invalidateQueries({ queryKey: ['admin-audit-logs'] });
      toast({
        title: t('flags.deletedTitle'),
        description: t('flags.deletedDescription', { name: deleteFlag.name }),
      });
      setDeleteFlag(null);
    } catch (error) {
      toast({
        title: t('flags.deleteFailedTitle'),
        description: error instanceof Error ? error.message : t('flags.deleteFailedTitle'),
        variant: 'destructive',
      });
    }
  }

  const currentNav = visibleNav.find((item) => item.key === activeTab) ?? visibleNav[0]!;

  return (
    <>
      {editOrgId ? (
        <EditOrganizationDialog
          organizationId={editOrgId}
          open={!!editOrgId}
          onOpenChange={(open) => !open && setEditOrgId(null)}
        />
      ) : null}
      {editUserId ? (
        <EditUserDialog
          userId={editUserId}
          open={!!editUserId}
          onOpenChange={(open) => !open && setEditUserId(null)}
        />
      ) : null}
      {editFlagId && selectedFlag ? (
        <EditFeatureFlagDialog
          flag={selectedFlag}
          open={!!editFlagId}
          onOpenChange={(open) => !open && setEditFlagId(null)}
        />
      ) : null}

      <ConfirmDialog
        open={!!deleteOrg}
        onOpenChange={(open) => !open && setDeleteOrg(null)}
        title={t('orgs.confirmDeleteTitle')}
        description={deleteOrg ? t('orgs.confirmDeleteDescription', { name: deleteOrg.name }) : ''}
        confirmLabel={t('orgs.confirmDeleteLabel')}
        pendingLabel={t('common.deleting')}
        cancelLabel={t('common.cancel')}
        pending={deleteOrgMutation.isPending}
        onConfirm={() => deleteOrg && deleteOrgMutation.mutate(deleteOrg.id)}
      />

      <ConfirmDialog
        open={!!deleteUser}
        onOpenChange={(open) => !open && setDeleteUser(null)}
        title={t('users.confirmDeleteTitle')}
        description={
          deleteUser
            ? t('users.confirmDeleteDescription', { name: deleteUser.name || deleteUser.email })
            : ''
        }
        confirmLabel={t('users.confirmDeleteLabel')}
        pendingLabel={t('common.deleting')}
        cancelLabel={t('common.cancel')}
        pending={deleteUserMutation.isPending}
        onConfirm={() => deleteUser && deleteUserMutation.mutate(deleteUser.id)}
      />

      <ConfirmDialog
        open={!!deleteFlag}
        onOpenChange={(open) => !open && setDeleteFlag(null)}
        title={t('flags.confirmDeleteTitle')}
        description={
          deleteFlag ? t('flags.confirmDeleteDescription', { name: deleteFlag.name }) : ''
        }
        confirmLabel={t('flags.confirmDeleteLabel')}
        pendingLabel={t('common.deleting')}
        cancelLabel={t('common.cancel')}
        pending={deleteFeatureFlag.isPending}
        onConfirm={handleConfirmDeleteFlag}
      />

      <div className="flex h-full min-h-0">
        <div className="animate-fade-up min-w-0 flex-1 space-y-6 overflow-y-auto p-6">
          {/* Mobile nav */}
          <div className="lg:hidden">
            <Select value={activeTab} onValueChange={handleTabChange}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {visibleNav.map((item) => (
                  <SelectItem key={item.key} value={item.key}>
                    {t(item.labelKey)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Update-available banner (dismiss persists per release version) */}
          {activeTab !== 'updates' && (
            <VersionUpdateBanner onView={() => handleTabChange('updates')} />
          )}

          {/* Header */}
          <div className="flex flex-col gap-1">
            <span className="kicker">{t('header.kicker')}</span>
            <h1 className="text-balance text-2xl font-semibold tracking-tight">
              {t(currentNav.labelKey)}
            </h1>
            <p className="text-muted-foreground max-w-2xl text-sm">{t('header.subtitle')}</p>
          </div>

          {/* Section body */}
          {activeTab === 'overview' && <OverviewSection stats={stats} loading={statsLoading} />}

          {activeTab === 'organizations' && (
            <OrganizationsSection
              orgsData={orgsData}
              orgsLoading={orgsLoading}
              orgsError={orgsError}
              orgSearch={orgSearch}
              setOrgSearch={setOrgSearch}
              orgStatus={orgStatus}
              setOrgStatus={setOrgStatus}
              orgPlan={orgPlan}
              setOrgPlan={setOrgPlan}
              onEdit={setEditOrgId}
              onDelete={setDeleteOrg}
            />
          )}

          {activeTab === 'users' && (
            <UsersSection
              usersData={usersData}
              usersLoading={usersLoading}
              usersError={usersError}
              userSearch={userSearch}
              setUserSearch={setUserSearch}
              userStatus={userStatus}
              setUserStatus={setUserStatus}
              onEdit={setEditUserId}
              onDelete={setDeleteUser}
            />
          )}

          {activeTab === 'feature-flags' && (
            <FeatureFlagsSection
              flags={filteredFlags}
              loading={flagsLoading}
              error={flagsError}
              search={flagSearch}
              setSearch={setFlagSearch}
              state={flagState}
              setState={setFlagState}
              onEdit={setEditFlagId}
              onDelete={(flag) => setDeleteFlag({ id: flag.id, name: flag.name })}
              onToggle={handleToggleFlag}
              updatePending={updateFeatureFlag.isPending}
            />
          )}

          {activeTab === 'agents' && <AgentOpsPanel />}

          {activeTab === 'integrations' && <IntegrationsAdminPanel />}

          {activeTab === 'system' && (
            <div className="space-y-6">
              <SystemCredentialsPanel />
              <EmailPreviewPanel />
            </div>
          )}

          {activeTab === 'updates' && <VersionPanel />}

          {activeTab === 'realtime' && <RealtimeHealthPanel />}

          {activeTab === 'audit' && (
            <AuditSection
              logs={auditData?.auditLogs || []}
              loading={auditLoading}
              error={auditError}
              search={auditSearch}
              setSearch={setAuditSearch}
              resourceType={auditResourceType}
              setResourceType={setAuditResourceType}
            />
          )}
        </div>
      </div>
    </>
  );
}

function OrganizationActionsMenu({
  org,
  onEdit,
  onDelete,
}: {
  org: OrganizationItem;
  onEdit: (id: string) => void;
  onDelete: (org: OrganizationItem) => void;
}) {
  const t = useTranslations('pagesAdmin');

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="h-7 w-7">
          <MoreVertical className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuLabel>{t('common.actions')}</DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={() => onEdit(org.id)}>
          <Edit className="mr-2 h-4 w-4" />
          {t('common.edit')}
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          className="text-destructive focus:text-destructive"
          onClick={() => onDelete(org)}
        >
          <Trash2 className="mr-2 h-4 w-4" />
          {t('common.delete')}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function UserActionsMenu({
  user,
  onEdit,
  onDelete,
}: {
  user: UserItem;
  onEdit: (id: string) => void;
  onDelete: (user: UserItem) => void;
}) {
  const t = useTranslations('pagesAdmin');

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="h-7 w-7">
          <MoreVertical className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuLabel>{t('common.actions')}</DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={() => onEdit(user.id)}>
          <Edit className="mr-2 h-4 w-4" />
          {t('users.editUser')}
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          className="text-destructive focus:text-destructive"
          onClick={() => onDelete(user)}
        >
          <Trash2 className="mr-2 h-4 w-4" />
          {t('users.deleteUser')}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

/* --------------------------------- Overview -------------------------------- */

function OverviewSection({
  stats,
  loading,
}: {
  stats: StatsResponse | undefined;
  loading: boolean;
}) {
  const t = useTranslations('pagesAdmin');
  const tiles: Array<{
    label: string;
    value: number | string;
    icon: ComponentType<{ className?: string }>;
    tone: 'blue' | 'violet' | 'emerald' | 'amber';
  }> = [
    {
      label: t('overview.organizations'),
      value: loading ? '—' : (stats?.overview?.totalOrganizations ?? 0),
      icon: Building2,
      tone: 'blue',
    },
    {
      label: t('overview.users'),
      value: loading ? '—' : (stats?.overview?.totalUsers ?? 0),
      icon: Users,
      tone: 'violet',
    },
    {
      label: t('overview.activeUsers'),
      value: loading ? '—' : (stats?.overview?.activeUsers ?? 0),
      icon: Activity,
      tone: 'emerald',
    },
    {
      label: t('overview.superAdmins'),
      value: loading ? '—' : (stats?.overview?.superAdmins ?? 0),
      icon: Crown,
      tone: 'amber',
    },
  ];

  return (
    <div className="space-y-6">
      <div className="stagger grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {tiles.map(({ label, value, icon: Icon, tone }) => (
          <KpiTile key={label} label={label} value={value} icon={Icon} tone={tone} />
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="surface-card space-y-3 p-6">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold">{t('overview.orgHealth')}</h3>
            <BarChart3 className="text-muted-foreground h-4 w-4" />
          </div>
          <dl className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm">
            <MetricRow
              label={t('overview.active')}
              value={stats?.organizations?.byStatus?.active ?? 0}
            />
            <MetricRow
              label={t('overview.trial')}
              value={stats?.organizations?.byStatus?.trial ?? 0}
            />
            <MetricRow
              label={t('overview.suspended')}
              value={stats?.organizations?.byStatus?.suspended ?? 0}
            />
            <MetricRow label={t('overview.free')} value={stats?.organizations?.byPlan?.free ?? 0} />
            <MetricRow
              label={t('overview.starter')}
              value={stats?.organizations?.byPlan?.starter ?? 0}
            />
            <MetricRow
              label={t('overview.growth')}
              value={stats?.organizations?.byPlan?.growth ?? 0}
            />
            <MetricRow
              label={t('overview.enterprise')}
              value={stats?.organizations?.byPlan?.enterprise ?? 0}
            />
          </dl>
        </div>

        <div className="surface-card space-y-3 p-6">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold">{t('overview.last30Days')}</h3>
            <Activity className="text-muted-foreground h-4 w-4" />
          </div>
          <dl className="space-y-2 text-sm">
            <MetricRow
              label={t('overview.newOrganizations')}
              value={stats?.growth?.newOrganizations30d ?? 0}
            />
            <MetricRow label={t('overview.newUsers')} value={stats?.growth?.newUsers30d ?? 0} />
            <MetricRow
              label={t('overview.projectsTotal')}
              value={stats?.overview?.totalProjects ?? 0}
            />
            <MetricRow
              label={t('overview.issuesTotal')}
              value={stats?.overview?.totalIssues ?? 0}
            />
            <MetricRow
              label={t('overview.commentsTotal')}
              value={stats?.overview?.totalComments ?? 0}
            />
          </dl>
        </div>
      </div>
    </div>
  );
}

/* ------------------------------ Organizations ----------------------------- */

function OrganizationsSection({
  orgsData,
  orgsLoading,
  orgsError,
  orgSearch,
  setOrgSearch,
  orgStatus,
  setOrgStatus,
  orgPlan,
  setOrgPlan,
  onEdit,
  onDelete,
}: {
  orgsData: { organizations: OrganizationItem[]; pagination: { total: number } } | undefined;
  orgsLoading: boolean;
  orgsError: unknown;
  orgSearch: string;
  setOrgSearch: (v: string) => void;
  orgStatus: string;
  setOrgStatus: (v: string) => void;
  orgPlan: string;
  setOrgPlan: (v: string) => void;
  onEdit: (id: string) => void;
  onDelete: (org: OrganizationItem) => void;
}) {
  const t = useTranslations('pagesAdmin');
  const orgs = orgsData?.organizations || [];
  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <p className="text-muted-foreground text-xs">
          {t('orgs.matchingCount', { count: orgsData?.pagination?.total ?? 0 })}
        </p>
        <CreateOrganizationAdminDialog />
      </div>

      <div className="animate-blur-in grid gap-3 md:grid-cols-[minmax(0,1fr)_180px_180px]">
        <SearchInput
          value={orgSearch}
          onChange={setOrgSearch}
          placeholder={t('orgs.searchPlaceholder')}
        />
        <Select value={orgStatus} onValueChange={setOrgStatus}>
          <SelectTrigger>
            <SelectValue placeholder={t('filters.status')} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t('filters.allStatuses')}</SelectItem>
            <SelectItem value="active">{t('filters.active')}</SelectItem>
            <SelectItem value="trial">{t('filters.trial')}</SelectItem>
            <SelectItem value="suspended">{t('filters.suspended')}</SelectItem>
          </SelectContent>
        </Select>
        <Select value={orgPlan} onValueChange={setOrgPlan}>
          <SelectTrigger>
            <SelectValue placeholder={t('filters.plan')} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t('filters.allPlans')}</SelectItem>
            <SelectItem value="free">{t('filters.free')}</SelectItem>
            <SelectItem value="starter">{t('filters.starter')}</SelectItem>
            <SelectItem value="growth">{t('filters.growth')}</SelectItem>
            <SelectItem value="enterprise">{t('filters.enterprise')}</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="surface-card overflow-hidden xl:hidden">
        {orgsLoading ? (
          <EmptyState icon={Building2} message={t('orgs.loading')} />
        ) : orgsError ? (
          <ErrorState
            message={orgsError instanceof Error ? orgsError.message : t('orgs.loadFailed')}
          />
        ) : orgs.length === 0 ? (
          <EmptyState icon={Building2} message={t('orgs.empty')} />
        ) : (
          <ul className="stagger divide-border/50 divide-y">
            {orgs.map((org) => (
              <li key={org.id} className="px-4 py-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{org.name}</p>
                    <p className="text-muted-foreground truncate font-mono text-xs">{org.slug}</p>
                  </div>
                  <OrganizationActionsMenu org={org} onEdit={onEdit} onDelete={onDelete} />
                </div>

                <dl className="mt-3 grid gap-3 text-sm sm:grid-cols-2">
                  <div className="min-w-0 space-y-1">
                    <dt className="kicker">{t('orgs.colStatus')}</dt>
                    <dd>
                      <span
                        className={cn(
                          orgStatusChipClass[org.status] ?? DEFAULT_CHIP_CLASS,
                          'capitalize'
                        )}
                      >
                        {org.status}
                      </span>
                    </dd>
                  </div>
                  <div className="min-w-0 space-y-1">
                    <dt className="kicker">{t('orgs.colPlan')}</dt>
                    <dd>
                      <span className="chip capitalize">{org.plan}</span>
                    </dd>
                  </div>
                  <div className="min-w-0 space-y-1">
                    <dt className="kicker">{t('orgs.colOwner')}</dt>
                    <dd className="truncate">
                      {org.owner?.name || org.owner?.email || (
                        <span className="text-muted-foreground">{t('orgs.noOwner')}</span>
                      )}
                    </dd>
                  </div>
                  <div className="min-w-0 space-y-1">
                    <dt className="kicker">{t('orgs.colMembers')}</dt>
                    <dd className="tabular-nums">{org.stats?.members ?? 0}</dd>
                  </div>
                </dl>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="surface-card hidden overflow-x-auto xl:block">
        {orgsLoading ? (
          <EmptyState icon={Building2} message={t('orgs.loading')} />
        ) : orgsError ? (
          <ErrorState
            message={orgsError instanceof Error ? orgsError.message : t('orgs.loadFailed')}
          />
        ) : orgs.length === 0 ? (
          <EmptyState icon={Building2} message={t('orgs.empty')} />
        ) : (
          <table className={cn(ADMIN_TABLE_CLASS, 'min-w-[860px] xl:min-w-0')}>
            <thead>
              <tr className="border-border border-b">
                <th className={ADMIN_TABLE_HEADER_CELL_CLASS}>{t('orgs.colName')}</th>
                <th className={ADMIN_TABLE_HEADER_CELL_CLASS}>{t('orgs.colStatus')}</th>
                <th className={ADMIN_TABLE_HEADER_CELL_CLASS}>{t('orgs.colPlan')}</th>
                <th className={ADMIN_TABLE_HEADER_CELL_CLASS}>{t('orgs.colOwner')}</th>
                <th className={cn(ADMIN_TABLE_HEADER_CELL_CLASS, 'text-right')}>
                  {t('orgs.colMembers')}
                </th>
                <th className={cn(ADMIN_TABLE_HEADER_CELL_CLASS, 'w-12')} />
              </tr>
            </thead>
            <tbody className="stagger">
              {orgs.map((org) => (
                <tr key={org.id} className={ADMIN_TABLE_ROW_CLASS}>
                  <td className={ADMIN_TABLE_CELL_CLASS}>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">{org.name}</p>
                      <p className="text-muted-foreground truncate font-mono text-xs">{org.slug}</p>
                    </div>
                  </td>
                  <td className={ADMIN_TABLE_CELL_CLASS}>
                    <span
                      className={cn(
                        orgStatusChipClass[org.status] ?? DEFAULT_CHIP_CLASS,
                        'capitalize'
                      )}
                    >
                      {org.status}
                    </span>
                  </td>
                  <td className={ADMIN_TABLE_CELL_CLASS}>
                    <span className="chip capitalize">{org.plan}</span>
                  </td>
                  <td className={ADMIN_TABLE_CELL_CLASS}>
                    <p className="max-w-[200px] truncate text-sm">
                      {org.owner?.name || org.owner?.email || (
                        <span className="text-muted-foreground">{t('orgs.noOwner')}</span>
                      )}
                    </p>
                  </td>
                  <td className={cn(ADMIN_TABLE_CELL_CLASS, 'text-right tabular-nums')}>
                    {org.stats?.members ?? 0}
                  </td>
                  <td className={cn(ADMIN_TABLE_CELL_CLASS, 'px-2 text-right')}>
                    <OrganizationActionsMenu org={org} onEdit={onEdit} onDelete={onDelete} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

/* ---------------------------------- Users --------------------------------- */

function UsersSection({
  usersData,
  usersLoading,
  usersError,
  userSearch,
  setUserSearch,
  userStatus,
  setUserStatus,
  onEdit,
  onDelete,
}: {
  usersData: { users: UserItem[]; pagination: { total: number } } | undefined;
  usersLoading: boolean;
  usersError: unknown;
  userSearch: string;
  setUserSearch: (v: string) => void;
  userStatus: string;
  setUserStatus: (v: string) => void;
  onEdit: (id: string) => void;
  onDelete: (user: UserItem) => void;
}) {
  const t = useTranslations('pagesAdmin');
  const tProject = useTranslations('projectConfig');
  const formatter = useFormatter();
  const users = usersData?.users || [];

  function renderUserIdentity(user: UserItem) {
    return (
      <div className="min-w-0">
        <p className="truncate text-sm font-medium">{user.name || user.email}</p>
        <p className="text-muted-foreground truncate text-xs">{user.email}</p>
        {user.createdAt ? (
          <p className="text-muted-foreground mt-0.5 truncate text-[11px]">
            {t('users.createdAt', {
              date: formatter.dateTime(new Date(user.createdAt), {
                dateStyle: 'medium',
                timeStyle: 'short',
              }),
            })}
          </p>
        ) : null}
      </div>
    );
  }

  function renderUserAccess(user: UserItem) {
    const isSuspended = user.status === 'suspended' || user.status === 'inactive';
    const isInvited = user.status === 'invited';
    const orgCount = user.organizations?.length ?? 0;

    return (
      <div className="space-y-1">
        {user.isSuperAdmin ? (
          <span className="chip-rose inline-flex items-center gap-1">
            <Crown className="h-3 w-3" />
            {t('users.roleAdmin')}
          </span>
        ) : isSuspended ? (
          <span className="chip-rose">{t('users.roleSuspended')}</span>
        ) : isInvited ? (
          <span className="chip-amber">{t('users.rolePending')}</span>
        ) : (
          <span className="chip-blue">{t('users.roleMember')}</span>
        )}
        <div className="flex flex-wrap gap-1">
          <span
            className={cn(userStatusChipClass[user.status] ?? DEFAULT_CHIP_CLASS, 'capitalize')}
          >
            {user.status}
          </span>
          <span className="chip">{t('users.orgsCount', { count: orgCount })}</span>
        </div>
      </div>
    );
  }

  function renderEmailStatus(user: UserItem) {
    return (
      <span
        className={cn(
          'inline-flex items-center gap-1',
          user.emailVerified ? 'chip-emerald' : 'chip-amber'
        )}
      >
        <Mail className="h-3 w-3" />
        {user.emailVerified ? t('users.emailVerified') : t('users.emailUnverified')}
      </span>
    );
  }

  function renderProjectMemberships(user: UserItem) {
    const projectMemberships = user.projectMemberships ?? [];
    const visibleProjects = projectMemberships.slice(0, 2);
    const hiddenProjectCount = Math.max(projectMemberships.length - visibleProjects.length, 0);

    if (projectMemberships.length === 0) {
      return <span className="text-muted-foreground text-sm">{t('users.noProjects')}</span>;
    }

    return (
      <div className="min-w-0 space-y-1">
        <div className="flex items-center gap-1.5 text-sm font-medium">
          <FolderKanban className="text-muted-foreground h-3.5 w-3.5" />
          {t('users.projectCount', { count: projectMemberships.length })}
        </div>
        <div className="flex flex-wrap gap-1">
          {visibleProjects.map((project) => (
            <span key={project.projectId} className="chip min-w-0 max-w-full">
              <span className="shrink-0 font-mono">{project.projectKey}</span>
              <span className="text-muted-foreground mx-1">·</span>
              <span className="min-w-0 truncate">{tProject(`pr_${project.role}`)}</span>
            </span>
          ))}
          {hiddenProjectCount > 0 ? (
            <span className="chip">{t('users.moreProjects', { count: hiddenProjectCount })}</span>
          ) : null}
        </div>
      </div>
    );
  }

  function renderLastSeen(user: UserItem) {
    if (!user.lastSeenAt) {
      return <span className="text-muted-foreground">{t('users.neverSeen')}</span>;
    }

    return (
      <div className="space-y-0.5">
        <p className="tabular-nums">{formatter.relativeTime(new Date(user.lastSeenAt))}</p>
        <p className="text-muted-foreground text-[11px]">
          {formatter.dateTime(new Date(user.lastSeenAt), {
            dateStyle: 'medium',
            timeStyle: 'short',
          })}
        </p>
      </div>
    );
  }

  function renderLastActivity(user: UserItem) {
    if (!user.lastActivity) {
      return <span className="text-muted-foreground text-sm">{t('users.noActivity')}</span>;
    }

    return (
      <div className="min-w-0 space-y-0.5">
        <p className="truncate text-sm font-medium">
          {formatAdminAction(user.lastActivity.action)}
        </p>
        <p className="text-muted-foreground truncate text-xs">
          {formatAdminAction(user.lastActivity.resourceType)} ·{' '}
          {formatter.relativeTime(new Date(user.lastActivity.createdAt))}
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <p className="text-muted-foreground text-xs">
          {t('users.matchingCount', { count: usersData?.pagination?.total ?? 0 })}
        </p>
        <CreateUserDialog />
      </div>

      <div className="animate-blur-in grid gap-3 md:grid-cols-[minmax(0,1fr)_180px]">
        <SearchInput
          value={userSearch}
          onChange={setUserSearch}
          placeholder={t('users.searchPlaceholder')}
        />
        <Select value={userStatus} onValueChange={setUserStatus}>
          <SelectTrigger>
            <SelectValue placeholder={t('filters.status')} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t('filters.allStatuses')}</SelectItem>
            <SelectItem value="active">{t('filters.active')}</SelectItem>
            <SelectItem value="inactive">{t('filters.inactive')}</SelectItem>
            <SelectItem value="invited">{t('filters.invited')}</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="surface-card overflow-hidden xl:hidden">
        {usersLoading ? (
          <EmptyState icon={Users} message={t('users.loading')} />
        ) : usersError ? (
          <ErrorState
            message={usersError instanceof Error ? usersError.message : t('users.loadFailed')}
          />
        ) : users.length === 0 ? (
          <EmptyState icon={Users} message={t('users.empty')} />
        ) : (
          <ul className="stagger divide-border/50 divide-y">
            {users.map((user) => (
              <li key={user.id} className="px-4 py-4">
                <div className="flex items-start justify-between gap-3">
                  {renderUserIdentity(user)}
                  <UserActionsMenu user={user} onEdit={onEdit} onDelete={onDelete} />
                </div>

                <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2">
                  <div className="min-w-0 space-y-1">
                    <dt className="kicker">{t('users.colAccess')}</dt>
                    <dd>{renderUserAccess(user)}</dd>
                  </div>
                  <div className="min-w-0 space-y-1">
                    <dt className="kicker">{t('users.colMail')}</dt>
                    <dd>{renderEmailStatus(user)}</dd>
                  </div>
                  <div className="min-w-0 space-y-1 sm:col-span-2">
                    <dt className="kicker">{t('users.colProjects')}</dt>
                    <dd>{renderProjectMemberships(user)}</dd>
                  </div>
                  <div className="min-w-0 space-y-1">
                    <dt className="kicker">{t('users.colLastSeen')}</dt>
                    <dd>{renderLastSeen(user)}</dd>
                  </div>
                  <div className="min-w-0 space-y-1">
                    <dt className="kicker">{t('users.colLastActivity')}</dt>
                    <dd>{renderLastActivity(user)}</dd>
                  </div>
                </dl>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="surface-card hidden overflow-x-auto xl:block">
        {usersLoading ? (
          <EmptyState icon={Users} message={t('users.loading')} />
        ) : usersError ? (
          <ErrorState
            message={usersError instanceof Error ? usersError.message : t('users.loadFailed')}
          />
        ) : users.length === 0 ? (
          <EmptyState icon={Users} message={t('users.empty')} />
        ) : (
          <table className={cn(ADMIN_TABLE_CLASS, 'min-w-[980px] table-fixed xl:min-w-0')}>
            <colgroup>
              <col className="w-[23%]" />
              <col className="w-[14%]" />
              <col className="w-[12%]" />
              <col className="w-[25%]" />
              <col className="w-[12%]" />
              <col className="w-[9%]" />
              <col className="w-[5%]" />
            </colgroup>
            <thead>
              <tr className="border-border border-b">
                <th className={ADMIN_TABLE_HEADER_CELL_CLASS}>{t('users.colUser')}</th>
                <th className={ADMIN_TABLE_HEADER_CELL_CLASS}>{t('users.colAccess')}</th>
                <th className={ADMIN_TABLE_HEADER_CELL_CLASS}>{t('users.colMail')}</th>
                <th className={ADMIN_TABLE_HEADER_CELL_CLASS}>{t('users.colProjects')}</th>
                <th className={ADMIN_TABLE_HEADER_CELL_CLASS}>{t('users.colLastSeen')}</th>
                <th className={ADMIN_TABLE_HEADER_CELL_CLASS}>{t('users.colLastActivity')}</th>
                <th className={cn(ADMIN_TABLE_HEADER_CELL_CLASS, 'px-2')} />
              </tr>
            </thead>
            <tbody className="stagger">
              {users.map((user) => (
                <tr key={user.id} className={ADMIN_TABLE_ROW_CLASS}>
                  <td className={ADMIN_TABLE_CELL_CLASS}>{renderUserIdentity(user)}</td>
                  <td className={ADMIN_TABLE_CELL_CLASS}>{renderUserAccess(user)}</td>
                  <td className={ADMIN_TABLE_CELL_CLASS}>{renderEmailStatus(user)}</td>
                  <td className={ADMIN_TABLE_CELL_CLASS}>{renderProjectMemberships(user)}</td>
                  <td className={ADMIN_TABLE_CELL_CLASS}>{renderLastSeen(user)}</td>
                  <td className={ADMIN_TABLE_CELL_CLASS}>{renderLastActivity(user)}</td>
                  <td className={cn(ADMIN_TABLE_CELL_CLASS, 'px-2 text-right')}>
                    <UserActionsMenu user={user} onEdit={onEdit} onDelete={onDelete} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

/* ------------------------------ Feature flags ----------------------------- */

function FeatureFlagsSection({
  flags,
  loading,
  error,
  search,
  setSearch,
  state,
  setState,
  onEdit,
  onDelete,
  onToggle,
  updatePending,
}: {
  flags: AdminFeatureFlag[];
  loading: boolean;
  error: unknown;
  search: string;
  setSearch: (v: string) => void;
  state: string;
  setState: (v: string) => void;
  onEdit: (id: string) => void;
  onDelete: (flag: { id: string; name: string }) => void;
  onToggle: (flag: AdminFeatureFlag, next: boolean) => void;
  updatePending: boolean;
}) {
  const t = useTranslations('pagesAdmin');
  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <p className="text-muted-foreground text-xs">
          {t('flags.matchingCount', { count: flags.length })}
        </p>
        <div className="flex items-center gap-2">
          <FeatureFlagRuntimeTest />
          <CreateFeatureFlagDialog />
        </div>
      </div>

      <div className="animate-blur-in grid gap-3 md:grid-cols-[minmax(0,1fr)_180px]">
        <SearchInput
          value={search}
          onChange={setSearch}
          placeholder={t('flags.searchPlaceholder')}
        />
        <Select value={state} onValueChange={setState}>
          <SelectTrigger>
            <SelectValue placeholder={t('filters.state')} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t('filters.allFlags')}</SelectItem>
            <SelectItem value="enabled">{t('filters.enabled')}</SelectItem>
            <SelectItem value="disabled">{t('filters.disabled')}</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="surface-card overflow-hidden">
        {loading ? (
          <EmptyState icon={Flag} message={t('flags.loading')} />
        ) : error ? (
          <ErrorState message={error instanceof Error ? error.message : t('flags.loadFailed')} />
        ) : flags.length === 0 ? (
          <EmptyState icon={Flag} message={t('flags.empty')} />
        ) : (
          <ul className="stagger divide-border/50 divide-y">
            {flags.map((flag) => (
              <li
                key={flag.id}
                className="border-border/50 hover:bg-accent/60 flex flex-col gap-3 px-4 py-3 transition-colors sm:flex-row sm:items-center"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="truncate text-sm font-medium">{flag.name}</span>
                    <span className="chip font-mono text-[11px]">{flag.key}</span>
                    {flag.rolloutPercentage < 100 && (
                      <span className="chip">{flag.rolloutPercentage}%</span>
                    )}
                  </div>
                  {flag.description ? (
                    <p className="text-muted-foreground mt-0.5 truncate text-xs">
                      {flag.description}
                    </p>
                  ) : null}
                </div>
                <div className="flex shrink-0 items-center justify-end gap-2 sm:min-w-[5.5rem]">
                  <Switch
                    checked={flag.isEnabled}
                    onCheckedChange={(next) => onToggle(flag, next)}
                    disabled={updatePending}
                    aria-label={flag.isEnabled ? t('flags.disableAria') : t('flags.enableAria')}
                  />
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon" className="h-7 w-7">
                        <MoreVertical className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuLabel>{t('common.actions')}</DropdownMenuLabel>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem onClick={() => onEdit(flag.id)}>
                        <Edit className="mr-2 h-4 w-4" />
                        {t('common.edit')}
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem
                        className="text-destructive focus:text-destructive"
                        onClick={() => onDelete(flag)}
                      >
                        <Trash2 className="mr-2 h-4 w-4" />
                        {t('common.delete')}
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

/* ---------------------------------- Audit --------------------------------- */

function AuditSection({
  logs,
  loading,
  error,
  search,
  setSearch,
  resourceType,
  setResourceType,
}: {
  logs: AdminAuditLog[];
  loading: boolean;
  error: unknown;
  search: string;
  setSearch: (v: string) => void;
  resourceType: string;
  setResourceType: (v: string) => void;
}) {
  const t = useTranslations('pagesAdmin');
  const formatter = useFormatter();
  return (
    <div className="space-y-4">
      <p className="text-muted-foreground text-xs">
        {t('audit.matchingCount', { count: logs.length })}
      </p>

      <div className="animate-blur-in grid gap-3 md:grid-cols-[minmax(0,1fr)_220px]">
        <SearchInput
          value={search}
          onChange={setSearch}
          placeholder={t('audit.searchPlaceholder')}
        />
        <Select value={resourceType} onValueChange={setResourceType}>
          <SelectTrigger>
            <SelectValue placeholder={t('audit.resourceType')} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t('audit.allResources')}</SelectItem>
            <SelectItem value="organization">{t('audit.organization')}</SelectItem>
            <SelectItem value="user">{t('audit.user')}</SelectItem>
            <SelectItem value="project">{t('audit.project')}</SelectItem>
            <SelectItem value="project_member">{t('audit.projectMember')}</SelectItem>
            <SelectItem value="system_setting">{t('audit.systemSetting')}</SelectItem>
            <SelectItem value="feature_flag">{t('audit.featureFlag')}</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="surface-card overflow-hidden">
        {loading ? (
          <EmptyState icon={Scroll} message={t('audit.loading')} />
        ) : error ? (
          <ErrorState message={error instanceof Error ? error.message : t('audit.loadFailed')} />
        ) : logs.length === 0 ? (
          <EmptyState icon={Scroll} message={t('audit.empty')} />
        ) : (
          <ul className="stagger divide-border/50 divide-y">
            {logs.map((log) => {
              const severity = auditSeverity(log.action);
              return (
                <li
                  key={log.id}
                  className="border-border/50 hover:bg-accent/60 flex flex-col gap-2 px-4 py-3 transition-colors sm:flex-row sm:items-start sm:gap-3"
                >
                  <div className="flex min-w-0 flex-1 items-start gap-3">
                    <span
                      className={cn(
                        'priority-indicator min-h-[1.75rem] shrink-0 self-stretch',
                        severity === 'critical' && 'priority-critical',
                        severity === 'high' && 'priority-high',
                        severity === 'medium' && 'priority-medium',
                        severity === 'low' && 'priority-low'
                      )}
                      aria-hidden="true"
                    />
                    <div className="min-w-0 flex-1 space-y-1">
                      <div className="flex min-w-0 flex-wrap items-center gap-2">
                        <span className="text-foreground truncate text-sm font-medium">
                          {formatAdminAction(log.action)}
                        </span>
                        <span className="chip">{formatAdminAction(log.resourceType)}</span>
                        {log.resourceId ? (
                          <span className="chip max-w-[180px] truncate font-mono text-[11px]">
                            {log.resourceId}
                          </span>
                        ) : null}
                      </div>
                      <div className="text-muted-foreground flex min-w-0 flex-wrap items-center gap-x-3 gap-y-0.5 text-xs">
                        <span className="truncate">
                          {log.user?.name || log.user?.email || t('audit.unknownUser')}
                        </span>
                        {log.user?.email && log.user.name ? (
                          <span className="truncate">{log.user.email}</span>
                        ) : null}
                        {log.ipAddress ? (
                          <span className="font-mono">
                            {t('audit.ipAddress', { ip: log.ipAddress })}
                          </span>
                        ) : null}
                      </div>
                    </div>
                  </div>
                  <span className="text-muted-foreground shrink-0 text-xs tabular-nums sm:pt-0.5">
                    {formatter.relativeTime(new Date(log.createdAt))}
                  </span>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}

/* ------------------------------- UI Helpers ------------------------------- */

function KpiTile({
  label,
  value,
  icon: Icon,
  trend,
  tone = 'blue',
}: {
  label: string;
  value: string | number;
  icon: ComponentType<{ className?: string }>;
  trend?: { direction: 'up' | 'down'; value: string };
  tone?: 'blue' | 'violet' | 'emerald' | 'amber' | 'rose' | 'cyan';
}) {
  return (
    <div className="surface-card flex max-h-[140px] flex-col justify-between gap-2 p-4">
      <div className="flex items-center justify-between gap-2">
        <p className="kicker truncate">{label}</p>
        <span className={cn('icon-tile', `icon-tile-accent-${tone}`)}>
          <Icon className="h-3.5 w-3.5" />
        </span>
      </div>
      <div className="flex items-end justify-between gap-2">
        <p className="text-2xl font-semibold tabular-nums">{value}</p>
        {trend ? (
          <span
            className={cn(
              'text-xs font-medium',
              trend.direction === 'up' ? 'text-accent-emerald' : 'text-accent-rose'
            )}
          >
            {trend.direction === 'up' ? '↑' : '↓'} {trend.value}
          </span>
        ) : null}
      </div>
    </div>
  );
}

function MetricRow({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex items-center justify-between">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="text-foreground font-medium tabular-nums">{value}</dd>
    </div>
  );
}

function SearchInput({
  value,
  onChange,
  placeholder,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
}) {
  return (
    <div className="relative">
      <Search className="text-muted-foreground pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2" />
      <Input
        className="pl-9"
        placeholder={placeholder}
        value={value}
        onChange={(event) => onChange(event.target.value)}
      />
    </div>
  );
}

function EmptyState({
  icon: Icon,
  message,
  action,
}: {
  icon: ComponentType<{ className?: string }>;
  message: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col items-center gap-3 px-6 py-12 text-center">
      <Icon className="text-muted-foreground h-6 w-6" aria-hidden="true" />
      <p className="text-muted-foreground text-sm">{message}</p>
      {action}
    </div>
  );
}

function ErrorState({ message }: { message: string }) {
  return <div className="text-destructive px-6 py-6 text-sm">{message}</div>;
}

function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel,
  pendingLabel,
  cancelLabel,
  pending,
  onConfirm,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  title: string;
  description: string;
  confirmLabel: string;
  pendingLabel: string;
  cancelLabel: string;
  pending: boolean;
  onConfirm: () => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" size="sm" onClick={() => onOpenChange(false)}>
            {cancelLabel}
          </Button>
          <Button variant="destructive" size="sm" onClick={onConfirm} disabled={pending}>
            {pending ? pendingLabel : confirmLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function formatAdminAction(action: string) {
  return action
    .replaceAll('.', ' ')
    .replaceAll('_', ' ')
    .replace(/\b\w/g, (char) => char.toUpperCase());
}
