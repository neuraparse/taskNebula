import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { db, and, eq, organizationMembers } from '@tasknebula/db';
import { integrationConnections } from '@tasknebula/db/src/schema/integration-connections';
import {
  asTokenEnvelope,
  decryptToken,
} from '@/lib/integrations/token-crypto';

export const dynamic = 'force-dynamic';

/**
 * DELETE /api/integrations/slack?organizationId=<id>
 *
 * Revokes the org's Slack connection. We best-effort call `auth.revoke` on
 * Slack to invalidate the token upstream, then delete the row from
 * `integration_connections`. Token revocation failures are logged but do not
 * block deletion — the local row is the source of truth.
 */
export async function DELETE(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const organizationId = searchParams.get('organizationId');
  if (!organizationId) {
    return NextResponse.json(
      { error: 'organizationId is required' },
      { status: 400 }
    );
  }

  const [member] = await db
    .select({ id: organizationMembers.id })
    .from(organizationMembers)
    .where(
      and(
        eq(organizationMembers.userId, session.user.id),
        eq(organizationMembers.organizationId, organizationId)
      )
    )
    .limit(1);

  if (!member) {
    return NextResponse.json(
      { error: 'You do not have access to this organization.' },
      { status: 403 }
    );
  }

  const [connection] = await db
    .select()
    .from(integrationConnections)
    .where(
      and(
        eq(integrationConnections.organizationId, organizationId),
        eq(integrationConnections.provider, 'slack')
      )
    )
    .limit(1);

  if (!connection) {
    // Nothing to delete — treat as idempotent success.
    return NextResponse.json({ ok: true, alreadyDisconnected: true });
  }

  // Best-effort upstream revoke.
  const envelope = asTokenEnvelope(connection.accessTokenEnc);
  if (envelope) {
    try {
      const token = decryptToken(envelope);
      await fetch('https://slack.com/api/auth.revoke', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          Authorization: `Bearer ${token}`,
        },
        body: new URLSearchParams({ token }).toString(),
      });
    } catch (err) {
      console.warn('Slack auth.revoke failed (ignored):', err);
    }
  }

  await db
    .delete(integrationConnections)
    .where(eq(integrationConnections.id, connection.id));

  return NextResponse.json({ ok: true });
}
