import { NextRequest, NextResponse } from 'next/server';
import { db, components, issueComponents } from '@tasknebula/db';
import { auth } from '@/auth';
import { eq, and, asc, sql, inArray } from 'drizzle-orm';
import { createId } from '@paralleldrive/cuid2';
import { z } from 'zod';
import { resolveProjectByIdOrKey } from '@/lib/projects/server';
import {
  canManageProject,
  canReadProject,
  isActiveOrganizationMember,
} from '@/lib/auth/access-control';

export const dynamic = 'force-dynamic';

const createComponentSchema = z.object({
  name: z.string().min(1).max(120),
  description: z.string().max(10000).optional().nullable(),
  leadId: z.string().optional().nullable(),
  defaultAssigneeType: z
    .enum(['project_default', 'component_lead', 'unassigned'])
    .default('project_default'),
});

// GET /api/projects/[projectId]/components - List components with issue counts
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ projectId: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { projectId } = await params;
    const project = await resolveProjectByIdOrKey(projectId, session.user.id);
    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }
    // 404 (not 403) so cross-org probing can't confirm the project exists
    if (!(await canReadProject(session.user.id, project))) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    const componentList = await db
      .select()
      .from(components)
      .where(eq(components.projectId, project.id))
      .orderBy(asc(components.name));

    let countsByComponent = new Map<string, number>();
    const componentIds = componentList.map((c) => c.id);
    if (componentIds.length > 0) {
      const counts = await db
        .select({
          componentId: issueComponents.componentId,
          total: sql<number>`COUNT(*)::int`,
        })
        .from(issueComponents)
        .where(inArray(issueComponents.componentId, componentIds))
        .groupBy(issueComponents.componentId);
      countsByComponent = new Map(counts.map((c) => [c.componentId, Number(c.total)]));
    }

    return NextResponse.json({
      components: componentList.map((component) => ({
        ...component,
        issueCount: countsByComponent.get(component.id) ?? 0,
      })),
      total: componentList.length,
    });
  } catch (error) {
    console.error('Error fetching project components:', error);
    return NextResponse.json({ error: 'Failed to fetch components' }, { status: 500 });
  }
}

// POST /api/projects/[projectId]/components - Create a component
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ projectId: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { projectId } = await params;
    const project = await resolveProjectByIdOrKey(projectId, session.user.id);
    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }
    if (!(await canReadProject(session.user.id, project))) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }
    if (!(await canManageProject(session.user.id, project))) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const body = createComponentSchema.parse(await request.json());

    if (body.leadId) {
      const leadIsMember = await isActiveOrganizationMember(body.leadId, project.organizationId);
      if (!leadIsMember) {
        return NextResponse.json(
          { error: 'Component lead must be an active member of the organization' },
          { status: 400 }
        );
      }
    }

    const [existing] = await db
      .select({ id: components.id })
      .from(components)
      .where(and(eq(components.projectId, project.id), eq(components.name, body.name)))
      .limit(1);
    if (existing) {
      return NextResponse.json(
        { error: 'A component with this name already exists in this project' },
        { status: 409 }
      );
    }

    const [component] = await db
      .insert(components)
      .values({
        id: createId(),
        organizationId: project.organizationId,
        projectId: project.id,
        name: body.name,
        description: body.description ?? null,
        leadId: body.leadId ?? null,
        defaultAssigneeType: body.defaultAssigneeType,
      })
      .returning();

    return NextResponse.json({ component }, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid request data', details: error.errors },
        { status: 400 }
      );
    }
    console.error('Error creating project component:', error);
    return NextResponse.json({ error: 'Failed to create component' }, { status: 500 });
  }
}
