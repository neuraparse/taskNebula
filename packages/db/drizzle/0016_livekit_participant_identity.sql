ALTER TABLE "call_participants"
  ADD COLUMN IF NOT EXISTS "participant_identity" text;

UPDATE "call_participants"
SET "participant_identity" = "user_id"
WHERE "participant_identity" IS NULL;

CREATE INDEX IF NOT EXISTS "call_participant_identity_idx"
  ON "call_participants" USING btree ("participant_identity");
