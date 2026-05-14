-- Import jobs: tracks long-running issue-import runs from external sources
-- (CSV upload, Linear API, Jira API, GitHub Issues). One row per submitted
-- import, updated as the job runner advances. `errors` is a JSONB list so
-- partial failures can be surfaced to the UI alongside successful records.
-- `payload_ref` is an opaque string the runner uses to retrieve raw payload
-- bytes (e.g. uploaded CSV path, JSON snapshot id) — we don't store the full
-- source body in this row to keep the table small.

CREATE TABLE IF NOT EXISTS "import_jobs" (
  "id" text PRIMARY KEY NOT NULL,
  "workspace_id" text NOT NULL,
  "source" text NOT NULL,
  "status" text NOT NULL DEFAULT 'pending',
  "total" integer NOT NULL DEFAULT 0,
  "processed" integer NOT NULL DEFAULT 0,
  "errors" jsonb NOT NULL DEFAULT '[]'::jsonb,
  "payload_ref" text,
  "mapping" jsonb NOT NULL DEFAULT '{}'::jsonb,
  "created_by" text,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "finished_at" timestamp
);

DO $$ BEGIN
  ALTER TABLE "import_jobs"
    ADD CONSTRAINT "import_jobs_workspace_id_organizations_id_fk"
    FOREIGN KEY ("workspace_id") REFERENCES "organizations"("id")
    ON DELETE CASCADE ON UPDATE NO ACTION;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "import_jobs"
    ADD CONSTRAINT "import_jobs_created_by_users_id_fk"
    FOREIGN KEY ("created_by") REFERENCES "users"("id")
    ON DELETE SET NULL ON UPDATE NO ACTION;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

CREATE INDEX IF NOT EXISTS "import_jobs_workspace_idx"
  ON "import_jobs" USING btree ("workspace_id");

CREATE INDEX IF NOT EXISTS "import_jobs_workspace_status_idx"
  ON "import_jobs" USING btree ("workspace_id", "status");

CREATE INDEX IF NOT EXISTS "import_jobs_created_at_idx"
  ON "import_jobs" USING btree ("created_at");
