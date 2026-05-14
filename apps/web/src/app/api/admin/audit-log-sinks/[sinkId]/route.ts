/**
 * Audit log sink — single-row endpoint.
 *
 * PATCH  /api/admin/audit-log-sinks/:sinkId
 *   Partial update: name, config, enabled.
 *
 * DELETE /api/admin/audit-log-sinks/:sinkId
 *   Remove the sink.
 *
 * Both require `org:settings` on the owning workspace.
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { auth } from '@/auth';
import { hasPermission } from '@/lib/auth/permissions';
import { db, auditLogSinks, eq } from '@tasknebula/db';
import { redactSinkConfig } from '../route';

export const dynamic = 'force-dynamic';

const patchSchema = z.object({
  name: z.string().min(1).max(120).optional(),
  config: z.record(z.any()).optional(),
  enabled: z.boolean().optional(),
});

async function loadSink(sinkId: string) {
  const [row] = await db
    .select()
    .from(auditLogSinks)
    .where(eq(auditLogSinks.id, sinkId))
    .limit(1);
  return row ?? null;
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ sinkId: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const { sinkId } = await params;
  const sink = await loadSink(sinkId);
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
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }
  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Invalid request data', details: parsed.error.errors },
      { status: 400 }
    );
  }
  const data = parsed.data;
  const [updated] = await db
    .update(auditLogSinks)
    .set({
      ...(data.name !== undefined ? { name: data.name } : {}),
      ...(data.config !== undefined ? { config: data.config } : {}),
      ...(data.enabled !== undefined ? { enabled: data.enabled } : {}),
      updatedAt: new Date(),
    })
    .where(eq(auditLogSinks.id, sinkId))
    .returning();
  if (!updated) {
    return NextResponse.json({ error: 'Sink not found' }, { status: 404 });
  }
  return NextResponse.json({
    sink: {
      ...updated,
      config: redactSinkConfig(
        updated.type as string,
        (updated.config as Record<string, unknown>) ?? {}
      ),
    },
  });
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ sinkId: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const { sinkId } = await params;
  const sink = await loadSink(sinkId);
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
  await db.delete(auditLogSinks).where(eq(auditLogSinks.id, sinkId));
  return NextResponse.json({ ok: true });
}
