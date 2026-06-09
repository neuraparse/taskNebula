# TaskNebula — Claude Code Project Guide

AI-native, real-time, keyboard-first project management platform (Jira/Linear alternative).
Monorepo managed with **pnpm + Turborepo**. Node **>=22**, pnpm **>=9**, TypeScript **5.7** (strict).

> Always use `pnpm` (never `npm`/`yarn`). Run repo-wide commands from the root; they fan out via Turbo.

## Monorepo layout

| Path                  | Purpose                                                                 |
| --------------------- | ----------------------------------------------------------------------- |
| `apps/web`            | Next.js 15 (App Router, React 19) full-stack app — UI + REST API routes |
| `packages/db`         | Drizzle ORM schema (40+ tables), migrations, seed — Postgres + pgvector |
| `packages/types`      | Shared TypeScript domain types                                          |
| `packages/config`     | Shared ESLint / TS / Tailwind configs                                   |
| `packages/mcp-server` | `@tasknebula/mcp-server` — MCP server exposing TaskNebula tools         |
| `services/hocuspocus` | Standalone Yjs realtime collab server (WebSocket + Postgres + Redis)    |

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
pnpm db:generate      # generate Drizzle migration from schema changes
pnpm db:migrate       # apply migrations (tsx packages/db/src/migrate.ts)
pnpm db:studio        # Drizzle Studio
pnpm db:reset         # full reset (scripts/reset-db.sh)

# Web app (cd apps/web)
pnpm dev              # next dev (port 3000)
pnpm test             # jest
pnpm tests:e2e        # playwright test  (note the plural "tests:")
pnpm openapi:gen      # regenerate public/openapi.json
```

**Before committing** run `pnpm type-check` and `pnpm lint`. Husky `pre-commit` runs lint-staged (ESLint + Prettier); `commit-msg` runs commitlint.

## Conventions

- **Commits**: Conventional Commits — `type(scope): subject`, header ≤120 chars. Allowed types include the standard set plus `infra`, `ai`, `integrations`. e.g. `feat(kanban): add drag-and-drop`.
- **Branches**: `feature/`, `fix/`, `docs/`, `refactor/`, `test/`.
- **TypeScript**: explicit types, avoid `any`. Base config is strict; `apps/web` opts out of `exactOptionalPropertyTypes` while ~146 violations are migrated (see `docs/TS_STRICT_MIGRATION.md`). Don't introduce new violations.
- **Path aliases** (apps/web): `@/*`, `@/components/*`, `@/lib/*`, `@/app/*`.
- **Design system**: follow `apps/web/DESIGN_SYSTEM.md` (square-ish radii: `rounded-sm`=2px pills, `rounded-md`=4px default, `rounded-lg`=6px cards; semantic `accent-*` colors; spring motion 150–200ms; first-class dark mode). See `.claude/rules/frontend.md`.

## apps/web structure

- `src/app/(marketing)/` — public pages · `src/app/(app)/` — authenticated routes · `src/app/api/` — REST endpoints · `[locale]/` — next-intl i18n.
- `src/components/` — `ui/` (shadcn/Radix base), `layout/`, `kanban/`, `issues/`, `forms/`, `ai/`, `dashboard/`, etc.
- State: TanStack Query (server), Zustand (UI), React Hook Form + Zod (forms).
- Auth: NextAuth v5 (beta). Realtime: Tiptap + Yjs via `@hocuspocus/provider`.

## Database

- **Drizzle ORM**. Schema: `packages/db/src/schema/index.ts`. Config: `packages/db/drizzle.config.ts`. Migrations in `packages/db/drizzle/`.
- Workflow: edit schema → `pnpm db:generate` → review SQL → `pnpm db:migrate`. **Never hand-edit generated migrations.**
- Multi-tenant: `organization_id` on every table, Postgres **RLS** for isolation. PKs are CUID2. Flexible data in JSONB. See `.claude/rules/database.md`.

## Git, branches & PRs

- Remote is **SSH**: `git@github.com:neuraparse/taskNebula.git`. Default branch: `main`.
- **Push work directly to `main`** (`git push origin main`) — this repo's owner prefers no branch/PR ceremony for normal work. Commits are authored as **Neura Parse `<hello@neuraparse.com>`**.
- Only commit/push when the user asks (push is irreversible/outward-facing). Use Conventional Commit messages (see Conventions).
- There is **no CI workflow yet**, so verify locally before every push: `pnpm type-check && pnpm lint && pnpm test` (or `/verify`). This repo is **open-source** — never commit secrets (see `.gitignore` hardening; `.env`, certs, keys, local files are ignored).
- External contributors still use branches + PRs (`.github/PULL_REQUEST_TEMPLATE.md`); the direct-to-main rule is for the maintainer's own Claude-assisted work.

## Releases & Docker images

- **Versioning**: SemVer, single source is `package.json` `version` (currently `0.3.3`). Changelog follows _Keep a Changelog_ in `CHANGELOG.md` (`[Unreleased]` → new version section).
- **Image**: published to **Docker Hub** as `neuraparse/tasknebula` (the machine's `docker login` is the `neuraparse` account). Platform `linux/amd64`, runtime port `3000`, health at `GET /api/health`. The web image is a Next.js **standalone** build (`Dockerfile`, entrypoint runs migrations).
- **Build & push** a release:
  ```bash
  docker compose build web                                   # or: docker build -t neuraparse/tasknebula:<v> --build-arg NEXT_PUBLIC_APP_URL=https://app.example.com .
  docker tag neuraparse/tasknebula:latest neuraparse/tasknebula:<v>
  docker push neuraparse/tasknebula:<v> && docker push neuraparse/tasknebula:latest
  ```
- **Version bump touches**: `package.json`, `apps/web/package.json`, `docker-compose.desktop.yml`, README `0.3.3` references, then regenerate `apps/web/public/openapi.json` via `pnpm openapi:gen`. `docker-compose.yml` web service defaults to `:latest` and is overridable with `TASKNEBULA_IMAGE`.
- Full step-by-step runbook: **`docs/RELEASE.md`**. To cut a release with Claude, use the `/release` command; to push work safely, use `/ship`.

## Current state & gotchas

The project is mid-build (Phase 1). Treat these as known, not bugs to "fix" silently:

- **Auth** (NextAuth v5) scaffolded; OAuth providers not fully wired.
- **AI features** return mock responses; real LLM integration pending.
- **Realtime**: Hocuspocus deployed but not fully wired into the web app.
- **Tests**: Jest + Playwright configured but coverage is near-zero — add tests with new features.
- See `docs/STATUS.md`, `docs/GAPS_AND_ISSUES_SUMMARY.md`, `docs/ROADMAP_2026.md` for the live picture.

## Realtime collab

`services/hocuspocus` hosts Yjs docs backing collaborative editing. Web connects via `NEXT_PUBLIC_HOCUSPOCUS_URL`; JWTs minted at `/api/collab/token` (verified with `AUTH_SECRET`/`NEXTAUTH_SECRET`). State persists to Postgres; Redis pub/sub for multi-instance scale-out.

## Pointers

- Env template: `.env.example` · Setup: `scripts/setup.sh` (`pnpm setup`)
- Architecture: `docs/ARCHITECTURE.md` · Contributing: `CONTRIBUTING.md` · Quick start: `docs/QUICK_START.md`
