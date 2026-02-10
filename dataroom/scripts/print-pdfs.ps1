$ErrorActionPreference = "Stop"

$rootDir = Resolve-Path "$PSScriptRoot\..\.."
$dataroomDir = Join-Path $rootDir "dataroom"
$outDir = Join-Path $dataroomDir "out"

New-Item -ItemType Directory -Force -Path $outDir | Out-Null

$pandoc = Get-Command pandoc -ErrorAction SilentlyContinue
if ($pandoc) {
  Write-Host "Using pandoc for PDF export"
  Get-ChildItem -Path $dataroomDir -Filter "*.md" | ForEach-Object {
    $base = $_.BaseName
    $outFile = Join-Path $outDir "$base.pdf"
    pandoc $_.FullName -o $outFile
  }
  exit 0
}

Write-Host "Pandoc not found. Falling back to Playwright (requires npm install -D playwright)."
node "$dataroomDir\scripts\print-pdfs.mjs"
