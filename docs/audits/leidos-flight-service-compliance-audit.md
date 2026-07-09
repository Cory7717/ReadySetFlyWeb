# Leidos Flight Service Compliance Audit

Audit date: 2026-07-09  
Scope: RSF ICAO filing, lifecycle, LAB safety, provider synchronization, saved plans, and certification tooling  
Disposition: **Do not invite external LAB review yet**

## 1. Executive Summary

RSF has substantial Flight Service coverage. The core payload builder implements ICAO FILE and AMEND fields, departure-airport timezone conversion, DOF injection, ZZZZ location expansion, RMK/Field 18 separation, contact/home-base transmission, lifecycle state controls, versionStamp recovery, provider-change review, LAB acknowledgement, certification-plan cleanup, range selection, and inter-case delay.

The integration is not ready for Sean and Will to review without qualifications. Four issues should be resolved first:

1. **Credentialed filing is not implemented.** Leidos requires the pilot's `webUserName` and pilot authorization for credentialed services and for ATC route-change visibility. RSF never sends `webUserName`. Its provider-change UI can process pushed/retrieved changes, but the documented prerequisites for receiving ATC `expectedRoute` changes are absent.
2. **The webhook acknowledgement does not match the Leidos contract.** Leidos documents `{"success":"true"}`; RSF returns `{"ok":true}`.
3. **Webhook logs can disclose provider payload PII.** Missing-identifier pushes log the complete body. Leidos documents that flight-plan supplementary data includes PII-restricted fields.
4. **The complete regression set is not green or part of the standard npm gate.** `npm run test:flight-service` passed 34/34 on 2026-07-09, but the broader filing validation command produced 47 passes and 8 failures. Several are date-expired fixtures; others cover ZZZZ, equipment, lifecycle, and provider-review assertions. A green subset must not be presented as complete certification evidence.

No production filing was attempted during this audit. No implementation code was changed.

## 2. Overall Readiness Rating

**Rating: 6/10 - PARTIAL, not ready for external LAB review**

The core filing path is credible and recent fixes are present. Readiness is held back by the credentialed-service gap, webhook contract/security issues, incomplete authoritative documentation capture, and a misleadingly narrow default test command.

### Source hierarchy used

1. [Leidos Flight Planning](https://lmfswebservices.atlassian.net/wiki/spaces/WSS/pages/1605682/Flight%2BPlanning)
2. [Leidos General Flight Plan Filing Questions](https://lmfswebservices.atlassian.net/wiki/spaces/WSS/pages/2691170306)
3. [Leidos Push Notifications](https://lmfswebservices.atlassian.net/wiki/spaces/WSS/pages/1605681)
4. [Leidos Authentication and Authorization](https://lmfswebservices.atlassian.net/wiki/spaces/WSS/pages/1605656)
5. [Leidos ICAO Flight Plan Fields](https://lmfswebservices.atlassian.net/wiki/spaces/WSS/pages/2828500995)
6. [Leidos RetrieveFlightPlan - ATC Route Change](https://lmfswebservices.atlassian.net/wiki/spaces/WSS/pages/2724823044)
7. [FAA AIP Appendix 1, FAA Form 7233-4](https://www.faa.gov/air_traffic/publications/atpubs/aip_html/appendix1.html)
8. [FAA ICAO Flight Planning Interface Reference Guide](https://www.faa.gov/sites/faa.gov/files/about/office_org/headquarters_offices/ato/FAA_ICAO_flight_planning_interface_ref_guide.pdf)

The Leidos `WebService.xml` URL is linked by Leidos but was not retrievable by the audit environment. The repository does not contain a frozen copy, WSDL-derived schema, or vendor filing manual. WSDL-only details are therefore marked **NEEDS LEIDOS CONFIRMATION** rather than PASS.

## 3. Critical Blockers

### B1. Credentialed filing and ATC route-change prerequisites are absent

- **Source:** Leidos Authentication, "Credentialed Web Services"; Leidos ATC Route Change, requirements 1-3.
- **Evidence:** `buildLeidosActionPayload()` sends pilot name/contact fields but never `webUserName` (`server/services/flight-plan-filing/provider.ts:1546-1567`). Repository search found no Flight Service payload use of `webUserName`.
- **Impact:** RSF cannot claim documented access to pilot-specific ATC notices or `expectedRoute` changes. The local review workflow is implemented, but its live upstream prerequisite is not.
- **Fix:** Add a Leidos pilot identity/authorization model, retrieve/check pilot profile and `atcNotices`, send `webUserName`, and add a coordinated LAB route-change test.

### B2. Webhook acknowledgement contract is wrong

- **Source:** Leidos Push Notifications states the webhook is expected to return JSON `{"success":"true"}`.
- **Evidence:** `server/routes.ts:21965-22324` returns `{"ok":true}` for accepted, unmatched, and internal-error paths.
- **Impact:** Leidos may treat deliveries as unacknowledged or behave differently from RSF's retry assumptions.
- **Fix:** Return the documented body on every authenticated accepted delivery and add an HTTP contract test.

### B3. Webhook logs can contain PII

- **Source:** Leidos ICAO Flight Plan Fields identifies pilot fields as PII-restricted; RSF checklist SF-47 requires redaction.
- **Evidence:** `server/routes.ts:22042-22048` logs `body: payload` when no flight identifier is found. The webhook comment also calls for logging the full raw payload.
- **Impact:** Pilot, phone, route, and supplementary flight-plan data can enter application logs.
- **Fix:** Log an allowlisted structural summary and hashes/IDs only; add tests that assert phone, name, pilotData, and supplementary fields never appear in logs.

### B4. Release test gate is incomplete and currently red

- **Evidence:** `package.json` runs seven files under `npm run test:flight-service`, but omits `scripts/tests/flight-plan-filing-validation.test.ts`, workflow, sorting, webhook-format, and endpoint-security tests.
- **Audit execution:** standard suite: **34/34 PASS**. Broader focused suite: **47 PASS / 8 FAIL**.
- **Impact:** Current CI evidence can report green while important filing regressions are failing.
- **Fix:** Make fixtures relative to the test clock, repair genuine assertion drift, and create one release-gate script containing every Flight Service test.

## 4. Issues to Fix Before Sean/Will Review

1. Freeze the current Leidos `WebService.xml` and vendor notes under a versioned, access-controlled documentation location, with retrieval date and checksum.
2. Confirm whether REST CLOSE/CANCEL should include `versionStamp`. Leidos's public close example omits it; RSF currently sends it when available.
3. Add provider-contract tests for webhook Basic authentication, exact success body, duplicate delivery idempotency, malformed payloads, and retrieval after `WebServicePushFlightChange`.
4. Verify the registered LAB webhook URL and credentials with Leidos. Code presence is not evidence that Leidos is configured to send pushes.
5. Add explicit filing-window validation: Leidos permits filing up to 27 days ahead and documents IFR amend/cancel cutoff behavior. RSF validates past time but does not visibly enforce the 27-day maximum or 46-minute IFR cutoff locally.
6. Re-run all 15 live LAB cases after the test gate is repaired. The latest report retained in the repository is from 2026-07-04 and contains one executed case, not a current full-suite pass.

## 5. Nice-to-Have Improvements

- Replace environment-defined default type-of-flight/surveillance values in provider configuration with typed, profile-derived values only.
- Generate TypeScript response/request types from the frozen Leidos schema.
- Record WSDL/release-note version in every certification artifact.
- Add clock injection to all date-sensitive tests.
- Test the 27-day boundary, IFR ARTCC cutoff, overdue close, terminal purge, and provider response field omission explicitly.
- Add a health check that verifies LAB hostname, webhook registration state, credentialed pilot authorization, and ATC Notices before a certification run.

## 6. Compliance Matrix

Status values are PASS, PARTIAL, MISSING, NOT APPLICABLE, and NEEDS LEIDOS CONFIRMATION.

| Requirement | Source / section | Implementation evidence | Test evidence | Status | Recommendation |
|---|---|---|---|---|---|
| ICAO flight plan filing | FAA AIP Appendix 1; Leidos Flight Planning | `provider.ts:1488-1680` builds ICAO form payload | payload-build, validation, generated scenarios | PASS | Keep schema aligned to WSDL |
| FILE | Leidos Flight Planning, filing example | configurable FILE path and provider ID parsing, `provider.ts:2400-2756` | live runner cases 1-15; provider ID test | PASS | Add direct HTTP contract test |
| AMEND | Leidos Flight Planning, Amending | latest versionStamp and full payload, `provider.ts:1648-1650,2442-2492` | live cases 8-9; lifecycle tests | PASS | Confirm IFR cutoff handling |
| ACTIVATE | Leidos Flight Planning, Activating; General Questions VFR | VFR/PROPOSED guard and actual departure instant, `provider.ts:1695-1701,2335-2356` | live cases 7,9; dynamic timing metadata | PASS | Boundary-test +/-30 minutes |
| CLOSE | Leidos Flight Planning, Cancelling/Closing | VFR ACTIVE guard, overdue close location, terminal success handling | live cases 7,9; overdue-close test | PASS | Confirm versionStamp request policy |
| CANCEL | Leidos Flight Planning, Cancelling/Closing | PROPOSED guard and terminal result handling | live cleanup and lifecycle matrix | PASS | Confirm no-stamp terminal behavior with Leidos |
| RETRIEVE | Leidos Flight Planning; Push Notifications | retrieve, retry, metadata snapshot, `provider.ts:1740-1851` | retrieve-compare tests | PASS | Add real webhook-to-retrieve integration test |
| Filing horizon and lifecycle cutoffs | Leidos General Questions | past-time and state guards exist; 27-day and IFR 46-minute cutoff not evident | no boundary coverage | PARTIAL | Enforce/test documented windows |
| LAB vs Production gating | RSF LAB config; Leidos test/operations separation | production requires environment plus explicit flag; LAB acknowledgement; endpoint assertion | environment tests and runner fail-closed test | PASS | Add deployment configuration evidence |
| Pilot profile requirements | Leidos Authentication; ATC Route Change | RSF pilot name/phone exists, but no Leidos pilot `webUserName`, authorization, or `atcNotices` check | no credentialed filing test | MISSING | Implement credentialed pilot integration |
| Aircraft profile requirements | FAA required fields; WSDL details unavailable | profile readiness and filing defaults in `server/routes.ts:2144-2243` and schema | profile-related filing validation | PARTIAL | Validate requirements against frozen WSDL |
| Phone number | Sean SF-20; Leidos supplementary fields | required and sent as `pilotPhone`, `provider.ts:1566,2241-2243` | validation and payload-build tests | PASS | Confirm exact WSDL field constraints |
| Aircraft home base | Sean SF-21; Leidos supplementary profile model | required and sent as `aircraftHomeBase`, `provider.ts:1567,2247-2249` | validation and payload-build tests | PASS | Confirm exact WSDL field constraints |
| Aircraft identifier/type/WTC | FAA Appendix 1 Items 7/9 | required, ZZZZ type uses TYP/, WTC required | validation and ZZZZ tests | PASS | Add WTC/type compatibility test |
| Equipment codes | FAA Interface Guide Field 10a | known-code, duplicate, and Flight Service subset validation | equipment negative tests | PASS | Reconcile allowed list to current WSDL |
| PBN | FAA Interface Guide: R requires PBN/ | bidirectional/dependency validation | multiple negative PBN tests | PASS | Add all WSDL-supported PBN combinations |
| Surveillance | FAA Interface Guide Field 10b/SUR | separate field and supported compact-code validation | surveillance negative tests | PARTIAL | Current Flight Service subset N/A/C/S needs Leidos confirmation |
| Special Z equipment | FAA Interface Guide: Z requires NAV/COM/DAT/ | warning/dependency logic in `shared/icao-readiness.ts` | partial readiness tests | PARTIAL | Block invalid Z combinations, not only warn |
| Field 18 prefixes | FAA Appendix 1; Leidos ICAO Fields | parser/guidance covers STS/PBN/NAV/COM/DAT/SUR/DEP/DEST/DOF/REG/EET/SEL/TYP/CODE/DLE/OPR/ORGN/PER/ALTN/RALT/TALT/RMK | guidance completeness test | PARTIAL | Validate grammar, duplicates, lengths, and ordering against WSDL |
| RMK stays in Other Info | Leidos ICAO Fields: RMK pertains to Field 18 | `buildOtherInfoWithRemarks`, `provider.ts:1109`; supplemental remains separate | RMK preservation/collapse tests | PASS | Preserve |
| Supplemental remarks | Leidos ICAO Fields: use `supplementalRemarksExtended` | separate payload field; ZZZZ names remain in Other Info | remarks and retrieve tests | PASS | Confirm whether ordinary RSF notes should ever enter Field 19 |
| ZZZZ departure DEP/ | FAA Appendix 1 Departure | `buildZzzzOtherInfoForLeidos`, `provider.ts:1450-1486` | ZZZZ departure tests | PASS | Repair broader stale tests |
| ZZZZ destination DEST/ | FAA Appendix 1 Destination | same builder | ZZZZ destination tests | PASS | Preserve |
| ZZZZ alternate ALTN/ | FAA Appendix 1 Alternate | same builder | ZZZZ alternate tests | PASS | Preserve |
| DOF injection | FAA Appendix 1 Item 18 DOF/ | operational local-date logic, `shared/flight-plan-filing-workflow.ts:126-208` | same-day/future workflow tests | PASS | Use clock-controlled tests |
| Local-to-Zulu conversion | FAA departure time is UTC | airport-timezone resolver overrides stale browser/server zone | Central/Phoenix/ZZZZ tests | PASS | Add DST gap/overlap tests |
| Activation timing | Leidos General Questions: +/-30 minutes | lifecycle cases use departure airport local now +15 minutes and precheck | runner report fields and case logic | PASS | Add runner unit test independent of live execution |
| versionStamp | Leidos Flight Planning: latest stamp for modifications | extraction/retrieve recovery for AMEND/ACTIVATE; terminal absence informational | lifecycle and live runner evidence | PASS | Clarify CLOSE/CANCEL request requirement |
| Terminal response without versionStamp | Leidos close example returns success without stamp | INFO event and success based on `returnStatus=true` | live case 7 behavior; runner terminal verification | PASS | Add provider-class unit test |
| Push notifications/webhooks | Leidos Push Notifications | Basic auth, payload parsing, persistence, notification creation | mock scenario only; no HTTP contract/live push test | PARTIAL | Fix response body, PII logs, and test live registration |
| Provider route changes | Leidos ATC Route Change | expected/provider route snapshot and non-overwrite review flags | route object/normalization tests | PARTIAL | Blocked by missing credentialed filing/ATC Notices |
| User acknowledgement before overwrite | Leidos ATC route acceptance behavior; Sean SF-35 | `providerPendingReview` blocks actions; explicit accept endpoint | provider-review validation test exists but broader suite currently fails | PARTIAL | Repair test and prove live push flow |
| Saved flight-plan history | RSF product requirement | persisted payload/snapshot/messages/history and current/past sorting | sorting/lifecycle tests | PASS | Add migration/backfill test |
| LAB test-plan marking | RSF safety requirement | `LAB TEST PLAN` badge and filtered history, `flight-planner.tsx:10048-10100` | no UI-render test for badge | PARTIAL | Add component test/screenshot |
| Certification cleanup | RSF safety requirement | current-run plan list; terminal skip/local close fallback; no background sync | runner cleanup summaries and route logic | PASS | Add endpoint tests for each blocked reason |
| Runner range/resume | RSF certification requirement | `--start-case`, `--end-case`, `--only-cases`, selection report | code inspection only | PARTIAL | Add CLI selection unit tests |
| Runner delay | RSF certification requirement | countdown before every case after first in confirmed non-dry runs, `live-lab-runner.ts:1742-1753` | report records applications; no clock test | PARTIAL | Add fake-clock delay test |
| Negative cases blocked locally | RSF/Sean requirement; FAA field rules | validation runs before provider stage; negative cases 10-15 | standard suite passes; broader suite has failures | PARTIAL | Repair and include all negative tests in release gate |
| Fuel/endurance | FAA Appendix 1 Item 19; Leidos file example | endurance required and sent ISO duration | missing-endurance test | PASS | Clarify gallons are planning-only, not provider endurance |
| Persons on board | FAA Item 19; Leidos ICAO fields | required, sent `peopleOnBoardExtended` | operational-default test only | PARTIAL | Confirm field name/format from WSDL |
| Aircraft color | FAA Item 19; Leidos recommends `aircraftColorExtended` | required and normalized to extended field | no focused format test | PARTIAL | Test allowed colors and 1-500 constraint |
| Type of flight | FAA Appendix 1 Item 8 | required and sent | operational-default test | PARTIAL | Validate only G/S/N/M/X |
| Altitude and speed formatting | FAA Appendix 1 Item 15 | knots and A/F fields emitted | payload scenarios | PARTIAL | Add exact A/F threshold/format tests |
| Route formatting | FAA Appendix 1 Item 15 | normalization and provider-change comparison | workflow and live round-trip tests | PASS | Add airway/procedure/lat-long grammar cases |
| Data retention/log redaction | Leidos PII notes; Sean SF-47 | outbound logs redact selected payload fields | webhook raw-body path violates policy | MISSING | Remove raw payload logging before review |

## 7. Test Coverage Matrix

| Suite / evidence | Result on 2026-07-09 | Coverage | Audit assessment |
|---|---:|---|---|
| `npm run test:flight-service` | 34/34 pass | core validation, payload, route comparison, lifecycle buttons, ZZZZ, remarks, generated scenarios | Useful but incomplete |
| Focused broader test command | 47/55 pass | detailed timezone, ZZZZ, equipment, RMK, lifecycle, provider review, sorting, webhook formatting, auth route | Release blocker until green |
| Latest retained live LAB report | 1 case pass, cleanup PASS, 2026-07-04 | one selected provider case | Not full-suite evidence |
| Stress report retained in repo | 74/74 pass, 2026-07-01 | generated/mock stress scenarios | Does not prove current Leidos behavior |
| Webhook live delivery | no evidence found | provider push, retrieve-after-push, browser update | Missing |
| Credentialed ATC route change | no evidence found | `webUserName`, authorization, ATC Notices, `expectedRoute` | Missing |
| UI badge/history review | implementation found, no automated render proof | LAB badge, cleanup action, past/current placement | Partial |

The eight broader-suite failures were at:

- ZZZZ planning-reference timezone readiness
- ZZZZ actual-location readiness
- ZZZZ aircraft type/TYP readiness
- equipment dependency warning expectation
- equipment/surveillance separation readiness
- one fixed-date DOF expectation
- lifecycle matrix readiness
- provider-push review readiness

Several plans use June 22 or July 2, 2026 and are now rejected as past departures. The suite needs clock control before remaining failures can be classified as implementation defects versus stale fixtures.

## 8. Documentation Gaps / Questions for Leidos

1. Provide/export the current LAB `WebService.xml`, REST endpoint definitions, and release version approved for RSF.
2. Must REST CLOSE and CANCEL include the latest `versionStamp`, or is it ignored/optional as the public example implies?
3. Confirm exact request/response field names and constraints for `pilotPhone`, `aircraftHomeBase`, `peopleOnBoardExtended`, `aircraftColorExtended`, and terminal lifecycle responses.
4. Confirm the currently accepted surveillance subset for RSF. The implementation limits direct values to N, A, C, or S.
5. Confirm Field 18 ordering, duplicate-prefix rules, character set, and maximum length.
6. Confirm whether RSF must use credentialed filing for all user plans or only for ATC notices/provider route-change functionality.
7. Confirm whether the pilot must accept an ATC route change on Leidos before RSF should treat `expectedRoute` as effective, and what RSF should display before acceptance.
8. Confirm webhook retry behavior for 401, 5xx, malformed success bodies, and processing failures.
9. Confirm LAB webhook registration, source addresses, authentication mode, and a test window for `WebServicePushFlightChange`.
10. Confirm terminal-plan retrieval/purge timing and the correct local fallback when CLOSED/CANCELLED plans are no longer retrievable.

## 9. Recommended Email Summary for Sean and Will

Subject: RSF Flight Service LAB review readiness update

Sean and Will,

We completed a documentation-led audit of RSF's Flight Service integration against the current public Leidos support pages and FAA ICAO filing guidance. Core FILE/AMEND/ACTIVATE/CLOSE/CANCEL behavior, ICAO Field 18 handling, ZZZZ locations, timezone conversion, DOF, versionStamp handling, LAB gating, provider-change review, and certification cleanup are implemented.

Before scheduling the next LAB review, we are closing four evidence gaps: credentialed pilot filing/ATC-notice support, the exact webhook acknowledgement contract, webhook log redaction, and consolidation of all filing regression tests into one green release gate. We also need a current copy of `WebService.xml` and confirmation of several WSDL-specific field constraints.

Once those items are complete, we will send a frozen test report and propose a coordinated LAB push/ATC route-change test window.

## 10. Exact Follow-up Codex Prompts

### Prompt A - credentialed filing

> Implement Leidos credentialed Flight Service filing in RSF. Add a secure per-user Leidos pilot identity model, send `webUserName` for credentialed FILE/RETRIEVE/lifecycle calls, represent pilot service-provider authorization and `atcNotices`, block credentialed features with actionable errors when authorization is absent, and add tests. Do not log credentials. Preserve anonymous/LAB certification behavior behind explicit configuration.

### Prompt B - webhook contract and redaction

> Fix the Leidos Flight Service webhook to match the documented contract. Return exactly `{"success":"true"}` for authenticated accepted deliveries, preserve intentional retry behavior for authentication failures, remove all raw flight-plan payload logging, add allowlisted redacted structured logs, and add HTTP tests for auth, success body, malformed payload, duplicate delivery, unmatched plan, and internal processing failure.

### Prompt C - release test gate

> Consolidate every Flight Service unit/regression test into one `npm run test:flight-service` release gate. Include `scripts/tests/flight-plan-filing-validation.test.ts`, workflow, saved-plan sorting, provider notification formatting, and route security tests. Replace fixed past dates with an injected/frozen clock, investigate all remaining failures, and do not weaken assertions merely to make the suite green.

### Prompt D - WSDL contract capture

> Add a versioned Leidos contract audit workflow. Securely capture the current LAB `WebService.xml`, record retrieval date and SHA-256, generate or maintain typed request/response fixtures for FILE/AMEND/ACTIVATE/CLOSE/CANCEL/RETRIEVE and push notifications, and add a contract-diff check that flags vendor schema changes without committing credentials or private account data.

### Prompt E - filing-window validation

> Implement and test the documented Leidos filing/lifecycle windows: maximum 27 days before ETD, VFR activation within +/-30 minutes of current time, IFR amend/cancel cutoff behavior, two-hours-past-ETD behavior, and overdue VFR close requirements. Use an injected clock and classify local validation, provider rejection, and test-setup failures separately.

### Prompt F - full evidence run

> After the Flight Service release gate is green, run a fresh Leidos LAB certification evidence cycle for cases 1-15 with `--delay-minutes 3`, verify the recorded delay before every case after the first, execute cleanup only for plans created by that run, run the post-run audit, and produce JSON/HTML/PDF artifacts plus a concise blocker/warning/info summary. Do not use production endpoints or enable operational filing.
