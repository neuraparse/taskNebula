import { NextRequest, NextResponse } from 'next/server';
import { db, projects, workflows, workflowStatuses } from '@tasknebula/db';
import { auth } from '@/auth';
import { eq, and, asc, desc } from 'drizzle-orm';
import { createId } from '@paralleldrive/cuid2';

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

    // Convert project key to ID if needed
    let actualProjectId = projectId;
    if (!projectId.includes('_')) {
      const projectByKey = await db
        .select()
        .from(projects)
        .where(eq(projects.key, projectId.toUpperCase()))
        .limit(1);
      
      if (projectByKey.length > 0) {
        actualProjectId = projectByKey[0].id;
      }
    }

    // Get project
    const projectResults = await db
      .select()
      .from(projects)
      .where(eq(projects.id, actualProjectId))
      .limit(1);

    if (projectResults.length === 0) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    const project = projectResults[0];

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
      
      if (defaultWorkflows.length === 0) {
        return NextResponse.json({ error: 'No workflow found' }, { status: 500 });
      }
      
      workflowId = defaultWorkflows[0].id;
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

    // Convert project key to ID if needed
    let actualProjectId = projectId;
    if (!projectId.includes('_')) {
      const projectByKey = await db
        .select()
        .from(projects)
        .where(eq(projects.key, projectId.toUpperCase()))
        .limit(1);

      if (projectByKey.length > 0) {
        actualProjectId = projectByKey[0].id;
      }
    }

    // Get project
    const projectResults = await db
      .select()
      .from(projects)
      .where(eq(projects.id, actualProjectId))
      .limit(1);

    if (projectResults.length === 0) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    const project = projectResults[0];

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

      if (defaultWorkflows.length === 0) {
        return NextResponse.json({ error: 'No workflow found' }, { status: 500 });
      }

      workflowId = defaultWorkflows[0].id;
    }

    // Get max position
    const existingStatuses = await db
      .select()
      .from(workflowStatuses)
      .where(eq(workflowStatuses.workflowId, workflowId))
      .orderBy(desc(workflowStatuses.position))
      .limit(1);

    const position = existingStatuses.length > 0 ? existingStatuses[0].position + 1 : 0;

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
