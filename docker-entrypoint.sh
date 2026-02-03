#!/bin/sh
set -e

echo "🚀 Starting TaskNebula initialization..."

# Wait for database to be ready
echo "⏳ Waiting for PostgreSQL to be ready..."
max_attempts=30
attempt=0
while ! nc -z postgres 5432; do
  attempt=$((attempt + 1))
  if [ $attempt -eq $max_attempts ]; then
    echo "❌ Failed to connect to PostgreSQL after $max_attempts attempts"
    exit 1
  fi
  echo "Waiting for PostgreSQL... (attempt $attempt/$max_attempts)"
  sleep 2
done
echo "✅ PostgreSQL is ready!"

# Wait a bit more to ensure database is fully initialized
sleep 5

# Apply database schema using drizzle-kit push (2025 best practice: schema-first)
echo "🔄 Pushing database schema..."
cd /app/packages/db

# Push schema with force flag (non-interactive)
pnpm drizzle-kit push --force || {
  echo "⚠️  Schema push failed or already applied"
}

echo "✅ Schema push completed!"

# Run database seed with production data
echo "🌱 Seeding database..."
pnpm db:seed:prod || {
  echo "⚠️  Seed failed or database already seeded"
}

echo "✅ Database initialization complete!"

# Start the Agent Worker in background
echo "🤖 Starting Agent Worker..."
cd /app
if [ "$(id -u)" = "0" ]; then
  su-exec nextjs npx tsx apps/web/src/workers/agent-worker.ts &
  WORKER_PID=$!
  echo "✅ Agent Worker started (PID: $WORKER_PID)"
else
  npx tsx apps/web/src/workers/agent-worker.ts &
  WORKER_PID=$!
  echo "✅ Agent Worker started (PID: $WORKER_PID)"
fi

# Start the Next.js application
echo "🚀 Starting Next.js server..."
cd /app

# Run as nextjs user if we're root
if [ "$(id -u)" = "0" ]; then
  exec su-exec nextjs node apps/web/server.js
else
  exec node apps/web/server.js
fi
