#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
# FMP-68 — Kubernetes One-Shot Deploy Script
# Applies all manifests in order: namespace → config → secrets → deployments → HPA
# Usage:  bash k8s/deploy.sh [--delete]
# ─────────────────────────────────────────────────────────────────────────────
set -euo pipefail

NAMESPACE="fmp68"
K8S_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ACTION="${1:-apply}"

if [[ "$ACTION" == "--delete" || "$ACTION" == "delete" ]]; then
  echo "⚠️  Deleting all FMP-68 K8s resources in namespace: $NAMESPACE"
  kubectl delete namespace "$NAMESPACE" --ignore-not-found
  exit 0
fi

echo "╔══════════════════════════════════════════════╗"
echo "║  FMP-68 Kubernetes Deployment                ║"
echo "║  Namespace : $NAMESPACE                           ║"
echo "╚══════════════════════════════════════════════╝"

# ── Ensure metrics-server is available (needed for HPA) ──────────────────────
if ! kubectl get deployment metrics-server -n kube-system &>/dev/null; then
  echo "📦  Installing metrics-server (required for HPA)..."
  kubectl apply -f https://github.com/kubernetes-sigs/metrics-server/releases/latest/download/components.yaml
  echo "⏳  Waiting for metrics-server to be ready..."
  kubectl wait --for=condition=available deployment/metrics-server -n kube-system --timeout=60s || true
fi

# ── 1. Namespace ──────────────────────────────────────────────────────────────
echo ""
echo "1️⃣   Applying namespace..."
kubectl apply -f "$K8S_DIR/namespace.yaml"

# ── 2. ConfigMap & Secrets ────────────────────────────────────────────────────
echo "2️⃣   Applying ConfigMap and Secrets..."
kubectl apply -f "$K8S_DIR/configmap.yaml"
kubectl apply -f "$K8S_DIR/secret.yaml"

# ── 3. Deployments ────────────────────────────────────────────────────────────
echo "3️⃣   Applying Deployments..."
for f in "$K8S_DIR"/deployments/*.yaml; do
  echo "   → $(basename "$f")"
  kubectl apply -f "$f"
done

# ── 4. HPA ────────────────────────────────────────────────────────────────────
echo "4️⃣   Applying Horizontal Pod Autoscalers..."
for f in "$K8S_DIR"/hpa/*.yaml; do
  echo "   → $(basename "$f")"
  kubectl apply -f "$f"
done

# ── 5. Wait for rollout ───────────────────────────────────────────────────────
echo ""
echo "5️⃣   Waiting for rollouts to complete..."
DEPLOYMENTS=(auth-service user-service paths-service follow-service tracking-service api-gateway frontend)
for dep in "${DEPLOYMENTS[@]}"; do
  echo -n "   Waiting for $dep... "
  kubectl rollout status deployment/"$dep" -n "$NAMESPACE" --timeout=120s && echo "✅" || echo "⚠️  timeout"
done

# ── 6. Status summary ─────────────────────────────────────────────────────────
echo ""
echo "📊  Pod Status:"
kubectl get pods -n "$NAMESPACE" -o wide

echo ""
echo "🔀  HPA Status:"
kubectl get hpa -n "$NAMESPACE"

echo ""
echo "🌐  Services:"
kubectl get svc -n "$NAMESPACE"

echo ""
echo "✅  FMP-68 deployed to Kubernetes!"
echo "   App         : http://localhost:30300"
echo "   API Gateway : http://localhost:30400"
