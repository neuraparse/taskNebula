-- Audit log sinks — SIEM streaming destinations per workspace.
-- See packages/db/src/schema/audit-log-sinks.ts for type definitions.

DO $$ BEGIN
  CREATE TYPE "audit_log_sink_type" AS ENUM ('webhook', 'splunk_hec', 'datadog', 's3');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

CREATE TABLE IF NOT EXISTS "audit_log_sinks" (
  "id" text PRIMARY KEY NOT NULL,
  "workspace_id" text NOT NULL,
  "type" "audit_log_sink_type" NOT NULL,
  "name" text NOT NULL,
  "config" jsonb NOT NULL DEFAULT '{}'::jsonb,
  "enabled" boolean NOT NULL DEFAULT true,
  "signing_secret" text NOT NULL,
  "last_delivery_at" timestamp,
  "last_error" text,
  "success_count" text NOT NULL DEFAULT '0',
  "failure_count" text NOT NULL DEFAULT '0',
  "created_by" text NOT NULL,
  "created_at" timestamp NOT NULL DEFAULT now(),
  "updated_at" timestamp NOT NULL DEFAULT now()
);

DO $$ BEGIN
  ALTER TABLE "audit_log_sinks"
    ADD CONSTRAINT "audit_log_sinks_workspace_id_organizations_id_fk"
    FOREIGN KEY ("workspace_id") REFERENCES "organizations"("id")
    ON DELETE cascade ON UPDATE no action;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE "audit_log_sinks"
    ADD CONSTRAINT "audit_log_sinks_created_by_users_id_fk"
    FOREIGN KEY ("created_by") REFERENCES "users"("id")
    ON DELETE cascade ON UPDATE no action;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

CREATE INDEX IF NOT EXISTS "audit_log_sink_workspace_idx"
  ON "audit_log_sinks" ("workspace_id");
CREATE INDEX IF NOT EXISTS "audit_log_sink_enabled_idx"
  ON "audit_log_sinks" ("enabled");
CREATE INDEX IF NOT EXISTS "audit_log_sink_workspace_enabled_idx"
  ON "audit_log_sinks" ("workspace_id", "enabled");
