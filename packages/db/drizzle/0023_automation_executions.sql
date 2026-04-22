-- Automation executions audit trail. One row per automation rule evaluation
-- (matched and run, or skipped because conditions did not match). Used by the
-- automation evaluator engine to record outcomes for debugging and audits.

CREATE TABLE IF NOT EXISTS "automation_executions" (
  "id" text PRIMARY KEY NOT NULL,
  "rule_id" text NOT NULL,
  "triggered_at" timestamp DEFAULT now() NOT NULL,
  "trigger_payload" jsonb,
  "status" text NOT NULL,
  "action_results" jsonb,
  "duration_ms" integer,
  "error" text
);

DO $$
BEGIN
  ALTER TABLE "automation_executions"
    ADD CONSTRAINT "automation_executions_rule_id_automation_rules_id_fk"
    FOREIGN KEY ("rule_id") REFERENCES "automation_rules"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

CREATE INDEX IF NOT EXISTS "automation_execution_rule_idx"
  ON "automation_executions" USING btree ("rule_id");

CREATE INDEX IF NOT EXISTS "automation_execution_rule_triggered_at_idx"
  ON "automation_executions" USING btree ("rule_id", "triggered_at");
