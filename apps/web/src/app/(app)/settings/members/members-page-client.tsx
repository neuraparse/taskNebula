'use client';

import { useState } from 'react';
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
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { useToast } from '@/hooks/use-toast';
import { useOrganization } from '@/lib/hooks/use-organization';
import {
  Users,
  UserPlus,
  MoreVertical,
  Mail,
  Shield,
  Crown,
  Eye,
  User,
  Loader2,
} from 'lucide-react';
import { cn } from '@/lib/utils';

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

const roleIcons = {
  owner: Crown,
  admin: Shield,
  member: User,
  viewer: Eye,
  guest: Mail,
};

// Token-driven role chips
const roleChipClass: Record<Member['role'], string> = {
  owner: 'bg-accent-amber/10 text-accent-amber border border-accent-amber/20',
  admin: 'bg-accent-violet/10 text-accent-violet border border-accent-violet/20',
  member: 'bg-accent-blue/10 text-accent-blue border border-accent-blue/20',
  viewer: 'bg-muted text-muted-foreground border border-border',
  guest: 'bg-accent-emerald/10 text-accent-emerald border border-accent-emerald/20',
};

export function MembersPageClient() {
  const { currentOrganizationId } = useOrganization();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [inviteOpen, setInviteOpen] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState<Member['role']>('member');

  const { data, isLoading } = useQuery({
    queryKey: ['organization-members', currentOrganizationId],
    queryFn: async () => {
      const response = await fetch(`/api/organizations/${currentOrganizationId}/members`);
      if (!response.ok) throw new Error('Failed to fetch members');
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
    mutationFn: async (data: { email: string; role: Member['role'] }) => {
      const response = await fetch(`/api/organizations/${currentOrganizationId}/members`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to invite member');
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['organization-members', currentOrganizationId] });
      toast({ title: 'Invitation sent', description: 'Member invited successfully.' });
      setInviteOpen(false);
      setInviteEmail('');
      setInviteRole('member');
    },
    onError: (error: Error) => {
      toast({ title: 'Failed to invite member', description: error.message, variant: 'destructive' });
    },
  });

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
        throw new Error(error.error || 'Failed to update role');
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['organization-members', currentOrganizationId] });
      toast({ title: 'Role updated', description: 'Member role updated successfully.' });
    },
    onError: (error: Error) => {
      toast({ title: 'Failed to update role', description: error.message, variant: 'destructive' });
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
        throw new Error(error.error || 'Failed to remove member');
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['organization-members', currentOrganizationId] });
      toast({ title: 'Member removed', description: 'Member removed successfully.' });
    },
    onError: (error: Error) => {
      toast({ title: 'Failed to remove member', description: error.message, variant: 'destructive' });
    },
  });

  if (!currentOrganizationId) {
    return (
      <div className="flex h-64 items-center justify-center">
        <p className="text-sm text-muted-foreground">Please select an organization.</p>
      </div>
    );
  }

  return (
    <div className="animate-fade-in space-y-6">
      <div className="surface-card p-6">
        <div className="flex items-center justify-between gap-3 pb-5">
          <div className="space-y-1">
            <span className="kicker">Access</span>
            <h2 className="text-xl font-semibold flex items-center gap-2">
              <Users className="h-5 w-5" />
              Members
              <span className="text-base font-normal text-muted-foreground">
                ({members.length})
              </span>
            </h2>
            <p className="text-sm text-muted-foreground">
              Manage organization members and their roles.
            </p>
          </div>

          <div className="flex items-center gap-2">
            {userRole && (
              <span
                className={cn(
                  'rounded-full px-2.5 py-0.5 text-[11px] font-medium border',
                  roleChipClass[userRole] ?? roleChipClass.member
                )}
              >
                {userRole}
              </span>
            )}
            {isSuperAdmin && (
              <span className="rounded-full border border-accent-violet/20 bg-accent-violet/10 px-2.5 py-0.5 text-[11px] font-medium text-accent-violet">
                Super admin
              </span>
            )}

            <Dialog open={inviteOpen} onOpenChange={setInviteOpen}>
              <DialogTrigger asChild>
                <Button size="sm" disabled={!canInvite}>
                  <UserPlus className="mr-1.5 h-4 w-4" />
                  Invite
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Invite Member</DialogTitle>
                  <DialogDescription>
                    Send an invitation to join this organization.
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="email">Email</Label>
                    <Input
                      id="email"
                      type="email"
                      placeholder="member@example.com"
                      value={inviteEmail}
                      onChange={(e) => setInviteEmail(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="role">Role</Label>
                    <Select
                      value={inviteRole}
                      onValueChange={(value) => setInviteRole(value as Member['role'])}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="member">Member</SelectItem>
                        <SelectItem value="admin">Admin</SelectItem>
                        <SelectItem value="viewer">Viewer</SelectItem>
                        <SelectItem value="guest">Guest</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setInviteOpen(false)}>
                    Cancel
                  </Button>
                  <Button
                    onClick={() => inviteMutation.mutate({ email: inviteEmail, role: inviteRole })}
                    disabled={inviteMutation.isPending || !inviteEmail}
                  >
                    {inviteMutation.isPending && (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    )}
                    Send invitation
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
        </div>

        {!canManage && (
          <div className="mb-4 rounded-lg border border-warning/30 bg-warning/5 px-4 py-3 text-sm text-muted-foreground">
            You can view members but cannot manage them. Only owners and admins can invite, change
            roles, or remove members.
          </div>
        )}

        {isLoading ? (
          <div className="flex items-center justify-center py-10">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <div className="space-y-px">
            {members.map((member) => {
              const RoleIcon = roleIcons[member.role];
              return (
                <div
                  key={member.id}
                  className="flex min-h-[48px] items-center justify-between gap-4 rounded-md px-2 py-2 transition-colors hover:bg-accent/40"
                >
                  <div className="flex items-center gap-3">
                    <Avatar className="h-8 w-8">
                      <AvatarImage src={member.image} alt={member.name} />
                      <AvatarFallback className="text-xs">
                        {member.name.charAt(0).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    <div>
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-medium">{member.name}</p>
                        {member.status === 'invited' && (
                          <span className="chip text-[11px]">Invited</span>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground">{member.email}</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <span
                      className={cn(
                        'flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-medium border',
                        roleChipClass[member.role]
                      )}
                    >
                      <RoleIcon className="h-3 w-3" />
                      {member.role.charAt(0).toUpperCase() + member.role.slice(1)}
                    </span>

                    {member.role !== 'owner' && canManage && (
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-7 w-7">
                            <MoreVertical className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuLabel>Change role</DropdownMenuLabel>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            onClick={() =>
                              updateRoleMutation.mutate({ memberId: member.id, role: 'admin' })
                            }
                            disabled={member.role === 'admin'}
                          >
                            <Shield className="mr-2 h-4 w-4" />
                            Admin
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() =>
                              updateRoleMutation.mutate({ memberId: member.id, role: 'member' })
                            }
                            disabled={member.role === 'member'}
                          >
                            <User className="mr-2 h-4 w-4" />
                            Member
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() =>
                              updateRoleMutation.mutate({ memberId: member.id, role: 'viewer' })
                            }
                            disabled={member.role === 'viewer'}
                          >
                            <Eye className="mr-2 h-4 w-4" />
                            Viewer
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            onClick={() => removeMutation.mutate(member.id)}
                            className="text-destructive"
                            disabled={!canRemove}
                          >
                            Remove member
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
      </div>
    </div>
  );
}
