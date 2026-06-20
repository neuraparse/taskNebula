import { NextResponse } from 'next/server';
import { z } from 'zod';
import { auth } from '@/auth';
import {
  db,
  issues,
  workflowStatuses,
  searchHistory,
  organizationMembers,
  projectMembers,
  parseJQL,
  issuePriorityEnum,
  issueTypeEnum,
} from '@tasknebula/db';
import { eq, and, or, inArray, gte, lte, desc, sql, type SQL } from 'drizzle-orm';
import { withValidation } from '@/lib/api-validation';

export const dynamic = 'force-dynamic';

// FEAT-29: search route now declares its query shape up front. This replaces
// the previous manual `searchParams.get('limit') || '100'` + `parseInt`
// dance and validates numeric ranges.
const searchQuerySchema = z.object({
  q: z.string().min(1, 'q is required'),
  organizationId: z.string().min(1, 'organizationId is required'),
  projectId: z.string().optional(),
  saveHistory: z
    .enum(['true', 'false'])
    .optional()
    .transform((v) => v !== 'false'),
  limit: z.coerce.number().int().min(1).max(500).default(100),
  offset: z.coerce.number().int().min(0).default(0),
});

// JQL criteria are plain strings, but `issues.priority` / `issues.type` are
// pg enums — invalid values must never reach Postgres (enum cast error).
// A filter left with no valid values matches nothing instead of everything.
// `enumValues` is read lazily (not at module scope) so unit tests can mock
// @tasknebula/db without stubbing the enum objects.
type IssuePriority = (typeof issuePriorityEnum.enumValues)[number];
type IssueType = (typeof issueTypeEnum.enumValues)[number];

const isIssuePriority = (value: string): value is IssuePriority =>
  (issuePriorityEnum.enumValues as readonly string[]).includes(value);
const isIssueType = (value: string): value is IssueType =>
  (issueTypeEnum.enumValues as readonly string[]).includes(value);

/**
 * Advanced Search API
 *
 * GET /api/search?q=assignee%20%3D%20me%20AND%20status%20%3D%20%22In%20Progress%22&organizationId=xxx&projectId=xxx&saveHistory=true
 *
 * Query parameters:
 * - q: JQL query string (required)
 * - organizationId: Organization ID (required)
 * - projectId: Project ID (optional, filters to specific project)
 * - saveHistory: Save to search history (optional, default: true)
 * - limit: Max results (optional, default: 100)
 * - offset: Pagination offset (optional, default: 0)
 */
// Migrated to withValidation (FEAT-29). Query params are validated and
// coerced by the wrapper, so manual `parseInt(... || '100')` and presence
// checks are no longer needed here.
export const GET = withValidation({ query: searchQuerySchema })(async (request, { query: q }) => {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { q: query, organizationId, projectId, saveHistory, limit, offset } = q;

    // Membership guard — the caller passes `organizationId` (and optionally
    // `projectId`) as a query parameter, so without a server-side check
    // anyone who can guess an org slug can probe its issue catalogue. Refuse
    // unless the user is currently an org member, and (if narrowing to a
    // project) a member of that project too.
    const [orgMember] = await db
      .select({ role: organizationMembers.role })
      .from(organizationMembers)
      .where(
        and(
          eq(organizationMembers.userId, session.user.id),
          eq(organizationMembers.organizationId, organizationId),
          eq(organizationMembers.status, 'active')
        )
      )
      .limit(1);
    if (!orgMember) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    if (projectId) {
      const [projMember] = await db
        .select({ role: projectMembers.role })
        .from(projectMembers)
        .where(
          and(eq(projectMembers.userId, session.user.id), eq(projectMembers.projectId, projectId))
        )
        .limit(1);
      if (!projMember) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
      }
    }

    // Parse JQL query
    const parseResult = parseJQL(query);
    if (!parseResult.isValid) {
      return NextResponse.json(
        {
          error: 'Invalid query syntax',
          details: parseResult.error,
        },
        { status: 400 }
      );
    }

    const { criteria } = parseResult;

    // Build where conditions
    const conditions: SQL[] = [eq(issues.organizationId, organizationId)];

    // Project filter
    if (projectId) {
      conditions.push(eq(issues.projectId, projectId));
    }

    // Assignee filter
    if (criteria.assignee) {
      if (criteria.assignee === 'me') {
        conditions.push(eq(issues.assigneeId, session.user.id));
      } else if (Array.isArray(criteria.assignee)) {
        conditions.push(inArray(issues.assigneeId, criteria.assignee));
      } else {
        conditions.push(eq(issues.assigneeId, criteria.assignee));
      }
    }

    // Reporter filter
    if (criteria.reporter) {
      if (criteria.reporter === 'me') {
        conditions.push(eq(issues.reporterId, session.user.id));
      } else if (Array.isArray(criteria.reporter)) {
        conditions.push(inArray(issues.reporterId, criteria.reporter));
      } else {
        conditions.push(eq(issues.reporterId, criteria.reporter));
      }
    }

    // Status filter — issues carry a `statusId` FK into workflow_statuses
    // (there is no `issues.status` column); JQL criteria reference statuses
    // by display name, so filter on the joined workflow_statuses.name.
    if (criteria.status) {
      if (Array.isArray(criteria.status)) {
        conditions.push(inArray(workflowStatuses.name, criteria.status));
      } else {
        conditions.push(eq(workflowStatuses.name, criteria.status));
      }
    }

    // Priority filter
    if (criteria.priority) {
      const requested = Array.isArray(criteria.priority) ? criteria.priority : [criteria.priority];
      const valid = requested.filter(isIssuePriority);
      if (valid.length > 0) {
        conditions.push(inArray(issues.priority, valid));
      } else {
        // e.g. `priority = banana` — match nothing rather than everything.
        conditions.push(sql`false`);
      }
    }

    // Type filter
    if (criteria.type) {
      const requested = Array.isArray(criteria.type) ? criteria.type : [criteria.type];
      const valid = requested.filter(isIssueType);
      if (valid.length > 0) {
        conditions.push(inArray(issues.type, valid));
      } else {
        conditions.push(sql`false`);
      }
    }

    // Project filter from criteria
    if (criteria.project && !projectId) {
      if (Array.isArray(criteria.project)) {
        conditions.push(inArray(issues.projectId, criteria.project));
      } else {
        conditions.push(eq(issues.projectId, criteria.project));
      }
    }

    // Sprint filter
    if (criteria.sprint) {
      if (Array.isArray(criteria.sprint)) {
        conditions.push(inArray(issues.sprintId, criteria.sprint as string[]));
      } else {
        conditions.push(eq(issues.sprintId, criteria.sprint));
      }
    }

    // Labels filter (contains) — `labels` is a jsonb string array, so a SQL
    // LIKE is invalid; use jsonb containment (matches the idiom in
    // lib/search/hybrid.ts). Multiple labels are OR'd (any-of, JQL `IN`).
    if (criteria.labels) {
      const labelValues = (
        Array.isArray(criteria.labels) ? criteria.labels : [criteria.labels]
      ).filter((label): label is string => typeof label === 'string' && label.length > 0);
      if (labelValues.length > 0) {
        const labelConditions = labelValues.map(
          (label) => sql`${issues.labels} @> ${JSON.stringify([label])}::jsonb`
        );
        const labelCondition =
          labelConditions.length === 1 ? labelConditions[0] : or(...labelConditions);
        if (labelCondition) {
          conditions.push(labelCondition);
        }
      }
    }

    // Date filters
    if (criteria.createdAfter) {
      conditions.push(gte(issues.createdAt, new Date(criteria.createdAfter)));
    }
    if (criteria.createdBefore) {
      conditions.push(lte(issues.createdAt, new Date(criteria.createdBefore)));
    }
    if (criteria.updatedAfter) {
      conditions.push(gte(issues.updatedAt, new Date(criteria.updatedAfter)));
    }
    if (criteria.updatedBefore) {
      conditions.push(lte(issues.updatedAt, new Date(criteria.updatedBefore)));
    }

    // Execute search query. workflow_statuses is joined unconditionally so
    // every row exposes its status name/category and status-name criteria
    // can filter on the joined column (issues.status does not exist).
    const results = await db
      .select({
        id: issues.id,
        key: issues.key,
        title: issues.title,
        description: issues.description,
        statusId: issues.statusId,
        status: workflowStatuses.name,
        statusCategory: workflowStatuses.category,
        priority: issues.priority,
        type: issues.type,
        labels: issues.labels,
        assigneeId: issues.assigneeId,
        reporterId: issues.reporterId,
        projectId: issues.projectId,
        sprintId: issues.sprintId,
        createdAt: issues.createdAt,
        updatedAt: issues.updatedAt,
      })
      .from(issues)
      .innerJoin(workflowStatuses, eq(issues.statusId, workflowStatuses.id))
      .where(and(...conditions))
      .orderBy(desc(issues.createdAt))
      .limit(limit)
      .offset(offset);

    // Save to search history
    if (saveHistory) {
      try {
        await db.insert(searchHistory).values({
          userId: session.user.id,
          organizationId,
          projectId: projectId || null,
          query,
          criteria: criteria as Record<string, unknown>,
          resultCount: results.length.toString(),
        });
      } catch (error) {
        // Non-critical, don't fail the request
        console.error('Failed to save search history:', error);
      }
    }

    return NextResponse.json({
      results,
      count: results.length,
      query,
      criteria,
    });
  } catch (error) {
    console.error('Search error:', error);
    return NextResponse.json({ error: 'Failed to execute search' }, { status: 500 });
  }
});
