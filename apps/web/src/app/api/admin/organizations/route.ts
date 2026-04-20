/**
 * Super Admin API - Organizations Management
 * GET /api/admin/organizations - List all organizations
 * POST /api/admin/organizations - Create new organization
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { db, organizations, organizationMembers, users, projects, issues, systemAuditLogs } from '@tasknebula/db';
import { eq, desc, count, and, ilike, or, inArray } from 'drizzle-orm';
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

    const conditions = [];
    if (status) {
      conditions.push(eq(organizations.status, status as any));
    }
    if (plan) {
      conditions.push(eq(organizations.plan, plan as any));
    }
    if (search) {
      conditions.push(
        or(
          ilike(organizations.name, `%${search}%`),
          ilike(organizations.slug, `%${search}%`),
          ilike(organizations.domain, `%${search}%`)
        )!
      );
    }

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    // Get organizations
    const orgs = whereClause
      ? await db
          .select()
          .from(organizations)
          .where(whereClause)
          .orderBy(desc(organizations.createdAt))
          .limit(limit)
          .offset((page - 1) * limit)
      : await db
          .select()
          .from(organizations)
          .orderBy(desc(organizations.createdAt))
          .limit(limit)
          .offset((page - 1) * limit);

    const orgIds = orgs.map((o) => o.id);

    // Aggregate member, project, issue counts per org in a single query
    const statsMap = new Map<string, { members: number; projects: number; issues: number }>();

    if (orgIds.length > 0) {
      const memberStats = await db
        .select({
          organizationId: organizationMembers.organizationId,
          total: count(),
        })
        .from(organizationMembers)
        .where(inArray(organizationMembers.organizationId, orgIds))
        .groupBy(organizationMembers.organizationId);

      const projectStats = await db
        .select({
          organizationId: projects.organizationId,
          total: count(),
        })
        .from(projects)
        .where(inArray(projects.organizationId, orgIds))
        .groupBy(projects.organizationId);

      const issueStats = await db
        .select({
          organizationId: issues.organizationId,
          total: count(),
        })
        .from(issues)
        .where(inArray(issues.organizationId, orgIds))
        .groupBy(issues.organizationId);

      for (const orgId of orgIds) {
        statsMap.set(orgId, { members: 0, projects: 0, issues: 0 });
      }
      for (const row of memberStats) {
        const entry = statsMap.get(row.organizationId);
        if (entry) entry.members = Number(row.total) || 0;
      }
      for (const row of projectStats) {
        const entry = statsMap.get(row.organizationId);
        if (entry) entry.projects = Number(row.total) || 0;
      }
      for (const row of issueStats) {
        const entry = statsMap.get(row.organizationId);
        if (entry) entry.issues = Number(row.total) || 0;
      }
    }

    // Batch fetch owners for all orgs in one query
    const ownersMap = new Map<string, { id: string; name: string | null; email: string; image: string | null }>();

    if (orgIds.length > 0) {
      const ownerRows = await db
        .select({
          organizationId: organizationMembers.organizationId,
          id: users.id,
          name: users.name,
          email: users.email,
          image: users.image,
        })
        .from(organizationMembers)
        .innerJoin(users, eq(organizationMembers.userId, users.id))
        .where(and(
          inArray(organizationMembers.organizationId, orgIds),
          eq(organizationMembers.role, 'owner')
        ));

      for (const row of ownerRows) {
        if (!ownersMap.has(row.organizationId)) {
          ownersMap.set(row.organizationId, {
            id: row.id,
            name: row.name,
            email: row.email,
            image: row.image,
          });
        }
      }
    }

    const orgsWithStats = orgs.map((org) => {
      const stats = statsMap.get(org.id) || { members: 0, projects: 0, issues: 0 };
      return {
        ...org,
        stats,
        owner: ownersMap.get(org.id) || undefined,
      };
    });

    // Get total count
    const totalQuery = db
      .select({ count: count() })
      .from(organizations);

    const [totalCount] = whereClause
      ? await totalQuery.where(whereClause)
      : await totalQuery;

    return NextResponse.json({
      organizations: orgsWithStats,
      pagination: {
        page,
        limit,
        total: Number(totalCount?.count || 0),
        totalPages: Math.ceil(Number(totalCount?.count || 0) / limit),
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
      .select({ id: organizations.id })
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

    if (!newOrg) {
      throw new Error('Failed to create organization');
    }

    // Add owner as member
    await db.insert(organizationMembers).values({
      id: createId(),
      organizationId: newOrg.id,
      userId: owner.id,
      role: 'owner',
      status: 'active',
    });

    await db.insert(systemAuditLogs).values({
      id: createId(),
      userId: session.user.id,
      action: 'org.created',
      resourceType: 'organization',
      resourceId: newOrg.id,
      organizationId: newOrg.id,
      metadata: {
        plan: newOrg.plan,
        status: newOrg.status,
        ownerId: owner.id,
        ownerEmail: owner.email,
      },
      ipAddress: request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || undefined,
      userAgent: request.headers.get('user-agent') || undefined,
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
