# Leidos Developer Reference Packet Audit - 2026-07-13

Source packet: `c:\Users\carme\Downloads\RSF_Leidos_Developer_Reference_Packet_2026-07-13.md`

Audit date: 2026-07-13

## Baseline

Repository commit: `3f1592682b63570ce57d56c8d1d9bd612687f1bc`

Working tree: not clean. The Phase 1 Flight Service lifecycle remediation is present as uncommitted changes and is included in this audit because it materially affects compliance.

Changed files at audit time:

- `client/src/pages/flight-planner.tsx`
- `package.json`
- `server/routes.ts`
- `server/services/flight-plan-filing/provider.ts`
- `server/services/flightServiceOpsConsole.ts`
- `shared/schema.ts`
- `migrations/0114_add_flight_service_provider_action_attempts.sql`
- `scripts/tests/flight-service-lifecycle-integrity.test.ts`

Provider requests sent: **No**

Production filing enabled: **No**

## WSDL Metadata

| Environment | URL | Status | Bytes | SHA-256 | Retrieved |
| --- | --- | ---: | ---: | --- | --- |
| LAB | `https://ffspelabs.leidos.com/Website2/resources/doc/WebService.xml` | 200 | 734434 | `7b7e71c22d2f8d2b2d67c1fc4fc3796f856f1d7be8dfecc83a6d716ef63b5082` | `2026-07-13T10:17:07.0122122-05:00` |
| Production | `https://www.1800wxbrief.com/Website/resources/doc/WebService.xml` | 200 | 734434 | `7b7e71c22d2f8d2b2d67c1fc4fc3796f856f1d7be8dfecc83a6d716ef63b5082` | `2026-07-13T10:17:08.2874180-05:00` |

Observation: LAB and production WSDL content matched by checksum during this audit.

## Verification

Command run:

```powershell
npm run test:flight-service:release
```

Result: PASS

- `npm run check`: PASS
- `npm run test:flight-service`: PASS, 144 tests
- Adjacent release-gate tests: PASS, 28 tests

No live LAB runner, certification evidence generator, or live provider command was run.

## Executive Summary

RSF is substantially aligned with the developer packet for non-credentialed LAB filing, lifecycle integrity, route assist, ICAO payload construction, webhook duplicate handling, privacy redaction, and fail-closed LAB/production separation.

The remaining gaps are mostly in three areas:

1. Credentialed pilot filing and ATC Notices are not implemented.
2. Unknown FILE outcome reconciliation still needs a Leidos-confirmed procedure when no `flightIdentifier` is returned.
3. Ops/SAR support mode still has placeholder fields and local-time/retention gaps.

External LAB review can proceed for the non-credentialed provider lifecycle workflow after the Phase 1 changes are committed and migrated, but credentialed filing/ATC route-change review should be explicitly marked out of scope unless Leidos asks to cover it.

## Requirement Crosswalk

| ID | Requirement | Classification | Priority | Evidence | Risk / Action |
| --- | --- | --- | --- | --- | --- |
| LDR-001 | WSDL is the structural authority; inspect LAB and production separately. | Implemented and verified | P1 | WSDL metadata above; matching checksums. | Re-check before each certification run. |
| LDR-002 | Vendor Basic auth server-side only, no credentials in logs. | Implemented and verified | P1 | Provider enablement/auth config in `server/services/flight-plan-filing/provider.ts:230`; webhook auth in `server/services/flight-plan-filing/provider.ts:2308`. | Continue secret handling review before production. |
| LDR-003 | Credentialed pilot actions require pilot Leidos authorization and `webUserName`/equivalent documented field. | Not implemented | P2 | Search found no `webUserName` implementation. Packet says do not add unless confirmed; prior direction also said do not add credentialed filing. | Do not treat as LAB blocker for non-credentialed review. Requires Leidos coordination before implementation. |
| LDR-004 | VFR supports FILE, AMEND, ACTIVATE, CANCEL, CLOSE; IFR supports FILE, AMEND, CANCEL only. | Implemented and verified | P1 | UI action logic in `client/src/pages/flight-planner.tsx:500`, `client/src/pages/flight-planner.tsx:510`; tests at `scripts/tests/flight-plan-filing-validation.test.ts:825`, `:833`, `:842`, `:843`. | Keep IFR ACTIVATE/CLOSE blocked. |
| LDR-005 | FILE success must persist `flightIdentifier` and `versionStamp`; never fabricate provider ID. | Implemented, with one open reconciliation question | P1 | Extraction in `server/services/flight-plan-filing/provider.ts:2001`; missing provider ID path at `server/services/flight-plan-filing/provider.ts:2887`; outcome-unknown handling in `server/routes.ts:24675`, `:24811`, `:24818`. | Need Leidos answer for timeout/no-flightIdentifier reconciliation procedure. |
| LDR-006 | AMEND/ACTIVATE require latest `versionStamp`; stale version must not overwrite newer state. | Implemented and verified | P1 | Version extraction/retrieve in `server/services/flight-plan-filing/provider.ts:2652-2698`; webhook lower-version guard in `server/routes.ts:22247`; tests at `scripts/tests/flight-service-lifecycle-integrity.test.ts:71`. | Needs Leidos confirmation that versionStamp is strictly monotonic, but current behavior is conservative. |
| LDR-007 | HTTP 2xx is not enough; inspect `returnStatus` and messages. | Implemented and verified | P1 | `returnStatus` parsing/rejection in `server/services/flight-plan-filing/provider.ts:2811`, `:2814`; Route Assist response handling at `server/services/flight-plan-filing/provider.ts:2207`, `:2223`. | Add deeper coded-message classification later. |
| LDR-008 | Transport failure after possible dispatch becomes unknown outcome, not ordinary staged retry. | Implemented and verified | P0 | New status in `shared/schema.ts:32`; action handling in `server/routes.ts:24811`, `:24818`; tests at `scripts/tests/flight-service-lifecycle-integrity.test.ts:52`. | Reconciliation procedure still requires Leidos confirmation. |
| LDR-009 | Public create/PATCH must not set provider-owned fields. | Implemented and verified | P0 | Reject list/schema in `server/routes.ts:168-183`; create/PATCH guards in `server/routes.ts:25275-25279`, `:25345-25349`; tests at `scripts/tests/flight-service-lifecycle-integrity.test.ts:11`. | Commit migration/code together. |
| LDR-010 | Durable multi-instance provider action idempotency. | Implemented and verified | P0 | Table in `shared/schema.ts:3120`; migration unique indexes in `migrations/0114_add_flight_service_provider_action_attempts.sql:33-39`; reservation in `server/routes.ts:230`, call at `server/routes.ts:24599`; tests at `scripts/tests/flight-service-lifecycle-integrity.test.ts:33`. | Uses DB reservation before provider dispatch; does not hold a network transaction open. |
| LDR-011 | Webhook auth, durable duplicate fingerprint, idempotent exact duplicates. | Implemented and verified | P1 | Auth route call in `server/routes.ts:23241`; webhook events table already exists; acknowledgement in `server/services/leidosWebhook.ts:1`; tests include `scripts/tests/leidos-webhook-contract.test.ts:8`. | Keep Basic webhook credentials rotated outside code. |
| LDR-012 | Webhook monotonic ordering and terminal state cannot regress. | Implemented conservatively | P1 | Ordering guard in `server/routes.ts:22247`; applied at `server/routes.ts:23677`, `:23719`; tests at `scripts/tests/flight-service-lifecycle-integrity.test.ts:71`. | Requires Leidos confirmation on versionStamp ordering. |
| LDR-013 | Persist canonical webhook provider state before notification/push; push failure must not roll back. | Implemented and verified | P1 | Persistence before post-persistence notification/push in `server/routes.ts:23677`, `:23719`, `:23742`; tests at `scripts/tests/flight-service-lifecycle-integrity.test.ts:60`. | There is legacy commented code in the file around the old notification block; it is not active but should be cleaned in a formatting pass. |
| LDR-014 | Do not persist raw webhook payload in user-visible notification records. | Implemented and verified | P1 | Safe summary in `server/services/leidosWebhook.ts:5`; notification meta uses `payloadSummary` in `server/routes.ts:23742`; tests at `scripts/tests/flight-service-lifecycle-integrity.test.ts:79`. | Continue redaction tests when notification schema changes. |
| LDR-015 | Do not persist complete raw provider request payloads or pilot PII in diagnostics. | Implemented and verified | P1 | Redaction in `server/services/flight-plan-filing/provider.ts:1086`; raw request payload removed; Other Info log redacted at `server/services/flight-plan-filing/provider.ts:2743`; tests at `scripts/tests/flight-service-lifecycle-integrity.test.ts:79`. | Operational payload still correctly sends pilot phone/name to provider where required. |
| LDR-016 | Route Assist includes documented `SearchPathOptionType`. | Implemented and verified | P2 | Constant `LOW_ALTITUDE_ONLY` in `server/services/flight-plan-filing/provider.ts:31`, used at `:2146`; test at `scripts/tests/flight-service-route-assist-display.test.ts:16`. | Add coded no-route vs validation-failure parsing later. |
| LDR-017 | Field 18 RMK and Field 19 supplemental remarks remain separate; prefer `supplementalRemarksExtended`. | Implemented and verified | P1 | Redaction includes `pilotInCommandExtended`; payload fields at `server/services/flight-plan-filing/provider.ts:1653`; tests in `scripts/tests/flight-plan-filing-validation.test.ts`. | Continue comparing against WSDL/Leidos examples. |
| LDR-018 | Equipment, surveillance, PBN, NAV/COM/DAT/SUR, ZZZZ, alternates, DOF, endurance, and route syntax cross-field validation. | Implemented and verified for current scope | P1 | ICAO helpers in `shared/icao-filing.ts`; readiness in `shared/icao-readiness.ts:51`; fuel payload at `server/services/flight-plan-filing/provider.ts:1639`, `:1647`; tests include fuel at `scripts/tests/flight-plan-fuel.test.ts:168-169`. | Add FAA ERAS-specific ACK/REJ matrix later if needed. |
| LDR-019 | ATC route-change / `expectedRoute` flow for credentialed filing. | Partially implemented | P2 | Expected route is parsed/stored in webhook path `server/routes.ts:23281`, `:23569`; provider review accept UI exists at `client/src/pages/flight-planner.tsx:7090`, `:10633`, `:11155`. | Full ATC Notices flow requires credentialed filing and coordinated Leidos simulation; do not run in live ops. |
| LDR-020 | Environment isolation and production fail-closed. | Implemented and verified | P0 | Runtime mode production flag in `server/services/flightServiceRuntimeMode.ts:22`; provider live flag in `server/services/flight-plan-filing/provider.ts:230`; release tests pass. | Keep production filing disabled until written Leidos authorization. |
| LDR-021 | Mocked vs live evidence must be clearly separated. | Implemented and verified | P2 | `package.json:31` adds non-writing release gate; certification scripts remain separate in `package.json:33-42`. | Avoid using mocked report as provider evidence. |
| LDR-022 | Ops/SAR support needs Zulu/local-time accuracy, retention, contact completeness, provenance. | Partially implemented | P2 | Ops status treats outcome-unknown as open in `server/services/flightServiceOpsConsole.ts:120`; gaps at `:151` local time same as UTC, `:194` retention TODO, `:241` emergency contact null, `:268` support placeholder. | Not a provider lifecycle blocker, but should be fixed before SAR/support demo. |

## Findings by Classification

### Implemented and Verified

- WSDL metadata was captured for LAB and production.
- Non-live release gate passes.
- Public mutation boundary rejects provider-owned fields.
- Durable provider action attempt table and active-action unique index exist.
- Unknown provider outcome is represented explicitly.
- Webhook auth, duplicate idempotency, ordering guard, and state-first persistence are present.
- Raw provider request payloads and raw webhook payloads are no longer persisted in the reviewed paths.
- Route Assist uses documented `LOW_ALTITUDE_ONLY`.
- VFR/IFR action eligibility is enforced.
- ICAO validation coverage is broad for current RSF scope.
- Production filing remains fail-closed.

### Partially Implemented

- ATC route-change review is partially present via `expectedRoute`, provider pending review, and accept-provider-change UI, but the credentialed ATC Notices workflow is not complete.
- Ops/SAR console is useful but still has placeholder/contact/retention/local-time gaps.
- Unknown FILE outcome reconciliation blocks blind retry but the exact no-`flightIdentifier` retrieval procedure requires Leidos confirmation.

### Not Implemented

- Credentialed pilot filing / `webUserName` support.
- Full coordinated ATC Notices LAB test flow.
- Automated WSDL drift detection in CI.

### Requires Leidos Confirmation

- Exact reconciliation procedure after FILE may have dispatched but RSF has no `flightIdentifier`.
- Whether `versionStamp` is strictly monotonic and authoritative for webhook ordering.
- Delayed webhook behavior after CLOSED/CANCELLED.
- Route Search coded-message taxonomy for no-route vs request validation failure.
- ARTCC-specific IFR amend/cancel cutoffs, including Release 11.3 behavior.
- Retention/redaction expectations for support diagnostics.
- Final Sean/Will evidence package contents.

## Priority Plan

### P0 - Before External LAB Provider Review

1. Commit and deploy the Phase 1 lifecycle integrity changes with migration `0114`.
2. Confirm the API database has the provider action attempt table and partial unique indexes.
3. Keep production filing disabled.
4. Use `npm run test:flight-service:release` as the non-live release gate.

### P1 - Before Sean/Will Deep Review

1. Ask Leidos for written guidance on unknown FILE outcome reconciliation.
2. Ask Leidos whether `versionStamp` is authoritative for webhook ordering.
3. Clean the old commented webhook notification block in `server/routes.ts` in a small formatting-only pass.
4. Add WSDL checksum drift reporting to the evidence packet.

### P2 - Before Certification Package or SAR Demo

1. Decide whether credentialed filing/ATC Notices are in scope.
2. Fix Ops/SAR local time, retention notice, support contact, and secondary/emergency contact fields.
3. Add Route Search coded-message classification tests.
4. Add FAA ERAS-specific test cases only where they affect RSF filing payload behavior.

## Release Gate

Use:

```powershell
npm run test:flight-service:release
```

Do not use these as default release-gate commands:

```powershell
npm run certification:leidos-live-lab
npm run test:flight-service:leidos
npm run certification:flight-service
```

The first two can send provider or LAB-path requests when configured. The third writes mocked certification artifacts.

## Final Verdict

Against the attached packet, RSF is **ready for non-credentialed Leidos LAB lifecycle review after the current Phase 1 changes are committed, migrated, and deployed**, with clear caveats:

- Credentialed filing and ATC Notices are not implemented.
- Unknown FILE reconciliation needs Leidos confirmation.
- Ops/SAR is not yet demo-polished.

No provider request was sent during this audit.
