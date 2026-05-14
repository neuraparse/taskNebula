-- PERF-33: switch the content_embeddings ANN index from IVFFlat to HNSW.
--
-- HNSW outperforms IVFFlat on recall-vs-latency for the 1536-dim OpenAI
-- embeddings we store. Parameters chosen here:
--   * m              = 16  -> graph degree; balances build memory + recall.
--   * ef_construction = 64 -> work per insert; higher = better graph, slower build.
-- Per-query recall is tuned with `SET LOCAL hnsw.ef_search = N` — see the
-- runtime helper at apps/web/src/lib/db/vector.ts::withEfSearch and the doc
-- at packages/db/docs/PGVECTOR_TUNING.md.
--
-- The DROP IF EXISTS line removes any prior IVFFlat index (the legacy naming
-- drizzle-kit would have used for the same column) so this migration is safe
-- whether or not a previous ANN index exists.
BEGIN;

DROP INDEX IF EXISTS "content_embeddings_embedding_ivfflat_idx";
DROP INDEX IF EXISTS "content_embeddings_embedding_idx";

CREATE INDEX IF NOT EXISTS "content_embeddings_embedding_hnsw_idx"
  ON "content_embeddings"
  USING hnsw ("embedding" vector_cosine_ops)
  WITH (m = 16, ef_construction = 64);

COMMIT;
