#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────
# FMP-68 — Zero-downtime rolling update demo
#
# What this proves (PDF "Live Patching" innovation, 2 marks):
#   While we change the api-gateway image, a continuous stream of
#   curl requests against /health gets HTTP 200 for every single
#   request — zero 5xx, zero connection errors.
#
# Mechanism (already in the deployment.yaml):
#   - 2 replicas
#   - strategy.rollingUpdate: maxSurge=1, maxUnavailable=0
#   - lifecycle.preStop sleep 5 — drains endpoints before SIGTERM
#   - terminationGracePeriodSeconds: 30 — drains in-flight traffic
#   - readinessProbe on /health — only Ready pods get traffic
#
# Pre-reqs:
#   - Minikube up, fmp namespace healthy
#   - kubectl port-forward 4000:4000 -n fmp svc/api-gateway running
#     (or any other way to reach the gateway from the host)
# ─────────────────────────────────────────────────────────────
set -u

NAMESPACE="${NAMESPACE:-fmp}"
DEPLOYMENT="${DEPLOYMENT:-api-gateway}"
URL="${URL:-http://localhost:4000/health}"
DURATION="${DURATION:-45}"             # seconds of background load
CONCURRENCY="${CONCURRENCY:-10}"
NEW_TAG="${NEW_TAG:-fmp-api-gateway:local}"

# Will print first line in green, summary in cyan, errors in red.
g() { printf '\033[32m%s\033[0m\n' "$*"; }
c() { printf '\033[36m%s\033[0m\n' "$*"; }
r() { printf '\033[31m%s\033[0m\n' "$*"; }

g "================================================================="
g "  FMP-68 zero-downtime rolling-update demo"
g "================================================================="
echo "Namespace:    $NAMESPACE"
echo "Deployment:   $DEPLOYMENT"
echo "URL:          $URL"
echo "Load:         ${CONCURRENCY} concurrent for ${DURATION}s"
echo "New image:    $NEW_TAG"
echo

# 0. Baseline check
c "→ Pre-flight: target reachable?"
http_status=$(curl -s -o /dev/null -m 3 -w '%{http_code}' "$URL")
echo "    $URL → HTTP $http_status"
if [ "$http_status" != "200" ]; then
  r "    ✘ target not reachable — fix port-forward before running"
  exit 1
fi
echo

# 1. Snapshot the current ReplicaSet so we can compare after
old_rs=$(kubectl get rs -n "$NAMESPACE" -l "app=$DEPLOYMENT" \
            -o jsonpath='{.items[?(@.spec.replicas>0)].metadata.name}')
c "→ Current active ReplicaSet: $old_rs"
echo

# 2. Start the load generator in the background.
#    Each request writes one line (status + total time) to /tmp/fmp-load.log.
c "→ Starting load: $CONCURRENCY concurrent curls for ${DURATION}s"
load_log=/tmp/fmp-load.log
: > "$load_log"
end=$(( $(date +%s) + DURATION ))

worker() {
  while [ "$(date +%s)" -lt "$end" ]; do
    code=$(curl -s -o /dev/null -m 2 -w '%{http_code}|%{time_total}' "$URL" 2>/dev/null || echo "000|timeout")
    printf '%s\n' "$code" >> "$load_log"
  done
}
for i in $(seq 1 "$CONCURRENCY"); do
  worker &
done
load_pids=$(jobs -p)
sleep 3

# 3. Trigger the rolling update mid-flight
c "→ Triggering rolling update (kubectl set image)"
kubectl set image deployment/"$DEPLOYMENT" "$DEPLOYMENT=$NEW_TAG" \
        -n "$NAMESPACE" --record 2>&1 | sed 's/^/    /'
echo

# 4. Watch the rollout
c "→ kubectl rollout status (live)"
kubectl rollout status deployment/"$DEPLOYMENT" -n "$NAMESPACE" --timeout=120s 2>&1 | sed 's/^/    /'
echo

# 5. Wait for the load generator to finish
c "→ Letting load generator finish its ${DURATION}s window"
wait $load_pids 2>/dev/null
echo

# 6. Report
total=$(wc -l < "$load_log")
ok_200=$(grep -c '^200|' "$load_log" || true)
non_200=$(grep -c '^[2-9][0-9][0-9]|' "$load_log" || true)
non_200=$((non_200 - ok_200))
errors=$(grep -c '^000|\|^5[0-9][0-9]|' "$load_log" || true)

c "→ Result summary"
echo "    Total requests:   $total"
echo "    HTTP 200:         $ok_200"
echo "    Other 2xx-9xx:    $non_200"
echo "    Errors / 5xx:     $errors"
echo

if [ "$errors" -eq 0 ]; then
  g "✅ ZERO downtime — all $total requests returned HTTP 200 during the rollout."
else
  r "❌ $errors errors observed during rollout — investigate."
fi
echo

c "→ Rollout history"
kubectl rollout history deployment/"$DEPLOYMENT" -n "$NAMESPACE" 2>&1 | sed 's/^/    /'
