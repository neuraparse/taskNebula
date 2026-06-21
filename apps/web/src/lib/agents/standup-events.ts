/**
 * Standup event collector.
 *
 * Bridges TaskNebula's DB (issues, comments, activities) into the
 * provider-agnostic `StandupEvent[]` shape consumed by `buildStandupDigest`.
 * Kept separate from `standup.ts` so the agent itself stays free of DB
 * imports and trivial to unit-test.
 */

import {
  db,
  issues,
  issueActivities,
  issueComments,
  workflowStatuses,
  organizationMembers,
  and,
  eq,
  gte,
  inArray,
  desc,
} from '@tasknebula/db';

import type { StandupEvent } from './standup';

export interface CollectEventsInput {
  userId: string;
  organizationId: string;
  windowStart: Date;
  windowEnd: Date;
  /** Cap on total events returned to the prompt. Older items are dropped. */
  maxEvents?: number;
}

const DEFAULT_MAX_EVENTS = 60;

/**
 * Verify the user is actually a member of the org before we leak activity.
 * Returns true if a row exists in organization_members.
 */
export async function isOrgMember(userId: string, organizationId: string): Promise<boolean> {
  const [row] = await db
    .select({ id: organizationMembers.id })
    .from(organizationMembers)
    .where(
      and(
        eq(organizationMembers.userId, userId),
        eq(organizationMembers.organizationId, organizationId),
        eq(organizationMembers.status, 'active')
      )
    )
    .limit(1);
  return !!row;
}

/**
 * Collect issue / comment / activity events for one user inside an org
 * window. Cross-integration sources (GitHub commits, PR reviews) plug
 * in via the optional `extraEvents` parameter on the calling route — this
 * keeps the DB-side collector dependency-free.
 */
export async function collectStandupEvents(input: CollectEventsInput): Promise<StandupEvent[]> {
  const { userId, organizationId, windowStart, windowEnd } = input;

  // 1. Issues the user updated or created. We filter by organization
  // through the issues table and join statuses for friendly labels.
  const userIssues = (await db
    .select({
      id: issues.id,
      key: issues.key,
      title: issues.title,
      updatedAt: issues.updatedAt,
      createdAt: issues.createdAt,
      createdBy: issues.createdBy,
      updatedBy: issues.updatedBy,
      assigneeId: issues.assigneeId,
      statusId: issues.statusId,
      statusName: workflowStatuses.name,
      statusCategory: workflowStatuses.category,
    })
    .from(issues)
    .leftJoin(workflowStatuses, eq(workflowStatuses.id, issues.statusId))
    .where(and(eq(issues.organizationId, organizationId), gte(issues.updatedAt, windowStart)))
    .limit(200)) as Array<{
    id: string;
    key: string;
    title: string;
    updatedAt: Date;
    createdAt: Date;
    createdBy: string;
    updatedBy: string;
    assigneeId: string | null;
    statusId: string;
    statusName: string | null;
    statusCategory: string | null;
  }>;

  const events: StandupEvent[] = [];

  for (const issue of userIssues) {
    const updated = issue.updatedAt.toISOString();
    const created = issue.createdAt.toISOString();

    if (issue.createdBy === userId && issue.createdAt >= windowStart) {
      events.push({
        type: 'issue_created',
        ref: issue.key,
        summary: issue.title,
        at: created,
      });
    }

    if (
      issue.updatedBy === userId &&
      issue.updatedAt >= windowStart &&
      issue.updatedAt <= windowEnd &&
      issue.createdAt < windowStart
    ) {
      const statusLabel = issue.statusName ?? 'updated';
      if ((issue.statusCategory ?? '').toLowerCase() === 'done') {
        events.push({
          type: 'issue_closed',
          ref: issue.key,
          summary: `${issue.title} (closed → ${statusLabel})`,
          at: updated,
        });
      } else {
        events.push({
          type: 'issue_status_changed',
          ref: issue.key,
          summary: `${issue.title} → ${statusLabel}`,
          at: updated,
        });
      }
    }

    if (
      issue.assigneeId === userId &&
      issue.updatedAt >= windowStart &&
      (issue.statusCategory ?? '').toLowerCase() !== 'done' &&
      (issue.statusCategory ?? '').toLowerCase() !== 'cancelled'
    ) {
      events.push({
        type: 'issue_assigned',
        ref: issue.key,
        summary: issue.title,
        at: updated,
      });
    }
  }

  // 2. Comments authored by the user in the window.
  const issueIds = userIssues.map((i) => i.id);
  if (issueIds.length > 0) {
    const comments = (await db
      .select({
        id: issueComments.id,
        issueId: issueComments.issueId,
        content: issueComments.content,
        createdBy: issueComments.createdBy,
        createdAt: issueComments.createdAt,
      })
      .from(issueComments)
      .where(
        and(
          eq(issueComments.createdBy, userId),
          gte(issueComments.createdAt, windowStart),
          inArray(issueComments.issueId, issueIds)
        )
      )
      .orderBy(desc(issueComments.createdAt))
      .limit(50)) as Array<{
      id: string;
      issueId: string;
      content: string;
      createdBy: string;
      createdAt: Date;
    }>;

    const issueByIdMap = new Map(userIssues.map((i) => [i.id, i]));
    for (const c of comments) {
      const issue = issueByIdMap.get(c.issueId);
      if (!issue) continue;
      const snippet = (c.content || '').replace(/\s+/g, ' ').slice(0, 160);
      events.push({
        type: 'comment_authored',
        ref: issue.key,
        summary: snippet || 'commented',
        at: c.createdAt.toISOString(),
      });
    }
  }

  // 3. Other workflow transitions captured in issue_activities — useful
  // when the user moved someone else's issue. We're conservative and
  // only surface status_changed activities to avoid double-counting.
  const activities = (await db
    .select({
      id: issueActivities.id,
      issueId: issueActivities.issueId,
      type: issueActivities.type,
      newValue: issueActivities.newValue,
      createdAt: issueActivities.createdAt,
    })
    .from(issueActivities)
    .where(
      and(
        eq(issueActivities.userId, userId),
        eq(issueActivities.type, 'status_changed'),
        gte(issueActivities.createdAt, windowStart)
      )
    )
    .limit(50)) as Array<{
    id: string;
    issueId: string;
    type: string;
    newValue: string | null;
    createdAt: Date;
  }>;

  const issueLookup = new Map(userIssues.map((i) => [i.id, i]));
  for (const a of activities) {
    const issue = issueLookup.get(a.issueId);
    if (!issue) continue;
    // Skip if we already recorded this transition on the issue row pass.
    const dup = events.find(
      (e) =>
        e.ref === issue.key &&
        (e.type === 'issue_status_changed' || e.type === 'issue_closed') &&
        e.at === a.createdAt.toISOString()
    );
    if (dup) continue;
    events.push({
      type: 'issue_status_changed',
      ref: issue.key,
      summary: `${issue.title} → ${a.newValue ?? 'updated'}`,
      at: a.createdAt.toISOString(),
    });
  }

  // Newest-first then trim.
  events.sort((a, b) => (a.at < b.at ? 1 : -1));
  return events.slice(0, input.maxEvents ?? DEFAULT_MAX_EVENTS);
}
