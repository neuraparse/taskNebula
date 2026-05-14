# Logger + error-handling migration guide

This document shows how to migrate an existing API route (or any module) from
ad-hoc `console.*` + `throw new Error(...)` patterns to the new central
infrastructure introduced in P0-06:

- `@/lib/logger`        — Pino logger (prod JSON, dev pretty-printed)
- `@/lib/errors`        — typed `ApiError` hierarchy
- `@/lib/api-handler`   — `withErrorHandler(...)` HOF for Route Handlers

The migration is **opt-in**. Three reference routes have been migrated as
examples (see "Migrated routes" below). Bulk-migration of the remaining ~190
routes is tracked as a follow-up.

---

## 1. Why

Today the codebase has:

- 399 `console.log` / `console.error` calls. No level filtering. No request
  correlation. No prod/dev split. No structured fields.
- ~34 ad-hoc `throw new Error(...)` calls in route handlers with inconsistent
  JSON shapes — some are `{ error: "..." }`, some are `{ message: "..." }`,
  some leak internal errors as 500 responses.

The new foundation gives us:

- Structured JSON logs in prod, pretty-printed colour logs in dev.
- A single error envelope: `{ error: { code, message, details? }, requestId }`.
- Automatic `x-request-id` correlation on every response.
- Typed errors that catch blocks can branch on (`isApiError`, `instanceof`).
- A safe default: unknown thrown values become a generic 500 — no message leak.

---

## 2. The pattern

### Before

```ts
// apps/web/src/app/api/issues/[issueId]/route.ts
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ issueId: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const { issueId } = await params;
    const issue = await getIssueById(issueId);
    if (!issue) {
      return NextResponse.json({ error: 'Issue not found' }, { status: 404 });
    }
    return NextResponse.json(issue);
  } catch (error) {
    console.error('Error fetching issue:', error);
    return NextResponse.json({ error: 'Failed to fetch issue' }, { status: 500 });
  }
}
```

### After

```ts
// apps/web/src/app/api/issues/[issueId]/route.ts
import { withErrorHandler } from '@/lib/api-handler';
import { NotFoundError, UnauthorizedError } from '@/lib/errors';
import { childLogger } from '@/lib/logger';

const log = childLogger('api/issues/[issueId]');

export const GET = withErrorHandler(
  async (request, { params }: { params: Promise<{ issueId: string }> }) => {
    const session = await auth();
    if (!session?.user?.id) {
      throw new UnauthorizedError();
    }

    const { issueId } = await params;
    const issue = await getIssueById(issueId);
    if (!issue) {
      throw new NotFoundError('Issue not found');
    }

    log.debug({ issueId }, 'fetched issue');
    return NextResponse.json(issue);
  },
  { scope: 'api/issues/[id]' },
);
```

Key changes:

- No outer `try/catch` — `withErrorHandler` owns it.
- No `console.error` — use `log.info`, `log.warn`, `log.error` with structured
  fields. The message is the second argument; data is the first.
- Auth / not-found / forbidden / etc. become `throw new XxxError(...)` and
  the wrapper picks the right status + JSON envelope.
- Zod errors are caught automatically and become a 400 with `details`.
- Unknown thrown values are logged with full stack + request id and become a
  generic 500 — no message leak.

---

## 3. Error classes cheat-sheet

| Class                | Status | Code             |
|----------------------|--------|------------------|
| `BadRequestError`    | 400    | `BAD_REQUEST`    |
| `ValidationError`    | 400    | `VALIDATION_ERROR` |
| `UnauthorizedError`  | 401    | `UNAUTHORIZED`   |
| `ForbiddenError`     | 403    | `FORBIDDEN`      |
| `NotFoundError`      | 404    | `NOT_FOUND`      |
| `ConflictError`      | 409    | `CONFLICT`       |
| `RateLimitError`     | 429    | `RATE_LIMITED`   |
| `ApiError` (custom)  | any    | any (UPPER_SNAKE) |

All accept `{ details?: unknown, cause?: unknown }`. `cause` is logged but
**never** serialised to the client.

---

## 4. Logger usage

```ts
import { childLogger, logger } from '@/lib/logger';

const log = childLogger('feature/sub-feature');

log.debug({ userId, orgId }, 'low-volume diagnostic');
log.info({ count: items.length }, 'imported items');
log.warn({ retryIn: 5 }, 'transient failure, retrying');
log.error({ err }, 'unrecoverable error');
```

Conventions:

- First arg = **structured fields** (object). Second arg = **message** (string).
  Never interpolate values into the message — log them as fields so they're
  indexable in Loki / Datadog.
- Use `childLogger("scope")` per file. The scope is included on every log
  line as `scope: "..."`.
- Sensitive fields (`password`, `token`, `apiKey`, `Authorization` headers,
  cookies) are auto-redacted — see the redact list in `lib/logger.ts`. If you
  add a new sensitive field name, add it to that list.
- **Do not** `console.log` in app code. The pre-existing 399 console calls
  are tolerated until bulk-migrated; new code must use the logger.

---

## 5. Request id correlation

Every response from a `withErrorHandler`-wrapped route has an `x-request-id`
header. If the inbound request already supplied one, it's reused; otherwise a
UUID is generated. Surface it in error UIs and propagate it to downstream
service calls so a single trace ID flows across the stack.

---

## 6. Migrated routes (reference examples)

These have been converted as worked examples — read them when porting
adjacent routes:

- `apps/web/src/app/api/health/route.ts`
- `apps/web/src/app/api/issues/route.ts` (GET + POST)
- `apps/web/src/app/api/issues/[issueId]/route.ts` (GET + PATCH + DELETE)

Each file's diff in the introducing commit shows the typical
before/after edit shape.

---

## 7. Migration checklist (per route)

1. `import { withErrorHandler } from '@/lib/api-handler'`.
2. `import` the relevant error classes from `@/lib/errors`.
3. `import { childLogger } from '@/lib/logger'`; create `const log = childLogger("scope")`.
4. Convert the named export from a function declaration to
   `export const METHOD = withErrorHandler(async (req, ctx) => { ... }, { scope: "..." })`.
5. Delete the outer `try/catch`.
6. Replace each `NextResponse.json({ error: "..." }, { status: N })` with a
   `throw new XxxError("...")`.
7. Replace `console.error(...)` calls with `log.error({ ... }, "...")`. Move
   variables into structured fields, not the message string.
8. For Zod schemas: remove the `if (error instanceof z.ZodError)` branch —
   the wrapper handles it.
9. Run the test suite for the touched route, and `pnpm tsc --noEmit`.

---

## 8. Follow-ups (not in P0-06)

- **Bulk-replace remaining 399 `console.*` calls.** Tracked separately to keep
  P0-06 reviewable. Suggested approach: codemod + manual review by
  module-owning team.
- **Structured request context middleware.** A small `withRequest(handler)`
  wrapper that, on top of `withErrorHandler`, parses session/org/project from
  the request once and injects a typed `ctx` object into the handler. Avoids
  the repeated `auth()` + org-membership-check boilerplate visible in
  /api/issues today.
- **OpenTelemetry trace ID propagation.** Use the OTel trace id as
  `x-request-id` when available so logs and traces line up.
- **Edge runtime variant.** Pino is Node-only. If we introduce edge routes
  we'll need a `logger.edge.ts` that maps to `console.*` with the same JSON
  shape.
