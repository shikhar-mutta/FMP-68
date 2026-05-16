#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────
# FMP-68 — root test runner (backend + frontend coverage)
#
# Runs both:
#   ./backend/run_test.sh
#   ./frontend/run_test.sh
# back-to-back and prints a combined pass/fail summary.
#
# Usage:
#   ./run_test.sh              # both
#   ./run_test.sh backend      # backend only
#   ./run_test.sh frontend     # frontend only
# ─────────────────────────────────────────────────────────────
set -u
set -o pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

G='\033[0;32m'; C='\033[0;36m'; Y='\033[1;33m'; R='\033[0;31m'; N='\033[0m'
banner() { echo -e "${C}══════════════════════════════════════════${N}"; echo -e "${C}  $*${N}"; echo -e "${C}══════════════════════════════════════════${N}"; }

TARGET="${1:-both}"
BACK_RC=0
FRONT_RC=0
RAN_BACK=0
RAN_FRONT=0

if [ "$TARGET" = "both" ] || [ "$TARGET" = "backend" ]; then
  banner "FMP-68 — backend test coverage"
  bash "$ROOT_DIR/backend/run_test.sh" || BACK_RC=$?
  RAN_BACK=1
fi

if [ "$TARGET" = "both" ] || [ "$TARGET" = "frontend" ]; then
  banner "FMP-68 — frontend test coverage"
  bash "$ROOT_DIR/frontend/run_test.sh" || FRONT_RC=$?
  RAN_FRONT=1
fi

echo ""
banner "Combined coverage summary"
[ "$RAN_BACK"  -eq 1 ] && { [ "$BACK_RC"  -eq 0 ] && echo -e "    ${G}✓${N} backend   PASS" || echo -e "    ${R}✘${N} backend   FAIL (rc=$BACK_RC)"; }
[ "$RAN_FRONT" -eq 1 ] && { [ "$FRONT_RC" -eq 0 ] && echo -e "    ${G}✓${N} frontend  PASS" || echo -e "    ${R}✘${N} frontend  FAIL (rc=$FRONT_RC)"; }

if [ "$RAN_BACK" -eq 0 ] && [ "$RAN_FRONT" -eq 0 ]; then
  echo -e "${R}Unknown target '${TARGET}'. Use: backend | frontend | (no arg = both)${N}"
  exit 2
fi

# ── Combined overall coverage (backend services + frontend) ──
SUMMARIES=()
for svc in api-gateway auth-service users-service paths-service tracking-service notification-service; do
  # Backend jest configs use rootDir: src → coverage lives under src/coverage/
  f="$ROOT_DIR/backend/$svc/src/coverage/coverage-summary.json"
  [ -f "$f" ] && SUMMARIES+=("$f")
done
FE_SUMMARY="$ROOT_DIR/frontend/coverage/coverage-summary.json"
[ -f "$FE_SUMMARY" ] && SUMMARIES+=("$FE_SUMMARY")

if [ "${#SUMMARIES[@]}" -gt 0 ]; then
  echo ""
  echo -e "${C}Project overall coverage (backend + frontend)${N}"
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

if [ "$BACK_RC" -ne 0 ] || [ "$FRONT_RC" -ne 0 ]; then
  exit 1
fi

echo ""
echo -e "${G}✅ All test suites passed${N}"
echo -e "${G}   Backend reports:  backend/<svc>/src/coverage/lcov-report/index.html${N}"
echo -e "${G}   Frontend report:  frontend/coverage/lcov-report/index.html${N}"
