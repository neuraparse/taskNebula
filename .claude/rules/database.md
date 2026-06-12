---
paths:
  - 'packages/db/**/*.ts'
---

# Database rules (packages/db)

- **ORM**: Drizzle ORM + `postgres` client, PostgreSQL with pgvector. Schema in `src/schema/` (re-exported from `index.ts`).
- **Migrations are hand-written SQL** (`drizzle-kit generate` is broken — meta snapshots frozen at `0012`; migrations `0013+` are all hand-written). Workflow: edit schema TS → hand-write an **idempotent** SQL file in `drizzle/` (`IF NOT EXISTS` / `duplicate_object` guards on every statement) → append a `drizzle/meta/_journal.json` entry whose `when` is **strictly greater** than the previous entry's (non-monotonic `when` values make drizzle silently skip migrations) → `pnpm db:migrate`. Use `0054_jira_parity_layer.sql` as the template.
- **Multi-tenancy is mandatory**: every tenant-scoped table has an `organization_id` column, and **application queries must filter by `organization_id`** — that app-level filtering is the _only_ isolation layer. Postgres **RLS is planned (roadmap #37) but NOT implemented** — never claim RLS exists or rely on a DB-level backstop.
- **Keys & data**: primary keys are CUID2 (`@paralleldrive/cuid2`); flexible attributes go in JSONB columns.
- **Indexes**: index `organization_id`, `project_id`, `user_id`, and other frequently queried columns.
- **Destructive changes** (drop/rename/type-narrow): call them out explicitly and provide a safe migration path; never silently lose data.
- pgvector tuning guidance: `packages/db/docs/PGVECTOR_TUNING.md`.
