-- AI Cost Guard (P0-07)
--
-- Two new tables:
--   * org_token_budgets — per-org daily/monthly token + USD ceilings with
--     a kill switch and running counters. Mutated under SELECT FOR UPDATE
--     by checkAndReserveTokens() / commitUsage() to avoid lost-update
--     races between concurrent LLM calls.
--   * llm_call_audit — append-only ledger of every LLM call attempted.
--     A trigger blocks UPDATE/DELETE so rows are immutable once written.
--
-- The existing `audit_logs` table is action-oriented and not a substitute
-- for per-call token/cost metrics — those would dominate the action log
-- in volume and need different retention rules.

CREATE TABLE IF NOT EXISTS "org_token_budgets" (
  "id" text PRIMARY KEY NOT NULL,
  "organization_id" text NOT NULL,
  "daily_token_limit" integer,
  "monthly_token_limit" integer,
  "daily_cost_usd_limit" numeric(12, 4),
  "monthly_cost_usd_limit" numeric(12, 4),
  "daily_used_tokens" integer DEFAULT 0 NOT NULL,
  "monthly_used_tokens" integer DEFAULT 0 NOT NULL,
  "daily_used_cost" numeric(12, 4) DEFAULT '0' NOT NULL,
  "monthly_used_cost" numeric(12, 4) DEFAULT '0' NOT NULL,
  "period_resets_at" timestamptz DEFAULT now() NOT NULL,
  "kill_switch_enabled" boolean DEFAULT false NOT NULL,
  "created_at" timestamptz DEFAULT now() NOT NULL,
  "updated_at" timestamptz DEFAULT now() NOT NULL
);

DO $$ BEGIN
  ALTER TABLE "org_token_budgets"
    ADD CONSTRAINT "org_token_budgets_organization_id_organizations_id_fk"
    FOREIGN KEY ("organization_id") REFERENCES "organizations"("id")
    ON DELETE CASCADE ON UPDATE NO ACTION;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS "org_token_budgets_organization_idx"
  ON "org_token_budgets" USING btree ("organization_id");

CREATE TABLE IF NOT EXISTS "llm_call_audit" (
  "id" text PRIMARY KEY NOT NULL,
  "organization_id" text NOT NULL,
  "user_id" text,
  "provider" text NOT NULL,
  "model" text NOT NULL,
  "prompt_hash" text,
  "input_tokens" integer DEFAULT 0 NOT NULL,
  "output_tokens" integer DEFAULT 0 NOT NULL,
  "cached_tokens" integer DEFAULT 0 NOT NULL,
  "cost_usd" numeric(12, 6) DEFAULT '0' NOT NULL,
  "latency_ms" integer,
  "status" text NOT NULL,
  "error_message" text,
  "feature" text NOT NULL,
  "created_at" timestamptz DEFAULT now() NOT NULL
);

DO $$ BEGIN
  ALTER TABLE "llm_call_audit"
    ADD CONSTRAINT "llm_call_audit_organization_id_organizations_id_fk"
    FOREIGN KEY ("organization_id") REFERENCES "organizations"("id")
    ON DELETE CASCADE ON UPDATE NO ACTION;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "llm_call_audit"
    ADD CONSTRAINT "llm_call_audit_user_id_users_id_fk"
    FOREIGN KEY ("user_id") REFERENCES "users"("id")
    ON DELETE SET NULL ON UPDATE NO ACTION;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

CREATE INDEX IF NOT EXISTS "llm_call_audit_organization_idx"
  ON "llm_call_audit" USING btree ("organization_id");
CREATE INDEX IF NOT EXISTS "llm_call_audit_created_at_idx"
  ON "llm_call_audit" USING btree ("created_at");
CREATE INDEX IF NOT EXISTS "llm_call_audit_org_created_at_idx"
  ON "llm_call_audit" USING btree ("organization_id", "created_at");
CREATE INDEX IF NOT EXISTS "llm_call_audit_status_idx"
  ON "llm_call_audit" USING btree ("status");
CREATE INDEX IF NOT EXISTS "llm_call_audit_feature_idx"
  ON "llm_call_audit" USING btree ("feature");

-- Append-only enforcement: reject any UPDATE or DELETE on llm_call_audit.
-- Rows are insert-only; corrections happen by writing a new row.
CREATE OR REPLACE FUNCTION "llm_call_audit_block_mutations"()
RETURNS trigger
LANGUAGE plpgsql
AS $func$
BEGIN
  RAISE EXCEPTION 'llm_call_audit is append-only; % is not permitted', TG_OP
    USING ERRCODE = 'feature_not_supported';
END;
$func$;

DROP TRIGGER IF EXISTS "llm_call_audit_no_update" ON "llm_call_audit";
CREATE TRIGGER "llm_call_audit_no_update"
  BEFORE UPDATE ON "llm_call_audit"
  FOR EACH ROW
  EXECUTE FUNCTION "llm_call_audit_block_mutations"();

DROP TRIGGER IF EXISTS "llm_call_audit_no_delete" ON "llm_call_audit";
CREATE TRIGGER "llm_call_audit_no_delete"
  BEFORE DELETE ON "llm_call_audit"
  FOR EACH ROW
  EXECUTE FUNCTION "llm_call_audit_block_mutations"();
