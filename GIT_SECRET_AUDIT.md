# RSF Git Secret Audit

Date: 2026-05-08

Scope: Local-only historical scan of the Ready Set Fly git repository, including all local branches and remote refs visible in this clone. No external systems were contacted except local git commands. No full secret values are included in this report.

## Summary

High-confidence historical secret scan result: no confirmed API keys, private keys, live payment keys, database URLs, OAuth tokens, Slack/GitHub tokens, OpenAI keys, Google/Firebase API keys, or AWS access keys were found in scanned git history.

Current frontend bundle/source-map scan result: no high-confidence secret values were found in current `dist`, `docs/assets`, client, mobile, server, shared, or root text files scanned with the same high-confidence patterns.

Source-map exposure result: no `.map` files were found under current `dist` or `docs/assets`.

Important repository hygiene note: `server.log` and `server.err` are currently tracked in git from commit `a22b6e1`. The high-confidence secret scan did not find matching secret patterns in those two files, but logs should not be tracked because they can later capture sensitive operational data.

## Historical Secret Findings

| Suspected secret type | File path | Commit hash | Still active/current | Rotation priority | Notes |
|---|---|---:|---|---|---|
| None confirmed | N/A | N/A | N/A | N/A | High-confidence pattern scan found no confirmed secret values. |

Patterns scanned included:

- AWS access keys
- private key material
- database URLs and passwords in URI form
- OpenAI API keys
- Stripe live publishable/secret keys
- Google/Firebase API keys
- Slack tokens
- GitHub tokens
- common payment/OAuth/provider secret value formats

## Repository Hygiene Findings

| Finding | File path | Commit hash | Still active/current | Rotation priority | Recommendation |
|---|---|---:|---|---|---|
| Tracked local log file | `server.log` | `a22b6e1` | Yes | Low, unless logs ever contained real secrets | Stop tracking this file in a separate cleanup commit after confirming it is not needed. |
| Tracked local error log file | `server.err` | `a22b6e1` | Yes | Low, unless logs ever contained real secrets | Stop tracking this file in a separate cleanup commit after confirming it is not needed. |

No high-confidence secret patterns were found in `server.log` or `server.err` during this audit.

## `.gitignore` Verification

Verified ignore coverage after update:

| Path example | Status |
|---|---|
| `.env` | Ignored |
| `.env.local` | Ignored |
| `.env.production` | Ignored |
| `backend/.env` | Ignored |
| `server.log` | Ignored for future untracked files |
| `server.err` | Ignored for future untracked files |
| `test.bak` | Ignored |
| `backup.old` | Ignored |
| `file.save` | Ignored |
| `swap.swp` | Ignored |
| `dump.sql` | Ignored |
| `archive.zip` | Ignored |
| `bundle.js.map` | Ignored |

Fix applied:

- Added ignore rules for backup/archive/source-map artifacts:
  - `*.zip`
  - `*.tar`
  - `*.gz`
  - `*.7z`
  - `*.bak`
  - `*.backup`
  - `*.old`
  - `*.save`
  - `*.swp`
  - `*.sql`
  - `*.map`

Note: ignore rules do not remove files already tracked by git. `server.log` and `server.err` remain tracked until explicitly removed from the index in a cleanup commit.

## Frontend Bundle and Source Map Verification

Current high-confidence scan of frontend/runtime artifacts found no secret values matching:

- AWS access key formats
- private key headers
- database URL formats
- OpenAI key formats
- Stripe live key formats
- Google/Firebase API key formats
- Slack token formats
- GitHub token formats

Source maps:

- No `.map` files were found in current `dist` or `docs/assets`.
- `.gitignore` now blocks future `.map` files from being accidentally committed.

## Commands Used

Representative local commands used:

```powershell
git rev-list --all
git log --all -G <secret-pattern> --name-only
git show <commit>:<path>
rg -n -I <secret-patterns> dist docs/assets client mobile server shared .
git log --all --name-status -- "*.env" ".env" ".env.*" "**/.env" "**/.env.*" "*.bak" "*.backup" "*.old" "*.save" "*.swp" "*.sql" "*.zip" "*.tar" "*.gz" "*.7z" "*.map"
git check-ignore -v --no-index <path>
git ls-files server.log server.err "*.map" "*.env" "*.env.*" "*.bak" "*.old" "*.save" "*.swp" "*.zip" "*.tar" "*.gz" "*.7z"
```

## Remaining Manual Actions

1. Remove tracked local logs in a dedicated cleanup commit if not needed:

   ```powershell
   git rm --cached server.log server.err
   ```

   Do this only after confirming those files are not intentionally required.

2. If there is any chance secrets were committed before this local clone’s available refs, run an external-grade scanner such as Gitleaks or TruffleHog on the full remote repository and all protected branches.

3. Rotate any production secret that was ever pasted into issue trackers, chat, CI logs, Render logs, local logs, or screenshots, even though this git scan did not find confirmed secret values.

4. Keep source maps disabled for public production artifacts unless intentionally published through a protected channel.

5. Consider adding a pre-commit or CI secret scanner using redacted output to prevent future commits containing `.env`, logs, backups, source maps, or token-shaped values.
