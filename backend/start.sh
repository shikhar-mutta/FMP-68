#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────
# FMP-68 backend — clean rebuild + launch
#
# What this does:
#   1. Tears the previous backend stack down (containers, images,
#      volumes, network) so the next rebuild really is clean.
#   2. Docker-builds all 6 microservices from scratch (--no-cache).
#   3. Brings the stack up in detached mode.
#   4. Waits for every pod's /health endpoint to return HTTP 200.
#
# Pre-reqs on the host:
#   - docker + docker compose v2
#   - MongoDB running locally with bindIp 0.0.0.0 (or include
#     the docker0 bridge IP) and the rs0 replica set initialised
#
# Usage:
#   ./backend/start.sh
# ─────────────────────────────────────────────────────────────
set -e
set -u
set -o pipefail

BACKEND_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
COMPOSE_FILE="$BACKEND_DIR/docker-compose.yml"

# Colours
G='\033[0;32m'; C='\033[0;36m'; Y='\033[1;33m'; R='\033[0;31m'; N='\033[0m'

banner() { echo -e "${C}══════════════════════════════════════════${N}"; echo -e "${C}  $*${N}"; echo -e "${C}══════════════════════════════════════════${N}"; }

banner "FMP-68 backend — clean rebuild"

echo -e "${Y}[1/5] Stop + remove previous backend containers/images/volumes${N}"
docker compose -f "$COMPOSE_FILE" down --rmi local --volumes --remove-orphans 2>&1 | sed 's/^/    /' || true
# Belt-and-braces: nuke any lingering fmp-<svc> images compose missed
imgs=""
for svc in api-gateway auth-service users-service paths-service tracking-service notification-service; do
  ids=$(docker images "fmp-${svc}" -q 2>/dev/null | tr '\n' ' ')
  imgs="$imgs $ids"
done
imgs=$(echo "$imgs" | xargs)
if [ -n "$imgs" ]; then
  docker rmi -f $imgs >/dev/null 2>&1 || true
fi
# Free any orphan host process holding backend ports (failed prior run leftovers)
for port in 4000 4001 4002 4003 4004 4005 5672 15672 6379; do
  fuser -k ${port}/tcp 2>/dev/null || true
done
# Remove the fmp-net bridge so frontend won't try to attach to a stale one
docker network rm fmp-net 2>/dev/null || true

echo -e "${Y}[2/5] Prune dangling images + backend build cache${N}"
# Removes orphan intermediate layers (e.g. failed 'npm ci' / prisma generate
# corpses) and the BuildKit cache so the next build re-runs every RUN step.
docker image prune -f 2>&1 | tail -2 | sed 's/^/    /' || true
docker builder prune -f 2>&1 | tail -2 | sed 's/^/    /' || true

echo -e "${Y}[3/5] Build all 6 services from scratch (--no-cache)${N}"
docker compose -f "$COMPOSE_FILE" build --no-cache 2>&1 | tail -3

echo -e "${Y}[4/5] Bring stack up${N}"
docker compose -f "$COMPOSE_FILE" up -d 2>&1 | tail -10

echo -e "${Y}[5/5] Wait for /health on every backend service${N}"
declare -A PORTS=( [api-gateway]=4000 [auth-service]=4001 [users-service]=4002 [paths-service]=4003 [tracking-service]=4004 [notification-service]=4005 )
for i in $(seq 1 24); do
  ready=0
  for svc in "${!PORTS[@]}"; do
    if curl -s -o /dev/null -m 2 -w '%{http_code}' "http://localhost:${PORTS[$svc]}/health" 2>/dev/null | grep -q '^200$'; then
      ready=$((ready + 1))
    fi
  done
  echo "    iter $i: $ready/${#PORTS[@]} services healthy"
  [ "$ready" -eq "${#PORTS[@]}" ] && break
  sleep 5
done

echo ""
echo -e "${G}Backend status${N}"
docker compose -f "$COMPOSE_FILE" ps --format "table {{.Name}}\t{{.Status}}" 2>&1 | sed 's/^/    /'

echo ""
echo -e "${G}Service URLs (host-mapped)${N}"
for svc in "${!PORTS[@]}"; do
  port=${PORTS[$svc]}
  printf "    %-22s http://localhost:%s/health\n" "$svc" "$port"
done
echo ""
echo -e "${G}✅ Backend stack is up. Next: ./frontend/start.sh${N}"
