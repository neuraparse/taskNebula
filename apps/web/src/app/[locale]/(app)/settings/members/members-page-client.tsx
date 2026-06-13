'use client';

import { useMemo, useState } from 'react';
import { useTranslations } from 'next-intl';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
import { useToast } from '@/hooks/use-toast';
import { useOrganization } from '@/lib/hooks/use-organization';
import { useProjects } from '@/lib/hooks/use-projects';
import {
  Users,
  UserPlus,
  MoreHorizontal,
  Loader2,
  Check,
  ChevronsUpDown,
  FolderKanban,
  X,
} from 'lucide-react';
import { cn } from '@/lib/utils';

type ProjectRole =
  | 'developer'
  | 'tech_lead'
  | 'scrum_master'
  | 'product_owner'
  | 'qa_engineer'
  | 'designer'
  | 'viewer';

const PROJECT_ROLE_VALUES: ProjectRole[] = [
  'developer',
  'tech_lead',
  'scrum_master',
  'product_owner',
  'qa_engineer',
  'designer',
  'viewer',
];

type Member = {
  id: string;
  name: string;
  email: string;
  image?: string;
  status: string;
  role: 'owner' | 'admin' | 'member' | 'viewer' | 'guest';
  memberStatus: string;
  joinedAt: string;
};

// Token-driven role chips
const roleChipClass: Record<Member['role'], string> = {
  owner: 'bg-accent-amber/10 text-accent-amber border border-accent-amber/20',
  admin: 'bg-accent-violet/10 text-accent-violet border border-accent-violet/20',
  member: 'bg-muted text-muted-foreground border border-border',
  viewer: 'bg-muted text-muted-foreground border border-border',
  guest: 'bg-accent-emerald/10 text-accent-emerald border border-accent-emerald/20',
};

export function MembersPageClient() {
  const t = useTranslations('settingsClients');
  const { currentOrganizationId } = useOrganization();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [inviteOpen, setInviteOpen] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState<Member['role']>('member');
  const [projectsExpanded, setProjectsExpanded] = useState(false);
  const [projectPickerOpen, setProjectPickerOpen] = useState(false);
  const [selectedProjectIds, setSelectedProjectIds] = useState<string[]>([]);
  const [projectRole, setProjectRole] = useState<ProjectRole>('developer');

  const { data: orgProjects = [], isLoading: projectsLoading } = useProjects({
    organizationId: currentOrganizationId ?? undefined,
  });

  const projectById = useMemo(() => {
    const map = new Map<string, (typeof orgProjects)[number]>();
    for (const p of orgProjects) map.set(p.id, p);
    return map;
  }, [orgProjects]);

  const toggleProject = (id: string) => {
    setSelectedProjectIds((prev) =>
      prev.includes(id) ? prev.filter((v) => v !== id) : [...prev, id]
    );
  };
  const removeProject = (id: string) => {
    setSelectedProjectIds((prev) => prev.filter((v) => v !== id));
  };

  const resetInviteForm = () => {
    setInviteEmail('');
    setInviteRole('member');
    setSelectedProjectIds([]);
    setProjectRole('developer');
    setProjectsExpanded(false);
  };

  const { data, isLoading } = useQuery({
    queryKey: ['organization-members', currentOrganizationId],
    queryFn: async () => {
      const response = await fetch(`/api/organizations/${currentOrganizationId}/members`);
      if (!response.ok) throw new Error(t('members.fetchFailed'));
      return response.json() as Promise<{
        members: Member[];
        userRole: 'owner' | 'admin' | 'member' | 'viewer' | 'guest' | null;
        isSuperAdmin: boolean;
      }>;
    },
    enabled: !!currentOrganizationId,
  });

  const members = data?.members || [];
  const userRole = data?.userRole || null;
  const isSuperAdmin = data?.isSuperAdmin || false;

  const canInvite = userRole === 'owner' || userRole === 'admin' || isSuperAdmin;
  const canManage = userRole === 'owner' || userRole === 'admin' || isSuperAdmin;
  const canRemove = userRole === 'owner' || userRole === 'admin' || isSuperAdmin;

  const inviteMutation = useMutation({
    mutationFn: async (data: {
      email: string;
      role: Member['role'];
      projectIds?: string[];
      projectRole?: ProjectRole;
    }) => {
      const response = await fetch(`/api/organizations/${currentOrganizationId}/members`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || t('members.inviteFailed'));
      }
      return response.json() as Promise<{
        addedToProjects?: string[];
        skippedProjects?: string[];
      }>;
    },
    onSuccess: (result, variables) => {
      queryClient.invalidateQueries({ queryKey: ['organization-members', currentOrganizationId] });
      const added = result?.addedToProjects?.length ?? 0;
      const skipped = result?.skippedProjects?.length ?? 0;
      const hasProjectSummary =
        (result?.addedToProjects !== undefined || result?.skippedProjects !== undefined) &&
        (variables.projectIds?.length ?? 0) > 0;
      if (hasProjectSummary) {
        const parts = [t('members.invitedEmail', { email: variables.email })];
        if (added > 0) parts.push(t('members.addedToProjects', { count: added }));
        if (skipped > 0) parts.push(t('members.skippedProjects', { count: skipped }));
        toast({ title: t('members.invitationSent'), description: parts.join(' ') });
      } else {
        toast({
          title: t('members.invitationSent'),
          description: t('members.memberInvited'),
        });
      }
      setInviteOpen(false);
      resetInviteForm();
    },
    onError: (error: Error) => {
      toast({
        title: t('members.inviteFailed'),
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  const handleSubmitInvite = () => {
    const payload: {
      email: string;
      role: Member['role'];
      projectIds?: string[];
      projectRole?: ProjectRole;
    } = { email: inviteEmail, role: inviteRole };
    if (selectedProjectIds.length > 0) {
      payload.projectIds = selectedProjectIds;
      payload.projectRole = projectRole;
    }
    inviteMutation.mutate(payload);
  };

  const updateRoleMutation = useMutation({
    mutationFn: async ({ memberId, role }: { memberId: string; role: Member['role'] }) => {
      const response = await fetch(
        `/api/organizations/${currentOrganizationId}/members/${memberId}`,
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ role }),
        }
      );
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || t('members.updateRoleFailed'));
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['organization-members', currentOrganizationId] });
      toast({ title: t('members.roleUpdated'), description: t('members.roleUpdatedDesc') });
    },
    onError: (error: Error) => {
      toast({
        title: t('members.updateRoleFailed'),
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  const removeMutation = useMutation({
    mutationFn: async (memberId: string) => {
      const response = await fetch(
        `/api/organizations/${currentOrganizationId}/members/${memberId}`,
        { method: 'DELETE' }
      );
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || t('members.removeFailed'));
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['organization-members', currentOrganizationId] });
      toast({ title: t('members.memberRemoved'), description: t('members.memberRemovedDesc') });
    },
    onError: (error: Error) => {
      toast({
        title: t('members.removeFailed'),
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  if (!currentOrganizationId) {
    return (
      <div className="flex h-64 items-center justify-center">
        <p className="text-muted-foreground text-sm">{t('members.selectOrg')}</p>
      </div>
    );
  }

  return (
    <div className="animate-fade-up stagger space-y-8">
      <section className="space-y-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="space-y-1">
            <span className="kicker">{t('members.kicker')}</span>
            <h2 className="flex items-center gap-2 text-lg font-semibold tracking-tight">
              {t('members.heading')}
              <span className="text-muted-foreground text-sm font-normal">({members.length})</span>
            </h2>
            <p className="text-muted-foreground max-w-prose text-sm">{t('members.subtitle')}</p>
          </div>

          <div className="flex items-center gap-2">
            {userRole && (
              <span
                className={cn(
                  'rounded-full px-2.5 py-0.5 text-[11px] font-medium',
                  roleChipClass[userRole] ?? roleChipClass.member
                )}
              >
                {t(`members.role.${userRole}`)}
              </span>
            )}
            {isSuperAdmin && (
              <span className="border-accent-violet/20 bg-accent-violet/10 text-accent-violet rounded-full border px-2.5 py-0.5 text-[11px] font-medium">
                {t('members.superAdmin')}
              </span>
            )}

            <Dialog
              open={inviteOpen}
              onOpenChange={(open) => {
                setInviteOpen(open);
                if (!open) resetInviteForm();
              }}
            >
              <DialogTrigger asChild>
                <Button size="sm" disabled={!canInvite}>
                  <UserPlus className="mr-1.5 h-4 w-4" />
                  {t('members.invite')}
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle className="flex items-center gap-2">
                    <UserPlus className="text-muted-foreground h-4 w-4" />
                    {t('members.inviteMember')}
                  </DialogTitle>
                  <DialogDescription>{t('members.inviteDescription')}</DialogDescription>
                </DialogHeader>
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="email">{t('members.email')}</Label>
                    <Input
                      id="email"
                      type="email"
                      placeholder="member@example.com"
                      value={inviteEmail}
                      onChange={(e) => setInviteEmail(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="role">{t('members.roleLabel')}</Label>
                    <Select
                      value={inviteRole}
                      onValueChange={(value) => setInviteRole(value as Member['role'])}
                    >
                      <SelectTrigger id="role">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="member">{t('members.role.member')}</SelectItem>
                        <SelectItem value="admin">{t('members.role.admin')}</SelectItem>
                        <SelectItem value="viewer">{t('members.role.viewer')}</SelectItem>
                        <SelectItem value="guest">{t('members.role.guest')}</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="border-border bg-muted/20 space-y-2 rounded-md border p-3">
                    <button
                      type="button"
                      onClick={() => setProjectsExpanded((v) => !v)}
                      className="flex w-full items-center justify-between text-left"
                    >
                      <span className="flex items-center gap-2 text-sm font-medium">
                        <FolderKanban className="text-muted-foreground h-4 w-4" />
                        {t('members.addToProjects')}
                        {selectedProjectIds.length > 0 && (
                          <span className="chip text-[11px]">{selectedProjectIds.length}</span>
                        )}
                      </span>
                      <ChevronsUpDown
                        className={cn(
                          'text-muted-foreground h-4 w-4 transition-transform',
                          projectsExpanded && 'rotate-180'
                        )}
                      />
                    </button>

                    {projectsExpanded && (
                      <div className="space-y-3 pt-2">
                        {projectsLoading ? (
                          <div className="flex items-center justify-center py-4">
                            <Loader2 className="text-muted-foreground h-4 w-4 animate-spin" />
                          </div>
                        ) : orgProjects.length === 0 ? (
                          <p className="text-muted-foreground text-xs">
                            {t('members.noProjectsYet')}
                          </p>
                        ) : (
                          <>
                            <Popover open={projectPickerOpen} onOpenChange={setProjectPickerOpen}>
                              <PopoverTrigger asChild>
                                <Button
                                  type="button"
                                  variant="outline"
                                  role="combobox"
                                  aria-label={t('members.selectProjects')}
                                  aria-expanded={projectPickerOpen}
                                  className="w-full justify-between font-normal"
                                >
                                  <span className="truncate text-sm">
                                    {selectedProjectIds.length === 0
                                      ? t('members.selectProjectsPlaceholder')
                                      : t('members.selectedCount', {
                                          count: selectedProjectIds.length,
                                        })}
                                  </span>
                                  <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                                </Button>
                              </PopoverTrigger>
                              <PopoverContent
                                className="w-[--radix-popover-trigger-width] p-0"
                                align="start"
                              >
                                <Command>
                                  <CommandInput placeholder={t('members.searchProjects')} />
                                  <CommandList>
                                    <CommandEmpty>{t('members.noProjectsFound')}</CommandEmpty>
                                    <CommandGroup>
                                      {orgProjects.map((project) => {
                                        const selected = selectedProjectIds.includes(project.id);
                                        return (
                                          <CommandItem
                                            key={project.id}
                                            value={`${project.name} ${project.key}`}
                                            onSelect={() => toggleProject(project.id)}
                                          >
                                            <Check
                                              className={cn(
                                                'mr-2 h-4 w-4',
                                                selected ? 'opacity-100' : 'opacity-0'
                                              )}
                                            />
                                            <span className="truncate">{project.name}</span>
                                            <span className="text-muted-foreground ml-2 truncate font-mono text-xs">
                                              {project.key}
                                            </span>
                                          </CommandItem>
                                        );
                                      })}
                                    </CommandGroup>
                                  </CommandList>
                                </Command>
                              </PopoverContent>
                            </Popover>

                            {selectedProjectIds.length > 0 && (
                              <div className="flex flex-wrap gap-1.5">
                                {selectedProjectIds.map((id) => {
                                  const project = projectById.get(id);
                                  return (
                                    <span key={id} className="chip flex items-center gap-1 text-xs">
                                      {project?.name ?? id}
                                      <button
                                        type="button"
                                        onClick={() => removeProject(id)}
                                        className="rounded p-0.5 opacity-60 hover:opacity-100"
                                        aria-label={t('members.removeProject', {
                                          name: project?.name ?? id,
                                        })}
                                      >
                                        <X className="h-3 w-3" />
                                      </button>
                                    </span>
                                  );
                                })}
                              </div>
                            )}

                            {selectedProjectIds.length > 0 && (
                              <div className="space-y-2">
                                <Label htmlFor="project-role">{t('members.projectRole')}</Label>
                                <Select
                                  value={projectRole}
                                  onValueChange={(value) => setProjectRole(value as ProjectRole)}
                                >
                                  <SelectTrigger id="project-role">
                                    <SelectValue />
                                  </SelectTrigger>
                                  <SelectContent>
                                    {PROJECT_ROLE_VALUES.map((value) => (
                                      <SelectItem key={value} value={value}>
                                        {t(`members.projectRoleOption.${value}`)}
                                      </SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                              </div>
                            )}
                          </>
                        )}
                      </div>
                    )}
                  </div>
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setInviteOpen(false)}>
                    {t('common.cancel')}
                  </Button>
                  <Button
                    onClick={handleSubmitInvite}
                    disabled={inviteMutation.isPending || !inviteEmail}
                  >
                    {inviteMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    {t('members.sendInvitation')}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
        </div>

        {!canManage && <div className="panel-warn text-sm">{t('members.viewOnly')}</div>}

        {isLoading ? (
          <div className="flex items-center justify-center py-10">
            <Loader2 className="text-muted-foreground h-5 w-5 animate-spin" />
          </div>
        ) : members.length === 0 ? (
          <div className="flex flex-col items-center gap-3 py-12 text-center">
            <Users className="text-muted-foreground/50 h-8 w-8" />
            <p className="text-muted-foreground text-sm">{t('members.noMembers')}</p>
            {canInvite && (
              <Button size="sm" onClick={() => setInviteOpen(true)}>
                {t('members.inviteFirst')}
              </Button>
            )}
          </div>
        ) : (
          <div>
            {members.map((member) => {
              const disableRoleChange = member.role === 'owner' || !canManage;
              return (
                <div
                  key={member.id}
                  className="hover:bg-accent/40 flex min-h-[52px] items-center justify-between gap-4 rounded-md px-2 py-2 transition-colors duration-150"
                >
                  <div className="flex min-w-0 items-center gap-3">
                    <Avatar className="h-8 w-8">
                      <AvatarImage src={member.image} alt={member.name} />
                      <AvatarFallback className="text-xs">
                        {member.name.charAt(0).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="truncate text-sm font-medium">{member.name}</p>
                        {member.status === 'invited' && (
                          <span className="chip text-[11px]">{t('members.invited')}</span>
                        )}
                      </div>
                      <p className="text-muted-foreground truncate text-xs">{member.email}</p>
                    </div>
                  </div>

                  <div className="flex shrink-0 items-center gap-2">
                    {disableRoleChange ? (
                      <span
                        className={cn(
                          'rounded-full px-2.5 py-0.5 text-[11px] font-medium',
                          roleChipClass[member.role]
                        )}
                      >
                        {t(`members.role.${member.role}`)}
                      </span>
                    ) : (
                      <Select
                        value={member.role}
                        onValueChange={(value) =>
                          updateRoleMutation.mutate({
                            memberId: member.id,
                            role: value as Member['role'],
                          })
                        }
                      >
                        <SelectTrigger className="h-8 w-[120px] text-xs">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="admin">{t('members.role.admin')}</SelectItem>
                          <SelectItem value="member">{t('members.role.member')}</SelectItem>
                          <SelectItem value="viewer">{t('members.role.viewer')}</SelectItem>
                          <SelectItem value="guest">{t('members.role.guest')}</SelectItem>
                        </SelectContent>
                      </Select>
                    )}

                    {member.role !== 'owner' && canRemove && (
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-8 w-8">
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem
                            onClick={() => removeMutation.mutate(member.id)}
                            className="text-destructive focus:text-destructive"
                          >
                            {t('members.removeMember')}
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}
