#!/usr/bin/env bash
# TaskNebula nginx hardening applier — run once with sudo
# Usage:  sudo bash scripts/apply-nginx-hardening.sh

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"

if [[ $EUID -ne 0 ]]; then
  echo "must run as root" >&2
  exit 1
fi

install -m 0644 "$REPO_ROOT/nginx/tasknebula-hardening.conf" /etc/nginx/conf.d/tasknebula-hardening.conf
install -m 0644 "$REPO_ROOT/nginx/tasknebula.conf" /etc/nginx/sites-available/tasknebula
ln -sfn /etc/nginx/sites-available/tasknebula /etc/nginx/sites-enabled/tasknebula

nginx -t
nginx -s reload

echo "✅ Hardening applied. Rate limits + scanner blocks + TLS tuning + CSP + HSTS active."
