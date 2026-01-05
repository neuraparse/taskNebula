CREATE TYPE "public"."email_template_type" AS ENUM('issue_assigned', 'issue_mentioned', 'issue_commented', 'issue_status_changed', 'issue_created', 'sprint_started', 'sprint_completed', 'daily_digest', 'weekly_digest');--> statement-breakpoint
CREATE TYPE "public"."digest_frequency" AS ENUM('none', 'daily', 'weekly');--> statement-breakpoint
CREATE TYPE "public"."notification_channel" AS ENUM('in_app', 'email', 'digest');--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "watchers" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"issue_id" text,
	"project_id" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "unique_issue_watch" UNIQUE("user_id","issue_id"),
	CONSTRAINT "unique_project_watch" UNIQUE("user_id","project_id")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "email_templates" (
	"id" text PRIMARY KEY NOT NULL,
	"organization_id" text,
	"type" "email_template_type" NOT NULL,
	"name" text NOT NULL,
	"subject" text NOT NULL,
	"html_body" text NOT NULL,
	"text_body" text NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"is_default" boolean DEFAULT false NOT NULL,
	"created_by" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "notification_preferences" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"organization_id" text NOT NULL,
	"enable_in_app" boolean DEFAULT true NOT NULL,
	"enable_email" boolean DEFAULT true NOT NULL,
	"digest_frequency" "digest_frequency" DEFAULT 'none' NOT NULL,
	"email_on_assigned" boolean DEFAULT true NOT NULL,
	"email_on_mentioned" boolean DEFAULT true NOT NULL,
	"email_on_commented" boolean DEFAULT true NOT NULL,
	"email_on_status_changed" boolean DEFAULT false NOT NULL,
	"email_on_issue_created" boolean DEFAULT false NOT NULL,
	"email_on_sprint_started" boolean DEFAULT false NOT NULL,
	"email_on_sprint_completed" boolean DEFAULT false NOT NULL,
	"in_app_on_assigned" boolean DEFAULT true NOT NULL,
	"in_app_on_mentioned" boolean DEFAULT true NOT NULL,
	"in_app_on_commented" boolean DEFAULT true NOT NULL,
	"in_app_on_status_changed" boolean DEFAULT true NOT NULL,
	"in_app_on_issue_created" boolean DEFAULT true NOT NULL,
	"in_app_on_sprint_started" boolean DEFAULT true NOT NULL,
	"in_app_on_sprint_completed" boolean DEFAULT true NOT NULL,
	"do_not_disturb" boolean DEFAULT false NOT NULL,
	"do_not_disturb_start" text,
	"do_not_disturb_end" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "watchers" ADD CONSTRAINT "watchers_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "watchers" ADD CONSTRAINT "watchers_issue_id_issues_id_fk" FOREIGN KEY ("issue_id") REFERENCES "public"."issues"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "watchers" ADD CONSTRAINT "watchers_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "email_templates" ADD CONSTRAINT "email_templates_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "email_templates" ADD CONSTRAINT "email_templates_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "notification_preferences" ADD CONSTRAINT "notification_preferences_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "notification_preferences" ADD CONSTRAINT "notification_preferences_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
