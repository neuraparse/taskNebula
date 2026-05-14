/**
 * Side-effect imports — each module calls `registerRoute(...)` at module
 * top level. Importing this file is what populates the OpenAPI registry.
 *
 * Add new route files here.
 *
 * TODO(QUAL-19 follow-up): the remaining ~185 routes under `apps/web/src/app/api/`
 * are not yet documented. Track the rest under a separate task; the current
 * scope is the public/stable surface that the MCP server (task #5) targets.
 *
 * Outstanding categories to register next, in rough priority order:
 *   - activities, audit-logs, notifications
 *   - workflows / workflow-transitions / projects/[projectId]/workflow-transitions
 *   - automations, automation-rules
 *   - integrations (github, sentry, webhooks)
 *   - attachments, uploads
 *   - admin/*  (likely keep private)
 *   - chat / conversations / presence
 *   - templates, custom-fields, saved-filters
 *   - export, ai/*
 *   - users (broader than /me): admin/users, organizations/[id]/members
 */

import './issues';
import './projects';
import './cycles';
import './users';
import './search';
import './health';
