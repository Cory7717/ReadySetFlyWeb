# Leidos Documentation Compliance Audit

Audit date: 2026-07-20
Repository: ReadySetFlyWeb / ReadySetFly
Audited local commit: `0272bd8511e55b6ae02af8bf43b17246a9f36b9f`
Scope: RSF Flight Service integration against current Leidos WSDL, validation catalog, and checked-in RSF code.

## Executive Recommendation

Recommendation: NO-GO for Leidos production approval until the FAIL items below are remediated and revalidated.

RSF is close on the core lifecycle workflow. The main FILE, AMEND, ACTIVATE, CLOSE, CANCEL, RETRIEVE, LAB gating, webhook authentication, lifecycle merge, versionStamp, route normalization, ZZZZ, Field 18, and local validation surfaces are implemented with meaningful defenses and tests. The current blockers are narrower:

1. Route Assist uses `SYSTEM_RECOMMENDED` without a required `searchPathOption` at or above 18,000 feet.
2. Leidos endpoint overrides are not HTTPS-fail-closed.
3. Stored `filingRaw` and action history still retain unrestricted provider response objects that may contain provider-echoed personal or operational payload fields.

The exact final extended live-LAB evidence package was not found as a committed local artifact in this workspace. The local non-live gate is green per prior validation, and `npm run flight-service:wsdl-check` passed during this audit, but production approval should reference a clean evidence bundle generated from the deployment candidate after the FAIL items are fixed.

## Documentation Snapshot

Fresh Leidos documentation was fetched on 2026-07-20.

| Document | URL | HTTP | SHA256 |
|---|---:|---:|---|
| LAB WSDL | `https://ffspelabs.leidos.com/Website2/resources/doc/WebService.xml` | 200 | `1adb3b5b1c25124ac7e868db09700d121164f898d68bac0bd7645cc34ae57c4b` |
| Production WSDL | `https://www.1800wxbrief.com/Website/resources/doc/WebService.xml` | 200 | `1adb3b5b1c25124ac7e868db09700d121164f898d68bac0bd7645cc34ae57c4b` |
| Validation catalog | `https://ffspelabs.leidos.com/Website2/resources/doc/validation_en_US.properties` | 200 | `f0c4081f38c0ff3616a04ad38a1cf338f7458ddf59e9f44ce3d921cc03819e28` |
| WSDL viewer stylesheet | `https://ffspelabs.leidos.com/Website2/resources/doc/wsdl-viewer.xsl` | 200 | `8c6a959e059558c8c5e9cd648094334f949fa61f00d4cd9f78b6b6c2b9747dfb` |

LAB and production WSDL files are byte-identical for this snapshot.

## WSDL Inventory

The WSDL exposes 67 operations:

`AcknowledgeAlert`, `AcknowledgeMobileAnnouncement`, `ActivateFlightPlan`, `AmendFlightPlan`, `AmendPilotProfile`, `AmendUasOperatingArea`, `ApplicationContext`, `AreaBriefing`, `CancelFlightPlan`, `CancelUasOperatingArea`, `ChangePassword`, `ChangeUserName`, `CloseFlightPlan`, `CreateAccount`, `CreateAccountWithExistingPilotProfileUsingEmail`, `CreateAccountWithExistingPilotProfileUsingPilotInfo`, `CreatePilotProfile`, `DeleteFavoriteFlightPlan`, `EvaluateDepartureTime`, `FileFlightPlan`, `FileUasOperatingArea`, `FlightInfo`, `LastMinuteCheck`, `LookupAircraftType`, `LookupNavAid`, `NavLog`, `OptimizeAltitude`, `PilotHistoryCountQuery`, `PilotHistoryEvents`, `PilotHistoryRetrieveEvent`, `PublishNotification`, `ResetPassword`, `RetrieveAdvancedServices`, `RetrieveAFD`, `RetrieveAircraftProfiles`, `RetrieveAlertByFlightId`, `RetrieveAlertByRoute`, `RetrieveAlertNotices`, `RetrieveFaaAirportId`, `RetrieveFavoriteFlightPlans`, `RetrieveFlightPlan`, `RetrieveFlightPlanSummaries`, `RetrieveMETAR`, `RetrievePilotProfile`, `RetrievePreferences`, `RetrieveRecentFlightPlans`, `RetrieveSidsOrStars`, `RetrieveTAF`, `RetrieveTemporaryFlightRestrictions`, `RetrieveUasOperatingArea`, `RetrieveUasOperatingAreaSummaries`, `RouteBriefing`, `RouteSearch`, `SaveAdvancedServices`, `SaveAircraftProfiles`, `SaveFavoriteFlightPlan`, `SavePreferences`, `SendTestMessage`, `SubmitPirep`, `SubmitPositionReport`, `ValidateOtherInfo`, `WebServicePushFlightChange`, `WebServicePushNGBAlert`, `WebServicePushUOAChange`, `WebServicePushUOANotamSubmission`, `WebServicePushWxChange`, `WebsiteWeather`.

RSF intentionally implements the flight-plan filing subset, route assistance, selected lookup/support functions, and provider push notifications. UAS, pilot-profile management, preference management, account creation, mobile-only, and weather/briefing operations are currently out of RSF's Flight Service filing scope and are classified as NOT_APPLICABLE in the compliance matrix.

## Confirmed Findings

### LDOC-001 RouteSearch Request Mode

Classification: FAIL
Severity: High

Audit claim: `RouteSearchRequest` requires `searchPathOption` when `searchOption` is `SYSTEM_RECOMMENDED`.

Documentation evidence: The WSDL states that if Search Option is `SYSTEM_RECOMMENDED`, Search Path Option is required. The documented option/path pair for system-recommended routing is `SYSTEM_RECOMMENDED/LOW_ALTITUDE_ONLY`. The WSDL also documents separate high-altitude options `J_ROUTE` and `Q_ROUTE`.

Code evidence: `server/services/flight-plan-filing/provider.ts` always sets `searchOption` to `SYSTEM_RECOMMENDED`, but `selectLeidosRouteSearchPathOption()` returns `null` at or above 18,000 feet. `searchLeidosRoute()` only appends `searchPathOption` when the value is non-null.

Risk if ignored: High-altitude route-assist requests can be invalid or misleading. A user may see route-assist failures even though filing itself is unaffected.

Recommended action: Do not use `SYSTEM_RECOMMENDED` without `searchPathOption`. Either send the documented `SYSTEM_RECOMMENDED/LOW_ALTITUDE_ONLY` only for low-altitude requests, or select a documented high-altitude `searchOption` such as `J_ROUTE` or `Q_ROUTE` when RSF can safely infer it. If RSF cannot infer the provider route family, do not make a provider route-search call and present provider-neutral unavailable copy.

Suggested test coverage: Assert outbound RouteSearch query parameters for 9,000 feet, 17,999 feet, 18,000 feet, 23,000 feet, missing altitude, and oceanic routes. Assert provider `returnStatus=false` is represented as no route found, not a successful recommendation.

### LDOC-002 HTTPS Fail-Closed Endpoint Handling

Classification: FAIL
Severity: High

Audit claim: Leidos REST examples and provider credentials assume HTTPS transport.

Documentation evidence: The WSDL REST examples use HTTPS endpoints, and authentication is Basic Auth with vendor credentials in the Authorization header.

Code evidence: `normalizePath()` accepts absolute `http://` values, `LEIDOS_FLIGHT_SERVICE_REST_BASE_URL` can override the base URL, and `fetchLeidosUrl()` chooses the HTTP client when `url.protocol === "http:"`.

Risk if ignored: A misconfigured environment variable could send Basic Auth credentials and flight-plan data over cleartext HTTP or to a non-Leidos endpoint.

Recommended action: Fail closed before dispatch when any Leidos base URL, action path, retrieve path, or route-search URL resolves to non-HTTPS. Consider an explicit LAB-only localhost/test exception only inside mocked tests, never in deployed runtime.

Suggested test coverage: Unit tests for base URL/action path/retrieve path validation; regression test that `http://` overrides are rejected before provider dispatch and do not log credentials.

### LDOC-003 Stored Provider Response Privacy

Classification: FAIL
Severity: High

Audit claim: Raw provider request payloads and webhook payloads must not be stored, and provider diagnostics must not retain pilot PII, phone numbers, credentials, or supplemental personal data.

Documentation evidence: The WSDL and validation catalog show Flight Service payloads can contain pilot contact data, remarks, other information, and provider messages. These are operationally sensitive and should not be stored in raw diagnostic blobs.

Code evidence: Recent hardening removed `requestPayload` from `providerResult.raw`, and webhook notification metadata uses sanitized summaries. However, successful provider actions still store `raw.response` and `raw.metadataResponse` in `filingRaw` and `filingActionHistory`. Those objects are not allowlisted before persistence.

Risk if ignored: If Leidos echoes pilot, phone, remarks, supplemental pilot data, or full retrieve details, RSF may persist sensitive data in diagnostic fields beyond the operational fields needed for lifecycle management.

Recommended action: Replace stored `response` and `metadataResponse` with an allowlisted provider diagnostic structure: HTTP status, returnStatus, response message codes/text, providerPlanId, versionStamp, provider status/lifecycle, ARTCC state, route-changed flag, timestamps, and redacted key-path diagnostics. Keep full transient provider objects in memory only for immediate parsing.

Suggested test coverage: Assert `filingRaw`, `filingActionHistory`, provider notifications, and action-attempt results do not contain pilot name, phone, remarks, supplemental personal data, credentials, or unrestricted nested response objects.

### LDOC-004 Vendor/User `webUserName` Contract

Classification: LEIDOS_CONFIRMATION_REQUIRED
Severity: Medium

Audit claim: Vendor filing may require an end-user `webUserName`.

Documentation evidence: WSDL examples show `webUserName=pilot@example.com` in `/FP/file` form data and the authorization section describes vendors acting on behalf of end users. In the XML schema snippets reviewed, `webUserName` appears with `minOccurs="0"` in relevant request structures.

Code evidence: RSF stores `accountEmail` in Leidos config diagnostics, but `buildLeidosActionPayload()` does not append `webUserName` for FILE or AMEND. Prior instructions also explicitly said not to add credentialed filing or `webUserName` without confirmation.

Risk if ignored: If Leidos production requires end-user authorization, production filing may fail despite LAB vendor-account success.

Recommended action: Ask Leidos whether RSF should send `webUserName` for vendor-filed ICAO FILE/AMEND requests, what value is expected, and whether the end user must have authorized the vendor in 1800WXBrief.

Suggested test coverage if confirmed: Payload construction tests for `webUserName`, no PII logging, user-account authorization errors, and backward-compatible LAB gating.

### LDOC-005 AFF/Push Payload Schema Completeness

Classification: LEIDOS_CONFIRMATION_REQUIRED
Severity: Medium

Audit claim: Push payload parsing should be compared against authoritative XML/JSON payload schemas, not only observed LAB examples.

Documentation evidence: The WSDL includes push operations such as `WebServicePushFlightChange`, `WebServicePushNGBAlert`, `WebServicePushUOAChange`, `WebServicePushUOANotamSubmission`, and `WebServicePushWxChange`, but the current fetched WSDL does not provide enough examples to prove every nested flight-alert variant.

Code evidence: RSF has a broad recursive parser in `server/services/leidosWebhook.ts`, stable fingerprinting, exact-duplicate protection, no-op handling, ordering guards, and tests for observed lifecycle shapes. Some alternate provider message paths remain dependent on observed payloads.

Risk if ignored: A documented but unobserved push variant could be stored as a no-op or require provider review until parser support is added.

Recommended action: Request the current provider push sample set or schema from Leidos, including proposed, activated, closed, cancelled, ARTCC rogered, expected-route, expected-route absent, and no-op informational notifications.

Suggested test coverage: Add fixtures from Leidos sample payloads once received.

### LDOC-006 Certification Evidence Traceability

Classification: UNVERIFIED
Severity: Medium

Audit claim: The production-readiness claim should be tied to a final evidence package generated from the exact deployment candidate.

Documentation evidence: Not a WSDL requirement; this is certification governance.

Code evidence: The workspace contains older live-LAB artifacts and a fresh WSDL check artifact. The final extended live-LAB run evidence for the current deployment candidate was not independently located as a committed artifact during this audit.

Risk if ignored: Sean/Will or Leidos may review code that differs from the evidence baseline.

Recommended action: After fixing FAIL items, run the non-live release gate and the approved live-LAB evidence cycle from the deployed candidate, then attach JSON, HTML, logs, and summary artifacts to the certification package.

Suggested test coverage: `npm run check`, `npm run test:flight-service:release`, `npm run flight-service:wsdl-check`, and the approved live LAB command only when intentionally running provider evidence.

## Areas That Passed

### Authentication and Environment Gating

Classification: PASS_WITH_DEFENSE

RSF uses Basic Auth for Leidos REST calls and webhook authentication. LAB and production filing gates are fail-closed, and production operational filing remains disabled unless explicitly enabled. The system distinguishes LAB acknowledgement, tester access, operational filing, certification plans, background sync, and public production filing protections. This area becomes PASS after LDOC-002 enforces HTTPS for endpoint overrides.

### FILE, AMEND, ACTIVATE, CLOSE, CANCEL

Classification: PASS_WITH_DEFENSE

The core provider action path uses the documented `/FP/file`, `/FP/{flightIdentifier}/amend`, activation, close, and cancel flows. It appends `includeCodedMessages=true`, includes ICAO-required fields, uses versionStamp for non-terminal updates, treats terminal versionStamp absence as informational, and keeps server-side authorization authoritative.

Defenses present:

- Public mutation allowlist rejects provider-owned fields.
- Durable database-backed provider action attempts provide idempotency.
- Possible-dispatch failures become provider-outcome-unknown instead of staged.
- Retry while outcome is unknown is blocked.
- Reconciliation path uses provider retrieve when possible.

### RETRIEVE and Provider Snapshot Merge

Classification: PASS_WITH_DEFENSE

RSF calls `/FP/{providerPlanId}/retrieve` with `versionRequested=20240801`, extracts provider identifiers, versionStamp, lifecycle, ARTCC state, expected route, notices, and route-changed metadata, and merges snapshots without letting empty retrieve results erase known webhook lifecycle evidence.

### Lifecycle and UI Safety

Classification: PASS

IFR Activate and Close controls are hidden. VFR Activate and Close are state-gated. Cancel, Amend, Sync, Download, and provider review actions are conditionally rendered with disabled reasons. Action eligibility has been moved toward canonical UTC departure instants rather than browser-local display strings.

### Webhook Contract

Classification: PASS_WITH_DEFENSE

RSF verifies webhook Basic Auth, returns `{ success: "true" }`, computes stable deduplication fingerprints, ignores exact duplicates, persists canonical lifecycle before notifications/push delivery, avoids terminal regression, avoids lower-version overwrite, and avoids creating pending review for no-op webhooks. This remains PASS_WITH_DEFENSE until Leidos confirms the full push payload variant set in LDOC-005.

### Validation Catalog Alignment

Classification: PASS

The validation catalog confirms behavior RSF already enforces or has tests for:

- `FuelEndurance.lessThanETE`
- `AircraftEquipment.RMissing` for `PBN/`
- `OtherInfo.PbnMissing` when equipment contains `R`
- `AircraftEquipment.ZMissing` for NAV/COM/DAT
- duplicate flight detection
- IFR activation disallowed
- activation time within 30 minutes

### Route and Time Handling

Classification: PASS_WITH_DEFENSE

RSF uses departure-airport timezone metadata for provider departure instants, preserves route tokens for navaids and fixes, separates planning geometry from provider Item 15 normalization, preserves valid DCT behavior, supports ZZZZ planning-reference timezones, and tests airport timezones including KLAS, KPBI, KPHX, and KEDC.

This area remains PASS_WITH_DEFENSE until final live evidence confirms no regression in the deployed candidate.

## Not Applicable WSDL Areas

The following WSDL operation families are not part of RSF's current Flight Service filing scope:

- UAS filing and UAS push operations
- Leidos pilot profile creation/amendment
- Leidos account creation/password/username management
- Leidos favorite flight plans and preferences
- Leidos briefing/weather products outside RSF's independent weather/TFR systems
- mobile-only endpoints documented as internal use only
- PIREP and position report submission

These are marked NOT_APPLICABLE in the CSV matrix unless RSF later chooses to implement them.

## Verification Performed

- Fetched current LAB WSDL, production WSDL, validation catalog, and WSDL stylesheet.
- Parsed WSDL operation inventory.
- Ran `npm run flight-service:wsdl-check`; result: PASS.
- Inspected flight-service provider action, route assist, webhook, provider-review, lifecycle UI, migration, and release-gate scripts.
- Did not run any live LAB or production provider command.
- Did not change runtime code.

## Remediation Plan

Phase 1 before Leidos production approval:

1. Fix RouteSearch request construction so documented provider enums are used consistently.
2. Enforce HTTPS-only Leidos URLs before dispatch.
3. Sanitize persisted provider response diagnostics to an allowlist.
4. Re-run `npm run check`, `npm run test:flight-service:release`, and `npm run flight-service:wsdl-check`.

Phase 2 before Sean/Will final review:

1. Ask Leidos to confirm `webUserName` requirements.
2. Ask Leidos for full push payload samples/schema.
3. Generate a clean final evidence package from the deployment candidate.

Phase 3 later hardening:

1. Expand route assist modes beyond low-altitude system recommended routes.
2. Add provider-provided push fixtures to regression tests.
3. Add periodic WSDL drift monitoring as a CI artifact.

