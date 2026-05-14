import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { auth } from '@/auth';
import { db, issues, users, workflowStatuses, projects, sprints, searchHistory, parseJQL } from '@tasknebula/db';
import { eq, and, or, inArray, gte, lte, like, desc } from 'drizzle-orm';
import { createId } from '@paralleldrive/cuid2';
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
export const GET = withValidation({ query: searchQuerySchema })(async (
  request,
  { query: q }
) => {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { q: query, organizationId, projectId, saveHistory, limit, offset } = q;

    // Parse JQL query
    const parseResult = parseJQL(query);
    if (!parseResult.isValid) {
      return NextResponse.json({ 
        error: 'Invalid query syntax', 
        details: parseResult.error 
      }, { status: 400 });
    }

    const { criteria } = parseResult;

    // Build where conditions
    const conditions: any[] = [eq(issues.organizationId, organizationId)];

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

    // Status filter
    if (criteria.status) {
      if (Array.isArray(criteria.status)) {
        conditions.push(inArray(issues.status, criteria.status));
      } else {
        conditions.push(eq(issues.status, criteria.status));
      }
    }

    // Priority filter
    if (criteria.priority) {
      if (Array.isArray(criteria.priority)) {
        conditions.push(inArray(issues.priority, criteria.priority));
      } else {
        conditions.push(eq(issues.priority, criteria.priority));
      }
    }

    // Type filter
    if (criteria.type) {
      if (Array.isArray(criteria.type)) {
        conditions.push(inArray(issues.type, criteria.type));
      } else {
        conditions.push(eq(issues.type, criteria.type));
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

    // Labels filter (contains)
    if (criteria.labels) {
      const labelValue = Array.isArray(criteria.labels) ? criteria.labels[0] : criteria.labels;
      conditions.push(like(issues.labels, `%${labelValue}%`));
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

    // Execute search query
    const results = await db
      .select({
        id: issues.id,
        key: issues.key,
        title: issues.title,
        description: issues.description,
        status: issues.status,
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
          criteria: criteria as any,
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
    return NextResponse.json(
      { error: 'Failed to execute search' },
      { status: 500 }
    );
  }
});

