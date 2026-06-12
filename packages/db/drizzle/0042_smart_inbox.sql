-- Smart Inbox + "Catch me up" digest (Roadmap P1-14).
--
-- 1. Adds `snoozed_until` to notifications so users can defer items and have
--    them re-emerge at the specified time. Re-emergence is enforced at read
--    time (queries filter snoozed_until > now()) so no background cron is
--    strictly required; the optional reaper just clears expired markers for
--    cleanliness.
-- 2. Adds `actor_type` so the inbox can distinguish human, agent, webhook
--    and system actors (rendered as filter chips). Existing rows default to
--    'user' which matches today's behavior.
-- 3. Adds `last_seen_at` to users so the dashboard "Welcome back" banner can
--    decide when to surface a "Catch me up" prompt (> 4h since last seen).

-- DO-block so the migration stays idempotent: the repaired journal
-- (_journal.json renumber, 2026-06) can legitimately re-run this file on
-- databases that stopped mid-way through the 2026-05 migration block.
DO $$ BEGIN
  CREATE TYPE "notification_actor_type" AS ENUM ('user', 'agent', 'webhook', 'system');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE "notifications"
  ADD COLUMN IF NOT EXISTS "snoozed_until" timestamp with time zone;

ALTER TABLE "notifications"
  ADD COLUMN IF NOT EXISTS "actor_type" "notification_actor_type" NOT NULL DEFAULT 'user';

CREATE INDEX IF NOT EXISTS "notification_user_snoozed_idx"
  ON "notifications" ("user_id", "snoozed_until");

CREATE INDEX IF NOT EXISTS "notification_user_actor_type_idx"
  ON "notifications" ("user_id", "actor_type");

ALTER TABLE "users"
  ADD COLUMN IF NOT EXISTS "last_seen_at" timestamp;
