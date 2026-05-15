# Changelog

All notable changes to TaskNebula will be documented in this file.

The format is based on [Keep a Changelog 1.1.0](https://keepachangelog.com/en/1.1.0/), and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [0.2.9] - 2026-05-15

### Fixed

- **Initiative slug conflict surfaced as 500.** `POST /api/initiatives` and `PATCH /api/initiatives/[id]` now catch Postgres's `23505` unique-violation and return `409 Conflict` with a human-readable message instead of letting the error bubble up.
- **Inbox mark-read flash-unsync.** `useInboxMarkRead` now does an optimistic update across every cached `['inbox', filters]` view, snapshots state for rollback on error, and uses `refetchType: 'active'` so background lenses don't trigger parallel refetches. The "unread for a frame after viewing the snooze tab" race is gone.
- **Locale switcher cookie race.** The switcher now reads back the cookie before reloading and yields a double-rAF so the browser has actually flushed the write. Slow networks (and Safari) no longer reload in the previous locale.

### Security

- **SAML callbacks now require a signed `RelayState`.** `/saml/[slug]/init` mints an HMAC-SHA256-signed token over `{slug, nonce, ts}` using `AUTH_SECRET` and appends it to the IdP redirect URL. `/saml/[slug]/callback` verifies the signature, enforces a 5-minute replay window, and rejects mismatched slugs. Defence-in-depth on top of the existing workspace-slug cookie.
- **Hocuspocus per-document authorization.** The collaboration server's `onAuthenticate` hook now resolves the issue id embedded in the document name (`issue:<id>`) and requires the connecting user to be either a member of the issue's project or an `owner`/`admin` of the issue's organization. Previously a valid collaboration JWT for any user opened any issue document, regardless of project access.

### Internationalisation

- App-rail tooltips, nav labels ("Home", "Inbox", "Issues", "Projects", "Docs", "Team", "Settings", "Admin"), and the account menu ("Account settings", "Sign out") now read from `nav.*` translation keys instead of hard-coded English. Filled in for EN, TR, DE, ES.

### Observability

- **Cron-driven LLM calls now write `llm_call_audit`.** Standup and janitor agents call `commitUsage()` on every Anthropic invocation (success and error paths), so the admin spend dashboard reflects cron activity. Token counts are estimated from message length until the underlying `callHaiku()` exposes provider usage.
- **Daily cycle-rollover cron scheduled.** The compose-side cron sidecar now also POSTs `/api/cron/cycle-rollover` at 02:00 UTC. Previously the endpoint existed but had no scheduler driving it.

### Tests

- 44 new Jest cases across five suites: initiative cycle detection, importer credential redaction, search org/project membership guard, sidebar locale-aware highlighting helpers, and SAML RelayState mint/verify (including tamper, expiry, and nonce-distinctness coverage).

## [0.2.8] - 2026-05-15

### Fixed

- **Logged-in users hit 404 on inbox, initiatives, settings/import, settings/intake-forms, settings/sso, settings/ai-transparency, settings/security/audit-log-streaming, and api-docs.** Those eight pages lived under `apps/web/src/app/(app)/` (no locale prefix) instead of `apps/web/src/app/[locale]/(app)/`, so next-intl's rewrite to `/en/inbox` etc. found no route. Relocated all sixteen files into the localised tree. Live-verified across `/`, `/en/`, `/tr/`, `/de/`, and `/es/` prefixes.
- **`/api-docs` and similar paths returned a hard 404.** The middleware's `pathname.startsWith('/api')` short-circuit had no boundary check, so it also swallowed `/api-docs`, `/api-keys`, etc., bypassing next-intl entirely. Now matches only the actual `/api` segment.
- **Sidebar active-link highlighting was wrong under non-default locales.** All `pathname === '/dashboard'` / `pathname.startsWith('/projects')` comparisons now run through a `stripLocalePrefix()` helper, so `/tr/projects` highlights the same row as `/projects`.
- **TimeTrackingPanel "Save estimate" button was a silent no-op.** `updateIssueSchema` lacked `estimateHours` and `estimateSource`, so Zod stripped them before the PATCH reached the DB. Both fields are now accepted.
- **Initiative pages dropped behind a feature flag.** Removed the `NEXT_PUBLIC_INITIATIVES_ENABLED` check now that the feature has shipped to main.

### Security

- **`/api/import/jobs/[id]` leaked upstream credentials.** Linear, Jira, and GitHub OAuth tokens stored alongside the field mapping (`mapping.config.apiKey`, `apiToken`, `accessToken`, `refreshToken`, `clientSecret`, `password`, `authorization`) were returned verbatim on every status poll. Now redacted to `'***'` before serialisation.
- **`/api/search` accepted any `organizationId` query param.** A member of one org could query another org's issue catalogue by passing its ID. The route now requires an `organization_members` row for the caller (and a `project_members` row when `projectId` is supplied).
- **Initiative re-parenting allowed indirect cycles.** `validateInitiativeDepth` walked the _current_ tree and couldn't see the proposed new edge, so `PATCH { parentInitiativeId: <descendant> }` would corrupt the hierarchy. Added `wouldCreateInitiativeCycle()` and reject the request before the update.

### Internationalisation

- Signin form banner strings (email verified, password reset, invalid credentials, verification link expired, generic error) are now translation keys (`auth.banner_*`) instead of hard-coded English. Filled in for EN, TR, DE, ES.

## [0.2.7] - 2026-05-15

### Fixed

- **Reverse-proxy 500 after login.** Behind nginx the host header is the public domain, which differs from the standalone server's bound address. next-intl emitted an absolute `x-middleware-rewrite` value, Next.js's `relativizeURL` detected the host mismatch, and fell through to `proxyRequest` — which then ECONNREFUSED'd against `127.0.0.2:443` (a loopback alias) on every locale-rewritten route (`/dashboard` → `/en/dashboard`). Authenticated users hit a 500 immediately after sign-in. Dockerfile now patches the standalone `server.js` to flip `experimental.trustHostHeader` to `true` (Next.js hard-codes this to false unless running on Vercel), so the rewrite stays internal.
- **Migration transaction warnings.** Migration `0051_pgvector_hnsw_content_embeddings.sql` wrapped its body in a manual `BEGIN;` / `COMMIT;`. Drizzle's migrator already wraps each file in a transaction, so the nested control produced "there is already a transaction in progress" / "there is no transaction in progress" Postgres warnings on every startup. Removed the manual control; SQL stays idempotent (`DROP/CREATE INDEX IF [NOT] EXISTS`).

### Added

- **Mobile app roadmap** — README now documents the phased mobile plan (React Native + Expo + Tamagui, M1–M5).
- Governance documentation: `SECURITY.md`, `CODE_OF_CONDUCT.md`, `SUPPORT.md`, GitHub issue/PR templates, and `FUNDING.yml` placeholder.

## [0.2.6] - 2026-05-14

### Added

- **Integrations:** GitHub and Sentry OAuth flows, plus HMAC-signed outbound webhook delivery (Plane parity).
- **Admin:** Platform integration OAuth credentials form and feature-flag CRUD UI with runtime tests.
- **Templates:** Admin CRUD for project templates plus a use-template onboarding flow.
- **Drafts:** Database-backed drafts with a promote-to-project flow and a project-creation modal on the drafts list.
- **Invites & permissions:** New invite flow, refined permission model, and redesigned mail/notification surfaces.

### Changed

- **Project UI:** Minimized top bar, settings moved into a modal, and an icon-only views toolbar.
- **Schema:** Exposed new drafts and integration-client-credentials schemas in the barrel exports; consolidated journal entries.

### Fixed

- **Infra:** Expanded health checks, repaired the migration journal, and reduced log noise.
- **Infra:** More robust container healthchecks and a better memory-pressure signal.
- **Auth:** Added `forgot-password`, `reset-password`, and `verify-email` to middleware public routes.
- **Templates:** Moved `getTemplateAuthz` out of `route.ts` so Next.js route exports stay valid; escaped quotes in the new-template dialog.
- **Automation:** Escaped apostrophe in the automation manager toast.

### Removed

- The standalone "New work item" button (superseded by inline creation affordances).

## [0.2.0] - 2026-03

### Added

- Initial public preview of TaskNebula: kanban boards, real-time updates, and keyboard-first navigation.
- [See git log] for the full list of pre-0.2.6 changes.

## [0.1.0] - 2026-01

### Added

- Internal alpha release. [See git log] for details.

[Unreleased]: https://github.com/neuraparse/tasknebula/compare/v0.2.6...HEAD
[0.2.6]: https://github.com/neuraparse/tasknebula/releases/tag/v0.2.6
[0.2.0]: https://github.com/neuraparse/tasknebula/releases/tag/v0.2.0
[0.1.0]: https://github.com/neuraparse/tasknebula/releases/tag/v0.1.0
