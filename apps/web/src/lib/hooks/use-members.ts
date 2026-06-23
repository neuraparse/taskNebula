import { useQuery } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';

export interface OrganizationMember {
  id: string;
  name: string | null;
  email: string | null;
  image: string | null;
  status: string;
  /** P0-04: virtual coding-agent users (Claude/Cursor/Devin/Copilot/...). */
  isAgent?: boolean;
  /** Provider handle when `isAgent` is true (matches agent_session_provider). */
  agentProvider?:
    | 'claude'
    | 'codex'
    | 'cursor'
    | 'devin'
    | 'copilot'
    | 'openhands'
    | 'custom'
    | null;
  role: 'owner' | 'admin' | 'member' | 'viewer' | 'guest';
  memberStatus: string;
  joinedAt: string;
}

export interface OrganizationMembersResponse {
  members: OrganizationMember[];
  userRole: 'owner' | 'admin' | 'member' | 'viewer' | 'guest' | null;
  isSuperAdmin: boolean;
  registrationMode?: 'allow_registration' | 'invite_only' | 'admin_created_only';
}

export function useOrganizationMembers(organizationId: string | null) {
  const t = useTranslations('hookErrors.members');

  return useQuery({
    queryKey: ['organization-members', organizationId],
    queryFn: async () => {
      if (!organizationId) {
        return { members: [], userRole: null, isSuperAdmin: false };
      }

      const response = await fetch(`/api/organizations/${organizationId}/members`);

      if (!response.ok) {
        throw new Error(t('fetchOrganizationMembers'));
      }

      return response.json() as Promise<OrganizationMembersResponse>;
    },
    enabled: !!organizationId,
  });
}
