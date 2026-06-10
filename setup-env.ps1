# PowerShell Script for Environment Setup
# Usage: .\setup-env.ps1 -Environment local
# Usage: .\setup-env.ps1 -Environment production

param(
    [Parameter(Mandatory=$true)]
    [ValidateSet('local','production')]
    [string]$Environment
)

Write-Host "==================================" -ForegroundColor Cyan
Write-Host "Environment Setup Script" -ForegroundColor Cyan
Write-Host "==================================" -ForegroundColor Cyan
Write-Host ""

# Setup Server Environment
Write-Host "Setting up SERVER environment..." -ForegroundColor Yellow
$serverEnvSource = "server\.env.$Environment"
$serverEnvTarget = "server\.env"

if (Test-Path $serverEnvSource) {
    Copy-Item $serverEnvSource $serverEnvTarget -Force
    Write-Host "✓ Server .env file created from $serverEnvSource" -ForegroundColor Green
} else {
    Write-Host "✗ Warning: $serverEnvSource not found!" -ForegroundColor Red
}

# Setup Client Environment
Write-Host "Setting up CLIENT environment..." -ForegroundColor Yellow

if ($Environment -eq "local") {
    $clientEnvSource = "client\.env.local"
    $clientEnvTarget = "client\.env"
    
    if (Test-Path $clientEnvSource) {
        Copy-Item $clientEnvSource $clientEnvTarget -Force
        Write-Host "✓ Client .env file created from $clientEnvSource" -ForegroundColor Green
    } else {
        Write-Host "✗ Warning: $clientEnvSource not found!" -ForegroundColor Red
    }
} else {
    # For production, .env.production is used directly by Vite during build
    Write-Host "✓ Client will use .env.production during build" -ForegroundColor Green
}

Write-Host ""
Write-Host "==================================" -ForegroundColor Cyan
Write-Host "Setup Complete!" -ForegroundColor Green
Write-Host "==================================" -ForegroundColor Cyan
Write-Host ""

if ($Environment -eq "local") {
    Write-Host "Next steps for LOCAL development:" -ForegroundColor Yellow
    Write-Host "1. Edit server\.env with your local database credentials" -ForegroundColor White
    Write-Host "2. cd server && npm install && npm run dev" -ForegroundColor White
    Write-Host "3. cd client && npm install && npm run dev" -ForegroundColor White
} else {
    Write-Host "Next steps for PRODUCTION deployment:" -ForegroundColor Yellow
    Write-Host "1. Edit server\.env with your production database credentials" -ForegroundColor White
    Write-Host "2. Generate a strong JWT_SECRET (see DEPLOYMENT_GUIDE.md)" -ForegroundColor White
    Write-Host "3. Edit client\.env.production with your production API URL" -ForegroundColor White
    Write-Host "4. cd client && npm run build" -ForegroundColor White
    Write-Host "5. Deploy server folder and client/dist folder to your host" -ForegroundColor White
}

Write-Host ""
Write-Host "⚠️  IMPORTANT: Never commit .env files to git!" -ForegroundColor Red
Write-Host ""
