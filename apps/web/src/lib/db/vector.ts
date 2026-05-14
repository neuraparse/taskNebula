/**
 * pgvector query-time tunables.
 *
 * Once `content_embeddings_embedding_hnsw_idx` (HNSW) exists, the *recall*
 * of an approximate-nearest-neighbour scan is governed at query time by the
 * `hnsw.ef_search` GUC. Higher values explore more of the graph -> higher
 * recall but slower queries; lower values do the opposite. The build-time
 * parameters (`m`, `ef_construction`) are baked into the index; only
 * `ef_search` can be tuned per query session.
 *
 * `withEfSearch` opens a transaction, applies `SET LOCAL hnsw.ef_search`,
 * runs the caller's block, and lets the transaction scope reset the GUC
 * when it commits or rolls back. Using `SET LOCAL` (instead of plain `SET`)
 * keeps the override scoped to this transaction so we don't leak state
 * onto pooled connections.
 *
 * The default of 40 is a balanced starting point for 1536-dim OpenAI
 * embeddings — see packages/db/docs/PGVECTOR_TUNING.md for the recall vs.
 * latency tradeoffs and how to measure recall against an exact baseline.
 */
import { sql } from 'drizzle-orm';

import { db } from '@tasknebula/db';

/**
 * The set of executor shapes we accept — either the root drizzle client
 * exported from `@tasknebula/db` or the transaction handle yielded inside
 * `db.transaction(...)`. Both expose `.transaction(...)` and `.execute(...)`
 * with the same signatures.
 */
export type VectorQueryClient =
  | typeof db
  | Parameters<Parameters<typeof db.transaction>[0]>[0];

/**
 * The transaction handle passed into the callback. We re-export it so call
 * sites can type their inner functions without re-deriving the conditional
 * type above.
 */
export type VectorTransactionClient = Parameters<
  Parameters<typeof db.transaction>[0]
>[0];

/** Smallest sane `ef_search`. pgvector accepts 1..1000 but <10 is useless. */
const MIN_EF_SEARCH = 10;
/** pgvector enforces `ef_search <= 1000`. */
const MAX_EF_SEARCH = 1000;

/**
 * Resolve the default `ef_search` value. Reads `PGVECTOR_EF_SEARCH` from the
 * environment so ops can dial recall vs. latency without a code change.
 * Falls back to 40, which gives ~0.95 recall@10 on typical 1536-dim
 * workloads — see PGVECTOR_TUNING.md for benchmark notes.
 */
export function getDefaultEfSearch(): number {
  const raw = process.env.PGVECTOR_EF_SEARCH;
  if (!raw) return 40;

  const parsed = Number.parseInt(raw, 10);
  if (!Number.isFinite(parsed)) return 40;

  return clampEfSearch(parsed);
}

function clampEfSearch(value: number): number {
  if (!Number.isFinite(value)) return 40;
  const rounded = Math.round(value);
  if (rounded < MIN_EF_SEARCH) return MIN_EF_SEARCH;
  if (rounded > MAX_EF_SEARCH) return MAX_EF_SEARCH;
  return rounded;
}

/**
 * Run `fn` against a transaction with `hnsw.ef_search` set to `value`.
 *
 * The override is applied via `SET LOCAL`, so it is automatically reverted
 * when the transaction ends — important when running against pgBouncer or
 * any pooled connection. If the caller doesn't pass `value`, the default
 * from `PGVECTOR_EF_SEARCH` (or 40) is used.
 *
 * Example:
 *   const hits = await withEfSearch(db, 80, async (tx) =>
 *     tx.execute(sql`SELECT id FROM content_embeddings ORDER BY embedding <=> ${queryVec} LIMIT 20`)
 *   );
 */
export async function withEfSearch<T>(
  client: VectorQueryClient,
  value: number | undefined,
  fn: (tx: VectorTransactionClient) => Promise<T>,
): Promise<T> {
  const efSearch = clampEfSearch(value ?? getDefaultEfSearch());

  return client.transaction(async (tx) => {
    // `SET LOCAL` requires an integer literal, not a bind parameter, so we
    // splice the already-clamped value directly with `sql.raw`. This is safe
    // because `clampEfSearch` guarantees `efSearch` is a finite integer.
    await tx.execute(sql.raw(`SET LOCAL hnsw.ef_search = ${efSearch}`));
    return fn(tx);
  });
}

/** Exported for tests. */
export const __internal = {
  clampEfSearch,
  MIN_EF_SEARCH,
  MAX_EF_SEARCH,
};
