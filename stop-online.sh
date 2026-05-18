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

echo "▶ Stopping frontend (online watch mode)…"
( cd frontend && docker compose --env-file .env.online -f docker-compose.online-watch.yml down --volumes ) || true

echo "▶ Stopping frontend (online prod mode)…"
( cd frontend && docker compose --env-file .env.online -f docker-compose.yml -f docker-compose.online.yml down --volumes ) || true

echo "▶ Stopping backend (online mode)…"
( cd backend && docker compose --env-file .env.online -f docker-compose.yml -f docker-compose.online.yml down --volumes ) || true

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
