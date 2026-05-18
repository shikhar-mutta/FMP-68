#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────
# FMP-68 — Online Mode Teardown
#
# Stops the online-mode frontend + backend stacks and any running
# ngrok tunnel. Does NOT touch local-dev containers started via
# ./start.sh (they use a different image set).
#
# Usage:
#   ./stop-online.sh
# ─────────────────────────────────────────────────────────────────────
set -euo pipefail

cd "$(dirname "$0")"

# backend/docker-compose.yml uses ${X:?} fail-fast guards on the secret
# env vars; `docker compose down` parses the file just like `up` does,
# so it would refuse to stop unless the env is set. Stub them just for
# the down — no real creds needed to STOP a container.
_compose_down() (
  JWT_SECRET="${JWT_SECRET:-stub-for-down}" \
  GOOGLE_CLIENT_ID="${GOOGLE_CLIENT_ID:-stub-for-down}" \
  GOOGLE_CLIENT_SECRET="${GOOGLE_CLIENT_SECRET:-stub-for-down}" \
  docker compose "$@" down --volumes
)

echo "▶ Stopping frontend (online watch mode)…"
( cd frontend && _compose_down --env-file .env.online -f docker-compose.online-watch.yml ) || true

echo "▶ Stopping frontend (online prod mode)…"
( cd frontend && _compose_down --env-file .env.online -f docker-compose.yml -f docker-compose.online.yml ) || true

echo "▶ Stopping backend (online mode)…"
( cd backend && _compose_down --env-file .env.online -f docker-compose.yml -f docker-compose.online.yml ) || true

echo "▶ Killing any running ngrok tunnel…"
pkill -f "ngrok http" 2>/dev/null || true

echo "▶ Stopping Vault port-forward + namespace…"
if [ -f /tmp/fmp-vault-pf.pid ]; then
  kill "$(cat /tmp/fmp-vault-pf.pid)" 2>/dev/null || true
  rm -f /tmp/fmp-vault-pf.pid
fi
pkill -f "kubectl port-forward -n vault svc/vault" 2>/dev/null || true
kubectl delete namespace vault --wait=false 2>/dev/null | sed 's/^/  /' || true

echo "✅ All online-mode services stopped."
