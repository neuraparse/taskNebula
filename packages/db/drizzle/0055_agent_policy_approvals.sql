-- AGENTOWNERS policy support for local AI-agent governance.
--
-- Adds:
-- 1. Audit action enum values for policy decisions and approval lifecycle.
-- 2. agent_approval_requests, a replayable queue for AI writes that require
--    human approval.
--
-- Every statement is idempotent so this migration can safely re-run on
-- repaired drizzle journals.

ALTER TYPE "audit_log_action" ADD VALUE IF NOT EXISTS 'agent.policy.allow';
ALTER TYPE "audit_log_action" ADD VALUE IF NOT EXISTS 'agent.policy.deny';
ALTER TYPE "audit_log_action" ADD VALUE IF NOT EXISTS 'agent.policy.require_approval';
ALTER TYPE "audit_log_action" ADD VALUE IF NOT EXISTS 'agent.approval.created';
ALTER TYPE "audit_log_action" ADD VALUE IF NOT EXISTS 'agent.approval.approved';
ALTER TYPE "audit_log_action" ADD VALUE IF NOT EXISTS 'agent.approval.rejected';

CREATE TABLE IF NOT EXISTS "agent_approval_requests" (
  "id" text PRIMARY KEY NOT NULL,
  "workspace_id" text NOT NULL REFERENCES "organizations"("id") ON DELETE CASCADE,
  "project_id" text REFERENCES "projects"("id") ON DELETE CASCADE,
  "requested_by" text NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "actor" text NOT NULL,
  "resource" text NOT NULL,
  "action" text NOT NULL,
  "target_type" text NOT NULL,
  "target_id" text,
  "proposed_payload" jsonb NOT NULL DEFAULT '{}'::jsonb,
  "matched_rule" text,
  "decision_reason" text NOT NULL,
  "status" text NOT NULL DEFAULT 'pending',
  "requested_at" timestamp NOT NULL DEFAULT now(),
  "expires_at" timestamp,
  "decided_by" text REFERENCES "users"("id") ON DELETE SET NULL,
  "decided_at" timestamp,
  "created_at" timestamp NOT NULL DEFAULT now(),
  "updated_at" timestamp NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "agent_approval_workspace_status_idx"
  ON "agent_approval_requests" ("workspace_id", "status", "requested_at");
CREATE INDEX IF NOT EXISTS "agent_approval_project_idx"
  ON "agent_approval_requests" ("project_id");
CREATE INDEX IF NOT EXISTS "agent_approval_actor_idx"
  ON "agent_approval_requests" ("actor");
CREATE INDEX IF NOT EXISTS "agent_approval_target_idx"
  ON "agent_approval_requests" ("target_type", "target_id");
CREATE INDEX IF NOT EXISTS "agent_approval_requested_by_idx"
  ON "agent_approval_requests" ("requested_by");

DO $$ BEGIN
  ALTER TABLE "agent_approval_requests"
    ADD CONSTRAINT "agent_approval_status_check"
    CHECK ("status" IN ('pending', 'approved', 'rejected', 'expired'));
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
