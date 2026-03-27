$ErrorActionPreference = "Stop"

$repoRoot = Split-Path -Parent $PSScriptRoot
$nodeCommand = Get-Command node -ErrorAction SilentlyContinue

if (-not $nodeCommand) {
  Write-Host ""
  Write-Host "Node.js was not found on this computer." -ForegroundColor Red
  Write-Host "Install Node.js, then run this launcher again." -ForegroundColor Yellow
  Write-Host ""
  Read-Host "Press Enter to close"
  exit 1
}

Set-Location $repoRoot

Write-Host ""
Write-Host "Ready Set Fly Receiver Bridge" -ForegroundColor Cyan
Write-Host "Listening for GDL-90 UDP on 0.0.0.0:4000" -ForegroundColor Gray
Write-Host "Serving bridge JSON at http://127.0.0.1:3005/rsf-live.json" -ForegroundColor Gray
Write-Host "Serving local bridge status at http://127.0.0.1:3005/" -ForegroundColor Gray
Write-Host "Open RSF Live Flight Map and choose 'Receiver bridge' as the position source." -ForegroundColor Gray
Write-Host ""

& node scripts/receiver-bridge.mjs
$exitCode = $LASTEXITCODE

Write-Host ""
Write-Host "Receiver bridge stopped." -ForegroundColor Yellow
Read-Host "Press Enter to close"
exit $exitCode
