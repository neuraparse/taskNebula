-- Home > Templates admin CRUD + use-template flow.
-- Adds `kind` and `payload` columns to project_templates so the app can store
-- project / issue / doc templates with a freeform JSON payload describing the
-- entity to create when a user presses "Use template".
--
-- The existing project-centric columns (statuses, issue_types, workflow_id, …)
-- remain intact so that legacy project-template rows continue to work. For the
-- new freeform flow we also relax `category` with a `'custom'` default so the
-- simple "new template" form only needs to collect name/description/kind/payload.

ALTER TABLE "project_templates"
  ADD COLUMN IF NOT EXISTS "kind" text NOT NULL DEFAULT 'project';

ALTER TABLE "project_templates"
  ADD COLUMN IF NOT EXISTS "payload" jsonb NOT NULL DEFAULT '{}'::jsonb;

ALTER TABLE "project_templates"
  ALTER COLUMN "category" SET DEFAULT 'custom';

CREATE INDEX IF NOT EXISTS "project_templates_organization_id_idx"
  ON "project_templates" USING btree ("organization_id");

CREATE INDEX IF NOT EXISTS "project_templates_kind_idx"
  ON "project_templates" USING btree ("kind");
