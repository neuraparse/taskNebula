-- Allow AI/agent failures to surface as in-app notifications so operators
-- see them without digging into audit logs. Adds two new enum values to
-- notification_type; existing rows are unaffected.

ALTER TYPE "notification_type" ADD VALUE IF NOT EXISTS 'ai_draft_failed';
ALTER TYPE "notification_type" ADD VALUE IF NOT EXISTS 'agent_run_failed';
