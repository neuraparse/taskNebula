/**
 * Organization API - Single Organization Management
 * GET /api/organizations/[organizationId] - Get organization details
 * PATCH /api/organizations/[organizationId] - Update organization
 * DELETE /api/organizations/[organizationId] - Delete organization
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { auth } from '@/auth';
import { db, organizations, organizationMembers, projects, teams, apiKeys } from '@tasknebula/db';
import { eq, and, count, ne } from 'drizzle-orm';
import { hasPermission, getUserRole } from '@/lib/auth/permissions';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ organizationId: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { organizationId } = await params;

    // Check if user has permission to view organization
    const canView = await hasPermission(organizationId, 'org:view');
    if (!canView) {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });
    }

    // Get organization
    const [org] = await db
      .select()
      .from(organizations)
      .where(eq(organizations.id, organizationId))
      .limit(1);

    if (!org) {
      return NextResponse.json({ error: 'Organization not found' }, { status: 404 });
    }

    // Get user's role in this organization
    const userRole = await getUserRole(organizationId);

    const [[memberCount], [projectCount], [teamCount], [apiKeyCount]] = await Promise.all([
      db
        .select({ count: count() })
        .from(organizationMembers)
        .where(eq(organizationMembers.organizationId, organizationId)),
      db
        .select({ count: count() })
        .from(projects)
        .where(eq(projects.organizationId, organizationId)),
      db.select({ count: count() }).from(teams).where(eq(teams.organizationId, organizationId)),
      db.select({ count: count() }).from(apiKeys).where(eq(apiKeys.organizationId, organizationId)),
    ]);

    return NextResponse.json({
      ...org,
      userRole: userRole?.role || null,
      isSuperAdmin: userRole?.isSuperAdmin || false,
      stats: {
        members: Number(memberCount?.count || 0),
        projects: Number(projectCount?.count || 0),
        teams: Number(teamCount?.count || 0),
        apiKeys: Number(apiKeyCount?.count || 0),
      },
    });
  } catch (error) {
    console.error('Failed to fetch organization:', error);
    return NextResponse.json({ error: 'Failed to fetch organization' }, { status: 500 });
  }
}

const updateOrgSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  slug: z
    .string()
    .min(1)
    .max(100)
    .regex(/^[a-z0-9-]+$/)
    .optional(),
  domain: z.string().max(255).optional(),
  logoUrl: z.union([z.string().url(), z.literal('')]).optional(),
});

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ organizationId: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { organizationId } = await params;

    // Check if user has permission to manage organization settings
    const canManage = await hasPermission(organizationId, 'org:settings');
    if (!canManage) {
      return NextResponse.json(
        { error: 'Updating organization settings requires org:settings permission.' },
        { status: 403 }
      );
    }

    const body = await request.json();
    const data = updateOrgSchema.parse(body);

    if (data.slug) {
      const [existingOrg] = await db
        .select({ id: organizations.id })
        .from(organizations)
        .where(and(eq(organizations.slug, data.slug), ne(organizations.id, organizationId)))
        .limit(1);

      if (existingOrg) {
        return NextResponse.json({ error: 'Organization slug already exists' }, { status: 400 });
      }
    }

    // Update organization
    const [updatedOrg] = await db
      .update(organizations)
      .set({
        ...data,
        logoUrl: data.logoUrl === '' ? null : data.logoUrl,
        updatedAt: new Date(),
      })
      .where(eq(organizations.id, organizationId))
      .returning();

    return NextResponse.json(updatedOrg);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Validation failed', details: error.errors },
        { status: 400 }
      );
    }

    console.error('Failed to update organization:', error);
    return NextResponse.json({ error: 'Failed to update organization' }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ organizationId: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { organizationId } = await params;

    // Check if user has permission to delete organization (only owner)
    const canDelete = await hasPermission(organizationId, 'org:delete');
    if (!canDelete) {
      return NextResponse.json({ error: 'Only owners can delete organizations' }, { status: 403 });
    }

    // Delete organization (cascade will handle related records)
    await db.delete(organizations).where(eq(organizations.id, organizationId));

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Failed to delete organization:', error);
    return NextResponse.json({ error: 'Failed to delete organization' }, { status: 500 });
  }
}
