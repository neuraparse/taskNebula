import { useQuery } from '@tanstack/react-query';

interface Member {
  id: string;
  name: string | null;
  email: string | null;
  image: string | null;
}

interface MembersResponse {
  members: Member[];
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

      return response.json() as Promise<MembersResponse>;
    },
    enabled: !!organizationId,
  });
}

