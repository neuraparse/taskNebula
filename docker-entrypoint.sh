#!/bin/sh
set -e

echo "========================================="
echo "  TaskNebula - Starting..."
echo "========================================="

PARSED_DB_HOST="$(node -e "try { const u = new URL(process.env.DATABASE_URL || ''); console.log(u.hostname || 'postgres') } catch { console.log('postgres') }")"
PARSED_DB_PORT="$(node -e "try { const u = new URL(process.env.DATABASE_URL || ''); console.log(u.port || '5432') } catch { console.log('5432') }")"
DB_HOST="${DB_WAIT_HOST:-$PARSED_DB_HOST}"
DB_PORT="${DB_WAIT_PORT:-$PARSED_DB_PORT}"

# Wait for database to be ready
echo "[1/3] Waiting for PostgreSQL at ${DB_HOST}:${DB_PORT}..."
max_attempts=30
attempt=0
while ! nc -z "$DB_HOST" "$DB_PORT"; do
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
pnpm db:migrate:prod

# Seed database (demo data) only when explicitly enabled.
if [ "${SEED_DEMO_DATA:-false}" = "true" ] && [ "${SKIP_SEED:-true}" != "true" ]; then
  echo "[3/3] Seeding demo database..."
  pnpm db:seed:prod
else
  echo "[3/3] Skipping demo seed. Use /setup for first-time setup."
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
