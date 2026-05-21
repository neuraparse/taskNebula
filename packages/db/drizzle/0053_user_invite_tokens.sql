-- Runtime schema gaps fixed after the 0.3.1 Docker audit.
--
-- These tables/columns are exported by the TypeScript schema and are used by
-- application code, but prior SQL migrations did not create them on a fresh
-- database. Keep this migration idempotent so existing installs that used
-- drizzle-kit push remain safe.

CREATE EXTENSION IF NOT EXISTS vector;

ALTER TABLE "users"
  ADD COLUMN IF NOT EXISTS "invite_token_hash" text,
  ADD COLUMN IF NOT EXISTS "invite_token_expires_at" timestamp;

CREATE TABLE IF NOT EXISTS "permission_schemes" (
  "id" text PRIMARY KEY NOT NULL,
  "organization_id" text NOT NULL REFERENCES "organizations"("id") ON DELETE CASCADE,
  "name" varchar(255) NOT NULL,
  "description" text,
  "is_default" boolean NOT NULL DEFAULT false,
  "permissions" jsonb NOT NULL DEFAULT '{}'::jsonb,
  "created_at" timestamp NOT NULL DEFAULT now(),
  "updated_at" timestamp NOT NULL DEFAULT now(),
  "created_by" text NOT NULL REFERENCES "users"("id"),
  "updated_by" text NOT NULL REFERENCES "users"("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "permission_scheme_org_name_idx"
  ON "permission_schemes" ("organization_id", "name");
CREATE INDEX IF NOT EXISTS "permission_scheme_org_idx"
  ON "permission_schemes" ("organization_id");
CREATE INDEX IF NOT EXISTS "permission_scheme_default_idx"
  ON "permission_schemes" ("organization_id", "is_default");

CREATE TABLE IF NOT EXISTS "permission_scheme_grants" (
  "id" text PRIMARY KEY NOT NULL,
  "scheme_id" text NOT NULL REFERENCES "permission_schemes"("id") ON DELETE CASCADE,
  "permission_key" varchar(100) NOT NULL,
  "grant_type" varchar(50) NOT NULL,
  "grant_value" text,
  "created_at" timestamp NOT NULL DEFAULT now(),
  "updated_at" timestamp NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "permission_grant_scheme_idx"
  ON "permission_scheme_grants" ("scheme_id");
CREATE INDEX IF NOT EXISTS "permission_grant_permission_idx"
  ON "permission_scheme_grants" ("scheme_id", "permission_key");

CREATE TABLE IF NOT EXISTS "project_permission_schemes" (
  "id" text PRIMARY KEY NOT NULL,
  "project_id" text NOT NULL REFERENCES "projects"("id") ON DELETE CASCADE,
  "scheme_id" text NOT NULL REFERENCES "permission_schemes"("id") ON DELETE CASCADE,
  "created_at" timestamp NOT NULL DEFAULT now(),
  "updated_at" timestamp NOT NULL DEFAULT now(),
  "created_by" text NOT NULL REFERENCES "users"("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "project_permission_scheme_project_idx"
  ON "project_permission_schemes" ("project_id");
CREATE INDEX IF NOT EXISTS "project_permission_scheme_scheme_idx"
  ON "project_permission_schemes" ("scheme_id");

CREATE TABLE IF NOT EXISTS "user_capacity" (
  "id" text PRIMARY KEY NOT NULL,
  "user_id" text NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "organization_id" text NOT NULL REFERENCES "organizations"("id") ON DELETE CASCADE,
  "weekly_hours" integer NOT NULL DEFAULT 40,
  "daily_hours" integer NOT NULL DEFAULT 8,
  "working_days" jsonb NOT NULL DEFAULT '["monday","tuesday","wednesday","thursday","friday"]'::jsonb,
  "working_hours" jsonb DEFAULT '{"start":"09:00","end":"17:00"}'::jsonb,
  "timezone" text NOT NULL DEFAULT 'UTC',
  "dedicated_project_ids" jsonb DEFAULT '[]'::jsonb,
  "allocation_percentage" jsonb DEFAULT '{}'::jsonb,
  "skills" jsonb DEFAULT '[]'::jsonb,
  "skill_levels" jsonb DEFAULT '{}'::jsonb,
  "is_available" boolean NOT NULL DEFAULT true,
  "unavailable_until" timestamp,
  "unavailable_reason" text,
  "created_at" timestamp NOT NULL DEFAULT now(),
  "updated_at" timestamp NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "user_capacity_user_idx"
  ON "user_capacity" ("user_id");
CREATE INDEX IF NOT EXISTS "user_capacity_org_idx"
  ON "user_capacity" ("organization_id");

CREATE TABLE IF NOT EXISTS "workload_snapshots" (
  "id" text PRIMARY KEY NOT NULL,
  "user_id" text NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "snapshot_date" timestamp NOT NULL,
  "assigned_issues" integer NOT NULL DEFAULT 0,
  "total_estimated_hours" numeric(10, 2) DEFAULT '0',
  "total_actual_hours" numeric(10, 2) DEFAULT '0',
  "available_hours" numeric(10, 2) NOT NULL,
  "allocated_hours" numeric(10, 2) NOT NULL,
  "utilization_percentage" integer NOT NULL,
  "issues_by_priority" jsonb DEFAULT '{}'::jsonb,
  "issues_by_project" jsonb DEFAULT '{}'::jsonb,
  "is_overloaded" boolean NOT NULL DEFAULT false,
  "overload_reason" text,
  "created_at" timestamp NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "workload_snapshots_user_date_idx"
  ON "workload_snapshots" ("user_id", "snapshot_date");

CREATE TABLE IF NOT EXISTS "issue_estimations" (
  "id" text PRIMARY KEY NOT NULL,
  "issue_id" text NOT NULL UNIQUE REFERENCES "issues"("id") ON DELETE CASCADE,
  "original_estimate" integer,
  "remaining_estimate" integer,
  "time_spent" integer NOT NULL DEFAULT 0,
  "story_points" integer,
  "complexity" text,
  "complexity_score" integer,
  "effort_breakdown" jsonb DEFAULT '{}'::jsonb,
  "estimated_by" text REFERENCES "users"("id"),
  "estimated_at" timestamp,
  "estimation_confidence" integer,
  "auto_calculated" boolean NOT NULL DEFAULT false,
  "calculation_model" text,
  "created_at" timestamp NOT NULL DEFAULT now(),
  "updated_at" timestamp NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "issue_estimations_issue_idx"
  ON "issue_estimations" ("issue_id");

CREATE TABLE IF NOT EXISTS "team_allocations" (
  "id" text PRIMARY KEY NOT NULL,
  "project_id" text NOT NULL REFERENCES "projects"("id") ON DELETE CASCADE,
  "user_id" text NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "role" text NOT NULL,
  "allocation_percentage" integer NOT NULL,
  "hours_per_week" numeric(10, 2),
  "start_date" timestamp NOT NULL,
  "end_date" timestamp,
  "is_active" boolean NOT NULL DEFAULT true,
  "notes" text,
  "created_by" text NOT NULL REFERENCES "users"("id"),
  "created_at" timestamp NOT NULL DEFAULT now(),
  "updated_at" timestamp NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "team_allocations_project_idx"
  ON "team_allocations" ("project_id");
CREATE INDEX IF NOT EXISTS "team_allocations_user_idx"
  ON "team_allocations" ("user_id");

CREATE TABLE IF NOT EXISTS "capacity_forecasts" (
  "id" text PRIMARY KEY NOT NULL,
  "organization_id" text NOT NULL REFERENCES "organizations"("id") ON DELETE CASCADE,
  "forecast_date" timestamp NOT NULL,
  "week_number" integer NOT NULL,
  "year" integer NOT NULL,
  "total_team_members" integer NOT NULL,
  "available_hours" numeric(10, 2) NOT NULL,
  "allocated_hours" numeric(10, 2) NOT NULL,
  "remaining_capacity" numeric(10, 2) NOT NULL,
  "project_forecasts" jsonb DEFAULT '[]'::jsonb,
  "is_over_capacity" boolean NOT NULL DEFAULT false,
  "capacity_risk" text,
  "risk_reasons" jsonb DEFAULT '[]'::jsonb,
  "predicted_velocity" numeric(10, 2),
  "confidence_score" integer,
  "created_at" timestamp NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "capacity_forecasts_org_date_idx"
  ON "capacity_forecasts" ("organization_id", "forecast_date");

CREATE TABLE IF NOT EXISTS "smart_assignment_rules" (
  "id" text PRIMARY KEY NOT NULL,
  "organization_id" text NOT NULL REFERENCES "organizations"("id") ON DELETE CASCADE,
  "project_id" text REFERENCES "projects"("id") ON DELETE CASCADE,
  "name" text NOT NULL,
  "description" text,
  "enabled" boolean NOT NULL DEFAULT true,
  "consider_workload" boolean NOT NULL DEFAULT true,
  "consider_skills" boolean NOT NULL DEFAULT true,
  "consider_timezone" boolean NOT NULL DEFAULT false,
  "consider_availability" boolean NOT NULL DEFAULT true,
  "consider_past_performance" boolean NOT NULL DEFAULT false,
  "max_assignments_per_day" integer DEFAULT 5,
  "max_workload_percentage" integer DEFAULT 100,
  "preferred_skill_level" integer DEFAULT 3,
  "weights" jsonb DEFAULT '{}'::jsonb,
  "fallback_assignee" text REFERENCES "users"("id"),
  "notify_on_auto_assign" boolean NOT NULL DEFAULT true,
  "created_by" text NOT NULL REFERENCES "users"("id"),
  "created_at" timestamp NOT NULL DEFAULT now(),
  "updated_at" timestamp NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "smart_assignment_rules_org_idx"
  ON "smart_assignment_rules" ("organization_id");
CREATE INDEX IF NOT EXISTS "smart_assignment_rules_project_idx"
  ON "smart_assignment_rules" ("project_id");

CREATE TABLE IF NOT EXISTS "semantic_search_history" (
  "id" text PRIMARY KEY NOT NULL,
  "user_id" text NOT NULL,
  "organization_id" text NOT NULL,
  "query" text NOT NULL,
  "query_embedding" vector(1536),
  "filters" jsonb DEFAULT '{}'::jsonb,
  "limit" integer DEFAULT 20,
  "similarity_threshold" integer DEFAULT 70,
  "results_count" integer NOT NULL,
  "top_results" jsonb DEFAULT '[]'::jsonb,
  "execution_time_ms" integer,
  "clicked_result_id" text,
  "was_helpful" boolean,
  "created_at" timestamp NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "semantic_search_history_user_idx"
  ON "semantic_search_history" ("user_id");
CREATE INDEX IF NOT EXISTS "semantic_search_history_org_created_idx"
  ON "semantic_search_history" ("organization_id", "created_at");

CREATE TABLE IF NOT EXISTS "search_suggestions" (
  "id" text PRIMARY KEY NOT NULL,
  "suggestion" text NOT NULL UNIQUE,
  "category" text,
  "usage_count" integer NOT NULL DEFAULT 0,
  "last_used" timestamp,
  "embedding" vector(1536),
  "created_at" timestamp NOT NULL DEFAULT now(),
  "updated_at" timestamp NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "search_suggestions_category_idx"
  ON "search_suggestions" ("category");
