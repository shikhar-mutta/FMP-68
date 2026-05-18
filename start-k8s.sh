#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────
# FMP-68 — Kubernetes launcher (Minikube + HPA)
#
# Brings the whole stack (6 NestJS microservices + frontend
# + RabbitMQ + Redis) up on a local Minikube cluster with
# HorizontalPodAutoscalers attached to every Deployment.
#
# Equivalent to ./start.sh, but uses kubectl + minikube
# instead of docker compose. MongoDB still runs on the host
# (rs0 replica set) — reached from pods via the mongo-external
# ExternalName service that points at host.minikube.internal.
#
# Pre-reqs:
#   - docker daemon up
#   - minikube + kubectl installed
#   - mongod running locally with bindIp 0.0.0.0 (or include
#     the minikube bridge IP) and rs0 replica set initialised
#
# Usage:
#   ./start-k8s.sh                # build, load, apply, wait, report
#   ./start-k8s.sh --skip-build   # skip docker build + minikube load
#   ./start-k8s.sh --no-forward   # don't start kubectl port-forwards
#   ./start-k8s.sh --stop         # tear stack down (keep minikube up)
#   ./start-k8s.sh --nuke         # tear stack + stop minikube
#
# After it finishes (with port-forwards enabled, the default):
#   http://localhost:3000    Frontend  (port-forward → svc/frontend:80)
#   http://localhost:4000    Backend gateway HTTP + WS
#   http://localhost:15672   RabbitMQ management UI  (guest / guest)
# ─────────────────────────────────────────────────────────────
set -e
set -u
set -o pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
NAMESPACE="${NAMESPACE:-fmp}"
MINIKUBE_PROFILE="${MINIKUBE_PROFILE:-minikube}"
MINIKUBE_DRIVER="${MINIKUBE_DRIVER:-docker}"
MINIKUBE_CPUS="${MINIKUBE_CPUS:-4}"
MINIKUBE_MEM="${MINIKUBE_MEM:-6144}"
IMAGE_TAG="${IMAGE_TAG:-latest}"
IMAGE_REPO="${IMAGE_REPO:-shikhar68}"

BACKEND_SERVICES=(api-gateway auth-service users-service paths-service tracking-service notification-service)
PORT_FORWARD_PID_FILE="/tmp/fmp-k8s-portforward.pids"
# Presence of this file = "keeper loops should keep restarting forwards".
# Removing it cleanly signals every keeper subshell to exit its retry loop.
PORT_FORWARD_FLAG_FILE="/tmp/fmp-k8s-portforward.flag"

G='\033[0;32m'; C='\033[0;36m'; Y='\033[1;33m'; R='\033[0;31m'; N='\033[0m'
banner() { echo -e "${C}══════════════════════════════════════════${N}"; echo -e "${C}  $*${N}"; echo -e "${C}══════════════════════════════════════════${N}"; }
info()   { echo -e "${Y}$*${N}"; }
ok()     { echo -e "${G}$*${N}"; }
err()    { echo -e "${R}$*${N}"; }

# ── tooling guards ─────────────────────────────────────────────
require() {
  command -v "$1" >/dev/null 2>&1 || { err "    ✘ '$1' not found in PATH. Install it and re-run."; exit 1; }
}

# ── port-forward management ────────────────────────────────────
# kubectl port-forward attaches to a single Pod endpoint, so rollouts
# (kubectl rollout restart / HPA scale-down / preStop drains) kill the
# tunnel. We wrap each forward in a "keeper" subshell that respawns it
# while $PORT_FORWARD_FLAG_FILE exists — survives pod rotation cleanly.
stop_port_forwards() {
  # Removing the flag tells every keeper loop to stop respawning.
  rm -f "$PORT_FORWARD_FLAG_FILE"
  if [ -f "$PORT_FORWARD_PID_FILE" ]; then
    while read -r pid; do
      [ -n "$pid" ] && kill "$pid" 2>/dev/null || true
    done < "$PORT_FORWARD_PID_FILE"
    rm -f "$PORT_FORWARD_PID_FILE"
  fi
  # Also reap any orphan kubectl port-forward processes that targeted
  # the fmp namespace — covers manual `kubectl port-forward` runs and
  # keepers from a prior script invocation whose PID file got lost.
  pkill -f "kubectl port-forward -n $NAMESPACE" 2>/dev/null || true
  for port in 3000 4000 15672; do
    fuser -k ${port}/tcp 2>/dev/null || true
  done
}

start_port_forward() {
  local svc="$1" local_port="$2" target_port="$3"
  # Keeper subshell: respawn the forward until the flag file disappears
  # or the namespace is deleted. 2s gap between respawns avoids busy-looping
  # while a Deployment is still rolling.
  (
    while [ -f "$PORT_FORWARD_FLAG_FILE" ]; do
      kubectl port-forward -n "$NAMESPACE" "svc/$svc" "${local_port}:${target_port}" \
        >>/tmp/fmp-pf-${svc}.log 2>&1 || true
      kubectl get ns "$NAMESPACE" >/dev/null 2>&1 || break
      [ -f "$PORT_FORWARD_FLAG_FILE" ] || break
      sleep 2
    done
  ) &
  echo "$!" >> "$PORT_FORWARD_PID_FILE"
  echo "    ✓ port-forward svc/$svc ${local_port} → ${target_port}  (keeper pid $!)"
}

# ── teardown modes ─────────────────────────────────────────────
if [ "${1:-}" = "--stop" ] || [ "${1:-}" = "--nuke" ]; then
  banner "FMP-68 — Kubernetes teardown"

  info "[1/3] Stop any running port-forwards"
  stop_port_forwards

  info "[2/3] Delete namespace '$NAMESPACE' (HPAs, Deployments, Services, Ingress, ConfigMap, Secret)"
  if kubectl get ns "$NAMESPACE" >/dev/null 2>&1; then
    kubectl delete namespace "$NAMESPACE" --wait=true 2>&1 | sed 's/^/    /' || true
  else
    echo "    (namespace already gone)"
  fi

  if [ "${1:-}" = "--nuke" ]; then
    info "[3/3] Stop minikube profile '$MINIKUBE_PROFILE'"
    minikube stop -p "$MINIKUBE_PROFILE" 2>&1 | sed 's/^/    /' || true
  else
    info "[3/3] Leaving minikube up (use --nuke to stop it as well)"
  fi

  ok "✅ Stopped."
  exit 0
fi

# ── parse flags ────────────────────────────────────────────────
SKIP_BUILD=0
DO_FORWARD=1
for arg in "$@"; do
  case "$arg" in
    --skip-build) SKIP_BUILD=1 ;;
    --no-forward) DO_FORWARD=0 ;;
    *) ;;
  esac
done

banner "FMP-68 — K8s launch (Minikube + HPA, namespace=$NAMESPACE)"

# ── Pre-flight ─────────────────────────────────────────────────
info "[pre-flight] required tooling"
require docker
require minikube
require kubectl
ok   "    ✓ docker, minikube, kubectl present"

info "[pre-flight] docker daemon"
if ! docker info >/dev/null 2>&1; then
  err "    ✘ docker daemon not reachable. Start Docker, then re-run."; exit 1
fi
ok   "    ✓ docker is up"

info "[pre-flight] host MongoDB rs0"
if command -v mongosh >/dev/null 2>&1; then
  if mongosh --quiet --eval "rs.status().ok" 2>/dev/null | grep -q '^1$'; then
    ok "    ✓ mongod rs0 healthy"
  else
    err "    ⚠ mongod replica set not reachable.  Pods will fail Prisma calls."
    err "      Ensure mongod binds 0.0.0.0 (or the minikube bridge IP) and rs.status() returns ok=1."
  fi
else
  echo "    (mongosh not installed — skipping check)"
fi

# ── 1. Minikube up + addons ────────────────────────────────────
banner "Minikube"
status=$(minikube status -p "$MINIKUBE_PROFILE" -f '{{.Host}}' 2>/dev/null || echo "Stopped")
if [ "$status" != "Running" ]; then
  info "[minikube] starting profile '$MINIKUBE_PROFILE' (driver=$MINIKUBE_DRIVER, cpus=$MINIKUBE_CPUS, mem=${MINIKUBE_MEM}MB)"
  minikube start \
    -p "$MINIKUBE_PROFILE" \
    --driver="$MINIKUBE_DRIVER" \
    --cpus="$MINIKUBE_CPUS" \
    --memory="$MINIKUBE_MEM" 2>&1 | sed 's/^/    /'
else
  ok "    ✓ minikube already Running"
fi

info "[minikube] kubectl context"
kubectl config use-context "$MINIKUBE_PROFILE" >/dev/null 2>&1 || true
echo "    current context: $(kubectl config current-context)"

info "[minikube] addon: metrics-server (HPA needs metrics-server)"
minikube addons enable metrics-server  -p "$MINIKUBE_PROFILE" 2>&1 | tail -1 | sed 's/^/    /' || true

# ── 2. Ensure namespace exists ─────────────────────────────────
# Hoisted BEFORE the build phase so a build failure doesn't leave
# the cluster in a confusing state where every other manifest is
# orphaned without a namespace. kubectl apply is idempotent —
# safe to run on every launch.
banner "Namespace"
if kubectl get namespace "$NAMESPACE" >/dev/null 2>&1; then
  phase=$(kubectl get namespace "$NAMESPACE" -o jsonpath='{.status.phase}' 2>/dev/null || echo "Unknown")
  if [ "$phase" = "Terminating" ]; then
    err "    ⚠ namespace '$NAMESPACE' is Terminating — waiting for it to disappear before recreating"
    kubectl wait --for=delete "namespace/$NAMESPACE" --timeout=60s 2>&1 | sed 's/^/    /' || true
    info "[namespace] recreating '$NAMESPACE'"
    kubectl apply -f "$ROOT_DIR/backend/k8s/namespace.yaml" 2>&1 | sed 's/^/    /'
  else
    ok "    ✓ namespace '$NAMESPACE' already exists ($phase)"
  fi
else
  info "[namespace] '$NAMESPACE' missing → creating from backend/k8s/namespace.yaml"
  kubectl apply -f "$ROOT_DIR/backend/k8s/namespace.yaml" 2>&1 | sed 's/^/    /'
fi
# Belt-and-suspenders: wait until the namespace is observably present
# in the API server's cache before any later manifest references it.
for i in 1 2 3 4 5 6 7 8 9 10; do
  if kubectl get namespace "$NAMESPACE" >/dev/null 2>&1; then
    echo "    ✓ namespace '$NAMESPACE' is reachable via kubectl"
    break
  fi
  echo "    … waiting for namespace to become reachable ($i/10)"
  sleep 1
done

# ── 3. Build + load images ─────────────────────────────────────
if [ "$SKIP_BUILD" -eq 0 ]; then
  banner "Build & load images into Minikube"

  for svc in "${BACKEND_SERVICES[@]}"; do
    img="${IMAGE_REPO}/fmp-${svc}:${IMAGE_TAG}"
    info "[build] $img"
    docker build -t "$img" "$ROOT_DIR/backend/$svc" 2>&1 | tail -3 | sed 's/^/    /'
    info "[load]  → minikube"
    minikube image load "$img" -p "$MINIKUBE_PROFILE" 2>&1 | sed 's/^/    /' || true
  done

  img="${IMAGE_REPO}/fmp-frontend:${IMAGE_TAG}"
  info "[build] $img"
  docker build -t "$img" "$ROOT_DIR/frontend" 2>&1 | tail -3 | sed 's/^/    /'
  info "[load]  → minikube"
  minikube image load "$img" -p "$MINIKUBE_PROFILE" 2>&1 | sed 's/^/    /' || true
else
  info "[build] --skip-build set → reusing existing images already loaded in minikube"
fi

# ── 4. Apply manifests ─────────────────────────────────────────
banner "Apply Kubernetes manifests (namespace=$NAMESPACE)"

# Namespace was already ensured above; re-apply is a no-op but kept
# implicit so configmap/secret/etc. can reference 'namespace: fmp' safely.
info "[apply] config + secret + mongo-external"
kubectl apply -f "$ROOT_DIR/backend/k8s/configmap.yaml"        2>&1 | sed 's/^/    /'
kubectl apply -f "$ROOT_DIR/backend/k8s/secret.yaml"           2>&1 | sed 's/^/    /'
kubectl apply -f "$ROOT_DIR/backend/k8s/mongo-external.yaml"   2>&1 | sed 's/^/    /'

info "[apply] infra (rabbitmq, redis)"
kubectl apply -f "$ROOT_DIR/backend/k8s/rabbitmq.yaml"         2>&1 | sed 's/^/    /'
kubectl apply -f "$ROOT_DIR/backend/k8s/redis.yaml"            2>&1 | sed 's/^/    /'

info "[apply] backend microservices (deployments + services + HPAs)"
for svc in "${BACKEND_SERVICES[@]}"; do
  kubectl apply -f "$ROOT_DIR/backend/k8s/$svc/" 2>&1 | sed "s/^/    [$svc] /"
done

info "[apply] frontend (deployment + service + HPA)"
kubectl apply -f "$ROOT_DIR/frontend/k8s/deployment.yaml"      2>&1 | sed 's/^/    /'
kubectl apply -f "$ROOT_DIR/frontend/k8s/service.yaml"         2>&1 | sed 's/^/    /'
kubectl apply -f "$ROOT_DIR/frontend/k8s/hpa.yaml"             2>&1 | sed 's/^/    /'

# ── 5. Wait for rollouts ───────────────────────────────────────
banner "Wait for rollouts"
DEPLOYMENTS=(rabbitmq redis "${BACKEND_SERVICES[@]}" frontend)
for d in "${DEPLOYMENTS[@]}"; do
  info "[wait] deployment/$d"
  if ! kubectl rollout status -n "$NAMESPACE" "deployment/$d" --timeout=180s 2>&1 | sed 's/^/    /'; then
    err "    ⚠ deployment/$d did not become ready in 180s — see 'kubectl describe' below"
    kubectl describe -n "$NAMESPACE" "deployment/$d" 2>&1 | tail -20 | sed 's/^/      /' || true
  fi
done

# ── 6. Port-forwards (optional, default on) ────────────────────
if [ "$DO_FORWARD" -eq 1 ]; then
  banner "Port-forwards"
  stop_port_forwards
  : > "$PORT_FORWARD_PID_FILE"
  # Create the flag file BEFORE spawning keepers — they exit immediately if it's missing.
  : > "$PORT_FORWARD_FLAG_FILE"
  start_port_forward frontend    3000 80
  start_port_forward api-gateway 4000 4000
  start_port_forward rabbitmq   15672 15672
  echo "    (keepers respawn forwards across pod rotations — '--stop' kills them all)"
fi

# ── 7. Final report ────────────────────────────────────────────
banner "Status"

echo ""
ok "Pods"
kubectl get pods -n "$NAMESPACE" -o wide 2>&1 | sed 's/^/  /'

echo ""
ok "Services"
kubectl get svc -n "$NAMESPACE" 2>&1 | sed 's/^/  /'

echo ""
ok "Horizontal Pod Autoscalers"
kubectl get hpa -n "$NAMESPACE" 2>&1 | sed 's/^/  /'

echo ""
ok "Open in your browser:"
if [ "$DO_FORWARD" -eq 1 ]; then
  echo "  http://localhost:3000    Frontend           (kubectl port-forward → svc/frontend:80)"
  echo "  http://localhost:4000    Backend gateway    (kubectl port-forward, HTTP + WS)"
  echo "  http://localhost:15672   RabbitMQ UI        (kubectl port-forward, guest / guest)"
fi

echo ""
ok "Useful commands:"
echo "  kubectl get pods -n $NAMESPACE -w           # watch pod lifecycle"
echo "  kubectl get hpa  -n $NAMESPACE -w           # watch HPA scaling decisions"
echo "  kubectl top pods -n $NAMESPACE              # live CPU/mem (needs metrics-server warmed up ~30s)"
echo "  kubectl logs -n $NAMESPACE deploy/api-gateway -f"
echo ""
ok "Stop everything later with:"
echo "  ./start-k8s.sh --stop     # delete namespace, keep minikube up"
echo "  ./start-k8s.sh --nuke     # delete namespace + stop minikube"
