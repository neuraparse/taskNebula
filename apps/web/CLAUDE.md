# apps/web — Next.js full-stack app

Next.js 15 (App Router) + React 19. UI **and** the REST API (`src/app/api/**`, ~245 routes).
Root guide: `/CLAUDE.md`. Run commands from `apps/web/` unless noted.

## Commands

```bash
pnpm dev               # next dev (port 3000)
pnpm build             # next build
pnpm test              # jest (188 suites / ~1,200 tests — keep them green)
pnpm tests:e2e         # playwright test (plural "tests:"); tests:e2e:ui for UI mode
pnpm type-check        # tsc --noEmit
pnpm lint              # next lint
pnpm openapi:gen       # regenerate public/openapi.json (openapi:check verifies no drift)
```

## Layout

- `src/app/(marketing)/` public · `src/app/(app)/` authenticated · `src/app/api/` REST · `[locale]/` next-intl i18n.
- `src/components/` — `ui/` (shadcn/Radix), `layout/`, `kanban/`, `issues/`, `forms/`, `ai/`, `dashboard/`, …
- `src/lib/` — domain logic; `src/lib/auth/` holds the canonical guards.
- State: TanStack Query (server), Zustand (UI), React Hook Form + Zod (forms). Aliases: `@/*`, `@/components/*`, `@/lib/*`, `@/app/*`.

## API route conventions

- **Auth idiom**: `const session = await auth();` (from `@/auth`), 401 on no session, then a permission check
  (e.g. `checkIssuePermission` in `api/issues/route.ts`). Prefer the **canonical guards** in
  `src/lib/auth/access-control.ts` and `src/lib/auth/guards.ts` over hand-rolled checks — hand-rolled per-route
  auth is the systemic cause of the audited cross-tenant holes.
- **Tenant scoping**: every query filters by the caller's `organization_id`. There is **no RLS backstop** — a
  forgotten WHERE clause is a cross-org breach. Never trust org/project ids from the request body.
- **Validation**: Zod on every body/query — use `withValidation` from `src/lib/api-validation.ts` (400 with
  `VALIDATION_FAILED` on failure).
- Keep `public/openapi.json` in sync (`pnpm openapi:gen`); audit-log mutating actions where the schema supports it.

## Gotchas

- **Labels back-compat**: first-class `labels`/`issue_labels` tables (migration 0054) are now the source of
  truth, but the legacy `issues.labels` JSONB string array still exists — check ownership/back-compat before
  reading or writing either side; don't filter labels with `LIKE` on the JSONB.
- **OAuth is broken** (no DB adapter — sessions map to no `users` row); credentials auth works.
- i18n is next-intl with `[locale]` routing — no hardcoded locale strings or `en-US` date calls.
- **Design system**: `apps/web/DESIGN_SYSTEM.md` — `rounded-md` (4px) default, `rounded-sm` pills, `rounded-lg`
  cards; semantic `accent-*` colors; dark mode first-class. See `.claude/rules/frontend.md` + `.claude/rules/api.md`.
