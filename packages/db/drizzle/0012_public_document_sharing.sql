ALTER TYPE "audit_log_action" ADD VALUE IF NOT EXISTS 'document.public_shared';
ALTER TYPE "audit_log_action" ADD VALUE IF NOT EXISTS 'document.public_unshared';
ALTER TYPE "audit_log_action" ADD VALUE IF NOT EXISTS 'document.public_link_regenerated';

ALTER TABLE "document_pages" ADD COLUMN IF NOT EXISTS "public_share_enabled" boolean DEFAULT false NOT NULL;
ALTER TABLE "document_pages" ADD COLUMN IF NOT EXISTS "public_share_token" varchar(64);
ALTER TABLE "document_pages" ADD COLUMN IF NOT EXISTS "public_share_allow_search_indexing" boolean DEFAULT false NOT NULL;
ALTER TABLE "document_pages" ADD COLUMN IF NOT EXISTS "public_share_include_attachments" boolean DEFAULT false NOT NULL;
ALTER TABLE "document_pages" ADD COLUMN IF NOT EXISTS "public_share_published_at" timestamp;
ALTER TABLE "document_pages" ADD COLUMN IF NOT EXISTS "public_share_published_by" text;

DO $$
BEGIN
  ALTER TABLE "document_pages"
    ADD CONSTRAINT "document_pages_public_share_published_by_users_id_fk"
    FOREIGN KEY ("public_share_published_by") REFERENCES "users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS "document_page_public_share_token_idx" ON "document_pages" USING btree ("public_share_token");
CREATE INDEX IF NOT EXISTS "document_page_public_share_enabled_idx" ON "document_pages" USING btree ("public_share_enabled");
