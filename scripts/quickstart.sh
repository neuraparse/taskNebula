#!/usr/bin/env bash
# TaskNebula one-command quickstart.
# Pipe from curl: curl -fsSL <url> | bash
# Or run locally after cloning: ./scripts/quickstart.sh
set -euo pipefail

BLUE='\033[0;34m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; RED='\033[0;31m'; NC='\033[0m'
log()  { printf "%b==>%b %s\n" "$BLUE" "$NC" "$*"; }
ok()   { printf "%b✓%b %s\n"  "$GREEN" "$NC" "$*"; }
warn() { printf "%b!%b %s\n"  "$YELLOW" "$NC" "$*"; }
die()  { printf "%b✗%b %s\n"  "$RED"   "$NC" "$*" >&2; exit 1; }

command -v docker >/dev/null 2>&1 || die "Docker is required. Install: https://docs.docker.com/get-docker/"
docker compose version >/dev/null 2>&1 || die "Docker Compose v2 is required (docker compose plugin)."
command -v openssl >/dev/null 2>&1 || die "openssl is required to generate AUTH_SECRET."

TARGET_DIR="${TASKNEBULA_DIR:-$PWD/tasknebula}"

if [ ! -d "$TARGET_DIR/.git" ]; then
  log "Cloning TaskNebula into $TARGET_DIR ..."
  command -v git >/dev/null 2>&1 || die "git is required for the first install."
  git clone --depth 1 https://github.com/neuraparse/tasknebula.git "$TARGET_DIR"
else
  log "Updating existing checkout in $TARGET_DIR ..."
  git -C "$TARGET_DIR" pull --ff-only
fi

cd "$TARGET_DIR"

if [ ! -f .env ]; then
  log "Provisioning .env from .env.example ..."
  cp .env.example .env
  SECRET="$(openssl rand -base64 32)"
  # portable sed for macOS + Linux
  if [ "$(uname)" = "Darwin" ]; then
    sed -i '' "s|^AUTH_SECRET=.*|AUTH_SECRET=${SECRET}|" .env
  else
    sed -i "s|^AUTH_SECRET=.*|AUTH_SECRET=${SECRET}|" .env
  fi
  ok "Generated AUTH_SECRET (32-byte base64)."
else
  warn ".env already exists — leaving it as-is."
fi

log "Pulling latest published image: neuraparse/tasknebula:latest ..."
docker compose pull web || warn "Image pull failed — will fall back to local build."

log "Starting services (postgres · redis · livekit · web) ..."
docker compose up -d

log "Waiting for the web container to report healthy ..."
DEADLINE=$(( $(date +%s) + 180 ))
while :; do
  STATUS="$(docker inspect -f '{{.State.Health.Status}}' tasknebula-web 2>/dev/null || true)"
  [ "$STATUS" = "healthy" ] && break
  [ "$(date +%s)" -ge "$DEADLINE" ] && die "Container did not become healthy within 180s. Run 'docker compose logs web' to inspect."
  sleep 3
done

ok "TaskNebula is running at http://localhost:3000"
printf "\n"
printf "  First-time setup wizard will guide admin-account creation.\n"
printf "  Logs:    docker compose logs -f web\n"
printf "  Stop:    docker compose down\n"
printf "  Update:  docker compose pull && docker compose up -d\n\n"
