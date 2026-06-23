'use client';

import { useEffect, useState } from 'react';
import { useFormatter, useTranslations } from 'next-intl';
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
  const t = useTranslations('settingsClients');
  const formatter = useFormatter();
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

  const {
    data: org,
    isLoading,
    error,
  } = useQuery<Organization>({
    queryKey: ['organization', currentOrganizationId],
    queryFn: async () => {
      const response = await fetch(`/api/organizations/${currentOrganizationId}`);
      const payload = await response.json().catch(() => ({ error: t('org.fetchFailed') }));
      if (!response.ok) throw new Error(payload.error || t('org.fetchFailed'));
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
      const payload = await response.json().catch(() => ({ error: t('org.updateFailed') }));
      if (!response.ok) throw new Error(payload.error || t('org.updateFailed'));
      return payload;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['organization', currentOrganizationId] });
      queryClient.invalidateQueries({ queryKey: ['organizations'] });
      toast({ title: t('org.updated'), description: t('org.updatedDesc') });
    },
    onError: (mutationError: Error) => {
      toast({
        title: t('org.updateFailed'),
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
      const payload = await response.json().catch(() => ({ error: t('org.deleteFailed') }));
      if (!response.ok) throw new Error(payload.error || t('org.deleteFailed'));
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
        title: t('org.deleted'),
        description: t('org.deletedDesc'),
      });
      setDeleteDialogOpen(false);
      setDeleteConfirmationName('');
      router.push('/');
    },
    onError: (mutationError: Error) => {
      toast({
        title: t('org.deleteFailed'),
        description: mutationError.message,
        variant: 'destructive',
      });
    },
  });

  if (!currentOrganizationId) {
    return (
      <div className="surface-card text-muted-foreground rounded-lg p-6 text-sm">
        {t('org.selectOrg')}
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="flex min-h-[320px] items-center justify-center">
        <Loader2 className="text-muted-foreground h-6 w-6 animate-spin" />
      </div>
    );
  }

  if (error || !org) {
    return (
      <div className="panel-danger animate-alert-in text-sm">
        {error instanceof Error ? error.message : t('org.loadFailed')}
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
            <DialogTitle>{t('org.deleteTitle')}</DialogTitle>
            <DialogDescription>
              {t.rich('org.deleteConfirmPrompt', {
                name: org.name,
                strong: (chunks) => <span className="text-foreground font-semibold">{chunks}</span>,
              })}
            </DialogDescription>
          </DialogHeader>
          <div className="panel-danger animate-alert-in text-sm">{t('org.deleteWarning')}</div>
          <div className="space-y-3">
            <Label htmlFor="delete-org-name">{t('org.orgName')}</Label>
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
              {t('common.cancel')}
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
                  {t('org.deleting')}
                </>
              ) : (
                t('org.deleteTitle')
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <div className="animate-fade-up space-y-8">
        {/* Header */}
        <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
          <div className="flex items-start gap-3">
            {org.logoUrl ? (
              <div
                className="border-border h-12 w-12 shrink-0 rounded-md border bg-cover bg-center"
                style={{ backgroundImage: `url(${org.logoUrl})` }}
                aria-hidden
              />
            ) : (
              <div className="border-border bg-card flex h-12 w-12 shrink-0 items-center justify-center rounded-md border">
                <Building2 className="text-muted-foreground h-5 w-5" />
              </div>
            )}
            <div className="space-y-1">
              <span className="kicker">{t('org.workspaceKicker')}</span>
              <h1 className="text-lg font-semibold tracking-tight">{org.name}</h1>
              <p className="text-muted-foreground max-w-prose text-sm">
                {t('org.workspaceSubtitle')}
              </p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="chip">{t(`org.plan.${org.plan}`)}</span>
            <span
              className={cn(
                'rounded-full border px-2.5 py-0.5 text-[11px] font-medium',
                statusChipClass[org.status] ?? statusChipClass.active
              )}
            >
              {t(`org.statusLabel.${org.status}`)}
            </span>
            <span className="chip">{t(`org.role.${org.userRole || 'member'}`)}</span>
            {org.isSuperAdmin && <span className="chip-accent">{t('org.superAdmin')}</span>}
          </div>
        </div>

        {/* Stat summary — minimal text row */}
        <div className="text-muted-foreground flex flex-wrap gap-x-6 gap-y-2 text-sm">
          {[
            { key: 'members', value: org.stats?.members || 0, icon: Users },
            { key: 'projects', value: org.stats?.projects || 0, icon: Layers3 },
            { key: 'teamspaces', value: org.stats?.teams || 0, icon: Shield },
            { key: 'apiKeys', value: org.stats?.apiKeys || 0, icon: KeyRound },
          ].map(({ key, value, icon: Icon }) => (
            <span key={key} className="inline-flex items-center gap-1.5">
              <Icon className="h-3.5 w-3.5" />
              <span className="text-foreground font-medium">{value}</span>
              {t(`org.stat.${key}`)}
            </span>
          ))}
        </div>

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <TabsList className="border-border bg-card/40 h-auto w-full justify-start gap-1 rounded-lg border p-1">
            <TabsTrigger value="general" className={orgTabTriggerClass}>
              {t('org.tabGeneral')}
            </TabsTrigger>
            <TabsTrigger value="teamspaces" className={orgTabTriggerClass}>
              {t('org.tabTeamspaces')}
            </TabsTrigger>
            <TabsTrigger value="danger" className={orgTabTriggerClass}>
              {t('org.tabDanger')}
            </TabsTrigger>
          </TabsList>

          <TabsContent value="general" className="space-y-8">
            <section className="space-y-4">
              <div className="space-y-1">
                <span className="kicker">{t('org.detailsKicker')}</span>
                <h2 className="text-lg font-semibold tracking-tight">{t('org.detailsHeading')}</h2>
                <p className="text-muted-foreground max-w-prose text-sm">
                  {t('org.detailsSubtitle')}
                </p>
              </div>

              {!canManageSettings ? (
                <div className="panel-warn text-sm">{t('org.manageRestricted')}</div>
              ) : null}

              <div className="surface-card space-y-6 rounded-lg p-6">
                {/* Logo preview tile + URL */}
                <div className="grid grid-cols-1 items-start gap-4 md:grid-cols-[240px_1fr]">
                  <Label htmlFor="org-logo-url" className="text-sm font-medium">
                    {t('org.logo')}
                  </Label>
                  <div className="flex items-start gap-3">
                    <div
                      className="border-border bg-muted h-16 w-16 shrink-0 rounded-md border bg-cover bg-center"
                      style={
                        formData.logoUrl
                          ? { backgroundImage: `url(${formData.logoUrl})` }
                          : undefined
                      }
                      aria-hidden
                    >
                      {!formData.logoUrl && (
                        <div className="flex h-full w-full items-center justify-center">
                          <Building2 className="text-muted-foreground h-5 w-5" />
                        </div>
                      )}
                    </div>
                    <Input
                      id="org-logo-url"
                      placeholder="https://cdn.example.com/logo.png"
                      value={formData.logoUrl}
                      onChange={(event) =>
                        setFormData((current) => ({ ...current, logoUrl: event.target.value }))
                      }
                      disabled={!canManageSettings}
                      className="ease-snap transition-all duration-150"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 items-start gap-4 md:grid-cols-[240px_1fr]">
                  <Label htmlFor="org-name" className="text-sm font-medium">
                    {t('org.orgName')}
                  </Label>
                  <Input
                    id="org-name"
                    value={formData.name}
                    onChange={(event) =>
                      setFormData((current) => ({ ...current, name: event.target.value }))
                    }
                    disabled={!canManageSettings}
                    className="ease-snap transition-all duration-150"
                  />
                </div>

                <div className="grid grid-cols-1 items-start gap-4 md:grid-cols-[240px_1fr]">
                  <div className="space-y-1">
                    <Label htmlFor="org-slug" className="text-sm font-medium">
                      {t('org.slug')}
                    </Label>
                    <p className="text-muted-foreground text-xs">{t('org.slugHint')}</p>
                  </div>
                  <Input id="org-slug" value={formData.slug} disabled />
                </div>

                <div className="grid grid-cols-1 items-start gap-4 md:grid-cols-[240px_1fr]">
                  <div className="space-y-1">
                    <Label htmlFor="org-domain" className="text-sm font-medium">
                      {t('org.verifiedDomain')}
                    </Label>
                    <p className="text-muted-foreground text-xs">{t('org.verifiedDomainHint')}</p>
                  </div>
                  <div className="relative">
                    <Globe className="text-muted-foreground pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2" />
                    <Input
                      id="org-domain"
                      className="ease-snap pl-9 transition-all duration-150"
                      placeholder="company.com"
                      value={formData.domain}
                      onChange={(event) =>
                        setFormData((current) => ({ ...current, domain: event.target.value }))
                      }
                      disabled={!canManageSettings}
                    />
                  </div>
                </div>

                <div className="border-border flex items-center justify-between border-t pt-4">
                  <p className="text-muted-foreground text-xs">
                    {t('org.updatedAt', {
                      date: formatter.dateTime(new Date(org.updatedAt), {
                        dateStyle: 'medium',
                        timeStyle: 'short',
                      }),
                    })}
                  </p>
                  <Button
                    onClick={() => updateOrgMutation.mutate()}
                    disabled={
                      !canManageSettings || !formData.name.trim() || updateOrgMutation.isPending
                    }
                  >
                    {updateOrgMutation.isPending ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        {t('org.saving')}
                      </>
                    ) : (
                      <>
                        <Save className="mr-2 h-4 w-4" />
                        {t('org.saveChanges')}
                      </>
                    )}
                  </Button>
                </div>
              </div>
            </section>
          </TabsContent>

          <TabsContent value="teamspaces">
            <TeamspaceManager
              organizationId={currentOrganizationId}
              canManage={canManageSettings}
            />
          </TabsContent>

          <TabsContent value="danger">
            <section className="animate-fade-up space-y-4">
              <div className="space-y-1">
                <span className="kicker text-destructive">{t('org.dangerKicker')}</span>
                <h2 className="flex items-center gap-2 text-lg font-semibold tracking-tight">
                  <AlertTriangle className="text-destructive h-4 w-4" />
                  {t('org.deleteTitle')}
                </h2>
                <p className="text-muted-foreground max-w-prose text-sm">
                  {t('org.dangerSubtitle')}
                </p>
              </div>
              <div className="panel-danger animate-alert-in flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                <p className="text-sm">{t('org.cannotRestore')}</p>
                <Button
                  variant="destructive"
                  disabled={!canDeleteOrg}
                  onClick={() => setDeleteDialogOpen(true)}
                >
                  {canDeleteOrg ? t('org.deleteTitle') : t('org.ownerOnly')}
                </Button>
              </div>
            </section>
          </TabsContent>
        </Tabs>
      </div>
    </>
  );
}
