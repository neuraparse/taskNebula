# TypeScript Strict Migration

**Task:** QUAL-21 — TS strict null checks + `any` cleanup
**Last updated:** 2026-05-14

This document tracks the incremental rollout of stricter TypeScript compiler
options across the TaskNebula monorepo. The goal is to land one flag per
iteration, fix or temporarily exempt the surfacing errors, and revisit until
every package runs the full strict surface.

## Current baseline

`packages/config/tsconfig.base.json` already enables:

- `"strict": true` — bundles `noImplicitAny`, `strictNullChecks`,
  `strictFunctionTypes`, `strictBindCallApply`, `strictPropertyInitialization`,
  `noImplicitThis`, `useUnknownInCatchVariables`, `alwaysStrict`.
- `"noUncheckedIndexedAccess": true` — every `arr[i]` / `obj[key]` returns
  `T | undefined`, forcing the caller to narrow.
- `"exactOptionalPropertyTypes": true` — **newly enabled in this iteration**.
  `foo?: string` no longer accepts `{ foo: undefined }`; you must omit the
  property or widen the type to `foo?: string | undefined`.

The base flag is inherited by every package. Two packages currently opt out
while their codebases are migrated:

| Package         | `exactOptionalPropertyTypes` | Surfacing errors | Notes |
| --------------- | ---------------------------- | ---------------- | ----- |
| `@tasknebula/config`  | n/a (no source) | — | — |
| `@tasknebula/types`   | **on**          | 0 | Beachhead. New types must satisfy the strict shape. |
| `@tasknebula/db`      | off             | 2 | drizzle-orm insert types use `T \| null`, not `T \| undefined`. |
| `@tasknebula/web`     | off             | 146 | Largest surface; needs file-by-file migration. |

Per-package opt-outs live in each package's `tsconfig.json` with a `QUAL-21`
comment pointing back here.

## Rollout plan

### Priority order for future flags

Pick **one** flag per iteration. Run `pnpm type-check`, log new error counts,
fix small files properly, suppress the rest with a file-level marker, then
move on.

1. ~~`noUncheckedIndexedAccess`~~ — already on as of the initial commit.
2. ~~`exactOptionalPropertyTypes`~~ — **enabled in base this iteration**; off
   in `@tasknebula/db` and `@tasknebula/web` until the surfacing errors are
   fixed.
3. `noPropertyAccessFromIndexSignature` — forces `obj["key"]` instead of
   `obj.key` for index-signature types. Low-impact; mostly cosmetic.
4. `noImplicitOverride` — requires `override` keyword on subclass methods.
   Negligible impact in this codebase (few classes).
5. `useUnknownInCatchVariables` — already on via `strict: true`. Verify no
   `// @ts-expect-error` workarounds remain.
6. Finally, retire the ~325 `any` casts. ESLint
   (`@typescript-eslint/no-explicit-any`) should flip from `warn` to `error`
   once the count is below ~50.

### Per-iteration workflow

1. **Enable the flag** in `packages/config/tsconfig.base.json`.
2. **Run** `pnpm type-check` and capture the error count per package.
3. **Fix 1-2 small files properly** — no `any` casts, no `@ts-expect-error`
   shortcuts. Demonstrate the migration pattern for downstream callers.
4. **Mark high-error files** with the standard header so future contributors
   know the file is queued for migration:
   ```ts
   // QUAL-21 TS-strict-migration: file untouched intentionally;
   // surfaces N errors under `<flag>`. See docs/TS_STRICT_MIGRATION.md.
   ```
5. **Opt out a package** (rather than commenting every file) when the error
   count exceeds ~50. Add the flag explicitly with `false` and a `QUAL-21`
   comment in that package's `tsconfig.json`.
6. **Verify CI** — `pnpm type-check` must exit 0 before merging.

### Migration pattern for `exactOptionalPropertyTypes`

The most common surfacing error is:

```ts
interface Foo { bar?: string }
const foo: Foo = { bar: maybeUndefined }; // TS2375 under exactOptional
```

Three legitimate fixes (in order of preference):

1. **Conditional spread** — keeps the runtime shape correct, doesn't widen the
   interface:
   ```ts
   const foo: Foo = {
     ...(maybeUndefined !== undefined ? { bar: maybeUndefined } : {}),
   };
   ```
2. **Widen the interface** when callers genuinely want to pass `undefined`:
   ```ts
   interface Foo { bar?: string | undefined }
   ```
3. **Narrow at the call site** with a guard before the assignment.

Examples of the conditional-spread pattern landed in this iteration:

- `apps/web/src/lib/performance.ts` — `recordMetric` builds the `metric`
  object with a conditional `metadata` spread.
- `apps/web/src/lib/email/sender.ts` — `sendEmail` returns the success result
  with a conditional `messageId` spread.

## Files marked for follow-up (top of `exactOptionalPropertyTypes` queue)

| File                                                                       | Errors |
| -------------------------------------------------------------------------- | ------ |
| `apps/web/src/lib/agents/engine.ts`                                        | 8 |
| `apps/web/src/components/docs/docs-shell.tsx`                              | 8 |
| `apps/web/src/lib/chat/server.ts`                                          | 7 |
| `apps/web/src/components/layout/app-sidebar.tsx`                           | 5 |
| `apps/web/src/lib/chat/microphone.ts`                                      | 4 |
| `apps/web/src/components/settings/project-ai-agents.tsx`                   | 4 |
| `apps/web/src/lib/admin/system-settings.ts`                                | 3 |
| `apps/web/src/components/notifications/notifications-inbox-shell.tsx`      | 3 |
| `apps/web/src/components/kanban/kanban-board.tsx`                          | 3 |
| `packages/db/src/utils/audit-logger.ts`                                    | 2 |

Re-enable `exactOptionalPropertyTypes` in `apps/web/tsconfig.json` and
`packages/db/tsconfig.json` once the per-file errors are resolved.

## CI

`pnpm type-check` exits 0 with the current configuration. Future agents
working on this migration should re-run after each change and update the
table above.
