import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { db, permissionSchemes, projectPermissionSchemes } from '@tasknebula/db';
import { eq, and, desc, inArray } from 'drizzle-orm';
import { PERMISSION_KEYS, ROLE_DEFAULT_PERMISSIONS } from '@tasknebula/db';
import { hasPermission } from '@/lib/auth/permissions';

// GET /api/permission-schemes - List all permission schemes for an organization
export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const organizationId = searchParams.get('organizationId');

    if (!organizationId) {
      return NextResponse.json({ error: 'Organization ID is required' }, { status: 400 });
    }

    const canView = await hasPermission(organizationId, 'org:settings');
    if (!canView) {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });
    }

    const schemes = await db
      .select({
        id: permissionSchemes.id,
        name: permissionSchemes.name,
        description: permissionSchemes.description,
        isDefault: permissionSchemes.isDefault,
        permissions: permissionSchemes.permissions,
        createdAt: permissionSchemes.createdAt,
        updatedAt: permissionSchemes.updatedAt,
      })
      .from(permissionSchemes)
      .where(eq(permissionSchemes.organizationId, organizationId))
      .orderBy(desc(permissionSchemes.isDefault), permissionSchemes.name);

    // Batch fetch project assignments for all schemes in a single query
    const schemeIds = schemes.map((s) => s.id);
    const countsBySchemeId = new Map<string, number>();

    if (schemeIds.length > 0) {
      const assignments = await db
        .select({ schemeId: projectPermissionSchemes.schemeId })
        .from(projectPermissionSchemes)
        .where(inArray(projectPermissionSchemes.schemeId, schemeIds));

      for (const row of assignments) {
        countsBySchemeId.set(row.schemeId, (countsBySchemeId.get(row.schemeId) || 0) + 1);
      }
    }

    const schemesWithProjectCounts = schemes.map((scheme) => ({
      ...scheme,
      projectCount: countsBySchemeId.get(scheme.id) || 0,
    }));

    return NextResponse.json(schemesWithProjectCounts);
  } catch (error) {
    console.error('Error fetching permission schemes:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// POST /api/permission-schemes - Create a new permission scheme
export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { organizationId, name, description, permissions, isDefault, baseRole } = body;

    if (!organizationId || !name) {
      return NextResponse.json({ error: 'Organization ID and name are required' }, { status: 400 });
    }

    const canManage = await hasPermission(organizationId, 'org:settings');
    if (!canManage) {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });
    }

    // If baseRole is provided, use its default permissions
    let schemePermissions = permissions || {};
    if (baseRole && ROLE_DEFAULT_PERMISSIONS[baseRole as keyof typeof ROLE_DEFAULT_PERMISSIONS]) {
      schemePermissions =
        ROLE_DEFAULT_PERMISSIONS[baseRole as keyof typeof ROLE_DEFAULT_PERMISSIONS];
    }

    // If this is set as default, unset other defaults
    if (isDefault) {
      await db
        .update(permissionSchemes)
        .set({ isDefault: false, updatedAt: new Date(), updatedBy: session.user.id })
        .where(eq(permissionSchemes.organizationId, organizationId));
    }

    const [scheme] = await db
      .insert(permissionSchemes)
      .values({
        organizationId,
        name,
        description: description || null,
        isDefault: isDefault || false,
        permissions: schemePermissions,
        createdBy: session.user.id,
        updatedBy: session.user.id,
      })
      .returning();

    return NextResponse.json(scheme, { status: 201 });
  } catch (error) {
    console.error('Error creating permission scheme:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
