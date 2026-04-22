'use client';

import type { ComponentType } from 'react';
import { useEffect, useMemo, useState } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { formatDistanceToNow } from 'date-fns';
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
import { RealtimeHealthPanel } from '@/components/admin/realtime-health-panel';
import { useDeleteFeatureFlag, useFeatureFlags, useUpdateFeatureFlag } from '@/lib/hooks/use-feature-flags';
import { cn } from '@/lib/utils';
import {
  Activity,
  BarChart3,
  Bot,
  Building2,
  Crown,
  Edit,
  Flag,
  Gauge,
  MoreVertical,
  Radio,
  Scroll,
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
  status: string;
  isSuperAdmin: boolean;
  organizations?: Array<{ organizationId: string; organizationName: string; role: string }>;
};

type AdminAuditLog = {
  id: string;
  action: string;
  resourceType: string;
  resourceId: string | null;
  changes: Record<string, { from?: unknown; to?: unknown }> | null;
  metadata: Record<string, unknown> | null;
  createdAt: string;
  user: { id: string | null; name: string | null; email: string | null; image?: string | null } | null;
};

type NavItem = {
  key: string;
  label: string;
  icon: ComponentType<{ className?: string }>;
};

const NAV: NavItem[] = [
  { key: 'overview', label: 'Overview', icon: Gauge },
  { key: 'organizations', label: 'Organizations', icon: Building2 },
  { key: 'users', label: 'Users', icon: Users },
  { key: 'feature-flags', label: 'Feature flags', icon: Flag },
  { key: 'agents', label: 'Agent control', icon: Bot },
  { key: 'realtime', label: 'Realtime health', icon: Radio },
  { key: 'audit', label: 'Audit logs', icon: Scroll },
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

const auditSeverity = (action: string): 'critical' | 'high' | 'medium' | 'low' => {
  if (/delete|revoke|suspend|purge/i.test(action)) return 'critical';
  if (/update|change|rotate|disable|enable/i.test(action)) return 'high';
  if (/create|invite|add/i.test(action)) return 'medium';
  return 'low';
};

export function AdminDashboardClient() {
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

  const { data: orgsData, isLoading: orgsLoading, error: orgsError } = useQuery({
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

  const { data: usersData, isLoading: usersLoading, error: usersError } = useQuery({
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

  const { data: auditData, isLoading: auditLoading, error: auditError } = useQuery({
    queryKey: ['admin-audit-logs', auditSearch, auditResourceType],
    queryFn: async () => {
      const params = new URLSearchParams({ limit: '50' });
      if (auditSearch.trim()) params.set('search', auditSearch.trim());
      if (auditResourceType !== 'all') params.set('resourceType', auditResourceType);
      const response = await fetch(`/api/admin/audit-logs?${params.toString()}`);
      const payload = await response
        .json()
        .catch(() => ({ error: 'Failed to fetch audit logs' }));
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
      toast({ title: 'Organization deleted', description: 'The organization was removed permanently.' });
      setDeleteOrg(null);
    },
    onError: (mutationError: Error) => {
      toast({
        title: 'Failed to delete organization',
        description: mutationError.message,
        variant: 'destructive',
      });
    },
  });

  const selectedFlag = featureFlags?.find((flag: any) => flag.id === editFlagId);
  const filteredFlags = (featureFlags || []).filter((flag: any) => {
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

  async function handleToggleFlag(flag: any, next: boolean) {
    try {
      await updateFeatureFlag.mutateAsync({ flagId: flag.id, data: { isEnabled: next } });
      queryClient.invalidateQueries({ queryKey: ['admin-audit-logs'] });
      toast({
        title: next ? 'Feature enabled' : 'Feature disabled',
        description: `${flag.name} is now ${next ? 'enabled' : 'disabled'}.`,
      });
    } catch (error) {
      toast({
        title: 'Failed to update feature flag',
        description: error instanceof Error ? error.message : 'Failed to update feature flag',
        variant: 'destructive',
      });
    }
  }

  async function handleConfirmDeleteFlag() {
    if (!deleteFlag) return;
    try {
      await deleteFeatureFlag.mutateAsync(deleteFlag.id);
      queryClient.invalidateQueries({ queryKey: ['admin-audit-logs'] });
      toast({ title: 'Feature flag deleted', description: `${deleteFlag.name} was removed.` });
      setDeleteFlag(null);
    } catch (error) {
      toast({
        title: 'Failed to delete feature flag',
        description: error instanceof Error ? error.message : 'Failed to delete feature flag',
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
        title="Delete organization?"
        description={
          deleteOrg
            ? `"${deleteOrg.name}" and all associated data will be removed permanently. This cannot be undone.`
            : ''
        }
        confirmLabel="Delete organization"
        pending={deleteOrgMutation.isPending}
        onConfirm={() => deleteOrg && deleteOrgMutation.mutate(deleteOrg.id)}
      />

      <ConfirmDialog
        open={!!deleteFlag}
        onOpenChange={(open) => !open && setDeleteFlag(null)}
        title="Delete feature flag?"
        description={
          deleteFlag
            ? `"${deleteFlag.name}" will be removed. Any rollouts referencing it will revert.`
            : ''
        }
        confirmLabel="Delete flag"
        pending={deleteFeatureFlag.isPending}
        onConfirm={handleConfirmDeleteFlag}
      />

      <div className="flex h-full min-h-0">
        <div className="flex-1 min-w-0 animate-fade-up space-y-6 overflow-y-auto p-6">
          {/* Mobile nav */}
          <div className="lg:hidden">
            <Select value={activeTab} onValueChange={handleTabChange}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {visibleNav.map((item) => (
                  <SelectItem key={item.key} value={item.key}>
                    {item.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Header */}
          <div className="flex flex-col gap-1">
            <span className="kicker">Admin</span>
            <h1 className="text-2xl font-semibold tracking-tight text-balance">{currentNav.label}</h1>
            <p className="text-sm text-muted-foreground max-w-2xl">
              System-wide organizations, users, rollout flags, agent control, and audit activity.
            </p>
          </div>

          {/* Section body */}
          {activeTab === 'overview' && (
            <OverviewSection stats={stats} loading={statsLoading} />
          )}

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

/* --------------------------------- Overview -------------------------------- */

function OverviewSection({
  stats,
  loading,
}: {
  stats: StatsResponse | undefined;
  loading: boolean;
}) {
  const tiles: Array<{
    label: string;
    value: number | string;
    icon: ComponentType<{ className?: string }>;
    tone: 'blue' | 'violet' | 'emerald' | 'amber';
  }> = [
    { label: 'Organizations', value: loading ? '—' : stats?.overview?.totalOrganizations ?? 0, icon: Building2, tone: 'blue' },
    { label: 'Users', value: loading ? '—' : stats?.overview?.totalUsers ?? 0, icon: Users, tone: 'violet' },
    { label: 'Active users', value: loading ? '—' : stats?.overview?.activeUsers ?? 0, icon: Activity, tone: 'emerald' },
    { label: 'Super admins', value: loading ? '—' : stats?.overview?.superAdmins ?? 0, icon: Crown, tone: 'amber' },
  ];

  return (
    <div className="space-y-6">
      <div className="stagger grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {tiles.map(({ label, value, icon: Icon, tone }) => (
          <KpiTile key={label} label={label} value={value} icon={Icon} tone={tone} />
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="surface-card p-6 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold">Organization health</h3>
            <BarChart3 className="h-4 w-4 text-muted-foreground" />
          </div>
          <dl className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm">
            <MetricRow label="Active" value={stats?.organizations?.byStatus?.active ?? 0} />
            <MetricRow label="Trial" value={stats?.organizations?.byStatus?.trial ?? 0} />
            <MetricRow label="Suspended" value={stats?.organizations?.byStatus?.suspended ?? 0} />
            <MetricRow label="Free" value={stats?.organizations?.byPlan?.free ?? 0} />
            <MetricRow label="Starter" value={stats?.organizations?.byPlan?.starter ?? 0} />
            <MetricRow label="Growth" value={stats?.organizations?.byPlan?.growth ?? 0} />
            <MetricRow label="Enterprise" value={stats?.organizations?.byPlan?.enterprise ?? 0} />
          </dl>
        </div>

        <div className="surface-card p-6 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold">Last 30 days</h3>
            <Activity className="h-4 w-4 text-muted-foreground" />
          </div>
          <dl className="space-y-2 text-sm">
            <MetricRow label="New organizations" value={stats?.growth?.newOrganizations30d ?? 0} />
            <MetricRow label="New users" value={stats?.growth?.newUsers30d ?? 0} />
            <MetricRow label="Projects total" value={stats?.overview?.totalProjects ?? 0} />
            <MetricRow label="Issues total" value={stats?.overview?.totalIssues ?? 0} />
            <MetricRow label="Comments total" value={stats?.overview?.totalComments ?? 0} />
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
  const orgs = orgsData?.organizations || [];
  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <p className="text-xs text-muted-foreground">
          {orgsData?.pagination?.total ?? 0} matching workspaces
        </p>
        <CreateOrganizationAdminDialog />
      </div>

      <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_180px_180px] animate-blur-in">
        <SearchInput value={orgSearch} onChange={setOrgSearch} placeholder="Search organizations" />
        <Select value={orgStatus} onValueChange={setOrgStatus}>
          <SelectTrigger><SelectValue placeholder="Status" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            <SelectItem value="active">Active</SelectItem>
            <SelectItem value="trial">Trial</SelectItem>
            <SelectItem value="suspended">Suspended</SelectItem>
          </SelectContent>
        </Select>
        <Select value={orgPlan} onValueChange={setOrgPlan}>
          <SelectTrigger><SelectValue placeholder="Plan" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All plans</SelectItem>
            <SelectItem value="free">Free</SelectItem>
            <SelectItem value="starter">Starter</SelectItem>
            <SelectItem value="growth">Growth</SelectItem>
            <SelectItem value="enterprise">Enterprise</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="surface-card overflow-hidden">
        {orgsLoading ? (
          <EmptyState icon={Building2} message="Loading organizations..." />
        ) : orgsError ? (
          <ErrorState message={orgsError instanceof Error ? orgsError.message : 'Failed to load organizations'} />
        ) : orgs.length === 0 ? (
          <EmptyState icon={Building2} message="No organizations match the current filters." />
        ) : (
          <table className="w-full border-collapse">
            <thead>
              <tr className="border-b border-border">
                <th className="px-4 py-2 text-left text-xs uppercase tracking-wider font-medium text-muted-foreground">Name</th>
                <th className="px-4 py-2 text-left text-xs uppercase tracking-wider font-medium text-muted-foreground">Status</th>
                <th className="px-4 py-2 text-left text-xs uppercase tracking-wider font-medium text-muted-foreground">Plan</th>
                <th className="px-4 py-2 text-left text-xs uppercase tracking-wider font-medium text-muted-foreground">Owner</th>
                <th className="px-4 py-2 text-right text-xs uppercase tracking-wider font-medium text-muted-foreground">Members</th>
                <th className="px-4 py-2" />
              </tr>
            </thead>
            <tbody className="stagger">
              {orgs.map((org) => (
                <tr
                  key={org.id}
                  className="row-interactive border-b border-border/50 last:border-b-0"
                >
                  <td className="px-4 py-3">
                    <div className="min-w-0">
                      <p className="text-sm font-medium truncate">{org.name}</p>
                      <p className="text-xs text-muted-foreground font-mono truncate">{org.slug}</p>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <span className={cn(orgStatusChipClass[org.status] ?? DEFAULT_CHIP_CLASS, 'capitalize')}>
                      {org.status}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span className="chip capitalize">{org.plan}</span>
                  </td>
                  <td className="px-4 py-3">
                    <p className="text-sm truncate max-w-[200px]">
                      {org.owner?.name || org.owner?.email || (
                        <span className="text-muted-foreground">No owner</span>
                      )}
                    </p>
                  </td>
                  <td className="px-4 py-3 text-right text-sm tabular-nums">
                    {org.stats?.members ?? 0}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-7 w-7">
                          <MoreVertical className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuLabel>Actions</DropdownMenuLabel>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem onClick={() => onEdit(org.id)}>
                          <Edit className="mr-2 h-4 w-4" />
                          Edit
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                          className="text-destructive focus:text-destructive"
                          onClick={() => onDelete(org)}
                        >
                          <Trash2 className="mr-2 h-4 w-4" />
                          Delete
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
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
}: {
  usersData: { users: UserItem[]; pagination: { total: number } } | undefined;
  usersLoading: boolean;
  usersError: unknown;
  userSearch: string;
  setUserSearch: (v: string) => void;
  userStatus: string;
  setUserStatus: (v: string) => void;
  onEdit: (id: string) => void;
}) {
  const users = usersData?.users || [];
  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <p className="text-xs text-muted-foreground">
          {usersData?.pagination?.total ?? 0} matching users
        </p>
        <CreateUserDialog />
      </div>

      <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_180px] animate-blur-in">
        <SearchInput value={userSearch} onChange={setUserSearch} placeholder="Search users" />
        <Select value={userStatus} onValueChange={setUserStatus}>
          <SelectTrigger><SelectValue placeholder="Status" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            <SelectItem value="active">Active</SelectItem>
            <SelectItem value="inactive">Inactive</SelectItem>
            <SelectItem value="invited">Invited</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="surface-card overflow-hidden">
        {usersLoading ? (
          <EmptyState icon={Users} message="Loading users..." />
        ) : usersError ? (
          <ErrorState message={usersError instanceof Error ? usersError.message : 'Failed to load users'} />
        ) : users.length === 0 ? (
          <EmptyState icon={Users} message="No users match the current filters." />
        ) : (
          <table className="w-full border-collapse">
            <thead>
              <tr className="border-b border-border">
                <th className="px-4 py-2 text-left text-xs uppercase tracking-wider font-medium text-muted-foreground">User</th>
                <th className="px-4 py-2 text-left text-xs uppercase tracking-wider font-medium text-muted-foreground">Role</th>
                <th className="px-4 py-2 text-left text-xs uppercase tracking-wider font-medium text-muted-foreground">Status</th>
                <th className="px-4 py-2 text-right text-xs uppercase tracking-wider font-medium text-muted-foreground">Orgs</th>
                <th className="px-4 py-2" />
              </tr>
            </thead>
            <tbody className="stagger">
              {users.map((user) => {
                const isSuspended = user.status === 'suspended' || user.status === 'inactive';
                const isInvited = user.status === 'invited';
                return (
                  <tr
                    key={user.id}
                    className="row-interactive border-b border-border/50 last:border-b-0"
                  >
                    <td className="px-4 py-3">
                      <div className="min-w-0">
                        <p className="text-sm font-medium truncate">{user.name || user.email}</p>
                        <p className="text-xs text-muted-foreground truncate">{user.email}</p>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      {user.isSuperAdmin ? (
                        <span className="chip-rose inline-flex items-center gap-1">
                          <Crown className="h-3 w-3" />
                          Admin
                        </span>
                      ) : isSuspended ? (
                        <span className="chip-rose">Suspended</span>
                      ) : isInvited ? (
                        <span className="chip-amber">Pending</span>
                      ) : (
                        <span className="chip-blue">Member</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <span className={cn(userStatusChipClass[user.status] ?? DEFAULT_CHIP_CLASS, 'capitalize')}>
                        {user.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right text-sm tabular-nums">
                      {(user.organizations || []).length}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-7 w-7">
                            <MoreVertical className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuLabel>Actions</DropdownMenuLabel>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem onClick={() => onEdit(user.id)}>
                            <Edit className="mr-2 h-4 w-4" />
                            Edit user
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </td>
                  </tr>
                );
              })}
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
  flags: any[];
  loading: boolean;
  error: unknown;
  search: string;
  setSearch: (v: string) => void;
  state: string;
  setState: (v: string) => void;
  onEdit: (id: string) => void;
  onDelete: (flag: { id: string; name: string }) => void;
  onToggle: (flag: any, next: boolean) => void;
  updatePending: boolean;
}) {
  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <p className="text-xs text-muted-foreground">{flags.length} matching flags</p>
        <div className="flex items-center gap-2">
          <FeatureFlagRuntimeTest />
          <CreateFeatureFlagDialog />
        </div>
      </div>

      <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_180px] animate-blur-in">
        <SearchInput value={search} onChange={setSearch} placeholder="Search feature flags" />
        <Select value={state} onValueChange={setState}>
          <SelectTrigger><SelectValue placeholder="State" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All flags</SelectItem>
            <SelectItem value="enabled">Enabled</SelectItem>
            <SelectItem value="disabled">Disabled</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="surface-card overflow-hidden">
        {loading ? (
          <EmptyState icon={Flag} message="Loading feature flags..." />
        ) : error ? (
          <ErrorState message={error instanceof Error ? error.message : 'Failed to load feature flags'} />
        ) : flags.length === 0 ? (
          <EmptyState icon={Flag} message="No feature flags match the current filters." />
        ) : (
          <ul className="stagger divide-y divide-border/50">
            {flags.map((flag: any) => (
              <li
                key={flag.id}
                className="row-interactive flex items-center gap-4 px-4 py-3"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-sm font-medium truncate">{flag.name}</span>
                    <span className="chip font-mono text-[11px]">{flag.key}</span>
                    {flag.rolloutPercentage < 100 && (
                      <span className="chip">{flag.rolloutPercentage}%</span>
                    )}
                  </div>
                  {flag.description ? (
                    <p className="mt-0.5 text-xs text-muted-foreground truncate">{flag.description}</p>
                  ) : null}
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <Switch
                    checked={flag.isEnabled}
                    onCheckedChange={(next) => onToggle(flag, next)}
                    disabled={updatePending}
                    aria-label={flag.isEnabled ? 'Disable flag' : 'Enable flag'}
                  />
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon" className="h-7 w-7">
                        <MoreVertical className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuLabel>Actions</DropdownMenuLabel>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem onClick={() => onEdit(flag.id)}>
                        <Edit className="mr-2 h-4 w-4" />
                        Edit
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem
                        className="text-destructive focus:text-destructive"
                        onClick={() => onDelete(flag)}
                      >
                        <Trash2 className="mr-2 h-4 w-4" />
                        Delete
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
  return (
    <div className="space-y-4">
      <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_220px] animate-blur-in">
        <SearchInput value={search} onChange={setSearch} placeholder="Search by action, resource, or user" />
        <Select value={resourceType} onValueChange={setResourceType}>
          <SelectTrigger><SelectValue placeholder="Resource type" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All resources</SelectItem>
            <SelectItem value="organization">Organization</SelectItem>
            <SelectItem value="user">User</SelectItem>
            <SelectItem value="feature_flag">Feature flag</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="surface-card overflow-hidden">
        {loading ? (
          <EmptyState icon={Scroll} message="Loading audit logs..." />
        ) : error ? (
          <ErrorState message={error instanceof Error ? error.message : 'Failed to load audit logs'} />
        ) : logs.length === 0 ? (
          <EmptyState icon={Scroll} message="No audit events match the current filters." />
        ) : (
          <ul className="stagger divide-y divide-border/50">
            {logs.map((log) => {
              const severity = auditSeverity(log.action);
              return (
                <li
                  key={log.id}
                  className="row-interactive flex items-center gap-3 px-4 py-3"
                >
                  <span
                    className={cn(
                      'priority-indicator self-stretch min-h-[1.75rem] shrink-0',
                      severity === 'critical' && 'priority-critical',
                      severity === 'high' && 'priority-high',
                      severity === 'medium' && 'priority-medium',
                      severity === 'low' && 'priority-low'
                    )}
                    aria-hidden="true"
                  />
                  <div className="min-w-0 flex-1 flex flex-wrap items-center gap-x-3 gap-y-0.5">
                    <span className="text-sm font-medium text-foreground truncate">
                      {log.user?.name || log.user?.email || 'Unknown user'}
                    </span>
                    <span className="text-sm text-muted-foreground truncate">
                      {formatAdminAction(log.action)}
                    </span>
                  </div>
                  <span className="shrink-0 text-xs text-muted-foreground tabular-nums">
                    {formatDistanceToNow(new Date(log.createdAt), { addSuffix: true })}
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
      <dd className="font-medium text-foreground tabular-nums">{value}</dd>
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
      <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
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
      <Icon className="h-6 w-6 text-muted-foreground" aria-hidden="true" />
      <p className="text-sm text-muted-foreground">{message}</p>
      {action}
    </div>
  );
}

function ErrorState({ message }: { message: string }) {
  return (
    <div className="px-6 py-6 text-sm text-destructive">
      {message}
    </div>
  );
}

function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel,
  pending,
  onConfirm,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  title: string;
  description: string;
  confirmLabel: string;
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
            Cancel
          </Button>
          <Button variant="destructive" size="sm" onClick={onConfirm} disabled={pending}>
            {pending ? 'Deleting...' : confirmLabel}
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
