-- Allow organization-specific email templates for project lifecycle events.
-- Runtime already has built-in project_created/project_archived templates; this
-- enum update lets admins override those templates per organization.

ALTER TYPE "email_template_type" ADD VALUE IF NOT EXISTS 'project_created';
ALTER TYPE "email_template_type" ADD VALUE IF NOT EXISTS 'project_archived';
