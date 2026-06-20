import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import {
  db,
  organizations,
  organizationMembers,
  workflows,
  workflowStatuses,
  users,
} from '@tasknebula/db';
import { auth } from '@/auth';
import { and, eq } from 'drizzle-orm';
import { createId } from '@paralleldrive/cuid2';

// GET /api/organizations - Get user's organizations
export async function GET() {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const [actor] = await db
      .select({ isSuperAdmin: users.isSuperAdmin })
      .from(users)
      .where(eq(users.id, session.user.id))
      .limit(1);

    // Get organizations where user is an active member.
    const userOrgs = await db
      .select({
        organization: organizations,
        role: organizationMembers.role,
      })
      .from(organizationMembers)
      .innerJoin(organizations, eq(organizationMembers.organizationId, organizations.id))
      .where(
        and(
          eq(organizationMembers.userId, session.user.id),
          eq(organizationMembers.status, 'active')
        )
      );

    return NextResponse.json({
      canCreateOrganizations: actor?.isSuperAdmin || false,
      organizations: userOrgs.map((org) => ({
        ...org.organization,
        role: org.role,
      })),
    });
  } catch (error) {
    console.error('Error fetching organizations:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// POST /api/organizations - Create new organization
const createOrgSchema = z.object({
  name: z.string().min(1).max(255),
  slug: z
    .string()
    .min(1)
    .max(100)
    .regex(/^[a-z0-9-]+$/, 'Slug must contain only lowercase letters, numbers, and hyphens'),
});

export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const [actor] = await db
      .select({ isSuperAdmin: users.isSuperAdmin })
      .from(users)
      .where(eq(users.id, session.user.id))
      .limit(1);

    if (!actor?.isSuperAdmin) {
      return NextResponse.json(
        { error: 'Only platform admins can create organizations. Ask an admin for an invite.' },
        { status: 403 }
      );
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

    // Create organization
    const [newOrg] = await db
      .insert(organizations)
      .values({
        id: createId(),
        name: data.name,
        slug: data.slug,
        plan: 'free',
        status: 'trial',
        settings: {},
      })
      .returning();

    if (!newOrg) {
      throw new Error('Failed to create organization');
    }

    // Add creator as owner
    await db.insert(organizationMembers).values({
      id: createId(),
      organizationId: newOrg.id,
      userId: session.user.id,
      role: 'owner',
      status: 'active',
    });

    // Create default workflow
    const [defaultWorkflow] = await db
      .insert(workflows)
      .values({
        id: createId(),
        organizationId: newOrg.id,
        name: 'Default Workflow',
        description: 'Default workflow for new projects',
        isDefault: true,
        createdBy: session.user.id,
        updatedBy: session.user.id,
      })
      .returning();

    if (!defaultWorkflow) {
      throw new Error('Failed to create default workflow');
    }

    // Create default workflow statuses
    const defaultStatuses = [
      { name: 'Backlog', category: 'backlog', position: 0, color: '#94a3b8' },
      { name: 'To Do', category: 'backlog', position: 1, color: '#64748b' },
      { name: 'In Progress', category: 'in_progress', position: 2, color: '#3b82f6' },
      { name: 'In Review', category: 'in_review', position: 3, color: '#8b5cf6' },
      { name: 'Done', category: 'done', position: 4, color: '#10b981' },
      { name: 'Blocked', category: 'blocked', position: 5, color: '#ef4444' },
    ];

    await db.insert(workflowStatuses).values(
      defaultStatuses.map((status) => ({
        id: createId(),
        workflowId: defaultWorkflow.id,
        name: status.name,
        category: status.category as any,
        position: status.position,
        color: status.color,
      }))
    );

    return NextResponse.json(newOrg, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Validation failed', details: error.errors },
        { status: 400 }
      );
    }

    console.error('Failed to create organization:', error);
    return NextResponse.json({ error: 'Failed to create organization' }, { status: 500 });
  }
}
