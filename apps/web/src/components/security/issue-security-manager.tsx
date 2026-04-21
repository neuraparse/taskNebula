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
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import {
  Plus,
  Lock,
  Trash2,
  Edit,
  Star,
  Users,
  User,
  UserCheck,
  Shield,
} from 'lucide-react';

interface SecurityLevelMember {
  id?: string;
  memberType: string;
  memberValue: string | null;
}

interface SecurityLevel {
  id: string;
  name: string;
  description: string | null;
  sortOrder: number;
  isDefault: boolean;
  members: SecurityLevelMember[];
}

interface SecurityScheme {
  id: string;
  name: string;
  description: string | null;
  isDefault: boolean;
  levels: SecurityLevel[];
  createdAt: string;
  projectCount?: number;
}

interface ProjectSecurityState {
  assignedSchemeId: string | null;
  effectiveSchemeId: string | null;
  source: 'project' | 'organization-default' | 'none';
  scheme: Pick<SecurityScheme, 'id' | 'name' | 'description' | 'isDefault'> | null;
}

interface IssueSecurityManagerProps {
  organizationId: string;
  projectId?: string;
}

interface LevelFormState {
  name: string;
  description: string;
  isDefault: boolean;
  members: Array<{ type: string; value: string }>;
}

const DEFAULT_SCHEME_VALUE = '__default__';

const MEMBER_TYPES = [
  { value: 'reporter', label: 'Reporter', icon: User },
  { value: 'assignee', label: 'Assignee', icon: UserCheck },
  { value: 'project_lead', label: 'Project lead', icon: Users },
  { value: 'project_role', label: 'Project role', icon: Users },
  { value: 'user', label: 'Specific user', icon: User },
  { value: 'anyone', label: 'Anyone', icon: Shield },
];

const PROJECT_ROLE_VALUES = ['product_owner', 'scrum_master', 'tech_lead', 'developer', 'qa_engineer', 'designer', 'viewer'];

export function IssueSecurityManager({ organizationId, projectId }: IssueSecurityManagerProps) {
  const [schemes, setSchemes] = useState<SecurityScheme[]>([]);
  const [loading, setLoading] = useState(true);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [levelDialogOpen, setLevelDialogOpen] = useState(false);
  const [newScheme, setNewScheme] = useState({ name: '', description: '' });
  const [editingScheme, setEditingScheme] = useState<SecurityScheme | null>(null);
  const [editForm, setEditForm] = useState({ name: '', description: '', isDefault: false });
  const [activeSchemeId, setActiveSchemeId] = useState<string | null>(null);
  const [editingLevel, setEditingLevel] = useState<SecurityLevel | null>(null);
  const [levelForm, setLevelForm] = useState<LevelFormState>({
    name: '',
    description: '',
    isDefault: false,
    members: [{ type: 'project_role', value: 'developer' }],
  });
  const [selectedProjectScheme, setSelectedProjectScheme] = useState<string>(DEFAULT_SCHEME_VALUE);
  const [projectSecurityState, setProjectSecurityState] = useState<ProjectSecurityState | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    void fetchSchemes();
  }, [organizationId, projectId]);

  async function fetchSchemes() {
    setLoading(true);

    try {
      const res = await fetch(`/api/security-schemes?organizationId=${organizationId}`);
      if (!res.ok) {
        throw new Error('Failed to fetch security schemes');
      }

      const data = await res.json();
      setSchemes(data);

      if (projectId) {
        const assignmentRes = await fetch(`/api/projects/${projectId}/security-scheme`);
        if (assignmentRes.ok) {
          const assignment = await assignmentRes.json();
          setProjectSecurityState(assignment);
          setSelectedProjectScheme(assignment.assignedSchemeId ?? DEFAULT_SCHEME_VALUE);
        }
      }
    } catch (error) {
      console.error('Error fetching security schemes:', error);
      toast({
        title: 'Load failed',
        description: 'Issue security schemes could not be loaded.',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  }

  async function createScheme() {
    try {
      const res = await fetch('/api/security-schemes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          organizationId,
          name: newScheme.name,
          description: newScheme.description,
          levels: [
            { name: 'Internal', description: 'Visible to delivery team roles', members: [{ type: 'project_role', value: 'developer' }] },
            { name: 'Confidential', description: 'Visible to project leads only', members: [{ type: 'project_role', value: 'tech_lead' }] },
            { name: 'Restricted', description: 'Visible to reporter and assignee', members: [{ type: 'reporter' }, { type: 'assignee' }] },
          ],
        }),
      });

      if (!res.ok) {
        const error = await res.json().catch(() => ({ error: 'Failed to create scheme' }));
        throw new Error(error.error || 'Failed to create scheme');
      }

      toast({ title: 'Security scheme created', description: 'Default visibility levels were added automatically.' });
      setCreateDialogOpen(false);
      setNewScheme({ name: '', description: '' });
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
      const res = await fetch(`/api/security-schemes/${editingScheme.id}`, {
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

      toast({ title: 'Scheme updated', description: 'Issue security scheme changes were saved.' });
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
      const res = await fetch(`/api/security-schemes/${schemeId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isDefault: true }),
      });

      if (!res.ok) {
        throw new Error('Failed to update default scheme');
      }

      toast({ title: 'Default updated', description: 'Organization default security scheme changed.' });
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
      const res = await fetch(`/api/projects/${projectId}/security-scheme`, {
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
      setProjectSecurityState(nextState);
      toast({
        title: 'Project scheme updated',
        description:
          nextState.source === 'project'
            ? `This project now uses ${nextState.scheme?.name}.`
            : 'This project now follows the organization default security scheme.',
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
    if (!window.confirm('Delete this security scheme? Projects using it must be moved first.')) {
      return;
    }

    try {
      const res = await fetch(`/api/security-schemes/${schemeId}`, { method: 'DELETE' });
      if (!res.ok) {
        const error = await res.json().catch(() => ({ error: 'Failed to delete scheme' }));
        throw new Error(error.error || 'Failed to delete scheme');
      }

      toast({ title: 'Scheme deleted', description: 'Security scheme removed successfully.' });
      await fetchSchemes();
    } catch (error) {
      toast({
        title: 'Delete failed',
        description: error instanceof Error ? error.message : 'Failed to delete scheme',
        variant: 'destructive',
      });
    }
  }

  function openEditDialog(scheme: SecurityScheme) {
    setEditingScheme(scheme);
    setEditForm({
      name: scheme.name,
      description: scheme.description || '',
      isDefault: scheme.isDefault,
    });
    setEditDialogOpen(true);
  }

  function openLevelDialog(schemeId: string, level?: SecurityLevel) {
    setActiveSchemeId(schemeId);
    setEditingLevel(level || null);
    setLevelForm({
      name: level?.name || '',
      description: level?.description || '',
      isDefault: level?.isDefault || false,
      members:
        level?.members?.length
          ? level.members.map((member) => ({
              type: member.memberType,
              value: member.memberValue || '',
            }))
          : [{ type: 'project_role', value: 'developer' }],
    });
    setLevelDialogOpen(true);
  }

  async function saveLevel() {
    if (!activeSchemeId) {
      return;
    }

    try {
      const url = editingLevel
        ? `/api/security-schemes/${activeSchemeId}/levels/${editingLevel.id}`
        : `/api/security-schemes/${activeSchemeId}/levels`;
      const method = editingLevel ? 'PATCH' : 'POST';

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: levelForm.name,
          description: levelForm.description || null,
          isDefault: levelForm.isDefault,
          members: levelForm.members.map((member) => ({
            type: member.type,
            value: member.value || undefined,
          })),
        }),
      });

      if (!res.ok) {
        const error = await res.json().catch(() => ({ error: 'Failed to save level' }));
        throw new Error(error.error || 'Failed to save level');
      }

      toast({
        title: editingLevel ? 'Level updated' : 'Level created',
        description: 'Security level changes were saved successfully.',
      });
      setLevelDialogOpen(false);
      setEditingLevel(null);
      setActiveSchemeId(null);
      await fetchSchemes();
    } catch (error) {
      toast({
        title: 'Save failed',
        description: error instanceof Error ? error.message : 'Failed to save level',
        variant: 'destructive',
      });
    }
  }

  async function deleteLevel(schemeId: string, levelId: string) {
    if (!window.confirm('Delete this security level?')) {
      return;
    }

    try {
      const res = await fetch(`/api/security-schemes/${schemeId}/levels/${levelId}`, {
        method: 'DELETE',
      });

      if (!res.ok) {
        const error = await res.json().catch(() => ({ error: 'Failed to delete level' }));
        throw new Error(error.error || 'Failed to delete level');
      }

      toast({ title: 'Level deleted', description: 'Security level removed successfully.' });
      await fetchSchemes();
    } catch (error) {
      toast({
        title: 'Delete failed',
        description: error instanceof Error ? error.message : 'Failed to delete level',
        variant: 'destructive',
      });
    }
  }

  function getMemberIcon(type: string) {
    const memberType = MEMBER_TYPES.find((member) => member.value === type);
    return memberType?.icon || User;
  }

  function getMemberLabel(type: string, value: string | null) {
    if (type === 'project_role' && value) {
      return value.replace(/_/g, ' ').replace(/\b\w/g, (letter) => letter.toUpperCase());
    }

    if (type === 'user' && value) {
      return `User · ${value}`;
    }

    const memberType = MEMBER_TYPES.find((member) => member.value === type);
    return memberType?.label || type;
  }

  const activeSchemeName = useMemo(() => {
    if (!projectSecurityState?.scheme) {
      return 'No scheme';
    }

    return projectSecurityState.scheme.name;
  }, [projectSecurityState]);

  if (loading) {
    return <div className="p-4 text-sm text-muted-foreground">Loading security schemes...</div>;
  }

  return (
    <div className="space-y-6 animate-fade-up">
      {projectId ? (
        <div className="surface-card p-5 space-y-3">
          <div className="space-y-1">
            <span className="kicker">Project assignment</span>
            <h3 className="text-sm font-semibold tracking-tight">Project assignment</h3>
            <p className="text-xs text-muted-foreground">
              Choose which issue visibility scheme this project should apply by default.
            </p>
          </div>
          <div className="grid grid-cols-1 gap-4 items-center md:grid-cols-[240px_1fr]">
            <div className="space-y-1">
              <div className="text-sm font-medium">{activeSchemeName}</div>
              <p className="text-xs text-muted-foreground">
                {projectSecurityState?.source === 'project'
                  ? 'This project uses an explicit scheme.'
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
          <span className="kicker">Security schemes</span>
          <h3 className="text-sm font-semibold tracking-tight text-foreground">Issue security schemes</h3>
          <p className="text-sm text-muted-foreground">
            Control who can see sensitive issues and what defaults new work starts with.
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
              <DialogTitle>Create security scheme</DialogTitle>
              <DialogDescription>Create a new issue security scheme with a few starter levels.</DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label>Name</Label>
                <Input
                  value={newScheme.name}
                  onChange={(event) => setNewScheme((current) => ({ ...current, name: event.target.value }))}
                  placeholder="Standard security"
                />
              </div>
              <div className="space-y-2">
                <Label>Description</Label>
                <Textarea
                  value={newScheme.description}
                  onChange={(event) => setNewScheme((current) => ({ ...current, description: event.target.value }))}
                  placeholder="Describe how teams should use this scheme."
                />
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
          <Lock className="mx-auto h-8 w-8 text-muted-foreground/40" />
          <p className="text-sm text-muted-foreground">No security schemes yet.</p>
          <Button size="sm" onClick={() => setCreateDialogOpen(true)}>
            <Plus className="mr-2 h-4 w-4" />
            Create your first scheme
          </Button>
        </div>
      ) : (
        <div className="space-y-4 stagger">
          {schemes.map((scheme) => {
            const isAssignedToProject = projectSecurityState?.assignedSchemeId === scheme.id;
            const isEffectiveForProject = projectSecurityState?.effectiveSchemeId === scheme.id;

            return (
              <div
                key={scheme.id}
                className={`surface-card p-5 space-y-4 ${scheme.isDefault ? 'border-primary/30' : ''}`}
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0 space-y-1">
                    <div className="flex items-center gap-2">
                      <Lock className="h-4 w-4 shrink-0 text-primary" />
                      <h4 className="truncate text-sm font-semibold">{scheme.name}</h4>
                      {scheme.isDefault ? (
                        <span className="chip gap-1">
                          <Star className="h-3 w-3" />
                          Default
                        </span>
                      ) : null}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {scheme.description || 'No description provided.'}
                    </p>
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
                      className="h-7 w-7"
                      onClick={() => openLevelDialog(scheme.id)}
                      aria-label="Add level"
                    >
                      <Plus className="h-3.5 w-3.5" />
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

                <div className="flex flex-wrap gap-1.5">
                  <span className="chip">{scheme.projectCount || 0} projects</span>
                  <span className="chip">{scheme.levels.length} levels</span>
                  {isAssignedToProject ? <span className="chip-accent">Assigned here</span> : null}
                  {!isAssignedToProject && isEffectiveForProject ? (
                    <span className="chip">Inherited here</span>
                  ) : null}
                </div>

                <Accordion type="single" collapsible className="w-full">
                  <AccordionItem value={`${scheme.id}-levels`} className="border-none">
                    <AccordionTrigger className="py-2 text-sm">Security levels</AccordionTrigger>
                    <AccordionContent className="pt-2">
                      {scheme.levels.length ? (
                        <div className="surface-inset divide-y divide-border/60">
                          {scheme.levels.map((level) => (
                            <div key={level.id} className="row-interactive px-4 py-3">
                              <div className="flex items-start justify-between gap-3">
                                <div className="min-w-0 space-y-1">
                                  <div className="flex items-center gap-2">
                                    <span className="truncate text-sm font-medium">{level.name}</span>
                                    {level.isDefault ? <span className="chip">Default</span> : null}
                                  </div>
                                  {level.description ? (
                                    <p className="text-xs text-muted-foreground">{level.description}</p>
                                  ) : null}
                                </div>
                                <div className="flex shrink-0 items-center gap-1">
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-7 w-7"
                                    onClick={() => openLevelDialog(scheme.id, level)}
                                    aria-label="Edit level"
                                  >
                                    <Edit className="h-3.5 w-3.5" />
                                  </Button>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-7 w-7 text-destructive hover:text-destructive"
                                    onClick={() => void deleteLevel(scheme.id, level.id)}
                                    aria-label="Delete level"
                                  >
                                    <Trash2 className="h-3.5 w-3.5" />
                                  </Button>
                                </div>
                              </div>
                              <div className="mt-2 flex flex-wrap gap-1">
                                {(Array.isArray(level.members) ? level.members : []).map((member, index) => {
                                  const Icon = getMemberIcon(member.memberType);
                                  return (
                                    <span
                                      key={member.id || `${member.memberType}-${member.memberValue || index}`}
                                      className="chip gap-1"
                                    >
                                      <Icon className="h-3 w-3" />
                                      {getMemberLabel(member.memberType, member.memberValue)}
                                    </span>
                                  );
                                })}
                              </div>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="rounded-md border border-dashed border-border p-4 text-sm text-muted-foreground">
                          No levels yet. Add the first visibility level for this scheme.
                        </div>
                      )}
                    </AccordionContent>
                  </AccordionItem>
                </Accordion>
              </div>
            );
          })}
        </div>
      )}

      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit security scheme</DialogTitle>
            <DialogDescription>Update the scheme metadata and default visibility behavior.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Name</Label>
              <Input
                value={editForm.name}
                onChange={(event) => setEditForm((current) => ({ ...current, name: event.target.value }))}
                placeholder="Standard security"
              />
            </div>
            <div className="space-y-2">
              <Label>Description</Label>
              <Textarea
                value={editForm.description}
                onChange={(event) => setEditForm((current) => ({ ...current, description: event.target.value }))}
                placeholder="Describe how teams should use this scheme."
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

      <Dialog open={levelDialogOpen} onOpenChange={setLevelDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingLevel ? 'Edit security level' : 'Add security level'}</DialogTitle>
            <DialogDescription>Define who can see issues tagged with this visibility level.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Name</Label>
              <Input
                value={levelForm.name}
                onChange={(event) => setLevelForm((current) => ({ ...current, name: event.target.value }))}
                placeholder="Confidential"
              />
            </div>
            <div className="space-y-2">
              <Label>Description</Label>
              <Textarea
                value={levelForm.description}
                onChange={(event) =>
                  setLevelForm((current) => ({ ...current, description: event.target.value }))
                }
                placeholder="Who should be able to view issues in this level?"
              />
            </div>
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label>Members</Label>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() =>
                    setLevelForm((current) => ({
                      ...current,
                      members: [...current.members, { type: 'project_role', value: 'developer' }],
                    }))
                  }
                >
                  <Plus className="mr-2 h-3 w-3" />
                  Add member
                </Button>
              </div>
              <div className="space-y-2">
                {levelForm.members.map((member, index) => (
                  <div key={`${member.type}-${index}`} className="grid gap-2 md:grid-cols-[170px_minmax(0,1fr)_40px]">
                    <Select
                      value={member.type}
                      onValueChange={(value) =>
                        setLevelForm((current) => ({
                          ...current,
                          members: current.members.map((entry, entryIndex) =>
                            entryIndex === index ? { ...entry, type: value, value: value === 'project_role' ? 'developer' : '' } : entry
                          ),
                        }))
                      }
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {MEMBER_TYPES.map((memberType) => (
                          <SelectItem key={memberType.value} value={memberType.value}>
                            {memberType.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {member.type === 'project_role' ? (
                      <Select
                        value={member.value || 'developer'}
                        onValueChange={(value) =>
                          setLevelForm((current) => ({
                            ...current,
                            members: current.members.map((entry, entryIndex) =>
                              entryIndex === index ? { ...entry, value } : entry
                            ),
                          }))
                        }
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {PROJECT_ROLE_VALUES.map((role) => (
                            <SelectItem key={role} value={role}>
                              {role.replace(/_/g, ' ').replace(/\b\w/g, (letter) => letter.toUpperCase())}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    ) : (
                      <Input
                        value={member.value}
                        onChange={(event) =>
                          setLevelForm((current) => ({
                            ...current,
                            members: current.members.map((entry, entryIndex) =>
                              entryIndex === index ? { ...entry, value: event.target.value } : entry
                            ),
                          }))
                        }
                        placeholder={member.type === 'user' ? 'User id or email' : 'Optional value'}
                        disabled={member.type === 'reporter' || member.type === 'assignee' || member.type === 'project_lead' || member.type === 'anyone'}
                      />
                    )}
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() =>
                        setLevelForm((current) => ({
                          ...current,
                          members: current.members.filter((_, entryIndex) => entryIndex !== index),
                        }))
                      }
                      disabled={levelForm.members.length === 1}
                      aria-label="Remove member"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </div>
            </div>
            <div className="space-y-2">
              <Label>Default behavior</Label>
              <Select
                value={levelForm.isDefault ? 'default' : 'standard'}
                onValueChange={(value) =>
                  setLevelForm((current) => ({ ...current, isDefault: value === 'default' }))
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="standard">Keep as regular level</SelectItem>
                  <SelectItem value="default">Make default issue level</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setLevelDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={() => void saveLevel()} disabled={!levelForm.name.trim()}>
              {editingLevel ? 'Save changes' : 'Create level'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
