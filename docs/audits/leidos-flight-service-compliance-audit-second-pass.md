# Leidos Flight Service Compliance Audit: Second Pass

Audit date: 2026-07-09

## Conclusion

The first audit was directionally useful but too aggressive about credentialed filing. RSF can use Leidos vendor-account filing without `webUserName`; Leidos describes `webUserName` as the mechanism for **credentialed** pilot services. It is required for the documented ATC `expectedRoute` workflow, but the available documentation does not make it a prerequisite for every FILE request.

Three findings remain confirmed blockers before Sean/Will LAB review:

1. The webhook success body does not match the documented Leidos body.
2. One webhook branch logs a raw provider payload that may contain flight or pilot data.
3. The advertised Flight Service test command omits relevant tests and can pass while the broader suite fails.

No production filing change is warranted. WSDL-only questions remain documentation confirmations.

## Sources

- [Leidos Authentication and Authorization](https://lmfswebservices.atlassian.net/wiki/spaces/WSS/pages/1605656/Authentication%2Band%2BAuthorization)
- [Leidos RetrieveFlightPlan - ATC Route Change](https://lmfswebservices.atlassian.net/wiki/spaces/WSS/pages/2724823044)
- [Leidos Push Notifications](https://lmfswebservices.atlassian.net/wiki/spaces/WSS/pages/1605681)
- [Leidos General Flight Plan Filing Questions](https://lmfswebservices.atlassian.net/wiki/spaces/WSS/pages/2691170306)
- [Leidos Flight Planning](https://lmfswebservices.atlassian.net/wiki/spaces/WSS/pages/1605682/Flight%2BPlanning)
- [Leidos ICAO Flight Plan Fields](https://lmfswebservices.atlassian.net/wiki/spaces/WSS/pages/2828500995/ICAO%2BFlight%2BPlan%2BFields)
- [FAA AIP Appendix 1](https://www.faa.gov/air_traffic/publications/atpubs/aip_html/appendix1.html)
- [FAA ICAO Flight Planning Interface Reference Guide](https://www.faa.gov/sites/faa.gov/files/about/office_org/headquarters_offices/ato/FAA_ICAO_flight_planning_interface_ref_guide.pdf)

## Finding Classification

Classification abbreviations:

- **CB:** Confirmed blocker
- **DC:** Documentation confirmation
- **BP:** Best-practice improvement
- **FP:** False positive or already implemented

| ID | Audit claim | Code evidence | Documentation evidence | Class | Recommended action | Risk if ignored | Suggested test |
|---|---|---|---|---|---|---|---|
| SP-01 | Credentialed filing is universally required | Payload intentionally lacks `webUserName`; vendor Basic auth is implemented in `provider.ts` | Leidos calls `webUserName` credentialed service and says pilot authorization is then required | DC | Ask Leidos/reviewers whether credentialed pilot filing is in review scope; do not add it speculatively | ATC notice features may be unavailable, but ordinary vendor filing is not shown invalid | Credentialed LAB test only after scope confirmation |
| SP-02 | ATC `expectedRoute` visibility requires credentialed filing | Webhook parses `expectedRoute`; no pilot authorization or `atcNotices` profile check exists | Leidos ATC Route Change lists credentialed filing, pilot authorization, and ATC Notices as prerequisites | DC | Confirm feature scope and coordinate a Leidos injected route-change test | RSF may demonstrate local review UI without receiving real ATC route changes | FILE credentialed IFR, injected route change, retrieve `expectedRoute` |
| SP-03 | Webhook acknowledgement body is wrong | `server/routes.ts` returns `{ok:true}` on accepted paths | Leidos Push Notifications expects `{"success":"true"}` | CB | Return the documented body on all authenticated accepted paths | Delivery may not be recognized as acknowledged | Route/helper contract test for exact body and value type |
| SP-04 | Webhook logs can expose PII/raw payloads | Missing-ID branch logs `body: payload`; normal summary logging is allowlisted | Leidos identifies pilot fields as PII-restricted | CB | Remove raw body and log keys/type only | Sensitive flight/pilot data in logs | Capture logger output and assert canary values absent |
| SP-05 | Standard test gate is incomplete | `package.json` omits detailed validation/workflow/history/notification/security tests | Internal release-evidence requirement, not a Leidos protocol rule | CB | Create one comprehensive release-gate command and make it green without weakening assertions | False green certification evidence | Run all Flight Service tests from one npm command |
| SP-06 | Current broader suite proves eight product defects | Most failures share expired fixed departure dates; standard suite remains green | No vendor rule makes expired fixtures product defects | FP | Replace time-sensitive fixture defaults with future-relative dates, then reassess | Persistent noisy failures hide real regressions | Future-relative or injected-clock tests |
| SP-07 | Current `WebService.xml` must be captured before LAB review | No local copy exists | Leidos links the XML; audit environment cannot retrieve it | DC | Request current XML/version; record checksum when supplied | WSDL-only assumptions remain unverified | Offline schema/fixture contract test |
| SP-08 | CLOSE/CANCEL versionStamp behavior is defective | RSF sends a stamp when available and accepts successful terminal responses without a returned stamp | Public close example omits request stamp and response stamp; WSDL unavailable | DC | Ask Leidos whether request stamp is optional/ignored; preserve working behavior | Speculative change could break proven cleanup | Fixture tests for terminal success with and without stamp |
| SP-09 | Webhook needs direct contract tests | No direct webhook HTTP suite; helper/format tests exist | Leidos defines Basic auth, JSON callback, and success body | BP | Add focused auth, malformed, unmatched, duplicate, and success tests | Regressions may reach LAB | Supertest or extracted-handler tests |
| SP-10 | Registered LAB webhook must be verified | Registration is external configuration and cannot be inferred from code | Leidos says Vendor Support must configure the URL | DC | Confirm URL/auth with Leidos outside code | Push review may appear broken despite correct code | Coordinated live push smoke test |
| SP-11 | RSF must locally enforce the 27-day filing horizon | Past-time validation exists; no 27-day maximum | Leidos documents filing up to 27 days ahead | BP | Add local UX validation after confirming boundary semantics | Provider rejects avoidable requests | 27-day boundary tests with injected clock |
| SP-12 | RSF must locally enforce IFR 46-minute cutoff | Lifecycle state guards exist; cutoff is not locally calculated | Leidos documents current cutoff and notes release-dependent changes | DC | Confirm current ARTCC/release behavior before enforcing | Hard-coded cutoff could become wrong; provider may reject late changes | Provider-fixture and boundary tests after confirmation |
| SP-13 | A fresh 15-case run is required before evidence freeze | Latest committed artifact is not a current full run | Certification process requirement | BP | Run after Phase 1 gate is green; do not run during code audit | Reviewers receive stale/incomplete evidence | Post-run audit verifies 15 selected/executed cases |
| SP-14 | Environment defaults should be removed | Plan values are validated; provider config still has defaults used as fallback | WSDL requirement not available | BP | Prefer typed profile values and keep fail-safe compatibility | Hidden defaults may obscure incomplete profiles | Payload test proving plan values win |
| SP-15 | Generate types from WSDL | Current parsing is defensive and untyped at provider boundary | XML exists but is unavailable locally | BP | Generate types after obtaining approved XML | Schema drift remains manual | Schema-diff CI test |
| SP-16 | Record contract version in reports | Reports identify suite/runtime but not WSDL checksum | No Leidos mandate found | BP | Add after contract capture | Evidence cannot identify vendor contract revision | Artifact metadata assertion |
| SP-17 | Date-sensitive tests need clock control | Detailed suite uses fixed June/July 2026 dates | Testing best practice | BP | Use injected clock or future-relative fixture data | Tests expire over time | Run with multiple clock dates |
| SP-18 | Certification health check should cover external setup | Runner checks LAB endpoint, account, flags, and profile completeness | Pilot authorization/ATC Notices are conditional external features | BP | Add capability-specific checks only when enabled | Ambiguous preflight failures | Dry-run diagnostics tests |
| SP-19 | ICAO FILE payload is missing | `buildLeidosActionPayload` emits complete ICAO payload | Leidos Flight Planning and FAA Appendix 1 | FP | No behavior change | None identified | Existing payload and live cases |
| SP-20 | FILE lifecycle behavior is missing | Provider ID/returnStatus parsing and persistence exist | Leidos Flight Planning FILE example | FP | Preserve | None identified | Provider ID and rejection fixtures |
| SP-21 | AMEND/versionStamp is missing | Latest stamp extraction/retrieve recovery and AMEND payload exist | Leidos says use latest versionStamp for modifications | FP | Preserve | None identified | Existing lifecycle tests plus stale-stamp fixture |
| SP-22 | ACTIVATE behavior/timing is missing | VFR state guard, current stamp, dynamic +15-minute runner timing | Leidos allows VFR activation within +/-30 minutes | FP | Preserve | None identified | Existing case 7/9 plus boundary unit test |
| SP-23 | CLOSE is mishandled when no stamp is returned | Terminal success uses returnStatus and missing response stamp is informational | Leidos close example returns success without stamp | FP | Preserve | None identified | Existing terminal response test should be expanded |
| SP-24 | CANCEL terminal handling is missing | Terminal success/cleanup handling and local-terminal fallback exist | Leidos says CANCELLED is terminal | FP | Preserve | None identified | Cancel success/no-stamp fixture |
| SP-25 | RETRIEVE is missing | Metadata retrieval, retries, snapshots, and post-action sync exist | Leidos recommends retrieve after change notification | FP | Preserve | None identified | Existing retrieve comparisons |
| SP-26 | LAB/production gating is unsafe | Production requires `PRODUCTION` plus explicit operational flag; LAB requires acknowledgement; runner asserts LAB | Leidos separates test and operations | FP | Preserve fail-closed behavior | High only if later regressed | Existing environment tests |
| SP-27 | Pilot name/phone requirements are absent | Name and phone are locally required for FILE/AMEND | Leidos/FAA supplementary data supports pilot contact; exact WSDL constraints unknown | FP | Preserve; confirm only detailed constraints | None for presence | Missing phone/name tests |
| SP-28 | Aircraft profile readiness is absent | Route/profile readiness and aircraft filing fields exist | Exact WSDL profile contract unavailable | DC | Confirm field constraints, not implementation existence | Edge values may be rejected | WSDL-derived profile fixtures |
| SP-29 | Aircraft home base is not transmitted | `aircraftHomeBase` is required and appended | Exact WSDL field constraint unavailable | FP | Preserve | None identified | Existing payload test |
| SP-30 | Aircraft type/ZZZZ TYP/WTC handling is absent | Type normalization, TYP injection, and WTC validation exist | FAA Items 9/18 | FP | Preserve | None identified | Existing ZZZZ/type tests |
| SP-31 | Equipment validation is absent | Known codes, duplicates, and provider subset are validated | FAA Field 10; provider subset needs current contract | FP | Preserve core validation; confirm subset | Unsupported edge code may be rejected | Existing negative equipment cases |
| SP-32 | PBN dependency validation is absent | R/PBN and sensor dependency checks exist | FAA says R without PBN rejects | FP | Preserve | None identified | Existing PBN negative tests |
| SP-33 | Surveillance support is definitively incomplete | RSF accepts provider-specific N/A/C/S direct values | FAA permits broader ICAO values; Leidos-specific accepted set is WSDL/vendor dependent | DC | Confirm Leidos REST field contract before broadening | Speculative broadening could send rejected values | WSDL-derived supported/unsupported cases |
| SP-34 | Special Z equipment should always hard-fail | Readiness distinguishes errors and warnings based on dependency | FAA says Z requires NAV/COM/DAT context; exact provider handling varies | DC | Validate exact combinations against current contract | Wrong severity for edge combinations | Table-driven Z dependency tests |
| SP-35 | All Field 18 grammar is known to be incomplete | Parser supports documented prefixes and local provider-safe limits | Leidos page says its field page is incomplete; XML unavailable | DC | Do not expand/relax until contract confirmed | False rejection or provider rejection at edges | WSDL/Leidos fixture corpus |
| SP-36 | RMK is moved out of Field 18 | RMK is preserved/merged in `otherInfo`; supplemental remains separate | Leidos says RMK pertains to Field 18 | FP | Preserve | Regression would alter ATC remarks | Existing RMK tests |
| SP-37 | Supplemental remarks are mixed with Field 18 | Separate `suppRemarksExtended` handling and comparison exist | Leidos says Field 19 remarks use extended field | FP | Preserve | None identified | Existing separation tests |
| SP-38 | ZZZZ DEP/ is missing | DEP builder/validation exists | FAA Appendix 1 | FP | Preserve | None identified | Existing ZZZZ tests |
| SP-39 | ZZZZ DEST/ is missing | DEST builder/validation exists | FAA Appendix 1 | FP | Preserve | None identified | Existing ZZZZ tests |
| SP-40 | ZZZZ ALTN/ is missing or uses ALT/ | ALTN builder exists and avoids ALT/ | FAA Appendix 1 | FP | Preserve | None identified | Existing ZZZZ tests |
| SP-41 | DOF handling is missing | Operational-date DOF injection exists | FAA Item 18 DOF | FP | Preserve; make tests clock-safe | None identified | Same-day/future tests |
| SP-42 | Browser/server timezone drives filing | Departure airport/planning-reference timezone drives UTC conversion | FAA requires UTC departure time | FP | Preserve | None identified | Central, Phoenix, ZZZZ tests |
| SP-43 | Provider changes overwrite local state silently | Provider snapshots/diffs and pending-review flag exist | Leidos exposes expectedRoute/current route distinctions | FP | Preserve | None identified | Existing route comparison/review tests |
| SP-44 | User can edit without acknowledging provider changes | Validation blocks provider actions while pending review; accept endpoint exists | Leidos route-change flow distinguishes proposed expectedRoute from accepted route | FP | Preserve | None identified | Pending/accepted action tests |
| SP-45 | Saved history lacks terminal sorting/history | History and current/past sorting exist | RSF product requirement | FP | Preserve | None identified | Existing sorting tests |
| SP-46 | LAB test plans are not visibly marked | Badge, filter, and cleanup action exist | RSF safety requirement | FP | Add UI regression coverage, no runtime change | Visual regression could confuse testers | Component/screenshot test |
| SP-47 | Certification cleanup is unsafe | Cleanup is current-run scoped; terminal plans are skipped; background certification sync is disabled | RSF safety requirement | FP | Preserve | None identified | Endpoint tests for cleanup reasons |
| SP-48 | Range/resume is missing | `--start-case`, `--end-case`, and `--only-cases` exist | RSF runner requirement | FP | Add parser tests | None identified | Case selection unit tests |
| SP-49 | Three-minute delay is not applied | Confirmed non-dry loop awaits countdown before each case after first | RSF runner requirement | FP | Add fake-clock test | Regression could flood LAB | Assert N-1 delay applications |
| SP-50 | Negative cases reach Leidos | Validation precedes provider calls and cases 10-15 expect local blocking | FAA/local safety requirement | FP | Keep in unified gate | Regression could submit invalid tests | Negative cases with provider-call spy |
| SP-51 | Fuel/endurance is missing | Endurance is required and transmitted as ISO duration | Leidos FILE example includes fuelOnBoard duration | FP | Preserve | None identified | Existing missing-endurance test |
| SP-52 | Persons on board field is certainly correct | RSF sends `peopleOnBoardExtended`; XML unavailable | FAA requires Item 19; exact REST field is WSDL-dependent | DC | Confirm name/range from XML | Edge payload rejection | WSDL-derived bounds tests |
| SP-53 | Aircraft color validation is complete | Extended color is normalized/transmitted; focused bounds tests are absent | Leidos public page describes extended color | BP | Add allowed-value/length tests | Avoidable provider rejection | Table-driven color tests |
| SP-54 | Type-of-flight validation is complete | Value is required and transmitted, but enum enforcement is not focused | FAA permits G/S/N/M/X | BP | Enforce typed enum locally | Invalid custom value could reach provider | Five valid plus invalid cases |
| SP-55 | Altitude/speed formatting is complete | A/F altitude and knots are emitted | FAA Item 15 defines formats | BP | Add exact boundary tests | Formatting regression may be provider-rejected | A/F threshold and zero-padding tests |
| SP-56 | Route formatting/change comparison is absent | DCT normalization, object extraction, and meaningful-change comparison exist | FAA Item 15 and Leidos expectedRoute behavior | FP | Preserve | None identified | Existing workflow/round-trip tests |
| SP-57 | Duplicate webhook delivery is fully proven | Event IDs/upsert behavior reduce duplicates, but no end-to-end duplicate test exists | Leidos pushes can be retried; exact retry contract needs confirmation | BP | Add idempotency test | Duplicate history/notifications | Send same fixture twice |
| SP-58 | Terminal plans are guaranteed retrievable | Local fallback already handles missing terminal provider data | Leidos says terminal plans are not guaranteed retrievable | FP | Preserve | None identified | Purged terminal fixture |
| SP-59 | Reports cleanly separate result classes | Live runner has provider, validation, test-design, warning/info, cleanup summaries | RSF evidence requirement | FP | Preserve and verify in next run | None identified | Artifact schema assertions |
| SP-60 | Latest retained artifact proves full readiness | Latest committed run is partial, not all 15 current cases | Evidence claim only | BP | Do not label ready until a fresh complete run passes | Review begins with incomplete evidence | Full-run selection/execution assertion |

## Prioritized Implementation Plan

### Phase 1: Must Fix Before Sean/Will LAB Review

1. Return the documented Leidos webhook acknowledgement body.
2. Eliminate raw webhook payload logging and add redaction regression coverage.
3. Create one comprehensive Flight Service release gate.
4. Make date-sensitive test fixtures stable and investigate every remaining failure.

### Phase 2: Should Fix Before Certification Package

1. Add direct webhook auth, success-contract, duplicate, malformed, and unmatched-plan tests.
2. Obtain and checksum the current `WebService.xml`; derive contract fixtures.
3. Confirm LAB webhook registration and run one coordinated push/retrieve test.
4. Run all 15 certification cases with the configured delay and freeze artifacts.
5. Add CLI selection/delay and artifact-schema tests.

### Phase 3: Later Hardening

1. Decide whether credentialed pilot filing and ATC Notices are product scope.
2. Add 27-day, cutoff, color, type-of-flight, altitude, speed, and Field 18 boundary validation after contract confirmation.
3. Generate provider boundary types from the approved contract.
4. Add capability-aware integration health checks.

## Phase 1 Guardrails

- Do not add `webUserName` until scope and secure account handling are defined.
- Do not alter production enablement or provider endpoints.
- Preserve current FILE/AMEND/ACTIVATE/CLOSE/CANCEL/RETRIEVE behavior.
- Keep LAB and production gates fail-closed.
- Never include raw provider payloads, credentials, names, phone numbers, or supplementary pilot data in logs or test output.

## Phase 1 Implementation Result

Completed on 2026-07-09:

- Authenticated webhook deliveries now return the documented `{"success":"true"}` body.
- The unmatched-push log no longer includes the raw payload; it records structural key names only.
- Webhook contract/redaction regression tests were added.
- `npm run test:flight-service` is now the unified release gate and includes detailed filing validation, workflow, history sorting, provider notification formatting, webhook contract, and route security tests.
- Date-sensitive filing fixtures now use a future-relative operational date.
- The full release gate passes **91/91**.

No provider endpoint, production enablement, lifecycle behavior, or credentialed filing behavior was changed.
