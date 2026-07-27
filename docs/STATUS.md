# TaskNebula — Project Status

**Last updated:** 2026-07-27 · **Version:** 0.14.0 · **Status:** Beta, self-hostable (Docker Hub `neuraparse/tasknebula`)

> This is a short, honest snapshot. For the full picture use:
>
> - **`docs/AUDIT_2026-06.md`** — the June 2026 full-codebase audit (28 domain auditors + adversarial critic): every known gap with file/line evidence.
> - **`docs/ROADMAP_2026.md`** — per-item status of the 2026 plan (#1–27) and the H2-2026 extension (#28–50).
> - **`CHANGELOG.md`** — what shipped, release by release.

## By the numbers (at v0.14.0, current tree)

| Metric                                         | Value                                                                                                             |
| ---------------------------------------------- | ----------------------------------------------------------------------------------------------------------------- |
| API routes (`apps/web/src/app/api`)            | 280 route handlers                                                                                                |
| Database tables (Drizzle, Postgres + pgvector) | 115 across 55 schema files                                                                                        |
| Migrations                                     | 54 (`packages/db/drizzle/`)                                                                                       |
| Jest                                           | Web: 273 suites / 1,673 passed + 1 skipped; mobile: 75 suites / 372 passed; MCP: 45 passed                        |
| Playwright e2e                                 | 8 specs; authenticated Chromium flow plus a 42-case public desktop/mobile light/dark matrix are covered           |
| CI                                             | Minimal workflow in `.github/workflows/ci.yml`; still verify locally: `pnpm type-check && pnpm lint && pnpm test` |

## What genuinely works

- **Core PM**: issues (CRUD, links, subtasks, custom fields, attachments), projects, sprints with auto-rollover, kanban, backlog, time tracking, initiatives, intake forms, importers (Linear is the deepest).
- **Structural layer (new in 0.3.x)**: first-class **labels**, **project versions/releases**, **components**, and an **issue resolution model** (`resolution`/`resolvedAt`/`flagged`) — schema + REST APIs via migration 0054; UI is still minimal.
- **AI (real, not mocked)**: draft-with-AI, issue assist, triage, Ask RAG with citations (`/api/ask`), standup/janitor cron agents, agent-as-assignee (Linear Agent Protocol), per-org cost guard, OpenAI + Anthropic BYOK.
- **Realtime**: SSE live updates, presence, Yjs/Hocuspocus collaborative issue descriptions (Docker env wiring and the Hocuspocus runtime are covered; hosted WebSocket/device smoke still remains).
- **Enterprise scaffolding**: SAML SSO + SCIM, audit logs + SIEM sinks, trust center, EU AI Act disclosures, permission/security scheme admin UIs.
- **Chat & calls**: project-scoped chat with threads (API), LiveKit audio calls.
- **Analytics**: burndown, velocity, project health, time-in-status, CSV/JSON export (parts of the modern chart suite exist but are unmounted).

## Known broken seams (the honest list)

Per the audit's executive summary — these are real, current, and being worked down:

1. **Tenant isolation**: RLS does not exist (app-level WHERE clauses only); ~20 API surfaces skipped even those. The cross-tenant route holes, org-scoped issue-key uniqueness, and the migration-journal ordering bug are fixed in the current change-set; RLS itself is roadmap #37.
2. **Last-mile wiring**: Cmd+K search and the `/api/search` route are wired; the Ask sidecar now consumes `/api/ask` SSE and embeddings have a cron drain endpoint, while API-key/MCP authentication lacks a full live end-to-end check, Build mode remains a deliberate stub, and chat attachment downloads are incomplete.
3. **Enforcement gaps**: workflow transitions stored but never enforced; permission/security schemes configurable but enforced nowhere; feature flags gate nothing.
4. **Notifications**: mentions/watchers notify no one; core events are email-only; digests/push never send.
5. **Scale**: core list endpoints unpaginated; no board/list virtualization. (The in-process event bus that broke at >1 web replica is **fixed in the current change-set** — the realtime SSE bus now fans out over Redis pub/sub with an in-process fallback.)
6. **Ops**: `pnpm db:generate` remains broken (snapshots frozen at 0012); DB integration coverage is still sparse, and external OAuth/AI/LiveKit credentials are required for full provider-flow verification.

## Where to contribute

Highest-leverage areas (see `docs/AUDIT_2026-06.md` §4 "Quick Wins" — most are <1 day):
closing the remaining cross-tenant guards, mounting orphaned finished UI (analytics bento,
time-tracking panel, settings pages), wiring the embedding worker, and API-key auth (roadmap #39 —
un-breaks the MCP server).

See [CONTRIBUTING.md](../CONTRIBUTING.md). Historical status documents live in `docs/archive/`.
