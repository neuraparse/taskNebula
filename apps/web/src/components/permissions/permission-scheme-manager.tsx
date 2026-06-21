'use client';

import { useEffect, useMemo, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { isApiPermissionError, throwApiResponseError } from '@/lib/client-api-errors';
import { Plus, Shield, Trash2, Edit, Star, Link2 } from 'lucide-react';

interface PermissionScheme {
  id: string;
  name: string;
  description: string | null;
  isDefault: boolean;
  permissions: Record<string, string[]>;
  createdAt: string;
  projectCount?: number;
}

interface ProjectSchemeState {
  assignedSchemeId: string | null;
  effectiveSchemeId: string | null;
  source: 'project' | 'organization-default' | 'none';
  scheme: Pick<PermissionScheme, 'id' | 'name' | 'description' | 'isDefault'> | null;
}

interface PermissionSchemeManagerProps {
  organizationId: string;
  projectId?: string;
}

const PROJECT_ROLES = [
  { value: 'product_owner', labelKey: 'pr_product_owner' },
  { value: 'scrum_master', labelKey: 'pr_scrum_master' },
  { value: 'tech_lead', labelKey: 'pr_tech_lead' },
  { value: 'developer', labelKey: 'pr_developer' },
  { value: 'qa_engineer', labelKey: 'pr_qa_engineer' },
  { value: 'designer', labelKey: 'pr_designer' },
  { value: 'viewer', labelKey: 'pr_viewer' },
];

const DEFAULT_SCHEME_VALUE = '__default__';

export function PermissionSchemeManager({
  organizationId,
  projectId,
}: PermissionSchemeManagerProps) {
  const [schemes, setSchemes] = useState<PermissionScheme[]>([]);
  const [loading, setLoading] = useState(true);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [selectedProjectScheme, setSelectedProjectScheme] = useState<string>(DEFAULT_SCHEME_VALUE);
  const [projectSchemeState, setProjectSchemeState] = useState<ProjectSchemeState | null>(null);
  const [newScheme, setNewScheme] = useState({ name: '', description: '', baseRole: '' });
  const [editingScheme, setEditingScheme] = useState<PermissionScheme | null>(null);
  const [editForm, setEditForm] = useState({ name: '', description: '', isDefault: false });
  const t = useTranslations('projectConfig');
  const tSettings = useTranslations('settings');
  const tActions = useTranslations('actions');
  const { toast } = useToast();

  const getErrorDescription = (error: unknown, fallback: string) =>
    isApiPermissionError(error) ? tSettings('error_no_permission') : fallback;

  useEffect(() => {
    void fetchSchemes();
  }, [organizationId, projectId]);

  async function fetchSchemes() {
    setLoading(true);

    try {
      const res = await fetch(`/api/permission-schemes?organizationId=${organizationId}`);
      if (!res.ok) {
        await throwApiResponseError(res);
      }

      const data = await res.json();
      setSchemes(data);

      if (projectId) {
        const projectSchemeRes = await fetch(`/api/projects/${projectId}/permission-scheme`);
        if (projectSchemeRes.ok) {
          const projectScheme = await projectSchemeRes.json();
          setProjectSchemeState(projectScheme);
          setSelectedProjectScheme(projectScheme.assignedSchemeId ?? DEFAULT_SCHEME_VALUE);
        }
      }
    } catch (error) {
      console.error('Error fetching schemes:', error);
      toast({
        title: t('psm_load_failed_title'),
        description: t('psm_load_failed_description'),
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  }

  async function createScheme() {
    try {
      const res = await fetch('/api/permission-schemes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          organizationId,
          name: newScheme.name,
          description: newScheme.description,
          baseRole: newScheme.baseRole || undefined,
        }),
      });

      if (!res.ok) {
        await throwApiResponseError(res);
      }

      toast({ title: t('psm_created_title'), description: t('psm_created_description') });
      setCreateDialogOpen(false);
      setNewScheme({ name: '', description: '', baseRole: '' });
      await fetchSchemes();
    } catch (error) {
      toast({
        title: t('psm_create_failed_title'),
        description: getErrorDescription(error, t('psm_create_failed')),
        variant: 'destructive',
      });
    }
  }

  async function updateScheme() {
    if (!editingScheme) {
      return;
    }

    try {
      const res = await fetch(`/api/permission-schemes/${editingScheme.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: editForm.name,
          description: editForm.description || null,
          isDefault: editForm.isDefault,
        }),
      });

      if (!res.ok) {
        await throwApiResponseError(res);
      }

      toast({ title: t('psm_updated_title'), description: t('psm_updated_description') });
      setEditDialogOpen(false);
      setEditingScheme(null);
      await fetchSchemes();
    } catch (error) {
      toast({
        title: t('psm_update_failed_title'),
        description: getErrorDescription(error, t('psm_update_failed')),
        variant: 'destructive',
      });
    }
  }

  async function setAsDefault(schemeId: string) {
    try {
      const res = await fetch(`/api/permission-schemes/${schemeId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isDefault: true }),
      });

      if (!res.ok) {
        await throwApiResponseError(res);
      }

      toast({
        title: t('psm_default_updated_title'),
        description: t('psm_default_updated_description'),
      });
      await fetchSchemes();
    } catch (error) {
      toast({
        title: t('psm_update_failed_title'),
        description: getErrorDescription(error, t('psm_update_failed')),
        variant: 'destructive',
      });
    }
  }

  async function assignSchemeToProject(value: string) {
    if (!projectId) {
      return;
    }

    setSelectedProjectScheme(value);

    try {
      const res = await fetch(`/api/projects/${projectId}/permission-scheme`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          schemeId: value === DEFAULT_SCHEME_VALUE ? null : value,
        }),
      });

      if (!res.ok) {
        await throwApiResponseError(res);
      }

      const nextState = await res.json();
      setProjectSchemeState(nextState);
      toast({
        title: t('psm_project_updated_title'),
        description:
          nextState.source === 'project'
            ? t('psm_project_uses_scheme', { name: nextState.scheme?.name ?? '' })
            : t('psm_project_follows_default'),
      });
      await fetchSchemes();
    } catch (error) {
      toast({
        title: t('psm_assign_failed_title'),
        description: getErrorDescription(error, t('psm_assign_failed')),
        variant: 'destructive',
      });
      await fetchSchemes();
    }
  }

  async function deleteScheme(schemeId: string) {
    if (!window.confirm(t('psm_delete_confirm'))) {
      return;
    }

    try {
      const res = await fetch(`/api/permission-schemes/${schemeId}`, { method: 'DELETE' });
      if (!res.ok) {
        await throwApiResponseError(res);
      }

      toast({ title: t('psm_deleted_title'), description: t('psm_deleted_description') });
      await fetchSchemes();
    } catch (error) {
      toast({
        title: t('psm_delete_failed_title'),
        description: getErrorDescription(error, t('psm_delete_failed')),
        variant: 'destructive',
      });
    }
  }

  function openEditDialog(scheme: PermissionScheme) {
    setEditingScheme(scheme);
    setEditForm({
      name: scheme.name,
      description: scheme.description || '',
      isDefault: scheme.isDefault,
    });
    setEditDialogOpen(true);
  }

  const assignedSchemeName = useMemo(() => {
    if (!projectSchemeState?.scheme) {
      return t('psm_no_scheme');
    }

    return projectSchemeState.scheme.name;
  }, [projectSchemeState, t]);

  if (loading) {
    return <div className="text-muted-foreground p-4 text-sm">{t('psm_loading')}</div>;
  }

  return (
    <div className="animate-fade-up space-y-6">
      {projectId ? (
        <div className="surface-card space-y-3 p-5">
          <div className="space-y-1">
            <span className="kicker">{t('psm_project_assignment')}</span>
            <p className="text-muted-foreground text-xs">{t('psm_project_assignment_help')}</p>
          </div>
          <div className="grid grid-cols-1 items-center gap-4 md:grid-cols-[240px_1fr]">
            <div className="space-y-1">
              <div className="text-sm font-medium">{assignedSchemeName}</div>
              <p className="text-muted-foreground text-xs">
                {projectSchemeState?.source === 'project'
                  ? t('psm_uses_explicit')
                  : t('psm_inherits_default')}
              </p>
            </div>
            <Select
              value={selectedProjectScheme}
              onValueChange={(value) => void assignSchemeToProject(value)}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={DEFAULT_SCHEME_VALUE}>{t('psm_use_org_default')}</SelectItem>
                {schemes.map((scheme) => (
                  <SelectItem key={scheme.id} value={scheme.id}>
                    {scheme.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      ) : null}

      <div className="flex items-center justify-between">
        <div className="space-y-1">
          <span className="kicker">{t('psm_schemes')}</span>
          <h3 className="text-foreground text-sm font-semibold tracking-tight">
            {t('psm_permission_schemes')}
          </h3>
          <p className="text-muted-foreground text-sm">{t('psm_schemes_help')}</p>
        </div>
        <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="mr-2 h-4 w-4" />
              {t('psm_create_scheme')}
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{t('psm_create_dialog_title')}</DialogTitle>
              <DialogDescription>{t('psm_create_dialog_description')}</DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label>{t('psm_name')}</Label>
                <Input
                  value={newScheme.name}
                  onChange={(event) =>
                    setNewScheme((current) => ({ ...current, name: event.target.value }))
                  }
                  placeholder={t('psm_name_placeholder')}
                />
              </div>
              <div className="space-y-2">
                <Label>{t('psm_description')}</Label>
                <Textarea
                  value={newScheme.description}
                  onChange={(event) =>
                    setNewScheme((current) => ({ ...current, description: event.target.value }))
                  }
                  placeholder={t('psm_description_placeholder')}
                />
              </div>
              <div className="space-y-2">
                <Label>{t('psm_base_role')}</Label>
                <Select
                  value={newScheme.baseRole}
                  onValueChange={(value) =>
                    setNewScheme((current) => ({ ...current, baseRole: value }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder={t('psm_base_role_placeholder')} />
                  </SelectTrigger>
                  <SelectContent>
                    {PROJECT_ROLES.map((role) => (
                      <SelectItem key={role.value} value={role.value}>
                        {t(role.labelKey)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setCreateDialogOpen(false)}>
                {tActions('cancel')}
              </Button>
              <Button onClick={() => void createScheme()} disabled={!newScheme.name.trim()}>
                {t('psm_create')}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {schemes.length === 0 ? (
        <div className="surface-card space-y-3 p-10 text-center">
          <Shield className="text-muted-foreground/40 mx-auto h-8 w-8" />
          <p className="text-muted-foreground text-sm">{t('psm_no_schemes')}</p>
          <Button size="sm" onClick={() => setCreateDialogOpen(true)}>
            <Plus className="mr-2 h-4 w-4" />
            {t('psm_create_first')}
          </Button>
        </div>
      ) : (
        <div className="stagger grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {schemes.map((scheme) => {
            const isAssignedToProject = projectSchemeState?.assignedSchemeId === scheme.id;
            const isEffectiveForProject = projectSchemeState?.effectiveSchemeId === scheme.id;

            return (
              <div
                key={scheme.id}
                className={`surface-card surface-card-hover space-y-3 p-5 ${
                  scheme.isDefault ? 'border-primary/30' : ''
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 space-y-1">
                    <div className="flex items-center gap-2">
                      <Shield className="text-primary h-4 w-4 shrink-0" />
                      <h4 className="truncate text-sm font-semibold">{scheme.name}</h4>
                    </div>
                    <p className="text-muted-foreground line-clamp-2 text-xs">
                      {scheme.description || t('psm_no_description')}
                    </p>
                  </div>
                  {scheme.isDefault ? (
                    <span className="chip shrink-0 gap-1">
                      <Star className="h-3 w-3" />
                      {t('psm_default_chip')}
                    </span>
                  ) : null}
                </div>

                <div className="flex flex-wrap gap-1.5">
                  <span className="chip">
                    {t('psm_groups_count', { count: Object.keys(scheme.permissions || {}).length })}
                  </span>
                  <span className="chip">
                    {t('psm_projects_count', { count: scheme.projectCount || 0 })}
                  </span>
                  {isAssignedToProject ? (
                    <span className="chip-accent">{t('psm_assigned_here')}</span>
                  ) : null}
                  {!isAssignedToProject && isEffectiveForProject ? (
                    <span className="chip">{t('psm_inherited_here')}</span>
                  ) : null}
                </div>

                <div className="border-border/60 flex items-center justify-between gap-2 border-t pt-3">
                  <div className="text-muted-foreground text-xs">
                    {isEffectiveForProject ? (
                      <span className="inline-flex items-center gap-1">
                        <Link2 className="h-3 w-3" />
                        {t('psm_active_here')}
                      </span>
                    ) : (
                      t('psm_reusable_org_wide')
                    )}
                  </div>
                  <div className="flex items-center gap-1">
                    {!scheme.isDefault ? (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7"
                        onClick={() => void setAsDefault(scheme.id)}
                        aria-label={t('psm_set_as_default')}
                      >
                        <Star className="h-3.5 w-3.5" />
                      </Button>
                    ) : null}
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7"
                      onClick={() => openEditDialog(scheme)}
                      aria-label={t('psm_edit_scheme')}
                    >
                      <Edit className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="text-destructive hover:text-destructive h-7 w-7"
                      onClick={() => void deleteScheme(scheme.id)}
                      aria-label={t('psm_delete_scheme')}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('psm_edit_dialog_title')}</DialogTitle>
            <DialogDescription>{t('psm_edit_dialog_description')}</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>{t('psm_name')}</Label>
              <Input
                value={editForm.name}
                onChange={(event) =>
                  setEditForm((current) => ({ ...current, name: event.target.value }))
                }
                placeholder={t('psm_name_placeholder')}
              />
            </div>
            <div className="space-y-2">
              <Label>{t('psm_description')}</Label>
              <Textarea
                value={editForm.description}
                onChange={(event) =>
                  setEditForm((current) => ({ ...current, description: event.target.value }))
                }
                placeholder={t('psm_description_placeholder')}
              />
            </div>
            <div className="space-y-2">
              <Label>{t('psm_default_behavior')}</Label>
              <Select
                value={editForm.isDefault ? 'default' : 'standard'}
                onValueChange={(value) =>
                  setEditForm((current) => ({ ...current, isDefault: value === 'default' }))
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="standard">{t('psm_keep_regular')}</SelectItem>
                  <SelectItem value="default">{t('psm_make_org_default')}</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditDialogOpen(false)}>
              {tActions('cancel')}
            </Button>
            <Button onClick={() => void updateScheme()} disabled={!editForm.name.trim()}>
              {t('save_changes')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
