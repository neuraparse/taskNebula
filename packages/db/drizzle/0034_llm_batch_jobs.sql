-- LLM batch job tracking (OpenAI Batch API, Anthropic Message Batches).
-- See packages/db/src/schema/llm-batch-jobs.ts for the schema doc.

CREATE TABLE IF NOT EXISTS "llm_batch_jobs" (
  "id" text PRIMARY KEY NOT NULL,
  "organization_id" text,
  "provider" text NOT NULL,
  "external_batch_id" text NOT NULL,
  "status" text DEFAULT 'validating' NOT NULL,
  "workload" text DEFAULT 'other' NOT NULL,
  "total_requests" integer DEFAULT 0 NOT NULL,
  "completed_requests" integer DEFAULT 0 NOT NULL,
  "error_count" integer DEFAULT 0 NOT NULL,
  "results_storage_path" text,
  "metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "completed_at" timestamp
);

DO $$
BEGIN
  ALTER TABLE "llm_batch_jobs"
    ADD CONSTRAINT "llm_batch_jobs_organization_id_organizations_id_fk"
    FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

CREATE INDEX IF NOT EXISTS "llm_batch_job_org_idx"
  ON "llm_batch_jobs" USING btree ("organization_id");
CREATE INDEX IF NOT EXISTS "llm_batch_job_status_idx"
  ON "llm_batch_jobs" USING btree ("status");
CREATE INDEX IF NOT EXISTS "llm_batch_job_provider_idx"
  ON "llm_batch_jobs" USING btree ("provider");
CREATE INDEX IF NOT EXISTS "llm_batch_job_workload_idx"
  ON "llm_batch_jobs" USING btree ("workload");
CREATE INDEX IF NOT EXISTS "llm_batch_job_external_idx"
  ON "llm_batch_jobs" USING btree ("external_batch_id");
CREATE INDEX IF NOT EXISTS "llm_batch_job_created_at_idx"
  ON "llm_batch_jobs" USING btree ("created_at");
