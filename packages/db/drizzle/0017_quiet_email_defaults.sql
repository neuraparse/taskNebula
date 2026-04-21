-- Tighten email notification defaults to "quiet by default":
-- only direct-impact events (assignment, mention) stay opt-in at creation.
-- Existing rows are NOT backfilled — users keep whatever they explicitly chose.

ALTER TABLE "notification_preferences"
  ALTER COLUMN "email_on_commented" SET DEFAULT false;
