#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────
# FMP-68 frontend — clean rebuild + launch
#
# What this does:
#   1. Tears the previous frontend container/image down.
#   2. Verifies the backend's 'fmp-net' bridge already exists
#      (created by backend/start.sh). Refuses to continue otherwise.
#   3. Docker-builds the nginx image from scratch (--no-cache).
#   4. Brings the container up on host port 3000.
#   5. Curls / to confirm nginx serves the SPA.
#
# Usage:
#   ./backend/start.sh   ← must run this first
#   ./frontend/start.sh
# ─────────────────────────────────────────────────────────────
set -e
set -u
set -o pipefail

FE_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
COMPOSE_FILE="$FE_DIR/docker-compose.yml"

G='\033[0;32m'; C='\033[0;36m'; Y='\033[1;33m'; R='\033[0;31m'; N='\033[0m'

banner() { echo -e "${C}══════════════════════════════════════════${N}"; echo -e "${C}  $*${N}"; echo -e "${C}══════════════════════════════════════════${N}"; }

banner "FMP-68 frontend — clean rebuild"

echo -e "${Y}[1/5] Stop + remove previous frontend container/image/volume${N}"
docker compose -f "$COMPOSE_FILE" down --rmi local --volumes --remove-orphans 2>&1 | sed 's/^/    /' || true
# Belt-and-braces: nuke any lingering tagged frontend image compose missed
docker rmi -f fmp-frontend:local 2>/dev/null || true
docker rmi -f $(docker images "fmp-frontend*" -q 2>/dev/null) 2>/dev/null || true
# Kill any orphan host process holding port 3000 (failed prior run leftovers)
fuser -k 3000/tcp 2>/dev/null || true

echo -e "${Y}[2/5] Prune dangling images + frontend build cache${N}"
# Removes orphan intermediate layers (e.g. failed 'npm ci' corpses) and the
# BuildKit cache so the next build re-runs every RUN step from scratch.
docker image prune -f 2>&1 | tail -2 | sed 's/^/    /' || true
docker builder prune -f 2>&1 | tail -2 | sed 's/^/    /' || true

echo -e "${Y}[3/5] Verify backend network (fmp-net) exists${N}"
if ! docker network inspect fmp-net >/dev/null 2>&1; then
  echo -e "${R}    ✘ fmp-net not found.${N}"
  echo -e "${R}      Run ./backend/start.sh first to bring backend up.${N}"
  exit 1
fi
echo "    ✓ fmp-net exists"

echo -e "${Y}[4/5] Build frontend image from scratch (--no-cache)${N}"
docker compose -f "$COMPOSE_FILE" build --no-cache 2>&1 | tail -3

echo -e "${Y}[5/5] Bring frontend up + wait for HTTP 200${N}"
docker compose -f "$COMPOSE_FILE" up -d 2>&1 | tail -3
for i in $(seq 1 12); do
  code=$(curl -s -o /dev/null -m 2 -w '%{http_code}' http://localhost:3000/ 2>/dev/null || echo 000)
  echo "    iter $i: http://localhost:3000/ → HTTP $code"
  [ "$code" = "200" ] && break
  sleep 3
done

echo ""
echo -e "${G}Frontend status${N}"
docker compose -f "$COMPOSE_FILE" ps --format "table {{.Name}}\t{{.Status}}" 2>&1 | sed 's/^/    /'

echo ""
echo -e "${G}✅ Frontend up at http://localhost:3000${N}"
echo -e "${G}   (frontend serves the SPA; the React code calls the api-gateway${N}"
echo -e "${G}    on http://localhost:4000 — exposed by docker-compose or by${N}"
echo -e "${G}    kubectl port-forward when K8s is the target).${N}"
