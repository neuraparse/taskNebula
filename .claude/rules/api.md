---
paths:
  - 'apps/web/src/app/api/**/*.ts'
---

# API route rules (apps/web/src/app/api)

- **Auth first**: every protected route must verify the session (NextAuth v5) and resolve the caller's `organization_id` before touching data.
- **Tenant isolation**: scope every DB query by the caller's `organization_id`; never trust an org/project id from the request body without authorization.
- **Validate input**: parse request bodies and query params with **Zod**; return 400 on failure. Never pass unvalidated input to the DB.
- **Errors**: return consistent JSON error shapes and correct status codes; don't leak stack traces, SQL, or secrets in responses or logs.
- **OpenAPI**: the public API spec is generated (`pnpm openapi:gen` → `public/openapi.json`); keep route changes reflected there.
- **Side effects**: emit audit-log entries for mutating actions where the schema supports it.
