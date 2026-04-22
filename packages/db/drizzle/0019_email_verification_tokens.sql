-- Email verification: store SHA-256 hashed verification tokens and link them
-- back to users. `users.email_verified` already exists (see 0000_dear_puck)
-- so this migration only introduces the tokens table.

CREATE TABLE IF NOT EXISTS "email_verification_tokens" (
  "id" text PRIMARY KEY NOT NULL,
  "user_id" text NOT NULL,
  "token_hash" text NOT NULL,
  "expires_at" timestamp NOT NULL,
  "used_at" timestamp,
  "created_at" timestamp DEFAULT now() NOT NULL
);

DO $$
BEGIN
  ALTER TABLE "email_verification_tokens"
    ADD CONSTRAINT "email_verification_tokens_user_id_users_id_fk"
    FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS "email_verification_token_hash_idx"
  ON "email_verification_tokens" USING btree ("token_hash");
CREATE INDEX IF NOT EXISTS "email_verification_user_idx"
  ON "email_verification_tokens" USING btree ("user_id");
