# TaskNebula Deployment Guide

This guide covers deploying TaskNebula to production environments.

## Table of Contents

- [Prerequisites](#prerequisites)
- [Environment Variables](#environment-variables)
- [Deployment Options](#deployment-options)
  - [Vercel (Recommended)](#vercel-recommended)
  - [Docker](#docker)
  - [Self-Hosted](#self-hosted)
- [Database Setup](#database-setup)
- [Post-Deployment](#post-deployment)
- [Monitoring](#monitoring)
- [Troubleshooting](#troubleshooting)

## Prerequisites

- Node.js 20+
- PostgreSQL 16+
- pnpm 9+
- Domain name (for production)
- SSL certificate (for production)

## Environment Variables

Copy `.env.example` to `.env` and configure:

### Required Variables

```bash
# Database
DATABASE_URL=postgresql://user:password@host:5432/database

# Auth
AUTH_SECRET=your-secret-key-here  # Generate with: openssl rand -base64 32
AUTH_URL=https://yourdomain.com

# OAuth Providers (at least one required)
GITHUB_CLIENT_ID=your-github-client-id
GITHUB_CLIENT_SECRET=your-github-client-secret

GOOGLE_CLIENT_ID=your-google-client-id
GOOGLE_CLIENT_SECRET=your-google-client-secret

# Application
NEXT_PUBLIC_APP_URL=https://yourdomain.com
NEXT_PUBLIC_APP_NAME=TaskNebula
```

### Optional Variables

```bash
# AI Features
OPENAI_API_KEY=your-openai-api-key

# Email
RESEND_API_KEY=your-resend-api-key
EMAIL_FROM=noreply@yourdomain.com

# Caching
REDIS_URL=redis://localhost:6379

# Self-hosted voice rooms
LIVEKIT_URL=http://host.docker.internal:7880
LIVEKIT_PUBLIC_HOST=rtc.yourdomain.com
NEXT_PUBLIC_LIVEKIT_URL=wss://rtc.yourdomain.com
LIVEKIT_NODE_IP=
LIVEKIT_API_KEY=replace-me
LIVEKIT_API_SECRET=replace-me

# Optional external TURN relay
TURN_URL=turns://turn.yourdomain.com:5349
TURN_USERNAME=replace-me
TURN_PASSWORD=replace-me

# Monitoring
NEXT_PUBLIC_SENTRY_DSN=your-sentry-dsn
```

## Deployment Options

### Vercel (Recommended)

1. **Install Vercel CLI**

   ```bash
   pnpm add -g vercel
   ```

2. **Login to Vercel**

   ```bash
   vercel login
   ```

3. **Deploy**

   ```bash
   cd apps/web
   vercel --prod
   ```

4. **Configure Environment Variables**
   - Go to Vercel Dashboard → Settings → Environment Variables
   - Add all required environment variables
   - Redeploy

5. **Setup Database**
   - Use Vercel Postgres or external PostgreSQL
   - Run migrations:
     ```bash
     pnpm --filter=@tasknebula/db db:migrate:prod
     ```

### Docker

1. **Build Image**

   ```bash
   docker build -t tasknebula:latest .
   ```

2. **Run with Docker Compose**

   ```bash
   docker-compose up -d
   ```

   The local compose stack provisions PostgreSQL, Redis, and a self-hosted LiveKit server for project voice rooms.

3. **Run Migrations**

   ```bash
   docker-compose exec web pnpm --filter=@tasknebula/db db:migrate:prod
   ```

4. **Seed Production Data**
   ```bash
   docker-compose exec web pnpm --filter=@tasknebula/db db:seed:prod
   ```

### Self-Hosted

1. **Install Dependencies**

   ```bash
   pnpm install --frozen-lockfile
   ```

2. **Build Application**

   ```bash
   pnpm build
   ```

3. **Run Migrations**

   ```bash
   pnpm --filter=@tasknebula/db db:migrate:prod
   pnpm --filter=@tasknebula/db db:seed:prod
   ```

4. **Start Application**

   ```bash
   pnpm --filter=@tasknebula/web start
   ```

5. **Provision Realtime Services**

- Redis is required for multi-instance SSE fanout and room presence.
- LiveKit is required for voice rooms.
- For Docker deployments, run LiveKit on the host network. LiveKit’s official deployment guide says Dockerized environments should use host networking for optimal performance.
- The bundled compose stack auto-detects `LIVEKIT_NODE_IP` inside the LiveKit container when left blank.
- For same-machine localhost development, keep `LIVEKIT_PUBLIC_HOST=127.0.0.1`.
- For LAN testing from another device, set `LIVEKIT_PUBLIC_HOST` to your machine IP, for example `192.168.1.103`.
- For production, pin your own `LIVEKIT_API_KEY` / `LIVEKIT_API_SECRET` and terminate TLS in front of the LiveKit WebSocket endpoint.
- LiveKit includes an embedded TURN server; use `TURN_*` only if you operate a separate TURN relay for stricter network environments.

5. **Setup Process Manager (PM2)**
   ```bash
   pnpm add -g pm2
   pm2 start "pnpm --filter=@tasknebula/web start" --name tasknebula
   pm2 save
   pm2 startup
   ```

## Database Setup

### PostgreSQL

1. **Create Database**

   ```sql
   CREATE DATABASE tasknebula;
   CREATE USER tasknebula_user WITH PASSWORD 'your-password';
   GRANT ALL PRIVILEGES ON DATABASE tasknebula TO tasknebula_user;
   ```

2. **Run Migrations**

   ```bash
   pnpm --filter=@tasknebula/db db:migrate:prod
   ```

3. **Seed Initial Data**
   ```bash
   pnpm --filter=@tasknebula/db db:seed:prod
   ```

### Supabase

1. Create a new project at [supabase.com](https://supabase.com)
2. Copy the connection string
3. Set `DATABASE_URL` environment variable
4. Run migrations as above

## Post-Deployment

### 1. Verify Health

```bash
curl https://yourdomain.com/api/health
```

### 2. Create First Organization

- Visit your domain
- Sign in with OAuth
- Create your first organization

### 3. Configure OAuth Callbacks

- GitHub: `https://yourdomain.com/api/auth/callback/github`
- Google: `https://yourdomain.com/api/auth/callback/google`

## Monitoring

### Health Checks

- Health: `GET /api/health`
- Readiness: `GET /api/ready`
- Metrics: `GET /api/metrics`

### Logs

```bash
# Docker
docker-compose logs -f web

# PM2
pm2 logs tasknebula
```

## Troubleshooting

### Database Connection Issues

- Verify `DATABASE_URL` is correct
- Check database is running
- Verify network connectivity

### OAuth Issues

- Verify callback URLs are correct
- Check client IDs and secrets
- Ensure `AUTH_URL` matches your domain

### Build Failures

- Clear cache: `pnpm clean`
- Reinstall: `rm -rf node_modules && pnpm install`
- Check Node.js version: `node --version`

For more help, see [GitHub Issues](https://github.com/neuraparse/taskNebula/issues)
