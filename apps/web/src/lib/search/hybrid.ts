/**
 * Hybrid issue search — runs BM25 (Postgres ts_rank_cd over the generated
 * `search_vector` columns) and vector cosine (pgvector content_embeddings)
 * in parallel, then fuses with Reciprocal Rank Fusion (RRF, k=60) to
 * produce the final top-N result list.
 *
 * Filters are applied uniformly to both legs so the candidate sets respect
 * project / assignee / status / type / label criteria before fusion.
 *
 * This module is provider-agnostic: the embedding for the query string is
 * computed via the same EmbeddingProvider used by the worker. When no key
 * is configured we still return BM25 results (graceful degradation).
 */

import { db, sql } from '@tasknebula/db';
import { reciprocalRankFusion } from './rrf';
import { getDefaultEmbeddingProvider, vectorToPg, type EmbeddingProvider } from './embeddings';

export interface HybridSearchFilters {
  organizationId: string;
  projectId?: string | string[] | null;
  project?: string | string[] | null;
  assigneeId?: string | string[] | null;
  assignee?: string | string[] | null;
  assigneeUnassigned?: boolean;
  statusId?: string | string[] | null;
  status?: string | string[] | null;
  statusCategory?: string | string[] | null;
  type?: string | string[] | null;
  priority?: string | string[] | null;
  label?: string | string[] | null;
}

export interface HybridSearchOptions {
  query: string;
  filters: HybridSearchFilters;
  /** Items per leg before fusion. Default 50. */
  candidateLimit?: number;
  /** Final size after fusion. Default 20. */
  limit?: number;
  rrfK?: number;
  /** Inject a custom embedding provider (useful for tests). */
  provider?: EmbeddingProvider | null;
}

export interface HybridResultRow {
  id: string;
  entityType: 'issue' | 'comment';
  issueId: string;
  key: string | null;
  title: string;
  snippet: string;
  projectId: string;
  bm25Rank: number | null;
  vectorRank: number | null;
  score: number;
}

interface BM25Row {
  id: string;
  entity_type: 'issue' | 'comment';
  issue_id: string;
  issue_key: string | null;
  title: string;
  snippet: string;
  project_id: string;
  rank: number;
  [key: string]: unknown;
}

interface VectorRow {
  id: string;
  content_type: 'issue' | 'comment';
  content_id: string;
  issue_id: string | null;
  issue_key: string | null;
  title: string;
  snippet: string;
  project_id: string;
  distance: number;
  [key: string]: unknown;
}

function asArrayParam(v: string | string[] | null | undefined): string[] | null {
  if (v == null) return null;
  const values = Array.isArray(v) ? v : [v];
  const compact = values.map((value) => value.trim()).filter(Boolean);
  return compact.length > 0 ? compact : null;
}

function normalizeLookupValue(value: string): string {
  return value
    .trim()
    .replace(/^@/, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
}

function normalizeArrayParam(v: string | string[] | null | undefined): string[] | null {
  const values = asArrayParam(v)?.map(normalizeLookupValue).filter(Boolean) ?? [];
  return values.length > 0 ? Array.from(new Set(values)) : null;
}

function normalizeStatusValue(value: string): string {
  const normalized = normalizeLookupValue(value);
  if (['todo', 'to_do', 'open'].includes(normalized)) return 'backlog';
  if (['review', 'in_review', 'code_review'].includes(normalized)) return 'in_review';
  if (['doing', 'inprogress', 'in_progress'].includes(normalized)) return 'in_progress';
  if (['closed', 'complete', 'completed'].includes(normalized)) return 'done';
  return normalized;
}

function normalizePriorityValue(value: string): string {
  const normalized = normalizeLookupValue(value);
  if (['highest', 'urgent', 'p0', 'p_0', 'critical'].includes(normalized)) return 'critical';
  if (['high', 'p1', 'p_1'].includes(normalized)) return 'high';
  if (['medium', 'normal', 'p2', 'p_2'].includes(normalized)) return 'medium';
  if (['low', 'p3', 'p_3'].includes(normalized)) return 'low';
  if (['lowest', 'none', 'no_priority', 'p4', 'p_4'].includes(normalized)) return 'none';
  return normalized;
}

function normalizeStatusArray(v: string | string[] | null | undefined): string[] | null {
  const values = asArrayParam(v)?.map(normalizeStatusValue).filter(Boolean) ?? [];
  return values.length > 0 ? Array.from(new Set(values)) : null;
}

function normalizePriorityArray(v: string | string[] | null | undefined): string[] | null {
  const values = asArrayParam(v)?.map(normalizePriorityValue).filter(Boolean) ?? [];
  return values.length > 0 ? Array.from(new Set(values)) : null;
}

/** Build the filter SQL fragment shared between BM25 and vector CTEs. */
function buildIssueFilterSql(filters: HybridSearchFilters) {
  const projectIds = asArrayParam(filters.projectId);
  const projectRefs = normalizeArrayParam(filters.project);
  const assigneeIds = asArrayParam(filters.assigneeId);
  const assigneeRefs = normalizeArrayParam(filters.assignee);
  const statusIds = asArrayParam(filters.statusId);
  const statusRefs = normalizeStatusArray(filters.status);
  const statusCats = normalizeStatusArray(filters.statusCategory);
  const types = normalizeArrayParam(filters.type);
  const priorities = normalizePriorityArray(filters.priority);
  const labels = normalizeArrayParam(filters.label);

  return sql`
    i.organization_id = ${filters.organizationId}
    ${projectIds ? sql`AND i.project_id = ANY(${projectIds})` : sql``}
    ${
      projectRefs
        ? sql`AND EXISTS (
      SELECT 1 FROM projects p
      WHERE p.id = i.project_id
        AND p.organization_id = i.organization_id
        AND (
          p.id = ANY(${projectRefs})
          OR lower(p.key) = ANY(${projectRefs})
          OR lower(regexp_replace(p.name, '[^a-zA-Z0-9]+', '_', 'g')) = ANY(${projectRefs})
        )
    )`
        : sql``
    }
    ${
      assigneeIds || filters.assigneeUnassigned
        ? sql`AND (
          ${assigneeIds ? sql`i.assignee_id = ANY(${assigneeIds})` : sql`false`}
          ${filters.assigneeUnassigned ? sql`OR i.assignee_id IS NULL` : sql``}
        )`
        : sql``
    }
    ${
      assigneeRefs
        ? sql`AND EXISTS (
      SELECT 1 FROM users u
      WHERE u.id = i.assignee_id
        AND (
          u.id = ANY(${assigneeRefs})
          OR lower(u.email) = ANY(${assigneeRefs})
          OR lower(regexp_replace(coalesce(u.name, ''), '[^a-zA-Z0-9]+', '_', 'g')) = ANY(${assigneeRefs})
        )
    )`
        : sql``
    }
    ${statusIds ? sql`AND i.status_id = ANY(${statusIds})` : sql``}
    ${
      statusRefs
        ? sql`AND EXISTS (
      SELECT 1 FROM workflow_statuses ws
      WHERE ws.id = i.status_id
        AND (
          ws.id = ANY(${statusRefs})
          OR ws.category::text = ANY(${statusRefs})
          OR lower(regexp_replace(ws.name, '[^a-zA-Z0-9]+', '_', 'g')) = ANY(${statusRefs})
        )
    )`
        : sql``
    }
    ${types ? sql`AND i.type::text = ANY(${types})` : sql``}
    ${priorities ? sql`AND i.priority::text = ANY(${priorities})` : sql``}
    ${
      statusCats
        ? sql`AND EXISTS (
      SELECT 1 FROM workflow_statuses ws
      WHERE ws.id = i.status_id AND ws.category::text = ANY(${statusCats})
    )`
        : sql``
    }
    ${
      labels
        ? sql`AND EXISTS (
      SELECT 1
      FROM jsonb_array_elements_text(i.labels::jsonb) label(value)
      WHERE lower(regexp_replace(label.value, '[^a-zA-Z0-9]+', '_', 'g')) = ANY(${labels})
    )`
        : sql``
    }
  `;
}

/**
 * Execute the BM25 leg. Returns ranked top-K candidates from both issues
 * and issue_comments. Comments inherit their parent issue's filters.
 */
async function runBM25(
  query: string,
  filters: HybridSearchFilters,
  limit: number
): Promise<BM25Row[]> {
  const filterSql = buildIssueFilterSql(filters);
  const result = await db.execute<BM25Row>(sql`
    WITH q AS (
      SELECT websearch_to_tsquery('simple', ${query}) AS tsq
    ),
    issue_hits AS (
      SELECT
        i.id AS id,
        'issue'::text AS entity_type,
        i.id AS issue_id,
        i.key AS issue_key,
        i.title AS title,
        COALESCE(left(i.description, 500), i.title) AS snippet,
        i.project_id AS project_id,
        (
          CASE WHEN lower(i.key) = lower(${query}) THEN 20 ELSE 0 END
          + CASE WHEN lower(i.key) LIKE lower(${query}) || '%' THEN 10 ELSE 0 END
          + CASE WHEN lower(i.title) = lower(${query}) THEN 8 ELSE 0 END
          + CASE WHEN lower(i.title) LIKE lower(${query}) || '%' THEN 4 ELSE 0 END
          + CASE WHEN lower(i.title) LIKE '%' || lower(${query}) || '%' THEN 2 ELSE 0 END
          + CASE WHEN lower(coalesce(i.description, '')) LIKE '%' || lower(${query}) || '%' THEN 1 ELSE 0 END
          + ts_rank_cd(i.search_vector, q.tsq)
        ) AS rank
      FROM issues i, q
      WHERE (
          i.search_vector @@ q.tsq
          OR lower(i.key) = lower(${query})
          OR lower(i.key) LIKE lower(${query}) || '%'
          OR lower(i.title) LIKE '%' || lower(${query}) || '%'
          OR lower(coalesce(i.description, '')) LIKE '%' || lower(${query}) || '%'
        )
        AND ${filterSql}
    ),
    comment_hits AS (
      SELECT
        c.id AS id,
        'comment'::text AS entity_type,
        c.issue_id AS issue_id,
        i.key AS issue_key,
        i.title AS title,
        left(c.content, 500) AS snippet,
        i.project_id AS project_id,
        (
          CASE WHEN lower(c.content) LIKE '%' || lower(${query}) || '%' THEN 1 ELSE 0 END
          + ts_rank_cd(c.search_vector, q.tsq)
        ) AS rank
      FROM issue_comments c
      JOIN issues i ON i.id = c.issue_id, q
      WHERE (
          c.search_vector @@ q.tsq
          OR lower(c.content) LIKE '%' || lower(${query}) || '%'
        )
        AND ${filterSql}
    )
    SELECT * FROM (
      SELECT * FROM issue_hits
      UNION ALL
      SELECT * FROM comment_hits
    ) merged
    ORDER BY rank DESC
    LIMIT ${limit};
  `);

  return Array.isArray(result) ? result : ((result as any).rows ?? []);
}

/**
 * Execute the vector leg via pgvector cosine distance against
 * content_embeddings. Requires an embedding provider; if absent, returns
 * an empty list so the route degrades to BM25-only.
 */
async function runVector(
  query: string,
  filters: HybridSearchFilters,
  limit: number,
  provider: EmbeddingProvider | null
): Promise<VectorRow[]> {
  if (!provider) return [];

  let queryVector: number[];
  try {
    const { vector } = await provider.embed(query);
    queryVector = vector;
  } catch (err) {
    console.error('Hybrid search: embedding query failed, falling back to BM25 only', err);
    return [];
  }

  const vecLiteral = vectorToPg(queryVector);
  const filterSql = buildIssueFilterSql(filters);
  const result = await db.execute<VectorRow>(sql`
    SELECT
      e.id AS id,
      e.content_type AS content_type,
      e.content_id AS content_id,
      COALESCE(e.issue_id, c.issue_id) AS issue_id,
      i.key AS issue_key,
      COALESCE(i.title, '(comment)') AS title,
      COALESCE(e.content_snippet, '') AS snippet,
      i.project_id AS project_id,
      (e.embedding <=> ${vecLiteral}::vector) AS distance
    FROM content_embeddings e
    LEFT JOIN issue_comments c ON c.id = e.comment_id
    LEFT JOIN issues i ON i.id = COALESCE(e.issue_id, c.issue_id)
    WHERE i.id IS NOT NULL
      AND ${filterSql}
    ORDER BY e.embedding <=> ${vecLiteral}::vector
    LIMIT ${limit};
  `);

  return Array.isArray(result) ? result : ((result as any).rows ?? []);
}

export async function hybridSearch(options: HybridSearchOptions): Promise<HybridResultRow[]> {
  const candidateLimit = options.candidateLimit ?? 50;
  const limit = options.limit ?? 20;
  const rrfK = options.rrfK ?? 60;
  const provider =
    options.provider !== undefined ? options.provider : getDefaultEmbeddingProvider();

  const [bm25Rows, vectorRows] = await Promise.all([
    runBM25(options.query, options.filters, candidateLimit),
    runVector(options.query, options.filters, candidateLimit, provider),
  ]);

  // Normalize rows so RRF can dedupe by stable id. We use
  // `${entity}:${id}` because the same issue can appear in both legs
  // and we don't want the comment row for the same issue to collide.
  type FusedRaw = { id: string; raw: BM25Row | VectorRow };
  const bm25Items: FusedRaw[] = bm25Rows.map((row) => ({
    id: `${row.entity_type}:${row.id}`,
    raw: row,
  }));
  const vectorItems: FusedRaw[] = vectorRows.map((row) => ({
    id: `${row.content_type}:${row.content_id}`,
    raw: row,
  }));

  const fused = reciprocalRankFusion<FusedRaw>([bm25Items, vectorItems], { k: rrfK });

  const results: HybridResultRow[] = fused.slice(0, limit).map((entry) => {
    const bmRank = entry.ranks[0] ?? null;
    const vecRank = entry.ranks[1] ?? null;
    const source = entry.item.raw;
    if ('rank' in source) {
      const r = source as BM25Row;
      return {
        id: r.id,
        entityType: r.entity_type,
        issueId: r.issue_id,
        key: r.issue_key,
        title: r.title,
        snippet: r.snippet,
        projectId: r.project_id,
        bm25Rank: bmRank,
        vectorRank: vecRank,
        score: entry.score,
      };
    }
    const r = source as VectorRow;
    return {
      id: r.content_id,
      entityType: r.content_type,
      issueId: r.issue_id ?? r.content_id,
      key: r.issue_key,
      title: r.title,
      snippet: r.snippet,
      projectId: r.project_id,
      bm25Rank: bmRank,
      vectorRank: vecRank,
      score: entry.score,
    };
  });

  return results;
}

/**
 * Heuristic used by /api/search to decide whether a query is free-text
 * (route to hybrid) vs. structured JQL (route to existing JQL handler).
 * Free-text: contains whitespace and no JQL operators/keywords.
 */
export function looksLikeFreeText(query: string): boolean {
  const q = query.trim();
  if (!q) return false;

  // Common JQL operators / keywords. Any occurrence => treat as JQL.
  const jqlMarkers = ['=', '!=', '~', '!~', '>', '<', ' AND ', ' OR ', ' NOT ', ' IN (', ' IS '];
  const upper = q.toUpperCase();
  for (const marker of jqlMarkers) {
    if (upper.includes(marker)) return false;
  }
  return true;
}
