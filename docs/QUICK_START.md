# TaskNebula Quick Start Guide

Get TaskNebula up and running in 5 minutes! 🚀

## Prerequisites

Before you begin, ensure you have:

- ✅ **Node.js 22+** installed ([Download](https://nodejs.org/))
- ✅ **pnpm 9+** installed (`npm install -g pnpm`)
- ✅ **PostgreSQL 16+** running (or Docker)
- ✅ **Git** installed

## Step 1: Clone the Repository

```bash
git clone https://github.com/neuraparse/taskNebula.git
cd tasknebula
```

## Step 2: Install Dependencies

```bash
pnpm install
```

This will install all dependencies for all packages in the monorepo.

## Step 3: Setup Environment Variables

```bash
# Copy example environment files
cp apps/web/.env.example apps/web/.env.local
cp packages/db/.env.example packages/db/.env
```

Edit the `.env.local` and `.env` files with your configuration:

**`apps/web/.env.local`:**

```env
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/tasknebula
NEXTAUTH_URL=http://localhost:3000
NEXTAUTH_SECRET=your-secret-key-here-change-this-in-production
```

**`packages/db/.env`:**

```env
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/tasknebula
```

## Step 4: Start PostgreSQL

### Option A: Using Docker (Recommended)

```bash
docker-compose up -d postgres
```

This will start PostgreSQL on port 5432.

### Option B: Using Local PostgreSQL

If you have PostgreSQL installed locally:

```bash
# Create database
createdb tasknebula

# Or using psql
psql -U postgres -c "CREATE DATABASE tasknebula;"
```

## Step 5: Run Database Migrations

```bash
# Generate migration files
pnpm db:generate

# Run migrations
pnpm db:migrate
```

## Step 6: Start Development Server

```bash
pnpm dev
```

This will start:

- 🌐 **Web app** at [http://localhost:3000](http://localhost:3000)

## Step 7: Open in Browser

Navigate to [http://localhost:3000](http://localhost:3000) and you should see the TaskNebula landing page!

## 🎉 You're Ready!

### Next Steps

1. **Explore the UI**
   - Visit `/dashboard` to see the main dashboard
   - Check out `/projects/demo/board` for the Kanban board
   - Try the AI features at `/ai`

2. **Create Your First Issue**
   - Press `⌘K` (or `Ctrl+K`) to open the command palette
   - Select "Create Issue" or press `C`

3. **Customize Your Workspace**
   - Toggle dark mode with the command palette
   - Explore different views (Kanban, Timeline, etc.)

## 🛠️ Development Tools

### Database Studio

View and edit your database with Drizzle Studio:

```bash
pnpm db:studio
```

Opens at [http://localhost:4983](http://localhost:4983)

### Type Checking

```bash
pnpm type-check
```

### Linting

```bash
pnpm lint
```

### Formatting

```bash
pnpm format
```

## 🐛 Troubleshooting

### Port Already in Use

If port 3000 is already in use:

```bash
# Kill the process using port 3000
# On macOS/Linux:
lsof -ti:3000 | xargs kill -9

# On Windows:
netstat -ano | findstr :3000
taskkill /PID <PID> /F
```

### Database Connection Error

1. Ensure PostgreSQL is running:

   ```bash
   docker-compose ps
   # or
   pg_isready
   ```

2. Check your `DATABASE_URL` in `.env` files

3. Verify database exists:
   ```bash
   psql -U postgres -l
   ```

### pnpm Install Fails

1. Clear pnpm cache:

   ```bash
   pnpm store prune
   ```

2. Delete `node_modules` and reinstall:
   ```bash
   rm -rf node_modules
   pnpm install
   ```

### Migration Errors

1. Reset database (⚠️ This will delete all data):

   ```bash
   # Drop and recreate database
   dropdb tasknebula
   createdb tasknebula

   # Run migrations again
   pnpm db:migrate
   ```

## 📚 Learn More

- [Architecture Overview](./ARCHITECTURE.md)
- [Contributing Guide](../CONTRIBUTING.md)
- [API Documentation](../apps/web/src/lib/openapi/README.md)
- [Deployment Guide](./DEPLOYMENT.md)

## 💬 Get Help

- **GitHub Issues**: [Report bugs, request features, or ask questions](https://github.com/neuraparse/taskNebula/issues)
- **Discord**: Join our community (coming soon)

---

Happy coding! 🌌
