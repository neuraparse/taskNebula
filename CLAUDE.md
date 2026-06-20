# TaskNebula — Claude Code Project Guide

AI-native, real-time, keyboard-first project management platform (Jira/Linear alternative).
Monorepo managed with **pnpm + Turborepo**. Node **>=22**, pnpm **>=9**, TypeScript **5.7** (strict).

> Always use `pnpm` (never `npm`/`yarn`). Run repo-wide commands from the root; they fan out via Turbo.

## Monorepo layout

| Path                  | Purpose                                                                  |
| --------------------- | ------------------------------------------------------------------------ |
| `apps/web`            | Next.js 15 (App Router, React 19) full-stack app — UI + REST API routes  |
| `packages/db`         | Drizzle ORM schema (100+ tables), migrations, seed — Postgres + pgvector |
| `packages/types`      | Shared TypeScript domain types                                           |
| `packages/config`     | Shared ESLint / TS / Tailwind configs                                    |
| `packages/mcp-server` | `@tasknebula/mcp-server` — MCP server exposing TaskNebula tools          |
| `services/hocuspocus` | Standalone Yjs realtime collab server (WebSocket + Postgres + Redis)     |

## Commands

Run from repo root unless noted. Build/lint/type-check/test fan out across workspaces via Turbo.

```bash
pnpm dev              # start all workspaces in dev
pnpm build            # build all (runs openapi:gen first)
pnpm lint             # ESLint across monorepo
pnpm type-check       # tsc --noEmit across all packages
pnpm test             # Jest across monorepo
pnpm format           # Prettier write **/*.{ts,tsx,md,json}

# Database (packages/db)
pnpm db:migrate       # apply migrations (tsx packages/db/src/migrate.ts)
pnpm db:studio        # Drizzle Studio
pnpm db:reset         # full reset (scripts/reset-db.sh)
# also in packages/db: db:seed, db:seed:prod, db:migrate:prod, db:push, db:setup
# NOTE: pnpm db:generate (drizzle-kit generate) is BROKEN — snapshots frozen at 0012.
# Migrations are hand-written SQL; see the Database section below.

# Web app (cd apps/web)
pnpm dev              # next dev (port 3000)
pnpm test             # jest
pnpm tests:e2e        # playwright test  (note the plural "tests:")
pnpm openapi:gen      # regenerate public/openapi.json
```

> `openapi:gen` does **not** exist as a root script — from the repo root use
> `pnpm --filter @tasknebula/web openapi:gen`.

**Before committing** run `pnpm type-check` and `pnpm lint`. Husky `pre-commit` runs lint-staged (ESLint + Prettier); `commit-msg` runs commitlint.

## Conventions

- **Commits**: Conventional Commits — `type(scope): subject`, header ≤120 chars. Allowed types include the standard set plus `infra`, `ai`, `integrations`. e.g. `feat(kanban): add drag-and-drop`.
- **Branches**: `feature/`, `fix/`, `docs/`, `refactor/`, `test/`.
- **TypeScript**: explicit types, avoid `any`. Base config is strict; `apps/web` opts out of `exactOptionalPropertyTypes` while ~146 violations are migrated (see `docs/TS_STRICT_MIGRATION.md`). Don't introduce new violations.
- **Path aliases** (apps/web): `@/*`, `@/components/*`, `@/lib/*`, `@/app/*`.
- **Design system**: follow `apps/web/DESIGN_SYSTEM.md` (square-ish radii: `rounded-sm`=2px pills, `rounded-md`=4px default, `rounded-lg`=6px cards; semantic `accent-*` colors; spring motion 150–200ms; first-class dark mode). See `.claude/rules/frontend.md`.
- **i18n is MANDATORY — zero hardcoded user-facing strings.** The app ships **30 languages** with device/browser auto-detection. EVERY user-facing string (JSX text **and** props like `placeholder`/`aria-label`/`title`/`alt`/`label`/`description`, plus `toast`/error messages) MUST go through `next-intl` — `useTranslations('ns')` in client components, `await getTranslations('ns')` in async server components. Add the English key to `apps/web/messages/en.json` **and the same key, translated, to all 30 locale catalogs** (`apps/web/messages/*.json`); keep full key parity (`node scripts/i18n-check.mjs`). Preserve ICU placeholders/plurals verbatim. The only English-only surface is the marketing landing (`components/marketing/*`). Lint (`react/jsx-no-literals`) blocks new hardcoded JSX text. **All future work — by any assistant (Claude/Cursor/Codex/…) — must follow this.** See `.claude/rules/frontend.md` and `.cursor/rules/i18n.mdc`.

## apps/web structure

- `src/app/(marketing)/` — public pages · `src/app/(app)/` — authenticated routes · `src/app/api/` — REST endpoints · `[locale]/` — next-intl i18n.
- `src/components/` — `ui/` (shadcn/Radix base), `layout/`, `kanban/`, `issues/`, `forms/`, `ai/`, `dashboard/`, etc.
- State: TanStack Query (server), Zustand (UI), React Hook Form + Zod (forms).
- Auth: NextAuth v5 (beta). Realtime: Tiptap + Yjs via `@hocuspocus/provider`.

## Database

- **Drizzle ORM**. ~113 tables across 53 schema files in `packages/db/src/schema/` (re-exported from `index.ts`) — it was 107 tables / 52 files before the 0054 parity layer, so old "40+ tables" claims are badly stale. Config: `packages/db/drizzle.config.ts`. Migrations in `packages/db/drizzle/`.
- **Migration workflow (hand-written SQL is the convention here)**: `drizzle-kit generate` is **broken** — snapshots are frozen at `0012`, so `pnpm db:generate` produces garbage. Migrations `0013+` are hand-written SQL files in `packages/db/drizzle/` plus a matching entry in `drizzle/meta/_journal.json`. Workflow: edit schema TS → write an **idempotent** SQL migration by hand (`IF NOT EXISTS` / `duplicate_object` exception guards on every statement) → append a `_journal.json` entry whose `when` is **strictly greater** than the previous entry's → `pnpm db:migrate`. See `packages/db/CLAUDE.md` for the full recipe.
- **Structural layer (migration `0054_jira_parity_layer`)**: first-class `labels` + `issue_labels` (replacing the legacy `issues.labels` JSONB array — keep back-compat reads in mind), `project_versions` + `issue_fix_versions`/`issue_affects_versions`, `components` + `issue_components`, and `issues.resolution`/`resolved_at`/`flagged`.
- Multi-tenant: `organization_id` on every tenant-scoped table; isolation is **app-level `WHERE` clauses** (Postgres RLS is planned, **not implemented** — never claim RLS exists). PKs are CUID2. Flexible data in JSONB. See `.claude/rules/database.md`.

## Git, branches & PRs

- Remote is **SSH**: `git@github.com:neuraparse/taskNebula.git`. Default branch: `main`.
- **Push work directly to `main`** (`git push origin main`) — this repo's owner prefers no branch/PR ceremony for normal work. Commits are authored as **Neura Parse `<hello@neuraparse.com>`**.
- Only commit/push when the user asks (push is irreversible/outward-facing). Use Conventional Commit messages (see Conventions).
- CI (`.github/workflows/ci.yml`) runs type-check, lint, and tests on every push/PR to `main` — but it is minimal and pushes go straight to `main`, so **still verify locally before every push**: `pnpm type-check && pnpm lint && pnpm test` (or `/verify`). This repo is **open-source** — never commit secrets (see `.gitignore` hardening; `.env`, certs, keys, local files are ignored).
- External contributors still use branches + PRs (`.github/PULL_REQUEST_TEMPLATE.md`); the direct-to-main rule is for the maintainer's own Claude-assisted work.

## Releases & Docker images

- **Versioning**: SemVer, single source of truth is the root `package.json` `version` (check it — do not trust hardcoded versions in docs). Changelog follows _Keep a Changelog_ in `CHANGELOG.md` (`[Unreleased]` → new version section).
- **Image**: published to **Docker Hub** as `neuraparse/tasknebula` (the machine's `docker login` is the `neuraparse` account). Platform `linux/amd64`, runtime port `3000`, health at `GET /api/health`. The web image is a Next.js **standalone** build (`Dockerfile`, entrypoint runs migrations).
- **Build & push** a release:
  ```bash
  docker compose build web                                   # or: docker build -t neuraparse/tasknebula:<v> --build-arg NEXT_PUBLIC_APP_URL=https://app.example.com .
  docker tag neuraparse/tasknebula:latest neuraparse/tasknebula:<v>
  docker push neuraparse/tasknebula:<v> && docker push neuraparse/tasknebula:latest
  ```
- **Version bump touches**: `package.json`, `apps/web/package.json`, `docker-compose.desktop.yml`, README version references, then regenerate `apps/web/public/openapi.json` via `pnpm --filter @tasknebula/web openapi:gen`. `docker-compose.yml` web service defaults to `:latest` and is overridable with `TASKNEBULA_IMAGE`.
- Full step-by-step runbook: **`docs/RELEASE.md`**. To cut a release with Claude, use the `/release` command; to push work safely, use `/ship`.

## Current state & gotchas

Most backends are real and substantial; the recurring failure mode is **last-mile wiring**, not missing implementation. Treat these as the known, accurate state (the older "everything is mocked" framing was wrong):

- **AI features are REAL** — actual OpenAI + Anthropic calls with a cost guard (`runWithBudget`), tracing, and a complete `/api/ask` RAG endpoint. Several last-mile seams were broken (Cmd+K search/palette payloads, the AI Sidecar stub, the idle embedding worker) and are being fixed in the June 2026 changeset — don't reintroduce stubs.
- **Tests**: 188 suites / ~1,200 unit tests in `apps/web` plus MCP-server tests and 6 Playwright e2e specs. `packages/db` and `services/hocuspocus` have **zero** tests — add coverage there when you touch them.
- **Realtime**: Hocuspocus **is** wired client-side (Tiptap + `@hocuspocus/provider`), but the collab env vars (`NEXT_PUBLIC_HOCUSPOCUS_URL` etc.) are not passed into the Docker images/compose files — collab is dark in containerized deploys until that's plumbed.
- **OAuth is genuinely broken**: GitHub/Google providers register, but there is no DB adapter — OAuth sessions carry a provider profile id that matches no `users` row, so every org-scoped API call 401s/403s for OAuth users.
- **RLS is PLANNED, not implemented**: tenant isolation is app-level `WHERE organization_id = ...` clauses only. Never claim or rely on Postgres RLS; never skip the org filter.
- See `docs/AUDIT_2026-06.md`, `docs/STATUS.md`, and `docs/ROADMAP_2026.md` for the live picture.

## Realtime collab

`services/hocuspocus` hosts Yjs docs backing collaborative editing. Web connects via `NEXT_PUBLIC_HOCUSPOCUS_URL`; JWTs minted at `/api/collab/token` (verified with `AUTH_SECRET`/`NEXTAUTH_SECRET`). State persists to Postgres; Redis pub/sub for multi-instance scale-out.

Separately — and distinct from the Yjs collab above — lightweight **issue/sprint/project events** that keep boards and lists live flow over a **Server-Sent Events** stream at `/api/events/stream`. Mutating API routes call `publishEvent` (`apps/web/src/lib/realtime/events.ts`); delivery is in-process by default and **fans out over Redis pub/sub when `REDIS_URL` is set** (origin-tagged per process to avoid double-delivery), so realtime survives multi-replica/restart deploys. The stream is org-scoped (events without an `organizationId` are dropped, fail-closed). On the client, every issue create/update/delete and the SSE consumer (`use-realtime-sync.ts`) invalidate caches through the shared `invalidateIssueCaches` helper, which is **key/CUID-agnostic** — boards are keyed by the project _key_, never scope issue-cache invalidation by a server CUID (see `apps/web/src/lib/realtime/issue-cache.ts`).

## Per-package guides

Each major workspace has its own nested `CLAUDE.md` (with a sibling `AGENTS.md` pointer for codex-convention tools) — read the one for the package you're editing:

- `apps/web/CLAUDE.md` — route auth idiom, validation, i18n, design system
- `packages/db/CLAUDE.md` — hand-written migration recipe, journal rules, tenancy
- `packages/mcp-server/CLAUDE.md` — tool surface, auth caveat, publish status
- `services/hocuspocus/CLAUDE.md` — JWT auth, persistence, env vars

## Pointers

- Env template: `.env.example` · Setup: `scripts/setup.sh` (`pnpm setup`)
- Architecture: `docs/ARCHITECTURE.md` · Contributing: `CONTRIBUTING.md` · Quick start: `docs/QUICK_START.md`
- Live state: `docs/AUDIT_2026-06.md` + `docs/STATUS.md` + `docs/ROADMAP_2026.md` (`docs/GAPS_AND_ISSUES_SUMMARY.md` is archived/superseded — don't use it)
