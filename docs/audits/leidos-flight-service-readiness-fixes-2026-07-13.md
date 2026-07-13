# Leidos Flight Service Readiness Fixes - 2026-07-13

This addendum records the confirmed local fixes made after the Leidos Developer Reference Packet audit.

## Fixed

- Removed the stale, commented webhook notification/push block from `server/routes.ts` so the active implementation is unambiguous: provider lifecycle state is persisted before notification and Expo push side effects.
- Replaced Flight Service Ops/SAR placeholder retention text with an explicit operational-support retention notice.
- Replaced the SAR support-contact placeholder with `FLIGHT_SERVICE_OPS_SUPPORT_CONTACT`, falling back to `SUPPORT_EMAIL` and then `support@readysetfly.us`.
- Added Ops/SAR local-time display based on saved planner timezone state instead of showing UTC as local time.
- Added explicit SAR secondary/emergency-contact reporting: use saved planner emergency contact fields when present; otherwise report `Not recorded separately in RSF`.
- Added an explicit WSDL drift-check command:

```powershell
npm run flight-service:wsdl-check
```

## Current WSDL Evidence

Command run:

```powershell
npm run flight-service:wsdl-check
```

Result: PASS

| Environment | Status | Bytes | SHA-256 |
| --- | ---: | ---: | --- |
| LAB | 200 | 734350 | `1adb3b5b1c25124ac7e868db09700d121164f898d68bac0bd7645cc34ae57c4b` |
| Production | 200 | 734350 | `1adb3b5b1c25124ac7e868db09700d121164f898d68bac0bd7645cc34ae57c4b` |

Evidence artifact:

`certification-results/leidos-wsdl/leidos-wsdl-2026-07-13T15-33-03-067Z.json`

LAB and production WSDLs matched by checksum at the time of this check.

## Verification

Command run:

```powershell
npm run test:flight-service:release
```

Result: PASS

- `npm run check`: PASS
- `npm run test:flight-service`: PASS, 146 tests
- Adjacent non-live release-gate tests: PASS, 28 tests

No Leidos LAB or production provider submission command was run.

## Still Requires Leidos Confirmation

- Whether credentialed filing and `webUserName` are required for RSF's initial Sean/Will LAB review scope.
- Exact reconciliation procedure when a FILE request may have dispatched but no `flightIdentifier` is available to RSF.
- Whether `versionStamp` is strictly monotonic and authoritative for webhook ordering.
- Delayed webhook behavior after CLOSED/CANCELLED.
- Route Search coded-message taxonomy for no-route vs request validation failure.
- ARTCC-specific IFR amend/cancel cutoffs, including Release 11.3 behavior.
- Final Sean/Will evidence-package expectations.
