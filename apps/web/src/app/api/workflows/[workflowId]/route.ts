import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { db, workflows, workflowStatuses, workflowTransitions } from '@tasknebula/db';
import { eq } from 'drizzle-orm';
import { isActiveOrganizationMember } from '@/lib/auth/access-control';
import { hasPermission } from '@/lib/auth/permissions';

// GET /api/workflows/[workflowId] - Get a specific workflow with details
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ workflowId: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { workflowId } = await params;

    const [workflow] = await db.select().from(workflows).where(eq(workflows.id, workflowId));

    if (!workflow) {
      return NextResponse.json({ error: 'Workflow not found' }, { status: 404 });
    }

    // 404 (not 403) so cross-org probing cannot confirm the workflow exists
    const isMember = await isActiveOrganizationMember(session.user.id, workflow.organizationId);
    if (!isMember) {
      return NextResponse.json({ error: 'Workflow not found' }, { status: 404 });
    }

    // Get statuses
    const statuses = await db
      .select()
      .from(workflowStatuses)
      .where(eq(workflowStatuses.workflowId, workflowId))
      .orderBy(workflowStatuses.position);

    // Get transitions
    const transitions = await db
      .select()
      .from(workflowTransitions)
      .where(eq(workflowTransitions.workflowId, workflowId));

    return NextResponse.json({
      ...workflow,
      statuses,
      transitions,
    });
  } catch (error) {
    console.error('Error fetching workflow:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// PATCH /api/workflows/[workflowId] - Update a workflow
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ workflowId: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { workflowId } = await params;
    const body = await request.json();
    const { name, description, isDefault } = body;

    const [existingWorkflow] = await db
      .select()
      .from(workflows)
      .where(eq(workflows.id, workflowId));

    if (!existingWorkflow) {
      return NextResponse.json({ error: 'Workflow not found' }, { status: 404 });
    }

    // 404 (not 403) so cross-org probing cannot confirm the workflow exists
    const isMember = await isActiveOrganizationMember(
      session.user.id,
      existingWorkflow.organizationId
    );
    if (!isMember) {
      return NextResponse.json({ error: 'Workflow not found' }, { status: 404 });
    }

    const canManage = await hasPermission(existingWorkflow.organizationId, 'org:settings');
    if (!canManage) {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });
    }

    // If setting as default, unset other defaults
    if (isDefault) {
      await db
        .update(workflows)
        .set({ isDefault: false, updatedAt: new Date(), updatedBy: session.user.id })
        .where(eq(workflows.organizationId, existingWorkflow.organizationId));
    }

    const [updatedWorkflow] = await db
      .update(workflows)
      .set({
        ...(name && { name }),
        ...(description !== undefined && { description }),
        ...(isDefault !== undefined && { isDefault }),
        updatedAt: new Date(),
        updatedBy: session.user.id,
      })
      .where(eq(workflows.id, workflowId))
      .returning();

    return NextResponse.json(updatedWorkflow);
  } catch (error) {
    console.error('Error updating workflow:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// DELETE /api/workflows/[workflowId] - Delete a workflow
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ workflowId: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { workflowId } = await params;

    const [workflow] = await db.select().from(workflows).where(eq(workflows.id, workflowId));

    if (!workflow) {
      return NextResponse.json({ error: 'Workflow not found' }, { status: 404 });
    }

    // 404 (not 403) so cross-org probing cannot confirm the workflow exists
    const isMember = await isActiveOrganizationMember(session.user.id, workflow.organizationId);
    if (!isMember) {
      return NextResponse.json({ error: 'Workflow not found' }, { status: 404 });
    }

    const canManage = await hasPermission(workflow.organizationId, 'org:settings');
    if (!canManage) {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });
    }

    if (workflow.isDefault) {
      return NextResponse.json({ error: 'Cannot delete default workflow' }, { status: 400 });
    }

    await db.delete(workflows).where(eq(workflows.id, workflowId));

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting workflow:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
