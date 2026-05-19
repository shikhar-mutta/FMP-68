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
#   http://localhost:5601    Kibana   (Discover index 'fmp-logs-*' + dashboard)
#   http://localhost:8200    Vault UI (token: fmp-dev-root)
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

# Docker build with one automatic retry. Guards against the transient
# OOM-kill that hits `npm install` inside multi-stage builds when the
# host is memory-pressured (e.g. minikube boot still has kicbase/preload
# resident, swap is hot). On failure: flush buffers, sleep, retry — the
# second attempt re-uses Docker's layer cache so the cheap layers fly past
# and the heavy npm step lands when the kernel has reclaimed memory.
docker_build_retry() {
  local tag="$1" ctx="$2"
  local attempt
  for attempt in 1 2; do
    if docker build -t "$tag" "$ctx" 2>&1 | tail -3 | sed 's/^/    /'; then
      return 0
    fi
    if [ "$attempt" -lt 2 ]; then
      err "    ⚠ docker build $tag failed (attempt $attempt/2) — likely transient OOM"
      info "    [retry] sync + free pagecache hint + sleeping 15s"
      sync
      sleep 15
    fi
  done
  err "    ✘ docker build $tag failed after 2 attempts"
  return 1
}

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
  # Vault port-forward runs as a plain nohup background (not via the
  # keeper loop), so it has its own PID file outside $PORT_FORWARD_PID_FILE.
  if [ -f /tmp/fmp-vault-pf.pid ]; then
    kill "$(cat /tmp/fmp-vault-pf.pid)" 2>/dev/null || true
    rm -f /tmp/fmp-vault-pf.pid
  fi
  pkill -f "kubectl port-forward -n vault svc/vault" 2>/dev/null || true
  # Kibana port-forward also lives outside $NAMESPACE (it's in 'elk') and
  # uses the same plain-nohup pattern as Vault, so it has its own PID file.
  if [ -f /tmp/fmp-kibana-pf.pid ]; then
    kill "$(cat /tmp/fmp-kibana-pf.pid)" 2>/dev/null || true
    rm -f /tmp/fmp-kibana-pf.pid
  fi
  pkill -f "kubectl port-forward -n elk svc/kibana" 2>/dev/null || true
  for port in 3000 4000 15672 8200 5601; do
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

# ── smart rollout wait ─────────────────────────────────────────
# Plain `kubectl rollout status --timeout=Xs` cries wolf the moment the
# fixed timer expires, even if the pod is healthy and just slow to warm
# up (ES on a cold start, NestJS during Prisma client generation, etc.)
# — that's how we ended up with the "⚠ elk/deployment/elasticsearch not
# ready in 360s" false alarm when ES was Ready at 8m45s anyway.
#
# This helper polls in $tick chunks instead. On each tick it asks two
# questions: (a) is the rollout Ready? exit 0. (b) is any pod in a
# known-bad waiting state (CrashLoopBackOff / ImagePullBackOff /
# ErrImagePull / CreateContainerConfigError / InvalidImageName)? fail
# fast — no point sitting on a 10-min timer when the kube scheduler
# already told us the rollout can't succeed. Otherwise print a one-line
# progress heartbeat (ready replicas, restarts, elapsed) and keep
# waiting up to $hard_timeout. Only then emit ⚠ with a real `describe`
# dump for diagnostics.
wait_for_deployment() {
  local ns="$1" name="$2" hard_timeout="$3" tick="${4:-15}"
  local start=$SECONDS elapsed=0
  while [ "$elapsed" -lt "$hard_timeout" ]; do
    if kubectl rollout status -n "$ns" "deployment/$name" --timeout=${tick}s >/dev/null 2>&1; then
      ok "    ✓ deployment/$name Ready after $((SECONDS - start))s"
      return 0
    fi
    elapsed=$((SECONDS - start))
    # Fail-fast: any pod stuck in a non-recoverable waiting reason.
    local bad
    bad=$(kubectl get pods -n "$ns" -l "app=$name" \
            -o jsonpath='{range .items[*]}{.status.containerStatuses[*].state.waiting.reason}{" "}{end}' \
            2>/dev/null)
    case "$bad" in
      *CrashLoopBackOff*|*ImagePullBackOff*|*ErrImagePull*|*CreateContainerConfigError*|*InvalidImageName*)
        err "    ✘ deployment/$name pod stuck (${bad% }) — bailing out at ${elapsed}s, won't recover on its own"
        kubectl describe -n "$ns" "deployment/$name" 2>&1 | tail -25 | sed 's/^/      /' || true
        return 1
        ;;
    esac
    # Heartbeat — gives the user a live signal that we're not hung.
    local desired ready restarts
    desired=$(kubectl get -n "$ns" "deployment/$name" -o jsonpath='{.spec.replicas}' 2>/dev/null)
    ready=$(  kubectl get -n "$ns" "deployment/$name" -o jsonpath='{.status.readyReplicas}' 2>/dev/null)
    restarts=$(kubectl get pods -n "$ns" -l "app=$name" \
                 -o jsonpath='{range .items[*]}{.status.containerStatuses[*].restartCount}{" "}{end}' \
                 2>/dev/null | tr -s ' ' | sed 's/^ *//;s/ *$//')
    echo "    … deployment/$name still rolling out (ready=${ready:-0}/${desired:-?}, restarts=[${restarts:-0}], elapsed ${elapsed}s / cap ${hard_timeout}s)"
  done
  err "    ⚠ deployment/$name not Ready after ${hard_timeout}s — dumping describe:"
  kubectl describe -n "$ns" "deployment/$name" 2>&1 | tail -25 | sed 's/^/      /' || true
  return 1
}

# ── teardown modes ─────────────────────────────────────────────
if [ "${1:-}" = "--stop" ] || [ "${1:-}" = "--nuke" ]; then
  banner "FMP-68 — Kubernetes teardown"

  info "[1/3] Stop any running port-forwards"
  stop_port_forwards

  info "[2/3] Delete namespaces '$NAMESPACE' + 'vault' + 'elk' (HPAs, Deployments, Services, ConfigMap, Secret, Vault, ELK)"
  if kubectl get ns "$NAMESPACE" >/dev/null 2>&1; then
    kubectl delete namespace "$NAMESPACE" --wait=true 2>&1 | sed 's/^/    /' || true
  else
    echo "    ($NAMESPACE namespace already gone)"
  fi
  if kubectl get ns vault >/dev/null 2>&1; then
    kubectl delete namespace vault --wait=true 2>&1 | sed 's/^/    /' || true
  else
    echo "    (vault namespace already gone)"
  fi
  if kubectl get ns elk >/dev/null 2>&1; then
    kubectl delete namespace elk --wait=true 2>&1 | sed 's/^/    /' || true
  else
    echo "    (elk namespace already gone)"
  fi
  # Filebeat's ClusterRole + ClusterRoleBinding live outside any namespace,
  # so deleting the elk namespace doesn't reap them. Clean up explicitly.
  kubectl delete clusterrolebinding filebeat --ignore-not-found=true 2>&1 | sed 's/^/    /' || true
  kubectl delete clusterrole        filebeat --ignore-not-found=true 2>&1 | sed 's/^/    /' || true

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
    docker_build_retry "$img" "$ROOT_DIR/backend/$svc"
    info "[load]  → minikube"
    minikube image load "$img" -p "$MINIKUBE_PROFILE" 2>&1 | sed 's/^/    /' || true
  done

  img="${IMAGE_REPO}/fmp-frontend:${IMAGE_TAG}"
  info "[build] $img"
  docker_build_retry "$img" "$ROOT_DIR/frontend"
  info "[load]  → minikube"
  minikube image load "$img" -p "$MINIKUBE_PROFILE" 2>&1 | sed 's/^/    /' || true
else
  info "[build] --skip-build set → reusing existing images already loaded in minikube"
fi

# ── 4. Apply manifests ─────────────────────────────────────────
banner "Apply Kubernetes manifests (namespace=$NAMESPACE)"

# Namespace was already ensured above; re-apply is a no-op but kept
# implicit so configmap/secret/etc. can reference 'namespace: fmp' safely.
info "[apply] config + mongo-external (fmp-secret comes from Vault — see next banner)"
kubectl apply -f "$ROOT_DIR/backend/k8s/configmap.yaml"        2>&1 | sed 's/^/    /'
kubectl apply -f "$ROOT_DIR/backend/k8s/mongo-external.yaml"   2>&1 | sed 's/^/    /'

# ── Vault: deploy, inject real creds, wait for re-seed, then bridge → fmp-secret ──
# Mirrors the pattern in backend/k8s-infra/Jenkinsfile (Bootstrap Vault stage)
# and start-online-watch.sh (lines 99-127):
#
#   1. Apply vault.yaml  → postStart seed.sh runs with CHANGE_ME_* placeholders
#   2. kubectl set env   → inject real creds from backend/auth-service/.env into
#                          the Vault Deployment; triggers a new rollout so the new
#                          pod's postStart seed.sh runs with the real values.
#   3. Rollout + poll    → wait for the new pod to be Ready and secret/fmp/auth
#                          to be re-populated with the real credentials.
#   4. Fetch KV          → read all 3 paths from Vault and write fmp-secret.
#
# After this block, fmp-secret in namespace '$NAMESPACE' holds JWT_SECRET,
# GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, DATABASE_URL, RABBITMQ_URL — all
# sourced from Vault (not from any committed plaintext file).
banner "Vault → fmp-secret bridge"

info "[vault] apply manifests (namespace + Deployment + Service + seed ConfigMap)"
kubectl apply -f "$ROOT_DIR/backend/k8s/vault/" 2>&1 | sed 's/^/    /'

info "[vault] wait for pod Ready (up to 120s)"
if ! kubectl wait --for=condition=ready pod -l app=vault -n vault --timeout=120s 2>&1 | sed 's/^/    /'; then
  err "    ✘ Vault pod did not become Ready — see 'kubectl logs -n vault deploy/vault'"
  exit 1
fi

# ── Step 2: inject real credentials (same as Jenkinsfile + online-watch) ──────
# Read from backend/auth-service/.env (same source as start-online-watch.sh).
# `kubectl set env` patches the Deployment env block, which triggers a new
# ReplicaSet rollout — the new pod's postStart seed.sh sees the real env vars
# and writes real values into secret/fmp/auth instead of CHANGE_ME_* defaults.
info "[vault] reading credentials from backend/auth-service/.env"
_AUTH_ENV="$ROOT_DIR/backend/auth-service/.env"
if [ ! -f "$_AUTH_ENV" ]; then
  err "    ✘ ${_AUTH_ENV} not found — cannot inject real credentials into Vault."
  err "      Create backend/auth-service/.env with GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET / JWT_SECRET."
  exit 1
fi
_FMP_JWT_SECRET=$(grep '^JWT_SECRET='           "$_AUTH_ENV" | cut -d= -f2-)
_FMP_GOOGLE_CLIENT_ID=$(grep '^GOOGLE_CLIENT_ID='    "$_AUTH_ENV" | cut -d= -f2-)
_FMP_GOOGLE_CLIENT_SECRET=$(grep '^GOOGLE_CLIENT_SECRET=' "$_AUTH_ENV" | cut -d= -f2-)
if [ -z "${_FMP_JWT_SECRET:-}" ] || [ -z "${_FMP_GOOGLE_CLIENT_ID:-}" ] || [ -z "${_FMP_GOOGLE_CLIENT_SECRET:-}" ]; then
  err "    ✘ Could not read JWT_SECRET / GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET from ${_AUTH_ENV}."
  exit 1
fi
ok "    ✓ credentials loaded (GOOGLE_CLIENT_ID=${_FMP_GOOGLE_CLIENT_ID:0:30}…)"

info "[vault] injecting real credentials via kubectl set env → triggers re-rollout"
kubectl set env deployment/vault -n vault \
  FMP_JWT_SECRET="$_FMP_JWT_SECRET" \
  FMP_GOOGLE_CLIENT_ID="$_FMP_GOOGLE_CLIENT_ID" \
  FMP_GOOGLE_CLIENT_SECRET="$_FMP_GOOGLE_CLIENT_SECRET" 2>&1 | sed 's/^/    /'

info "[vault] waiting for Vault rollout (new pod runs seed.sh with real creds, up to 120s)"
if ! kubectl rollout status deployment/vault -n vault --timeout=120s 2>&1 | sed 's/^/    /'; then
  err "    ✘ Vault rollout did not complete — see 'kubectl logs -n vault deploy/vault'"
  exit 1
fi

# ── Step 3: poll until secret/fmp/auth is re-populated ────────────────────────
info "[vault] polling for secret/fmp/auth to be re-seeded with real credentials (up to 30s)"
seeded=0
for i in $(seq 1 15); do
  if kubectl exec -n vault deploy/vault -- \
       sh -c 'VAULT_TOKEN=fmp-dev-root vault kv get -format=json secret/fmp/auth' >/dev/null 2>&1; then
    ok "    ✓ secret/fmp/auth re-seeded after ${i} attempts (~$((i*2))s)"
    seeded=1
    break
  fi
  echo "    … waiting for Vault re-seed ($i/15)"
  sleep 2
done
if [ "$seeded" -eq 0 ]; then
  err "    ✘ Vault never re-seeded secret/fmp/auth — check 'kubectl logs -n vault deploy/vault'"
  exit 1
fi

info "[vault] fetch all 3 KV entries and render fmp-secret"
JSON_AUTH=$(kubectl exec -n vault deploy/vault -- sh -c 'VAULT_TOKEN=fmp-dev-root vault kv get -format=json secret/fmp/auth')
JSON_DB=$(kubectl exec -n vault deploy/vault -- sh -c 'VAULT_TOKEN=fmp-dev-root vault kv get -format=json secret/fmp/db')
JSON_RMQ=$(kubectl exec -n vault deploy/vault -- sh -c 'VAULT_TOKEN=fmp-dev-root vault kv get -format=json secret/fmp/rabbitmq')

# Parse with python3 (always present on Linux/macOS). JSON values are passed
# via env vars to avoid heredoc-quoting issues with strings that contain
# special chars (e.g. '&' in the Mongo URI's replicaSet query).
# read'ing on whitespace is safe — none of the 5 fields contain spaces.
read -r JWT GID GSEC DB_URL RMQ_URL < <(
  JSON_AUTH="$JSON_AUTH" JSON_DB="$JSON_DB" JSON_RMQ="$JSON_RMQ" python3 - <<'PY'
import json, os
a = json.loads(os.environ["JSON_AUTH"])["data"]["data"]
d = json.loads(os.environ["JSON_DB"])["data"]["data"]
r = json.loads(os.environ["JSON_RMQ"])["data"]["data"]
print(a["jwt_secret"], a["google_client_id"], a["google_client_secret"],
      d["mongodb_uri"], r["url"])
PY
)
if [ -z "${JWT:-}" ] || [ -z "${DB_URL:-}" ]; then
  err "    ✘ Failed to parse Vault response — JWT='$JWT' DB_URL='$DB_URL'"
  exit 1
fi

kubectl create secret generic fmp-secret \
  --namespace "$NAMESPACE" \
  --from-literal=JWT_SECRET="$JWT" \
  --from-literal=GOOGLE_CLIENT_ID="$GID" \
  --from-literal=GOOGLE_CLIENT_SECRET="$GSEC" \
  --from-literal=DATABASE_URL="$DB_URL" \
  --from-literal=RABBITMQ_URL="$RMQ_URL" \
  --dry-run=client -o yaml | kubectl apply -f - 2>&1 | sed 's/^/    /'
ok "    ✓ fmp-secret rebuilt from Vault (5 keys: JWT_SECRET, GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, DATABASE_URL, RABBITMQ_URL)"

banner "Apply Kubernetes manifests (namespace=$NAMESPACE, continued)"

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

# ── 4b. Apply ELK stack (Filebeat → Logstash → Elasticsearch → Kibana) ──
# Lives in its own 'elk' namespace. Apply the namespace first so the
# parallel kubectl apply -f <dir> doesn't race on NotFound (the
# filebeat ClusterRole/Binding apply succeeds without the namespace,
# but every other manifest fails — same race we hit on the first
# manual apply). Apply twice if needed: the first pass guarantees the
# namespace, the second pass is idempotent.
banner "Apply ELK stack (namespace=elk)"
info "[apply] elk namespace"
kubectl apply -f "$ROOT_DIR/backend/k8s/elk/namespace.yaml" 2>&1 | sed 's/^/    /'
for i in 1 2 3 4 5 6 7 8 9 10; do
  if kubectl get namespace elk >/dev/null 2>&1; then
    echo "    ✓ namespace 'elk' is reachable via kubectl"
    break
  fi
  echo "    … waiting for elk namespace to become reachable ($i/10)"
  sleep 1
done
info "[apply] elk manifests (ES + Logstash + Kibana + Filebeat DS + ILM bootstrap + dashboard import)"
kubectl apply -f "$ROOT_DIR/backend/k8s/elk/" 2>&1 | sed 's/^/    /'

# ── 5. Wait for rollouts ───────────────────────────────────────
# Uses wait_for_deployment (see top of file): tick-based polling, fails
# fast on CrashLoopBackOff / ImagePullBackOff, prints a heartbeat each
# tick, and only emits ⚠ when the hard cap is genuinely exceeded.
banner "Wait for rollouts"
DEPLOYMENTS=(rabbitmq redis "${BACKEND_SERVICES[@]}" frontend)
for d in "${DEPLOYMENTS[@]}"; do
  info "[wait] $NAMESPACE/deployment/$d  (cap 240s)"
  wait_for_deployment "$NAMESPACE" "$d" 240 15 || true
done

# ELK gets longer per-pod caps. Elasticsearch dominates the cold-start
# (JVM heap + single-node cluster bootstrap + ILM policy install +
# first-time data dir layout); on a truly cold rebuild (fresh kicbase
# image, no docker cache) observed ES Ready times can reach ~9 min.
# Cap ES at 900s for headroom; the others are quick once ES is Ready.
# Failures here are non-fatal — the app stack works without logs.
info "[wait] ELK rollouts — ES cold-start can take ~5–9 min on a fresh cluster"
declare -A ELK_TIMEOUTS=( [elasticsearch]=900 [logstash]=240 [kibana]=240 )
for d in elasticsearch logstash kibana; do
  timeout="${ELK_TIMEOUTS[$d]}"
  info "[wait] elk/deployment/$d  (cap ${timeout}s)"
  wait_for_deployment elk "$d" "$timeout" 20 || true
done
info "[wait] elk/daemonset/filebeat  (cap 180s)"
# DaemonSets don't fit wait_for_deployment (different selector + Ready
# semantics), but they roll out in seconds — keep the plain check.
if ! kubectl rollout status -n elk daemonset/filebeat --timeout=180s 2>&1 | sed 's/^/    /'; then
  err "    ⚠ filebeat DaemonSet not ready in 180s — container logs won't ship to Logstash"
fi

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

  # Vault UI runs in its own namespace, not $NAMESPACE, so it uses a
  # plain nohup background (no keeper). The inline Vault block above
  # already deployed it — we just need to expose the UI on 8200.
  info "[vault] start detached port-forward on 127.0.0.1:8200"
  if [ -f /tmp/fmp-vault-pf.pid ]; then
    kill "$(cat /tmp/fmp-vault-pf.pid)" 2>/dev/null || true
    rm -f /tmp/fmp-vault-pf.pid
  fi
  fuser -k 8200/tcp 2>/dev/null || true
  nohup kubectl port-forward -n vault svc/vault 8200:8200 > /tmp/fmp-vault-pf.log 2>&1 &
  echo $! > /tmp/fmp-vault-pf.pid
  disown
  ok "    ✓ Vault UI: http://127.0.0.1:8200/ui/vault/secrets/secret/kv/fmp%2Fauth/details?version=1"

  # Kibana lives in the 'elk' namespace, so it follows the same plain-nohup
  # pattern as Vault (the keeper loop hard-codes $NAMESPACE). Only forward
  # it if Kibana's Deployment actually came up — silent failures are
  # confusing otherwise.
  info "[kibana] start detached port-forward on 127.0.0.1:5601"
  if [ -f /tmp/fmp-kibana-pf.pid ]; then
    kill "$(cat /tmp/fmp-kibana-pf.pid)" 2>/dev/null || true
    rm -f /tmp/fmp-kibana-pf.pid
  fi
  fuser -k 5601/tcp 2>/dev/null || true
  if kubectl get -n elk deploy/kibana >/dev/null 2>&1; then
    nohup kubectl port-forward -n elk svc/kibana 5601:5601 > /tmp/fmp-kibana-pf.log 2>&1 &
    echo $! > /tmp/fmp-kibana-pf.pid
    disown
    ok "    ✓ Kibana UI: http://localhost:5601  (Discover index 'fmp-logs-*' or dashboard 'FMP-68 — Application Logs')"
  else
    err "    ⚠ deploy/kibana missing in 'elk' namespace — skipping Kibana port-forward"
  fi
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
  echo "  http://localhost:5601    Kibana             (kubectl port-forward → svc/kibana:5601, namespace 'elk')"
  echo "  http://127.0.0.1:8200/ui Vault UI           (kubectl port-forward, token: fmp-dev-root)"
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
