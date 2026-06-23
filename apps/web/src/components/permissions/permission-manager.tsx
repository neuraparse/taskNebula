'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { useQueryClient } from '@tanstack/react-query';
import {
  useProjectMembers,
  useProjectPermissions,
  type ProjectMember,
  type ProjectRole,
} from '@/lib/hooks/use-project-permissions';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Shield, Save, RotateCcw, Trash2, UserPlus } from 'lucide-react';
import { AddProjectMemberDialog } from './add-project-member-dialog';

// Role info using design token classes
const ROLE_INFO: Record<ProjectRole, { labelKey: string; tokenClass: string }> = {
  product_owner: {
    labelKey: 'pr_product_owner',
    tokenClass: 'bg-accent-violet/10 text-accent-violet',
  },
  scrum_master: {
    labelKey: 'pr_scrum_master',
    tokenClass: 'bg-accent-blue/10 text-accent-blue',
  },
  tech_lead: {
    labelKey: 'pr_tech_lead',
    tokenClass: 'bg-accent-indigo/10 text-accent-indigo',
  },
  developer: {
    labelKey: 'pr_developer',
    tokenClass: 'bg-accent-emerald/10 text-accent-emerald',
  },
  qa_engineer: {
    labelKey: 'pr_qa_engineer',
    tokenClass: 'bg-accent-amber/10 text-accent-amber',
  },
  designer: {
    labelKey: 'pr_designer',
    tokenClass: 'bg-accent-cyan/10 text-accent-cyan',
  },
  viewer: {
    labelKey: 'pr_viewer',
    tokenClass: 'bg-muted text-muted-foreground',
  },
};

// Permission categories grouped by resource for kicker headers
const PERMISSION_CATEGORIES = {
  project: {
    labelKey: 'pm_cat_project',
    permissions: [
      'canBrowseProject',
      'canAdministerProject',
      'canBrowseDocs',
      'canCreateDocs',
      'canEditDocs',
      'canDeleteDocs',
    ],
  },
  chat: {
    labelKey: 'pm_cat_chat',
    permissions: [
      'canBrowseChat',
      'canCreateChannels',
      'canPostMessages',
      'canModerateMessages',
      'canStartCalls',
      'canManageCalls',
    ],
  },
  sprint: {
    labelKey: 'pm_cat_sprint',
    permissions: ['canManageSprints', 'canStartSprint', 'canCompleteSprint', 'canDeleteSprint'],
  },
  issue: {
    labelKey: 'pm_cat_issues',
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
    labelKey: 'pm_cat_comments',
    permissions: [
      'canAddComments',
      'canEditOwnComments',
      'canEditAllComments',
      'canDeleteOwnComments',
      'canDeleteAllComments',
    ],
  },
  attachment: {
    labelKey: 'pm_cat_attachments',
    permissions: ['canCreateAttachments', 'canDeleteOwnAttachments', 'canDeleteAllAttachments'],
  },
  member: {
    labelKey: 'pm_cat_members',
    permissions: ['canManageMembers', 'canInviteMembers', 'canRemoveMembers', 'canChangeRoles'],
  },
  workflow: { labelKey: 'pm_cat_workflow', permissions: ['canManageWorkflow'] },
  timeTracking: {
    labelKey: 'pm_cat_time_tracking',
    permissions: [
      'canLogWork',
      'canEditOwnWorklogs',
      'canEditAllWorklogs',
      'canDeleteOwnWorklogs',
      'canDeleteAllWorklogs',
    ],
  },
};

// Permission label/hint translation keys for toggles
const PERMISSION_DEFS: Record<string, { labelKey: string; hintKey?: string }> = {
  canBrowseProject: {
    labelKey: 'pm_perm_canBrowseProject',
    hintKey: 'pm_perm_canBrowseProject_hint',
  },
  canAdministerProject: {
    labelKey: 'pm_perm_canAdministerProject',
    hintKey: 'pm_perm_canAdministerProject_hint',
  },
  canBrowseDocs: { labelKey: 'pm_perm_canBrowseDocs' },
  canCreateDocs: { labelKey: 'pm_perm_canCreateDocs' },
  canEditDocs: { labelKey: 'pm_perm_canEditDocs' },
  canDeleteDocs: { labelKey: 'pm_perm_canDeleteDocs' },
  canBrowseChat: { labelKey: 'pm_perm_canBrowseChat' },
  canCreateChannels: { labelKey: 'pm_perm_canCreateChannels' },
  canPostMessages: { labelKey: 'pm_perm_canPostMessages' },
  canModerateMessages: { labelKey: 'pm_perm_canModerateMessages' },
  canStartCalls: { labelKey: 'pm_perm_canStartCalls' },
  canManageCalls: { labelKey: 'pm_perm_canManageCalls' },
  canManageSprints: { labelKey: 'pm_perm_canManageSprints' },
  canStartSprint: { labelKey: 'pm_perm_canStartSprint' },
  canCompleteSprint: { labelKey: 'pm_perm_canCompleteSprint' },
  canDeleteSprint: { labelKey: 'pm_perm_canDeleteSprint' },
  canCreateIssues: { labelKey: 'pm_perm_canCreateIssues' },
  canEditIssues: { labelKey: 'pm_perm_canEditIssues' },
  canEditOwnIssues: { labelKey: 'pm_perm_canEditOwnIssues' },
  canDeleteIssues: { labelKey: 'pm_perm_canDeleteIssues' },
  canDeleteOwnIssues: { labelKey: 'pm_perm_canDeleteOwnIssues' },
  canAssignIssues: { labelKey: 'pm_perm_canAssignIssues' },
  canAssigneeIssues: { labelKey: 'pm_perm_canAssigneeIssues' },
  canTransitionIssues: { labelKey: 'pm_perm_canTransitionIssues' },
  canScheduleIssues: { labelKey: 'pm_perm_canScheduleIssues' },
  canMoveIssues: { labelKey: 'pm_perm_canMoveIssues' },
  canLinkIssues: { labelKey: 'pm_perm_canLinkIssues' },
  canCloseIssues: { labelKey: 'pm_perm_canCloseIssues' },
  canReopenIssues: { labelKey: 'pm_perm_canReopenIssues' },
  canAddComments: { labelKey: 'pm_perm_canAddComments' },
  canEditOwnComments: { labelKey: 'pm_perm_canEditOwnComments' },
  canEditAllComments: { labelKey: 'pm_perm_canEditAllComments' },
  canDeleteOwnComments: { labelKey: 'pm_perm_canDeleteOwnComments' },
  canDeleteAllComments: { labelKey: 'pm_perm_canDeleteAllComments' },
  canCreateAttachments: { labelKey: 'pm_perm_canCreateAttachments' },
  canDeleteOwnAttachments: { labelKey: 'pm_perm_canDeleteOwnAttachments' },
  canDeleteAllAttachments: { labelKey: 'pm_perm_canDeleteAllAttachments' },
  canManageWatchers: { labelKey: 'pm_perm_canManageWatchers' },
  canViewWatchers: { labelKey: 'pm_perm_canViewWatchers' },
  canManageMembers: { labelKey: 'pm_perm_canManageMembers' },
  canInviteMembers: { labelKey: 'pm_perm_canInviteMembers' },
  canRemoveMembers: { labelKey: 'pm_perm_canRemoveMembers' },
  canChangeRoles: { labelKey: 'pm_perm_canChangeRoles' },
  canManageWorkflow: { labelKey: 'pm_perm_canManageWorkflow' },
  canLogWork: { labelKey: 'pm_perm_canLogWork' },
  canEditOwnWorklogs: { labelKey: 'pm_perm_canEditOwnWorklogs' },
  canEditAllWorklogs: { labelKey: 'pm_perm_canEditAllWorklogs' },
  canDeleteOwnWorklogs: { labelKey: 'pm_perm_canDeleteOwnWorklogs' },
  canDeleteAllWorklogs: { labelKey: 'pm_perm_canDeleteAllWorklogs' },
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
  const [addOpen, setAddOpen] = useState(false);
  const [removingMemberId, setRemovingMemberId] = useState<string | null>(null);
  const t = useTranslations('projectConfig');
  const tActions = useTranslations('actions');
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const canManage =
    currentUserPermissions.canChangeRoles ||
    currentUserPermissions.isSuperAdmin ||
    currentUserPermissions.isOrgAdmin ||
    currentUserPermissions.isOrgOwner;
  const canAdd =
    canManage || currentUserPermissions.canInviteMembers || currentUserPermissions.canManageMembers;
  const canRemove =
    currentUserPermissions.isSuperAdmin ||
    currentUserPermissions.isOrgAdmin ||
    currentUserPermissions.isOrgOwner ||
    currentUserPermissions.canManageMembers ||
    currentUserPermissions.canRemoveMembers;
  const existingMemberUserIds = members
    .map((m) => m.user?.id)
    .filter((id): id is string => typeof id === 'string');

  const invalidateMemberCaches = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ['projects'] }),
      queryClient.invalidateQueries({ queryKey: ['project', projectId] }),
      queryClient.invalidateQueries({ queryKey: ['project-members'] }),
      queryClient.invalidateQueries({ queryKey: ['project-members', projectId] }),
      queryClient.invalidateQueries({ queryKey: ['project-permissions', projectId] }),
      queryClient.invalidateQueries({ queryKey: ['org-members-for-project-add'] }),
    ]);
  };

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
      if (!res.ok) throw new Error(t('pm_update_failed'));
      toast({ title: t('success'), description: t('pm_update_success') });
      await refetch();
      await invalidateMemberCaches();
    } catch {
      toast({ title: t('error'), description: t('pm_update_failed'), variant: 'destructive' });
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
      if (!res.ok) throw new Error(t('pm_reset_failed'));
      toast({ title: t('success'), description: t('pm_reset_success') });
      await refetch();
      await invalidateMemberCaches();
      setSelectedMember(null);
    } catch {
      toast({ title: t('error'), description: t('pm_reset_failed'), variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const handleRemoveMember = async (member: ProjectMember) => {
    setRemovingMemberId(member.id);
    try {
      const res = await fetch(`/api/projects/${projectId}/members/${member.id}`, {
        method: 'DELETE',
      });
      if (!res.ok) {
        const payload = await res.json().catch(() => ({ error: t('pm_remove_failed') }));
        throw new Error(payload.error || t('pm_remove_failed'));
      }
      toast({ title: t('success'), description: t('pm_remove_success') });
      if (selectedMember?.id === member.id) {
        setSelectedMember(null);
      }
      await refetch();
      await invalidateMemberCaches();
    } catch {
      toast({
        title: t('error'),
        description: t('pm_remove_failed'),
        variant: 'destructive',
      });
    } finally {
      setRemovingMemberId(null);
    }
  };

  if (isLoading) {
    return <div className="text-muted-foreground p-4 text-sm">{t('pm_loading')}</div>;
  }

  return (
    <div className="animate-fade-up flex min-h-0 flex-col gap-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0 space-y-1">
          <span className="kicker">{t('pm_permissions')}</span>
          <h2 className="text-lg font-semibold tracking-tight">{t('pm_management')}</h2>
          <p className="text-muted-foreground text-sm">{t('pm_management_help')}</p>
        </div>
        {canAdd ? (
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() => setAddOpen(true)}
            className="w-full shrink-0 sm:w-auto"
          >
            <UserPlus className="mr-1.5 h-3.5 w-3.5" />
            {t('pm_add')}
          </Button>
        ) : null}
      </div>

      <div className="grid min-h-0 grid-cols-1 gap-4 lg:grid-cols-[minmax(280px,340px)_minmax(0,1fr)]">
        {/* Members list */}
        <div className="surface-card min-h-0 overflow-hidden p-0">
          <div className="border-border/60 flex items-start justify-between gap-3 border-b px-4 py-3">
            <div>
              <span className="kicker">{t('pm_team_members')}</span>
              <p className="text-muted-foreground mt-1 text-xs">
                {t('pm_members_count', { count: members.length })}
              </p>
            </div>
          </div>
          <ScrollArea className="h-[min(42dvh,360px)] lg:h-[min(58dvh,520px)]">
            <div className="divide-border/60 divide-y">
              {members.map((member) => {
                const roleInfo = ROLE_INFO[member.role];
                const isActive = selectedMember?.id === member.id;
                return (
                  <div
                    key={member.id}
                    data-active={isActive ? 'true' : undefined}
                    className={`row-interactive flex w-full items-center gap-2 px-4 py-2.5 text-left ${
                      !canManage ? 'cursor-default' : ''
                    }`}
                  >
                    <button
                      type="button"
                      onClick={() => canManage && handleMemberSelect(member)}
                      disabled={!canManage}
                      className={`min-w-0 flex-1 text-left ${
                        canManage ? 'cursor-pointer' : 'cursor-default'
                      }`}
                    >
                      <div className="flex items-center gap-2.5">
                        <Avatar className="h-7 w-7 shrink-0">
                          <AvatarImage src={member.user?.image || ''} />
                          <AvatarFallback className="text-[11px]">
                            {member.user?.name?.charAt(0) || 'U'}
                          </AvatarFallback>
                        </Avatar>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-medium">
                            {member.user?.name || t('pm_unknown')}
                          </p>
                          <p className="text-muted-foreground truncate text-xs">
                            {member.user?.email}
                          </p>
                        </div>
                        <span className={`chip shrink-0 text-[10px] ${roleInfo?.tokenClass}`}>
                          {roleInfo ? t(roleInfo.labelKey) : null}
                        </span>
                      </div>
                    </button>
                    {canRemove ? (
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="text-muted-foreground hover:text-destructive h-7 w-7 shrink-0"
                        onClick={() => void handleRemoveMember(member)}
                        disabled={removingMemberId === member.id}
                        aria-label={t('pm_remove_member_aria', {
                          name: member.user?.name || member.user?.email || t('pm_unknown'),
                        })}
                      >
                        {removingMemberId === member.id ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : (
                          <Trash2 className="h-3.5 w-3.5" />
                        )}
                      </Button>
                    ) : null}
                  </div>
                );
              })}
            </div>
          </ScrollArea>
        </div>

        {/* Permission editor */}
        <div className="surface-card min-h-0 overflow-hidden p-0">
          <div className="border-border/60 border-b px-5 py-4">
            <span className="kicker">{t('pm_editor')}</span>
            <h3 className="mt-1 text-sm font-semibold tracking-tight">
              {selectedMember
                ? t('pm_editing', { name: selectedMember.user?.name ?? '' })
                : t('pm_select_member')}
            </h3>
            <p className="text-muted-foreground mt-0.5 text-xs">
              {selectedMember ? t('pm_editor_help') : t('pm_editor_empty_help')}
            </p>
          </div>

          <div className="p-4 sm:p-5">
            {!canManage && (
              <div className="panel-warn mb-4 p-3">
                <p className="text-sm">{t('pm_no_permission')}</p>
              </div>
            )}

            {selectedMember && canManage ? (
              <div className="space-y-5">
                {/* Role selector row */}
                <div className="grid grid-cols-1 items-start gap-3 md:grid-cols-[minmax(160px,220px)_1fr] md:items-center">
                  <div className="text-sm font-medium">{t('pm_role')}</div>
                  <div className="flex flex-wrap items-center gap-2">
                    <Select
                      value={editedRole || ''}
                      onValueChange={(v) => handleRoleChange(v as ProjectRole)}
                    >
                      <SelectTrigger className="w-full sm:w-56">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {Object.entries(ROLE_INFO).map(([key, info]) => (
                          <SelectItem key={key} value={key}>
                            {t(info.labelKey)}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleResetToDefaults}
                      disabled={saving}
                    >
                      <RotateCcw className="mr-1.5 h-4 w-4" />
                      {t('pm_reset_defaults')}
                    </Button>
                  </div>
                </div>

                {/* Permission categories */}
                <ScrollArea className="h-[min(44dvh,390px)]">
                  <div className="stagger space-y-6 pr-2">
                    {Object.entries(PERMISSION_CATEGORIES).map(([catKey, category]) => (
                      <div key={catKey} className="space-y-2">
                        <span className="kicker">{t(category.labelKey)}</span>
                        <div className="surface-inset divide-border/60 divide-y">
                          {category.permissions.map((permKey) => {
                            const def = PERMISSION_DEFS[permKey];
                            const permLabel = def ? t(def.labelKey) : permKey;
                            const permHint = def?.hintKey ? t(def.hintKey) : null;
                            return (
                              <label
                                key={permKey}
                                htmlFor={`perm-${permKey}`}
                                className="row-interactive flex cursor-pointer items-center justify-between gap-3 px-4 py-2.5"
                              >
                                <div className="min-w-0 flex-1">
                                  <p className="text-sm font-medium">{permLabel}</p>
                                  {permHint ? (
                                    <p className="text-muted-foreground truncate text-xs">
                                      {permHint}
                                    </p>
                                  ) : null}
                                </div>
                                <Switch
                                  id={`perm-${permKey}`}
                                  className="shrink-0"
                                  checked={editedPermissions[permKey] || false}
                                  onCheckedChange={(v) =>
                                    handlePermissionChange(permKey, Boolean(v))
                                  }
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
                <div className="border-border/60 flex justify-end gap-2 border-t pt-4">
                  <Button variant="outline" onClick={() => setSelectedMember(null)}>
                    {tActions('cancel')}
                  </Button>
                  <Button onClick={handleSave} disabled={saving}>
                    <Save className="mr-1.5 h-4 w-4" />
                    {saving ? t('pm_saving') : t('save_changes')}
                  </Button>
                </div>
              </div>
            ) : (
              <div className="text-muted-foreground flex h-[min(44dvh,390px)] min-h-64 items-center justify-center">
                <div className="space-y-2 text-center">
                  <Shield className="text-muted-foreground/40 mx-auto h-8 w-8" />
                  <p className="text-sm">{t('pm_select_member_hint')}</p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      <AddProjectMemberDialog
        projectId={projectId}
        existingMemberUserIds={existingMemberUserIds}
        open={addOpen}
        onOpenChange={setAddOpen}
        onAdded={async () => {
          await refetch();
          await invalidateMemberCaches();
        }}
      />
    </div>
  );
}
