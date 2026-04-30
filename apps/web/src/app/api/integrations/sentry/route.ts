/**
 * DELETE /api/integrations/sentry?organizationId=<id>
 *
 * Removes the Sentry integration connection for the given organization.
 * Sentry's API does not provide an OAuth token revocation endpoint that is
 * usable from the public OAuth client surface — the closest is deleting the
 * installation in the user's settings — so we limit ourselves to deleting
 * the local row. Future work: hit `/api/0/sentry-app-installations/...` for
 * apps that registered as Sentry Apps.
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import {
  db,
  and,
  eq,
  organizationMembers,
  integrationConnections,
} from '@tasknebula/db';

export const dynamic = 'force-dynamic';

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

  try {
    await db
      .delete(integrationConnections)
      .where(
        and(
          eq(integrationConnections.organizationId, organizationId),
          eq(integrationConnections.provider, 'sentry')
        )
      );
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('Failed to delete Sentry integration_connection', err);
    return NextResponse.json(
      { error: 'Failed to disconnect Sentry' },
      { status: 500 }
    );
  }
}
