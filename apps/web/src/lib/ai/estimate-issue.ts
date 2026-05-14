/**
 * AI-assisted hour estimate for an issue (task #10).
 *
 * Strategy (in order):
 *   1. If the issue has a stored embedding in `content_embeddings`, run a
 *      pgvector ANN search against the 10 most similar **closed** issues that
 *      already have `actual_hours` populated. Return percentiles + rationale.
 *   2. If no similar-enough neighbours (count < {@link MIN_NEIGHBOURS}), fall
 *      back to the team-wide historical median for closed issues in the same
 *      project.
 *   3. If even the project has no history, return a `null` estimate with a
 *      "not_enough_data" reason — the UI shows the manual entry field only.
 *
 * The actual embedding generation is delegated to whatever provider is wired
 * up in task #1's semantic-search pipeline. This module only **queries** the
 * existing embedding row. When there is no embedding for the issue yet we skip
 * straight to the project-history fallback rather than calling an external
 * embedding API from inside the request handler.
 */

import { sql, and, eq, isNotNull, desc } from 'drizzle-orm';
import {
  db,
  issues,
  workflowStatuses,
  contentEmbeddings,
} from '@tasknebula/db';

/**
 * Minimum number of neighbour issues we need before we trust the similarity
 * search. Below this we fall back to per-project history.
 */
export const MIN_NEIGHBOURS = 3;

export interface NeighbourIssue {
  id: string;
  key: string;
  title: string;
  actualHours: number;
  similarity: number; // 0..1, higher is closer
}

export type EstimateReason =
  | 'similar_issues'
  | 'project_median'
  | 'not_enough_data';

export interface AiEstimateResult {
  /** Median hours across the chosen sample, or null if no data. */
  estimateHours: number | null;
  /** 25th percentile in hours (lower bound). */
  p25Hours: number | null;
  /** 75th percentile in hours (upper bound). */
  p75Hours: number | null;
  /** Which pathway produced the estimate. */
  reason: EstimateReason;
  /** Human-readable explanation surfaced in the UI. */
  rationale: string;
  /** Sample size used (similar issues OR project closed-issue count). */
  sampleSize: number;
  /** When `similar_issues`, the actual neighbours used. */
  neighbours?: NeighbourIssue[];
}

/** Percentile of a sorted ascending number array, linear interpolation. */
export function percentile(sortedAsc: number[], q: number): number | null {
  if (sortedAsc.length === 0) return null;
  if (sortedAsc.length === 1) return sortedAsc[0]!;
  const pos = (sortedAsc.length - 1) * q;
  const base = Math.floor(pos);
  const rest = pos - base;
  const lo = sortedAsc[base]!;
  const hi = sortedAsc[base + 1];
  if (hi === undefined) return lo;
  return lo + (hi - lo) * rest;
}

function round2(n: number | null): number | null {
  if (n === null || !Number.isFinite(n)) return null;
  return Math.round(n * 100) / 100;
}

/**
 * Build a short rationale string like
 *   "Similar to TN-123 (5h), TN-456 (3h), TN-789 (4h) — median 4h."
 */
function rationaleFromNeighbours(neighbours: NeighbourIssue[], median: number): string {
  const top = neighbours.slice(0, 3);
  const parts = top
    .map((n) => `${n.key} (${formatHours(n.actualHours)})`)
    .join(', ');
  return `Similar to ${parts} — median ${formatHours(median)}.`;
}

function formatHours(h: number): string {
  // Drop trailing zeros: 5.00 → "5h", 1.50 → "1.5h".
  const trimmed = Number(h.toFixed(2)).toString();
  return `${trimmed}h`;
}

export interface EstimateOptions {
  issueId: string;
  projectId: string;
  /** Override the neighbour count for tests; default 10. */
  limit?: number;
  /**
   * Test injection points. When provided, these stub the DB-touching steps so
   * unit tests can exercise fallback paths without a live Postgres.
   */
  _testHooks?: {
    fetchNeighbours?: (issueId: string, limit: number) => Promise<NeighbourIssue[]>;
    fetchProjectClosedHours?: (projectId: string) => Promise<number[]>;
  };
}

/**
 * Compute the AI estimate suggestion. Pure-ish: branches on injected hooks for
 * tests, otherwise hits the DB.
 */
export async function suggestEstimateForIssue(
  opts: EstimateOptions,
): Promise<AiEstimateResult> {
  const limit = opts.limit ?? 10;

  // ── Step 1: similar closed issues via pgvector ──────────────────────────
  const neighbours = opts._testHooks?.fetchNeighbours
    ? await opts._testHooks.fetchNeighbours(opts.issueId, limit)
    : await fetchNeighboursFromDb(opts.issueId, limit);

  if (neighbours.length >= MIN_NEIGHBOURS) {
    const hours = neighbours.map((n) => n.actualHours).sort((a, b) => a - b);
    const median = percentile(hours, 0.5)!;
    const p25 = percentile(hours, 0.25)!;
    const p75 = percentile(hours, 0.75)!;
    return {
      estimateHours: round2(median),
      p25Hours: round2(p25),
      p75Hours: round2(p75),
      reason: 'similar_issues',
      rationale: rationaleFromNeighbours(neighbours, median),
      sampleSize: neighbours.length,
      neighbours,
    };
  }

  // ── Step 2: project-wide median ─────────────────────────────────────────
  const projectHours = opts._testHooks?.fetchProjectClosedHours
    ? await opts._testHooks.fetchProjectClosedHours(opts.projectId)
    : await fetchProjectClosedHoursFromDb(opts.projectId);

  if (projectHours.length === 0) {
    return {
      estimateHours: null,
      p25Hours: null,
      p75Hours: null,
      reason: 'not_enough_data',
      rationale:
        'Not enough historical data to suggest an estimate yet. Log a few closed issues with actual hours first.',
      sampleSize: 0,
    };
  }

  const sorted = [...projectHours].sort((a, b) => a - b);
  const median = percentile(sorted, 0.5)!;
  const p25 = percentile(sorted, 0.25)!;
  const p75 = percentile(sorted, 0.75)!;
  return {
    estimateHours: round2(median),
    p25Hours: round2(p25),
    p75Hours: round2(p75),
    reason: 'project_median',
    rationale: `Based on the median of ${sorted.length} closed issue${
      sorted.length === 1 ? '' : 's'
    } in this project (${formatHours(median)}).`,
    sampleSize: sorted.length,
  };
}

/**
 * pgvector ANN search: cosine distance (1 - cosine_similarity). We require the
 * source issue to have an embedding row; without one we return an empty array
 * and let the caller fall back to project history.
 */
async function fetchNeighboursFromDb(
  issueId: string,
  limit: number,
): Promise<NeighbourIssue[]> {
  // Get the source embedding.
  const [src] = await db
    .select({ embedding: contentEmbeddings.embedding })
    .from(contentEmbeddings)
    .where(
      and(
        eq(contentEmbeddings.contentType, 'issue'),
        eq(contentEmbeddings.issueId, issueId),
      ),
    )
    .limit(1);

  if (!src?.embedding) return [];

  // pgvector cosine distance operator <=> ; similarity = 1 - distance.
  // We join into `issues` (closed + actual_hours not null + not self).
  const rows = await db
    .select({
      id: issues.id,
      key: issues.key,
      title: issues.title,
      actualHours: issues.actualHours,
      distance: sql<number>`${contentEmbeddings.embedding} <=> ${src.embedding}::vector`,
    })
    .from(contentEmbeddings)
    .innerJoin(issues, eq(issues.id, contentEmbeddings.issueId))
    .innerJoin(workflowStatuses, eq(workflowStatuses.id, issues.statusId))
    .where(
      and(
        eq(contentEmbeddings.contentType, 'issue'),
        eq(workflowStatuses.category, 'done'),
        isNotNull(issues.actualHours),
        sql`${issues.id} <> ${issueId}`,
        sql`(${issues.actualHours})::numeric > 0`,
      ),
    )
    .orderBy(sql`${contentEmbeddings.embedding} <=> ${src.embedding}::vector`)
    .limit(limit);

  return rows
    .map((r) => ({
      id: r.id,
      key: r.key,
      title: r.title,
      actualHours: Number(r.actualHours ?? 0),
      similarity: Math.max(0, Math.min(1, 1 - Number(r.distance ?? 1))),
    }))
    .filter((n) => n.actualHours > 0);
}

async function fetchProjectClosedHoursFromDb(projectId: string): Promise<number[]> {
  const rows = await db
    .select({ actualHours: issues.actualHours })
    .from(issues)
    .innerJoin(workflowStatuses, eq(workflowStatuses.id, issues.statusId))
    .where(
      and(
        eq(issues.projectId, projectId),
        eq(workflowStatuses.category, 'done'),
        isNotNull(issues.actualHours),
        sql`(${issues.actualHours})::numeric > 0`,
      ),
    )
    .orderBy(desc(issues.updatedAt))
    .limit(200); // Cap so a giant project doesn't dominate the median.

  return rows
    .map((r) => Number(r.actualHours ?? 0))
    .filter((h) => Number.isFinite(h) && h > 0);
}
