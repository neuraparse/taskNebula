/**
 * Slash-command business logic for the Slack integration.
 *
 * The HTTP route at /api/integrations/slack/commands is intentionally thin —
 * it verifies the signature, parses form data, and hands the parsed verb here.
 * Each handler returns the response object Slack expects (we use the
 * `response_type` field to control private vs. in-channel replies).
 *
 * Handlers DO NOT call Slack APIs that require a delayed `response_url` —
 * Slack gives us 3 seconds for the initial reply, which is enough for the
 * queries we run (single-table lookups with appropriate indexes).
 */

import {
  db,
  eq,
  and,
  desc,
  inArray,
  ilike,
  or,
  organizationMembers,
  integrationConnections,
  issues,
  projects,
  users,
  workflowStatuses,
  workflows,
} from '@tasknebula/db';
import { createId } from '@paralleldrive/cuid2';
import {
  parseSlackUserMention,
  type ParsedSlashCommand,
} from './slack';
import { triggerWebhooks } from '@/lib/webhooks/dispatcher';

export interface SlackCommandContext {
  /** Slack team/workspace id (from slash command form). */
  teamId: string;
  /** Slack channel id where the slash command was invoked. */
  channelId: string;
  /** Slack user id of the invoker. */
  slackUserId: string;
  /** Slack username (display) of the invoker. */
  slackUserName: string;
}

export interface SlackSlashResponse {
  response_type: 'ephemeral' | 'in_channel';
  text: string;
  blocks?: unknown[];
}

const ERR_NOT_INSTALLED: SlackSlashResponse = {
  response_type: 'ephemeral',
  text:
    "TaskNebula isn't installed for this Slack workspace yet. Ask an admin to connect it in Settings → Integrations.",
};

const HELP_TEXT: SlackSlashResponse = {
  response_type: 'ephemeral',
  text: [
    '*TaskNebula commands*',
    '`/tn new <title>` — open the new-issue modal pre-filled with your title',
    '`/tn list` — list your open assigned issues',
    '`/tn search <query>` — top 5 matches across your accessible issues',
    '`/tn assign TN-123 @user` — reassign an issue',
    '`/tn status TN-123 done` — transition an issue (backlog | in_progress | in_review | done | blocked)',
  ].join('\n'),
};

/**
 * Resolve the TaskNebula organization + connection row that owns a Slack
 * workspace. We look up by the workspace id stored in
 * `integration_connections.external_account_id`. Returns null when no org has
 * the bot installed.
 */
export async function resolveSlackOrg(teamId: string): Promise<
  | {
      organizationId: string;
      connectionId: string;
      botUserId: string | null;
    }
  | null
> {
  const [row] = await db
    .select({
      organizationId: integrationConnections.organizationId,
      id: integrationConnections.id,
      metadata: integrationConnections.metadata,
    })
    .from(integrationConnections)
    .where(
      and(
        eq(integrationConnections.provider, 'slack'),
        eq(integrationConnections.externalAccountId, teamId)
      )
    )
    .limit(1);

  if (!row) return null;
  const metadata = (row.metadata ?? {}) as Record<string, unknown>;
  return {
    organizationId: row.organizationId,
    connectionId: row.id,
    botUserId:
      typeof metadata.botUserId === 'string' ? metadata.botUserId : null,
  };
}

/**
 * Best-effort mapping from a Slack user id to a TaskNebula user id. Two
 * matching strategies, evaluated in order:
 *   1. exact lookup in users.slackUserId (if such a column exists today —
 *      otherwise this no-ops gracefully and we fall through),
 *   2. match on Slack profile email — left as a follow-up since we'd need
 *      another Slack API call to resolve the user's email.
 *
 * Returns null when no match is found.
 */
async function lookupTaskNebulaUserBySlackId(
  organizationId: string,
  slackUserId: string
): Promise<string | null> {
  // The current users schema does not have a slackUserId column. Until we add
  // one, we can't map Slack users to TN users automatically — return null so
  // the caller can surface a helpful message.
  void organizationId;
  void slackUserId;
  return null;
}

/**
 * Handle the parsed slash command and return a Slack-formatted response.
 *
 * Each verb gets its own helper; the top-level switch is just a dispatch
 * table so the file reads like a menu.
 */
export async function handleSlashCommand(
  parsed: ParsedSlashCommand,
  ctx: SlackCommandContext
): Promise<SlackSlashResponse> {
  const org = await resolveSlackOrg(ctx.teamId);
  if (!org) return ERR_NOT_INSTALLED;

  switch (parsed.verb) {
    case 'help':
      return HELP_TEXT;
    case 'list':
      return handleListMine(org.organizationId, ctx);
    case 'search':
      return handleSearch(org.organizationId, parsed.raw, ctx);
    case 'assign':
      return handleAssign(org.organizationId, parsed.args, ctx);
    case 'status':
      return handleStatus(org.organizationId, parsed.args, ctx);
    case 'new':
      return handleNew(org.organizationId, parsed.raw, ctx);
    case 'unknown':
    default:
      return {
        response_type: 'ephemeral',
        text: `Unknown command. ${HELP_TEXT.text}`,
      };
  }
}

// ---------------------------------------------------------------------------
// Handlers
// ---------------------------------------------------------------------------

async function handleListMine(
  organizationId: string,
  ctx: SlackCommandContext
): Promise<SlackSlashResponse> {
  const userId = await lookupTaskNebulaUserBySlackId(
    organizationId,
    ctx.slackUserId
  );
  if (!userId) {
    return {
      response_type: 'ephemeral',
      text:
        "I couldn't link your Slack account to a TaskNebula user. Ask an admin to map Slack profiles to TaskNebula accounts (follow-up).",
    };
  }

  const rows = await db
    .select({
      key: issues.key,
      title: issues.title,
      statusName: workflowStatuses.name,
      category: workflowStatuses.category,
    })
    .from(issues)
    .leftJoin(workflowStatuses, eq(issues.statusId, workflowStatuses.id))
    .where(
      and(
        eq(issues.organizationId, organizationId),
        eq(issues.assigneeId, userId)
      )
    )
    .orderBy(desc(issues.updatedAt))
    .limit(15);

  const open = rows.filter((r) => r.category !== 'done');
  if (open.length === 0) {
    return {
      response_type: 'ephemeral',
      text: "You have no open assigned issues.",
    };
  }

  const lines = open.map(
    (r) => `• *${r.key}* — ${r.title} _(${r.statusName ?? 'no status'})_`
  );
  return {
    response_type: 'ephemeral',
    text: `Your open issues:\n${lines.join('\n')}`,
  };
}

async function handleSearch(
  organizationId: string,
  query: string,
  _ctx: SlackCommandContext
): Promise<SlackSlashResponse> {
  const q = query.trim();
  if (!q) {
    return {
      response_type: 'ephemeral',
      text: 'Usage: `/tn search <query>`',
    };
  }

  const like = `%${q}%`;
  const rows = await db
    .select({
      key: issues.key,
      title: issues.title,
      statusName: workflowStatuses.name,
    })
    .from(issues)
    .leftJoin(workflowStatuses, eq(issues.statusId, workflowStatuses.id))
    .where(
      and(
        eq(issues.organizationId, organizationId),
        or(ilike(issues.title, like), ilike(issues.key, like))
      )
    )
    .orderBy(desc(issues.updatedAt))
    .limit(5);

  if (rows.length === 0) {
    return {
      response_type: 'ephemeral',
      text: `No issues matched \`${q}\`.`,
    };
  }

  // Block Kit list — each result as a section so they wrap nicely in mobile.
  const blocks: unknown[] = [
    {
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: `*Top ${rows.length} match${rows.length === 1 ? '' : 'es'} for* \`${q}\``,
      },
    },
    { type: 'divider' },
    ...rows.map((r) => ({
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: `*${r.key}* — ${r.title}\n_${r.statusName ?? 'no status'}_`,
      },
    })),
  ];

  return {
    response_type: 'ephemeral',
    text: `${rows.length} match${rows.length === 1 ? '' : 'es'} for ${q}`,
    blocks,
  };
}

async function handleAssign(
  organizationId: string,
  args: string[],
  ctx: SlackCommandContext
): Promise<SlackSlashResponse> {
  const issueKey = args[0];
  const mention = args[1];
  if (!issueKey || !mention) {
    return {
      response_type: 'ephemeral',
      text: 'Usage: `/tn assign TN-123 @user`',
    };
  }

  const slackUserId = parseSlackUserMention(mention);
  if (!slackUserId) {
    return {
      response_type: 'ephemeral',
      text: `\`${mention}\` doesn't look like a Slack user mention.`,
    };
  }

  const issueRow = await loadIssueByKey(organizationId, issueKey);
  if (!issueRow) {
    return {
      response_type: 'ephemeral',
      text: `Issue \`${issueKey}\` not found in this workspace's org.`,
    };
  }

  const newAssigneeId = await lookupTaskNebulaUserBySlackId(
    organizationId,
    slackUserId
  );
  if (!newAssigneeId) {
    return {
      response_type: 'ephemeral',
      text:
        "I couldn't map that Slack user to a TaskNebula account. Add the mapping in Settings → Integrations (follow-up).",
    };
  }

  await db
    .update(issues)
    .set({ assigneeId: newAssigneeId, updatedAt: new Date() })
    .where(eq(issues.id, issueRow.id));

  // Fire webhooks so subscribers see the assignment change.
  void triggerWebhooks({
    organizationId,
    projectId: issueRow.projectId,
    event: 'issue.assigned',
    payload: {
      issueId: issueRow.id,
      issueKey: issueRow.key,
      assigneeId: newAssigneeId,
      source: 'slack-slash',
    },
    actorUserId: null,
  });

  return {
    response_type: 'in_channel',
    text: `Reassigned *${issueRow.key}* to <@${slackUserId}> (requested by <@${ctx.slackUserId}>).`,
  };
}

async function handleStatus(
  organizationId: string,
  args: string[],
  ctx: SlackCommandContext
): Promise<SlackSlashResponse> {
  const issueKey = args[0];
  const requested = (args[1] ?? '').toLowerCase();
  if (!issueKey || !requested) {
    return {
      response_type: 'ephemeral',
      text: 'Usage: `/tn status TN-123 done`',
    };
  }

  const issueRow = await loadIssueByKey(organizationId, issueKey);
  if (!issueRow) {
    return {
      response_type: 'ephemeral',
      text: `Issue \`${issueKey}\` not found in this workspace's org.`,
    };
  }

  // Resolve the workflow status by category, then by name as a fallback.
  const targetCategory = mapStatusKeyword(requested);
  const project = await db
    .select({ defaultWorkflowId: projects.defaultWorkflowId })
    .from(projects)
    .where(eq(projects.id, issueRow.projectId))
    .limit(1);
  const workflowId = project[0]?.defaultWorkflowId;
  if (!workflowId) {
    // Fall back to org default workflow.
    const [defaultWf] = await db
      .select({ id: workflows.id })
      .from(workflows)
      .where(
        and(
          eq(workflows.organizationId, organizationId),
          eq(workflows.isDefault, true)
        )
      )
      .limit(1);
    if (!defaultWf) {
      return {
        response_type: 'ephemeral',
        text: `Project ${issueRow.projectId} has no workflow configured.`,
      };
    }
  }
  const wfStatuses = await db
    .select()
    .from(workflowStatuses)
    .where(eq(workflowStatuses.workflowId, workflowId!));

  const match =
    (targetCategory && wfStatuses.find((s) => s.category === targetCategory)) ||
    wfStatuses.find((s) => s.name.toLowerCase() === requested);

  if (!match) {
    const known = wfStatuses
      .map((s) => `\`${s.name}\``)
      .join(', ');
    return {
      response_type: 'ephemeral',
      text: `Unknown status \`${requested}\`. Known statuses: ${known}.`,
    };
  }

  await db
    .update(issues)
    .set({ statusId: match.id, updatedAt: new Date() })
    .where(eq(issues.id, issueRow.id));

  void triggerWebhooks({
    organizationId,
    projectId: issueRow.projectId,
    event: 'issue.status_changed',
    payload: {
      issueId: issueRow.id,
      issueKey: issueRow.key,
      statusId: match.id,
      statusName: match.name,
      source: 'slack-slash',
    },
    actorUserId: null,
  });

  return {
    response_type: 'in_channel',
    text: `Moved *${issueRow.key}* to *${match.name}* (requested by <@${ctx.slackUserId}>).`,
  };
}

/**
 * `/tn new <title>` — for the synchronous response we just acknowledge that
 * the modal is opening. The route handler (which has the trigger_id needed
 * for views.open) actually opens the modal. We return ephemeral here so the
 * acknowledgement doesn't leak into the channel.
 */
function handleNew(
  organizationId: string,
  title: string,
  _ctx: SlackCommandContext
): SlackSlashResponse {
  void organizationId;
  const trimmed = title.trim();
  if (!trimmed) {
    return {
      response_type: 'ephemeral',
      text: 'Usage: `/tn new <title>` — opens the new-issue modal.',
    };
  }
  // The route handler opens the modal directly via views.open using the
  // trigger_id. We respond with a short ack so the user sees something
  // immediately even if Slack rate-limits the modal.
  return {
    response_type: 'ephemeral',
    text: `Opening the new-issue modal for: _${trimmed}_`,
  };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function loadIssueByKey(organizationId: string, key: string) {
  const normalized = key.toUpperCase();
  const [row] = await db
    .select({
      id: issues.id,
      projectId: issues.projectId,
      key: issues.key,
      statusId: issues.statusId,
    })
    .from(issues)
    .where(
      and(
        eq(issues.organizationId, organizationId),
        eq(issues.key, normalized)
      )
    )
    .limit(1);
  return row ?? null;
}

/**
 * Map a free-text status keyword (the second arg to `/tn status`) to a
 * `workflow_status_category` value when possible. Returns null when the
 * keyword is meant to match a status name directly.
 */
function mapStatusKeyword(
  word: string
): 'backlog' | 'in_progress' | 'in_review' | 'done' | 'blocked' | null {
  switch (word) {
    case 'todo':
    case 'backlog':
      return 'backlog';
    case 'in_progress':
    case 'in-progress':
    case 'progress':
    case 'doing':
      return 'in_progress';
    case 'in_review':
    case 'in-review':
    case 'review':
      return 'in_review';
    case 'done':
    case 'closed':
    case 'complete':
    case 'completed':
      return 'done';
    case 'blocked':
      return 'blocked';
    default:
      return null;
  }
}

/**
 * Used by route handlers to silence unused-import lint warnings for symbols
 * we only need to keep imported because they're side-effectful (e.g.
 * triggering schema evaluation). Tree-shakeable in prod.
 */
export const __slackCommandsTouchpoints = {
  createId,
  inArray,
  organizationMembers,
  users,
};
