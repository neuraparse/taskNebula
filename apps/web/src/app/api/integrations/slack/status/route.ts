import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { db, and, eq } from '@tasknebula/db';
import { integrationConnections } from '@tasknebula/db/src/schema/integration-connections';
import { hasPermission } from '@/lib/auth/permissions';

export const dynamic = 'force-dynamic';

/**
 * GET /api/integrations/slack/status?organizationId=<id>
 *
 * Lightweight endpoint the settings UI polls to decide whether to show
 * "Connect" or "Disconnect" for Slack. Never returns the encrypted token
 * envelope — just the public display fields.
 */
export async function GET(request: NextRequest) {
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
      { error: 'Viewing integration settings requires organization settings permission.' },
      { status: 403 }
    );
  }

  const [connection] = await db
    .select({
      id: integrationConnections.id,
      externalAccountId: integrationConnections.externalAccountId,
      externalAccountLabel: integrationConnections.externalAccountLabel,
      scope: integrationConnections.scope,
      connectedById: integrationConnections.connectedById,
      createdAt: integrationConnections.createdAt,
      updatedAt: integrationConnections.updatedAt,
    })
    .from(integrationConnections)
    .where(
      and(
        eq(integrationConnections.organizationId, organizationId),
        eq(integrationConnections.provider, 'slack')
      )
    )
    .limit(1);

  if (!connection) {
    return NextResponse.json({ connected: false });
  }

  return NextResponse.json({
    connected: true,
    connection: {
      id: connection.id,
      externalAccountId: connection.externalAccountId,
      externalAccountLabel: connection.externalAccountLabel,
      scope: connection.scope,
      connectedById: connection.connectedById,
      createdAt: connection.createdAt,
      updatedAt: connection.updatedAt,
    },
  });
}
