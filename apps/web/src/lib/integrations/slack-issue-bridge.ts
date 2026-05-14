/**
 * Slack ↔ Issue bridge.
 *
 * Two responsibilities:
 *   1. createIssueFromSlackMessage — given an authenticated Slack workspace
 *      and a message payload, create a TaskNebula issue and stash a row in
 *      `slack_message_links` so subsequent updates mirror back into the same
 *      thread. The issue description embeds the Slack message text + author +
 *      a permalink, so context never gets lost.
 *   2. postMirroredThreadReply — used by other modules (issue comment route,
 *      status-change webhook handler) to mirror events back into the Slack
 *      thread that spawned the issue.
 *
 * Both helpers are safe to call without a connected integration — they log
 * and return when no Slack workspace owns the issue, so callers don't need
 * an `if (slack)` gate.
 */

import { createId } from '@paralleldrive/cuid2';
import {
  db,
  and,
  eq,
  desc,
  issues,
  projects,
  workflows,
  workflowStatuses,
  organizationMembers,
  integrationConnections,
  slackChannelRoutes,
  slackMessageLinks,
} from '@tasknebula/db';
import { callSlackApi, postSlackMessage } from './slack';

export interface CreateFromSlackParams {
  organizationId: string;
  /** Slack workspace id (T...). */
  slackTeamId: string;
  /** Slack channel id (C...). */
  slackChannelId: string;
  /** Slack message timestamp (the natural key for that message). */
  slackMessageTs: string;
  /** Optional override — when set we open the thread under this ts instead. */
  slackThreadTs?: string | null;
  /** Slack user id of the message author — embedded into the description. */
  slackAuthorId: string;
  /** Permalink to the originating Slack message (chat.getPermalink). */
  permalink?: string | null;
  /** Free-text title for the issue. */
  title: string;
  /** Optional long-form description. The Slack quote is appended automatically. */
  description?: string | null;
  /** Project the issue should belong to. When null, the channel route is consulted. */
  projectId?: string | null;
  /** Slack message text (quoted in the description). */
  messageText?: string | null;
  /** Slack channel name for the description (best-effort). */
  channelName?: string | null;
  /** TaskNebula user id that performed the action — used for createdBy/reporter. */
  reporterUserId: string;
  /** Extra labels to apply (e.g. "slack"). The channel route's label is added automatically. */
  extraLabels?: string[];
}

export interface CreatedIssue {
  id: string;
  key: string;
  projectId: string;
  organizationId: string;
}

export interface SlackBridgeResult {
  issue: CreatedIssue;
  /** Slack ts of the bot's confirmation reply, when the post succeeded. */
  threadTs: string | null;
}

/**
 * Create a new TaskNebula issue from a Slack message, post a confirmation
 * reply into the message's thread, and persist the bidirectional mapping.
 *
 * Returns `null` when the project cannot be resolved (no projectId arg, no
 * channel route, and no fallback) — the caller should surface the error to
 * the Slack user via the modal response or the slash command response.
 */
export async function createIssueFromSlackMessage(
  params: CreateFromSlackParams
): Promise<SlackBridgeResult | null> {
  const projectId = await resolveProjectId(
    params.organizationId,
    params.slackTeamId,
    params.slackChannelId,
    params.projectId ?? null
  );
  if (!projectId) return null;

  const project = await loadProject(projectId);
  if (!project) return null;

  // Pick the project's default workflow + first backlog status.
  const workflowId = await resolveWorkflowId(
    project.organizationId,
    project.defaultWorkflowId
  );
  if (!workflowId) return null;

  const [backlogStatus] = await db
    .select()
    .from(workflowStatuses)
    .where(
      and(
        eq(workflowStatuses.workflowId, workflowId),
        eq(workflowStatuses.category, 'backlog')
      )
    )
    .limit(1);
  if (!backlogStatus) return null;

  // Next sequential issue number for the project.
  const [last] = await db
    .select({ number: issues.number })
    .from(issues)
    .where(eq(issues.projectId, projectId))
    .orderBy(desc(issues.number))
    .limit(1);
  const nextNumber = (last?.number ?? 0) + 1;
  const issueKey = `${project.key}-${nextNumber}`;

  // Compose description: caller-supplied body first, then a "From Slack"
  // block with the original message text + permalink + author.
  const quotedBlock = buildSlackQuoteBlock({
    text: params.messageText ?? '',
    permalink: params.permalink ?? null,
    authorSlackId: params.slackAuthorId,
    channelName: params.channelName ?? null,
  });
  const fullDescription = [params.description?.trim() || '', quotedBlock]
    .filter(Boolean)
    .join('\n\n');

  // Labels: caller extras + channel route default + a "slack" tag we always add.
  const routeLabel = await loadRouteLabel(
    params.organizationId,
    params.slackTeamId,
    params.slackChannelId
  );
  const labels = Array.from(
    new Set([
      ...(params.extraLabels ?? []),
      ...(routeLabel ? [routeLabel] : []),
      'slack',
    ])
  );

  const issueId = createId();
  const now = new Date();
  await db.insert(issues).values({
    id: issueId,
    organizationId: project.organizationId,
    projectId,
    key: issueKey,
    number: nextNumber,
    type: 'task',
    title: params.title.slice(0, 500) || `Slack: ${(params.messageText ?? '').slice(0, 80)}`,
    description: fullDescription || null,
    statusId: backlogStatus.id,
    priority: 'medium',
    reporterId: params.reporterUserId,
    labels,
    customFields: {},
    metadata: {
      source: 'slack',
      slackTeamId: params.slackTeamId,
      slackChannelId: params.slackChannelId,
      slackMessageTs: params.slackMessageTs,
      slackPermalink: params.permalink ?? null,
    },
    createdBy: params.reporterUserId,
    updatedBy: params.reporterUserId,
    createdAt: now,
    updatedAt: now,
  });

  // Best-effort: post a confirmation reply in the Slack thread.
  let threadTs: string | null = null;
  try {
    threadTs = await postConfirmationReply({
      organizationId: params.organizationId,
      channel: params.slackChannelId,
      threadTs: params.slackThreadTs ?? params.slackMessageTs,
      issueKey,
      issueId,
    });
  } catch (err) {
    console.warn('[slack-bridge] confirmation reply failed', err);
  }

  // Persist the link — this powers all future mirrored comments / status updates.
  try {
    await db.insert(slackMessageLinks).values({
      organizationId: params.organizationId,
      slackTeamId: params.slackTeamId,
      slackChannelId: params.slackChannelId,
      slackMessageTs: params.slackMessageTs,
      slackThreadTs: threadTs ?? params.slackThreadTs ?? params.slackMessageTs,
      issueId,
      permalink: params.permalink ?? null,
    });
  } catch (err) {
    // If the unique constraint fires, the message was already linked — that's
    // fine, we ignore the dup so the caller isn't surprised by a 5xx.
    console.warn('[slack-bridge] link insert failed (likely dup)', err);
  }

  return {
    issue: {
      id: issueId,
      key: issueKey,
      projectId,
      organizationId: project.organizationId,
    },
    threadTs,
  };
}

// ---------------------------------------------------------------------------
// Mirror-back helpers
// ---------------------------------------------------------------------------

/**
 * Mirror a TaskNebula event (comment, status change) back into the Slack
 * thread that originally produced the issue. Returns true when a thread
 * reply was posted (or no link exists — silent no-op), false on failure.
 */
export async function postMirroredThreadReply(params: {
  issueId: string;
  text: string;
}): Promise<boolean> {
  const [link] = await db
    .select({
      organizationId: slackMessageLinks.organizationId,
      slackChannelId: slackMessageLinks.slackChannelId,
      slackThreadTs: slackMessageLinks.slackThreadTs,
      slackMessageTs: slackMessageLinks.slackMessageTs,
    })
    .from(slackMessageLinks)
    .where(eq(slackMessageLinks.issueId, params.issueId))
    .limit(1);
  if (!link) return true; // Not a Slack-spawned issue; silently succeed.

  const [conn] = await db
    .select({ accessTokenEnc: integrationConnections.accessTokenEnc })
    .from(integrationConnections)
    .where(
      and(
        eq(integrationConnections.organizationId, link.organizationId),
        eq(integrationConnections.provider, 'slack')
      )
    )
    .limit(1);
  if (!conn) return false;

  const result = await postSlackMessage(conn.accessTokenEnc, {
    channel: link.slackChannelId,
    text: params.text,
    threadTs: link.slackThreadTs ?? link.slackMessageTs,
  });
  return result.ok;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function loadProject(projectId: string) {
  const [row] = await db
    .select({
      id: projects.id,
      key: projects.key,
      organizationId: projects.organizationId,
      defaultWorkflowId: projects.defaultWorkflowId,
    })
    .from(projects)
    .where(eq(projects.id, projectId))
    .limit(1);
  return row ?? null;
}

async function resolveWorkflowId(
  organizationId: string,
  projectDefault: string | null
): Promise<string | null> {
  if (projectDefault) return projectDefault;
  const [wf] = await db
    .select({ id: workflows.id })
    .from(workflows)
    .where(
      and(
        eq(workflows.organizationId, organizationId),
        eq(workflows.isDefault, true)
      )
    )
    .limit(1);
  return wf?.id ?? null;
}

/**
 * Resolve which project a Slack-originating issue should land in. Caller
 * preference wins; otherwise we consult the per-channel mapping. Returns
 * null when nothing is configured so the caller can surface a helpful
 * error rather than silently picking a project.
 */
async function resolveProjectId(
  organizationId: string,
  slackTeamId: string,
  slackChannelId: string,
  caller: string | null
): Promise<string | null> {
  if (caller) return caller;
  const [route] = await db
    .select({ projectId: slackChannelRoutes.projectId })
    .from(slackChannelRoutes)
    .where(
      and(
        eq(slackChannelRoutes.organizationId, organizationId),
        eq(slackChannelRoutes.slackTeamId, slackTeamId),
        eq(slackChannelRoutes.slackChannelId, slackChannelId)
      )
    )
    .limit(1);
  return route?.projectId ?? null;
}

async function loadRouteLabel(
  organizationId: string,
  slackTeamId: string,
  slackChannelId: string
): Promise<string | null> {
  const [route] = await db
    .select({ defaultLabel: slackChannelRoutes.defaultLabel })
    .from(slackChannelRoutes)
    .where(
      and(
        eq(slackChannelRoutes.organizationId, organizationId),
        eq(slackChannelRoutes.slackTeamId, slackTeamId),
        eq(slackChannelRoutes.slackChannelId, slackChannelId)
      )
    )
    .limit(1);
  return route?.defaultLabel ?? null;
}

function buildSlackQuoteBlock(params: {
  text: string;
  permalink: string | null;
  authorSlackId: string;
  channelName: string | null;
}): string {
  const lines: string[] = ['---', '*From Slack*'];
  if (params.permalink) {
    lines.push(`Permalink: ${params.permalink}`);
  }
  lines.push(
    `Author: <@${params.authorSlackId}>` +
      (params.channelName ? ` in #${params.channelName}` : '')
  );
  const quote =
    params.text
      .split('\n')
      .map((line) => `> ${line}`)
      .join('\n') || '> (no message text)';
  lines.push(quote);
  return lines.join('\n');
}

/**
 * Post the bot's "issue created" message into the originating thread and
 * return the new message's ts (used as `slack_thread_ts` for future mirrors).
 */
async function postConfirmationReply(params: {
  organizationId: string;
  channel: string;
  threadTs: string;
  issueKey: string;
  issueId: string;
}): Promise<string | null> {
  const [conn] = await db
    .select({ accessTokenEnc: integrationConnections.accessTokenEnc })
    .from(integrationConnections)
    .where(
      and(
        eq(integrationConnections.organizationId, params.organizationId),
        eq(integrationConnections.provider, 'slack')
      )
    )
    .limit(1);
  if (!conn) return null;

  // Render a small confirmation block. Issue URL is best-effort — we use the
  // canonical app URL when one is configured.
  const appBase = (
    process.env.NEXT_PUBLIC_APP_URL ||
    process.env.APP_URL ||
    'https://app.tasknebula'
  ).replace(/\/$/, '');
  const issueUrl = `${appBase}/issues/${params.issueId}`;

  const result = await callSlackApi<{ ts: string }>(
    'chat.postMessage',
    conn.accessTokenEnc,
    {
      channel: params.channel,
      thread_ts: params.threadTs,
      text: `Created TaskNebula issue *${params.issueKey}* — ${issueUrl}`,
      blocks: [
        {
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: `:white_check_mark: Created TaskNebula issue *<${issueUrl}|${params.issueKey}>*`,
          },
        },
      ],
    }
  );

  if (!result.ok || !result.data?.ts) return null;
  return result.data.ts;
}

/** Touchpoint exports to keep tree-shakers happy with unused imports. */
export const __slackBridgeTouchpoints = {
  organizationMembers,
};
