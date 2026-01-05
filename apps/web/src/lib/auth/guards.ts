/**
 * API Route Guards
 * Middleware for protecting API routes with permission checks
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { Permission } from '@tasknebula/db';
import {
  hasPermission,
  hasAnyPermission,
  isSuperAdmin as checkSuperAdmin,
  getUserRole,
} from './permissions';

/**
 * Super Admin Guard - Protect routes that require super admin access
 */
export async function withSuperAdmin(
  handler: (req: NextRequest, ...args: any[]) => Promise<NextResponse>
) {
  return async (req: NextRequest, ...args: any[]) => {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const isAdmin = await checkSuperAdmin();
    if (!isAdmin) {
      return NextResponse.json({ error: 'Super admin access required' }, { status: 403 });
    }

    return handler(req, ...args);
  };
}

/**
 * Permission Guard - Protect routes that require specific permission
 */
export function withPermission(
  permission: Permission,
  getOrganizationId: (req: NextRequest, ...args: any[]) => string | Promise<string>
) {
  return (handler: (req: NextRequest, ...args: any[]) => Promise<NextResponse>) => {
    return async (req: NextRequest, ...args: any[]) => {
      const session = await auth();
      if (!session?.user?.id) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
      }

      const organizationId = await getOrganizationId(req, ...args);
      const hasAccess = await hasPermission(organizationId, permission);

      if (!hasAccess) {
        return NextResponse.json(
          { error: `Permission denied: ${permission}` },
          { status: 403 }
        );
      }

      return handler(req, ...args);
    };
  };
}

/**
 * Any Permission Guard - Protect routes that require any of the specified permissions
 */
export function withAnyPermission(
  permissions: Permission[],
  getOrganizationId: (req: NextRequest, ...args: any[]) => string | Promise<string>
) {
  return (handler: (req: NextRequest, ...args: any[]) => Promise<NextResponse>) => {
    return async (req: NextRequest, ...args: any[]) => {
      const session = await auth();
      if (!session?.user?.id) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
      }

      const organizationId = await getOrganizationId(req, ...args);
      const hasAccess = await hasAnyPermission(organizationId, permissions);

      if (!hasAccess) {
        return NextResponse.json(
          { error: `Permission denied: requires one of ${permissions.join(', ')}` },
          { status: 403 }
        );
      }

      return handler(req, ...args);
    };
  };
}

/**
 * Organization Owner Guard - Protect routes that require organization owner role
 */
export function withOrganizationOwner(
  getOrganizationId: (req: NextRequest, ...args: any[]) => string | Promise<string>
) {
  return (handler: (req: NextRequest, ...args: any[]) => Promise<NextResponse>) => {
    return async (req: NextRequest, ...args: any[]) => {
      const session = await auth();
      if (!session?.user?.id) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
      }

      const organizationId = await getOrganizationId(req, ...args);
      const userRole = await getUserRole(organizationId);

      if (!userRole || (userRole.role !== 'owner' && !userRole.isSuperAdmin)) {
        return NextResponse.json(
          { error: 'Organization owner access required' },
          { status: 403 }
        );
      }

      return handler(req, ...args);
    };
  };
}

/**
 * Organization Admin Guard - Protect routes that require organization admin or owner role
 */
export function withOrganizationAdmin(
  getOrganizationId: (req: NextRequest, ...args: any[]) => string | Promise<string>
) {
  return (handler: (req: NextRequest, ...args: any[]) => Promise<NextResponse>) => {
    return async (req: NextRequest, ...args: any[]) => {
      const session = await auth();
      if (!session?.user?.id) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
      }

      const organizationId = await getOrganizationId(req, ...args);
      const userRole = await getUserRole(organizationId);

      if (!userRole || (!['owner', 'admin'].includes(userRole.role || '') && !userRole.isSuperAdmin)) {
        return NextResponse.json(
          { error: 'Organization admin access required' },
          { status: 403 }
        );
      }

      return handler(req, ...args);
    };
  };
}

