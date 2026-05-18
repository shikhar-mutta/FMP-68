#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────
# FMP-68 — Total cleanup
#
# Wipes everything this project leaves behind:
#   - Kubernetes:  namespaces fmp/vault/elk + filebeat ClusterRole/Binding
#   - Minikube:    stop profile (--delete-minikube to delete it entirely)
#   - Port-forwards: kubectl keepers + /tmp/fmp-* PID + log files
#   - Docker compose: backend + frontend stacks (regular + online variants)
#   - Docker:      project containers (fmp-*), images (fmp-*, shikhar68/fmp-*),
#                  volumes, networks (fmp-net)
#   - Build artifacts: node_modules, dist, .next, coverage in backend/* + frontend
#
# Usage:
#   ./nuke.sh                   # interactive — prompts before wiping
#   ./nuke.sh --yes             # no prompt
#   ./nuke.sh --delete-minikube # also `minikube delete` (wipes the VM/cluster)
#   ./nuke.sh --keep-minikube   # leave minikube running (default: stop it)
#   ./nuke.sh --keep-artifacts  # keep node_modules/dist/.next/coverage
#   ./nuke.sh --prune-docker    # also `docker system prune -af --volumes`
# ─────────────────────────────────────────────────────────────
set -u
set -o pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
NAMESPACE="${NAMESPACE:-fmp}"
MINIKUBE_PROFILE="${MINIKUBE_PROFILE:-minikube}"

ASSUME_YES=0
DELETE_MINIKUBE=0
KEEP_MINIKUBE=0
KEEP_ARTIFACTS=0
PRUNE_DOCKER=0
for arg in "$@"; do
  case "$arg" in
    --yes|-y)          ASSUME_YES=1 ;;
    --delete-minikube) DELETE_MINIKUBE=1 ;;
    --keep-minikube)   KEEP_MINIKUBE=1 ;;
    --keep-artifacts)  KEEP_ARTIFACTS=1 ;;
    --prune-docker)    PRUNE_DOCKER=1 ;;
    -h|--help)
      sed -n '2,22p' "$0"; exit 0 ;;
    *) echo "unknown flag: $arg" >&2; exit 2 ;;
  esac
done

G='\033[0;32m'; C='\033[0;36m'; Y='\033[1;33m'; R='\033[0;31m'; N='\033[0m'
banner() { echo -e "${C}══════════════════════════════════════════${N}"; echo -e "${C}  $*${N}"; echo -e "${C}══════════════════════════════════════════${N}"; }
info()   { echo -e "${Y}$*${N}"; }
ok()     { echo -e "${G}$*${N}"; }
err()    { echo -e "${R}$*${N}"; }

have() { command -v "$1" >/dev/null 2>&1; }

# ── confirmation ───────────────────────────────────────────────
banner "FMP-68 — total cleanup"
cat <<EOF
This will permanently remove:
  • k8s namespaces:  $NAMESPACE, vault, elk  (+ filebeat ClusterRole/Binding)
  • docker-compose stacks: backend, frontend (regular + online variants)
  • docker containers matching: fmp-*
  • docker images matching:     fmp-*:local, shikhar68/fmp-*
  • docker volumes/networks owned by the compose projects
  • /tmp/fmp-* port-forward PID + log files
EOF
if [ "$DELETE_MINIKUBE" -eq 1 ]; then
  echo "  • minikube profile '$MINIKUBE_PROFILE' (entire cluster — minikube delete)"
elif [ "$KEEP_MINIKUBE" -eq 0 ]; then
  echo "  • minikube profile '$MINIKUBE_PROFILE' will be STOPPED (use --delete-minikube to wipe it)"
fi
if [ "$KEEP_ARTIFACTS" -eq 0 ]; then
  echo "  • build artifacts: node_modules, dist, .next, coverage in backend/* + frontend"
fi
if [ "$PRUNE_DOCKER" -eq 1 ]; then
  echo "  • docker system prune -af --volumes (wipes ALL unused docker objects, not just this project)"
fi
echo ""
if [ "$ASSUME_YES" -ne 1 ]; then
  read -r -p "Proceed? [y/N] " ans
  case "$ans" in
    y|Y|yes|YES) ;;
    *) err "Aborted."; exit 1 ;;
  esac
fi

# ── 1. Stop port-forwards ──────────────────────────────────────
banner "[1/7] Stop port-forwards"
PORT_FORWARD_PID_FILE="/tmp/fmp-k8s-portforward.pids"
PORT_FORWARD_FLAG_FILE="/tmp/fmp-k8s-portforward.flag"
rm -f "$PORT_FORWARD_FLAG_FILE"
if [ -f "$PORT_FORWARD_PID_FILE" ]; then
  while read -r pid; do
    [ -n "$pid" ] && kill "$pid" 2>/dev/null || true
  done < "$PORT_FORWARD_PID_FILE"
  rm -f "$PORT_FORWARD_PID_FILE"
fi
for pidf in /tmp/fmp-vault-pf.pid /tmp/fmp-kibana-pf.pid; do
  if [ -f "$pidf" ]; then
    kill "$(cat "$pidf")" 2>/dev/null || true
    rm -f "$pidf"
  fi
done
pkill -f "kubectl port-forward -n $NAMESPACE" 2>/dev/null || true
pkill -f "kubectl port-forward -n vault svc/vault" 2>/dev/null || true
pkill -f "kubectl port-forward -n elk svc/kibana" 2>/dev/null || true
for port in 3000 4000 15672 8200 5601; do
  fuser -k ${port}/tcp 2>/dev/null || true
done
rm -f /tmp/fmp-*.log /tmp/fmp-pf-*.log
ok "    ✓ port-forwards stopped, /tmp/fmp-* cleaned"

# ── 2. Kubernetes teardown ─────────────────────────────────────
banner "[2/7] Kubernetes teardown"
if have kubectl; then
  for ns in "$NAMESPACE" vault elk; do
    if kubectl get ns "$ns" >/dev/null 2>&1; then
      info "[k8s] delete namespace $ns"
      kubectl delete namespace "$ns" --wait=true 2>&1 | sed 's/^/    /' || true
    else
      echo "    ($ns namespace already gone)"
    fi
  done
  # Filebeat ClusterRole/Binding live outside any namespace.
  kubectl delete clusterrolebinding filebeat --ignore-not-found=true 2>&1 | sed 's/^/    /' || true
  kubectl delete clusterrole        filebeat --ignore-not-found=true 2>&1 | sed 's/^/    /' || true
  ok "    ✓ namespaces + filebeat cluster RBAC removed"
else
  err "    ⚠ kubectl not installed — skipping k8s teardown"
fi

# ── 3. Docker compose down ─────────────────────────────────────
banner "[3/7] docker-compose down (backend + frontend, all variants)"
if have docker; then
  COMPOSE_FILES=(
    "$ROOT_DIR/backend/docker-compose.yml"
    "$ROOT_DIR/backend/docker-compose.online.yml"
    "$ROOT_DIR/frontend/docker-compose.yml"
    "$ROOT_DIR/frontend/docker-compose.online.yml"
    "$ROOT_DIR/frontend/docker-compose.online-watch.yml"
  )
  for cf in "${COMPOSE_FILES[@]}"; do
    [ -f "$cf" ] || continue
    info "[compose] down -v --remove-orphans  ($cf)"
    docker compose -f "$cf" down -v --remove-orphans --rmi local 2>&1 | sed 's/^/    /' || true
  done
  ok "    ✓ compose stacks down"
else
  err "    ⚠ docker not installed — skipping compose teardown"
fi

# ── 4. Docker: containers, images, volumes, networks ───────────
banner "[4/7] Remove project containers / images / volumes / networks"
if have docker; then
  info "[docker] containers matching 'fmp-' (force remove)"
  cids=$(docker ps -aq --filter 'name=fmp-' 2>/dev/null || true)
  if [ -n "$cids" ]; then
    echo "$cids" | xargs -r docker rm -f 2>&1 | sed 's/^/    /' || true
  else
    echo "    (none)"
  fi

  info "[docker] images: fmp-*:local + shikhar68/fmp-*"
  # fmp-*:local (docker-compose builds)
  imgs=$(docker images --format '{{.Repository}}:{{.Tag}}' 2>/dev/null \
         | grep -E '^(fmp-[a-z-]+:local|shikhar68/fmp-[a-z-]+:.*)$' || true)
  if [ -n "$imgs" ]; then
    echo "$imgs" | xargs -r docker rmi -f 2>&1 | sed 's/^/    /' || true
  else
    echo "    (none)"
  fi

  info "[docker] volumes whose name contains 'fmp' or starts with 'backend_' / 'frontend_'"
  vols=$(docker volume ls --format '{{.Name}}' 2>/dev/null \
         | grep -E '(fmp|^backend_|^frontend_)' || true)
  if [ -n "$vols" ]; then
    echo "$vols" | xargs -r docker volume rm -f 2>&1 | sed 's/^/    /' || true
  else
    echo "    (none)"
  fi

  info "[docker] networks containing 'fmp'"
  nets=$(docker network ls --format '{{.Name}}' 2>/dev/null | grep -E 'fmp' || true)
  if [ -n "$nets" ]; then
    echo "$nets" | xargs -r -n1 docker network rm 2>&1 | sed 's/^/    /' || true
  else
    echo "    (none)"
  fi
  ok "    ✓ project docker resources removed"
else
  err "    ⚠ docker not installed — skipping"
fi

# ── 5. Minikube ────────────────────────────────────────────────
banner "[5/7] Minikube"
if have minikube; then
  if [ "$DELETE_MINIKUBE" -eq 1 ]; then
    info "[minikube] delete profile '$MINIKUBE_PROFILE' (entire cluster)"
    minikube delete -p "$MINIKUBE_PROFILE" 2>&1 | sed 's/^/    /' || true
    ok "    ✓ minikube profile deleted"
  elif [ "$KEEP_MINIKUBE" -eq 1 ]; then
    echo "    --keep-minikube set → leaving minikube running"
  else
    info "[minikube] stop profile '$MINIKUBE_PROFILE'"
    minikube stop -p "$MINIKUBE_PROFILE" 2>&1 | sed 's/^/    /' || true
    ok "    ✓ minikube stopped (use --delete-minikube to wipe it entirely)"
  fi
else
  err "    ⚠ minikube not installed — skipping"
fi

# ── 6. Build artifacts ─────────────────────────────────────────
banner "[6/7] Build artifacts"
if [ "$KEEP_ARTIFACTS" -eq 1 ]; then
  echo "    --keep-artifacts set → leaving node_modules / dist / .next / coverage in place"
else
  info "[artifacts] removing node_modules, dist, .next, coverage under backend/* + frontend"
  # -prune stops descent into matched dirs so we don't recurse into node_modules.
  find "$ROOT_DIR/backend" "$ROOT_DIR/frontend" \
    \( -type d \( -name node_modules -o -name dist -o -name .next -o -name coverage \) \) \
    -prune -exec rm -rf {} + 2>/dev/null || true
  ok "    ✓ build artifacts cleaned"
fi

# ── 7. Optional system-wide docker prune ───────────────────────
banner "[7/7] Optional docker system prune"
if [ "$PRUNE_DOCKER" -eq 1 ] && have docker; then
  info "[docker] system prune -af --volumes  (wipes ALL unused docker objects)"
  docker system prune -af --volumes 2>&1 | sed 's/^/    /' || true
  ok "    ✓ docker pruned"
else
  echo "    (skipped — pass --prune-docker to enable)"
fi

echo ""
ok "✅ FMP-68 nuked."
