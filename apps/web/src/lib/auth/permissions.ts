/**
 * Permission utilities for Next.js app
 * Server-side permission checking
 */

import { auth } from '@/auth';
import {
  db,
  organizationMembers,
  users,
  Permission,
  hasPermission as checkPermission,
  hasAnyPermission as checkAnyPermission,
  hasAllPermissions as checkAllPermissions,
  getRolePermissions,
} from '@tasknebula/db';
import { eq, and } from 'drizzle-orm';

/**
 * Get current user's organization role and super admin status
 */
export async function getUserRole(organizationId: string) {
  const session = await auth();
  if (!session?.user?.id) {
    return null;
  }

  // Get user's super admin status
  const [user] = await db
    .select({
      isSuperAdmin: users.isSuperAdmin,
    })
    .from(users)
    .where(eq(users.id, session.user.id))
    .limit(1);

  // Get user's organization role
  const [member] = await db
    .select({
      role: organizationMembers.role,
    })
    .from(organizationMembers)
    .where(
      and(
        eq(organizationMembers.userId, session.user.id),
        eq(organizationMembers.organizationId, organizationId)
      )
    )
    .limit(1);

  return {
    role: member?.role || null,
    isSuperAdmin: user?.isSuperAdmin || false,
  };
}

/**
 * Check if current user has a specific permission in an organization
 */
export async function hasPermission(
  organizationId: string,
  permission: Permission
): Promise<boolean> {
  const userRole = await getUserRole(organizationId);
  if (!userRole) {
    return false;
  }

  return checkPermission(userRole.role || '', permission, userRole.isSuperAdmin);
}

/**
 * Check if current user has any of the specified permissions
 */
export async function hasAnyPermission(
  organizationId: string,
  permissions: Permission[]
): Promise<boolean> {
  const userRole = await getUserRole(organizationId);
  if (!userRole) {
    return false;
  }

  return checkAnyPermission(userRole.role || '', permissions, userRole.isSuperAdmin);
}

/**
 * Check if current user has all of the specified permissions
 */
export async function hasAllPermissions(
  organizationId: string,
  permissions: Permission[]
): Promise<boolean> {
  const userRole = await getUserRole(organizationId);
  if (!userRole) {
    return false;
  }

  return checkAllPermissions(userRole.role || '', permissions, userRole.isSuperAdmin);
}

/**
 * Check if current user is a super admin
 */
export async function isSuperAdmin(): Promise<boolean> {
  const session = await auth();
  if (!session?.user?.id) {
    return false;
  }

  const [user] = await db
    .select({
      isSuperAdmin: users.isSuperAdmin,
    })
    .from(users)
    .where(eq(users.id, session.user.id))
    .limit(1);

  return user?.isSuperAdmin || false;
}

/**
 * Require super admin access - throws error if not super admin
 */
export async function requireSuperAdmin() {
  const isAdmin = await isSuperAdmin();
  if (!isAdmin) {
    throw new Error('Super admin access required');
  }
}

/**
 * Require specific permission - throws error if not authorized
 */
export async function requirePermission(
  organizationId: string,
  permission: Permission
) {
  const hasAccess = await hasPermission(organizationId, permission);
  if (!hasAccess) {
    throw new Error(`Permission denied: ${permission}`);
  }
}

/**
 * Get all permissions for current user in an organization
 */
export async function getUserPermissions(organizationId: string): Promise<Permission[]> {
  const userRole = await getUserRole(organizationId);
  if (!userRole) {
    return [];
  }

  return getRolePermissions(userRole.role || '', userRole.isSuperAdmin);
}

