# Ready Set Fly Security Audit

Date: 2026-05-08

Scope: Local defensive review of the RSF repository for OWASP-style risks, Express production security practices, Leidos/provider safety, secrets exposure, public file exposure, access control, input validation, rate limiting, CORS, headers, logging safety, and dependency risk.

No external exploitation was performed. No secrets were printed or exfiltrated.

## Critical Findings

### JWT fallback secret in production

Risk: `server/jwt.ts` previously fell back to a hardcoded development secret if `JWT_SECRET` and `SESSION_SECRET` were absent. In production this could allow token forgery if the environment were misconfigured.

Fix applied:
- Production now fails fast unless `JWT_SECRET` or `SESSION_SECRET` is configured.
- Development still has a clearly labeled local-only fallback.

Files changed:
- `server/jwt.ts`

### Dependency audit shows critical/high advisories

Risk: `npm audit --audit-level=high --json` reported 29 total advisories, including critical advisories involving `fast-xml-parser` and `protobufjs`, and high advisories involving `drizzle-orm`, `axios`, `multer`, `lodash`, `path-to-regexp`, `rollup`, `minimatch`, and `picomatch`.

Fix applied:
- No broad dependency upgrades were applied in this pass to avoid breaking production behavior.

Recommended manual action:
- Prioritize safe upgrades for direct runtime dependencies: `fast-xml-parser`, `drizzle-orm`, `multer`, and any direct/mobile `axios` usage.
- Re-run the full app test suite after dependency updates.

## High Findings

### Marketplace listing delete lacked route-level authentication

Risk: `DELETE /api/marketplace/:id` was public at the route layer and deleted by ID after only checking whether the listing was an example listing.

Fix applied:
- Added `isAuthenticated`.
- Added owner/admin/super-admin authorization before deletion.

Files changed:
- `server/routes.ts`

### Message read mutation lacked authentication and ownership checks

Risk: `PATCH /api/messages/:id/read` was public and could mark arbitrary messages read by ID.

Fix applied:
- Added `isAuthenticated`.
- Added sender/receiver ownership validation before marking read.
- Added `storage.getMessageById`.

Files changed:
- `server/routes.ts`
- `server/storage.ts`

### Leidos webhook logging included full request body

Risk: The Leidos webhook handler logged the full webhook body. Provider webhook payloads can contain pilot, route, aircraft, status, or operational details.

Fix applied:
- Replaced full body logging with metadata-only logging: event, timestamp, user agent, notification type, flight identifier, and top-level payload keys.
- Webhook authorization remains enforced through configured Basic Auth.

Files changed:
- `server/routes.ts`

### Scanner/config probes could hit app fallback

Risk: Automated probes for `/.env`, `/.git/config`, nested `.env` files, backups, archives, source maps, and `phpinfo.php` should never receive the React fallback HTML.

Fix applied:
- Early scanner guard blocks suspicious paths before body parsing, API routes, static serving, and fallback.
- Structured logs use `event="blocked_scanner_probe"` and do not log headers or bodies.
- Repeated scanner probes from the same IP are rate limited.
- Added explicit coverage for `phpinfo.php` and source maps.

Files changed:
- `server/middleware/scannerGuard.ts`
- `server/index.ts`
- `scripts/tests/scanner-guard.test.ts`

## Medium Findings

### CORS allowed localhost origins in production defaults

Risk: Production CORS defaults included localhost development origins. With credentialed requests, this unnecessarily broadened trusted browser origins.

Fix applied:
- Production defaults now include only RSF web origins.
- Localhost origins are included only outside production or if explicitly configured by environment.

Files changed:
- `server/corsOptions.ts`

### Missing security headers

Risk: The Express app did not have a centralized production security header middleware.

Fix applied:
- Added headers equivalent to a conservative Helmet baseline:
  - `X-Content-Type-Options: nosniff`
  - `X-Frame-Options: DENY`
  - `Referrer-Policy: strict-origin-when-cross-origin`
  - `Permissions-Policy`
  - `Cross-Origin-Resource-Policy: same-site`
  - production `Strict-Transport-Security`

Files changed:
- `server/middleware/securityHeaders.ts`
- `server/index.ts`

### Missing rate limits on auth and provider-sensitive actions

Risk: Login, token refresh, flight filing preview, Leidos actions, and filing sync were not consistently rate limited.

Fix applied:
- Added rate limiting to web/mobile login and refresh routes.
- Added rate limiting to filing preview, route analysis, guest filing, filing action, and filing sync.

Files changed:
- `server/unified-auth-routes.ts`
- `server/mobile-auth-routes.ts`
- `server/routes.ts`

### Static serving needed explicit dotfile denial everywhere

Risk: Static middleware should explicitly deny dotfiles even when serving only controlled directories.

Fix applied:
- `express.static` now uses `dotfiles: "deny"` for production frontend assets, Cesium assets, and uploads.
- Static serving remains limited to the built frontend/public directory and uploads path, not the repository root.

Files changed:
- `server/vite.ts`
- `server/routes.ts`

## Low Findings

### Secret scan findings were mostly references/placeholders

Observation: Local pattern scans found environment variable names, placeholder config, workflow references to GitHub secrets, and code references to secret-bearing env vars. No real secret value is included in this report.

Recommended manual action:
- Review `.github/workflows/deploy.yml`, Render environment variables, mobile build config, and any historical git commits for accidental real secret exposure.
- Rotate any secret that was ever committed or pasted into logs.

### Local logs and generated files exist in the workspace

Observation: `server.log`, `server.err`, generated docs/assets, and local analysis files are present in the workspace. `.gitignore` ignores logs and env files, but generated artifacts should stay out of production static hosting unless intended.

Recommended manual action:
- Confirm deployment build context does not publish local logs or analysis artifacts.
- Keep `docs/assets` only for GitHub Pages/docs use, not API/static runtime.

### Cron endpoints use shared secret headers

Observation: Cron endpoints require `x-cron-secret` and fall back to `SESSION_SECRET` if `CRON_SECRET` is not set.

Recommended manual action:
- Configure a dedicated high-entropy `CRON_SECRET` in production instead of relying on `SESSION_SECRET`.

## Leidos/Provider Security Verification

Verified:
- `/api/flight-plans/:id/filing-action` requires `isAuthenticated`.
- `/api/flight-plans/:id/filing-sync` requires `isAuthenticated`.
- `/api/flight-plans/route-search` requires `isAuthenticated`.
- `/api/leidos/webhooks/flight-service` requires configured webhook Basic Auth through `verifyLeidosWebhookAuthorization`.
- `guest-file` always returns `401` with the RSF account prompt.

Additional hardening applied:
- Provider action and sync routes now have a focused rate limiter.
- Webhook logging no longer records the full request body.

## Files Changed

- `server/middleware/scannerGuard.ts`
- `server/middleware/securityHeaders.ts`
- `server/index.ts`
- `server/vite.ts`
- `server/routes.ts`
- `server/storage.ts`
- `server/corsOptions.ts`
- `server/jwt.ts`
- `server/unified-auth-routes.ts`
- `server/mobile-auth-routes.ts`
- `scripts/tests/scanner-guard.test.ts`
- `SECURITY_AUDIT_RSF.md`

Note: The working tree also contains earlier Leidos/mobile planner changes from the previous task.

## Verification Performed

Commands run:

```powershell
npm run check
npx tsx --test scripts/tests/scanner-guard.test.ts
npm audit --audit-level=high --json
```

Results:
- TypeScript check passed.
- Scanner guard tests passed.
- Dependency audit completed and reported remaining advisories.

## Verification Checklist

- `GET /.env` returns plain `404` or `403`, not React fallback HTML.
- `GET /.git/config` returns plain `404` or `403`, not React fallback HTML.
- `GET /backend/.env` returns plain `404` or `403`, not React fallback HTML.
- `GET /phpinfo.php` returns plain `404` or `403`, not React fallback HTML.
- `GET /assets/app.js.map` returns plain `404` or `403`.
- `GET /api/healthz` still returns `200`.
- Unauthenticated `POST /api/flight-plans/:id/filing-action` returns `401`.
- Unauthenticated `POST /api/flight-plans/:id/filing-sync` returns `401`.
- Unauthorized `DELETE /api/marketplace/:id` returns `401` or `403`.
- Unauthorized `PATCH /api/messages/:id/read` returns `401` or `403`.
- Scanner attempts produce structured `blocked_scanner_probe` logs without request bodies or sensitive headers.

## Remaining Recommended Manual Actions

- Upgrade vulnerable dependencies in a dedicated branch and run regression tests.
- Rotate secrets if there is any chance they were historically committed or logged.
- Configure dedicated production secrets for `JWT_SECRET`, `SESSION_SECRET`, `CRON_SECRET`, Leidos webhook credentials, PayPal, Google OAuth, Resend, S3, SWIM/NMS, and database access.
- Review historical git history with a dedicated secret scanner before publishing or sharing the repository.
- Consider replacing the custom security header middleware with `helmet` later if dependency policy allows.
- Consider moving the large `server/routes.ts` into smaller route modules so future security reviews can be more systematic and less error-prone.
