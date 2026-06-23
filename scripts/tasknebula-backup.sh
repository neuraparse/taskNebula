#!/usr/bin/env bash
# TaskNebula full backup: Postgres custom archive + uploads volume archive.

set -euo pipefail

ENV_FILE="${ENV_FILE:-.env}"
if [ -f "$ENV_FILE" ]; then
  set -a
  # shellcheck disable=SC1090
  . "$ENV_FILE"
  set +a
fi

BACKUP_DIR="${BACKUP_DIR:-/var/backups/tasknebula}"
RETENTION_DAYS="${RETENTION_DAYS:-14}"
POSTGRES_CONTAINER="${POSTGRES_CONTAINER:-tasknebula-postgres}"
WEB_CONTAINER="${WEB_CONTAINER:-tasknebula-web}"
UPLOADS_VOLUME="${UPLOADS_VOLUME:-tasknebula_uploads_data}"
DB="${POSTGRES_DB:-tasknebula}"
USER="${POSTGRES_USER:-postgres}"
PASSWORD="${POSTGRES_PASSWORD:-postgres}"

TS="$(date -u +%Y%m%d-%H%M%SZ)"
OUT_DIR="$BACKUP_DIR/tasknebula-$TS"

mkdir -p "$OUT_DIR"
chmod 700 "$BACKUP_DIR" "$OUT_DIR"

docker exec -e PGPASSWORD="$PASSWORD" "$POSTGRES_CONTAINER" \
  pg_dump -U "$USER" -d "$DB" --format=custom --no-owner --no-privileges \
  > "$OUT_DIR/postgres.dump"

if docker ps --format '{{.Names}}' | grep -Fxq "$WEB_CONTAINER"; then
  docker run --rm --volumes-from "$WEB_CONTAINER" -v "$OUT_DIR:/backup" alpine:3.22 \
    sh -c 'cd /app && tar -czf /backup/uploads.tar.gz uploads'
else
  docker run --rm -v "$UPLOADS_VOLUME:/uploads:ro" -v "$OUT_DIR:/backup" alpine:3.22 \
    sh -c 'cd / && tar -czf /backup/uploads.tar.gz uploads'
fi

(
  cd "$OUT_DIR"
  sha256sum postgres.dump uploads.tar.gz > SHA256SUMS
)

cat > "$OUT_DIR/manifest.json" <<JSON
{
  "kind": "tasknebula.backup",
  "createdAt": "$(date -u +%Y-%m-%dT%H:%M:%SZ)",
  "postgresContainer": "$POSTGRES_CONTAINER",
  "webContainer": "$WEB_CONTAINER",
  "database": "$DB",
  "artifacts": {
    "database": "postgres.dump",
    "uploads": "uploads.tar.gz",
    "checksums": "SHA256SUMS"
  }
}
JSON

chmod 600 "$OUT_DIR"/*

find "$BACKUP_DIR" -mindepth 1 -maxdepth 1 -type d -name 'tasknebula-*' \
  -mtime +"$RETENTION_DAYS" -exec rm -rf {} +

echo "[tasknebula-backup] wrote $OUT_DIR"
