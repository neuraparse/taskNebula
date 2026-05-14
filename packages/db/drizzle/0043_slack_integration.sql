-- Slack integration auxiliary tables.
--
-- The OAuth connection for Slack lives in `integration_connections` (provider
-- = 'slack'). These two tables complement it:
--
--   * slack_channel_routes — maps a Slack channel to a TaskNebula project,
--     used by the "create issue from message" action, slash commands without
--     an explicit project, and the emoji-triage reaction handler.
--   * slack_message_links  — bidirectional mapping between a Slack message /
--     bot reply thread and the issue it spawned, so subsequent comments and
--     status changes can mirror back into the same Slack thread.

CREATE TABLE IF NOT EXISTS "slack_channel_routes" (
  "id" text PRIMARY KEY NOT NULL,
  "organization_id" text NOT NULL,
  "slack_team_id" varchar(32) NOT NULL,
  "slack_channel_id" varchar(32) NOT NULL,
  "slack_channel_name" varchar(80),
  "project_id" text NOT NULL,
  "default_label" varchar(80),
  "emoji_trigger" varchar(64),
  "default_priority" varchar(16) DEFAULT 'medium' NOT NULL,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL
);

DO $$ BEGIN
  ALTER TABLE "slack_channel_routes"
    ADD CONSTRAINT "slack_channel_routes_organization_id_organizations_id_fk"
    FOREIGN KEY ("organization_id") REFERENCES "organizations"("id")
    ON DELETE CASCADE ON UPDATE NO ACTION;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "slack_channel_routes"
    ADD CONSTRAINT "slack_channel_routes_project_id_projects_id_fk"
    FOREIGN KEY ("project_id") REFERENCES "projects"("id")
    ON DELETE CASCADE ON UPDATE NO ACTION;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS "slack_channel_route_org_channel_idx"
  ON "slack_channel_routes" ("organization_id", "slack_team_id", "slack_channel_id");

CREATE INDEX IF NOT EXISTS "slack_channel_route_organization_idx"
  ON "slack_channel_routes" ("organization_id");

CREATE INDEX IF NOT EXISTS "slack_channel_route_project_idx"
  ON "slack_channel_routes" ("project_id");

CREATE INDEX IF NOT EXISTS "slack_channel_route_team_channel_idx"
  ON "slack_channel_routes" ("slack_team_id", "slack_channel_id");

-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS "slack_message_links" (
  "id" text PRIMARY KEY NOT NULL,
  "organization_id" text NOT NULL,
  "slack_team_id" varchar(32) NOT NULL,
  "slack_channel_id" varchar(32) NOT NULL,
  "slack_message_ts" varchar(64) NOT NULL,
  "slack_thread_ts" varchar(64),
  "issue_id" text NOT NULL,
  "permalink" text,
  "created_at" timestamp DEFAULT now() NOT NULL
);

DO $$ BEGIN
  ALTER TABLE "slack_message_links"
    ADD CONSTRAINT "slack_message_links_organization_id_organizations_id_fk"
    FOREIGN KEY ("organization_id") REFERENCES "organizations"("id")
    ON DELETE CASCADE ON UPDATE NO ACTION;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "slack_message_links"
    ADD CONSTRAINT "slack_message_links_issue_id_issues_id_fk"
    FOREIGN KEY ("issue_id") REFERENCES "issues"("id")
    ON DELETE CASCADE ON UPDATE NO ACTION;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS "slack_message_link_team_channel_message_idx"
  ON "slack_message_links" ("slack_team_id", "slack_channel_id", "slack_message_ts");

CREATE INDEX IF NOT EXISTS "slack_message_link_issue_idx"
  ON "slack_message_links" ("issue_id");

CREATE INDEX IF NOT EXISTS "slack_message_link_organization_idx"
  ON "slack_message_links" ("organization_id");
