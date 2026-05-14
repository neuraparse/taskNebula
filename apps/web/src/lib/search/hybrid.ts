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
import {
  getDefaultEmbeddingProvider,
  vectorToPg,
  type EmbeddingProvider,
} from './embeddings';

export interface HybridSearchFilters {
  organizationId: string;
  projectId?: string | string[] | null;
  assigneeId?: string | string[] | null;
  statusId?: string | string[] | null;
  statusCategory?: string | string[] | null;
  type?: string | string[] | null;
  label?: string | null;
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
  return Array.isArray(v) ? v : [v];
}

/** Build the filter SQL fragment shared between BM25 and vector CTEs. */
function buildIssueFilterSql(filters: HybridSearchFilters) {
  const projectIds = asArrayParam(filters.projectId);
  const assigneeIds = asArrayParam(filters.assigneeId);
  const statusIds = asArrayParam(filters.statusId);
  const statusCats = asArrayParam(filters.statusCategory);
  const types = asArrayParam(filters.type);
  const label = filters.label ?? null;

  return sql`
    i.organization_id = ${filters.organizationId}
    ${projectIds ? sql`AND i.project_id = ANY(${projectIds})` : sql``}
    ${assigneeIds ? sql`AND i.assignee_id = ANY(${assigneeIds})` : sql``}
    ${statusIds ? sql`AND i.status_id = ANY(${statusIds})` : sql``}
    ${types ? sql`AND i.type::text = ANY(${types})` : sql``}
    ${statusCats ? sql`AND EXISTS (
      SELECT 1 FROM workflow_statuses ws
      WHERE ws.id = i.status_id AND ws.category::text = ANY(${statusCats})
    )` : sql``}
    ${label ? sql`AND i.labels::jsonb @> ${JSON.stringify([label])}::jsonb` : sql``}
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
        ts_rank_cd(i.search_vector, q.tsq) AS rank
      FROM issues i, q
      WHERE i.search_vector @@ q.tsq
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
        ts_rank_cd(c.search_vector, q.tsq) AS rank
      FROM issue_comments c
      JOIN issues i ON i.id = c.issue_id, q
      WHERE c.search_vector @@ q.tsq
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

  return Array.isArray(result) ? result : (result as any).rows ?? [];
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

  return Array.isArray(result) ? result : (result as any).rows ?? [];
}

export async function hybridSearch(
  options: HybridSearchOptions
): Promise<HybridResultRow[]> {
  const candidateLimit = options.candidateLimit ?? 50;
  const limit = options.limit ?? 20;
  const rrfK = options.rrfK ?? 60;
  const provider = options.provider !== undefined
    ? options.provider
    : getDefaultEmbeddingProvider();

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
  const jqlMarkers = [
    '=',
    '!=',
    '~',
    '!~',
    '>',
    '<',
    ' AND ',
    ' OR ',
    ' NOT ',
    ' IN (',
    ' IS ',
  ];
  const upper = q.toUpperCase();
  for (const marker of jqlMarkers) {
    if (upper.includes(marker)) return false;
  }
  return true;
}
