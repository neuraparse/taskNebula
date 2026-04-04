DO $$
BEGIN
  CREATE TYPE "agent_provider" AS ENUM (
    'native',
    'openai',
    'anthropic',
    'azure',
    'custom'
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

ALTER TYPE "audit_log_action" ADD VALUE IF NOT EXISTS 'agent.model_config_created';
ALTER TYPE "audit_log_action" ADD VALUE IF NOT EXISTS 'agent.model_config_updated';
ALTER TYPE "audit_log_action" ADD VALUE IF NOT EXISTS 'agent.model_config_archived';

CREATE TABLE IF NOT EXISTS "agent_model_configs" (
  "id" text PRIMARY KEY NOT NULL,
  "organization_id" text NOT NULL,
  "name" varchar(120) NOT NULL,
  "provider" "agent_provider" NOT NULL,
  "model" varchar(255) NOT NULL,
  "description" text,
  "settings" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "is_default" boolean DEFAULT false NOT NULL,
  "is_archived" boolean DEFAULT false NOT NULL,
  "created_by" text NOT NULL,
  "updated_by" text NOT NULL,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "agent_model_config_revisions" (
  "id" text PRIMARY KEY NOT NULL,
  "config_id" text NOT NULL,
  "organization_id" text NOT NULL,
  "revision" integer NOT NULL,
  "snapshot" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "changed_by" text NOT NULL,
  "created_at" timestamp DEFAULT now() NOT NULL
);

DO $$
BEGIN
  ALTER TABLE "agent_model_configs"
    ADD CONSTRAINT "agent_model_configs_organization_id_organizations_id_fk"
    FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TABLE "agent_model_configs"
    ADD CONSTRAINT "agent_model_configs_created_by_users_id_fk"
    FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TABLE "agent_model_configs"
    ADD CONSTRAINT "agent_model_configs_updated_by_users_id_fk"
    FOREIGN KEY ("updated_by") REFERENCES "users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TABLE "agent_model_config_revisions"
    ADD CONSTRAINT "agent_model_config_revisions_config_id_agent_model_configs_id_fk"
    FOREIGN KEY ("config_id") REFERENCES "agent_model_configs"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TABLE "agent_model_config_revisions"
    ADD CONSTRAINT "agent_model_config_revisions_organization_id_organizations_id_fk"
    FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TABLE "agent_model_config_revisions"
    ADD CONSTRAINT "agent_model_config_revisions_changed_by_users_id_fk"
    FOREIGN KEY ("changed_by") REFERENCES "users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

CREATE INDEX IF NOT EXISTS "agent_model_config_organization_idx" ON "agent_model_configs" USING btree ("organization_id");
CREATE INDEX IF NOT EXISTS "agent_model_config_provider_idx" ON "agent_model_configs" USING btree ("provider");
CREATE INDEX IF NOT EXISTS "agent_model_config_default_idx" ON "agent_model_configs" USING btree ("organization_id", "is_default");
CREATE INDEX IF NOT EXISTS "agent_model_config_active_idx" ON "agent_model_configs" USING btree ("organization_id", "is_archived");
CREATE UNIQUE INDEX IF NOT EXISTS "agent_model_config_org_name_idx" ON "agent_model_configs" USING btree ("organization_id", "name");
CREATE INDEX IF NOT EXISTS "agent_model_config_revision_config_idx" ON "agent_model_config_revisions" USING btree ("config_id");
CREATE INDEX IF NOT EXISTS "agent_model_config_revision_org_idx" ON "agent_model_config_revisions" USING btree ("organization_id");
CREATE UNIQUE INDEX IF NOT EXISTS "agent_model_config_revision_unique_idx" ON "agent_model_config_revisions" USING btree ("config_id", "revision");
