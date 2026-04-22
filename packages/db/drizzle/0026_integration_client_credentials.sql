-- Integration client credentials: platform-level OAuth client id / secret for
-- each third-party integration provider (slack, gitlab, jira, github, google,
-- ...). Secrets are stored as encrypted AES-256-GCM envelopes in JSONB. One
-- row per provider — env vars still work as a fallback for providers without
-- a DB row.

CREATE TABLE IF NOT EXISTS "integration_client_credentials" (
  "id" text PRIMARY KEY NOT NULL,
  "provider" text NOT NULL,
  "client_id_enc" jsonb,
  "client_secret_enc" jsonb,
  "redirect_uri" text,
  "scope" text,
  "metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "updated_by" text,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL
);

DO $$ BEGIN
  ALTER TABLE "integration_client_credentials"
    ADD CONSTRAINT "integration_client_credentials_updated_by_users_id_fk"
    FOREIGN KEY ("updated_by") REFERENCES "users"("id")
    ON DELETE SET NULL ON UPDATE NO ACTION;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS "integration_client_credentials_provider_idx"
  ON "integration_client_credentials" USING btree ("provider");
