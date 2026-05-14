-- Linear Agent Protocol parity (P0-04).
--
-- 1. Adds the `agent_sessions` table — one row per dispatched agent run on an
--    issue, with state machine (`pending` -> `active`/`awaitingInput` ->
--    `complete`/`error`/`stale`) and a per-session HMAC secret for reply-webhook
--    verification.
-- 2. Adds the `agent_providers` table — per-workspace (organization) provider
--    config: webhook endpoint URL, optional FK to the encrypted client
--    credentials envelope, and the shared HMAC secret used to sign outbound
--    dispatch payloads / verify inbound session-event posts.
-- 3. Adds `is_agent` and `agent_provider` columns to `users` so virtual agent
--    users (@claude, @cursor, @devin, @copilot) appear in the assignee picker
--    like humans.

-- --- enums -----------------------------------------------------------------

DO $$ BEGIN
  CREATE TYPE "agent_session_state" AS ENUM (
    'pending',
    'active',
    'awaitingInput',
    'error',
    'complete',
    'stale'
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "agent_session_provider" AS ENUM (
    'claude',
    'cursor',
    'devin',
    'copilot',
    'openhands',
    'custom'
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- --- agent_sessions --------------------------------------------------------

CREATE TABLE IF NOT EXISTS "agent_sessions" (
  "id" text PRIMARY KEY NOT NULL,
  "issue_id" text NOT NULL,
  "provider" "agent_session_provider" NOT NULL,
  "external_id" text,
  "state" "agent_session_state" DEFAULT 'pending' NOT NULL,
  "signed_secret" text NOT NULL,
  "payload" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "started_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL,
  "finished_at" timestamp
);

DO $$ BEGIN
  ALTER TABLE "agent_sessions"
    ADD CONSTRAINT "agent_sessions_issue_id_issues_id_fk"
    FOREIGN KEY ("issue_id") REFERENCES "issues"("id")
    ON DELETE CASCADE ON UPDATE NO ACTION;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

CREATE INDEX IF NOT EXISTS "agent_session_issue_idx"
  ON "agent_sessions" USING btree ("issue_id");
CREATE INDEX IF NOT EXISTS "agent_session_state_idx"
  ON "agent_sessions" USING btree ("state");
CREATE INDEX IF NOT EXISTS "agent_session_provider_idx"
  ON "agent_sessions" USING btree ("provider");
CREATE INDEX IF NOT EXISTS "agent_session_issue_state_idx"
  ON "agent_sessions" USING btree ("issue_id", "state");

-- --- agent_providers -------------------------------------------------------

CREATE TABLE IF NOT EXISTS "agent_providers" (
  "id" text PRIMARY KEY NOT NULL,
  "workspace_id" text NOT NULL,
  "provider" "agent_session_provider" NOT NULL,
  "credentials_ref" text,
  "endpoint_url" text NOT NULL,
  "hmac_secret" text NOT NULL,
  "enabled" boolean DEFAULT true NOT NULL,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL
);

DO $$ BEGIN
  ALTER TABLE "agent_providers"
    ADD CONSTRAINT "agent_providers_workspace_id_organizations_id_fk"
    FOREIGN KEY ("workspace_id") REFERENCES "organizations"("id")
    ON DELETE CASCADE ON UPDATE NO ACTION;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "agent_providers"
    ADD CONSTRAINT "agent_providers_credentials_ref_integration_client_credentials_id_fk"
    FOREIGN KEY ("credentials_ref") REFERENCES "integration_client_credentials"("id")
    ON DELETE SET NULL ON UPDATE NO ACTION;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS "agent_provider_workspace_provider_idx"
  ON "agent_providers" USING btree ("workspace_id", "provider");
CREATE INDEX IF NOT EXISTS "agent_provider_workspace_idx"
  ON "agent_providers" USING btree ("workspace_id");

-- --- users.is_agent / users.agent_provider --------------------------------

ALTER TABLE "users"
  ADD COLUMN IF NOT EXISTS "is_agent" boolean DEFAULT false NOT NULL;

ALTER TABLE "users"
  ADD COLUMN IF NOT EXISTS "agent_provider" text;
