'use client';

import { useState } from 'react';
import { useProjectMembers, useProjectPermissions, type ProjectMember, type ProjectRole } from '@/lib/hooks/use-project-permissions';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useToast } from '@/hooks/use-toast';
import { Shield, Save, RotateCcw } from 'lucide-react';

// Role info using design token classes
const ROLE_INFO: Record<ProjectRole, { label: string; tokenClass: string; description: string }> = {
  product_owner: {
    label: 'Product Owner',
    tokenClass: 'bg-accent-violet/10 text-accent-violet',
    description: 'Full project control',
  },
  scrum_master: {
    label: 'Scrum Master',
    tokenClass: 'bg-accent-blue/10 text-accent-blue',
    description: 'Sprint & team management',
  },
  tech_lead: {
    label: 'Tech Lead',
    tokenClass: 'bg-accent-indigo/10 text-accent-indigo',
    description: 'Technical decisions',
  },
  developer: {
    label: 'Developer',
    tokenClass: 'bg-accent-emerald/10 text-accent-emerald',
    description: 'Development work',
  },
  qa_engineer: {
    label: 'QA Engineer',
    tokenClass: 'bg-accent-amber/10 text-accent-amber',
    description: 'Testing & QA',
  },
  designer: {
    label: 'Designer',
    tokenClass: 'bg-accent-cyan/10 text-accent-cyan',
    description: 'Design work',
  },
  viewer: {
    label: 'Viewer',
    tokenClass: 'bg-muted text-muted-foreground',
    description: 'Read-only access',
  },
};

// Permission categories grouped by resource for kicker headers
const PERMISSION_CATEGORIES = {
  project: {
    label: 'Project',
    permissions: ['canBrowseProject', 'canAdministerProject', 'canBrowseDocs', 'canCreateDocs', 'canEditDocs', 'canDeleteDocs'],
  },
  chat: {
    label: 'Chat & Calls',
    permissions: ['canBrowseChat', 'canCreateChannels', 'canPostMessages', 'canModerateMessages', 'canStartCalls', 'canManageCalls'],
  },
  sprint: {
    label: 'Sprint',
    permissions: ['canManageSprints', 'canStartSprint', 'canCompleteSprint', 'canDeleteSprint'],
  },
  issue: {
    label: 'Issues',
    permissions: [
      'canCreateIssues',
      'canEditIssues',
      'canEditOwnIssues',
      'canDeleteIssues',
      'canDeleteOwnIssues',
      'canAssignIssues',
      'canAssigneeIssues',
      'canTransitionIssues',
      'canScheduleIssues',
      'canMoveIssues',
      'canLinkIssues',
      'canCloseIssues',
      'canReopenIssues',
    ],
  },
  comment: {
    label: 'Comments',
    permissions: [
      'canAddComments',
      'canEditOwnComments',
      'canEditAllComments',
      'canDeleteOwnComments',
      'canDeleteAllComments',
    ],
  },
  attachment: {
    label: 'Attachments',
    permissions: ['canCreateAttachments', 'canDeleteOwnAttachments', 'canDeleteAllAttachments'],
  },
  member: {
    label: 'Members',
    permissions: ['canManageMembers', 'canInviteMembers', 'canRemoveMembers', 'canChangeRoles'],
  },
  workflow: { label: 'Workflow', permissions: ['canManageWorkflow'] },
  timeTracking: {
    label: 'Time tracking',
    permissions: ['canLogWork', 'canEditOwnWorklogs', 'canEditAllWorklogs', 'canDeleteOwnWorklogs', 'canDeleteAllWorklogs'],
  },
};

// Permission labels + short descriptions for toggles
const PERMISSION_DEFS: Record<string, { label: string; hint?: string }> = {
  canBrowseProject: { label: 'Browse project', hint: 'View project content' },
  canAdministerProject: { label: 'Administer project', hint: 'Full project settings access' },
  canBrowseDocs: { label: 'Browse docs' },
  canCreateDocs: { label: 'Create docs' },
  canEditDocs: { label: 'Edit docs' },
  canDeleteDocs: { label: 'Delete docs' },
  canBrowseChat: { label: 'Browse chat' },
  canCreateChannels: { label: 'Create channels' },
  canPostMessages: { label: 'Post messages' },
  canModerateMessages: { label: 'Moderate messages' },
  canStartCalls: { label: 'Start calls' },
  canManageCalls: { label: 'Manage calls' },
  canManageSprints: { label: 'Manage sprints' },
  canStartSprint: { label: 'Start sprint' },
  canCompleteSprint: { label: 'Complete sprint' },
  canDeleteSprint: { label: 'Delete sprint' },
  canCreateIssues: { label: 'Create issues' },
  canEditIssues: { label: 'Edit all issues' },
  canEditOwnIssues: { label: 'Edit own issues' },
  canDeleteIssues: { label: 'Delete all issues' },
  canDeleteOwnIssues: { label: 'Delete own issues' },
  canAssignIssues: { label: 'Assign issues' },
  canAssigneeIssues: { label: 'Be assigned' },
  canTransitionIssues: { label: 'Transition issues' },
  canScheduleIssues: { label: 'Schedule issues' },
  canMoveIssues: { label: 'Move issues' },
  canLinkIssues: { label: 'Link issues' },
  canCloseIssues: { label: 'Close issues' },
  canReopenIssues: { label: 'Reopen issues' },
  canAddComments: { label: 'Add comments' },
  canEditOwnComments: { label: 'Edit own comments' },
  canEditAllComments: { label: 'Edit all comments' },
  canDeleteOwnComments: { label: 'Delete own comments' },
  canDeleteAllComments: { label: 'Delete all comments' },
  canCreateAttachments: { label: 'Create attachments' },
  canDeleteOwnAttachments: { label: 'Delete own attachments' },
  canDeleteAllAttachments: { label: 'Delete all attachments' },
  canManageWatchers: { label: 'Manage watchers' },
  canViewWatchers: { label: 'View watchers' },
  canManageMembers: { label: 'Manage members' },
  canInviteMembers: { label: 'Invite members' },
  canRemoveMembers: { label: 'Remove members' },
  canChangeRoles: { label: 'Change roles' },
  canManageWorkflow: { label: 'Manage workflow' },
  canLogWork: { label: 'Log work' },
  canEditOwnWorklogs: { label: 'Edit own worklogs' },
  canEditAllWorklogs: { label: 'Edit all worklogs' },
  canDeleteOwnWorklogs: { label: 'Delete own worklogs' },
  canDeleteAllWorklogs: { label: 'Delete all worklogs' },
};

interface PermissionManagerProps {
  projectId: string;
}

export function PermissionManager({ projectId }: PermissionManagerProps) {
  const { members, isLoading, refetch } = useProjectMembers(projectId);
  const { permissions: currentUserPermissions } = useProjectPermissions(projectId);
  const [selectedMember, setSelectedMember] = useState<ProjectMember | null>(null);
  const [editedPermissions, setEditedPermissions] = useState<Record<string, boolean>>({});
  const [editedRole, setEditedRole] = useState<ProjectRole | null>(null);
  const [saving, setSaving] = useState(false);
  const { toast } = useToast();

  const canManage =
    currentUserPermissions.canChangeRoles || currentUserPermissions.isSuperAdmin || currentUserPermissions.isOrgOwner;

  const handleMemberSelect = (member: ProjectMember) => {
    setSelectedMember(member);
    setEditedPermissions({ ...member.permissions });
    setEditedRole(member.role);
  };

  const handlePermissionChange = (key: string, value: boolean) => {
    setEditedPermissions((prev) => ({ ...prev, [key]: value }));
  };

  const handleRoleChange = (role: ProjectRole) => {
    setEditedRole(role);
  };

  const handleSave = async () => {
    if (!selectedMember) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/projects/${projectId}/members/${selectedMember.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role: editedRole, permissions: editedPermissions }),
      });
      if (!res.ok) throw new Error('Failed to save');
      toast({ title: 'Success', description: 'Permissions updated successfully' });
      refetch();
    } catch {
      toast({ title: 'Error', description: 'Failed to update permissions', variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const handleResetToDefaults = async () => {
    if (!selectedMember || !editedRole) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/projects/${projectId}/members/${selectedMember.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role: editedRole, resetToDefaults: true }),
      });
      if (!res.ok) throw new Error('Failed to reset');
      toast({ title: 'Success', description: 'Permissions reset to role defaults' });
      refetch();
      setSelectedMember(null);
    } catch {
      toast({ title: 'Error', description: 'Failed to reset permissions', variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  if (isLoading) {
    return <div className="p-4 text-sm text-muted-foreground">Loading members...</div>;
  }

  return (
    <div className="space-y-6 animate-fade-up">
      <div className="space-y-1">
        <span className="kicker">Permissions</span>
        <h2 className="text-lg font-semibold tracking-tight">Permission management</h2>
        <p className="text-sm text-muted-foreground">Manage team member roles and individual permission overrides.</p>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Members list */}
        <div className="surface-card p-0 lg:col-span-1">
          <div className="border-b border-border/60 px-4 py-3">
            <span className="kicker">Team members</span>
            <p className="mt-1 text-xs text-muted-foreground">{members.length} members</p>
          </div>
          <ScrollArea className="h-[440px]">
            <div className="divide-y divide-border/60">
              {members.map((member) => {
                const roleInfo = ROLE_INFO[member.role];
                const isActive = selectedMember?.id === member.id;
                return (
                  <button
                    key={member.id}
                    type="button"
                    onClick={() => canManage && handleMemberSelect(member)}
                    className={`w-full px-4 py-2.5 text-left transition-colors duration-150 ${
                      isActive ? 'bg-primary/10' : 'hover:bg-accent/40'
                    } ${!canManage ? 'cursor-default' : 'cursor-pointer'}`}
                  >
                    <div className="flex items-center gap-2.5">
                      <Avatar className="h-7 w-7 shrink-0">
                        <AvatarImage src={member.user?.image || ''} />
                        <AvatarFallback className="text-[11px]">
                          {member.user?.name?.charAt(0) || 'U'}
                        </AvatarFallback>
                      </Avatar>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium">{member.user?.name || 'Unknown'}</p>
                        <p className="truncate text-xs text-muted-foreground">{member.user?.email}</p>
                      </div>
                      <span className={`chip shrink-0 text-[10px] ${roleInfo?.tokenClass}`}>
                        {roleInfo?.label}
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>
          </ScrollArea>
        </div>

        {/* Permission editor */}
        <div className="surface-card lg:col-span-2">
          <div className="border-b border-border/60 px-5 py-4">
            <span className="kicker">Editor</span>
            <h3 className="mt-1 text-sm font-semibold tracking-tight">
              {selectedMember ? `Editing: ${selectedMember.user?.name}` : 'Select a member'}
            </h3>
            <p className="mt-0.5 text-xs text-muted-foreground">
              {selectedMember
                ? 'Customize role and individual permissions.'
                : 'Click a team member to edit their permissions.'}
            </p>
          </div>

          <div className="p-5">
            {!canManage && (
              <div className="mb-4 rounded-md border border-warning/30 bg-warning/10 p-3">
                <p className="text-sm text-warning">You don&apos;t have permission to manage team permissions.</p>
              </div>
            )}

            {selectedMember && canManage ? (
              <div className="space-y-5">
                {/* Role selector row */}
                <div className="grid grid-cols-1 md:grid-cols-[240px_1fr] gap-4 items-center">
                  <div className="text-sm font-medium">Role</div>
                  <div className="flex flex-wrap items-center gap-2">
                    <Select value={editedRole || ''} onValueChange={(v) => handleRoleChange(v as ProjectRole)}>
                      <SelectTrigger className="w-56">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {Object.entries(ROLE_INFO).map(([key, info]) => (
                          <SelectItem key={key} value={key}>
                            {info.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Button variant="outline" size="sm" onClick={handleResetToDefaults} disabled={saving}>
                      <RotateCcw className="mr-1.5 h-4 w-4" />
                      Reset defaults
                    </Button>
                  </div>
                </div>

                {/* Permission categories */}
                <ScrollArea className="h-[360px]">
                  <div className="space-y-6 pr-2 stagger">
                    {Object.entries(PERMISSION_CATEGORIES).map(([catKey, category]) => (
                      <div key={catKey} className="space-y-2">
                        <span className="kicker">{category.label}</span>
                        <div className="divide-y divide-border/60 rounded-md border border-border/60 bg-card">
                          {category.permissions.map((permKey) => {
                            const def = PERMISSION_DEFS[permKey] || { label: permKey };
                            return (
                              <label
                                key={permKey}
                                htmlFor={`perm-${permKey}`}
                                className="flex cursor-pointer items-center justify-between gap-3 px-4 py-2.5 transition-colors duration-150 hover:bg-accent/40"
                              >
                                <div className="min-w-0">
                                  <p className="text-sm font-medium">{def.label}</p>
                                  {def.hint ? (
                                    <p className="truncate text-xs text-muted-foreground">{def.hint}</p>
                                  ) : null}
                                </div>
                                <Switch
                                  id={`perm-${permKey}`}
                                  checked={editedPermissions[permKey] || false}
                                  onCheckedChange={(v) => handlePermissionChange(permKey, Boolean(v))}
                                />
                              </label>
                            );
                          })}
                        </div>
                      </div>
                    ))}
                  </div>
                </ScrollArea>

                {/* Save bar */}
                <div className="flex justify-end gap-2 border-t border-border/60 pt-4">
                  <Button variant="outline" onClick={() => setSelectedMember(null)}>
                    Cancel
                  </Button>
                  <Button onClick={handleSave} disabled={saving}>
                    <Save className="mr-1.5 h-4 w-4" />
                    {saving ? 'Saving...' : 'Save changes'}
                  </Button>
                </div>
              </div>
            ) : (
              <div className="flex h-[360px] items-center justify-center text-muted-foreground">
                <div className="space-y-2 text-center">
                  <Shield className="mx-auto h-8 w-8 text-muted-foreground/40" />
                  <p className="text-sm">Select a team member to edit their permissions.</p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
