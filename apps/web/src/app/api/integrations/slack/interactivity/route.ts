/**
 * POST /api/integrations/slack/interactivity
 *
 * Single endpoint for every Slack "interactivity" event — message actions
 * (right-click → "Create TaskNebula issue"), modal submissions, and button
 * clicks. Slack POSTs `payload=<json>` with `application/x-www-form-urlencoded`
 * encoding and signs the raw body with the app's signing secret.
 *
 * We support two payload types today:
 *   - `message_action` with callback_id `tn_create_from_message` →
 *     opens a modal pre-filled with the message body / author / channel.
 *   - `view_submission` with callback_id `tn_new_issue_modal` →
 *     creates the issue and (if the modal was opened from a message) posts
 *     the bridge thread reply via `createIssueFromSlackMessage`.
 *
 * Modal cancellations and other payload types are acknowledged with 200 OK.
 */

import { NextRequest, NextResponse } from 'next/server';
import { db, eq, and } from '@tasknebula/db';
import { integrationConnections } from '@tasknebula/db/src/schema/integration-connections';
import {
  callSlackApi,
  getSlackSigningSecret,
  verifySlackSignature,
} from '@/lib/integrations/slack';
import {
  resolveSlackOrg,
} from '@/lib/integrations/slack-commands';
import { createIssueFromSlackMessage } from '@/lib/integrations/slack-issue-bridge';

export const dynamic = 'force-dynamic';

interface MessageActionPayload {
  type: 'message_action';
  callback_id: string;
  trigger_id: string;
  team: { id: string; domain?: string };
  user: { id: string; name?: string };
  channel: { id: string; name?: string };
  message: {
    ts: string;
    thread_ts?: string;
    text?: string;
    user?: string;
  };
  response_url?: string;
}

interface ViewSubmissionPayload {
  type: 'view_submission';
  team: { id: string };
  user: { id: string; name?: string };
  view: {
    id: string;
    callback_id: string;
    private_metadata?: string;
    state: {
      values: Record<
        string,
        Record<
          string,
          {
            type: string;
            value?: string;
            selected_option?: { value?: string };
          }
        >
      >;
    };
  };
}

type Payload = MessageActionPayload | ViewSubmissionPayload | { type: string };

export async function POST(request: NextRequest) {
  const signingSecret = getSlackSigningSecret();
  if (!signingSecret) {
    console.error('[slack-interactivity] SLACK_SIGNING_SECRET is not set.');
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

  const form = new URLSearchParams(rawBody);
  const payloadRaw = form.get('payload');
  if (!payloadRaw) {
    return NextResponse.json({ error: 'missing_payload' }, { status: 400 });
  }
  let payload: Payload;
  try {
    payload = JSON.parse(payloadRaw) as Payload;
  } catch {
    return NextResponse.json({ error: 'invalid_json' }, { status: 400 });
  }

  if (payload.type === 'message_action') {
    return handleMessageAction(payload as MessageActionPayload);
  }
  if (payload.type === 'view_submission') {
    return handleViewSubmission(payload as ViewSubmissionPayload);
  }

  // Acknowledge all other interactivity payloads (block_actions, etc.) so
  // Slack doesn't keep retrying. We can grow this dispatch table later.
  return NextResponse.json({});
}

// ---------------------------------------------------------------------------
// Message action: "Create TaskNebula issue from this message"
// ---------------------------------------------------------------------------

async function handleMessageAction(
  payload: MessageActionPayload
): Promise<NextResponse> {
  if (payload.callback_id !== 'tn_create_from_message') {
    return NextResponse.json({});
  }

  const org = await resolveSlackOrg(payload.team.id);
  if (!org) {
    // Without a token we can't open a modal, so respond ephemerally via the
    // response_url. Slack will display the text directly to the actor.
    if (payload.response_url) {
      await postEphemeralViaResponseUrl(
        payload.response_url,
        "TaskNebula isn't installed for this workspace yet."
      );
    }
    return NextResponse.json({});
  }

  const [conn] = await db
    .select({ accessTokenEnc: integrationConnections.accessTokenEnc })
    .from(integrationConnections)
    .where(
      and(
        eq(integrationConnections.organizationId, org.organizationId),
        eq(integrationConnections.provider, 'slack')
      )
    )
    .limit(1);
  if (!conn) return NextResponse.json({});

  // Resolve a permalink so the modal — and the resulting issue — has the
  // canonical link back to the originating Slack message.
  let permalink: string | null = null;
  try {
    const resp = await callSlackApi<{ permalink: string }>(
      'chat.getPermalink',
      conn.accessTokenEnc,
      {
        channel: payload.channel.id,
        message_ts: payload.message.ts,
      }
    );
    if (resp.ok && resp.data?.permalink) permalink = resp.data.permalink;
  } catch {
    /* permalink is best-effort */
  }

  const seedTitle = (payload.message.text ?? '').split('\n')[0]?.slice(0, 200) ?? '';
  const view = {
    type: 'modal',
    callback_id: 'tn_new_issue_modal',
    private_metadata: JSON.stringify({
      teamId: payload.team.id,
      channelId: payload.channel.id,
      channelName: payload.channel.name ?? null,
      messageTs: payload.message.ts,
      threadTs: payload.message.thread_ts ?? payload.message.ts,
      authorSlackId: payload.message.user ?? '',
      messageText: payload.message.text ?? '',
      permalink,
    }),
    title: { type: 'plain_text', text: 'New issue from Slack' },
    submit: { type: 'plain_text', text: 'Create' },
    close: { type: 'plain_text', text: 'Cancel' },
    blocks: [
      {
        type: 'context',
        elements: [
          {
            type: 'mrkdwn',
            text: `Creating an issue from <@${payload.message.user ?? '?'}>'s message in <#${payload.channel.id}>`,
          },
        ],
      },
      {
        type: 'input',
        block_id: 'title',
        label: { type: 'plain_text', text: 'Title' },
        element: {
          type: 'plain_text_input',
          action_id: 'value',
          initial_value: seedTitle,
          max_length: 500,
        },
      },
      {
        type: 'input',
        block_id: 'description',
        optional: true,
        label: { type: 'plain_text', text: 'Description (extra context)' },
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
        label: { type: 'plain_text', text: 'Project key (overrides channel mapping)' },
        element: { type: 'plain_text_input', action_id: 'value' },
      },
    ],
  };

  const opened = await callSlackApi('views.open', conn.accessTokenEnc, {
    trigger_id: payload.trigger_id,
    view,
  });
  if (!opened.ok) {
    console.warn('[slack-interactivity] views.open failed', opened.error);
  }
  return NextResponse.json({});
}

// ---------------------------------------------------------------------------
// View submission: the "New issue" modal
// ---------------------------------------------------------------------------

async function handleViewSubmission(
  payload: ViewSubmissionPayload
): Promise<NextResponse> {
  if (payload.view.callback_id !== 'tn_new_issue_modal') {
    return NextResponse.json({});
  }

  const values = payload.view.state.values;
  const title = readInput(values, 'title');
  const description = readInput(values, 'description');
  const projectKey = readInput(values, 'project');

  if (!title) {
    // Slack expects this exact shape to highlight the offending input.
    return NextResponse.json({
      response_action: 'errors',
      errors: { title: 'Title is required.' },
    });
  }

  // Pull the meta the message_action handler stuffed in private_metadata.
  let meta: {
    teamId?: string;
    channelId?: string;
    channelName?: string | null;
    messageTs?: string;
    threadTs?: string;
    authorSlackId?: string;
    messageText?: string;
    permalink?: string | null;
  } = {};
  try {
    meta = JSON.parse(payload.view.private_metadata ?? '{}');
  } catch {
    /* keep empty */
  }

  const teamId = meta.teamId ?? payload.team.id;
  const org = await resolveSlackOrg(teamId);
  if (!org) {
    return NextResponse.json({
      response_action: 'errors',
      errors: { title: 'Slack workspace is no longer connected.' },
    });
  }

  // Resolve project id from the optional key field.
  const projectId = projectKey
    ? await resolveProjectByKey(org.organizationId, projectKey)
    : null;

  // Look up a reporter user id — fall back to the installer when we can't
  // map the submitting Slack user.
  const reporterUserId = await resolveReporter(org.organizationId, payload.user.id);
  if (!reporterUserId) {
    return NextResponse.json({
      response_action: 'errors',
      errors: { title: 'No TaskNebula user found to act as the reporter.' },
    });
  }

  // If we have message context, use the bridge (creates the link + thread
  // reply). Otherwise this was a /tn new modal — create a standalone issue.
  if (meta.messageTs && meta.channelId) {
    const result = await createIssueFromSlackMessage({
      organizationId: org.organizationId,
      slackTeamId: teamId,
      slackChannelId: meta.channelId,
      slackMessageTs: meta.messageTs,
      slackThreadTs: meta.threadTs ?? null,
      slackAuthorId: meta.authorSlackId ?? payload.user.id,
      permalink: meta.permalink ?? null,
      title,
      description,
      projectId,
      messageText: meta.messageText ?? null,
      channelName: meta.channelName ?? null,
      reporterUserId,
      extraLabels: [],
    });
    if (!result) {
      return NextResponse.json({
        response_action: 'errors',
        errors: {
          project:
            'Could not resolve a project. Provide a project key or configure a channel mapping.',
        },
      });
    }
    return NextResponse.json({ response_action: 'clear' });
  }

  // Standalone /tn new flow — require a project key when there's no channel.
  if (!projectId) {
    return NextResponse.json({
      response_action: 'errors',
      errors: {
        project: 'A project key is required when creating from /tn new.',
      },
    });
  }

  const result = await createIssueFromSlackMessage({
    organizationId: org.organizationId,
    slackTeamId: teamId,
    slackChannelId: '',
    slackMessageTs: `${Date.now()}.${Math.floor(Math.random() * 1e6)}`,
    slackAuthorId: payload.user.id,
    permalink: null,
    title,
    description,
    projectId,
    messageText: null,
    channelName: null,
    reporterUserId,
    extraLabels: [],
  });
  if (!result) {
    return NextResponse.json({
      response_action: 'errors',
      errors: { project: 'Could not create the issue.' },
    });
  }
  return NextResponse.json({ response_action: 'clear' });
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function readInput(
  values: Record<string, Record<string, { value?: string }>>,
  block: string
): string {
  const action = values[block];
  if (!action) return '';
  const first = Object.values(action)[0];
  return (first?.value ?? '').trim();
}

async function resolveProjectByKey(
  organizationId: string,
  key: string
): Promise<string | null> {
  const { projects } = await import('@tasknebula/db');
  const [row] = await db
    .select({ id: projects.id })
    .from(projects)
    .where(
      and(
        eq(projects.organizationId, organizationId),
        eq(projects.key, key.toUpperCase())
      )
    )
    .limit(1);
  return row?.id ?? null;
}

async function resolveReporter(
  organizationId: string,
  _slackUserId: string
): Promise<string | null> {
  // Until we add a slack_user_id mapping column, fall back to the user that
  // installed the integration. This guarantees we always have a valid FK.
  const [conn] = await db
    .select({ connectedById: integrationConnections.connectedById })
    .from(integrationConnections)
    .where(
      and(
        eq(integrationConnections.organizationId, organizationId),
        eq(integrationConnections.provider, 'slack')
      )
    )
    .limit(1);
  return conn?.connectedById ?? null;
}

async function postEphemeralViaResponseUrl(
  responseUrl: string,
  text: string
): Promise<void> {
  try {
    await fetch(responseUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ response_type: 'ephemeral', text }),
    });
  } catch (err) {
    console.warn('[slack-interactivity] response_url post failed', err);
  }
}
