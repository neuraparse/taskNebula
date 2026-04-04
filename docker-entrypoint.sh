#!/bin/sh
set -e

echo "========================================="
echo "  TaskNebula - Starting..."
echo "========================================="

# Wait for database to be ready
echo "[1/3] Waiting for PostgreSQL..."
max_attempts=30
attempt=0
while ! nc -z postgres 5432; do
  attempt=$((attempt + 1))
  if [ $attempt -eq $max_attempts ]; then
    echo "FAILED: Could not connect to PostgreSQL after $max_attempts attempts"
    exit 1
  fi
  echo "  Waiting for PostgreSQL... ($attempt/$max_attempts)"
  sleep 2
done
echo "  PostgreSQL is ready!"

# Wait a bit more to ensure database is fully initialized
sleep 3

# Apply database migrations
echo "[2/3] Applying database migrations..."
cd /app/packages/db
pnpm db:migrate:prod 2>&1 || {
  echo "  Migration skipped or already applied"
}

# Seed database (demo data + default workflows)
if [ "${SKIP_SEED:-}" = "true" ]; then
  echo "[3/3] Skipping seed (SKIP_SEED=true) — use /setup for first-time setup"
else
  echo "[3/3] Seeding database..."
  pnpm db:seed:prod 2>&1 || {
    echo "  Seed skipped (database already seeded)"
  }
fi

# Check SMTP connectivity (optional)
if [ -n "${SMTP_HOST:-}" ]; then
  echo "[*] Checking SMTP ($SMTP_HOST:${SMTP_PORT:-25})..."
  if nc -z "$SMTP_HOST" "${SMTP_PORT:-25}" 2>/dev/null; then
    echo "  SMTP is reachable!"
  else
    echo "  SMTP not reachable (email notifications will be disabled)"
  fi
fi

echo "========================================="
echo "  Database ready!"
echo "  Starting web server on port 3000..."
echo "========================================="

# Start the Next.js application
cd /app

# Run as nextjs user if we're root (security best practice)
if [ "$(id -u)" = "0" ]; then
  exec su-exec nextjs node apps/web/server.js
else
  exec node apps/web/server.js
fi
