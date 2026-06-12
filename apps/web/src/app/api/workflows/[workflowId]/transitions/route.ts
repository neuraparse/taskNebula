import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { db, workflowTransitions, workflowStatuses, workflows } from '@tasknebula/db';
import { eq } from 'drizzle-orm';
import { isActiveOrganizationMember } from '@/lib/auth/access-control';
import { hasPermission } from '@/lib/auth/permissions';

// GET /api/workflows/[workflowId]/transitions - Get all transitions
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

    const [workflow] = await db
      .select({ organizationId: workflows.organizationId })
      .from(workflows)
      .where(eq(workflows.id, workflowId))
      .limit(1);

    // 404 (not 403) so cross-org probing cannot confirm the workflow exists
    if (
      !workflow ||
      !(await isActiveOrganizationMember(session.user.id, workflow.organizationId))
    ) {
      return NextResponse.json({ error: 'Workflow not found' }, { status: 404 });
    }

    const transitions = await db
      .select()
      .from(workflowTransitions)
      .where(eq(workflowTransitions.workflowId, workflowId));

    return NextResponse.json(transitions);
  } catch (error) {
    console.error('Error fetching transitions:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// POST /api/workflows/[workflowId]/transitions - Create a transition
export async function POST(
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
    const { name, fromStatusId, toStatusId, conditions, validators, postActions } = body;

    if (!name || !fromStatusId || !toStatusId) {
      return NextResponse.json(
        { error: 'Name, fromStatusId, and toStatusId are required' },
        { status: 400 }
      );
    }

    const [workflow] = await db
      .select({ organizationId: workflows.organizationId })
      .from(workflows)
      .where(eq(workflows.id, workflowId))
      .limit(1);

    // 404 (not 403) so cross-org probing cannot confirm the workflow exists
    if (
      !workflow ||
      !(await isActiveOrganizationMember(session.user.id, workflow.organizationId))
    ) {
      return NextResponse.json({ error: 'Workflow not found' }, { status: 404 });
    }

    const canManage = await hasPermission(workflow.organizationId, 'org:settings');
    if (!canManage) {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });
    }

    const [transition] = await db
      .insert(workflowTransitions)
      .values({
        workflowId,
        name,
        fromStatusId,
        toStatusId,
        conditions: conditions || [],
        validators: validators || [],
        postActions: postActions || [],
      })
      .returning();

    return NextResponse.json(transition, { status: 201 });
  } catch (error) {
    console.error('Error creating transition:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
