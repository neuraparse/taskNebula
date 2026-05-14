# API Route Validation Migration Guide

This guide explains how to migrate the remaining ~189 ad-hoc-validated API
routes under `apps/web/src/app/api/` to the shared
[`withValidation`](../api-validation.ts) wrapper introduced by FEAT-29.

The wrapper:

- Parses `body`, `query`, and `params` with Zod schemas you supply.
- Returns a consistent `400 { error: { code: "VALIDATION_FAILED", message, details } }` envelope on failure.
- Returns `400 INVALID_JSON` when the request body is not parseable JSON.
- Passes a typed `{ body, query, params }` second argument to the handler.
- Plays nicely with Next.js 15 App Router (Promise-based `params`).

Do **not** bulk-migrate in a single PR — move routes incrementally so each
behavior change can be reviewed. The reference migrations done in FEAT-29 are:

- `apps/web/src/app/api/issues/route.ts` (POST)
- `apps/web/src/app/api/issues/[issueId]/route.ts` (PATCH)
- `apps/web/src/app/api/issues/[issueId]/comments/route.ts` (POST)
- `apps/web/src/app/api/projects/route.ts` (POST)
- `apps/web/src/app/api/search/route.ts` (GET)

## Common pattern

### Before

```ts
import { z } from 'zod';

const createCommentSchema = z.object({
  content: z.string().min(1),
  parentId: z.string().optional(),
});

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ issueId: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { issueId } = await params;
    const body = await request.json();
    const validatedData = createCommentSchema.parse(body);

    // ... handler body ...

    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Validation failed', details: error.errors },
        { status: 400 }
      );
    }
    console.error('Error creating comment:', error);
    return NextResponse.json({ error: 'Failed to create comment' }, { status: 500 });
  }
}
```

### After

```ts
import { z } from 'zod';
import { withValidation } from '@/lib/api-validation';

const createCommentSchema = z.object({
  content: z.string().min(1),
  parentId: z.string().optional(),
});

const commentsParamsSchema = z.object({ issueId: z.string().min(1) });

export const POST = withValidation({
  body: createCommentSchema,
  params: commentsParamsSchema,
})(async (request, { body: validatedData, params }) => {
  const { issueId } = params;
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // ... handler body ...

    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    // ZodError catch is no longer needed — the wrapper handles it.
    console.error('Error creating comment:', error);
    return NextResponse.json({ error: 'Failed to create comment' }, { status: 500 });
  }
});
```

## Step-by-step

1. **Identify** any `schema.parse(body)`, `searchParams.get(...)`, or
   manual `if (!field)` checks in the route.
2. **Define schemas** at the top of the file (or import from
   [`@/lib/validation/common`](./common.ts) for shared primitives):
   ```ts
   import { id, pagination, sortDir } from '@/lib/validation/common';
   ```
3. **Wrap the handler**:
   ```ts
   export const POST = withValidation({ body, query, params })(handler);
   ```
   Use `export const`, not `export function` — `withValidation` returns
   a function expression.
4. **Drop the `ZodError` branch** from the handler's `catch` — the wrapper
   short-circuits before the handler runs.
5. **Drop manual presence checks** (`if (!name) return 400`) that the schema
   now enforces.

## Query params — coercion

URLSearchParams are always strings. Use Zod coercion for numbers / booleans:

```ts
const querySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(50),
  cursor: z.string().optional(),
  // For booleans, prefer an enum so `?flag=anything` doesn't silently
  // coerce to `true`:
  saveHistory: z.enum(['true', 'false']).optional().transform((v) => v !== 'false'),
});
```

Repeated keys (`?tag=a&tag=b`) become arrays automatically. Declare them
as `z.array(z.string())` in the schema if you expect multiples.

## Params — Next 15 specifics

Next 15 hands `params` as a `Promise`. The wrapper awaits it for you, so
your schema validates the resolved object:

```ts
withValidation({
  params: z.object({ projectId: id, issueId: id }),
})(async (req, { params }) => {
  // params.projectId / params.issueId are typed strings, already validated.
});
```

## Strict vs. passthrough

By default, Zod **strips unknown keys** from objects. To reject them, mark
the schema `.strict()`. To pass them through verbatim, use `.passthrough()`.

```ts
const tightSchema = z.object({ name: z.string() }).strict();
// extra fields → 400 with `code: 'unrecognized_keys'`

const flexibleSchema = z.object({ name: z.string() }).passthrough();
// extra fields → preserved as-is
```

Almost all TaskNebula API routes can stay on the default (strip) behaviour.
Reach for `.strict()` only when you specifically want to reject typos in
client requests (e.g. write-once admin endpoints).

## Error envelope contract

The wrapper always returns this exact shape on validation failure:

```jsonc
// HTTP 400
{
  "error": {
    "code": "VALIDATION_FAILED",
    "message": "Validation failed",
    "details": [
      {
        "code": "invalid_type",
        "expected": "string",
        "received": "undefined",
        "path": ["body", "title"],   // <— prefixed with body / query / params
        "message": "Required"
      }
    ]
  }
}
```

For malformed JSON bodies:

```jsonc
// HTTP 400
{
  "error": {
    "code": "INVALID_JSON",
    "message": "Request body is not valid JSON"
  }
}
```

This shape is intentionally aligned with the proposed unified error envelope
(roadmap task #6). If #6 ships a shared helper, `api-validation.ts` will be
updated to call it without changing the public shape.

## Migration checklist (per route)

- [ ] Schemas declared at top of file (or imported from `validation/common`).
- [ ] Route uses `export const METHOD = withValidation(...)(handler)`.
- [ ] Manual `await request.json()` + `.parse()` removed.
- [ ] `instanceof z.ZodError` branch removed from `catch`.
- [ ] Manual `if (!field) return 400` checks removed when covered by schema.
- [ ] No behavior change in success path — verify with existing tests / curl.

## Tracking progress

To find unmigrated routes:

```bash
# Routes that still call schema.parse directly:
rg "schema\.parse\(body\)" apps/web/src/app/api

# Routes that still catch ZodError:
rg "instanceof z\.ZodError" apps/web/src/app/api
```

Migrate in small batches (3–5 routes per PR) so reviewers can vet each
schema in context.
