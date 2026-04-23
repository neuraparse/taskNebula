-- Home > Templates admin CRUD + use-template flow.
-- Adds `kind` and `payload` columns to project_templates so the app can store
-- project / issue / doc templates with a freeform JSON payload describing the
-- entity to create when a user presses "Use template".
--
-- The existing project-centric columns (statuses, issue_types, workflow_id, …)
-- remain intact so that legacy project-template rows continue to work. For the
-- new freeform flow we also relax `category` with a `'custom'` default so the
-- simple "new template" form only needs to collect name/description/kind/payload.
--
-- Self-healing: earlier migrations did not include a CREATE TABLE for
-- project_templates (it was populated via drizzle-kit push on some envs), so
-- this migration first ensures the table + its companion tables exist before
-- attempting to alter them. IF NOT EXISTS keeps this a no-op on fully
-- migrated DBs.

CREATE TABLE IF NOT EXISTS "project_templates" (
  "id" text PRIMARY KEY,
  "organization_id" text,
  "name" text NOT NULL,
  "description" text,
  "category" text NOT NULL DEFAULT 'custom',
  "icon" text,
  "color" text,
  "workflow_id" text,
  "permission_scheme_id" text,
  "statuses" jsonb NOT NULL DEFAULT '[]'::jsonb,
  "issue_types" jsonb NOT NULL DEFAULT '["task", "bug", "story"]'::jsonb,
  "custom_fields" jsonb NOT NULL DEFAULT '[]'::jsonb,
  "automation_rules" jsonb NOT NULL DEFAULT '[]'::jsonb,
  "default_settings" jsonb NOT NULL DEFAULT '{}'::jsonb,
  "sprint_config" jsonb,
  "board_config" jsonb,
  "is_public" boolean NOT NULL DEFAULT false,
  "is_verified" boolean NOT NULL DEFAULT false,
  "is_featured" boolean NOT NULL DEFAULT false,
  "usage_count" integer NOT NULL DEFAULT 0,
  "rating" integer DEFAULT 0,
  "reviews" jsonb DEFAULT '[]'::jsonb,
  "min_plan" text DEFAULT 'free',
  "required_integrations" jsonb DEFAULT '[]'::jsonb,
  "thumbnail" text,
  "screenshots" jsonb DEFAULT '[]'::jsonb,
  "created_by" text NOT NULL,
  "created_at" timestamp NOT NULL DEFAULT now(),
  "updated_at" timestamp NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS "template_usages" (
  "id" text PRIMARY KEY,
  "template_id" text NOT NULL,
  "organization_id" text NOT NULL,
  "user_id" text NOT NULL,
  "project_name" text NOT NULL,
  "project_key" text NOT NULL,
  "customizations" jsonb DEFAULT '{}'::jsonb,
  "created_at" timestamp NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS "template_reviews" (
  "id" text PRIMARY KEY,
  "template_id" text NOT NULL,
  "user_id" text NOT NULL,
  "organization_id" text NOT NULL,
  "rating" integer NOT NULL,
  "comment" text,
  "helpful" integer NOT NULL DEFAULT 0,
  "created_at" timestamp NOT NULL DEFAULT now(),
  "updated_at" timestamp NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS "template_categories" (
  "id" text PRIMARY KEY,
  "name" text NOT NULL UNIQUE,
  "description" text,
  "icon" text,
  "order" integer NOT NULL DEFAULT 0,
  "is_active" boolean NOT NULL DEFAULT true
);

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
