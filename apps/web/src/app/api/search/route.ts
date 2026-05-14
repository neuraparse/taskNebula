import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { db, issues, users, workflowStatuses, projects, sprints, searchHistory, parseJQL } from '@tasknebula/db';
import { eq, and, or, inArray, gte, lte, like, desc } from 'drizzle-orm';
import { createId } from '@paralleldrive/cuid2';
import { hybridSearch, looksLikeFreeText } from '@/lib/search/hybrid';

export const dynamic = 'force-dynamic';

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
export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const query = searchParams.get('q');
    const organizationId = searchParams.get('organizationId');
    const projectId = searchParams.get('projectId');
    const saveHistory = searchParams.get('saveHistory') !== 'false';
    const limit = parseInt(searchParams.get('limit') || '100');
    const offset = parseInt(searchParams.get('offset') || '0');

    if (!query) {
      return NextResponse.json({ error: 'Query is required' }, { status: 400 });
    }

    if (!organizationId) {
      return NextResponse.json({ error: 'organizationId is required' }, { status: 400 });
    }

    // Heuristic: free-text queries (no JQL operators) are routed to the
    // hybrid path (BM25 + vector + RRF). JQL syntax with operators stays
    // on the structured filter path for back-compat.
    const wantsHybrid = searchParams.get('mode') === 'hybrid' || looksLikeFreeText(query);
    if (wantsHybrid && searchParams.get('mode') !== 'jql') {
      try {
        const hybridResults = await hybridSearch({
          query,
          filters: { organizationId, projectId: projectId || null },
          limit: Math.min(limit, 50),
        });

        if (saveHistory) {
          try {
            await db.insert(searchHistory).values({
              userId: session.user.id,
              organizationId,
              projectId: projectId || null,
              query,
              criteria: { hybrid: true } as any,
              resultCount: hybridResults.length.toString(),
            });
          } catch (error) {
            console.error('Failed to save search history:', error);
          }
        }

        return NextResponse.json({
          results: hybridResults,
          count: hybridResults.length,
          query,
          mode: 'hybrid',
        });
      } catch (error) {
        console.error('Hybrid search failed, falling back to JQL parse:', error);
        // fall through to JQL path so caller still gets *something*
      }
    }

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
}

