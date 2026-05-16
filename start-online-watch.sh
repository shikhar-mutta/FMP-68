#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────
# FMP-68 — Online WATCH Mode Startup
#
# Same as ./start-online.sh, except the frontend runs the CRA dev
# server inside a container with HMR. Any edit to frontend/src/ is
# recompiled and pushed to every connected browser (including the
# phone on the public ngrok URL) within ~1–2 seconds.
#
# Usage:
#   ./start-online-watch.sh
# Stop with ./stop-online.sh
# ─────────────────────────────────────────────────────────────────────
set -euo pipefail

cd "$(dirname "$0")"

NGROK_DOMAIN="patriarchic-georgianne-acetimetric.ngrok-free.dev"

echo "▶ Pre-flight: Docker running?"
docker info >/dev/null 2>&1 || { echo "✖ Docker daemon is not running."; exit 1; }

echo "▶ Pre-flight: ngrok installed & authed?"
command -v ngrok >/dev/null || { echo "✖ ngrok not installed."; exit 1; }
ngrok config check >/dev/null 2>&1 || { echo "✖ ngrok not authed. Run: ngrok config add-authtoken <token>"; exit 1; }

echo "▶ Stopping any running online containers (prod or watch)…"
( cd frontend && docker compose --env-file .env.online -f docker-compose.online-watch.yml down --volumes ) || true
( cd frontend && docker compose --env-file .env.online -f docker-compose.yml -f docker-compose.online.yml down --volumes ) || true
( cd backend  && docker compose --env-file .env.online -f docker-compose.yml -f docker-compose.online.yml down --volumes ) || true

echo "▶ Removing any stale 'fmp-net' (backend compose will recreate with proper labels)…"
docker network rm fmp-net >/dev/null 2>&1 || true

echo "▶ Starting backend (online mode)…"
( cd backend && docker compose --env-file .env.online -f docker-compose.yml -f docker-compose.online.yml up -d --build )

echo "▶ Waiting for api-gateway /health (up to 2 min)…"
for i in $(seq 1 60); do
  if curl -fs http://localhost:4000/health >/dev/null 2>&1; then
    echo "  ✓ api-gateway healthy"
    break
  fi
  sleep 2
  if [ "$i" -eq 60 ]; then
    echo "✖ api-gateway did not become healthy in 2 min."
    echo "   Logs: docker compose -f backend/docker-compose.yml logs api-gateway"
    exit 1
  fi
done

echo "▶ Starting frontend (WATCH mode)…"
echo "   ⏱  First start does 'npm install' inside the container (~3–5 min)."
echo "   ⏱  Subsequent starts are fast (node_modules cached in named volume)."
( cd frontend && docker compose --env-file .env.online -f docker-compose.online-watch.yml up -d )

echo "▶ Waiting for CRA dev server on http://localhost:3000 (up to 8 min)…"
for i in $(seq 1 240); do
  if curl -fs http://localhost:3000 >/dev/null 2>&1; then
    echo "  ✓ Dev server ready"
    break
  fi
  sleep 2
  if [ "$i" -eq 240 ]; then
    echo "✖ Dev server did not come up. Watch the logs:"
    echo "   docker compose -f frontend/docker-compose.online-watch.yml logs -f"
    exit 1
  fi
done

echo ""
echo "─────────────────────────────────────────────────────────────"
echo "✅  Online WATCH stack is up."
echo "   Local:   http://localhost:3000"
echo "   Public:  https://${NGROK_DOMAIN}"
echo ""
echo "   ✏  Edit any file in frontend/src/ → auto-reload everywhere"
echo "   📜  Tail dev-server logs:"
echo "      docker compose -f frontend/docker-compose.online-watch.yml logs -f"
echo "─────────────────────────────────────────────────────────────"
echo ""
echo "▶ Starting ngrok tunnel (Ctrl-C stops the tunnel; containers keep running)…"
echo ""

exec ngrok http --domain="${NGROK_DOMAIN}" 3000
