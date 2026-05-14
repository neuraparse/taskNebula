/**
 * Duplicate-issue detector (TaskNebula Roadmap P0-02 companion).
 *
 * Given an issue ID, returns ranked candidate duplicates using pgvector
 * cosine similarity over the `content_embeddings` table.
 *
 * The embeddings table is wired up in roadmap task #1. If it's missing
 * (because task #1 has not yet shipped a deploy of the migration, or in
 * a stripped-down test database), the function falls back to a cheap
 * title-overlap text-similarity scan so the API surface still works.
 *
 * Thresholds:
 *   - cosine > 0.88 → "potential duplicate"
 *   - cosine > 0.92 → "high confidence"
 * Cosine here is computed as `1 - <embedding> <=> <embedding>` (pgvector's
 * built-in cosine *distance* operator returns 0 for identical vectors).
 */

import {
  db,
  desc,
  eq,
  issues,
  ne,
  sql,
} from '@tasknebula/db';

export interface DuplicateCandidate {
  issueId: string;
  issueKey: string;
  title: string;
  similarity: number; // cosine similarity, 0..1 (higher = more similar)
  confidence: 'potential' | 'high';
  source: 'embedding' | 'text-fallback';
}

export interface DuplicateDetectOptions {
  limit?: number; // default 10
  /**
   * Override thresholds for tests / tuning.
   * `potential` is the minimum bar to surface a candidate at all,
   * `high` is the bar to mark as a high-confidence duplicate.
   */
  thresholds?: { potential: number; high: number };
}

const DEFAULT_THRESHOLDS = { potential: 0.88, high: 0.92 } as const;

/**
 * Lightweight token-set Jaccard-ish similarity over titles. Used only
 * when the embeddings path errors out. Range is 0..1; we map it onto
 * the same `similarity` field so consumers don't need to branch.
 */
export function textSimilarity(a: string, b: string): number {
  const tokenise = (s: string) =>
    new Set(
      s
        .toLowerCase()
        .replace(/[^a-z0-9\s]/g, ' ')
        .split(/\s+/)
        .filter((t) => t.length > 2),
    );
  const aTokens = tokenise(a);
  const bTokens = tokenise(b);
  if (aTokens.size === 0 || bTokens.size === 0) return 0;
  let intersection = 0;
  for (const t of aTokens) if (bTokens.has(t)) intersection += 1;
  const union = aTokens.size + bTokens.size - intersection;
  return union === 0 ? 0 : intersection / union;
}

interface RawEmbeddingRow {
  issue_id: string | null;
  issue_key: string | null;
  title: string | null;
  similarity: number | string | null;
}

async function findDuplicatesByEmbedding(
  issueId: string,
  organizationId: string,
  limit: number,
  potentialThreshold: number,
): Promise<DuplicateCandidate[]> {
  // Cosine distance via pgvector's `<=>` operator. `1 - distance` →
  // cosine similarity. We join issues→content_embeddings twice: once to
  // find the source embedding for `issueId`, once to score every other
  // issue's embedding against it. Scoped to the source issue's
  // organization so we never leak cross-org content.
  const rows = await db.execute(sql`
    WITH source AS (
      SELECT embedding
      FROM content_embeddings
      WHERE issue_id = ${issueId}
        AND content_type = 'issue'
      ORDER BY created_at DESC
      LIMIT 1
    )
    SELECT
      i.id           AS issue_id,
      i.key          AS issue_key,
      i.title        AS title,
      1 - (ce.embedding <=> source.embedding) AS similarity
    FROM content_embeddings ce
    JOIN source ON true
    JOIN issues i ON i.id = ce.issue_id
    WHERE ce.content_type = 'issue'
      AND ce.issue_id <> ${issueId}
      AND i.organization_id = ${organizationId}
      AND (1 - (ce.embedding <=> source.embedding)) >= ${potentialThreshold}
    ORDER BY similarity DESC
    LIMIT ${limit};
  `);

  // drizzle's `db.execute` returns { rows: [...] } for pg / { rows } for
  // postgres-js — both expose a .rows array. Be defensive.
  const list: RawEmbeddingRow[] = Array.isArray((rows as any).rows)
    ? (rows as any).rows
    : Array.isArray(rows)
      ? (rows as any)
      : [];

  return list
    .filter((r): r is RawEmbeddingRow & { issue_id: string; issue_key: string; title: string } =>
      Boolean(r.issue_id && r.issue_key && r.title !== null),
    )
    .map((r) => {
      const sim = typeof r.similarity === 'string' ? parseFloat(r.similarity) : r.similarity ?? 0;
      return {
        issueId: r.issue_id,
        issueKey: r.issue_key,
        title: r.title,
        similarity: sim,
        confidence: sim >= DEFAULT_THRESHOLDS.high ? 'high' : 'potential',
        source: 'embedding' as const,
      };
    });
}

async function findDuplicatesByText(
  issueId: string,
  organizationId: string,
  limit: number,
  thresholds: { potential: number; high: number },
): Promise<DuplicateCandidate[]> {
  // Pull source issue title + description, then scan recent issues in the
  // same org and rank by title token-set similarity. Capped to recent
  // issues for cost — full-text scan would be wasteful here.
  const [source] = await db
    .select({ title: issues.title, description: issues.description })
    .from(issues)
    .where(eq(issues.id, issueId))
    .limit(1);
  if (!source) return [];

  const candidates = await db
    .select({
      id: issues.id,
      key: issues.key,
      title: issues.title,
    })
    .from(issues)
    .where(eq(issues.organizationId, organizationId))
    .orderBy(desc(issues.createdAt))
    .limit(500);

  const sourceBlob = `${source.title} ${source.description ?? ''}`;
  return candidates
    .filter((c) => c.id !== issueId)
    .map((c) => {
      const sim = textSimilarity(sourceBlob, c.title);
      return {
        issueId: c.id,
        issueKey: c.key,
        title: c.title,
        similarity: sim,
        confidence: (sim >= thresholds.high ? 'high' : 'potential') as 'potential' | 'high',
        source: 'text-fallback' as const,
      };
    })
    .filter((r) => r.similarity >= thresholds.potential)
    .sort((a, b) => b.similarity - a.similarity)
    .slice(0, limit);
}

export async function findDuplicates(
  issueId: string,
  options: DuplicateDetectOptions = {},
): Promise<DuplicateCandidate[]> {
  const limit = options.limit ?? 10;
  const thresholds = options.thresholds ?? DEFAULT_THRESHOLDS;

  const [source] = await db
    .select({ id: issues.id, organizationId: issues.organizationId })
    .from(issues)
    .where(eq(issues.id, issueId))
    .limit(1);
  if (!source) return [];

  try {
    const viaEmbeddings = await findDuplicatesByEmbedding(
      issueId,
      source.organizationId,
      limit,
      thresholds.potential,
    );
    if (viaEmbeddings.length > 0) {
      return viaEmbeddings;
    }
    // Empty result with embeddings available is a legitimate "no duplicates"
    // — fall through to text-fallback only when the embedding query errored.
    // We can't easily distinguish "table missing" from "empty result" here
    // without a sentinel, so try the text fallback as a low-cost safety net.
    return findDuplicatesByText(issueId, source.organizationId, limit, thresholds);
  } catch (err) {
    // pgvector / content_embeddings table is not deployed yet (task #1
    // hasn't migrated this env). Don't crash — degrade gracefully.
    console.warn('[triage.duplicate-detect] embedding path failed, using text fallback:', err);
    return findDuplicatesByText(issueId, source.organizationId, limit, thresholds);
  }
}

export const __internal = {
  findDuplicatesByEmbedding,
  findDuplicatesByText,
};
