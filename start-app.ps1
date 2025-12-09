# RailGuard V2 - Quick Start Script
# This script starts both backend and frontend servers

Write-Host "==================================================" -ForegroundColor Cyan
Write-Host "  RailGuard V2 - Starting Application" -ForegroundColor Cyan
Write-Host "==================================================" -ForegroundColor Cyan
Write-Host ""

# Check if .env files exist
$backendEnvExists = Test-Path "backend\.env"
$frontendEnvExists = Test-Path "frontend\.env.local"

if (-not $backendEnvExists) {
    Write-Host "⚠️  WARNING: backend\.env not found!" -ForegroundColor Yellow
    Write-Host "   Please create backend\.env with your database and API credentials" -ForegroundColor Yellow
    Write-Host "   See backend\.env.example for template" -ForegroundColor Yellow
    Write-Host ""
    Write-Host "   Required variables:" -ForegroundColor Yellow
    Write-Host "   - NEON_DATABASE_URL (PostgreSQL connection string)" -ForegroundColor Yellow
    Write-Host "   - GEMINI_API_KEY (Google Gemini API key)" -ForegroundColor Yellow
    Write-Host "   - AWS credentials (for S3 storage)" -ForegroundColor Yellow
    Write-Host ""
    $continue = Read-Host "Continue anyway? (y/n)"
    if ($continue -ne "y") {
        exit
    }
}

if (-not $frontendEnvExists) {
    Write-Host "ℹ️  Creating frontend\.env.local with default settings..." -ForegroundColor Blue
    Copy-Item "frontend\.env.local.example" "frontend\.env.local"
}

Write-Host ""
Write-Host "Starting Backend Server..." -ForegroundColor Green
Write-Host "Location: http://localhost:8000" -ForegroundColor Gray
Write-Host ""

# Start backend in new window
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd backend; python main.py"

# Wait a bit for backend to start
Start-Sleep -Seconds 3

Write-Host "Starting Frontend Server..." -ForegroundColor Green
Write-Host "Location: http://localhost:3000" -ForegroundColor Gray
Write-Host ""

# Start frontend in new window
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd frontend; npm run dev"

Write-Host ""
Write-Host "==================================================" -ForegroundColor Cyan
Write-Host "  ✅ Application Started!" -ForegroundColor Green
Write-Host "==================================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "  Backend:  http://localhost:8000" -ForegroundColor White
Write-Host "  Frontend: http://localhost:3000" -ForegroundColor White
Write-Host ""
Write-Host "  Press Ctrl+C in each window to stop servers" -ForegroundColor Gray
Write-Host ""
