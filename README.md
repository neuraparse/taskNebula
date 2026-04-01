<div align="center">

# TaskNebula

### Open-Source, Self-Hosted Project Management

[![Docker](https://img.shields.io/badge/Docker-Ready-2496ED?style=for-the-badge&logo=docker)](https://hub.docker.com/r/neuraparse/tasknebula)
[![Next.js](https://img.shields.io/badge/Next.js-15-black?style=for-the-badge&logo=next.js)](https://nextjs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.7-3178C6?style=for-the-badge&logo=typescript)](https://www.typescriptlang.org/)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-16-336791?style=for-the-badge&logo=postgresql)](https://www.postgresql.org/)
[![License](https://img.shields.io/badge/License-MIT-green?style=for-the-badge)](LICENSE)

The power of Jira, the speed of Linear, the flexibility of Notion.
Self-hosted and production-ready in one command.

[Docker Hub](https://hub.docker.com/r/neuraparse/tasknebula) · [Report Bug](https://github.com/neuraparse/tasknebula/issues)

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

```bash
git clone https://github.com/neuraparse/tasknebula.git
cd tasknebula
cp .env.example .env
echo "AUTH_SECRET=$(openssl rand -base64 32)" >> .env
docker compose up -d
```

Open **http://localhost:3000** — setup wizard creates your admin account.

> Already have Docker? Just `docker pull neuraparse/tasknebula:latest` — see [docker-compose.yml](docker-compose.yml) for the full config.

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
docker compose up -d            # Start
docker compose down             # Stop
docker compose logs -f web      # Logs
docker compose up -d --build    # Rebuild
git pull && docker compose up -d --build  # Update
```

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
