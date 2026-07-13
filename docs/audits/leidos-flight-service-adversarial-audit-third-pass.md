# Leidos Flight Service Adversarial Audit - Third Pass

Audit date: 2026-07-13
Auditor: Codex
Scope: RSF Flight Planner and Leidos Flight Service integration, including provider filing, lifecycle, route assist, webhooks, background sync, Ops/SAR console, certification runners, and local test gates.

## 1. Executive Verdict

Verdict: **NOT READY for Sean/Will external LAB review without Phase 1 fixes.**

The current codebase is much stronger than the first two audit passes: the unified flight-service gate is green, route assist includes the documented `searchPathOption=LOW_ALTITUDE_ONLY`, duplicate Leidos webhook delivery has durable fingerprint idempotency, route/fuel regressions have coverage, and LAB/production gating remains fail-closed.

The adversarial blockers are not ordinary payload-format issues. They are state-integrity and operational-safety issues that can surface under double-submit, stale browser state, timeout/unknown provider outcome, multi-instance execution, or user-crafted saved-plan payloads.

Priority counts:

| Priority | Count | Meaning |
| --- | ---: | --- |
| P0 | 2 | Must fix before inviting Sean/Will into LAB |
| P1 | 8 | Should fix before external LAB review or certification package |
| P2 | 8 | Best-practice hardening before broader rollout |
| P3 | 4 | Later cleanup/documentation |

Provider requests sent during this audit: **NO**.

## 2. Baseline

| Item | Value |
| --- | --- |
| Branch | `main` |
| Commit | `1e83f47cc218b80ed116be064d7fb968db9065fb` |
| Working tree before audit | Clean |
| Node | `v20.19.4` |
| npm | `10.8.2` |
| Audit timestamp | `2026-07-13T09:21:24.4421305-05:00` |
| WSDL URL | `https://ffspelabs.leidos.com/Website2/resources/doc/WebService.xml` |
| WSDL fetch status | `200` |
| WSDL content type | `application/xml` |
| WSDL bytes | `734434` |
| WSDL SHA-256 | `7b7e71c22d2f8d2b2d67c1fc4fc3796f856f1d7be8dfecc83a6d716ef63b5082` |
| Official docs landing page | `https://lmfswebservices.atlassian.net/wiki/spaces/WSS/` fetched `200` |

WSDL term counts from the captured document:

| WSDL term | Count |
| --- | ---: |
| `FileFlightPlan` | 21 |
| `AmendFlightPlan` | 20 |
| `ActivateFlightPlan` | 19 |
| `CloseFlightPlan` | 19 |
| `CancelFlightPlan` | 19 |
| `RetrieveFlightPlan` | 48 |
| `SearchPathOptionType` | 2 |
| `versionStamp` | 73 |
| `returnStatus` | 210 |
| `flightIdentifier` | 54 |

Route Assist WSDL evidence:

- `RouteSearchRequest` contains `departure`, optional `sid`, `destination`, optional `star`, required `searchOption`, and optional `searchPathOption`.
- `SearchPathOptionType` pattern is `LOW_ALTITUDE_ONLY`.
- Current RSF code sets `searchPathOption` to `LOW_ALTITUDE_ONLY`.

## 3. Commands Run

Local-only verification:

```powershell
npm run check
npm run test:flight-service
npx tsx --test scripts/tests/flight-planner-route-geometry.test.ts scripts/tests/flight-plan-access.test.ts scripts/tests/flight-filing-readiness-messages.test.ts scripts/tests/tfms-provider.test.ts scripts/tests/route-builder-navaids.test.ts scripts/tests/route-weather-tokens.test.ts
```

Results:

| Command | Result |
| --- | --- |
| `npm run check` | PASS |
| `npm run test:flight-service` | PASS, 136 tests |
| Additional local flight-service-adjacent tests | PASS, 28 tests |

Commands intentionally not run:

| Command | Reason |
| --- | --- |
| `npm run certification:leidos-live-lab -- --confirm-leidos-lab ...` | Live provider action runner; audit explicitly prohibited provider requests |
| `npm run test:flight-service:leidos` | Smoke runner can use provider/LAB path |
| `npm run certification:flight-service` | Script writes certification artifacts; audit prohibited modifying existing certification artifacts |
| `npm run test:flight-service:stress` | Stress runner writes report history artifacts |

## 4. Architecture Trace

High-level flow:

1. Flight Planner builds a saved `flight_plans` row and filing packet.
2. Filing action endpoint: `POST /api/flight-plans/:id/filing-action` in `server/routes.ts`.
3. Runtime and auth gates run in `server/routes.ts` and `server/services/flightServiceRuntimeMode.ts`.
4. Payload and provider action handling runs through `server/services/flight-plan-filing/provider.ts`.
5. Provider metadata sync runs through `syncLeidosPlanMetadata`.
6. Webhook endpoint: `POST /api/leidos/webhooks/flight-service` in `server/routes.ts`.
7. Provider snapshot/lifecycle fields persist on `flight_plans`.
8. UI reads saved plan state from Flight Planner and Ops/SAR reads projections from `server/services/flightServiceOpsConsole.ts`.

Critical tables and JSON fields:

| Area | Evidence |
| --- | --- |
| Flight plans | `shared/schema.ts` defines `filingProviderPlanId`, `filingStatus`, `filingIsLive`, `filingPayload`, `filingProviderSnapshot`, `filingProviderMessages`, `filingRaw`, `filingActionHistory`, and certification audit fields |
| Webhook idempotency | `flight_service_webhook_events` table plus unique index on `(provider, event_fingerprint)` |
| Provider action history | Stored as JSON array `filingActionHistory`, not as a durable action-attempt table |

## 5. Findings

### FS-AUDIT-001 - Client can mass-assign `filingStatus` on normal create/PATCH

Priority: **P0**

Claim: A normal user can submit saved-plan payload fields that alter filing lifecycle state without provider action.

Code evidence:

- `shared/schema.ts` line 3610 extends `insertFlightPlanSchema` with `filingStatus: z.enum(flightPlanFilingStatuses).optional()`.
- `server/routes.ts` line 24912 parses create payload with `insertFlightPlanSchema.safeParse(payload)`.
- `server/routes.ts` line 24929 calls `storage.createFlightPlan({ ...result.data, userId })`.
- `server/routes.ts` line 24978 parses PATCH with `insertFlightPlanSchema.partial().safeParse(payload)`.
- `server/routes.ts` line 24982 calls `storage.updateFlightPlan(req.params.id, result.data as any)`.

Documentation evidence:

- Provider lifecycle states must be derived from provider action responses, provider retrieve, or provider webhook, not client-supplied planner payloads.
- Leidos lifecycle operations have stateful semantics around FILE/AMEND/ACTIVATE/CLOSE/CANCEL and `versionStamp`.

Risk if ignored:

- A user-crafted request can mark a plan filed, activated, closed, or cancelled locally.
- UI action buttons, active-plan limits, history display, Ops/SAR status, and provider sync behavior can become inconsistent with Leidos.

Recommended action:

- Split public create/update schemas from provider-owned fields.
- Reject or strip `filingStatus`, provider IDs, provider snapshots, raw provider fields, action history, timestamps, certification audit, and lifecycle metadata from normal create/PATCH.
- Add route-level tests proving client payloads cannot change provider-owned fields.

Suggested tests:

- PATCH with `filingStatus: "closed"` preserves existing status.
- Create with `filingStatus: "filed"` creates a draft.
- Admin/provider internal update path can still set provider-owned fields through explicit server-only functions.

### FS-AUDIT-002 - Provider action path lacks durable per-plan action lock/idempotency

Priority: **P0**

Claim: FILE/AMEND/ACTIVATE/CLOSE/CANCEL can be submitted concurrently by two tabs, retries, or two API instances because the provider action route reads a plan, calls the provider, then persists, without a durable lock or action-attempt idempotency record.

Code evidence:

- `server/routes.ts` line 23896 exposes the filing action route.
- `server/routes.ts` line 24353 calls `flightPlanFilingProvider.stageAction(effectivePlanForAction, action)`.
- `server/routes.ts` lines 24407-24421 persist the result after provider return.
- Repository search found no `FOR UPDATE`, advisory lock, or filing-action idempotency table around this route.
- `flightPlanFilingActions` is an action enum, not a durable attempt ledger.

Documentation evidence:

- Leidos lifecycle operations are stateful. Duplicate FILE can trigger duplicate-flight detection; AMEND/ACTIVATE depend on current provider plan identity and `versionStamp`.

Risk if ignored:

- Duplicate provider calls, stale `versionStamp` use, duplicate notifications/history, or provider/local divergence under double-click/retry/multi-instance conditions.

Recommended action:

- Add a durable per-plan action attempt table or transaction lock.
- Store client idempotency key, action, plan ID, provider request fingerprint, status, provider response, and outcome.
- Require exactly one active provider action per plan.

Suggested tests:

- Two concurrent FILE requests result in one provider call.
- Two concurrent AMEND requests with the same versionStamp result in one provider call.
- Retry with same idempotency key replays local result without a provider call.

### FS-AUDIT-003 - Ambiguous FILE outcome is staged, not represented as provider-outcome-unknown

Priority: **P1**

Claim: When network timeout or malformed accepted response occurs after provider submission, RSF may keep the request staged without a distinct outcome-unknown state requiring retrieve/reconciliation.

Code evidence:

- `provider.ts` catches fetch/network errors after building the provider request and returns a staged fallback with `providerTimeout` metadata.
- `provider.ts` also treats a FILE HTTP success without usable `flightIdentifier` as staged.
- The normal route then persists `nextStatus` from the provider result.

Documentation evidence:

- Once a provider action request is sent, local certainty depends on provider response or later RETRIEVE/push. A timeout is not proof the provider did not accept the action.

Risk if ignored:

- User retries FILE, Leidos may reject duplicate or create a duplicate remote plan.
- Local plan can remain staged while a real Leidos plan exists.

Recommended action:

- Add `provider_outcome_unknown` or equivalent terminal-of-attempt state.
- Automatically reconcile by route/tail/time/provider lookup where supported.
- Disable retry FILE until reconciliation is complete or an admin override is used.

Suggested tests:

- Simulated timeout after request dispatch marks outcome unknown.
- Retry FILE while outcome unknown is locally blocked.
- Successful later retrieve attaches provider plan ID and clears unknown state.

### FS-AUDIT-004 - Webhook idempotency handles identical duplicates, but stale/out-of-order provider events are not proven safe

Priority: **P1**

Claim: Identical duplicate webhook deliveries are durable-idempotent, but there is no demonstrated monotonic version/timestamp guard preventing older provider events from overwriting newer local lifecycle/snapshot data.

Code evidence:

- `migrations/0112_add_flight_service_webhook_events.sql` creates a durable idempotency table and unique fingerprint index.
- `server/routes.ts` reserves events before side effects and logs `leidos_webhook_duplicate_ignored`.
- The final snapshot merge appends processed event metadata and persists lifecycle updates.
- No local test proves lower `versionStamp` or older `messageDateTime` cannot regress an existing snapshot.

Documentation evidence:

- Provider push/retrieve systems can deliver duplicate or delayed messages. Lifecycle state must not move backward without explicit provider evidence.

Risk if ignored:

- A delayed `PROPOSED` push can overwrite a later `ACTIVATED`, `CLOSED`, or `CANCELLED` view.
- Ops/SAR console can show a stale provider state.

Recommended action:

- Define monotonic ordering rules using `versionStamp`, provider timestamp, message ID, and terminal-state precedence.
- Ignore or record stale events without applying state regressions.

Suggested tests:

- `closed` followed by older `proposed` webhook does not regress local/provider lifecycle.
- Higher versionStamp wins.
- Same event hash is ignored before notifications/history; distinct older event is recorded as stale without state update.

### FS-AUDIT-005 - Webhook creates notification and push before final provider-state persistence

Priority: **P1**

Claim: The webhook route creates an in-app notification and may send Expo push before final provider snapshot/history/lifecycle persistence completes.

Code evidence:

- In `server/routes.ts`, `storage.createUserNotification` occurs before `syncLeidosPlanMetadata`, `persistLeidosProviderSync`, and final `storage.updateFlightPlan`.
- Expo push fetch also occurs before final provider snapshot update.

Documentation evidence:

- Webhook acknowledgement should be quick and durable; side effects should not be observable before the canonical state is committed.

Risk if ignored:

- User opens a notification before the underlying provider status is visible.
- If later persistence fails, notification exists for a state not reflected on the plan.

Recommended action:

- Persist canonical provider snapshot/history first.
- Then create/update notification and enqueue push delivery.
- Move push delivery to a best-effort job after durable state update.

Suggested tests:

- Simulated persistence failure does not create user notification.
- Simulated Expo failure does not prevent provider snapshot persistence.

### FS-AUDIT-006 - `filingRaw` stores full request payload including sensitive provider fields

Priority: **P1**

Claim: Live provider action results persist `raw.requestPayload`, which includes provider-submitted fields such as pilot name/phone and supplemental fields.

Code evidence:

- `provider.ts` returns `raw: { requestUrl, requestPayload, providerPlanId, versionStamp, metadataResponse, response }`.
- Ops detail sanitizes many raw keys, and evidence reports redact, but the database still stores raw provider request payloads.

Documentation evidence:

- Pilot contact data and raw provider payloads should be minimized and redacted in operational artifacts.

Risk if ignored:

- Breach/blast radius increases.
- Future endpoints may accidentally expose raw provider payloads.

Recommended action:

- Persist only redacted payload snapshots and provider IDs/version/timestamps.
- Store raw payloads only behind explicit short-retention diagnostics if absolutely necessary.

Suggested tests:

- Saved `filingRaw` from live action does not contain pilot phone, pilot name, credentials, or raw request payload.
- Ops/SAR/export endpoints remain redacted.

### FS-AUDIT-007 - Ops/SAR console includes placeholders and incomplete local-time modeling

Priority: **P1**

Claim: Ops/SAR support mode is useful but not ready as a definitive operational record.

Code evidence:

- `flightServiceOpsConsole.ts` sets `etdLocal: iso(plan.plannedDepartureAt)`, same as UTC ISO value.
- SAR detail includes `retentionNotice: "TODO..."`.
- `secondaryEmergencyContact: null`.
- `supportContact: "RSF support contact placeholder"`.

Documentation evidence:

- SAR/support workflows require clear local/Zulu interpretation, contact confidence, and retention/traceability policies.

Risk if ignored:

- Super Admin may misread local time as true local airport time.
- SAR export appears more complete than it is.

Recommended action:

- Represent departure/destination local time with stored airport timezone.
- Replace placeholders with explicit "not configured" plus configuration owner.
- Decide retention policy before external support-mode demo.

Suggested tests:

- Ops result shows distinct Zulu and airport-local time for non-UTC airports.
- SAR report never labels placeholder/null data as verified.

### FS-AUDIT-008 - Background sync is client-tab driven and limited by UI visibility

Priority: **P1**

Claim: Provider synchronization depends heavily on the Flight Planner page being open and browser timers running.

Code evidence:

- `client/src/pages/flight-planner.tsx` contains a 60-second background sync interval.
- It posts `/api/flight-plans/:id/filing-sync` with `requestSource: "background"`.
- No durable server scheduler was identified in this audit for overdue/open-provider reconciliation.

Documentation evidence:

- Provider lifecycle/SAR support needs server-side reconciliation independent of user browser state.

Risk if ignored:

- IFR/VFR state changes can remain stale when the browser tab is closed, suspended, or displaying a different subset of plans.

Recommended action:

- Add a server-side reconciliation worker for open live plans.
- Use backoff, stale threshold, lifecycle-safe rules, and provider-rate limits.

Suggested tests:

- Open filed plan becomes stale and is queued for server sync without client tab.
- Terminal provider state is detected and local state updates without UI polling.

### FS-AUDIT-009 - Production/LAB gating is fail-closed but live provider enablement is split across env vars

Priority: **P1**

Claim: Runtime mode and provider live enablement are safe but complex.

Code evidence:

- `flightServiceRuntimeMode.ts` defaults environment to `LAB`, requires `FLIGHT_FILING_OPERATIONAL_ENABLED` only for `PRODUCTION`.
- `provider.ts` uses `LEIDOS_FLIGHT_SERVICE_ENABLE_LIVE` for provider action enablement.
- `live-lab-runner.ts` requires `LEIDOS_LAB_TEST_ENABLED` and rejects production operational flags.

Documentation evidence:

- Test and production Leidos endpoints must remain separated and explicit.

Risk if ignored:

- Misconfigured API service can pass UI auth but stage provider calls, or vice versa.
- Operator confusion during external demo.

Recommended action:

- Add a single diagnostics endpoint/report showing environment, provider base URL class, live provider enabled, LAB test enabled, and production filing disabled.
- Keep production filing disabled.

Suggested tests:

- LAB with provider disabled stages safely.
- LAB live runner refuses if production operational flag is set.
- Production endpoint refuses unless both environment and production operational flag are correct.

### FS-AUDIT-010 - Certification mocked report is intentionally mocked, but artifact-writing scripts are not release-gate safe

Priority: **P2**

Claim: `npm run certification:flight-service` intentionally generates mocked reports, while live provider submission is only under `certification:leidos-live-lab`.

Code evidence:

- `package.json` `certification:flight-service` runs `tsx tests/flight-service/certification-report.ts --write`.
- `certification-report.ts` has `mode: "mocked"` and prints provider calls simulated.
- `package.json` `certification:leidos-live-lab` runs `tests/flight-service/leidos-live-lab/live-lab-runner.ts`.

Documentation evidence:

- Evidence packages must distinguish mock validation from provider evidence.

Risk if ignored:

- A release gate may overwrite evidence artifacts or be misread as live provider proof.

Recommended action:

- Add a non-writing `npm run gate:flight-service` for local release gate.
- Add explicit `mocked` vs `live-lab` labels to every generated artifact.

Suggested tests:

- Gate command exits nonzero if any local flight-service test fails.
- Gate command does not write certification artifacts.

### FS-AUDIT-011 - Existing test gate omits several relevant local tests

Priority: **P2**

Claim: `npm run test:flight-service` is green, but several flight-service-adjacent tests live outside the gate.

Code evidence:

- `package.json` `test:flight-service` runs 136 tests.
- Additional local tests run separately in this audit passed 28 tests:
  - `flight-planner-route-geometry.test.ts`
  - `flight-plan-access.test.ts`
  - `flight-filing-readiness-messages.test.ts`
  - `tfms-provider.test.ts`
  - `route-builder-navaids.test.ts`
  - `route-weather-tokens.test.ts`

Risk if ignored:

- Route geometry, navaid route builder, active-plan access, and readiness UX can regress while unified flight-service gate remains green.

Recommended action:

- Add these local tests to `test:flight-service` or create `test:flight-service:release` and make it the release gate.

Suggested tests:

- Keep all currently passing omitted tests in the release gate.

### FS-AUDIT-012 - Active flight plan limit is checked in application code without a proven DB-level race guard

Priority: **P2**

Claim: Free-tier one-active-plan enforcement appears to be an application-level read/check/create flow.

Code evidence:

- `server/routes.ts` create route loads all user plans, calls `canCreateAnotherActiveFlightPlan`, then creates the plan.
- Local tests cover ordinary logic, not concurrent create.

Risk if ignored:

- Two concurrent requests can create two active plans for a free user.

Recommended action:

- Use a transaction/advisory lock or DB constraint for active-plan creation.

Suggested tests:

- Two concurrent create calls for a free user result in one success and one limit error.

### FS-AUDIT-013 - Provider lifecycle transition logging is not enough by itself to guarantee UI freshness

Priority: **P2**

Claim: Logs can show `provider_lifecycle_transition` while UI still reads stale query cache or an older saved-plan object.

Code evidence:

- Webhook persistence was improved and tests assert UI/Ops read preserved provider state.
- Flight Planner uses React query and plan lists with periodic sync; no end-to-end UI cache invalidation test was found for webhook-driven update.

Risk if ignored:

- Provider panel can display stale lifecycle until manual refresh.

Recommended action:

- Add websocket/query invalidation or polling refresh after provider webhook updates.

Suggested tests:

- Simulated webhook update invalidates plan detail/list query and displays `Proposed` without manual sync.

### FS-AUDIT-014 - Provider action error taxonomy still conflates some provider/transport outcomes

Priority: **P2**

Claim: Error handling is improved, but transport timeout, provider rejection, no route suggestions, missing provider plan ID, and outcome unknown need fully distinct UI/report classifications.

Code evidence:

- `provider.ts` has specific messages for `returnStatus=false`, timeout-like errors, missing provider plan ID, and missing versionStamp.
- Certification and UI reporting still rely on string messages in some places.

Risk if ignored:

- Users may retry unsafe actions or misunderstand provider rejection versus local test-design failure.

Recommended action:

- Return structured `code`, `providerReturnStatus`, `transportStatus`, and `outcomeKnown` for every provider action.

Suggested tests:

- Timeout after dispatch shows outcome-unknown.
- Provider `returnStatus=false` shows provider rejected.
- HTTP 4xx/5xx shows transport/provider unavailable.

### FS-AUDIT-015 - WSDL comparison is captured but not automated in CI

Priority: **P2**

Claim: The current WSDL was fetched and checked manually, but there is no automated drift detector.

Code evidence:

- No CI/local test was found that fetches or compares WSDL field/enum drift.

Risk if ignored:

- Leidos schema changes may break route assist, action payloads, or response parsing silently.

Recommended action:

- Add a non-secret WSDL snapshot metadata test using checksum/date/manual approval.
- Do not commit credentials or raw provider payloads.

Suggested tests:

- Fails when required operation/type names disappear.
- Warns when checksum changes.

### FS-AUDIT-016 - Route Assist error semantics are provider-neutral in UI, but WSDL notes no-routes can return `returnStatus=false`

Priority: **P2**

Claim: The WSDL says Route Search may use `returnStatus=false` for both failed request and no routes found, with message differences by search option. UI needs to preserve this distinction.

Code evidence:

- Current tests cover friendly provider error and zero suggestions.
- WSDL states no-routes can be an unsuccessful return status with coded message.

Risk if ignored:

- A legitimate no-route result could be presented as provider unavailable, or a provider validation failure could look like empty suggestions.

Recommended action:

- Parse route-search coded messages into `zero_results`, `validation_error`, and `provider_unavailable`.

Suggested tests:

- `returnStatus=false` with no-route message maps to empty-result UX.
- `returnStatus=false` with validation message maps to unavailable UX.

### FS-AUDIT-017 - Timezone conversion tests exist, but airport timezone source is not contract-tested against edge cases

Priority: **P2**

Claim: Payload building logs airport timezone and computes UTC, but high-risk DST and ZZZZ reference airport edge cases need broader tests.

Code evidence:

- `provider.ts` logs `flight_time_conversion`.
- Tests cover changed planned departure date and lifecycle dynamic timing.

Risk if ignored:

- Wrong UTC time around DST or ZZZZ planning reference can create invalid provider actions.

Recommended action:

- Add DST boundary tests and ZZZZ actual location with planning reference timezone.

Suggested tests:

- Spring/fall DST boundary departure at airports in different timezones.
- ZZZZ departure with planning reference airport uses reference timezone.

### FS-AUDIT-018 - Notification payloads still include raw provider payload in metadata

Priority: **P2**

Claim: Webhook notification metadata includes `raw: payload`; summaries are redacted, but raw payload in notification metadata is risky.

Code evidence:

- Webhook route creates notification metadata with `raw: payload`.
- Webhook contract tests assert log summaries exclude values, not necessarily database notification metadata.

Risk if ignored:

- Raw provider payload can leak through future notification APIs or logs.

Recommended action:

- Store redacted/summarized provider payload metadata only.

Suggested tests:

- Notification meta does not contain pilot phone/name/raw provider values.

### FS-AUDIT-019 - Route, fuel, and readiness fixes are well covered locally

Priority: **P3**

Claim: Recent route/fuel/readiness changes have meaningful tests and passed this audit.

Evidence:

- `flight-plan-fuel.test.ts` covers authoritative ETE, calculated endurance, manual ICAO endurance override, and provider `flightDuration`.
- `flight-planner-route-geometry.test.ts` covers endpoint restoration for geometry while provider Item 15 route remains endpoint-free.
- `route-builder-navaids.test.ts` covers MQP/MLP navaids and no airport prefixing.

Recommended action:

- Keep these tests in the release gate.

### FS-AUDIT-020 - LAB/production protections are currently preserved

Priority: **P3**

Claim: No audit evidence showed production filing was enabled or weakened.

Evidence:

- Runtime mode defaults to LAB.
- Production operational filing requires `FLIGHT_SERVICE_ENVIRONMENT=PRODUCTION` and `FLIGHT_FILING_OPERATIONAL_ENABLED=true`.
- Live LAB runner refuses production operational filing flags.

Recommended action:

- Preserve fail-closed behavior.
- Keep provider live submission separate from production operational filing.

### FS-AUDIT-021 - Duplicate-flight local detection and live LAB duplicate-risk check are implemented

Priority: **P3**

Evidence:

- Filing action route calls `findLikelyDuplicateFlightPlan` before FILE.
- Admin/LAB certification override is scoped.
- `test:flight-service` includes live-lab duplicate-risk tests.

Recommended action:

- Add concurrency/race tests around duplicate detection and provider action lock once action idempotency exists.

### FS-AUDIT-022 - Webhook identical duplicate delivery idempotency is implemented

Priority: **P3**

Evidence:

- Durable webhook event table with unique provider/fingerprint index.
- Route reserves before side effects.
- Tests assert durable idempotency structure and duplicate-before-side-effects ordering.

Recommended action:

- Extend from identical duplicate handling to stale/out-of-order event handling.

## 6. Provider Operation Matrix

| Operation | Current handling | Main residual risk | Priority |
| --- | --- | --- | --- |
| FILE | Builds payload, validates, sends provider action, persists provider ID/version where returned | Timeout/unknown outcome and no action idempotency | P0/P1 |
| AMEND | Requires provider plan and versionStamp; retrieves if missing | Concurrent stale versionStamp and no action lock | P0/P1 |
| ACTIVATE | Requires versionStamp; lifecycle dynamic timing in runner | Activation-window tests are runner-specific; stale versionStamp race | P1 |
| CLOSE | Terminal action can succeed without versionStamp | IFR close must stay blocked; stale UI/provider state | P1/P2 |
| CANCEL | Terminal action can succeed without versionStamp | Duplicate/stale cancellation calls without idempotency | P1 |
| RETRIEVE/SYNC | Pulls provider metadata and merges snapshot | Browser-driven background sync and stale event ordering | P1 |
| Route Assist | Uses WSDL enum `LOW_ALTITUDE_ONLY`; friendly UI errors | No-route `returnStatus=false` vs error distinction | P2 |

## 7. ICAO / Payload Matrix

| Area | Status |
| --- | --- |
| Equipment/surveillance | Local tests cover invalid equipment, duplicate equipment message, PBN dependencies, ADS-B combos |
| ZZZZ DEP/DEST/ALTN | Local tests cover actual location insertion and Field 18 separation |
| RMK/Field 18 separation | Local tests cover RMK normalization and supplemental remarks separation |
| Pilot phone/home base | Payload includes values; logs/reporting redaction tests exist |
| Fuel endurance | Server and client compare transmitted ICAO endurance to ETE |
| Route normalization | Provider Item 15 normalization preserves valid DCT semantics and planning geometry uses endpoints |
| Navaids/fixes | MQP/MLP route builder tests passed |
| VersionStamp | Required for AMEND/ACTIVATE; optional for terminal actions |

## 8. Security and Privacy

Strong points:

- Webhook auth guard exists.
- Webhook log summary omits raw payload values.
- Ops detail sanitizes raw history.
- Payload-built log redacts pilot phone and request payload fields.

Gaps:

- `filingRaw.requestPayload` can persist sensitive submitted provider data.
- Webhook notification metadata stores raw payload.
- Normal create/PATCH can mass-assign `filingStatus`.

Security verdict: **not ready until P0 mass-assignment and provider action idempotency are fixed**.

## 9. Test Gate Inventory

`npm run test:flight-service` includes:

- Flight-service validation and payload build
- Retrieve comparison
- Lifecycle buttons
- ZZZZ
- Remarks
- Generated scenarios
- Live LAB duplicate-risk preflight
- Ops console
- Filing validation/workflow/fuel
- Saved-plan sorting
- Provider notification formatting
- Webhook contract
- Scanner guard
- Auth gate
- Route Assist display
- Provider status

Local flight-service-adjacent tests that passed but are outside the unified gate:

- `scripts/tests/flight-planner-route-geometry.test.ts`
- `scripts/tests/flight-plan-access.test.ts`
- `scripts/tests/flight-filing-readiness-messages.test.ts`
- `scripts/tests/tfms-provider.test.ts`
- `scripts/tests/route-builder-navaids.test.ts`
- `scripts/tests/route-weather-tokens.test.ts`

Recommended release gate:

```powershell
npm run check
npm run test:flight-service
npx tsx --test scripts/tests/flight-planner-route-geometry.test.ts scripts/tests/flight-plan-access.test.ts scripts/tests/flight-filing-readiness-messages.test.ts scripts/tests/route-builder-navaids.test.ts scripts/tests/route-weather-tokens.test.ts
```

Do not include live provider commands in the default release gate.

## 10. Required New Test Designs

1. Client PATCH cannot set `filingStatus`.
2. Client create cannot set `filingStatus`.
3. Client PATCH cannot set provider ID, snapshot, raw, action history, or lifecycle timestamps.
4. Two concurrent FILE actions create one provider request.
5. Two concurrent AMEND actions create one provider request.
6. Retry with same action idempotency key replays local result.
7. Timeout after provider request dispatch marks provider outcome unknown.
8. FILE retry is blocked while outcome is unknown.
9. Later retrieve attaches provider ID after unknown FILE.
10. Webhook `closed` followed by older `proposed` does not regress state.
11. Higher webhook versionStamp wins over lower versionStamp.
12. Webhook notification is not created if canonical provider-state persistence fails.
13. Expo push failure does not prevent provider-state persistence.
14. Notification metadata excludes raw provider payload and pilot PII.
15. Saved `filingRaw` excludes raw request payload and pilot PII.
16. Free-user active-plan limit survives two concurrent creates.
17. Server-side open-plan sync updates stale provider state without browser tab.
18. Route Assist `returnStatus=false` no-route coded message maps to zero-result UX.
19. Route Assist `returnStatus=false` validation message maps to unavailable UX.
20. DST/ZZZZ reference-airport timezone conversion tests.

## 11. Sean/Will LAB Review Readiness Plan

### Phase 1 - Must fix before Sean/Will LAB review

1. Strip provider-owned fields from public flight-plan create/PATCH.
2. Add durable per-plan provider action lock/idempotency.
3. Add provider outcome-unknown handling for ambiguous FILE/transport outcomes.
4. Add stale/out-of-order webhook ordering rules.
5. Move webhook notification/push side effects after canonical state persistence.
6. Remove raw provider request payload and raw webhook payload from persisted user-visible/notification records.

### Phase 2 - Should fix before certification package

1. Server-side background provider reconciliation for open live plans.
2. Add omitted local flight-service-adjacent tests to release gate.
3. Add WSDL drift metadata check.
4. Harden Ops/SAR local time, retention, and support-contact placeholders.
5. Add structured provider action error taxonomy.

### Phase 3 - Later hardening

1. Better provider no-route vs route-assist-error classification.
2. UI cache invalidation for webhook-driven provider state.
3. Expanded DST/airport-time matrix.
4. Admin diagnostics dashboard for all Flight Service runtime flags.

## 12. Leidos / Documentation Questions

1. For FILE, what is the recommended reconciliation path when RSF times out after sending the request and no `flightIdentifier` is known?
2. Are webhook `versionStamp` values strictly monotonic per flight plan?
3. Can Leidos send delayed webhooks after a terminal CLOSE/CANCEL?
4. Is `messageDateTime` reliable for ordering, or should `versionStamp` be authoritative?
5. Does Route Search use `returnStatus=false` for no-route as well as validation failures in current LAB?
6. What retention period should RSF apply to raw provider diagnostics, if any?
7. For IFR plans, what exact provider state should RSF display after expected departure and expected arrival when Leidos manages activation/closure?

## 13. Demo Checklist

Before external LAB demo:

- `npm run check` passes.
- `npm run test:flight-service` passes.
- Added release-gate local tests pass.
- Public create/PATCH cannot mutate provider-owned fields.
- Provider action idempotency test passes.
- Ambiguous FILE outcome test passes.
- Duplicate and stale webhook tests pass.
- Logs/artifacts contain no raw provider payload, pilot phone, credentials, or supplementary pilot data.
- LAB endpoint and LAB acknowledgement are enforced.
- Production filing remains disabled.
- Live LAB command is run only deliberately:

```powershell
npm run certification:leidos-live-lab -- --confirm-leidos-lab --limit 15 --delay-minutes 3
```

## 14. Final Classification Summary

Blockers:

- FS-AUDIT-001: public mass assignment of `filingStatus`.
- FS-AUDIT-002: no durable provider action lock/idempotency.

Warnings:

- FS-AUDIT-003 through FS-AUDIT-018.

Info/already-implemented:

- FS-AUDIT-019 through FS-AUDIT-022.

## 15. Audit Integrity Statement

No implementation code was changed.
No production filing flag was enabled.
No live LAB provider action was sent.
No database credentials or provider credentials were printed.
No certification artifacts were regenerated.
The only repository change from this audit is this Markdown report.
