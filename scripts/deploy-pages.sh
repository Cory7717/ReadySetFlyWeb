#!/usr/bin/env bash
set -euo pipefail

remote="${1:-origin}"
branch="${2:-gh-pages}"

echo "Building GitHub Pages bundle..."
npm run build:pages

if [ -f CNAME ]; then
  cp CNAME docs/CNAME
fi
if [ ! -f docs/404.html ]; then
  cp client/public/404.html docs/404.html
fi

repo_root="$(git rev-parse --show-toplevel)"
worktree="$repo_root/.tmp/gh-pages"

if [ -d "$worktree" ]; then
  git worktree remove "$worktree" --force || true
  rm -rf "$worktree"
fi

if git ls-remote --heads "$remote" "$branch" >/dev/null 2>&1; then
  git worktree add -B "$branch" "$worktree" "$remote/$branch" >/dev/null
else
  git worktree add -B "$branch" "$worktree" >/dev/null
fi

shopt -s dotglob
rm -rf "$worktree"/*
cp -R "$repo_root/docs/"* "$worktree/"

pushd "$worktree" >/dev/null
git add -A
if git diff --cached --quiet; then
  echo "No changes to deploy."
  popd >/dev/null
  git worktree remove "$worktree" >/dev/null
  exit 0
fi
git commit -m "Manual Pages deploy $(date +'%Y-%m-%d %H:%M')" >/dev/null
git push "$remote" "$branch"
popd >/dev/null

git worktree remove "$worktree" >/dev/null
echo "Manual Pages deploy pushed to $remote/$branch."
