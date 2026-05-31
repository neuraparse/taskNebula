# TaskNebula web — Playwright E2E suite

End-to-end tests for the Next.js app in `apps/web`, driven by
[Playwright](https://playwright.dev). The suite covers signup, first-run
workspace setup, the issue lifecycle, the Kanban board, the Cmd+K command
palette, and the AI draft dialog across Chromium, Firefox, and WebKit.

## Layout

```
apps/web/
  playwright.config.ts        # web server + 3 browser projects + storage state
  e2e/
    .auth/                    # storage state (gitignored)
    fixtures/seed.ts          # deterministic seeder (idempotent)
    auth.setup.ts             # signs in once, persists storage state
    signup.spec.ts            # public — email/password registration
    workspace-setup.spec.ts   # public — first-run admin wizard
    issue-lifecycle.spec.ts   # authed — create → priority → assign → close
    kanban-board.spec.ts      # authed — keyboard DnD + API persistence
    cmd-k-palette.spec.ts     # authed — Cmd+K, search "create issue"
    ai-draft.spec.ts          # authed — Draft with AI (route stubbed)
```

## One-time setup

```bash
# From the repo root:
pnpm install
pnpm --filter @tasknebula/web exec playwright install --with-deps
```

`--with-deps` installs Linux shared libraries needed by Chromium/Firefox/WebKit
and may prompt for sudo. Drop the flag if you already have the host deps.

You also need a Postgres reachable through `DATABASE_URL`. Locally we use the
compose stack:

```bash
docker compose up -d postgres redis
pnpm --filter @tasknebula/db db:migrate
```

## Running the suite

```bash
# Full headless run (all browsers)
pnpm --filter @tasknebula/web tests:e2e

# Interactive UI mode — best for authoring & debugging
pnpm --filter @tasknebula/web tests:e2e:ui

# Single spec, single browser
pnpm --filter @tasknebula/web exec playwright test e2e/cmd-k-palette.spec.ts --project=chromium
```

Playwright auto-starts `pnpm dev` on `http://localhost:3000` (and reuses the
server if it is already running locally). Override with `PLAYWRIGHT_BASE_URL`
to point at a deployed environment.

## How auth + seeding works

`auth.setup.ts` runs _before_ every authed project and:

1. Calls `ensureSeed()` to insert (idempotently) the `E2E Workspace`
   organization, an admin user (`e2e-admin@tasknebula.test` /
   `E2eAdmin!2026`), a project `E2E`, a workflow with three statuses, and
   five seed issues (`E2E-1`..`E2E-5`).
2. POSTs credentials to `/api/auth/callback/credentials` with a fresh CSRF
   token, then visits `/dashboard` to materialize the session cookies.
3. Writes the resulting `storageState` to `e2e/.auth/admin.json`, which is
   then shared by every authed project via the `storageState` use option.

The two public specs (`signup`, `workspace-setup`) run without storage state
under the `chromium-public` project.

## Artifacts

- `apps/web/test-results/` — per-test output (HTML report, traces, video).
- Traces and screenshots are captured _only on failure_ to keep the working
  directory small. Open the HTML report with
  `pnpm --filter @tasknebula/web exec playwright show-report`.

## CI

When CI coverage is restored, run this suite on pull requests with Postgres
and Redis service containers, apply migrations, run the seeder, execute the
suite, and upload trace artifacts on failure.

## Known follow-ups

- **AI mocking strategy.** `ai-draft.spec.ts` currently mocks the
  `/api/ai/draft-issues` endpoint via `page.route(...)`. The intended
  replacement is a server-side stub keyed off `PLAYWRIGHT_AI_STUB=1` (set in
  the Playwright webServer config) so we exercise the real handler against a
  fake provider.
- **Sharding.** CI currently runs a single shard. For larger suites switch to
  `--shard=N/M` and emit JUnit so GitHub annotations group correctly.
- **Visual regression.** Not in scope here; covered in the design-system QA
  task.
