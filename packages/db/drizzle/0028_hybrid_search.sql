-- Hybrid search wire-up (P0-01)
-- 1. tsvector + GIN on issues (title weight A, key weight A, description weight B)
-- 2. tsvector + GIN on issue_comments (content weight B)
-- 3. Helpful ivfflat index on content_embeddings.embedding for cosine search
-- 4. content_embeddings_queue durable job log (LISTEN/NOTIFY channel: content_embeddings_jobs)
-- 5. Triggers on issues/issue_comments to enqueue (insert/update of indexed text)

-- pgvector is provisioned by docker/postgres/init.sql; this is a no-op if it
-- already exists.
CREATE EXTENSION IF NOT EXISTS vector;

-- ---------------------------------------------------------------------------
-- 1. issues.search_vector
-- ---------------------------------------------------------------------------
ALTER TABLE "issues" ADD COLUMN IF NOT EXISTS "search_vector" tsvector
  GENERATED ALWAYS AS (
    setweight(to_tsvector('simple', coalesce("title", '')), 'A') ||
    setweight(to_tsvector('simple', coalesce("key", '')), 'A') ||
    setweight(to_tsvector('simple', coalesce("description", '')), 'B')
  ) STORED;

CREATE INDEX IF NOT EXISTS "issue_search_vector_idx"
  ON "issues" USING gin ("search_vector");

-- ---------------------------------------------------------------------------
-- 2. issue_comments.search_vector
-- ---------------------------------------------------------------------------
ALTER TABLE "issue_comments" ADD COLUMN IF NOT EXISTS "search_vector" tsvector
  GENERATED ALWAYS AS (
    setweight(to_tsvector('simple', coalesce("content", '')), 'B')
  ) STORED;

CREATE INDEX IF NOT EXISTS "issue_comment_search_vector_idx"
  ON "issue_comments" USING gin ("search_vector");

-- ---------------------------------------------------------------------------
-- 3. content_embeddings: dedup unique key + ivfflat ANN index
--    We key the row by (content_type, content_id) so the embedding worker
--    can UPSERT and the hash-gate (content_hash) prevents needless re-embeds.
-- ---------------------------------------------------------------------------
CREATE UNIQUE INDEX IF NOT EXISTS "content_embeddings_type_id_idx"
  ON "content_embeddings" ("content_type", "content_id");

-- The cosine distance operator is `<=>` for pgvector; lists=100 is a safe
-- default for tables under ~1M rows. We can re-tune (or switch to HNSW)
-- without code changes.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes WHERE indexname = 'content_embeddings_embedding_idx'
  ) THEN
    EXECUTE 'CREATE INDEX "content_embeddings_embedding_idx"
             ON "content_embeddings"
             USING ivfflat ("embedding" vector_cosine_ops)
             WITH (lists = 100)';
  END IF;
EXCEPTION
  WHEN feature_not_supported THEN NULL;
  WHEN undefined_object THEN NULL;
END $$;

-- ---------------------------------------------------------------------------
-- 4. Durable embedding job log + LISTEN/NOTIFY channel
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS "content_embeddings_queue" (
  "id" bigserial PRIMARY KEY,
  "content_type" text NOT NULL,
  "content_id" text NOT NULL,
  "organization_id" text,
  "project_id" text,
  "status" text NOT NULL DEFAULT 'pending',
  "attempts" integer NOT NULL DEFAULT 0,
  "last_error" text,
  "enqueued_at" timestamp NOT NULL DEFAULT now(),
  "started_at" timestamp,
  "completed_at" timestamp
);

CREATE INDEX IF NOT EXISTS "content_embeddings_queue_status_idx"
  ON "content_embeddings_queue" ("status", "enqueued_at");

CREATE INDEX IF NOT EXISTS "content_embeddings_queue_ref_idx"
  ON "content_embeddings_queue" ("content_type", "content_id");

-- ---------------------------------------------------------------------------
-- 5. Triggers: enqueue on insert/update of indexed columns
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION enqueue_content_embedding()
RETURNS trigger AS $$
DECLARE
  v_content_type text;
  v_content_id text;
  v_org_id text;
  v_project_id text;
BEGIN
  IF TG_TABLE_NAME = 'issues' THEN
    v_content_type := 'issue';
    v_content_id := NEW.id;
    v_org_id := NEW.organization_id;
    v_project_id := NEW.project_id;
    IF TG_OP = 'UPDATE' AND
       OLD.title IS NOT DISTINCT FROM NEW.title AND
       OLD.description IS NOT DISTINCT FROM NEW.description THEN
      RETURN NEW;
    END IF;
  ELSIF TG_TABLE_NAME = 'issue_comments' THEN
    v_content_type := 'comment';
    v_content_id := NEW.id;
    v_org_id := NULL;
    v_project_id := NULL;
    IF TG_OP = 'UPDATE' AND OLD.content IS NOT DISTINCT FROM NEW.content THEN
      RETURN NEW;
    END IF;
  ELSE
    RETURN NEW;
  END IF;

  INSERT INTO content_embeddings_queue (content_type, content_id, organization_id, project_id)
  VALUES (v_content_type, v_content_id, v_org_id, v_project_id);

  PERFORM pg_notify('content_embeddings_jobs', v_content_type || ':' || v_content_id);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS issues_enqueue_embedding_trg ON "issues";
CREATE TRIGGER issues_enqueue_embedding_trg
  AFTER INSERT OR UPDATE OF title, description ON "issues"
  FOR EACH ROW EXECUTE FUNCTION enqueue_content_embedding();

DROP TRIGGER IF EXISTS issue_comments_enqueue_embedding_trg ON "issue_comments";
CREATE TRIGGER issue_comments_enqueue_embedding_trg
  AFTER INSERT OR UPDATE OF content ON "issue_comments"
  FOR EACH ROW EXECUTE FUNCTION enqueue_content_embedding();
