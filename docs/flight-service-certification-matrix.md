# RSF Flight Service Production Certification Matrix

Purpose: move Ready Set Fly Flight Planner from reactive fixes to a repeatable production-readiness test process before requesting another Flight Service review.

Rules for execution:
- Run these tests in lab/test mode unless the test explicitly says production review.
- Do not use operational live filing for ad hoc tests.
- Record pass/fail, tester, browser/device, date/time, plan ID, provider reference, and evidence.
- Any failure that reaches Flight Service when RSF should have blocked locally is a release blocker.

## 1. Public safety / lab mode gating

| Test ID | Description | Preconditions | Steps | Expected result | Pass/fail | Notes |
| --- | --- | --- | --- | --- | --- | --- |
| TC-FS-001 | Confirm public filing is gated | Public user account | Open planner and attempt live file | Live filing is unavailable unless allowed | TBD | Release blocker |
| TC-FS-002 | Confirm lab banner is visible | Lab mode enabled | Open planner | Testing notice is visible and readable | TBD | Sean UI item |
| TC-FS-003 | Confirm production flag off blocks provider call | Provider env disabled | Click File | RSF blocks before provider request | TBD | Capture logs |
| TC-FS-004 | Confirm allowed tester can see filing tools | Authorized tester | Open saved plan | File workflow is available | TBD | Verify account |
| TC-FS-005 | Confirm unauthorized account cannot file | Non-tester account | Open planner | File controls hidden or blocked | TBD | Security |
| TC-FS-006 | Confirm safety copy is sober and branded | Any account | Inspect notice | No Leidos branding unless required | TBD | UI |
| TC-FS-007 | Confirm no accidental production submit in lab | Lab credentials | Attempt File | Endpoint is lab endpoint only | TBD | Network trace |

## 2. Authentication and authorized tester access

| Test ID | Description | Preconditions | Steps | Expected result | Pass/fail | Notes |
| --- | --- | --- | --- | --- | --- | --- |
| TC-FS-008 | Email/password login works for tester | Tester exists | Login with email/password | Planner opens as same RSF profile | TBD | Auth |
| TC-FS-009 | Google login maps by email | Same email Google account | Login with Google | Same RSF user/profile is loaded | TBD | No duplicate identity |
| TC-FS-010 | Profile name remains RSF name | RSF profile has custom name | Login with Google | RSF name is preferred over Google name | TBD | Regression |
| TC-FS-011 | Tester allow-list is enforced | Allow-list configured | Login as unlisted user | Filing is blocked | TBD | Security |
| TC-FS-012 | Session refresh keeps tester permissions | Tester logged in | Refresh planner | Filing access remains correct | TBD | Browser |
| TC-FS-013 | Two computers show same profile | Same account on two PCs | Refresh both | Same name and filing state show | TBD | Prior bug |
| TC-FS-014 | Logout clears provider-sensitive state | Logged in tester | Logout/login as other user | No prior provider data leaks | TBD | Security |

## 3. New flight plan creation

| Test ID | Description | Preconditions | Steps | Expected result | Pass/fail | Notes |
| --- | --- | --- | --- | --- | --- | --- |
| TC-FS-015 | Create VFR direct plan | Tester logged in | Start new VFR plan | Plan starts clean with DCT route | TBD | No stale data |
| TC-FS-016 | Create IFR plan | Tester logged in | Start IFR plan | IFR required fields appear | TBD | UI |
| TC-FS-017 | New plan does not inherit provider errors | Prior failed plan exists | Start new plan | No stale provider error banner | TBD | Automated |
| TC-FS-018 | New plan default route is direct | Airports selected | Select departure/destination | Map shows direct route only | TBD | No route assist waypoints |
| TC-FS-019 | Departure/destination entry does not open plates | Planner route tab | Type airport IDs | Plates do not auto-open per letter | TBD | UI |
| TC-FS-020 | New plan saves draft | Required draft fields | Save plan | Draft appears in saved plans | TBD | Persistence |

## 4. Saved flight plans

| Test ID | Description | Preconditions | Steps | Expected result | Pass/fail | Notes |
| --- | --- | --- | --- | --- | --- | --- |
| TC-FS-021 | Open saved draft | Saved draft exists | Open plan | Draft fields load accurately | TBD | Persistence |
| TC-FS-022 | Current plans section prioritizes review | Plan needing review exists | Open saved list | Review plan is visible at top group | TBD | UI |
| TC-FS-023 | Closed plan moves to past section | Closed plan exists | Open saved list | Plan is in Past Flight Plans | TBD | UI |
| TC-FS-024 | Cancelled plan moves to past section | Cancelled plan exists | Open saved list | Plan is in Past Flight Plans | TBD | UI |
| TC-FS-025 | Provider review overrides past grouping | Closed-looking plan has unresolved review | Open saved list | Plan remains current | TBD | Safety |
| TC-FS-026 | Saved list sorting is stable | Multiple statuses | Refresh list | Order remains predictable | TBD | UI |

## 5. Clear/reset form behavior

| Test ID | Description | Preconditions | Steps | Expected result | Pass/fail | Notes |
| --- | --- | --- | --- | --- | --- | --- |
| TC-FS-027 | Clear form removes route fields | Draft with data | Click clear/reset | Route fields reset | TBD | UI |
| TC-FS-028 | Clear form removes validation errors | Plan has errors | Click clear/reset | Error banners clear | TBD | Automated |
| TC-FS-029 | Clear form removes provider errors | Prior provider error | Click clear/reset | Provider error gone | TBD | Automated |
| TC-FS-030 | Clear form clears provider IDs | Prior filed plan loaded | Clear/new plan | No provider reference remains | TBD | Safety |
| TC-FS-031 | Reset does not delete saved plan | Saved plan loaded | Clear form | Saved record remains unless deleted | TBD | Data |
| TC-FS-032 | Scratch pad survives only if intended | Scratch pad content | Clear planner | Behavior matches product decision | TBD | UI |

## 6. Required field validation

| Test ID | Description | Preconditions | Steps | Expected result | Pass/fail | Notes |
| --- | --- | --- | --- | --- | --- | --- |
| TC-FS-033 | Missing departure blocked | Plan missing departure | File | Local validation blocks | TBD | No provider call |
| TC-FS-034 | Missing destination blocked | Plan missing destination | File | Local validation blocks | TBD | No provider call |
| TC-FS-035 | Missing aircraft identifier blocked | Plan missing tail/callsign | File | Clear field-specific error | TBD | No provider call |
| TC-FS-036 | Missing aircraft type blocked | Plan missing type | File | Clear error | TBD | No provider call |
| TC-FS-037 | Missing route for IFR blocked | IFR route blank | File | IFR route error shown | TBD | Existing rule |
| TC-FS-038 | Required errors are readable | Multiple missing fields | File | Error text lists each missing field | TBD | Sean UI item |

## 7. ICAO aircraft fields

| Test ID | Description | Preconditions | Steps | Expected result | Pass/fail | Notes |
| --- | --- | --- | --- | --- | --- | --- |
| TC-FS-039 | Normal aircraft type files | Type DA42 | Build payload | aircraftType remains DA42 | TBD | Regression |
| TC-FS-040 | Aircraft type ZZZZ requires actual type | Type ZZZZ, no actual | File | Local validation blocks | TBD | No provider call |
| TC-FS-041 | Aircraft type ZZZZ emits TYP | Actual type TBM700 | Build payload | otherInfo includes TYP/TBM700 | TBD | Leidos fix |
| TC-FS-042 | Aircraft identifier is not ZZZZ-tested | Tail N111CA | Build payload | aircraftIdentifier remains N111CA | TBD | Guidance |
| TC-FS-043 | Actual aircraft type normalizes uppercase | actual tbm700 | Build payload | TYP/TBM700 | TBD | Formatting |
| TC-FS-044 | Legacy TYPE normalizes to TYP | Saved TYPE/TBM700 | File | Payload contains TYP not TYPE | TBD | Regression |

## 8. Equipment and surveillance validation

| Test ID | Description | Preconditions | Steps | Expected result | Pass/fail | Notes |
| --- | --- | --- | --- | --- | --- | --- |
| TC-FS-045 | Invalid aircraft equipment SCE blocked | aircraftEquipment SCE | File | RSF blocks locally | TBD | Automated |
| TC-FS-046 | Invalid equipment blocked on amend | Filed plan with SCE | Amend | RSF blocks locally | TBD | Automated planned |
| TC-FS-047 | Valid SC allowed | aircraftEquipment SC | File | Payload build allowed | TBD | Automated |
| TC-FS-048 | Surveillance stays separate | equipment SC, surveillance S | Build payload | No merge into SCS | TBD | Regression |
| TC-FS-049 | R equipment requires PBN | aircraftEquipment R | File | PBN guidance/error if missing | TBD | Leidos |
| TC-FS-050 | Invalid surveillance code blocked | Unsupported surveillance | File | Local validation blocks | TBD | No provider call |

## 9. Planned departure date/time and Zulu conversion

| Test ID | Description | Preconditions | Steps | Expected result | Pass/fail | Notes |
| --- | --- | --- | --- | --- | --- | --- |
| TC-FS-051 | Central time converts to Zulu | CDT local time | Build payload | Correct UTC instant | TBD | Timezone |
| TC-FS-052 | Phoenix time no DST error | America/Phoenix | Build payload | Correct UTC instant | TBD | Regression |
| TC-FS-053 | Edited time is used immediately | Change time, do not manual save | File | Payload uses edited time | TBD | Automated |
| TC-FS-054 | Saved display time remains local | Save/reopen | Inspect plan | Local time shown correctly | TBD | UI |
| TC-FS-055 | Zulu label matches payload | Build payload | Compare UI and logs | Same Zulu time | TBD | Evidence |
| TC-FS-056 | Past departure time blocked or warned | Time in past | File | Clear warning/block per policy | TBD | Safety |

## 10. DOF generation

| Test ID | Description | Preconditions | Steps | Expected result | Pass/fail | Notes |
| --- | --- | --- | --- | --- | --- | --- |
| TC-FS-057 | IFR DOF generated | IFR future plan | Build payload | DOF/YYMMDD present | TBD | Regression |
| TC-FS-058 | VFR DOF policy matches provider | VFR plan | Build payload | DOF present only when required | TBD | Verify |
| TC-FS-059 | DOF matches planned date | Local date selected | Build payload | DOF equals local flight date | TBD | Timezone |
| TC-FS-060 | DOF not duplicated | Existing DOF in otherInfo | Build payload | One DOF only | TBD | Field 18 |
| TC-FS-061 | Provider DOF differences detected | Retrieve changed DOF | Sync | Provider review detects DOF | TBD | Compare |
| TC-FS-062 | DOF survives amend | Filed plan amended | Build amend | DOF remains correct | TBD | Lifecycle |

## 11. Fuel and altitude confirmation

| Test ID | Description | Preconditions | Steps | Expected result | Pass/fail | Notes |
| --- | --- | --- | --- | --- | --- | --- |
| TC-FS-063 | Missing fuel blocked | No endurance | File | Local validation blocks | TBD | Automated |
| TC-FS-064 | Unconfirmed fuel blocked or warned | Fuel unconfirmed | File | Policy is enforced | TBD | Manual until UI state exported |
| TC-FS-065 | Missing altitude blocked | No altitude | File | Local validation blocks | TBD | Automated |
| TC-FS-066 | VFR altitude type valid | VFR altitude | Build payload | altitudeTypeA emitted | TBD | Payload |
| TC-FS-067 | IFR flight level valid | IFR FL | Build payload | altitudeTypeF emitted | TBD | Payload |
| TC-FS-068 | Fuel duration formatting valid | Endurance entered | Build payload | PTnHnM format | TBD | Provider |

## 12. Route handling and DCT normalization

| Test ID | Description | Preconditions | Steps | Expected result | Pass/fail | Notes |
| --- | --- | --- | --- | --- | --- | --- |
| TC-FS-069 | Direct route remains DCT | Route DCT | Build payload | route DCT | TBD | Regression |
| TC-FS-070 | IFR route requires content | IFR route blank | File | Local validation blocks | TBD | Required |
| TC-FS-071 | Route builder route persists | Route assist selected | Save/reopen | Waypoints remain | TBD | UI |
| TC-FS-072 | Direct mode suppresses route assist waypoints | Direct selected | Select airports | Only direct line shown | TBD | Prior bug |
| TC-FS-073 | DCT not weather-fetched | VFR DCT | Run advisory | No /aviation-weather/DCT | TBD | Risk analyzer |
| TC-FS-074 | Provider route changes need review | Sync changed route | Open updates | Route diff shown | TBD | Provider |

## 13. Field 18 / Other Info

| Test ID | Description | Preconditions | Steps | Expected result | Pass/fail | Notes |
| --- | --- | --- | --- | --- | --- | --- |
| TC-FS-075 | PBN retained | PBN entered | Build payload | PBN present | TBD | Regression |
| TC-FS-076 | RMK retained | RMK entered | Build payload | RMK present | TBD | Field 18 |
| TC-FS-077 | TYP retained for ZZZZ type | aircraftType ZZZZ | Build payload | TYP present | TBD | Regression |
| TC-FS-078 | ALTN used for alternate | Alternate ZZZZ | Build payload | ALTN not ALT | TBD | Leidos fix |
| TC-FS-079 | Field 18 not mixed with supplemental | Field 18 and supp remarks | Retrieve compare | Separate fields | TBD | Automated |
| TC-FS-080 | Objects never render as object Object | Provider metadata object | Show notification | Human text or omitted | TBD | UI |

## 14. Supplemental remarks

| Test ID | Description | Preconditions | Steps | Expected result | Pass/fail | Notes |
| --- | --- | --- | --- | --- | --- | --- |
| TC-FS-081 | Supplemental remarks included when supported | Remarks entered | Build payload | remarks/supp fields as designed | TBD | Verify |
| TC-FS-082 | Supplemental remarks not invalid Field 18 | ZZZZ remarks | File | No invalid supplemental rejection | TBD | Regression |
| TC-FS-083 | Internal notes do not go to provider | Internal note entered | Build payload | Note absent from provider payload | TBD | Privacy |
| TC-FS-084 | Redacted logs hide remarks content | Payload log | Inspect logs | Sensitive text redacted | TBD | Security |
| TC-FS-085 | ZZZZ names not duplicated in supplemental | Private field code used | Build payload | No duplicate field name | TBD | Automated |
| TC-FS-086 | Long remarks length handled | Long text | File | Block or truncate per provider limit | TBD | Negative |

## 15. Phone number and aircraft home base

| Test ID | Description | Preconditions | Steps | Expected result | Pass/fail | Notes |
| --- | --- | --- | --- | --- | --- | --- |
| TC-FS-087 | Phone included in payload | Pilot phone saved | Build payload | pilotPhone present | TBD | Automated |
| TC-FS-088 | Home base included in payload | Home base saved | Build payload | aircraftHomeBase present | TBD | Automated |
| TC-FS-089 | Missing phone blocked or warned | No phone | File | Clear message | TBD | Required |
| TC-FS-090 | Invalid phone blocked | Bad phone | File | Local validation blocks | TBD | Provider |
| TC-FS-091 | Retrieve missing phone flagged | Retrieved missing phone | Compare | Difference flagged | TBD | Automated |
| TC-FS-092 | Retrieve missing home base flagged | Retrieved missing home base | Compare | Difference flagged | TBD | Automated |

## 16. ZZZZ departure

| Test ID | Description | Preconditions | Steps | Expected result | Pass/fail | Notes |
| --- | --- | --- | --- | --- | --- | --- |
| TC-FS-093 | ZZZZ departure requires actual location | Departure ZZZZ | File without location | Local validation blocks | TBD | Safety |
| TC-FS-094 | ZZZZ departure FAA code persists | DEP code 85TX | Save/reopen | 85TX remains selected | TBD | Regression |
| TC-FS-095 | ZZZZ departure emits DEP/85TX | DEP code 85TX | Build payload | DEP/85TX once | TBD | Automated |
| TC-FS-096 | ZZZZ departure lat/long emits DEP coords | Lat/long mode | Build payload | DEP/coords description | TBD | Provider |
| TC-FS-097 | Departure planning reference not sent as actual | Ref KEDC, actual 85TX | Build payload | departure ZZZZ, DEP/85TX | TBD | SAR |
| TC-FS-098 | ZZZZ departure description required for coords | Coordinates no description | File | Local validation blocks | TBD | Leidos feedback |

## 17. ZZZZ destination

| Test ID | Description | Preconditions | Steps | Expected result | Pass/fail | Notes |
| --- | --- | --- | --- | --- | --- | --- |
| TC-FS-099 | ZZZZ destination requires actual location | Destination ZZZZ | File without location | Local validation blocks | TBD | Safety |
| TC-FS-100 | ZZZZ destination FAA code persists | DEST code 85TX | Save/reopen | 85TX remains selected | TBD | Regression |
| TC-FS-101 | ZZZZ destination emits DEST/85TX | DEST code 85TX | Build payload | DEST/85TX once | TBD | Automated |
| TC-FS-102 | ZZZZ destination lat/long emits DEST coords | Lat/long mode | Build payload | DEST/coords description | TBD | Provider |
| TC-FS-103 | Destination planning reference not sent as actual | Ref KSDL, actual 85TX | Build payload | destination ZZZZ, DEST/85TX | TBD | SAR |
| TC-FS-104 | ZZZZ destination description required for coords | Coordinates no description | File | Local validation blocks | TBD | Leidos feedback |

## 18. ZZZZ alternate

| Test ID | Description | Preconditions | Steps | Expected result | Pass/fail | Notes |
| --- | --- | --- | --- | --- | --- | --- |
| TC-FS-105 | ZZZZ alternate requires actual location | Alternate ZZZZ | File without location | Local validation blocks | TBD | Safety |
| TC-FS-106 | ZZZZ alternate FAA code persists | ALTN code 85TX | Save/reopen | 85TX remains selected | TBD | Regression |
| TC-FS-107 | ZZZZ alternate emits ALTN/85TX | ALTN code 85TX | Build payload | ALTN/85TX once | TBD | Automated |
| TC-FS-108 | ZZZZ alternate never emits ALT | Alternate ZZZZ | Build payload | ALTN used, ALT absent | TBD | Leidos fix |
| TC-FS-109 | Alternate planning reference not sent as actual | Ref KSDL, actual 85TX | Build payload | altDestination1 ZZZZ, ALTN/85TX | TBD | SAR |
| TC-FS-110 | ZZZZ alternate description required for coords | Coordinates no description | File | Local validation blocks | TBD | Leidos feedback |

## 19. FAA/private field code handling

| Test ID | Description | Preconditions | Steps | Expected result | Pass/fail | Notes |
| --- | --- | --- | --- | --- | --- | --- |
| TC-FS-111 | Private code mode persists for departure | DEP mode identifier | Save/reopen | Mode remains identifier | TBD | UI |
| TC-FS-112 | Private code mode persists for destination | DEST mode identifier | Save/reopen | Mode remains identifier | TBD | UI |
| TC-FS-113 | Private code mode persists for alternate | ALTN mode identifier | Save/reopen | Mode remains identifier | TBD | UI |
| TC-FS-114 | Private code does not append name | Code 85TX with airport name | Build payload | Code only | TBD | Automated |
| TC-FS-115 | Duplicate subfields suppressed | Existing DEP plus generated DEP | Build payload | One DEP only | TBD | Field 18 |
| TC-FS-116 | Provider sync does not overwrite code | Synced filed plan | Refresh sync | Code remains local actual location | TBD | Persistence |

## 20. Lat/long handling

| Test ID | Description | Preconditions | Steps | Expected result | Pass/fail | Notes |
| --- | --- | --- | --- | --- | --- | --- |
| TC-FS-117 | Lat/long input accepts valid compact format | 3027N09749W | Save | Value persists | TBD | UI |
| TC-FS-118 | Lat/long input accepts slash format | 3027N/09749W | Save | Normalized provider value valid | TBD | UI |
| TC-FS-119 | Invalid lat/long blocked | Bad coordinate | File | Local validation blocks | TBD | Safety |
| TC-FS-120 | Lat/long description appended | Coords plus Private Strip | Build payload | DEP/coords PRIVATE STRIP | TBD | Leidos feedback |
| TC-FS-121 | Lat/long not used for identifier mode | Code mode 85TX | Build payload | No coordinate fallback | TBD | Regression |
| TC-FS-122 | Lat/long preview matches payload | Coords entered | Compare preview/log | Same text | TBD | Evidence |

## 21. FILE lifecycle

| Test ID | Description | Preconditions | Steps | Expected result | Pass/fail | Notes |
| --- | --- | --- | --- | --- | --- | --- |
| TC-FS-123 | File valid VFR | Valid VFR plan | File | Provider accepts, ID/version stored | TBD | Lab |
| TC-FS-124 | File valid IFR | Valid IFR plan | File | Provider accepts, ID/version stored | TBD | Lab |
| TC-FS-125 | File blocked on local validation | Invalid plan | File | No provider call | TBD | Negative |
| TC-FS-126 | File response with flightIdentifier accepted | Lab response lacks providerPlanId | File | RSF records usable reference | TBD | Prior issue |
| TC-FS-127 | File staged message is clear | Successful file | Inspect UI | Message shows state and next action | TBD | UX |
| TC-FS-128 | File logs redact sensitive data | File action | Inspect logs | PII redacted | TBD | Security |

## 22. AMEND lifecycle

| Test ID | Description | Preconditions | Steps | Expected result | Pass/fail | Notes |
| --- | --- | --- | --- | --- | --- | --- |
| TC-FS-129 | Amend filed plan | Filed plan | Change route and amend | Provider accepts new version | TBD | Lab |
| TC-FS-130 | Amend blocked when provider review pending | Plan has unresolved provider change | Amend | User must review first | TBD | Safety |
| TC-FS-131 | Amend uses latest edited fields | Edit date/route | Amend without manual save | Payload uses edits | TBD | Sean |
| TC-FS-132 | Amend validates equipment | SCE on filed plan | Amend | Local validation blocks | TBD | Automated planned |
| TC-FS-133 | Amend updates filing history | Amend success | Open history | Submitted changes shown | TBD | Audit |
| TC-FS-134 | Amend failure is readable | Provider rejects | Inspect UI | Clear provider message | TBD | UX |

## 23. ACTIVATE lifecycle

| Test ID | Description | Preconditions | Steps | Expected result | Pass/fail | Notes |
| --- | --- | --- | --- | --- | --- | --- |
| TC-FS-135 | Activate filed VFR plan | Filed plan | Activate | Provider state updates | TBD | Lab |
| TC-FS-136 | Activate button hidden when not filed | Draft plan | Inspect actions | Activate unavailable | TBD | UI |
| TC-FS-137 | Activate blocked with provider review pending | Review pending | Activate | User must review | TBD | Safety |
| TC-FS-138 | Activation notification specific | Activation success | Inspect notifications | Includes plan and state | TBD | UX |
| TC-FS-139 | Activate history entry shown | Activation success | Open history | Flight Service section updated | TBD | Audit |
| TC-FS-140 | Activate closed plan unavailable | Closed plan | Inspect actions | No Activate button | TBD | Automated |

## 24. CANCEL lifecycle

| Test ID | Description | Preconditions | Steps | Expected result | Pass/fail | Notes |
| --- | --- | --- | --- | --- | --- | --- |
| TC-FS-141 | Cancel filed plan | Filed plan | Cancel | Provider accepts cancel | TBD | Lab |
| TC-FS-142 | Cancel requires confirmation | Filed plan | Click cancel | Confirmation shown | TBD | UX |
| TC-FS-143 | Cancel button hidden on closed plan | Closed plan | Inspect actions | Cancel unavailable | TBD | Automated |
| TC-FS-144 | Cancelled plan moves to past | Cancel success | Open saved list | Past section | TBD | UI |
| TC-FS-145 | Cancelled plan no refile without new plan | Cancelled plan | Inspect actions | No File/Amend/Activate | TBD | Safety |
| TC-FS-146 | Cancel history entry shown | Cancel success | Open history | Cancel entry present | TBD | Audit |

## 25. CLOSE lifecycle

| Test ID | Description | Preconditions | Steps | Expected result | Pass/fail | Notes |
| --- | --- | --- | --- | --- | --- | --- |
| TC-FS-147 | Close activated plan | Activated plan | Close | Provider accepts close | TBD | Lab |
| TC-FS-148 | Close requires confirmation | Activated plan | Click close | Confirmation shown | TBD | UX |
| TC-FS-149 | Close hidden on draft | Draft plan | Inspect actions | Close unavailable | TBD | UI |
| TC-FS-150 | Closed plan moves to past | Close success | Open saved list | Past section | TBD | UI |
| TC-FS-151 | Closed plan no operational actions | Closed plan | Inspect actions | No File/Amend/Activate/Cancel | TBD | Automated |
| TC-FS-152 | Close history entry shown | Close success | Open history | Close entry present | TBD | Audit |

## 26. RetrieveFlightPlan verification

| Test ID | Description | Preconditions | Steps | Expected result | Pass/fail | Notes |
| --- | --- | --- | --- | --- | --- | --- |
| TC-FS-153 | Retrieve after file | Filed plan | Retrieve/sync | Provider fields stored | TBD | Lab |
| TC-FS-154 | Retrieve route comparison | Provider route differs | Sync | Difference shown | TBD | Review |
| TC-FS-155 | Retrieve otherInfo comparison | Provider otherInfo differs | Sync | Difference shown | TBD | Automated |
| TC-FS-156 | Retrieve phone missing flagged | Provider omits phone | Compare | Difference flagged | TBD | Automated |
| TC-FS-157 | Retrieve homebase missing flagged | Provider omits home base | Compare | Difference flagged | TBD | Automated |
| TC-FS-158 | Retrieve does not overwrite unresolved local edits | Unsaved local edits | Sync | User review required | TBD | Safety |

## 27. Provider sync accuracy

| Test ID | Description | Preconditions | Steps | Expected result | Pass/fail | Notes |
| --- | --- | --- | --- | --- | --- | --- |
| TC-FS-159 | Manual sync updates state | Provider changed | Click Refresh provider sync | Current state updates | TBD | Lab |
| TC-FS-160 | Sync stores version stamp | Provider response has version | Sync | Version stored | TBD | Audit |
| TC-FS-161 | Sync detects route change | Provider route changed | Sync | Route review item | TBD | Review |
| TC-FS-162 | Sync detects ARTCC state | ARTCC changed | Sync | ARTCC state displayed | TBD | Review |
| TC-FS-163 | Sync omits object Object | Metadata object | Sync and display | No object Object | TBD | Regression |
| TC-FS-164 | Duplicate sync does not duplicate history | Same version twice | Sync twice | One visible history entry | TBD | Audit |

## 28. Provider push notifications

| Test ID | Description | Preconditions | Steps | Expected result | Pass/fail | Notes |
| --- | --- | --- | --- | --- | --- | --- |
| TC-FS-165 | Push creates notification without reload | Websocket/SSE active | Simulate provider push | Notification appears live | TBD | Real-time |
| TC-FS-166 | Push does not auto-accept changes | Provider changed route | Simulate push | Manual accept still required | TBD | Safety |
| TC-FS-167 | Push change summary is specific | Provider changed otherInfo | Open notification | Added/removed summary shown | TBD | UX |
| TC-FS-168 | Push history under Flight Service | Provider push with changes | Open filing history | Flight Service section entry | TBD | Audit |
| TC-FS-169 | Duplicate push same version deduped | Same version push twice | Simulate twice | One visible entry | TBD | Audit |
| TC-FS-170 | Push metadata safely formatted | artccInfo object | Display notification | Human text or omitted | TBD | Regression |

## 29. Closed/cancelled plan behavior

| Test ID | Description | Preconditions | Steps | Expected result | Pass/fail | Notes |
| --- | --- | --- | --- | --- | --- | --- |
| TC-FS-171 | Closed plan hides file | Closed plan | Inspect actions | File hidden | TBD | Automated |
| TC-FS-172 | Closed plan hides amend | Closed plan | Inspect actions | Amend hidden | TBD | Automated |
| TC-FS-173 | Closed plan hides activate | Closed plan | Inspect actions | Activate hidden | TBD | Automated |
| TC-FS-174 | Closed plan hides cancel | Closed plan | Inspect actions | Cancel hidden | TBD | Automated |
| TC-FS-175 | Cancelled plan hides operational actions | Cancelled plan | Inspect actions | No operational actions | TBD | UI |
| TC-FS-176 | Past plan can still be opened read-only | Past plan | Open from past | Details visible, actions safe | TBD | UX |

## 30. Error handling and negative tests

| Test ID | Description | Preconditions | Steps | Expected result | Pass/fail | Notes |
| --- | --- | --- | --- | --- | --- | --- |
| TC-FS-177 | Provider 400 message shown | Mock provider 400 | File | Specific message visible | TBD | UX |
| TC-FS-178 | Failed fetch is not only message | Network failure | File | Actionable error shown | TBD | UX |
| TC-FS-179 | Access denied TFR does not block filing | TFR upstream 403 | File valid plan | Filing still possible | TBD | TFR |
| TC-FS-180 | Validation log emitted | Invalid plan | File | flight_plan_filing_validation_failed log | TBD | Automated |
| TC-FS-181 | No sensitive data in error logs | Validation/provider error | Inspect logs | PII absent/redacted | TBD | Security |
| TC-FS-182 | Negative tests do not call provider | Invalid fields | File | No provider endpoint request | TBD | Release blocker |

## 31. UI/UX issues from Sean's feedback

| Test ID | Description | Preconditions | Steps | Expected result | Pass/fail | Notes |
| --- | --- | --- | --- | --- | --- | --- |
| TC-FS-183 | Flight Planner discoverable from home | Logged in | Navigate from home | Start Flight Plan obvious | TBD | Sean |
| TC-FS-184 | Saved plan actions are visible | Filed plan | Open details | Actions not clipped/overlapped | TBD | Sean |
| TC-FS-185 | Provider label says FAA Flight Service | Plan details | Inspect provider | No leidos_flight_service raw label | TBD | Branding |
| TC-FS-186 | Error cards are readable | Trigger error | Inspect card | Contrast passes visual review | TBD | UI |
| TC-FS-187 | Mobile app promo not distracting | Planner header | Inspect desktop/mobile | Store badges fit cleanly | TBD | UI |
| TC-FS-188 | Provider changes are pilot-readable | Provider diff | Open card | Added/removed/unchanged summary | TBD | UX |

## 32. Security and bot/rate-limit protection

| Test ID | Description | Preconditions | Steps | Expected result | Pass/fail | Notes |
| --- | --- | --- | --- | --- | --- | --- |
| TC-FS-189 | Filing endpoints require auth | Logged out | Call filing API | 401/403 | TBD | Security |
| TC-FS-190 | Filing endpoints require tester/entitlement | Non-tester | Call filing API | 403 | TBD | Security |
| TC-FS-191 | Rate limit repeated filing attempts | Tester | Rapid invalid submits | Requests throttled/logged | TBD | Abuse |
| TC-FS-192 | Webhook validates source/secret | Bad webhook | POST webhook | Rejected | TBD | Security |
| TC-FS-193 | Logs redact pilot data | Provider action | Inspect logs | Phone/pilot data redacted | TBD | Security |
| TC-FS-194 | Bot protection does not block valid tester | Tester normal use | File once | Request allowed | TBD | UX |

## 33. Regression tests before production review

| Test ID | Description | Preconditions | Steps | Expected result | Pass/fail | Notes |
| --- | --- | --- | --- | --- | --- | --- |
| TC-FS-195 | Run TypeScript check | Clean branch | npm run check | Pass | TBD | Required |
| TC-FS-196 | Run flight-service automated tests | Clean branch | npm run test:flight-service | Pass | TBD | Required |
| TC-FS-197 | Run certification summary | Clean branch | npm run certification:flight-service | Summary plus pass | TBD | Required |
| TC-FS-198 | Run existing filing validation tests | Clean branch | npx tsx --test scripts/tests/flight-plan-filing-validation.test.ts | Pass | TBD | Regression |
| TC-FS-199 | Manual lab FILE/AMEND/ACTIVATE/CANCEL smoke | Lab credentials | Execute lifecycle | All pass with evidence | TBD | Required before review |
| TC-FS-200 | Freeze evidence package for Flight Service | All critical tests pass | Export logs/screenshots/matrix | Review package complete | TBD | Gate to request review |
