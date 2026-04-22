#!/bin/sh
set -eu

detect_node_ip() {
  if [ -n "${LIVEKIT_NODE_IP:-}" ]; then
    printf '%s' "$LIVEKIT_NODE_IP"
    return
  fi

  if command -v ip >/dev/null 2>&1; then
    ip route get 1.1.1.1 2>/dev/null | awk '/src/ {for (i = 1; i <= NF; i++) if ($i == "src") { print $(i + 1); exit }}'
    return
  fi

  hostname -i 2>/dev/null | awk '{print $1}'
}

detect_node_interface() {
  if [ -n "${LIVEKIT_INTERFACE:-}" ]; then
    printf '%s' "$LIVEKIT_INTERFACE"
    return
  fi

  if command -v ip >/dev/null 2>&1; then
    ip route get 1.1.1.1 2>/dev/null | awk '/dev/ {for (i = 1; i <= NF; i++) if ($i == "dev") { print $(i + 1); exit }}'
    return
  fi
}

NODE_IP="$(detect_node_ip)"
NODE_INTERFACE="$(detect_node_interface)"

if [ -z "$NODE_IP" ]; then
  echo "Could not determine LIVEKIT_NODE_IP" >&2
  exit 1
fi

INTERFACE_BLOCK=""
if [ -n "${NODE_INTERFACE}" ]; then
  INTERFACE_BLOCK="$(cat <<EOF
  interfaces:
    includes:
      - "${NODE_INTERFACE}"
EOF
)"
fi

WEBHOOK_BLOCK=""
if [ -n "${LIVEKIT_WEBHOOK_URL:-}" ]; then
  WEBHOOK_BLOCK="$(cat <<EOF
webhook:
  api_key: ${LIVEKIT_API_KEY:-tasknebula-dev}
  urls:
    - "${LIVEKIT_WEBHOOK_URL}"
EOF
)"
fi

cat >/tmp/livekit.yaml <<EOF
port: ${LIVEKIT_PORT:-7880}
bind_addresses:
  - "0.0.0.0"
log_level: info
rtc:
  tcp_port: ${LIVEKIT_TCP_PORT:-7881}
  port_range_start: ${LIVEKIT_RTC_START_PORT:-50000}
  port_range_end: ${LIVEKIT_RTC_END_PORT:-50020}
  use_external_ip: false
  enable_loopback_candidate: false
${INTERFACE_BLOCK}
redis:
  address: 127.0.0.1:${REDIS_PORT:-6379}$(
    if [ -n "${REDIS_PASSWORD:-}" ]; then
      printf '\n  password: %s' "$REDIS_PASSWORD"
    fi
  )
turn:
  enabled: true
  udp_port: ${LIVEKIT_TURN_UDP_PORT:-3478}
keys:
  ${LIVEKIT_API_KEY:-tasknebula-dev}: ${LIVEKIT_API_SECRET:-tasknebula-livekit-secret-local-2026}
${WEBHOOK_BLOCK}
EOF

echo "Starting LiveKit with node IP: ${NODE_IP}"
exec /livekit-server --config /tmp/livekit.yaml --node-ip "${NODE_IP}"
