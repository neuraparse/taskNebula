'use client';

import { useEffect, useMemo, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
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
  const slug = value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 100);

  return slug || '';
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
    const teamspaceMemberIds = new Set((membersQuery.data?.members ?? []).map((member) => member.id));
    return organizationMembers.filter((member) => !teamspaceMemberIds.has(member.id));
  }, [membersQuery.data?.members, organizationMembers]);

  const isMutating =
    createMutation.isPending ||
    updateMutation.isPending ||
    deleteMutation.isPending ||
    addMemberMutation.isPending ||
    updateMemberMutation.isPending ||
    removeMemberMutation.isPending;

  const teamspaceCards = teamspaces.length > 0;

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
    if (!formState.name.trim()) {
      return;
    }

    const payload = {
      name: formState.name.trim(),
      slug: formState.slug.trim() || undefined,
      description: formState.description.trim() || undefined,
      avatarUrl: formState.avatarUrl.trim() || undefined,
      leadId: formState.leadId === 'creator' ? null : formState.leadId,
    };

    try {
      if (editingTeamspace) {
        await updateMutation.mutateAsync({
          teamspaceId: editingTeamspace.id,
          payload,
        });
        toast({
          title: 'Teamspace updated',
          description: `${formState.name.trim()} is ready to use.`,
        });
      } else {
        await createMutation.mutateAsync(payload);
        toast({
          title: 'Teamspace created',
          description: `${formState.name.trim()} is now available across projects and views.`,
        });
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
    if (!deleteTarget) {
      return;
    }

    try {
      await deleteMutation.mutateAsync(deleteTarget.id);
      if (currentTeamId === deleteTarget.id) {
        setCurrentTeam(null);
      }
      setDeleteTarget(null);
      toast({
        title: 'Teamspace deleted',
        description: 'Projects stay intact and simply fall back to the organization scope.',
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
    if (!membersTarget || memberToAddId === 'none') {
      return;
    }

    try {
      await addMemberMutation.mutateAsync({
        userId: memberToAddId,
        role: memberRoleToAdd,
      });
      setMemberToAddId('none');
      setMemberRoleToAdd('member');
      toast({
        title: 'Member added',
        description: 'The teamspace membership was updated.',
      });
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
      toast({
        title: 'Member updated',
        description: 'The teamspace role changed successfully.',
      });
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
      toast({
        title: 'Member removed',
        description: 'They no longer inherit teamspace-specific scope.',
      });
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
      <Dialog open={createOpen || Boolean(editingTeamspace)} onOpenChange={(open) => !open && closeFormDialogs()}>
        <DialogContent className="sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>{editingTeamspace ? 'Edit teamspace' : 'Create teamspace'}</DialogTitle>
            <DialogDescription>
              Teamspaces group projects, views, and planning context without creating a second organization.
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
                rows={3}
                value={formState.description}
                onChange={(event) =>
                  setFormState((current) => ({ ...current, description: event.target.value }))
                }
                placeholder="Own the core platform work, delivery flow, and cross-product foundations."
              />
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="teamspace-lead">Lead</Label>
                <Select
                  value={formState.leadId}
                  onValueChange={(value) => setFormState((current) => ({ ...current, leadId: value }))}
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
                  placeholder="https://cdn.example.com/teamspace.png"
                />
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={closeFormDialogs}>
              Cancel
            </Button>
            <Button type="button" onClick={() => void handleSaveTeamspace()} disabled={!formState.name.trim() || isMutating}>
              {isMutating ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              {editingTeamspace ? 'Save changes' : 'Create teamspace'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(deleteTarget)} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Delete teamspace</DialogTitle>
            <DialogDescription>
              {deleteTarget?.name} will be removed. Projects remain, but their teamspace association is cleared automatically.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteTarget(null)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={() => void handleDeleteTeamspace()} disabled={deleteMutation.isPending}>
              {deleteMutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Delete teamspace
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

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
        <DialogContent className="sm:max-w-3xl">
          <DialogHeader>
            <DialogTitle>{membersTarget?.name} members</DialogTitle>
            <DialogDescription>
              Manage who belongs to this Teamspace and who owns the planning context.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_280px]">
            <div className="space-y-3">
              <div className="space-y-2">
                <h3 className="text-sm font-medium text-foreground">Current members</h3>
                <div className="space-y-2">
                  {membersQuery.isLoading ? (
                    <div className="flex items-center gap-2 rounded-lg border px-3 py-4 text-sm text-muted-foreground">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Loading teamspace members...
                    </div>
                  ) : membersQuery.data?.members.length ? (
                    membersQuery.data.members.map((member) => (
                      <div
                        key={member.id}
                        className="flex items-center justify-between rounded-lg border px-3 py-3"
                      >
                        <div className="flex min-w-0 items-center gap-3">
                          <Avatar className="h-9 w-9 rounded-full">
                            <AvatarImage src={member.image || undefined} />
                            <AvatarFallback>{buildInitials(member.name, member.email)}</AvatarFallback>
                          </Avatar>
                          <div className="min-w-0">
                            <p className="truncate text-sm font-medium">
                              {member.name || member.email || member.id}
                            </p>
                            <p className="truncate text-xs text-muted-foreground">{member.email}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge variant={member.teamRole === 'lead' ? 'default' : 'outline'}>
                            {member.teamRole}
                          </Badge>
                          {canManage ? (
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="icon" className="h-8 w-8">
                                  <MoreVertical className="h-4 w-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                <DropdownMenuLabel>Member actions</DropdownMenuLabel>
                                <DropdownMenuSeparator />
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
                                  Remove from teamspace
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          ) : null}
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="rounded-lg border px-3 py-4 text-sm text-muted-foreground">
                      No explicit members yet. Teamspace-scoped planning will still work for linked projects.
                    </div>
                  )}
                </div>
              </div>
            </div>

            <Card className="rounded-none">
              <CardHeader>
                <CardTitle className="text-base">Add member</CardTitle>
                <CardDescription>
                  Pick an existing organization member and assign their Teamspace role.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="teamspace-member-user">Organization member</Label>
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
                  <Select value={memberRoleToAdd} onValueChange={(value) => setMemberRoleToAdd(value as 'lead' | 'member')}>
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
                  className="w-full"
                  onClick={() => void handleAddMember()}
                  disabled={!canManage || memberToAddId === 'none' || addMemberMutation.isPending}
                >
                  {addMemberMutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <UserPlus className="mr-2 h-4 w-4" />}
                  Add to teamspace
                </Button>
              </CardContent>
            </Card>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setMembersTarget(null)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Card>
        <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="space-y-1">
            <CardTitle className="flex items-center gap-2">
              <Layers3 className="h-4 w-4 text-muted-foreground" />
              Teamspaces
            </CardTitle>
            <CardDescription>
              Create planning lanes above individual projects without fragmenting the organization.
            </CardDescription>
          </div>
          <Button type="button" onClick={openCreateDialog} disabled={!canManage}>
            <BadgePlus className="mr-2 h-4 w-4" />
            {canManage ? 'New teamspace' : 'Owner or admin only'}
          </Button>
        </CardHeader>
        <CardContent className="space-y-4">
          {!canManage ? (
            <div className="rounded-lg border border-yellow-500/30 bg-yellow-500/10 px-4 py-3 text-sm text-yellow-700 dark:text-yellow-200">
              You can browse Teamspaces here, but only owners and admins can change the structure.
            </div>
          ) : null}

          {isLoading ? (
            <div className="flex items-center gap-2 rounded-lg border px-3 py-4 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              Loading teamspaces...
            </div>
          ) : teamspaceCards ? (
            <div className="grid gap-4 xl:grid-cols-2">
              {teamspaces.map((teamspace) => {
                const isActive = currentTeamId === teamspace.id;

                return (
                  <Card
                    key={teamspace.id}
                    className={cn(
                      'rounded-none border-border/70',
                      isActive ? 'border-primary/50 bg-primary/5' : 'bg-card'
                    )}
                  >
                    <CardContent className="flex h-full flex-col gap-4 p-5">
                      <div className="flex items-start justify-between gap-4">
                        <div className="min-w-0 space-y-2">
                          <div className="flex items-center gap-2">
                            <h3 className="truncate text-lg font-semibold">{teamspace.name}</h3>
                            {isActive ? <Badge>Active</Badge> : null}
                          </div>
                          <p className="text-sm text-muted-foreground">
                            {teamspace.description || 'No description yet. Use this Teamspace to cluster related projects and planning views.'}
                          </p>
                        </div>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-8 w-8">
                              <MoreVertical className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuLabel>Teamspace actions</DropdownMenuLabel>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem onClick={() => setMembersTarget(teamspace)}>
                              <Users className="mr-2 h-4 w-4" />
                              Manage members
                            </DropdownMenuItem>
                            <DropdownMenuItem disabled={!canManage} onClick={() => openEditDialog(teamspace)}>
                              <Pencil className="mr-2 h-4 w-4" />
                              Edit teamspace
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                              disabled={!canManage}
                              className="text-destructive focus:text-destructive"
                              onClick={() => setDeleteTarget(teamspace)}
                            >
                              <Trash2 className="mr-2 h-4 w-4" />
                              Delete teamspace
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>

                      <div className="grid gap-3 sm:grid-cols-3">
                        <div className="rounded-lg border px-3 py-3">
                          <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">Members</p>
                          <p className="mt-1 text-lg font-semibold">{teamspace.memberCount ?? 0}</p>
                        </div>
                        <div className="rounded-lg border px-3 py-3">
                          <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">Projects</p>
                          <p className="mt-1 text-lg font-semibold">{teamspace.projectCount ?? 0}</p>
                        </div>
                        <div className="rounded-lg border px-3 py-3">
                          <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">Scope</p>
                          <p className="mt-1 text-sm font-medium">{teamspace.slug}</p>
                        </div>
                      </div>

                      <div className="flex items-center justify-between gap-3 rounded-lg border px-3 py-3">
                        <div className="flex items-center gap-3">
                          <Avatar className="h-10 w-10 rounded-full">
                            <AvatarImage src={teamspace.lead?.image || teamspace.avatarUrl || undefined} />
                            <AvatarFallback>
                              {buildInitials(teamspace.lead?.name, teamspace.lead?.email || teamspace.name)}
                            </AvatarFallback>
                          </Avatar>
                          <div>
                            <p className="text-sm font-medium">
                              {teamspace.lead?.name || teamspace.lead?.email || 'Lead assigned on create'}
                            </p>
                            <p className="text-xs text-muted-foreground">Teamspace lead</p>
                          </div>
                        </div>
                        {teamspace.currentUserRole ? (
                          <Badge variant={teamspace.currentUserRole === 'lead' ? 'default' : 'outline'} className="capitalize">
                            {teamspace.currentUserRole}
                          </Badge>
                        ) : (
                          <Badge variant="outline">
                            <Shield className="mr-1 h-3 w-3" />
                            Organization scope
                          </Badge>
                        )}
                      </div>

                      <div className="flex justify-between gap-3">
                        <Button
                          type="button"
                          variant="outline"
                          onClick={() => {
                            setCurrentTeam(isActive ? null : teamspace.id);
                            void queryClient.invalidateQueries({ queryKey: ['projects'] });
                          }}
                        >
                          {isActive ? 'Show all Teamspaces' : 'Focus this Teamspace'}
                        </Button>
                        <Button type="button" variant="ghost" onClick={() => setMembersTarget(teamspace)}>
                          Manage members
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          ) : (
            <div className="rounded-lg border border-dashed px-4 py-8 text-center">
              <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-lg border bg-card">
                <Layers3 className="h-5 w-5 text-muted-foreground" />
              </div>
              <h3 className="text-base font-semibold">No teamspaces yet</h3>
              <p className="mt-2 text-sm text-muted-foreground">
                Start with a Teamspace when you want shared views, ownership, and planning scope above individual projects.
              </p>
              {canManage ? (
                <Button type="button" className="mt-4" onClick={openCreateDialog}>
                  Create your first teamspace
                </Button>
              ) : null}
            </div>
          )}
        </CardContent>
      </Card>
    </>
  );
}
