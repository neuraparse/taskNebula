# `@tasknebula/mcp-server`

Model Context Protocol server for [TaskNebula](https://tasknebula.io).

Lets Claude, Cursor, Claude Code, and Claude.ai's Custom Connectors talk
to your TaskNebula instance — search and create issues, transition
status, link PRs, plan sprints, and more.

- **Transports:** stdio (local) **and** HTTP Streamable (remote /
  Claude.ai)
- **Auth:** API key from env (stdio) or OAuth 2.1 + PKCE Bearer token
  (HTTP — scaffolding in this release, see _Roadmap_)
- **Surface area:** 12 tools, 4 resource templates, 3 prompts

## Install

```bash
# Quick try (stdio)
npx @tasknebula/mcp-server

# Inside a TaskNebula workspace
pnpm add -D @tasknebula/mcp-server
```

Set credentials:

```bash
export TASKNEBULA_API_URL="https://app.tasknebula.io"
export TASKNEBULA_API_KEY="tnk_..."   # from Settings → API keys
```

## Claude Desktop

`~/Library/Application Support/Claude/claude_desktop_config.json`
(macOS) or `%APPDATA%\Claude\claude_desktop_config.json` (Windows):

```json
{
  "mcpServers": {
    "tasknebula": {
      "command": "npx",
      "args": ["-y", "@tasknebula/mcp-server"],
      "env": {
        "TASKNEBULA_API_URL": "https://app.tasknebula.io",
        "TASKNEBULA_API_KEY": "tnk_..."
      }
    }
  }
}
```

## Cursor

`~/.cursor/mcp.json` (or **Settings → MCP → Edit config**):

```json
{
  "mcpServers": {
    "tasknebula": {
      "command": "npx",
      "args": ["-y", "@tasknebula/mcp-server"],
      "env": {
        "TASKNEBULA_API_URL": "https://app.tasknebula.io",
        "TASKNEBULA_API_KEY": "tnk_..."
      }
    }
  }
}
```

## Claude Code

```bash
claude mcp add tasknebula \
  --command "npx" --args "-y" "@tasknebula/mcp-server" \
  --env "TASKNEBULA_API_URL=https://app.tasknebula.io" \
  --env "TASKNEBULA_API_KEY=tnk_..."
```

## Claude.ai (Custom Connector / remote)

Point Claude.ai at the HTTP endpoint exposed by your TaskNebula
deployment:

```
https://app.tasknebula.io/api/mcp
```

Authorize using OAuth 2.1 + PKCE — discovery metadata is served from
`GET /api/mcp`. (OAuth provider implementation is scaffolded; until it
ships you can pass a long-lived TaskNebula API key as a Bearer token
for testing.)

## Tools

| Name | Description |
| --- | --- |
| `search_issues` | Full-text search across issues with optional project/status/assignee filters. |
| `get_issue` | Fetch one issue with comments + links. |
| `list_my_assigned` | Issues assigned to the authenticated user (filterable by status bucket). |
| `create_issue` | Create a new issue. |
| `update_issue` | Patch title/description/priority/labels/due-date. |
| `transition_status` | Move an issue between workflow statuses. |
| `assign_issue` | Assign or unassign. |
| `add_comment` | Post a comment (with optional mentions). |
| `link_pr` | Attach a pull-request URL to an issue. |
| `list_projects` | Projects accessible to the user. |
| `create_subtask` | Create a subtask under a parent issue. |
| `get_my_workload` | Aggregated workload (counts + due-soon list) for the user. |

## Resources

- `tasknebula://issue/{id}`
- `tasknebula://project/{id}`
- `tasknebula://user/me`
- `tasknebula://cycle/current`

## Prompts

- `triage_inbox` — propose triage actions for unassigned issues.
- `standup_summary` — generate a daily standup from your assigned work.
- `sprint_planning` — draft a sprint from a backlog and capacity.

## Architecture

```
packages/mcp-server/
├── bin/tasknebula-mcp.mjs   # npx entry point
├── src/
│   ├── index.ts              # public API
│   ├── client.ts             # REST client (env-driven)
│   ├── auth.ts               # stdio API-key + HTTP OAuth scaffolding
│   ├── server.ts             # MCP server factory (shared by transports)
│   ├── stdio.ts              # stdio transport entry
│   ├── http.ts               # HTTP / JSON-RPC handler (Next.js route)
│   ├── resources.ts          # resource templates
│   ├── prompts.ts            # prompt templates
│   └── tools/                # one file per tool
└── README.md
```

The Next.js route at `apps/web/src/app/api/mcp/route.ts` re-exports the
HTTP handler so the remote endpoint and the npm package share the exact
same tool definitions.

## OAuth 2.1 flow (stub)

The HTTP transport currently extracts a Bearer token and forwards it to
the REST API. The full OAuth 2.1 + PKCE flow is scaffolded but not yet
live:

1. Client `GET /api/mcp` discovers the authorization endpoints.
2. Client performs **Dynamic Client Registration** (RFC 7591) against
   `POST /api/oauth/register`. _(TODO)_
3. Client redirects user to `GET /api/oauth/authorize` with PKCE
   `code_challenge`. _(TODO)_
4. Client exchanges the code at `POST /api/oauth/token`. _(TODO)_
5. Refresh tokens rotate per RFC 6749 §6. _(TODO)_

See `src/auth.ts` for the integration hooks.

## Roadmap

- [ ] Full OAuth 2.1 + PKCE provider routes
- [ ] Per-tool rate limiting (token bucket; surfacing `Retry-After`)
- [ ] Streamable HTTP transport (resumable SSE)
- [ ] Server → client resource update notifications
- [ ] Audit log entry per tool invocation

## License

MIT © Neura Parse
