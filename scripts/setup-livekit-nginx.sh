#!/usr/bin/env bash
# TaskNebula Community — one-shot LiveKit TLS terminator setup.
#
# Stands up nginx on a dedicated subdomain (defaults to livekit.<main>),
# requests a Let's Encrypt cert, reloads nginx, writes
# NEXT_PUBLIC_LIVEKIT_URL into .env, and rebuilds the web container so
# the Next.js bundle picks up the new URL.
#
# Usage (run as root on the host that terminates TLS for the main site):
#   sudo bash scripts/setup-livekit-nginx.sh tasknebula.nowflow.io \
#     you@example.com
#
# Args:
#   $1  main domain the TaskNebula app is already served from
#       (e.g. tasknebula.nowflow.io). The LiveKit subdomain is derived
#       as `livekit.<main>` unless $3 is passed.
#   $2  email certbot registers with.
#   $3  optional override for the LiveKit subdomain FQDN.

set -euo pipefail

MAIN_DOMAIN="${1:?usage: $0 <main-domain> <certbot-email> [livekit-fqdn]}"
CERT_EMAIL="${2:?usage: $0 <main-domain> <certbot-email> [livekit-fqdn]}"
LIVEKIT_HOST="${3:-livekit.${MAIN_DOMAIN}}"

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
TEMPLATE="${REPO_ROOT}/nginx/tasknebula-livekit.conf"
SITES_AVAILABLE="/etc/nginx/sites-available/${LIVEKIT_HOST}"
SITES_ENABLED="/etc/nginx/sites-enabled/${LIVEKIT_HOST}"
ENV_FILE="${REPO_ROOT}/.env"

need() { command -v "$1" >/dev/null 2>&1 || { echo "❌ missing dependency: $1"; exit 1; }; }
need nginx
need certbot
need docker

echo "▶ LiveKit host will be: ${LIVEKIT_HOST}"
echo "▶ Make sure DNS A record ${LIVEKIT_HOST} → this server IP is already propagated."
printf '  Press enter to continue, or Ctrl+C to abort… '
read -r _

if [ ! -f "${TEMPLATE}" ]; then
  echo "❌ nginx template not found at ${TEMPLATE}"
  exit 1
fi

echo "▶ Writing HTTP-only bootstrap vhost so certbot can answer the ACME challenge"
# Minimal HTTP-only vhost; certbot --nginx will extend it with a TLS
# server block after the cert is issued, and we then overwrite the
# whole file with the full proxy template below.
cat > "${SITES_AVAILABLE}" <<EOF
server {
    listen 80;
    server_name ${LIVEKIT_HOST};

    location /.well-known/acme-challenge/ {
        root /var/www/certbot;
    }

    location / {
        return 200 'livekit-bootstrap';
        add_header Content-Type text/plain;
    }
}
EOF
ln -sf "${SITES_AVAILABLE}" "${SITES_ENABLED}"
nginx -t
nginx -s reload

echo "▶ Requesting Let's Encrypt cert for ${LIVEKIT_HOST}"
certbot --nginx \
  --non-interactive --agree-tos \
  --email "${CERT_EMAIL}" \
  -d "${LIVEKIT_HOST}"

echo "▶ Restoring full nginx vhost (TLS + proxy)"
sed "s/livekit.your-domain.example.com/${LIVEKIT_HOST}/g" "${TEMPLATE}" > "${SITES_AVAILABLE}"
nginx -t && nginx -s reload

echo "▶ Updating ${ENV_FILE} with NEXT_PUBLIC_LIVEKIT_URL"
if [ -f "${ENV_FILE}" ]; then
  if grep -q '^NEXT_PUBLIC_LIVEKIT_URL=' "${ENV_FILE}"; then
    sed -i "s|^NEXT_PUBLIC_LIVEKIT_URL=.*|NEXT_PUBLIC_LIVEKIT_URL=wss://${LIVEKIT_HOST}|" "${ENV_FILE}"
  else
    printf '\nNEXT_PUBLIC_LIVEKIT_URL=wss://%s\n' "${LIVEKIT_HOST}" >> "${ENV_FILE}"
  fi
else
  echo "❌ ${ENV_FILE} not found — create one from .env.example first"
  exit 1
fi

echo "▶ Rebuilding web container so the bundle has the new WSS URL"
(cd "${REPO_ROOT}" && docker compose --env-file .env up -d --build web)

echo ""
echo "✅ Done."
echo "   Browser should now open wss://${LIVEKIT_HOST}/rtc with status 101."
echo "   Open the chat call, DevTools → Network → filter 'rtc' to verify."
