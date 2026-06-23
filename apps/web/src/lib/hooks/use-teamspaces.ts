'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import { throwApiResponseError } from '@/lib/client-api-errors';

export interface Teamspace {
  id: string;
  organizationId: string;
  name: string;
  slug: string;
  description: string | null;
  avatarUrl: string | null;
  leadId: string | null;
  settings: Record<string, unknown>;
  isMember?: boolean;
  memberCount?: number;
  projectCount?: number;
  currentUserRole?: 'lead' | 'member' | null;
  lead?: {
    id: string;
    name: string | null;
    email: string | null;
    image: string | null;
  } | null;
  createdAt: string;
  updatedAt: string;
}

export interface TeamspaceMember {
  id: string;
  teamRole: 'lead' | 'member';
  joinedAt: string;
  name: string | null;
  email: string | null;
  image: string | null;
  status: string;
}

export interface TeamspaceMembersResponse {
  team: Teamspace;
  members: TeamspaceMember[];
}

export interface TeamspacePayload {
  name: string;
  slug?: string;
  description?: string;
  avatarUrl?: string;
  leadId?: string | null;
}

export interface TeamspaceMemberPayload {
  userId: string;
  role: 'lead' | 'member';
}

export function useTeamspaces(organizationId?: string | null) {
  const t = useTranslations('hookErrors.teamspaces');

  return useQuery<Teamspace[]>({
    queryKey: ['teamspaces', organizationId],
    queryFn: async () => {
      if (!organizationId) {
        return [];
      }

      const response = await fetch(`/api/organizations/${organizationId}/teams`);
      if (!response.ok) {
        await throwApiResponseError(response, t('fetch'));
      }

      const data = await response.json();
      return data.teams ?? [];
    },
    enabled: !!organizationId,
  });
}

export function useTeamspaceMembers(organizationId?: string | null, teamspaceId?: string | null) {
  const t = useTranslations('hookErrors.teamspaces');

  return useQuery<TeamspaceMembersResponse>({
    queryKey: ['teamspace-members', organizationId, teamspaceId],
    queryFn: async () => {
      if (!organizationId || !teamspaceId) {
        throw new Error(t('organizationAndTeamspaceRequired'));
      }

      const response = await fetch(
        `/api/organizations/${organizationId}/teams/${teamspaceId}/members`
      );
      if (!response.ok) {
        await throwApiResponseError(response, t('fetchMembers'));
      }

      return response.json() as Promise<TeamspaceMembersResponse>;
    },
    enabled: !!organizationId && !!teamspaceId,
  });
}

function invalidateTeamspaceQueries(
  queryClient: ReturnType<typeof useQueryClient>,
  organizationId?: string | null,
  teamspaceId?: string | null
) {
  void queryClient.invalidateQueries({ queryKey: ['teamspaces', organizationId] });
  void queryClient.invalidateQueries({ queryKey: ['organization', organizationId] });
  void queryClient.invalidateQueries({ queryKey: ['projects'] });

  if (teamspaceId) {
    void queryClient.invalidateQueries({
      queryKey: ['teamspace-members', organizationId, teamspaceId],
    });
  }
}

export function useCreateTeamspace(organizationId?: string | null) {
  const queryClient = useQueryClient();
  const t = useTranslations('hookErrors.teamspaces');

  return useMutation({
    mutationFn: async (payload: TeamspacePayload) => {
      if (!organizationId) {
        throw new Error(t('noOrganizationSelected'));
      }

      const response = await fetch(`/api/organizations/${organizationId}/teams`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        await throwApiResponseError(response, t('create'));
      }

      return response.json();
    },
    onSuccess: () => {
      invalidateTeamspaceQueries(queryClient, organizationId);
    },
  });
}

export function useUpdateTeamspace(organizationId?: string | null) {
  const queryClient = useQueryClient();
  const t = useTranslations('hookErrors.teamspaces');

  return useMutation({
    mutationFn: async ({
      teamspaceId,
      payload,
    }: {
      teamspaceId: string;
      payload: TeamspacePayload;
    }) => {
      if (!organizationId) {
        throw new Error(t('noOrganizationSelected'));
      }

      const response = await fetch(`/api/organizations/${organizationId}/teams/${teamspaceId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        await throwApiResponseError(response, t('update'));
      }

      return response.json();
    },
    onSuccess: (_, variables) => {
      invalidateTeamspaceQueries(queryClient, organizationId, variables.teamspaceId);
    },
  });
}

export function useDeleteTeamspace(organizationId?: string | null) {
  const queryClient = useQueryClient();
  const t = useTranslations('hookErrors.teamspaces');

  return useMutation({
    mutationFn: async (teamspaceId: string) => {
      if (!organizationId) {
        throw new Error(t('noOrganizationSelected'));
      }

      const response = await fetch(`/api/organizations/${organizationId}/teams/${teamspaceId}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        await throwApiResponseError(response, t('delete'));
      }

      return response.json();
    },
    onSuccess: (_, teamspaceId) => {
      invalidateTeamspaceQueries(queryClient, organizationId, teamspaceId);
    },
  });
}

export function useAddTeamspaceMember(organizationId?: string | null, teamspaceId?: string | null) {
  const queryClient = useQueryClient();
  const t = useTranslations('hookErrors.teamspaces');

  return useMutation({
    mutationFn: async (payload: TeamspaceMemberPayload) => {
      if (!organizationId || !teamspaceId) {
        throw new Error(t('noTeamspaceSelected'));
      }

      const response = await fetch(
        `/api/organizations/${organizationId}/teams/${teamspaceId}/members`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        }
      );

      if (!response.ok) {
        await throwApiResponseError(response, t('addMember'));
      }

      return response.json();
    },
    onSuccess: () => {
      invalidateTeamspaceQueries(queryClient, organizationId, teamspaceId);
    },
  });
}

export function useUpdateTeamspaceMember(
  organizationId?: string | null,
  teamspaceId?: string | null
) {
  const queryClient = useQueryClient();
  const t = useTranslations('hookErrors.teamspaces');

  return useMutation({
    mutationFn: async ({ memberId, role }: { memberId: string; role: 'lead' | 'member' }) => {
      if (!organizationId || !teamspaceId) {
        throw new Error(t('noTeamspaceSelected'));
      }

      const response = await fetch(
        `/api/organizations/${organizationId}/teams/${teamspaceId}/members/${memberId}`,
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ role }),
        }
      );

      if (!response.ok) {
        await throwApiResponseError(response, t('updateMember'));
      }

      return response.json();
    },
    onSuccess: () => {
      invalidateTeamspaceQueries(queryClient, organizationId, teamspaceId);
    },
  });
}

export function useRemoveTeamspaceMember(
  organizationId?: string | null,
  teamspaceId?: string | null
) {
  const queryClient = useQueryClient();
  const t = useTranslations('hookErrors.teamspaces');

  return useMutation({
    mutationFn: async (memberId: string) => {
      if (!organizationId || !teamspaceId) {
        throw new Error(t('noTeamspaceSelected'));
      }

      const response = await fetch(
        `/api/organizations/${organizationId}/teams/${teamspaceId}/members/${memberId}`,
        {
          method: 'DELETE',
        }
      );

      if (!response.ok) {
        await throwApiResponseError(response, t('removeMember'));
      }

      return response.json();
    },
    onSuccess: () => {
      invalidateTeamspaceQueries(queryClient, organizationId, teamspaceId);
    },
  });
}
