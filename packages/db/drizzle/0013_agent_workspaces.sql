-- Agent Workspaces: Docker containers for isolated agent execution
CREATE TABLE IF NOT EXISTS "agent_workspaces" (
	"id" text PRIMARY KEY NOT NULL,
	"issue_id" text NOT NULL,
	"project_id" text NOT NULL,
	"container_id" text,
	"container_name" text,
	"branch_name" text NOT NULL,
	"working_directory" text,
	"status" text DEFAULT 'setup_pending' NOT NULL,
	"setup_completed_at" timestamp,
	"error_message" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint

-- Agent Sessions: Link between workspace and agent execution
CREATE TABLE IF NOT EXISTS "agent_sessions" (
	"id" text PRIMARY KEY NOT NULL,
	"workspace_id" text NOT NULL,
	"executor_profile" text NOT NULL,
	"executor_variant" text DEFAULT 'DEFAULT',
	"mcp_config" jsonb DEFAULT '{}'::jsonb,
	"environment_variables" jsonb DEFAULT '{}'::jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint

-- Agent Execution Processes: Individual agent runs
CREATE TABLE IF NOT EXISTS "agent_execution_processes" (
	"id" text PRIMARY KEY NOT NULL,
	"session_id" text NOT NULL,
	"workspace_id" text NOT NULL,
	"run_reason" text NOT NULL,
	"status" text DEFAULT 'running' NOT NULL,
	"exit_code" integer,
	"started_at" timestamp DEFAULT now() NOT NULL,
	"completed_at" timestamp,
	"dropped" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint

-- Coding Agent Turns: Multi-turn conversations with AI agents
CREATE TABLE IF NOT EXISTS "coding_agent_turns" (
	"id" text PRIMARY KEY NOT NULL,
	"execution_process_id" text NOT NULL,
	"agent_session_id" text,
	"turn_number" integer NOT NULL,
	"initial_prompt" text NOT NULL,
	"assistant_summary" text,
	"files_changed" jsonb DEFAULT '[]'::jsonb,
	"tokens_used" integer DEFAULT 0,
	"cost_usd" numeric(10, 6) DEFAULT 0,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint

-- Agent Execution Logs: Streamed logs from agent executions
CREATE TABLE IF NOT EXISTS "agent_execution_logs" (
	"id" text PRIMARY KEY NOT NULL,
	"execution_process_id" text NOT NULL,
	"log_index" integer NOT NULL,
	"log_type" text DEFAULT 'stdout' NOT NULL,
	"content" text NOT NULL,
	"timestamp" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint

-- Executor Profiles: Configuration for different AI agents
CREATE TABLE IF NOT EXISTS "executor_profiles" (
	"id" text PRIMARY KEY NOT NULL,
	"executor" text NOT NULL,
	"variant" text DEFAULT 'DEFAULT' NOT NULL,
	"display_name" text NOT NULL,
	"description" text,
	"base_command" text NOT NULL,
	"extra_params" jsonb DEFAULT '[]'::jsonb,
	"env_vars" jsonb DEFAULT '{}'::jsonb,
	"mcp_config" jsonb DEFAULT '{}'::jsonb,
	"enabled" boolean DEFAULT true NOT NULL,
	"organization_id" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "executor_profiles_executor_variant_unique" UNIQUE("executor","variant")
);
--> statement-breakpoint

-- Foreign Keys
DO $$ BEGIN
 ALTER TABLE "agent_workspaces" ADD CONSTRAINT "agent_workspaces_issue_id_issues_id_fk" FOREIGN KEY ("issue_id") REFERENCES "public"."issues"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint

DO $$ BEGIN
 ALTER TABLE "agent_workspaces" ADD CONSTRAINT "agent_workspaces_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint

DO $$ BEGIN
 ALTER TABLE "agent_sessions" ADD CONSTRAINT "agent_sessions_workspace_id_agent_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."agent_workspaces"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint

DO $$ BEGIN
 ALTER TABLE "agent_execution_processes" ADD CONSTRAINT "agent_execution_processes_session_id_agent_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."agent_sessions"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint

DO $$ BEGIN
 ALTER TABLE "agent_execution_processes" ADD CONSTRAINT "agent_execution_processes_workspace_id_agent_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."agent_workspaces"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint

DO $$ BEGIN
 ALTER TABLE "coding_agent_turns" ADD CONSTRAINT "coding_agent_turns_execution_process_id_agent_execution_processes_id_fk" FOREIGN KEY ("execution_process_id") REFERENCES "public"."agent_execution_processes"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint

DO $$ BEGIN
 ALTER TABLE "agent_execution_logs" ADD CONSTRAINT "agent_execution_logs_execution_process_id_agent_execution_processes_id_fk" FOREIGN KEY ("execution_process_id") REFERENCES "public"."agent_execution_processes"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint

DO $$ BEGIN
 ALTER TABLE "executor_profiles" ADD CONSTRAINT "executor_profiles_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint

-- Indexes for performance
CREATE INDEX IF NOT EXISTS "agent_workspaces_issue_id_idx" ON "agent_workspaces" ("issue_id");
CREATE INDEX IF NOT EXISTS "agent_workspaces_status_idx" ON "agent_workspaces" ("status");
CREATE INDEX IF NOT EXISTS "agent_sessions_workspace_id_idx" ON "agent_sessions" ("workspace_id");
CREATE INDEX IF NOT EXISTS "agent_execution_processes_session_id_idx" ON "agent_execution_processes" ("session_id");
CREATE INDEX IF NOT EXISTS "agent_execution_processes_status_idx" ON "agent_execution_processes" ("status");
CREATE INDEX IF NOT EXISTS "coding_agent_turns_execution_process_id_idx" ON "coding_agent_turns" ("execution_process_id");
CREATE INDEX IF NOT EXISTS "agent_execution_logs_execution_process_id_idx" ON "agent_execution_logs" ("execution_process_id");
CREATE INDEX IF NOT EXISTS "agent_execution_logs_log_index_idx" ON "agent_execution_logs" ("log_index");
CREATE INDEX IF NOT EXISTS "executor_profiles_executor_idx" ON "executor_profiles" ("executor");
