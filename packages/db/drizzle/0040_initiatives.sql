-- Initiatives sit ABOVE projects in the planning hierarchy and can nest
-- (sub-initiatives) up to 5 levels deep. Depth is enforced in the API layer.
--
-- Three new tables:
--   * initiatives             — the entity itself (self-referencing)
--   * initiative_projects     — M:N junction with projects
--   * initiative_updates      — weekly status posts attached to an initiative

DO $$ BEGIN
  CREATE TYPE "initiative_status" AS ENUM (
    'planned',
    'active',
    'paused',
    'complete',
    'cancelled'
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS "initiatives" (
  "id" text PRIMARY KEY NOT NULL,
  "workspace_id" text NOT NULL,
  "parent_initiative_id" text,
  "name" text NOT NULL,
  "slug" text NOT NULL,
  "description" text,
  "status" "initiative_status" NOT NULL DEFAULT 'planned',
  "owner_user_id" text,
  "target_date" date,
  "color" text,
  "sort_order" integer NOT NULL DEFAULT 0,
  "created_at" timestamp NOT NULL DEFAULT now(),
  "updated_at" timestamp NOT NULL DEFAULT now(),
  "created_by" text,
  "updated_by" text
);

DO $$ BEGIN
  ALTER TABLE "initiatives"
    ADD CONSTRAINT "initiatives_workspace_id_organizations_id_fk"
    FOREIGN KEY ("workspace_id") REFERENCES "organizations"("id")
    ON DELETE CASCADE ON UPDATE NO ACTION;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "initiatives"
    ADD CONSTRAINT "initiatives_parent_initiative_id_initiatives_id_fk"
    FOREIGN KEY ("parent_initiative_id") REFERENCES "initiatives"("id")
    ON DELETE CASCADE ON UPDATE NO ACTION;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "initiatives"
    ADD CONSTRAINT "initiatives_owner_user_id_users_id_fk"
    FOREIGN KEY ("owner_user_id") REFERENCES "users"("id")
    ON DELETE SET NULL ON UPDATE NO ACTION;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "initiatives"
    ADD CONSTRAINT "initiatives_created_by_users_id_fk"
    FOREIGN KEY ("created_by") REFERENCES "users"("id")
    ON DELETE SET NULL ON UPDATE NO ACTION;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "initiatives"
    ADD CONSTRAINT "initiatives_updated_by_users_id_fk"
    FOREIGN KEY ("updated_by") REFERENCES "users"("id")
    ON DELETE SET NULL ON UPDATE NO ACTION;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS "initiative_workspace_slug_idx"
  ON "initiatives" USING btree ("workspace_id", "slug");
CREATE INDEX IF NOT EXISTS "initiative_workspace_idx"
  ON "initiatives" USING btree ("workspace_id");
CREATE INDEX IF NOT EXISTS "initiative_parent_idx"
  ON "initiatives" USING btree ("parent_initiative_id");
CREATE INDEX IF NOT EXISTS "initiative_status_idx"
  ON "initiatives" USING btree ("status");

-- Junction: initiative <-> project
CREATE TABLE IF NOT EXISTS "initiative_projects" (
  "initiative_id" text NOT NULL,
  "project_id" text NOT NULL,
  "created_at" timestamp NOT NULL DEFAULT now(),
  CONSTRAINT "initiative_projects_initiative_id_project_id_pk"
    PRIMARY KEY ("initiative_id", "project_id")
);

DO $$ BEGIN
  ALTER TABLE "initiative_projects"
    ADD CONSTRAINT "initiative_projects_initiative_id_initiatives_id_fk"
    FOREIGN KEY ("initiative_id") REFERENCES "initiatives"("id")
    ON DELETE CASCADE ON UPDATE NO ACTION;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "initiative_projects"
    ADD CONSTRAINT "initiative_projects_project_id_projects_id_fk"
    FOREIGN KEY ("project_id") REFERENCES "projects"("id")
    ON DELETE CASCADE ON UPDATE NO ACTION;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

CREATE INDEX IF NOT EXISTS "initiative_projects_project_idx"
  ON "initiative_projects" USING btree ("project_id");

-- Weekly update posts
CREATE TABLE IF NOT EXISTS "initiative_updates" (
  "id" text PRIMARY KEY NOT NULL,
  "initiative_id" text NOT NULL,
  "author_id" text,
  "status" text NOT NULL,
  "summary" text NOT NULL,
  "blockers" text,
  "next_steps" text,
  "week_of" date NOT NULL,
  "created_at" timestamp NOT NULL DEFAULT now()
);

DO $$ BEGIN
  ALTER TABLE "initiative_updates"
    ADD CONSTRAINT "initiative_updates_initiative_id_initiatives_id_fk"
    FOREIGN KEY ("initiative_id") REFERENCES "initiatives"("id")
    ON DELETE CASCADE ON UPDATE NO ACTION;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "initiative_updates"
    ADD CONSTRAINT "initiative_updates_author_id_users_id_fk"
    FOREIGN KEY ("author_id") REFERENCES "users"("id")
    ON DELETE SET NULL ON UPDATE NO ACTION;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

CREATE INDEX IF NOT EXISTS "initiative_updates_initiative_idx"
  ON "initiative_updates" USING btree ("initiative_id");
CREATE INDEX IF NOT EXISTS "initiative_updates_week_idx"
  ON "initiative_updates" USING btree ("week_of");
