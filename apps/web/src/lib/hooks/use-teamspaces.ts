'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

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
  return useQuery<Teamspace[]>({
    queryKey: ['teamspaces', organizationId],
    queryFn: async () => {
      if (!organizationId) {
        return [];
      }

      const response = await fetch(`/api/organizations/${organizationId}/teams`);
      if (!response.ok) {
        throw new Error('Failed to fetch teamspaces');
      }

      const data = await response.json();
      return data.teams ?? [];
    },
    enabled: !!organizationId,
  });
}

export function useTeamspaceMembers(organizationId?: string | null, teamspaceId?: string | null) {
  return useQuery<TeamspaceMembersResponse>({
    queryKey: ['teamspace-members', organizationId, teamspaceId],
    queryFn: async () => {
      if (!organizationId || !teamspaceId) {
        throw new Error('Organization and teamspace are required');
      }

      const response = await fetch(`/api/organizations/${organizationId}/teams/${teamspaceId}/members`);
      if (!response.ok) {
        throw new Error('Failed to fetch teamspace members');
      }

      return response.json() as Promise<TeamspaceMembersResponse>;
    },
    enabled: !!organizationId && !!teamspaceId,
  });
}

function invalidateTeamspaceQueries(queryClient: ReturnType<typeof useQueryClient>, organizationId?: string | null, teamspaceId?: string | null) {
  void queryClient.invalidateQueries({ queryKey: ['teamspaces', organizationId] });
  void queryClient.invalidateQueries({ queryKey: ['organization', organizationId] });
  void queryClient.invalidateQueries({ queryKey: ['projects'] });

  if (teamspaceId) {
    void queryClient.invalidateQueries({ queryKey: ['teamspace-members', organizationId, teamspaceId] });
  }
}

export function useCreateTeamspace(organizationId?: string | null) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (payload: TeamspacePayload) => {
      if (!organizationId) {
        throw new Error('No organization selected');
      }

      const response = await fetch(`/api/organizations/${organizationId}/teams`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await response.json().catch(() => ({ error: 'Failed to create teamspace' }));
      if (!response.ok) {
        throw new Error(data.error || 'Failed to create teamspace');
      }

      return data;
    },
    onSuccess: () => {
      invalidateTeamspaceQueries(queryClient, organizationId);
    },
  });
}

export function useUpdateTeamspace(organizationId?: string | null) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      teamspaceId,
      payload,
    }: {
      teamspaceId: string;
      payload: TeamspacePayload;
    }) => {
      if (!organizationId) {
        throw new Error('No organization selected');
      }

      const response = await fetch(`/api/organizations/${organizationId}/teams/${teamspaceId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await response.json().catch(() => ({ error: 'Failed to update teamspace' }));
      if (!response.ok) {
        throw new Error(data.error || 'Failed to update teamspace');
      }

      return data;
    },
    onSuccess: (_, variables) => {
      invalidateTeamspaceQueries(queryClient, organizationId, variables.teamspaceId);
    },
  });
}

export function useDeleteTeamspace(organizationId?: string | null) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (teamspaceId: string) => {
      if (!organizationId) {
        throw new Error('No organization selected');
      }

      const response = await fetch(`/api/organizations/${organizationId}/teams/${teamspaceId}`, {
        method: 'DELETE',
      });

      const data = await response.json().catch(() => ({ error: 'Failed to delete teamspace' }));
      if (!response.ok) {
        throw new Error(data.error || 'Failed to delete teamspace');
      }

      return data;
    },
    onSuccess: (_, teamspaceId) => {
      invalidateTeamspaceQueries(queryClient, organizationId, teamspaceId);
    },
  });
}

export function useAddTeamspaceMember(organizationId?: string | null, teamspaceId?: string | null) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (payload: TeamspaceMemberPayload) => {
      if (!organizationId || !teamspaceId) {
        throw new Error('No teamspace selected');
      }

      const response = await fetch(`/api/organizations/${organizationId}/teams/${teamspaceId}/members`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await response.json().catch(() => ({ error: 'Failed to add teamspace member' }));
      if (!response.ok) {
        throw new Error(data.error || 'Failed to add teamspace member');
      }

      return data;
    },
    onSuccess: () => {
      invalidateTeamspaceQueries(queryClient, organizationId, teamspaceId);
    },
  });
}

export function useUpdateTeamspaceMember(organizationId?: string | null, teamspaceId?: string | null) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      memberId,
      role,
    }: {
      memberId: string;
      role: 'lead' | 'member';
    }) => {
      if (!organizationId || !teamspaceId) {
        throw new Error('No teamspace selected');
      }

      const response = await fetch(`/api/organizations/${organizationId}/teams/${teamspaceId}/members/${memberId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role }),
      });

      const data = await response.json().catch(() => ({ error: 'Failed to update teamspace member' }));
      if (!response.ok) {
        throw new Error(data.error || 'Failed to update teamspace member');
      }

      return data;
    },
    onSuccess: () => {
      invalidateTeamspaceQueries(queryClient, organizationId, teamspaceId);
    },
  });
}

export function useRemoveTeamspaceMember(organizationId?: string | null, teamspaceId?: string | null) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (memberId: string) => {
      if (!organizationId || !teamspaceId) {
        throw new Error('No teamspace selected');
      }

      const response = await fetch(`/api/organizations/${organizationId}/teams/${teamspaceId}/members/${memberId}`, {
        method: 'DELETE',
      });

      const data = await response.json().catch(() => ({ error: 'Failed to remove teamspace member' }));
      if (!response.ok) {
        throw new Error(data.error || 'Failed to remove teamspace member');
      }

      return data;
    },
    onSuccess: () => {
      invalidateTeamspaceQueries(queryClient, organizationId, teamspaceId);
    },
  });
}
