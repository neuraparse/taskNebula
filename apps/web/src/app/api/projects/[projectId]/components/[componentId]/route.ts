import { NextRequest, NextResponse } from 'next/server';
import { db, components, organizationMembers } from '@tasknebula/db';
import { auth } from '@/auth';
import { eq, and, ne } from 'drizzle-orm';
import { z } from 'zod';
import { resolveProjectByIdOrKey } from '@/lib/projects/server';
import { canManageProject, canReadProject } from '@/lib/auth/access-control';

export const dynamic = 'force-dynamic';

const updateComponentSchema = z.object({
  name: z.string().min(1).max(120).optional(),
  description: z.string().max(10000).optional().nullable(),
  leadId: z.string().optional().nullable(),
  defaultAssigneeType: z.enum(['project_default', 'component_lead', 'unassigned']).optional(),
  archived: z.boolean().optional(),
});

async function resolveComponentAccess(
  userId: string,
  projectIdOrKey: string,
  componentId: string
): Promise<
  | {
      ok: true;
      project: NonNullable<Awaited<ReturnType<typeof resolveProjectByIdOrKey>>>;
      component: typeof components.$inferSelect;
    }
  | { ok: false; response: NextResponse }
> {
  const project = await resolveProjectByIdOrKey(projectIdOrKey, userId);
  if (!project) {
    return {
      ok: false,
      response: NextResponse.json({ error: 'Project not found' }, { status: 404 }),
    };
  }
  // 404 (not 403) so cross-org probing can't confirm the project exists
  if (!(await canReadProject(userId, project))) {
    return {
      ok: false,
      response: NextResponse.json({ error: 'Project not found' }, { status: 404 }),
    };
  }

  const [component] = await db
    .select()
    .from(components)
    .where(and(eq(components.id, componentId), eq(components.projectId, project.id)))
    .limit(1);
  if (!component) {
    return {
      ok: false,
      response: NextResponse.json({ error: 'Component not found' }, { status: 404 }),
    };
  }

  return { ok: true, project, component };
}

// GET /api/projects/[projectId]/components/[componentId] - Fetch a single component
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ projectId: string; componentId: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { projectId, componentId } = await params;
    const access = await resolveComponentAccess(session.user.id, projectId, componentId);
    if (!access.ok) return access.response;

    return NextResponse.json({ component: access.component });
  } catch (error) {
    console.error('Error fetching project component:', error);
    return NextResponse.json({ error: 'Failed to fetch component' }, { status: 500 });
  }
}

// PATCH /api/projects/[projectId]/components/[componentId] - Update a component
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ projectId: string; componentId: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { projectId, componentId } = await params;
    const access = await resolveComponentAccess(session.user.id, projectId, componentId);
    if (!access.ok) return access.response;
    const { project, component } = access;

    if (!(await canManageProject(session.user.id, project))) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const body = updateComponentSchema.parse(await request.json());

    if (body.leadId) {
      const [leadMember] = await db
        .select({ id: organizationMembers.id })
        .from(organizationMembers)
        .where(
          and(
            eq(organizationMembers.userId, body.leadId),
            eq(organizationMembers.organizationId, project.organizationId),
            eq(organizationMembers.status, 'active')
          )
        )
        .limit(1);
      if (!leadMember) {
        return NextResponse.json(
          { error: 'Component lead must be an active member of the organization' },
          { status: 400 }
        );
      }
    }

    if (body.name !== undefined && body.name !== component.name) {
      const [duplicate] = await db
        .select({ id: components.id })
        .from(components)
        .where(
          and(
            eq(components.projectId, project.id),
            eq(components.name, body.name),
            ne(components.id, component.id)
          )
        )
        .limit(1);
      if (duplicate) {
        return NextResponse.json(
          { error: 'A component with this name already exists in this project' },
          { status: 409 }
        );
      }
    }

    const updates: Partial<typeof components.$inferInsert> = { updatedAt: new Date() };
    if (body.name !== undefined) updates.name = body.name;
    if (body.description !== undefined) updates.description = body.description;
    if (body.leadId !== undefined) updates.leadId = body.leadId;
    if (body.defaultAssigneeType !== undefined)
      updates.defaultAssigneeType = body.defaultAssigneeType;
    if (body.archived !== undefined) updates.archived = body.archived;

    const [updated] = await db
      .update(components)
      .set(updates)
      .where(eq(components.id, component.id))
      .returning();

    return NextResponse.json({ component: updated });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid request data', details: error.errors },
        { status: 400 }
      );
    }
    console.error('Error updating project component:', error);
    return NextResponse.json({ error: 'Failed to update component' }, { status: 500 });
  }
}

// DELETE /api/projects/[projectId]/components/[componentId] - Delete a component
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ projectId: string; componentId: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { projectId, componentId } = await params;
    const access = await resolveComponentAccess(session.user.id, projectId, componentId);
    if (!access.ok) return access.response;

    if (!(await canManageProject(session.user.id, access.project))) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // issue_components rows cascade on delete
    await db.delete(components).where(eq(components.id, access.component.id));

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting project component:', error);
    return NextResponse.json({ error: 'Failed to delete component' }, { status: 500 });
  }
}
