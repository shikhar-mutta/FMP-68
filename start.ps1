# FMP-68 - Start Dev Servers
# Run: .\start.ps1

$root = Split-Path -Parent $MyInvocation.MyCommand.Definition
$backend = Join-Path $root "backend"
$frontend = Join-Path $root "frontend"

# Add Node.js to PATH if not already present
$env:Path += ";C:\Program Files\nodejs"

Write-Host ""
Write-Host "FMP-68 Dev Server Launcher" -ForegroundColor Cyan
Write-Host ""
Write-Host "  Starting Backend  -> http://localhost:4000" -ForegroundColor Green
Write-Host "  Starting Frontend -> http://localhost:3000" -ForegroundColor Green
Write-Host ""

# Start Backend in a new PowerShell window
Start-Process powershell -ArgumentList @(
    "-NoExit",
    "-Command",
    "`$env:Path += ';C:\Program Files\nodejs'; cd '$backend'; Write-Host '[BACKEND] Starting NestJS...' -ForegroundColor Green; npm run start:dev"
)

# Small delay so backend starts first
Start-Sleep -Seconds 2

# Start Frontend in a new PowerShell window
Start-Process powershell -ArgumentList @(
    "-NoExit",
    "-Command",
    "`$env:Path += ';C:\Program Files\nodejs'; cd '$frontend'; Write-Host '[FRONTEND] Starting React...' -ForegroundColor Blue; `$env:DANGEROUSLY_DISABLE_HOST_CHECK='true'; `$env:HOST='localhost'; `$env:REACT_APP_API_URL='http://localhost:4000'; npm start"
)

Write-Host "Both servers launched in separate windows!" -ForegroundColor Yellow
Write-Host ""
Read-Host "Press Enter to exit"
