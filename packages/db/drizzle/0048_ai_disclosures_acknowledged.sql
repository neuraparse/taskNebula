-- EU AI Act Article 50 disclosure acknowledgement ledger.
-- Records the first time each (workspace, user) sees the AI involvement
-- modal and accepts the disclosure copy. Bumping `version` re-prompts every
-- user. Enforcement begins 2026-08-02.

CREATE TABLE IF NOT EXISTS "ai_disclosures_acknowledged" (
  "id" text PRIMARY KEY NOT NULL,
  "workspace_id" text NOT NULL,
  "user_id" text NOT NULL,
  "version" varchar(32) NOT NULL,
  "acknowledged_at" timestamp DEFAULT now() NOT NULL,
  "created_at" timestamp DEFAULT now() NOT NULL
);

DO $$ BEGIN
  ALTER TABLE "ai_disclosures_acknowledged"
    ADD CONSTRAINT "ai_disclosures_workspace_id_organizations_id_fk"
    FOREIGN KEY ("workspace_id") REFERENCES "organizations"("id")
    ON DELETE CASCADE ON UPDATE NO ACTION;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "ai_disclosures_acknowledged"
    ADD CONSTRAINT "ai_disclosures_user_id_users_id_fk"
    FOREIGN KEY ("user_id") REFERENCES "users"("id")
    ON DELETE CASCADE ON UPDATE NO ACTION;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS "ai_disclosures_workspace_user_version_idx"
  ON "ai_disclosures_acknowledged" USING btree
  ("workspace_id", "user_id", "version");

CREATE INDEX IF NOT EXISTS "ai_disclosures_workspace_idx"
  ON "ai_disclosures_acknowledged" USING btree ("workspace_id");

CREATE INDEX IF NOT EXISTS "ai_disclosures_user_idx"
  ON "ai_disclosures_acknowledged" USING btree ("user_id");
