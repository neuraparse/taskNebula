/**
 * GET /api/integrations/gitlab/status?organizationId=...
 *
 * Returns whether the current organization has an active GitLab connection
 * and a small amount of non-sensitive metadata useful for the UI.
 */

import { NextRequest, NextResponse } from 'next/server';
import { and, eq } from 'drizzle-orm';
import { db, integrationConnections } from '@tasknebula/db';
import { auth } from '@/auth';
import { hasPermission } from '@/lib/auth/permissions';

export const dynamic = 'force-dynamic';

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
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  try {
    const rows = await db
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
          eq(integrationConnections.provider, 'gitlab')
        )
      )
      .limit(1);

    const row = rows[0];
    if (!row) {
      return NextResponse.json({ connected: false });
    }

    return NextResponse.json({
      connected: true,
      connection: {
        id: row.id,
        externalAccountId: row.externalAccountId,
        externalAccountLabel: row.externalAccountLabel,
        scope: row.scope,
        connectedById: row.connectedById,
        createdAt: row.createdAt,
        updatedAt: row.updatedAt,
      },
    });
  } catch (err) {
    console.error('Failed to read GitLab integration status', err);
    // Return connected=false on schema-not-ready so UI shows Connect CTA.
    return NextResponse.json({ connected: false });
  }
}
