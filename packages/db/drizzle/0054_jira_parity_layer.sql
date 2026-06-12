-- Jira-parity structural layer (2026-06).
--
-- 1. First-class labels (+ issue_labels junction) replacing the
--    issues.labels jsonb string array as the source of truth, with an
--    idempotent backfill from the legacy jsonb column.
-- 2. Project versions / releases ("Fix Version" / "Affects Version") with
--    issue_fix_versions / issue_affects_versions junctions.
-- 3. Project components (+ issue_components junction).
-- 4. issues: resolution / resolved_at / flagged columns.
-- 5. CRITICAL fix: issue keys were globally unique (issue_key_idx on key
--    alone) which let one tenant collide with another tenant's "PROJ-1".
--    Replaced by issue_org_key_idx on (organization_id, key).
-- 6. Missing hot-path indexes: issues(organization_id), issues(epic_id),
--    attachments(issue_id), attachments(file_path).
--
-- Every statement is idempotent: this migration may re-run on databases
-- whose drizzle journal history was repaired (see _journal.json renumber).

-- --- enums -----------------------------------------------------------------

DO $$ BEGIN
  CREATE TYPE "issue_resolution" AS ENUM (
    'fixed',
    'wont_do',
    'duplicate',
    'cannot_reproduce',
    'done'
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "version_status" AS ENUM ('unreleased', 'released', 'archived');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "component_default_assignee" AS ENUM (
    'project_default',
    'component_lead',
    'unassigned'
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- --- labels ------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS "labels" (
  "id" text PRIMARY KEY NOT NULL,
  "organization_id" text NOT NULL REFERENCES "organizations"("id") ON DELETE CASCADE,
  -- NULL = org-wide label; non-NULL scopes the label to one project.
  "project_id" text REFERENCES "projects"("id") ON DELETE CASCADE,
  "name" varchar(100) NOT NULL,
  "color" varchar(20) NOT NULL DEFAULT '#6B7280',
  "description" text,
  "created_at" timestamp NOT NULL DEFAULT now(),
  "updated_at" timestamp NOT NULL DEFAULT now(),
  "created_by" text REFERENCES "users"("id") ON DELETE SET NULL
);

-- Expression unique index: org-wide labels (project_id NULL) share the ''
-- bucket so "bug" can exist once org-wide and once per project, but never
-- twice at the same scope. Must exist BEFORE the backfill below so its
-- ON CONFLICT DO NOTHING has a unique violation to swallow on re-runs.
CREATE UNIQUE INDEX IF NOT EXISTS "label_org_project_name_idx"
  ON "labels" ("organization_id", COALESCE("project_id", ''), "name");
CREATE INDEX IF NOT EXISTS "label_org_idx" ON "labels" ("organization_id");
CREATE INDEX IF NOT EXISTS "label_project_idx" ON "labels" ("project_id");

CREATE TABLE IF NOT EXISTS "issue_labels" (
  "issue_id" text NOT NULL REFERENCES "issues"("id") ON DELETE CASCADE,
  "label_id" text NOT NULL REFERENCES "labels"("id") ON DELETE CASCADE,
  "organization_id" text NOT NULL REFERENCES "organizations"("id") ON DELETE CASCADE,
  "created_at" timestamp NOT NULL DEFAULT now(),
  CONSTRAINT "issue_labels_issue_id_label_id_pk" PRIMARY KEY ("issue_id", "label_id")
);

CREATE INDEX IF NOT EXISTS "issue_label_label_idx" ON "issue_labels" ("label_id");
CREATE INDEX IF NOT EXISTS "issue_label_org_idx" ON "issue_labels" ("organization_id");

-- --- project versions --------------------------------------------------------

CREATE TABLE IF NOT EXISTS "project_versions" (
  "id" text PRIMARY KEY NOT NULL,
  "organization_id" text NOT NULL REFERENCES "organizations"("id") ON DELETE CASCADE,
  "project_id" text NOT NULL REFERENCES "projects"("id") ON DELETE CASCADE,
  "name" varchar(120) NOT NULL,
  "description" text,
  "status" "version_status" NOT NULL DEFAULT 'unreleased',
  "start_date" timestamp,
  "release_date" timestamp,
  "released_at" timestamp,
  "sort_order" integer NOT NULL DEFAULT 0,
  "created_at" timestamp NOT NULL DEFAULT now(),
  "updated_at" timestamp NOT NULL DEFAULT now(),
  "created_by" text REFERENCES "users"("id") ON DELETE SET NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS "project_version_project_name_idx"
  ON "project_versions" ("project_id", "name");
CREATE INDEX IF NOT EXISTS "project_version_org_idx"
  ON "project_versions" ("organization_id");
CREATE INDEX IF NOT EXISTS "project_version_project_status_idx"
  ON "project_versions" ("project_id", "status");

CREATE TABLE IF NOT EXISTS "issue_fix_versions" (
  "issue_id" text NOT NULL REFERENCES "issues"("id") ON DELETE CASCADE,
  "version_id" text NOT NULL REFERENCES "project_versions"("id") ON DELETE CASCADE,
  "organization_id" text NOT NULL REFERENCES "organizations"("id") ON DELETE CASCADE,
  "created_at" timestamp NOT NULL DEFAULT now(),
  CONSTRAINT "issue_fix_versions_issue_id_version_id_pk" PRIMARY KEY ("issue_id", "version_id")
);

CREATE INDEX IF NOT EXISTS "issue_fix_version_version_idx"
  ON "issue_fix_versions" ("version_id");
CREATE INDEX IF NOT EXISTS "issue_fix_version_org_idx"
  ON "issue_fix_versions" ("organization_id");

CREATE TABLE IF NOT EXISTS "issue_affects_versions" (
  "issue_id" text NOT NULL REFERENCES "issues"("id") ON DELETE CASCADE,
  "version_id" text NOT NULL REFERENCES "project_versions"("id") ON DELETE CASCADE,
  "organization_id" text NOT NULL REFERENCES "organizations"("id") ON DELETE CASCADE,
  "created_at" timestamp NOT NULL DEFAULT now(),
  CONSTRAINT "issue_affects_versions_issue_id_version_id_pk" PRIMARY KEY ("issue_id", "version_id")
);

CREATE INDEX IF NOT EXISTS "issue_affects_version_version_idx"
  ON "issue_affects_versions" ("version_id");
CREATE INDEX IF NOT EXISTS "issue_affects_version_org_idx"
  ON "issue_affects_versions" ("organization_id");

-- --- components ----------------------------------------------------------------

CREATE TABLE IF NOT EXISTS "components" (
  "id" text PRIMARY KEY NOT NULL,
  "organization_id" text NOT NULL REFERENCES "organizations"("id") ON DELETE CASCADE,
  "project_id" text NOT NULL REFERENCES "projects"("id") ON DELETE CASCADE,
  "name" varchar(120) NOT NULL,
  "description" text,
  "lead_id" text REFERENCES "users"("id") ON DELETE SET NULL,
  "default_assignee_type" "component_default_assignee" NOT NULL DEFAULT 'project_default',
  "archived" boolean NOT NULL DEFAULT false,
  "created_at" timestamp NOT NULL DEFAULT now(),
  "updated_at" timestamp NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS "component_project_name_idx"
  ON "components" ("project_id", "name");
CREATE INDEX IF NOT EXISTS "component_org_idx" ON "components" ("organization_id");

CREATE TABLE IF NOT EXISTS "issue_components" (
  "issue_id" text NOT NULL REFERENCES "issues"("id") ON DELETE CASCADE,
  "component_id" text NOT NULL REFERENCES "components"("id") ON DELETE CASCADE,
  "organization_id" text NOT NULL REFERENCES "organizations"("id") ON DELETE CASCADE,
  "created_at" timestamp NOT NULL DEFAULT now(),
  CONSTRAINT "issue_components_issue_id_component_id_pk" PRIMARY KEY ("issue_id", "component_id")
);

CREATE INDEX IF NOT EXISTS "issue_component_component_idx"
  ON "issue_components" ("component_id");
CREATE INDEX IF NOT EXISTS "issue_component_org_idx"
  ON "issue_components" ("organization_id");

-- --- issues: resolution / resolved_at / flagged -------------------------------

ALTER TABLE "issues" ADD COLUMN IF NOT EXISTS "resolution" "issue_resolution";
ALTER TABLE "issues" ADD COLUMN IF NOT EXISTS "resolved_at" timestamp;
ALTER TABLE "issues" ADD COLUMN IF NOT EXISTS "flagged" boolean NOT NULL DEFAULT false;

-- --- issues: cross-tenant key fix + missing indexes ----------------------------
-- issue_key_idx was UNIQUE on (key) alone — issue keys are only unique
-- within an organization, so the global index let tenant A's "PROJ-1"
-- block tenant B from ever creating a "PROJ-1".

DROP INDEX IF EXISTS "issue_key_idx";
CREATE UNIQUE INDEX IF NOT EXISTS "issue_org_key_idx"
  ON "issues" ("organization_id", "key");
CREATE INDEX IF NOT EXISTS "issue_org_idx" ON "issues" ("organization_id");
CREATE INDEX IF NOT EXISTS "issue_epic_idx" ON "issues" ("epic_id");

-- --- attachments: missing indexes ----------------------------------------------
-- "attachments" (schema/attachments.ts) had no index at all on issue_id or
-- file_path. ("issue_attachments" already gets attachment_issue_idx in 0000.)

CREATE INDEX IF NOT EXISTS "attachments_issue_id_idx" ON "attachments" ("issue_id");
CREATE INDEX IF NOT EXISTS "attachments_file_path_idx" ON "attachments" ("file_path");

-- --- label backfill from issues.labels jsonb ------------------------------------
-- Deterministic ids ('lbl' + md5 of org:name, 24 chars total like CUID2) so
-- re-runs regenerate the same id and ON CONFLICT DO NOTHING no-ops on both
-- the primary key and the label_org_project_name_idx expression index.
-- jsonb_typeof guard skips any malformed non-array labels values.

INSERT INTO "labels" ("id", "organization_id", "project_id", "name", "color")
SELECT DISTINCT
  'lbl' || substr(md5(i."organization_id" || ':' || t.name), 1, 21),
  i."organization_id",
  NULL,
  t.name,
  '#6B7280'
FROM "issues" i
CROSS JOIN LATERAL jsonb_array_elements_text(
  CASE WHEN jsonb_typeof(i."labels") = 'array' THEN i."labels" ELSE '[]'::jsonb END
) AS t(name)
-- char_length guard: a pathological legacy label longer than varchar(100)
-- would otherwise hard-fail the insert (value too long, not a conflict).
WHERE t.name <> '' AND char_length(t.name) <= 100
ON CONFLICT DO NOTHING;

INSERT INTO "issue_labels" ("issue_id", "label_id", "organization_id")
SELECT DISTINCT i."id", l."id", i."organization_id"
FROM "issues" i
CROSS JOIN LATERAL jsonb_array_elements_text(
  CASE WHEN jsonb_typeof(i."labels") = 'array' THEN i."labels" ELSE '[]'::jsonb END
) AS t(name)
JOIN "labels" l
  ON l."organization_id" = i."organization_id"
 AND l."project_id" IS NULL
 AND l."name" = t.name
WHERE t.name <> ''
ON CONFLICT DO NOTHING;
