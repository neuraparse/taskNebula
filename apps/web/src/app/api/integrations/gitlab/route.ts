/**
 * DELETE /api/integrations/gitlab?organizationId=...
 *
 * Removes the GitLab integration_connections row for the given organization.
 */

import { NextRequest, NextResponse } from 'next/server';
import { and, eq } from 'drizzle-orm';
import { db, integrationConnections } from '@tasknebula/db';
import { auth } from '@/auth';
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
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  try {
    await db
      .delete(integrationConnections)
      .where(
        and(
          eq(integrationConnections.organizationId, organizationId),
          eq(integrationConnections.provider, 'gitlab')
        )
      );
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('Failed to delete GitLab integration_connection', err);
    return NextResponse.json({ error: 'Failed to disconnect GitLab' }, { status: 500 });
  }
}
