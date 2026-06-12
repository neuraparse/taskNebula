import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { db, workflowTransitions, workflows } from '@tasknebula/db';
import { and, eq } from 'drizzle-orm';
import { isActiveOrganizationMember } from '@/lib/auth/access-control';
import { hasPermission } from '@/lib/auth/permissions';

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ workflowId: string; transitionId: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { workflowId, transitionId } = await params;

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

    const [deletedTransition] = await db
      .delete(workflowTransitions)
      .where(
        and(
          eq(workflowTransitions.id, transitionId),
          eq(workflowTransitions.workflowId, workflowId)
        )
      )
      .returning();

    if (!deletedTransition) {
      return NextResponse.json({ error: 'Transition not found' }, { status: 404 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting workflow transition:', error);
    return NextResponse.json({ error: 'Failed to delete workflow transition' }, { status: 500 });
  }
}
