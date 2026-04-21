'use client';

import { useEffect, useMemo, useState } from 'react';
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
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
  { value: 'product_owner', label: 'Product Owner' },
  { value: 'scrum_master', label: 'Scrum Master' },
  { value: 'tech_lead', label: 'Tech Lead' },
  { value: 'developer', label: 'Developer' },
  { value: 'qa_engineer', label: 'QA Engineer' },
  { value: 'designer', label: 'Designer' },
  { value: 'viewer', label: 'Viewer' },
];

const DEFAULT_SCHEME_VALUE = '__default__';

export function PermissionSchemeManager({ organizationId, projectId }: PermissionSchemeManagerProps) {
  const [schemes, setSchemes] = useState<PermissionScheme[]>([]);
  const [loading, setLoading] = useState(true);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [selectedProjectScheme, setSelectedProjectScheme] = useState<string>(DEFAULT_SCHEME_VALUE);
  const [projectSchemeState, setProjectSchemeState] = useState<ProjectSchemeState | null>(null);
  const [newScheme, setNewScheme] = useState({ name: '', description: '', baseRole: '' });
  const [editingScheme, setEditingScheme] = useState<PermissionScheme | null>(null);
  const [editForm, setEditForm] = useState({ name: '', description: '', isDefault: false });
  const { toast } = useToast();

  useEffect(() => {
    void fetchSchemes();
  }, [organizationId, projectId]);

  async function fetchSchemes() {
    setLoading(true);

    try {
      const res = await fetch(`/api/permission-schemes?organizationId=${organizationId}`);
      if (!res.ok) {
        throw new Error('Failed to fetch permission schemes');
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
        title: 'Load failed',
        description: 'Permission schemes could not be loaded.',
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
        const error = await res.json().catch(() => ({ error: 'Failed to create scheme' }));
        throw new Error(error.error || 'Failed to create scheme');
      }

      toast({ title: 'Permission scheme created', description: 'The new scheme is ready to assign.' });
      setCreateDialogOpen(false);
      setNewScheme({ name: '', description: '', baseRole: '' });
      await fetchSchemes();
    } catch (error) {
      toast({
        title: 'Create failed',
        description: error instanceof Error ? error.message : 'Failed to create scheme',
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
        const error = await res.json().catch(() => ({ error: 'Failed to update scheme' }));
        throw new Error(error.error || 'Failed to update scheme');
      }

      toast({ title: 'Scheme updated', description: 'Permission scheme changes were saved.' });
      setEditDialogOpen(false);
      setEditingScheme(null);
      await fetchSchemes();
    } catch (error) {
      toast({
        title: 'Update failed',
        description: error instanceof Error ? error.message : 'Failed to update scheme',
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
        throw new Error('Failed to update default scheme');
      }

      toast({ title: 'Default updated', description: 'Organization default permission scheme changed.' });
      await fetchSchemes();
    } catch (error) {
      toast({
        title: 'Update failed',
        description: error instanceof Error ? error.message : 'Failed to update scheme',
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
        const error = await res.json().catch(() => ({ error: 'Failed to assign scheme' }));
        throw new Error(error.error || 'Failed to assign scheme');
      }

      const nextState = await res.json();
      setProjectSchemeState(nextState);
      toast({
        title: 'Project scheme updated',
        description:
          nextState.source === 'project'
            ? `This project now uses ${nextState.scheme?.name}.`
            : 'This project now follows the organization default scheme.',
      });
      await fetchSchemes();
    } catch (error) {
      toast({
        title: 'Assignment failed',
        description: error instanceof Error ? error.message : 'Failed to assign scheme',
        variant: 'destructive',
      });
      await fetchSchemes();
    }
  }

  async function deleteScheme(schemeId: string) {
    if (!window.confirm('Delete this permission scheme? Projects using it must be moved first.')) {
      return;
    }

    try {
      const res = await fetch(`/api/permission-schemes/${schemeId}`, { method: 'DELETE' });
      if (!res.ok) {
        const error = await res.json().catch(() => ({ error: 'Failed to delete scheme' }));
        throw new Error(error.error || 'Failed to delete scheme');
      }

      toast({ title: 'Scheme deleted', description: 'Permission scheme removed successfully.' });
      await fetchSchemes();
    } catch (error) {
      toast({
        title: 'Delete failed',
        description: error instanceof Error ? error.message : 'Failed to delete scheme',
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
      return 'No scheme';
    }

    return projectSchemeState.scheme.name;
  }, [projectSchemeState]);

  if (loading) {
    return <div className="p-4 text-sm text-muted-foreground">Loading permission schemes...</div>;
  }

  return (
    <div className="space-y-6 animate-fade-up">
      {projectId ? (
        <div className="surface-card p-5 space-y-3">
          <div className="space-y-1">
            <span className="kicker">Project assignment</span>
            <p className="text-xs text-muted-foreground">
              Choose which permission scheme should drive this project&apos;s default access model.
            </p>
          </div>
          <div className="grid grid-cols-1 gap-4 items-center md:grid-cols-[240px_1fr]">
            <div className="space-y-1">
              <div className="text-sm font-medium">{assignedSchemeName}</div>
              <p className="text-xs text-muted-foreground">
                {projectSchemeState?.source === 'project'
                  ? 'This project uses its own explicit scheme.'
                  : 'This project inherits the organization default.'}
              </p>
            </div>
            <Select value={selectedProjectScheme} onValueChange={(value) => void assignSchemeToProject(value)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={DEFAULT_SCHEME_VALUE}>Use organization default</SelectItem>
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
          <span className="kicker">Schemes</span>
          <h3 className="text-sm font-semibold tracking-tight text-foreground">Permission schemes</h3>
          <p className="text-sm text-muted-foreground">
            Create reusable access templates and reuse them across projects.
          </p>
        </div>
        <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="mr-2 h-4 w-4" />
              Create scheme
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Create permission scheme</DialogTitle>
              <DialogDescription>
                Start from a role template and adjust member-level permissions later if needed.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label>Name</Label>
                <Input
                  value={newScheme.name}
                  onChange={(event) => setNewScheme((current) => ({ ...current, name: event.target.value }))}
                  placeholder="Standard project permissions"
                />
              </div>
              <div className="space-y-2">
                <Label>Description</Label>
                <Textarea
                  value={newScheme.description}
                  onChange={(event) => setNewScheme((current) => ({ ...current, description: event.target.value }))}
                  placeholder="Describe when teams should use this scheme."
                />
              </div>
              <div className="space-y-2">
                <Label>Base role</Label>
                <Select
                  value={newScheme.baseRole}
                  onValueChange={(value) => setNewScheme((current) => ({ ...current, baseRole: value }))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Start from a project role template" />
                  </SelectTrigger>
                  <SelectContent>
                    {PROJECT_ROLES.map((role) => (
                      <SelectItem key={role.value} value={role.value}>
                        {role.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setCreateDialogOpen(false)}>
                Cancel
              </Button>
              <Button onClick={() => void createScheme()} disabled={!newScheme.name.trim()}>
                Create
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {schemes.length === 0 ? (
        <div className="surface-card p-10 text-center space-y-3">
          <Shield className="mx-auto h-8 w-8 text-muted-foreground/40" />
          <p className="text-sm text-muted-foreground">No permission schemes yet.</p>
          <Button size="sm" onClick={() => setCreateDialogOpen(true)}>
            <Plus className="mr-2 h-4 w-4" />
            Create your first scheme
          </Button>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3 stagger">
          {schemes.map((scheme) => {
            const isAssignedToProject = projectSchemeState?.assignedSchemeId === scheme.id;
            const isEffectiveForProject = projectSchemeState?.effectiveSchemeId === scheme.id;

            return (
              <div
                key={scheme.id}
                className={`surface-card surface-card-hover p-5 space-y-3 ${
                  scheme.isDefault ? 'border-primary/30' : ''
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 space-y-1">
                    <div className="flex items-center gap-2">
                      <Shield className="h-4 w-4 shrink-0 text-primary" />
                      <h4 className="truncate text-sm font-semibold">{scheme.name}</h4>
                    </div>
                    <p className="text-xs text-muted-foreground line-clamp-2">
                      {scheme.description || 'No description provided.'}
                    </p>
                  </div>
                  {scheme.isDefault ? (
                    <span className="chip shrink-0 gap-1">
                      <Star className="h-3 w-3" />
                      Default
                    </span>
                  ) : null}
                </div>

                <div className="flex flex-wrap gap-1.5">
                  <span className="chip">{Object.keys(scheme.permissions || {}).length} groups</span>
                  <span className="chip">{scheme.projectCount || 0} projects</span>
                  {isAssignedToProject ? <span className="chip-accent">Assigned here</span> : null}
                  {!isAssignedToProject && isEffectiveForProject ? (
                    <span className="chip">Inherited here</span>
                  ) : null}
                </div>

                <div className="flex items-center justify-between gap-2 border-t border-border/60 pt-3">
                  <div className="text-xs text-muted-foreground">
                    {isEffectiveForProject ? (
                      <span className="inline-flex items-center gap-1">
                        <Link2 className="h-3 w-3" />
                        Active here
                      </span>
                    ) : (
                      'Reusable org-wide'
                    )}
                  </div>
                  <div className="flex items-center gap-1">
                    {!scheme.isDefault ? (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7"
                        onClick={() => void setAsDefault(scheme.id)}
                        aria-label="Set as default"
                      >
                        <Star className="h-3.5 w-3.5" />
                      </Button>
                    ) : null}
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7"
                      onClick={() => openEditDialog(scheme)}
                      aria-label="Edit scheme"
                    >
                      <Edit className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 text-destructive hover:text-destructive"
                      onClick={() => void deleteScheme(scheme.id)}
                      aria-label="Delete scheme"
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
            <DialogTitle>Edit permission scheme</DialogTitle>
            <DialogDescription>
              Update the scheme metadata and default behavior for new projects.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Name</Label>
              <Input
                value={editForm.name}
                onChange={(event) => setEditForm((current) => ({ ...current, name: event.target.value }))}
                placeholder="Standard project permissions"
              />
            </div>
            <div className="space-y-2">
              <Label>Description</Label>
              <Textarea
                value={editForm.description}
                onChange={(event) => setEditForm((current) => ({ ...current, description: event.target.value }))}
                placeholder="Describe when teams should use this scheme."
              />
            </div>
            <div className="space-y-2">
              <Label>Default behavior</Label>
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
                  <SelectItem value="standard">Keep as regular scheme</SelectItem>
                  <SelectItem value="default">Make organization default</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={() => void updateScheme()} disabled={!editForm.name.trim()}>
              Save changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
