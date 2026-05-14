-- Issue Triage Suggestions: persisted output of the Triage Intelligence agent
-- (P0-02). Stores each LLM proposal so we can audit suggestions whether or
-- not they were applied; `applied_at` and `dismissed_at` are mutually
-- exclusive lifecycle markers (both null = pending review).

CREATE TABLE IF NOT EXISTS "issue_triage_suggestions" (
  "id" text PRIMARY KEY NOT NULL,
  "issue_id" text NOT NULL,
  "payload" jsonb NOT NULL,
  "confidence" integer NOT NULL DEFAULT 0,
  "applied_at" timestamp,
  "applied_by" text,
  "dismissed_at" timestamp,
  "dismissed_by" text,
  "created_at" timestamp DEFAULT now() NOT NULL
);

DO $$
BEGIN
  ALTER TABLE "issue_triage_suggestions"
    ADD CONSTRAINT "issue_triage_suggestions_issue_id_issues_id_fk"
    FOREIGN KEY ("issue_id") REFERENCES "issues"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TABLE "issue_triage_suggestions"
    ADD CONSTRAINT "issue_triage_suggestions_applied_by_users_id_fk"
    FOREIGN KEY ("applied_by") REFERENCES "users"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TABLE "issue_triage_suggestions"
    ADD CONSTRAINT "issue_triage_suggestions_dismissed_by_users_id_fk"
    FOREIGN KEY ("dismissed_by") REFERENCES "users"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

CREATE INDEX IF NOT EXISTS "triage_suggestion_issue_idx"
  ON "issue_triage_suggestions" USING btree ("issue_id");

CREATE INDEX IF NOT EXISTS "triage_suggestion_issue_created_at_idx"
  ON "issue_triage_suggestions" USING btree ("issue_id", "created_at");
