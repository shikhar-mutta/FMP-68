#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────
# FMP-68 — root launcher (Docker stack, dev orchestration)
#
# Brings up both backend + frontend with a single clean rebuild.
# Equivalent to running:
#   ./backend/start.sh
#   ./frontend/start.sh
# back-to-back, with extra sanity checks between them.
#
# Pre-reqs:
#   - docker + docker compose v2 installed on the host
#   - mongod running locally with bindIp 0.0.0.0 (or include
#     the docker0 bridge) and rs0 replica set initialised
#
# Usage:
#   ./start.sh            # full clean rebuild + run
#   ./start.sh --stop     # tear everything down
#
# After it finishes:
#   http://localhost:3000    Frontend (nginx)
#   http://localhost:4000    Backend gateway (HTTP + WS)
#   http://localhost:15672   RabbitMQ management UI  (guest / guest)
# ─────────────────────────────────────────────────────────────
set -e
set -u
set -o pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

G='\033[0;32m'; C='\033[0;36m'; Y='\033[1;33m'; R='\033[0;31m'; N='\033[0m'
banner() { echo -e "${C}══════════════════════════════════════════${N}"; echo -e "${C}  $*${N}"; echo -e "${C}══════════════════════════════════════════${N}"; }

# ── --stop flag → tear everything down and exit ────────────────
if [ "${1:-}" = "--stop" ]; then
  banner "FMP-68 — stopping everything"

  echo -e "${Y}[1/4] Stop + remove frontend stack${N}"
  docker compose -f "$ROOT_DIR/frontend/docker-compose.yml" down --rmi local --volumes --remove-orphans 2>&1 | sed 's/^/    /' || true
  docker rmi -f $(docker images "fmp-frontend*" -q 2>/dev/null) 2>/dev/null || true
  fuser -k 3000/tcp 2>/dev/null || true

  echo -e "${Y}[2/4] Stop + remove backend stack${N}"
  docker compose -f "$ROOT_DIR/backend/docker-compose.yml"  down --rmi local --volumes --remove-orphans 2>&1 | sed 's/^/    /' || true
  imgs=""
  for svc in api-gateway auth-service users-service paths-service tracking-service notification-service; do
    ids=$(docker images "fmp-${svc}" -q 2>/dev/null | tr '\n' ' ')
    imgs="$imgs $ids"
  done
  imgs=$(echo "$imgs" | xargs)
  [ -n "$imgs" ] && docker rmi -f $imgs >/dev/null 2>&1 || true
  for port in 4000 4001 4002 4003 4004 4005 5672 15672 6379; do
    fuser -k ${port}/tcp 2>/dev/null || true
  done

  echo -e "${Y}[3/4] Remove fmp-net bridge${N}"
  docker network rm fmp-net 2>/dev/null && echo "    removed fmp-net" || echo "    already gone"

  echo -e "${Y}[4/4] Prune dangling images + build cache${N}"
  docker image prune -f 2>&1 | tail -2 | sed 's/^/    /' || true
  docker builder prune -f 2>&1 | tail -2 | sed 's/^/    /' || true

  echo -e "${Y}[vault] Stop Vault port-forward + namespace${N}"
  if [ -f /tmp/fmp-vault-pf.pid ]; then
    kill "$(cat /tmp/fmp-vault-pf.pid)" 2>/dev/null || true
    rm -f /tmp/fmp-vault-pf.pid
  fi
  pkill -f "kubectl port-forward -n vault svc/vault" 2>/dev/null || true
  kubectl delete namespace vault --wait=false 2>/dev/null | sed 's/^/    /' || true

  echo ""
  echo -e "${G}✅ Stopped. Remaining fmp-* artifacts:${N}"
  docker ps -a --filter "name=fmp-" --format "    {{.Names}}" | head -10
  docker images "fmp-*" --format "    {{.Repository}}:{{.Tag}}" | head -10
  exit 0
fi

banner "FMP-68 — clean rebuild + launch (backend + frontend)"

# ── Pre-flight ─────────────────────────────────────────────────
echo -e "${Y}[pre-flight] docker daemon${N}"
if ! docker info >/dev/null 2>&1; then
  echo -e "${R}    ✘ docker daemon not reachable. Start Docker, then re-run.${N}"; exit 1
fi
echo "    ✓ docker is up"

echo -e "${Y}[pre-flight] host MongoDB${N}"
if command -v mongosh >/dev/null 2>&1; then
  if mongosh --quiet --eval "rs.status().ok" 2>/dev/null | grep -q '^1$'; then
    echo "    ✓ mongod rs0 healthy"
  else
    echo -e "${R}    ⚠ mongod replica set not reachable.  Backend will fail Prisma calls.${N}"
    echo -e "${R}      Ensure mongod is running and rs.status() returns ok=1.${N}"
  fi
else
  echo "    (mongosh not installed — skipping check)"
fi

# ── 1. Backend ────────────────────────────────────────────────
banner "Backend stack"
"$ROOT_DIR/backend/start.sh"

# ── 2. Frontend ───────────────────────────────────────────────
banner "Frontend stack"
"$ROOT_DIR/frontend/start.sh"

# ── 2b. Vault (ansible deploy + detached UI port-forward) ─────
banner "Vault UI"
echo -e "${Y}[vault] ansible-playbook site.yml --tags vault${N}"
ansible-playbook -i backend/ansible/inventory.ini backend/ansible/site.yml --tags vault 2>&1 | tail -8 | sed 's/^/    /'

echo -e "${Y}[vault] start detached port-forward on 127.0.0.1:8200${N}"
if [ -f /tmp/fmp-vault-pf.pid ]; then
  kill "$(cat /tmp/fmp-vault-pf.pid)" 2>/dev/null || true
  rm -f /tmp/fmp-vault-pf.pid
fi
fuser -k 8200/tcp 2>/dev/null || true
nohup kubectl port-forward -n vault svc/vault 8200:8200 > /tmp/fmp-vault-pf.log 2>&1 &
echo $! > /tmp/fmp-vault-pf.pid
disown
echo -e "${G}    ✓ Vault UI: http://127.0.0.1:8200/ui/vault/secrets/secret/kv/fmp%2Fauth/details?version=1${N}"

# ── 3. Final report ───────────────────────────────────────────
banner "Done"
echo ""
echo -e "${G}Running containers${N}"
docker ps --filter "name=fmp-" --format "  {{.Names}}  {{.Status}}  →  {{.Ports}}" 2>&1 | head -15
echo ""
echo -e "${G}Open in your browser:${N}"
echo "  http://localhost:3000    Frontend"
echo "  http://localhost:4000    Backend gateway"
echo "  http://localhost:15672   RabbitMQ UI  (guest / guest)"
echo "  http://127.0.0.1:8200/ui Vault UI     (token: fmp-dev-root)"
echo ""
echo -e "${G}Stop everything later with:${N}"
echo "  ./start.sh --stop"
