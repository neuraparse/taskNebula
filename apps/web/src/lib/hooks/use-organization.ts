'use client';

import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';

interface OrganizationState {
  currentOrganizationId: string | null;
  currentTeamId: string | null;
  setCurrentOrganization: (organizationId: string) => void;
  setCurrentTeam: (teamId: string | null) => void;
  clearContext: () => void;
}

export const useOrganization = create<OrganizationState>()(
  persist(
    (set) => ({
      currentOrganizationId: null,
      currentTeamId: null,
      setCurrentOrganization: (organizationId) =>
        set({ currentOrganizationId: organizationId }),
      setCurrentTeam: (teamId) => set({ currentTeamId: teamId }),
      clearContext: () =>
        set({ currentOrganizationId: null, currentTeamId: null }),
    }),
    {
      name: 'tasknebula-organization-context',
      storage: createJSONStorage(() => {
        // Check if we're in the browser
        if (typeof window !== 'undefined') {
          return localStorage;
        }
        // Return a no-op storage for SSR
        return {
          getItem: () => null,
          setItem: () => {},
          removeItem: () => {},
        };
      }),
    }
  )
);

