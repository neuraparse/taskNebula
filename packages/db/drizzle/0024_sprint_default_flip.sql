-- Sprint & project lifecycle notifications.
-- Adds per-event email + in-app toggles for sprint.started, sprint.completed,
-- project.created, project.archived. Sprint events default to ON because they
-- are low-frequency/high-signal milestones; project events default to OFF for
-- email (opt-in) and ON for in-app (visible but not pushed to inbox).
--
-- We also flip the existing `email_on_sprint_started` / `email_on_sprint_completed`
-- DEFAULTS from false → true to match the new "lifecycle events are on" policy.
-- Existing rows are NOT backfilled; users keep whatever they explicitly chose.

ALTER TABLE "notification_preferences"
  ALTER COLUMN "email_on_sprint_started" SET DEFAULT true;

ALTER TABLE "notification_preferences"
  ALTER COLUMN "email_on_sprint_completed" SET DEFAULT true;

ALTER TABLE "notification_preferences"
  ADD COLUMN IF NOT EXISTS "email_on_project_created" boolean NOT NULL DEFAULT false;

ALTER TABLE "notification_preferences"
  ADD COLUMN IF NOT EXISTS "email_on_project_archived" boolean NOT NULL DEFAULT false;

ALTER TABLE "notification_preferences"
  ADD COLUMN IF NOT EXISTS "in_app_on_project_created" boolean NOT NULL DEFAULT true;

ALTER TABLE "notification_preferences"
  ADD COLUMN IF NOT EXISTS "in_app_on_project_archived" boolean NOT NULL DEFAULT true;
