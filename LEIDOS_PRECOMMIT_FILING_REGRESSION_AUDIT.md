# Leidos Pre-Commit Filing Regression Audit

Audit date: 2026-07-20
Final result: PASS - NO FILING REGRESSION DETECTED

No live Leidos LAB or production provider operations were run. No commit, push, deploy, reset, checkout, or destructive Git command was performed during this audit.

## 1. Baseline And Working Tree

The WSDL documentation audit referenced `0272bd8511e55b6ae02af8bf43b17246a9f36b9f`. Git history confirms it is the pre-compliance-remediation baseline for the current Leidos documentation changes.

Current HEAD at audit time:

- `6dfc8cffeca385bf0143fc19729e28ee28a7d874`

Recent history:

- `6dfc8cf Audit update`
- `cab242c Update`
- `0272bd8 Case error update`

Important note: the working tree was clean at the start of this audit, which means the previously implemented compliance changes were already committed in the current local branch. This audit added a new pre-commit operation-presence test and this report only. It did not modify provider behavior.

Current working tree after this audit:

- Modified: `package.json`
- Untracked: `scripts/tests/flight-service-operation-presence.test.ts`
- Untracked: `LEIDOS_PRECOMMIT_FILING_REGRESSION_AUDIT.md`
- Untracked WSDL evidence artifact from validation: `certification-results/leidos-wsdl/leidos-wsdl-2026-07-20T15-57-48-918Z.json`

Diff from `0272bd8511e55b6ae02af8bf43b17246a9f36b9f` includes the Leidos documentation audit files, RouteSearch fix, URL validation, diagnostic sanitizer, cleanup utility, and tests. There were no deletions of Flight Planner UI files, provider lifecycle action types, schema fields, API routes, or lifecycle mappings.

## 2. Files Changed In The Compliance Delta

Runtime and server behavior:

- `server/services/flight-plan-filing/provider.ts`
- `server/routes.ts`
- `server/services/flight-service-provider-diagnostics.ts`

Utilities:

- `scripts/sanitize-flight-service-provider-diagnostics.ts`

Tests:

- `scripts/tests/flight-service-route-assist-display.test.ts`
- `scripts/tests/flight-service-provider-url-validation.test.ts`
- `scripts/tests/flight-service-provider-diagnostics.test.ts`
- `scripts/tests/flight-service-operation-presence.test.ts`

Scripts:

- `package.json`

Audit/evidence:

- `LEIDOS_DOCUMENTATION_COMPLIANCE_AUDIT.md`
- `LEIDOS_DOCUMENTATION_COMPLIANCE_MATRIX.csv`
- `LEIDOS_OPEN_QUESTIONS_FOR_PROVIDER.md`
- WSDL evidence JSON files under `certification-results/leidos-wsdl/`

## 3. Filing Operation Inventory

| Operation | UI entry point | Eligibility logic | API route | Server handler | Provider method | Leidos path | Response persistence | Tests |
|---|---|---|---|---|---|---|---|---|
| FILE | `FlightPlanLifecycleActions` and planner save/file flow | `canFilePlan`, readiness checks | `POST /api/flight-plans/:id/filing-action` | `filingLifecycleActionSchema`, `flightPlanFilingProvider.stageAction` | `stageAction(plan, "file")` | default action path `FP/file` | `filingProviderPlanId`, status, `filingPayload`, provider snapshot, sanitized `filingRaw`, history | payload, validation, workflow, operation-presence |
| RETRIEVE/SYNC | provider sync buttons and background sync | saved live provider plan with provider id | sync branches in same route and background sync path | `syncLeidosPlanMetadata`, `persistLeidosProviderSync` | retrieve helpers in provider adapter | `FP/{providerPlanId}/retrieve` | typed provider snapshot, lifecycle merge, messages, sanitized diagnostics | retrieve-compare, provider-status, lifecycle-integrity |
| AMEND | `onAmend`, save changes and amend | `canAmendPlan`, readiness, provider review gate | `POST /api/flight-plans/:id/filing-action` | action schema and provider action attempts | `stageAction(plan, "amend")` | `FP/{flightIdentifier}/amend` by configured action path | newer versionStamp, accepted transmitted snapshot, sanitized history | validation, payload, workflow, live-lab fixture tests |
| ACTIVATE | VFR lifecycle button only | `canActivatePlan`, VFR, proposed/filed, provider action availability | `POST /api/flight-plans/:id/filing-action` | same action handler | `stageAction(plan, "activate")` | configured activate path | status, versionStamp when required, lifecycle evidence | lifecycle-buttons, live-lab timing, terminal evidence |
| CANCEL | proposed live provider plans and certification cleanup | `canCancelPlan`, nonterminal provider plan, safety gates | `POST /api/flight-plans/:id/filing-action` | same action handler plus cleanup decisions | `stageAction(plan, "cancel")` | configured cancel path | terminal/local state, sanitized history, terminal versionStamp optional | provider-status, live-lab post-run, operation-presence |
| CLOSE | active/eligible overdue VFR plans | `canClosePlan`, VFR, active/activated, close location for overdue | `POST /api/flight-plans/:id/filing-action` | same action handler plus overdue close location | `stageAction(plan, "close")` | configured close path | terminal/local state, sanitized history, terminal versionStamp optional | lifecycle-buttons, terminal evidence, operation-presence |

Evidence:

- Action schema: `server/routes.ts:23297`
- Filing route: `server/routes.ts:24811`
- Provider dispatch: `server/routes.ts:25392`
- Post-action retrieve/sync: `server/routes.ts:25500`
- Route sync paths: `server/routes.ts:25868`, `server/routes.ts:25975`
- Provider interface/action dispatch: `server/services/flight-plan-filing/provider.ts:3048`
- Retrieve parsing and provider snapshot extraction occur before sanitizer: `server/services/flight-plan-filing/provider.ts:3277`, `server/services/flight-plan-filing/provider.ts:3305`

## 4. UI Control Inventory

The current planner still exposes lifecycle controls through both current-plan and saved-plan-card locations:

- Current plan action component use: `client/src/pages/flight-planner.tsx:11798`
- Saved plan card action component use: `client/src/pages/flight-planner.tsx:12187`
- Shared action component: `client/src/components/flight-planner/FlightPlanLifecycleActions.tsx:272`
- Action names: `client/src/pages/flight-planner.tsx:144` and `client/src/components/flight-planner/FlightPlanLifecycleActions.tsx:10`
- API click handler: `client/src/pages/flight-planner.tsx:7762`
- Actual API call: `client/src/pages/flight-planner.tsx:7539`

Controls confirmed present:

- File Flight Plan
- Amend
- Activate
- Cancel
- Close
- Sync/Retrieve Provider Status
- Provider updates
- Accept provider changes
- Download filing summary
- Cleanup test plan for certification plans

The new operation-presence test asserts that lifecycle controls are not hard-suppressed by `false &&` or `Boolean(false)` patterns.

## 5. Lifecycle Eligibility Matrix

| Scenario | File | Amend | Activate | Cancel | Close | Sync |
|---|---:|---:|---:|---:|---:|---:|
| New valid VFR plan | Yes | No | No | No | No | As applicable after save/provider state |
| Proposed VFR provider plan | No | Yes | Yes when provider/window eligible | Yes | No | Yes |
| Active VFR provider plan | No | Yes where provider allows | No | No | Yes | Yes |
| Overdue VFR provider plan | No | As documented by provider/local readiness | No | No | Yes with close location | Yes |
| Proposed IFR provider plan before cutoff | No | Yes | No | Yes when provider permits | No | Yes |
| Proposed IFR provider plan inside cutoff | No | Blocked/specialist guidance | No | Blocked/specialist guidance | No | Yes |
| Cancelled plan | No | No | No | No | No | Safe terminal sync behavior |
| Closed plan | No | No | No | No | No | Safe terminal sync behavior |
| Genuine provider changes pending review | No new mutation until reviewed | Blocked | Blocked | Existing safety policy | Existing safety policy | Yes |
| Exact provider echo only | Normal eligibility | Normal eligibility | Normal eligibility | Normal eligibility | Normal eligibility | Yes |

No regression was found in this matrix. Existing tests cover closed plans, filed VFR action availability, provider review gating, terminal evidence, and certification cleanup.

## 6. Filing Rule Invariants

### FILE

Confirmed unchanged.

- The public route remains authenticated and rate-limited.
- `includeCodedMessages=true` remains appended by payload construction.
- FILE still builds the full ICAO payload and stores accepted transmitted snapshots.
- RouteSearch is not called inside the FILE path.
- Diagnostic sanitization is not applied until after provider response parsing and operational extraction.

### RETRIEVE/SYNC

Confirmed unchanged.

- Retrieve path remains `FP/{providerPlanId}/retrieve`.
- `versionRequested=20240801` remains set.
- Provider sync persists lifecycle, versionStamp, route evidence, ARTCC state, notices, and provider messages through typed provider snapshot fields.
- Empty retrieve lifecycle does not erase stronger webhook evidence through existing lifecycle merge behavior.

### AMEND

Confirmed unchanged.

- AMEND remains in the shared action enum and UI action union.
- Missing versionStamp retrieve fallback remains before dispatch.
- AMEND still uses the same provider action path mechanism and payload builder.
- Accepted transmitted snapshots are still persisted for provider review reconciliation.
- The sanitizer preserves versionStamp and providerPlanId in diagnostics and does not run before operational extraction.

### ACTIVATE

Confirmed unchanged.

- ACTIVATE remains VFR-only in UI.
- IFR activation remains prohibited by eligibility and tests.
- Activation window behavior remains covered by live-lab timing tests.
- Successful nonterminal actions still expect versionStamp unless terminal.

### CANCEL

Confirmed unchanged.

- CANCEL remains available for eligible proposed provider plans.
- Terminal missing versionStamp remains informational.
- Certification cleanup behavior remains separate and present.
- Cleanup decision logic remains in `server/routes.ts`.

### CLOSE

Confirmed unchanged.

- CLOSE remains VFR-only and active/activated-state gated.
- Overdue close location behavior remains in planner dialog flow.
- Terminal missing versionStamp remains informational.
- Normal CLOSE path remains present and is not replaced by cleanup-only behavior.

## 7. Deleted Or Altered Behavior

Diff-based deletion audit found no deleted filing operation, no deleted route, no deleted lifecycle action type, no deleted provider interface method, no deleted UI action component, no deleted authorization check, and no deleted lifecycle mapping.

Changes classified:

- RouteSearch request planning: intentional and authorized.
- HTTP transport removal: intentional and authorized replacement with HTTPS-only transport.
- Raw diagnostic persistence replacement: intentional and authorized. Operational fields are extracted before sanitizer, and only diagnostic copies are sanitized.
- Provider action attempt result compaction: intentional and authorized. Full `responsePlan` was replaced with an allowlisted plan outcome summary.
- Tests added/updated: intentional and authorized.

No regression requiring restoration was found.

## 8. Sanitizer Ordering Proof

Required order:

Parse full transient response in memory -> extract operational values -> sanitize diagnostic copy -> persist sanitized diagnostics.

Confirmed order in `server/services/flight-plan-filing/provider.ts`:

1. `parseProviderResponse(response)` parses the full transient provider response.
2. `extractLeidosResponseMessages`, `extractFilingProviderPlanId`, and `extractFilingVersionStamp` run on the full response.
3. Missing versionStamp retrieve still receives the full transient response.
4. `buildProviderSnapshot` runs before persisted diagnostic sanitization.
5. `buildProviderMessages` runs before persisted diagnostic sanitization.
6. `sanitizeProviderDiagnosticRecordForPersistence` creates only the diagnostic `raw` copy.
7. `server/routes.ts` sanitizes `filingRaw`, `filingActionHistory.raw`, `responsePlan`, `responseBody`, and action-attempt error messages before DB persistence.

Operational values still persist correctly:

- Provider plan ID
- Version stamp
- Lifecycle
- ARTCC state
- Route evidence/route changed flag
- Provider return status
- Coded errors/messages
- Action timestamps
- Accepted transmitted snapshot
- Terminal evidence source
- Provider review state

## 9. RouteSearch Isolation Proof

RouteSearch remains optional assistance:

- The only RouteSearch API path is `GET /api/flight-plans/route-search`.
- Filing action submission uses `POST /api/flight-plans/:id/filing-action`.
- `submitFilingAction` contains no RouteSearch dependency.
- The operation-presence test asserts route assist is absent from the submit/save action blocks.
- High-altitude RouteSearch unavailable results do not affect manual route entry or FILE validation.
- Low altitude still uses `SYSTEM_RECOMMENDED + LOW_ALTITUDE_ONLY`.
- High altitude does not guess `J_ROUTE` or `Q_ROUTE` unless explicitly selected.

## 10. URL Validation Proof

URL validation applies before credentials are built:

- URL validator: `server/services/flight-plan-filing/provider.ts:272`
- Action URL validation: `server/services/flight-plan-filing/provider.ts:1019`
- Provider action uses validated URL before Authorization header: `server/services/flight-plan-filing/provider.ts:3048`

Allowed origins:

- LAB/test/validation: `https://ffspelabs.leidos.com/Website2/rest/`
- Production: `https://www.lmfsweb.afss.com/Website/rest/`, `https://lmfsweb.afss.com/Website/rest/`, `https://www.1800wxbrief.com/Website/rest/`, `https://1800wxbrief.com/Website/rest/`

Rejected before dispatch:

- `http://`
- unexpected host
- unexpected REST path
- unexpected port
- embedded URL credentials
- protocol-relative URLs
- cross-origin redirects are blocked without retaining credentials

## 11. Tests Executed

Focused pre-commit test:

- `npx tsx --test scripts/tests/flight-service-operation-presence.test.ts`
- Result: 5/5 passed.

Required gates:

- `npm run check`
- Result: PASS.

- `npm run test:flight-service:release`
- Result: PASS.
- Flight-service suite: 251/251 passed.
- Adjacent release tests: 30/30 passed.

- `npm run flight-service:wsdl-check`
- Result: PASS.
- LAB and production WSDL hashes matched: `1adb3b5b1c25124ac7e868db09700d121164f898d68bac0bd7645cc34ae57c4b`

No live provider command was run.

## 12. Regression Found

No filing regression was found.

One test-authoring issue was found while adding the operation-presence test:

- The first assertion expected an older `flightPlanFilingActions.includes(action)` route shape.
- Current code correctly validates through `filingLifecycleActionSchema.safeParse(req.body ?? {})`.
- Correction: test now asserts the current Zod enum route schema.

A second test-authoring issue was found:

- The test expected `CaseAction` to duplicate a literal union.
- Current runner correctly aliases `CaseAction = FlightPlanFilingAction`, which ties certification runner actions to the shared schema.
- Correction: test now asserts the shared action alias plus concrete case action arrays.

No runtime correction was needed.

## 13. Final Pre-Commit Result

PASS - NO FILING REGRESSION DETECTED

FILE, RETRIEVE/SYNC, AMEND, ACTIVATE, CANCEL, and CLOSE remain present, reachable, conditionally rendered, provider-connected, persisted, and covered by the release gate. The RouteSearch, URL validation, and diagnostic sanitizer changes are isolated from provider filing behavior except for the explicitly authorized safety/privacy changes.

