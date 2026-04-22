-- Cross-device pinned items for the dashboard widget. Replaces the
-- client-only `tn:pinned-items:v1` localStorage cache. `kind` is plain text
-- (issue/doc/project/chat/custom) so new kinds don't require a migration.
-- `(user_id, href)` is unique so re-pinning the same target is idempotent.

CREATE TABLE IF NOT EXISTS "pinned_items" (
  "id" text PRIMARY KEY NOT NULL,
  "user_id" text NOT NULL,
  "kind" text NOT NULL,
  "entity_id" text,
  "title" text NOT NULL,
  "href" text NOT NULL,
  "pinned_at" timestamp DEFAULT now() NOT NULL
);

DO $$
BEGIN
  ALTER TABLE "pinned_items"
    ADD CONSTRAINT "pinned_items_user_id_users_id_fk"
    FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

CREATE INDEX IF NOT EXISTS "pinned_items_user_idx"
  ON "pinned_items" USING btree ("user_id");

CREATE UNIQUE INDEX IF NOT EXISTS "pinned_items_user_href_idx"
  ON "pinned_items" USING btree ("user_id", "href");
