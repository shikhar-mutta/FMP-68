#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────
# FMP-68 backend — test runner with coverage report (all 6 services)
#
# What this does:
#   For each NestJS microservice:
#     1. Installs deps if node_modules is missing.
#     2. Runs `jest --coverage` and prints the coverage table.
#   Then prints an aggregated per-service summary.
#
# Usage:
#   ./backend/run_test.sh                # run all services
#   ./backend/run_test.sh auth-service   # run a single service
#
# Per-service coverage HTML report:
#   backend/<svc>/coverage/lcov-report/index.html
# ─────────────────────────────────────────────────────────────
set -u
set -o pipefail

BACKEND_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

G='\033[0;32m'; C='\033[0;36m'; Y='\033[1;33m'; R='\033[0;31m'; N='\033[0m'
banner() { echo -e "${C}══════════════════════════════════════════${N}"; echo -e "${C}  $*${N}"; echo -e "${C}══════════════════════════════════════════${N}"; }

ALL_SERVICES=(api-gateway auth-service users-service paths-service tracking-service notification-service)

if [ $# -gt 0 ]; then
  SERVICES=("$@")
else
  SERVICES=("${ALL_SERVICES[@]}")
fi

banner "FMP-68 backend — test coverage (${#SERVICES[@]} service(s))"

declare -A RESULT
FAIL=0

for svc in "${SERVICES[@]}"; do
  SVC_DIR="$BACKEND_DIR/$svc"
  if [ ! -d "$SVC_DIR" ]; then
    echo -e "${R}    ✘ $svc — directory not found at $SVC_DIR${N}"
    RESULT[$svc]="MISSING"
    FAIL=$((FAIL + 1))
    continue
  fi

  banner "→ $svc"
  cd "$SVC_DIR"

  if [ ! -d "node_modules" ]; then
    echo -e "${Y}[deps] $svc — node_modules missing → npm ci${N}"
    if ! npm ci 2>&1 | tail -3; then
      echo -e "${R}    ✘ $svc — npm ci failed${N}"
      RESULT[$svc]="DEPS-FAIL"
      FAIL=$((FAIL + 1))
      continue
    fi
  else
    echo -e "${Y}[deps] $svc — node_modules present — skipping install${N}"
  fi

  # paths-service / tracking-service / users-service need prisma client
  if [ -f "$SVC_DIR/prisma/schema.prisma" ] && [ ! -d "$SVC_DIR/node_modules/.prisma" ]; then
    echo -e "${Y}[prisma] $svc — generating client${N}"
    npx prisma generate 2>&1 | tail -3 || true
  fi

  echo -e "${Y}[test] $svc — jest --coverage${N}"
  if npm test -- --coverage --colors; then
    RESULT[$svc]="PASS"
  else
    RESULT[$svc]="FAIL"
    FAIL=$((FAIL + 1))
  fi
done

echo ""
banner "Backend coverage summary"
for svc in "${SERVICES[@]}"; do
  status="${RESULT[$svc]:-?}"
  case "$status" in
    PASS)      printf "    ${G}✓${N} %-22s %s\n" "$svc" "$status" ;;
    FAIL)      printf "    ${R}✘${N} %-22s %s\n" "$svc" "$status" ;;
    DEPS-FAIL) printf "    ${R}✘${N} %-22s %s\n" "$svc" "$status" ;;
    MISSING)   printf "    ${R}✘${N} %-22s %s\n" "$svc" "$status" ;;
    *)         printf "    ${Y}?${N} %-22s %s\n" "$svc" "$status" ;;
  esac
done

# ── Aggregate "All files" totals across every service's coverage-summary.json ──
SUMMARIES=()
for svc in "${SERVICES[@]}"; do
  # Each service's jest has rootDir: src → coverage lives under src/coverage/
  f="$BACKEND_DIR/$svc/src/coverage/coverage-summary.json"
  [ -f "$f" ] && SUMMARIES+=("$f")
done

if [ "${#SUMMARIES[@]}" -gt 0 ]; then
  echo ""
  echo -e "${C}Backend overall coverage (sum of all services)${N}"
  python3 - "${SUMMARIES[@]}" <<'PYEOF'
import json, sys
agg = {k: {"total": 0, "covered": 0} for k in ("statements", "branches", "functions", "lines")}
for path in sys.argv[1:]:
    with open(path) as fh:
        tot = json.load(fh).get("total", {})
    for k in agg:
        agg[k]["total"]   += tot.get(k, {}).get("total", 0)
        agg[k]["covered"] += tot.get(k, {}).get("covered", 0)
def pct(x): return 0.0 if x["total"] == 0 else (x["covered"] / x["total"]) * 100
print("    Statements : {:>6.2f}%  ({}/{})".format(pct(agg["statements"]), agg["statements"]["covered"], agg["statements"]["total"]))
print("    Branches   : {:>6.2f}%  ({}/{})".format(pct(agg["branches"]),   agg["branches"]["covered"],   agg["branches"]["total"]))
print("    Functions  : {:>6.2f}%  ({}/{})".format(pct(agg["functions"]),  agg["functions"]["covered"],  agg["functions"]["total"]))
print("    Lines      : {:>6.2f}%  ({}/{})".format(pct(agg["lines"]),      agg["lines"]["covered"],      agg["lines"]["total"]))
PYEOF
fi

echo ""
if [ "$FAIL" -eq 0 ]; then
  echo -e "${G}✅ Backend coverage complete (all ${#SERVICES[@]} services passed)${N}"
  exit 0
else
  echo -e "${R}✘ Backend coverage complete with ${FAIL} failure(s)${N}"
  exit 1
fi
