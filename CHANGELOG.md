# Changelog

All notable changes to TaskNebula will be documented in this file.

The format is based on [Keep a Changelog 1.1.0](https://keepachangelog.com/en/1.1.0/), and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Changed

- **Project view switcher shows view names on desktop.** The List/Board/Timeline/Calendar tabs stay compact icon-only on mobile and tablet, and now show the translated label beside the icon on wide (`lg`+) screens. No new strings — reuses the existing `issuesViews.shell.view_*` keys (already in all 30 locales); accessibility unchanged (the `aria-label` still names each icon-only tab).
- **Project nav tabs show labels on desktop too.** The project header tabs (Views/Board/Backlog/Sprints/Modules/Docs/Chat/Analytics) were icon-only at every size; they now reveal their label beside the icon on `lg`+ while staying compact icon-only on mobile/tablet. The hover tooltip is suppressed on desktop where the label is already visible (no redundant label), and kept on smaller screens. Reuses existing `pagesProjects.tab*` keys — no new strings.

## [0.6.5] - 2026-06-20

### Fixed

- **New and updated issues now appear instantly — no page refresh.** Creating, editing, or moving an issue (Kanban/list, epics, sub-issues, AI-drafted issues, draft promotion, triage apply) now reflects the moment you act, instead of only after a manual reload. Root cause: the cache-invalidation predicate compared the server's project CUID against React Query caches keyed by the project **key** (boards are routed `/projects/<key>/board`), so the match never fired and the board never refetched. Every issue create/update/delete and the SSE realtime consumer now route through a single, key/CUID-agnostic `invalidateIssueCaches` helper (`apps/web/src/lib/realtime/issue-cache.ts`), and `useCreateIssue`/`useUpdateIssue`/`useDeleteIssue` do optimistic cache mutations so the card shows the instant the form is submitted and reconciles with the server row on success.

### Changed

- **Realtime event bus upgraded to Redis pub/sub (with an in-process fallback).** The SSE stream (`/api/events/stream`) that pushes issue/sprint/project events to other clients was an in-memory `EventEmitter` confined to a single Node process — it broke at >1 web replica and did not survive restarts. Events are now fanned out over Redis (origin-tagged so the publisher never double-delivers) and a per-process bridge pumps cross-instance events back into the local bus, so cross-client realtime survives multi-replica/restart deploys. Single-instance and no-Redis behaviour is byte-for-byte unchanged, and the 75 `publishEvent` call-sites are untouched. Mirrors the existing chat realtime transport.

### Added

- Unit tests for the issue-cache invalidation helpers (`matchesIssueList`, `issueBelongsInSprintList`, `issueMatchesListFilters`, `invalidateIssueCaches`) and the realtime event bus. Full web suite: 1409 unit tests green.

## [0.6.4] - 2026-06-13

### Fixed

- **Light (day) mode legibility across all overlay surfaces.** The shared `.glass-panel` surface — which backs every modal/dialog, the Cmd+K command palette, and popovers — was hardcoded as a dark glass slab in _both_ themes, so in light mode dark panels with light text floated over the bright app (illegible icons/text/backgrounds). `.glass-panel` is now theme-aware: a frosted-white surface in light mode and the original dark glass in dark mode (preserved byte-for-byte, no night-mode regression). The dark-coupled internals of the command palette and the AI disclosure modal, plus non-adaptive `slate`/`white`-opacity fills in module cards, notification items, label pills, and sticky notes, were converted to semantic design-system tokens (`foreground`/`muted-foreground`/`muted`/`accent`/`border`) so they resolve correctly in both themes. Verified in light and dark via screenshots; 204 web test suites green.

## [0.6.3] - 2026-06-13

### Changed

- **Refreshed the Anthropic model catalog to the current Claude lineup** — Claude Opus 4.8 (default), Fable 5, Opus 4.7, Sonnet 4.6, Haiku 4.5 — with correct output limits, reasoning-effort options, and temperature support (Opus 4.7+/Fable are adaptive-thinking only). Removed retired Claude 3.x entries, replaced fabricated model IDs (`claude-sonnet-4-7`, `claude-haiku-4-7`) and retired ones (`claude-3-5-*`) across the ask/draft/catch-me-up paths, and refreshed the per-model price table. (OpenAI catalog unchanged.)

### Added

- **README "Languages" section** documenting the 30 shipped locales (native names), device/browser auto-detection, RTL support, and the zero-hardcoded-string lint gate; updated the supported-models table to the current Claude lineup.

## [0.6.2] - 2026-06-13

### Fixed

- **Language selection now actually translates the whole app.** Because TaskNebula uses a custom middleware (not next-intl's `createMiddleware`), next-intl's `requestLocale` was never populated, so `getMessages()` and server `getTranslations()` silently fell back to English — the authenticated app stayed English even with a non-English locale selected and `<html lang>` set correctly. The middleware now forwards the resolved locale as an `x-tasknebula-locale` request header, and `request.ts` resolves the active locale as route segment → header → cookie → default. Switching language (and device auto-detection) now localizes every surface — dashboard, settings, admin, projects, issues — verified across locales.

## [0.6.1] - 2026-06-13

### Added

- **Zero-hardcoded-string enforcement.** A `react/jsx-no-literals` ESLint gate now errors on any bare visible string literal in app components/pages (marketing landing, `global-error`, `offline`, and tests are exempt), so CI blocks untranslated text from regressing. `scripts/i18n-check.mjs` enforces key parity across all 30 locale catalogs.
- **i18n governance for all assistants.** The "every user-facing string goes through next-intl; every key in all 30 catalogs" rule is documented in `CLAUDE.md`, `AGENTS.md`, `.cursor/rules/i18n.mdc`, and `.claude/rules/frontend.md`.

### Fixed

- **Completed localization of the remaining surfaces** — finished every partially-migrated component plus the public AI model-cards page, command palette, doc editor, auth/setup page wrappers, presence, and more. All visible app text now routes through next-intl and is translated into all 30 languages (catalogs at full key parity, 4,586 keys each).

## [0.6.0] - 2026-06-13

### Added

- **Full app-wide internationalization across 30 languages.** Every user-facing surface of the authenticated app is now localized via next-intl: navigation, dashboard, issues (board/list/detail/pickers), projects, settings, admin, notifications, search/command palette, docs/chat, sprints, analytics, AI features, page-level headings, and the auth/setup/error pages. ~3,900 UI strings were extracted into 55 message namespaces and translated into all 30 locales (English, Turkish, German, Spanish, French, Italian, Portuguese, Dutch, Polish, Russian, Ukrainian, Czech, Swedish, Danish, Finnish, Norwegian, Romanian, Hungarian, Greek, Bulgarian, Simplified & Traditional Chinese, Japanese, Korean, Hindi, Indonesian, Thai, Vietnamese, Arabic, Hebrew). Catalogs are key-parity verified across every locale; Arabic and Hebrew render right-to-left.
- **Device/browser language auto-detection.** The middleware negotiates the best supported locale from the `Accept-Language` header (quality-weighted, with regional→base fallback such as `fr-FR`→`fr` and `zh`→`zh-CN`) for first-time visitors and persists the choice; an explicit pick in the language switcher always wins. The switcher now lists all 30 languages by their native names.

### Changed

- The Jest i18n test harness mock now resolves ICU plural/select/`#`, `t.rich`, and `next-intl/server` `getTranslations`, and returns a stable per-namespace translator — so localized components are covered without a real next-intl runtime.

## [0.5.1] - 2026-06-13

### Fixed

- **Analytics "By Status" chart** showed raw status CUIDs as names, rendered all-grey, and clipped its slice labels. It now resolves workflow status **names + colors** and uses a contained legend; all distribution charts (Status/Priority/Type) share a consistent donut + legend layout.
- **Mobile responsiveness.** The My Issues header (search now full-width with horizontally scrollable tabs, title no longer wraps), the project board/views toolbar (scrollable view-icon strip; the "New Issue" button no longer overlaps the search field; sprint status reflows onto its own row), and the Settings tab strip (now horizontally scrollable) no longer overflow or clip on small screens. The desktop board also gained a trailing gutter so the last column isn't sheared at the edge.
- **Empty states.** The Docs space no longer renders a duplicate "Create page" CTA, the Initiatives empty state offers a real "New initiative" dialog instead of a "create via the API" dead-end, and the issue Links empty state no longer shows an orphaned icon.
- **API reference page** dark-themes the Swagger "Servers / Authorize" band and raises the description text contrast.

## [0.5.0] - 2026-06-13

### Added

- **Landing page redesign + logo refresh.** Reworked hero (AI-native, "for teams _and_ agents" framing), feature grid, comparison, proof/CTA/nav/footer/FAQ/self-host, plus new **workflow-narrative**, **migrate-from-Jira**, and **AI/MCP-server** sections. Refined the TaskNebula logo mark (brand + mono variants) with a synced `public/icon.svg`.
- **Jira/Plane-parity issue-detail fields.** `flagged` (impediment) and `storyPoints` surfaced in the sidebar (real columns), plus `environment` and `startDate` stored in `customFields` (no migration). Header flag indicator and a flag/unflag quick action.
- **Inline "type-to-create" pickers.** Create a new Sprint, Epic, or Sub-issue directly from the picker input (mirroring the existing label/component/version pattern); sub-issues inherit the parent's project/sprint/epic.
- **Admin version-update notification.** Super-admin panel + dismissible banner that surfaces new TaskNebula releases, with automatic background polling (6h, matching the server cache) and tests for the panel/banner/route.
- New i18n namespaces (`issueFields`, `sprintPicker`, `epicPicker`, `subtaskCreate`, `issueRelations`, `timeTrio`, `issueQuickActions`, `issueHeaderExtra`) across en/de/es/tr.
- Refreshed README screenshots (home, board, dashboard, issue detail).

### Changed

- **Issue relations & time-tracking polish.** Relationship types (blocks / is blocked by / relates to / duplicates) grouped with semantic chips in the links list; time-tracking panel now shows the Original Estimate / Logged / Remaining trio with a progress bar.

## [0.4.0] - 2026-06-12

### Added

- **First-class labels, project versions/releases, and components** (migration `0054_jira_parity_layer.sql` + REST APIs). New tables: `labels` + `issue_labels` (with an idempotent backfill from the legacy `issues.labels` JSONB array), `project_versions` + `issue_fix_versions` / `issue_affects_versions`, and `components` + `issue_components`. UI is minimal for now — these land as schema + API.
- **Issue resolution model**: `resolution` enum (fixed / wont_do / duplicate / cannot_reproduce / done), `resolvedAt`, and `flagged` fields on issues, so cycle-time analytics can distinguish Done from Won't Fix.
- `docs/AUDIT_2026-06.md` — the June 2026 full-codebase audit (28 domain auditors + adversarial critic) with file/line evidence for every known gap.

### Fixed

- **Cross-org issue-key collision.** The unique index on issue keys was global (`issue_key_idx` on `key` alone), so two organizations choosing the same project key collided on first insert. Replaced by `issue_org_key_idx` on `(organization_id, key)`.
- **Migration journal ordering silently skipped migrations 0044–0051 on upgrades.** `_journal.json` had non-monotonic `when` timestamps (0043 newer than 0044–0051), so drizzle's `created_at < folderMillis` rule skipped them on already-migrated databases. Timestamps renumbered strictly increasing; affected migrations are idempotent and re-run safely.
- **Cmd+K palette returned 405 on every query.** The omnibar issued `GET /api/search/hybrid`, which only exports `POST`.
- **`/api/search` returned 500.** The route referenced a non-existent `issues.status` column (schema has `statusId`) and used an invalid jsonb `LIKE` on labels.
- **~20 cross-tenant authorization gaps closed** across workflows, sprint issues, permission/security schemes, project members, issue links/activities, hybrid search, the SSE event stream, analytics, watchers, and saved filters (see `docs/AUDIT_2026-06.md` Gap #1).

### Changed

- **Docs refresh + 2026 roadmap extension.** `docs/ROADMAP_2026.md` now carries per-item status for #1–27 and the H2-2026 extension (#28–50 + H1-2027 outlook); `docs/STATUS.md`, `docs/FEATURES.md`, `docs/ARCHITECTURE.md` (RLS is planned, not implemented), and `docs/RELEASE.md` corrected; seven stale 2025-era snapshot docs archived to `docs/archive/`.

## [0.3.4] - 2026-06-09

### Security

- **Dependency vulnerabilities reduced from 14 to 1 (`pnpm audit --prod`).**
  - **Nodemailer upgraded to 8.0.10** to fix the SMTP command-injection advisory affecting `<= 8.0.4`.
  - Added range-scoped pnpm overrides patching transitive advisories without disturbing other major lines: `ajv >=6.14.0`, `bn.js >=4.12.3`, `brace-expansion >=1.1.13 / >=2.0.3`, `hono >=4.12.21`, `postcss >=8.5.10`, `qs >=6.15.2`, `uuid` 11.x `>=11.1.1`, `ws >=8.20.1`.
  - One remaining moderate advisory (`uuid` 9.0.1, transitive) is intentionally not force-upgraded: the fix requires a major bump (9 → 11) of a transitive dependency, and the issue only affects `v3/v5/v6` calls that pass a `buf` argument.

### Changed

- Removed two unused declarations flagged by ESLint (`PART_RE` in `time-tracking/duration.ts`, `ExecCall` type in the hybrid-search test).

### Added

- Claude Code project configuration: `CLAUDE.md` (also exposed as `AGENTS.md`), subagents, slash commands, and path-scoped rules under `.claude/`, plus a release runbook at `docs/RELEASE.md`.

## [0.3.3] - 2026-05-31

### Security

- **Next.js upgraded to 15.5.18.** This pulls in the current Next 15 security patch line, including fixes for middleware bypass, RSC denial-of-service, image optimizer, rewrite/request-smuggling, and cache-poisoning advisories reported by `pnpm audit`.
- **Docker build context now excludes local incident and secret artifacts.** `.dockerignore` now blocks `forensic/`, Claude worktrees, env variants, backups, dumps, local DB files, certs, and test reports so ignored local files cannot be sent to the Docker daemon during image builds.
- **Postgres password rehash no longer interpolates secrets into SQL.** The startup override now uses psql quoted variables for role and password values, so special characters cannot break the `ALTER ROLE` command.
- **Push subscription creation now fails closed when VAPID is incomplete.** The client disables unsupported push setup without a public key, and the API rejects subscription writes when server-side VAPID keys are missing.

### Fixed

- **Remote MCP HTTP endpoint is mounted.** `/api/mcp` now delegates to the shared `@tasknebula/mcp-server` HTTP handler instead of returning the temporary 503 stub.
- **Auth env aliases are consistent.** Runtime env validation now accepts `AUTH_*` and `NEXTAUTH_*` aliases for secret/base URL resolution, and agent dispatch URL generation no longer imports the strict env module just to build callback links.
- **First-run setup no longer masks database outages.** `GET /api/setup` returns a 503 database-not-ready state instead of showing the admin setup form when the DB query fails.
- **Authenticated mobile shell is usable.** The desktop sidebar/header are hidden on small screens, a bottom mobile nav uses real routes, and the app shell now has a keyboard skip link plus a stable `main` target.
- **PWA manifest and service worker no longer reference missing assets.** A bundled app icon is used for install shortcuts and notifications, and stale screenshot/share-target entries were removed.
- **Docker health/runtime hardening.** Postgres healthchecks respect overridden DB user/name values, Redis no longer exposes its password in the process arguments, and the web runtime starts as the unprivileged `nextjs` user.
- **Production DB config fails fast.** The DB connection helper only falls back to local Postgres outside production.

## [0.3.2] - 2026-05-21

### Fixed

- **Self-hosted release path hardened** (`fix: harden self-hosted release path`); README Docker quickstart and screenshot refresh shipped alongside.

## [0.3.1] - 2026-05-19

### Fixed

- **App rail labels no longer shift when “My Issues” wraps.** Rail items now use a fixed-height, centered two-line label slot, so translated labels and two-word labels keep the icon grid aligned.
- **Sidebar navigation respects locale-prefixed routes.** The rail and sidebar now strip `/tr`, `/de`, `/es`, and `/en` before matching active sections, so My Issues, issue detail, projects, settings, and admin navigation render consistently across locales.
- **Long sidebar labels truncate inside their row.** Navigation rows now reserve stable icon/text space instead of letting longer translated labels push or overflow the menu.

## [0.3.0] - 2026-05-15

### Fixed

- **Tiptap collaborative descriptions no longer lose formatting.** The collab editor used to snapshot `editor.getText()` to `issues.description`, so lists / bold / links / code blocks were discarded the moment the Yjs doc was dropped. A new `issues.description_rich` JSONB column (migration 0052) now carries the full ProseMirror state alongside the plain-text fallback, and the static read path mounts a non-editable Tiptap to rebuild the rich rendering.
- **Initiative re-parent and project links now reject cross-workspace ids.** POST and PATCH `/api/initiatives` walk the proposed parent's `workspaceId` plus every `projectIds` entry and refuse with 400 (with the offending id) before touching the FK. The previous behaviour either 500'd on the FK or partially deleted the existing project links before failing.
- **Cycle-rollover cron now uses the shared `requireCronAuth()` helper** so the secret accept-set matches standup and janitor (header, Bearer, `?secret=`) and benefits from the same timing-safe compare. The route's bespoke parser is gone.
- **Janitor dry-run no longer silently ignores the caller.** When the request body has `dryRun: false` but no `systemUserId` is available (env or body), the route now returns `412 Precondition Failed` with an explanation instead of crashing on the first comment insert. Default behaviour (no `dryRun` field) is unchanged.
- **Stale collab documents are cleaned up when an issue is deleted.** `deleteIssue()` now also removes the matching `collab_documents` row (`issue:<id>`) via a `to_regclass`-guarded query, so deployments that have never enabled Hocuspocus stay untouched while live-collab deployments don't accumulate orphan Y-state.

### Security

- **SAML response validator hardened.** The schema-validator callback now rejects `<!DOCTYPE …>` (XXE), `<!ENTITY …>` declarations, payloads larger than 3 MB, and the presence of multiple top-level `<Response>` / `<Assertion>` elements (signature-wrapping shape). A new `verifyAssertionConstraints` block runs after samlify's parse: it enforces an exact-match `Recipient`, requires AudienceRestriction membership for our SP entityID, and tightens the `NotBefore` / `NotOnOrAfter` window to ±30 s.
- **Importer adapters now go through `fetchWithBackoff`.** Linear, Jira, and GitHub HTTP calls retry on 429 / 5xx / network error with exponential backoff and full jitter, honour `Retry-After` (seconds or HTTP-date), and cap at 4 retries. Previously a single transient response from any upstream killed the import job.

### Reliability

- **Linear importer paginates `pageInfo.hasNextPage`.** The previous adapter capped at the first 50 issues and silently truncated; large workspaces are now imported in full, with an upper bound of 200 pages × 50 = 10 000 issues per run.
- **`cycle-rollover` cron is scheduled.** The compose sidecar now POSTs it daily at 02:00 UTC alongside the existing standup (08:00) and janitor (hourly) jobs.

### Tests

- **51 new Jest cases across 8 suites:**
  - `lib/importers/__tests__/fetch-with-backoff.test.ts` (8) — retries, Retry-After, exhaustion, jitter overrides.
  - `app/api/issues/[issueId]/__tests__/estimate-persistence.test.ts` (6) — `estimateHours`, `estimateSource`, `descriptionRich` end-to-end through the route.
  - `lib/agents/__tests__/cron-auth-bearer.test.ts` (5) — `Authorization: Bearer` accept-path.
  - `app/api/cron/janitor/__tests__/dry-run.test.ts` (4) — `effectiveDryRun` + 412 refusal.
  - `lib/sso/__tests__/saml-constraints.test.ts` (15) — XXE / wrapping / Recipient / Audience / clock-skew. Plus `saml.test.ts` fixture catch-up.
  - `app/api/initiatives/__tests__/workspace-validation.test.ts` (7) — cross-workspace parent + projectIds rejection.

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

[Unreleased]: https://github.com/neuraparse/tasknebula/compare/v0.4.0...HEAD
[0.4.0]: https://github.com/neuraparse/tasknebula/compare/v0.3.4...v0.4.0
[0.3.4]: https://github.com/neuraparse/tasknebula/compare/v0.3.3...v0.3.4
[0.3.3]: https://github.com/neuraparse/tasknebula/compare/v0.3.2...v0.3.3
[0.3.2]: https://github.com/neuraparse/tasknebula/releases/tag/v0.3.2
[0.3.1]: https://github.com/neuraparse/tasknebula/commit/a2211ec
[0.3.0]: https://github.com/neuraparse/tasknebula/commit/14e9bab
[0.2.9]: https://github.com/neuraparse/tasknebula/commit/1b0ef18
[0.2.8]: https://github.com/neuraparse/tasknebula/commit/38ad445
[0.2.7]: https://github.com/neuraparse/tasknebula/commit/fc3afe7
[0.2.6]: https://github.com/neuraparse/tasknebula/releases/tag/v0.2.6
[0.2.0]: https://github.com/neuraparse/tasknebula/releases/tag/v0.2.0
[0.1.0]: https://github.com/neuraparse/tasknebula/commit/b07e16c
