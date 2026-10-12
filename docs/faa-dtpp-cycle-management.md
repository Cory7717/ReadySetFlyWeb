# FAA d-TPP cycle management

RSF resolves the effective FAA d-TPP cycle automatically from the FAA's official
publication selector. It selects the cycle whose `0901Z` effective window
contains the current time, validates that cycle's XML root, effective dates,
chart mapping, and a representative PDF, and pre-validates (but does not activate)
the next published cycle.

## Production configuration

For normal automatic operation, remove these legacy Render variables:

- `FAA_DTPP_CYCLE`
- `FAA_DTPP_META_URL`
- `FAA_DTPP_PDF_BASE_URL`
- `FAA_DTPP_ZIP_URL`

`ENABLE_PLATE_CACHE_CRON` and `PLATE_CACHE_REFRESH_MS` may remain; they only
control eviction of per-airport metadata caches and do not select a cycle.

## Emergency override precedence

An explicit `FAA_DTPP_CYCLE`, `FAA_DTPP_META_URL`, or
`FAA_DTPP_PDF_BASE_URL` disables automatic selection. All supplied values must
resolve to the same four-digit cycle. A custom URL without a cycle in its path
also requires `FAA_DTPP_CYCLE`. URLs must be credential-free HTTPS URLs.

`FAA_DTPP_ZIP_URL` is retained only for compatibility/diagnostics. RSF does not
download the approximately gigabyte-scale ZIP in its on-demand chart path. A ZIP
setting by itself does not override automatic selection. When supplied alongside
an override, a recognizable ZIP effective date must agree with the XML effective
date.

## Cache and failure behavior

- Cycle discovery runs at startup and every six hours, with immediate discovery
  at an effective-window boundary.
- Concurrent refreshes share one promise. Failures enter a five-minute retry
  cooldown.
- The last validated cycle is retained in memory and optional Redis shared cache
  for 90 days. A refresh failure returns it only with `status: stale`,
  `stale: true`, and a warning.
- Per-airport metadata is keyed by cycle, retained for six hours, and keeps a
  separate last-known-good fallback. A failed active-cycle request can never be
  presented as a confirmed zero-result response.
- XML reads remain streamed and bounded. Validation reads at most 768 KiB and
  uses a PDF `HEAD`; routine airport lookup streams only until its airport block.
  No bulk d-TPP ZIP is downloaded.

## Deployment verification

1. Remove the four legacy cycle/URL variables above from the API service.
2. Deploy the API normally; no database migration is required.
3. Confirm a `faa_dtpp_cycle_resolved` log reports the expected cycle, effective
   dates, `status: current`, `provenance: faa-auto`, and next-cycle readiness.
4. Call `/api/plates/KAUS`; confirm `plates` remains an array and
   `referenceData` reports the current cycle.
5. Open Approach Plates in web and mobile and view a chart.
6. Confirm `/api/admin/approach-plates/status` exposes nonsensitive cycle-manager
   diagnostics.

Rollback consists of reverting the application changes and restoring one
coherent set of cycle/XML/PDF overrides. Do not restore `FAA_DTPP_ZIP_URL` as a
cycle-selection mechanism.
