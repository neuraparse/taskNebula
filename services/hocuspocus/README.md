# TaskNebula Hocuspocus server

Standalone Node service that backs the collaborative Tiptap + Yjs editor used
for issue descriptions (and, later, comments and docs). The web app talks to
this server over WebSocket via `@hocuspocus/provider`.

## Architecture

```
Browser (Tiptap + Yjs) ──ws──►  hocuspocus (this service) ──►  Postgres (state)
                                                       └────►  Redis (pub/sub)
```

- **Persistence** — Yjs document binary state is stored in a dedicated
  `collab_documents` table that the service auto-creates on boot. The table
  uses `name` as the primary key (we use `issue:<id>` for issue descriptions).
- **Scale-out** — When `REDIS_URL` is set, the Redis extension keeps all
  Hocuspocus instances in sync. Multiple replicas may run behind a single
  load balancer.
- **Auth** — Every connection presents a short-lived JWT minted by the web
  app at `POST /api/collab/token`. The token is signed with `AUTH_SECRET`
  (HS256) and verified here against the same secret, so no extra key
  exchange is required.

## Environment variables

| Variable           | Required | Description                                                                  |
| ------------------ | -------- | ---------------------------------------------------------------------------- |
| `AUTH_SECRET`      | yes      | Shared with the web app. Used to verify connection JWTs.                     |
| `NEXTAUTH_SECRET`  | no       | Alternative name for `AUTH_SECRET` (kept for backward compatibility).        |
| `DATABASE_URL`     | yes      | Postgres connection string. The same one the web app uses is fine.           |
| `REDIS_URL`        | no       | When set, enables Redis pub/sub for multi-replica scale-out.                 |
| `HOCUSPOCUS_PORT`  | no       | Port to listen on. Defaults to `1234`.                                       |

The web app uses two additional env vars:

| Variable                       | Description                                                  |
| ------------------------------ | ------------------------------------------------------------ |
| `NEXT_PUBLIC_COLLAB_ENABLED`   | Set to `true` to mount the collaborative editor.             |
| `NEXT_PUBLIC_HOCUSPOCUS_URL`   | Public WebSocket URL of this service, e.g. `ws://localhost:1234`. |

## Running locally

```bash
cd services/hocuspocus
pnpm install
AUTH_SECRET="$(grep ^AUTH_SECRET= ../../.env | cut -d= -f2-)" \
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/tasknebula \
REDIS_URL=redis://:devpassword@localhost:6379 \
pnpm dev
```

Then in the web app:

```bash
NEXT_PUBLIC_COLLAB_ENABLED=true NEXT_PUBLIC_HOCUSPOCUS_URL=ws://localhost:1234 pnpm dev
```

## Docker

A ready-to-use compose overlay lives at the repository root as
`docker-compose.collab.yml`. Bring the optional service up with:

```bash
docker compose -f docker-compose.yml -f docker-compose.collab.yml up -d hocuspocus
```

## Document namespace

| Prefix         | Owner / Notes                                |
| -------------- | -------------------------------------------- |
| `issue:<id>`   | Issue description (P1-09).                   |
| `comment:<id>` | Reserved for future per-comment editors.     |
| `doc:<id>`     | Reserved for the existing Notion-style docs. |

## Health checks

The server exposes the standard Hocuspocus HTTP upgrade endpoint on the
configured port. A simple TCP-level liveness probe (Docker `healthcheck`)
is sufficient — see `docker-compose.collab.yml`.
