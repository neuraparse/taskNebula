'use client';

import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useRouter, useSearchParams } from 'next/navigation';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/hooks/use-toast';
import { useOrganization } from '@/lib/hooks/use-organization';
import { TeamspaceManager } from '@/components/organization/teamspace-manager';
import {
  AlertTriangle,
  Building2,
  Globe,
  KeyRound,
  Layers3,
  Loader2,
  Save,
  Shield,
  Users,
} from 'lucide-react';

type Organization = {
  id: string;
  name: string;
  slug: string;
  domain: string | null;
  logoUrl: string | null;
  plan: 'free' | 'starter' | 'growth' | 'enterprise';
  status: 'active' | 'trial' | 'suspended';
  settings: Record<string, any>;
  createdAt: string;
  updatedAt: string;
  userRole: 'owner' | 'admin' | 'member' | 'viewer' | 'guest' | null;
  isSuperAdmin: boolean;
  stats?: {
    members: number;
    projects: number;
    teams: number;
    apiKeys: number;
  };
};

const EMPTY_FORM = {
  name: '',
  slug: '',
  domain: '',
  logoUrl: '',
};

const organizationTabsListClassName =
  'h-auto w-full flex-wrap justify-start gap-2 rounded-xl border border-border/70 bg-card/40 p-1';

const organizationTabTriggerClassName =
  'rounded-lg border border-transparent px-3.5 py-2 text-sm text-muted-foreground transition-colors hover:bg-muted/50 hover:text-foreground data-[state=active]:border-border data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-sm';

export function OrganizationSettingsClient() {
  const { currentOrganizationId, clearContext } = useOrganization();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const router = useRouter();
  const searchParams = useSearchParams();
  const requestedTab = searchParams.get('tab');

  const [formData, setFormData] = useState(EMPTY_FORM);
  const [activeTab, setActiveTab] = useState(
    requestedTab === 'teamspaces' || requestedTab === 'danger' ? requestedTab : 'general'
  );
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deleteConfirmationName, setDeleteConfirmationName] = useState('');

  const { data: org, isLoading, error } = useQuery<Organization>({
    queryKey: ['organization', currentOrganizationId],
    queryFn: async () => {
      const response = await fetch(`/api/organizations/${currentOrganizationId}`);
      const payload = await response.json().catch(() => ({ error: 'Failed to fetch organization' }));
      if (!response.ok) {
        throw new Error(payload.error || 'Failed to fetch organization');
      }
      return payload;
    },
    enabled: !!currentOrganizationId,
  });

  useEffect(() => {
    if (!org) {
      return;
    }

    setFormData({
      name: org.name || '',
      slug: org.slug || '',
      domain: org.domain || '',
      logoUrl: org.logoUrl || '',
    });
  }, [org]);

  useEffect(() => {
    if (requestedTab === 'teamspaces' || requestedTab === 'danger' || requestedTab === 'general') {
      setActiveTab(requestedTab);
    }
  }, [requestedTab]);

  const updateOrgMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch(`/api/organizations/${currentOrganizationId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: formData.name.trim(),
          domain: formData.domain.trim() || undefined,
          logoUrl: formData.logoUrl.trim(),
        }),
      });

      const payload = await response.json().catch(() => ({ error: 'Failed to update organization' }));
      if (!response.ok) {
        throw new Error(payload.error || 'Failed to update organization');
      }

      return payload;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['organization', currentOrganizationId] });
      queryClient.invalidateQueries({ queryKey: ['organizations'] });
      toast({
        title: 'Organization updated',
        description: 'Changes were saved successfully.',
      });
    },
    onError: (mutationError: Error) => {
      toast({
        title: 'Failed to update organization',
        description: mutationError.message,
        variant: 'destructive',
      });
    },
  });

  const deleteOrgMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch(`/api/organizations/${currentOrganizationId}`, {
        method: 'DELETE',
      });

      const payload = await response.json().catch(() => ({ error: 'Failed to delete organization' }));
      if (!response.ok) {
        throw new Error(payload.error || 'Failed to delete organization');
      }

      return payload;
    },
    onSuccess: () => {
      clearContext();
      queryClient.invalidateQueries({ queryKey: ['organization', currentOrganizationId] });
      queryClient.invalidateQueries({ queryKey: ['organizations'] });
      queryClient.invalidateQueries({ queryKey: ['organization-members', currentOrganizationId] });
      queryClient.invalidateQueries({ queryKey: ['projects'] });
      toast({
        title: 'Organization deleted',
        description: 'The organization and related data were removed.',
      });
      setDeleteDialogOpen(false);
      setDeleteConfirmationName('');
      router.push('/');
    },
    onError: (mutationError: Error) => {
      toast({
        title: 'Failed to delete organization',
        description: mutationError.message,
        variant: 'destructive',
      });
    },
  });

  if (!currentOrganizationId) {
    return (
      <Card>
        <CardContent className="py-10 text-sm text-muted-foreground">
          Select an organization to load settings.
        </CardContent>
      </Card>
    );
  }

  if (isLoading) {
    return (
      <div className="flex min-h-[320px] items-center justify-center">
        <Loader2 className="h-7 w-7 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error || !org) {
    return (
      <Card>
        <CardContent className="py-10 text-sm text-destructive">
          {error instanceof Error ? error.message : 'Failed to load organization settings.'}
        </CardContent>
      </Card>
    );
  }

  const canManageSettings = org.userRole === 'owner' || org.userRole === 'admin' || org.isSuperAdmin;
  const canDeleteOrg = org.userRole === 'owner' || org.isSuperAdmin;
  const deleteBlocked = deleteConfirmationName.trim() !== org.name;

  return (
    <>
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete organization</DialogTitle>
            <DialogDescription>
              This removes projects, issues, docs, keys, and memberships. Type <span className="font-semibold text-foreground">{org.name}</span> to confirm.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <Label htmlFor="delete-org-name">Organization name</Label>
            <Input
              id="delete-org-name"
              value={deleteConfirmationName}
              onChange={(event) => setDeleteConfirmationName(event.target.value)}
              placeholder={org.name}
            />
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setDeleteDialogOpen(false);
                setDeleteConfirmationName('');
              }}
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="destructive"
              onClick={() => deleteOrgMutation.mutate()}
              disabled={deleteBlocked || deleteOrgMutation.isPending}
            >
              {deleteOrgMutation.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Deleting
                </>
              ) : (
                'Delete organization'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <div className="space-y-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="space-y-2">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg border bg-card">
                <Building2 className="h-5 w-5 text-muted-foreground" />
              </div>
              <div>
                <h1 className="text-2xl font-semibold tracking-tight">{org.name}</h1>
                <p className="text-sm text-muted-foreground">Workspace settings, access, and shared service configuration.</p>
              </div>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="outline">{org.plan}</Badge>
            <Badge variant={org.status === 'active' ? 'default' : org.status === 'trial' ? 'secondary' : 'destructive'}>
              {org.status}
            </Badge>
            <Badge variant="outline">{org.userRole || 'member'}</Badge>
            {org.isSuperAdmin ? <Badge>Super admin</Badge> : null}
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <Card>
            <CardContent className="flex items-center justify-between p-4">
              <div>
                <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">Members</p>
                <p className="mt-1 text-2xl font-semibold">{org.stats?.members || 0}</p>
              </div>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardContent>
          </Card>
          <Card>
            <CardContent className="flex items-center justify-between p-4">
              <div>
                <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">Projects</p>
                <p className="mt-1 text-2xl font-semibold">{org.stats?.projects || 0}</p>
              </div>
              <Layers3 className="h-4 w-4 text-muted-foreground" />
            </CardContent>
          </Card>
          <Card>
            <CardContent className="flex items-center justify-between p-4">
              <div>
                <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">Teamspaces</p>
                <p className="mt-1 text-2xl font-semibold">{org.stats?.teams || 0}</p>
              </div>
              <Shield className="h-4 w-4 text-muted-foreground" />
            </CardContent>
          </Card>
          <Card>
            <CardContent className="flex items-center justify-between p-4">
              <div>
                <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">API Keys</p>
                <p className="mt-1 text-2xl font-semibold">{org.stats?.apiKeys || 0}</p>
              </div>
              <KeyRound className="h-4 w-4 text-muted-foreground" />
            </CardContent>
          </Card>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
          <TabsList className={organizationTabsListClassName}>
            <TabsTrigger value="general" className={organizationTabTriggerClassName}>
              General
            </TabsTrigger>
            <TabsTrigger value="teamspaces" className={organizationTabTriggerClassName}>
              Teamspaces
            </TabsTrigger>
            <TabsTrigger value="danger" className={organizationTabTriggerClassName}>
              Danger zone
            </TabsTrigger>
          </TabsList>

          <TabsContent value="general" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Workspace details</CardTitle>
                <CardDescription>Name, domain, and brand information used across the workspace.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-5">
                {!canManageSettings ? (
                  <div className="rounded-lg border border-yellow-500/30 bg-yellow-500/10 px-4 py-3 text-sm text-yellow-700 dark:text-yellow-200">
                    Only owners and admins can update organization settings.
                  </div>
                ) : null}

                <div className="grid gap-5 lg:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="org-name">Organization name</Label>
                    <Input
                      id="org-name"
                      value={formData.name}
                      onChange={(event) => setFormData((current) => ({ ...current, name: event.target.value }))}
                      disabled={!canManageSettings}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="org-slug">Workspace slug</Label>
                    <Input
                      id="org-slug"
                      value={formData.slug}
                      disabled
                    />
                    <p className="text-xs text-muted-foreground">Used in URLs. Super admins can change it from the Admin panel.</p>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="org-domain">Verified domain</Label>
                    <div className="relative">
                      <Globe className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                      <Input
                        id="org-domain"
                        className="pl-9"
                        placeholder="company.com"
                        value={formData.domain}
                        onChange={(event) => setFormData((current) => ({ ...current, domain: event.target.value }))}
                        disabled={!canManageSettings}
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="org-logo-url">Logo URL</Label>
                    <Input
                      id="org-logo-url"
                      placeholder="https://cdn.example.com/logo.png"
                      value={formData.logoUrl}
                      onChange={(event) => setFormData((current) => ({ ...current, logoUrl: event.target.value }))}
                      disabled={!canManageSettings}
                    />
                  </div>
                </div>

                <div className="grid gap-5 lg:grid-cols-2">
                  <div className="space-y-2">
                    <Label>Created</Label>
                    <p className="text-sm text-muted-foreground">
                      {new Date(org.createdAt).toLocaleString()}
                    </p>
                  </div>
                  <div className="space-y-2">
                    <Label>Last updated</Label>
                    <p className="text-sm text-muted-foreground">
                      {new Date(org.updatedAt).toLocaleString()}
                    </p>
                  </div>
                </div>

                <div className="flex justify-end">
                  <Button
                    onClick={() => updateOrgMutation.mutate()}
                    disabled={!canManageSettings || !formData.name.trim() || updateOrgMutation.isPending}
                  >
                    {updateOrgMutation.isPending ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Saving
                      </>
                    ) : (
                      <>
                        <Save className="mr-2 h-4 w-4" />
                        Save changes
                      </>
                    )}
                  </Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="teamspaces" className="space-y-4">
            <TeamspaceManager
              organizationId={currentOrganizationId}
              canManage={canManageSettings}
            />
          </TabsContent>

          <TabsContent value="danger" className="space-y-4">
            <Card className="border-destructive/30">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-destructive">
                  <AlertTriangle className="h-4 w-4" />
                  Delete organization
                </CardTitle>
                <CardDescription>
                  Permanently removes this workspace and every project, issue, document, webhook, and member under it.
                </CardDescription>
              </CardHeader>
              <CardContent className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                <div className="space-y-1 text-sm text-muted-foreground">
                  <p>Owner access is required for this action.</p>
                  <p>Deleted organizations cannot be restored.</p>
                </div>
                <Button
                  variant="destructive"
                  disabled={!canDeleteOrg}
                  onClick={() => setDeleteDialogOpen(true)}
                >
                  {canDeleteOrg ? 'Delete organization' : 'Owner only'}
                </Button>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </>
  );
}
