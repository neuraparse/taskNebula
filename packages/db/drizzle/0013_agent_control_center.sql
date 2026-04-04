CREATE TYPE "agent_run_kind" AS ENUM (
  'project_tracking',
  'backlog_triage',
  'sprint_planning',
  'bulk_sprint_creation'
);

CREATE TYPE "agent_run_status" AS ENUM (
  'pending',
  'running',
  'completed',
  'failed',
  'cancelled'
);

CREATE TYPE "agent_execution_mode" AS ENUM (
  'manual',
  'assistive',
  'auto'
);

ALTER TYPE "audit_log_action" ADD VALUE IF NOT EXISTS 'agent.config_updated';
ALTER TYPE "audit_log_action" ADD VALUE IF NOT EXISTS 'agent.run_requested';
ALTER TYPE "audit_log_action" ADD VALUE IF NOT EXISTS 'agent.run_completed';
ALTER TYPE "audit_log_action" ADD VALUE IF NOT EXISTS 'agent.run_failed';

CREATE TABLE IF NOT EXISTS "agent_runs" (
  "id" text PRIMARY KEY NOT NULL,
  "organization_id" text NOT NULL,
  "project_id" text,
  "initiated_by" text NOT NULL,
  "kind" "agent_run_kind" NOT NULL,
  "status" "agent_run_status" DEFAULT 'pending' NOT NULL,
  "mode" "agent_execution_mode" DEFAULT 'manual' NOT NULL,
  "dry_run" boolean DEFAULT false NOT NULL,
  "summary" text,
  "write_actions_count" integer DEFAULT 0 NOT NULL,
  "input" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "output" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "logs" jsonb DEFAULT '[]'::jsonb NOT NULL,
  "error" text,
  "started_at" timestamp DEFAULT now() NOT NULL,
  "completed_at" timestamp,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL
);

DO $$
BEGIN
  ALTER TABLE "agent_runs"
    ADD CONSTRAINT "agent_runs_organization_id_organizations_id_fk"
    FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TABLE "agent_runs"
    ADD CONSTRAINT "agent_runs_project_id_projects_id_fk"
    FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TABLE "agent_runs"
    ADD CONSTRAINT "agent_runs_initiated_by_users_id_fk"
    FOREIGN KEY ("initiated_by") REFERENCES "users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

CREATE INDEX IF NOT EXISTS "agent_run_organization_idx" ON "agent_runs" USING btree ("organization_id");
CREATE INDEX IF NOT EXISTS "agent_run_project_idx" ON "agent_runs" USING btree ("project_id");
CREATE INDEX IF NOT EXISTS "agent_run_status_idx" ON "agent_runs" USING btree ("status");
CREATE INDEX IF NOT EXISTS "agent_run_kind_idx" ON "agent_runs" USING btree ("kind");
CREATE INDEX IF NOT EXISTS "agent_run_created_at_idx" ON "agent_runs" USING btree ("created_at");
CREATE INDEX IF NOT EXISTS "agent_run_project_created_at_idx" ON "agent_runs" USING btree ("project_id", "created_at");
