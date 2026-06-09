---
paths:
  - 'packages/db/**/*.ts'
---

# Database rules (packages/db)

- **ORM**: Drizzle ORM + `postgres` client, PostgreSQL with pgvector. Schema in `src/schema/` (re-exported from `index.ts`).
- **Migrations**: edit schema TS → `pnpm db:generate` → review SQL in `drizzle/` → `pnpm db:migrate`. Never hand-edit generated SQL.
- **Multi-tenancy is mandatory**: every tenant-scoped table has an `organization_id` column and a Postgres **RLS** policy. Application queries must filter by `organization_id`.
- **Keys & data**: primary keys are CUID2 (`@paralleldrive/cuid2`); flexible attributes go in JSONB columns.
- **Indexes**: index `organization_id`, `project_id`, `user_id`, and other frequently queried columns.
- **Destructive changes** (drop/rename/type-narrow): call them out explicitly and provide a safe migration path; never silently lose data.
- pgvector tuning guidance: `packages/db/docs/PGVECTOR_TUNING.md`.
