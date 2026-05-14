-- FEAT-25 (Cmd+K omnibar redesign): pinned/saved queries surface above
-- recent history in the palette. Default false so existing rows behave
-- like ephemeral history. Partial index keeps lookups for the
-- "Pinned" section cheap once the table grows.

ALTER TABLE "search_history"
  ADD COLUMN IF NOT EXISTS "pinned" boolean NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS "search_history_user_pinned_idx"
  ON "search_history" USING btree ("user_id", "pinned");
