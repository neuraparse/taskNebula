'use client';

import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useRouter, useSearchParams } from 'next/navigation';
import { Button } from '@/components/ui/button';
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
import { cn } from '@/lib/utils';

type Organization = {
  id: string;
  name: string;
  slug: string;
  domain: string | null;
  logoUrl: string | null;
  plan: 'free' | 'starter' | 'growth' | 'enterprise';
  status: 'active' | 'trial' | 'suspended';
  settings: Record<string, unknown>;
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

const EMPTY_FORM = { name: '', slug: '', domain: '', logoUrl: '' };

const orgTabTriggerClass =
  'rounded-md border border-transparent px-3 py-1.5 text-sm text-muted-foreground transition-colors hover:bg-accent/50 hover:text-foreground data-[state=active]:border-border data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-xs';

const statusChipClass: Record<string, string> = {
  active: 'bg-accent-emerald/10 text-accent-emerald border border-accent-emerald/20',
  trial: 'bg-accent-amber/10 text-accent-amber border border-accent-amber/20',
  suspended: 'bg-destructive/10 text-destructive border border-destructive/20',
};

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
      const payload = await response
        .json()
        .catch(() => ({ error: 'Failed to fetch organization' }));
      if (!response.ok) throw new Error(payload.error || 'Failed to fetch organization');
      return payload;
    },
    enabled: !!currentOrganizationId,
  });

  useEffect(() => {
    if (!org) return;
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
      const payload = await response
        .json()
        .catch(() => ({ error: 'Failed to update organization' }));
      if (!response.ok) throw new Error(payload.error || 'Failed to update organization');
      return payload;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['organization', currentOrganizationId] });
      queryClient.invalidateQueries({ queryKey: ['organizations'] });
      toast({ title: 'Organization updated', description: 'Changes were saved successfully.' });
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
      const payload = await response
        .json()
        .catch(() => ({ error: 'Failed to delete organization' }));
      if (!response.ok) throw new Error(payload.error || 'Failed to delete organization');
      return payload;
    },
    onSuccess: () => {
      clearContext();
      queryClient.invalidateQueries({ queryKey: ['organization', currentOrganizationId] });
      queryClient.invalidateQueries({ queryKey: ['organizations'] });
      queryClient.invalidateQueries({
        queryKey: ['organization-members', currentOrganizationId],
      });
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
      <div className="surface-card p-6 text-sm text-muted-foreground">
        Select an organization to load settings.
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="flex min-h-[320px] items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error || !org) {
    return (
      <div className="surface-card p-6 text-sm text-destructive">
        {error instanceof Error ? error.message : 'Failed to load organization settings.'}
      </div>
    );
  }

  const canManageSettings =
    org.userRole === 'owner' || org.userRole === 'admin' || org.isSuperAdmin;
  const canDeleteOrg = org.userRole === 'owner' || org.isSuperAdmin;
  const deleteBlocked = deleteConfirmationName.trim() !== org.name;

  return (
    <>
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete organization</DialogTitle>
            <DialogDescription>
              This removes projects, issues, docs, keys, and memberships. Type{' '}
              <span className="font-semibold text-foreground">{org.name}</span> to confirm.
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

      <div className="animate-fade-in space-y-6">
        {/* Header */}
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg border border-border bg-card">
              <Building2 className="h-4 w-4 text-muted-foreground" />
            </div>
            <div>
              <h1 className="text-xl font-semibold tracking-tight">{org.name}</h1>
              <p className="text-xs text-muted-foreground">
                Workspace settings, access, and shared service configuration.
              </p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="chip capitalize">{org.plan}</span>
            <span
              className={cn(
                'rounded-full px-2.5 py-0.5 text-[11px] font-medium border capitalize',
                statusChipClass[org.status] ?? statusChipClass.active
              )}
            >
              {org.status}
            </span>
            <span className="chip capitalize">{org.userRole || 'member'}</span>
            {org.isSuperAdmin && <span className="chip-accent">Super admin</span>}
          </div>
        </div>

        {/* Stat tiles */}
        <div className="stagger grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {[
            { label: 'Members', value: org.stats?.members || 0, icon: Users },
            { label: 'Projects', value: org.stats?.projects || 0, icon: Layers3 },
            { label: 'Teamspaces', value: org.stats?.teams || 0, icon: Shield },
            { label: 'API Keys', value: org.stats?.apiKeys || 0, icon: KeyRound },
          ].map(({ label, value, icon: Icon }) => (
            <div key={label} className="surface-card flex items-center justify-between p-4">
              <div>
                <p className="kicker">{label}</p>
                <p className="mt-1 text-2xl font-semibold">{value}</p>
              </div>
              <Icon className="h-4 w-4 text-muted-foreground" />
            </div>
          ))}
        </div>

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
          <TabsList className="h-auto w-full justify-start gap-1 rounded-lg border border-border bg-card/40 p-1">
            <TabsTrigger value="general" className={orgTabTriggerClass}>
              General
            </TabsTrigger>
            <TabsTrigger value="teamspaces" className={orgTabTriggerClass}>
              Teamspaces
            </TabsTrigger>
            <TabsTrigger value="danger" className={orgTabTriggerClass}>
              Danger zone
            </TabsTrigger>
          </TabsList>

          <TabsContent value="general" className="space-y-0">
            <div className="surface-card p-6 space-y-5">
              <div className="space-y-1">
                <span className="kicker">Details</span>
                <h2 className="text-lg font-semibold">Workspace details</h2>
                <p className="text-sm text-muted-foreground">
                  Name, domain, and brand information used across the workspace.
                </p>
              </div>

              {!canManageSettings ? (
                <div className="rounded-lg border border-warning/30 bg-warning/5 px-4 py-3 text-sm text-muted-foreground">
                  Only owners and admins can update organization settings.
                </div>
              ) : null}

              <div className="grid gap-5 lg:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="org-name">Organization name</Label>
                  <Input
                    id="org-name"
                    value={formData.name}
                    onChange={(event) =>
                      setFormData((current) => ({ ...current, name: event.target.value }))
                    }
                    disabled={!canManageSettings}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="org-slug">Workspace slug</Label>
                  <Input id="org-slug" value={formData.slug} disabled />
                  <p className="text-xs text-muted-foreground">
                    Used in URLs. Super admins can change it from the Admin panel.
                  </p>
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
                      onChange={(event) =>
                        setFormData((current) => ({ ...current, domain: event.target.value }))
                      }
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
                    onChange={(event) =>
                      setFormData((current) => ({ ...current, logoUrl: event.target.value }))
                    }
                    disabled={!canManageSettings}
                  />
                </div>
              </div>

              <div className="grid gap-5 lg:grid-cols-2 text-sm text-muted-foreground">
                <div className="space-y-1">
                  <Label className="text-muted-foreground">Created</Label>
                  <p>{new Date(org.createdAt).toLocaleString()}</p>
                </div>
                <div className="space-y-1">
                  <Label className="text-muted-foreground">Last updated</Label>
                  <p>{new Date(org.updatedAt).toLocaleString()}</p>
                </div>
              </div>

              <div className="flex justify-end">
                <Button
                  onClick={() => updateOrgMutation.mutate()}
                  disabled={
                    !canManageSettings || !formData.name.trim() || updateOrgMutation.isPending
                  }
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
            </div>
          </TabsContent>

          <TabsContent value="teamspaces">
            <TeamspaceManager
              organizationId={currentOrganizationId}
              canManage={canManageSettings}
            />
          </TabsContent>

          <TabsContent value="danger">
            <div className="surface-card border-destructive/30 p-6">
              <div className="space-y-1 pb-4">
                <div className="flex items-center gap-2 text-destructive">
                  <AlertTriangle className="h-4 w-4" />
                  <h2 className="font-semibold">Delete organization</h2>
                </div>
                <p className="text-sm text-muted-foreground">
                  Permanently removes this workspace and every project, issue, document, webhook,
                  and member under it.
                </p>
              </div>
              <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
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
              </div>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </>
  );
}
