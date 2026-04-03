import { NextRequest, NextResponse } from 'next/server';
import { db, projects, workflows, workflowStatuses } from '@tasknebula/db';
import { auth } from '@/auth';
import { eq, and, asc, desc } from 'drizzle-orm';
import { createId } from '@paralleldrive/cuid2';
import { resolveProjectByIdOrKey } from '@/lib/projects/server';

// GET /api/projects/[projectId]/workflow-statuses - Get workflow statuses for a project
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ projectId: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { projectId } = await params;
    const project = await resolveProjectByIdOrKey(projectId);

    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    // Get workflow for project
    let workflowId = project.defaultWorkflowId;
    
    if (!workflowId) {
      // Get organization's default workflow
      const defaultWorkflows = await db
        .select()
        .from(workflows)
        .where(
          and(
            eq(workflows.organizationId, project.organizationId),
            eq(workflows.isDefault, true)
          )
        )
        .limit(1);

      const defaultWorkflow = defaultWorkflows[0];

      if (!defaultWorkflow) {
        return NextResponse.json({ error: 'No workflow found' }, { status: 500 });
      }

      workflowId = defaultWorkflow.id;
    }

    // Get workflow statuses
    const statuses = await db
      .select()
      .from(workflowStatuses)
      .where(eq(workflowStatuses.workflowId, workflowId))
      .orderBy(asc(workflowStatuses.position));

    return NextResponse.json({
      statuses,
      total: statuses.length,
    });
  } catch (error) {
    console.error('Error fetching workflow statuses:', error);
    return NextResponse.json({ error: 'Failed to fetch workflow statuses' }, { status: 500 });
  }
}

// POST /api/projects/[projectId]/workflow-statuses - Create a new workflow status
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ projectId: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { projectId } = await params;
    const body = await request.json();
    const { name, category, color } = body;

    if (!name || !category || !color) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const project = await resolveProjectByIdOrKey(projectId);

    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    // Get workflow for project
    let workflowId = project.defaultWorkflowId;

    if (!workflowId) {
      // Get organization's default workflow
      const defaultWorkflows = await db
        .select()
        .from(workflows)
        .where(
          and(
            eq(workflows.organizationId, project.organizationId),
            eq(workflows.isDefault, true)
          )
        )
        .limit(1);

      const defaultWorkflow = defaultWorkflows[0];

      if (!defaultWorkflow) {
        return NextResponse.json({ error: 'No workflow found' }, { status: 500 });
      }

      workflowId = defaultWorkflow.id;
    }

    // Get max position
    const existingStatuses = await db
      .select()
      .from(workflowStatuses)
      .where(eq(workflowStatuses.workflowId, workflowId))
      .orderBy(desc(workflowStatuses.position))
      .limit(1);

    const position = (existingStatuses[0]?.position ?? -1) + 1;

    // Create new status
    const newStatus = await db
      .insert(workflowStatuses)
      .values({
        id: createId(),
        workflowId,
        name,
        category,
        color,
        position,
      })
      .returning();

    return NextResponse.json({ status: newStatus[0] });
  } catch (error) {
    console.error('Error creating workflow status:', error);
    return NextResponse.json({ error: 'Failed to create workflow status' }, { status: 500 });
  }
}
