import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import {
  db,
  integrationConnections,
  organizationMembers,
  eq,
  and,
} from '@tasknebula/db';
import { JIRA_PROVIDER } from '@/lib/integrations/jira';

/**
 * Helpers
 */

async function requireMembership(userId: string, organizationId: string) {
  const [membership] = await db
    .select({ role: organizationMembers.role })
    .from(organizationMembers)
    .where(
      and(
        eq(organizationMembers.userId, userId),
        eq(organizationMembers.organizationId, organizationId)
      )
    )
    .limit(1);
  return membership ?? null;
}

/**
 * GET /api/integrations/jira?organizationId=...
 *
 * Returns the current connection summary for the Jira integration (no tokens).
 * Used by the settings UI to render Connect / Disconnect state.
 */
export async function GET(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const organizationId = request.nextUrl.searchParams.get('organizationId');
  if (!organizationId) {
    return NextResponse.json(
      { error: 'organizationId query parameter is required' },
      { status: 400 }
    );
  }

  const membership = await requireMembership(session.user.id, organizationId);
  if (!membership) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const [row] = await db
    .select({
      id: integrationConnections.id,
      provider: integrationConnections.provider,
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
        eq(integrationConnections.provider, JIRA_PROVIDER)
      )
    )
    .limit(1);

  if (!row) {
    return NextResponse.json({ connected: false });
  }

  const metadata = (row.metadata ?? {}) as Record<string, unknown>;
  return NextResponse.json({
    connected: true,
    id: row.id,
    externalAccountId: row.externalAccountId,
    externalAccountLabel: row.externalAccountLabel,
    scope: row.scope,
    siteUrl: typeof metadata.siteUrl === 'string' ? metadata.siteUrl : null,
    siteName:
      typeof metadata.siteName === 'string'
        ? metadata.siteName
        : row.externalAccountLabel,
    connectedAt: row.createdAt,
    updatedAt: row.updatedAt,
  });
}

/**
 * DELETE /api/integrations/jira?organizationId=...
 *
 * Removes the Jira integration connection row for the given organization.
 * Does NOT call Atlassian to revoke tokens (best-effort local cleanup) —
 * users can revoke access from https://id.atlassian.com/manage-profile/apps.
 */
export async function DELETE(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const organizationId = request.nextUrl.searchParams.get('organizationId');
  if (!organizationId) {
    return NextResponse.json(
      { error: 'organizationId query parameter is required' },
      { status: 400 }
    );
  }

  const membership = await requireMembership(session.user.id, organizationId);
  if (!membership) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  await db
    .delete(integrationConnections)
    .where(
      and(
        eq(integrationConnections.organizationId, organizationId),
        eq(integrationConnections.provider, JIRA_PROVIDER)
      )
    );

  return NextResponse.json({ ok: true });
}
