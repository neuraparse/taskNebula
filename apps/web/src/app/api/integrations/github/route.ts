/**
 * DELETE /api/integrations/github?organizationId=<id>
 *
 * Revokes the org's GitHub connection. We best-effort call the
 * `applications/{client_id}/grant` endpoint to invalidate the token upstream,
 * then delete the row from `integration_connections`. Token revocation
 * failures are logged but do not block deletion — the local row is the
 * source of truth.
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { db, and, eq, integrationConnections } from '@tasknebula/db';
import { asTokenEnvelope, decryptToken } from '@/lib/integrations/token-crypto';
import { revokeGithubGrant } from '@/lib/integrations/github';
import { hasPermission } from '@/lib/auth/permissions';

export const dynamic = 'force-dynamic';

export async function DELETE(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const organizationId = searchParams.get('organizationId');
  if (!organizationId) {
    return NextResponse.json({ error: 'organizationId is required' }, { status: 400 });
  }

  if (!(await hasPermission(organizationId, 'org:settings'))) {
    return NextResponse.json(
      { error: 'Managing integrations requires organization settings permission.' },
      { status: 403 }
    );
  }

  const [connection] = await db
    .select()
    .from(integrationConnections)
    .where(
      and(
        eq(integrationConnections.organizationId, organizationId),
        eq(integrationConnections.provider, 'github')
      )
    )
    .limit(1);

  if (!connection) {
    return NextResponse.json({ ok: true, alreadyDisconnected: true });
  }

  // Best-effort upstream revoke — never blocks the local delete.
  const envelope = asTokenEnvelope(connection.accessTokenEnc);
  if (envelope) {
    try {
      const token = decryptToken(envelope);
      await revokeGithubGrant(token);
    } catch (err) {
      console.warn('GitHub grant revoke failed (ignored):', err);
    }
  }

  try {
    await db.delete(integrationConnections).where(eq(integrationConnections.id, connection.id));
  } catch (err) {
    console.error('Failed to delete GitHub integration_connection', err);
    return NextResponse.json({ error: 'Failed to disconnect GitHub' }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
