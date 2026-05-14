-- FEAT-23: Cycles auto-rollover + Time-in-Status
--
-- 1. issue_status_history: append-only log of issue status transitions.
--    Backfill is intentionally skipped; analytics start fresh from deploy.
-- 2. sprints.enable_auto_rollover: per-cycle opt-out for auto-rollover.
-- 3. sprints.rolled_over_at: idempotency guard for the cron worker.

CREATE TABLE IF NOT EXISTS "issue_status_history" (
  "id" text PRIMARY KEY NOT NULL,
  "issue_id" text NOT NULL REFERENCES "issues"("id") ON DELETE CASCADE,
  "from_status" text,
  "to_status" text NOT NULL,
  "changed_by_user_id" text REFERENCES "users"("id") ON DELETE SET NULL,
  "changed_at" timestamp with time zone DEFAULT now() NOT NULL,
  "reason" text
);

CREATE INDEX IF NOT EXISTS "issue_status_history_issue_changed_at_idx"
  ON "issue_status_history" ("issue_id", "changed_at");

ALTER TABLE "sprints"
  ADD COLUMN IF NOT EXISTS "enable_auto_rollover" boolean NOT NULL DEFAULT true;

ALTER TABLE "sprints"
  ADD COLUMN IF NOT EXISTS "rolled_over_at" timestamp;
