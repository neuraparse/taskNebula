-- Shareable project invite links.
--
-- Links are token-hash based, limited-use, expiring, and revocable. This is
-- intentionally separate from user invite tokens so project links can be
-- cancelled without affecting email invitations.

ALTER TYPE "audit_log_action" ADD VALUE IF NOT EXISTS 'project.invite_link_created';
ALTER TYPE "audit_log_action" ADD VALUE IF NOT EXISTS 'project.invite_link_revoked';
ALTER TYPE "audit_log_action" ADD VALUE IF NOT EXISTS 'project.invite_link_accepted';
ALTER TYPE "audit_log_action" ADD VALUE IF NOT EXISTS 'project.invite_link_signup';

CREATE TABLE IF NOT EXISTS "project_invite_links" (
  "id" text PRIMARY KEY NOT NULL,
  "organization_id" text NOT NULL REFERENCES "organizations"("id") ON DELETE CASCADE,
  "project_id" text NOT NULL REFERENCES "projects"("id") ON DELETE CASCADE,
  "token_hash" text NOT NULL,
  "role" "project_role" NOT NULL DEFAULT 'developer',
  "max_uses" integer NOT NULL DEFAULT 1,
  "used_count" integer NOT NULL DEFAULT 0,
  "expires_at" timestamp NOT NULL,
  "revoked_at" timestamp,
  "revoked_by" text REFERENCES "users"("id") ON DELETE SET NULL,
  "created_by" text NOT NULL REFERENCES "users"("id"),
  "created_at" timestamp NOT NULL DEFAULT now(),
  "updated_at" timestamp NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS "project_invite_link_token_hash_idx"
  ON "project_invite_links" ("token_hash");
CREATE INDEX IF NOT EXISTS "project_invite_link_project_idx"
  ON "project_invite_links" ("project_id");
CREATE INDEX IF NOT EXISTS "project_invite_link_organization_idx"
  ON "project_invite_links" ("organization_id");
CREATE INDEX IF NOT EXISTS "project_invite_link_expires_at_idx"
  ON "project_invite_links" ("expires_at");
CREATE INDEX IF NOT EXISTS "project_invite_link_revoked_at_idx"
  ON "project_invite_links" ("revoked_at");
