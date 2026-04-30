/**
 * GET /api/integrations/sentry/status?organizationId=...
 *
 * Returns whether the current org has an active Sentry connection plus a
 * minimal set of public metadata for the UI (sentry org slug + name).
 */

import { NextRequest, NextResponse } from 'next/server';
import { and, eq } from 'drizzle-orm';
import {
  db,
  integrationConnections,
  organizationMembers,
} from '@tasknebula/db';
import { auth } from '@/auth';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
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

  try {
    const [row] = await db
      .select({
        id: integrationConnections.id,
        externalAccountId: integrationConnections.externalAccountId,
        externalAccountLabel: integrationConnections.externalAccountLabel,
        scope: integrationConnections.scope,
        metadata: integrationConnections.metadata,
        connectedById: integrationConnections.connectedById,
        createdAt: integrationConnections.createdAt,
        updatedAt: integrationConnections.updatedAt,
      })
      .from(integrationConnections)
      .where(
        and(
          eq(integrationConnections.organizationId, organizationId),
          eq(integrationConnections.provider, 'sentry')
        )
      )
      .limit(1);

    if (!row) return NextResponse.json({ connected: false });

    return NextResponse.json({
      connected: true,
      connection: {
        id: row.id,
        externalAccountId: row.externalAccountId,
        externalAccountLabel: row.externalAccountLabel,
        scope: row.scope,
        metadata: row.metadata,
        connectedById: row.connectedById,
        createdAt: row.createdAt,
        updatedAt: row.updatedAt,
      },
    });
  } catch (err) {
    console.error('Failed to read Sentry integration status', err);
    return NextResponse.json({ connected: false });
  }
}
