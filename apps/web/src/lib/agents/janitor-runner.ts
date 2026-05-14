/**
 * Janitor runner — pulls stale issues, asks the janitor agent for a
 * decision per issue, and applies it (comment / snooze / close).
 *
 * Kept separate from `janitor.ts` so the agent stays pure (no DB) and
 * easy to unit test. The runner is responsible for:
 *   - Querying stale issues for an org/workspace (non-terminal status,
 *     updated_at older than the threshold).
 *   - Resolving the org's Anthropic credential.
 *   - Applying the chosen action: posting a comment, bumping
 *     updated_at, or closing the issue with the stale-auto label.
 */

import {
  db,
  issues,
  issueComments,
  workflowStatuses,
  sql,
  eq,
  and,
  lte,
  notInArray,
} from '@tasknebula/db';

import {
  sweepStaleIssues,
  StaleIssue,
  JanitorDecision,
  DEFAULT_STALE_THRESHOLD_DAYS,
  DEFAULT_SNOOZE_DAYS,
  STALE_AUTO_LABEL,
} from './janitor';
import {
  getOrganizationSettingsForAgentCredentials,
  resolveProviderApiKeyFromSettings,
} from './credentials';

export interface RunJanitorOptions {
  organizationId: string;
  /** System user id used as the comment author + updater for janitor actions. */
  systemUserId?: string;
  /** Days of inactivity before an issue is considered stale (default 30). */
  staleThresholdDays?: number;
  /** Skip mutating side effects — return decisions only. */
  dryRun?: boolean;
  /** Cap on issues handled per run. */
  limit?: number;
}

export interface AppliedDecision extends JanitorDecision {
  applied: boolean;
  appliedError?: string;
}

const JANITOR_COMMENT_TEMPLATE = (days: number) =>
  `This issue has been quiet for ${days} days. Could the assignee post a quick update on status or blockers? If it's no longer relevant feel free to close it.`;

async function loadStaleIssues(
  organizationId: string,
  thresholdDays: number,
  limit: number
): Promise<StaleIssue[]> {
  const cutoff = new Date(Date.now() - thresholdDays * 24 * 60 * 60 * 1000);

  // Find IDs of statuses in terminal categories so we can exclude them. We
  // resolve at runtime rather than relying on names because workflows are
  // org-customizable.
  const terminalStatuses = await db
    .select({ id: workflowStatuses.id })
    .from(workflowStatuses)
    .where(sql`category IN ('done')`);
  const terminalIds = terminalStatuses.map((s) => s.id);

  const where = terminalIds.length
    ? and(
        eq(issues.organizationId, organizationId),
        lte(issues.updatedAt, cutoff),
        notInArray(issues.statusId, terminalIds)
      )
    : and(
        eq(issues.organizationId, organizationId),
        lte(issues.updatedAt, cutoff)
      );

  const rows = (await db
    .select({
      id: issues.id,
      key: issues.key,
      title: issues.title,
      description: issues.description,
      updatedAt: issues.updatedAt,
      assigneeId: issues.assigneeId,
      reporterId: issues.reporterId,
      priority: issues.priority,
      labels: issues.labels,
      statusCategory: workflowStatuses.category,
    })
    .from(issues)
    .leftJoin(workflowStatuses, eq(workflowStatuses.id, issues.statusId))
    .where(where)
    .limit(limit)) as Array<{
    id: string;
    key: string;
    title: string;
    description: string | null;
    updatedAt: Date;
    assigneeId: string | null;
    reporterId: string;
    priority: string;
    labels: unknown;
    statusCategory: string | null;
  }>;

  const now = Date.now();
  return rows.map((r) => ({
    id: r.id,
    key: r.key,
    title: r.title,
    description: r.description,
    updatedAt: r.updatedAt.toISOString(),
    assigneeId: r.assigneeId,
    reporterId: r.reporterId,
    priority: r.priority,
    labels: Array.isArray(r.labels) ? (r.labels as string[]) : [],
    statusCategory: r.statusCategory ?? 'unknown',
    staleDays: Math.floor((now - r.updatedAt.getTime()) / (24 * 60 * 60 * 1000)),
  }));
}

async function postJanitorComment(
  issueId: string,
  systemUserId: string,
  staleDays: number
) {
  await db.insert(issueComments).values({
    issueId,
    content: JANITOR_COMMENT_TEMPLATE(staleDays),
    createdBy: systemUserId,
    updatedBy: systemUserId,
    isInternal: 'false',
    mentions: [],
    reactions: [],
  });
  // Touch updated_at so the issue leaves the stale window for a while.
  await db
    .update(issues)
    .set({ updatedAt: new Date(), updatedBy: systemUserId })
    .where(eq(issues.id, issueId));
}

async function snoozeIssue(issueId: string, systemUserId: string, days: number) {
  const newUpdated = new Date(Date.now() + days * 24 * 60 * 60 * 1000);
  await db
    .update(issues)
    .set({ updatedAt: newUpdated, updatedBy: systemUserId })
    .where(eq(issues.id, issueId));
}

async function autoCloseIssue(
  issueId: string,
  systemUserId: string,
  currentLabels: string[]
) {
  const labelsWithMarker = currentLabels.includes(STALE_AUTO_LABEL)
    ? currentLabels
    : [...currentLabels, STALE_AUTO_LABEL];

  // Find any "done"-category status in this org to transition into.
  const [issueRow] = (await db
    .select({ orgId: issues.organizationId })
    .from(issues)
    .where(eq(issues.id, issueId))
    .limit(1)) as Array<{ orgId: string }>;

  if (!issueRow) return;

  // Pick the first done-category status linked through any workflow used in
  // this org. We're intentionally lenient here — operators can later use
  // the stale-auto label to find these and re-route them.
  const doneStatuses = await db.execute<{ id: string }>(
    sql`SELECT ws.id FROM workflow_statuses ws
        JOIN workflows w ON w.id = ws.workflow_id
        WHERE w.organization_id = ${issueRow.orgId} AND ws.category = 'done'
        ORDER BY ws.position ASC LIMIT 1`
  );
  const doneList: Array<{ id: string }> = Array.isArray(doneStatuses)
    ? (doneStatuses as any)
    : ((doneStatuses as any).rows ?? []);
  const doneStatusId = doneList[0]?.id;

  await db
    .update(issues)
    .set({
      labels: labelsWithMarker,
      updatedAt: new Date(),
      updatedBy: systemUserId,
      ...(doneStatusId ? { statusId: doneStatusId } : {}),
    })
    .where(eq(issues.id, issueId));
}

export async function runJanitorForOrg(
  options: RunJanitorOptions
): Promise<{ decisions: AppliedDecision[]; total: number }> {
  const thresholdDays = options.staleThresholdDays ?? DEFAULT_STALE_THRESHOLD_DAYS;
  const limit = options.limit ?? 100;

  const stale = await loadStaleIssues(options.organizationId, thresholdDays, limit);
  if (stale.length === 0) {
    return { decisions: [], total: 0 };
  }

  const settings = await getOrganizationSettingsForAgentCredentials(
    options.organizationId
  );
  const apiKey = resolveProviderApiKeyFromSettings(settings, 'anthropic');

  const decisions = await sweepStaleIssues({
    workspaceId: options.organizationId,
    issues: stale,
    staleThresholdDays: thresholdDays,
    anthropicApiKey: apiKey,
  });

  const applied: AppliedDecision[] = [];
  const issueById = new Map(stale.map((s) => [s.id, s]));

  for (const decision of decisions) {
    const issue = issueById.get(decision.issueId);
    if (!issue) {
      applied.push({ ...decision, applied: false, appliedError: 'issue missing' });
      continue;
    }

    if (options.dryRun || !options.systemUserId) {
      applied.push({ ...decision, applied: false });
      continue;
    }

    try {
      switch (decision.action) {
        case 'ping_assignee':
          await postJanitorComment(
            issue.id,
            options.systemUserId,
            issue.staleDays
          );
          break;
        case 'snooze':
          await snoozeIssue(
            issue.id,
            options.systemUserId,
            decision.snoozeDays ?? DEFAULT_SNOOZE_DAYS
          );
          break;
        case 'auto_close_with_label':
          await autoCloseIssue(issue.id, options.systemUserId, issue.labels);
          break;
      }
      applied.push({ ...decision, applied: true });
    } catch (err) {
      applied.push({
        ...decision,
        applied: false,
        appliedError: err instanceof Error ? err.message : 'unknown error',
      });
    }
  }

  return { decisions: applied, total: stale.length };
}
