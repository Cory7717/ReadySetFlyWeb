$ErrorActionPreference = "Stop"

$repoRoot = Split-Path -Parent $PSScriptRoot
$targetDir = Join-Path $repoRoot "dist\\receiver-bridge"
$zipPath = Join-Path $repoRoot "dist\\receiver-bridge.zip"

if (Test-Path $targetDir) {
  Remove-Item $targetDir -Recurse -Force
}

if (Test-Path $zipPath) {
  Remove-Item $zipPath -Force
}

New-Item -ItemType Directory -Path $targetDir | Out-Null

Copy-Item (Join-Path $repoRoot "scripts\\receiver-bridge.mjs") (Join-Path $targetDir "receiver-bridge.mjs")
Copy-Item (Join-Path $repoRoot "scripts\\receiver-bridge-launch.ps1") (Join-Path $targetDir "receiver-bridge-launch.ps1")
Copy-Item (Join-Path $repoRoot "scripts\\receiver-bridge-launch.cmd") (Join-Path $targetDir "receiver-bridge-launch.cmd")
Copy-Item (Join-Path $repoRoot "docs\\receiver-bridge.md") (Join-Path $targetDir "README.md")

$notes = @"
Ready Set Fly Receiver Bridge bundle

1. Make sure Node.js is installed.
2. Double-click receiver-bridge-launch.cmd
3. Open http://127.0.0.1:3005/ to confirm the bridge is receiving frames
4. In RSF Live Flight Map, choose Receiver bridge
5. Use http://127.0.0.1:3005/rsf-live.json as the bridge URL
"@

Set-Content -Path (Join-Path $targetDir "QUICK_START.txt") -Value $notes

Compress-Archive -Path (Join-Path $targetDir "*") -DestinationPath $zipPath -Force

Write-Host ""
Write-Host "Receiver bridge package created at:" -ForegroundColor Cyan
Write-Host $targetDir -ForegroundColor Green
Write-Host ""
Write-Host "Receiver bridge zip created at:" -ForegroundColor Cyan
Write-Host $zipPath -ForegroundColor Green
Write-Host ""
