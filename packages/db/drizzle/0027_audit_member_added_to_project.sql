-- Add audit log action value for member-to-project assignment
-- introduced by the "invite with project" flow in
-- apps/web/src/app/api/organizations/[organizationId]/members/route.ts

ALTER TYPE "audit_log_action" ADD VALUE IF NOT EXISTS 'organization.member_added_to_project';
