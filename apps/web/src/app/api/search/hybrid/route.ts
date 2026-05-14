import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { hybridSearch } from '@/lib/search/hybrid';

export const dynamic = 'force-dynamic';

/**
 * Hybrid search endpoint.
 *
 *   POST /api/search/hybrid
 *
 * Body:
 *   {
 *     query: string,                          // required, free-text
 *     organizationId: string,                 // required
 *     projectId?: string | string[],
 *     assigneeId?: string | string[],
 *     statusId?: string | string[],
 *     statusCategory?: string | string[],     // 'backlog' | 'in_progress' | ...
 *     type?: string | string[],               // 'task' | 'bug' | ...
 *     label?: string,
 *     limit?: number                          // default 20
 *   }
 *
 * Response: { results: HybridResultRow[], count, query, filters }
 *
 * BM25 (Postgres ts_rank_cd via the generated search_vector columns on
 * issues and issue_comments) and vector cosine (pgvector against
 * content_embeddings) are run in parallel; the result lists are fused
 * with RRF (k=60). If no OpenAI key is configured the route degrades to
 * BM25-only so basic search remains functional.
 */
export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json().catch(() => ({}));
    const query: unknown = body?.query;
    const organizationId: unknown = body?.organizationId;

    if (typeof query !== 'string' || query.trim().length === 0) {
      return NextResponse.json({ error: 'query is required' }, { status: 400 });
    }
    if (typeof organizationId !== 'string' || organizationId.length === 0) {
      return NextResponse.json({ error: 'organizationId is required' }, { status: 400 });
    }

    const limit = Math.min(
      Math.max(Number(body?.limit ?? 20) | 0, 1),
      100
    );

    const filters = {
      organizationId,
      projectId: body?.projectId ?? null,
      assigneeId: body?.assigneeId ?? null,
      statusId: body?.statusId ?? null,
      statusCategory: body?.statusCategory ?? null,
      type: body?.type ?? null,
      label: typeof body?.label === 'string' ? body.label : null,
    };

    const results = await hybridSearch({
      query,
      filters,
      limit,
    });

    return NextResponse.json({
      results,
      count: results.length,
      query,
      filters,
    });
  } catch (error) {
    console.error('Hybrid search error:', error);
    return NextResponse.json(
      { error: 'Failed to execute hybrid search' },
      { status: 500 }
    );
  }
}
