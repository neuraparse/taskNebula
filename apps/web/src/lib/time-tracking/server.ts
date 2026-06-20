/**
 * Server helpers shared by the time-tracking route handlers (task #10).
 *
 * Centralises three things so each `route.ts` stays short:
 *   1. {@link assertIssueAccess} — auth + "can this user view this issue?".
 *   2. {@link recomputeActualHours} — keeps `issues.actual_hours` in sync with
 *      the sum of finalised `time_entries.duration_seconds` for the issue. We
 *      do this in app code (vs a trigger) because (a) Drizzle can't migrate a
 *      trigger cleanly and (b) the running-timer case is route-specific.
 *   3. {@link sumDurationSeconds} — convenience for analytics.
 */

import { and, eq, isNotNull, sql } from 'drizzle-orm';
import {
  db,
  issues,
  organizationMembers,
  projectMembers,
  projects,
  timeEntries,
  users,
} from '@tasknebula/db';

export type IssueAccessIssue = {
  id: string;
  projectId: string;
  organizationId: string;
  key: string;
  title: string;
};

export interface IssueAccessResult {
  ok: true;
  issue: IssueAccessIssue;
}

export interface IssueAccessFailure {
  ok: false;
  status: 401 | 403 | 404;
  reason: string;
}

/**
 * Verify the user can at least *view* the issue. We deliberately keep this
 * narrow — write permission for time entries is "any member of the issue's
 * project", which mirrors the existing comment policy.
 */
export async function assertIssueAccess(
  userId: string | undefined,
  issueId: string
): Promise<IssueAccessResult | IssueAccessFailure> {
  if (!userId) return { ok: false, status: 401, reason: 'Unauthorized' };

  const [issue] = await db
    .select({
      id: issues.id,
      projectId: issues.projectId,
      organizationId: issues.organizationId,
      key: issues.key,
      title: issues.title,
    })
    .from(issues)
    .where(eq(issues.id, issueId))
    .limit(1);
  if (!issue) return { ok: false, status: 404, reason: 'Issue not found' };

  // Super admin shortcut.
  const [u] = await db
    .select({ isSuperAdmin: users.isSuperAdmin })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);
  if (u?.isSuperAdmin) return { ok: true, issue };

  // Org owner / admin shortcut.
  const [orgMember] = await db
    .select({ role: organizationMembers.role })
    .from(organizationMembers)
    .where(
      and(
        eq(organizationMembers.userId, userId),
        eq(organizationMembers.organizationId, issue.organizationId),
        eq(organizationMembers.status, 'active')
      )
    )
    .limit(1);
  if (orgMember?.role === 'owner' || orgMember?.role === 'admin') {
    return { ok: true, issue };
  }

  // Otherwise the user needs to be a project member.
  const [member] = await db
    .select({ projectId: projectMembers.projectId })
    .from(projectMembers)
    .innerJoin(projects, eq(projects.id, projectMembers.projectId))
    .where(and(eq(projectMembers.userId, userId), eq(projectMembers.projectId, issue.projectId)))
    .limit(1);
  if (!member) {
    return { ok: false, status: 403, reason: 'Not a project member' };
  }
  return { ok: true, issue };
}

/**
 * Recompute `issues.actual_hours` from the sum of finalised entries.
 *
 * We always run this after a create / stop / delete so the column matches the
 * underlying log. Running entries (`ended_at IS NULL`) are excluded — they
 * surface as the live timer in the UI but don't count toward "actual" yet.
 */
export async function recomputeActualHours(issueId: string): Promise<number> {
  const [row] = await db
    .select({
      totalSeconds: sql<number>`COALESCE(SUM(${timeEntries.durationSeconds}), 0)::int`,
    })
    .from(timeEntries)
    .where(and(eq(timeEntries.issueId, issueId), isNotNull(timeEntries.endedAt)));

  const totalSeconds = Number(row?.totalSeconds ?? 0);
  const hours = Math.round((totalSeconds / 3600) * 100) / 100;

  await db
    .update(issues)
    .set({ actualHours: hours.toFixed(2) })
    .where(eq(issues.id, issueId));

  return hours;
}

/**
 * Sum of finalised seconds for an issue. Cheap helper used by burndown.
 */
export async function sumDurationSeconds(issueId: string): Promise<number> {
  const [row] = await db
    .select({
      totalSeconds: sql<number>`COALESCE(SUM(${timeEntries.durationSeconds}), 0)::int`,
    })
    .from(timeEntries)
    .where(and(eq(timeEntries.issueId, issueId), isNotNull(timeEntries.endedAt)));
  return Number(row?.totalSeconds ?? 0);
}
