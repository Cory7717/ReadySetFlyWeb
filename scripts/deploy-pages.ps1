$ErrorActionPreference = "Stop"

param(
  [string]$Remote = "origin",
  [string]$Branch = "gh-pages"
)

Write-Host "Building GitHub Pages bundle..."
npm run build:pages

if (Test-Path "CNAME") {
  Copy-Item "CNAME" "docs\\CNAME" -Force
}
if (!(Test-Path "docs\\404.html")) {
  Copy-Item "client\\public\\404.html" "docs\\404.html" -Force
}

$repoRoot = (git rev-parse --show-toplevel).Trim()
$worktree = Join-Path $repoRoot ".tmp\\gh-pages"

if (Test-Path $worktree) {
  git worktree remove $worktree --force | Out-Null
  Remove-Item $worktree -Recurse -Force -ErrorAction SilentlyContinue
}

$hasRemote = $false
try {
  $remoteHeads = git ls-remote --heads $Remote $Branch
  if ($remoteHeads) { $hasRemote = $true }
} catch {
  $hasRemote = $false
}

if ($hasRemote) {
  git worktree add -B $Branch $worktree "$Remote/$Branch" | Out-Null
} else {
  git worktree add -B $Branch $worktree | Out-Null
}

Get-ChildItem -Path $worktree -Force |
  Where-Object { $_.Name -ne ".git" } |
  Remove-Item -Recurse -Force

Copy-Item (Join-Path $repoRoot "docs\\*") $worktree -Recurse -Force

Push-Location $worktree
git add -A
git diff --cached --quiet
if ($LASTEXITCODE -ne 0) {
  $timestamp = Get-Date -Format "yyyy-MM-dd HH:mm"
  git commit -m "Manual Pages deploy $timestamp" | Out-Null
  git push $Remote $Branch
  Write-Host "Manual Pages deploy pushed to $Remote/$Branch."
} else {
  Write-Host "No changes to deploy."
}
Pop-Location

git worktree remove $worktree | Out-Null
Write-Host "Done."
