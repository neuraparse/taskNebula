DO $$
BEGIN
  CREATE TYPE "project_role" AS ENUM (
    'product_owner',
    'scrum_master',
    'tech_lead',
    'developer',
    'qa_engineer',
    'designer',
    'viewer'
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS "project_members" (
  "id" text PRIMARY KEY NOT NULL,
  "project_id" text NOT NULL REFERENCES "projects"("id") ON DELETE cascade,
  "user_id" text NOT NULL REFERENCES "users"("id") ON DELETE cascade,
  "role" "project_role" DEFAULT 'developer' NOT NULL,
  "can_browse_project" varchar(5) DEFAULT 'true' NOT NULL,
  "can_administer_project" varchar(5) DEFAULT 'false' NOT NULL,
  "can_manage_sprints" varchar(5) DEFAULT 'false' NOT NULL,
  "can_start_sprint" varchar(5) DEFAULT 'false' NOT NULL,
  "can_complete_sprint" varchar(5) DEFAULT 'false' NOT NULL,
  "can_delete_sprint" varchar(5) DEFAULT 'false' NOT NULL,
  "can_create_issues" varchar(5) DEFAULT 'true' NOT NULL,
  "can_edit_issues" varchar(5) DEFAULT 'true' NOT NULL,
  "can_edit_own_issues" varchar(5) DEFAULT 'true' NOT NULL,
  "can_delete_issues" varchar(5) DEFAULT 'false' NOT NULL,
  "can_delete_own_issues" varchar(5) DEFAULT 'false' NOT NULL,
  "can_assign_issues" varchar(5) DEFAULT 'false' NOT NULL,
  "can_assignee_issues" varchar(5) DEFAULT 'true' NOT NULL,
  "can_transition_issues" varchar(5) DEFAULT 'true' NOT NULL,
  "can_schedule_issues" varchar(5) DEFAULT 'false' NOT NULL,
  "can_move_issues" varchar(5) DEFAULT 'false' NOT NULL,
  "can_link_issues" varchar(5) DEFAULT 'true' NOT NULL,
  "can_close_issues" varchar(5) DEFAULT 'true' NOT NULL,
  "can_reopen_issues" varchar(5) DEFAULT 'true' NOT NULL,
  "can_add_comments" varchar(5) DEFAULT 'true' NOT NULL,
  "can_edit_own_comments" varchar(5) DEFAULT 'true' NOT NULL,
  "can_edit_all_comments" varchar(5) DEFAULT 'false' NOT NULL,
  "can_delete_own_comments" varchar(5) DEFAULT 'true' NOT NULL,
  "can_delete_all_comments" varchar(5) DEFAULT 'false' NOT NULL,
  "can_create_attachments" varchar(5) DEFAULT 'true' NOT NULL,
  "can_delete_own_attachments" varchar(5) DEFAULT 'true' NOT NULL,
  "can_delete_all_attachments" varchar(5) DEFAULT 'false' NOT NULL,
  "can_manage_watchers" varchar(5) DEFAULT 'false' NOT NULL,
  "can_view_watchers" varchar(5) DEFAULT 'true' NOT NULL,
  "can_manage_members" varchar(5) DEFAULT 'false' NOT NULL,
  "can_invite_members" varchar(5) DEFAULT 'false' NOT NULL,
  "can_remove_members" varchar(5) DEFAULT 'false' NOT NULL,
  "can_change_roles" varchar(5) DEFAULT 'false' NOT NULL,
  "can_manage_workflow" varchar(5) DEFAULT 'false' NOT NULL,
  "can_log_work" varchar(5) DEFAULT 'true' NOT NULL,
  "can_edit_own_worklogs" varchar(5) DEFAULT 'true' NOT NULL,
  "can_edit_all_worklogs" varchar(5) DEFAULT 'false' NOT NULL,
  "can_delete_own_worklogs" varchar(5) DEFAULT 'true' NOT NULL,
  "can_delete_all_worklogs" varchar(5) DEFAULT 'false' NOT NULL,
  "joined_at" timestamp DEFAULT now() NOT NULL,
  "invited_by" text REFERENCES "users"("id"),
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS "project_member_project_user_idx" ON "project_members" USING btree ("project_id","user_id");
CREATE INDEX IF NOT EXISTS "project_member_user_idx" ON "project_members" USING btree ("user_id");
CREATE INDEX IF NOT EXISTS "project_member_project_idx" ON "project_members" USING btree ("project_id");
CREATE INDEX IF NOT EXISTS "project_member_role_idx" ON "project_members" USING btree ("role");

ALTER TABLE "project_members" ADD COLUMN IF NOT EXISTS "can_browse_docs" varchar(5) DEFAULT 'true' NOT NULL;
ALTER TABLE "project_members" ADD COLUMN IF NOT EXISTS "can_create_docs" varchar(5) DEFAULT 'false' NOT NULL;
ALTER TABLE "project_members" ADD COLUMN IF NOT EXISTS "can_edit_docs" varchar(5) DEFAULT 'false' NOT NULL;
ALTER TABLE "project_members" ADD COLUMN IF NOT EXISTS "can_delete_docs" varchar(5) DEFAULT 'false' NOT NULL;

DO $$
BEGIN
  CREATE TYPE "document_space_scope" AS ENUM ('organization', 'project');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

ALTER TYPE "audit_log_action" ADD VALUE IF NOT EXISTS 'document.created';
ALTER TYPE "audit_log_action" ADD VALUE IF NOT EXISTS 'document.updated';
ALTER TYPE "audit_log_action" ADD VALUE IF NOT EXISTS 'document.deleted';
ALTER TYPE "audit_log_action" ADD VALUE IF NOT EXISTS 'document.restored';
ALTER TYPE "audit_log_action" ADD VALUE IF NOT EXISTS 'document.linked_issue';
ALTER TYPE "audit_log_action" ADD VALUE IF NOT EXISTS 'document.unlinked_issue';

CREATE TABLE IF NOT EXISTS "issue_security_schemes" (
  "id" text PRIMARY KEY NOT NULL,
  "organization_id" text NOT NULL REFERENCES "organizations"("id") ON DELETE cascade,
  "name" varchar(255) NOT NULL,
  "description" text,
  "is_default" boolean DEFAULT false NOT NULL,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL,
  "created_by" text NOT NULL REFERENCES "users"("id"),
  "updated_by" text NOT NULL REFERENCES "users"("id")
);

CREATE TABLE IF NOT EXISTS "issue_security_levels" (
  "id" text PRIMARY KEY NOT NULL,
  "scheme_id" text NOT NULL REFERENCES "issue_security_schemes"("id") ON DELETE cascade,
  "name" varchar(255) NOT NULL,
  "description" text,
  "sort_order" integer DEFAULT 0 NOT NULL,
  "is_default" boolean DEFAULT false NOT NULL,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "issue_security_level_members" (
  "id" text PRIMARY KEY NOT NULL,
  "level_id" text NOT NULL REFERENCES "issue_security_levels"("id") ON DELETE cascade,
  "member_type" varchar(50) NOT NULL,
  "member_value" text,
  "created_at" timestamp DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "project_security_schemes" (
  "id" text PRIMARY KEY NOT NULL,
  "project_id" text NOT NULL REFERENCES "projects"("id") ON DELETE cascade,
  "scheme_id" text NOT NULL REFERENCES "issue_security_schemes"("id") ON DELETE cascade,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL,
  "created_by" text NOT NULL REFERENCES "users"("id")
);

CREATE INDEX IF NOT EXISTS "issue_security_scheme_org_idx" ON "issue_security_schemes" USING btree ("organization_id");
CREATE UNIQUE INDEX IF NOT EXISTS "issue_security_scheme_org_name_idx" ON "issue_security_schemes" USING btree ("organization_id","name");
CREATE INDEX IF NOT EXISTS "issue_security_level_scheme_idx" ON "issue_security_levels" USING btree ("scheme_id");
CREATE UNIQUE INDEX IF NOT EXISTS "issue_security_level_scheme_name_idx" ON "issue_security_levels" USING btree ("scheme_id","name");
CREATE INDEX IF NOT EXISTS "issue_security_level_sort_idx" ON "issue_security_levels" USING btree ("scheme_id","sort_order");
CREATE INDEX IF NOT EXISTS "issue_security_member_level_idx" ON "issue_security_level_members" USING btree ("level_id");
CREATE INDEX IF NOT EXISTS "issue_security_member_type_idx" ON "issue_security_level_members" USING btree ("level_id","member_type");
CREATE UNIQUE INDEX IF NOT EXISTS "project_security_scheme_project_idx" ON "project_security_schemes" USING btree ("project_id");
CREATE INDEX IF NOT EXISTS "project_security_scheme_scheme_idx" ON "project_security_schemes" USING btree ("scheme_id");

ALTER TABLE "issues" ADD COLUMN IF NOT EXISTS "security_level_id" text;
CREATE INDEX IF NOT EXISTS "issue_security_level_idx" ON "issues" USING btree ("security_level_id");

DO $$
BEGIN
  ALTER TABLE "issues"
    ADD CONSTRAINT "issues_security_level_id_issue_security_levels_id_fk"
    FOREIGN KEY ("security_level_id") REFERENCES "issue_security_levels"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE "document_spaces" (
  "id" text PRIMARY KEY NOT NULL,
  "organization_id" text NOT NULL REFERENCES "organizations"("id") ON DELETE cascade,
  "project_id" text REFERENCES "projects"("id") ON DELETE cascade,
  "scope" "document_space_scope" NOT NULL,
  "name" varchar(255) NOT NULL,
  "slug" varchar(120) NOT NULL,
  "description" text,
  "is_default" boolean DEFAULT false NOT NULL,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL,
  "created_by" text NOT NULL REFERENCES "users"("id"),
  "updated_by" text NOT NULL REFERENCES "users"("id")
);

CREATE TABLE "document_pages" (
  "id" text PRIMARY KEY NOT NULL,
  "space_id" text NOT NULL REFERENCES "document_spaces"("id") ON DELETE cascade,
  "organization_id" text NOT NULL REFERENCES "organizations"("id") ON DELETE cascade,
  "project_id" text REFERENCES "projects"("id") ON DELETE cascade,
  "parent_id" text REFERENCES "document_pages"("id") ON DELETE cascade,
  "title" varchar(500) NOT NULL,
  "slug" varchar(200) NOT NULL,
  "icon" varchar(50),
  "content_json" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "content_text" text DEFAULT '' NOT NULL,
  "excerpt" text,
  "current_revision" integer DEFAULT 1 NOT NULL,
  "position" integer DEFAULT 0 NOT NULL,
  "is_archived" boolean DEFAULT false NOT NULL,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL,
  "created_by" text NOT NULL REFERENCES "users"("id"),
  "updated_by" text NOT NULL REFERENCES "users"("id")
);

CREATE TABLE "document_page_revisions" (
  "id" text PRIMARY KEY NOT NULL,
  "page_id" text NOT NULL REFERENCES "document_pages"("id") ON DELETE cascade,
  "revision" integer NOT NULL,
  "title" varchar(500) NOT NULL,
  "content_json" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "content_text" text DEFAULT '' NOT NULL,
  "excerpt" text,
  "change_summary" text,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "created_by" text NOT NULL REFERENCES "users"("id")
);

CREATE TABLE "document_page_links" (
  "id" text PRIMARY KEY NOT NULL,
  "source_page_id" text NOT NULL REFERENCES "document_pages"("id") ON DELETE cascade,
  "target_page_id" text NOT NULL REFERENCES "document_pages"("id") ON DELETE cascade,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL,
  "created_by" text NOT NULL REFERENCES "users"("id"),
  "updated_by" text NOT NULL REFERENCES "users"("id")
);

CREATE TABLE "issue_document_links" (
  "id" text PRIMARY KEY NOT NULL,
  "issue_id" text NOT NULL REFERENCES "issues"("id") ON DELETE cascade,
  "page_id" text NOT NULL REFERENCES "document_pages"("id") ON DELETE cascade,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL,
  "created_by" text NOT NULL REFERENCES "users"("id"),
  "updated_by" text NOT NULL REFERENCES "users"("id")
);

CREATE TABLE "document_page_attachments" (
  "id" text PRIMARY KEY NOT NULL,
  "page_id" text NOT NULL REFERENCES "document_pages"("id") ON DELETE cascade,
  "file_name" varchar(255) NOT NULL,
  "file_size" integer NOT NULL,
  "mime_type" varchar(100) NOT NULL,
  "file_path" text NOT NULL,
  "uploaded_by_id" text NOT NULL REFERENCES "users"("id") ON DELETE cascade,
  "created_at" timestamp DEFAULT now() NOT NULL
);

ALTER TABLE "document_pages"
ADD COLUMN "search_vector" tsvector GENERATED ALWAYS AS (
  setweight(to_tsvector('simple', coalesce("title", '')), 'A') ||
  setweight(to_tsvector('simple', coalesce("content_text", '')), 'B')
) STORED;

CREATE UNIQUE INDEX "document_space_org_scope_slug_idx" ON "document_spaces" ("organization_id", "scope", "slug");
CREATE INDEX "document_space_project_idx" ON "document_spaces" ("project_id");
CREATE INDEX "document_space_organization_idx" ON "document_spaces" ("organization_id");

CREATE UNIQUE INDEX "document_page_space_parent_slug_idx" ON "document_pages" ("space_id", "parent_id", "slug");
CREATE INDEX "document_page_space_idx" ON "document_pages" ("space_id");
CREATE INDEX "document_page_parent_idx" ON "document_pages" ("parent_id");
CREATE INDEX "document_page_project_idx" ON "document_pages" ("project_id");
CREATE INDEX "document_page_organization_idx" ON "document_pages" ("organization_id");
CREATE INDEX "document_page_archived_idx" ON "document_pages" ("is_archived");
CREATE INDEX "document_page_search_vector_idx" ON "document_pages" USING gin ("search_vector");

CREATE UNIQUE INDEX "document_page_revision_page_revision_idx" ON "document_page_revisions" ("page_id", "revision");
CREATE INDEX "document_page_revision_page_idx" ON "document_page_revisions" ("page_id");

CREATE UNIQUE INDEX "document_page_link_source_target_idx" ON "document_page_links" ("source_page_id", "target_page_id");
CREATE INDEX "document_page_link_source_idx" ON "document_page_links" ("source_page_id");
CREATE INDEX "document_page_link_target_idx" ON "document_page_links" ("target_page_id");

CREATE UNIQUE INDEX "issue_document_link_issue_page_idx" ON "issue_document_links" ("issue_id", "page_id");
CREATE INDEX "issue_document_link_issue_idx" ON "issue_document_links" ("issue_id");
CREATE INDEX "issue_document_link_page_idx" ON "issue_document_links" ("page_id");

CREATE INDEX "document_page_attachment_page_idx" ON "document_page_attachments" ("page_id");
