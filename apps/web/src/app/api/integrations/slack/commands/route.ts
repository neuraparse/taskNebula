/**
 * POST /api/integrations/slack/commands
 *
 * Slack invokes this endpoint when a user runs `/tn ...`. Slack sends the
 * payload as `application/x-www-form-urlencoded` with the documented fields
 * (team_id, channel_id, user_id, command, text, response_url, trigger_id)
 * and signs the raw body via HMAC-SHA256 using the app's signing secret.
 *
 * Responsibilities:
 *   1. Verify `X-Slack-Signature` / `X-Slack-Request-Timestamp` headers
 *      against the raw body (rejects replay attacks > 5 minutes old).
 *   2. Parse the form, extract the `text`, and dispatch to the handler in
 *      `slack-commands.ts` which returns a Slack-formatted response.
 *   3. For `/tn new`, additionally open a modal via `views.open` using the
 *      trigger_id — Slack gives us 3 seconds and the modal call is fast.
 *
 * Returns 200 with a JSON Slack response in every code path. A 401 is only
 * returned when the signature check fails (Slack retries on non-2xx but a
 * 401 makes a bad signature visible in the developer dashboard).
 */

import { NextRequest, NextResponse } from 'next/server';
import { db, eq, and } from '@tasknebula/db';
import { integrationConnections } from '@tasknebula/db/src/schema/integration-connections';
import {
  callSlackApi,
  getSlackSigningSecret,
  parseSlashCommand,
  verifySlackSignature,
} from '@/lib/integrations/slack';
import {
  handleSlashCommand,
  resolveSlackOrg,
  type SlackCommandContext,
} from '@/lib/integrations/slack-commands';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  const signingSecret = getSlackSigningSecret();
  if (!signingSecret) {
    console.error('[slack-commands] SLACK_SIGNING_SECRET is not set.');
    return NextResponse.json({ error: 'not_configured' }, { status: 500 });
  }

  // Read the raw body BEFORE parsing — the signature is over these exact bytes.
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

  const form = new URLSearchParams(rawBody);
  const teamId = form.get('team_id') ?? '';
  const channelId = form.get('channel_id') ?? '';
  const userId = form.get('user_id') ?? '';
  const userName = form.get('user_name') ?? '';
  const triggerId = form.get('trigger_id') ?? '';
  const text = form.get('text') ?? '';

  const parsed = parseSlashCommand(text);
  const ctx: SlackCommandContext = {
    teamId,
    channelId,
    slackUserId: userId,
    slackUserName: userName,
  };

  // For `new` we also fire-and-forget views.open so the modal appears. The
  // synchronous response from handleSlashCommand stays ephemeral.
  if (parsed.verb === 'new' && triggerId) {
    void openNewIssueModal({
      teamId,
      triggerId,
      seedTitle: parsed.raw,
      channelId,
    }).catch((err) =>
      console.warn('[slack-commands] views.open failed', err)
    );
  }

  const response = await handleSlashCommand(parsed, ctx);
  return NextResponse.json(response);
}

/**
 * Open the issue-creation modal seeded with the slash command text. Uses the
 * bot token stored in `integration_connections` for the workspace. Errors are
 * logged and swallowed — the caller already returned a synchronous ack.
 */
async function openNewIssueModal(params: {
  teamId: string;
  triggerId: string;
  seedTitle: string;
  channelId: string;
}): Promise<void> {
  const org = await resolveSlackOrg(params.teamId);
  if (!org) return;

  const [conn] = await db
    .select({ accessTokenEnc: integrationConnections.accessTokenEnc })
    .from(integrationConnections)
    .where(
      and(
        eq(integrationConnections.id, org.connectionId),
        eq(integrationConnections.provider, 'slack')
      )
    )
    .limit(1);
  if (!conn) return;

  // Modal that callbacks into /interactivity with callback_id =
  // "tn_new_issue_modal". The interactivity handler does the actual insert.
  const view = {
    type: 'modal',
    callback_id: 'tn_new_issue_modal',
    private_metadata: JSON.stringify({
      channelId: params.channelId,
    }),
    title: { type: 'plain_text', text: 'New TaskNebula issue' },
    submit: { type: 'plain_text', text: 'Create' },
    close: { type: 'plain_text', text: 'Cancel' },
    blocks: [
      {
        type: 'input',
        block_id: 'title',
        label: { type: 'plain_text', text: 'Title' },
        element: {
          type: 'plain_text_input',
          action_id: 'value',
          initial_value: params.seedTitle.slice(0, 480),
          max_length: 500,
        },
      },
      {
        type: 'input',
        block_id: 'description',
        optional: true,
        label: { type: 'plain_text', text: 'Description' },
        element: {
          type: 'plain_text_input',
          action_id: 'value',
          multiline: true,
        },
      },
      {
        type: 'input',
        block_id: 'project',
        optional: true,
        label: { type: 'plain_text', text: 'Project key (e.g. TN)' },
        element: { type: 'plain_text_input', action_id: 'value' },
      },
    ],
  };

  await callSlackApi('views.open', conn.accessTokenEnc, {
    trigger_id: params.triggerId,
    view,
  });
}
