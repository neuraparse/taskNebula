# packages/mcp-server — @tasknebula/mcp-server

Model Context Protocol server exposing TaskNebula to Claude/Cursor/etc. over the web app's REST API.
Root guide: `/CLAUDE.md`. Transports: stdio (`src/stdio.ts`) and HTTP (`src/http.ts`).

## Commands (run in packages/mcp-server)

```bash
pnpm build        # tsc -p tsconfig.build.json
pnpm start        # node ./bin/tasknebula-mcp.mjs (stdio)
pnpm test         # jest (43 tests live in src/__tests__)
pnpm type-check && pnpm lint
```

## Surface

12 tools in `src/tools/`: create-issue, create-subtask, get-issue, update-issue, assign-issue,
add-comment, transition-status, link-pr, search-issues, list-projects, list-my-assigned,
get-my-workload. Plus resources (`src/resources.ts`) and prompts (`src/prompts.ts`), registered in
`src/server.ts`. REST calls go through `src/client.ts`; auth resolution in `src/auth.ts`
(`TASKNEBULA_API_URL` + `TASKNEBULA_API_KEY` env).

## Gotchas (audit, June 2026)

- **Auth caveat — tools 401 until fixed**: the web REST API does not yet accept API keys (no route
  consumes the `api_keys` table; everything uses session cookies via `await auth()`). Every tool call
  fails with 401 until an API-key resolver lands in `apps/web` route auth. Don't "fix" this inside the
  MCP package — the gap is server-side.
- **Not published to npm**: `npx @tasknebula/mcp-server` 404s despite README instructions. Version 0.1.0,
  publish pending.
- Real API keys are prefixed `sk_live_` (README's `tnk_` is wrong); some tool contracts drift from the
  REST API (priority enums, `subtask` type not creatable server-side, `link_pr` shape) — verify against
  `apps/web/src/app/api/issues/route.ts` before changing tool schemas.
