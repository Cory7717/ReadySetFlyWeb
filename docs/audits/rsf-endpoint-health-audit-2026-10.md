# Ready Set Fly endpoint, integration, and dependency health audit

**Audit date:** 2026-10-12  
**Scope:** web, mobile, Node/TypeScript API, workers, scheduled jobs, aviation providers, authentication, payments, communications, storage, maps, deployment-visible configuration, and runtime dependencies  
**Overall status:** **FAIL — production-readiness remediation is required**  
**Change posture:** audit only; no integration behavior, credentials, production settings, filings, payments, or provider choices were changed

## 1. Executive summary

The audit registered **52 externally hosted services, endpoint groups, or environment-driven integrations**. The machine-readable register classifies them as:

| Status | Count |
|---|---:|
| HEALTHY | 18 |
| WARNING | 19 |
| CRITICAL | 3 |
| UNKNOWN | 11 |
| LEGACY | 1 |

The supported OurAirports host introduced by the runway-briefing repair is operating correctly. RSF's public site, API health endpoint, AviationWeather METAR endpoint, FAA official TFR WFS, FAA SUA WFS, OurAirports runway feed, runway briefing, airport search, NOTAM response, USGS elevation service, RainViewer manifest, and both Leidos WSDLs responded successfully during read-only checks.

The audit nevertheless fails production readiness for three reasons:

1. The production obstacle integration is currently broken. `server/routes.ts:922-925` requests `DDOF_CSV.zip`, which is HTTP 404. The FAA currently publishes `DAILY_DOF_CSV.ZIP`; an RSF production nearby-obstacles request returned a gateway error.
2. Two hardcoded TFR ArcGIS fallbacks are broken: the `services1.arcgis.com` service returns an ArcGIS `Invalid URL` error inside HTTP 200, while `gis.faa.gov` does not resolve. The official FAA TFR WFS is healthy, so this is degraded redundancy rather than a current TFR outage.
3. The runtime security posture is not supportable without remediation: Node 20 is EOL, no Node engine is pinned, and runtime audits report 44 web/server vulnerabilities (4 critical) and 63 mobile vulnerabilities (2 critical). No packages were upgraded in this audit.

The audit found no tracked production credential matching common private-key/API-key patterns. Local untracked environment files were not printed or copied.

## 2. Method and evidence boundaries

The repository was searched for HTTP calls, WebSockets, SDK setup, hardcoded hosts, environment-supplied URLs, workers, scheduled tasks, callbacks, storage, database connections, CDNs, and integration-facing packages. Read-only checks used ordinary certificate validation; no TLS bypass was used.

Live checks included DNS, TLS handshake/hostname validation, certificate dates, redirect destination, representative HTTP status, response type, and—in selected cases—schema/source metadata. HTTP 200 was not considered sufficient when the body contained a provider error.

The live Render dashboard, Cloudflare dashboard, provider dashboards, secret values, production database URL, Redis URL, SWIM/NMS credentials, OAuth console, payment dashboards, app-store consoles, and RevenueCat dashboard were not accessible. Those items remain `UNKNOWN` rather than being inferred healthy.

No Firebase SDK or Cloud Function implementation was found. A Firebase service-worker path is merely exempted by canonical-host middleware. Stripe appears only in a backup/inactive storage file; no active Stripe SDK or route was found.

## 3. Critical findings

### C1 — FAA obstacle download is broken now

- **Evidence:** `server/routes.ts:922-925` defaults to `https://aeronav.faa.gov/Obst_Data/DDOF_CSV.zip`; that URL returned HTTP 404. The official directory currently exposes `DAILY_DOF_CSV.ZIP`, which returned HTTP 200 and a valid ZIP response. The production `/api/aviation/obstacles/nearby` check returned HTTP 502/gateway content.
- **Affected feature:** nearby obstacles and any route/terrain presentation using this dataset (`server/routes.ts:1101-1228`, `server/routes.ts:22027-22079`).
- **Failure mode:** the only cache is process memory for 12 hours. A cold start or expired cache cannot refresh and has no durable last-known-good dataset.
- **Operational impact:** obstacle data is unavailable. The application must not imply that an empty or failed response proves obstacle clearance.
- **Recommended fix:** in a separately approved Priority 1 corrective pass, change only the official filename, validate archive/CSV schema and freshness before replacing good data, persist a last-known-good snapshot with age/provenance, and add a focused regression test.
- **Complexity:** SMALL for filename correction; MEDIUM for durable LKG/freshness.
- **Deployment required:** yes.
- **Dashboard action:** no.

Official evidence: [FAA Daily Digital Obstacle File](https://www.faa.gov/air_traffic/flight_info/aeronav/digital_products/DailyDOF/) and [current FAA obstacle directory](https://aeronav.faa.gov/Obst_Data/).

### C2 — TFR ArcGIS redundancy has two invalid endpoints

- **Evidence:** `server/routes.ts:3515-3520` contains two casing variants of a `services1.arcgis.com` endpoint and a `gis.faa.gov` endpoint. The first returned HTTP 200 with provider error `code: 400, message: Invalid URL`; the latter failed DNS with `ENOTFOUND`. The same dead FAA GIS endpoint exists in `workers/rsf-tfr-proxy/src/index.js:18`.
- **Affected feature:** fallback TFR geometry retrieval only.
- **Current impact:** limited because `server/routes.ts:23505-23518` uses the official FAA TFR WFS first. Production `/api/tfrs?...&debug=1` reported `source=faa-tfr-wfs`, `stale=false`.
- **Recommended fix:** locate a current documented FAA/ArcGIS service before replacing anything; otherwise remove dead fallbacks while preserving official WFS, SUA WFS, NOTAM, and bounded stale behavior.
- **Complexity:** SMALL after provider validation.
- **Deployment required:** yes.
- **Dashboard action:** verify whether the optional Cloudflare worker is deployed and referenced.

### C3 — Unsupported runtime and critical dependency advisories

- **Evidence:** root `package.json` has no `engines.node`; the local validation runtime is Node `20.19.4`. Node 20 reached EOL on **2026-03-24** and no longer receives security fixes. `npm audit --omit=dev` reports **44** web/server runtime issues (4 critical, 21 high) and **63** mobile runtime issues (2 critical, 37 high).
- **Direct web/server high/critical packages:** `fast-xml-parser` (critical), `maplibre-gl` (critical), `adm-zip`, `drizzle-orm`, `multer`, `postcss`, `tailwindcss`, `tailwindcss-animate`, and `ws`.
- **Direct mobile high packages:** `axios`, `expo`, and `react-native`; critical findings are transitive.
- **Impact:** known exploitable dependency paths may remain in production, and the runtime receives no new fixes.
- **Recommended fix:** pin a supported Node line in package/deployment configuration and conduct staged, package-by-package upgrades with web, aviation, WebSocket, upload, map, and mobile regression suites. Do not accept audit-generated major upgrades blindly.
- **Complexity:** MEDIUM/LARGE.
- **Deployment required:** yes.
- **Dashboard action:** update Render runtime after application certification.

Official evidence: [Node.js EOL policy and dates](https://nodejs.org/en/about/eol), [Node.js release status](https://nodejs.org/en/about/previous-releases), and [Expo SDK 54 reference](https://docs.expo.dev/versions/v54.0.0/). Expo 54's documented React Native 0.81/Node 20.19 baseline matches the repository, but Node 20 is now EOL; a coordinated Expo/Node migration is required.

## 4. High and medium findings

| Priority | Finding | Evidence | Consequence | Recommended action |
|---|---|---|---|---|
| HIGH | SWIM can disable certificate validation | `server/notam-worker.ts:1362,1430` maps `SWIM_TLS_INSECURE=true` to `sslValidateCertificate=false` | A bad production value defeats TLS verification | Verify production is false and reject insecure mode in production startup |
| HIGH | d-TPP currency depends on manual environment state | `server/routes.ts:6245-6280` requires `FAA_DTPP_CYCLE` or explicit URLs | Plates can fail at cycle turnover or silently reference the wrong cycle | Automate/validate the 28-day cycle and alert before rollover |
| HIGH | Turnstile fails open if secret is absent | `server/unified-auth-routes.ts:22-35` returns `true` when no secret is configured | Registration abuse protection can silently disappear | Production startup/config guard; safe health signal; bounded request timeout |
| HIGH | NMS defaults to staging | `server/nms-notam-worker.ts:17-20` | Enabling NMS without explicit production URLs uses staging | Require explicit environment/base URL when enabled |
| HIGH | Airport/frequency/navaid caches are memory-only and calls lack explicit timeout | `server/routes.ts:3337-3380` | Restart plus upstream failure removes otherwise usable reference data | Timeouts, validation, durable LKG, and visible age/provenance |
| HIGH | NASR PJA/MAA refresh has no timeout/retry/durable cache | `server/services/nasrActivityAreas.ts:174-223` | Cycle-page/parser/provider changes can remove activity areas after restart | Add bounded timeout and preserve validated previous cycle with age warning |
| HIGH | PayPal and Brevo direct calls lack explicit timeouts | `server/paypal-client.ts:13-38`; `server/resendClient.ts:51-81` | Hung providers consume request capacity and obscure failure boundaries | Add bounded AbortSignal handling and safe retry/idempotency policy |
| HIGH | PayPal Payouts Node SDK support is doubtful | `server/paypal-payouts.ts`; `@paypal/payouts-sdk@1.1.0` | Future breakage/security drift | Confirm support with PayPal and plan tested migration; current official SDK page lists Java/Python |
| HIGH | Esri VFR tile authority/currency is undocumented | `mobile/src/components/flight-deck/flightDeckMapTiles.ts:17` | Chart-like imagery could look current while stale/unlicensed | Verify owner, licensing, edition/cycle, and display freshness |
| MEDIUM | Configuration documentation is incomplete | 270 distinct env names were referenced across scanned source/scripts; `.env.example` lists 24 and no env template is tracked | Configuration drift and accidental insecure defaults | Add a sanitized, categorized production configuration contract |
| MEDIUM | Several optional map/CDN layers lack health/freshness visibility | client/mobile map components | Quiet layer loss or stale imagery | Treat as optional and collect coarse layer-load/freshness telemetry |
| MEDIUM | Push/email paths lack durable delivery queues | Expo sends in `server/routes.ts`; Brevo direct fetch | Transient provider outage loses notifications | Queue/retry with deduplication and receipt/error processing |

PayPal references: [Payouts SDK documentation](https://developer.paypal.com/sdk/payouts), [PayPal server SDK transition guidance](https://developer.paypal.com/community/blog/navigating-paypal-server-sdks/), and [server SDK deprecation policy](https://developer.paypal.com/braintree/docs/reference/general/server-sdk-deprecation-policy).

## 5. Upcoming expirations and lifecycle watch

Provider-controlled certificates are listed for visibility, not as RSF renewal obligations. RSF/custom-domain renewal ownership must be confirmed in Cloudflare/Render.

| Window | Host/service | Verified expiry | Ownership/action |
|---|---|---:|---|
| under 30 days | `davidmegginson.github.io` | 2026-10-31 | Provider-controlled; watch because runway/airport/navaid feeds depend on it |
| 30–45 days | `challenges.cloudflare.com` | 2026-11-12 | Provider-controlled |
| 30–45 days | `ffspelabs.leidos.com` | 2026-11-16 | Provider-controlled; certification-critical |
| 30–45 days | `api.adsbexchange.com` | 2026-11-17 | Provider-controlled |
| 30–45 days | `exp.host` | 2026-11-19 | Provider-controlled |
| 30–45 days | `coast.noaa.gov` | 2026-11-21 | Provider-controlled |
| 46–60 days | `api.openai.com` | 2026-12-04 | Provider-controlled/default host only |
| 46–60 days | RainViewer hosts | 2026-12-07 | Provider-controlled |
| 46–60 days | `places.googleapis.com` | 2026-12-11 | Provider-controlled |
| 61–90 days | OpenStreetMap tiles | 2026-12-12 | Provider-controlled |
| 61–90 days | `overpass-api.de` | 2026-12-18 | Provider-controlled |
| 61–90 days | `readysetfly-api.onrender.com` | 2026-12-20 | Render-managed; verify account/service health |
| 61–90 days | `readysetfly.us` | 2026-12-23 | RSF/Cloudflare-controlled; alert at 30/14/7 |
| 61–90 days | `api.readysetfly.us` | 2026-12-23 | RSF/Cloudflare-controlled; alert at 30/14/7 |
| 61–90 days | `api.brevo.com` | 2026-12-25 | Provider-controlled |

Other lifecycle risks:

- FAA NASR data advances on a 28-day cycle; parser and dataset freshness need explicit validation. FAA published format changes effective September 2026, so parsed column compatibility deserves a focused fixture test. See [FAA safety and data-product notices](https://www.faa.gov/air_traffic/flight_info/aeronav/safety_alerts/).
- d-TPP is also cycle-bound; production environment values were not visible.
- AviationWeather's supported `/api/data` endpoints are used. The old `/cgi-bin` interface was retired in the 2025 redesign; no active RSF dependency on that old interface was found. See [AviationWeather upcoming/API changes](https://testbed.aviationweather.gov/help/upcoming/).
- OAuth, PayPal, Brevo, RevenueCat, app-store, ADSBExchange, AirNav, Google Places, OpenAI, database, Redis, S3, and SWIM credential expiration/rotation cannot be determined from source.

## 6. Aviation provider health

### Healthy primary paths

- **Runway reference:** supported `davidmegginson.github.io/ourairports-data/runways.csv` returned HTTP 200. `server/services/runway-reference-cache.ts` enforces a 15-second timeout, 24-hour fresh interval, five-minute retry suppression, and up to seven-day stale LKG with provenance. Mobile/web consumers expose stale/unavailable warnings rather than certifying stale data as current.
- **Weather:** AviationWeather Data API returned a current KAUS METAR response. Service calls generally use six-to-eight-second timeouts; caches vary by route.
- **TFR:** official FAA WFS is currently healthy and is first in the source order. Cache policy is one hour for populated data, five minutes for empty responses, and default maximum stale age of 12 hours (`server/routes.ts:3416-3423`).
- **NOTAM:** production `/api/notams?icao=KAUS` returned HTTP 200 with source `swim_jms`. This confirms serving health, not the age/credential state of the worker.
- **Terrain:** USGS EPQS sample response succeeded; point cache is six hours and profile cache ten minutes.
- **Leidos:** lab and production WSDL retrieval both returned 200. Their hashes differ, so baselines must remain environment-specific. No filing was submitted.

### Degraded or fragile paths

- Obstacle refresh is broken (C1).
- TFR ArcGIS redundancy is broken, though the primary source works (C2).
- NASR PJA/MAA, OurAirports airports/frequencies/navaids, and AviationWeather station-cache fetches are process-memory dependent and not all have explicit timeouts.
- d-TPP freshness depends on manual cycle configuration.
- Esri VFR tiles, Iowa radar, RainViewer, NASA GIBS, NOAA nowCOAST, USGS tiles, Overpass, and OpenStreetMap are presentation layers, not authoritative sources for flight decisions. Their failure must remain nonblocking.
- The runway cache is informational and is not a source of truth for runway suitability, aircraft performance, navigation, or active-flight calculations.

No evidence was found that unavailable reference data is deliberately substituted into Flight Data Engine calculations. The more important risk is stale or missing presentation/reference data without uniform age reporting across older integrations.

## 7. Business integration health

- **Authentication:** Google OAuth callback/origin construction is centralized in `server/oauthSessionAuth.ts` and the recent canonical-host/CORS correction remains intact. Live OAuth was not exercised. Session storage depends on Postgres. No active Firebase authentication implementation was found.
- **Abuse prevention:** Turnstile is present but missing-secret behavior is unsafe for production.
- **Payments:** PayPal production/sandbox TLS is healthy. No transaction or webhook mutation was performed. REST calls lack explicit timeouts; Payouts SDK support needs confirmation. RevenueCat and store mappings require dashboard verification.
- **Communications:** Brevo, Expo Push, and RSF WebSocket code are active. Brevo/Expo do not expose a single durable queue/receipt pipeline in the inspected paths.
- **Hotel tools:** Google Places and OpenAI integrations are environment-keyed. Their default hosts have valid TLS, but no authenticated calls were made. Failures should remain scoped to enrichment/parsing features rather than core Courtyard records.
- **Storage/database:** public S3 TLS is valid. Neon, Redis, private S3 IAM, object-storage backend, backups, rotation, and quotas require provider/dashboard inspection.
- **Analytics/CDNs:** GA4/Tag Manager/Meta Pixel and several frontend CDNs were found. They are noncritical and must not block application rendering.

## 8. Render and configuration findings

- No repository-visible `render.yaml` or equivalent complete Render service manifest was found. Build/start commands, health-check configuration, worker topology, cron schedules, runtime selection, and environment groups therefore cannot be fully reconciled from source.
- `server/index.ts:50-71` provides `/healthz` and `/api/healthz`; both public API and Render-origin health checks returned HTTP 200.
- `server/index.ts:147-150` sets 30-second server request timeout. Individual outbound integrations are inconsistent and can exceed or omit bounded deadlines.
- The API starts optional SWIM/NMS processes based on environment flags (`server/index.ts:175+`); without a tracked environment contract, API/worker responsibility can drift.
- API-only Render origins are correctly treated as non-browser origins; no recommendation expands CORS.
- `NMS_BASE_URL` and `NMS_AUTH_URL` default to staging. Production enablement must require explicit values.
- `.env.example` is untracked and covers only a small subset of the repository's environment surface. Secret values were not inspected or reported.

## 9. Single points of failure

1. **Postgres/Neon:** primary state, sessions, and many operational features; backup/PITR/failover unknown.
2. **Official FAA TFR WFS:** current primary is healthy, but both ArcGIS redundancies are broken.
3. **OurAirports GitHub Pages feed:** runway resilience is good in-process; other airport datasets have weaker cache behavior and all depend on the same host.
4. **FAA d-TPP cycle setting:** a single stale/missing value can break plate metadata at rollover.
5. **FAA Daily DOF filename:** a provider filename change fully broke obstacles.
6. **Leidos:** no substitute is appropriate for certified flight-service operations; contract monitoring is essential.
7. **SWIM/JMS credentials and URL:** worker health is opaque without dashboard and freshness checks.
8. **PayPal/RevenueCat/store dashboards:** membership and payout flows depend on external product/credential/webhook configuration.
9. **Process-memory caches:** a restart can remove the only last-known-good data for several providers.

## 10. Prioritized correction sequence

1. **P0 — obstacle service restoration:** approve the narrow official filename correction, add archive/schema/freshness validation and a regression test. Then add durable LKG. Deployment required.
2. **P0 — security/runtime plan:** pin and migrate from EOL Node 20; triage critical/high runtime advisories by reachable production path. Staged deployment required.
3. **P1 — TLS safety:** verify `SWIM_TLS_INSECURE=false` and make insecure SWIM startup impossible in production. Dashboard plus deployment action.
4. **P1 — TFR redundancy:** validate current provider-documented ArcGIS source or remove dead entries while preserving official WFS/NOTAM/stale behavior. Deployment required.
5. **P1 — cycle freshness:** add d-TPP and NASR cycle/date alerts and fixture tests. Deployment required.
6. **P1 — authentication/payment dashboard review:** Google callbacks, Turnstile secret, PayPal webhooks/credentials, RevenueCat products/webhook, app-store products, session/JWT secrets. Mostly dashboard action; Turnstile guard requires deployment.
7. **P2 — consistent outbound reliability:** timeouts, bounded retry rules, durable LKG, and structured provider metrics for airport reference, NASR, PayPal, Brevo, Google Places, Expo Push, and AirNav.
8. **P2 — tracked configuration contract:** sanitized required/optional variables, environment owner, default, validation, and rotation responsibility.
9. **P3 — optional maps/CDNs:** document authority/licensing/currency and ensure graceful degradation.

## 11. Proposed monitoring system

Use one small scheduled health-check job, preferably a Render cron service running the same supported Node runtime as the API. Store only coarse results—provider key, check time, status, latency, certificate expiry, data timestamp/age, response-schema result, and sanitized error class—in Postgres. Do not store tokens, cookies, headers, credential-bearing URLs, complete provider payloads, or personal information.

Recommended cadence:

- **Every 5 minutes:** RSF `/healthz`, API health, worker/data freshness summaries; alert only after 3 consecutive failures.
- **Every 15 minutes:** critical provider metadata checks for FAA TFR WFS, NOTAM ingestion age, AWC, Leidos reachability, and payment/email edge health where a non-mutating endpoint exists.
- **Hourly:** OurAirports/FAA reference feed HEAD or small validation, obstacle archive existence, TFR fallback state, database/Redis connectivity metrics.
- **Daily:** TLS/DNS/redirect audit, package/provider lifecycle register, d-TPP/NASR cycle-age check.
- **Certificates:** page at 30/14/7 days only for RSF-controlled domains; provider certificates generate an owner-tagged warning and dependency watch, not an RSF renewal ticket.
- **Data freshness:** provider-specific thresholds and explicit `fresh`, `stale`, `unavailable`, and `invalid` states. Never count HTTP 200 with an error body or old timestamp as healthy.
- **Alert routing:** critical aviation/auth/payment failures to operations immediately after confirmation; optional tiles/analytics as daily digest. Resolve alerts after two consecutive successes to avoid flapping.

The existing API can expose a sanitized internal health summary, but public endpoints must not reveal configured provider hosts, credential presence details, account identifiers, or internal exception payloads.

## 12. Verification performed and gaps

### Completed

- Repository endpoint/SDK/environment inventory.
- 52-row CSV schema validation (20 required columns per row).
- DNS/TLS checks with certificate validation enabled.
- Representative non-mutating HTTP checks.
- RSF public/API/Render health checks.
- Production runway/search/NOTAM/TFR read checks.
- FAA current obstacle filename verification.
- Leidos lab and production WSDL retrieval and SHA-256 evidence generation.
- Root and mobile runtime dependency audits.
- Tracked-source common secret-pattern scan: no matches.
- Root TypeScript check: `npm run check` — **passed**.
- Mobile TypeScript check: `npx tsc --noEmit -p tsconfig.json` from `mobile/` — **passed**.
- Focused aviation/route/TFMS/mobile-provenance tests — **36 passed, 0 failed**.
- Production build: `npm run build` — **exit 0**. Vite reported the existing large-chunk/PostCSS warnings; the Cesium copy helper also logged an invalid intermediate Windows path before completing its intended copies and allowing the server/worker bundles to finish. This warrants a separate build-script cleanup but did not fail this build.
- `git diff --check` — **passed**.

### Not verified

- Live Render service/environment/cron/worker configuration and actual Node runtime.
- Cloudflare DNS/certificate auto-renew, worker deployment, firewall, and Turnstile dashboard.
- Google OAuth console and production login flow.
- PayPal credentials, webhook registrations, plan IDs, and payout execution.
- RevenueCat/App Store/Google Play product and webhook configuration.
- SWIM, NMS, ADSBExchange, AirNav, Google Places, OpenAI, Redis, Neon, S3 IAM, Cesium, Brevo, and Expo account/credential expiry and quotas.
- Authenticated WebSocket exchange.
- Mobile store builds and physical-device behavior.
- Any real filing, payment, payout, email, or push send (intentionally prohibited).

## 13. Deliverables and source changes

- Human-readable report: `docs/audits/rsf-endpoint-health-audit-2026-10.md`
- Machine-readable register: `docs/audits/rsf-endpoint-health-audit-2026-10.csv`
- Read-only Leidos evidence: `certification-results/leidos-wsdl/leidos-wsdl-2026-10-12T15-51-08-922Z.json`

No application source code or production configuration was changed. The two audit documents and generated Leidos evidence are the only audit artifacts.

## Final assessment

**FAIL** for production-readiness, not because the RSF platform is broadly offline, but because one active aviation integration is demonstrably broken, fallback redundancy contains dead endpoints, and the deployed runtime/dependency lifecycle includes confirmed critical security exposure. Core web/API, runway briefing, weather, NOTAM serving, TFR primary, terrain, and Leidos WSDL paths were healthy at the time of verification.
