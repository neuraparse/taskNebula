# OpenAPI registry

This folder owns the OpenAPI 3.1 surface that ships in
`apps/web/public/openapi.json` and is rendered by the Swagger UI route at
`/api-docs`.

## Layout

```
src/lib/openapi/
├── README.md              ← you are here
├── registry.ts            ← OpenAPIRegistry + registerRoute() helper
├── schemas.ts             ← shared Zod schemas (request/response shapes)
├── routes/
│   ├── index.ts           ← side-effect entrypoint — imports every route file
│   ├── issues.ts          ← /api/issues, /api/issues/{id}, comments
│   ├── projects.ts        ← /api/projects
│   ├── labels.ts          ← /api/labels, /api/labels/{labelId}
│   ├── versions.ts        ← project versions + issue fix/affects versions
│   ├── components.ts      ← project components + issue components
│   ├── users.ts           ← /api/users/me
│   ├── search.ts          ← /api/search
│   └── health.ts          ← /api/health
└── __tests__/             ← snapshot + 3.1 conformance tests
```

The generator entrypoint is `apps/web/scripts/generate-openapi.ts`, which
imports `routes/index.ts` for its side effects and writes
`apps/web/public/openapi.json`.

Run it locally with:

```bash
pnpm --filter @tasknebula/web openapi:gen
```

## Registering a new route

1. **Add (or reuse) the request/response Zod schemas in `schemas.ts`.**

   Use `.openapi(...)` to attach OpenAPI metadata such as `example`,
   `description`, or a named component name:

   ```ts
   export const FooSchema = z
     .object({
       id: z.string(),
       name: z.string().openapi({ example: 'My foo' }),
     })
     .openapi('Foo');
   ```

2. **Create or extend a file under `routes/` and call `registerRoute()`:**

   ```ts
   import { registerRoute, TAGS } from '../registry';
   import { FooSchema, ErrorResponseSchema } from '../schemas';

   registerRoute({
     method: 'get',
     path: '/api/foos/{fooId}',
     summary: 'Get a foo',
     tags: [TAGS.Issues], // pick a tag or add a new one to TAGS
     request: {
       params: z.object({ fooId: z.string() }),
     },
     responses: {
       '200': {
         description: 'The foo.',
         content: { 'application/json': { schema: FooSchema } },
       },
       '404': {
         description: 'Foo not found.',
         content: { 'application/json': { schema: ErrorResponseSchema } },
       },
     },
   });
   ```

   By default routes are documented as requiring the NextAuth session cookie
   (`cookieAuth`). Pass `security: []` for a public route.

3. **If the file is new, add a side-effect import to `routes/index.ts`.**

4. **Regenerate the spec and commit it:**

   ```bash
   pnpm --filter @tasknebula/web openapi:gen
   git add apps/web/public/openapi.json
   ```

   CI runs `pnpm openapi:gen` and a snapshot test that fails if the
   generated file is stale — both must be green before merge.

## Conventions

- Path parameter names in the OpenAPI path **must match** the Next.js folder
  segment, e.g. `/api/issues/{issueId}` matches `app/api/issues/[issueId]/`.
- Error responses should reuse `ErrorResponseSchema`.
- Prefer reusing a top-level component (via `.openapi('ComponentName')`)
  over inline object schemas for anything documented in more than one place.
- Don't register internal/admin routes (`/api/admin/**`,
  `/api/setup/**`, ...) — keep the surface minimal and stable.

## Known gap

A large number of internal routes are intentionally **not** documented yet —
see the TODO list at the top of `routes/index.ts` for the tracked
follow-up.
