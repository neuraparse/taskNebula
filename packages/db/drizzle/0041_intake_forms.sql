-- Intake Forms — public-facing web forms that route submissions into a
-- project as auto-created issues.

CREATE TABLE IF NOT EXISTS "intake_forms" (
  "id" text PRIMARY KEY NOT NULL,
  "workspace_id" text NOT NULL,
  "project_id" text NOT NULL,
  "slug" text NOT NULL,
  "title" text NOT NULL,
  "description" text,
  "fields" jsonb DEFAULT '[]'::jsonb NOT NULL,
  "is_public" boolean DEFAULT true NOT NULL,
  "requires_captcha" boolean DEFAULT false NOT NULL,
  "target_status" text DEFAULT 'triage' NOT NULL,
  "auto_assign_user_id" text,
  "custom_styling" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL
);

DO $$ BEGIN
  ALTER TABLE "intake_forms"
    ADD CONSTRAINT "intake_forms_workspace_id_organizations_id_fk"
    FOREIGN KEY ("workspace_id") REFERENCES "organizations"("id")
    ON DELETE CASCADE ON UPDATE NO ACTION;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "intake_forms"
    ADD CONSTRAINT "intake_forms_project_id_projects_id_fk"
    FOREIGN KEY ("project_id") REFERENCES "projects"("id")
    ON DELETE CASCADE ON UPDATE NO ACTION;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "intake_forms"
    ADD CONSTRAINT "intake_forms_auto_assign_user_id_users_id_fk"
    FOREIGN KEY ("auto_assign_user_id") REFERENCES "users"("id")
    ON DELETE SET NULL ON UPDATE NO ACTION;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE UNIQUE INDEX IF NOT EXISTS "intake_form_slug_idx" ON "intake_forms" USING btree ("slug");
CREATE INDEX IF NOT EXISTS "intake_form_workspace_idx" ON "intake_forms" USING btree ("workspace_id");
CREATE INDEX IF NOT EXISTS "intake_form_project_idx" ON "intake_forms" USING btree ("project_id");

CREATE TABLE IF NOT EXISTS "intake_submissions" (
  "id" text PRIMARY KEY NOT NULL,
  "intake_form_id" text NOT NULL,
  "submitted_by_email" text,
  "submitted_payload" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "status" text DEFAULT 'pending' NOT NULL,
  "created_issue_id" text,
  "ip_hash" text,
  "user_agent" text,
  "created_at" timestamp DEFAULT now() NOT NULL
);

DO $$ BEGIN
  ALTER TABLE "intake_submissions"
    ADD CONSTRAINT "intake_submissions_intake_form_id_intake_forms_id_fk"
    FOREIGN KEY ("intake_form_id") REFERENCES "intake_forms"("id")
    ON DELETE CASCADE ON UPDATE NO ACTION;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "intake_submissions"
    ADD CONSTRAINT "intake_submissions_created_issue_id_issues_id_fk"
    FOREIGN KEY ("created_issue_id") REFERENCES "issues"("id")
    ON DELETE SET NULL ON UPDATE NO ACTION;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE INDEX IF NOT EXISTS "intake_submission_form_idx" ON "intake_submissions" USING btree ("intake_form_id");
CREATE INDEX IF NOT EXISTS "intake_submission_created_at_idx" ON "intake_submissions" USING btree ("created_at");
CREATE INDEX IF NOT EXISTS "intake_submission_status_idx" ON "intake_submissions" USING btree ("status");
