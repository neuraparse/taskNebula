-- LLM call audit log: per-request observability for the Ask TaskNebula
-- RAG endpoint and other AI surfaces. We track org/user, model, a hash
-- of the prompt (raw text is never stored), token counts, USD cost and
-- end-to-end latency so admins can monitor spend and abuse without
-- exposing user content.

CREATE TABLE IF NOT EXISTS "llm_call_audit" (
  "id" text PRIMARY KEY NOT NULL,
  "org_id" text,
  "user_id" text,
  "endpoint" text NOT NULL DEFAULT 'ask',
  "model" text NOT NULL,
  "prompt_hash" text NOT NULL,
  "input_tokens" integer NOT NULL DEFAULT 0,
  "output_tokens" integer NOT NULL DEFAULT 0,
  "cost_usd" numeric(10, 6) NOT NULL DEFAULT 0,
  "latency_ms" integer NOT NULL DEFAULT 0,
  "status" text NOT NULL DEFAULT 'success',
  "metadata" jsonb NOT NULL DEFAULT '{}'::jsonb,
  "created_at" timestamp DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS "llm_call_audit_org_idx"
  ON "llm_call_audit" USING btree ("org_id");
CREATE INDEX IF NOT EXISTS "llm_call_audit_user_idx"
  ON "llm_call_audit" USING btree ("user_id");
CREATE INDEX IF NOT EXISTS "llm_call_audit_created_at_idx"
  ON "llm_call_audit" USING btree ("created_at");
CREATE INDEX IF NOT EXISTS "llm_call_audit_endpoint_created_idx"
  ON "llm_call_audit" USING btree ("endpoint", "created_at");
