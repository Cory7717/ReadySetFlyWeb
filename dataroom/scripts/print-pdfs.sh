#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/../.." && pwd)"
DATAROOM_DIR="$ROOT_DIR/dataroom"
OUT_DIR="$DATAROOM_DIR/out"

mkdir -p "$OUT_DIR"

if command -v pandoc >/dev/null 2>&1; then
  echo "Using pandoc for PDF export"
  for file in "$DATAROOM_DIR"/*.md; do
    base="$(basename "$file" .md)"
    pandoc "$file" -o "$OUT_DIR/$base.pdf"
  done
  exit 0
fi

echo "Pandoc not found. Falling back to Playwright (requires npm install -D playwright)."
node "$DATAROOM_DIR/scripts/print-pdfs.mjs"
