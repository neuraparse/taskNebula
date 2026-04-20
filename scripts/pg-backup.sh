#!/usr/bin/env bash
# TaskNebula Postgres daily backup
# Keeps last 14 days. Recommended cron: 0 3 * * * /home/taskNebula/scripts/pg-backup.sh

set -euo pipefail

BACKUP_DIR="${BACKUP_DIR:-/var/backups/tasknebula}"
RETENTION_DAYS="${RETENTION_DAYS:-14}"
CONTAINER="${CONTAINER:-tasknebula-postgres}"
DB="${POSTGRES_DB:-tasknebula}"
USER="${POSTGRES_USER:-postgres}"

mkdir -p "$BACKUP_DIR"
chmod 700 "$BACKUP_DIR"

TS=$(date +%Y%m%d-%H%M%S)
OUT="$BACKUP_DIR/tasknebula-$TS.sql.gz"

docker exec -e PGPASSWORD="$(grep -E '^POSTGRES_PASSWORD=' /home/taskNebula/.env | cut -d= -f2-)" \
  "$CONTAINER" pg_dump -U "$USER" -d "$DB" --clean --if-exists --no-owner --no-privileges \
  | gzip -9 > "$OUT"

chmod 600 "$OUT"

# Prune old backups
find "$BACKUP_DIR" -name 'tasknebula-*.sql.gz' -type f -mtime +"$RETENTION_DAYS" -delete

echo "[pg-backup] $(date -Iseconds) wrote $OUT ($(du -h "$OUT" | cut -f1))"
