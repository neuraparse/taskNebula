/**
 * Super Admin API - Organizations Management
 * GET /api/admin/organizations - List all organizations
 * POST /api/admin/organizations - Create new organization
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { db, organizations, organizationMembers, users, projects, issues } from '@tasknebula/db';
import { eq, desc, sql, count } from 'drizzle-orm';
import { auth } from '@/auth';
import { isSuperAdmin } from '@/lib/auth/permissions';
import { createId } from '@paralleldrive/cuid2';

// GET /api/admin/organizations - List all organizations with stats
export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Check super admin
    const isAdmin = await isSuperAdmin();
    if (!isAdmin) {
      return NextResponse.json({ error: 'Super admin access required' }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1', 10);
    const limit = parseInt(searchParams.get('limit') || '20', 10);
    const status = searchParams.get('status'); // 'active', 'trial', 'suspended'
    const plan = searchParams.get('plan'); // 'free', 'starter', 'growth', 'enterprise'
    const search = searchParams.get('search');

    // Build query
    let query = db.select().from(organizations);

    // Apply filters
    const conditions = [];
    if (status) {
      conditions.push(eq(organizations.status, status as any));
    }
    if (plan) {
      conditions.push(eq(organizations.plan, plan as any));
    }

    // Get organizations
    const orgs = await db
      .select()
      .from(organizations)
      .orderBy(desc(organizations.createdAt))
      .limit(limit)
      .offset((page - 1) * limit);

    // Get stats for each organization
    const orgsWithStats = await Promise.all(
      orgs.map(async (org) => {
        // Count members
        const [memberCount] = await db
          .select({ count: count() })
          .from(organizationMembers)
          .where(eq(organizationMembers.organizationId, org.id));

        // Count projects
        const [projectCount] = await db
          .select({ count: count() })
          .from(projects)
          .where(eq(projects.organizationId, org.id));

        // Count issues
        const [issueCount] = await db
          .select({ count: count() })
          .from(issues)
          .where(eq(issues.organizationId, org.id));

        // Get owner
        const [owner] = await db
          .select({
            id: users.id,
            name: users.name,
            email: users.email,
            image: users.image,
          })
          .from(organizationMembers)
          .innerJoin(users, eq(organizationMembers.userId, users.id))
          .where(
            eq(organizationMembers.organizationId, org.id),
            eq(organizationMembers.role, 'owner')
          )
          .limit(1);

        return {
          ...org,
          stats: {
            members: memberCount?.count || 0,
            projects: projectCount?.count || 0,
            issues: issueCount?.count || 0,
          },
          owner,
        };
      })
    );

    // Get total count
    const [totalCount] = await db
      .select({ count: count() })
      .from(organizations);

    return NextResponse.json({
      organizations: orgsWithStats,
      pagination: {
        page,
        limit,
        total: totalCount?.count || 0,
        totalPages: Math.ceil((totalCount?.count || 0) / limit),
      },
    });
  } catch (error) {
    console.error('Failed to fetch organizations:', error);
    return NextResponse.json(
      { error: 'Failed to fetch organizations' },
      { status: 500 }
    );
  }
}

// POST /api/admin/organizations - Create new organization
const createOrgSchema = z.object({
  name: z.string().min(1).max(255),
  slug: z.string().min(1).max(100).regex(/^[a-z0-9-]+$/),
  plan: z.enum(['free', 'starter', 'growth', 'enterprise']).default('free'),
  status: z.enum(['active', 'trial', 'suspended']).default('trial'),
  ownerId: z.string().min(1),
});

export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Check super admin
    const isAdmin = await isSuperAdmin();
    if (!isAdmin) {
      return NextResponse.json({ error: 'Super admin access required' }, { status: 403 });
    }

    const body = await request.json();
    const data = createOrgSchema.parse(body);

    // Check if slug already exists
    const [existingOrg] = await db
      .select()
      .from(organizations)
      .where(eq(organizations.slug, data.slug))
      .limit(1);

    if (existingOrg) {
      return NextResponse.json({ error: 'Organization slug already exists' }, { status: 400 });
    }

    // Find owner user
    const [owner] = await db
      .select()
      .from(users)
      .where(eq(users.id, data.ownerId))
      .limit(1);

    if (!owner) {
      return NextResponse.json({ error: 'Owner user not found' }, { status: 400 });
    }

    // Create organization
    const [newOrg] = await db
      .insert(organizations)
      .values({
        id: createId(),
        name: data.name,
        slug: data.slug,
        plan: data.plan,
        status: data.status,
        settings: {},
      })
      .returning();

    // Add owner as member
    await db.insert(organizationMembers).values({
      id: createId(),
      organizationId: newOrg.id,
      userId: owner.id,
      role: 'owner',
      status: 'active',
    });

    return NextResponse.json(newOrg, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Validation failed', details: error.errors },
        { status: 400 }
      );
    }

    console.error('Failed to create organization:', error);
    return NextResponse.json(
      { error: 'Failed to create organization' },
      { status: 500 }
    );
  }
}

