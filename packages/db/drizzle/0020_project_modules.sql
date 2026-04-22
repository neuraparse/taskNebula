-- Project modules: server-side persistence for per-project feature areas.
-- Previously stored client-side in localStorage (tn:modules:<projectId>).
-- Status is plain text (not an enum) so new statuses can be added without a
-- follow-up enum migration; values mirror the ModuleStatus type in the web app.

CREATE TABLE IF NOT EXISTS "project_modules" (
  "id" text PRIMARY KEY NOT NULL,
  "project_id" text NOT NULL REFERENCES "projects"("id") ON DELETE cascade,
  "name" varchar(255) NOT NULL,
  "description" text,
  "status" text NOT NULL DEFAULT 'backlog',
  "owner_id" text REFERENCES "users"("id") ON DELETE set null,
  "member_ids" jsonb NOT NULL DEFAULT '[]'::jsonb,
  "target_date" timestamp,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS "project_module_project_idx"
  ON "project_modules" ("project_id");
