-- Create content_embeddings (was defined in TS schema only; never created
-- by a migration prior to the 2026-05 roadmap merge).
--
-- The 2026-05 work added several migrations that ALTER or INDEX this table
-- (notably 0035_hybrid_search adds a unique index + ivfflat ANN, and
-- 0051_pgvector_hnsw_content_embeddings swaps to HNSW). Both of those must
-- find the table already present, so we create it here at idx 32.

CREATE EXTENSION IF NOT EXISTS vector;

CREATE TABLE IF NOT EXISTS "content_embeddings" (
  "id" text PRIMARY KEY NOT NULL,
  "content_type" text NOT NULL,
  "content_id" text NOT NULL,
  "issue_id" text,
  "comment_id" text,
  "project_id" text,
  "content_snippet" text,
  "metadata" jsonb DEFAULT '{}'::jsonb,
  "embedding" vector(1536) NOT NULL,
  "embedding_model" text NOT NULL DEFAULT 'text-embedding-ada-002',
  "embedding_provider" text NOT NULL DEFAULT 'openai',
  "tokens_used" integer,
  "content_hash" text NOT NULL,
  "version" integer NOT NULL DEFAULT 1,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now()
);

-- Foreign keys: best-effort; some of these target tables may not be present
-- in older deployments, in which case we skip rather than fail the migration.
DO $$
BEGIN
  ALTER TABLE "content_embeddings"
    ADD CONSTRAINT "content_embeddings_issue_id_fk"
    FOREIGN KEY ("issue_id") REFERENCES "issues"("id") ON DELETE CASCADE;
EXCEPTION WHEN duplicate_object OR undefined_table THEN
  NULL;
END $$;

DO $$
BEGIN
  ALTER TABLE "content_embeddings"
    ADD CONSTRAINT "content_embeddings_comment_id_fk"
    FOREIGN KEY ("comment_id") REFERENCES "issue_comments"("id") ON DELETE CASCADE;
EXCEPTION WHEN duplicate_object OR undefined_table THEN
  NULL;
END $$;

DO $$
BEGIN
  ALTER TABLE "content_embeddings"
    ADD CONSTRAINT "content_embeddings_project_id_fk"
    FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE;
EXCEPTION WHEN duplicate_object OR undefined_table THEN
  NULL;
END $$;

-- Helpful supporting indexes (the ANN index is added later in 0035 + 0051).
CREATE INDEX IF NOT EXISTS "content_embeddings_issue_id_idx"
  ON "content_embeddings" ("issue_id");
CREATE INDEX IF NOT EXISTS "content_embeddings_content_type_idx"
  ON "content_embeddings" ("content_type");
