# ─────────────────────────────────────────────────────────────
# FMP-68 — Local Dev Launcher (Windows)
# Usage: .\start.ps1
# Runs Backend (NestJS :4000) and Frontend (React :3000)
# ─────────────────────────────────────────────────────────────

$ROOT_DIR    = Split-Path -Parent $MyInvocation.MyCommand.Definition
$BACKEND_DIR = Join-Path $ROOT_DIR "backend"
$FRONTEND_DIR= Join-Path $ROOT_DIR "frontend"
$LOG_DIR     = Join-Path $ROOT_DIR "logs"

# Ensure logs dir exists
New-Item -ItemType Directory -Force -Path $LOG_DIR | Out-Null

# ── Banner ─────────────────────────────────────────────────────
Write-Host ""
Write-Host "╔══════════════════════════════════════════╗" -ForegroundColor Cyan
Write-Host "║        FMP-68 Dev Server Launcher        ║" -ForegroundColor Cyan
Write-Host "╚══════════════════════════════════════════╝" -ForegroundColor Cyan
Write-Host ""

# ── Validate dirs ──────────────────────────────────────────────
if (-not (Test-Path $BACKEND_DIR))  { Write-Host "[ERROR] backend/ not found"  -ForegroundColor Red; exit 1 }
if (-not (Test-Path $FRONTEND_DIR)) { Write-Host "[ERROR] frontend/ not found" -ForegroundColor Red; exit 1 }

# ── Check backend .env ─────────────────────────────────────────
$backendEnv = Join-Path $BACKEND_DIR ".env"
$rootEnv    = Join-Path $ROOT_DIR ".env"
if (-not (Test-Path $backendEnv)) {
    Write-Host "[WARN] backend\.env missing — copying from root .env" -ForegroundColor Yellow
    Copy-Item $rootEnv $backendEnv
    # Replace host.docker.internal with localhost for local dev
    (Get-Content $backendEnv) -replace "host\.docker\.internal", "localhost" | Set-Content $backendEnv
}

# ── Install deps if needed ─────────────────────────────────────
if (-not (Test-Path (Join-Path $BACKEND_DIR "node_modules"))) {
    Write-Host "[BACKEND] Installing dependencies..." -ForegroundColor Yellow
    Push-Location $BACKEND_DIR
    npm install --legacy-peer-deps
    Pop-Location
}

if (-not (Test-Path (Join-Path $FRONTEND_DIR "node_modules"))) {
    Write-Host "[FRONTEND] Installing dependencies..." -ForegroundColor Yellow
    Push-Location $FRONTEND_DIR
    npm install --legacy-peer-deps
    Pop-Location
}

# ── Prisma setup ───────────────────────────────────────────────
Write-Host "[BACKEND] Generating Prisma client..." -ForegroundColor Green
Push-Location $BACKEND_DIR
npx prisma generate 2>&1 | Select-Object -Last 3
Write-Host "[BACKEND] Pushing Prisma schema..." -ForegroundColor Green
npx prisma db push --skip-generate 2>&1 | Select-Object -Last 5
Pop-Location

# ── Clear ports 4000 and 3000 ──────────────────────────────────
Write-Host "[INFO] Clearing ports 4000 and 3000..." -ForegroundColor Yellow

foreach ($port in @(4000, 3000)) {
    $conn = netstat -ano | Select-String ":$port\s" | Select-Object -First 1
    if ($conn) {
        $pid = ($conn -split '\s+')[-1]
        try {
            Stop-Process -Id $pid -Force -ErrorAction SilentlyContinue
            Write-Host "  Killed process $pid on port $port" -ForegroundColor Yellow
        } catch {}
    }
}
Start-Sleep -Seconds 1

# ── Start Backend ──────────────────────────────────────────────
Write-Host "[BACKEND]  Starting NestJS  -> http://localhost:4000" -ForegroundColor Green
Start-Process powershell -ArgumentList @(
    "-NoExit",
    "-Command",
    "cd '$BACKEND_DIR'; `$env:NODE_OPTIONS='--no-deprecation'; Write-Host '[BACKEND] NestJS starting...' -ForegroundColor Green; npm run start:dev"
) -WindowStyle Normal

Start-Sleep -Seconds 2

# ── Start Frontend ─────────────────────────────────────────────
Write-Host "[FRONTEND] Starting React   -> http://localhost:3000" -ForegroundColor Blue
Start-Process powershell -ArgumentList @(
    "-NoExit",
    "-Command",
    "cd '$FRONTEND_DIR'; `$env:HOST='localhost'; `$env:REACT_APP_API_URL='http://localhost:4000'; `$env:NODE_OPTIONS='--no-deprecation'; Write-Host '[FRONTEND] React starting...' -ForegroundColor Blue; npm start"
) -WindowStyle Normal

# ── Summary ────────────────────────────────────────────────────
Write-Host ""
Write-Host "══════════════════════════════════════════════" -ForegroundColor Cyan
Write-Host " ✔ Backend  -> http://localhost:4000"          -ForegroundColor Green
Write-Host " ✔ Frontend -> http://localhost:3000"          -ForegroundColor Green
Write-Host "══════════════════════════════════════════════" -ForegroundColor Cyan
Write-Host ""
Write-Host " Both servers launched in separate PowerShell windows!" -ForegroundColor Yellow
Write-Host " To stop: close the Backend and Frontend windows."      -ForegroundColor Yellow
Write-Host ""
