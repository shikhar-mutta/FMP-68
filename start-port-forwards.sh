#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
# start-port-forwards.sh — bring up kubectl port-forwards for local access
#
# Minikube is managed by the jenkins OS user, so its kubeconfig lives at
# /var/lib/jenkins/.kube/config.  When running this script as a different
# OS user (e.g. shikhar), we delegate each kubectl call through sudo -u jenkins
# so the correct kubeconfig is used automatically.
#
# Usage:
#   ./start-port-forwards.sh          # start all port-forwards
#   ./start-port-forwards.sh stop     # kill all port-forwards
#
# After starting, the following endpoints are available:
#   http://localhost:3000    Frontend SPA
#   http://localhost:4000    API Gateway  (health: /health)
#   http://localhost:15672   RabbitMQ management UI  (guest / guest)
#   http://localhost:5601    Kibana  (index: fmp-logs-*)
#   http://localhost:8200    Vault UI  (token: fmp-dev-root)
# ─────────────────────────────────────────────────────────────────────────────
set -euo pipefail

PID_DIR="/tmp/fmp-pf-pids"
LOG_DIR="/tmp/fmp-pf-logs"
JENKINS_USER="jenkins"

# Detect whether kubectl must be run via sudo -u jenkins (when not already jenkins)
if [ "$(id -un)" = "$JENKINS_USER" ]; then
    KUBECTL="kubectl"
else
    KUBECTL="sudo -u $JENKINS_USER kubectl"
fi

# ── helpers ───────────────────────────────────────────────────────────────────
start_pf() {
    local name="$1" namespace="$2" svc="$3" local_port="$4" target_port="$5"
    local pid_file="$PID_DIR/$name.pid"
    local log_file="$LOG_DIR/$name.log"

    # Kill any stale forward on this port first
    if [ -f "$pid_file" ]; then
        kill "$(cat "$pid_file")" 2>/dev/null || true
        rm -f "$pid_file"
    fi
    fuser -k "${local_port}/tcp" 2>/dev/null || true

    nohup $KUBECTL port-forward -n "$namespace" "svc/$svc" \
        "${local_port}:${target_port}" >"$log_file" 2>&1 &
    echo $! > "$pid_file"
    echo "  ✓ $name  localhost:${local_port} → svc/${svc}:${target_port}  (pid $!)"
}

stop_all() {
    echo "Stopping all FMP port-forwards..."
    for pid_file in "$PID_DIR"/*.pid 2>/dev/null; do
        [ -f "$pid_file" ] || continue
        pid=$(cat "$pid_file")
        name=$(basename "$pid_file" .pid)
        kill "$pid" 2>/dev/null && echo "  stopped $name (pid $pid)" || true
        rm -f "$pid_file"
    done
    for port in 3000 4000 15672 5601 8200; do
        fuser -k "${port}/tcp" 2>/dev/null || true
    done
    echo "Done."
}

# ── main ──────────────────────────────────────────────────────────────────────
if [ "${1:-}" = "stop" ]; then
    stop_all
    exit 0
fi

mkdir -p "$PID_DIR" "$LOG_DIR"

echo "Starting FMP port-forwards..."
start_pf frontend    fmp   frontend    3000  80
start_pf api-gateway fmp   api-gateway 4000  4000
start_pf rabbitmq    fmp   rabbitmq    15672 15672
start_pf vault       vault vault       8200  8200
start_pf kibana      elk   kibana      5601  5601

echo ""
echo "All port-forwards running. Access:"
echo "  http://localhost:3000    Frontend SPA"
echo "  http://localhost:4000    API Gateway"
echo "  http://localhost:15672   RabbitMQ  (guest/guest)"
echo "  http://localhost:5601    Kibana"
echo "  http://localhost:8200    Vault  (token: fmp-dev-root)"
echo ""
echo "To stop: ./start-port-forwards.sh stop"
