import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { db, workflows, workflowStatuses, workflowTransitions } from '@tasknebula/db';
import { eq, desc } from 'drizzle-orm';

// GET /api/workflows - List all workflows for an organization
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

    const workflowList = await db
      .select({
        id: workflows.id,
        name: workflows.name,
        description: workflows.description,
        isDefault: workflows.isDefault,
        createdAt: workflows.createdAt,
        updatedAt: workflows.updatedAt,
      })
      .from(workflows)
      .where(eq(workflows.organizationId, organizationId))
      .orderBy(desc(workflows.isDefault), workflows.name);

    // Get statuses for each workflow
    const workflowsWithStatuses = await Promise.all(
      workflowList.map(async (workflow) => {
        const statuses = await db
          .select()
          .from(workflowStatuses)
          .where(eq(workflowStatuses.workflowId, workflow.id))
          .orderBy(workflowStatuses.position);
        return { ...workflow, statuses };
      })
    );

    return NextResponse.json(workflowsWithStatuses);
  } catch (error) {
    console.error('Error fetching workflows:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// POST /api/workflows - Create a new workflow
export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { organizationId, name, description, isDefault, statuses: initialStatuses } = body;

    if (!organizationId || !name) {
      return NextResponse.json({ error: 'Organization ID and name are required' }, { status: 400 });
    }

    // If this is set as default, unset other defaults
    if (isDefault) {
      await db
        .update(workflows)
        .set({ isDefault: false, updatedAt: new Date(), updatedBy: session.user.id })
        .where(eq(workflows.organizationId, organizationId));
    }

    const [workflow] = await db
      .insert(workflows)
      .values({
        organizationId,
        name,
        description: description || null,
        isDefault: isDefault || false,
        createdBy: session.user.id,
        updatedBy: session.user.id,
      })
      .returning();

    // Create default statuses if provided
    if (workflow && initialStatuses && Array.isArray(initialStatuses)) {
      for (let i = 0; i < initialStatuses.length; i++) {
        const status = initialStatuses[i];
        await db.insert(workflowStatuses).values({
          workflowId: workflow.id,
          name: status.name,
          category: status.category,
          color: status.color || '#6b7280',
          position: i,
        });
      }
    }

    return NextResponse.json(workflow, { status: 201 });
  } catch (error) {
    console.error('Error creating workflow:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
