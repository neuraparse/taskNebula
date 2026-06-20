# TaskNebula — Project Status

**Last updated:** 2026-06-12 · **Version:** 0.3.4 · **Status:** Beta, self-hostable (Docker Hub `neuraparse/tasknebula`)

> This is a short, honest snapshot. For the full picture use:
>
> - **`docs/AUDIT_2026-06.md`** — the June 2026 full-codebase audit (28 domain auditors + adversarial critic): every known gap with file/line evidence.
> - **`docs/ROADMAP_2026.md`** — per-item status of the 2026 plan (#1–27) and the H2-2026 extension (#28–50).
> - **`CHANGELOG.md`** — what shipped, release by release.

## By the numbers (at v0.3.4, commit c519e8e)

| Metric                                         | Value                                                                                                                                                                  |
| ---------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| API routes (`apps/web/src/app/api`)            | ~245                                                                                                                                                                   |
| Database tables (Drizzle, Postgres + pgvector) | 107 across 52 schema files                                                                                                                                             |
| Migrations                                     | 54 (`packages/db/drizzle/`)                                                                                                                                            |
| Jest                                           | 188 suites / ~1,219 tests (plus ~43 in `packages/mcp-server`)                                                                                                          |
| Playwright e2e                                 | 6 specs (not run in any pipeline)                                                                                                                                      |
| CI                                             | None at audit time; a minimal workflow (`.github/workflows/ci.yml`) lands in the current change-set. Still verify locally: `pnpm type-check && pnpm lint && pnpm test` |

## What genuinely works

- **Core PM**: issues (CRUD, links, subtasks, custom fields, attachments), projects, sprints with auto-rollover, kanban, backlog, time tracking, initiatives, intake forms, importers (Linear is the deepest).
- **Structural layer (new in 0.3.x)**: first-class **labels**, **project versions/releases**, **components**, and an **issue resolution model** (`resolution`/`resolvedAt`/`flagged`) — schema + REST APIs via migration 0054; UI is still minimal.
- **AI (real, not mocked)**: draft-with-AI, issue assist, triage, Ask RAG with citations (`/api/ask`), standup/janitor cron agents, agent-as-assignee (Linear Agent Protocol), per-org cost guard, OpenAI + Anthropic BYOK.
- **Realtime**: SSE live updates, presence, Yjs/Hocuspocus collaborative issue descriptions (client wired; production env wiring for the collab server is still missing).
- **Enterprise scaffolding**: SAML SSO + SCIM, audit logs + SIEM sinks, trust center, EU AI Act disclosures, permission/security scheme admin UIs.
- **Chat & calls**: project-scoped chat with threads (API), LiveKit audio calls.
- **Analytics**: burndown, velocity, project health, time-in-status, CSV/JSON export (parts of the modern chart suite exist but are unmounted).

## Known broken seams (the honest list)

Per the audit's executive summary — these are real, current, and being worked down:

1. **Tenant isolation**: RLS does not exist (app-level WHERE clauses only); ~20 API surfaces skipped even those. The cross-tenant route holes, org-scoped issue-key uniqueness, and the migration-journal ordering bug are fixed in the current change-set; RLS itself is roadmap #37.
2. **Last-mile wiring**: Cmd+K search 405 and the `/api/search` 500 are fixed in the current change-set; still dark: embedding worker (vector features inert), AI Sidecar stub over the finished `/api/ask`, API keys minted but accepted by no route (blocks public API + MCP server), OAuth sign-in mints sessions matching no DB user, chat attachment downloads.
3. **Enforcement gaps**: workflow transitions stored but never enforced; permission/security schemes configurable but enforced nowhere; feature flags gate nothing.
4. **Notifications**: mentions/watchers notify no one; core events are email-only; digests/push never send.
5. **Scale**: core list endpoints unpaginated; no board/list virtualization. (The in-process event bus that broke at >1 web replica is **fixed in the current change-set** — the realtime SSE bus now fans out over Redis pub/sub with an in-process fallback.)
6. **Ops**: CI absent until the current change-set (a minimal `ci.yml` now exists); `pnpm db:generate` broken (snapshots frozen at 0012); near-zero DB-integration tests.

## Where to contribute

Highest-leverage areas (see `docs/AUDIT_2026-06.md` §4 "Quick Wins" — most are <1 day):
closing the remaining cross-tenant guards, mounting orphaned finished UI (analytics bento,
time-tracking panel, settings pages), wiring the embedding worker and AI Sidecar, and API-key auth
(roadmap #39 — un-breaks the MCP server).

See [CONTRIBUTING.md](../CONTRIBUTING.md). Historical status documents live in `docs/archive/`.
