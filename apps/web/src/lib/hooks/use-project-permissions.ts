'use client';

import { useQuery } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import { useSession } from 'next-auth/react';

export type ProjectRole =
  | 'product_owner'
  | 'scrum_master'
  | 'tech_lead'
  | 'developer'
  | 'qa_engineer'
  | 'designer'
  | 'viewer';

// Granular permissions interface matching the API response
export interface GranularPermissions {
  // Project
  canBrowseProject: boolean;
  canAdministerProject: boolean;
  canBrowseDocs: boolean;
  canCreateDocs: boolean;
  canEditDocs: boolean;
  canDeleteDocs: boolean;
  canBrowseChat: boolean;
  canCreateChannels: boolean;
  canPostMessages: boolean;
  canModerateMessages: boolean;
  canStartCalls: boolean;
  canManageCalls: boolean;
  // Sprint
  canManageSprints: boolean;
  canStartSprint: boolean;
  canCompleteSprint: boolean;
  canDeleteSprint: boolean;
  // Issue
  canCreateIssues: boolean;
  canEditIssues: boolean;
  canEditOwnIssues: boolean;
  canDeleteIssues: boolean;
  canDeleteOwnIssues: boolean;
  canAssignIssues: boolean;
  canAssigneeIssues: boolean;
  canTransitionIssues: boolean;
  canScheduleIssues: boolean;
  canMoveIssues: boolean;
  canLinkIssues: boolean;
  canCloseIssues: boolean;
  canReopenIssues: boolean;
  // Comment
  canAddComments: boolean;
  canEditOwnComments: boolean;
  canEditAllComments: boolean;
  canDeleteOwnComments: boolean;
  canDeleteAllComments: boolean;
  // Attachment
  canCreateAttachments: boolean;
  canDeleteOwnAttachments: boolean;
  canDeleteAllAttachments: boolean;
  // Watcher
  canManageWatchers: boolean;
  canViewWatchers: boolean;
  // Member
  canManageMembers: boolean;
  canInviteMembers: boolean;
  canRemoveMembers: boolean;
  canChangeRoles: boolean;
  // Workflow
  canManageWorkflow: boolean;
  // Time Tracking
  canLogWork: boolean;
  canEditOwnWorklogs: boolean;
  canEditAllWorklogs: boolean;
  canDeleteOwnWorklogs: boolean;
  canDeleteAllWorklogs: boolean;
}

export interface ProjectMember {
  id: string;
  userId: string;
  projectId: string;
  role: ProjectRole;
  permissions: GranularPermissions;
  user?: {
    id: string;
    name: string;
    email: string;
    image: string | null;
  };
}

export interface UserProjectPermissions extends GranularPermissions {
  isMember: boolean;
  role: ProjectRole | null;
  isSuperAdmin: boolean;
  isOrgOwner: boolean;
  isOrgAdmin: boolean;
}

const DEFAULT_PERMISSIONS: UserProjectPermissions = {
  isMember: false,
  role: null,
  isSuperAdmin: false,
  isOrgOwner: false,
  isOrgAdmin: false,
  // Project
  canBrowseProject: false,
  canAdministerProject: false,
  canBrowseDocs: false,
  canCreateDocs: false,
  canEditDocs: false,
  canDeleteDocs: false,
  canBrowseChat: false,
  canCreateChannels: false,
  canPostMessages: false,
  canModerateMessages: false,
  canStartCalls: false,
  canManageCalls: false,
  // Sprint
  canManageSprints: false,
  canStartSprint: false,
  canCompleteSprint: false,
  canDeleteSprint: false,
  // Issue
  canCreateIssues: false,
  canEditIssues: false,
  canEditOwnIssues: false,
  canDeleteIssues: false,
  canDeleteOwnIssues: false,
  canAssignIssues: false,
  canAssigneeIssues: false,
  canTransitionIssues: false,
  canScheduleIssues: false,
  canMoveIssues: false,
  canLinkIssues: false,
  canCloseIssues: false,
  canReopenIssues: false,
  // Comment
  canAddComments: false,
  canEditOwnComments: false,
  canEditAllComments: false,
  canDeleteOwnComments: false,
  canDeleteAllComments: false,
  // Attachment
  canCreateAttachments: false,
  canDeleteOwnAttachments: false,
  canDeleteAllAttachments: false,
  // Watcher
  canManageWatchers: false,
  canViewWatchers: false,
  // Member
  canManageMembers: false,
  canInviteMembers: false,
  canRemoveMembers: false,
  canChangeRoles: false,
  // Workflow
  canManageWorkflow: false,
  // Time Tracking
  canLogWork: false,
  canEditOwnWorklogs: false,
  canEditAllWorklogs: false,
  canDeleteOwnWorklogs: false,
  canDeleteAllWorklogs: false,
};

export function useProjectPermissions(projectId: string | undefined) {
  const { data: session, status } = useSession();
  const userId = session?.user?.id;
  const t = useTranslations('hookErrors.projectPermissions');

  const { data, isLoading, error } = useQuery({
    queryKey: ['project-permissions', projectId, userId],
    queryFn: async (): Promise<UserProjectPermissions> => {
      if (!projectId || !userId) {
        return DEFAULT_PERMISSIONS;
      }

      const res = await fetch(`/api/projects/${projectId}/permissions`);
      if (!res.ok) {
        if (res.status === 403 || res.status === 404) {
          return DEFAULT_PERMISSIONS;
        }
        throw new Error(t('fetchPermissions'));
      }
      return res.json();
    },
    enabled: !!projectId && !!userId,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });

  return {
    permissions: data || DEFAULT_PERMISSIONS,
    isLoading: status === 'loading' || isLoading,
    error,
  };
}

export function useUserRole() {
  const { data: session } = useSession();
  const t = useTranslations('hookErrors.projectPermissions');

  const { data, isLoading } = useQuery({
    queryKey: ['user-role', session?.user?.id],
    queryFn: async () => {
      const res = await fetch('/api/user/role');
      if (!res.ok) throw new Error(t('fetchUserRole'));
      return res.json();
    },
    enabled: !!session?.user?.id,
    staleTime: 5 * 60 * 1000,
  });

  return {
    isSuperAdmin: data?.isSuperAdmin || false,
    orgRole: data?.orgRole || null,
    isLoading,
  };
}

// Hook to fetch project members
export function useProjectMembers(projectId: string | undefined) {
  const { data: session } = useSession();
  const t = useTranslations('hookErrors.projectPermissions');

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['project-members', projectId],
    queryFn: async (): Promise<ProjectMember[]> => {
      if (!projectId) return [];
      const res = await fetch(`/api/projects/${projectId}/members`);
      if (!res.ok) throw new Error(t('fetchMembers'));
      return res.json();
    },
    enabled: !!projectId && !!session?.user?.id,
    staleTime: 2 * 60 * 1000,
  });

  return {
    members: data || [],
    isLoading,
    error,
    refetch,
  };
}
