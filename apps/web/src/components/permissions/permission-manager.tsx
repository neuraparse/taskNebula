'use client';

import { useState } from 'react';
import { useProjectMembers, useProjectPermissions, type ProjectMember, type ProjectRole } from '@/lib/hooks/use-project-permissions';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { useToast } from '@/hooks/use-toast';
import { Shield, Users, Settings2, Save, RotateCcw } from 'lucide-react';

// Role info with colors
const ROLE_INFO: Record<ProjectRole, { label: string; color: string; description: string }> = {
  product_owner: { label: 'Product Owner', color: 'bg-purple-500', description: 'Full project control' },
  scrum_master: { label: 'Scrum Master', color: 'bg-blue-500', description: 'Sprint & team management' },
  tech_lead: { label: 'Tech Lead', color: 'bg-indigo-500', description: 'Technical decisions' },
  developer: { label: 'Developer', color: 'bg-green-500', description: 'Development work' },
  qa_engineer: { label: 'QA Engineer', color: 'bg-orange-500', description: 'Testing & QA' },
  designer: { label: 'Designer', color: 'bg-pink-500', description: 'Design work' },
  viewer: { label: 'Viewer', color: 'bg-gray-500', description: 'Read-only access' },
};

// Permission categories for organized display
const PERMISSION_CATEGORIES = {
  project: { label: 'Project', permissions: ['canBrowseProject', 'canAdministerProject'] },
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
    return <div className="p-4">Loading members...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold flex items-center gap-2">
            <Shield className="h-6 w-6" /> Permission Management
          </h2>
          <p className="text-muted-foreground">Manage team member roles and permissions</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Members List */}
        <Card className="lg:col-span-1">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" /> Team Members
            </CardTitle>
            <CardDescription>{members.length} members</CardDescription>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-[500px]">
              <div className="space-y-2">
                {members.map((member) => (
                  <div
                    key={member.id}
                    onClick={() => canManage && handleMemberSelect(member)}
                    className={`p-3 rounded-lg border cursor-pointer transition-colors ${
                      selectedMember?.id === member.id
                        ? 'border-primary bg-primary/5'
                        : 'hover:bg-muted/50'
                    } ${!canManage ? 'cursor-default' : ''}`}
                  >
                    <div className="flex items-center gap-3">
                      <Avatar className="h-10 w-10">
                        <AvatarImage src={member.user?.image || ''} />
                        <AvatarFallback>
                          {member.user?.name?.charAt(0) || 'U'}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium truncate">{member.user?.name || 'Unknown'}</p>
                        <p className="text-sm text-muted-foreground truncate">{member.user?.email}</p>
                      </div>
                      <Badge className={`${ROLE_INFO[member.role]?.color} text-white`}>
                        {ROLE_INFO[member.role]?.label}
                      </Badge>
                    </div>
                  </div>
                ))}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>

        {/* Permission Editor */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Settings2 className="h-5 w-5" />
              {selectedMember ? `Edit: ${selectedMember.user?.name}` : 'Select a Member'}
            </CardTitle>
            <CardDescription>
              {selectedMember
                ? 'Customize role and individual permissions'
                : 'Click on a team member to edit their permissions'}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {!canManage && (
              <div className="p-4 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg mb-4">
                <p className="text-yellow-800 dark:text-yellow-200">
                  You don't have permission to manage team permissions.
                </p>
              </div>
            )}

            {selectedMember && canManage ? (
              <div className="space-y-6">
                {/* Role Selector */}
                <div className="flex items-center gap-4">
                  <label className="font-medium w-24">Role:</label>
                  <Select value={editedRole || ''} onValueChange={(v) => handleRoleChange(v as ProjectRole)}>
                    <SelectTrigger className="w-48">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {Object.entries(ROLE_INFO).map(([key, info]) => (
                        <SelectItem key={key} value={key}>
                          <div className="flex items-center gap-2">
                            <div className={`w-2 h-2 rounded-full ${info.color}`} />
                            {info.label}
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Button variant="outline" size="sm" onClick={handleResetToDefaults} disabled={saving}>
                    <RotateCcw className="h-4 w-4 mr-1" /> Reset to Defaults
                  </Button>
                </div>

                <Separator />

                {/* Permission Categories */}
                <ScrollArea className="h-[400px]">
                  <div className="space-y-6 pr-4">
                    {Object.entries(PERMISSION_CATEGORIES).map(([catKey, category]) => (
                      <div key={catKey} className="space-y-3">
                        <h4 className="font-semibold text-sm uppercase tracking-wide text-muted-foreground">
                          {category.label}
                        </h4>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                          {category.permissions.map((permKey) => (
                            <div key={permKey} className="flex items-center justify-between p-2 rounded border">
                              <span className="text-sm">{PERMISSION_LABELS[permKey] || permKey}</span>
                              <Switch
                                checked={editedPermissions[permKey] || false}
                                onCheckedChange={(v) => handlePermissionChange(permKey, v)}
                              />
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </ScrollArea>

                {/* Save Button */}
                <div className="flex justify-end gap-2 pt-4 border-t">
                  <Button variant="outline" onClick={() => setSelectedMember(null)}>
                    Cancel
                  </Button>
                  <Button onClick={handleSave} disabled={saving}>
                    <Save className="h-4 w-4 mr-1" /> {saving ? 'Saving...' : 'Save Changes'}
                  </Button>
                </div>
              </div>
            ) : (
              <div className="h-[400px] flex items-center justify-center text-muted-foreground">
                <div className="text-center">
                  <Shield className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>Select a team member to view and edit their permissions</p>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

