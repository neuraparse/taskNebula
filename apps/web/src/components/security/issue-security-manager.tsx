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
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { Plus, Lock, Trash2, Edit, Star, Users, User, UserCheck, Shield } from 'lucide-react';

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
  { value: 'reporter', labelKey: 'memberReporter', icon: User },
  { value: 'assignee', labelKey: 'memberAssignee', icon: UserCheck },
  { value: 'project_lead', labelKey: 'memberProjectLead', icon: Users },
  { value: 'project_role', labelKey: 'memberProjectRole', icon: Users },
  { value: 'user', labelKey: 'memberUser', icon: User },
  { value: 'anyone', labelKey: 'memberAnyone', icon: Shield },
] as const;

const PROJECT_ROLE_VALUES = [
  'product_owner',
  'scrum_master',
  'tech_lead',
  'developer',
  'qa_engineer',
  'designer',
  'viewer',
];

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
  const [projectSecurityState, setProjectSecurityState] = useState<ProjectSecurityState | null>(
    null
  );
  const { toast } = useToast();
  const t = useTranslations('userSecurity');

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
        title: t('toastLoadFailedTitle'),
        description: t('toastLoadFailedDescription'),
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
            {
              name: t('starterInternalName'),
              description: t('starterInternalDescription'),
              members: [{ type: 'project_role', value: 'developer' }],
            },
            {
              name: t('starterConfidentialName'),
              description: t('starterConfidentialDescription'),
              members: [{ type: 'project_role', value: 'tech_lead' }],
            },
            {
              name: t('starterRestrictedName'),
              description: t('starterRestrictedDescription'),
              members: [{ type: 'reporter' }, { type: 'assignee' }],
            },
          ],
        }),
      });

      if (!res.ok) {
        const error = await res.json().catch(() => ({ error: t('errorCreateScheme') }));
        throw new Error(error.error || t('errorCreateScheme'));
      }

      toast({
        title: t('toastSchemeCreatedTitle'),
        description: t('toastSchemeCreatedDescription'),
      });
      setCreateDialogOpen(false);
      setNewScheme({ name: '', description: '' });
      await fetchSchemes();
    } catch (error) {
      toast({
        title: t('toastCreateFailedTitle'),
        description: error instanceof Error ? error.message : t('errorCreateScheme'),
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
        const error = await res.json().catch(() => ({ error: t('errorUpdateScheme') }));
        throw new Error(error.error || t('errorUpdateScheme'));
      }

      toast({
        title: t('toastSchemeUpdatedTitle'),
        description: t('toastSchemeUpdatedDescription'),
      });
      setEditDialogOpen(false);
      setEditingScheme(null);
      await fetchSchemes();
    } catch (error) {
      toast({
        title: t('toastUpdateFailedTitle'),
        description: error instanceof Error ? error.message : t('errorUpdateScheme'),
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
        throw new Error(t('errorUpdateDefaultScheme'));
      }

      toast({
        title: t('toastDefaultUpdatedTitle'),
        description: t('toastDefaultUpdatedDescription'),
      });
      await fetchSchemes();
    } catch (error) {
      toast({
        title: t('toastUpdateFailedTitle'),
        description: error instanceof Error ? error.message : t('errorUpdateScheme'),
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
        const error = await res.json().catch(() => ({ error: t('errorAssignScheme') }));
        throw new Error(error.error || t('errorAssignScheme'));
      }

      const nextState = await res.json();
      setProjectSecurityState(nextState);
      toast({
        title: t('toastProjectSchemeUpdatedTitle'),
        description:
          nextState.source === 'project'
            ? t('toastProjectSchemeUsesDescription', { name: nextState.scheme?.name ?? '' })
            : t('toastProjectSchemeDefaultDescription'),
      });
      await fetchSchemes();
    } catch (error) {
      toast({
        title: t('toastAssignmentFailedTitle'),
        description: error instanceof Error ? error.message : t('errorAssignScheme'),
        variant: 'destructive',
      });
      await fetchSchemes();
    }
  }

  async function deleteScheme(schemeId: string) {
    if (!window.confirm(t('confirmDeleteScheme'))) {
      return;
    }

    try {
      const res = await fetch(`/api/security-schemes/${schemeId}`, { method: 'DELETE' });
      if (!res.ok) {
        const error = await res.json().catch(() => ({ error: t('errorDeleteScheme') }));
        throw new Error(error.error || t('errorDeleteScheme'));
      }

      toast({
        title: t('toastSchemeDeletedTitle'),
        description: t('toastSchemeDeletedDescription'),
      });
      await fetchSchemes();
    } catch (error) {
      toast({
        title: t('toastDeleteFailedTitle'),
        description: error instanceof Error ? error.message : t('errorDeleteScheme'),
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
      members: level?.members?.length
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
        const error = await res.json().catch(() => ({ error: t('errorSaveLevel') }));
        throw new Error(error.error || t('errorSaveLevel'));
      }

      toast({
        title: editingLevel ? t('toastLevelUpdatedTitle') : t('toastLevelCreatedTitle'),
        description: t('toastLevelSavedDescription'),
      });
      setLevelDialogOpen(false);
      setEditingLevel(null);
      setActiveSchemeId(null);
      await fetchSchemes();
    } catch (error) {
      toast({
        title: t('toastSaveFailedTitle'),
        description: error instanceof Error ? error.message : t('errorSaveLevel'),
        variant: 'destructive',
      });
    }
  }

  async function deleteLevel(schemeId: string, levelId: string) {
    if (!window.confirm(t('confirmDeleteLevel'))) {
      return;
    }

    try {
      const res = await fetch(`/api/security-schemes/${schemeId}/levels/${levelId}`, {
        method: 'DELETE',
      });

      if (!res.ok) {
        const error = await res.json().catch(() => ({ error: t('errorDeleteLevel') }));
        throw new Error(error.error || t('errorDeleteLevel'));
      }

      toast({
        title: t('toastLevelDeletedTitle'),
        description: t('toastLevelDeletedDescription'),
      });
      await fetchSchemes();
    } catch (error) {
      toast({
        title: t('toastDeleteFailedTitle'),
        description: error instanceof Error ? error.message : t('errorDeleteLevel'),
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
      return t('memberUserValue', { value });
    }

    const memberType = MEMBER_TYPES.find((member) => member.value === type);
    return memberType ? t(memberType.labelKey) : type;
  }

  const activeSchemeName = useMemo(() => {
    if (!projectSecurityState?.scheme) {
      return t('noScheme');
    }

    return projectSecurityState.scheme.name;
  }, [projectSecurityState, t]);

  if (loading) {
    return <div className="text-muted-foreground p-4 text-sm">{t('loadingSchemes')}</div>;
  }

  return (
    <div className="animate-fade-up space-y-6">
      {projectId ? (
        <div className="surface-card space-y-3 p-5">
          <div className="space-y-1">
            <span className="kicker">{t('projectAssignment')}</span>
            <p className="text-muted-foreground text-xs">{t('projectAssignmentHint')}</p>
          </div>
          <div className="grid grid-cols-1 items-center gap-4 md:grid-cols-[240px_1fr]">
            <div className="space-y-1">
              <div className="text-sm font-medium">{activeSchemeName}</div>
              <p className="text-muted-foreground text-xs">
                {projectSecurityState?.source === 'project'
                  ? t('projectUsesExplicit')
                  : t('projectInheritsDefault')}
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
                <SelectItem value={DEFAULT_SCHEME_VALUE}>{t('useOrganizationDefault')}</SelectItem>
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
          <span className="kicker">{t('schemes')}</span>
          <h3 className="text-foreground text-sm font-semibold tracking-tight">
            {t('issueSecuritySchemes')}
          </h3>
          <p className="text-muted-foreground text-sm">{t('schemesHint')}</p>
        </div>
        <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="mr-2 h-4 w-4" />
              {t('createScheme')}
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{t('createSchemeTitle')}</DialogTitle>
              <DialogDescription>{t('createSchemeDescription')}</DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label>{t('fieldName')}</Label>
                <Input
                  value={newScheme.name}
                  onChange={(event) =>
                    setNewScheme((current) => ({ ...current, name: event.target.value }))
                  }
                  placeholder={t('schemeNamePlaceholder')}
                />
              </div>
              <div className="space-y-2">
                <Label>{t('fieldDescription')}</Label>
                <Textarea
                  value={newScheme.description}
                  onChange={(event) =>
                    setNewScheme((current) => ({ ...current, description: event.target.value }))
                  }
                  placeholder={t('schemeDescriptionPlaceholder')}
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setCreateDialogOpen(false)}>
                {t('cancel')}
              </Button>
              <Button onClick={() => void createScheme()} disabled={!newScheme.name.trim()}>
                {t('create')}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {schemes.length === 0 ? (
        <div className="surface-card space-y-3 p-10 text-center">
          <Lock className="text-muted-foreground/40 mx-auto h-8 w-8" />
          <p className="text-muted-foreground text-sm">{t('noSchemesYet')}</p>
          <Button size="sm" onClick={() => setCreateDialogOpen(true)}>
            <Plus className="mr-2 h-4 w-4" />
            {t('createFirstScheme')}
          </Button>
        </div>
      ) : (
        <div className="stagger space-y-4">
          {schemes.map((scheme) => {
            const isAssignedToProject = projectSecurityState?.assignedSchemeId === scheme.id;
            const isEffectiveForProject = projectSecurityState?.effectiveSchemeId === scheme.id;

            return (
              <div
                key={scheme.id}
                className={`surface-card space-y-4 p-5 ${scheme.isDefault ? 'border-primary/30' : ''}`}
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0 space-y-1">
                    <div className="flex items-center gap-2">
                      <Lock className="text-primary h-4 w-4 shrink-0" />
                      <h4 className="truncate text-sm font-semibold">{scheme.name}</h4>
                      {scheme.isDefault ? (
                        <span className="chip gap-1">
                          <Star className="h-3 w-3" />
                          {t('default')}
                        </span>
                      ) : null}
                    </div>
                    <p className="text-muted-foreground text-xs">
                      {scheme.description || t('noDescription')}
                    </p>
                  </div>
                  <div className="flex items-center gap-1">
                    {!scheme.isDefault ? (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7"
                        onClick={() => void setAsDefault(scheme.id)}
                        aria-label={t('setAsDefault')}
                      >
                        <Star className="h-3.5 w-3.5" />
                      </Button>
                    ) : null}
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7"
                      onClick={() => openEditDialog(scheme)}
                      aria-label={t('editScheme')}
                    >
                      <Edit className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7"
                      onClick={() => openLevelDialog(scheme.id)}
                      aria-label={t('addLevel')}
                    >
                      <Plus className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="text-destructive hover:text-destructive h-7 w-7"
                      onClick={() => void deleteScheme(scheme.id)}
                      aria-label={t('deleteScheme')}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>

                <div className="flex flex-wrap gap-1.5">
                  <span className="chip">
                    {t('projectsCount', { count: scheme.projectCount || 0 })}
                  </span>
                  <span className="chip">{t('levelsCount', { count: scheme.levels.length })}</span>
                  {isAssignedToProject ? (
                    <span className="chip-accent">{t('assignedHere')}</span>
                  ) : null}
                  {!isAssignedToProject && isEffectiveForProject ? (
                    <span className="chip">{t('inheritedHere')}</span>
                  ) : null}
                </div>

                <Accordion type="single" collapsible className="w-full">
                  <AccordionItem value={`${scheme.id}-levels`} className="border-none">
                    <AccordionTrigger className="py-2 text-sm">
                      {t('securityLevels')}
                    </AccordionTrigger>
                    <AccordionContent className="pt-2">
                      {scheme.levels.length ? (
                        <div className="surface-inset divide-border/60 divide-y">
                          {scheme.levels.map((level) => (
                            <div key={level.id} className="row-interactive px-4 py-3">
                              <div className="flex items-start justify-between gap-3">
                                <div className="min-w-0 space-y-1">
                                  <div className="flex items-center gap-2">
                                    <span className="truncate text-sm font-medium">
                                      {level.name}
                                    </span>
                                    {level.isDefault ? (
                                      <span className="chip">{t('default')}</span>
                                    ) : null}
                                  </div>
                                  {level.description ? (
                                    <p className="text-muted-foreground text-xs">
                                      {level.description}
                                    </p>
                                  ) : null}
                                </div>
                                <div className="flex shrink-0 items-center gap-1">
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-7 w-7"
                                    onClick={() => openLevelDialog(scheme.id, level)}
                                    aria-label={t('editLevel')}
                                  >
                                    <Edit className="h-3.5 w-3.5" />
                                  </Button>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="text-destructive hover:text-destructive h-7 w-7"
                                    onClick={() => void deleteLevel(scheme.id, level.id)}
                                    aria-label={t('deleteLevel')}
                                  >
                                    <Trash2 className="h-3.5 w-3.5" />
                                  </Button>
                                </div>
                              </div>
                              <div className="mt-2 flex flex-wrap gap-1">
                                {(Array.isArray(level.members) ? level.members : []).map(
                                  (member, index) => {
                                    const Icon = getMemberIcon(member.memberType);
                                    return (
                                      <span
                                        key={
                                          member.id ||
                                          `${member.memberType}-${member.memberValue || index}`
                                        }
                                        className="chip gap-1"
                                      >
                                        <Icon className="h-3 w-3" />
                                        {getMemberLabel(member.memberType, member.memberValue)}
                                      </span>
                                    );
                                  }
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="border-border text-muted-foreground rounded-md border border-dashed p-4 text-sm">
                          {t('noLevelsYet')}
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
            <DialogTitle>{t('editSchemeTitle')}</DialogTitle>
            <DialogDescription>{t('editSchemeDescription')}</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>{t('fieldName')}</Label>
              <Input
                value={editForm.name}
                onChange={(event) =>
                  setEditForm((current) => ({ ...current, name: event.target.value }))
                }
                placeholder={t('schemeNamePlaceholder')}
              />
            </div>
            <div className="space-y-2">
              <Label>{t('fieldDescription')}</Label>
              <Textarea
                value={editForm.description}
                onChange={(event) =>
                  setEditForm((current) => ({ ...current, description: event.target.value }))
                }
                placeholder={t('schemeDescriptionPlaceholder')}
              />
            </div>
            <div className="space-y-2">
              <Label>{t('defaultBehavior')}</Label>
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
                  <SelectItem value="standard">{t('keepRegularScheme')}</SelectItem>
                  <SelectItem value="default">{t('makeOrganizationDefault')}</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditDialogOpen(false)}>
              {t('cancel')}
            </Button>
            <Button onClick={() => void updateScheme()} disabled={!editForm.name.trim()}>
              {t('saveChanges')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={levelDialogOpen} onOpenChange={setLevelDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingLevel ? t('editLevelTitle') : t('addLevelTitle')}</DialogTitle>
            <DialogDescription>{t('levelDialogDescription')}</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>{t('fieldName')}</Label>
              <Input
                value={levelForm.name}
                onChange={(event) =>
                  setLevelForm((current) => ({ ...current, name: event.target.value }))
                }
                placeholder={t('levelNamePlaceholder')}
              />
            </div>
            <div className="space-y-2">
              <Label>{t('fieldDescription')}</Label>
              <Textarea
                value={levelForm.description}
                onChange={(event) =>
                  setLevelForm((current) => ({ ...current, description: event.target.value }))
                }
                placeholder={t('levelDescriptionPlaceholder')}
              />
            </div>
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label>{t('members')}</Label>
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
                  {t('addMember')}
                </Button>
              </div>
              <div className="space-y-2">
                {levelForm.members.map((member, index) => (
                  <div
                    key={`${member.type}-${index}`}
                    className="grid gap-2 md:grid-cols-[170px_minmax(0,1fr)_40px]"
                  >
                    <Select
                      value={member.type}
                      onValueChange={(value) =>
                        setLevelForm((current) => ({
                          ...current,
                          members: current.members.map((entry, entryIndex) =>
                            entryIndex === index
                              ? {
                                  ...entry,
                                  type: value,
                                  value: value === 'project_role' ? 'developer' : '',
                                }
                              : entry
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
                            {t(memberType.labelKey)}
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
                              {role
                                .replace(/_/g, ' ')
                                .replace(/\b\w/g, (letter) => letter.toUpperCase())}
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
                        placeholder={
                          member.type === 'user'
                            ? t('userIdOrEmailPlaceholder')
                            : t('optionalValuePlaceholder')
                        }
                        disabled={
                          member.type === 'reporter' ||
                          member.type === 'assignee' ||
                          member.type === 'project_lead' ||
                          member.type === 'anyone'
                        }
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
                      aria-label={t('removeMember')}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </div>
            </div>
            <div className="space-y-2">
              <Label>{t('defaultBehavior')}</Label>
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
                  <SelectItem value="standard">{t('keepRegularLevel')}</SelectItem>
                  <SelectItem value="default">{t('makeDefaultLevel')}</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setLevelDialogOpen(false)}>
              {t('cancel')}
            </Button>
            <Button onClick={() => void saveLevel()} disabled={!levelForm.name.trim()}>
              {editingLevel ? t('saveChanges') : t('createLevel')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
