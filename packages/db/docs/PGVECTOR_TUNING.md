# pgvector HNSW Tuning Guide

This document describes the parameters used by the
`content_embeddings_embedding_hnsw_idx` index introduced in
[`0028_pgvector_hnsw_content_embeddings.sql`](../drizzle/0028_pgvector_hnsw_content_embeddings.sql),
and how to tune them for the TaskNebula semantic search workload.

The index is declared in TypeScript at
[`packages/db/src/schema/semantic-search.ts`](../src/schema/semantic-search.ts):

```ts
embeddingHnswIdx: index('content_embeddings_embedding_hnsw_idx')
  .using('hnsw', table.embedding.op('vector_cosine_ops'))
  .with({ m: 16, ef_construction: 64 }),
```

## Why HNSW

We replaced the previous IVFFlat index because, for the 1536-dim OpenAI
embeddings we store, HNSW gives:

- **Higher recall at the same latency** — IVFFlat needs many probes to
  approach HNSW's recall, which raises tail latency.
- **No `lists` retuning when data grows** — IVFFlat's optimal `lists`
  scales with row count and requires periodic `REINDEX`. HNSW's structure
  adapts as rows are inserted.
- **Cheaper exact-search fallback** when `ef_search` is high enough to
  approximate a full scan, useful for the eval harness described below.

## Build-time parameters

These are baked into the index at `CREATE INDEX` / `REINDEX` time and can
only be changed by rebuilding.

| Parameter         | Value | What it controls                                           | Tradeoff |
|-------------------|-------|------------------------------------------------------------|----------|
| `m`               | 16    | Max graph degree per node (bidirectional links).           | Higher `m` -> better recall + more memory + slower build. 16 is pgvector's recommended default for general use. |
| `ef_construction` | 64    | Candidate list size during insert; quality of the graph.   | Higher -> better-built graph + slower inserts. 64 keeps single-row inserts cheap during embedding ingestion. |

### When to rebuild

Rebuild (`REINDEX INDEX CONCURRENTLY content_embeddings_embedding_hnsw_idx`)
when **any** of the following are true:

1. Recall@10 against the exact baseline (see "Measuring recall" below)
   drops below your SLO and bumping `ef_search` alone doesn't recover it.
2. The corpus has grown by more than ~10x since the last build. Even
   though HNSW adapts, very large growth makes a rebuild with a higher
   `m` (e.g. 32) worthwhile.
3. The embedding model changes dimensionality or distance metric. The
   index op-class (`vector_cosine_ops` here) must match the metric used
   at query time (`<=>` for cosine).

If you do need higher recall, the cheapest path is:

1. Try raising `ef_search` (see below) — no rebuild needed.
2. If that's not enough, rebuild with `m = 32` and re-measure.

## Query-time parameter: `hnsw.ef_search`

This is the per-session knob. Higher = explore more of the graph =
higher recall and higher latency. pgvector accepts `1..1000`; the
default in vanilla pgvector is `40`.

We expose it via the helper at
[`apps/web/src/lib/db/vector.ts`](../../../apps/web/src/lib/db/vector.ts):

```ts
import { withEfSearch } from '@/lib/db/vector';

const rows = await withEfSearch(db, 80, async (tx) =>
  tx.execute(sql`
    SELECT id
    FROM content_embeddings
    ORDER BY embedding <=> ${queryEmbedding}
    LIMIT 20
  `),
);
```

`withEfSearch` opens a transaction, issues `SET LOCAL hnsw.ef_search = N`,
and runs your block. Because it uses `SET LOCAL`, the override is reverted
when the transaction ends — safe to use with pgBouncer / pooled
connections.

The default value (when no explicit value is passed) is read from the
`PGVECTOR_EF_SEARCH` env var, falling back to **40**.

### Choosing a value

| `ef_search` | Typical recall@10 | Latency profile          | Use case                           |
|-------------|-------------------|--------------------------|------------------------------------|
| 20          | ~0.85             | Fastest                  | Suggest-as-you-type, low SLO       |
| 40 (default)| ~0.95             | Fast                     | Standard search UI                 |
| 80          | ~0.98             | ~2x default              | "Power search" / advanced filters  |
| 200         | ~0.995            | ~4-5x default            | Backfills, eval jobs               |
| 1000        | ~exact            | Approaches seq scan      | Eval baselines only                |

These numbers are illustrative — measure on your own corpus.

## Measuring recall

To know whether the current settings are healthy, compare ANN top-k
against an exact (sequential-scan) top-k for the same query.

1. Force pgvector to use exact search:
   ```sql
   SET LOCAL enable_indexscan = off;
   SET LOCAL enable_bitmapscan = off;
   ```
   Run the same `ORDER BY embedding <=> :q LIMIT :k` query and record
   the IDs. This is your "truth" set.
2. Run the ANN query at the candidate `ef_search` and record its IDs.
3. `recall@k = |truth ∩ ann| / k`.

Repeat for ~100 representative queries and report the mean. A drop in
mean recall@10 of more than ~0.03 vs. the previous deploy is the signal
to either bump `ef_search` or rebuild with higher `m`.

You can verify the index is actually being used with `EXPLAIN`:

```sql
EXPLAIN
SELECT id
FROM content_embeddings
ORDER BY embedding <=> '[...]'::vector
LIMIT 10;
```

The plan should show an `Index Scan using content_embeddings_embedding_hnsw_idx`
node. If you see `Seq Scan`, either the index is missing, `ef_search`
was set absurdly high, or the planner has bad stats — run `ANALYZE
content_embeddings`.

## Quick reference

| Knob                  | Where                                                          | Reload required |
|-----------------------|----------------------------------------------------------------|-----------------|
| `m`                   | Migration / schema                                             | REINDEX         |
| `ef_construction`     | Migration / schema                                             | REINDEX         |
| `hnsw.ef_search`      | `withEfSearch` helper / `PGVECTOR_EF_SEARCH` env               | Per transaction |
