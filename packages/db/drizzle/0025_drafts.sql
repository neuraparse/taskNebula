-- Drafts: cross-device scratch space for unfinished work items, docs, comments.
-- Replaces the client-only `tn:drafts:v1` localStorage cache. `entity_type`
-- is plain text (issue/doc/other) so new promotion targets can be introduced
-- without a follow-up enum migration. `target_project_id` is nullable so a
-- draft can exist before the user has decided where to promote it.

CREATE TABLE IF NOT EXISTS "drafts" (
  "id" text PRIMARY KEY NOT NULL,
  "user_id" text NOT NULL,
  "organization_id" text,
  "title" text,
  "content" text,
  "entity_type" text NOT NULL DEFAULT 'other',
  "target_project_id" text,
  "metadata" jsonb NOT NULL DEFAULT '{}'::jsonb,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL
);

DO $$
BEGIN
  ALTER TABLE "drafts"
    ADD CONSTRAINT "drafts_user_id_users_id_fk"
    FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TABLE "drafts"
    ADD CONSTRAINT "drafts_organization_id_organizations_id_fk"
    FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TABLE "drafts"
    ADD CONSTRAINT "drafts_target_project_id_projects_id_fk"
    FOREIGN KEY ("target_project_id") REFERENCES "projects"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

CREATE INDEX IF NOT EXISTS "drafts_user_idx"
  ON "drafts" USING btree ("user_id");
