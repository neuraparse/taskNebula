# Changelog

All notable changes to TaskNebula will be documented in this file.

The format is based on [Keep a Changelog 1.1.0](https://keepachangelog.com/en/1.1.0/), and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [0.7.5] - 2026-06-22

### Added

- **Immediate Docker Hub update detection.** Self-hosted installs can now point
  Docker Hub webhooks at `/api/webhooks/docker-hub` with
  `TASKNEBULA_DOCKER_HUB_WEBHOOK_SECRET`; versioned image pushes update the
  shared version cache and notify every super-admin in-app without waiting for
  an admin page poll.
- **Scheduled update-check fallback.** The optional cron sidecar now calls
  `/api/cron/version-check` every 6 hours when `CRON_SECRET` is configured, so
  installs still detect new GitHub/Docker Hub versions when inbound webhooks
  are not exposed.

### Changed

- **Mobile and responsive UI polish.** The mobile app header/nav now respect
  safe-area insets, truncate long labels cleanly, and prevent horizontal page
  overflow; landing/auth/comparison surfaces were tightened for narrow screens.
- **Project overview opens the real views shell.** Visiting a project root now
  renders the project views surface directly instead of redirecting through the
  nested views route.

### Fixed

- **Dashboard language picker scrolls through all shipped locales.** The
  30-language menu now caps to the available viewport height, supports mouse
  and touch scrolling, and keeps the bottom locales reachable.
- **SAML metadata display no longer overflows settings.** Long metadata URLs
  wrap inside a code block instead of pushing the SSO panel wider than its
  container.
- **Public unlocalized routes stay public.** Middleware now keeps
  `/ai-model-cards`, `/intake`, and `/trust` outside locale-prefix handling,
  matching their app routes.

## [0.7.4] - 2026-06-22

### Added

- **AGENTOWNERS enforcement for MCP coding agents.** The TaskNebula MCP server
  now attaches server-side AGENTOWNERS markers to issue creation, issue updates,
  assignment, status transitions, comments, and subtask creation so Codex,
  Claude Code, Gemini, Cursor, and other configured agent actors flow through
  the local policy evaluator and approval queue instead of bypassing governance.
- **MCP AGENTOWNERS configuration docs.** MCP setup examples now show
  `TASKNEBULA_AGENT_ACTOR` so each client can identify itself consistently, with
  `mcp-agent` as the unknown-agent fallback and `TASKNEBULA_AGENT_POLICY=off`
  available for explicit opt-out.

### Changed

- **Comment policy rules are normalized.** `comments:create` and the earlier
  `issues:comment` AGENTOWNERS spelling now match each other, keeping existing
  policy files compatible while documenting the more precise comment resource.

### Fixed

- **Admin-created-only invitations no longer strand invited users.** When
  platform registration is restricted to admin-created accounts, organization
  invitations now block new/passwordless invitees with a clear warning instead
  of sending signup mail for an account that cannot set a password.
- **Invitation and auth emails use the configured app URL.** Organization
  invites, project invite links, password reset links, and email verification
  links now prefer `APP_URL`/auth URL configuration instead of falling back to
  `http://localhost:3000` in self-hosted custom-domain deployments.

## [0.7.3] - 2026-06-22

### Added

- **Richer super-admin user visibility.** Admin → Users now surfaces email
  verification state, last seen/created timestamps, organization memberships,
  project memberships, and recent activity so self-hosted operators can audit
  invited and active accounts without jumping between pages.
- **Admin email preview and broader admin regression tests.** Super-admin email
  diagnostics and the refreshed admin tables now have focused Jest coverage,
  alongside project settings and membership-flow tests.

### Changed

- **Admin/users tables are responsive and action-oriented.** Admin pages now use
  denser table layouts on desktop, card fallbacks on smaller screens, safer
  delete confirmations, and cleaner action menus for organizations, users, and
  feature flags.
- **Project settings membership management is usable from the modal.** Project
  settings now exposes add/remove project-member flows in a layout that fits
  the dialog and keeps permission controls aligned with the table/card views.

### Fixed

- **Invited-user signup works in admin-created-only installs.** A valid admin
  invite token now authorizes activation even when public account creation is
  closed, and invited-user activation dispatches the verification email expected
  by the verify-request screen.
- **Deploy updates no longer strand cached sessions on stale bundles.** The PWA
  service worker no longer precaches the app shell, skips mutating/API/Next
  internal requests, updates its script without browser-cache indirection, and
  the client clears TaskNebula caches plus reloads once when it detects stale
  Server Action or chunk-load errors from an older deployment.
- **Signup no longer performs a redundant router refresh after sign-in.** The
  invite/signup flow now navigates once to the project or verify-request page,
  reducing RSC/session races after account activation.

## [0.7.2] - 2026-06-21

### Fixed

- **Registered users can be added directly to projects.** Project member
  management now searches both existing workspace members and active registered
  users for admins with member-invite permission. Selecting a registered user
  atomically adds them to the workspace as a member and then to the project with
  the selected project role, avoiding the previous dead end where self-hosted
  admins could not choose newly registered accounts.
- **Project member add flow is race-safe.** Workspace/project membership writes
  now run in a transaction, handle duplicate project-member inserts as a clean
  `409`, and avoid leaving stray workspace memberships when the target user is
  already on the project.

## [0.7.1] - 2026-06-21

### Added

- **Dashboard interface font setting.** Settings → Appearance now includes an
  Interface font control with TaskNebula classic as the default dashboard and
  workspace font, while IBM Plex remains available as an optional app-surface
  font. The preference is stored per user through `user_appearance_settings`
  and ships with migration `0057_user_appearance_interface_font`.
- **Denser dashboard workspace widgets.** The dashboard now surfaces catch-up,
  standup, analytics, recent activity, personal work, deadlines, and pinned
  items in the first workspace view instead of leaving those entry points
  scattered across lower-priority pages.

### Changed

- **Classic app typography restored by default.** The IBM-inspired visual
  language remains on the landing page and as an optional Appearance setting,
  but authenticated dashboard/workspace screens default back to the previous
  TaskNebula font stack for readability.
- **Dashboard and app-shell polish.** The main dashboard, side rail, sidebar,
  header, loading shells, KPI tiles, activity feed, import wizard, audit-log
  streaming, and dashboard widgets were tightened for the current square IBM
  layout without duplicating controls.
- **README and install docs now pin `0.7.1`.** Docker Desktop and production
  pinning examples point at the new release tag.

### Fixed

- **Recent activity status labels.** Activity feed status-change messages now
  resolve workflow status names instead of rendering raw status IDs.

## [0.7.0] - 2026-06-21

### Added

- **Safe self-update handoff for Docker installs.** Admin → Updates now keeps
  manual Docker commands visible while exposing an opt-in self-update action
  only when a signed external updater webhook is configured. The web container
  never receives Docker socket access; requests are super-admin-gated, audited,
  version-validated, stored durably in `system_settings`, and sent with an HMAC
  signature so a host-side updater can pull the target Docker Hub image and
  restart `web` under operator control.
- **Limited project invite links.** Project member management now supports
  shareable invite links with a project role, expiry window, usage limit, and
  revoke action. Valid project invite links can open signup in invite-only
  installs, while admin-created-only mode remains closed.
- **Docker/GitHub update visibility across self-hosted installs.** The update
  surface now tracks Docker Hub tags and GitHub releases, stores update markers,
  and notifies super-admins when their running image is behind.
- **README screenshot refresh.** Current home, dashboard, board, and AI workflow
  screenshots were regenerated for the public README.

### Changed

- **IBM-inspired landing refresh.** The public home page now uses a more
  restrained IBM-style visual system with local IBM Plex fonts and a tighter
  two/three-color palette.
- **App shell and navigation cleanup.** The duplicated profile surfaces were
  consolidated, sidebar destinations were tightened, and Inbox navigation now
  exposes clearer data and states.
- **Route loading polish.** Several route-level loading files were replaced by
  reusable loading shells to reduce double-load flicker and page jumpiness.
- **README and install docs now pin `0.7.0`.** Docker Desktop and production
  pinning examples point at the new release tag.

### Fixed

- **Project invite link routing.** `/join/project/[token]` is now public at the
  middleware layer, so unauthenticated invitees reach signup with the token
  intact instead of being bounced to a generic sign-in callback.
- **Pending email invite cancellation.** Removing a pending organization invite
  now clears the user's invite token when no other pending invite remains.
- **Issue detail and time tracking layout polish.** Placeholder and input layout
  issues in the lower issue-detail/time logging surfaces were tightened.

## [0.6.9] - 2026-06-21

### Added

- **Docker Hub update alerts for self-hosted super-admins.** The authenticated app shell now mounts the version-update banner for super-admins outside the Admin dashboard too, so Docker Hub/GitHub updates surface while admins are using the product instead of only after opening Admin → Updates. Docker Hub-only updates get Docker-specific banner copy and link back to the Updates panel.
- **One-time in-app notifications for newly detected upstream updates.** When the existing version check detects a newer GitHub release or `neuraparse/tasknebula` Docker Hub image, TaskNebula records an idempotent `system_settings` marker and inserts a single unread bell notification for each super-admin, avoiding repeated noise for the same version.

### Changed

- Post-upgrade system notifications now point admins to Admin → Updates instead of Admin → System, matching the actual version/update control surface.

## [0.6.8] - 2026-06-21

### Added

- **UI visibility for recent admin controls.** Organization labels now appear in the main Settings tab flow, not only as a standalone sidebar route, so admins can manage first-class labels from the normal settings surface.
- **Agent approval queue surfaced in Admin.** The AGENTOWNERS governance and pending approval queue now also appears in Admin → Agent control, giving super-admins a direct review surface instead of hiding approvals inside workspace AI settings.

## [0.6.7] - 2026-06-21

### Added

- **Self-hosted registration policy controls.** Super admins can now choose the platform-wide signup mode from Admin → System: allow public registration, require valid invitations, or restrict account creation to super admins. The policy is stored in `system_settings`, defaults to open registration for backward compatibility, and every update is audit-logged.

### Changed

- **Public signup and OAuth now honor the registration policy.** Invite-only mode still lets invited users complete signup with a valid invite token, while admin-created-only mode blocks public signup paths entirely. Signup errors are localized across all 30 shipped languages.

## [0.6.6] - 2026-06-20

### Added

- **AGENTOWNERS governance for AI-driven actions.** Added a local policy parser/evaluator for `AGENTOWNERS`, `.github/AGENTOWNERS`, and `.tasknebula/AGENTOWNERS`, with explicit `allow`, `deny`, and `require-approval` decisions for agent actors and project-management actions. AI issue and board actions now pass through the central policy guard before execution, denied actions return clear explanations, approval-required actions create pending approval requests, and every policy decision is audit-logged. A sample policy ships at `docs/examples/AGENTOWNERS.example`.
- **Admin approval queue and governance UI.** Admin AI settings now include policy status, parsed-rule previews, validation errors, default approval behavior, pending AI approval requests, and approve/reject controls that execute the original proposed payload only after approval.
- **Docker Hub update visibility for admins.** The admin Updates panel now checks the published `neuraparse/tasknebula` Docker Hub image in addition to GitHub releases, showing the latest tag, pushed time, digest, size, and Docker tag link. The check uses Docker Hub tag metadata, keeps the existing six-hour cache/manual refresh behavior, and chooses the most recently pushed semver tag instead of a stale larger semver.

### Changed

- **Self-signup is now invite-first for workspace access.** New registered users no longer gain broad organization/project power by default: organization creation is restricted to platform super-admins, organization/project listings only include active memberships, project creation/visibility is scoped by organization role or explicit project membership, and project membership changes require the target user to already be an active organization member.
- **Organization invites are safer and renewable.** Invite emails are normalized case-insensitively, expiry is configurable through `INVITE_TOKEN_TTL_DAYS` with a bounded 1-90 day range, resend refreshes pending invited-member tokens instead of leaving users stuck on expired links, and invite emails include the expiry window.

### Fixed

- **Issue detail modal: the close (X) no longer collides with the header, and right-sidebar field values no longer overflow.** The modal header (title + Star/Watch/Copy actions) is now padded clear of the Dialog's absolute close button in modal mode (full-page view is unchanged). In the details sidebar, every picker trigger (status, priority, assignee, components, fix/affects versions, resolution, due/start date, sprint, epic, parent, type) now truncates long values consistently instead of sliding past the control — fixed the flexbox truncation chain (`min-w-0 flex-1` on the value wrapper, `truncate` on the text, `shrink-0` on the icon/chevron) and dropped two dead imports surfaced along the way.

## [0.6.5] - 2026-06-20

### Fixed

- **New and updated issues now appear instantly — no page refresh.** Creating, editing, or moving an issue (Kanban/list, epics, sub-issues, AI-drafted issues, draft promotion, triage apply) now reflects the moment you act, instead of only after a manual reload. Root cause: the cache-invalidation predicate compared the server's project CUID against React Query caches keyed by the project **key** (boards are routed `/projects/<key>/board`), so the match never fired and the board never refetched. Every issue create/update/delete and the SSE realtime consumer now route through a single, key/CUID-agnostic `invalidateIssueCaches` helper (`apps/web/src/lib/realtime/issue-cache.ts`), and `useCreateIssue`/`useUpdateIssue`/`useDeleteIssue` do optimistic cache mutations so the card shows the instant the form is submitted and reconciles with the server row on success.

### Changed

- **Realtime event bus upgraded to Redis pub/sub (with an in-process fallback).** The SSE stream (`/api/events/stream`) that pushes issue/sprint/project events to other clients was an in-memory `EventEmitter` confined to a single Node process — it broke at >1 web replica and did not survive restarts. Events are now fanned out over Redis (origin-tagged so the publisher never double-delivers) and a per-process bridge pumps cross-instance events back into the local bus, so cross-client realtime survives multi-replica/restart deploys. Single-instance and no-Redis behaviour is byte-for-byte unchanged, and the 75 `publishEvent` call-sites are untouched. Mirrors the existing chat realtime transport.
- **Project view switcher shows view names on desktop.** The List/Board/Timeline/Calendar tabs stay compact icon-only on mobile and tablet, and now show the translated label beside the icon on wide (`lg`+) screens. No new strings — reuses the existing `issuesViews.shell.view_*` keys (already in all 30 locales); accessibility unchanged (the `aria-label` still names each icon-only tab).
- **Project nav tabs show labels on desktop too.** The project header tabs were icon-only at every size; they now reveal their label beside the icon on `lg`+ while staying compact icon-only on mobile/tablet. The hover tooltip is suppressed on desktop where the label is already visible (no redundant label), and kept on smaller screens. Reuses existing `pagesProjects.tab*` keys — no new strings.
- **De-cluttered the project view page (removed duplicate menus + dead UI).** Trimmed the project header nav to `Views / Sprints / Modules / Docs / Chat / Analytics` — the **Board** and **Backlog** tabs were removed because both are reachable as view modes inside "Views" (and still via direct URL); the header no longer mirrors the in-page view switcher. Inside the Views page, two toolbar sections that **never actually affected the issue list** were removed: the "advanced filter" bar (`ViewFilterBar` — its state was never applied to `filteredIssues`) and the "display options" control (`ViewDisplayOptions` — likewise inert). The real search/priority filter, Save view, and New issue actions are untouched, so the page keeps every working control while dropping the redundant ones.

### Added

- Unit tests for the issue-cache invalidation helpers (`matchesIssueList`, `issueBelongsInSprintList`, `issueMatchesListFilters`, `invalidateIssueCaches`) and the realtime event bus. Full web suite: 1409 unit tests green.

### Removed

- Dead UI with no remaining consumers after the Views toolbar cleanup: `components/issues/view-filter-bar.tsx`, `components/issues/view-display-options.tsx`, and `lib/issues/view-state.ts`.

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

[Unreleased]: https://github.com/neuraparse/tasknebula/compare/v0.7.5...HEAD
[0.7.5]: https://github.com/neuraparse/tasknebula/compare/v0.7.4...v0.7.5
[0.7.4]: https://github.com/neuraparse/tasknebula/compare/v0.7.3...v0.7.4
[0.7.3]: https://github.com/neuraparse/tasknebula/compare/v0.7.2...v0.7.3
[0.7.2]: https://github.com/neuraparse/tasknebula/compare/v0.7.1...v0.7.2
[0.7.1]: https://github.com/neuraparse/tasknebula/compare/v0.7.0...v0.7.1
[0.7.0]: https://github.com/neuraparse/tasknebula/compare/v0.6.9...v0.7.0
[0.6.9]: https://github.com/neuraparse/tasknebula/compare/v0.6.8...v0.6.9
[0.6.8]: https://github.com/neuraparse/tasknebula/compare/v0.6.7...v0.6.8
[0.6.7]: https://github.com/neuraparse/tasknebula/compare/v0.6.6...v0.6.7
[0.6.6]: https://github.com/neuraparse/tasknebula/compare/v0.6.5...v0.6.6
[0.6.5]: https://github.com/neuraparse/tasknebula/compare/v0.6.4...v0.6.5
[0.6.4]: https://github.com/neuraparse/tasknebula/compare/v0.6.3...v0.6.4
[0.6.3]: https://github.com/neuraparse/tasknebula/compare/v0.6.2...v0.6.3
[0.6.2]: https://github.com/neuraparse/tasknebula/compare/v0.6.1...v0.6.2
[0.6.1]: https://github.com/neuraparse/tasknebula/compare/v0.6.0...v0.6.1
[0.6.0]: https://github.com/neuraparse/tasknebula/compare/v0.5.1...v0.6.0
[0.5.1]: https://github.com/neuraparse/tasknebula/compare/v0.5.0...v0.5.1
[0.5.0]: https://github.com/neuraparse/tasknebula/compare/v0.4.0...v0.5.0
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
