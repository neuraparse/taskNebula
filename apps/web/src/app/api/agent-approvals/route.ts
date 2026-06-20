import { NextRequest, NextResponse } from 'next/server';
import { and, desc, eq } from 'drizzle-orm';
import { agentApprovalRequests, db } from '@tasknebula/db';
import { auth } from '@/auth';
import { hasPermission } from '@/lib/auth/permissions';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  const organizationId = request.nextUrl.searchParams.get('organizationId');
  if (!organizationId) {
    return NextResponse.json({ error: 'organization_required' }, { status: 400 });
  }

  if (!(await hasPermission(organizationId, 'org:settings'))) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  }

  const status = request.nextUrl.searchParams.get('status') || 'pending';
  const conditions = [eq(agentApprovalRequests.workspaceId, organizationId)];
  if (status !== 'all') {
    conditions.push(eq(agentApprovalRequests.status, status));
  }

  const approvals = await db
    .select()
    .from(agentApprovalRequests)
    .where(and(...conditions))
    .orderBy(desc(agentApprovalRequests.requestedAt))
    .limit(100);

  return NextResponse.json({ approvals });
}
