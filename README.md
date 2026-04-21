<div align="center">

# TaskNebula

### Open-Source, Self-Hosted Project Management

[![Docker Pulls](https://img.shields.io/docker/pulls/neuraparse/tasknebula?style=for-the-badge&logo=docker&color=2496ED)](https://hub.docker.com/r/neuraparse/tasknebula)
[![Docker Image Version](https://img.shields.io/docker/v/neuraparse/tasknebula/latest?style=for-the-badge&logo=docker&label=image&color=2496ED)](https://hub.docker.com/r/neuraparse/tasknebula/tags)
[![Next.js](https://img.shields.io/badge/Next.js-15-black?style=for-the-badge&logo=next.js)](https://nextjs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.7-3178C6?style=for-the-badge&logo=typescript)](https://www.typescriptlang.org/)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-16-336791?style=for-the-badge&logo=postgresql)](https://www.postgresql.org/)
[![License](https://img.shields.io/badge/License-MIT-green?style=for-the-badge)](LICENSE)

The power of Jira, the speed of Linear, the flexibility of Notion.
Self-hosted and production-ready in one command.

[Docker Hub](https://hub.docker.com/r/neuraparse/tasknebula) · [Report Bug](https://github.com/neuraparse/tasknebula/issues) · Latest: **v0.2.4**

<br/>

<img src="images/home-page.png" alt="TaskNebula" width="100%"/>

<table>
<tr>
<td width="50%">
<img src="images/new-issue.png" alt="Kanban Board" width="100%"/>
<p align="center"><b>Kanban Board</b></p>
</td>
<td width="50%">
<img src="images/new-issue-detail.png" alt="Issue Detail" width="100%"/>
<p align="center"><b>Issue Detail</b></p>
</td>
</tr>
</table>

</div>

---

## Quick Start

### One-command run (prebuilt image, zero build time)

```bash
curl -fsSL https://raw.githubusercontent.com/neuraparse/tasknebula/main/scripts/quickstart.sh | bash
```

Pulls the latest `neuraparse/tasknebula` image from Docker Hub, provisions
Postgres + Redis + LiveKit via Docker Compose, generates a secure
`AUTH_SECRET` for you, and opens at http://localhost:3000.

### Build from source

```bash
git clone https://github.com/neuraparse/tasknebula.git
cd tasknebula
cp .env.example .env
echo "AUTH_SECRET=$(openssl rand -base64 32)" >> .env
docker compose up -d
```

Open **http://localhost:3000** — setup wizard creates your admin account.

### Pinned version

```bash
docker pull neuraparse/tasknebula:0.2.4
# or always-latest
docker pull neuraparse/tasknebula:latest
```

See [docker-compose.yml](docker-compose.yml) for the full stack.
Release notes for each tag live on the [GitHub releases page](https://github.com/neuraparse/tasknebula/releases).

---

## Features

| Category | What you get |
|----------|-------------|
| **Board** | Kanban drag-and-drop, custom columns, priority accent bars, type icons |
| **Issues** | Stories, Tasks, Bugs, Epics, Subtasks, Custom Fields, Links, Attachments |
| **Sprints** | Sprint planning, burndown charts, velocity tracking, backlog grooming |
| **Workflows** | Custom statuses, transition rules, auto-move on conditions |
| **Team** | Real-time presence, live activity feed, @mentions, watchers |
| **Permissions** | 30+ permission types, role-based access, issue security levels |
| **Analytics** | Burndown, velocity, cycle time, throughput, CSV/JSON export |
| **Security** | Audit logs (63+ actions), API keys, webhooks, OAuth (GitHub/Google) |
| **Admin** | Multi-org, user management, feature flags, email templates |
| **DX** | `Cmd+K` palette, keyboard shortcuts, dark mode, mobile responsive |

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | Next.js 15, React 19, Tailwind CSS, shadcn/ui |
| Backend | Next.js API Routes, Drizzle ORM |
| Database | PostgreSQL 16 + pgvector |
| Cache | Redis 7 |
| Auth | Auth.js v5 (NextAuth) |
| Deploy | Docker Compose |

---

## Production

```env
APP_URL=https://tasks.yourcompany.com
AUTH_SECRET=your-secret-here
```

Put a reverse proxy in front for SSL — [Caddy](https://caddyserver.com) is the easiest:

```
tasks.yourcompany.com {
    reverse_proxy localhost:3000
}
```

See [.env.example](.env.example) for all configuration options.

---

## Commands

```bash
docker compose up -d                       # Start (pulls neuraparse/tasknebula:latest)
docker compose down                        # Stop
docker compose logs -f web                 # Logs
docker compose pull web && docker compose up -d     # Update to latest prebuilt image
docker compose up -d --build               # Rebuild from source (uses local Dockerfile)
git pull && docker compose up -d --build   # Pull source + rebuild
```

> `docker-compose.yml` defaults to `image: neuraparse/tasknebula:latest`.
> Pin a version by setting `TASKNEBULA_IMAGE=neuraparse/tasknebula:0.2.4` in your `.env`.

---

## Development

```bash
pnpm install
docker compose up -d postgres redis
cp .env.example .env
cp apps/web/.env.example apps/web/.env.local
cd packages/db && pnpm tsx scripts/migrate.ts && cd ../..
pnpm dev
```

---

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md).

## License

MIT — see [LICENSE](LICENSE).

---

<div align="center">

Built by [Neura Parse](https://neuraparse.com)

</div>
