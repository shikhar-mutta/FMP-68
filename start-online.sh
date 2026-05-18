#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────
# FMP-68 — Online Mode Startup
#
# Brings up the full local stack (backend + frontend) configured to be
# reachable from the public internet via a stable ngrok dev domain.
# Keeps local-dev (./start.sh) completely untouched.
#
# Usage:
#   ./start-online.sh
#
# To stop:
#   ./stop-online.sh
# ─────────────────────────────────────────────────────────────────────
set -euo pipefail

# Always run relative to the repo root, regardless of where invoked from
cd "$(dirname "$0")"

NGROK_DOMAIN="patriarchic-georgianne-acetimetric.ngrok-free.dev"

# Minikube knobs — kept aligned with start-k8s.sh so flipping between the
# two launchers reuses the same profile/disk/state.
MINIKUBE_PROFILE="${MINIKUBE_PROFILE:-minikube}"
MINIKUBE_DRIVER="${MINIKUBE_DRIVER:-docker}"
MINIKUBE_CPUS="${MINIKUBE_CPUS:-4}"
MINIKUBE_MEM="${MINIKUBE_MEM:-6144}"

echo "▶ Pre-flight: checking Docker is running…"
docker info >/dev/null 2>&1 || { echo "✖ Docker daemon is not running."; exit 1; }

echo "▶ Pre-flight: checking ngrok is installed and authed…"
command -v ngrok >/dev/null || { echo "✖ ngrok is not installed. See plan Step 2."; exit 1; }
ngrok config check >/dev/null 2>&1 || { echo "✖ ngrok is not authed. Run: ngrok config add-authtoken <your-token>"; exit 1; }

# ── Minikube pre-flight ────────────────────────────────────────────
# Vault deploys via `ansible-playbook ... --tags vault`, which under the
# hood runs `kubectl apply -f backend/k8s/vault/`. If minikube isn't up,
# kubectl falls back to its built-in http://localhost:8080 default and
# the Ansible task dies with `connection refused`. Boot the cluster
# here so the downstream kubectl/ansible calls land on a real API server.
echo "▶ Pre-flight: minikube + kubectl installed?"
command -v minikube >/dev/null || { echo "✖ minikube not installed (needed for Vault)."; exit 1; }
command -v kubectl  >/dev/null || { echo "✖ kubectl not installed (needed for Vault)."; exit 1; }

echo "▶ Pre-flight: minikube cluster status?"
status=$(minikube status -p "$MINIKUBE_PROFILE" -f '{{.Host}}' 2>/dev/null || echo "Stopped")
if [ "$status" != "Running" ]; then
  echo "  ▶ Starting minikube profile '$MINIKUBE_PROFILE' (driver=$MINIKUBE_DRIVER, cpus=$MINIKUBE_CPUS, mem=${MINIKUBE_MEM}MB)…"
  minikube start \
    -p "$MINIKUBE_PROFILE" \
    --driver="$MINIKUBE_DRIVER" \
    --cpus="$MINIKUBE_CPUS" \
    --memory="$MINIKUBE_MEM" 2>&1 | sed 's/^/    /'
else
  echo "  ✓ minikube already Running (profile=$MINIKUBE_PROFILE)"
fi
kubectl config use-context "$MINIKUBE_PROFILE" >/dev/null 2>&1 || true
echo "  ✓ kubectl context: $(kubectl config current-context 2>/dev/null || echo 'unset')"

echo "▶ Pre-flight: freeing host ports 3000/4000/15672 from any k8s port-forwards…"
# start-k8s.sh launches `kubectl port-forward …` inside supervised subshells;
# both the supervisor bash AND the kubectl child must die, otherwise the
# supervisor respawns kubectl and docker can't bind these host ports.
pkill -f "start-k8s.sh"         2>/dev/null || true
pkill -f "kubectl port-forward" 2>/dev/null || true
sleep 1

echo "▶ Stopping any existing online containers…"
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
    echo "✖ api-gateway did not become healthy in 2 min. Check: docker compose -f backend/docker-compose.yml logs api-gateway"
    exit 1
  fi
done

echo "▶ Starting frontend (online mode)…"
( cd frontend && docker compose --env-file .env.online -f docker-compose.yml -f docker-compose.online.yml up -d --build )

echo "▶ Waiting for frontend on http://localhost:3000 (up to 2 min)…"
for i in $(seq 1 60); do
  if curl -fs http://localhost:3000 >/dev/null 2>&1; then
    echo "  ✓ frontend healthy"
    break
  fi
  sleep 2
  if [ "$i" -eq 60 ]; then
    echo "✖ frontend did not become healthy in 2 min. Check: docker compose -f frontend/docker-compose.yml logs frontend"
    exit 1
  fi
done

echo "▶ Deploying Vault via ansible (site.yml --tags vault)…"
ansible-playbook -i backend/ansible/inventory.ini backend/ansible/site.yml --tags vault 2>&1 | tail -8 | sed 's/^/  /'

echo "▶ Starting detached port-forward for Vault UI on 127.0.0.1:8200…"
if [ -f /tmp/fmp-vault-pf.pid ]; then
  kill "$(cat /tmp/fmp-vault-pf.pid)" 2>/dev/null || true
  rm -f /tmp/fmp-vault-pf.pid
fi
fuser -k 8200/tcp 2>/dev/null || true
nohup kubectl port-forward -n vault svc/vault 8200:8200 > /tmp/fmp-vault-pf.log 2>&1 &
echo $! > /tmp/fmp-vault-pf.pid
disown
echo "  ✓ Vault UI: http://127.0.0.1:8200/ui/vault/secrets/secret/kv/fmp%2Fauth/details?version=1"

echo ""
echo "─────────────────────────────────────────────────────────────"
echo "✅  Online stack is up."
echo "   Local:   http://localhost:3000"
echo "   Public:  https://${NGROK_DOMAIN}"
echo "   Vault:   http://127.0.0.1:8200/ui  (token: fmp-dev-root)"
echo "─────────────────────────────────────────────────────────────"
echo ""
echo "▶ Starting ngrok tunnel (Ctrl-C stops the tunnel; containers keep running)…"
echo ""

exec ngrok http --url="${NGROK_DOMAIN}" 3000
