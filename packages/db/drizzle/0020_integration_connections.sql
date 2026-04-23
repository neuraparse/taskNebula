-- Integration connections: shared OAuth connection table for third-party
-- integrations (Slack, GitLab, Jira, etc.). Tokens are stored as encrypted
-- AES-256-GCM envelopes in JSONB columns. Unique on (organization, provider)
-- so there is at most one active connection per org per provider.

CREATE TABLE IF NOT EXISTS "integration_connections" (
  "id" text PRIMARY KEY NOT NULL,
  "organization_id" text NOT NULL,
  "provider" text NOT NULL,
  "external_account_id" text,
  "external_account_label" text,
  "access_token_enc" jsonb,
  "refresh_token_enc" jsonb,
  "scope" text,
  "metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "connected_by_id" text,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL
);

DO $$ BEGIN
  ALTER TABLE "integration_connections"
    ADD CONSTRAINT "integration_connections_organization_id_organizations_id_fk"
    FOREIGN KEY ("organization_id") REFERENCES "organizations"("id")
    ON DELETE CASCADE ON UPDATE NO ACTION;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "integration_connections"
    ADD CONSTRAINT "integration_connections_connected_by_id_users_id_fk"
    FOREIGN KEY ("connected_by_id") REFERENCES "users"("id")
    ON DELETE NO ACTION ON UPDATE NO ACTION;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS "integration_connections_org_provider_idx"
  ON "integration_connections" USING btree ("organization_id", "provider");

CREATE INDEX IF NOT EXISTS "integration_connections_organization_idx"
  ON "integration_connections" USING btree ("organization_id");

CREATE INDEX IF NOT EXISTS "integration_connections_provider_idx"
  ON "integration_connections" USING btree ("provider");
