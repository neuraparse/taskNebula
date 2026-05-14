-- SAML 2.0 SSO + SCIM 2.0 scaffolding (Roadmap task #17).
--
-- `sso_configs`  — one IdP configuration per workspace (organization).
-- `scim_tokens`  — bearer tokens used by IdP SCIM provisioning agents.
--
-- Both tables cascade-delete with the owning organization so that removing
-- a workspace fully detaches its SSO/SCIM footprint.

CREATE TABLE IF NOT EXISTS "sso_configs" (
  "id" text PRIMARY KEY NOT NULL,
  "workspace_id" text NOT NULL,
  "provider" text NOT NULL,
  "entry_point_url" text NOT NULL,
  "issuer" text NOT NULL,
  "cert" text NOT NULL,
  "private_key" text,
  "audience" text NOT NULL,
  "attribute_map" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "enabled" boolean DEFAULT false NOT NULL,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL
);

DO $$ BEGIN
  ALTER TABLE "sso_configs"
    ADD CONSTRAINT "sso_configs_workspace_id_organizations_id_fk"
    FOREIGN KEY ("workspace_id") REFERENCES "organizations"("id")
    ON DELETE CASCADE ON UPDATE NO ACTION;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS "sso_configs_workspace_idx"
  ON "sso_configs" USING btree ("workspace_id");

CREATE TABLE IF NOT EXISTS "scim_tokens" (
  "id" text PRIMARY KEY NOT NULL,
  "workspace_id" text NOT NULL,
  "token_hash" text NOT NULL,
  "name" text NOT NULL,
  "scopes" text[] DEFAULT '{}'::text[] NOT NULL,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "last_used_at" timestamp,
  "revoked_at" timestamp,
  CONSTRAINT "scim_tokens_token_hash_unique" UNIQUE ("token_hash")
);

DO $$ BEGIN
  ALTER TABLE "scim_tokens"
    ADD CONSTRAINT "scim_tokens_workspace_id_organizations_id_fk"
    FOREIGN KEY ("workspace_id") REFERENCES "organizations"("id")
    ON DELETE CASCADE ON UPDATE NO ACTION;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

CREATE INDEX IF NOT EXISTS "scim_tokens_workspace_idx"
  ON "scim_tokens" USING btree ("workspace_id");

CREATE UNIQUE INDEX IF NOT EXISTS "scim_tokens_token_hash_idx"
  ON "scim_tokens" USING btree ("token_hash");
