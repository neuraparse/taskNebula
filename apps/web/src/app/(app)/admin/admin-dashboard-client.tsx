'use client';

import type { ComponentType } from 'react';
import { useEffect, useMemo, useState } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { formatDistanceToNow } from 'date-fns';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
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
import { EditOrganizationDialog } from '@/components/admin/edit-organization-dialog';
import { EditUserDialog } from '@/components/admin/edit-user-dialog';
import { AgentOpsPanel } from '@/components/admin/agent-ops-panel';
import { useDeleteFeatureFlag, useFeatureFlags, useUpdateFeatureFlag } from '@/lib/hooks/use-feature-flags';
import { cn } from '@/lib/utils';
import {
  Activity,
  Bot,
  Building2,
  Clock3,
  Crown,
  Edit,
  Flag,
  MoreVertical,
  Search,
  Shield,
  ToggleLeft,
  ToggleRight,
  Trash2,
  Users,
} from 'lucide-react';

const adminTabsListClassName =
  'h-auto w-full flex-wrap justify-start gap-2 rounded-xl border border-border/70 bg-card/40 p-1';

const adminTabTriggerClassName =
  'rounded-lg border border-transparent px-3.5 py-2 text-sm text-muted-foreground transition-colors hover:bg-muted/50 hover:text-foreground data-[state=active]:border-border data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-sm';

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
  owner?: {
    id: string;
    name: string | null;
    email: string | null;
  } | null;
  stats?: {
    members: number;
    projects: number;
    issues: number;
  };
};

type UserItem = {
  id: string;
  name: string | null;
  email: string;
  status: string;
  isSuperAdmin: boolean;
  organizations?: Array<{
    organizationId: string;
    organizationName: string;
    role: string;
  }>;
};

type AdminAuditLog = {
  id: string;
  action: string;
  resourceType: string;
  resourceId: string | null;
  changes: Record<string, { from?: unknown; to?: unknown }> | null;
  metadata: Record<string, unknown> | null;
  createdAt: string;
  user: {
    id: string | null;
    name: string | null;
    email: string | null;
    image?: string | null;
  } | null;
};

export function AdminDashboardClient() {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const validTabs = useMemo(
    () => ['overview', 'organizations', 'users', 'feature-flags', 'agents', 'audit'],
    []
  );
  const requestedTab = searchParams.get('tab');
  const initialTab = requestedTab && validTabs.includes(requestedTab) ? requestedTab : 'overview';
  const [activeTab, setActiveTab] = useState(initialTab);
  const [editOrgId, setEditOrgId] = useState<string | null>(null);
  const [editUserId, setEditUserId] = useState<string | null>(null);
  const [editFlagId, setEditFlagId] = useState<string | null>(null);

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
      if (!response.ok) {
        throw new Error(payload.error || 'Failed to fetch stats');
      }
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
      const payload = await response.json().catch(() => ({ error: 'Failed to fetch organizations' }));
      if (!response.ok) {
        throw new Error(payload.error || 'Failed to fetch organizations');
      }
      return payload as {
        organizations: OrganizationItem[];
        pagination: { total: number };
      };
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
      if (!response.ok) {
        throw new Error(payload.error || 'Failed to fetch users');
      }
      return payload as {
        users: UserItem[];
        pagination: { total: number };
      };
    },
  });

  const { data: auditData, isLoading: auditLoading, error: auditError } = useQuery({
    queryKey: ['admin-audit-logs', auditSearch, auditResourceType],
    queryFn: async () => {
      const params = new URLSearchParams({ limit: '50' });
      if (auditSearch.trim()) params.set('search', auditSearch.trim());
      if (auditResourceType !== 'all') params.set('resourceType', auditResourceType);

      const response = await fetch(`/api/admin/audit-logs?${params.toString()}`);
      const payload = await response.json().catch(() => ({ error: 'Failed to fetch audit logs' }));
      if (!response.ok) {
        throw new Error(payload.error || 'Failed to fetch audit logs');
      }
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
      const payload = await response.json().catch(() => ({ error: 'Failed to delete organization' }));
      if (!response.ok) {
        throw new Error(payload.error || 'Failed to delete organization');
      }
      return payload;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-organizations'] });
      queryClient.invalidateQueries({ queryKey: ['admin-stats'] });
      queryClient.invalidateQueries({ queryKey: ['admin-audit-logs'] });
      toast({
        title: 'Organization deleted',
        description: 'The organization was removed permanently.',
      });
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
    const matchesSearch = !searchTerm
      || flag.name.toLowerCase().includes(searchTerm)
      || flag.key.toLowerCase().includes(searchTerm)
      || (flag.description || '').toLowerCase().includes(searchTerm);

    const matchesState = flagState === 'all'
      || (flagState === 'enabled' && flag.isEnabled)
      || (flagState === 'disabled' && !flag.isEnabled);

    return matchesSearch && matchesState;
  });

  async function handleToggleFlag(flag: any) {
    try {
      await updateFeatureFlag.mutateAsync({
        flagId: flag.id,
        data: {
          isEnabled: !flag.isEnabled,
        },
      });
      queryClient.invalidateQueries({ queryKey: ['admin-audit-logs'] });
      toast({
        title: flag.isEnabled ? 'Feature disabled' : 'Feature enabled',
        description: `${flag.name} is now ${flag.isEnabled ? 'disabled' : 'enabled'}.`,
      });
    } catch (error) {
      toast({
        title: 'Failed to update feature flag',
        description: error instanceof Error ? error.message : 'Failed to update feature flag',
        variant: 'destructive',
      });
    }
  }

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

      <div className="space-y-6 p-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="space-y-2">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg border bg-card">
                <Shield className="h-5 w-5 text-muted-foreground" />
              </div>
              <div>
                <h1 className="text-3xl font-semibold tracking-tight">Admin</h1>
                <p className="text-sm text-muted-foreground">System-wide organizations, users, rollout flags, and audit activity.</p>
              </div>
            </div>
          </div>
          <Button
            variant="outline"
            onClick={() => handleTabChange('audit')}
            className={cn(
              'border-border/70 bg-transparent',
              activeTab === 'audit' && 'border-border bg-background text-foreground shadow-sm',
            )}
          >
            <Activity className="mr-2 h-4 w-4" />
            Open audit log
          </Button>
        </div>

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-6">
          <StatCard title="Organizations" value={statsLoading ? '...' : stats?.overview?.totalOrganizations || 0} icon={Building2} />
          <StatCard title="Users" value={statsLoading ? '...' : stats?.overview?.totalUsers || 0} icon={Users} />
          <StatCard title="Active Users" value={statsLoading ? '...' : stats?.overview?.activeUsers || 0} icon={Activity} />
          <StatCard title="Super Admins" value={statsLoading ? '...' : stats?.overview?.superAdmins || 0} icon={Crown} />
          <StatCard title="Projects" value={statsLoading ? '...' : stats?.overview?.totalProjects || 0} icon={Building2} />
          <StatCard title="Issues" value={statsLoading ? '...' : stats?.overview?.totalIssues || 0} icon={Flag} />
        </div>

        <Tabs value={activeTab} onValueChange={handleTabChange} className="space-y-6">
          <TabsList className={adminTabsListClassName}>
            <TabsTrigger value="overview" className={adminTabTriggerClassName}>
              Overview
            </TabsTrigger>
            <TabsTrigger value="organizations" className={adminTabTriggerClassName}>
              Organizations
            </TabsTrigger>
            <TabsTrigger value="users" className={adminTabTriggerClassName}>
              Users
            </TabsTrigger>
            <TabsTrigger value="feature-flags" className={adminTabTriggerClassName}>
              Feature Flags
            </TabsTrigger>
            <TabsTrigger value="agents" className={adminTabTriggerClassName}>
              AI Ops
            </TabsTrigger>
            <TabsTrigger value="audit" className={adminTabTriggerClassName}>
              Audit
            </TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="space-y-6">
            <div className="grid gap-6 lg:grid-cols-2">
              <Card>
                <CardHeader>
                  <CardTitle>Organization health</CardTitle>
                  <CardDescription>Breakdown by status and plan.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-3 text-sm">
                  <MetricRow label="Active" value={stats?.organizations?.byStatus?.active || 0} />
                  <MetricRow label="Trial" value={stats?.organizations?.byStatus?.trial || 0} />
                  <MetricRow label="Suspended" value={stats?.organizations?.byStatus?.suspended || 0} />
                  <div className="pt-3" />
                  <MetricRow label="Free" value={stats?.organizations?.byPlan?.free || 0} />
                  <MetricRow label="Starter" value={stats?.organizations?.byPlan?.starter || 0} />
                  <MetricRow label="Growth" value={stats?.organizations?.byPlan?.growth || 0} />
                  <MetricRow label="Enterprise" value={stats?.organizations?.byPlan?.enterprise || 0} />
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Last 30 days</CardTitle>
                  <CardDescription>Growth snapshot across the system.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-3 text-sm">
                  <MetricRow label="New organizations" value={stats?.growth?.newOrganizations30d || 0} />
                  <MetricRow label="New users" value={stats?.growth?.newUsers30d || 0} />
                  <MetricRow label="Comments" value={stats?.overview?.totalComments || 0} />
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="organizations" className="space-y-6">
            <Card>
              <CardHeader>
                <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                  <div>
                    <CardTitle>Organizations</CardTitle>
                    <CardDescription>{orgsData?.pagination?.total || 0} matching workspaces</CardDescription>
                  </div>
                  <CreateOrganizationAdminDialog />
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_180px_180px]">
                  <div className="relative">
                    <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      className="pl-9"
                      placeholder="Search organizations"
                      value={orgSearch}
                      onChange={(event) => setOrgSearch(event.target.value)}
                    />
                  </div>
                  <Select value={orgStatus} onValueChange={setOrgStatus}>
                    <SelectTrigger>
                      <SelectValue placeholder="Status" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All statuses</SelectItem>
                      <SelectItem value="active">Active</SelectItem>
                      <SelectItem value="trial">Trial</SelectItem>
                      <SelectItem value="suspended">Suspended</SelectItem>
                    </SelectContent>
                  </Select>
                  <Select value={orgPlan} onValueChange={setOrgPlan}>
                    <SelectTrigger>
                      <SelectValue placeholder="Plan" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All plans</SelectItem>
                      <SelectItem value="free">Free</SelectItem>
                      <SelectItem value="starter">Starter</SelectItem>
                      <SelectItem value="growth">Growth</SelectItem>
                      <SelectItem value="enterprise">Enterprise</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {orgsLoading ? (
                  <EmptyState message="Loading organizations..." />
                ) : orgsError ? (
                  <ErrorState message={orgsError instanceof Error ? orgsError.message : 'Failed to load organizations'} />
                ) : (orgsData?.organizations || []).length === 0 ? (
                  <EmptyState message="No organizations match the current filters." />
                ) : (
                  <div className="space-y-3">
                    {orgsData?.organizations.map((org) => (
                      <div key={org.id} className="flex flex-col gap-4 rounded-lg border p-4 lg:flex-row lg:items-start lg:justify-between">
                        <div className="space-y-2">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="font-medium">{org.name}</span>
                            <Badge variant="outline">{org.slug}</Badge>
                            <Badge variant={org.status === 'active' ? 'default' : org.status === 'trial' ? 'secondary' : 'destructive'}>
                              {org.status}
                            </Badge>
                            <Badge variant="outline">{org.plan}</Badge>
                          </div>
                          <div className="text-sm text-muted-foreground">
                            Owner: {org.owner?.name || org.owner?.email || 'Not assigned'}
                          </div>
                          <div className="flex flex-wrap gap-4 text-sm text-muted-foreground">
                            <span>{org.stats?.members || 0} members</span>
                            <span>{org.stats?.projects || 0} projects</span>
                            <span>{org.stats?.issues || 0} issues</span>
                          </div>
                        </div>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon">
                              <MoreVertical className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuLabel>Actions</DropdownMenuLabel>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem onClick={() => setEditOrgId(org.id)}>
                              <Edit className="mr-2 h-4 w-4" />
                              Edit organization
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                              className="text-destructive"
                              onClick={() => {
                                if (window.confirm(`Delete "${org.name}"? This cannot be undone.`)) {
                                  deleteOrgMutation.mutate(org.id);
                                }
                              }}
                            >
                              <Trash2 className="mr-2 h-4 w-4" />
                              Delete organization
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="users" className="space-y-6">
            <Card>
              <CardHeader>
                <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                  <div>
                    <CardTitle>Users</CardTitle>
                    <CardDescription>{usersData?.pagination?.total || 0} matching users</CardDescription>
                  </div>
                  <CreateUserDialog />
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_180px]">
                  <div className="relative">
                    <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      className="pl-9"
                      placeholder="Search users"
                      value={userSearch}
                      onChange={(event) => setUserSearch(event.target.value)}
                    />
                  </div>
                  <Select value={userStatus} onValueChange={setUserStatus}>
                    <SelectTrigger>
                      <SelectValue placeholder="Status" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All statuses</SelectItem>
                      <SelectItem value="active">Active</SelectItem>
                      <SelectItem value="inactive">Inactive</SelectItem>
                      <SelectItem value="invited">Invited</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {usersLoading ? (
                  <EmptyState message="Loading users..." />
                ) : usersError ? (
                  <ErrorState message={usersError instanceof Error ? usersError.message : 'Failed to load users'} />
                ) : (usersData?.users || []).length === 0 ? (
                  <EmptyState message="No users match the current filters." />
                ) : (
                  <div className="space-y-3">
                    {usersData?.users.map((user) => (
                      <div key={user.id} className="flex flex-col gap-4 rounded-lg border p-4 lg:flex-row lg:items-start lg:justify-between">
                        <div className="space-y-2">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="font-medium">{user.name || user.email}</span>
                            {user.isSuperAdmin ? <Badge className="gap-1"><Crown className="h-3 w-3" />Super admin</Badge> : null}
                            <Badge variant="outline">{user.status}</Badge>
                          </div>
                          <div className="text-sm text-muted-foreground">{user.email}</div>
                          <div className="text-sm text-muted-foreground">
                            {(user.organizations || []).length} organization{(user.organizations || []).length === 1 ? '' : 's'}
                          </div>
                        </div>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon">
                              <MoreVertical className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuLabel>Actions</DropdownMenuLabel>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem onClick={() => setEditUserId(user.id)}>
                              <Edit className="mr-2 h-4 w-4" />
                              Edit user
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="feature-flags" className="space-y-6">
            <Card>
              <CardHeader>
                <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                  <div>
                    <CardTitle>Feature flags</CardTitle>
                    <CardDescription>{filteredFlags.length} matching flags</CardDescription>
                  </div>
                  <CreateFeatureFlagDialog />
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_180px]">
                  <div className="relative">
                    <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      className="pl-9"
                      placeholder="Search feature flags"
                      value={flagSearch}
                      onChange={(event) => setFlagSearch(event.target.value)}
                    />
                  </div>
                  <Select value={flagState} onValueChange={setFlagState}>
                    <SelectTrigger>
                      <SelectValue placeholder="State" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All flags</SelectItem>
                      <SelectItem value="enabled">Enabled</SelectItem>
                      <SelectItem value="disabled">Disabled</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {flagsLoading ? (
                  <EmptyState message="Loading feature flags..." />
                ) : flagsError ? (
                  <ErrorState message={flagsError instanceof Error ? flagsError.message : 'Failed to load feature flags'} />
                ) : filteredFlags.length === 0 ? (
                  <EmptyState message="No feature flags match the current filters." />
                ) : (
                  <div className="space-y-3">
                    {filteredFlags.map((flag: any) => (
                      <div key={flag.id} className="flex flex-col gap-4 rounded-lg border p-4 lg:flex-row lg:items-start lg:justify-between">
                        <div className="space-y-2">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="font-medium">{flag.name}</span>
                            <Badge variant={flag.isEnabled ? 'default' : 'secondary'}>
                              <span className="flex items-center gap-1">
                                {flag.isEnabled ? <ToggleRight className="h-3 w-3" /> : <ToggleLeft className="h-3 w-3" />}
                                {flag.isEnabled ? 'Enabled' : 'Disabled'}
                              </span>
                            </Badge>
                            {flag.rolloutPercentage < 100 ? (
                              <Badge variant="outline">{flag.rolloutPercentage}% rollout</Badge>
                            ) : null}
                          </div>
                          <div className="font-mono text-xs text-muted-foreground">{flag.key}</div>
                          {flag.description ? <p className="text-sm text-muted-foreground">{flag.description}</p> : null}
                        </div>
                        <div className="flex items-center gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleToggleFlag(flag)}
                            disabled={updateFeatureFlag.isPending}
                          >
                            {flag.isEnabled ? 'Disable' : 'Enable'}
                          </Button>
                          <Button variant="outline" size="sm" onClick={() => setEditFlagId(flag.id)}>
                            <Edit className="mr-2 h-4 w-4" />
                            Edit
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={async () => {
                              if (window.confirm(`Delete "${flag.name}"?`)) {
                                try {
                                  await deleteFeatureFlag.mutateAsync(flag.id);
                                  queryClient.invalidateQueries({ queryKey: ['admin-audit-logs'] });
                                  toast({
                                    title: 'Feature flag deleted',
                                    description: `${flag.name} was removed.`,
                                  });
                                } catch (error) {
                                  toast({
                                    title: 'Failed to delete feature flag',
                                    description: error instanceof Error ? error.message : 'Failed to delete feature flag',
                                    variant: 'destructive',
                                  });
                                }
                              }
                            }}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="agents" className="space-y-6">
            <Card>
              <CardHeader>
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg border bg-card">
                    <Bot className="h-5 w-5 text-muted-foreground" />
                  </div>
                  <div>
                    <CardTitle>AI operations</CardTitle>
                    <CardDescription>Global control plane for workspace agents, live safety, and rollout quality.</CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <AgentOpsPanel />
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="audit" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>System audit</CardTitle>
                <CardDescription>Recent super admin activity across organizations, users, and flags.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_220px]">
                  <div className="relative">
                    <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      className="pl-9"
                      placeholder="Search by action, resource, or user"
                      value={auditSearch}
                      onChange={(event) => setAuditSearch(event.target.value)}
                    />
                  </div>
                  <Select value={auditResourceType} onValueChange={setAuditResourceType}>
                    <SelectTrigger>
                      <SelectValue placeholder="Resource type" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All resources</SelectItem>
                      <SelectItem value="organization">Organization</SelectItem>
                      <SelectItem value="user">User</SelectItem>
                      <SelectItem value="feature_flag">Feature flag</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {auditLoading ? (
                  <EmptyState message="Loading audit logs..." />
                ) : auditError ? (
                  <ErrorState message={auditError instanceof Error ? auditError.message : 'Failed to load audit logs'} />
                ) : (auditData?.auditLogs || []).length === 0 ? (
                  <EmptyState message="No audit events match the current filters." />
                ) : (
                  <div className="space-y-3">
                    {auditData?.auditLogs.map((log) => (
                      <div key={log.id} className="rounded-lg border p-4">
                        <div className="flex flex-col gap-2 lg:flex-row lg:items-center lg:justify-between">
                          <div className="space-y-1">
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="font-medium">{formatAdminAction(log.action)}</span>
                              <Badge variant="outline">{log.resourceType}</Badge>
                              {log.resourceId ? <Badge variant="secondary">{log.resourceId}</Badge> : null}
                            </div>
                            <div className="text-sm text-muted-foreground">
                              {log.user?.name || log.user?.email || 'Unknown user'}
                            </div>
                          </div>
                          <div className="flex items-center gap-2 text-xs text-muted-foreground">
                            <Clock3 className="h-3.5 w-3.5" />
                            {formatDistanceToNow(new Date(log.createdAt), { addSuffix: true })}
                          </div>
                        </div>
                        {log.changes ? (
                          <div className="mt-3 grid gap-2 text-sm text-muted-foreground">
                            {Object.entries(log.changes).map(([field, change]) => (
                              <div key={field} className="flex flex-wrap items-center gap-2">
                                <span className="font-medium text-foreground">{field}</span>
                                <span className="line-through">{String(change.from ?? 'null')}</span>
                                <span>→</span>
                                <span className="text-foreground">{String(change.to ?? 'null')}</span>
                              </div>
                            ))}
                          </div>
                        ) : null}
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </>
  );
}

function StatCard({
  title,
  value,
  icon: Icon,
}: {
  title: string;
  value: string | number;
  icon: ComponentType<{ className?: string }>;
}) {
  return (
    <Card>
      <CardContent className="flex items-center justify-between p-4">
        <div>
          <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">{title}</p>
          <p className="mt-1 text-2xl font-semibold">{value}</p>
        </div>
        <Icon className="h-4 w-4 text-muted-foreground" />
      </CardContent>
    </Card>
  );
}

function MetricRow({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium text-foreground">{value}</span>
    </div>
  );
}

function EmptyState({ message }: { message: string }) {
  return <div className="py-10 text-center text-sm text-muted-foreground">{message}</div>;
}

function ErrorState({ message }: { message: string }) {
  return <div className="rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-6 text-sm text-destructive">{message}</div>;
}

function formatAdminAction(action: string) {
  return action
    .replaceAll('.', ' ')
    .replaceAll('_', ' ')
    .replace(/\b\w/g, (char) => char.toUpperCase());
}
