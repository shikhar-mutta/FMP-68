#!/bin/bash

# ─────────────────────────────────────────────────────────────
# FMP-68 — Local Dev Launcher
# Usage: ./start.sh
# Runs Backend (NestJS :4000) and Frontend (React :3000)
# ─────────────────────────────────────────────────────────────

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BACKEND_DIR="$ROOT_DIR/backend"
FRONTEND_DIR="$ROOT_DIR/frontend"
LOG_DIR="$ROOT_DIR/logs"

mkdir -p "$LOG_DIR"

RED='\033[0;31m'; GREEN='\033[0;32m'; CYAN='\033[0;36m'
YELLOW='\033[1;33m'; BLUE='\033[0;34m'; NC='\033[0m'

echo ""
echo -e "${CYAN}╔══════════════════════════════════════════╗${NC}"
echo -e "${CYAN}║        FMP-68 Dev Server Launcher        ║${NC}"
echo -e "${CYAN}╚══════════════════════════════════════════╝${NC}"
echo ""

# ── Validate dirs ──────────────────────────────────────────────
if [ ! -d "$BACKEND_DIR" ]; then echo -e "${RED}[ERROR] backend/ not found${NC}"; exit 1; fi
if [ ! -d "$FRONTEND_DIR" ]; then echo -e "${RED}[ERROR] frontend/ not found${NC}"; exit 1; fi

# ── Check backend .env ─────────────────────────────────────────
if [ ! -f "$BACKEND_DIR/.env" ]; then
  echo -e "${YELLOW}[WARN] backend/.env missing — copying from root .env${NC}"
  cp "$ROOT_DIR/.env" "$BACKEND_DIR/.env"
  sed -i 's|host.docker.internal|localhost|g' "$BACKEND_DIR/.env"
fi

# ── Install deps if needed ─────────────────────────────────────
if [ ! -d "$BACKEND_DIR/node_modules" ]; then
  echo -e "${YELLOW}[BACKEND] Installing dependencies...${NC}"
  npm install --prefix "$BACKEND_DIR"
fi

if [ ! -d "$FRONTEND_DIR/node_modules" ]; then
  echo -e "${YELLOW}[FRONTEND] Installing dependencies...${NC}"
  npm install --prefix "$FRONTEND_DIR"
fi

# ── Prisma setup ───────────────────────────────────────────────
echo -e "${GREEN}[BACKEND] Generating Prisma client...${NC}"
cd "$BACKEND_DIR" && npx prisma generate 2>&1 | tail -3
echo -e "${GREEN}[BACKEND] Pushing Prisma schema...${NC}"
npx prisma db push --skip-generate 2>&1 | tail -5
cd "$ROOT_DIR"

# ── Launch helper ──────────────────────────────────────────────
launch_in_terminal() {
  local title="$1"
  local cmd="$2"

  if command -v gnome-terminal &>/dev/null; then
    gnome-terminal --title="$title" -- bash -c "$cmd; exec bash" &
  elif command -v xfce4-terminal &>/dev/null; then
    xfce4-terminal --title="$title" -x bash -c "$cmd; exec bash" &
  elif command -v konsole &>/dev/null; then
    konsole --title "$title" -e bash -c "$cmd; exec bash" &
  elif command -v xterm &>/dev/null; then
    xterm -T "$title" -e bash -c "$cmd; exec bash" &
  else
    # Fallback: run in background, log to file
    echo -e "${YELLOW}[INFO] No terminal emulator found — running $title in background${NC}"
    bash -c "$cmd" >> "$LOG_DIR/$(echo $title | tr ' ' '_').log" 2>&1 &
    echo $! > "$LOG_DIR/$(echo $title | tr ' ' '_').pid"
  fi
}

# ── Clear ports ───────────────────────────────────────────────
echo -e "${YELLOW}[INFO] Clearing ports 4000 and 3000...${NC}"
fuser -k 4000/tcp 2>/dev/null || true
fuser -k 3000/tcp 2>/dev/null || true
sleep 1

# ── Start Backend ──────────────────────────────────────────────
echo -e "${GREEN}[BACKEND]  Starting NestJS  → http://localhost:4000${NC}"
launch_in_terminal "FMP-68 Backend" "cd \"$BACKEND_DIR\" && npm run start:dev"

sleep 2

# ── Start Frontend ─────────────────────────────────────────────
echo -e "${BLUE}[FRONTEND] Starting React   → http://localhost:3000${NC}"
launch_in_terminal "FMP-68 Frontend" "cd \"$FRONTEND_DIR\" && HOST=localhost REACT_APP_API_URL=http://localhost:4000 npm start"

echo ""
echo -e "${CYAN}══════════════════════════════════════════════${NC}"
echo -e "${GREEN} ✔ Backend  → http://localhost:4000${NC}"
echo -e "${GREEN} ✔ Frontend → http://localhost:3000${NC}"
echo -e "${CYAN}══════════════════════════════════════════════${NC}"
echo ""
echo -e "${YELLOW} Logs (if no terminal emulator): $LOG_DIR/${NC}"
echo -e "${YELLOW} To stop: kill \$(cat $LOG_DIR/*.pid 2>/dev/null)${NC}"
echo ""
