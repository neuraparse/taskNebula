-- Project lifecycle notification preferences + notification_type values.
-- Adds opt-in toggles for `project.created` and `project.archived` events so
-- the notification pipeline can gate sends per user. Existing rows keep their
-- explicit choices; these new columns default to quiet (email off, in-app on),
-- matching the existing "quiet by default" email policy.

ALTER TABLE "notification_preferences"
  ADD COLUMN IF NOT EXISTS "email_on_project_created" boolean DEFAULT false NOT NULL;

ALTER TABLE "notification_preferences"
  ADD COLUMN IF NOT EXISTS "email_on_project_archived" boolean DEFAULT false NOT NULL;

ALTER TABLE "notification_preferences"
  ADD COLUMN IF NOT EXISTS "in_app_on_project_created" boolean DEFAULT true NOT NULL;

ALTER TABLE "notification_preferences"
  ADD COLUMN IF NOT EXISTS "in_app_on_project_archived" boolean DEFAULT true NOT NULL;

-- Expose the two new event kinds on the in-app notifications enum.
ALTER TYPE "notification_type" ADD VALUE IF NOT EXISTS 'project_created';
ALTER TYPE "notification_type" ADD VALUE IF NOT EXISTS 'project_archived';
