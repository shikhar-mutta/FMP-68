#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────
# FMP-68 frontend — test runner with coverage report
#
# What this does:
#   1. Installs deps if node_modules is missing.
#   2. Runs jest via react-scripts with --coverage --watchAll=false.
#   3. Prints the per-file coverage table to the terminal.
#
# Usage:
#   ./frontend/run_test.sh
#
# Coverage HTML report (after run):
#   frontend/coverage/lcov-report/index.html
# ─────────────────────────────────────────────────────────────
set -e
set -u
set -o pipefail

FE_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$FE_DIR"

G='\033[0;32m'; C='\033[0;36m'; Y='\033[1;33m'; R='\033[0;31m'; N='\033[0m'
banner() { echo -e "${C}══════════════════════════════════════════${N}"; echo -e "${C}  $*${N}"; echo -e "${C}══════════════════════════════════════════${N}"; }

banner "FMP-68 frontend — test coverage"

if [ ! -d "node_modules" ]; then
  echo -e "${Y}[deps] node_modules missing → npm ci${N}"
  npm ci 2>&1 | tail -3
else
  echo -e "${Y}[deps] node_modules present — skipping install${N}"
fi

echo -e "${Y}[test] react-scripts test --coverage --watchAll=false${N}"
# CI=true forces non-interactive, prints coverage summary table at end.
CI=true npm test -- --coverage --watchAll=false --colors

# ── Overall coverage line (read from coverage-summary.json) ──
SUMMARY="$FE_DIR/coverage/coverage-summary.json"
if [ -f "$SUMMARY" ]; then
  echo ""
  echo -e "${C}Frontend overall coverage${N}"
  python3 - "$SUMMARY" <<'PYEOF'
import json, sys
with open(sys.argv[1]) as fh:
    tot = json.load(fh).get("total", {})
def fmt(k):
    v = tot.get(k, {})
    return "{:>6.2f}%  ({}/{})".format(v.get("pct", 0), v.get("covered", 0), v.get("total", 0))
print("    Statements : " + fmt("statements"))
print("    Branches   : " + fmt("branches"))
print("    Functions  : " + fmt("functions"))
print("    Lines      : " + fmt("lines"))
PYEOF
fi

echo ""
echo -e "${G}✅ Frontend coverage complete${N}"
echo -e "${G}   HTML report: ${FE_DIR}/coverage/lcov-report/index.html${N}"
