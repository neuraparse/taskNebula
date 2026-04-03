'use client';

import { useEffect, useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
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
import { Badge } from '@/components/ui/badge';
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
    <div className="space-y-4">
      {projectId ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Project assignment</CardTitle>
            <CardDescription>Choose which issue visibility scheme this project should apply by default.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4 md:grid-cols-[minmax(0,1fr)_220px]">
            <div className="space-y-1">
              <div className="text-sm font-medium">{activeSchemeName}</div>
              <p className="text-sm text-muted-foreground">
                {projectSecurityState?.source === 'project'
                  ? 'This project uses an explicit issue security scheme.'
                  : 'This project currently inherits the organization default scheme.'}
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
          </CardContent>
        </Card>
      ) : null}

      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold">Issue security schemes</h3>
          <p className="text-sm text-muted-foreground">Control who can see sensitive issues and what defaults new work starts with.</p>
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

      <div className="space-y-4">
        {schemes.map((scheme) => {
          const isAssignedToProject = projectSecurityState?.assignedSchemeId === scheme.id;
          const isEffectiveForProject = projectSecurityState?.effectiveSchemeId === scheme.id;

          return (
            <Card key={scheme.id} className={scheme.isDefault ? 'border-primary/60' : undefined}>
              <CardHeader className="space-y-3 pb-3">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <Lock className="h-4 w-4 text-primary" />
                      <CardTitle className="text-base">{scheme.name}</CardTitle>
                      {scheme.isDefault ? (
                        <Badge variant="secondary" className="gap-1">
                          <Star className="h-3 w-3" />
                          Default
                        </Badge>
                      ) : null}
                    </div>
                    {scheme.description ? (
                      <CardDescription>{scheme.description}</CardDescription>
                    ) : (
                      <CardDescription>No description provided.</CardDescription>
                    )}
                  </div>
                  <div className="flex items-center gap-1">
                    {!scheme.isDefault ? (
                      <Button variant="ghost" size="icon" onClick={() => void setAsDefault(scheme.id)} title="Set as default">
                        <Star className="h-4 w-4" />
                      </Button>
                    ) : null}
                    <Button variant="ghost" size="icon" onClick={() => openEditDialog(scheme)} title="Edit">
                      <Edit className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="icon" onClick={() => openLevelDialog(scheme.id)} title="Add level">
                      <Plus className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => void deleteScheme(scheme.id)}
                      title="Delete"
                      className="text-destructive hover:text-destructive"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>

                <div className="flex flex-wrap gap-2">
                  <Badge variant="outline">{scheme.projectCount || 0} projects</Badge>
                  <Badge variant="outline">{scheme.levels.length} levels</Badge>
                  {isAssignedToProject ? <Badge>Assigned here</Badge> : null}
                  {!isAssignedToProject && isEffectiveForProject ? <Badge variant="secondary">Inherited here</Badge> : null}
                </div>
              </CardHeader>
              <CardContent>
                <Accordion type="single" collapsible className="w-full">
                  <AccordionItem value={`${scheme.id}-levels`} className="border-none">
                    <AccordionTrigger className="py-2 text-sm">
                      Security levels
                    </AccordionTrigger>
                    <AccordionContent className="space-y-3 pt-2">
                      {scheme.levels.length ? (
                        scheme.levels.map((level) => (
                          <div key={level.id} className="rounded-lg border p-3">
                            <div className="flex items-start justify-between gap-3">
                              <div className="space-y-2">
                                <div className="flex items-center gap-2">
                                  <span className="font-medium text-sm">{level.name}</span>
                                  {level.isDefault ? <Badge variant="outline">Default</Badge> : null}
                                </div>
                                {level.description ? (
                                  <p className="text-xs text-muted-foreground">{level.description}</p>
                                ) : null}
                              </div>
                              <div className="flex items-center gap-1">
                                <Button variant="ghost" size="icon" onClick={() => openLevelDialog(scheme.id, level)}>
                                  <Edit className="h-4 w-4" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  onClick={() => void deleteLevel(scheme.id, level.id)}
                                  className="text-destructive hover:text-destructive"
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </div>
                            </div>
                            <div className="mt-3 flex flex-wrap gap-1">
                              {(Array.isArray(level.members) ? level.members : []).map((member, index) => {
                                const Icon = getMemberIcon(member.memberType);

                                return (
                                  <Badge
                                    key={member.id || `${member.memberType}-${member.memberValue || index}`}
                                    variant="secondary"
                                    className="gap-1"
                                  >
                                    <Icon className="h-3 w-3" />
                                    {getMemberLabel(member.memberType, member.memberValue)}
                                  </Badge>
                                );
                              })}
                            </div>
                          </div>
                        ))
                      ) : (
                        <div className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
                          No levels yet. Add the first visibility level for this scheme.
                        </div>
                      )}
                    </AccordionContent>
                  </AccordionItem>
                </Accordion>
              </CardContent>
            </Card>
          );
        })}

        {schemes.length === 0 ? (
          <div className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">
            No security schemes yet. Create one to control issue visibility.
          </div>
        ) : null}
      </div>

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
