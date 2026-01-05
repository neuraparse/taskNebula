'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Building2,
  Users,
  Shield,
  Activity,
  Search,
  Filter,
  MoreVertical,
  Crown,
  AlertCircle,
  CheckCircle2,
  Clock,
  XCircle,
  Edit,
  Trash2,
  Flag,
  ToggleLeft,
  ToggleRight,
} from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { CreateOrganizationAdminDialog } from '@/components/admin/create-organization-admin-dialog';
import { CreateUserDialog } from '@/components/admin/create-user-dialog';
import { EditOrganizationDialog } from '@/components/admin/edit-organization-dialog';
import { EditUserDialog } from '@/components/admin/edit-user-dialog';
import { CreateFeatureFlagDialog } from '@/components/admin/create-feature-flag-dialog';
import { EditFeatureFlagDialog } from '@/components/admin/edit-feature-flag-dialog';
import { useToast } from '@/hooks/use-toast';
import { useFeatureFlags, useDeleteFeatureFlag } from '@/lib/hooks/use-feature-flags';

export function AdminDashboardClient() {
  const [activeTab, setActiveTab] = useState('overview');
  const [editOrgId, setEditOrgId] = useState<string | null>(null);
  const [editUserId, setEditUserId] = useState<string | null>(null);
  const [editFlagId, setEditFlagId] = useState<string | null>(null);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Fetch system stats
  const { data: stats, isLoading: statsLoading } = useQuery({
    queryKey: ['admin-stats'],
    queryFn: async () => {
      const response = await fetch('/api/admin/stats');
      if (!response.ok) throw new Error('Failed to fetch stats');
      return response.json();
    },
  });

  // Fetch organizations
  const { data: orgsData, isLoading: orgsLoading } = useQuery({
    queryKey: ['admin-organizations'],
    queryFn: async () => {
      const response = await fetch('/api/admin/organizations?limit=10');
      if (!response.ok) throw new Error('Failed to fetch organizations');
      return response.json();
    },
  });

  // Fetch users
  const { data: usersData, isLoading: usersLoading } = useQuery({
    queryKey: ['admin-users'],
    queryFn: async () => {
      const response = await fetch('/api/admin/users?limit=10');
      if (!response.ok) throw new Error('Failed to fetch users');
      return response.json();
    },
  });

  // Fetch feature flags
  const { data: featureFlags, isLoading: flagsLoading } = useFeatureFlags();

  // Delete feature flag mutation
  const deleteFeatureFlag = useDeleteFeatureFlag();

  // Delete organization mutation
  const deleteOrgMutation = useMutation({
    mutationFn: async (orgId: string) => {
      const response = await fetch(`/api/admin/organizations/${orgId}`, {
        method: 'DELETE',
      });
      if (!response.ok) throw new Error('Failed to delete organization');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-organizations'] });
      queryClient.invalidateQueries({ queryKey: ['admin-stats'] });
      toast({
        title: 'Organization deleted',
        description: 'The organization has been permanently deleted.',
      });
    },
    onError: (error: Error) => {
      toast({
        title: 'Failed to delete organization',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  const selectedFlag = featureFlags?.find((f: any) => f.id === editFlagId);

  return (
    <>
      {/* Edit Dialogs */}
      {editOrgId && (
        <EditOrganizationDialog
          organizationId={editOrgId}
          open={!!editOrgId}
          onOpenChange={(open: boolean) => !open && setEditOrgId(null)}
        />
      )}
      {editUserId && (
        <EditUserDialog
          userId={editUserId}
          open={!!editUserId}
          onOpenChange={(open: boolean) => !open && setEditUserId(null)}
        />
      )}
      {editFlagId && selectedFlag && (
        <EditFeatureFlagDialog
          flag={selectedFlag}
          open={!!editFlagId}
          onOpenChange={(open: boolean) => !open && setEditFlagId(null)}
        />
      )}

      <div className="flex h-full flex-col">
        <div className="flex-1 overflow-auto">
        <div className="space-y-8 max-w-[1800px] mx-auto p-8">
          {/* Header */}
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-4xl font-bold tracking-tight flex items-center gap-3">
                <div className="h-12 w-12 rounded-xl bg-gradient-to-br from-purple-500 to-pink-600 flex items-center justify-center">
                  <Shield className="h-6 w-6 text-white" />
                </div>
                Super Admin Dashboard
              </h1>
              <p className="text-muted-foreground mt-2">
                System-wide management and analytics
              </p>
            </div>
            <div className="flex gap-3">
              <Button variant="outline" className="gap-2">
                <Activity className="h-4 w-4" />
                Audit Logs
              </Button>
            </div>
          </div>

          {/* Stats Grid */}
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <Card className="border-muted-foreground/10">
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Organizations</p>
                    <p className="text-3xl font-bold mt-2">
                      {statsLoading ? '...' : stats?.overview?.totalOrganizations || 0}
                    </p>
                  </div>
                  <div className="h-12 w-12 rounded-xl bg-blue-500/10 flex items-center justify-center">
                    <Building2 className="h-6 w-6 text-blue-600 dark:text-blue-400" />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="border-muted-foreground/10">
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Total Users</p>
                    <p className="text-3xl font-bold mt-2">
                      {statsLoading ? '...' : stats?.overview?.totalUsers || 0}
                    </p>
                  </div>
                  <div className="h-12 w-12 rounded-xl bg-green-500/10 flex items-center justify-center">
                    <Users className="h-6 w-6 text-green-600 dark:text-green-400" />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="border-muted-foreground/10">
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Active Users</p>
                    <p className="text-3xl font-bold mt-2">
                      {statsLoading ? '...' : stats?.overview?.activeUsers || 0}
                    </p>
                  </div>
                  <div className="h-12 w-12 rounded-xl bg-emerald-500/10 flex items-center justify-center">
                    <Activity className="h-6 w-6 text-emerald-600 dark:text-emerald-400" />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="border-muted-foreground/10">
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Super Admins</p>
                    <p className="text-3xl font-bold mt-2">
                      {statsLoading ? '...' : stats?.overview?.superAdmins || 0}
                    </p>
                  </div>
                  <div className="h-12 w-12 rounded-xl bg-purple-500/10 flex items-center justify-center">
                    <Crown className="h-6 w-6 text-purple-600 dark:text-purple-400" />
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Tabs */}
          <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
            <TabsList>
              <TabsTrigger value="overview">Overview</TabsTrigger>
              <TabsTrigger value="organizations">Organizations</TabsTrigger>
              <TabsTrigger value="users">Users</TabsTrigger>
              <TabsTrigger value="feature-flags">Feature Flags</TabsTrigger>
            </TabsList>

            <TabsContent value="overview" className="space-y-6">
              <div className="grid gap-6 md:grid-cols-2">
                {/* Organization Status */}
                <Card className="border-muted-foreground/10">
                  <CardHeader>
                    <CardTitle className="text-lg">Organizations by Status</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <CheckCircle2 className="h-4 w-4 text-green-600" />
                        <span className="text-sm">Active</span>
                      </div>
                      <Badge variant="secondary">
                        {stats?.organizations?.byStatus?.active || 0}
                      </Badge>
                    </div>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Clock className="h-4 w-4 text-blue-600" />
                        <span className="text-sm">Trial</span>
                      </div>
                      <Badge variant="secondary">
                        {stats?.organizations?.byStatus?.trial || 0}
                      </Badge>
                    </div>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <XCircle className="h-4 w-4 text-red-600" />
                        <span className="text-sm">Suspended</span>
                      </div>
                      <Badge variant="secondary">
                        {stats?.organizations?.byStatus?.suspended || 0}
                      </Badge>
                    </div>
                  </CardContent>
                </Card>

                {/* Organization Plans */}
                <Card className="border-muted-foreground/10">
                  <CardHeader>
                    <CardTitle className="text-lg">Organizations by Plan</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-sm">Free</span>
                      <Badge variant="secondary">
                        {stats?.organizations?.byPlan?.free || 0}
                      </Badge>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm">Starter</span>
                      <Badge variant="secondary">
                        {stats?.organizations?.byPlan?.starter || 0}
                      </Badge>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm">Growth</span>
                      <Badge variant="secondary">
                        {stats?.organizations?.byPlan?.growth || 0}
                      </Badge>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm">Enterprise</span>
                      <Badge variant="secondary">
                        {stats?.organizations?.byPlan?.enterprise || 0}
                      </Badge>
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Growth Stats */}
              <Card className="border-muted-foreground/10">
                <CardHeader>
                  <CardTitle className="text-lg">Growth (Last 30 Days)</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="flex items-center gap-4">
                      <div className="h-10 w-10 rounded-lg bg-blue-500/10 flex items-center justify-center">
                        <Building2 className="h-5 w-5 text-blue-600" />
                      </div>
                      <div>
                        <p className="text-2xl font-bold">
                          {stats?.growth?.newOrganizations30d || 0}
                        </p>
                        <p className="text-sm text-muted-foreground">New Organizations</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-4">
                      <div className="h-10 w-10 rounded-lg bg-green-500/10 flex items-center justify-center">
                        <Users className="h-5 w-5 text-green-600" />
                      </div>
                      <div>
                        <p className="text-2xl font-bold">
                          {stats?.growth?.newUsers30d || 0}
                        </p>
                        <p className="text-sm text-muted-foreground">New Users</p>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="organizations" className="space-y-6">
              <Card className="border-muted-foreground/10">
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle>Organizations</CardTitle>
                    <CreateOrganizationAdminDialog />
                  </div>
                </CardHeader>
                <CardContent>
                  {orgsLoading ? (
                    <p className="text-muted-foreground">Loading...</p>
                  ) : (
                    <div className="space-y-2">
                      {orgsData?.organizations?.map((org: any) => (
                        <div
                          key={org.id}
                          className="flex items-center justify-between p-4 rounded-lg border border-muted-foreground/10 hover:bg-accent/50 transition-colors"
                        >
                          <div className="flex items-center gap-4">
                            <div className="h-10 w-10 rounded-lg bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center">
                              <Building2 className="h-5 w-5 text-white" />
                            </div>
                            <div>
                              <p className="font-medium">{org.name}</p>
                              <p className="text-sm text-muted-foreground">
                                {org.stats?.members || 0} members · {org.stats?.projects || 0} projects
                              </p>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <Badge variant={org.status === 'active' ? 'default' : 'secondary'}>
                              {org.status}
                            </Badge>
                            <Badge variant="outline">{org.plan}</Badge>

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
                                  Edit Organization
                                </DropdownMenuItem>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem
                                  onClick={() => {
                                    if (confirm(`Are you sure you want to delete "${org.name}"? This action cannot be undone.`)) {
                                      deleteOrgMutation.mutate(org.id);
                                    }
                                  }}
                                  className="text-destructive"
                                >
                                  <Trash2 className="mr-2 h-4 w-4" />
                                  Delete Organization
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="users" className="space-y-6">
              <Card className="border-muted-foreground/10">
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle>Users</CardTitle>
                    <CreateUserDialog />
                  </div>
                </CardHeader>
                <CardContent>
                  {usersLoading ? (
                    <p className="text-muted-foreground">Loading...</p>
                  ) : (
                    <div className="space-y-2">
                      {usersData?.users?.map((user: any) => (
                        <div
                          key={user.id}
                          className="flex items-center justify-between p-4 rounded-lg border border-muted-foreground/10 hover:bg-accent/50 transition-colors"
                        >
                          <div className="flex items-center gap-4">
                            <div className="h-10 w-10 rounded-full bg-gradient-to-br from-purple-500 to-pink-600 flex items-center justify-center text-white font-semibold">
                              {user.name?.[0]?.toUpperCase() || user.email[0].toUpperCase()}
                            </div>
                            <div>
                              <p className="font-medium">{user.name || user.email}</p>
                              <p className="text-sm text-muted-foreground">
                                {user.organizations?.length || 0} organizations
                              </p>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            {user.isSuperAdmin && (
                              <Badge variant="default" className="gap-1">
                                <Crown className="h-3 w-3" />
                                Super Admin
                              </Badge>
                            )}
                            <Badge variant="outline">{user.status}</Badge>

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
                                  Edit User
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="feature-flags" className="space-y-6">
              <Card className="border-muted-foreground/10">
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle>Feature Flags</CardTitle>
                    <CreateFeatureFlagDialog />
                  </div>
                </CardHeader>
                <CardContent>
                  {flagsLoading ? (
                    <div className="text-center py-8 text-muted-foreground">
                      Loading feature flags...
                    </div>
                  ) : !featureFlags || featureFlags.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground">
                      No feature flags found. Create one to get started.
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {featureFlags.map((flag: any) => (
                        <div
                          key={flag.id}
                          className="flex items-center justify-between p-4 border border-muted-foreground/10 rounded-lg hover:bg-muted/50 transition-colors"
                        >
                          <div className="flex items-center gap-4 flex-1">
                            <div className="h-10 w-10 rounded-lg bg-purple-500/10 flex items-center justify-center">
                              <Flag className="h-5 w-5 text-purple-600 dark:text-purple-400" />
                            </div>
                            <div className="flex-1">
                              <div className="flex items-center gap-2">
                                <p className="font-medium">{flag.name}</p>
                                <Badge
                                  variant={flag.isEnabled ? 'default' : 'secondary'}
                                  className={
                                    flag.isEnabled
                                      ? 'bg-green-500/10 text-green-700 dark:text-green-400 hover:bg-green-500/20'
                                      : ''
                                  }
                                >
                                  {flag.isEnabled ? (
                                    <div className="flex items-center gap-1">
                                      <ToggleRight className="h-3 w-3" />
                                      Enabled
                                    </div>
                                  ) : (
                                    <div className="flex items-center gap-1">
                                      <ToggleLeft className="h-3 w-3" />
                                      Disabled
                                    </div>
                                  )}
                                </Badge>
                              </div>
                              <div className="flex items-center gap-3 mt-1">
                                <p className="text-sm text-muted-foreground font-mono">
                                  {flag.key}
                                </p>
                                {flag.rolloutPercentage < 100 && (
                                  <Badge variant="outline" className="text-xs">
                                    {flag.rolloutPercentage}% rollout
                                  </Badge>
                                )}
                                {flag.enabledForPlans && flag.enabledForPlans.length > 0 && (
                                  <Badge variant="outline" className="text-xs">
                                    {flag.enabledForPlans.join(', ')}
                                  </Badge>
                                )}
                              </div>
                              {flag.description && (
                                <p className="text-sm text-muted-foreground mt-1">
                                  {flag.description}
                                </p>
                              )}
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="icon">
                                  <MoreVertical className="h-4 w-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                <DropdownMenuLabel>Actions</DropdownMenuLabel>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem onClick={() => setEditFlagId(flag.id)}>
                                  <Edit className="h-4 w-4 mr-2" />
                                  Edit Flag
                                </DropdownMenuItem>
                                <DropdownMenuItem
                                  onClick={async () => {
                                    if (
                                      confirm(
                                        `Are you sure you want to delete the feature flag "${flag.name}"?`
                                      )
                                    ) {
                                      try {
                                        await deleteFeatureFlag.mutateAsync(flag.id);
                                        toast({
                                          title: 'Feature flag deleted',
                                          description: `Feature flag "${flag.name}" has been deleted.`,
                                        });
                                      } catch (error: any) {
                                        toast({
                                          title: 'Error',
                                          description: error.message || 'Failed to delete feature flag',
                                          variant: 'destructive',
                                        });
                                      }
                                    }
                                  }}
                                  className="text-red-600"
                                >
                                  <Trash2 className="h-4 w-4 mr-2" />
                                  Delete Flag
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>
        </div>
      </div>
    </>
  );
}

