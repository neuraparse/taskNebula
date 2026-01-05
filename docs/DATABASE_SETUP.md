# Database Setup Guide

## Option 1: Local PostgreSQL (Recommended for Development)

### Using Docker (Easiest)

1. **Start PostgreSQL with Docker:**
```bash
docker run --name tasknebula-postgres \
  -e POSTGRES_USER=postgres \
  -e POSTGRES_PASSWORD=postgres \
  -e POSTGRES_DB=tasknebula \
  -p 5432:5432 \
  -d postgres:16
```

2. **Set environment variable:**
```bash
# Create .env file in root
echo "DATABASE_URL=postgresql://postgres:postgres@localhost:5432/tasknebula" > .env
```

3. **Push schema to database:**
```bash
pnpm --filter=@tasknebula/db db:push
```

4. **Seed with demo data:**
```bash
pnpm --filter=@tasknebula/db db:seed
```

### Using Local PostgreSQL Installation

1. **Install PostgreSQL 16:**
   - Windows: Download from https://www.postgresql.org/download/windows/
   - Mac: `brew install postgresql@16`
   - Linux: `sudo apt install postgresql-16`

2. **Create database:**
```bash
createdb tasknebula
```

3. **Set environment variable and run migrations** (same as Docker steps 2-4)

---

## Option 2: Supabase (Recommended for Production)

### Setup Supabase Project

1. **Create account:** Go to https://supabase.com and create a new project

2. **Get connection string:**
   - Go to Project Settings → Database
   - Copy the "Connection string" (URI format)
   - Replace `[YOUR-PASSWORD]` with your actual password

3. **Set environment variable:**
```bash
# In .env file
DATABASE_URL=postgresql://postgres:[YOUR-PASSWORD]@db.[PROJECT-REF].supabase.co:5432/postgres
```

4. **Push schema:**
```bash
pnpm --filter=@tasknebula/db db:push
```

5. **Seed data:**
```bash
pnpm --filter=@tasknebula/db db:seed
```

---

## Database Commands

```bash
# Generate migration files from schema changes
pnpm --filter=@tasknebula/db db:generate

# Push schema directly to database (no migration files)
pnpm --filter=@tasknebula/db db:push

# Run migrations
pnpm --filter=@tasknebula/db db:migrate

# Seed database with demo data
pnpm --filter=@tasknebula/db db:seed

# Open Drizzle Studio (database GUI)
pnpm --filter=@tasknebula/db db:studio

# Complete setup (push + seed)
pnpm --filter=@tasknebula/db db:setup
```

---

## Verify Setup

1. **Check database connection:**
```bash
pnpm --filter=@tasknebula/db db:studio
```
This will open Drizzle Studio at http://localhost:4983

2. **Verify tables:**
You should see 19 tables:
- organizations, organization_members
- teams, team_members
- users, accounts, sessions, verification_tokens
- projects
- workflows, workflow_statuses, workflow_transitions, automation_rules
- sprints
- issues, issue_comments, issue_activities, issue_attachments, issue_links

3. **Verify seed data:**
- 1 organization (Acme Corporation)
- 3 users (John Doe, Sarah Chen, Mike Johnson)
- 1 team (Engineering)
- 1 project (Demo Project - DEMO)
- 1 workflow with 4 statuses
- 1 active sprint
- 4 sample issues

---

## Troubleshooting

### Connection refused
- Make sure PostgreSQL is running: `docker ps` or `pg_isready`
- Check port 5432 is not in use: `lsof -i :5432` (Mac/Linux) or `netstat -ano | findstr :5432` (Windows)

### Authentication failed
- Verify DATABASE_URL credentials match your PostgreSQL setup
- For Supabase, make sure you replaced `[YOUR-PASSWORD]` with actual password

### Migration errors
- Drop and recreate database if schema is corrupted:
```bash
# Docker
docker exec -it tasknebula-postgres psql -U postgres -c "DROP DATABASE tasknebula; CREATE DATABASE tasknebula;"

# Local
dropdb tasknebula && createdb tasknebula
```

Then run `pnpm --filter=@tasknebula/db db:push` again

---

## Next Steps

After database is setup:
1. Configure OAuth providers (see README.md)
2. Run development server: `pnpm dev`
3. Visit http://localhost:3000
4. Sign in with GitHub/Google

