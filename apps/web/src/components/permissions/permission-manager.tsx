'use client';

import { useState } from 'react';
import { useProjectMembers, useProjectPermissions, type ProjectMember, type ProjectRole } from '@/lib/hooks/use-project-permissions';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useToast } from '@/hooks/use-toast';
import { Shield, Users, Settings2, Save, RotateCcw } from 'lucide-react';

// Role info using design token classes
const ROLE_INFO: Record<ProjectRole, { label: string; tokenClass: string; description: string }> = {
  product_owner: { label: 'Product Owner', tokenClass: 'bg-accent-violet/10 text-accent-violet', description: 'Full project control' },
  scrum_master: { label: 'Scrum Master', tokenClass: 'bg-accent-blue/10 text-accent-blue', description: 'Sprint & team management' },
  tech_lead: { label: 'Tech Lead', tokenClass: 'bg-accent-indigo/10 text-accent-indigo', description: 'Technical decisions' },
  developer: { label: 'Developer', tokenClass: 'bg-accent-emerald/10 text-accent-emerald', description: 'Development work' },
  qa_engineer: { label: 'QA Engineer', tokenClass: 'bg-accent-amber/10 text-accent-amber', description: 'Testing & QA' },
  designer: { label: 'Designer', tokenClass: 'bg-accent-cyan/10 text-accent-cyan', description: 'Design work' },
  viewer: { label: 'Viewer', tokenClass: 'bg-muted text-muted-foreground', description: 'Read-only access' },
};

// Permission categories for organized display
const PERMISSION_CATEGORIES = {
  project: { label: 'Project', permissions: ['canBrowseProject', 'canAdministerProject', 'canBrowseDocs', 'canCreateDocs', 'canEditDocs', 'canDeleteDocs'] },
  chat: { label: 'Chat & Calls', permissions: ['canBrowseChat', 'canCreateChannels', 'canPostMessages', 'canModerateMessages', 'canStartCalls', 'canManageCalls'] },
  sprint: { label: 'Sprint', permissions: ['canManageSprints', 'canStartSprint', 'canCompleteSprint', 'canDeleteSprint'] },
  issue: { label: 'Issues', permissions: ['canCreateIssues', 'canEditIssues', 'canEditOwnIssues', 'canDeleteIssues', 'canDeleteOwnIssues', 'canAssignIssues', 'canAssigneeIssues', 'canTransitionIssues', 'canScheduleIssues', 'canMoveIssues', 'canLinkIssues', 'canCloseIssues', 'canReopenIssues'] },
  comment: { label: 'Comments', permissions: ['canAddComments', 'canEditOwnComments', 'canEditAllComments', 'canDeleteOwnComments', 'canDeleteAllComments'] },
  attachment: { label: 'Attachments', permissions: ['canCreateAttachments', 'canDeleteOwnAttachments', 'canDeleteAllAttachments'] },
  member: { label: 'Members', permissions: ['canManageMembers', 'canInviteMembers', 'canRemoveMembers', 'canChangeRoles'] },
  workflow: { label: 'Workflow', permissions: ['canManageWorkflow'] },
  timeTracking: { label: 'Time Tracking', permissions: ['canLogWork', 'canEditOwnWorklogs', 'canEditAllWorklogs', 'canDeleteOwnWorklogs', 'canDeleteAllWorklogs'] },
};

// Permission labels
const PERMISSION_LABELS: Record<string, string> = {
  canBrowseProject: 'Browse Project',
  canAdministerProject: 'Administer Project',
  canBrowseDocs: 'Browse Docs',
  canCreateDocs: 'Create Docs',
  canEditDocs: 'Edit Docs',
  canDeleteDocs: 'Delete Docs',
  canBrowseChat: 'Browse Chat',
  canCreateChannels: 'Create Channels',
  canPostMessages: 'Post Messages',
  canModerateMessages: 'Moderate Messages',
  canStartCalls: 'Start Calls',
  canManageCalls: 'Manage Calls',
  canManageSprints: 'Manage Sprints',
  canStartSprint: 'Start Sprint',
  canCompleteSprint: 'Complete Sprint',
  canDeleteSprint: 'Delete Sprint',
  canCreateIssues: 'Create Issues',
  canEditIssues: 'Edit All Issues',
  canEditOwnIssues: 'Edit Own Issues',
  canDeleteIssues: 'Delete All Issues',
  canDeleteOwnIssues: 'Delete Own Issues',
  canAssignIssues: 'Assign Issues',
  canAssigneeIssues: 'Be Assigned',
  canTransitionIssues: 'Transition Issues',
  canScheduleIssues: 'Schedule Issues',
  canMoveIssues: 'Move Issues',
  canLinkIssues: 'Link Issues',
  canCloseIssues: 'Close Issues',
  canReopenIssues: 'Reopen Issues',
  canAddComments: 'Add Comments',
  canEditOwnComments: 'Edit Own Comments',
  canEditAllComments: 'Edit All Comments',
  canDeleteOwnComments: 'Delete Own Comments',
  canDeleteAllComments: 'Delete All Comments',
  canCreateAttachments: 'Create Attachments',
  canDeleteOwnAttachments: 'Delete Own Attachments',
  canDeleteAllAttachments: 'Delete All Attachments',
  canManageWatchers: 'Manage Watchers',
  canViewWatchers: 'View Watchers',
  canManageMembers: 'Manage Members',
  canInviteMembers: 'Invite Members',
  canRemoveMembers: 'Remove Members',
  canChangeRoles: 'Change Roles',
  canManageWorkflow: 'Manage Workflow',
  canLogWork: 'Log Work',
  canEditOwnWorklogs: 'Edit Own Worklogs',
  canEditAllWorklogs: 'Edit All Worklogs',
  canDeleteOwnWorklogs: 'Delete Own Worklogs',
  canDeleteAllWorklogs: 'Delete All Worklogs',
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

  const canManage = currentUserPermissions.canChangeRoles || currentUserPermissions.isSuperAdmin || currentUserPermissions.isOrgOwner;

  const handleMemberSelect = (member: ProjectMember) => {
    setSelectedMember(member);
    setEditedPermissions({ ...member.permissions });
    setEditedRole(member.role);
  };

  const handlePermissionChange = (key: string, value: boolean) => {
    setEditedPermissions(prev => ({ ...prev, [key]: value }));
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
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        <Shield className="h-5 w-5 text-primary" />
        <div>
          <h2 className="text-lg font-semibold">Permission Management</h2>
          <p className="text-sm text-muted-foreground">Manage team member roles and permissions</p>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Members list */}
        <Card className="lg:col-span-1">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-sm">
              <Users className="h-4 w-4" />
              Team Members
            </CardTitle>
            <CardDescription>{members.length} members</CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            <ScrollArea className="h-[440px]">
              <div className="space-y-px px-3 pb-3">
                {members.map((member) => {
                  const roleInfo = ROLE_INFO[member.role];
                  return (
                    <button
                      key={member.id}
                      type="button"
                      onClick={() => canManage && handleMemberSelect(member)}
                      className={`w-full rounded-md px-2 py-2.5 text-left transition-colors duration-200 ${
                        selectedMember?.id === member.id
                          ? 'bg-primary/10 ring-1 ring-primary/20'
                          : 'hover:bg-accent/50'
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
          </CardContent>
        </Card>

        {/* Permission editor */}
        <Card className="lg:col-span-2">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-sm">
              <Settings2 className="h-4 w-4" />
              {selectedMember ? `Editing: ${selectedMember.user?.name}` : 'Select a Member'}
            </CardTitle>
            <CardDescription>
              {selectedMember
                ? 'Customize role and individual permissions'
                : 'Click on a team member to edit their permissions'}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {!canManage && (
              <div className="mb-4 rounded-md border border-warning/30 bg-warning/10 p-3">
                <p className="text-sm text-warning">
                  You don&apos;t have permission to manage team permissions.
                </p>
              </div>
            )}

            {selectedMember && canManage ? (
              <div className="space-y-5">
                {/* Role selector */}
                <div className="flex items-center gap-3">
                  <label className="text-sm font-medium text-muted-foreground w-12 shrink-0">Role</label>
                  <Select value={editedRole || ''} onValueChange={(v) => handleRoleChange(v as ProjectRole)}>
                    <SelectTrigger className="w-48">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {Object.entries(ROLE_INFO).map(([key, info]) => (
                        <SelectItem key={key} value={key}>
                          <div className="flex items-center gap-2">
                            <span className={`inline-block h-2 w-2 rounded-full ${info.tokenClass}`} />
                            {info.label}
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Button variant="outline" size="sm" onClick={handleResetToDefaults} disabled={saving}>
                    <RotateCcw className="mr-1.5 h-4 w-4" />
                    Reset defaults
                  </Button>
                </div>

                {/* Permission categories */}
                <ScrollArea className="h-[360px]">
                  <div className="space-y-5 pr-2">
                    {Object.entries(PERMISSION_CATEGORIES).map(([catKey, category]) => (
                      <div key={catKey} className="space-y-2">
                        <span className="kicker">{category.label}</span>
                        <div className="grid grid-cols-1 gap-1 md:grid-cols-2">
                          {category.permissions.map((permKey) => (
                            <label
                              key={permKey}
                              className="flex cursor-pointer items-center gap-2.5 rounded-md px-2 py-1.5 transition-colors duration-200 hover:bg-accent/50"
                            >
                              <Checkbox
                                id={permKey}
                                checked={editedPermissions[permKey] || false}
                                onCheckedChange={(v) => handlePermissionChange(permKey, Boolean(v))}
                                className="shrink-0"
                              />
                              <span className="text-sm">{PERMISSION_LABELS[permKey] || permKey}</span>
                            </label>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </ScrollArea>

                {/* Save bar */}
                <div className="flex justify-end gap-2 border-t border-border pt-4">
                  <Button variant="outline" onClick={() => setSelectedMember(null)}>
                    Cancel
                  </Button>
                  <Button onClick={handleSave} disabled={saving}>
                    <Save className="mr-1.5 h-4 w-4" />
                    {saving ? 'Saving...' : 'Save Changes'}
                  </Button>
                </div>
              </div>
            ) : (
              <div className="flex h-[360px] items-center justify-center text-muted-foreground">
                <div className="text-center">
                  <Shield className="mx-auto mb-3 h-10 w-10 opacity-20" />
                  <p className="text-sm">Select a team member to view and edit their permissions</p>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
