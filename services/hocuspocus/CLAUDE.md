# services/hocuspocus — Yjs realtime collab server

Standalone Hocuspocus (WebSocket) server backing collaborative editing (Tiptap + Yjs) in `apps/web`.
Plain Node ESM (`src/server.mjs`) — no TypeScript build step. Root guide: `/CLAUDE.md`.
Zero tests today — add coverage when you touch this service.

## Commands (run in services/hocuspocus)

```bash
pnpm dev      # node --watch src/server.mjs
pnpm start    # node src/server.mjs
```

## How it works

- **Auth**: clients connect with a JWT minted by the web app at `/api/collab/token`; verified here with
  `AUTH_SECRET` (falls back to `NEXTAUTH_SECRET`) — the secret must match the web app's.
- **Persistence**: Yjs document state persists to **Postgres** (`DATABASE_URL`).
- **Scale-out**: **Redis pub/sub** (`REDIS_URL`) syncs awareness/updates across multiple instances.

## Env vars

| Var                               | Purpose                                        |
| --------------------------------- | ---------------------------------------------- |
| `HOCUSPOCUS_PORT`                 | listen port (default `1234`)                   |
| `AUTH_SECRET` / `NEXTAUTH_SECRET` | JWT verification secret (shared with apps/web) |
| `DATABASE_URL`                    | Postgres for doc persistence                   |
| `REDIS_URL`                       | Redis pub/sub for multi-instance               |

## Gotchas

- The web client **is** wired (`@hocuspocus/provider` via `NEXT_PUBLIC_HOCUSPOCUS_URL`), but collab env
  vars are **not passed into the Docker web image/compose files** — collab is dark in containerized
  deploys until that plumbing lands. Don't assume a missing client integration; the gap is deployment env.
