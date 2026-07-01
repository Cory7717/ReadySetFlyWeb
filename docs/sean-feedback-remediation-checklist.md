# Sean Feedback Remediation Checklist

Purpose: map Flight Service review feedback and observed certification blockers to remediation status, likely code area, manual certification coverage, automated test intent, and evidence needed before requesting another review.

Status values:
- `fixed`: code exists but still needs final review evidence.
- `needs verification`: behavior was changed or partially covered, but must be proven in lab/manual review.
- `open`: not complete or not yet verified enough for production certification.

| ID | Feedback / issue | Status | Code area likely affected | Manual test case ID | Automated test planned | Verification evidence needed |
| --- | --- | --- | --- | --- | --- | --- |
| SF-01 | Public users must not accidentally live-file during testing | needs verification | `server/routes.ts`, entitlement/lab gating, planner UI | TC-FS-001, TC-FS-003, TC-FS-007 | yes | Screenshot of gated UI, API 403/log showing no provider call |
| SF-02 | Only authorized testers should access filing workflow | needs verification | auth/session middleware, flight planner route guards | TC-FS-004, TC-FS-005, TC-FS-011 | yes | Tester and non-tester account screenshots |
| SF-03 | Google login should not overwrite RSF profile name | fixed | auth profile merge logic | TC-FS-009, TC-FS-010, TC-FS-013 | no | Two-device profile screenshots |
| SF-04 | New plan must not inherit stale provider errors | fixed | `client/src/pages/flight-planner.tsx` state reset | TC-FS-017, TC-FS-029 | yes | Automated test plus screen recording |
| SF-05 | Clear/reset must remove validation and provider errors | fixed | planner reset state | TC-FS-027, TC-FS-028, TC-FS-029 | yes | Automated test and UI verification |
| SF-06 | Required field validation must block before provider calls | needs verification | filing validation service, route action handlers | TC-FS-033 through TC-FS-038 | yes | Network trace proving no provider request |
| SF-07 | Missing altitude must block before provider call | fixed | filing validation | TC-FS-065 | yes | Automated test result |
| SF-08 | Missing or unconfirmed fuel must block or warn clearly | needs verification | filing validation, fuel confirmation UI | TC-FS-063, TC-FS-064 | partial | Automated missing-fuel test, manual unconfirmed-fuel evidence |
| SF-09 | Changed planned departure date/time must be used immediately | fixed | local time conversion, payload builder | TC-FS-053 | yes | Automated test plus payload log |
| SF-10 | Zulu conversion must be correct for Central and Phoenix | needs verification | time zone helper, payload builder | TC-FS-051, TC-FS-052, TC-FS-055 | yes | Payload examples with local and UTC values |
| SF-11 | DOF generation must match local flight date | needs verification | DOF injection, Field 18 builder | TC-FS-057 through TC-FS-062 | yes | Payload logs for VFR/IFR cases |
| SF-12 | Invalid aircraft equipment such as SCE must be blocked locally | fixed | equipment validation, payload staging | TC-FS-045, TC-FS-046 | yes | Automated test and no provider call evidence |
| SF-13 | Aircraft equipment must remain separate from surveillance equipment | needs verification | equipment normalization, aircraft profile defaults | TC-FS-048 | yes | Payload proving `aircraftEquipment` and `surveillanceEquipment` are distinct |
| SF-14 | R equipment requires PBN data | needs verification | equipment validation, Field 18 UI | TC-FS-049 | yes | Local validation or guided UI evidence |
| SF-15 | Surveillance equipment list must include valid options | needs verification | aircraft equipment UI dropdown | TC-FS-050 | no | Dropdown screenshot and valid payload example |
| SF-16 | Aircraft Type ZZZZ must use TYP/actual type, not TYPE/ | fixed | ICAO otherInfo builder | TC-FS-040 through TC-FS-044 | yes | Payload with `aircraftType: ZZZZ` and `TYP/TBM700` |
| SF-17 | Aircraft Identifier must not be changed to ZZZZ for this test | fixed | UI labels, payload builder | TC-FS-042 | yes | Payload showing normal N-number |
| SF-18 | Field 18 and supplemental remarks must stay separate | needs verification | payload builder, retrieve comparison | TC-FS-079, TC-FS-081, TC-FS-082 | yes | Automated comparison and provider payload evidence |
| SF-19 | Supplemental remarks should not be invalid ICAO Field 18 data | needs verification | remarks builder, ZZZZ supplemental helper | TC-FS-082, TC-FS-085 | yes | Lab filing result and payload log |
| SF-20 | Pilot phone must be included and retrieve differences flagged | fixed | payload builder, retrieve compare | TC-FS-087, TC-FS-091, TC-FS-156 | yes | Automated test plus retrieve diff sample |
| SF-21 | Aircraft home base must be included and retrieve differences flagged | fixed | payload builder, retrieve compare | TC-FS-088, TC-FS-092, TC-FS-157 | yes | Automated test plus retrieve diff sample |
| SF-22 | Route default Direct must not auto-load route-assist waypoints | needs verification | route builder state, map rendering | TC-FS-018, TC-FS-072 | no | Screenshot selecting Phoenix to Austin Exec with direct only |
| SF-23 | DCT should not be treated as aviation weather station | fixed | VFR weather advisory token filtering | TC-FS-073 | yes | Log showing filtered DCT and no `/aviation-weather/DCT` |
| SF-24 | IFR route blank must block locally | fixed | route validation | TC-FS-037, TC-FS-070 | yes | Validation test and UI evidence |
| SF-25 | ZZZZ departure must require actual SAR location | needs verification | ZZZZ UI, validation, payload builder | TC-FS-093 through TC-FS-098 | yes | Payload `departure: ZZZZ`, `DEP/...` |
| SF-26 | ZZZZ destination must require actual SAR location | needs verification | ZZZZ UI, validation, payload builder | TC-FS-099 through TC-FS-104 | yes | Payload `destination: ZZZZ`, `DEST/...` |
| SF-27 | ZZZZ alternate must use ALTN, not ALT | fixed | ICAO otherInfo builder | TC-FS-105 through TC-FS-110 | yes | Payload `ALTN/3839N09045W` or `ALTN/85TX` |
| SF-28 | FAA/private field code mode must persist for departure | fixed | planner state persistence, payload builder | TC-FS-094, TC-FS-111, TC-FS-115 | yes | Save/reload evidence and `DEP/85TX` payload |
| SF-29 | FAA/private field code mode must persist for destination | fixed | planner state persistence, payload builder | TC-FS-100, TC-FS-112, TC-FS-115 | yes | Save/reload evidence and `DEST/85TX` payload |
| SF-30 | FAA/private field code mode must persist for alternate | fixed | planner state persistence, payload builder | TC-FS-106, TC-FS-113, TC-FS-115 | yes | Save/reload evidence and `ALTN/85TX` payload |
| SF-31 | FAA/private code must not append airport name in Field 18 | fixed | ZZZZ location formatter | TC-FS-114 | yes | Automated ZZZZ tests, payload with code only |
| SF-32 | Lat/long ZZZZ should include human-readable description | needs verification | ZZZZ UI, validation, Field 18 preview | TC-FS-120, TC-FS-122 | yes | UI preview and payload evidence |
| SF-33 | Provider sync must detect provider-originated changes accurately | needs verification | provider sync service, diff comparison | TC-FS-159 through TC-FS-164 | yes | Sync logs and Filing History entries |
| SF-34 | Provider push notifications must appear without reload | open | realtime notification channel, query invalidation | TC-FS-165 | yes | Live browser proof with simulated provider push |
| SF-35 | Provider push notifications must not auto-accept changes | fixed | provider review workflow | TC-FS-166 | yes | Push creates review, user must accept manually |
| SF-36 | Provider notifications must show what changed | fixed | `ProviderChangeSummaryView`, notifications UI | TC-FS-167, TC-FS-188 | yes | Card showing Added/Removed/Unchanged summary |
| SF-37 | `[object Object]` must never display in provider metadata | fixed | notification formatter, provider detail rendering | TC-FS-080, TC-FS-163, TC-FS-170 | yes | UI screenshot with formatted ARTCC/provider info |
| SF-38 | Provider duplicate webhooks should not duplicate history | needs verification | provider webhook handler, filing history | TC-FS-164, TC-FS-169 | yes | Same version pushed twice, one visible entry |
| SF-39 | Closed/cancelled plans must not expose operational action buttons | fixed | lifecycle action policy, saved plan card | TC-FS-140, TC-FS-143, TC-FS-151, TC-FS-171 through TC-FS-176 | yes | Automated lifecycle test plus UI screenshot |
| SF-40 | Closed/cancelled plans should move to Past Flight Plans | needs verification | saved plans sorting/grouping | TC-FS-023, TC-FS-024, TC-FS-144, TC-FS-150 | yes | Saved list screenshot |
| SF-41 | Flight Planner should be easy to find from home/nav | needs verification | home page CTA, navigation | TC-FS-183 | no | Screenshot from logged-in home page |
| SF-42 | Raw internal provider name must not show as `leidos_flight_service` | fixed | display label formatter | TC-FS-185 | no | Plan card screenshot reading FAA Flight Service |
| SF-43 | Provider errors should be readable and specific | needs verification | toast/error cards, provider action catch blocks | TC-FS-177, TC-FS-178, TC-FS-186 | yes | Rejection examples with field-specific messages |
| SF-44 | File response with only `flightIdentifier` must still record provider reference | fixed | provider response parser | TC-FS-126 | yes | Lab response log and stored reference |
| SF-45 | Filing history should include Flight Service changes | fixed | filing history builder, provider webhook/sync | TC-FS-168 | yes | History screenshot under Flight Service |
| SF-46 | TFR upstream degradation should not break filing workflow | needs verification | TFR fetch fallback, planner hazards panel | TC-FS-179 | no | TFR 403/502 log plus successful filing |
| SF-47 | Logs must redact pilot data and avoid sensitive fields | needs verification | structured logging | TC-FS-084, TC-FS-128, TC-FS-181, TC-FS-193 | yes | Log samples showing redaction |
| SF-48 | Filing endpoints need auth, tester, webhook, and rate-limit protections | open | API middleware, webhook validation, rate limiter | TC-FS-189 through TC-FS-194 | yes | API test evidence and security review |
| SF-49 | Existing filing validation regression suite must pass | needs verification | `scripts/tests/flight-plan-filing-validation.test.ts` | TC-FS-198 | yes | Command output |
| SF-50 | Certification package must be frozen before requesting review | open | docs, evidence folder/process | TC-FS-195 through TC-FS-200 | no | Completed matrix, screenshots, logs, command output |
