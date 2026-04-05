import { useQuery } from '@tanstack/react-query';

export interface OrganizationMember {
  id: string;
  name: string | null;
  email: string | null;
  image: string | null;
  status: string;
  role: 'owner' | 'admin' | 'member' | 'viewer' | 'guest';
  memberStatus: string;
  joinedAt: string;
}

export interface OrganizationMembersResponse {
  members: OrganizationMember[];
  userRole: 'owner' | 'admin' | 'member' | 'viewer' | 'guest' | null;
  isSuperAdmin: boolean;
}

export function useOrganizationMembers(organizationId: string | null) {
  return useQuery({
    queryKey: ['organization-members', organizationId],
    queryFn: async () => {
      if (!organizationId) {
        return { members: [], userRole: null, isSuperAdmin: false };
      }

      const response = await fetch(`/api/organizations/${organizationId}/members`);

      if (!response.ok) {
        throw new Error('Failed to fetch organization members');
      }

      return response.json() as Promise<OrganizationMembersResponse>;
    },
    enabled: !!organizationId,
  });
}
