import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { and, eq, db, organizationMembers } from '@tasknebula/db';
import { auth } from '@/auth';
import { hybridSearch } from '@/lib/search/hybrid';

export const dynamic = 'force-dynamic';

const stringOrArray = z.union([z.string().min(1), z.array(z.string().min(1)).min(1)]);

/**
 * Body schema. `organizationId` is only a *hint* — the effective
 * organization is always resolved against the caller's memberships in
 * `resolveOrganizationId` below; a request naming an org the caller does
 * not belong to is rejected with 403 (never trusted, per
 * .claude/rules/api.md tenant-isolation rule).
 */
const bodySchema = z.object({
  query: z.string().trim().min(1, 'query is required').max(500),
  organizationId: z.string().min(1).max(64).optional(),
  projectId: stringOrArray.optional(),
  project: stringOrArray.optional(),
  assigneeId: stringOrArray.optional(),
  assignee: stringOrArray.optional(),
  statusId: stringOrArray.optional(),
  status: stringOrArray.optional(),
  statusCategory: stringOrArray.optional(),
  type: stringOrArray.optional(),
  priority: stringOrArray.optional(),
  label: stringOrArray.optional(),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

/**
 * Resolve the organization the search runs against. Mirrors the pattern in
 * api/ask/route.ts: a requested org id is only honoured when the session
 * user is actually a member; with no request hint we fall back to the
 * user's first membership.
 */
async function resolveOrganizationId(
  userId: string,
  requested?: string | null
): Promise<string | null> {
  if (requested) {
    const [member] = await db
      .select({ organizationId: organizationMembers.organizationId })
      .from(organizationMembers)
      .where(
        and(
          eq(organizationMembers.userId, userId),
          eq(organizationMembers.organizationId, requested),
          eq(organizationMembers.status, 'active')
        )
      )
      .limit(1);
    return member?.organizationId ?? null;
  }
  const [member] = await db
    .select({ organizationId: organizationMembers.organizationId })
    .from(organizationMembers)
    .where(and(eq(organizationMembers.userId, userId), eq(organizationMembers.status, 'active')))
    .limit(1);
  return member?.organizationId ?? null;
}

function normalizeAssigneeFilter(
  input: string | string[] | undefined,
  userId: string
): {
  assigneeId: string | string[] | null;
  assignee: string | string[] | null;
  assigneeUnassigned: boolean;
} {
  if (!input) {
    return { assigneeId: null, assignee: null, assigneeUnassigned: false };
  }

  const ids: string[] = [];
  const refs: string[] = [];
  let assigneeUnassigned = false;

  for (const rawValue of Array.isArray(input) ? input : [input]) {
    const value = rawValue.trim();
    const normalized = value.replace(/^@/, '').toLowerCase();
    if (!value) continue;

    if (normalized === 'me') {
      ids.push(userId);
      continue;
    }

    if (['unassigned', 'none', 'no_assignee'].includes(normalized)) {
      assigneeUnassigned = true;
      continue;
    }

    refs.push(value);
  }

  return {
    assigneeId: ids.length === 0 ? null : ids.length === 1 ? ids[0]! : ids,
    assignee: refs.length === 0 ? null : refs.length === 1 ? refs[0]! : refs,
    assigneeUnassigned,
  };
}

/**
 * Hybrid search endpoint.
 *
 *   POST /api/search/hybrid
 *
 * Body:
 *   {
 *     query: string,                          // required, free-text
 *     organizationId?: string,                // must match a membership; defaults to first
 *     projectId?: string | string[],
 *     project?: string | string[],            // project key/name/id facet
 *     assigneeId?: string | string[],
 *     assignee?: string | string[],           // "me", "@unassigned", email/name/id
 *     statusId?: string | string[],
 *     status?: string | string[],             // status name/category/id facet
 *     statusCategory?: string | string[],     // 'backlog' | 'in_progress' | ...
 *     type?: string | string[],               // 'task' | 'bug' | ...
 *     priority?: string | string[],
 *     label?: string | string[],
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

    let payload: z.infer<typeof bodySchema>;
    try {
      payload = bodySchema.parse(await request.json());
    } catch (err) {
      if (err instanceof z.ZodError) {
        return NextResponse.json({ error: 'Invalid input', details: err.errors }, { status: 400 });
      }
      return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
    }

    // SECURITY: derive the tenant from the session user's memberships —
    // never trust an organizationId straight from the request body.
    const organizationId = await resolveOrganizationId(session.user.id, payload.organizationId);
    if (!organizationId) {
      return NextResponse.json(
        { error: 'No accessible organization for this user.', code: 'no_org' },
        { status: 403 }
      );
    }

    const assigneeFilter = normalizeAssigneeFilter(payload.assignee, session.user.id);
    const filters = {
      organizationId,
      projectId: payload.projectId ?? null,
      project: payload.project ?? null,
      assigneeId: payload.assigneeId ?? assigneeFilter.assigneeId,
      assignee: assigneeFilter.assignee,
      assigneeUnassigned: assigneeFilter.assigneeUnassigned,
      statusId: payload.statusId ?? null,
      status: payload.status ?? null,
      statusCategory: payload.statusCategory ?? null,
      type: payload.type ?? null,
      priority: payload.priority ?? null,
      label: payload.label ?? null,
    };

    const results = await hybridSearch({
      query: payload.query,
      filters,
      limit: payload.limit,
    });

    return NextResponse.json({
      results,
      count: results.length,
      query: payload.query,
      filters,
    });
  } catch (error) {
    console.error('Hybrid search error:', error);
    return NextResponse.json({ error: 'Failed to execute hybrid search' }, { status: 500 });
  }
}
