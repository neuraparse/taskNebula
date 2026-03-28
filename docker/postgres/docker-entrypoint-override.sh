#!/bin/bash
set -e

PGDATA="${PGDATA:-/var/lib/postgresql/data}"

# Only act on existing databases with a password configured
if [ -s "$PGDATA/PG_VERSION" ] && [ -n "$POSTGRES_PASSWORD" ]; then
  # 1. Backup pg_hba.conf, temporarily trust host connections
  cp "$PGDATA/pg_hba.conf" "$PGDATA/pg_hba.conf.bak"
  sed -i 's/^\(host.*\)scram-sha-256$/\1trust/' "$PGDATA/pg_hba.conf"
  sed -i 's/^\(host.*\)md5$/\1trust/' "$PGDATA/pg_hba.conf"

  # 2. Start postgres on unix socket only (no TCP = no external access during trust)
  pg_ctl -D "$PGDATA" -o "-c listen_addresses=''" -w start -l /tmp/pg_pwd_fix.log 2>/dev/null || {
    mv "$PGDATA/pg_hba.conf.bak" "$PGDATA/pg_hba.conf"
    exec docker-entrypoint.sh "$@"
  }

  # 3. Re-hash password with scram-sha-256 (PG16 default, secure)
  psql -U "${POSTGRES_USER:-postgres}" -d postgres \
    -c "ALTER USER \"${POSTGRES_USER:-postgres}\" PASSWORD '${POSTGRES_PASSWORD}';" \
    2>/dev/null || true

  # 4. Stop temporary server
  pg_ctl -D "$PGDATA" -m fast -w stop 2>/dev/null

  # 5. Restore original pg_hba.conf (keeps scram-sha-256)
  mv "$PGDATA/pg_hba.conf.bak" "$PGDATA/pg_hba.conf"
fi

exec docker-entrypoint.sh "$@"
