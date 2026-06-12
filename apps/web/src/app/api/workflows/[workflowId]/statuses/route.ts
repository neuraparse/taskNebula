import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { db, workflowStatuses, workflows } from '@tasknebula/db';
import { desc, eq } from 'drizzle-orm';
import { isActiveOrganizationMember } from '@/lib/auth/access-control';
import { hasPermission } from '@/lib/auth/permissions';

export async function GET(
  _request: NextRequest,
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

    const statuses = await db
      .select()
      .from(workflowStatuses)
      .where(eq(workflowStatuses.workflowId, workflowId))
      .orderBy(workflowStatuses.position);

    return NextResponse.json(statuses);
  } catch (error) {
    console.error('Error fetching workflow statuses:', error);
    return NextResponse.json({ error: 'Failed to fetch workflow statuses' }, { status: 500 });
  }
}

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
    const { name, category, color } = body;

    if (!name || !category || !color) {
      return NextResponse.json(
        { error: 'Name, category, and color are required' },
        { status: 400 }
      );
    }

    const [workflow] = await db
      .select({ id: workflows.id, organizationId: workflows.organizationId })
      .from(workflows)
      .where(eq(workflows.id, workflowId))
      .limit(1);

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

    const [lastStatus] = await db
      .select({ position: workflowStatuses.position })
      .from(workflowStatuses)
      .where(eq(workflowStatuses.workflowId, workflowId))
      .orderBy(desc(workflowStatuses.position))
      .limit(1);

    const [status] = await db
      .insert(workflowStatuses)
      .values({
        workflowId,
        name,
        category,
        color,
        position: (lastStatus?.position ?? -1) + 1,
      })
      .returning();

    return NextResponse.json(status, { status: 201 });
  } catch (error) {
    console.error('Error creating workflow status:', error);
    return NextResponse.json({ error: 'Failed to create workflow status' }, { status: 500 });
  }
}
