/**
 * Audit log sink — connectivity test.
 *
 * POST /api/admin/audit-log-sinks/:sinkId/test
 *   Sends a synthetic audit event to the sink right now and returns the
 *   outcome. Does not write to audit_logs (so it can't cycle on itself).
 *
 *   Useful for the "Test connectivity" button in the settings UI.
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { hasPermission } from '@/lib/auth/permissions';
import { db, auditLogSinks, eq } from '@tasknebula/db';
import { deliverToSink } from '@/lib/audit/sink-dispatcher';
import type { SinkType } from '@/lib/audit/sink-dispatcher';

export const dynamic = 'force-dynamic';

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ sinkId: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const { sinkId } = await params;
  const [sink] = await db
    .select()
    .from(auditLogSinks)
    .where(eq(auditLogSinks.id, sinkId))
    .limit(1);
  if (!sink) {
    return NextResponse.json({ error: 'Sink not found' }, { status: 404 });
  }
  const canManage = await hasPermission(sink.workspaceId, 'org:settings');
  if (!canManage) {
    return NextResponse.json(
      { error: 'Insufficient permissions' },
      { status: 403 }
    );
  }

  const result = await deliverToSink(
    {
      id: sink.id,
      workspaceId: sink.workspaceId,
      type: sink.type as SinkType,
      name: sink.name,
      config: (sink.config as Record<string, unknown>) ?? {},
      signingSecret: sink.signingSecret,
      successCount: sink.successCount,
      failureCount: sink.failureCount,
    },
    {
      id: 'test-' + Date.now(),
      workspaceId: sink.workspaceId,
      action: 'organization.updated',
      resourceType: 'audit_log_sink',
      resourceId: sink.id,
      userId: session.user.id,
      projectId: null,
      issueId: null,
      changes: null,
      metadata: { test: true },
      createdAt: new Date().toISOString(),
    }
  );

  return NextResponse.json({ result });
}
