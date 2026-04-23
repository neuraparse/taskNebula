'use client';

import { useQuery } from '@tanstack/react-query';
import { useMemo } from 'react';
import type { Permission } from '@tasknebula/db';

export type { Permission };

export interface OrganizationPermissionsResponse {
  organizationId: string;
  role: string | null;
  isSuperAdmin: boolean;
  permissions: Permission[];
}

export interface UseOrganizationPermissionsResult {
  permissions: Permission[];
  isSuperAdmin: boolean;
  role: string | null;
  isLoading: boolean;
  has: (p: Permission) => boolean;
  hasAny: (ps: Permission[]) => boolean;
  hasAll: (ps: Permission[]) => boolean;
}

/**
 * Hook that exposes the current user's organization-level permissions.
 *
 * Uses the `/api/user/me/permissions` endpoint. Returns a stable default
 * (empty permissions, non-super-admin) while loading or when `orgId` is absent.
 *
 * Super admins always pass `has`/`hasAny`/`hasAll` checks, regardless of the
 * permissions array returned by the server.
 */
export function useOrganizationPermissions(
  orgId?: string
): UseOrganizationPermissionsResult {
  const { data, isLoading } = useQuery<OrganizationPermissionsResponse>({
    queryKey: ['user-permissions', orgId],
    queryFn: async () => {
      const res = await fetch(
        `/api/user/me/permissions?organizationId=${encodeURIComponent(orgId as string)}`
      );
      if (!res.ok) {
        throw new Error('Failed to fetch organization permissions');
      }
      return res.json();
    },
    enabled: !!orgId,
    staleTime: 5 * 60 * 1000,
  });

  const permissions = useMemo<Permission[]>(
    () => data?.permissions ?? [],
    [data?.permissions]
  );
  const isSuperAdmin = data?.isSuperAdmin ?? false;
  const role = data?.role ?? null;

  const permissionSet = useMemo(() => new Set<Permission>(permissions), [permissions]);

  const has = (p: Permission): boolean => {
    if (isSuperAdmin) return true;
    return permissionSet.has(p);
  };

  const hasAny = (ps: Permission[]): boolean => {
    if (isSuperAdmin) return true;
    return ps.some((p) => permissionSet.has(p));
  };

  const hasAll = (ps: Permission[]): boolean => {
    if (isSuperAdmin) return true;
    return ps.every((p) => permissionSet.has(p));
  };

  return {
    permissions,
    isSuperAdmin,
    role,
    isLoading,
    has,
    hasAny,
    hasAll,
  };
}
