/**
 * POST /api/integrations/slack/events
 *
 * Slack Events API webhook. Three responsibilities:
 *
 *   1. URL verification: when an admin first wires the Events URL in the
 *      Slack app config, Slack sends `{ type: 'url_verification', challenge }`
 *      and expects us to echo the challenge back as plain text or JSON.
 *
 *   2. `reaction_added` events: if the reaction emoji matches the configured
 *      `emoji_trigger` for the channel's route, we create an issue from the
 *      reacted-to message (emoji-triage workflow).
 *
 *   3. `app_mention` and other events: acknowledged with 200 so Slack stops
 *      retrying. We can wire more handlers here later.
 *
 * Every payload is HMAC-verified using the signing secret before any DB or
 * Slack API call so a forged event can't side-effect the system.
 */

import { NextRequest, NextResponse } from 'next/server';
import { db, eq, and } from '@tasknebula/db';
import {
  slackChannelRoutes,
  integrationConnections,
} from '@tasknebula/db';
import {
  callSlackApi,
  getSlackSigningSecret,
  verifySlackSignature,
} from '@/lib/integrations/slack';
import { createIssueFromSlackMessage } from '@/lib/integrations/slack-issue-bridge';
import { resolveSlackOrg } from '@/lib/integrations/slack-commands';

export const dynamic = 'force-dynamic';

interface UrlVerificationEvent {
  type: 'url_verification';
  challenge: string;
}

interface EventCallbackEnvelope {
  type: 'event_callback';
  team_id: string;
  event: ReactionAddedEvent | { type: string };
}

interface ReactionAddedEvent {
  type: 'reaction_added';
  user: string; // reacting user
  reaction: string; // emoji name without colons
  item: {
    type: 'message';
    channel: string;
    ts: string;
  };
  event_ts: string;
}

type SlackEventPayload = UrlVerificationEvent | EventCallbackEnvelope;

export async function POST(request: NextRequest) {
  const signingSecret = getSlackSigningSecret();
  if (!signingSecret) {
    console.error('[slack-events] SLACK_SIGNING_SECRET is not set.');
    return NextResponse.json({ error: 'not_configured' }, { status: 500 });
  }

  const rawBody = await request.text();
  const ok = verifySlackSignature({
    body: rawBody,
    timestamp: request.headers.get('X-Slack-Request-Timestamp'),
    signature: request.headers.get('X-Slack-Signature'),
    signingSecret,
  });
  if (!ok) {
    return NextResponse.json({ error: 'invalid_signature' }, { status: 401 });
  }

  let payload: SlackEventPayload;
  try {
    payload = JSON.parse(rawBody) as SlackEventPayload;
  } catch {
    return NextResponse.json({ error: 'invalid_json' }, { status: 400 });
  }

  // Step 1: URL verification handshake.
  if (payload.type === 'url_verification') {
    return NextResponse.json({ challenge: payload.challenge });
  }

  // Step 2: event_callback dispatch.
  if (payload.type === 'event_callback') {
    const event = payload.event;
    if (event && event.type === 'reaction_added') {
      // Fire-and-forget so the 3-second Slack ack window is met regardless of
      // how long the issue creation takes.
      void handleReactionAdded(
        payload.team_id,
        event as ReactionAddedEvent
      ).catch((err) =>
        console.warn('[slack-events] reaction_added handler failed', err)
      );
    }
  }

  return NextResponse.json({ ok: true });
}

async function handleReactionAdded(
  teamId: string,
  event: ReactionAddedEvent
): Promise<void> {
  if (event.item?.type !== 'message') return;

  const org = await resolveSlackOrg(teamId);
  if (!org) return;

  // Look up the channel route — if no route is configured, or the emoji
  // doesn't match the trigger, ignore the reaction. This keeps the surface
  // area small and predictable: triage only fires for explicitly opted-in
  // channels.
  const [route] = await db
    .select({
      projectId: slackChannelRoutes.projectId,
      emojiTrigger: slackChannelRoutes.emojiTrigger,
      defaultLabel: slackChannelRoutes.defaultLabel,
    })
    .from(slackChannelRoutes)
    .where(
      and(
        eq(slackChannelRoutes.organizationId, org.organizationId),
        eq(slackChannelRoutes.slackTeamId, teamId),
        eq(slackChannelRoutes.slackChannelId, event.item.channel)
      )
    )
    .limit(1);
  if (!route || !route.emojiTrigger) return;
  if (route.emojiTrigger !== event.reaction) return;

  // Resolve the original message text + author by calling conversations.history
  // with a tight window. We can't index Slack messages locally, so this round
  // trip is mandatory for the issue title/description.
  const [conn] = await db
    .select({
      accessTokenEnc: integrationConnections.accessTokenEnc,
      connectedById: integrationConnections.connectedById,
    })
    .from(integrationConnections)
    .where(
      and(
        eq(integrationConnections.organizationId, org.organizationId),
        eq(integrationConnections.provider, 'slack')
      )
    )
    .limit(1);
  if (!conn) return;

  const history = await callSlackApi<{
    messages?: Array<{ ts: string; text?: string; user?: string }>;
  }>('conversations.history', conn.accessTokenEnc, {
    channel: event.item.channel,
    latest: event.item.ts,
    inclusive: true,
    limit: 1,
  });
  const message = history.data?.messages?.[0];
  if (!message) return;

  // Try to get a permalink — best-effort.
  let permalink: string | null = null;
  try {
    const res = await callSlackApi<{ permalink: string }>(
      'chat.getPermalink',
      conn.accessTokenEnc,
      {
        channel: event.item.channel,
        message_ts: event.item.ts,
      }
    );
    if (res.ok) permalink = res.data?.permalink ?? null;
  } catch {
    /* permalink is best-effort */
  }

  await createIssueFromSlackMessage({
    organizationId: org.organizationId,
    slackTeamId: teamId,
    slackChannelId: event.item.channel,
    slackMessageTs: event.item.ts,
    slackAuthorId: message.user ?? event.user,
    permalink,
    title: `:${event.reaction}: ${(message.text ?? '').slice(0, 80) || 'Untitled Slack message'}`,
    description: null,
    projectId: route.projectId,
    messageText: message.text ?? '',
    channelName: null,
    reporterUserId: conn.connectedById ?? '',
    extraLabels: route.defaultLabel ? [route.defaultLabel] : [],
  });
}
