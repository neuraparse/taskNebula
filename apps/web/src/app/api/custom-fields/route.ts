import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { db, customFields } from '@tasknebula/db';
import { eq, and, desc } from 'drizzle-orm';
import { z } from 'zod';
import { canManageProject, isActiveOrganizationMember } from '@/lib/auth/access-control';
import { hasPermission } from '@/lib/auth/permissions';
import { projects } from '@tasknebula/db';

export const dynamic = 'force-dynamic';

const createCustomFieldSchema = z.object({
  organizationId: z.string(),
  projectId: z.string().optional(),
  name: z.string().min(1),
  description: z.string().optional(),
  type: z.enum(['text', 'number', 'date', 'select', 'multi_select', 'checkbox', 'url', 'email']),
  isRequired: z.boolean().optional(),
  defaultValue: z.string().optional(),
  options: z.string().optional(), // JSON string for select/multi_select
});

// GET /api/custom-fields?organizationId=xxx&projectId=xxx
export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const organizationId = searchParams.get('organizationId');
    const projectId = searchParams.get('projectId');

    if (!organizationId) {
      return NextResponse.json({ error: 'organizationId is required' }, { status: 400 });
    }

    if (!(await isActiveOrganizationMember(session.user.id, organizationId))) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    if (projectId) {
      const [project] = await db
        .select()
        .from(projects)
        .where(and(eq(projects.id, projectId), eq(projects.organizationId, organizationId)))
        .limit(1);
      if (!project) {
        return NextResponse.json({ error: 'Project not found' }, { status: 404 });
      }
      if (!(await canManageProject(session.user.id, project))) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
      }
    }

    // Build query
    const conditions = [
      eq(customFields.organizationId, organizationId),
      eq(customFields.isActive, true),
    ];

    if (projectId) {
      conditions.push(eq(customFields.projectId, projectId));
    }

    const fields = await db
      .select()
      .from(customFields)
      .where(and(...conditions))
      .orderBy(customFields.position, desc(customFields.createdAt));

    return NextResponse.json({ customFields: fields });
  } catch (error) {
    console.error('Error fetching custom fields:', error);
    return NextResponse.json({ error: 'Failed to fetch custom fields' }, { status: 500 });
  }
}

// POST /api/custom-fields
export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const validatedData = createCustomFieldSchema.parse(body);

    if (validatedData.projectId) {
      const [project] = await db
        .select()
        .from(projects)
        .where(
          and(
            eq(projects.id, validatedData.projectId),
            eq(projects.organizationId, validatedData.organizationId)
          )
        )
        .limit(1);
      if (!project) {
        return NextResponse.json({ error: 'Project not found' }, { status: 404 });
      }
      if (!(await canManageProject(session.user.id, project))) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
      }
    } else if (!(await hasPermission(validatedData.organizationId, 'org:settings'))) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const [newField] = await db
      .insert(customFields)
      .values({
        ...validatedData,
        createdBy: session.user.id,
        updatedBy: session.user.id,
      })
      .returning();

    return NextResponse.json(newField, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid request data', details: error.errors },
        { status: 400 }
      );
    }
    console.error('Error creating custom field:', error);
    return NextResponse.json({ error: 'Failed to create custom field' }, { status: 500 });
  }
}
