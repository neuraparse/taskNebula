/**
 * Super Admin API - Single Organization Management
 * GET /api/admin/organizations/[organizationId] - Get organization details
 * PATCH /api/admin/organizations/[organizationId] - Update organization
 * DELETE /api/admin/organizations/[organizationId] - Delete organization
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { db, organizations, systemAuditLogs } from '@tasknebula/db';
import { and, eq, ne } from 'drizzle-orm';
import { auth } from '@/auth';
import { isSuperAdmin } from '@/lib/auth/permissions';
import { createId } from '@paralleldrive/cuid2';

// GET /api/admin/organizations/[organizationId]
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ organizationId: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const isAdmin = await isSuperAdmin();
    if (!isAdmin) {
      return NextResponse.json({ error: 'Super admin access required' }, { status: 403 });
    }

    const { organizationId } = await params;

    const [org] = await db
      .select()
      .from(organizations)
      .where(eq(organizations.id, organizationId))
      .limit(1);

    if (!org) {
      return NextResponse.json({ error: 'Organization not found' }, { status: 404 });
    }

    return NextResponse.json(org);
  } catch (error) {
    console.error('Failed to fetch organization:', error);
    return NextResponse.json(
      { error: 'Failed to fetch organization' },
      { status: 500 }
    );
  }
}

// PATCH /api/admin/organizations/[organizationId]
const updateOrgSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  slug: z.string().min(1).max(100).regex(/^[a-z0-9-]+$/).optional(),
  plan: z.enum(['free', 'starter', 'growth', 'enterprise']).optional(),
  status: z.enum(['active', 'trial', 'suspended']).optional(),
  domain: z.string().optional(),
  logoUrl: z.string().url().optional(),
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

    const isAdmin = await isSuperAdmin();
    if (!isAdmin) {
      return NextResponse.json({ error: 'Super admin access required' }, { status: 403 });
    }

    const { organizationId } = await params;
    const body = await request.json();
    const data = updateOrgSchema.parse(body);

    // Get current organization
    const [currentOrg] = await db
      .select()
      .from(organizations)
      .where(eq(organizations.id, organizationId))
      .limit(1);

    if (!currentOrg) {
      return NextResponse.json({ error: 'Organization not found' }, { status: 404 });
    }

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
        updatedAt: new Date(),
      })
      .where(eq(organizations.id, organizationId))
      .returning();

    // Create audit log
    const changes: Record<string, { from: any; to: any }> = {};
    if (data.plan && data.plan !== currentOrg.plan) {
      changes.plan = { from: currentOrg.plan, to: data.plan };
    }
    if (data.status && data.status !== currentOrg.status) {
      changes.status = { from: currentOrg.status, to: data.status };
    }
    if (data.name && data.name !== currentOrg.name) {
      changes.name = { from: currentOrg.name, to: data.name };
    }

    if (Object.keys(changes).length > 0) {
      await db.insert(systemAuditLogs).values({
        id: createId(),
        userId: session.user.id,
        action: data.status === 'suspended' ? 'org.suspended' : data.plan !== currentOrg.plan ? 'org.plan_changed' : 'org.updated',
        resourceType: 'organization',
        resourceId: organizationId,
        organizationId,
        changes,
        ipAddress: request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || undefined,
        userAgent: request.headers.get('user-agent') || undefined,
      });
    }

    return NextResponse.json(updatedOrg);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Validation failed', details: error.errors },
        { status: 400 }
      );
    }

    console.error('Failed to update organization:', error);
    return NextResponse.json(
      { error: 'Failed to update organization' },
      { status: 500 }
    );
  }
}

// DELETE /api/admin/organizations/[organizationId]
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ organizationId: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const isAdmin = await isSuperAdmin();
    if (!isAdmin) {
      return NextResponse.json({ error: 'Super admin access required' }, { status: 403 });
    }

    const { organizationId } = await params;

    // Delete organization (cascade will handle related records)
    await db
      .delete(organizations)
      .where(eq(organizations.id, organizationId));

    // Create audit log
    await db.insert(systemAuditLogs).values({
      id: createId(),
      userId: session.user.id,
      action: 'org.deleted',
      resourceType: 'organization',
      resourceId: organizationId,
      organizationId,
      ipAddress: request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || undefined,
      userAgent: request.headers.get('user-agent') || undefined,
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Failed to delete organization:', error);
    return NextResponse.json(
      { error: 'Failed to delete organization' },
      { status: 500 }
    );
  }
}
