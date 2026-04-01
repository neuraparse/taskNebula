<div align="center">

# TaskNebula

### **Open-Source, Self-Hosted Project Management Platform**

[![Docker](https://img.shields.io/badge/Docker-Ready-2496ED?style=for-the-badge&logo=docker)](https://hub.docker.com/r/neuraparse/tasknebula)
[![Next.js](https://img.shields.io/badge/Next.js-15-black?style=for-the-badge&logo=next.js)](https://nextjs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.7-3178C6?style=for-the-badge&logo=typescript)](https://www.typescriptlang.org/)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-16-336791?style=for-the-badge&logo=postgresql)](https://www.postgresql.org/)
[![License](https://img.shields.io/badge/License-MIT-green?style=for-the-badge)](LICENSE)

A modern project management tool with the power of Jira, the speed of Linear, and the flexibility of Notion. Self-hosted, free, and production-ready in under 5 minutes.

</div>

---

## Quick Start

### 1. Clone & Configure

```bash
git clone https://github.com/neuraparse/tasknebula.git
cd tasknebula
cp .env.example .env
```

### 2. Generate Auth Secret

```bash
# Linux/Mac
echo "AUTH_SECRET=$(openssl rand -base64 32)" >> .env

# Or manually edit .env and set AUTH_SECRET to any random 32+ character string
```

### 3. Start

```bash
docker compose up -d
```

### 4. Open & Setup

Go to **http://localhost:3000** — you'll be redirected to `/setup` to create your admin account.

That's it. You're running TaskNebula.

### Docker Hub (no clone needed)

```bash
docker pull neuraparse/tasknebula:latest
```

Or use this minimal `docker-compose.yml`:

```yaml
services:
  postgres:
    image: pgvector/pgvector:pg16
    environment:
      POSTGRES_USER: postgres
      POSTGRES_PASSWORD: postgres
      POSTGRES_DB: tasknebula
    volumes:
      - postgres_data:/var/lib/postgresql/data
    healthcheck:
      test: ['CMD-SHELL', 'pg_isready -U postgres']
      interval: 10s
      timeout: 5s
      retries: 5

  redis:
    image: redis:7-alpine
    command: redis-server --appendonly yes
    volumes:
      - redis_data:/data
    healthcheck:
      test: ['CMD', 'redis-cli', 'ping']
      interval: 10s
      timeout: 5s
      retries: 5

  web:
    image: neuraparse/tasknebula:latest
    depends_on:
      postgres: { condition: service_healthy }
      redis: { condition: service_healthy }
    environment:
      DATABASE_URL: postgresql://postgres:postgres@postgres:5432/tasknebula
      AUTH_SECRET: ${AUTH_SECRET} # generate: openssl rand -base64 32
      AUTH_URL: ${APP_URL:-http://localhost:3000}
      NEXT_PUBLIC_APP_URL: ${APP_URL:-http://localhost:3000}
      REDIS_URL: redis://redis:6379
      SKIP_SEED: true
    ports:
      - '3000:3000'
    volumes:
      - uploads_data:/app/uploads

volumes:
  postgres_data:
  redis_data:
  uploads_data:
```

```bash
# Generate secret and start
echo "AUTH_SECRET=$(openssl rand -base64 32)" > .env
docker compose up -d
# Open http://localhost:3000 → /setup wizard
```

---

## Custom Domain / Production

Edit `.env` before starting:

```env
APP_URL=https://tasks.yourcompany.com
AUTH_SECRET=your-generated-secret-here
```

Put a reverse proxy (Caddy, Nginx, Traefik) in front of port 3000 for SSL:

```
# Caddyfile (easiest - auto SSL)
tasks.yourcompany.com {
    reverse_proxy localhost:3000
}
```

```nginx
# Or Nginx
server {
    listen 443 ssl;
    server_name tasks.yourcompany.com;
    ssl_certificate /path/to/cert.pem;
    ssl_certificate_key /path/to/key.pem;

    location / {
        proxy_pass http://localhost:3000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
    }
}
```

---

## Screenshots

<div align="center">

<img src="images/home-page.png" alt="Landing Page" width="100%"/>
<p><b>Landing Page</b></p>

<br/>

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

## Features

### Project Management
- **Kanban Boards** - Drag-and-drop task management
- **Sprint Planning** - Scrum-style sprint management with burndown charts
- **Backlog** - Prioritized product backlog
- **Roadmap** - Visual project roadmap
- **Issue Types** - Stories, Tasks, Bugs, Epics, Subtasks
- **Custom Fields** - Text, Number, Date, Select, Multi-select, Checkbox, URL, Email
- **Issue Links** - Blocks, Relates to, Duplicates, Parent/Child
- **Time Tracking** - Log work with estimates
- **Bulk Operations** - Update multiple issues at once
- **Labels & Filters** - Saved filters with advanced search

### Workflow Engine
- **Custom Workflows** - Visual drag-and-drop editor
- **Status Categories** - Backlog, In Progress, Done (customizable)
- **Automation Rules** - Trigger-based actions and transitions

### Security & Permissions
- **30+ Permission Types** - Most granular permission system available
- **Permission Schemes** - Reusable templates (Jira-style)
- **Issue Security Levels** - Control who can see specific issues
- **Audit Logging** - 63+ action types tracked
- **API Keys** - Programmatic access management

### Analytics
- **Burndown Charts** - Sprint progress visualization
- **Velocity Tracking** - Team performance over time
- **Project Health** - Issues by status, priority, assignee
- **CSV/JSON Export** - Export your data

### Administration
- **Admin Dashboard** - System-wide management for super admins
- **Organization Management** - Multi-org support
- **User Management** - Roles and access control
- **Feature Flags** - Enable/disable features per org
- **Webhooks** - Integrate with external services
- **Email Templates** - Customizable notification emails

### Developer Experience
- **Keyboard Shortcuts** - `Cmd+K` command palette, `C` create issue, `G+B` go to board
- **Dark Mode** - Full dark theme support
- **Mobile Responsive** - Works on any device
- **Real-time Updates** - Live collaboration
- **OAuth** - GitHub and Google sign-in

---

## Architecture

```
tasknebula/
  apps/web/           # Next.js 15 + React 19 + Tailwind CSS + shadcn/ui
  packages/db/        # PostgreSQL + Drizzle ORM (22 tables)
  packages/types/     # Shared TypeScript types
  packages/config/    # Shared configs (ESLint, TSConfig)
  docker/             # Docker configurations
```

| Stack | Technology |
|-------|-----------|
| Frontend | Next.js 15, React 19, TypeScript, Tailwind CSS, shadcn/ui |
| Backend | Next.js API Routes, Drizzle ORM |
| Database | PostgreSQL 16 |
| Cache | Redis 7 |
| Auth | Auth.js v5 (NextAuth) |
| Deploy | Docker Compose |

---

## Configuration

### Environment Variables

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `APP_URL` | Yes | `http://localhost:3000` | Your app URL |
| `AUTH_SECRET` | Yes | - | Random secret (32+ chars) |
| `PORT` | No | `3000` | Web server port |
| `DB_PORT` | No | `5432` | PostgreSQL port |
| `REDIS_PORT` | No | `6379` | Redis port |
| `POSTGRES_USER` | No | `postgres` | Database user |
| `POSTGRES_PASSWORD` | No | `postgres` | Database password |
| `GITHUB_CLIENT_ID` | No | - | GitHub OAuth app ID |
| `GITHUB_CLIENT_SECRET` | No | - | GitHub OAuth secret |
| `GOOGLE_CLIENT_ID` | No | - | Google OAuth client ID |
| `GOOGLE_CLIENT_SECRET` | No | - | Google OAuth secret |
| `SKIP_SEED` | No | `false` | Skip demo data, use `/setup` for first admin |

### Docker Commands

| Command | Description |
|---------|-------------|
| `docker compose up -d` | Start all services |
| `docker compose down` | Stop all services |
| `docker compose logs -f web` | View application logs |
| `docker compose restart web` | Restart the web app |
| `docker compose ps` | Check service status |

### Backup & Restore

```bash
# Backup database
docker exec tasknebula-postgres pg_dump -U postgres tasknebula > backup.sql

# Restore database
docker exec -i tasknebula-postgres psql -U postgres tasknebula < backup.sql
```

### Update

```bash
git pull
docker compose down
docker compose up -d --build
```

---

## Development

```bash
# Install dependencies
pnpm install

# Start database & redis
docker compose up -d postgres redis

# Setup environment
cp .env.example .env
cp apps/web/.env.example apps/web/.env.local

# Run migrations
cd packages/db && pnpm tsx scripts/migrate.ts && cd ../..

# Start dev server
pnpm dev
```

---

## Enterprise

Looking for AI-powered features? **TaskNebula Enterprise** adds:

- AI issue generation & thread summarization
- Autonomous AI agents (code writing, PR creation)
- Plan-based usage limits & billing
- Priority support

Contact **hello@neuraparse.com** for details.

---

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md).

---

## License

MIT License - see [LICENSE](LICENSE).

---

<div align="center">

Built by [Neura Parse](https://neuraparse.com)

</div>
