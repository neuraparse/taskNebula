# packages/db — Drizzle ORM schema & migrations

Postgres + pgvector. ~113 tables across 53 schema files in `src/schema/` (re-exported from `index.ts`).
Root guide: `/CLAUDE.md`. Zero tests today — add coverage when you touch this package.

## Commands (run in packages/db)

```bash
pnpm db:migrate        # apply migrations (tsx src/migrate.ts)
pnpm db:migrate:prod   # tsx scripts/migrate.ts
pnpm db:seed           # dev seed (WIPES tables — never against real data); db:seed:prod for prod seeder
pnpm db:studio         # Drizzle Studio
pnpm db:push           # drizzle-kit push (dev only — bypasses the journal)
pnpm type-check && pnpm lint
```

## Migration convention (IMPORTANT — overrides generic Drizzle docs)

- `pnpm db:generate` (drizzle-kit generate) is **BROKEN**: snapshots in `drizzle/meta/` are frozen at `0012`.
  Do not use it. Migrations `0013+` are **hand-written SQL** — that is the convention here.
- Recipe: edit schema TS → hand-write `drizzle/NNNN_name.sql` → append an entry to `drizzle/meta/_journal.json`.
- **Idempotency is required**: every statement must be safe to re-run — `CREATE TABLE IF NOT EXISTS`,
  `ALTER TABLE ... ADD COLUMN IF NOT EXISTS`, `DO $$ BEGIN ... EXCEPTION WHEN duplicate_object THEN NULL; END $$`
  for enums/constraints. Migrations re-run on journal-repaired databases (see `0054_jira_parity_layer.sql` as
  the template).
- **Journal ordering rule**: each new `_journal.json` entry's `when` must be **strictly greater** than the
  previous entry's (drizzle applies a migration only if `created_at < folderMillis`; non-monotonic values
  silently skip migrations — this already bit 0032/0044–0051 historically).
- Verify in a scratch container before shipping:
  ```bash
  docker run -d --name db-scratch -e POSTGRES_PASSWORD=pg -p 5499:5432 pgvector/pgvector:pg16
  DATABASE_URL=postgres://postgres:pg@localhost:5499/postgres pnpm db:migrate   # run twice: must be idempotent
  docker rm -f db-scratch
  ```

## Schema rules

- PKs are **CUID2** via `createId()` from `@paralleldrive/cuid2` (never UUID).
- Every tenant-scoped table carries `organization_id`; index `organization_id`, `project_id`, and FKs.
- **RLS is NOT implemented** (planned — roadmap #37). Isolation is app-level WHERE clauses only; never claim RLS.
- Structural layer (0054): `labels`/`issue_labels`, `project_versions` + `issue_fix_versions`/`issue_affects_versions`,
  `components`/`issue_components`, `issues.resolution`/`resolved_at`/`flagged`; issue keys unique per
  `(organization_id, key)` — not globally.
- Avoid `: any` on table exports (use `AnyPgColumn` for self-references); it erases inference for all consumers.
- See `.claude/rules/database.md` and `docs/PGVECTOR_TUNING.md`.
