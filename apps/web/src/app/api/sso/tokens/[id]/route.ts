/**
 * SCIM token revocation. Hard delete is intentionally avoided so audit
 * logs / last-used timestamps survive — `revokedAt` is the off switch.
 */
import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { db, scimTokens, eq } from '@tasknebula/db';
import { hasPermission } from '@/lib/auth/permissions';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const { id } = await params;
  const [row] = await db
    .select({ workspaceId: scimTokens.workspaceId })
    .from(scimTokens)
    .where(eq(scimTokens.id, id))
    .limit(1);
  if (!row) {
    return NextResponse.json({ error: 'Token not found' }, { status: 404 });
  }
  if (!(await hasPermission(row.workspaceId, 'org:settings'))) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }
  await db
    .update(scimTokens)
    .set({ revokedAt: new Date() })
    .where(eq(scimTokens.id, id));
  return NextResponse.json({ ok: true });
}
