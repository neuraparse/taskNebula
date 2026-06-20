import { NextResponse } from 'next/server';
import { eq } from 'drizzle-orm';
import { agentApprovalRequests, createAuditLog, db } from '@tasknebula/db';
import { auth } from '@/auth';
import { canManageAgentApprovals } from '@/lib/agent-policy/approval-permissions';

export const dynamic = 'force-dynamic';

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ approvalId: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  const { approvalId } = await params;
  const [approval] = await db
    .select()
    .from(agentApprovalRequests)
    .where(eq(agentApprovalRequests.id, approvalId))
    .limit(1);

  if (!approval) {
    return NextResponse.json({ error: 'approval_not_found' }, { status: 404 });
  }

  if (
    !(await canManageAgentApprovals({
      userId: session.user.id,
      workspaceId: approval.workspaceId,
      projectId: approval.projectId,
    }))
  ) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  }

  if (approval.status !== 'pending') {
    return NextResponse.json({ error: 'approval_not_pending' }, { status: 409 });
  }

  const [updated] = await db
    .update(agentApprovalRequests)
    .set({
      status: 'rejected',
      decidedBy: session.user.id,
      decidedAt: new Date(),
      updatedAt: new Date(),
    })
    .where(eq(agentApprovalRequests.id, approval.id))
    .returning();

  await createAuditLog({
    userId: session.user.id,
    organizationId: approval.workspaceId,
    action: 'agent.approval.rejected',
    resourceType: 'agent_approval',
    resourceId: approval.id,
    projectId: approval.projectId ?? undefined,
    metadata: {
      actor: approval.actor,
      resource: approval.resource,
      action: approval.action,
      targetId: approval.targetId,
    },
  }).catch(() => null);

  return NextResponse.json({ approval: updated });
}
