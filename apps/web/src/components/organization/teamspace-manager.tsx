'use client';

import { useEffect, useMemo, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { useToast } from '@/hooks/use-toast';
import { useOrganization } from '@/lib/hooks/use-organization';
import { useOrganizationMembers } from '@/lib/hooks/use-members';
import {
  Teamspace,
  useAddTeamspaceMember,
  useCreateTeamspace,
  useDeleteTeamspace,
  useRemoveTeamspaceMember,
  useTeamspaceMembers,
  useTeamspaces,
  useUpdateTeamspace,
  useUpdateTeamspaceMember,
} from '@/lib/hooks/use-teamspaces';
import { cn } from '@/lib/utils';
import {
  BadgePlus,
  Layers3,
  Loader2,
  MoreVertical,
  Pencil,
  Shield,
  Trash2,
  UserPlus,
  Users,
} from 'lucide-react';

type TeamspaceManagerProps = {
  organizationId: string;
  canManage: boolean;
};

type TeamspaceFormState = {
  name: string;
  slug: string;
  description: string;
  avatarUrl: string;
  leadId: string;
};

const EMPTY_FORM: TeamspaceFormState = {
  name: '',
  slug: '',
  description: '',
  avatarUrl: '',
  leadId: 'creator',
};

function slugifyTeamspaceName(value: string) {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 100);
}

function buildInitials(name?: string | null, email?: string | null) {
  const source = name?.trim() || email?.trim() || 'TS';
  return source
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() || '')
    .join('');
}

export function TeamspaceManager({ organizationId, canManage }: TeamspaceManagerProps) {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { currentTeamId, setCurrentTeam } = useOrganization();
  const { data: teamspaces = [], isLoading } = useTeamspaces(organizationId);
  const { data: orgMembersData } = useOrganizationMembers(organizationId);
  const organizationMembers = orgMembersData?.members ?? [];

  const createMutation = useCreateTeamspace(organizationId);
  const updateMutation = useUpdateTeamspace(organizationId);
  const deleteMutation = useDeleteTeamspace(organizationId);

  const [createOpen, setCreateOpen] = useState(false);
  const [editingTeamspace, setEditingTeamspace] = useState<Teamspace | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Teamspace | null>(null);
  const [membersTarget, setMembersTarget] = useState<Teamspace | null>(null);
  const [formState, setFormState] = useState<TeamspaceFormState>(EMPTY_FORM);

  const membersQuery = useTeamspaceMembers(organizationId, membersTarget?.id ?? null);
  const addMemberMutation = useAddTeamspaceMember(organizationId, membersTarget?.id ?? null);
  const updateMemberMutation = useUpdateTeamspaceMember(organizationId, membersTarget?.id ?? null);
  const removeMemberMutation = useRemoveTeamspaceMember(organizationId, membersTarget?.id ?? null);

  const [memberToAddId, setMemberToAddId] = useState<string>('none');
  const [memberRoleToAdd, setMemberRoleToAdd] = useState<'lead' | 'member'>('member');

  useEffect(() => {
    if (!createOpen && !editingTeamspace) {
      setFormState(EMPTY_FORM);
    }
  }, [createOpen, editingTeamspace]);

  const availableMembers = useMemo(() => {
    const teamspaceMemberIds = new Set(
      (membersQuery.data?.members ?? []).map((member) => member.id)
    );
    return organizationMembers.filter((member) => !teamspaceMemberIds.has(member.id));
  }, [membersQuery.data?.members, organizationMembers]);

  const isMutating =
    createMutation.isPending ||
    updateMutation.isPending ||
    deleteMutation.isPending ||
    addMemberMutation.isPending ||
    updateMemberMutation.isPending ||
    removeMemberMutation.isPending;

  function openCreateDialog() {
    setFormState(EMPTY_FORM);
    setCreateOpen(true);
  }

  function openEditDialog(teamspace: Teamspace) {
    setEditingTeamspace(teamspace);
    setFormState({
      name: teamspace.name,
      slug: teamspace.slug,
      description: teamspace.description || '',
      avatarUrl: teamspace.avatarUrl || '',
      leadId: teamspace.leadId || 'creator',
    });
  }

  function closeFormDialogs() {
    setCreateOpen(false);
    setEditingTeamspace(null);
    setFormState(EMPTY_FORM);
  }

  async function handleSaveTeamspace() {
    if (!formState.name.trim()) return;

    const payload = {
      name: formState.name.trim(),
      slug: formState.slug.trim() || undefined,
      description: formState.description.trim() || undefined,
      avatarUrl: formState.avatarUrl.trim() || undefined,
      leadId: formState.leadId === 'creator' ? null : formState.leadId,
    };

    try {
      if (editingTeamspace) {
        await updateMutation.mutateAsync({ teamspaceId: editingTeamspace.id, payload });
        toast({ title: 'Teamspace updated', description: `${formState.name.trim()} is ready.` });
      } else {
        await createMutation.mutateAsync(payload);
        toast({ title: 'Teamspace created', description: `${formState.name.trim()} is now available.` });
      }
      closeFormDialogs();
    } catch (error) {
      toast({
        title: editingTeamspace ? 'Failed to update teamspace' : 'Failed to create teamspace',
        description: error instanceof Error ? error.message : 'Please try again.',
        variant: 'destructive',
      });
    }
  }

  async function handleDeleteTeamspace() {
    if (!deleteTarget) return;

    try {
      await deleteMutation.mutateAsync(deleteTarget.id);
      if (currentTeamId === deleteTarget.id) setCurrentTeam(null);
      setDeleteTarget(null);
      toast({
        title: 'Teamspace deleted',
        description: 'Projects stay intact and fall back to organization scope.',
      });
    } catch (error) {
      toast({
        title: 'Failed to delete teamspace',
        description: error instanceof Error ? error.message : 'Please try again.',
        variant: 'destructive',
      });
    }
  }

  async function handleAddMember() {
    if (!membersTarget || memberToAddId === 'none') return;

    try {
      await addMemberMutation.mutateAsync({ userId: memberToAddId, role: memberRoleToAdd });
      setMemberToAddId('none');
      setMemberRoleToAdd('member');
      toast({ title: 'Member added', description: 'Teamspace membership updated.' });
    } catch (error) {
      toast({
        title: 'Failed to add member',
        description: error instanceof Error ? error.message : 'Please try again.',
        variant: 'destructive',
      });
    }
  }

  async function handleChangeMemberRole(memberId: string, role: 'lead' | 'member') {
    try {
      await updateMemberMutation.mutateAsync({ memberId, role });
      toast({ title: 'Member updated', description: 'Role changed successfully.' });
    } catch (error) {
      toast({
        title: 'Failed to update member',
        description: error instanceof Error ? error.message : 'Please try again.',
        variant: 'destructive',
      });
    }
  }

  async function handleRemoveMember(memberId: string) {
    try {
      await removeMemberMutation.mutateAsync(memberId);
      toast({ title: 'Member removed', description: 'They no longer have teamspace scope.' });
    } catch (error) {
      toast({
        title: 'Failed to remove member',
        description: error instanceof Error ? error.message : 'Please try again.',
        variant: 'destructive',
      });
    }
  }

  return (
    <>
      {/* Create / Edit dialog */}
      <Dialog
        open={createOpen || Boolean(editingTeamspace)}
        onOpenChange={(open) => !open && closeFormDialogs()}
      >
        <DialogContent className="sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>
              {editingTeamspace ? 'Edit teamspace' : 'Create teamspace'}
            </DialogTitle>
            <DialogDescription>
              Teamspaces group projects and planning context without creating a separate organization.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-1">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="teamspace-name">Name</Label>
                <Input
                  id="teamspace-name"
                  value={formState.name}
                  onChange={(event) =>
                    setFormState((current) => ({
                      ...current,
                      name: event.target.value,
                      slug:
                        current.slug === '' || current.slug === slugifyTeamspaceName(current.name)
                          ? slugifyTeamspaceName(event.target.value)
                          : current.slug,
                    }))
                  }
                  placeholder="Platform"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="teamspace-slug">Slug</Label>
                <Input
                  id="teamspace-slug"
                  value={formState.slug}
                  onChange={(event) =>
                    setFormState((current) => ({
                      ...current,
                      slug: slugifyTeamspaceName(event.target.value),
                    }))
                  }
                  placeholder="platform"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="teamspace-description">Description</Label>
              <Textarea
                id="teamspace-description"
                rows={2}
                value={formState.description}
                onChange={(event) =>
                  setFormState((current) => ({ ...current, description: event.target.value }))
                }
                placeholder="Own the core platform work and cross-product foundations."
              />
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="teamspace-lead">Lead</Label>
                <Select
                  value={formState.leadId}
                  onValueChange={(value) =>
                    setFormState((current) => ({ ...current, leadId: value }))
                  }
                >
                  <SelectTrigger id="teamspace-lead">
                    <SelectValue placeholder="Use creator as lead" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="creator">Use creator as lead</SelectItem>
                    {organizationMembers.map((member) => (
                      <SelectItem key={member.id} value={member.id}>
                        {member.name || member.email || member.id}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="teamspace-avatar">Avatar URL</Label>
                <Input
                  id="teamspace-avatar"
                  value={formState.avatarUrl}
                  onChange={(event) =>
                    setFormState((current) => ({ ...current, avatarUrl: event.target.value }))
                  }
                  placeholder="https://cdn.example.com/icon.png"
                />
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" size="sm" onClick={closeFormDialogs}>
              Cancel
            </Button>
            <Button
              type="button"
              size="sm"
              onClick={() => void handleSaveTeamspace()}
              disabled={!formState.name.trim() || isMutating}
            >
              {isMutating && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {editingTeamspace ? 'Save changes' : 'Create teamspace'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete confirmation dialog */}
      <Dialog
        open={Boolean(deleteTarget)}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Delete teamspace</DialogTitle>
            <DialogDescription>
              <strong>{deleteTarget?.name}</strong> will be removed. Projects remain but their
              teamspace association is cleared.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setDeleteTarget(null)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              size="sm"
              onClick={() => void handleDeleteTeamspace()}
              disabled={deleteMutation.isPending}
            >
              {deleteMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Members dialog */}
      <Dialog
        open={Boolean(membersTarget)}
        onOpenChange={(open) => {
          if (!open) {
            setMembersTarget(null);
            setMemberToAddId('none');
            setMemberRoleToAdd('member');
          }
        }}
      >
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>{membersTarget?.name} members</DialogTitle>
            <DialogDescription>
              Manage who belongs to this teamspace and who owns the planning context.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-5 lg:grid-cols-[1fr_260px]">
            {/* Current members list */}
            <div className="space-y-2">
              <p className="text-sm font-medium">Current members</p>
              {membersQuery.isLoading ? (
                <div className="flex items-center gap-2 rounded-lg border border-border px-3 py-4 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Loading members...
                </div>
              ) : membersQuery.data?.members.length ? (
                <div className="space-y-2">
                  {membersQuery.data.members.map((member) => (
                    <div
                      key={member.id}
                      className="flex items-center justify-between rounded-lg border border-border px-3 py-2.5"
                    >
                      <div className="flex min-w-0 items-center gap-2.5">
                        <Avatar className="h-8 w-8 rounded-full">
                          <AvatarImage src={member.image || undefined} />
                          <AvatarFallback className="text-xs">
                            {buildInitials(member.name, member.email)}
                          </AvatarFallback>
                        </Avatar>
                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium">
                            {member.name || member.email || member.id}
                          </p>
                          <p className="truncate text-xs text-muted-foreground">{member.email}</p>
                        </div>
                      </div>
                      <div className="flex shrink-0 items-center gap-2">
                        <span
                          className={cn(
                            'chip capitalize',
                            member.teamRole === 'lead' && 'chip-accent'
                          )}
                        >
                          {member.teamRole}
                        </span>
                        {canManage && (
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon" className="h-7 w-7">
                                <MoreVertical className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="data-[state=open]:animate-scale-in">
                              <DropdownMenuItem
                                disabled={member.teamRole === 'lead' || updateMemberMutation.isPending}
                                onClick={() => void handleChangeMemberRole(member.id, 'lead')}
                              >
                                Promote to lead
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                disabled={member.teamRole === 'member' || updateMemberMutation.isPending}
                                onClick={() => void handleChangeMemberRole(member.id, 'member')}
                              >
                                Set as member
                              </DropdownMenuItem>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem
                                className="text-destructive focus:text-destructive"
                                disabled={removeMemberMutation.isPending}
                                onClick={() => void handleRemoveMember(member.id)}
                              >
                                Remove
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="rounded-lg border border-border px-3 py-4 text-sm text-muted-foreground">
                  No explicit members yet. Teamspace-scoped planning still works for linked projects.
                </div>
              )}
            </div>

            {/* Add member panel */}
            <div className="surface-inset rounded-lg p-4 space-y-4">
              <div>
                <p className="text-sm font-medium">Add member</p>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  Assign an org member to this teamspace.
                </p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="teamspace-member-user">Member</Label>
                <Select value={memberToAddId} onValueChange={setMemberToAddId}>
                  <SelectTrigger id="teamspace-member-user">
                    <SelectValue placeholder="Choose a member" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Choose a member</SelectItem>
                    {availableMembers.map((member) => (
                      <SelectItem key={member.id} value={member.id}>
                        {member.name || member.email || member.id}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="teamspace-member-role">Role</Label>
                <Select
                  value={memberRoleToAdd}
                  onValueChange={(value) => setMemberRoleToAdd(value as 'lead' | 'member')}
                >
                  <SelectTrigger id="teamspace-member-role">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="member">Member</SelectItem>
                    <SelectItem value="lead">Lead</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <Button
                type="button"
                size="sm"
                className="w-full"
                onClick={() => void handleAddMember()}
                disabled={!canManage || memberToAddId === 'none' || addMemberMutation.isPending}
              >
                {addMemberMutation.isPending ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <UserPlus className="mr-2 h-4 w-4" />
                )}
                Add to teamspace
              </Button>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setMembersTarget(null)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Teamspace list */}
      <section className="space-y-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="space-y-1">
            <span className="kicker">Planning</span>
            <h2 className="text-lg font-semibold tracking-tight flex items-center gap-2">
              <Layers3 className="h-4 w-4" />
              Teamspaces
            </h2>
            <p className="text-sm text-muted-foreground max-w-prose">
              Planning lanes above individual projects, without splitting the organization.
            </p>
          </div>
          <Button type="button" size="sm" onClick={openCreateDialog} disabled={!canManage}>
            <BadgePlus className="mr-2 h-4 w-4" />
            {canManage ? 'New teamspace' : 'Owner or admin only'}
          </Button>
        </div>

        {!canManage && (
          <div className="panel-warn text-sm">
            Browse only — owners and admins can change the structure.
          </div>
        )}

        {isLoading ? (
          <div className="flex items-center gap-2 rounded-lg border border-border px-3 py-4 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            Loading teamspaces...
          </div>
        ) : teamspaces.length > 0 ? (
          <div className="stagger grid gap-4 xl:grid-cols-2">
            {teamspaces.map((teamspace) => {
              const isActive = currentTeamId === teamspace.id;

              return (
                <div
                  key={teamspace.id}
                  className={cn(
                    'animate-fade-up surface-card rounded-lg p-6 transition-all duration-200 ease-smooth',
                    isActive && 'border-primary/20 bg-primary/5'
                  )}
                >
                  <div className="mb-4 flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <h3 className="truncate text-sm font-semibold">{teamspace.name}</h3>
                        {isActive && <span className="chip-accent text-xs">Active</span>}
                      </div>
                      {teamspace.description && (
                        <p className="mt-1 text-xs text-muted-foreground line-clamp-2">
                          {teamspace.description}
                        </p>
                      )}
                    </div>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0">
                          <MoreVertical className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="data-[state=open]:animate-scale-in">
                        <DropdownMenuItem onClick={() => setMembersTarget(teamspace)}>
                          <Users className="mr-2 h-4 w-4" />
                          Manage members
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          disabled={!canManage}
                          onClick={() => openEditDialog(teamspace)}
                        >
                          <Pencil className="mr-2 h-4 w-4" />
                          Edit
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                          disabled={!canManage}
                          className="text-destructive focus:text-destructive"
                          onClick={() => setDeleteTarget(teamspace)}
                        >
                          <Trash2 className="mr-2 h-4 w-4" />
                          Delete
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>

                  {/* Stat row */}
                  <div className="mb-4 flex items-center gap-4 text-sm">
                    <span className="text-muted-foreground">
                      <span className="font-semibold text-foreground">{teamspace.memberCount ?? 0}</span>{' '}
                      members
                    </span>
                    <span className="text-muted-foreground">
                      <span className="font-semibold text-foreground">{teamspace.projectCount ?? 0}</span>{' '}
                      projects
                    </span>
                    <span className="chip ml-auto text-[10px]">{teamspace.slug}</span>
                  </div>

                  {/* Lead row */}
                  <div className="mb-4 flex items-center justify-between gap-3">
                    <div className="flex min-w-0 items-center gap-2">
                      <Avatar className="h-7 w-7 rounded-full">
                        <AvatarImage src={teamspace.lead?.image || teamspace.avatarUrl || undefined} />
                        <AvatarFallback className="text-xs">
                          {buildInitials(teamspace.lead?.name, teamspace.lead?.email || teamspace.name)}
                        </AvatarFallback>
                      </Avatar>
                      <div className="min-w-0">
                        <p className="truncate text-xs font-medium">
                          {teamspace.lead?.name || teamspace.lead?.email || 'Lead assigned on create'}
                        </p>
                        <p className="text-xs text-muted-foreground">Lead</p>
                      </div>
                    </div>
                    {teamspace.currentUserRole ? (
                      <span
                        className={cn(
                          'chip capitalize',
                          teamspace.currentUserRole === 'lead' && 'chip-accent'
                        )}
                      >
                        {teamspace.currentUserRole}
                      </span>
                    ) : (
                      <span className="chip">
                        <Shield className="mr-1 h-3 w-3 inline" />
                        Org scope
                      </span>
                    )}
                  </div>

                  {/* Actions */}
                  <div className="flex gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setCurrentTeam(isActive ? null : teamspace.id);
                        void queryClient.invalidateQueries({ queryKey: ['projects'] });
                      }}
                    >
                      {isActive ? 'Show all' : 'Focus'}
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => setMembersTarget(teamspace)}
                    >
                      Members
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="flex flex-col items-center gap-3 py-12 text-center">
            <Layers3 className="h-8 w-8 text-muted-foreground/50" />
            <p className="text-sm text-muted-foreground">
              No teamspaces yet. Group projects above the individual project level.
            </p>
            {canManage && (
              <Button type="button" size="sm" onClick={openCreateDialog}>
                Create your first teamspace
              </Button>
            )}
          </div>
        )}
      </section>
    </>
  );
}
