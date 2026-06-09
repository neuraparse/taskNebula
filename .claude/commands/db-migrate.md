---
description: Generate a Drizzle migration from schema changes, review the SQL, then apply it
argument-hint: '[optional migration description]'
allowed-tools: Bash(pnpm db:generate:*), Bash(pnpm db:migrate:*), Read, Grep
---

Generate and apply a database migration for the change described as: $ARGUMENTS

Steps:

1. Run `pnpm db:generate` to create the migration from the current `packages/db/src/schema/` state.
2. Read the newly generated SQL in `packages/db/drizzle/` and summarize the delta (tables/columns/indexes/constraints). Flag any destructive operation (drop, rename, type narrowing) and STOP for confirmation before applying if found.
3. Verify any new tenant table has an `organization_id` column and an RLS policy.
4. If non-destructive (or confirmed), run `pnpm db:migrate` and report the result.

Never hand-edit generated migration SQL.
