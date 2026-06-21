/**
 * Slack channel-to-project routing table CRUD.
 *
 * GET    /api/integrations/slack/routes?organizationId=<id>
 *   List configured routes for the org's connected workspace.
 *
 * POST   /api/integrations/slack/routes
 *   Body: { organizationId, slackChannelId, slackChannelName?, projectId,
 *           defaultLabel?, emojiTrigger?, defaultPriority? }
 *   Upserts a route — the unique index on (org, team, channel) drives the
 *   "create-or-update" semantics so the UI never has to delete-then-recreate.
 *
 * DELETE /api/integrations/slack/routes?id=<routeId>&organizationId=<id>
 *   Removes a single route. Idempotent.
 *
 * NOTE: This is the minimal endpoint the roadmap calls out — a richer settings
 * UI is left as a follow-up. Access is aligned with integration settings.
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { db, and, eq, slackChannelRoutes, integrationConnections } from '@tasknebula/db';
import { auth } from '@/auth';
import { hasPermission } from '@/lib/auth/permissions';

export const dynamic = 'force-dynamic';

const createSchema = z.object({
  organizationId: z.string().min(1),
  slackChannelId: z.string().regex(/^[A-Z0-9]{1,32}$/),
  slackChannelName: z.string().max(80).optional(),
  projectId: z.string().min(1),
  defaultLabel: z.string().max(80).optional(),
  emojiTrigger: z.string().max(64).optional(),
  defaultPriority: z.enum(['critical', 'high', 'medium', 'low', 'none']).default('medium'),
});

async function requireIntegrationSettingsPermission(
  request: NextRequest,
  organizationId: string
): Promise<{ userId: string } | NextResponse> {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  if (!(await hasPermission(organizationId, 'org:settings'))) {
    return NextResponse.json(
      { error: 'Managing integrations requires organization settings permission.' },
      { status: 403 }
    );
  }
  return { userId: session.user.id };
}

export async function GET(request: NextRequest) {
  const organizationId = new URL(request.url).searchParams.get('organizationId');
  if (!organizationId) {
    return NextResponse.json({ error: 'organizationId is required' }, { status: 400 });
  }
  const guard = await requireIntegrationSettingsPermission(request, organizationId);
  if (guard instanceof NextResponse) return guard;

  const rows = await db
    .select()
    .from(slackChannelRoutes)
    .where(eq(slackChannelRoutes.organizationId, organizationId));

  return NextResponse.json({ routes: rows });
}

export async function POST(request: NextRequest) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'invalid_json' }, { status: 400 });
  }
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'invalid_body', issues: parsed.error.issues },
      { status: 400 }
    );
  }
  const guard = await requireIntegrationSettingsPermission(request, parsed.data.organizationId);
  if (guard instanceof NextResponse) return guard;

  // Resolve the workspace id from the org's Slack connection. We require a
  // connection because a route without one is meaningless — Slack events
  // would never match.
  const [conn] = await db
    .select({ externalAccountId: integrationConnections.externalAccountId })
    .from(integrationConnections)
    .where(
      and(
        eq(integrationConnections.organizationId, parsed.data.organizationId),
        eq(integrationConnections.provider, 'slack')
      )
    )
    .limit(1);
  if (!conn?.externalAccountId) {
    return NextResponse.json({ error: 'slack_not_connected' }, { status: 400 });
  }

  const slackTeamId = conn.externalAccountId;

  // Upsert — drizzle does not expose ON CONFLICT cleanly across all dialects
  // in our config, so we do a manual select-then-insert/update.
  const [existing] = await db
    .select({ id: slackChannelRoutes.id })
    .from(slackChannelRoutes)
    .where(
      and(
        eq(slackChannelRoutes.organizationId, parsed.data.organizationId),
        eq(slackChannelRoutes.slackTeamId, slackTeamId),
        eq(slackChannelRoutes.slackChannelId, parsed.data.slackChannelId)
      )
    )
    .limit(1);

  if (existing) {
    await db
      .update(slackChannelRoutes)
      .set({
        slackChannelName: parsed.data.slackChannelName ?? null,
        projectId: parsed.data.projectId,
        defaultLabel: parsed.data.defaultLabel ?? null,
        emojiTrigger: parsed.data.emojiTrigger ?? null,
        defaultPriority: parsed.data.defaultPriority,
        updatedAt: new Date(),
      })
      .where(eq(slackChannelRoutes.id, existing.id));
    return NextResponse.json({ ok: true, id: existing.id, updated: true });
  }

  const [inserted] = await db
    .insert(slackChannelRoutes)
    .values({
      organizationId: parsed.data.organizationId,
      slackTeamId,
      slackChannelId: parsed.data.slackChannelId,
      slackChannelName: parsed.data.slackChannelName ?? null,
      projectId: parsed.data.projectId,
      defaultLabel: parsed.data.defaultLabel ?? null,
      emojiTrigger: parsed.data.emojiTrigger ?? null,
      defaultPriority: parsed.data.defaultPriority,
    })
    .returning({ id: slackChannelRoutes.id });

  return NextResponse.json({ ok: true, id: inserted?.id, created: true });
}

export async function DELETE(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const organizationId = searchParams.get('organizationId');
  const id = searchParams.get('id');
  if (!organizationId || !id) {
    return NextResponse.json({ error: 'organizationId and id are required' }, { status: 400 });
  }
  const guard = await requireIntegrationSettingsPermission(request, organizationId);
  if (guard instanceof NextResponse) return guard;

  await db
    .delete(slackChannelRoutes)
    .where(
      and(eq(slackChannelRoutes.id, id), eq(slackChannelRoutes.organizationId, organizationId))
    );

  return NextResponse.json({ ok: true });
}
