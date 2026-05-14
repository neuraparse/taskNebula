-- Native time tracking (P1-10).
--
-- 1. Extend `issues` with hour-denominated estimate/actual + story points.
-- 2. Introduce `time_entries` with a GENERATED STORED `duration_seconds` column
--    so the DB always agrees with the timer math.
-- 3. Enforce "only one running timer per user" via a partial UNIQUE index on
--    (user_id) WHERE ended_at IS NULL.

ALTER TABLE "issues"
  ADD COLUMN IF NOT EXISTS "estimate_hours" numeric(8,2),
  ADD COLUMN IF NOT EXISTS "actual_hours" numeric(8,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "estimate_source" text,
  ADD COLUMN IF NOT EXISTS "story_points" integer;

-- Estimate-source guard. Three allowed values; NULL means "no estimate set".
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'issues_estimate_source_check'
  ) THEN
    ALTER TABLE "issues"
      ADD CONSTRAINT "issues_estimate_source_check"
      CHECK ("estimate_source" IS NULL
             OR "estimate_source" IN ('manual', 'ai_suggest', 'story_points'));
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS "time_entries" (
  "id" text PRIMARY KEY NOT NULL,
  "issue_id" text NOT NULL REFERENCES "issues"("id") ON DELETE CASCADE,
  "user_id" text NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "started_at" timestamptz NOT NULL,
  "ended_at" timestamptz,
  "duration_seconds" integer GENERATED ALWAYS AS (
    CASE
      WHEN "ended_at" IS NULL THEN NULL
      ELSE EXTRACT(EPOCH FROM ("ended_at" - "started_at"))::int
    END
  ) STORED,
  "description" text,
  "source" text NOT NULL DEFAULT 'manual',
  "integration_ref" text,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT "time_entries_source_check"
    CHECK ("source" IN ('manual', 'timer', 'github_inferred', 'integration')),
  CONSTRAINT "time_entries_ended_after_started_check"
    CHECK ("ended_at" IS NULL OR "ended_at" >= "started_at")
);

CREATE INDEX IF NOT EXISTS "time_entries_user_started_at_idx"
  ON "time_entries" ("user_id", "started_at");
CREATE INDEX IF NOT EXISTS "time_entries_issue_idx"
  ON "time_entries" ("issue_id");
CREATE INDEX IF NOT EXISTS "time_entries_user_running_idx"
  ON "time_entries" ("user_id", "ended_at");

-- "Only one running timer per user." Postgres treats every NULL as distinct,
-- so a plain UNIQUE on (user_id, ended_at) wouldn't enforce this. The partial
-- index does.
CREATE UNIQUE INDEX IF NOT EXISTS "time_entries_one_running_per_user_idx"
  ON "time_entries" ("user_id")
  WHERE "ended_at" IS NULL;
